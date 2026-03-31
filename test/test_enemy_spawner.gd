extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running EnemySpawner Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_default_exported_values()
	await test_wave_count_calculation()
	await test_start_next_wave_increments()
	await test_start_next_wave_enemy_count()
	await test_max_waves_reached()
	await test_spawn_area_default()
	await test_get_random_spawn_position_bounds()
	await test_active_enemies_initially_empty()
	await test_is_spawning_default_false()
	await test_current_wave_default_zero()
	await test_boss_id_default_empty()
	await test_signal_connections_array_exists()
	await test_spawn_position_within_area()

	print("\n=== EnemySpawner Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

const ENEMY_SPAWNER_SCRIPT = preload("res://scenes/enemies/enemy_spawner.gd")

func _create_spawner() -> Node2D:
	var spawner = Node2D.new()
	spawner.set_script(ENEMY_SPAWNER_SCRIPT)
	add_child(spawner)
	return spawner

func _create_spawner_before_ready() -> Node2D:
	var spawner = Node2D.new()
	spawner.set_script(ENEMY_SPAWNER_SCRIPT)
	return spawner

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_default_exported_values() -> void:
	var spawner = _create_spawner()
	var passed = (
		spawner.time_between_waves == 5.0 and
		spawner.time_between_enemies == 0.5 and
		spawner.base_enemy_count == 3 and
		spawner.enemy_count_increment == 1 and
		spawner.max_waves == 3
	)
	if passed:
		_pass("test_default_exported_values")
	else:
		_fail("test_default_exported_values", "Default values incorrect")
	spawner.queue_free()

func test_wave_count_calculation() -> void:
	var spawner = _create_spawner()
	spawner.base_enemy_count = 3
	spawner.enemy_count_increment = 2
	spawner.max_waves = 5

	# Wave 1: 3 + (1-1)*2 = 3
	spawner.current_wave = 0
	spawner.start_next_wave()
	if spawner.enemies_to_spawn == 3:
		_pass("test_wave_count_calculation_wave1")
	else:
		_fail("test_wave_count_calculation_wave1", "Wave 1 should have 3 enemies (got %d)" % spawner.enemies_to_spawn)

	spawner.queue_free()

func test_start_next_wave_increments() -> void:
	var spawner = _create_spawner()
	spawner.max_waves = 5
	spawner.current_wave = 0

	spawner.start_next_wave()
	if spawner.current_wave == 1:
		_pass("test_start_next_wave_increments")
	else:
		_fail("test_start_next_wave_increments", "current_wave should be 1 after start_next_wave (got %d)" % spawner.current_wave)
	spawner.queue_free()

func test_start_next_wave_enemy_count() -> void:
	var spawner = _create_spawner()
	spawner.base_enemy_count = 5
	spawner.enemy_count_increment = 3
	spawner.max_waves = 5

	spawner.start_next_wave()  # wave 1: 5 + 0*3 = 5
	if spawner.enemies_to_spawn == 5:
		_pass("test_start_next_wave_enemy_count")
	else:
		_fail("test_start_next_wave_enemy_count", "Wave 1 should spawn 5 enemies (got %d)" % spawner.enemies_to_spawn)

	# Don't check subsequent waves since they depend on timer nodes that aren't present
	spawner.queue_free()

func test_max_waves_reached() -> void:
	var spawner = _create_spawner()
	spawner.max_waves = 2
	spawner.current_wave = 2
	spawner.boss_id = ""  # No boss

	# At max waves with no boss, should return without spawning
	spawner.start_next_wave()
	if spawner.current_wave == 2:
		_pass("test_max_waves_reached")
	else:
		_fail("test_max_waves_reached", "current_wave should not increment past max_waves")
	spawner.queue_free()

func test_spawn_area_default() -> void:
	var spawner = _create_spawner()
	var area = spawner.spawn_area
	if area.position.x == -400 and area.position.y == -300 and area.size.x == 800 and area.size.y == 600:
		_pass("test_spawn_area_default")
	else:
		_fail("test_spawn_area_default", "Default spawn area should be Rect2(-400, -300, 800, 600)")
	spawner.queue_free()

func test_get_random_spawn_position_bounds() -> void:
	var spawner = _create_spawner()
	spawner.global_position = Vector2.ZERO

	# Run multiple times to verify positions are within bounds
	var all_valid = true
	for i in range(20):
		var pos = spawner.get_random_spawn_position()
		if pos.x < -400 or pos.x > 400 or pos.y < -300 or pos.y > 300:
			all_valid = false
			break

	if all_valid:
		_pass("test_get_random_spawn_position_bounds")
	else:
		_fail("test_get_random_spawn_position_bounds", "Spawn positions should be within spawn area bounds")
	spawner.queue_free()

func test_active_enemies_initially_empty() -> void:
	var spawner = _create_spawner()
	if spawner.active_enemies.is_empty():
		_pass("test_active_enemies_initially_empty")
	else:
		_fail("test_active_enemies_initially_empty", "active_enemies should be empty initially")
	spawner.queue_free()

func test_is_spawning_default_false() -> void:
	var spawner = _create_spawner_before_ready()
	if spawner.is_spawning == false:
		_pass("test_is_spawning_default_false")
	else:
		_fail("test_is_spawning_default_false", "is_spawning should default to false")
	spawner.free()

func test_current_wave_default_zero() -> void:
	var spawner = _create_spawner_before_ready()
	if spawner.current_wave == 0:
		_pass("test_current_wave_default_zero")
	else:
		_fail("test_current_wave_default_zero", "current_wave should default to 0")
	spawner.free()

func test_boss_id_default_empty() -> void:
	var spawner = _create_spawner_before_ready()
	if spawner.boss_id == "":
		_pass("test_boss_id_default_empty")
	else:
		_fail("test_boss_id_default_empty", "boss_id should default to empty string")
	spawner.free()

func test_signal_connections_array_exists() -> void:
	var spawner = _create_spawner()
	if spawner._signal_connections is Array:
		_pass("test_signal_connections_array_exists")
	else:
		_fail("test_signal_connections_array_exists", "_signal_connections should be an Array")
	spawner.queue_free()

func test_spawn_position_within_area() -> void:
	var spawner = _create_spawner()
	spawner.global_position = Vector2(100, 100)
	spawner.spawn_area = Rect2(-50, -50, 100, 100)

	var all_valid = true
	for i in range(50):
		var pos = spawner.get_random_spawn_position()
		if pos.x < 50 or pos.x > 150 or pos.y < 50 or pos.y > 150:
			all_valid = false
			break

	if all_valid:
		_pass("test_spawn_position_within_area")
	else:
		_fail("test_spawn_position_within_area", "Spawn positions should be offset by global_position")
	spawner.queue_free()
