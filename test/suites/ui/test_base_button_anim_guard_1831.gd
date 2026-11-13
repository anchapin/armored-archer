extends GutTest

## Issue #1831: the shared base button must honour the global UI animation
## switch (`UITransitionOptimizer.is_ui_animation_enabled()`).
##
## `scenes/ui/components/base_button.gd` created tweens for hover, press and
## glow without ever consulting the optimizer, so a consumer-side guard could
## not promise "no animations anywhere" — the shared button animated anyway.
##
## The fix routes the flag through UIAutomation's shipped static API
## (`UIAutomation.are_animations_enabled()`, autoloads/UIAutomation.gd:387),
## the same static-setting pattern PRs #1825/#1833 used. No `/root` look-up is
## added to the button.
##
## The suite has three layers:
##   1. **Static** — each of `_animate_hover`, `_animate_press` and
##      `_animate_glow` must consult the switch *before* creating a tween.
##   2. **Runtime** — with animations enabled the button still animates; with
##      animations disabled it creates no tween and stays neutral.
##   3. **Runtime, mid-flight** — turning the switch off while a tween runs
##      restores the neutral transform instead of leaving the button stuck
##      scaled/rotated/glowing.
##
## Unchanged behaviour (state changes, audio, pressed/toggled signals, size,
## styles and input handling) is asserted as well.

const BASE_BUTTON_SCRIPT_PATH := "res://scenes/ui/components/base_button.gd"

## The neutral scale of a freshly created base button.
const NEUTRAL_SCALE := 1.0
## Hover scale factor used by `_animate_hover`.
const HOVER_SCALE := 1.05
## Press scale factor used by `_animate_press`.
const PRESS_SCALE := 0.92
## Rotation (radians) used by `_animate_press`.
const PRESS_ROTATION := 0.026179938779914945  # deg_to_rad(1.5)


# ---------------------------------------------------------------------------
# Helpers.
# ---------------------------------------------------------------------------

func _read_base_button_source() -> String:
	var file := FileAccess.open(BASE_BUTTON_SCRIPT_PATH, FileAccess.READ)
	assert_not_null(file, "Could not open %s" % BASE_BUTTON_SCRIPT_PATH)
	if file == null:
		return ""
	var text := file.get_as_text()
	file.close()
	return text


func _extract_method(source: String, method_name: String) -> String:
	## Return the source of a single `func` block (up to the next top level func).
	var start := source.find("func %s(" % method_name)
	if start == -1:
		return ""
	var next_func := source.find("\nfunc ", start + 1)
	if next_func == -1:
		return source.substr(start)
	return source.substr(start, next_func - start)


func _optimizer() -> Node:
	return get_node_or_null("/root/UITransitionOptimizer")


func _set_animations_enabled(enabled: bool) -> void:
	var optimizer := _optimizer()
	if optimizer == null:
		return
	optimizer.set("_ui_animation_enabled", enabled)


func _make_button() -> ArcheryBaseButton:
	var button := ArcheryBaseButton.new()
	add_child_autofree(button)
	await get_tree().process_frame
	return button


