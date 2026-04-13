## Manages dynamic difficulty adjustment based on player performance.
## Tracks win/lose streaks and adjusts difficulty modifiers accordingly.
##
## Signals:
## - difficulty_changed(new_level: String, modifier: float): Emitted when difficulty changes
## - streak_updated(streak_type: String, count: int): Emitted when streak changes
## - performance_updated(rating: String): Emitted when performance rating changes
##
extends Node

# --- Difficulty Levels ---
const DIFFICULTY_EASY = -0.20
const DIFFICULTY_NORMAL = 0.0
const DIFFICULTY_HARD = 0.10
const DIFFICULTY_EXTREME = 0.20

const MAX_MODIFIER = 0.20
const MIN_MODIFIER = -0.20

# --- Streak Thresholds ---
const WIN_STREAK_THRESHOLD = 3
const LOSE_STREAK_THRESHOLD = 3

# --- Performance State ---
var current_modifier: float = 0.0
var win_streak: int = 0
var lose_streak: int = 0
var match_history: Array = []
var max_history_size: int = 50

# --- Manager References ---
var network_manager: Node
var analytics: Node

# --- Signals ---
signal difficulty_changed(new_level: String, modifier: float)
signal streak_updated(streak_type: String, count: int)
signal performance_updated(rating: String)

func _ready() -> void:
	"""Initializes the difficulty manager and loads saved state."""
	network_manager = get_node_or_null("/root/NetworkManager")
	analytics = get_node_or_null("/root/AnalyticsManager")
	load_difficulty_state()

func load_difficulty_state() -> void:
	"""Loads difficulty state from persistent storage."""
	var file = FileAccess.open("user://difficulty_state.json", FileAccess.READ)
	if file:
		var json_string = file.get_as_text()
		file.close()
		var json = JSON.new()
		var parse_result = json.parse(json_string)
		if parse_result == OK:
			var save_data = json.data
			current_modifier = save_data.get("current_modifier", 0.0)
			win_streak = save_data.get("win_streak", 0)
			lose_streak = save_data.get("lose_streak", 0)
			match_history = save_data.get("match_history", [])
			_update_difficulty_level()
		else:
			push_error("Failed to parse difficulty state JSON")
	else:
		# Initialize with default state
		current_modifier = 0.0
		win_streak = 0
		lose_streak = 0
		match_history = []
		save_difficulty_state()

func save_difficulty_state() -> void:
	"""Saves difficulty state to persistent storage."""
	var save_data = {
		"current_modifier": current_modifier,
		"win_streak": win_streak,
		"lose_streak": lose_streak,
		"match_history": match_history
	}
	var file = FileAccess.open("user://difficulty_state.json", FileAccess.WRITE)
	if file:
		var _err = file.store_string(JSON.stringify(save_data))
		file.close()

func track_match_outcome(won: bool, match_type: String) -> void:
	"""Tracks match outcome and updates difficulty accordingly.

	Parameters:
		won: True if player won, false if lost
		match_type: Type of match ("pve" or "pvp")
	"""
	var timestamp = Time.get_unix_time_from_system()
	var match_entry = {
		"won": won,
		"match_type": match_type,
		"timestamp": timestamp
	}

	# Add to history
	match_history.append(match_entry)
	if match_history.size() > max_history_size:
		match_history.pop_front()

	# Update streaks
	if won:
		win_streak += 1
		lose_streak = 0
	else:
		lose_streak += 1
		win_streak = 0

	streak_updated.emit("win" if won else "lose", win_streak if won else lose_streak)

	# Check for difficulty adjustment
	_check_streak_thresholds()

	# Save state
	save_difficulty_state()

	# Track in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("match_outcome_tracked", {
			"won": won,
			"match_type": match_type,
			"win_streak": win_streak,
			"lose_streak": lose_streak,
			"current_modifier": current_modifier
		})

func _check_streak_thresholds() -> void:
	"""Checks if streak thresholds are met and adjusts difficulty."""
	var previous_level = get_difficulty_level_string()
	var adjustment_needed = false

	if win_streak >= WIN_STREAK_THRESHOLD:
		# Increase difficulty
		var old_modifier = current_modifier
		current_modifier = min(current_modifier + 0.10, MAX_MODIFIER)
		if current_modifier != old_modifier:
			adjustment_needed = true

	if lose_streak >= LOSE_STREAK_THRESHOLD:
		# Decrease difficulty
		var old_modifier = current_modifier
		current_modifier = max(current_modifier - 0.10, MIN_MODIFIER)
		if current_modifier != old_modifier:
			adjustment_needed = true

	if adjustment_needed:
		_update_difficulty_level()

func _update_difficulty_level() -> void:
	"""Emits difficulty changed signal and syncs to server."""
	var level_string = get_difficulty_level_string()
	difficulty_changed.emit(level_string, current_modifier)

	# Sync with server
	_sync_difficulty_to_server()

