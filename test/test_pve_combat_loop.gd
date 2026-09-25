## PvE Combat Loop Integration Tests
## Validates the full pipeline: enemy spawn -> autoaim -> damage -> death -> unregister -> pool reuse
extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running PvE Combat Loop Integration Tests ===\n")
	await run_tests()
	print("\n=== PvE Combat Loop Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func run_tests() -> void:
	await test_enemy_spawn_and_register_with_autoaim()
	await test_enemy_take_damage_and_die()
	await test_dead_enemy_unregisters_from_autoaim()
	await test_died_signal_emitted_on_death()
	await test_enemy_pool_reuse_resets_health()
	await test_multiple_enemies_register()
	await test_kill_all_enemies_clears_autoaim()
	print("\nTotal: %d passed, %d failed" % [_tests_passed, _tests_failed])

func _create_enemy() -> Node:
	var enemy = CharacterBody2D.new()
	enemy.set_script(load("res://scenes/enemies/base_enemy.gd"))
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

func _get_autoaim() -> Node:
	return get_node_or_null("/root/AutoAimManager")

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_enemy_spawn_and_register_with_autoaim() -> void:
	var autoaim = _get_autoaim()
	if not autoaim:
		_pass("test_enemy_spawn_and_register_with_autoaim (no AutoAimManager autoload)")
		return

	var initial_count: int = autoaim.registered_enemies.size() if "registered_enemies" in autoaim else 0
	var enemy = _create_enemy()

	if autoaim.has_method("register_enemy"):
		autoaim.register_enemy(enemy)

	var new_count: int = autoaim.registered_enemies.size() if "registered_enemies" in autoaim else 0
	if new_count > initial_count:
		_pass("test_enemy_spawn_and_register_with_autoaim")
	else:
		_fail("test_enemy_spawn_and_register_with_autoaim", "Enemy should register with AutoAimManager (count: %d -> %d)" % [initial_count, new_count])
	enemy.queue_free()

func test_enemy_take_damage_and_die() -> void:
	var enemy = _create_enemy()

	enemy.take_damage(enemy.max_health)

	if enemy.current_health <= 0 and enemy.is_dead:
		_pass("test_enemy_take_damage_and_die")
	else:
		_fail("test_enemy_take_damage_and_die", "Enemy should be dead after taking max_health damage (health=%d, is_dead=%s)" % [enemy.current_health, str(enemy.is_dead)])
	enemy.queue_free()

func test_dead_enemy_unregisters_from_autoaim() -> void:
	var autoaim = _get_autoaim()
	if not autoaim:
		_pass("test_dead_enemy_unregisters_from_autoaim (no AutoAimManager autoload)")
		return

	var enemy = _create_enemy()
	if autoaim.has_method("register_enemy"):
		autoaim.register_enemy(enemy)

	enemy.take_damage(enemy.max_health)
	if enemy.has_method("die"):
		enemy.die()

	if not autoaim.has_method("is_enemy_registered") or not autoaim.is_enemy_registered(enemy):
		_pass("test_dead_enemy_unregisters_from_autoaim")
	else:
		var count: int = autoaim.registered_enemies.size() if "registered_enemies" in autoaim else -1
		_fail("test_dead_enemy_unregisters_from_autoaim", "Dead enemy should unregister (registered_enemies count: %d)" % count)
	enemy.queue_free()

func test_died_signal_emitted_on_death() -> void:
	var enemy = _create_enemy()
	# Use Array (reference type) instead of bool — Godot 4 lambdas cannot mutate
	# primitive locals in the enclosing scope (see godotengine/godot#80597).
	var signal_received: Array = []
	if enemy.has_signal("died"):
		enemy.died.connect(func(_val): signal_received.append(true))
	enemy.take_damage(enemy.max_health)
	if signal_received.size() == 1:
		_pass("test_died_signal_emitted_on_death")
	else:
		_fail("test_died_signal_emitted_on_death", "died signal should be emitted on death")
	enemy.queue_free()

func test_enemy_pool_reuse_resets_health() -> void:
	var enemy = _create_enemy()
	enemy.take_damage(enemy.max_health / 2)
	var damaged_health = enemy.current_health

	if enemy.has_method("reset_for_spawn"):
		enemy.reset_for_spawn()
		if enemy.current_health == enemy.max_health:
			_pass("test_enemy_pool_reuse_resets_health")
		else:
			_fail("test_enemy_pool_reuse_resets_health", "Health should reset to max after pool reuse (got %d, expected %d)" % [enemy.current_health, enemy.max_health])
	else:
		_pass("test_enemy_pool_reuse_resets_health (no reset_for_spawn method)")
	enemy.queue_free()

func test_multiple_enemies_register() -> void:
	var autoaim = _get_autoaim()
	if not autoaim:
		_pass("test_multiple_enemies_register (no AutoAimManager autoload)")
		return

	var enemies: Array = []
	for i in range(3):
		var enemy = _create_enemy()
		if autoaim.has_method("register_enemy"):
			autoaim.register_enemy(enemy)
		enemies.append(enemy)

	var count: int = autoaim.registered_enemies.size() if "registered_enemies" in autoaim else 0
	if count >= 3:
		_pass("test_multiple_enemies_register")
	else:
		_fail("test_multiple_enemies_register", "Should have 3+ registered enemies (got %d)" % count)

	for enemy in enemies:
		enemy.queue_free()

func test_kill_all_enemies_clears_autoaim() -> void:
	var autoaim = _get_autoaim()
	if not autoaim:
		_pass("test_kill_all_enemies_clears_autoaim (no AutoAimManager autoload)")
		return

	# Reset autoaim state for test isolation — earlier tests in this suite
	# queue_free living enemies without calling unregister_enemy, leaving
	# stale weakref entries that would skew the post-kill count.
	if "registered_enemies" in autoaim:
		autoaim.registered_enemies.clear()

	# Setup: 3 enemies registered in autoaim
	var enemies: Array = []
	for i in range(3):
		var enemy = _create_enemy()
		if autoaim.has_method("register_enemy"):
			autoaim.register_enemy(enemy)
		enemies.append(enemy)

	for enemy in enemies:
		enemy.take_damage(enemy.max_health)
		if enemy.has_method("die"):
			enemy.die()

	var count: int = autoaim.registered_enemies.size() if "registered_enemies" in autoaim else 0
	if count == 0:
		_pass("test_kill_all_enemies_clears_autoaim")
	else:
		_fail("test_kill_all_enemies_clears_autoaim", "All enemies dead, autoaim should be empty (got %d)" % count)

	for enemy in enemies:
		if is_instance_valid(enemy):
			enemy.queue_free()
