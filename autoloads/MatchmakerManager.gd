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
const RPC_GET_MATCH_HISTORY = "armored_archer/get_match_history"
const RPC_SUBMIT_TURN = "armored_archer/submit_turn"
const RPC_GET_ASYNC_MATCH_STATE = "armored_archer/get_async_match_state"
const RPC_FORFEIT_MATCH = "armored_archer/forfeit_match"

# --- Match Data ---
var available_matches: Array = []
var player_rank: int = 0
var current_match: Dictionary = {}

# --- Punch Up Statistics ---
var punch_up_wins: int = 0
var punch_up_losses: int = 0

# --- Analytics Reference ---
@onready var analytics: Node = get_node_or_null("/root/AnalyticsManager")

# --- Signals ---
signal matches_loaded(matches: Array, player_rank: int)
signal match_created(match: Dictionary)
signal match_accepted(match: Dictionary)
signal rank_retrieved(rank: int)
signal match_completed(match_result: Dictionary)
signal match_history_loaded(matches: Array, total: int, stats: Dictionary)
signal punch_up_stats_updated(wins: int, losses: int, win_rate: float)

# --- Async Duel Signals ---
signal turn_submitted(match: Dictionary, turn_result: Dictionary = {})
signal match_state_loaded(match: Dictionary, is_my_turn: bool, my_health: int, opponent_health: int, time_remaining_ms: int)
signal match_reconnected(match: Dictionary)
signal match_reconnect_failed(error: String)
signal match_forfeited(match: Dictionary)
signal match_expired(match: Dictionary)
signal turn_timeout(match: Dictionary)

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

		# Track PvP match started in analytics
		if analytics and analytics.has_method("log_pvp_match_started"):
			var match_id: String = current_match.get("match_id", "")
			var opponent_id: String = current_match.get("opponent_id", "")
			var season_id: int = 0
			var season_manager = get_node_or_null("/root/SeasonManager")
			if season_manager and season_manager.current_season.has("season_id"):
				season_id = season_manager.current_season.get("season_id")
			analytics.log_pvp_match_started(match_id, opponent_id, season_id, player_rank)

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
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_PLAYER_RANK, json.stringify({}))

	if response.has("error"):
		push_error("Failed to get player rank: %s" % response.error)
		return

	if response.get("success", false):
		player_rank = response.get("rank", 0)
		rank_retrieved.emit(player_rank)

