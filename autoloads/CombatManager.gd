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
@onready var network_manager: Node = get_node_or_null("/root/NetworkManager")

# --- Submit Combat Action ---
func submit_combat_action(match_id: String, action_type: String, angle: float, power: float = 1.0) -> void:
	var _profiling_block = _profiler.create_profile_block("CombatManager.submit_combat_action") if _profiler else null
	
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		if _profiling_block:
			_profiling_block.end()
		return

	if match_id.is_empty() or action_type.is_empty():
		push_error("Invalid combat action parameters")
		if _profiling_block:
			_profiling_block.end()
		return

	var payload: Dictionary = {
		"match_id": match_id,
		"action_type": action_type,
		"angle": angle,
		"power": power
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_SUBMIT_COMBAT_ACTION, json.stringify(payload))

	if response.has("error"):
		push_error("Failed to submit combat action: %s" % response["error"])
		if _profiling_block:
			_profiling_block.end()
		return

	if response.get("success", false):
		var result: Dictionary = response.get("result", {})
		combat_action_submitted.emit(result)

		_update_local_state(result)

		if result.has("winner"):
			combat_ended.emit(result["winner"])
	
	if _profiling_block:
		_profiling_block.end()

# --- Get Match State ---
func get_match_state(match_id: String) -> void:
	var _profiling_block = _profiler.create_profile_block("CombatManager.get_match_state") if _profiler else null
	
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		if _profiling_block:
			_profiling_block.end()
		return

	if match_id.is_empty():
		push_error("Match ID required")
		if _profiling_block:
			_profiling_block.end()
		return

	var payload: Dictionary = {
		"match_id": match_id
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_MATCH_STATE, json.stringify(payload))

	if response.has("error"):
		push_error("Failed to get match state: %s" % response["error"])
		if _profiling_block:
			_profiling_block.end()
		return

	current_match_state = response
	match_state_updated.emit(current_match_state)
	_update_from_match_state()
	
	if _profiling_block:
		_profiling_block.end()

# --- State Updates ---
func _update_local_state(result: Dictionary) -> void:
	if current_match_state.has("creator_id"):
		var is_creator: bool = current_match_state.get("creator_id") == NetworkManager.user_id

		if is_creator:
			my_health = current_match_state.get("creator_health", 100)
			opponent_health = current_match_state.get("opponent_health", 100)
		else:
			my_health = current_match_state.get("opponent_health", 100)
			opponent_health = current_match_state.get("creator_health", 100)

func _update_from_match_state() -> void:
	if current_match_state.is_empty():
		return

	var current_turn_user_id: String = current_match_state.get("current_turn_user_id", "")
	is_my_turn = (current_turn_user_id == NetworkManager.user_id)

	var is_creator: bool = current_match_state.get("creator_id") == NetworkManager.user_id

	if is_creator:
		my_health = current_match_state.get("creator_health", 100)
		opponent_health = current_match_state.get("opponent_health", 100)
	else:
		my_health = current_match_state.get("opponent_health", 100)
		opponent_health = current_match_state.get("creator_health", 100)

	turn_changed.emit(is_my_turn)

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
