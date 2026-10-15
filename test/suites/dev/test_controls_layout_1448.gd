extends GutTest

var touch: Control
var saved_margins: Dictionary

func before_each() -> void:
	saved_margins = SafeAreaManager.safe_margins.duplicate()
	SafeAreaManager.safe_margins = {"left": 0.0, "top": 0.0, "right": 0.0, "bottom": 0.0}
	touch = load("res://scenes/touch_ui.tscn").instantiate()
	touch.controls_mode = touch.ControlsMode.TOUCH
	add_child(touch)
	touch._adjust_joysticks_for_safe_area()

func after_each() -> void:
	touch.free()
	SafeAreaManager.safe_margins = saved_margins

func test_desktop_hides_and_disables_both_touch_inputs() -> void:
	touch.controls_mode = touch.ControlsMode.DESKTOP
	touch.apply_controls_mode()
	for stick in [touch.movement_joystick, touch.aiming_joystick]:
		assert_false(stick.visible)
		assert_false(stick.is_processing_input())

func test_touch_bounds_are_small_and_in_bottom_corners() -> void:
	for stick in [touch.movement_joystick, touch.aiming_joystick]:
		assert_true(stick.visible)
		assert_eq(stick.size, Vector2(120, 120))
		assert_eq(stick.anchor_top, 1.0)
		assert_eq(stick.offset_bottom, -12.0)
	assert_eq(touch.movement_joystick.offset_left, 12.0)
	assert_eq(touch.aiming_joystick.offset_right, -12.0)
	assert_lt(2.0 * 120.0 * 120.0 / (640.0 * 360.0), 0.25)

func test_safe_margins_inset_both_sticks_without_changing_size() -> void:
	SafeAreaManager.safe_margins = {"left": 20.0, "top": 0.0, "right": 30.0, "bottom": 10.0}
	touch._adjust_joysticks_for_safe_area()
	assert_eq(touch.movement_joystick.offset_left, 32.0)
	assert_eq(touch.aiming_joystick.offset_right, -42.0)
	for stick in [touch.movement_joystick, touch.aiming_joystick]:
		assert_eq(stick.offset_bottom, -22.0)
		assert_eq(stick.size, Vector2(120, 120))

func test_repeated_layout_does_not_compound_radius() -> void:
	var stick: Control = touch.movement_joystick
	stick._scale_joystick_to_viewport()
	var radius: float = stick.joystick_radius
	stick._scale_joystick_to_viewport()
	assert_eq(stick.joystick_radius, radius)
	assert_eq(radius, 42.0)

func test_hidden_stick_cannot_capture_touch() -> void:
	var stick: Control = touch.movement_joystick
	stick.hide()
	var event := InputEventScreenTouch.new()
	event.index = 0
	event.pressed = true
	event.position = stick._get_joystick_center()
	stick._input(event)
	assert_eq(stick.touch_index, -1)
	assert_false(stick.is_active)

func test_drag_clamps_and_release_clears_output() -> void:
	var stick: Control = touch.movement_joystick
	watch_signals(stick)
	stick.update_thumb_position(stick._get_joystick_center() + Vector2(200, 0))
	assert_almost_eq(stick.output_vector.length(), 1.0, 0.001)
	assert_signal_emitted(stick, "joystick_moved")
	stick._release_joystick()
	assert_eq(stick.output_vector, Vector2.ZERO)
	assert_signal_emit_count(stick, "joystick_released", 1)

func test_switching_to_desktop_cancels_held_aim() -> void:
	touch._touch_aim_started = true
	touch.aiming_joystick.touch_index = 1
	touch.aiming_joystick.is_active = true
	touch.controls_mode = touch.ControlsMode.DESKTOP
	touch.apply_controls_mode()
	assert_false(touch._touch_aim_started)
	assert_eq(touch.aiming_joystick.touch_index, -1)

func test_two_sticks_capture_and_release_separate_fingers() -> void:
	var move: Control = touch.movement_joystick
	var aim: Control = touch.aiming_joystick
	var press := InputEventScreenTouch.new()
	press.index = 1
	press.pressed = true
	press.position = move._get_joystick_center()
	move._input(press)
	aim._input(press)
	assert_eq(move.touch_index, 1)
	assert_eq(aim.touch_index, -1)
	press.index = 2
	press.position = aim._get_joystick_center()
	aim._input(press)
	assert_eq(aim.touch_index, 2)
	press.index = 1
	press.pressed = false
	move._input(press)
	aim._input(press)
	assert_eq(move.touch_index, -1)
	assert_eq(aim.touch_index, 2)
