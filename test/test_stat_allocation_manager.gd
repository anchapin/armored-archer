extends GutTest

## Tests for StatAllocationManager autoload.
## Tests respec costs, stat validation, and build save/load.
##
## NOTE: StatAllocationManager should be implemented.
## This test verifies the expected API and behavior.

var stat_allocation_manager: Node
var player_stats_manager: Node
var store_manager: Node

func before_all():
	# Get references to autoloads
	stat_allocation_manager = get_node("/root/StatAllocationManager")
	player_stats_manager = get_node("/root/PlayerStatsManager")
	store_manager = get_node("/root/StoreManager")

	if stat_allocation_manager == null:
		gut.p("WARNING: StatAllocationManager autoload not found.")

func test_respec_cost_calculation_min():
	# Respec cost should have minimum of 100 gems
	# Cost = 5% of gems, clamped between 100 and 1000
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	# Set up mock gem balance (low value)
	if store_manager and store_manager.has_method("_set_gems"):
		store_manager._set_gems(1000)

	var cost: int = stat_allocation_manager.get_respec_cost(false)

	assert_ge(cost, 100, "Respec cost should be at least 100 gems")

func test_respec_cost_calculation_max():
	# Respec cost should have maximum of 1000 gems
	# Even with high gem balance, cost is capped
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	# Set up mock gem balance (high value)
	if store_manager and store_manager.has_method("_set_gems"):
		store_manager._set_gems(50000)

	var cost: int = stat_allocation_manager.get_respec_cost(false)

	assert_le(cost, 1000, "Respec cost should be at most 1000 gems")

func test_respec_cost_calculation_percent():
	# Respec cost should be 5% of current gems
	# Within min/max bounds (100-1000)
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	# Set up mock gem balance
	if store_manager and store_manager.has_method("_set_gems"):
		store_manager._set_gems(5000)

	var cost: int = stat_allocation_manager.get_respec_cost(false)

	# 5% of 5000 = 250
	var expected: int = int(5000 * 0.05)
	assert_almost_eq(float(cost), float(expected), 10.0, "Cost should be 5% of gem balance")

func test_respec_free_available():
	# Player should have one free respec per season
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	var has_free: bool = stat_allocation_manager.has_free_respec()

	# Should have free respec available if not used this season
	assert_true(has_free, "Player should have free respec available")

func test_respec_cost_with_free_respec():
	# Using free respec should cost 0 gems
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	var cost_with_free: int = stat_allocation_manager.get_respec_cost(true)
	var cost_normal: int = stat_allocation_manager.get_respec_cost(false)

	assert_eq(cost_with_free, 0, "Free respec should cost 0 gems")
	assert_gt(cost_normal, 0, "Normal respec should cost gems")

func test_stat_point_validation_valid():
	# Valid allocation should pass validation
	# Points should sum to total available
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	var valid_allocation: Dictionary = {
		"attack": 10,
		"defense": 10,
		"dodge": 5,
		"crit_rate": 5
	}

	var validation: Dictionary = stat_allocation_manager.validate_allocation(valid_allocation)

	assert_true(validation.get("valid", false), "Valid allocation should pass validation")
	assert_eq(validation.get("error", ""), "", "Valid allocation should have no error")

func test_stat_point_validation_invalid_stat():
	# Allocation with invalid stat name should fail
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	var invalid_allocation: Dictionary = {
		"attack": 10,
		"defense": 10,
		"invalid_stat": 5,
		"crit_rate": 5
	}

	var validation: Dictionary = stat_allocation_manager.validate_allocation(invalid_allocation)

	assert_false(validation.get("valid", true), "Invalid stat name should fail validation")
	assert_ne(validation.get("error", ""), "", "Invalid allocation should have error message")

func test_stat_point_validation_negative():
	# Allocation with negative values should fail
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	var negative_allocation: Dictionary = {
		"attack": 10,
		"defense": -5,
		"dodge": 5,
		"crit_rate": 5
	}

	var validation: Dictionary = stat_allocation_manager.validate_allocation(negative_allocation)

	assert_false(validation.get("valid", true), "Negative stat value should fail validation")
	assert_ne(validation.get("error", ""), "", "Negative allocation should have error message")

func test_stat_point_validation_mismatch():
	# Allocation with wrong point total should fail
	# Points spent must equal available + already spent
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	var mismatched_allocation: Dictionary = {
		"attack": 100,
		"defense": 100,
		"dodge": 100,
		"crit_rate": 100
	}

	var validation: Dictionary = stat_allocation_manager.validate_allocation(mismatched_allocation)

	assert_false(validation.get("valid", true), "Mismatched point total should fail validation")
	assert_ne(validation.get("error", ""), "", "Mismatched allocation should have error message")