# --- Match History ---
func get_match_history(match_type: String = "", limit: int = 20, offset: int = 0) -> void:
	"""Retrieves the player's match history.

	Parameters:
		match_type: Filter by match type ("ranked" or "casual"), empty for all
		limit: Maximum number of matches to return
		offset: Offset for pagination
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var payload: Dictionary = {}
	if not match_type.is_empty():
		payload["match_type"] = match_type
	if limit > 0:
		payload["limit"] = limit
	if offset > 0:
		payload["offset"] = offset

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_MATCH_HISTORY, json.stringify(payload))

	if response.has("error"):
		push_error("Failed to get match history: %s" % response.error)
		return

	if response.get("success", false):
		var matches: Array = response.get("matches", [])
		var total: int = response.get("total", 0)
		var stats: Dictionary = response.get("stats", {})
		match_history_loaded.emit(matches, total, stats)

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
		var match: Dictionary = response.get("match", {})
		var winner_data: Dictionary = response.get("winner", {})
		var loser_data: Dictionary = response.get("loser", {})

		# Update cached player rank
		var my_user_id: String = NetworkManager.user_id
		var my_player_data: Dictionary = {}
		var is_victory: bool = false
		var old_rank: int = 0
		var new_rank: int = 0
		var rank_delta: int = 0
		var xp_gained: int = 0
		var old_season_position: int = 0
		var new_season_position: int = 0
		var season_delta: int = 0
		var rewards: Array = []

		if my_user_id == winner_id:
			my_player_data = winner_data
			is_victory = true
			player_rank = winner_data.get("new_rank", player_rank)
		elif my_user_id == loser_id:
			my_player_data = loser_data
			is_victory = false
			player_rank = loser_data.get("new_rank", player_rank)
		else:
			# Not a participant, use winner data as fallback
			my_player_data = winner_data

		# Extract player result data
		old_rank = my_player_data.get("old_rank", 0)
		new_rank = my_player_data.get("new_rank", 0)
		rank_delta = my_player_data.get("rank_change", 0)
		xp_gained = my_player_data.get("xp_gained", 0)
		old_season_position = my_player_data.get("old_season_position", 0)
		new_season_position = my_player_data.get("new_season_position", 0)
		season_delta = my_player_data.get("season_position_delta", 0)
		rewards = my_player_data.get("rewards", [])

		# Calculate match duration
		var match_duration: float = 0.0
		var created_at: int = match.get("created_at", 0)
		var completed_at: int = match.get("updated_at", 0)
		if created_at > 0 and completed_at > 0:
			match_duration = float(completed_at - created_at) / 1000.0

		# Create UI-compatible result data
		var ui_result_data: Dictionary = {
			"winner_id": winner_id,
			"loser_id": loser_id,
			"is_victory": is_victory,
			"match_type": match.get("match_type", "ranked"),
			"is_punch_up": response.get("is_punch_up", false),
			"xp_gained": xp_gained,
			"old_rank": old_rank,
			"new_rank": new_rank,
			"rank_delta": rank_delta,
			"season_position": new_season_position if new_season_position > 0 else old_season_position,
			"season_delta": season_delta,
			"match_duration": match_duration,
			"rewards": rewards
		}

		# Update Punch Up statistics
		if is_punch_up:
			if my_user_id == winner_id:
				punch_up_wins += 1
			elif my_user_id == loser_id:
				punch_up_losses += 1
			_emit_punch_up_stats_updated()

		# Track PvP match completed in analytics
		if analytics and analytics.has_method("log_pvp_match_completed"):
			var match_id: String = current_match.get("match_id", "")
			var opponent_id: String = current_match.get("opponent_id", "")
			var season_id: int = 0
			var season_manager = get_node_or_null("/root/SeasonManager")
			if season_manager and season_manager.current_season.has("season_id"):
				season_id = season_manager.current_season.get("season_id")

			var result: String = "win" if is_victory else "loss"
			var my_score: int = winner_data.get("new_rank", 0) if is_victory else loser_data.get("new_rank", 0)
			var opponent_score: int = loser_data.get("new_rank", 0) if is_victory else winner_data.get("new_rank", 0)

			analytics.log_pvp_match_completed(
				match_id,
				result,
				opponent_id,
				season_id,
				match_duration,
				my_score,
				opponent_score,
				rank_delta
			)

		# Clear current match
		current_match = {}

		# Emit UI-compatible result data
		match_completed.emit(ui_result_data)

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

# ==================== ASYNC DUEL LIFECYCLE METHODS ====================

# --- Turn Submission ---
func submit_turn(action_type: String, angle: float, power: float = 1.0) -> void:
	"""Submits a turn action for the current match.

	Parameters:
		action_type: Type of action (currently only "shoot")
		angle: Shot angle in radians (0-2π)
		power: Shot power (0-1, optional, defaults to 1.0)
	"""
	if not is_in_match():
		push_error("Not in an active match")
		return

	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var match_id = current_match.get("match_id", "")
	var payload = {
		"match_id": match_id,
		"action_type": action_type,
		"angle": angle,
		"power": power
	}

	var json = JSON.new()
	var response = await network_manager.send_rpc(
		RPC_SUBMIT_TURN,
		json.stringify(payload)
	)

	if response.has("error"):
		push_error("Failed to submit turn: %s" % response.error)
		# Check if match ended while submitting
		if "match_status" in response and response.match_status != "active":
			_handle_match_status_change(response)
		return

	if response.get("success", false):
		current_match = response.get("match", {})
		var turn_result = response.get("turn_result", {})

		# Emit turn_submitted signal
		turn_submitted.emit(current_match, turn_result)

		# Check if match completed
		if current_match.get("status") == "completed":
			_handle_match_completion(response)
		else:
			# Emit state update if turn was completed
			if response.get("turn_completed", false):
				_emit_match_state_update(response)

# --- Match State ---
func get_async_match_state(match_id: String) -> Dictionary:
	"""Retrieves the current state of an async match.

	Parameters:
		match_id: ID of the match to retrieve state for

	Returns:
		Dictionary: Match state response from server
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return {"error": "Not connected to server"}

	var payload = {"match_id": match_id}
	var json = JSON.new()
	var response = await network_manager.send_rpc(
		RPC_GET_ASYNC_MATCH_STATE,
		json.stringify(payload)
	)

	return response