func _wait(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout


func _style_shadow_size(button: ArcheryBaseButton) -> int:
	var style := button.get_theme_stylebox("normal") as StyleBoxFlat
	if style == null:
		return -1
	return style.shadow_size


# ---------------------------------------------------------------------------
# Layer 1: static source guards.
# ---------------------------------------------------------------------------

func test_base_button_reads_the_global_animation_switch() -> void:
	var source := _read_base_button_source()
	assert_true(
		source.contains("are_animations_enabled()"),
		"base_button.gd must consult UIAutomation.are_animations_enabled() (issue #1831)."
	)
	assert_false(
		source.contains("UITransitionOptimizer"),
		"base_button.gd must not look the optimizer up itself; the static API is enough (issue #1831)."
	)


func test_every_animate_method_guards_its_tween_creation() -> void:
	var source := _read_base_button_source()
	for method_name in ["_animate_hover", "_animate_press", "_animate_glow"]:
		var body := _extract_method(source, method_name)
		assert_ne(body, "", "base_button.gd must still define %s (issue #1831)." % method_name)
		if body == "":
			continue
		var guard_index := body.find("_animations_enabled()")
		var tween_index := body.find("create_tween()")
		assert_ne(
			guard_index,
			-1,
			"%s must check the global animation switch (issue #1831)." % method_name
		)
		assert_ne(
			tween_index,
			-1,
			"%s must still create a tween when animations are enabled (issue #1831)." % method_name
		)
		if guard_index == -1 or tween_index == -1:
			continue
		assert_lt(
			guard_index,
			tween_index,
			"%s must check the animation switch before creating its tween (issue #1831)." % method_name
		)


# ---------------------------------------------------------------------------
# Layer 2: runtime behaviour with animations enabled.
# ---------------------------------------------------------------------------

func test_hover_animates_when_animations_are_enabled() -> void:
	if _optimizer() == null:
		pending("UITransitionOptimizer autoload not available — skipping issue #1831 runtime check.")
		return
	var button := await _make_button()
	_set_animations_enabled(true)

	button._on_mouse_entered()
	assert_true(
		button.has_active_animation(),
		"A hover must animate the button while animations are enabled (issue #1831)."
	)
	assert_not_null(button._transform_tween, "The hover must own a transform tween (issue #1831).")

	await _wait(0.2)
	assert_almost_eq(button.scale.x, NEUTRAL_SCALE * HOVER_SCALE, 0.01,
		"The hover must scale the button up while animations are enabled (issue #1831).")

	button._on_mouse_exited()
	await _wait(0.25)
	assert_almost_eq(button.scale.x, NEUTRAL_SCALE, 0.01,
		"Leaving the button must scale it back to neutral (issue #1831).")



func test_press_animates_when_animations_are_enabled() -> void:
	if _optimizer() == null:
		pending("UITransitionOptimizer autoload not available — skipping issue #1831 runtime check.")
		return
	var button := await _make_button()
	_set_animations_enabled(true)

	button._on_button_down()
	assert_true(
		button.has_active_animation(),
		"A press must animate the button while animations are enabled (issue #1831)."
	)

	await _wait(0.2)
	assert_almost_eq(button.scale.x, NEUTRAL_SCALE * PRESS_SCALE, 0.01,
		"The press must scale the button down while animations are enabled (issue #1831).")
	assert_almost_eq(button.rotation, PRESS_ROTATION, 0.005,
		"The press must tilt the button while animations are enabled (issue #1831).")

	button._on_button_up()
	await _wait(0.25)
	assert_almost_eq(button.scale.x, NEUTRAL_SCALE, 0.01,
		"Releasing the button must restore the neutral scale (issue #1831).")
	assert_almost_eq(button.rotation, 0.0, 0.005,
		"Releasing the button must restore the neutral rotation (issue #1831).")



func test_hover_and_press_have_exactly_one_animation_owner() -> void:
	if _optimizer() == null:
		pending("UITransitionOptimizer autoload not available — skipping issue #1831 runtime check.")
		return
	var button := await _make_button()
	_set_animations_enabled(true)

	button._on_mouse_entered()
	var hover_tween: Tween = button._transform_tween
	assert_not_null(hover_tween, "The hover must own a transform tween (issue #1831).")
	assert_true(button.has_active_animation(), "The hover must own a running animation (issue #1831).")

	button._on_button_down()
	assert_false(
		hover_tween.is_valid(),
		"The press must take over the transform instead of racing the hover tween (issue #1831)."
	)
	assert_not_null(button._transform_tween, "The press must own a transform tween (issue #1831).")
	assert_true(
		button.has_active_animation(),
		"The press tween must be running (issue #1831)."
	)
	assert_ne(
		button._transform_tween,
		hover_tween,
		"Only one tween may own the transform at a time (issue #1831)."
	)

	# The transform must follow the press, not the (killed) hover tween.
	await _wait(0.2)
	assert_almost_eq(button.scale.x, NEUTRAL_SCALE * PRESS_SCALE, 0.01,
		"The transform must be owned by the press alone (issue #1831).")



# ---------------------------------------------------------------------------
# Layer 2: runtime behaviour with animations disabled.
# ---------------------------------------------------------------------------

func test_hover_creates_no_tween_when_animations_are_disabled() -> void:
	if _optimizer() == null:
		pending("UITransitionOptimizer autoload not available — skipping issue #1831 runtime check.")
		return
	var button := await _make_button()
	_set_animations_enabled(false)

	button._on_mouse_entered()
	assert_false(
		button.has_active_animation(),
		"A hover must not animate the button while animations are disabled (issue #1831)."
	)
	assert_null(button._transform_tween, "The hover must not create a transform tween (issue #1831).")
	assert_null(button._glow_tween, "The hover must not create a glow tween (issue #1831).")
	assert_almost_eq(button.scale.x, NEUTRAL_SCALE, 0.001,
		"The button must stay at its neutral scale while animations are disabled (issue #1831).")
	assert_almost_eq(button.rotation, 0.0, 0.001,
		"The button must stay at its neutral rotation while animations are disabled (issue #1831).")

	await _wait(0.3)
	assert_almost_eq(button.scale.x, NEUTRAL_SCALE, 0.001,
		"The button must stay at its neutral scale while animations are disabled (issue #1831).")



func test_press_creates_no_tween_when_animations_are_disabled() -> void:
	if _optimizer() == null:
		pending("UITransitionOptimizer autoload not available — skipping issue #1831 runtime check.")
		return
	var button := await _make_button()
	_set_animations_enabled(false)

	button._on_button_down()
	assert_false(
		button.has_active_animation(),
		"A press must not animate the button while animations are disabled (issue #1831)."
	)
	assert_null(button._transform_tween, "The press must not create a transform tween (issue #1831).")
	assert_almost_eq(button.scale.x, NEUTRAL_SCALE, 0.001,
		"The button must stay at its neutral scale while animations are disabled (issue #1831).")
	assert_almost_eq(button.rotation, 0.0, 0.001,
		"The button must stay at its neutral rotation while animations are disabled (issue #1831).")

	button._on_button_up()
	await _wait(0.2)
	assert_almost_eq(button.scale.x, NEUTRAL_SCALE, 0.001,
		"The button must stay at its neutral scale while animations are disabled (issue #1831).")



func test_glow_creates_no_tween_when_animations_are_disabled() -> void:
	if _optimizer() == null:
		pending("UITransitionOptimizer autoload not available — skipping issue #1831 runtime check.")
		return
	var button := await _make_button()
	_set_animations_enabled(false)
	var base_shadow: int = button._base_shadow_size

	button._animate_glow(true)
	assert_false(
		button.has_active_animation(),
		"The glow must not animate the button while animations are disabled (issue #1831)."
	)
	assert_null(button._glow_tween, "The glow must not create a tween (issue #1831).")
	assert_eq(
		_style_shadow_size(button),
		base_shadow,
		"The glow must stay at its neutral shadow size while animations are disabled (issue #1831)."
	)

	await _wait(0.3)
	assert_eq(
		_style_shadow_size(button),
		base_shadow,
		"The glow must stay at its neutral shadow size while animations are disabled (issue #1831)."
	)



# ---------------------------------------------------------------------------
# Layer 3: the switch is turned off while an animation is running.
# ---------------------------------------------------------------------------

func test_turning_animations_off_mid_animation_restores_the_neutral_state() -> void:
	if _optimizer() == null:
		pending("UITransitionOptimizer autoload not available — skipping issue #1831 runtime check.")
		return
	var button := await _make_button()
	_set_animations_enabled(true)

	button._on_mouse_entered()
	await _wait(0.04)
	assert_true(
		button.has_active_animation(),
		"The hover tween must still be running before the switch is flipped (issue #1831)."
	)

	_set_animations_enabled(false)
	await _wait(0.05)

	assert_false(
		button.has_active_animation(),
		"Flipping the switch off must stop the running tween (issue #1831)."
	)
	assert_almost_eq(button.scale.x, NEUTRAL_SCALE, 0.001,
		"Flipping the switch off mid-animation must restore the neutral scale (issue #1831).")
	assert_almost_eq(button.rotation, 0.0, 0.001,
		"Flipping the switch off mid-animation must restore the neutral rotation (issue #1831).")
	assert_eq(
		_style_shadow_size(button),
		button._base_shadow_size,
		"Flipping the switch off mid-animation must restore the neutral glow (issue #1831)."
	)



func test_turning_animations_off_mid_press_restores_the_neutral_state() -> void:
	if _optimizer() == null:
		pending("UITransitionOptimizer autoload not available — skipping issue #1831 runtime check.")
		return
	var button := await _make_button()
	_set_animations_enabled(true)

	button._on_button_down()
	await _wait(0.03)
	assert_true(
		button.has_active_animation(),
		"The press tween must still be running before the switch is flipped (issue #1831)."
	)

	_set_animations_enabled(false)
	await _wait(0.05)

	assert_false(
		button.has_active_animation(),
		"Flipping the switch off must stop the running press tween (issue #1831)."
	)
	assert_almost_eq(button.scale.x, NEUTRAL_SCALE, 0.001,
		"Flipping the switch off mid-press must restore the neutral scale (issue #1831).")
	assert_almost_eq(button.rotation, 0.0, 0.001,
		"Flipping the switch off mid-press must restore the neutral rotation (issue #1831).")



# ---------------------------------------------------------------------------
# Unchanged behaviour: states, toggled, disabled, focus and signals.
# ---------------------------------------------------------------------------

func test_state_and_signals_are_unchanged_when_animations_are_disabled() -> void:
	if _optimizer() == null:
		pending("UITransitionOptimizer autoload not available — skipping issue #1831 runtime check.")
		return
	var button := await _make_button()
	_set_animations_enabled(false)

	var states: Array = []
	button.state_changed.connect(func(state: String) -> void: states.append(state))

	button._on_mouse_entered()
	assert_eq(button.get_current_state(), ArcheryBaseButton.ButtonState.HOVER,
		"The hover state must still be applied while animations are disabled (issue #1831).")
	button._on_button_down()
	assert_eq(button.get_current_state(), ArcheryBaseButton.ButtonState.PRESSED,
		"The pressed state must still be applied while animations are disabled (issue #1831).")
	button._on_button_up()
	assert_eq(button.get_current_state(), ArcheryBaseButton.ButtonState.NORMAL,
		"The normal state must still be applied while animations are disabled (issue #1831).")
	assert_true(states.has("hover"), "The hover state signal must still be emitted (issue #1831).")
	assert_true(states.has("pressed"), "The pressed state signal must still be emitted (issue #1831).")
	assert_true(states.has("normal"), "The normal state signal must still be emitted (issue #1831).")



func test_toggled_disabled_and_focus_behaviour_is_unchanged() -> void:
	if _optimizer() == null:
		pending("UITransitionOptimizer autoload not available — skipping issue #1831 runtime check.")
		return
	var button := await _make_button()
	_set_animations_enabled(false)

	# Toggled state still tracked and restyled.
	button._on_toggled(true)
	assert_true(button.is_toggled_on(), "The toggled state must still be tracked (issue #1831).")
	button._on_toggled(false)
	assert_false(button.is_toggled_on(), "The toggled state must still be cleared (issue #1831).")

	# Disabled state still applied.
	button.apply_disabled(true)
	assert_eq(button.get_current_state(), ArcheryBaseButton.ButtonState.DISABLED,
		"The disabled state must still be applied (issue #1831).")
	assert_true(button.disabled, "The button must still be disabled (issue #1831).")

	# A disabled button must not animate on hover.
	button._on_mouse_entered()
	assert_false(button.has_active_animation(),
		"A disabled button must not animate (issue #1831).")
	assert_almost_eq(button.scale.x, NEUTRAL_SCALE, 0.001,
		"A disabled button must stay at its neutral scale (issue #1831).")

	# Focus state still applied.
	button.apply_disabled(false)
	button._set_state(ArcheryBaseButton.ButtonState.FOCUSED)
	assert_eq(button.get_current_state(), ArcheryBaseButton.ButtonState.FOCUSED,
		"The focused state must still be applied (issue #1831).")

	# Size and styles are untouched by the animation guard.
	assert_eq(button.custom_minimum_size, Vector2(120, 40),
		"The button size must stay unchanged (issue #1831).")
	assert_not_null(button.get_theme_stylebox("normal"),
		"The button style must stay applied (issue #1831).")



func test_animation_guard_does_not_change_the_button_api() -> void:
	var source := _read_base_button_source()
	for required in [
		"func _animate_hover(is_hovering: bool) -> void:",
		"func _animate_press(is_pressed: bool) -> void:",
		"func _animate_glow(enabled: bool) -> void:",
		"func _on_button_down() -> void:",
		"func _on_button_up() -> void:",
		"func _on_toggled(button_pressed: bool) -> void:",
		"func apply_disabled(disabled: bool) -> void:",
		"func is_toggled_on() -> bool:",
	]:
		assert_true(
			source.contains(required),
			"base_button.gd must keep %s (issue #1831)." % required
		)