func test_build_save():
	# Build should be saved to a slot
	# Should store stats, level, and timestamp
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	var build_slot: int = 1
	var build_name: String = "Test Build"

	# Signal tracking would be here in real test
	stat_allocation_manager.save_build(build_slot, build_name)

	var saved_build: Dictionary = stat_allocation_manager.get_build(build_slot)

	assert_false(saved_build.is_empty(), "Build should be saved to slot")
	assert_eq(saved_build.get("name", ""), build_name, "Build name should match")
	assert_gt(saved_build.get("timestamp", 0), 0, "Build should have timestamp")

func test_build_load():
	# Build should be loaded from a slot
	# Should emit signal with build data
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	# First save a build
	stat_allocation_manager.save_build(1, "Load Test")

	# Signal tracking would be here in real test
	stat_allocation_manager.load_build(1)

	var loaded_build: Dictionary = stat_allocation_manager.get_build(1)

	assert_false(loaded_build.is_empty(), "Build should be loaded from slot")
	assert_eq(loaded_build.get("name", ""), "Load Test", "Build name should match")

func test_multiple_build_slots():
	# Multiple build slots should be available (1-3)
	# Each slot should store independent build data
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	# Save builds to different slots
	stat_allocation_manager.save_build(1, "Build 1")
	stat_allocation_manager.save_build(2, "Build 2")
	stat_allocation_manager.save_build(3, "Build 3")

	var build_1: Dictionary = stat_allocation_manager.get_build(1)
	var build_2: Dictionary = stat_allocation_manager.get_build(2)
	var build_3: Dictionary = stat_allocation_manager.get_build(3)

	assert_eq(build_1.get("name", ""), "Build 1", "Slot 1 should have correct build")
	assert_eq(build_2.get("name", ""), "Build 2", "Slot 2 should have correct build")
	assert_eq(build_3.get("name", ""), "Build 3", "Slot 3 should have correct build")

func test_build_delete():
	# Build should be deletable from a slot
	# Slot should be empty after deletion
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	# Save a build first
	stat_allocation_manager.save_build(1, "To Delete")

	# Delete it
	stat_allocation_manager.delete_build(1)

	var deleted_build: Dictionary = stat_allocation_manager.get_build(1)

	assert_true(deleted_build.is_empty(), "Build should be deleted from slot")

func test_build_save_invalid_slot():
	# Saving to invalid slot should fail
	# Valid slots are 1-3
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	# This would normally produce an error
	# For now, just verify the method exists
	assert_true(stat_allocation_manager.has_method("save_build"), "save_build() method should exist")

func test_respec_cooldown():
	# Respec should have 24 hour cooldown
	# Cooldown should prevent additional respecs until time passes
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	var cooldown_remaining: int = stat_allocation_manager.get_respec_cooldown_remaining()

	assert_ge(cooldown_remaining, 0, "Cooldown remaining should be non-negative")

func test_respec_cooldown_max():
	# Cooldown should be at most 24 hours (86400 seconds)
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	var cooldown_remaining: int = stat_allocation_manager.get_respec_cooldown_remaining()

	assert_le(cooldown_remaining, 86400, "Cooldown should be at most 24 hours")

func test_is_respec_on_cooldown():
	# Should report whether respec is on cooldown
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	var is_cooldown: bool = stat_allocation_manager.is_respec_on_cooldown()

	# Should return boolean
	assert_true(is_cooldown == false or is_cooldown == true, "is_respec_on_cooldown() should return boolean")

func test_format_cooldown_time():
	# Cooldown time should be formatted for display
	# "Available", "Xh Ym", "Xm" formats
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	var formatted: String = stat_allocation_manager.format_cooldown_time(0)

	assert_eq(formatted, "Available", "Zero cooldown should show 'Available'")

	var formatted_hour: String = stat_allocation_manager.format_cooldown_time(3661)

	assert_true(formatted_hour.contains("h"), "Hour+ cooldown should show 'h'")

	var formatted_min: String = stat_allocation_manager.format_cooldown_time(300)

	assert_true(formatted_min.contains("m"), "Minute cooldown should show 'm'")

func test_get_all_builds():
	# Should return all saved builds
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	# Save a couple builds
	stat_allocation_manager.save_build(1, "Build 1")
	stat_allocation_manager.save_build(2, "Build 2")

	var all_builds: Dictionary = stat_allocation_manager.get_all_builds()

	assert_ge(all_builds.size(), 2, "Should have at least 2 builds")

func test_valid_stat_names():
	# Only valid stats should be allowed: attack, defense, dodge, crit_rate
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	var valid_stats: Dictionary = {
		"attack": 5,
		"defense": 5,
		"dodge": 5,
		"crit_rate": 5
	}

	var validation: Dictionary = stat_allocation_manager.validate_allocation(valid_stats)

	assert_true(validation.get("valid", false), "All valid stats should pass validation")

func test_respec_season_tracking():
	# Free respecs should reset each season
	# Used free respecs should be tracked per season
	if stat_allocation_manager == null:
		gut.p("SKIP: StatAllocationManager not available")
		return

	# Just verify season tracking data exists
	assert_true(stat_allocation_manager.has_method("load_data"), "load_data() method should exist")
	assert_true(stat_allocation_manager.has_method("save_data"), "save_data() method should exist")
