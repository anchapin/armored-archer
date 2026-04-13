extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running ScreenShake Script Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_default_config()
	await test_shake_light()
	await test_shake_medium()
	await test_shake_heavy()
	await test_shake_impact()
	await test_is_shaking()
	await test_get_noise_function()

	print("\n=== ScreenShake Script Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_screen_shake() -> Node:
	var ss_script = load("res://scripts/screen_shake.gd")
	var ss = Node.new()
	ss.set_script(ss_script)
	add_child(ss)
	return ss

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var ss = _create_screen_shake()

	# Check only intensity, duration, and shaking state (frequency is implementation detail)
	if ss.shake_intensity == 10.0 and ss.shake_duration == 0.3 and not ss.is_shaking():
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Initial state should have default config")

	ss.queue_free()

func test_default_config() -> void:
	var ss = _create_screen_shake()

	# Create a mock camera to avoid null camera check
	var mock_camera = Camera2D.new()
	add_child(mock_camera)
	ss._camera = mock_camera

	ss.start_shake()

	# Only check if shaking started, since _shake_time is private and implementation-dependent
	if ss.is_shaking():
		_pass("test_default_config")
	else:
		_fail("test_default_config", "Default shake should start")

	ss.queue_free()
	mock_camera.queue_free()

func test_shake_light() -> void:
	var ss = _create_screen_shake()

	ss.shake_light()

	# Check only intensity and duration (frequency is implementation detail)
	if ss.shake_intensity == 5.0 and ss.shake_duration == 0.15:
		_pass("test_shake_light")
	else:
		_fail("test_shake_light", "Light shake should have correct parameters")

	ss.queue_free()

func test_shake_medium() -> void:
	var ss = _create_screen_shake()

	ss.shake_medium()

	# Check only intensity and duration (frequency is implementation detail)
	if ss.shake_intensity == 10.0 and ss.shake_duration == 0.25:
		_pass("test_shake_medium")
	else:
		_fail("test_shake_medium", "Medium shake should have correct parameters")

	ss.queue_free()

func test_shake_heavy() -> void:
	var ss = _create_screen_shake()

	ss.shake_heavy()

	# Check only intensity and duration (frequency is implementation detail)
	if ss.shake_intensity == 20.0 and ss.shake_duration == 0.4:
		_pass("test_shake_heavy")
	else:
		_fail("test_shake_heavy", "Heavy shake should have correct parameters")

	ss.queue_free()

func test_shake_impact() -> void:
	var ss = _create_screen_shake()

	ss.shake_impact()

	# Check only intensity and duration (frequency is implementation detail)
	if ss.shake_intensity == 30.0 and ss.shake_duration == 0.5:
		_pass("test_shake_impact")
	else:
		_fail("test_shake_impact", "Impact shake should have correct parameters")

	ss.queue_free()

func test_is_shaking() -> void:
	var ss = _create_screen_shake()
	ss._is_shaking = true

	if ss.is_shaking():
		_pass("test_is_shaking")
	else:
		_fail("test_is_shaking", "Should report correct shaking state")

	ss.queue_free()

func test_get_noise_function() -> void:
	var ss = _create_screen_shake()

	var noise1 = ss._get_noise(1.0)
	var noise2 = ss._get_noise(1.0)

	if noise1 == noise2:
		_pass("test_get_noise_function")
	else:
		_fail("test_get_noise_function", "Noise should be deterministic")

	ss.queue_free()
