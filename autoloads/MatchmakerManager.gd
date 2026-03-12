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
const RPC_COMPLETE_MATCH = "armored_archer/complete_match"

# --- Match Data ---
var available_matches: Array = []
var player_rank: int = 0
var current_match: Dictionary = {}

# --- Punch Up Statistics ---
var punch_up_wins: int = 0
var punch_up_losses: int = 0

# --- Signals ---
signal matches_loaded(matches: Array, player_rank: int)
signal match_created(match: Dictionary)
signal match_accepted(match: Dictionary)
signal rank_retrieved(rank: int)
signal match_completed(match_result: Dictionary)
signal punch_up_stats_updated(wins: int, losses: int, win_rate: float)

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

# --- Match Completion ---
func complete_match(winner_id: String, loser_id: String, is_punch_up: bool = false) -> void:
	"""Completes a PvP match and updates player ranks.

	Parameters:
		winner_id: User ID of the match winner
		loser_id: User ID of the match loser
		is_punch_up: True if winner fought a higher-ranked opponent
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	if current_match.is_empty():
		push_error("No active match to complete")
		return

	if winner_id.is_empty() or loser_id.is_empty():
		push_error("Winner and loser IDs required")
		return

	if winner_id == loser_id:
		push_error("Winner and loser must be different")
		return

	var payload: Dictionary = {
		"match_id": current_match.get("match_id", ""),
		"winner_id": winner_id,
		"loser_id": loser_id,
		"is_punch_up": is_punch_up
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_COMPLETE_MATCH, json.stringify(payload))

	if response.has("error"):
		push_error("Failed to complete match: %s" % response.error)
		return

	if response.get("success", false):
		var match_result: Dictionary = {
			"match": response.get("match", {}),
			"winner": response.get("winner", {}),
			"loser": response.get("loser", {}),
			"is_punch_up": response.get("is_punch_up", false)
		}

		# Update cached player rank
		var my_user_id: String = NetworkManager.user_id
		if my_user_id == winner_id:
			player_rank = response.get("winner", {}).get("new_rank", player_rank)
		elif my_user_id == loser_id:
			player_rank = response.get("loser", {}).get("new_rank", player_rank)

		# Update Punch Up statistics
		if is_punch_up:
			if my_user_id == winner_id:
				punch_up_wins += 1
			elif my_user_id == loser_id:
				punch_up_losses += 1
			_emit_punch_up_stats_updated()

		# Clear current match
		current_match = {}

		match_completed.emit(match_result)

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

# --- Punch Up Statistics ---
func _emit_punch_up_stats_updated() -> void:
	"""Emits punch_up_stats_updated signal with current statistics."""
	var win_rate: float = 0.0
	var total: int = punch_up_wins + punch_up_losses
	if total > 0:
		win_rate = float(punch_up_wins) / float(total)
	punch_up_stats_updated.emit(punch_up_wins, punch_up_losses, win_rate)

func get_punch_up_wins() -> int:
	"""Returns the number of Punch Up matches won.

	Returns:
		int: Number of Punch Up wins
	"""
	return punch_up_wins

func get_punch_up_losses() -> int:
	"""Returns the number of Punch Up matches lost.

	Returns:
		int: Number of Punch Up losses
	"""
	return punch_up_losses

func get_punch_up_win_rate() -> float:
	"""Returns the Punch Up win rate as a percentage (0.0 to 1.0).

	Returns:
		float: Win rate (0.0 to 1.0)
	"""
	var total: int = punch_up_wins + punch_up_losses
	if total == 0:
		return 0.0
	return float(punch_up_wins) / float(total)

func get_punch_up_total_matches() -> int:
	"""Returns the total number of Punch Up matches played.

	Returns:
		int: Total Punch Up matches
	"""
	return punch_up_wins + punch_up_losses
