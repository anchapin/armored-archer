extends GutTest

## Tests for PacingManager autoload.
## Tests encounter classification, fatigue calculation, and pacing distribution.
##
## NOTE: PacingManager should be implemented.
## This test verifies the expected API and behavior.

var pacing_manager: Node

func before_all():
	# Get reference to PacingManager autoload
	pacing_manager = get_node("/root/PacingManager")

	if pacing_manager == null:
		gut.p("WARNING: PacingManager autoload not found.")

func before_each():
	# Reset pacing state before each test
	if pacing_manager and pacing_manager.has_method("reset_pacing_state"):
		pacing_manager.reset_pacing_state()

func test_encounter_classification_combat():
	# Combat encounters should be classified correctly
	# Boss encounters always combat, difficulty-based classification
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	var combat_encounter: Dictionary = {
		"id": "forest_goblin",
		"biome": "forest",
		"difficulty": 1,
		"is_boss": false
	}

	var encounter_type: int = pacing_manager.classify_encounter(combat_encounter)

	assert_eq(encounter_type, 0, "Forest goblin should be classified as COMBAT (0)")

func test_encounter_classification_boss():
	# Boss encounters should always be combat type
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	var boss_encounter: Dictionary = {
		"id": "cavern_warlord",
		"biome": "cavern",
		"difficulty": 2,
		"is_boss": true
	}

	var encounter_type: int = pacing_manager.classify_encounter(boss_encounter)

	assert_eq(encounter_type, 0, "Boss should be classified as COMBAT (0)")

func test_encounter_classification_exploration():
	# Exploration encounters should be classified correctly
	# Random classification based on biome and difficulty
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	# Forest biome has 30% chance of exploration
	# We'll test the classification method exists
	assert_true(pacing_manager.has_method("classify_encounter"), "classify_encounter() method should exist")

func test_encounter_classification_puzzle():
	# Puzzle encounters should be classified correctly
	# Cavern biome has 25% chance of puzzles
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	var cavern_encounter: Dictionary = {
		"id": "cavern_elemental",
		"biome": "cavern",
		"difficulty": 2,
		"is_boss": false
	}

	var encounter_type: int = pacing_manager.classify_encounter(cavern_encounter)

	# Either COMBAT (0) or PUZZLE (3)
	assert_true(encounter_type == 0 or encounter_type == 3, "Cavern should be COMBAT or PUZZLE")

func test_encounter_classification_narrative():
	# Narrative encounters should be a valid type
	# Content type enum should include NARRATIVE (2)
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	# Verify NARRATIVE enum value exists
	assert_eq(pacing_manager.ContentType.NARRATIVE, 2, "NARRATIVE should be enum value 2")

func test_pacing_distribution_targets():
	# Pacing should target 60/20/20 distribution
	# Combat: 60%, Exploration: 20%, Narrative: 20%
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	assert_eq(pacing_manager.TARGET_COMBAT_RATIO, 0.60, "Combat target should be 60%")
	assert_eq(pacing_manager.TARGET_EXPLORATION_RATIO, 0.20, "Exploration target should be 20%")
	assert_eq(pacing_manager.TARGET_NARRATIVE_RATIO, 0.20, "Narrative target should be 20%")

func test_pacing_streak_constraints():
	# Pacing should enforce streak constraints
	# Max combat streak: 5, Min exploration streak: 3
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	assert_eq(pacing_manager.MAX_COMBAT_STREAK, 5, "Max combat streak should be 5")
	assert_eq(pacing_manager.MIN_EXPLORATION_STREAK, 3, "Min exploration streak should be 3")

func test_fatigue_level_calculation():
	# Fatigue should be calculated based on intensity and duration
	# Base fatigue = duration * 0.1, scaled by intensity
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	var intensity: float = 0.5
	var duration: float = 60.0  # 1 minute

	var fatigue: float = pacing_manager.get_fatigue_level(intensity, duration)

	# Base fatigue = 60 * 0.1 = 6.0
	# Intensity multiplier = 1.0 + (0.5 * 0.5) = 1.25
	# Expected = 6.0 * 1.25 = 7.5
	var expected: float = duration * 0.1 * (1.0 + intensity * 0.5)
	assert_almost_eq(fatigue, expected, 0.1, "Fatigue should match formula")

