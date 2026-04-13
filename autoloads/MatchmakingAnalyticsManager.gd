## Matchmaking Analytics Manager
## Collects and analyzes matchmaking quality metrics for balance monitoring
##
## Signals:
## - match_data_logged(match_id: String): Emitted when match data is logged
## - abandonment_tracked(match_id: String): Emitted when match abandonment is tracked
## - balance_issue_detected(weapon_id: String, issue: String): Emitted when balance issue is detected

extends Node

# Note: Do NOT add class_name here as it conflicts with the autoload singleton

# --- Constants ---
# Target metrics for healthy matchmaking
const TARGET_RATING_DIFF: int = 100  # Average rating difference target
const TARGET_COMPLETION_RATE: float = 0.90  # 90% completion rate target
const TARGET_WIN_RATE_VARIANCE: float = 0.10  # 10% variance target (45-55%)
const TARGET_QUEUE_TIME_MEDIAN: int = 60  # 60 seconds median queue time target
const TARGET_ABANDONMENT_RATE: float = 0.05  # 5% abandonment rate target

# --- Analytics Data ---
var _match_metrics: Dictionary = {}  # match_id -> match data
var _weapon_stats: Dictionary = {}  # weapon_id -> weapon statistics
var _quality_metrics: Dictionary = {}  # Overall quality metrics
var _network_manager: Node

# --- Signals ---
signal match_data_logged(match_id: String)
signal abandonment_tracked(match_id: String)
signal balance_issue_detected(weapon_id: String, issue: String)

# --- Initialization ---
func _ready() -> void:
	"""Initialize analytics manager."""
	_network_manager = get_node_or_null("/root/NetworkManager")

	# Initialize quality metrics
	_quality_metrics = {
		"total_matches": 0,
		"completed_matches": 0,
		"abandoned_matches": 0,
		"rating_diff_sum": 0,
		"rating_diff_values": [],  # Store for percentile calculations
		"queue_times": [],  # Store queue times for median calculation
		"weapon_usage": {},  # weapon_id -> {matches, wins, losses}
		"last_updated": Time.get_unix_time_from_system()
	}

# --- Match Data Logging ---

func log_match_data(rating_diff: int, weapons: Array, duration: float, match_id: String = "") -> void:
	"""Logs match data for analytics.

	Parameters:
		rating_diff: Rating difference between players
		weapons: Array of weapon IDs used in match
		duration: Match duration in seconds
		match_id: Unique match identifier (generated if not provided)
	"""
	if match_id.is_empty():
		match_id = "match_" + str(Time.get_unix_time_from_system())

	var timestamp: int = Time.get_unix_time_from_system()

	var match_data: Dictionary = {
		"match_id": match_id,
		"timestamp": timestamp,
		"rating_diff": rating_diff,
		"weapons": weapons,
		"duration": duration,
		"completed": true
	}

	# Store match data
	_match_metrics[match_id] = match_data

	# Update overall quality metrics
	_quality_metrics["total_matches"] += 1
	_quality_metrics["completed_matches"] += 1
	_quality_metrics["rating_diff_sum"] += rating_diff
	_quality_metrics["rating_diff_values"].append(rating_diff)

	# Track weapon usage
	for weapon_id in weapons:
		if not _quality_metrics["weapon_usage"].has(weapon_id):
			_quality_metrics["weapon_usage"][weapon_id] = {
				"matches": 0,
				"wins": 0,
				"losses": 0,
				"total_rating_diff": 0
			}

		_quality_metrics["weapon_usage"][weapon_id]["matches"] += 1
		_quality_metrics["weapon_usage"][weapon_id]["total_rating_diff"] += rating_diff

	# Update timestamp
	_quality_metrics["last_updated"] = timestamp

	print("MatchmakingAnalyticsManager: Logged match %s (rating_diff: %d, duration: %.1f)" % [match_id, rating_diff, duration])
	match_data_logged.emit(match_id)

	# Send to server if connected
	if _network_manager and _network_manager.is_connected:
		_send_match_data_to_server(match_data)


