## Manages PvP matchmaking operations including listing, creating, and accepting matches.
## Handles player rank tracking and match availability.
##
## Signals:
## - matches_loaded(matches: Array, player_rank: int): Emitted when match list is retrieved
## - match_created(match: Dictionary): Emitted when a new match is created
## - match_accepted(match: Dictionary): Emitted when joining an existing match
## - rank_retrieved(rank: int): Emitted when player rank is updated
##
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

# --- Match Listing ---
func list_matches(match_type: String = "", min_rank: int = 0, max_rank: int = 0, limit: int = 20) -> void:
	"""Retrieves available matches from the server.

	Parameters:
		match_type: Filter by match type ("ranked" or "casual"), empty for all
		min_rank: Minimum player rank to include (0 for no minimum)
		max_rank: Maximum player rank to include (0 for no maximum)
		limit: Maximum number of matches to return
	"""
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

# --- Match Creation ---
func create_match(match_type: String, is_punch_up: bool = false, target_opponent_id: String = "") -> void:
	"""Creates a new PvP match.

	Parameters:
		match_type: Type of match ("ranked" or "casual")
		is_punch_up: True if this is a punch-up match (fighting higher rank)
		target_opponent_id: Optional specific opponent user ID
	"""
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

# --- Match Acceptance ---
func accept_match(match_id: String) -> void:
	"""Joins an existing available match.

	Parameters:
		match_id: ID of the match to join
	"""
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

# --- Rank Management ---
func get_player_rank() -> void:
	"""Retrieves the player's current PvP rank."""
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
	"""Returns the current list of available matches.

	Returns:
		Array: List of available match dictionaries
	"""
	return available_matches

func get_current_match() -> Dictionary:
	"""Returns the current active match data.

	Returns:
		Dictionary: Current match data (empty if not in match)
	"""
	return current_match

func get_player_rank_sync() -> int:
	"""Returns the cached player rank (synchronous).

	Returns:
		int: Current player rank
	"""
	return player_rank

func is_in_match() -> bool:
	"""Checks if player is currently in an active match.

	Returns:
		bool: True if in active match that hasn't completed
	"""
	return not current_match.is_empty() and current_match.get("status", "") != "completed"
