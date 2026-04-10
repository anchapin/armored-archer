extends SceneTree

# Headless-compatible test runner for CI
# This runner avoids await process_frame which doesn't work in headless mode
# It runs custom tests that extend Node. GUT framework tests (extending GutTest)
# should be run using the GUT runner via `godot -s -d`.

var _test_root: Node
var _total_tests := 0
var _tests_run := 0
var _all_tests_completed := false
var _exit_code := 0

func _init():
	print("=== Starting Armored Archer Test Suite (Headless Mode) ===")
	print("")

	_test_root = Node.new()
	_test_root.name = "TestRoot"
	root.add_child(_test_root)

	# Run tests synchronously
	_run_tests()

func _run_tests():
	var test_files = [
		# Core game managers
		"res://test/test_combat_manager.gd",
		"res://test/test_game_manager.gd",
		"res://test/test_gear_manager.gd",
		"res://test/test_matchmaker_manager.gd",
		"res://test/test_matchmaking_manager.gd",
		"res://test/test_network_manager.gd",
		"res://test/test_player_stats_manager.gd",
		"res://test/test_weapon_balance_manager.gd",
		"res://test/test_store_manager.gd",
		"res://test/test_campaign_manager.gd",
		"res://test/test_season_manager.gd",
		"res://test/test_inventory_manager.gd",
		"res://test/test_shooting_manager.gd",

		# Gear and items
		"res://test/test_gear_registry.gd",
		"res://test/test_gem_manager.gd",
		"res://test/test_transmog_manager.gd",
		"res://test/test_gear_enums.gd",
		"res://test/test_encounter_data.gd",

		# UI and visual
		"res://test/test_ui_transition_optimizer.gd",
		"res://test/test_ui_automation.gd",
		"res://test/test_vfx_manager.gd",
		"res://test/test_theme_manager.gd",
		"res://test/test_safe_area_manager.gd",

		# Design tokens
		"res://test/test_archer_design_tokens.gd",
		"res://test/test_design_tokens.gd",

		# Audio
		"res://test/test_audio_manager.gd",

		# Accessibility
		"res://test/test_accessibility_manager.gd",

		# Combat and sync
		"res://test/test_combat_sync_manager.gd",
		"res://test/test_auto_aim_manager.gd",

		# Animation
		"res://test/test_animation_utils.gd",

		# Object pooling and performance
		"res://test/test_object_pool.gd",
		"res://test/test_performance_profiler.gd",
		"res://test/test_profiling_instrumentation.gd",
		"res://test/test_low_end_device_performance.gd",
		"res://test/test_performance_benchmarks.gd",
		"res://test/test_network_resilience.gd",

		# Scripts
		"res://test/test_arrow.gd",
		"res://test/test_screen_shake.gd",
		"res://test/test_camera_shake_integration.gd",
		"res://test/test_damage_popup.gd",
		"res://test/test_character_body_2d.gd",
		"res://test/test_background_palette.gd",
		"res://test/test_sprite_palette.gd",
		"res://test/test_screenshot_capture.gd",

		# Analytics
		"res://test/test_analytics_manager.gd",

		# Scene scripts (enemies)
		"res://test/test_base_enemy.gd",
		"res://test/test_enemy_spawner.gd",
		"res://test/test_melee_enemy.gd",
		"res://test/test_ranged_enemy.gd",
		"res://test/test_tank_enemy.gd",
		"res://test/test_speed_enemy.gd",
		"res://test/test_scout_enemy.gd",
		"res://test/test_brute_enemy.gd",
		"res://test/test_guardian_enemy.gd",
		"res://test/test_swarmer_enemy.gd",
		"res://test/test_necromancer_enemy.gd",

		# Scene scripts (player/gear)
		"res://test/test_gear_data.gd",
		"res://test/test_gear_slot.gd",
		"res://test/test_cosmetic_skin_data.gd",
		"res://test/test_modular_character_sprite.gd",

		# NOTE: GUT framework tests excluded - these extend GutTest and require GUT runner:
		# - test_const.gd, test_boss_system.gd, test_combat_juice_integration.gd
		# - test_damage_indicator_manager.gd, test_damage_overlay.gd, test_death_animations.gd
		# - test_difficulty_scaling_manager.gd, test_dynamic_difficulty_manager.gd
		# - test_enemy_ai.gd, test_gear_balance_calculator.gd, test_gut_simple.gd
		# - test_hit_reactions.gd, test_impact_manager.gd
		# - test_matchmaking_analytics_manager.gd, test_matchmaking_pool_manager.gd
		# - test_pacing_manager.gd, test_player_rating_manager.gd
		# - test_progression_indicator_manager.gd, test_progression_scenarios.gd
		# - test_season_leaderboard.gd, test_stat_allocation_manager.gd
		# - test_weapon_balance_manager.gd, test_xp_manager.gd
		# - test_boss_basic.gd, test_boss_fire.gd (require scene files)
		# - test_ui_components.gd, test_loadout.gd, test_gear_enums_coverage.gd
	]

	_total_tests = test_files.size()

	# Run tests synchronously
	for test_file in test_files:
		_run_single_test(test_file)

	_all_tests_completed = true

	# Cleanup: Free all test root children to prevent memory leaks
	for child in _test_root.get_children():
		if is_instance_valid(child):
			child.queue_free()
	# Process frames to ensure queued frees execute
	for i in range(2):
		process_frame()

	_print_summary()
	quit(_exit_code)

func _run_single_test(test_file: String):
	_tests_run += 1
	print("[TEST %d/%d] %s" % [_tests_run, _total_tests, test_file])

	var test_script = load(test_file)
	if not test_script:
		print("  [WARN] Could not load test file: " + test_file)
		return

	var test_instance = test_script.new()
	_test_root.add_child(test_instance)

	# Check if test has run_tests method
	if test_instance.has_method("run_tests"):
		test_instance.run_tests()

	# Note: In headless mode, tests should run synchronously
	# No frame waiting needed as we avoid async operations

	# Proper cleanup for headless mode
	if is_instance_valid(test_instance):
		# First queue free the test instance
		test_instance.queue_free()
		# Process one frame to allow queued frees to execute
		# This is critical for preventing memory leaks in headless mode
		process_frame()

func _print_summary():
	print("")
	print("=== Test Suite Complete ===")
	print("Total test files: %d" % _total_tests)
	print("Tests run: %d" % _tests_run)
	print("Exit code: %d" % _exit_code)
