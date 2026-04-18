## Manages seasonal ranking system, leaderboards, and rewards.
## Handles rank updates, leaderboard retrieval, season reward claims, and rating decay.
##
## Signals:
## - season_info_loaded(season_info: Dictionary): Emitted when season data is retrieved
## - leaderboard_loaded(leaderboard: Array): Emitted when leaderboard data arrives
## - rank_updated(rank_change: Dictionary): Emitted when rank changes after a match
## - rewards_loaded(rewards: Dictionary): Emitted when season rewards are available
## - rewards_claimed(rewards: Dictionary): Emitted when rewards are claimed
## - season_transitioned(old_season: Dictionary, new_season: Dictionary): Emitted on season end
## - decay_info_updated(decay_info: Dictionary): Emitted when decay info is updated
##
extends Node

# --- RPC IDs ---
const RPC_GET_SEASON_INFO = "armored_archer/get_season_info"
const RPC_GET_LEADERBOARD = "armored_archer/get_leaderboard"
const RPC_UPDATE_RANK = "armored_archer/update_rank"
const RPC_GET_SEASON_REWARDS = "armored_archer/get_season_rewards"
const RPC_CLAIM_SEASON_REWARDS = "armored_archer/claim_season_rewards"
const RPC_GET_SEASON_HISTORY = "armored_archer/get_season_history"
const RPC_GET_PLAYER_RANK = "armored_archer/get_player_rank"
const RPC_GET_PLAYER_COSMETICS = "armored_archer/get_player_cosmetics"
const RPC_GET_PRESTIGE_PROGRESS = "armored_archer/get_prestige_progress"
const RPC_GET_PROJECTED_NEXT_SEASON_ELO = "armored_archer/get_projected_next_season_elo"

# --- Season Duration ---
const SEASON_DURATION_DAYS: int = 30  # 30 days per season
const SEASON_DURATION_MS: int = SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000

# --- Rating Decay Configuration ---
const DECAY_INACTIVE_DAYS_THRESHOLD: int = 7  # 1% decay starts after 7 days
const DECAY_RATE_PERCENT: float = 1.0  # 1% per decay period
const HIGH_DECAY_THRESHOLD_DAYS: int = 30  # 2% decay after 30 days
const HIGH_DECAY_RATE_PERCENT: float = 2.0  # 2% per decay period
const MINIMUM_RATING: int = 1000  # Rating floor
const MAX_DECAY_LOSS: int = 200  # Maximum points per decay check

# --- Season Data ---
var current_season: Dictionary = {}
var player_rank: int = 0
var player_score: int = 0
var time_remaining: int = 0
var leaderboard: Array = []
var season_rewards: Dictionary = {}
var rewards_claimed: bool = false
var has_claimed_rewards: bool = false  # Track if rewards have been claimed

# --- Decay Info ---
var decay_info: Dictionary = {
	"days_inactive": 0,
	"points_at_risk": 0,
	"can_decay": false
}

# --- Season History ---
var season_history: Array = []

# --- Prestige Data ---
var prestige_progress: Dictionary = {
	"tiers_earned": [],
	"season_finishes": [],
	"tier_progress": []
}
var projected_next_season_elo: int = 1000
var current_tier_name: String = "Unranked"

# --- Signals ---
signal season_info_loaded(season_info: Dictionary)
signal leaderboard_loaded(leaderboard: Array)
signal rank_updated(rank_change: Dictionary)
signal rewards_loaded(rewards: Dictionary)
signal rewards_claimed_signal(rewards: Dictionary)
signal season_transitioned(old_season: Dictionary, new_season: Dictionary)
signal decay_info_updated(decay_info: Dictionary)
signal season_history_loaded(history: Array)
signal player_cosmetics_loaded(cosmetics: Dictionary)
signal prestige_progress_loaded(progress: Dictionary)
signal projected_elo_loaded(elo: int, current_rank: int, tier_name: String)

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

		# Update decay info
		_update_decay_info()

# --- Get Season End Time ---
func get_season_end_time() -> int:
	"""Returns the end time of the current season in milliseconds.

	Returns:
		int: Season end time (Unix timestamp in ms)
	"""
	if current_season.has("end_time"):
		return int(current_season.end_time)

	# Calculate based on start time if end time not available
	if current_season.has("start_time"):
		return int(current_season.start_time) + SEASON_DURATION_MS

	# Default: calculate from current time
	return int(Time.get_unix_time_from_system() * 1000) + SEASON_DURATION_MS

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

