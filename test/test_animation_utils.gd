extends Node

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

	if tween != null and tween.get_loop_count() == -1:
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

	if ArcherDesignTokens.has("ANIM_DURATION_FAST"):
		_pass("test_design_tokens_anim_duration_fast")
	else:
		_fail("test_design_tokens_anim_duration_fast", "Should have ANIM_DURATION_FAST")

	if ArcherDesignTokens.has("ANIM_DURATION_NORMAL"):
		_pass("test_design_tokens_anim_duration_normal")
	else:
		_fail("test_design_tokens_anim_duration_normal", "Should have ANIM_DURATION_NORMAL")

	if ArcherDesignTokens.has("ANIM_DURATION_SLOW"):
		_pass("test_design_tokens_anim_duration_slow")
	else:
		_fail("test_design_tokens_anim_duration_slow", "Should have ANIM_DURATION_SLOW")

	node.queue_free()