func log_queue_time(queue_time: float) -> void:
	"""Logs queue time for matchmaking quality analysis.

	Parameters:
		queue_time: Time spent in queue in seconds
	"""
	_quality_metrics["queue_times"].append(queue_time)

	# Keep only last 1000 queue times for memory management
	if _quality_metrics["queue_times"].size() > 1000:
		_quality_metrics["queue_times"] = _quality_metrics["queue_times"].slice(-1000)


func track_abandonment(match_id: String, reason: String = "") -> void:
	"""Tracks match abandonment for quality analysis.

	Parameters:
		match_id: Unique match identifier
		reason: Optional reason for abandonment
	"""
	if _match_metrics.has(match_id):
		var match_data: Dictionary = _match_metrics[match_id]
		match_data["completed"] = false
		match_data["abandonment_reason"] = reason

		# Update abandonment metrics
		_quality_metrics["completed_matches"] -= 1
		_quality_metrics["abandoned_matches"] += 1

		print("MatchmakingAnalyticsManager: Tracked abandonment for match %s (reason: %s)" % [match_id, reason])
		abandonment_tracked.emit(match_id)

		# Send to server if connected
		if _network_manager and _network_manager.is_connected:
			_send_abandonment_to_server(match_id, reason)


func log_weapon_result(weapon_id: String, is_win: bool) -> void:
	"""Logs weapon win/loss result for balance analysis.

	Parameters:
		weapon_id: Unique weapon identifier
		is_win: True if weapon user won the match
	"""
	if _quality_metrics["weapon_usage"].has(weapon_id):
		if is_win:
			_quality_metrics["weapon_usage"][weapon_id]["wins"] += 1
		else:
			_quality_metrics["weapon_usage"][weapon_id]["losses"] += 1

		# Check for balance issues
		_check_weapon_balance(weapon_id)


# --- Metrics Retrieval ---

func get_match_quality_metrics() -> Dictionary:
	"""Returns current match quality metrics.

	Returns:
		Dictionary containing:
			- avg_rating_diff: Average rating difference
			- completion_rate: Percentage of matches completed
			- abandonment_rate: Percentage of matches abandoned
			- median_queue_time: Median queue time in seconds
			- total_matches: Total number of tracked matches
	"""
	var total_matches: int = _quality_metrics["total_matches"]
	var completed_matches: int = _quality_metrics["completed_matches"]
	var abandoned_matches: int = _quality_metrics["abandoned_matches"]
	var rating_diff_sum: int = _quality_metrics["rating_diff_sum"]

	var avg_rating_diff: float = 0.0
	if total_matches > 0:
		avg_rating_diff = float(rating_diff_sum) / float(total_matches)

	var completion_rate: float = 0.0
	if total_matches > 0:
		completion_rate = float(completed_matches) / float(total_matches)

	var abandonment_rate: float = 0.0
	if total_matches > 0:
		abandonment_rate = float(abandoned_matches) / float(total_matches)

	var median_queue_time: float = _calculate_median(_quality_metrics["queue_times"])

	return {
		"avg_rating_diff": avg_rating_diff,
		"completion_rate": completion_rate,
		"abandonment_rate": abandonment_rate,
		"median_queue_time": median_queue_time,
		"total_matches": total_matches,
		"last_updated": _quality_metrics["last_updated"]
	}


