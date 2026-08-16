extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running GuardianEnemy Tests ===\n")
	run_tests()

func run_tests() -> void:
	await test_default_stats()
	await test_shield_defaults()
	await test_shield_damage_reduction()
	await test_shield_takes_damage_first()
	await test_shield_broken()
	await test_shield_regeneration()
	await test_parry_settings()
	await test_take_damage_without_shield()
	await test_take_damage_death()

	print("\n=== GuardianEnemy Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_guardian_enemy() -> Node:
	var enemy = CharacterBody2D.new()
	enemy.set_script(load("res://scenes/enemies/guardian_enemy.gd"))
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
	var enemy = _create_guardian_enemy()
	enemy._ready()
	var passed = enemy.max_health == 80 and enemy.move_speed == 70.0 and enemy.damage == 15 and enemy.xp_reward == 45
	if passed:
		_pass("test_default_stats")
	else:
		_fail("test_default_stats", "Expected (80, 70, 15, 45) got (%d, %f, %d, %d)" % [enemy.max_health, enemy.move_speed, enemy.damage, enemy.xp_reward])
	enemy.queue_free()

func test_shield_defaults() -> void:
	var enemy = _create_guardian_enemy()
	var passed = enemy.max_shield_health == 50 and enemy.shield_damage_reduction == 0.6
	if passed:
		_pass("test_shield_defaults")
	else:
		_fail("test_shield_defaults", "Expected shield_health=50, reduction=0.6")
	enemy.queue_free()

func test_shield_damage_reduction() -> void:
	var enemy = _create_guardian_enemy()
	enemy._ready()
	# Shield blocks 60% of damage
	enemy.take_damage(50)
	# shield_damage = int(50 * 0.6) = 30
	# remaining_damage = 50 - 30 = 20
	# shield_health = 50 - 30 = 20
	# health = 80 - 20 = 60
	var passed = enemy.current_health == 60 and enemy.shield_health == 20
	if passed:
		_pass("test_shield_damage_reduction")
	else:
		_fail("test_shield_damage_reduction", "Expected health=60, shield=20 got health=%d, shield=%d" % [enemy.current_health, enemy.shield_health])
	enemy.queue_free()

func test_shield_takes_damage_first() -> void:
	var enemy = _create_guardian_enemy()
	enemy._ready()
	var initial_shield = enemy.shield_health
	enemy.take_damage(10)
	# Shield should take damage, not health directly (mostly)
	var passed = enemy.shield_health < initial_shield
	if passed:
		_pass("test_shield_takes_damage_first")
	else:
		_fail("test_shield_takes_damage_first", "Shield should absorb damage before health")
	enemy.queue_free()

func test_shield_broken() -> void:
	var enemy = _create_guardian_enemy()
	enemy._ready()
	# Deal enough damage to break shield
	enemy.take_damage(100)
	# shield_damage = int(100 * 0.6) = 60, shield only has 50
	# Shield should break
	var passed = enemy.shield_health <= 0 or not enemy.is_shield_active
	if passed:
		_pass("test_shield_broken")
	else:
		_fail("test_shield_broken", "Shield should break after enough damage (shield=%d, active=%s)" % [enemy.shield_health, str(enemy.is_shield_active)])
	enemy.queue_free()

func test_shield_regeneration() -> void:
	var enemy = _create_guardian_enemy()
	enemy._ready()
	# Break shield
	enemy.shield_health = 0
	enemy.is_shield_active = false
	# Regenerate
	enemy.regenerate_shield()
	var passed = enemy.shield_health == enemy.max_shield_health and enemy.is_shield_active == true
	if passed:
		_pass("test_shield_regeneration")
	else:
		_fail("test_shield_regeneration", "Shield should regenerate to max (got %d)" % enemy.shield_health)
	enemy.queue_free()

func test_parry_settings() -> void:
	var enemy = _create_guardian_enemy()
	var passed = enemy.can_parry == true and enemy.parry_window == 0.4 and enemy.parry_cooldown == 3.0
	if passed:
		_pass("test_parry_settings")
	else:
		_fail("test_parry_settings", "Expected parry enabled, window=0.4, cooldown=3.0")
	enemy.queue_free()

func test_take_damage_without_shield() -> void:
	var enemy = _create_guardian_enemy()
	enemy._ready()
	enemy.is_shield_active = false
	enemy.take_damage(30)
	var expected = 80 - 30
	if enemy.current_health == expected:
		_pass("test_take_damage_without_shield")
	else:
		_fail("test_take_damage_without_shield", "Expected %d got %d" % [expected, enemy.current_health])
	enemy.queue_free()

func test_take_damage_death() -> void:
	var enemy = _create_guardian_enemy()
	enemy._ready()
	enemy.is_shield_active = false
	var signals_received: Array = []
	enemy.died.connect(func(_xp): signals_received.append("died"))
	enemy.take_damage(80)
	if signals_received.size() > 0:
		_pass("test_take_damage_death")
	else:
		_fail("test_take_damage_death", "Should die at 0 health")
	enemy.queue_free()
