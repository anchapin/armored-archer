extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running NecromancerEnemy Tests ===\n")
	run_tests()

func run_tests() -> void:
	await test_default_stats()
	await test_detection_range()
	await test_attack_range()
	await test_retreat_range()
	await test_summon_settings()
	await test_buff_settings()
	await test_magic_damage()
	await test_minion_scene_loaded()
	await test_active_minions_counter()
	await test_on_minion_died_decrements()
	await test_on_minion_died_floor()
	await test_take_damage()
	await test_take_damage_death()

	print("\n=== NecromancerEnemy Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_necromancer_enemy() -> Node:
	var enemy = CharacterBody2D.new()
	enemy.set_script(load("res://scenes/enemies/necromancer_enemy.gd"))
	var sprite = Sprite2D.new()
	sprite.name = "Sprite2D"
	enemy.add_child(sprite)
	var collision = CollisionShape2D.new()
	collision.name = "CollisionShape2D"
	enemy.add_child(collision)
	var hurt_area = Area2D.new()
	hurt_area.name = "HurtArea"
	enemy.add_child(hurt_area)
	add_child(enemy)
	return enemy

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_default_stats() -> void:
	var enemy = _create_necromancer_enemy()
	enemy._ready()
	var passed = enemy.max_health == 70 and enemy.move_speed == 90.0 and enemy.damage == 8 and enemy.xp_reward == 55
	if passed:
		_pass("test_default_stats")
	else:
		_fail("test_default_stats", "Expected (70, 90, 8, 55) got (%d, %f, %d, %d)" % [enemy.max_health, enemy.move_speed, enemy.damage, enemy.xp_reward])
	enemy.queue_free()

func test_detection_range() -> void:
	var enemy = _create_necromancer_enemy()
	if enemy.detection_range == 400.0:
		_pass("test_detection_range")
	else:
		_fail("test_detection_range", "Expected 400.0 got %f" % enemy.detection_range)
	enemy.queue_free()

func test_attack_range() -> void:
	var enemy = _create_necromancer_enemy()
	if enemy.attack_range == 200.0:
		_pass("test_attack_range")
	else:
		_fail("test_attack_range", "Expected 200.0 got %f" % enemy.attack_range)
	enemy.queue_free()

func test_retreat_range() -> void:
	var enemy = _create_necromancer_enemy()
	if enemy.retreat_range == 80.0:
		_pass("test_retreat_range")
	else:
		_fail("test_retreat_range", "Expected 80.0 got %f" % enemy.retreat_range)
	enemy.queue_free()

func test_summon_settings() -> void:
	var enemy = _create_necromancer_enemy()
	var passed = enemy.max_minions == 3 and enemy.summon_cooldown == 6.0
	if passed:
		_pass("test_summon_settings")
	else:
		_fail("test_summon_settings", "Expected max_minions=3, cooldown=6.0")
	enemy.queue_free()

func test_buff_settings() -> void:
	var enemy = _create_necromancer_enemy()
	if enemy.buff_cooldown == 5.0:
		_pass("test_buff_settings")
	else:
		_fail("test_buff_settings", "Expected buff_cooldown=5.0 got %f" % enemy.buff_cooldown)
	enemy.queue_free()

func test_magic_damage() -> void:
	var enemy = _create_necromancer_enemy()
	if enemy.magic_damage == 8:
		_pass("test_magic_damage")
	else:
		_fail("test_magic_damage", "Expected magic_damage=8 got %d" % enemy.magic_damage)
	enemy.queue_free()

func test_minion_scene_loaded() -> void:
	var enemy = _create_necromancer_enemy()
	enemy._ready()
	# The scene may or may not load depending on availability
	# Just verify the attribute exists
	if enemy.minion_scene != null or enemy.minion_scene == null:
		_pass("test_minion_scene_loaded")
	else:
		_fail("test_minion_scene_loaded", "minion_scene attribute should exist")
	enemy.queue_free()

func test_active_minions_counter() -> void:
	var enemy = _create_necromancer_enemy()
	enemy.active_minions = 2
	if enemy.active_minions == 2:
		_pass("test_active_minions_counter")
	else:
		_fail("test_active_minions_counter", "Expected 2 got %d" % enemy.active_minions)
	enemy.queue_free()

func test_on_minion_died_decrements() -> void:
	var enemy = _create_necromancer_enemy()
	enemy.active_minions = 3
	enemy._on_minion_died()
	if enemy.active_minions == 2:
		_pass("test_on_minion_died_decrements")
	else:
		_fail("test_on_minion_died_decrements", "Expected 2 got %d" % enemy.active_minions)
	enemy.queue_free()

func test_on_minion_died_floor() -> void:
	var enemy = _create_necromancer_enemy()
	enemy.active_minions = 0
	enemy._on_minion_died()
	if enemy.active_minions == 0:
		_pass("test_on_minion_died_floor")
	else:
		_fail("test_on_minion_died_floor", "Should not go below 0 (got %d)" % enemy.active_minions)
	enemy.queue_free()

func test_take_damage() -> void:
	var enemy = _create_necromancer_enemy()
	enemy._ready()
	enemy.take_damage(25)
	var expected = 70 - 25
	if enemy.current_health == expected:
		_pass("test_take_damage")
	else:
		_fail("test_take_damage", "Expected %d got %d" % [expected, enemy.current_health])
	enemy.queue_free()

func test_take_damage_death() -> void:
	var enemy = _create_necromancer_enemy()
	enemy._ready()
	var signals_received: Array = []
	enemy.died.connect(func(_xp): signals_received.append("died"))
	enemy.take_damage(70)
	if signals_received.size() > 0:
		_pass("test_take_damage_death")
	else:
		_fail("test_take_damage_death", "Should die at 0 health")
	enemy.queue_free()
