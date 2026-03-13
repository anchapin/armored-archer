extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running UITransitionOptimizer Tests ===\n")
	await run_tests()

func run_tests() -> void:
	test_initial_state()
	test_get_transition_duration()
	test_is_fade_enabled()
	test_is_ui_animation_enabled()
	test_is_particle_effects_enabled()
	test_set_transition_speed()
	test_refresh_optimizations()
	test_transition_speed_boundaries()

	print("\n=== UITransitionOptimizer Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_optimizer() -> Node:
	var opt = load("res://autoloads/UITransitionOptimizer.gd").new()
	add_child(opt)
	return opt

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var opt = _create_optimizer()

	# Default transition duration is 0.3
	if opt._transition_duration == 0.3:
		_pass("test_initial_duration")
	else:
		_fail("test_initial_duration", "Default duration should be 0.3")

	if opt._fade_enabled == true:
		_pass("test_initial_fade_enabled")
	else:
		_fail("test_initial_fade_enabled", "Fade should be enabled by default")

	if opt._ui_animation_enabled == true:
		_pass("test_initial_ui_animation")
	else:
		_fail("test_initial_ui_animation", "UI animation should be enabled")

	opt.queue_free()

func test_get_transition_duration() -> void:
	var opt = _create_optimizer()

	var duration = opt.get_transition_duration()

	if duration > 0:
		_pass("test_get_transition_duration")
	else:
		_fail("test_get_transition_duration", "Duration should be positive")

	opt.queue_free()

func test_is_fade_enabled() -> void:
	var opt = _create_optimizer()

	var enabled = opt.is_fade_enabled()

	if enabled == true:
		_pass("test_is_fade_enabled")
	else:
		_fail("test_is_fade_enabled", "Fade should be enabled")

	opt.queue_free()

func test_is_ui_animation_enabled() -> void:
	var opt = _create_optimizer()

	var enabled = opt.is_ui_animation_enabled()

	if enabled == true:
		_pass("test_is_ui_animation_enabled")
	else:
		_fail("test_is_ui_animation_enabled", "UI animation should be enabled")

	opt.queue_free()

func test_is_particle_effects_enabled() -> void:
	var opt = _create_optimizer()

	var enabled = opt.is_particle_effects_enabled()

	if enabled == true:
		_pass("test_is_particle_effects_enabled")
	else:
		_fail("test_is_particle_effects_enabled", "Particle effects should be enabled")

	opt.queue_free()

func test_set_transition_speed() -> void:
	var opt = _create_optimizer()

	opt.set_transition_speed(2.0)

	if opt._transition_duration < 0.3:
		_pass("test_set_transition_speed_faster")
	else:
		_fail("test_set_transition_speed_faster", "Duration should decrease with higher speed")

	opt.queue_free()

func test_transition_speed_boundaries() -> void:
	var opt = _create_optimizer()

	# Test very high multiplier
	opt.set_transition_speed(100.0)
	if opt._transition_duration >= 0.05:
		_pass("test_transition_speed_max_boundary")
	else:
		_fail("test_transition_speed_max_boundary", "Duration should not go below minimum")

	# Test very low multiplier
	opt.set_transition_speed(0.1)
	if opt._transition_duration <= 1.0:
		_pass("test_transition_speed_min_boundary")
	else:
		_fail("test_transition_speed_min_boundary", "Duration should not exceed maximum")

	opt.queue_free()

func test_refresh_optimizations() -> void:
	var opt = _create_optimizer()

	# Just verify it runs without error
	opt.refresh_optimizations()

	_pass("test_refresh_optimizations")

	opt.queue_free()
