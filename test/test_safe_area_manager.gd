extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running SafeAreaManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_get_safe_margins()
	await test_apply_to_control()
	await test_signal_exists()

	print("\n=== SafeAreaManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_safe_area_manager() -> Node:
	var safe = load("res://autoloads/SafeAreaManager.gd").new()
	add_child(safe)
	return safe

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var safe = _create_safe_area_manager()

	if safe.safe_margins.has("left") and safe.safe_margins.has("top"):
		_pass("test_initial_margins_dict")
	else:
		_fail("test_initial_margins_dict", "Should have margin keys")

	safe.queue_free()

func test_get_safe_margins() -> void:
	var safe = _create_safe_area_manager()

	var margins = safe.get_safe_margins()

	if margins.has("left") and margins.has("top") and margins.has("right") and margins.has("bottom"):
		_pass("test_get_safe_margins_keys")
	else:
		_fail("test_get_safe_margins_keys", "Should have all margin keys")

	if typeof(margins["left"]) == TYPE_FLOAT:
		_pass("test_get_safe_margins_types")
	else:
		_fail("test_get_safe_margins_types", "Margins should be floats")

	safe.queue_free()

func test_apply_to_control() -> void:
	var safe = _create_safe_area_manager()

	# Set mock margins
	safe.safe_margins = {"left": 10.0, "top": 20.0, "right": 30.0, "bottom": 40.0}

	var control = Control.new()
	control.offset_left = 0
	control.offset_top = 0
	control.offset_right = 100
	control.offset_bottom = 100
	add_child(control)

	safe.apply_to_control(control)

	if control.offset_left == 10.0:
		_pass("test_apply_left_offset")
	else:
		_fail("test_apply_left_offset", "Left offset should be applied")

	if control.offset_top == 20.0:
		_pass("test_apply_top_offset")
	else:
		_fail("test_apply_top_offset", "Top offset should be applied")

	if control.offset_right == 70.0:  # 100 - 30
		_pass("test_apply_right_offset")
	else:
		_fail("test_apply_right_offset", "Right offset should be applied")

	if control.offset_bottom == 60.0:  # 100 - 40
		_pass("test_apply_bottom_offset")
	else:
		_fail("test_apply_bottom_offset", "Bottom offset should be applied")

	control.queue_free()
	safe.queue_free()

func test_signal_exists() -> void:
	var safe = _create_safe_area_manager()

	if safe.has_signal("safe_area_changed"):
		_pass("test_signal_exists")
	else:
		_fail("test_signal_exists", "Should have safe_area_changed signal")

	safe.queue_free()