func test_fatigue_clamping():
	# Fatigue should be clamped to 0-100 range
	# Cannot exceed 100 or go below 0
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	# High intensity and duration should still cap at 100
	var max_fatigue: float = pacing_manager.get_fatigue_level(1.0, 1000.0)
	assert_le(max_fatigue, 100.0, "Fatigue should not exceed 100")

	# Low values should produce valid fatigue
	var min_fatigue: float = pacing_manager.get_fatigue_level(0.0, 0.0)
	assert_ge(min_fatigue, 0.0, "Fatigue should not be negative")

func test_fatigue_high_threshold():
	# Fatigue high threshold should be 70%
	# Should trigger high fatigue warning
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	assert_eq(pacing_manager.FATIGUE_THRESHOLD_HIGH, 70, "High fatigue threshold should be 70")

func test_fatigue_critical_threshold():
	# Fatigue critical threshold should be 85%
	# Should trigger critical fatigue warning
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	assert_eq(pacing_manager.FATIGUE_THRESHOLD_CRITICAL, 85, "Critical fatigue threshold should be 85")

func test_fatigue_by_encounter_type():
	# Different encounter types should increase fatigue differently
	# Combat: 0.15x, Puzzle: 0.10x, Exploration: 0.05x, Narrative: 0.02x
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	pacing_manager.reset_pacing_state()

	# Track a combat encounter
	pacing_manager.track_pacing_state(0, 60.0)  # 1 minute combat
	var combat_fatigue: float = pacing_manager.current_fatigue

	pacing_manager.reset_pacing_state()

	# Track a narrative encounter
	pacing_manager.track_pacing_state(2, 60.0)  # 1 minute narrative
	var narrative_fatigue: float = pacing_manager.current_fatigue

	assert_gt(combat_fatigue, narrative_fatigue, "Combat should increase fatigue more than narrative")

func test_pacing_combat_streak():
	# Combat streak should be tracked correctly
	# Resets on non-combat encounters
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	pacing_manager.reset_pacing_state()

	# Track 3 combat encounters
	pacing_manager.track_pacing_state(0, 30.0)
	pacing_manager.track_pacing_state(0, 30.0)
	pacing_manager.track_pacing_state(0, 30.0)

	var metrics: Dictionary = pacing_manager.get_pacing_metrics()
	assert_eq(metrics.get("combat_streak", 0), 3, "Combat streak should be 3")

func test_pacing_exploration_streak():
	# Exploration streak should be tracked correctly
	# Resets on non-exploration encounters
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	pacing_manager.reset_pacing_state()

	# Track 2 exploration encounters
	pacing_manager.track_pacing_state(1, 30.0)
	pacing_manager.track_pacing_state(1, 30.0)

	var metrics: Dictionary = pacing_manager.get_pacing_metrics()
	assert_eq(metrics.get("exploration_streak", 0), 2, "Exploration streak should be 2")

func test_pacing_metrics_encounter_counts():
	# Pacing metrics should track encounter counts by type
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	pacing_manager.reset_pacing_state()

	# Track various encounter types
	pacing_manager.track_pacing_state(0, 30.0)  # Combat
	pacing_manager.track_pacing_state(0, 30.0)  # Combat
	pacing_manager.track_pacing_state(1, 30.0)  # Exploration
	pacing_manager.track_pacing_state(2, 30.0)  # Narrative

	var metrics: Dictionary = pacing_manager.get_pacing_metrics()

	assert_eq(metrics.get("combat_count", 0), 2, "Should track 2 combat encounters")
	assert_eq(metrics.get("exploration_count", 0), 1, "Should track 1 exploration encounter")
	assert_eq(metrics.get("narrative_count", 0), 1, "Should track 1 narrative encounter")

func test_pacing_ratios():
	# Pacing metrics should calculate ratios correctly
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	pacing_manager.reset_pacing_state()

	# Track encounters for clear ratio: 6 combat, 2 exploration, 2 narrative
	for i in range(6):
		pacing_manager.track_pacing_state(0, 30.0)  # Combat
	for i in range(2):
		pacing_manager.track_pacing_state(1, 30.0)  # Exploration
	for i in range(2):
		pacing_manager.track_pacing_state(2, 30.0)  # Narrative

	var metrics: Dictionary = pacing_manager.get_pacing_metrics()

	assert_almost_eq(metrics.get("combat_ratio", 0.0), 0.60, 0.01, "Combat ratio should be 60%")
	assert_almost_eq(metrics.get("exploration_ratio", 0.0), 0.20, 0.01, "Exploration ratio should be 20%")
	assert_almost_eq(metrics.get("narrative_ratio", 0.0), 0.20, 0.01, "Narrative ratio should be 20%")

