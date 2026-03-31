## Manages seasonal ranking system, leaderboards, and rewards.
## Handles rank updates, leaderboard retrieval, and season reward claims.
##
## Signals:
## - season_info_loaded(season_info: Dictionary): Emitted when season data is retrieved
## - leaderboard_loaded(leaderboard: Array): Emitted when leaderboard data arrives
## - rank_updated(rank_change: Dictionary): Emitted when rank changes after a match
## - rewards_loaded(rewards: Dictionary): Emitted when season rewards are available
## - rewards_claimed(rewards: Dictionary): Emitted when rewards are claimed
##
extends Node

# --- RPC IDs ---
const RPC_GET_SEASON_INFO = "armored_archer/get_season_info"
const RPC_GET_LEADERBOARD = "armored_archer/get_leaderboard"
const RPC_UPDATE_RANK = "armored_archer/update_rank"
const RPC_GET_SEASON_REWARDS = "armored_archer/get_season_rewards"
const RPC_CLAIM_SEASON_REWARDS = "armored_archer/claim_season_rewards"

# --- Season Data ---
var current_season: Dictionary = {}
var player_rank: int = 0
var player_score: int = 0
var time_remaining: int = 0
var leaderboard: Array = []
var season_rewards: Dictionary = {}
var rewards_claimed: bool = false
var has_claimed_rewards: bool = false  # Track if rewards have been claimed

# --- Signals ---
signal season_info_loaded(season_info: Dictionary)
signal leaderboard_loaded(leaderboard: Array)
signal rank_updated(rank_change: Dictionary)
signal rewards_loaded(rewards: Dictionary)
signal rewards_claimed_signal(rewards: Dictionary)

# --- Network Reference ---
@onready var network_manager: Node = get_node_or_null("/root/NetworkManager")

# --- Analytics Reference ---
@onready var analytics: Node = get_node_or_null("/root/AnalyticsManager")

# --- Get Season Info ---
func get_season_info() -> void:
	"""Retrieves current season information and player ranking."""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_SEASON_INFO, json.stringify({}))

	if response.has("error"):
		push_error("Failed to get season info: %s" % response.error)
		return

	if response.get("success", false):
		current_season = response.get("season", {})
		player_rank = response.get("player_rank", 0)
		player_score = response.get("player_score", 0)
		time_remaining = response.get("time_remaining", 0)

		season_info_loaded.emit({
			"season": current_season,
			"player_rank": player_rank,
			"player_score": player_score,
			"time_remaining": time_remaining
		})

		# Track season start in analytics
		if analytics and analytics.has_method("log_season_start") and current_season.has("id"):
			analytics.log_season_start(
				current_season.get("id", 0),
				current_season.get("name", "Season")
			)

# --- Get Leaderboard ---
func get_leaderboard(limit: int = 50) -> void:
	"""Retrieves the top players leaderboard.

	Parameters:
		limit: Maximum number of entries to retrieve (default 50)
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var payload: Dictionary = {
		"limit": limit
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_LEADERBOARD, json.stringify(payload))

	if response.has("error"):
		push_error("Failed to get leaderboard: %s" % response.error)
		return

	if response.get("success", false):
		leaderboard = response.get("leaderboard", [])
		leaderboard_loaded.emit(leaderboard)

# --- Update Rank ---
func update_rank(winner_id: String, loser_id: String, is_punch_up: bool = false) -> void:
	"""Updates player ranks after a match concludes.

	Parameters:
		winner_id: User ID of the match winner
		loser_id: User ID of the match loser
		is_punch_up: True if winner fought a higher-ranked opponent
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	if winner_id.is_empty() or loser_id.is_empty():
		push_error("Winner and loser IDs required")
		return

	var payload: Dictionary = {
		"winner_id": winner_id,
		"loser_id": loser_id,
		"is_punch_up": is_punch_up
	}

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_UPDATE_RANK, json.stringify(payload))

	if response.has("error"):
		push_error("Failed to update rank: %s" % response.error)
		return

	if response.get("success", false):
		var rank_change: Dictionary = {
			"winner": response.get("winner", {}),
			"loser": response.get("loser", {}),
			"is_punch_up": response.get("is_punch_up", false)
		}

		if NetworkManager.user_id == winner_id:
			player_score = rank_change.winner.get("new_rank", player_score)
		elif NetworkManager.user_id == loser_id:
			player_score = rank_change.loser.get("new_rank", player_score)

		rank_updated.emit(rank_change)

