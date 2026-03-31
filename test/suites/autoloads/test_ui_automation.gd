extends GutTest

var UIAutomationClass = load("res://autoloads/UIAutomation.gd")
var _ui_auto: UIAutomation

func before_each():
	UIAutomation._instance = null
	_ui_auto = UIAutomationClass.new()
	add_child_autofree(_ui_auto)

func after_each():
	UIAutomation._instance = null
	_ui_auto = null

func test_ui_automation_initializes():
	assert_true(_ui_auto != null, "UIAutomation should instantiate")
	assert_true(_ui_auto.has_method("fade_in"), "Should have fade_in method")
	assert_true(_ui_auto.has_method("fade_out"), "Should have fade_out method")
	assert_true(_ui_auto.has_method("scale_in"), "Should have scale_in method")
	assert_true(_ui_auto.has_method("slide_in"), "Should have slide_in method")

func test_animation_constants():
	assert_eq(UIAutomation.DEFAULT_DURATION, 0.3, "DEFAULT_DURATION should be 0.3")
	assert_eq(UIAutomation.FAST_DURATION, 0.15, "FAST_DURATION should be 0.15")
	assert_eq(UIAutomation.SLOW_DURATION, 0.5, "SLOW_DURATION should be 0.5")

func test_easing_type_enum():
	var ease_out = UIAutomation.EasingType.EASE_OUT
	var ease_in = UIAutomation.EasingType.EASE_IN
	var ease_in_out = UIAutomation.EasingType.EASE_IN_OUT
	var linear = UIAutomation.EasingType.LINEAR
	assert_eq(ease_out, 0, "EASE_OUT should be 0")
	assert_eq(ease_in, 1, "EASE_IN should be 1")
	assert_eq(ease_in_out, 2, "EASE_IN_OUT should be 2")
	assert_eq(linear, 3, "LINEAR should be 3")

func test_slide_direction_enum():
	var left = UIAutomation.SlideDirection.LEFT
	var right = UIAutomation.SlideDirection.RIGHT
	var up = UIAutomation.SlideDirection.UP
	var down = UIAutomation.SlideDirection.DOWN
	assert_eq(left, 0, "LEFT should be 0")
	assert_eq(right, 1, "RIGHT should be 1")
	assert_eq(up, 2, "UP should be 2")
	assert_eq(down, 3, "DOWN should be 3")

func test_static_get_instance():
	var instance = UIAutomation.get_instance()
	assert_true(instance != null, "get_instance should return an instance")

func test_singleton_lifecycle():
	UIAutomation._instance = null
	var ui = UIAutomationClass.new()
	add_child_autofree(ui)
	assert_eq(UIAutomation._instance, ui, "Instance should be set on ready")

func test_fade_methods_exist():
	assert_true(_ui_auto.has_method("fade_in"), "fade_in should exist")
	assert_true(_ui_auto.has_method("fade_out"), "fade_out should exist")

func test_scale_methods_exist():
	assert_true(_ui_auto.has_method("scale_in"), "scale_in should exist")
	assert_true(_ui_auto.has_method("scale_out"), "scale_out should exist")
	assert_true(_ui_auto.has_method("scale_pulse"), "scale_pulse should exist")

func test_slide_methods_exist():
	assert_true(_ui_auto.has_method("slide_in"), "slide_in should exist")
	assert_true(_ui_auto.has_method("slide_out"), "slide_out should exist")

func test_additional_methods_exist():
	assert_true(_ui_auto.has_method("pulse"), "pulse should exist")
	assert_true(_ui_auto.has_method("shake"), "shake should exist")
	assert_true(_ui_auto.has_method("bounce"), "bounce should exist")
	assert_true(_ui_auto.has_method("spinner"), "spinner should exist")

func test_static_fade_methods():
	assert_true(has_method("fade_in"), "Should have static fade_in")
	assert_true(has_method("fade_out"), "Should have static fade_out")

func test_node_parameter_handling():
	# Test with null node doesn't crash
	var tween = UIAutomation.fade_in(null, 0.3)
	assert_null(tween, "fade_in with null node should return null")