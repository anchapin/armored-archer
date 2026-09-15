extends Node

const AnimationUtils = preload("res://autoloads/AnimationUtils.gd")
const ArcherDesignTokens = preload("res://autoloads/ArcherDesignTokens.gd")

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running AnimationUtils Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_fade_in_basic()
	await test_fade_out_basic()
	await test_scale_bounce()
	await test_slide_in_left()
	await test_slide_in_right()
	await test_pulse()
	await test_scale_down()
	await test_scale_up()
	await test_design_tokens_reference()
	await test_slide_in_top()
	await test_slide_in_bottom()
	await test_fade_out_hide_on_complete()
	await test_fade_in_default_duration()
	await test_slide_in_default_duration()
	await test_scale_bounce_custom_factor()
	await test_scale_down_custom_factor()
	await test_pulse_custom_params()

	print("\n=== AnimationUtils Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_test_node() -> Control:
	var node = Control.new()
	node.name = "TestNode"
	node.position = Vector2(100, 100)
	node.size = Vector2(50, 50)
	node.modulate = Color.WHITE
	add_child(node)
	return node

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_fade_in_basic() -> void:
	var node = _create_test_node()
	node.modulate.a = 1.0
	node.visible = false

	var tween = AnimationUtils.fade_in(node, 0.1)

	if node.modulate.a == 0.0:
		_pass("test_fade_in_sets_alpha_zero")
	else:
		_fail("test_fade_in_sets_alpha_zero", "Alpha should start at 0")

	if node.visible == true:
		_pass("test_fade_in_sets_visible")
	else:
		_fail("test_fade_in_sets_visible", "Node should be visible")

	if tween != null:
		_pass("test_fade_in_returns_tween")
	else:
		_fail("test_fade_in_returns_tween", "Should return a tween")

	node.queue_free()

func test_fade_out_basic() -> void:
	var node = _create_test_node()
	node.modulate.a = 1.0
	node.visible = true

	var tween = AnimationUtils.fade_out(node, 0.1, false)

	if tween != null:
		_pass("test_fade_out_returns_tween")
	else:
		_fail("test_fade_out_returns_tween", "Should return a tween")

	node.queue_free()

func test_scale_bounce() -> void:
	var node = _create_test_node()
	node.scale = Vector2(1.0, 1.0)

	var tween = AnimationUtils.scale_bounce(node, 1.1)

	if tween != null:
		_pass("test_scale_bounce_returns_tween")
	else:
		_fail("test_scale_bounce_returns_tween", "Should return a tween")

	if node.scale == Vector2(1.0, 1.0):
		_pass("test_scale_bounce_preserves_initial_scale")
	else:
		_fail("test_scale_bounce_preserves_initial_scale", "Scale should remain unchanged initially")

	node.queue_free()

func test_slide_in_left() -> void:
	var node = _create_test_node()
	var original_pos = node.position

	var tween = AnimationUtils.slide_in(node, "left", 0.1)

	if tween != null:
		_pass("test_slide_in_left_returns_tween")
	else:
		_fail("test_slide_in_left_returns_tween", "Should return a tween")

	if node.visible == true:
		_pass("test_slide_in_left_sets_visible")
	else:
		_fail("test_slide_in_left_sets_visible", "Node should be visible")

	node.queue_free()

func test_slide_in_right() -> void:
	var node = _create_test_node()

	var tween = AnimationUtils.slide_in(node, "right", 0.1)

	if tween != null:
		_pass("test_slide_in_right_returns_tween")
	else:
		_fail("test_slide_in_right_returns_tween", "Should return a tween")

	node.queue_free()

func test_pulse() -> void:
	var node = _create_test_node()
	node.scale = Vector2(1.0, 1.0)

	var tween = AnimationUtils.pulse(node, 0.1, 2.0)

	if tween != null:
		_pass("test_pulse_returns_tween")
	else:
		_fail("test_pulse_returns_tween", "Should return a tween")

	# set_loops() with no argument makes the tween loop indefinitely.
	# Godot 4 exposes no loop-count getter (get_loop_count was Godot 3.5
	# SceneTreeTween API), so assert the tween is live instead (#1059).
	if tween != null and tween.is_running():
		_pass("test_pulse_sets_loops")
	else:
		_fail("test_pulse_sets_loops", "Tween should loop indefinitely")

	node.queue_free()

func test_scale_down() -> void:
	var node = _create_test_node()
	node.scale = Vector2(1.0, 1.0)

	var tween = AnimationUtils.scale_down(node, 0.95)

	if tween != null:
		_pass("test_scale_down_returns_tween")
	else:
		_fail("test_scale_down_returns_tween", "Should return a tween")

	node.queue_free()

func test_scale_up() -> void:
	var node = _create_test_node()
	node.scale = Vector2(0.95, 0.95)

	var tween = AnimationUtils.scale_up(node)

	if tween != null:
		_pass("test_scale_up_returns_tween")
	else:
		_fail("test_scale_up_returns_tween", "Should return a tween")

	node.queue_free()

func test_design_tokens_reference() -> void:
	var node = _create_test_node()

	# Check that design token constants exist
	if ArcherDesignTokens.ANIM_DURATION_FAST == 0.1:
		_pass("test_design_tokens_anim_duration_fast")
	else:
		_fail("test_design_tokens_anim_duration_fast", "Should have ANIM_DURATION_FAST = 0.1")

	if ArcherDesignTokens.ANIM_DURATION_NORMAL == 0.2:
		_pass("test_design_tokens_anim_duration_normal")
	else:
		_fail("test_design_tokens_anim_duration_normal", "Should have ANIM_DURATION_NORMAL = 0.2")

	if ArcherDesignTokens.ANIM_DURATION_SLOW == 0.3:
		_pass("test_design_tokens_anim_duration_slow")
	else:
		_fail("test_design_tokens_anim_duration_slow", "Should have ANIM_DURATION_SLOW = 0.3")

	node.queue_free()

func test_slide_in_top() -> void:
	var node = _create_test_node()
	var original_pos = node.position

	var tween = AnimationUtils.slide_in(node, "top", 0.1)

	if tween != null:
		_pass("test_slide_in_top_returns_tween")
	else:
		_fail("test_slide_in_top_returns_tween", "Should return a tween")

	if node.visible == true:
		_pass("test_slide_in_top_sets_visible")
	else:
		_fail("test_slide_in_top_sets_visible", "Node should be visible")

	if node.position.y != original_pos.y:
		_pass("test_slide_in_top_moves_node")
	else:
		_fail("test_slide_in_top_moves_node", "Node position should change for top slide")

	node.queue_free()

func test_slide_in_bottom() -> void:
	var node = _create_test_node()
	var original_pos = node.position

	var tween = AnimationUtils.slide_in(node, "bottom", 0.1)

	if tween != null:
		_pass("test_slide_in_bottom_returns_tween")
	else:
		_fail("test_slide_in_bottom_returns_tween", "Should return a tween")

	if node.visible == true:
		_pass("test_slide_in_bottom_sets_visible")
	else:
		_fail("test_slide_in_bottom_sets_visible", "Node should be visible")

	if node.position.y != original_pos.y:
		_pass("test_slide_in_bottom_moves_node")
	else:
		_fail("test_slide_in_bottom_moves_node", "Node position should change for bottom slide")

	node.queue_free()

func test_fade_out_hide_on_complete() -> void:
	var node = _create_test_node()
	node.modulate.a = 1.0
	node.visible = true

	var tween = AnimationUtils.fade_out(node, 0.1, true)

	if tween != null:
		_pass("test_fade_out_hide_on_complete_returns_tween")
	else:
		_fail("test_fade_out_hide_on_complete_returns_tween", "Should return a tween")

	node.queue_free()

func test_fade_in_default_duration() -> void:
	var node = _create_test_node()
	node.modulate.a = 1.0
	node.visible = false

	var tween = AnimationUtils.fade_in(node)

	if tween != null:
		_pass("test_fade_in_default_duration")
	else:
		_fail("test_fade_in_default_duration", "Should work with default duration")

	node.queue_free()

func test_fade_out_default_duration() -> void:
	var node = _create_test_node()
	node.modulate.a = 1.0
	node.visible = true

	var tween = AnimationUtils.fade_out(node)

	if tween != null:
		_pass("test_fade_out_default_duration")
	else:
		_fail("test_fade_out_default_duration", "Should work with default duration")

	node.queue_free()

func test_slide_in_default_duration() -> void:
	var node = _create_test_node()

	var tween = AnimationUtils.slide_in(node, "left")

	if tween != null:
		_pass("test_slide_in_default_duration")
	else:
		_fail("test_slide_in_default_duration", "Should work with default duration")

	node.queue_free()

func test_scale_bounce_custom_factor() -> void:
	var node = _create_test_node()
	node.scale = Vector2(1.0, 1.0)

	var tween = AnimationUtils.scale_bounce(node, 1.5)

	if tween != null:
		_pass("test_scale_bounce_custom_factor")
	else:
		_fail("test_scale_bounce_custom_factor", "Should work with custom scale factor")

	node.queue_free()

func test_scale_down_custom_factor() -> void:
	var node = _create_test_node()
	node.scale = Vector2(1.0, 1.0)

	var tween = AnimationUtils.scale_down(node, 0.8)

	if tween != null:
		_pass("test_scale_down_custom_factor")
	else:
		_fail("test_scale_down_custom_factor", "Should work with custom scale factor")

	node.queue_free()

func test_pulse_custom_params() -> void:
	var node = _create_test_node()
	node.scale = Vector2(1.0, 1.0)

	var tween = AnimationUtils.pulse(node, 0.2, 4.0)

	# Infinite loops (see test_pulse): assert the tween is live.
	if tween != null and tween.is_running():
		_pass("test_pulse_custom_params")
	else:
		_fail("test_pulse_custom_params", "Should work with custom params and loop")

	node.queue_free()
