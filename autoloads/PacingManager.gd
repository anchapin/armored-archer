## Manages encounter pacing, variety, and fatigue monitoring.
## Tracks content type distribution (60% combat, 20% exploration, 20% narrative)
## and provides pacing recommendations to prevent player fatigue.
##
## Signals:
## - fatigue_warning(level: int): Emitted when fatigue threshold is reached
## - pacing_break_recommended(reason: String): Emitted when a break is suggested
## - encounter_type_classified(type: String): Emitted when an encounter is classified
## - pacing_metrics_updated(metrics: Dictionary): Emitted when pacing data changes
##
extends Node

# --- Content Type Enum ---
enum ContentType {
	COMBAT,
	EXPLORATION,
	NARRATIVE,
	PUZZLE
}

# --- Pacing Targets ---
const TARGET_COMBAT_RATIO := 0.60  # 60% of encounters should be combat
const TARGET_EXPLORATION_RATIO := 0.20  # 20% should be exploration
const TARGET_NARRATIVE_RATIO := 0.20  # 20% should be narrative
const MAX_COMBAT_STREAK := 6  # Max combat encounters before non-combat content
const MIN_EXPLORATION_STREAK := 3  # Min exploration before returning to combat
const FATIGUE_THRESHOLD_HIGH := 75  # High fatigue threshold
const FATIGUE_THRESHOLD_CRITICAL := 88  # Critical fatigue threshold

# --- Pacing State ---
var recent_encounters: Array = []  # Last 10 encounters
var combat_streak: int = 0
var exploration_streak: int = 0
var current_fatigue: float = 0.0  # 0.0 to 100.0
var session_encounters: int = 0
var combat_time_accumulated: float = 0.0

# --- Encounter Classification Data ---
var encounter_classifications: Dictionary = {}

# --- Manager References ---
var network_manager: Node
var analytics: Node
var campaign_manager: Node

# --- Signals ---
signal fatigue_warning(level: int)
signal pacing_break_recommended(reason: String)
signal encounter_type_classified(type: String)
signal pacing_metrics_updated(metrics: Dictionary)

func _ready() -> void:
	"""Initializes the pacing manager and loads saved state."""
	network_manager = get_node_or_null("/root/NetworkManager")
	analytics = get_node_or_null("/root/AnalyticsManager")
	campaign_manager = get_node_or_null("/root/CampaignManager")

	load_pacing_state()
	_init_encounter_classifications()

func _init_encounter_classifications() -> void:
	"""Initializes default encounter type classifications."""
	encounter_classifications = {
		# Difficulty 1 - Forest
		"forest_goblin": ContentType.COMBAT,
		"forest_scout": ContentType.COMBAT,
		"forest_alpha": ContentType.COMBAT,
		# Difficulty 2 - Cavern
		"cavern_golem": ContentType.COMBAT,
		"cavern_elemental": ContentType.COMBAT,
		"cavern_warlord": ContentType.COMBAT,
		# Difficulty 3 - Sky
		"sky_drake": ContentType.COMBAT,
		"frost_giant": ContentType.COMBAT,
		"ancient_guardian": ContentType.COMBAT,
	}

## Classifies an encounter based on its data.
##
## Parameters:
##   encounter_data: Dictionary containing encounter information
##
## Returns:
##   ContentType enum value
func classify_encounter(encounter_data: Dictionary) -> ContentType:
	"""Classifies an encounter based on its data.

	Parameters:
		encounter_data: Dictionary containing encounter information

	Returns:
		ContentType enum value (COMBAT, EXPLORATION, NARRATIVE, PUZZLE)
	"""
	var encounter_id: String = encounter_data.get("id", "")
	var is_boss: bool = encounter_data.get("is_boss", false)
	var biome: String = encounter_data.get("biome", "")
	var difficulty: int = encounter_data.get("difficulty", 1)

	# Check pre-classified encounters first
	if encounter_id in encounter_classifications:
		return encounter_classifications[encounter_id]

	# Boss encounters are always combat
	if is_boss:
		return ContentType.COMBAT

	# Difficulty-based classification
	match difficulty:
		1:
			# Forest: Mix of combat and exploration
			if biome == "forest":
				return ContentType.EXPLORATION if randf() < 0.3 else ContentType.COMBAT
		2:
			# Cavern: More combat, some puzzles
			if biome == "cavern":
				return ContentType.PUZZLE if randf() < 0.25 else ContentType.COMBAT
		3:
			# Sky: Heavy combat
			if biome == "sky":
				return ContentType.COMBAT

	# Default to combat for unclassified
	return ContentType.COMBAT

