extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running ScreenshotCapture Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_capture_screenshot_returns_path()
	await test_capture_screenshot_increments_count()
	await test_capture_main_menu()
	await test_capture_combat()
	await test_capture_gear_inventory()
	await test_capture_shop()
	await test_capture_leaderboard()
	await test_capture_campaign()
	await test_capture_loadout()
	await test_custom_file_prefix()
	await test_screenshot_path_configuration()

	print("\n=== ScreenshotCapture Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_screenshot_capture() -> Node:
	var script = load("res://scripts/screenshot_capture.gd")
	var node = Node.new()
	node.set_script(script)
	add_child(node)
	await get_tree().process_frame
	return node

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var sc = await _create_screenshot_capture()

	if sc.screenshot_path == "user://screenshots/":
		_pass("test_default_screenshot_path")
	else:
		_fail("test_default_screenshot_path", "Default path should be user://screenshots/")

	if sc.file_prefix == "screenshot_":
		_pass("test_default_file_prefix")
	else:
		_fail("test_default_file_prefix", "Default prefix should be screenshot_")

	if sc.auto_number == true:
		_pass("test_default_auto_number")
	else:
		_fail("test_default_auto_number", "Auto number should be enabled by default")

	if sc._screenshot_count >= 0:
		_pass("test_initial_count_non_negative")
	else:
		_fail("test_initial_count_non_negative", "Screenshot count should be non-negative")

	sc.queue_free()

func test_capture_screenshot_returns_path() -> void:
	var sc = await _create_screenshot_capture()

	var result = sc.capture_screenshot()

	if typeof(result) == TYPE_STRING:
		_pass("test_capture_returns_string")
	else:
		_fail("test_capture_returns_string", "capture_screenshot should return string path")

	if result.begins_with(sc.screenshot_path):
		_pass("test_capture_path_starts_with_screenshot_path")
	else:
		_fail("test_capture_path_starts_with_screenshot_path", "Path should start with screenshot_path")

	if result.ends_with(".png"):
		_pass("test_capture_path_ends_with_png")
	else:
		_fail("test_capture_path_ends_with_png", "Path should end with .png")

	sc.queue_free()

func test_capture_screenshot_increments_count() -> void:
	var sc = await _create_screenshot_capture()
	var count_before = sc._screenshot_count

	sc.capture_screenshot()

	if sc._screenshot_count == count_before + 1:
		_pass("test_capture_increments_count")
	else:
		_fail("test_capture_increments_count", "Screenshot count should increment by 1")

	sc.capture_screenshot()
	sc.capture_screenshot()

	if sc._screenshot_count == count_before + 3:
		_pass("test_capture_multiple_increments")
	else:
		_fail("test_capture_multiple_increments", "Count should increment for each capture")

	sc.queue_free()

func test_capture_main_menu() -> void:
	var sc = await _create_screenshot_capture()

	var result = sc.capture_main_menu()

	if typeof(result) == TYPE_STRING and result.ends_with(".png"):
		_pass("test_capture_main_menu")
	else:
		_fail("test_capture_main_menu", "Should return valid screenshot path")

	sc.queue_free()

func test_capture_combat() -> void:
	var sc = await _create_screenshot_capture()

	var result = sc.capture_combat()

	if typeof(result) == TYPE_STRING and result.ends_with(".png"):
		_pass("test_capture_combat")
	else:
		_fail("test_capture_combat", "Should return valid screenshot path")

	sc.queue_free()

func test_capture_gear_inventory() -> void:
	var sc = await _create_screenshot_capture()

	var result = sc.capture_gear_inventory()

	if typeof(result) == TYPE_STRING and result.ends_with(".png"):
		_pass("test_capture_gear_inventory")
	else:
		_fail("test_capture_gear_inventory", "Should return valid screenshot path")

	sc.queue_free()

func test_capture_shop() -> void:
	var sc = await _create_screenshot_capture()

	var result = sc.capture_shop()

	if typeof(result) == TYPE_STRING and result.ends_with(".png"):
		_pass("test_capture_shop")
	else:
		_fail("test_capture_shop", "Should return valid screenshot path")

	sc.queue_free()

func test_capture_leaderboard() -> void:
	var sc = await _create_screenshot_capture()

	var result = sc.capture_leaderboard()

	if typeof(result) == TYPE_STRING and result.ends_with(".png"):
		_pass("test_capture_leaderboard")
	else:
		_fail("test_capture_leaderboard", "Should return valid screenshot path")

	sc.queue_free()

func test_capture_campaign() -> void:
	var sc = await _create_screenshot_capture()

	var result = sc.capture_campaign()

	if typeof(result) == TYPE_STRING and result.ends_with(".png"):
		_pass("test_capture_campaign")
	else:
		_fail("test_capture_campaign", "Should return valid screenshot path")

	sc.queue_free()

func test_capture_loadout() -> void:
	var sc = await _create_screenshot_capture()

	var result = sc.capture_loadout()

	if typeof(result) == TYPE_STRING and result.ends_with(".png"):
		_pass("test_capture_loadout")
	else:
		_fail("test_capture_loadout", "Should return valid screenshot path")

	sc.queue_free()

func test_custom_file_prefix() -> void:
	var sc = await _create_screenshot_capture()
	sc.file_prefix = "test_capture_"

	var result = sc.capture_screenshot()

	if "test_capture_" in result:
		_pass("test_custom_file_prefix")
	else:
		_fail("test_custom_file_prefix", "Screenshot should use custom prefix")

	sc.queue_free()

func test_screenshot_path_configuration() -> void:
	var sc = await _create_screenshot_capture()
	sc.screenshot_path = "user://test_screenshots/"

	var result = sc.capture_screenshot()

	if result.begins_with("user://test_screenshots/"):
		_pass("test_custom_screenshot_path")
	else:
		_fail("test_custom_screenshot_path", "Screenshot should use custom path")

	sc.queue_free()
