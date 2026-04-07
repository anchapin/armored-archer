extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running UIAutomation Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_constants()
	await test_singleton_initialization()
	await test_easing_enum_values()
	await test_slide_direction_enum_values()
	await test_static_methods_exist()
	await test_get_instance_creates_instance()

	print("\n=== UIAutomation Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_ui_automation() -> Node:
	var ui_auto = load("res://autoloads/UIAutomation.gd").new()
	add_child(ui_auto)
	await get_tree().process_frame
	return ui_auto

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_constants() -> void:
	var ui_auto = await _create_ui_automation()

	if ui_auto.DEFAULT_DURATION == 0.3:
		_pass("test_default_duration_constant")
	else:
		_fail("test_default_duration_constant", "DEFAULT_DURATION should be 0.3")

	if ui_auto.FAST_DURATION == 0.15:
		_pass("test_fast_duration_constant")
	else:
		_fail("test_fast_duration_constant", "FAST_DURATION should be 0.15")

	if ui_auto.SLOW_DURATION == 0.5:
		_pass("test_slow_duration_constant")
	else:
		_fail("test_slow_duration_constant", "SLOW_DURATION should be 0.5")

	ui_auto.queue_free()

func test_singleton_initialization() -> void:
	var UIAutomationClass = load("res://autoloads/UIAutomation.gd")
	var ui_auto = await _create_ui_automation()

	if UIAutomationClass._instance == ui_auto:
		_pass("test_singleton_sets_instance")
	else:
		_fail("test_singleton_sets_instance", "Singleton should set _instance")

	ui_auto.queue_free()

	if not UIAutomationClass._instance:
		_pass("test_singleton_clears_on_exit")
	else:
		_fail("test_singleton_clears_on_exit", "Singleton should clear on exit")

func test_easing_enum_values() -> void:
	var ui_auto = await _create_ui_automation()

	var easing = ui_auto.EasingType
	if easing.has("EASE_OUT"):
		_pass("test_easing_type_has_ease_out")
	else:
		_fail("test_easing_type_has_ease_out", "EasingType should have EASE_OUT")

	if easing.has("EASE_IN"):
		_pass("test_easing_type_has_ease_in")
	else:
		_fail("test_easing_type_has_ease_in", "EasingType should have EASE_IN")

	if easing.has("EASE_IN_OUT"):
		_pass("test_easing_type_has_ease_in_out")
	else:
		_fail("test_easing_type_has_ease_in_out", "EasingType should have EASE_IN_OUT")

	if easing.has("LINEAR"):
		_pass("test_easing_type_has_linear")
	else:
		_fail("test_easing_type_has_linear", "EasingType should have LINEAR")

	ui_auto.queue_free()

func test_slide_direction_enum_values() -> void:
	var ui_auto = await _create_ui_automation()

	var directions = ui_auto.SlideDirection
	if directions.has("LEFT"):
		_pass("test_slide_direction_has_left")
	else:
		_fail("test_slide_direction_has_left", "SlideDirection should have LEFT")

	if directions.has("RIGHT"):
		_pass("test_slide_direction_has_right")
	else:
		_fail("test_slide_direction_has_right", "SlideDirection should have RIGHT")

	if directions.has("UP"):
		_pass("test_slide_direction_has_up")
	else:
		_fail("test_slide_direction_has_up", "SlideDirection should have UP")

	if directions.has("DOWN"):
		_pass("test_slide_direction_has_down")
	else:
		_fail("test_slide_direction_has_down", "SlideDirection should have DOWN")

	ui_auto.queue_free()

func test_static_methods_exist() -> void:
	var ui_auto = await _create_ui_automation()

	if typeof(ui_auto.get("fade_in")) == TYPE_CALLABLE:
		_pass("test_fade_in_method_exists")
	else:
		_fail("test_fade_in_method_exists", "fade_in method should exist")

	if typeof(ui_auto.get("fade_out")) == TYPE_CALLABLE:
		_pass("test_fade_out_method_exists")
	else:
		_fail("test_fade_out_method_exists", "fade_out method should exist")

	if typeof(ui_auto.get("scale_in")) == TYPE_CALLABLE:
		_pass("test_scale_in_method_exists")
	else:
		_fail("test_scale_in_method_exists", "scale_in method should exist")

	if typeof(ui_auto.get("scale_out")) == TYPE_CALLABLE:
		_pass("test_scale_out_method_exists")
	else:
		_fail("test_scale_out_method_exists", "scale_out method should exist")

	if typeof(ui_auto.get("slide_in")) == TYPE_CALLABLE:
		_pass("test_slide_in_method_exists")
	else:
		_fail("test_slide_in_method_exists", "slide_in method should exist")

	if typeof(ui_auto.get("slide_out")) == TYPE_CALLABLE:
		_pass("test_slide_out_method_exists")
	else:
		_fail("test_slide_out_method_exists", "slide_out method should exist")

	if typeof(ui_auto.get("pulse")) == TYPE_CALLABLE:
		_pass("test_pulse_method_exists")
	else:
		_fail("test_pulse_method_exists", "pulse method should exist")

	if typeof(ui_auto.get("shake")) == TYPE_CALLABLE:
		_pass("test_shake_method_exists")
	else:
		_fail("test_shake_method_exists", "shake method should exist")

	if typeof(ui_auto.get("button_hover_in")) == TYPE_CALLABLE:
		_pass("test_button_hover_in_method_exists")
	else:
		_fail("test_button_hover_in_method_exists", "button_hover_in method should exist")

	if typeof(ui_auto.get("button_press")) == TYPE_CALLABLE:
		_pass("test_button_press_method_exists")
	else:
		_fail("test_button_press_method_exists", "button_press method should exist")

	ui_auto.queue_free()

func test_get_instance_creates_instance() -> void:
	var UIAutomationClass = load("res://autoloads/UIAutomation.gd")
	var ui_auto = await _create_ui_automation()
	ui_auto.queue_free()

	var instance = UIAutomationClass.get_instance()
	if instance != null:
		_pass("test_get_instance_returns_instance")
		instance.queue_free()
	else:
		_fail("test_get_instance_returns_instance", "get_instance should return instance")