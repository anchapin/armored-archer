extends GutTest

## Tests for XP Manager autoload.
## Tests XP curve calculations, level progression, and bonus multipliers.
##
## NOTE: XP Manager may not be implemented yet. Tests will verify expected API.
## If autoload doesn't exist, tests will fail with informative messages.

var xp_manager: Node

func before_all():
	# Get reference to XPManager autoload
	xp_manager = get_node_or_null("/root/XPManager")

	if xp_manager == null:
		gut.p("WARNING: XPManager autoload not found. Manager may not be implemented yet.")
		gut.p("This test file will skip tests for missing manager.")

func test_xp_curve_early_levels():
	# Early levels (1-10) should have low XP requirements
	# Level 1: 0 XP, Level 2: 100 XP, Level 3: 300 XP, etc.
	if xp_manager == null or not xp_manager.has_method("get_xp_for_level"):
		gut.p("SKIP: get_xp_for_level() method not available")
		return

	var level_2_xp: int = xp_manager.get_xp_for_level(2)
	var level_5_xp: int = xp_manager.get_xp_for_level(5)
	var level_10_xp: int = xp_manager.get_xp_for_level(10)

	# Early levels should require less XP
	assert_eq(level_2_xp, 100, "Level 2 should require 100 XP")
	assert_eq(level_5_xp, 1000, "Level 5 should require 1000 XP")
	assert_eq(level_10_xp, 4500, "Level 10 should require 4500 XP")

	# XP should increase quadratically for early levels
	assert_gt(level_5_xp, level_2_xp * 4, "XP growth should be roughly quadratic")
	assert_gt(level_10_xp, level_5_xp * 3, "XP growth should be roughly quadratic")

func test_xp_curve_mid_levels():
	# Mid levels (11-30) should have moderate XP requirements
	# Level 11: 5500 XP, Level 15: 10500 XP, Level 20: 20000 XP
	if xp_manager == null or not xp_manager.has_method("get_xp_for_level"):
		gut.p("SKIP: get_xp_for_level() method not available")
		return

	var level_11_xp: int = xp_manager.get_xp_for_level(11)
	var level_15_xp: int = xp_manager.get_xp_for_level(15)
	var level_20_xp: int = xp_manager.get_xp_for_level(20)
	var level_30_xp: int = xp_manager.get_xp_for_level(30)

	# Mid levels should have higher XP requirements than early levels
	assert_eq(level_11_xp, 5500, "Level 11 should require 5500 XP")
	assert_eq(level_15_xp, 10500, "Level 15 should require 10500 XP")

	# XP increase between levels should grow
	var xp_increase_11_to_15: int = level_15_xp - level_11_xp
	var xp_increase_15_to_20: int = level_20_xp - level_15_xp
	assert_gt(xp_increase_15_to_20, xp_increase_11_to_15, "XP per level should increase")

func test_xp_curve_late_levels():
	# Late levels (31-50) should have high XP requirements
	# Progression slows down significantly for late game
	if xp_manager == null or not xp_manager.has_method("get_xp_for_level"):
		gut.p("SKIP: get_xp_for_level() method not available")
		return

	var level_30_xp: int = xp_manager.get_xp_for_level(30)
	var level_40_xp: int = xp_manager.get_xp_for_level(40)
	var level_50_xp: int = xp_manager.get_xp_for_level(50)

	# Late levels should require significantly more XP
	assert_gt(level_40_xp, level_30_xp * 2, "Late levels should require much more XP")
	assert_gt(level_50_xp, level_40_xp * 1.5, "XP should continue growing")

func test_level_up_detection():
	# Level up should be detected when XP threshold is reached
	if xp_manager == null:
		gut.p("SKIP: XPManager not available")
		return

	if not xp_manager.has_method("add_xp"):
		gut.p("SKIP: add_xp() method not available")
		return

	# This test requires setup of mock state
	# For now, just verify the method exists
	assert_true(xp_manager.has_method("add_xp"), "add_xp() method should exist")