## Tracks pacing state based on encounter type and duration.
##
## Parameters:
##   encounter_type: ContentType enum
##   duration: Duration of the encounter in seconds
func track_pacing_state(encounter_type: ContentType, duration: float) -> void:
	"""Tracks pacing state based on encounter type and duration.

	Parameters:
		encounter_type: ContentType enum
		duration: Duration of the encounter in seconds
	"""
	session_encounters += 1

	# Update streaks
	if encounter_type == ContentType.COMBAT:
		combat_streak += 1
		exploration_streak = 0
		combat_time_accumulated += duration
	elif encounter_type == ContentType.EXPLORATION:
		exploration_streak += 1
		combat_streak = 0
	else:
		combat_streak = 0
		exploration_streak = 0

	# Add to recent encounters
	var entry = {
		"type": encounter_type,
		"duration": duration,
		"timestamp": Time.get_unix_time_from_system()
	}
	recent_encounters.append(entry)

	# Keep only last 10 encounters
	if recent_encounters.size() > 10:
		recent_encounters.pop_front()

	# Update fatigue
	_update_fatigue(encounter_type, duration)

	# Check pacing constraints
	_check_pacing_constraints()

	# Emit classification signal
	encounter_type_classified.emit(ContentType.keys()[encounter_type])

	# Update and emit metrics
	var metrics = get_pacing_metrics()
	pacing_metrics_updated.emit(metrics)

	# Track in analytics
	if analytics and analytics.has_method("log_custom_event"):
		analytics.log_custom_event("encounter_pacing", {
			"type": ContentType.keys()[encounter_type],
			"duration": duration,
			"combat_streak": combat_streak,
			"fatigue": current_fatigue
		})

## Updates fatigue level based on encounter intensity and duration.
##
## Parameters:
##   encounter_type: ContentType enum
##   duration: Duration in seconds
func _update_fatigue(encounter_type: ContentType, duration: float) -> void:
	"""Updates fatigue level based on encounter intensity and duration.

	Parameters:
		encounter_type: ContentType enum
		duration: Duration in seconds
	"""
	var fatigue_increase: float = 0.0

	# Calculate fatigue increase based on type and duration
	match encounter_type:
		ContentType.COMBAT:
			# Combat increases fatigue more
			fatigue_increase = duration * 0.12
			# Bonus for streaks
			if combat_streak > MAX_COMBAT_STREAK:
				fatigue_increase *= 1.5
		ContentType.PUZZLE:
			# Puzzles are moderately fatiguing
			fatigue_increase = duration * 0.10
		ContentType.EXPLORATION:
			# Exploration is less fatiguing
			fatigue_increase = duration * 0.05
		ContentType.NARRATIVE:
			# Narrative is least fatiguing
			fatigue_increase = duration * 0.02

	# Apply fatigue
	current_fatigue = min(current_fatigue + fatigue_increase, 100.0)

	# Check fatigue thresholds
	if current_fatigue >= FATIGUE_THRESHOLD_CRITICAL:
		fatigue_warning.emit(2)  # Critical
	elif current_fatigue >= FATIGUE_THRESHOLD_HIGH:
		fatigue_warning.emit(1)  # High

## Checks pacing constraints and recommends breaks if needed.
func _check_pacing_constraints() -> void:
	"""Checks pacing constraints and recommends breaks if needed."""
	var break_reasons: Array = []

	# Check combat streak
	if combat_streak > MAX_COMBAT_STREAK:
		break_reasons.append("Combat streak too long")

	# Check fatigue
	if current_fatigue >= FATIGUE_THRESHOLD_CRITICAL:
		break_reasons.append("Critical fatigue level")

	# Emit break recommendation if needed
	if not break_reasons.is_empty():
		var reason_string = ", ".join(break_reasons)
		pacing_break_recommended.emit(reason_string)