func get_weapon_statistics() -> Dictionary:
	"""Returns weapon usage statistics for balance tuning.

	Returns:
		Dictionary mapping weapon_id to statistics:
			- matches: Number of matches weapon was used
			- wins: Number of wins
			- losses: Number of losses
			- win_rate: Win percentage
			- avg_rating_diff: Average rating difference when used
	"""
	var weapon_stats: Dictionary = {}

	for weapon_id in _quality_metrics["weapon_usage"]:
		var usage: Dictionary = _quality_metrics["weapon_usage"][weapon_id]
		var matches: int = usage["matches"]
		var wins: int = usage["wins"]
		var losses: int = usage["losses"]

		var win_rate: float = 0.0
		if matches > 0:
			win_rate = float(wins) / float(matches)

		var avg_rating_diff: float = 0.0
		if matches > 0:
			avg_rating_diff = float(usage["total_rating_diff"]) / float(matches)

		weapon_stats[weapon_id] = {
			"matches": matches,
			"wins": wins,
			"losses": losses,
			"win_rate": win_rate,
			"avg_rating_diff": avg_rating_diff
		}

	return weapon_stats


func get_rating_difference_distribution() -> Dictionary:
	"""Returns rating difference distribution for quality analysis.

	Returns:
		Dictionary with distribution buckets:
			- 0-50, 51-100, 101-150, 151-200, 200+
	"""
	var rating_diff_values: Array = _quality_metrics["rating_diff_values"]

	var distribution: Dictionary = {
		"0-50": 0,
		"51-100": 0,
		"101-150": 0,
		"151-200": 0,
		"200+": 0
	}

	for diff in rating_diff_values:
		if diff <= 50:
			distribution["0-50"] += 1
		elif diff <= 100:
			distribution["51-100"] += 1
		elif diff <= 150:
			distribution["101-150"] += 1
		elif diff <= 200:
			distribution["151-200"] += 1
		else:
			distribution["200+"] += 1

	return distribution


# --- Balance Issue Detection ---

func detect_balance_issues() -> Array:
	"""Detects potential balance issues from collected metrics.

	Returns:
		Array of detected issues, each with:
			- weapon_id: Weapon identifier
			- issue_type: Type of issue (e.g., "high_win_rate", "low_win_rate")
			- severity: Severity level (low, medium, high)
			- description: Human-readable description
	"""
	var issues: Array = []
	var weapon_stats: Dictionary = get_weapon_statistics()

	for weapon_id in weapon_stats:
		var stats: Dictionary = weapon_stats[weapon_id]
		var win_rate: float = stats["win_rate"]
		var matches: int = stats["matches"]

		# Only check weapons with sufficient data
		if matches < 10:
			continue

		# Check for high win rate (overpowered)
		if win_rate > 0.60:
			var severity: String = "low"
			if win_rate > 0.70:
				severity = "medium"
			if win_rate > 0.80:
				severity = "high"

			issues.append({
				"weapon_id": weapon_id,
				"issue_type": "high_win_rate",
				"severity": severity,
				"description": "Weapon has %.1f%% win rate (%d matches)" % [win_rate * 100, matches]
			})

		# Check for low win rate (underpowered)
		elif win_rate < 0.40:
			var severity: String = "low"
			if win_rate < 0.30:
				severity = "medium"
			if win_rate < 0.20:
				severity = "high"

			issues.append({
				"weapon_id": weapon_id,
				"issue_type": "low_win_rate",
				"severity": severity,
				"description": "Weapon has %.1f%% win rate (%d matches)" % [win_rate * 100, matches]
			})

	# Check for overall match quality issues
	var quality_metrics: Dictionary = get_match_quality_metrics()

	if quality_metrics["avg_rating_diff"] > TARGET_RATING_DIFF * 1.5:
		issues.append({
			"weapon_id": "system",
			"issue_type": "high_rating_diff",
			"severity": "medium",
			"description": "Average rating difference (%.1f) exceeds target (%d)" % [
				quality_metrics["avg_rating_diff"],
				TARGET_RATING_DIFF
			]
		})

	if quality_metrics["abandonment_rate"] > TARGET_ABANDONMENT_RATE * 1.5:
		issues.append({
			"weapon_id": "system",
			"issue_type": "high_abandonment_rate",
			"severity": "high",
			"description": "Abandonment rate (%.1f%%) exceeds target (%.1f%%)" % [
				quality_metrics["abandonment_rate"] * 100,
				TARGET_ABANDONMENT_RATE * 100
			]
		})

	return issues


