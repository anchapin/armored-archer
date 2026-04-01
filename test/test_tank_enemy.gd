extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running TankEnemy Tests ===\n")
	run_tests()

func run_tests() -> void:
	await test_default_stats()
	await test_shield_defaults()
	await test_shield_activation()
	await test_shield_deactivation()
	await test_shield_damage_reduction()
	await test_take_damage_without_shield()
	await test_take_damage_with_shield()
	await test_shield_broken_state()
	await test_charge_settings()
	await test_attack_cooldown()
	await test_detection_range()
	await test_take_damage_death()

	print("\n=== TankEnemy Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_tank_enemy() -> Node:
	var enemy = CharacterBody2D.new()
	enemy.set_script(load("res://scenes/enemies/tank_enemy.gd"))
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
	var enemy = _create_tank_enemy()
	enemy._ready()
	var passed = enemy.max_health == 200 and enemy.move_speed == 60.0 and enemy.damage == 25 and enemy.xp_reward == 50
	if passed:
		_pass("test_default_stats")
	else:
		_fail("test_default_stats", "Expected (200, 60, 25, 50) got (%d, %f, %d, %d)" % [enemy.max_health, enemy.move_speed, enemy.damage, enemy.xp_reward])
	enemy.queue_free()

func test_shield_defaults() -> void:
	var enemy = _create_tank_enemy()
	var passed = enemy.shield_active == false and enemy.shield_damage_reduction == 0.4
	if passed:
		_pass("test_shield_defaults")
	else:
		_fail("test_shield_defaults", "Shield should start inactive with 0.4 reduction")
	enemy.queue_free()

func test_shield_activation() -> void:
	var enemy = _create_tank_enemy()
	enemy.activate_shield()
	var passed = enemy.shield_active == true and enemy.shield_timer == 0.0
	if passed:
		_pass("test_shield_activation")
	else:
		_fail("test_shield_activation", "Shield should be active after activate_shield()")
	enemy.queue_free()

func test_shield_deactivation() -> void:
	var enemy = _create_tank_enemy()
	enemy.activate_shield()
	enemy.deactivate_shield()
	var passed = enemy.shield_active == false and enemy.shield_timer == 0.0
	if passed:
		_pass("test_shield_deactivation")
	else:
		_fail("test_shield_deactivation", "Shield should be inactive after deactivate_shield()")
	enemy.queue_free()

func test_shield_damage_reduction() -> void:
	var enemy = _create_tank_enemy()
	enemy._ready()
	enemy.activate_shield()
	enemy.take_damage(100)
	# With 40% reduction: actual damage = 100 * 0.6 = 60
	var expected_health = 200 - 60
	if enemy.current_health == expected_health:
		_pass("test_shield_damage_reduction")
	else:
		_fail("test_shield_damage_reduction", "Expected %d health (got %d)" % [expected_health, enemy.current_health])
	enemy.queue_free()

func test_take_damage_without_shield() -> void:
	var enemy = _create_tank_enemy()
	enemy._ready()
	enemy.shield_active = false
	enemy.take_damage(50)
	var expected = 200 - 50
	if enemy.current_health == expected:
		_pass("test_take_damage_without_shield")
	else:
		_fail("test_take_damage_without_shield", "Expected %d got %d" % [expected, enemy.current_health])
	enemy.queue_free()

func test_take_damage_with_shield() -> void:
	var enemy = _create_tank_enemy()
	enemy._ready()
	enemy.activate_shield()
	enemy.take_damage(50)
	# 50 * 0.6 = 30 actual damage
	var expected = 200 - 30
	if enemy.current_health == expected:
		_pass("test_take_damage_with_shield")
	else:
		_fail("test_take_damage_with_shield", "Expected %d got %d" % [expected, enemy.current_health])
	enemy.queue_free()

func test_shield_broken_state() -> void:
	var enemy = _create_tank_enemy()
	enemy._ready()
	enemy.shield_active = true
	# Deal enough damage to break through shield and kill
	enemy.take_damage(999)
	# Should die from massive damage
	var died = false
	enemy.died.connect(func(_xp): died = true)
	enemy.take_damage(999)
	if died:
		_pass("test_shield_broken_state")
	else:
		_fail("test_shield_broken_state", "Should die from massive damage even with shield")
	enemy.queue_free()

func test_charge_settings() -> void:
	var enemy = _create_tank_enemy()
	var passed = enemy.can_charge == true and enemy.charge_cooldown == 6.0
	if passed:
		_pass("test_charge_settings")
	else:
		_fail("test_charge_settings", "Expected can_charge=true, cooldown=6.0")
	enemy.queue_free()

func test_attack_cooldown() -> void:
	var enemy = _create_tank_enemy()
	if enemy.attack_cooldown == 2.0:
		_pass("test_attack_cooldown")
	else:
		_fail("test_attack_cooldown", "Expected 2.0 got %f" % enemy.attack_cooldown)
	enemy.queue_free()

func test_detection_range() -> void:
	var enemy = _create_tank_enemy()
	if enemy.detection_range == 350.0:
		_pass("test_detection_range")
	else:
		_fail("test_detection_range", "Expected 350.0 got %f" % enemy.detection_range)
	enemy.queue_free()

func test_take_damage_death() -> void:
	var enemy = _create_tank_enemy()
	enemy._ready()
	enemy.shield_active = false
	var died = false
	enemy.died.connect(func(_xp): died = true)
	enemy.take_damage(200)
	if died:
		_pass("test_take_damage_death")
	else:
		_fail("test_take_damage_death", "Should die at 0 health")
	enemy.queue_free()
