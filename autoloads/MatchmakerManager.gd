extends Node

# --- RPC IDs ---
const RPC_LIST_MATCHES = "armored_archer/list_matches"
const RPC_CREATE_MATCH = "armored_archer/create_match"
const RPC_ACCEPT_MATCH = "armored_archer/accept_match"
const RPC_GET_PLAYER_RANK = "armored_archer/get_player_rank"

# --- Match Data ---
var available_matches: Array = []
var player_rank: int = 0
var current_match: Dictionary = {}

# --- Signals ---
signal matches_loaded(matches: Array, player_rank: int)
signal match_created(match: Dictionary)
signal match_accepted(match: Dictionary)
signal rank_retrieved(rank: int)

# --- Network Reference ---
@onready var network_manager: Node = get_node_or_null("/root/NetworkManager")

# --- List Matches ---
func list_matches(match_type: String = "", min_rank: int = 0, max_rank: int = 0, limit: int = 20) -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	var payload: Dictionary = {}
	if not match_type.is_empty():
		payload["match_type"] = match_type
	if min_rank > 0:
		payload["min_rank"] = min_rank
	if max_rank > 0:
		payload["max_rank"] = max_rank
	if limit > 0:
		payload["limit"] = limit
	
	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_LIST_MATCHES, json.stringify(payload))
	
	if response.has("error"):
		push_error("Failed to list matches: %s" % response.error)
		return
	
	if response.get("success", false):
		available_matches = response.get("matches", [])
		player_rank = response.get("player_rank", 0)
		matches_loaded.emit(available_matches, player_rank)

# --- Create Match ---
func create_match(match_type: String, is_punch_up: bool = false, target_opponent_id: String = "") -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	if match_type != "ranked" and match_type != "casual":
		push_error("Invalid match type")
		return
	
	var payload: Dictionary = {
		"match_type": match_type,
		"is_punch_up": is_punch_up
	}
	
	if not target_opponent_id.is_empty():
		payload["target_opponent_id"] = target_opponent_id
	
	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_CREATE_MATCH, json.stringify(payload))
	
	if response.has("error"):
		push_error("Failed to create match: %s" % response.error)
		return
	
	if response.get("success", false):
		current_match = response.get("match", {})
		match_created.emit(current_match)

# --- Accept Match ---
func accept_match(match_id: String) -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	if match_id.is_empty():
		push_error("Match ID required")
		return
	
	var payload: Dictionary = {
		"match_id": match_id
	}
	
	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_ACCEPT_MATCH, json.stringify(payload))
	
	if response.has("error"):
		push_error("Failed to accept match: %s" % response.error)
		return
	
	if response.get("success", false):
		current_match = response.get("match", {})
		match_accepted.emit(current_match)

# --- Get Player Rank ---
func get_player_rank() -> void:
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return
	
	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_PLAYER_RANK, json.stringify("{}"))
	
	if response.has("error"):
		push_error("Failed to get player rank: %s" % response.error)
		return
	
	if response.get("success", false):
		player_rank = response.get("rank", 0)
		rank_retrieved.emit(player_rank)

# --- Utility Methods ---
func get_available_matches() -> Array:
	return available_matches

func get_current_match() -> Dictionary:
	return current_match

func get_player_rank_sync() -> int:
	return player_rank

func is_in_match() -> bool:
	return not current_match.is_empty() and current_match.get("status", "") != "completed"