# --- Reconnect Flow ---
func reconnect_to_match() -> void:
	"""Attempts to reconnect to the current match after a disconnect.

	This should be called when:
	- Network connection is restored
	- App is foregrounded after being backgrounded
	- App restarts while a match was active
	"""
	if current_match.is_empty():
		push_warning("No match to reconnect to")
		match_reconnect_failed.emit("No match to reconnect to")
		return

	# Wait for network connection if not connected
	if not network_manager.is_connected:
		var _connected = await network_manager.session_created
		if not network_manager.is_connected:
			match_reconnect_failed.emit("Failed to connect to server")
			return

	var match_id = current_match.get("match_id", "")
	var response = await get_async_match_state(match_id)

	if response.has("error"):
		push_error("Failed to reconnect: %s" % response.error)
		# Clear current match and signal failure
		current_match = {}
		match_reconnect_failed.emit(response.error)
		return

	if response.get("success", false):
		current_match = response.get("match", {})
		match_reconnected.emit(current_match)

		# Handle different match states
		match current_match.get("status"):
			"active":
				# Emit state update to refresh UI
				_emit_match_state_update(response)
			"completed":
				# Show results
				_handle_match_completion(response)
			"expired":
				# Show expired message
				match_expired.emit(current_match)

# --- Forfeit ---
func forfeit_match() -> void:
	"""Forfeits the current match.

	Opponent wins automatically. Use when player wants to quit the match.
	"""
	if not is_in_match():
		push_error("Not in an active match")
		return

	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var match_id = current_match.get("match_id", "")
	var payload = {"match_id": match_id}

	var json = JSON.new()
	var response = await network_manager.send_rpc(
		RPC_FORFEIT_MATCH,
		json.stringify(payload)
	)

	if response.has("error"):
		push_error("Failed to forfeit: %s" % response.error)
		return

	if response.get("success", false):
		current_match = response.get("match", {})
		match_forfeited.emit(current_match)
		# Clear current match
		current_match = {}

# --- State Update Helper ---
func _emit_match_state_update(response: Dictionary) -> void:
	"""Emits match_state_loaded signal with parsed state information.

	Parameters:
		response: Response from get_async_match_state RPC
	"""
	var match_data = response.get("match", {})
	var is_my_turn = response.get("is_my_turn", false)
	var my_health = response.get("my_health", 100)
	var opponent_health = response.get("opponent_health", 100)
	var time_remaining_ms = response.get("time_remaining_ms", 0)

	match_state_loaded.emit(match_data, is_my_turn, my_health, opponent_health, time_remaining_ms)

# --- Match Status Change Handler ---
func _handle_match_status_change(response: Dictionary) -> void:
	"""Handles cases where match status changed during an RPC call.

	Parameters:
		response: Response that contains match_status field
	"""
	var status = response.get("match_status", "")
	if status == "completed":
		# Try to get match data from response
		if "match" in response:
			current_match = response.match
		_handle_match_completion(response)
	elif status == "expired":
		match_expired.emit(current_match)

# --- Match Completion Handler ---
func _handle_match_completion(response: Dictionary) -> void:
	"""Handles match completion from turn submission or other triggers.

	Parameters:
		response: Response containing match completion data
	"""
	var match_data = response.get("match", {})
	var completion_data = response.get("completion_data", {})

	# Check for forfeit
	if "forfeited_by" in response:
		var forfeited_by = response.get("forfeited_by", "")
		var reason = response.get("forfeit_reason", "")
		push_warning("Match forfeited by %s (%s)" % [forfeited_by, reason])
		match_forfeited.emit(match_data)
		return

	# Check for draw
	if response.get("is_draw", false):
		push_info("Match ended in a draw")
		match_completed.emit({
			"is_draw": true,
			"reason": response.get("reason", "")
		})
		return

	# Normal completion - use existing completion logic
	var winner_id = completion_data.get("winner_id", "")
	var loser_id = completion_data.get("loser_id", "")
	var is_victory = NetworkManager.user_id == winner_id

	# Extract reward data
	var my_data = completion_data.get("winner", {}) if is_victory else completion_data.get("loser", {})
	var old_rank = my_data.get("old_rank", 0)
	var new_rank = my_data.get("new_rank", 0)
	var rank_delta = my_data.get("rank_change", 0)
	var xp_gained = my_data.get("xp_gained", 0)
	var old_season_position = my_data.get("old_season_position", 0)
	var new_season_position = my_data.get("new_season_position", 0)
	var season_delta = my_data.get("season_position_delta", 0)
	var rewards = my_data.get("rewards", [])

	# Calculate match duration
	var match_duration = 0.0
	var created_at = match_data.get("created_at", 0)
	var completed_at = match_data.get("updated_at", 0)
	if created_at > 0 and completed_at > 0:
		match_duration = float(completed_at - created_at) / 1000.0

	# Update player rank
	if not is_victory:
		player_rank = new_rank

	# Create UI-compatible result data
	var ui_result_data = {
		"winner_id": winner_id,
		"loser_id": loser_id,
		"is_victory": is_victory,
		"match_type": match_data.get("match_type", "ranked"),
		"is_punch_up": match_data.get("is_punch_up", false),
		"xp_gained": xp_gained,
		"old_rank": old_rank,
		"new_rank": new_rank,
		"rank_delta": rank_delta,
		"season_position": new_season_position if new_season_position > 0 else old_season_position,
		"season_delta": season_delta,
		"match_duration": match_duration,
		"rewards": rewards
	}

	# Clear current match
	current_match = {}

	# Emit completion signal
	match_completed.emit(ui_result_data)

