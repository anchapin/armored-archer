extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running AutoAimManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	test_initial_state()
	test_constants()
	test_register_enemy()
	test_unregister_enemy()
	test_get_best_target_no_enemies()
	test_get_best_target_out_of_range()
	test_get_best_target_out_of_angle()
	test_get_best_target_valid()
	test_get_best_target_closest_selected()
	test_get_best_target_zero_direction()
	test_get_target_position()
	test_is_target_locked()
	test_enemy_removal_invalid()

	print("\n=== AutoAimManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_auto_aim_manager() -> Node:
	var aim = load("res://autoloads/AutoAimManager.gd").new()
	add_child(aim)
	return aim

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var aim = _create_auto_aim_manager()

	if aim.registered_enemies.is_empty():
		_pass("test_initial_state_empty")
	else:
		_fail("test_initial_state_empty", "Initial enemies should be empty")

	if aim._cache_valid == false:
		_pass("test_initial_cache_invalid")
	else:
		_fail("test_initial_cache_invalid", "Cache should initially be invalid")

	aim.queue_free()

func test_constants() -> void:
	var aim = _create_auto_aim_manager()

	if aim.AIM_RANGE == 500.0:
		_pass("test_aim_range_constant")
	else:
		_fail("test_aim_range_constant", "AIM_RANGE should be 500.0")

	if aim.AIM_RANGE_SQUARED == 250000.0:
		_pass("test_aim_range_squared_constant")
	else:
		_fail("test_aim_range_squared_constant", "AIM_RANGE_SQUARED should be 250000.0")

	if abs(aim.MAX_AIM_ANGLE - 0.785398) < 0.001:  # pi/4
		_pass("test_max_aim_angle_constant")
	else:
		_fail("test_max_aim_angle_constant", "MAX_AIM_ANGLE should be pi/4")

	aim.queue_free()

func test_register_enemy() -> void:
	var aim = _create_auto_aim_manager()
	var enemy = Node2D.new()
	enemy.name = "TestEnemy"
	add_child(enemy)

	aim.register_enemy(enemy)

	if aim.registered_enemies.size() == 1:
		_pass("test_register_enemy")
	else:
		_fail("test_register_enemy", "Enemy should be registered")

	# Test duplicate registration is ignored
	aim.register_enemy(enemy)
	if aim.registered_enemies.size() == 1:
		_pass("test_register_duplicate_ignored")
	else:
		_fail("test_register_duplicate_ignored", "Duplicate should be ignored")

	enemy.queue_free()
	aim.queue_free()

func test_unregister_enemy() -> void:
	var aim = _create_auto_aim_manager()
	var enemy = Node2D.new()
	enemy.name = "TestEnemy"
	add_child(enemy)

	aim.register_enemy(enemy)
	aim.unregister_enemy(enemy)

	if aim.registered_enemies.is_empty():
		_pass("test_unregister_enemy")
	else:
		_fail("test_unregister_enemy", "Enemy should be unregistered")

	# Test unregistering non-existent enemy doesn't crash
	aim.unregister_enemy(enemy)
	_pass("test_unregister_nonexistent_safe")

	enemy.queue_free()
	aim.queue_free()

func test_get_best_target_no_enemies() -> void:
	var aim = _create_auto_aim_manager()
	var result = aim.get_best_target(Vector2.ZERO, Vector2.RIGHT)

	if result == null:
		_pass("test_get_best_target_no_enemies")
	else:
		_fail("test_get_best_target_no_enemies", "Should return null with no enemies")

	aim.queue_free()

func test_get_best_target_zero_direction() -> void:
	var aim = _create_auto_aim_manager()
	var enemy = Node2D.new()
	enemy.position = Vector2(100, 0)
	add_child(enemy)
	aim.register_enemy(enemy)

	var result = aim.get_best_target(Vector2.ZERO, Vector2.ZERO)

	if result == null:
		_pass("test_get_best_target_zero_direction")
	else:
		_fail("test_get_best_target_zero_direction", "Should return null with zero direction")

	enemy.queue_free()
	aim.queue_free()

func test_get_best_target_out_of_range() -> void:
	var aim = _create_auto_aim_manager()
	var enemy = Node2D.new()
	enemy.position = Vector2(1000, 0)  # Beyond 500 range
	add_child(enemy)
	aim.register_enemy(enemy)

	var result = aim.get_best_target(Vector2.ZERO, Vector2.RIGHT)

	if result == null:
		_pass("test_get_best_target_out_of_range")
	else:
		_fail("test_get_best_target_out_of_range", "Should return null for out of range")

	enemy.queue_free()
	aim.queue_free()

func test_get_best_target_out_of_angle() -> void:
	var aim = _create_auto_aim_manager()
	var enemy = Node2D.new()
	enemy.position = Vector2(100, 100)  # 45 degrees, at the edge
	add_child(enemy)
	aim.register_enemy(enemy)

	# Aim direction is 90 degrees (up), enemy is at 45 degrees
	var result = aim.get_best_target(Vector2.ZERO, Vector2.UP)

	if result == null:
		_pass("test_get_best_target_out_of_angle")
	else:
		_fail("test_get_best_target_out_of_angle", "Should return null for out of angle")

	enemy.queue_free()
	aim.queue_free()

func test_get_best_target_valid() -> void:
	var aim = _create_auto_aim_manager()
	var enemy = Node2D.new()
	enemy.position = Vector2(100, 0)  # 100 units right
	add_child(enemy)
	aim.register_enemy(enemy)

	var result = aim.get_best_target(Vector2.ZERO, Vector2.RIGHT)

	if result == enemy:
		_pass("test_get_best_target_valid")
	else:
		_fail("test_get_best_target_valid", "Should return the valid enemy")

	enemy.queue_free()
	aim.queue_free()

func test_get_best_target_closest_selected() -> void:
	var aim = _create_auto_aim_manager()
	var enemy1 = Node2D.new()
	enemy1.position = Vector2(200, 0)
	enemy1.name = "Enemy1"
	add_child(enemy1)

	var enemy2 = Node2D.new()
	enemy2.position = Vector2(100, 0)
	enemy2.name = "Enemy2"
	add_child(enemy2)

	aim.register_enemy(enemy1)
	aim.register_enemy(enemy2)

	var result = aim.get_best_target(Vector2.ZERO, Vector2.RIGHT)

	if result == enemy2:
		_pass("test_get_best_target_closest_selected")
	else:
		_fail("test_get_best_target_closest_selected", "Should return closest enemy")

	enemy1.queue_free()
	enemy2.queue_free()
	aim.queue_free()

func test_get_target_position() -> void:
	var aim = _create_auto_aim_manager()
	var enemy = Node2D.new()
	enemy.position = Vector2(100, 50)
	add_child(enemy)
	aim.register_enemy(enemy)

	var pos = aim.get_target_position(Vector2.ZERO, Vector2.RIGHT)

	if pos == Vector2(100, 50):
		_pass("test_get_target_position")
	else:
		_fail("test_get_target_position", "Should return enemy position")

	# Test with no target
	enemy.queue_free()
	pos = aim.get_target_position(Vector2.ZERO, Vector2.RIGHT)
	if pos == Vector2.ZERO:
		_pass("test_get_target_position_no_target")
	else:
		_fail("test_get_target_position_no_target", "Should return ZERO when no target")

	aim.queue_free()

func test_is_target_locked() -> void:
	var aim = _create_auto_aim_manager()
	var enemy = Node2D.new()
	enemy.position = Vector2(100, 0)
	add_child(enemy)
	aim.register_enemy(enemy)

	if aim.is_target_locked(Vector2.ZERO, Vector2.RIGHT):
		_pass("test_is_target_locked_true")
	else:
		_fail("test_is_target_locked_true", "Should return true when target locked")

	enemy.queue_free()

	if not aim.is_target_locked(Vector2.ZERO, Vector2.RIGHT):
		_pass("test_is_target_locked_false")
	else:
		_fail("test_is_target_locked_false", "Should return false when no target")

	aim.queue_free()

func test_enemy_removal_invalid() -> void:
	var aim = _create_auto_aim_manager()
	var enemy = Node2D.new()
	enemy.position = Vector2(100, 0)
	add_child(enemy)
	aim.register_enemy(enemy)

	enemy.queue_free()
	await get_tree().process_frame

	var result = aim.get_best_target(Vector2.ZERO, Vector2.RIGHT)

	if result == null:
		_pass("test_enemy_removal_invalid")
	else:
		_fail("test_enemy_removal_invalid", "Should handle invalid enemy gracefully")

	aim.queue_free()
