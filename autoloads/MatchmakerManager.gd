## Manages PvP matchmaking operations including listing, creating, and accepting matches.
## Tracks the player's Power Rating (build strength) used for matchmaking
## comparisons and punch-up eligibility.
##
## Settlement is server-authoritative (ADR-0002): complete_match is a
## settlement TRIGGER only — the winner is resolved from the server's
## terminal match state, never from client input.
##
## Signals:
## - matches_loaded(matches: Array, power_rating: int): Emitted when match list is retrieved
## - match_created(match: Dictionary): Emitted when a new match is created
## - match_accepted(match: Dictionary): Emitted when joining an existing match
## - rank_retrieved(power_rating: int): Emitted when the cached Power Rating is refreshed
##
extends Node

# --- RPC IDs ---
const RPC_LIST_MATCHES = "armored_archer/list_matches"
const RPC_CREATE_MATCH = "armored_archer/create_match"
const RPC_ACCEPT_MATCH = "armored_archer/accept_match"
const RPC_GET_PLAYER_RANK = "armored_archer/get_player_rank"
const RPC_COMPLETE_MATCH = "armored_archer/complete_match"
const RPC_GET_MATCH_HISTORY = "armored_archer/get_match_history"
# Issue #903: legacy correspondence duel RPCs (submit_turn /
# get_async_match_state / forfeit_match) and their constants were removed.
# Use submit_combat_action / get_match_state via CombatManager and
# CombatSyncManager instead — the shipped hybrid duel path.

# --- Match Data ---
var available_matches: Array = []
## Cached Power Rating (build strength — level*10 + stat average).
## NOT the Ladder Rating (Elo) and NOT the season Standing; see issue #871.
var power_rating: int = 0
var current_match: Dictionary = {}

# --- Punch Up Statistics ---
var punch_up_wins: int = 0
var punch_up_losses: int = 0

# --- Punch Up Risk Constants (matching backend: gap 5-15, min Power Rating 20) ---
const PUNCH_UP_RANK_DIFF_THRESHOLD = 5
const PUNCH_UP_MAX_RANK_DIFF = 15
const PUNCH_UP_MIN_RANK = 20
const RISK_LEVEL_LOW_THRESHOLD = 7
const RISK_LEVEL_MEDIUM_THRESHOLD = 10
const RISK_LEVEL_HIGH_THRESHOLD = 14

# --- Analytics Reference ---
@onready var analytics: Node = get_node_or_null("/root/AnalyticsManager")

# --- Signals ---
signal matches_loaded(matches: Array, power_rating: int)
signal match_created(match: Dictionary)
signal match_accepted(match: Dictionary)
signal rank_retrieved(power_rating: int)
signal match_completed(match_result: Dictionary)
signal match_history_loaded(matches: Array, total: int, stats: Dictionary)
signal punch_up_stats_updated(wins: int, losses: int, win_rate: float)

# --- Async Duel Signals ---
# Issue #903: signals tied to the removed legacy correspondence RPCs
# (turn_submitted, match_state_loaded, match_reconnected,
# match_reconnect_failed, match_forfeited, match_expired, turn_timeout)
# were removed. The shipped hybrid duel emits turn state via
# CombatManager / CombatSyncManager.

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
		# list_matches returns the server-derived Power Rating in its
		# `player_rank` field (same calculateRank derivation as the
		# consolidated get_player_rank RPC's `power_rating` field).
		power_rating = response.get("player_rank", 0)
		matches_loaded.emit(available_matches, power_rating)

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
			analytics.log_pvp_match_started(match_id, opponent_id, season_id, power_rating)

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

