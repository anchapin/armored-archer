extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running RangedEnemy Tests ===\n")
	run_tests()

func run_tests() -> void:
	await test_default_stats()
	await test_attack_range()
	await test_detection_range()
	await test_retreat_range()
	await test_projectile_damage_multiplier()
	await test_attack_cooldown()
	await test_retreat_sets_velocity_away()
	await test_maintain_distance_approach()
	await test_maintain_distance_retreat()
	await test_take_damage()
	await test_take_damage_death()

	print("\n=== RangedEnemy Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_ranged_enemy() -> Node:
	var enemy = CharacterBody2D.new()
	enemy.set_script(load("res://scenes/enemies/ranged_enemy.gd"))
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
	var enemy = _create_ranged_enemy()
	enemy._ready()
	var passed = enemy.max_health == 60 and enemy.move_speed == 100.0 and enemy.damage == 12 and enemy.xp_reward == 30
	if passed:
		_pass("test_default_stats")
	else:
		_fail("test_default_stats", "Expected (60, 100, 12, 30) got (%d, %f, %d, %d)" % [enemy.max_health, enemy.move_speed, enemy.damage, enemy.xp_reward])
	enemy.queue_free()

func test_attack_range() -> void:
	var enemy = _create_ranged_enemy()
	if enemy.attack_range == 250.0:
		_pass("test_attack_range")
	else:
		_fail("test_attack_range", "Expected 250.0 got %f" % enemy.attack_range)
	enemy.queue_free()

func test_detection_range() -> void:
	var enemy = _create_ranged_enemy()
	if enemy.detection_range == 450.0:
		_pass("test_detection_range")
	else:
		_fail("test_detection_range", "Expected 450.0 got %f" % enemy.detection_range)
	enemy.queue_free()

func test_retreat_range() -> void:
	var enemy = _create_ranged_enemy()
	if enemy.retreat_range == 100.0:
		_pass("test_retreat_range")
	else:
		_fail("test_retreat_range", "Expected 100.0 got %f" % enemy.retreat_range)
	enemy.queue_free()

func test_projectile_damage_multiplier() -> void:
	var enemy = _create_ranged_enemy()
	if enemy.projectile_damage_multiplier == 0.8:
		_pass("test_projectile_damage_multiplier")
	else:
		_fail("test_projectile_damage_multiplier", "Expected 0.8 got %f" % enemy.projectile_damage_multiplier)
	enemy.queue_free()

func test_attack_cooldown() -> void:
	var enemy = _create_ranged_enemy()
	if enemy.attack_cooldown == 1.5:
		_pass("test_attack_cooldown")
	else:
		_fail("test_attack_cooldown", "Expected 1.5 got %f" % enemy.attack_cooldown)
	enemy.queue_free()

func test_retreat_sets_velocity_away() -> void:
	var enemy = _create_ranged_enemy()
	enemy._ready()
	var mock_player = CharacterBody2D.new()
	mock_player.add_to_group("Player")
	mock_player.global_position = Vector2(50, 0)
	add_child(mock_player)
	enemy.player_ref = mock_player
	enemy.retreat_from_player()
	# Velocity should be away from player (negative x direction)
	var passed = enemy.velocity.x < 0
	if passed:
		_pass("test_retreat_sets_velocity_away")
	else:
		_fail("test_retreat_sets_velocity_away", "Retreat should move away from player (got %s)" % str(enemy.velocity))
	mock_player.queue_free()
	enemy.queue_free()

func test_maintain_distance_approach() -> void:
	var enemy = _create_ranged_enemy()
	enemy._ready()
	var mock_player = CharacterBody2D.new()
	mock_player.add_to_group("Player")
	mock_player.global_position = Vector2(300, 0)
	add_child(mock_player)
	enemy.player_ref = mock_player
	# Distance 300 > attack_range * 0.8 (200) so should approach
	enemy.maintain_distance(300.0)
	var passed = enemy.velocity.length() > 0
	if passed:
		_pass("test_maintain_distance_approach")
	else:
		_fail("test_maintain_distance_approach", "Should have non-zero velocity when approaching")
	mock_player.queue_free()
	enemy.queue_free()

func test_maintain_distance_retreat() -> void:
	var enemy = _create_ranged_enemy()
	enemy._ready()
	var mock_player = CharacterBody2D.new()
	mock_player.add_to_group("Player")
	mock_player.global_position = Vector2(100, 0)
	add_child(mock_player)
	enemy.player_ref = mock_player
	# Distance 100 < attack_range * 0.8 (200) so should back away
	enemy.maintain_distance(100.0)
	var passed = enemy.velocity.length() > 0
	if passed:
		_pass("test_maintain_distance_retreat")
	else:
		_fail("test_maintain_distance_retreat", "Should have non-zero velocity when retreating")
	mock_player.queue_free()
	enemy.queue_free()

func test_take_damage() -> void:
	var enemy = _create_ranged_enemy()
	enemy._ready()
	enemy.take_damage(30)
	var expected = 60 - 30
	if enemy.current_health == expected:
		_pass("test_take_damage")
	else:
		_fail("test_take_damage", "Expected %d got %d" % [expected, enemy.current_health])
	enemy.queue_free()

func test_take_damage_death() -> void:
	var enemy = _create_ranged_enemy()
	enemy._ready()
	var signals_received: Array = []
	enemy.died.connect(func(_xp): signals_received.append("died"))
	enemy.take_damage(60)
	if signals_received.size() > 0:
		_pass("test_take_damage_death")
	else:
		_fail("test_take_damage_death", "Should die at 0 health")
	enemy.queue_free()
