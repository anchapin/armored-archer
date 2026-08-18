extends Node

# --- RPC IDs ---
const RPC_SUBMIT_COMBAT_ACTION = "armored_archer/submit_combat_action"
const RPC_GET_MATCH_STATE = "armored_archer/get_match_state"

# --- Profiling Reference ---
@onready var _profiler: Node = get_node_or_null("/root/ProfilingInstrumentation")

# --- Combat State ---
var current_match_state: Dictionary = {}
var is_my_turn: bool = false
var my_health: int = 0
var opponent_health: int = 0

# --- Signals ---
signal combat_action_submitted(result: Dictionary)
signal match_state_updated(match_state: Dictionary)
signal turn_changed(is_my_turn: bool)
signal combat_ended(winner: String)

# --- Network Reference ---
# Only set network_manager if it wasn't already set (e.g., by tests)
var network_manager: Node

# --- Difficulty Reference ---
var difficulty_manager: Node

func _ready() -> void:
	if network_manager == null:
		network_manager = get_node_or_null("/root/NetworkManager")
	if difficulty_manager == null:
		difficulty_manager = get_node_or_null("/root/DynamicDifficultyManager")

# --- Submit Combat Action ---
func submit_combat_action(match_id: String, action_type: String, angle: float, power: float = 1.0) -> void:
	var profiling_block = _profiler.create_profile_block("CombatManager.submit_combat_action") if _profiler else null

	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		if profiling_block:
			profiling_block.end()
		return

	if match_id.is_empty() or action_type.is_empty():
		push_error("Invalid combat action parameters")
		if profiling_block:
			profiling_block.end()
		return

	var payload: Dictionary = {
		"match_id": match_id,
		"action_type": action_type,
		"angle": angle,
		"power": power
	}

	var json_string: String = JSON.stringify(payload)
	var response: Dictionary = await network_manager.send_rpc(RPC_SUBMIT_COMBAT_ACTION, json_string)

	if response.has("error"):
		push_error("Failed to submit combat action: %s" % response["error"])
		if profiling_block:
			profiling_block.end()
		return

	if response.get("success", false):
		var result: Dictionary = response.get("result", {})
		combat_action_submitted.emit(result)

		_update_local_state(result)

		if result.has("winner"):
			combat_ended.emit(result["winner"])

	if profiling_block:
		profiling_block.end()

# --- Get Match State ---
func get_match_state(match_id: String) -> void:
	var profiling_block = _profiler.create_profile_block("CombatManager.get_match_state") if _profiler else null

	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		if profiling_block:
			profiling_block.end()
		return

	if match_id.is_empty():
		push_error("Match ID required")
		if profiling_block:
			profiling_block.end()
		return

	var payload: Dictionary = {
		"match_id": match_id
	}

	var json_string: String = JSON.stringify(payload)
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_MATCH_STATE, json_string)

	if response.has("error"):
		push_error("Failed to get match state: %s" % response["error"])
		if profiling_block:
			profiling_block.end()
		return

	current_match_state = response
	match_state_updated.emit(current_match_state)
	_update_from_match_state()

	if profiling_block:
		profiling_block.end()

# --- State Updates ---
func _update_local_state(result: Dictionary) -> void:
	# Merge the server-authoritative result into the cached match state so
	# health and perspective reflect the outcome of the submitted action.
	for key: String in result:
		current_match_state[key] = result[key]
	_apply_perspective()

func _update_from_match_state() -> void:
	if current_match_state.is_empty():
		return

	is_my_turn = (current_match_state.get("current_turn_user_id", "") == _local_user_id())

	_apply_perspective()

	turn_changed.emit(is_my_turn)

# Resolves the local player's id from the injected network manager, falling
# back to the global autoload so non-injected consumers keep working (#974).
func _local_user_id() -> String:
	if network_manager != null and "user_id" in network_manager:
		return network_manager.user_id
	return NetworkManager.user_id

# Maps creator/opponent health onto my/opponent health from the local
# player's perspective.
func _apply_perspective() -> void:
	if not current_match_state.has("creator_id"):
		return

	var is_creator: bool = current_match_state.get("creator_id") == _local_user_id()

	if is_creator:
		my_health = current_match_state.get("creator_health", 100)
		opponent_health = current_match_state.get("opponent_health", 100)
	else:
		my_health = current_match_state.get("opponent_health", 100)
		opponent_health = current_match_state.get("creator_health", 100)

# --- Utility Methods ---
func get_current_match_state() -> Dictionary:
	return current_match_state

func get_my_health() -> int:
	return my_health

func get_opponent_health() -> int:
	return opponent_health