# --- Power Rating Management ---
func get_player_rank() -> void:
	"""Retrieves the player's Power Rating (build strength).

	The consolidated server response (issue #871) exposes the explicit
	`power_rating` field; the legacy `rank` alias is only a best-effort
	fallback for older servers (where it carried the same derivation).
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_PLAYER_RANK, json.stringify({}))

	if response.has("error"):
		push_error("Failed to get player rank: %s" % response.error)
		return

	if response.get("success", false):
		power_rating = response.get("power_rating", response.get("rank", 0))
		rank_retrieved.emit(power_rating)

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

# --- Match Completion (Settlement Trigger) ---
func complete_match(is_punch_up: bool = false) -> void:
	"""Triggers server-side settlement of the current PvP match.

	Settlement is server-authoritative (ADR-0002 / issue #862): the winner
	is resolved from the server's terminal match state and the server's
	match record is the sole source for the punch-up flag. This RPC is a
	settlement TRIGGER only — the advisory `is_punch_up` flag is sent per
	the server schema, but no winner/loser assertion is sent or treated as
	authoritative. Victory, rank updates, XP, and rewards are read from
	the server response.

	Parameters:
		is_punch_up: Advisory client punch-up flag (the server record wins)
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	if current_match.is_empty():
		push_error("No active match to complete")
		return

	# Trigger-only payload: match_id is the settlement key; is_punch_up is
	# advisory. winner_id/loser_id are intentionally omitted — the server
	# never honors client winner claims.
	var payload: Dictionary = {
		"match_id": current_match.get("match_id", ""),
		"is_punch_up": is_punch_up
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_COMPLETE_MATCH, json.stringify(payload))

	if response.has("error"):
		push_error("Failed to complete match: %s" % response.error)
		return

	if response.get("success", false):
		_handle_settlement_response(response, is_punch_up)

func _handle_settlement_response(response: Dictionary, advisory_is_punch_up: bool) -> void:
	"""Builds the UI result payload from a server settlement response.

	Victory is derived from the server-declared winner — never from a
	client assertion (trigger-only settlement per issue #862).

	Parameters:
		response: Settlement response from the complete_match RPC
		advisory_is_punch_up: Client punch-up flag, used only as a fallback
			when the server response omits its own record's flag
	"""
	var match: Dictionary = response.get("match", {})
	var winner_data: Dictionary = _extract_participant_data(response.get("winner", {}))
	var loser_data: Dictionary = _extract_participant_data(response.get("loser", {}))

	# Server-declared winner: a full settlement returns a winner object;
	# an already-settled idempotent replay returns a plain winner string.
	var server_winner_id: String = winner_data.get("user_id", "")
	var server_loser_id: String = loser_data.get("user_id", "")

	# The server match record is authoritative for the punch-up flag.
	var is_punch_up: bool = response.get("is_punch_up", advisory_is_punch_up)

	# Terminal draw (or a response without a server-declared winner): no
	# winner was settled, so there is no victory data to report.
	if response.get("is_draw", false) or server_winner_id.is_empty():
		current_match = {}
		match_completed.emit({
			"is_draw": true,
			"reason": response.get("reason", response.get("end_reason", ""))
		})
		return

	var my_user_id: String = _get_local_user_id()
	var is_victory: bool = my_user_id == server_winner_id

	# Determine which side of the settlement is ours (for the result payload).
	# Note: we deliberately do NOT update the cached `power_rating` from the
	# settlement — `new_rank` in the settlement response is the Ladder Rating
	# (Elo), a different concept (issue #871). Power Rating is build strength
	# and only changes via stats/level; the cache refreshes from
	# list_matches / get_player_rank responses.
	var my_player_data: Dictionary = {}
	if is_victory:
		my_player_data = winner_data
	elif my_user_id == server_loser_id:
		my_player_data = loser_data
	else:
		# Not a participant, use winner data as fallback
		my_player_data = winner_data

	# Extract player result data. old_rank/new_rank/rank_change are Ladder
	# Rating (Elo) values from the server settlement — match_results renders
	# them as the Ladder Rating change (issue #871).
	var old_rank: int = my_player_data.get("old_rank", 0)
	var new_rank: int = my_player_data.get("new_rank", 0)
	var rank_delta: int = my_player_data.get("rank_change", 0)
	var xp_gained: int = my_player_data.get("xp_gained", 0)
	var old_season_position: int = my_player_data.get("old_season_position", 0)
	var new_season_position: int = my_player_data.get("new_season_position", 0)
	var season_delta: int = my_player_data.get("season_position_delta", 0)
	var rewards: Array = my_player_data.get("rewards", [])

	# Calculate match duration
	var match_duration: float = 0.0
	var created_at: int = match.get("created_at", 0)
	var completed_at: int = match.get("updated_at", 0)
	if created_at > 0 and completed_at > 0:
		match_duration = float(completed_at - created_at) / 1000.0

	# Create UI-compatible result data (winner/loser are server-declared)
	var ui_result_data: Dictionary = {
		"winner_id": server_winner_id,
		"loser_id": server_loser_id,
		"is_victory": is_victory,
		"match_type": match.get("match_type", "ranked"),
		"is_punch_up": is_punch_up,
		"xp_gained": xp_gained,
		"old_rank": old_rank,
		"new_rank": new_rank,
		"rank_delta": rank_delta,
		"season_position": new_season_position if new_season_position > 0 else old_season_position,
		"season_delta": season_delta,
		"match_duration": match_duration,
		"rewards": rewards
	}

	# Update Punch Up statistics from the server-declared outcome
	if is_punch_up:
		if my_user_id == server_winner_id:
			punch_up_wins += 1
		elif my_user_id == server_loser_id:
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

func _extract_participant_data(raw_participant: Variant) -> Dictionary:
	"""Normalizes a settlement participant entry to a Dictionary.

	Full settlements return participant objects; idempotent replays of an
	already-settled match may return a plain user ID string instead.

	Parameters:
		raw_participant: The winner/loser entry from a settlement response

	Returns:
		Dictionary: Participant data (empty when only a string was present)
	"""
	if raw_participant is Dictionary:
		return raw_participant
	return {}

func _get_local_user_id() -> String:
	"""Returns the local player's user ID from the network layer.

	Prefers the injected network manager (mocked in tests); falls back to
	the NetworkManager autoload.

	Returns:
		String: Local player's user ID (empty when unauthenticated)
	"""
	if network_manager and network_manager.get("user_id") != null:
		return str(network_manager.get("user_id"))
	return NetworkManager.user_id

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
	"""Returns the cached Power Rating (build strength, synchronous).

	Returns:
		int: Current Power Rating (0 until the first successful fetch)
	"""
	return power_rating

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

# ==================== PUNCH UP RISK ASSESSMENT ====================

func is_punch_up_match(match_data: Dictionary) -> bool:
	"""Checks if a match is a punch-up match.

	Parameters:
		match_data: Dictionary containing match information

	Returns:
		bool: True if this is a punch-up match
	"""
	return match_data.get("is_punch_up", false)

func calculate_punch_up_risk_level(match_data: Dictionary) -> String:
	"""Calculates the risk level of a punch-up match.

	Parameters:
		match_data: Dictionary containing match information

	Returns:
		String: Risk level ("low", "medium", "high", or "none")
	"""
	if not is_punch_up_match(match_data):
		return "none"

	var opponent_rank: int = match_data.get("creator_rank", 0)
	var rank_diff: int = abs(opponent_rank - power_rating)

	if rank_diff >= RISK_LEVEL_HIGH_THRESHOLD:
		return "high"
	elif rank_diff >= RISK_LEVEL_MEDIUM_THRESHOLD:
		return "medium"
	else:
		return "low"

func get_punch_up_risk_details(match_data: Dictionary) -> Dictionary:
	"""Gets detailed risk information for a punch-up match.

	Parameters:
		match_data: Dictionary containing match information

	Returns:
		Dictionary: Risk details including:
			- is_punch_up: bool - Whether this is a punch-up
			- risk_level: String - "low", "medium", "high", or "none"
			- rank_difference: int - Absolute rank difference
			- opponent_rank: int - Opponent's rank
			- xp_multiplier: float - XP multiplier if won
			- gem_bonus: int - Gem bonus if won
			- rank_penalty: int - Rank penalty if lost
	"""
	var is_punch_up: bool = is_punch_up_match(match_data)
	var risk_level: String = calculate_punch_up_risk_level(match_data)
	var opponent_rank: int = match_data.get("creator_rank", 0)
	var rank_diff: int = abs(opponent_rank - power_rating)

	# Calculate rewards based on rank difference
	var xp_multiplier: float = 1.0
	var gem_bonus: int = 0
	var rank_penalty: int = 0

	if is_punch_up:
		xp_multiplier = _calculate_xp_multiplier(rank_diff)
		gem_bonus = _calculate_gem_bonus(rank_diff)
		rank_penalty = _calculate_rank_penalty(rank_diff)

	return {
		"is_punch_up": is_punch_up,
		"risk_level": risk_level,
		"rank_difference": rank_diff,
		"opponent_rank": opponent_rank,
		"xp_multiplier": xp_multiplier,
		"gem_bonus": gem_bonus,
		"rank_penalty": rank_penalty
	}

func should_show_punch_up_warning(match_data: Dictionary) -> bool:
	"""Determines if a punch-up warning should be shown for this match.

	Parameters:
		match_data: Dictionary containing match information

	Returns:
		bool: True if a warning should be shown
	"""
	if not is_punch_up_match(match_data):
		return false

	# Always show warning for medium and high risk
	var risk_level: String = calculate_punch_up_risk_level(match_data)
	return risk_level in ["medium", "high"]

func _calculate_xp_multiplier(rank_diff: int) -> float:
	"""Calculates XP multiplier based on rank difference.

	Parameters:
		rank_diff: Absolute difference in ranks

	Returns:
		float: XP multiplier (1.0 = normal, higher = bonus)
	"""
	var multiplier_min: float = 1.2
	var multiplier_max: float = 2.0
	var multiplier_range: float = multiplier_max - multiplier_min
	var rank_diff_range: float = float(PUNCH_UP_MAX_RANK_DIFF - PUNCH_UP_RANK_DIFF_THRESHOLD)
	var normalized_diff: float = clampf(
		(float(rank_diff) - float(PUNCH_UP_RANK_DIFF_THRESHOLD)) / rank_diff_range,
		0.0,
		1.0
	)
	return multiplier_min + multiplier_range * normalized_diff

func _calculate_gem_bonus(rank_diff: int) -> int:
	"""Calculates gem bonus based on rank difference.

	Parameters:
		rank_diff: Absolute difference in ranks

	Returns:
		int: Number of bonus gems
	"""
	var gem_min: int = 3
	var gem_max: int = 10
	var gem_range: float = float(gem_max - gem_min)
	var rank_diff_range: float = float(PUNCH_UP_MAX_RANK_DIFF - PUNCH_UP_RANK_DIFF_THRESHOLD)
	var normalized_diff: float = clampf(
		(float(rank_diff) - float(PUNCH_UP_RANK_DIFF_THRESHOLD)) / rank_diff_range,
		0.0,
		1.0
	)
	return int(round(gem_min + gem_range * normalized_diff))

func _calculate_rank_penalty(rank_diff: int) -> int:
	"""Calculates rank penalty for losing a punch-up.

	Parameters:
		rank_diff: Absolute difference in ranks

	Returns:
		int: Rank points to lose
	"""
	# Penalty scales with rank difference
	# Minimum penalty of 5, maximum of 25
	var normalized_diff: float = clampf(float(rank_diff) / float(PUNCH_UP_MAX_RANK_DIFF), 0.0, 1.0)
	return int(5.0 + 20.0 * normalized_diff)

# ==================== ASYNC DUEL LIFECYCLE METHODS ====================