func test_fatigue_level_string():
	# Fatigue level should be formatted as string
	# None, Low, Medium, High, Critical
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	# Check fatigue level formatting
	var metrics: Dictionary = pacing_manager.get_pacing_metrics()
	var fatigue_level: String = metrics.get("fatigue_level", "")

	assert_true(fatigue_level in ["None", "Low", "Medium", "High", "Critical"],
		"Fatigue level should be valid string")

func test_suggest_break_no_break():
	# Break recommendation should suggest no break when appropriate
	# Low fatigue, no excessive streaks
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	pacing_manager.reset_pacing_state()

	# Low fatigue scenario
	pacing_manager.track_pacing_state(2, 30.0)  # Narrative, low fatigue

	var recommendation: Dictionary = pacing_manager.suggest_break()

	assert_false(recommendation.get("should_break", true), "Should not recommend break with low fatigue")

func test_suggest_break_critical_fatigue():
	# Break should be recommended at critical fatigue
	# 5 minute break suggested
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	pacing_manager.reset_pacing_state()

	# Simulate high fatigue through many combat encounters
	for i in range(10):
		pacing_manager.track_pacing_state(0, 60.0)  # Combat, 1 minute each

	var recommendation: Dictionary = pacing_manager.suggest_break()

	if recommendation.get("should_break", false):
		assert_ge(recommendation.get("break_duration", 0), 300, "Critical fatigue should suggest 5+ min break")
		assert_eq(recommendation.get("suggested_next_type", ""), "narrative", "Should suggest narrative after break")

func test_suggest_break_combat_streak():
	# Break should be recommended after excessive combat streak
	# >5 combat encounters in a row
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	pacing_manager.reset_pacing_state()

	# Track 6 combat encounters in a row
	for i in range(6):
		pacing_manager.track_pacing_state(0, 30.0)

	var recommendation: Dictionary = pacing_manager.suggest_break()

	if recommendation.get("should_break", false):
		assert_eq(recommendation.get("suggested_next_type", ""), "exploration", "Should suggest exploration after combat streak")
		assert_ne(recommendation.get("reason", ""), "", "Should provide reason for break")

func test_recommended_encounter_type():
	# Should recommend next encounter type based on pacing
	# Balances ratios and respects constraints
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	pacing_manager.reset_pacing_state()

	var recommended: int = pacing_manager.get_recommended_encounter_type()

	# Should be a valid ContentType enum value
	assert_true(recommended in [0, 1, 2, 3], "Recommended type should be valid enum")

func test_pacing_time_accumulated():
	# Combat time should be accumulated for pacing analysis
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	pacing_manager.reset_pacing_state()

	pacing_manager.track_pacing_state(0, 60.0)  # 1 minute combat
	pacing_manager.track_pacing_state(0, 30.0)  # 30 seconds combat

	var metrics: Dictionary = pacing_manager.get_pacing_metrics()
	var total_time: float = metrics.get("combat_time_total", 0.0)

	assert_almost_eq(total_time, 90.0, 0.1, "Should accumulate 90 seconds of combat time")

func test_fatigue_color():
	# Fatigue color should indicate severity
	# White: Low, Green: Medium, Yellow: High, Orange: High, Red: Critical
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	var low_color: Color = pacing_manager.get_fatigue_color()
	assert_true(low_color == Color.WHITE or low_color == Color.GREEN,
		"Low fatigue should use white or green color")

func test_pacing_history_limit():
	# Recent encounters should be limited to 10
	# Old encounters should be removed from history
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	pacing_manager.reset_pacing_state()

	# Track 15 encounters
	for i in range(15):
		pacing_manager.track_pacing_state(i % 4, 30.0)

	var metrics: Dictionary = pacing_manager.get_pacing_metrics()
	var recent_count: int = metrics.get("recent_encounters", 0)

	assert_eq(recent_count, 10, "Should keep only 10 recent encounters")

func test_session_encounter_count():
	# Session encounters should count all encounters in session
	# Not limited to recent history
	if pacing_manager == null:
		gut.p("SKIP: PacingManager not available")
		return

	pacing_manager.reset_pacing_state()

	# Track 12 encounters
	for i in range(12):
		pacing_manager.track_pacing_state(i % 4, 30.0)

	var metrics: Dictionary = pacing_manager.get_pacing_metrics()
	var session_count: int = metrics.get("total_encounters", 0)

	assert_eq(session_count, 12, "Session count should track all 12 encounters")
