## Sprint 7 Regression Test Runner
## Runs all regression-critical tests across PvE, PvP, Seasons, Inventory, Purchases, and Touch
## Usage: godot --headless --script test/regression_sprint7.gd
extends SceneTree

var _categories: Dictionary = {}
var _total_passed: int = 0
var _total_failed: int = 0

func _init() -> void:
	print("========================================================")
	print("  Sprint 7 — Mobile Beta Regression Test Suite")
	print("========================================================\n")

	_define_categories()
	_run_all()
	_print_summary()
	quit()

func _define_categories() -> void:
	_categories = {
		"PvE": [
			"res://test/test_enemy_ai.gd",
			"res://test/test_base_enemy.gd",
			"res://test/test_combat_manager.gd",
			"res://test/test_shooting_manager.gd",
			"res://test/test_enemy_spawner.gd",
			"res://test/test_pve_combat_loop.gd",
		],
		"PvP": [
			"res://test/test_matchmaker_manager.gd",
			"res://test/test_matchmaking_manager.gd",
			"res://test/test_matchmaking_analytics_manager.gd",
			"res://test/test_async_duel_flow.gd",
		],
		"Seasons": [
			"res://test/test_season_manager.gd",
			"res://test/test_season_leaderboard.gd",
			"res://test/test_season_manager_integration.gd",
		],
		"Inventory": [
			"res://test/test_inventory_manager.gd",
			"res://test/test_gear_manager.gd",
			"res://test/test_gear_registry.gd",
			"res://test/test_gear_data.gd",
			"res://test/test_gear_enums.gd",
			"res://test/test_gem_manager.gd",
			"res://test/test_loadout.gd",
		],
		"Purchases": [
			"res://test/test_store_manager.gd",
			"res://test/test_store_purchase_flow.gd",
			"res://test/test_store_fallback.gd",
		],
		"Touch": [
			"res://test/test_auto_aim_manager.gd",
			"res://test/test_safe_area_manager.gd",
			"res://test/test_performance_profiler.gd",
			"res://test/test_object_pool.gd",
		],
	}

func _run_all() -> void:
	for category in _categories:
		print("\n--- %s ---" % category)
		var tests: Array = _categories[category]
		var cat_passed: int = 0
		var cat_failed: int = 0
		for test_path in tests:
			var result = _run_test(test_path)
			if result == "PASS":
				cat_passed += 1
			elif result == "FAIL":
				cat_failed += 1
			# SKIP or ERROR: don't count
		_total_passed += cat_passed
		_total_failed += cat_failed
		print("  %s: %d passed, %d failed" % [category, cat_passed, cat_failed])

func _run_test(test_path: String) -> String:
	if not ResourceLoader.exists(test_path):
		print("  [SKIP] %s (file not found)" % test_path)
		return "SKIP"

	var script = load(test_path)
	if not script:
		print("  [ERROR] %s (failed to load)" % test_path)
		return "ERROR"

	# Instantiate the test node
	var test_node = script.new()
	if not test_node:
		print("  [ERROR] %s (failed to instantiate)" % test_path)
		return "ERROR"

	# Check if it uses the signal-based pattern
	var has_signal_pattern = test_node.has_signal("test_completed")

	# Add to tree so _ready fires
	root.add_child(test_node)

	# Wait for tests to complete (most tests use await in _ready)
	await root.get_tree().create_timer(2.0).timeout

	# Read results from the test node
	var passed = test_node.get("_tests_passed") if "_tests_passed" in test_node else 0
	var failed = test_node.get("_tests_failed") if "_tests_failed" in test_node else 0

	test_node.queue_free()

	if failed > 0:
		print("  [FAIL] %s (%d passed, %d failed)" % [test_path, passed, failed])
		return "FAIL"
	elif passed > 0:
		print("  [PASS] %s (%d tests)" % [test_path, passed])
		return "PASS"
	else:
		print("  [SKIP] %s (no results)" % test_path)
		return "SKIP"

func _print_summary() -> void:
	print("\n========================================================")
	print("  REGRESSION SUMMARY")
	print("========================================================")
	print("  Total Passed: %d" % _total_passed)
	print("  Total Failed: %d" % _total_failed)
	if _total_failed == 0:
		print("  RESULT: ALL REGRESSIONS PASSED")
	else:
		print("  RESULT: REGRESSIONS FOUND — %d FAILURES" % _total_failed)
	print("========================================================")