func _sync_difficulty_to_server() -> void:
	"""Syncs current difficulty setting to the server."""
	if not network_manager or not network_manager.is_connected:
		return

	var payload = JSON.stringify({
		"difficulty_modifier": current_modifier,
		"difficulty_level": get_difficulty_level_string()
	})

	# Send async RPC to server (fire and forget)
	network_manager.send_rpc_async("armored_archer/sync_difficulty", payload, 5.0)

func get_difficulty_modifier() -> float:
	"""Returns the current difficulty modifier.

	Returns:
		float: Modifier value from -0.20 to 0.20
	"""
	return current_modifier

func get_difficulty_level_string() -> String:
	"""Returns the current difficulty level as a string.

	Returns:
		String: "Easy", "Normal", "Hard", or "Extreme"
	"""
	if current_modifier <= DIFFICULTY_EASY + 0.01:
		return "Easy"
	elif current_modifier <= DIFFICULTY_NORMAL + 0.01:
		return "Normal"
	elif current_modifier <= DIFFICULTY_HARD + 0.01:
		return "Hard"
	else:
		return "Extreme"

func calculate_target_difficulty(base_difficulty: float, modifier: float = current_modifier) -> float:
	"""Calculates the target difficulty for an encounter.

	Parameters:
		base_difficulty: Base difficulty value (0.0 to 1.0)
		modifier: Optional modifier override (uses current if not specified)

	Returns:
		float: Adjusted difficulty value clamped to valid range
	"""
	var adjusted = base_difficulty * (1.0 + modifier)
	return clamp(adjusted, 0.0, 1.5)

func get_performance_rating() -> String:
	"""Calculates and returns the player's performance rating.

	Returns:
		String: Performance rating ("Excellent", "Good", "Average", "Poor")
	"""
	if match_history.is_empty():
		return "Average"

	var recent_matches = match_history.slice(max(0, match_history.size() - 10))
	if recent_matches.is_empty():
		return "Average"

	var wins = 0
	for match in recent_matches:
		if match.get("won", false):
			wins += 1

	var win_rate = float(wins) / float(recent_matches.size())

	if win_rate >= 0.8:
		return "Excellent"
	elif win_rate >= 0.6:
		return "Good"
	elif win_rate >= 0.4:
		return "Average"
	else:
		return "Poor"

func get_win_rate(window_size: int = 10) -> float:
	"""Calculates win rate for the most recent matches.

	Parameters:
		window_size: Number of recent matches to consider

	Returns:
		float: Win rate from 0.0 to 1.0
	"""
	if match_history.is_empty():
		return 0.0

	var recent_matches = match_history.slice(max(0, match_history.size() - window_size))
	if recent_matches.is_empty():
		return 0.0

	var wins = 0
	for match in recent_matches:
		if match.get("won", false):
			wins += 1

	return float(wins) / float(recent_matches.size())

func get_win_streak() -> int:
	"""Returns the current win streak.

	Returns:
		int: Number of consecutive wins
	"""
	return win_streak

func get_lose_streak() -> int:
	"""Returns the current lose streak.

	Returns:
		int: Number of consecutive losses
	"""
	return lose_streak

func reset_difficulty() -> void:
	"""Resets difficulty to normal level."""
	var old_modifier = current_modifier
	current_modifier = 0.0
	win_streak = 0
	lose_streak = 0
	save_difficulty_state()

	if old_modifier != current_modifier:
		_update_difficulty_level()

	# Track reset in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("difficulty_reset", {
			"previous_modifier": old_modifier,
			"new_modifier": current_modifier
		})

func set_difficulty_modifier(modifier: float) -> void:
	"""Manually sets the difficulty modifier (for debugging/testing).

	Parameters:
		modifier: New modifier value (clamped to valid range)
	"""
	var old_modifier = current_modifier
	current_modifier = clamp(modifier, MIN_MODIFIER, MAX_MODIFIER)
	save_difficulty_state()

	if old_modifier != current_modifier:
		_update_difficulty_level()

func get_difficulty_color() -> Color:
	"""Returns the color associated with current difficulty level.

	Returns:
		Color: Color code for UI display
	"""
	match get_difficulty_level_string():
		"Easy":
			return Color.GREEN
		"Normal":
			return Color.WHITE
		"Hard":
			return Color.ORANGE
		"Extreme":
			return Color.RED
		_:
			return Color.WHITE

func get_encounter_reward_modifier() -> float:
	"""Returns the reward multiplier based on current difficulty.

	Returns:
		float: Multiplier for XP/gold rewards
	"""
	match get_difficulty_level_string():
		"Easy":
			return 0.8
		"Normal":
			return 1.0
		"Hard":
			return 1.2
		"Extreme":
			return 1.4
		_:
			return 1.0
