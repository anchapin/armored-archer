## Manages seasonal messaging: timed announcements, reward previews, tier milestones, and decay warnings.
##
## Signals:
## - season_message(message: Dictionary): Emitted when a seasonal message should be displayed
## - tier_milestone_reached(tier: String, rank: int): Emitted when player enters a new tier
## - season_ending_soon(time_left: String): Emitted when season end is approaching
##
extends Node

# --- Signals ---
signal season_message(message: Dictionary)
signal tier_milestone_reached(tier: String, rank: int)
signal season_ending_soon(time_left: String)

# --- Season End Warning Thresholds (in hours) ---
const WARNING_THRESHOLDS: Array = [168, 72, 24, 1]  # 7d, 3d, 1d, 1h
const WARNING_MESSAGES: Dictionary = {
	168: "Season ends in 1 week! Push for a higher rank!",
	72: "Only 3 days left in the season!",
	24: "Final day of the season! Last chance to climb!",
	1: "Less than 1 hour remaining! Season ending soon!",
}

# --- Tier Threshold Messages ---
const TIER_MESSAGES: Dictionary = {
	"Legendary": "You've reached the Legendary tier! Incredible!",
	"Epic": "Epic tier achieved! Keep pushing for Legendary!",
	"Rare": "Welcome to the Rare tier! Great progress!",
	"Uncommon": "Uncommon tier reached! You're climbing!",
	"Common": "You're ranked! Keep playing to climb higher!",
}

# --- State ---
var _last_warning_threshold: int = 999999
var _last_known_tier: String = ""
var _check_timer: Timer
var _messages_queue: Array = []

# --- Manager References ---
@onready var season_manager: Node = get_node_or_null("/root/SeasonManager")

func _ready() -> void:
	_setup_check_timer()
	_connect_signals()

func _setup_check_timer() -> void:
	_check_timer = Timer.new()
	_check_timer.wait_time = 60.0  # Check every minute
	_check_timer.autostart = true
	_check_timer.timeout.connect(_check_season_status)
	add_child(_check_timer)

func _connect_signals() -> void:
	if season_manager:
		season_manager.season_info_loaded.connect(_on_season_info_loaded)
		season_manager.rank_updated.connect(_on_rank_updated)
		season_manager.season_transitioned.connect(_on_season_transitioned)
		season_manager.decay_info_updated.connect(_on_decay_info_updated)
		season_manager.rewards_loaded.connect(_on_rewards_loaded)

# --- Check Season Status (called periodically) ---
func _check_season_status() -> void:
	if not season_manager:
		return

	var time_remaining_ms: int = season_manager.get_time_remaining()
	_check_season_end_warning(time_remaining_ms)

# --- Season End Warnings ---
func _check_season_end_warning(time_remaining_ms: int) -> void:
	var hours_remaining: float = time_remaining_ms / (1000.0 * 60.0 * 60.0)

	for threshold in WARNING_THRESHOLDS:
		if hours_remaining <= float(threshold) and _last_warning_threshold > threshold:
			_last_warning_threshold = threshold
			var msg_text: String = WARNING_MESSAGES.get(threshold, "Season ending soon!")
			_emit_message("season_ending", msg_text, "warning")
			season_ending_soon.emit(_format_hours(hours_remaining))
			break

# --- Handle Season Info Loaded ---
func _on_season_info_loaded(data: Dictionary) -> void:
	var player_rank: int = data.get("player_rank", 0)

	if player_rank > 0:
		var current_tier: String = season_manager.get_rank_tier(player_rank)
		if _last_known_tier != current_tier and _last_known_tier != "":
			tier_milestone_reached.emit(current_tier, player_rank)
			var msg: String = TIER_MESSAGES.get(current_tier, "Tier changed!")
			_emit_message("tier_milestone", msg, "achievement")
		_last_known_tier = current_tier

	_check_season_end_warning(season_manager.get_time_remaining())

# --- Handle Rank Updated ---
func _on_rank_updated(rank_change: Dictionary) -> void:
	var my_id: String = ""
	if season_manager and season_manager.network_manager:
		my_id = season_manager.network_manager.user_id

	if my_id.is_empty():
		return

	var is_winner: bool = rank_change.get("winner", {}).get("user_id", "") == my_id
	if not is_winner:
		return

	var new_rank: int = rank_change.get("winner", {}).get("new_rank", 0)
	if new_rank <= 0:
		return

	var new_tier: String = season_manager.get_rank_tier(new_rank)
	if new_tier != _last_known_tier:
		_last_known_tier = new_tier
		tier_milestone_reached.emit(new_tier, new_rank)

		var msg: String = TIER_MESSAGES.get(new_tier, "Tier changed!")
		_emit_message("tier_milestone", msg, "achievement")