# --- Rating Decay Methods ---

## Apply rating decay based on inactivity
func apply_rating_decay(current_rating: int, last_active_ms: int) -> int:
	"""Calculates the decayed rating based on inactivity days.

	Parameters:
		current_rating: Player's current rating
		last_active_ms: Last activity timestamp in milliseconds

	Returns:
		int: Rating after decay calculation
	"""
	if current_rating <= MINIMUM_RATING:
		return current_rating

	var now_ms: int = int(Time.get_unix_time_from_system() * 1000)
	var inactive_ms: int = now_ms - last_active_ms
	var days_inactive: int = inactive_ms / (24 * 60 * 60 * 1000)

	# No decay if within threshold
	if days_inactive < DECAY_INACTIVE_DAYS_THRESHOLD:
		return current_rating

	# Determine decay rate
	var decay_rate: float = DECAY_RATE_PERCENT
	if days_inactive >= HIGH_DECAY_THRESHOLD_DAYS:
		decay_rate = HIGH_DECAY_RATE_PERCENT

	# Calculate decay periods
	var inactive_days: int = days_inactive - DECAY_INACTIVE_DAYS_THRESHOLD
	var decay_periods: int = inactive_days / DECAY_INACTIVE_DAYS_THRESHOLD

	# Calculate loss
	var decay_loss: float = current_rating * (decay_rate / 100.0) * float(decay_periods)
	decay_loss = min(decay_loss, float(MAX_DECAY_LOSS))

	# Apply decay with floor
	var new_rating: int = max(current_rating - int(decay_loss), MINIMUM_RATING)

	return new_rating

## Get player's decay info
func get_decay_info() -> Dictionary:
	"""Returns player's rating decay information.

	Returns:
		Dictionary: Decay info with days_inactive, points_at_risk, can_decay
	"""
	return decay_info

## Update decay info from server or local calculation
func _update_decay_info() -> void:
	"""Updates the decay info based on current player data."""
	if not current_season.is_empty() and player_score > 0:
		# Estimate last active time from local storage
		var last_active_ms: int = _get_last_active_from_storage()

		var now_ms: int = int(Time.get_unix_time_from_system() * 1000)
		var inactive_ms: int = max(0, now_ms - last_active_ms)
		var days_inactive: int = inactive_ms / (24 * 60 * 60 * 1000)

		var points_at_risk: int = 0
		var can_decay: bool = false

		if days_inactive >= DECAY_INACTIVE_DAYS_THRESHOLD and player_score > MINIMUM_RATING:
			can_decay = true
			var inactive_days: int = days_inactive - DECAY_INACTIVE_DAYS_THRESHOLD
			var decay_periods: int = inactive_days / DECAY_INACTIVE_DAYS_THRESHOLD

			var decay_rate: float = DECAY_RATE_PERCENT
			if days_inactive >= HIGH_DECAY_THRESHOLD_DAYS:
				decay_rate = HIGH_DECAY_RATE_PERCENT

			var decay_loss: float = player_score * (decay_rate / 100.0) * float(decay_periods)
			points_at_risk = min(int(decay_loss), MAX_DECAY_LOSS)

		decay_info = {
			"days_inactive": days_inactive,
			"points_at_risk": points_at_risk,
			"can_decay": can_decay,
			"threshold_days": DECAY_INACTIVE_DAYS_THRESHOLD,
			"minimum_rating": MINIMUM_RATING
		}

		decay_info_updated.emit(decay_info)

## Get last active timestamp from storage
func _get_last_active_from_storage() -> int:
	"""Retrieves the player's last active timestamp from local storage.

	Returns:
		int: Last active timestamp in milliseconds (0 if not found)
	"""
	if not network_manager:
		return 0

	var storage = network_manager.get_storage_sync()
	if not storage:
		return 0

	var last_active_data = storage.get("player_last_active")
	if last_active_data is Dictionary and last_active_data.has("timestamp"):
		return int(last_active_data.timestamp)

	# Default to current time (no decay for new players)
	return int(Time.get_unix_time_from_system() * 1000)

