## Regression for stage teardown during the delayed death-animation pool return.
extends GutTest

const JUICE_SCRIPT: Script = preload("res://autoloads/CombatJuiceManager.gd")
const POOL_SCRIPT: Script = preload("res://autoloads/ObjectPool.gd")

func test_freed_enemy_is_rejected_before_animation() -> void:
	var manager: Node = add_child_autofree(JUICE_SCRIPT.new())
	var enemy: Node = Node.new()
	enemy.free()
	var result: Dictionary = await manager._trigger_death_animation({"enemy_node": enemy})
	assert_false(result.success)

func test_enemy_freed_during_animation_completes_without_pool_call() -> void:
	var manager: Node = add_child_autofree(JUICE_SCRIPT.new())
	var enemy: Node = Node.new()
	add_child(enemy)
	var enemy_id: String = str(enemy.get_instance_id())
	get_tree().create_timer(0.05).timeout.connect(enemy.queue_free)
	watch_signals(manager)
	var result: Dictionary = await manager._trigger_death_animation({"enemy_node": enemy})
	assert_true(result.success)
	assert_eq(result.enemy_id, enemy_id)
	assert_signal_emitted(manager, "juice_effect_completed")

func test_detached_enemy_return_after_cleanup_does_not_recreate_pool() -> void:
	var pool: Node = add_child_autofree(POOL_SCRIPT.new())
	var enemy: Node2D = Node2D.new()
	enemy.set_meta("_pool_scene_key", "test-enemy")
	pool._enemy_pools["test-enemy"] = {"available": [], "active": [enemy]}
	pool.cleanup_all()
	# Queue-free has not run yet, so the old validity-only guard is insufficient.
	assert_true(is_instance_valid(enemy))
	pool.return_enemy(enemy)
	assert_true(pool._enemy_pools.is_empty())

func test_valid_untracked_enemy_after_cleanup_is_ignored() -> void:
	var pool: Node = add_child_autofree(POOL_SCRIPT.new())
	var enemy: Node2D = Node2D.new()
	pool.cleanup_all()
	pool.return_enemy(enemy)
	assert_true(pool._enemy_pools.is_empty())
	assert_eq(enemy.process_mode, Node.PROCESS_MODE_INHERIT)
	enemy.free()

func test_live_enemy_return_preserves_scene_pool() -> void:
	var pool: Node = add_child_autofree(POOL_SCRIPT.new())
	var enemy: Node2D = Node2D.new()
	enemy.set_meta("_pool_scene_key", "test-enemy")
	pool._enemy_pools["test-enemy"] = {"available": [], "active": [enemy]}
	pool.return_enemy(enemy)
	assert_eq(pool._enemy_pools["test-enemy"].available, [enemy])
	assert_true(pool._enemy_pools["test-enemy"].active.is_empty())
	assert_eq(enemy.process_mode, Node.PROCESS_MODE_DISABLED)
	pool.cleanup_all()

func test_delayed_return_after_pool_cleanup_completes_safely() -> void:
	var pool: Node = get_node("/root/ObjectPool")
	var manager: Node = add_child_autofree(JUICE_SCRIPT.new())
	var enemy: Node2D = Node2D.new()
	add_child(enemy)
	enemy.set_meta("_pool_scene_key", "test-detached-enemy")
	pool._enemy_pools["test-detached-enemy"] = {"available": [], "active": [enemy]}
	# A detached death-animation node may outlive the pool tracking dictionary.
	pool._enemy_pools["test-detached-enemy"].active.clear()
	get_tree().create_timer(0.05).timeout.connect(pool.cleanup_all)
	var result: Dictionary = await manager._trigger_death_animation({"enemy_node": enemy})
	assert_true(result.success)
	assert_true(pool._enemy_pools.is_empty())
	enemy.queue_free()