## Calculates fatigue level based on intensity and duration.
##
## Parameters:
##   intensity: Encounter intensity (0.0 to 1.0)
##   duration: Duration in seconds
##
## Returns:
##   Fatigue level (0 to 100)
func get_fatigue_level(intensity: float, duration: float) -> float:
	"""Calculates fatigue level based on intensity and duration.

	Parameters:
		intensity: Encounter intensity (0.0 to 1.0)
		duration: Duration in seconds

	Returns:
		Fatigue level (0 to 100)
	"""
	var base_fatigue = duration * 0.1
	var intensity_multiplier = 1.0 + (intensity * 0.5)
	return min(base_fatigue * intensity_multiplier, 100.0)

## Suggests a break or pacing adjustment.
##
## Returns:
##   Dictionary with break recommendation data
func suggest_break() -> Dictionary:
	"""Suggests a break or pacing adjustment.

	Returns:
		Dictionary with break recommendation data
	"""
	var recommendation: Dictionary = {
		"should_break": false,
		"break_duration": 0,
		"suggested_next_type": "",
		"reason": ""
	}

	# Check fatigue
	if current_fatigue >= FATIGUE_THRESHOLD_CRITICAL:
		recommendation.should_break = true
		recommendation.break_duration = 300  # 5 minutes
		recommendation.suggested_next_type = "narrative"
		recommendation.reason = "Critical fatigue detected"
	elif current_fatigue >= FATIGUE_THRESHOLD_HIGH:
		recommendation.should_break = true
		recommendation.break_duration = 120  # 2 minutes
		recommendation.suggested_next_type = "exploration"
		recommendation.reason = "High fatigue detected"

	# Check combat streak
	if combat_streak > MAX_COMBAT_STREAK:
		recommendation.should_break = true
		recommendation.suggested_next_type = "exploration"
		recommendation.reason = "Combat streak too long"

	# Check exploration streak (should return to combat)
	if exploration_streak >= MIN_EXPLORATION_STREAK:
		recommendation.suggested_next_type = "combat"
		if not recommendation.should_break:
			recommendation.reason = "Enough exploration, ready for combat"

	return recommendation

## Gets current pacing metrics.
##
## Returns:
##   Dictionary with pacing metrics
func get_pacing_metrics() -> Dictionary:
	"""Gets current pacing metrics.

	Returns:
		Dictionary with pacing metrics
	"""
	var combat_count: int = 0
	var exploration_count: int = 0
	var narrative_count: int = 0
	var puzzle_count: int = 0

	for entry in recent_encounters:
		match entry.type:
			ContentType.COMBAT: combat_count += 1
			ContentType.EXPLORATION: exploration_count += 1
			ContentType.NARRATIVE: narrative_count += 1
			ContentType.PUZZLE: puzzle_count += 1

	var total: int = recent_encounters.size()

	return {
		"total_encounters": session_encounters,
		"recent_encounters": total,
		"combat_count": combat_count,
		"exploration_count": exploration_count,
		"narrative_count": narrative_count,
		"puzzle_count": puzzle_count,
		"combat_ratio": float(combat_count) / max(total, 1),
		"exploration_ratio": float(exploration_count) / max(total, 1),
		"narrative_ratio": float(narrative_count) / max(total, 1),
		"puzzle_ratio": float(puzzle_count) / max(total, 1),
		"combat_streak": combat_streak,
		"exploration_streak": exploration_streak,
		"current_fatigue": current_fatigue,
		"fatigue_level": _get_fatigue_level_string(),
		"combat_time_total": combat_time_accumulated,
	}

## Gets fatigue level as a human-readable string.
##
## Returns:
##   String: Fatigue level description
func _get_fatigue_level_string() -> String:
	"""Gets fatigue level as a human-readable string.

	Returns:
		String: Fatigue level description
	"""
	if current_fatigue >= FATIGUE_THRESHOLD_CRITICAL:
		return "Critical"
	elif current_fatigue >= FATIGUE_THRESHOLD_HIGH:
		return "High"
	elif current_fatigue >= 50.0:
		return "Medium"
	elif current_fatigue >= 25.0:
		return "Low"
	else:
		return "None"