## Update player's last active timestamp
func update_player_activity() -> void:
	"""Updates the player's last activity timestamp."""
	if not network_manager:
		return

	var storage = network_manager.get_storage_sync()
	if not storage:
		return

	var timestamp_ms: int = int(Time.get_unix_time_from_system() * 1000)
	storage.put("player_last_active", {
		"timestamp": timestamp_ms
	})

	# Update decay info
	_update_decay_info()

# --- Season History Methods ---

## Get season history
func get_season_history(limit: int = 10) -> void:
	"""Retrieves historical season data.

	Parameters:
		limit: Maximum number of seasons to retrieve (default 10)
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_SEASON_HISTORY, json.stringify({"limit": limit}))

	if response.has("error"):
		push_error("Failed to get season history: %s" % response.error)
		return

	if response.get("success", false):
		season_history = response.get("history", [])
		season_history_loaded.emit(season_history)

## Get player rank in current season
func get_player_rank() -> void:
	"""Retrieves the player's current rank in the season."""
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
		player_score = response.get("rating", 0)
		time_remaining = response.get("time_remaining", 0)

		season_info_loaded.emit({
			"season": current_season,
			"player_rank": player_rank,
			"player_score": player_score,
			"time_remaining": time_remaining
		})

# --- Get Player Cosmetics ---
func get_player_cosmetics() -> void:
	"""Retrieves player's claimed cosmetics (titles, auras).

	Returns:
		Dictionary: Player's cosmetics with 'titles' and 'auras' arrays
	"""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_PLAYER_COSMETICS, json.stringify({}))

	if response.has("error"):
		push_error("Failed to get player cosmetics: %s" % response.error)
		return

	if response.get("success", false):
		var cosmetics: Dictionary = response.get("cosmetics", {})
		player_cosmetics_loaded.emit(cosmetics)

# --- Prestige Progress ---
func get_prestige_progress() -> void:
	"""Retrieves player's prestige progress across seasons."""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_PRESTIGE_PROGRESS, json.stringify({}))

	if response.has("error"):
		push_error("Failed to get prestige progress: %s" % response.error)
		return

	if response.get("success", false):
		prestige_progress = response.get("prestige", {})
		prestige_progress_loaded.emit(prestige_progress)

# --- Projected Next Season ELO ---
func get_projected_next_season_elo() -> void:
	"""Retrieves the player's projected starting ELO for next season."""
	if not network_manager or not network_manager.is_connected:
		push_error("Not connected to server")
		return

	var json: JSON = JSON.new()
	var response: Dictionary = await network_manager.send_rpc(RPC_GET_PROJECTED_NEXT_SEASON_ELO, json.stringify({}))

	if response.has("error"):
		push_error("Failed to get projected ELO: %s" % response.error)
		return

	if response.get("success", false):
		projected_next_season_elo = response.get("projected_elo", 1000)
		current_tier_name = response.get("tier_name", "Unranked")
		projected_elo_loaded.emit(
			projected_next_season_elo,
			response.get("current_rank", 0),
			current_tier_name
		)

# --- Local Soft Reset ELO Calculation ---
func calculate_soft_reset_elo(rank: int) -> int:
	"""Calculates projected starting ELO based on rank (local, no network).

	Parameters:
		rank: Player's current rank

	Returns:
		int: Projected starting ELO for next season
	"""
	if rank <= 10:
		return 1300
	elif rank <= 50:
		return 1200
	elif rank <= 100:
		return 1150
	elif rank <= 500:
		return 1100
	else:
		return 1000

func get_projected_elo_sync() -> int:
	"""Returns cached projected next season ELO (synchronous).

	Returns:
		int: Projected starting ELO
	"""
	return projected_next_season_elo

func get_prestige_progress_sync() -> Dictionary:
	"""Returns cached prestige progress (synchronous).

	Returns:
		Dictionary: Prestige progress data
	"""
	return prestige_progress

# --- Season Transition ---

## Handle season transition event
func on_season_transition(old_season: Dictionary, new_season: Dictionary) -> void:
	"""Called when a season ends and a new one begins.

	Parameters:
		old_season: The season that just ended
		new_season: The new active season
	"""
	current_season = new_season
	player_rank = 0
	player_score = 0
	projected_next_season_elo = 1000
	current_tier_name = "Unranked"

	season_transitioned.emit(old_season, new_season)

	# Refresh prestige progress for the new season
	get_prestige_progress()
	get_projected_next_season_elo()