# --- Timeout Monitoring ---
var _timeout_check_timer: Timer = null
var _timeout_warning_threshold_ms: int = 12 * 60 * 60 * 1000  # 12 hours

func start_timeout_monitoring() -> void:
	"""Starts monitoring for turn timeouts.

	Call this when entering an active match.
	Stops automatically when match is no longer active.
	"""
	if _timeout_check_timer:
		return  # Already running

	_timeout_check_timer = Timer.new()
	_timeout_check_timer.wait_time = 60.0  # Check every minute
	_timeout_check_timer.one_shot = false
	var _err = _timeout_check_timer.timeout.connect(_check_turn_timeout)
	add_child(_timeout_check_timer)
	_timeout_check_timer.start()

func stop_timeout_monitoring() -> void:
	"""Stops monitoring for turn timeouts.

	Call this when leaving a match or match completes.
	"""
	if _timeout_check_timer:
		_timeout_check_timer.queue_free()
		_timeout_check_timer = null

func _check_turn_timeout() -> void:
	"""Checks if the current turn has timed out.

	Called periodically by the timeout monitoring timer.
	"""
	if not is_in_match():
		stop_timeout_monitoring()
		return

	var last_turn = current_match.get("last_turn_timestamp", 0)
	var time_limit = current_match.get("turn_time_limit_ms", 86400000)
	var elapsed = Time.get_ticks_msec() - last_turn
	var remaining = time_limit - elapsed

	# Emit timeout signal if time has run out
	if remaining <= 0:
		turn_timeout.emit(current_match)
		# Don't stop monitoring - server will handle timeout
	# Emit warning if close to timeout (but not already warned)
	elif remaining <= _timeout_warning_threshold_ms:
		# This could emit a warning signal for UI
		pass

# --- Utility Methods for Async Duels ---
func is_my_turn() -> bool:
	"""Checks if it's currently the local player's turn.

	Returns:
		bool: True if it's the local player's turn
	"""
	if current_match.is_empty():
		return false
	var current_player = current_match.get("current_player", "")
	return current_player == NetworkManager.user_id

func get_time_remaining_ms() -> int:
	"""Gets the time remaining for the current turn.

	Returns:
		int: Time remaining in milliseconds (0 if not in match)
	"""
	if current_match.is_empty():
		return 0

	var last_turn = current_match.get("last_turn_timestamp", 0)
	var time_limit = current_match.get("turn_time_limit_ms", 86400000)
	var elapsed = Time.get_ticks_msec() - last_turn
	return max(0, time_limit - elapsed)

func get_my_health() -> int:
	"""Gets the local player's current health.

	Returns:
		int: Current health (0 if not in match)
	"""
	if current_match.is_empty():
		return 0

	var my_user_id = NetworkManager.user_id
	if my_user_id == current_match.get("creator_id", ""):
		return current_match.get("creator_health", 0)
	else:
		return current_match.get("opponent_health", 0)

func get_opponent_health() -> int:
	"""Gets the opponent's current health.

	Returns:
		int: Opponent's health (0 if not in match)
	"""
	if current_match.is_empty():
		return 0

	var my_user_id = NetworkManager.user_id
	if my_user_id == current_match.get("creator_id", ""):
		return current_match.get("opponent_health", 0)
	else:
		return current_match.get("creator_health", 0)

func get_current_turn() -> int:
	"""Gets the current turn number.

	Returns:
		int: Current turn number (0 if not in match)
	"""
	if current_match.is_empty():
		return 0
	return current_match.get("current_turn", 0)

func get_max_turns() -> int:
	"""Gets the maximum number of turns for the match.

	Returns:
		int: Maximum turns (0 if not in match)
	"""
	if current_match.is_empty():
		return 0
	return current_match.get("max_turns", 0)

# --- Cleanup ---
func _exit_tree() -> void:
	"""Clean up resources when the manager is destroyed."""
	stop_timeout_monitoring()
