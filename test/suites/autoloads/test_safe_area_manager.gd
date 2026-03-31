extends GutTest

var SafeAreaManagerClass = preload("res://autoloads/SafeAreaManager.gd")
var _safe_area

func before_each():
	_safe_area = SafeAreaManagerClass.new()
	add_child_autofree(_safe_area)

func after_each():
	_safe_area = null

func test_initial_safe_margins():
	var margins = _safe_area.get_safe_margins()
	assert_eq(margins.left, 0.0, "Left margin should start at 0")
	assert_eq(margins.top, 0.0, "Top margin should start at 0")
	assert_eq(margins.right, 0.0, "Right margin should start at 0")
	assert_eq(margins.bottom, 0.0, "Bottom margin should start at 0")

func test_safe_area_changed_signal():
	watch_signals(_safe_area)
	_safe_area.emit_signal("safe_area_changed")
	assert_signal_emitted(_safe_area, "safe_area_changed", "Should emit safe_area_changed signal")

func test_update_safe_area():
	_safe_area._update_safe_area()
	var margins = _safe_area.get_safe_margins()
	assert_true(margins.has("left"), "Should have left margin")
	assert_true(margins.has("top"), "Should have top margin")
	assert_true(margins.has("right"), "Should have right margin")
	assert_true(margins.has("bottom"), "Should have bottom margin")

func test_on_screen_size_changed():
	watch_signals(_safe_area)
	_safe_area._on_screen_size_changed()
	assert_signal_emitted(_safe_area, "safe_area_changed", "Should emit signal on screen size change")

func test_apply_to_control():
	var control = Control.new()
	add_child_autofree(control)
	control.offset_left = 0.0
	control.offset_top = 0.0
	control.offset_right = 100.0
	control.offset_bottom = 100.0

	_safe_area.safe_margins = {"left": 10.0, "top": 20.0, "right": 15.0, "bottom": 25.0}
	_safe_area.apply_to_control(control)

	assert_eq(control.offset_left, 10.0, "Left offset should be adjusted")
	assert_eq(control.offset_top, 20.0, "Top offset should be adjusted")
	assert_eq(control.offset_right, 85.0, "Right offset should be reduced")
	assert_eq(control.offset_bottom, 75.0, "Bottom offset should be reduced")

func test_apply_to_control_zero_margins():
	var control = Control.new()
	add_child_autofree(control)
	control.offset_left = 0.0
	control.offset_top = 0.0
	control.offset_right = 100.0
	control.offset_bottom = 100.0

	_safe_area.safe_margins = {"left": 0.0, "top": 0.0, "right": 0.0, "bottom": 0.0}
	_safe_area.apply_to_control(control)

	assert_eq(control.offset_left, 0.0, "Left offset should remain unchanged")
	assert_eq(control.offset_top, 0.0, "Top offset should remain unchanged")
	assert_eq(control.offset_right, 100.0, "Right offset should remain unchanged")
	assert_eq(control.offset_bottom, 100.0, "Bottom offset should remain unchanged")
