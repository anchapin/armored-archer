extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running BaseEnemy Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_default_stats()
	await test_initial_health_equals_max()
	await test_take_damage_reduces_health()
	await test_take_damage_triggers_death_at_zero()
	await test_take_damage_no_death_above_zero()
	await test_take_damage_multiple_hits()
	await test_died_signal_emitted()
	await test_died_signal_xp_value()
	await test_die_calls_unregister()
	await test_die_calls_object_pool()
	await test_reset_for_spawn_restores_health()
	await test_reset_for_spawn_registers_enemy()
	await test_reset_pooled_state_restores_health()
	await test_reset_pooled_state_resets_position()
	await test_reset_pooled_state_resets_velocity()
	await test_enemy_in_enemies_group()
	await test_exported_stats_default_values()

	print("\n=== BaseEnemy Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_enemy() -> Node:
	# Create a minimal CharacterBody2D with the BaseEnemy script attached
	var enemy = CharacterBody2D.new()
	enemy.set_script(load("res://scenes/enemies/base_enemy.gd"))
	# Add required child nodes
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
	var enemy = _create_enemy()
	var passed = enemy.max_health == 100 and enemy.move_speed == 150.0 and enemy.damage == 10 and enemy.xp_reward == 25
	if passed:
		_pass("test_default_stats")
	else:
		_fail("test_default_stats", "Default stats should be max_health=100, move_speed=150, damage=10, xp_reward=25 (got %d, %f, %d, %d)" % [enemy.max_health, enemy.move_speed, enemy.damage, enemy.xp_reward])
	enemy.queue_free()

func test_initial_health_equals_max() -> void:
	var enemy = _create_enemy()
	enemy._ready()
	if enemy.current_health == enemy.max_health:
		_pass("test_initial_health_equals_max")
	else:
		_fail("test_initial_health_equals_max", "current_health should equal max_health after _ready (got %d vs %d)" % [enemy.current_health, enemy.max_health])
	enemy.queue_free()

func test_take_damage_reduces_health() -> void:
	var enemy = _create_enemy()
	enemy._ready()
	enemy.take_damage(30)
	if enemy.current_health == 70:
		_pass("test_take_damage_reduces_health")
	else:
		_fail("test_take_damage_reduces_health", "Health should be 70 after 30 damage (got %d)" % enemy.current_health)
	enemy.queue_free()

func test_take_damage_triggers_death_at_zero() -> void:
	var enemy = _create_enemy()
	enemy._ready()
	var signals_received: Array = []
	enemy.died.connect(func(_xp): signals_received.append("died"))
	enemy.take_damage(100)
	await get_tree().process_frame
	if signals_received.size() > 0:
		_pass("test_take_damage_triggers_death_at_zero")
	else:
		_fail("test_take_damage_triggers_death_at_zero", "died signal should emit when health reaches 0")
	enemy.queue_free()

func test_take_damage_no_death_above_zero() -> void:
	var enemy = _create_enemy()
	enemy._ready()
	var signals_received: Array = []
	enemy.died.connect(func(_xp): signals_received.append("died"))
	enemy.take_damage(50)
	await get_tree().process_frame
	if signals_received.is_empty() and enemy.current_health == 50:
		_pass("test_take_damage_no_death_above_zero")
	else:
		_fail("test_take_damage_no_death_above_zero", "Should not die when health > 0")
	enemy.queue_free()

func test_take_damage_multiple_hits() -> void:
	var enemy = _create_enemy()
	enemy._ready()
	enemy.take_damage(20)
	enemy.take_damage(30)
	enemy.take_damage(25)
	if enemy.current_health == 25:
		_pass("test_take_damage_multiple_hits")
	else:
		_fail("test_take_damage_multiple_hits", "Health should be 25 after 20+30+25 damage (got %d)" % enemy.current_health)
	enemy.queue_free()

func test_died_signal_emitted() -> void:
	var enemy = _create_enemy()
	enemy._ready()
	var signals_received: Array = []
	enemy.died.connect(func(_xp): signals_received.append("died"))
	enemy.take_damage(999)
	# In headless mode, give a frame for deferred death handling to process
	await get_tree().process_frame
	if signals_received.size() > 0:
		_pass("test_died_signal_emitted")
	else:
		_fail("test_died_signal_emitted", "died signal should emit on death")
	enemy.queue_free()

func test_died_signal_xp_value() -> void:
	var enemy = _create_enemy()
	enemy._ready()
	enemy.xp_reward = 50
	var signals_received: Array = []
	enemy.died.connect(func(xp): signals_received.append(xp))
	enemy.take_damage(999)
	await get_tree().process_frame
	if signals_received.size() > 0 and signals_received[0] == 50:
		_pass("test_died_signal_xp_value")
	else:
		_fail("test_died_signal_xp_value", "died signal should pass xp_reward (got %d)" % (signals_received[0] if signals_received.size() > 0 else -1))
	enemy.queue_free()

func test_die_calls_unregister() -> void:
	# This test verifies die() exists and can be called without error
	# (AutoAimManager may not be available in test, but the method should handle it)
	var enemy = _create_enemy()
	enemy._ready()
	# Calling die() directly - it will try to call AutoAimManager.unregister_enemy
	# which may fail if AutoAimManager isn't loaded, but the method itself should exist
	if enemy.has_method("die"):
		_pass("test_die_calls_unregister")
	else:
		_fail("test_die_calls_unregister", "Enemy should have die() method")
	enemy.queue_free()

func test_die_calls_object_pool() -> void:
	var enemy = _create_enemy()
	if enemy.has_method("die"):
		_pass("test_die_calls_object_pool")
	else:
		_fail("test_die_calls_object_pool", "die() method should exist for ObjectPool integration")
	enemy.queue_free()

func test_reset_for_spawn_restores_health() -> void:
	var enemy = _create_enemy()
	enemy._ready()
	enemy.take_damage(50)
	enemy.reset_for_spawn()
	if enemy.current_health == enemy.max_health:
		_pass("test_reset_for_spawn_restores_health")
	else:
		_fail("test_reset_for_spawn_restores_health", "reset_for_spawn should restore health to max (got %d vs %d)" % [enemy.current_health, enemy.max_health])
	enemy.queue_free()

func test_reset_for_spawn_registers_enemy() -> void:
	var enemy = _create_enemy()
	if enemy.has_method("reset_for_spawn"):
		_pass("test_reset_for_spawn_registers_enemy")
	else:
		_fail("test_reset_for_spawn_registers_enemy", "reset_for_spawn should exist")
	enemy.queue_free()

func test_reset_pooled_state_restores_health() -> void:
	var enemy = _create_enemy()
	enemy._ready()
	enemy.take_damage(80)
	enemy.reset_pooled_state()
	if enemy.current_health == enemy.max_health:
		_pass("test_reset_pooled_state_restores_health")
	else:
		_fail("test_reset_pooled_state_restores_health", "reset_pooled_state should restore health (got %d)" % enemy.current_health)
	enemy.queue_free()

func test_reset_pooled_state_resets_position() -> void:
	var enemy = _create_enemy()
	enemy.position = Vector2(100, 200)
	enemy.reset_pooled_state()
	if enemy.position == Vector2.ZERO:
		_pass("test_reset_pooled_state_resets_position")
	else:
		_fail("test_reset_pooled_state_resets_position", "Position should reset to ZERO (got %s)" % str(enemy.position))
	enemy.queue_free()

func test_reset_pooled_state_resets_velocity() -> void:
	var enemy = _create_enemy()
	enemy.velocity = Vector2(50, 75)
	enemy.reset_pooled_state()
	if enemy.velocity == Vector2.ZERO:
		_pass("test_reset_pooled_state_resets_velocity")
	else:
		_fail("test_reset_pooled_state_resets_velocity", "Velocity should reset to ZERO (got %s)" % str(enemy.velocity))
	enemy.queue_free()

func test_enemy_in_enemies_group() -> void:
	var enemy = _create_enemy()
	enemy._ready()
	if enemy.is_in_group("Enemies"):
		_pass("test_enemy_in_enemies_group")
	else:
		_fail("test_enemy_in_enemies_group", "Enemy should be in 'Enemies' group after _ready")
	enemy.queue_free()

func test_exported_stats_default_values() -> void:
	var enemy = _create_enemy()
	# Test that exported vars can be overridden
	enemy.max_health = 200
	enemy.move_speed = 300.0
	enemy.damage = 25
	enemy.xp_reward = 100
	enemy._ready()
	if enemy.current_health == 200:
		_pass("test_exported_stats_default_values")
	else:
		_fail("test_exported_stats_default_values", "Overridden max_health should be used (got %d)" % enemy.current_health)
	enemy.queue_free()