func is_my_turn_sync() -> bool:
	return is_my_turn

func get_combat_log() -> Array:
	return current_match_state.get("log", [])

func get_match_status() -> String:
	return current_match_state.get("status", "")

func is_combat_active() -> bool:
	return get_match_status() == "active"

# --- Difficulty Modifiers ---
func apply_difficulty_to_damage(base_damage: float, is_enemy_damage: bool = true) -> float:
	"""Applies difficulty modifier to damage calculations.

	Parameters:
		base_damage: Base damage value before modification
		is_enemy_damage: If true, applies difficulty to enemy damage. If false, applies to player damage.

	Returns:
		float: Modified damage value
	"""
	if not difficulty_manager:
		return base_damage

	var modifier = difficulty_manager.get_difficulty_modifier()

	# Higher difficulty = more enemy damage, lower player damage
	# Lower difficulty = less enemy damage, higher player damage
	if is_enemy_damage:
		return base_damage * (1.0 + modifier)
	else:
		return base_damage * (1.0 - modifier * 0.5)

func apply_difficulty_to_ai(difficulty_tier: int) -> int:
	"""Adjusts AI difficulty based on dynamic difficulty modifier.

	Parameters:
		difficulty_tier: Base AI difficulty tier (1-3)

	Returns:
		int: Adjusted difficulty tier
	"""
	if not difficulty_manager:
		return difficulty_tier

	var modifier = difficulty_manager.get_difficulty_modifier()

	# Modifier ranges from -0.20 (Easy) to +0.20 (Extreme)
	# Map to tier adjustments
	var tier_adjustment = int(modifier * 10)  # -2 to +2
	return clamp(difficulty_tier + tier_adjustment, 1, 5)

func apply_difficulty_to_rewards(base_rewards: Dictionary) -> Dictionary:
	"""Applies difficulty modifier to encounter rewards.

	Parameters:
		base_rewards: Dictionary with xp, gold, etc.

	Returns:
		Dictionary: Modified rewards
	"""
	if not difficulty_manager:
		return base_rewards

	var reward_modifier = difficulty_manager.get_encounter_reward_modifier()
	var modified_rewards = base_rewards.duplicate()

	for key in modified_rewards:
		if modified_rewards[key] is float or modified_rewards[key] is int:
			modified_rewards[key] = int(modified_rewards[key] * reward_modifier)

	return modified_rewards

func get_adjusted_encounter_difficulty(base_difficulty: float) -> float:
	"""Returns the difficulty modifier-adjusted encounter difficulty.

	Parameters:
		base_difficulty: Base encounter difficulty (0.0 to 1.0)

	Returns:
		float: Adjusted difficulty
	"""
	if not difficulty_manager:
		return base_difficulty

	return difficulty_manager.calculate_target_difficulty(base_difficulty)

# --- Combat Simulation (Non-Authoritative) ---
# Local damage estimate restored per issue #1027. The server's combat_system.ts
# computes authoritative duel damage via submit_combat_action; this estimate is
# never reported to the server and never settles matches (ADR-0002).

func calculate_damage(base_damage: int, attacker_stats: Dictionary, defender_stats: Dictionary, crit_multiplier: float) -> int:
	"""Estimates damage from attacker and defender stats for local simulation.

	Non-authoritative: duel results come exclusively from the server via
	submit_combat_action and _update_local_state (ADR-0002, server-declared
	match settlement). This estimate exists for client-side presentation,
	PvE pacing, and benchmarks only — never for settlement.

	Parameters:
		base_damage: Base damage before modifiers
		attacker_stats: Dictionary containing attacker stats (attack, crit_rate)
		defender_stats: Dictionary containing defender stats (defense, dodge)
		crit_multiplier: Multiplier for critical hits

	Returns:
		int: Estimated damage (0 when dodged, minimum 1 otherwise)
	"""
	var attack: int = int(attacker_stats.get("attack", 0))
	var defense: int = int(defender_stats.get("defense", 0))
	var crit_rate: float = float(attacker_stats.get("crit_rate", 0))
	var dodge: float = float(defender_stats.get("dodge", 0))

	# Dodge check: a successful dodge negates the hit entirely
	var dodge_roll: float = randf() * 100.0
	if dodge_roll < dodge:
		return 0  # Dodged

	# Critical hit check
	var is_crit: bool = randf() * 100.0 < crit_rate

	# Base formula, floored at 1 so a landed hit always deals damage
	var damage: int = base_damage + attack - defense
	damage = maxi(1, damage)

	if is_crit:
		damage = int(damage * crit_multiplier)

	return damage