# --- Handle Season Transition ---
func _on_season_transitioned(_old_season: Dictionary, _new_season: Dictionary) -> void:
	_last_warning_threshold = 999999
	_last_known_tier = ""
	_emit_message(
		"season_start",
		"A new season has begun! Climb the ladder and earn rewards!",
		"info"
	)

# --- Handle Decay Info ---
func _on_decay_info_updated(info: Dictionary) -> void:
	if info.get("can_decay", false):
		var points_at_risk: int = info.get("points_at_risk", 0)
		if points_at_risk > 0:
			_emit_message(
				"decay_warning",
				"Your rating is decaying! %d points at risk. Play a match to stop decay." % points_at_risk,
				"warning"
			)

# --- Handle Rewards Loaded ---
func _on_rewards_loaded(rewards: Dictionary) -> void:
	if rewards.is_empty():
		return
	var tier: String = rewards.get("rank_tier", "common").capitalize()
	_emit_message(
		"rewards_available",
		"Season rewards available! Current tier: %s. Check the leaderboard to preview." % tier,
		"info"
	)

# --- Emit Message ---
func _emit_message(msg_type: String, text: String, priority: String) -> void:
	var message: Dictionary = {
		"type": msg_type,
		"text": text,
		"priority": priority,
		"timestamp": int(Time.get_unix_time_from_system() * 1000),
	}
	_messages_queue.append(message)
	season_message.emit(message)

# --- Public API ---

## Get all queued messages
func get_pending_messages() -> Array:
	return _messages_queue

## Clear the message queue
func clear_messages() -> void:
	_messages_queue.clear()

## Get a motivational message based on rank
func get_motivational_message(player_rank: int) -> String:
	if player_rank <= 0:
		return "Play PvP matches to earn your rank!"
	elif player_rank <= 10:
		return "Top 10! Defend your Legendary position!"
	elif player_rank <= 50:
		var needed: int = player_rank - 10
		return "Rank %d! Only %d spots to Legendary!" % [player_rank, needed]
	elif player_rank <= 100:
		var needed: int = player_rank - 50
		return "Rank %d! %d spots to Epic tier!" % [player_rank, needed]
	elif player_rank <= 500:
		var needed: int = player_rank - 100
		return "Rank %d! %d spots to Rare tier!" % [player_rank, needed]
	else:
		return "Rank %d. Play matches to climb the ladder!" % player_rank

## Get a description of what the next tier offers
func get_next_tier_info(player_rank: int) -> Dictionary:
	var current_tier: String = season_manager.get_rank_tier(player_rank) if season_manager else "Unranked"
	var next_tier: String = ""
	var rank_threshold: int = 0

	if player_rank <= 0:
		return {"tier": "Common", "threshold": 0, "message": "Start playing to get ranked!"}
	elif player_rank <= 10:
		return {"tier": "Legendary (max)", "threshold": 1, "message": "You're at the top! Defend your rank!"}
	elif player_rank <= 50:
		next_tier = "Legendary"
		rank_threshold = 10
	elif player_rank <= 100:
		next_tier = "Epic"
		rank_threshold = 50
	elif player_rank <= 500:
		next_tier = "Rare"
		rank_threshold = 100
	else:
		next_tier = "Uncommon"
		rank_threshold = 500

	return {
		"tier": next_tier,
		"threshold": rank_threshold,
		"message": "Climb to rank %d for %s tier!" % [rank_threshold, next_tier],
	}

## Get projected rewards for a given rank
func get_projected_rewards(player_rank: int) -> Dictionary:
	var tier: String = season_manager.get_rank_tier(player_rank) if season_manager else "Common"

	var rewards: Dictionary = {"tier": tier, "coins": 0, "gems": 0, "cosmetics": {}}

	match tier:
		"Legendary":
			rewards.coins = 10000
			rewards.gems = 500
			rewards.cosmetics = {"title": "Legendary Archer", "aura": "golden_aura"}
		"Epic":
			rewards.coins = 5000
			rewards.gems = 250
			rewards.cosmetics = {"title": "Epic Warrior", "aura": "epic_glow"}
		"Rare":
			rewards.coins = 2500
			rewards.gems = 100
			rewards.cosmetics = {"title": "Rare Contender"}
		"Uncommon":
			rewards.coins = 1000
			rewards.gems = 50
		"Common":
			rewards.coins = 500
			rewards.gems = 25
		_:
			rewards.coins = 500
			rewards.gems = 25

	return rewards

# --- Helpers ---
func _format_hours(hours: float) -> String:
	if hours >= 24.0:
		return "%dd" % int(hours / 24.0)
	elif hours >= 1.0:
		return "%dh" % int(hours)
	else:
		return "%dm" % int(hours * 60.0)