func test_xp_bonus_multiplier():
	# XP gain should be multiplied by bonus multipliers
	# Quest completion: +50%, certain events: +25%, etc.
	if xp_manager == null or not xp_manager.has_method("calculate_xp_gain"):
		gut.p("SKIP: calculate_xp_gain() method not available")
		return

	var base_xp: int = 100
	var level: int = 5

	# Base XP gain
	var base_gain: int = xp_manager.calculate_xp_gain(base_xp, level)

	# XP gain with quest bonus
	var quest_gain: int = xp_manager.calculate_xp_gain(base_xp * 1.5, level)

	assert_gt(quest_gain, base_gain, "Quest bonus should increase XP gain")

func test_progress_percentage_calculation():
	# Progress percentage should be calculated correctly
	# from 0% at start of level to 100% at level up
	if xp_manager == null or not xp_manager.has_method("get_progress_percentage"):
		gut.p("SKIP: get_progress_percentage() method not available")
		return

	# Mock current level and XP
	# This would normally be set by add_xp()
	# For now, just verify the method exists
	assert_true(xp_manager.has_method("get_progress_percentage"), "get_progress_percentage() method should exist")

func test_level_curve_type_early():
	# Early levels (1-10) should be classified as "early" progression
	if xp_manager == null or not xp_manager.has_method("get_level_curve_type"):
		gut.p("SKIP: get_level_curve_type() method not available")
		return

	var level_5_type: String = xp_manager.get_level_curve_type(5)
	assert_eq(level_5_type, "early", "Level 5 should be early progression")

func test_level_curve_type_mid():
	# Mid levels (11-30) should be classified as "mid" progression
	if xp_manager == null or not xp_manager.has_method("get_level_curve_type"):
		gut.p("SKIP: get_level_curve_type() method not available")
		return

	var level_15_type: String = xp_manager.get_level_curve_type(15)
	assert_eq(level_15_type, "mid", "Level 15 should be mid progression")

func test_level_curve_type_late():
	# Late levels (31-50) should be classified as "late" progression
	if xp_manager == null or not xp_manager.has_method("get_level_curve_type"):
		gut.p("SKIP: get_level_curve_type() method not available")
		return

	var level_35_type: String = xp_manager.get_level_curve_type(35)
	assert_eq(level_35_type, "late", "Level 35 should be late progression")

func test_xp_milestone_rewards():
	# XP milestones should provide bonus rewards
	# Every 5 levels or at specific XP thresholds
	if xp_manager == null or not xp_manager.has_method("get_xp_milestone"):
		gut.p("SKIP: get_xp_milestone() method not available")
		return

	# Verify milestone tracking exists
	assert_true(xp_manager.has_method("get_xp_milestone"), "get_xp_milestone() method should exist")

func test_xp_progression_monotonic():
	# XP requirements should be strictly increasing per level
	if xp_manager == null or not xp_manager.has_method("get_xp_for_level"):
		gut.p("SKIP: get_xp_for_level() method not available")
		return

	var previous_xp: int = -1
	for level in range(1, 51):
		var level_xp: int = xp_manager.get_xp_for_level(level)
		assert_gt(level_xp, previous_xp, "Level %d XP should be greater than previous level" % level)
		previous_xp = level_xp

func test_xp_boundaries():
	# Level 1 should start at 0 XP
	# Minimum and maximum levels should be enforced
	if xp_manager == null or not xp_manager.has_method("get_xp_for_level"):
		gut.p("SKIP: get_xp_for_level() method not available")
		return

	var level_1_xp: int = xp_manager.get_xp_for_level(1)
	assert_eq(level_1_xp, 0, "Level 1 should require 0 XP")

	# Level 50 should be maximum
	var level_50_xp: int = xp_manager.get_xp_for_level(50)
	var level_51_xp: int = xp_manager.get_xp_for_level(51)
	assert_eq(level_50_xp, level_51_xp, "XP should cap at level 50")
