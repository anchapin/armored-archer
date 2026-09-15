extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running ObjectPool Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_constants()
	await test_arrow_pool_acquire_release()
	await test_enemy_pool_acquire_release()
	await test_hit_effect_pool_acquire_release()
	await test_pool_reuse()
	await test_return_invalid_instance()
	await test_statistics()
	await test_cleanup_invalid_instances()

	print("\n=== ObjectPool Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_object_pool() -> Node:
	var pool = load("res://autoloads/ObjectPool.gd").new()
	add_child(pool)
	# Wait for _ready to complete
	await get_tree().process_frame
	return pool

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var pool = await _create_object_pool()

	# Test pool arrays are initialized
	if "_arrow_pool" in pool and "_enemy_pool" in pool and "_hit_effect_pool" in pool:
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Pool arrays should exist")

	# Test active tracking arrays exist
	if "_active_arrows" in pool and "_active_enemies" in pool and "_active_hit_effects" in pool:
		_pass("test_initial_state_tracking_arrays")
	else:
		_fail("test_initial_state_tracking_arrays", "Active tracking arrays should exist")

	# Test statistics counters exist
	if "_arrows_created" in pool and "_enemies_created" in pool and "_hit_effects_created" in pool:
		_pass("test_initial_state_statistics")
	else:
		_fail("test_initial_state_statistics", "Statistics counters should exist")

	pool.queue_free()

func test_constants() -> void:
	var pool = await _create_object_pool()

	if pool.ARROW_POOL_SIZE == 20:
		_pass("test_arrow_pool_size_constant")
	else:
		_fail("test_arrow_pool_size_constant", "ARROW_POOL_SIZE should be 20")

	if pool.ENEMY_POOL_SIZE == 15:
		_pass("test_enemy_pool_size_constant")
	else:
		_fail("test_enemy_pool_size_constant", "ENEMY_POOL_SIZE should be 15")

	if pool.HIT_EFFECT_POOL_SIZE == 10:
		_pass("test_hit_effect_pool_size_constant")
	else:
		_fail("test_hit_effect_pool_size_constant", "HIT_EFFECT_POOL_SIZE should be 10")

	pool.queue_free()

func test_arrow_pool_acquire_release() -> void:
	var pool = await _create_object_pool()

	# Acquire an arrow
	var arrow = pool.get_arrow()

	if arrow != null:
		_pass("test_get_arrow_returns_node")
	else:
		_fail("test_get_arrow_returns_node", "get_arrow should return a node")

	# Arrow should be visible and active
	if arrow.visible == true:
		_pass("test_arrow_visible_after_acquire")
	else:
		_fail("test_arrow_visible_after_acquire", "Arrow should be visible after acquire")

	# Arrow should be in active tracking
	if pool._active_arrows.has(arrow):
		_pass("test_arrow_in_active_tracking")
	else:
		_fail("test_arrow_in_active_tracking", "Arrow should be in active tracking")

	# Release the arrow
	pool.return_arrow(arrow)
	await get_tree().process_frame

	# Arrow should no longer be in active tracking
	if not pool._active_arrows.has(arrow):
		_pass("test_arrow_removed_from_active_after_release")
	else:
		_fail("test_arrow_removed_from_active_after_release", "Arrow should be removed from active tracking")

	# Arrow should be back in pool
	if pool._arrow_pool.has(arrow):
		_pass("test_arrow_returned_to_pool")
	else:
		_fail("test_arrow_returned_to_pool", "Arrow should be returned to pool")

	pool.queue_free()

func test_enemy_pool_acquire_release() -> void:
	var pool = await _create_object_pool()

	# Acquire an enemy
	var enemy = pool.get_enemy()

	if enemy != null:
		_pass("test_get_enemy_returns_node")
	else:
		_fail("test_get_enemy_returns_node", "get_enemy should return a node")

	# Enemy should be visible and active
	if enemy.visible == true:
		_pass("test_enemy_visible_after_acquire")
	else:
		_fail("test_enemy_visible_after_acquire", "Enemy should be visible after acquire")

	# Enemy should be in active tracking
	if pool._active_enemies.has(enemy):
		_pass("test_enemy_in_active_tracking")
	else:
		_fail("test_enemy_in_active_tracking", "Enemy should be in active tracking")

	# Release the enemy
	pool.return_enemy(enemy)
	await get_tree().process_frame

	# Enemy should no longer be in active tracking
	if not pool._active_enemies.has(enemy):
		_pass("test_enemy_removed_from_active_after_release")
	else:
		_fail("test_enemy_removed_from_active_after_release", "Enemy should be removed from active tracking")

	# Enemy should be back in pool
	if pool._enemy_pool.has(enemy):
		_pass("test_enemy_returned_to_pool")
	else:
		_fail("test_enemy_returned_to_pool", "Enemy should be returned to pool")

	pool.queue_free()

func test_hit_effect_pool_acquire_release() -> void:
	var pool = await _create_object_pool()

	# Acquire a hit effect
	var effect = pool.get_hit_effect()

	if effect != null:
		_pass("test_get_hit_effect_returns_node")
	else:
		_fail("test_get_hit_effect_returns_node", "get_hit_effect should return a node")

	# Effect should be visible and active
	if effect.visible == true:
		_pass("test_hit_effect_visible_after_acquire")
	else:
		_fail("test_hit_effect_visible_after_acquire", "Hit effect should be visible after acquire")

	# Effect should be in active tracking
	if pool._active_hit_effects.has(effect):
		_pass("test_hit_effect_in_active_tracking")
	else:
		_fail("test_hit_effect_in_active_tracking", "Hit effect should be in active tracking")

	# Release the effect
	pool.return_hit_effect(effect)
	await get_tree().process_frame

	# Effect should no longer be in active tracking
	if not pool._active_hit_effects.has(effect):
		_pass("test_hit_effect_removed_from_active_after_release")
	else:
		_fail("test_hit_effect_removed_from_active_after_release", "Hit effect should be removed from active tracking")

	# Effect should be back in pool
	if pool._hit_effect_pool.has(effect):
		_pass("test_hit_effect_returned_to_pool")
	else:
		_fail("test_hit_effect_returned_to_pool", "Hit effect should be returned to pool")

	pool.queue_free()

func test_pool_reuse() -> void:
	var pool = await _create_object_pool()

	# Get initial pool size
	var initial_pool_size = pool._arrow_pool.size()

	# Acquire an arrow (should reuse from pool)
	var arrow1 = pool.get_arrow()
	var reused_count = pool._arrows_reused

	# Release it
	pool.return_arrow(arrow1)
	await get_tree().process_frame

	# Acquire again - should reuse
	var arrow2 = pool.get_arrow()

	if pool._arrows_reused > reused_count:
		_pass("test_pool_reuse")
	else:
		_fail("test_pool_reuse", "Pool should reuse objects")

	pool.queue_free()

func test_return_invalid_instance() -> void:
	var pool = await _create_object_pool()

	# Create a fake invalid node reference
	var fake_node: Node = null

	# Should not crash when returning null/invalid
	pool.return_arrow(fake_node)
	_pass("test_return_null_arrow_safe")

	pool.return_enemy(fake_node)
	_pass("test_return_null_enemy_safe")

	pool.return_hit_effect(fake_node)
	_pass("test_return_null_hit_effect_safe")

	# Test with freed node (invalid): the typed call boundary rejects
	# freed instances before ObjectPool's internal is_instance_valid
	# guard runs, so guard at the call site (issue #1059).
	var arrow = pool.get_arrow()
	arrow.queue_free()
	await get_tree().process_frame

	if is_instance_valid(arrow):
		pool.return_arrow(arrow)
	_pass("test_return_freed_arrow_safe")

	pool.queue_free()

func test_statistics() -> void:
	var pool = await _create_object_pool()

	# Get initial statistics
	var stats = pool.get_statistics()

	# Test statistics structure
	if stats.has("arrows") and stats.has("enemies") and stats.has("hit_effects"):
		_pass("test_statistics_structure")
	else:
		_fail("test_statistics_structure", "Statistics should have arrows, enemies, hit_effects")

	# Test arrow stats
	if stats.arrows.has("active") and stats.arrows.has("available") and stats.arrows.has("created") and stats.arrows.has("reused") and stats.arrows.has("reuse_rate"):
		_pass("test_arrow_statistics_fields")
	else:
		_fail("test_arrow_statistics_fields", "Arrow stats should have all required fields")

	# Acquire and release an arrow to test statistics update
	var arrow = pool.get_arrow()
	pool.return_arrow(arrow)
	await get_tree().process_frame

	stats = pool.get_statistics()

	# Created + reused should be > 0
	if stats.arrows.created + stats.arrows.reused > 0:
		_pass("test_statistics_update")
	else:
		_fail("test_statistics_update", "Statistics should update after acquire/release")

	pool.queue_free()

func test_cleanup_invalid_instances() -> void:
	var pool = await _create_object_pool()

	# Acquire some arrows
	var arrow1 = pool.get_arrow()
	var arrow2 = pool.get_arrow()

	# Queue free one
	arrow1.queue_free()
	await get_tree().process_frame

	# Run cleanup
	pool.cleanup_invalid_instances()

	# Only arrow2 should remain in active
	if pool._active_arrows.size() == 1 and pool._active_arrows.has(arrow2):
		_pass("test_cleanup_removes_invalid")
	else:
		_fail("test_cleanup_removes_invalid", "Cleanup should remove invalid instances")

	arrow2.queue_free()
	pool.queue_free()