# --- Data Export ---

func export_analytics_report() -> Dictionary:
	"""Exports comprehensive analytics report for admin review.

	Returns:
		Dictionary containing all analytics data:
			- quality_metrics: Overall match quality metrics
			- weapon_stats: Weapon usage statistics
			- rating_diff_distribution: Rating difference distribution
			- detected_issues: Array of balance issues
			- export_timestamp: Report generation time
	"""
	return {
		"quality_metrics": get_match_quality_metrics(),
		"weapon_stats": get_weapon_statistics(),
		"rating_diff_distribution": get_rating_difference_distribution(),
		"detected_issues": detect_balance_issues(),
		"export_timestamp": Time.get_unix_time_from_system()
	}


# --- Helper Functions ---

func _check_weapon_balance(weapon_id: String) -> void:
	"""Checks for balance issues on a specific weapon.

	Parameters:
		weapon_id: Weapon identifier to check
	"""
	if not _quality_metrics["weapon_usage"].has(weapon_id):
		return

	var usage: Dictionary = _quality_metrics["weapon_usage"][weapon_id]
	var matches: int = usage["matches"]
	var wins: int = usage["wins"]

	# Only check with sufficient data
	if matches < 10:
		return

	var win_rate: float = float(wins) / float(matches)

	# Emit signal if balance issue detected
	if win_rate > 0.65 or win_rate < 0.35:
		var issue: String = "high_win_rate" if win_rate > 0.5 else "low_win_rate"
		balance_issue_detected.emit(weapon_id, issue)


func _calculate_median(values: Array) -> float:
	"""Calculates median value from array of numbers.

	Parameters:
		values: Array of numbers

	Returns:
		Median value
	"""
	if values.is_empty():
		return 0.0

	var sorted: Array = values.duplicate()
	sorted.sort()

	var count: int = sorted.size()
	var mid: int = count / 2

	if count % 2 == 0:
		return (sorted[mid - 1] + sorted[mid]) / 2.0
	else:
		return float(sorted[mid])


# --- Server Communication ---

func _send_match_data_to_server(match_data: Dictionary) -> void:
	"""Sends match data to server for persistent storage.

	Parameters:
		match_data: Match data dictionary
	"""
	if not _network_manager or not _network_manager.is_connected:
		return

	# TODO: Implement RPC call to send match data to server
	# This should call backend endpoint to store analytics data


func _send_abandonment_to_server(match_id: String, reason: String) -> void:
	"""Sends abandonment data to server.

	Parameters:
		match_id: Match identifier
		reason: Abandonment reason
	"""
	if not _network_manager or not _network_manager.is_connected:
		return

	# TODO: Implement RPC call to send abandonment data to server


# --- Target Getters ---

func get_target_rating_diff() -> int:
	"""Returns target rating difference."""
	return TARGET_RATING_DIFF


func get_target_completion_rate() -> float:
	"""Returns target completion rate."""
	return TARGET_COMPLETION_RATE


func get_target_win_rate_variance() -> float:
	"""Returns target win rate variance."""
	return TARGET_WIN_RATE_VARIANCE


func get_target_queue_time_median() -> int:
	"""Returns target queue time median."""
	return TARGET_QUEUE_TIME_MEDIAN


func get_target_abandonment_rate() -> float:
	"""Returns target abandonment rate."""
	return TARGET_ABANDONMENT_RATE


# --- Data Management ---

func clear_local_data() -> void:
	"""Clears all locally stored analytics data."""
	_match_metrics.clear()
	_quality_metrics = {
		"total_matches": 0,
		"completed_matches": 0,
		"abandoned_matches": 0,
		"rating_diff_sum": 0,
		"rating_diff_values": [],
		"queue_times": [],
		"weapon_usage": {},
		"last_updated": Time.get_unix_time_from_system()
	}

	print("MatchmakingAnalyticsManager: Cleared all local analytics data")