## Gets the recommended next encounter type.
##
## Returns:
##   ContentType enum value
func get_recommended_encounter_type() -> ContentType:
	"""Gets the recommended next encounter type.

	Returns:
		ContentType enum value
	"""
	var recommendation = suggest_break()
	var suggested_type: String = recommendation.get("suggested_next_type", "")

	match suggested_type:
		"combat":
			return ContentType.COMBAT
		"exploration":
			return ContentType.EXPLORATION
		"narrative":
			return ContentType.NARRATIVE
		"puzzle":
			return ContentType.PUZZLE

	# Default: check pacing ratios and recommend what's needed
	var metrics = get_pacing_metrics()
	var combat_ratio: float = metrics.combat_ratio
	var exploration_ratio: float = metrics.exploration_ratio

	if combat_ratio > TARGET_COMBAT_RATIO:
		return ContentType.EXPLORATION
	elif exploration_ratio > TARGET_EXPLORATION_RATIO:
		return ContentType.COMBAT
	else:
		return ContentType.NARRATIVE

## Records encounter pacing to the server.
func log_encounter_pacing() -> void:
	"""Records encounter pacing to the server."""
	if not network_manager or not network_manager.has_method("send_rpc_async"):
		return

	var metrics = get_pacing_metrics()
	var payload = JSON.stringify(metrics)

	network_manager.send_rpc_async("armored_archer/log_encounter_pacing", payload, 5.0)

## Gets pacing analytics report from the server.
##
## Returns:
##   Dictionary with pacing analytics
func get_pacing_report() -> Dictionary:
	"""Gets pacing analytics report from the server.

	Returns:
		Dictionary with pacing analytics
	"""
	if not network_manager or not network_manager.has_method("send_rpc"):
		return {}

	var response = network_manager.send_rpc(
		"armored_archer/get_pacing_report",
		JSON.stringify({})
	)

	if response.has("error"):
		push_warning("Failed to get pacing report: " + str(response.error))
		return {}

	return response

## Saves pacing state to persistent storage.
func save_pacing_state() -> void:
	"""Saves pacing state to persistent storage."""
	var save_data = {
		"recent_encounters": recent_encounters,
		"combat_streak": combat_streak,
		"exploration_streak": exploration_streak,
		"current_fatigue": current_fatigue,
		"session_encounters": session_encounters,
		"combat_time_accumulated": combat_time_accumulated
	}
	var file = FileAccess.open("user://pacing_state.json", FileAccess.WRITE)
	if file:
		var _err = file.store_string(JSON.stringify(save_data))
		file.close()

## Loads pacing state from persistent storage.
func load_pacing_state() -> void:
	"""Loads pacing state from persistent storage."""
	var file = FileAccess.open("user://pacing_state.json", FileAccess.READ)
	if file:
		var json_string = file.get_as_text()
		file.close()
		var json = JSON.new()
		var parse_result = json.parse(json_string)
		if parse_result == OK:
			var save_data = json.data
			recent_encounters = save_data.get("recent_encounters", [])
			combat_streak = save_data.get("combat_streak", 0)
			exploration_streak = save_data.get("exploration_streak", 0)
			current_fatigue = save_data.get("current_fatigue", 0.0)
			session_encounters = save_data.get("session_encounters", 0)
			combat_time_accumulated = save_data.get("combat_time_accumulated", 0.0)

## Resets pacing state (for new session).
func reset_pacing_state() -> void:
	"""Resets pacing state (for new session)."""
	recent_encounters.clear()
	combat_streak = 0
	exploration_streak = 0
	current_fatigue = 0.0
	session_encounters = 0
	combat_time_accumulated = 0.0
	save_pacing_state()

## Gets the color for a fatigue level.
##
## Returns:
##   Color for UI display
func get_fatigue_color() -> Color:
	"""Gets the color for a fatigue level.

	Returns:
		Color for UI display
	"""
	var design_tokens = get_node_or_null("/root/ArcherDesignTokens")

	if current_fatigue >= FATIGUE_THRESHOLD_CRITICAL:
		return Color.RED
	elif current_fatigue >= FATIGUE_THRESHOLD_HIGH:
		return Color.ORANGE
	elif current_fatigue >= 50.0:
		return Color.YELLOW
	elif current_fatigue >= 25.0:
		return Color.GREEN
	else:
		return Color.WHITE
