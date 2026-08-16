extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running ScoutEnemy Tests ===\n")
	run_tests()

func run_tests() -> void:
	await test_default_stats()
	await test_detection_range()
	await test_attack_range()
	await test_attack_cooldown()
	await test_hit_and_run_settings()
	await test_take_damage()
	await test_take_damage_death()

	print("\n=== ScoutEnemy Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_scout_enemy() -> Node:
	var enemy = CharacterBody2D.new()
	enemy.set_script(load("res://scenes/enemies/scout_enemy.gd"))
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
	var enemy = _create_scout_enemy()
	enemy._ready()
	var passed = enemy.max_health == 40 and enemy.move_speed == 220.0 and enemy.damage == 8 and enemy.xp_reward == 20
	if passed:
		_pass("test_default_stats")
	else:
		_fail("test_default_stats", "Expected (40, 220, 8, 20) got (%d, %f, %d, %d)" % [enemy.max_health, enemy.move_speed, enemy.damage, enemy.xp_reward])
	enemy.queue_free()

func test_detection_range() -> void:
	var enemy = _create_scout_enemy()
	if enemy.detection_range == 350.0:
		_pass("test_detection_range")
	else:
		_fail("test_detection_range", "Expected 350.0 got %f" % enemy.detection_range)
	enemy.queue_free()

func test_attack_range() -> void:
	var enemy = _create_scout_enemy()
	if enemy.attack_range == 35.0:
		_pass("test_attack_range")
	else:
		_fail("test_attack_range", "Expected 35.0 got %f" % enemy.attack_range)
	enemy.queue_free()

func test_attack_cooldown() -> void:
	var enemy = _create_scout_enemy()
	if enemy.attack_cooldown == 0.8:
		_pass("test_attack_cooldown")
	else:
		_fail("test_attack_cooldown", "Expected 0.8 got %f" % enemy.attack_cooldown)
	enemy.queue_free()

func test_hit_and_run_settings() -> void:
	var enemy = _create_scout_enemy()
	var passed = enemy.retreat_duration == 0.5 and enemy.attack_pause == 0.3
	if passed:
		_pass("test_hit_and_run_settings")
	else:
		_fail("test_hit_and_run_settings", "Expected retreat=0.5s, pause=0.3s")
	enemy.queue_free()

func test_take_damage() -> void:
	var enemy = _create_scout_enemy()
	enemy._ready()
	enemy.take_damage(15)
	var expected = 40 - 15
	if enemy.current_health == expected:
		_pass("test_take_damage")
	else:
		_fail("test_take_damage", "Expected %d got %d" % [expected, enemy.current_health])
	enemy.queue_free()

func test_take_damage_death() -> void:
	var enemy = _create_scout_enemy()
	enemy._ready()
	var signals_received: Array = []
	enemy.died.connect(func(_xp): signals_received.append("died"))
	enemy.take_damage(40)
	if signals_received.size() > 0:
		_pass("test_take_damage_death")
	else:
		_fail("test_take_damage_death", "Should die at 0 health")
	enemy.queue_free()
