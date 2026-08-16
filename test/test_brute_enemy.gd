extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running BruteEnemy Tests ===\n")
	run_tests()

func run_tests() -> void:
	await test_default_stats()
	await test_armor_reduction_small_attack()
	await test_armor_reduction_medium_attack()
	await test_armor_no_reduction_large_attack()
	await test_armor_minimum_damage()
	await test_charge_settings()
	await test_knockback_settings()
	await test_detection_range()
	await test_take_damage_death()

	print("\n=== BruteEnemy Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_brute_enemy() -> Node:
	var enemy = CharacterBody2D.new()
	enemy.set_script(load("res://scenes/enemies/brute_enemy.gd"))
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
	var enemy = _create_brute_enemy()
	enemy._ready()
	var passed = enemy.max_health == 180 and enemy.move_speed == 60.0 and enemy.damage == 25 and enemy.xp_reward == 50
	if passed:
		_pass("test_default_stats")
	else:
		_fail("test_default_stats", "Expected (180, 60, 25, 50) got (%d, %f, %d, %d)" % [enemy.max_health, enemy.move_speed, enemy.damage, enemy.xp_reward])
	enemy.queue_free()

func test_armor_reduction_small_attack() -> void:
	var enemy = _create_brute_enemy()
	enemy._ready()
	# Small attack (<15): damage - 5
	enemy.take_damage(10)
	# effective_damage = max(1, 10 - 5) = 5
	var expected = 180 - 5
	if enemy.current_health == expected:
		_pass("test_armor_reduction_small_attack")
	else:
		_fail("test_armor_reduction_small_attack", "Expected %d got %d (10 dmg -> 5 effective)" % [expected, enemy.current_health])
	enemy.queue_free()

func test_armor_reduction_medium_attack() -> void:
	var enemy = _create_brute_enemy()
	enemy._ready()
	# Medium attack (15-29): damage - 2
	enemy.take_damage(20)
	# effective_damage = 20 - 2 = 18
	var expected = 180 - 18
	if enemy.current_health == expected:
		_pass("test_armor_reduction_medium_attack")
	else:
		_fail("test_armor_reduction_medium_attack", "Expected %d got %d (20 dmg -> 18 effective)" % [expected, enemy.current_health])
	enemy.queue_free()

func test_armor_no_reduction_large_attack() -> void:
	var enemy = _create_brute_enemy()
	enemy._ready()
	# Large attack (>=30): no reduction
	enemy.take_damage(40)
	var expected = 180 - 40
	if enemy.current_health == expected:
		_pass("test_armor_no_reduction_large_attack")
	else:
		_fail("test_armor_no_reduction_large_attack", "Expected %d got %d" % [expected, enemy.current_health])
	enemy.queue_free()

func test_armor_minimum_damage() -> void:
	var enemy = _create_brute_enemy()
	enemy._ready()
	# Very small attack: min 1 damage
	enemy.take_damage(1)
	# effective_damage = max(1, 1 - 5) = 1
	var expected = 180 - 1
	if enemy.current_health == expected:
		_pass("test_armor_minimum_damage")
	else:
		_fail("test_armor_minimum_damage", "Expected %d got %d (min 1 damage)" % [expected, enemy.current_health])
	enemy.queue_free()

func test_charge_settings() -> void:
	var enemy = _create_brute_enemy()
	var passed = enemy.can_charge == true and enemy.charge_cooldown == 5.0 and enemy.charge_speed == 350.0
	if passed:
		_pass("test_charge_settings")
	else:
		_fail("test_charge_settings", "Expected charge enabled, 5.0s cooldown, 350 speed")
	enemy.queue_free()

func test_knockback_settings() -> void:
	var enemy = _create_brute_enemy()
	var passed = enemy.knockback_force == 80.0
	if passed:
		_pass("test_knockback_settings")
	else:
		_fail("test_knockback_settings", "Expected knockback_force=80.0 got %f" % enemy.knockback_force)
	enemy.queue_free()

func test_detection_range() -> void:
	var enemy = _create_brute_enemy()
	if enemy.detection_range == 300.0:
		_pass("test_detection_range")
	else:
		_fail("test_detection_range", "Expected 300.0 got %f" % enemy.detection_range)
	enemy.queue_free()

func test_take_damage_death() -> void:
	var enemy = _create_brute_enemy()
	enemy._ready()
	var signals_received: Array = []
	enemy.died.connect(func(_xp): signals_received.append("died"))
	enemy.take_damage(999)
	if signals_received.size() > 0:
		_pass("test_take_damage_death")
	else:
		_fail("test_take_damage_death", "Should die from massive damage")
	enemy.queue_free()
