extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running CharacterBody2D Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_default_stats()
	await test_aim_direction_initial()
	await test_get_aim_direction()
	await test_is_player_aiming_initial()
	await test_signals_exist()
	await test_movement_state_changes()
	await test_aim_direction_update()

	print("\n=== CharacterBody2D Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_character() -> CharacterBody2DScript:
	var script = load("res://scripts/character_body_2d.gd")
	var char = CharacterBody2D.new()
	char.set_script(script)
	char.name = "TestCharacter"
	add_child(char)
	await get_tree().process_frame
	return char

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var char = await _create_character()

	if char.is_moving == false:
		_pass("test_initial_not_moving")
	else:
		_fail("test_initial_not_moving", "Character should not be moving initially")

	if char.is_aiming == false:
		_pass("test_initial_not_aiming")
	else:
		_fail("test_initial_not_aiming", "Character should not be aiming initially")

	char.queue_free()

func test_default_stats() -> void:
	var char = await _create_character()

	if char.move_speed == 200.0:
		_pass("test_default_move_speed")
	else:
		_fail("test_default_move_speed", "Default move_speed should be 200.0")

	if char.acceleration == 800.0:
		_pass("test_default_acceleration")
	else:
		_fail("test_default_acceleration", "Default acceleration should be 800.0")

	if char.friction == 1000.0:
		_pass("test_default_friction")
	else:
		_fail("test_default_friction", "Default friction should be 1000.0")

	char.queue_free()

func test_aim_direction_initial() -> void:
	var char = await _create_character()

	if char.aim_direction == Vector2.RIGHT:
		_pass("test_initial_aim_direction")
	else:
		_fail("test_initial_aim_direction", "Initial aim direction should be Vector2.RIGHT")

	char.queue_free()

func test_get_aim_direction() -> void:
	var char = await _create_character()

	var aim = char.get_aim_direction()

	if aim == Vector2.RIGHT:
		_pass("test_get_aim_direction")
	else:
		_fail("test_get_aim_direction", "get_aim_direction should return Vector2.RIGHT initially")

	char.queue_free()

func test_is_player_aiming_initial() -> void:
	var char = await _create_character()

	if char.is_player_aiming() == false:
		_pass("test_is_player_aiming_initial")
	else:
		_fail("test_is_player_aiming_initial", "is_player_aiming should return false initially")

	char.queue_free()

func test_signals_exist() -> void:
	var char = await _create_character()

	if char.has_signal("movement_started"):
		_pass("test_has_movement_started_signal")
	else:
		_fail("test_has_movement_started_signal", "Should have movement_started signal")

	if char.has_signal("movement_stopped"):
		_pass("test_has_movement_stopped_signal")
	else:
		_fail("test_has_movement_stopped_signal", "Should have movement_stopped signal")

	if char.has_signal("aim_direction_changed"):
		_pass("test_has_aim_direction_changed_signal")
	else:
		_fail("test_has_aim_direction_changed_signal", "Should have aim_direction_changed signal")

	char.queue_free()

func test_movement_state_changes() -> void:
	var char = await _create_character()

	var movement_started_emitted = false
	var movement_stopped_emitted = false

	char.movement_started.connect(func(): movement_started_emitted = true)
	char.movement_stopped.connect(func(): movement_stopped_emitted = true)

	if not movement_started_emitted and not movement_stopped_emitted:
		_pass("test_no_movement_signals_initially")
	else:
		_fail("test_no_movement_signals_initially", "No movement signals should fire initially")

	char.queue_free()

func test_aim_direction_update() -> void:
	var char = await _create_character()

	var aim_changed_emitted = false
	var emitted_direction = Vector2.ZERO

	char.aim_direction_changed.connect(func(dir: Vector2):
		aim_changed_emitted = true
		emitted_direction = dir
	)

	char.aim_direction = Vector2.UP
	char._update_aim_direction(0.016)

	if char.aim_direction == Vector2.UP:
		_pass("test_aim_direction_set")
	else:
		_fail("test_aim_direction_set", "Aim direction should be updated")

	char.queue_free()
