extends Node

# --- RPC IDs ---
const RPC_SUBMIT_COMBAT_ACTION = "armored_archer/submit_combat_action"
const RPC_GET_MATCH_STATE = "armored_archer/get_match_state"

# --- Profiling Reference ---
@onready var _profiler: Node = get_node_or_null("/root/ProfilingInstrumentation")

# --- Combat State ---
var current_match_state: Dictionary = {}
# ADR-0009 (issue #1714, option b): health/turn are backed by the shared
# server-known snapshot in CombatStateCache; both write paths (this RPC echo
# and CombatSyncManager's polling loop) feed it, so all screens read one value.
var is_my_turn: bool:
	get:
		return CombatStateCache.is_my_turn
	set(value):
		CombatStateCache.is_my_turn = value
var my_health: int:
	get:
		return CombatStateCache.my_health
	set(value):
		CombatStateCache.my_health = maxi(0, value)
var opponent_health: int:
	get:
		return CombatStateCache.opponent_health
	set(value):
		CombatStateCache.opponent_health = maxi(0, value)

# --- Signals ---
signal combat_action_submitted(result: Dictionary)
signal match_state_updated(match_state: Dictionary)
signal turn_changed(is_my_turn: bool)
signal combat_ended(winner: String)

# --- Network Reference ---
# Only set network_manager if it wasn't already set (e.g., by tests)
var network_manager: Node

func _ready() -> void:
	if network_manager == null:
		network_manager = get_node_or_null("/root/NetworkManager")
	# Seed the shared snapshot with this path's empty placeholder.
	CombatStateCache.update_snapshot(0, 0, false, "", "")

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
	CombatStateCache.update_snapshot(my_health, opponent_health, is_my_turn, current_match_state.get("status", ""), "rpc")

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