# --- Get Season Rewards ---
func get_season_rewards() -> void:
	"""Retrieves available season rewards based on player rank."""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_SEASON_REWARDS, json.stringify({}))

	if response.has("error"):
		push_error("Failed to get season rewards: %s" % response.error)
		return

	if response.get("success", false):
		season_rewards = response.get("rewards", {})
		rewards_loaded.emit(season_rewards)

# --- Claim Season Rewards ---
func claim_season_rewards() -> void:
	"""Claims the current season's rewards."""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_CLAIM_SEASON_REWARDS, json.stringify({}))

	if response.has("error"):
		push_error("Failed to claim rewards: %s" % response.error)
		return

	if response.get("success", false):
		season_rewards = response.get("rewards", {})
		rewards_claimed = response.get("claimed", false)
		rewards_claimed_signal.emit(season_rewards)

		# Track season end/rewards claimed in analytics
		if analytics and analytics.has_method("log_season_end"):
			analytics.log_season_end(
				current_season.get("id", 0),
				current_season.get("name", "Season"),
				player_rank
			)

# --- Utility Methods ---
func get_current_season() -> Dictionary:
	"""Returns current season data.

	Returns:
		Dictionary: Season configuration and state
	"""
	return current_season

func get_player_rank_sync() -> int:
	"""Returns current PvP rank (synchronous, no network call).

	Returns:
		int: Current player rank
	"""
	return player_rank

func get_player_score_sync() -> int:
	"""Returns current score/rating (synchronous).

	Returns:
		int: Current score/rating value
	"""
	return player_score

func get_time_remaining() -> int:
	"""Returns time remaining in current season in milliseconds.

	Returns:
		int: Milliseconds remaining
	"""
	return time_remaining

func get_leaderboard_sync() -> Array:
	"""Returns cached leaderboard data (synchronous).

	Returns:
		Array: Leaderboard entries
	"""
	return leaderboard

func get_rewards_sync() -> Dictionary:
	"""Returns cached season rewards (synchronous).

	Returns:
		Dictionary: Available rewards
	"""
	return season_rewards

func is_rewards_claimed() -> bool:
	"""Checks if season rewards have been claimed.

	Returns:
		bool: True if already claimed
	"""
	return rewards_claimed

func format_time_remaining() -> String:
	"""Formats remaining time as human-readable string.

	Returns:
		String: Formatted time like "2d 5h" or "3h 30m" or "45m"
	"""
	var seconds: int = time_remaining / 1000
	var days: int = seconds / 86400
	var hours: int = (seconds % 86400) / 3600
	var minutes: int = (seconds % 3600) / 60

	if days > 0:
		return "%dd %dh" % [days, hours]
	elif hours > 0:
		return "%dh %dm" % [hours, minutes]
	else:
		return "%dm" % minutes

func get_rank_tier(rank: int) -> String:
	"""Gets the tier name for a given rank.

	Parameters:
		rank: Player rank number

	Returns:
		String: Tier name (Legendary, Epic, Rare, Uncommon, Common)
	"""
	if rank <= 10:
		return "Legendary"
	elif rank <= 50:
		return "Epic"
	elif rank <= 100:
		return "Rare"
	elif rank <= 500:
		return "Uncommon"
	else:
		return "Common"

func get_rank_color(rank: int) -> Color:
	"""Gets the display color for a rank tier.

	Parameters:
		rank: Player rank number

	Returns:
		Color: Color for this rank tier
	"""
	if rank <= 10:
		return Color.ORANGE
	elif rank <= 50:
		return Color.MAGENTA
	elif rank <= 100:
		return Color.BLUE
	elif rank <= 500:
		return Color.GREEN
	else:
		return Color.GRAY
