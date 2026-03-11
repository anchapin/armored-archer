extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running ObjectPool Tests ===\n")
	await run_tests()

func run_tests() -> void:
	# Test constants
	test_constants()
	
	# Test initial state after initialization
	test_initial_state()
	
	# Test pool constants values
	test_pool_size_constants()
	
	# Test get and return arrow
	test_get_and_return_arrow()
	
	# Test get and return enemy
	test_get_and_return_enemy()
	
	# Test get and return hit effect
	test_get_and_return_hit_effect()
	
	# Test object reuse (get same object twice)
	test_object_reuse()
	
	# Test statistics
	test_statistics()
	
	# Test get_statistics structure
	test_statistics_structure()
	
	# Test reuse rate calculation
	test_reuse_rate_calculation()
	
	# Test cleanup invalid instances
	test_cleanup_invalid_instances()
	
	# Test return invalid instance (should not crash)
	test_return_invalid_instance()
	
	# Test warm_pools method exists
	test_warm_pools()
	
	# Test log_statistics method exists
	test_log_statistics()

	print("\n=== ObjectPool Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_object_pool() -> Node:
	var pool = load("res://autoloads/ObjectPool.gd").new()
	add_child(pool)
	# Wait for _ready to complete initialization
	await get_tree().create_timer(0.5).timeout
	return pool

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_constants() -> void:
	var pool = _create_object_pool()
	
	# Test pool size constants exist and are integers
	if typeof(pool.ARROW_POOL_SIZE) == TYPE_INT:
		_pass("test_arrow_pool_size_constant_type")
	else:
		_fail("test_arrow_pool_size_constant_type", "ARROW_POOL_SIZE should be int")
	
	if typeof(pool.ENEMY_POOL_SIZE) == TYPE_INT:
		_pass("test_enemy_pool_size_constant_type")
	else:
		_fail("test_enemy_pool_size_constant_type", "ENEMY_POOL_SIZE should be int")
	
	if typeof(pool.HIT_EFFECT_POOL_SIZE) == TYPE_INT:
		_pass("test_hit_effect_pool_size_constant_type")
	else:
		_fail("test_hit_effect_pool_size_constant_type", "HIT_EFFECT_POOL_SIZE should be int")
	
	# Test constants have expected values
	if pool.ARROW_POOL_SIZE == 20:
		_pass("test_arrow_pool_size_value")
	else:
		_fail("test_arrow_pool_size_value", "ARROW_POOL_SIZE should be 20")
	
	if pool.ENEMY_POOL_SIZE == 15:
		_pass("test_enemy_pool_size_value")
	else:
		_fail("test_enemy_pool_size_value", "ENEMY_POOL_SIZE should be 15")
	
	if pool.HIT_EFFECT_POOL_SIZE == 10:
		_pass("test_hit_effect_pool_size_value")
	else:
		_fail("test_hit_effect_pool_size_value", "HIT_EFFECT_POOL_SIZE should be 10")
	
	pool.queue_free()

func test_initial_state() -> void:
	var pool = _create_object_pool()
	
	# Test that pools are initialized after _ready
	# The pool should have created initial objects
	var stats = pool.get_statistics()
	
	if stats.has("arrows") and stats.has("enemies") and stats.has("hit_effects"):
		_pass("test_initial_state_statistics")
	else:
		_fail("test_initial_state_statistics", "Statistics should have arrows, enemies, hit_effects")
	
	pool.queue_free()

func test_pool_size_constants() -> void:
	var pool = _create_object_pool()
	
	# Verify pool constants are defined and positive
	if pool.ARROW_POOL_SIZE > 0:
		_pass("test_arrow_pool_size_positive")
	else:
		_fail("test_arrow_pool_size_positive", "ARROW_POOL_SIZE should be positive")
	
	if pool.ENEMY_POOL_SIZE > 0:
		_pass("test_enemy_pool_size_positive")
	else:
		_fail("test_enemy_pool_size_positive", "ENEMY_POOL_SIZE should be positive")
	
	if pool.HIT_EFFECT_POOL_SIZE > 0:
		_pass("test_hit_effect_pool_size_positive")
	else:
		_fail("test_hit_effect_pool_size_positive", "HIT_EFFECT_POOL_SIZE should be positive")
	
	pool.queue_free()

func test_get_and_return_arrow() -> void:
	var pool = _create_object_pool()
	
	# Get initial available count
	var initial_stats = pool.get_statistics()
	var initial_available = initial_stats.arrows.available
	
	# Get an arrow
	var arrow = pool.get_arrow()
	
	# Arrow should not be null
	if arrow != null:
		_pass("test_get_arrow_not_null")
	else:
		_fail("test_get_arrow_not_null", "get_arrow should return a node")
	
	# Check that active count increased
	var after_get_stats = pool.get_statistics()
	if after_get_stats.arrows.active >= 1:
		_pass("test_get_arrow_increases_active")
	else:
		_fail("test_get_arrow_increases_active", "Active arrows should be >= 1")
	
	# Return the arrow
	pool.return_arrow(arrow)
	
	# Wait a moment for processing
	await get_tree().create_timer(0.1).timeout
	
	# Check that available count increased
	var after_return_stats = pool.get_statistics()
	if after_return_stats.arrows.available >= initial_available:
		_pass("test_return_arrow_increases_available")
	else:
		_fail("test_return_arrow_increases_available", "Available arrows should be >= initial")
	
	# Check that arrow is no longer active
	if after_return_stats.arrows.active == after_get_stats.arrows.active - 1:
		_pass("test_return_arrow_decreases_active")
	else:
		_fail("test_return_arrow_decreases_active", "Active arrows should decrease after return")
	
	pool.queue_free()

func test_get_and_return_enemy() -> void:
	var pool = _create_object_pool()
	
	# Get initial available count
	var initial_stats = pool.get_statistics()
	var initial_available = initial_stats.enemies.available
	
	# Get an enemy
	var enemy = pool.get_enemy()
	
	# Enemy should not be null
	if enemy != null:
		_pass("test_get_enemy_not_null")
	else:
		_fail("test_get_enemy_not_null", "get_enemy should return a node")
	
	# Check that active count increased
	var after_get_stats = pool.get_statistics()
	if after_get_stats.enemies.active >= 1:
		_pass("test_get_enemy_increases_active")
	else:
		_fail("test_get_enemy_increases_active", "Active enemies should be >= 1")
	
	# Return the enemy
	pool.return_enemy(enemy)
	
	# Wait a moment for processing
	await get_tree().create_timer(0.1).timeout
	
	# Check that available count increased
	var after_return_stats = pool.get_statistics()
	if after_return_stats.enemies.available >= initial_available:
		_pass("test_return_enemy_increases_available")
	else:
		_fail("test_return_enemy_increases_available", "Available enemies should be >= initial")
	
	pool.queue_free()

func test_get_and_return_hit_effect() -> void:
	var pool = _create_object_pool()
	
	# Get initial available count
	var initial_stats = pool.get_statistics()
	var initial_available = initial_stats.hit_effects.available
	
	# Get a hit effect
	var effect = pool.get_hit_effect()
	
	# Effect should not be null
	if effect != null:
		_pass("test_get_hit_effect_not_null")
	else:
		_fail("test_get_hit_effect_not_null", "get_hit_effect should return a node")
	
	# Check that active count increased
	var after_get_stats = pool.get_statistics()
	if after_get_stats.hit_effects.active >= 1:
		_pass("test_get_hit_effect_increases_active")
	else:
		_fail("test_get_hit_effect_increases_active", "Active hit effects should be >= 1")
	
	# Return the effect
	pool.return_hit_effect(effect)
	
	# Wait a moment for processing
	await get_tree().create_timer(0.1).timeout
	
	# Check that available count increased
	var after_return_stats = pool.get_statistics()
	if after_return_stats.hit_effects.available >= initial_available:
		_pass("test_return_hit_effect_increases_available")
	else:
		_fail("test_return_hit_effect_increases_available", "Available hit effects should be >= initial")
	
	pool.queue_free()

func test_object_reuse() -> void:
	var pool = _create_object_pool()
	
	# Get an arrow
	var arrow1 = pool.get_arrow()
	pool.return_arrow(arrow1)
	await get_tree().create_timer(0.1).timeout
	
	# Get another arrow - should be the same object (reused)
	var arrow2 = pool.get_arrow()
	
	# Check that arrows were reused (created count should stay low)
	var stats = pool.get_statistics()
	
	# If reuse is working, reused count should be > 0 after getting 2 arrows
	if stats.arrows.reused >= 1:
		_pass("test_object_reuse")
	else:
		_fail("test_object_reuse", "Arrows should be reused")
	
	pool.queue_free()

func test_statistics() -> void:
	var pool = _create_object_pool()
	
	# Get initial statistics
	var initial_stats = pool.get_statistics()
	var initial_created = initial_stats.arrows.created
	var initial_reused = initial_stats.arrows.reused
	
	# Get and return an arrow
	var arrow = pool.get_arrow()
	pool.return_arrow(arrow)
	await get_tree().create_timer(0.1).timeout
	
	# Get updated statistics
	var updated_stats = pool.get_statistics()
	
	# Created or reused should have increased
	if updated_stats.arrows.created + updated_stats.arrows.reused > initial_created + initial_reused:
		_pass("test_statistics_tracks_acquisitions")
	else:
		_fail("test_statistics_tracks_acquisitions", "Statistics should track acquisitions")
	
	pool.queue_free()

func test_statistics_structure() -> void:
	var pool = _create_object_pool()
	
	var stats = pool.get_statistics()
	
	# Test arrows structure
	if stats.arrows.has("active") and stats.arrows.has("available") and stats.arrows.has("created") and stats.arrows.has("reused") and stats.arrows.has("reuse_rate"):
		_pass("test_statistics_arrows_structure")
	else:
		_fail("test_statistics_arrows_structure", "Arrows stats should have all fields")
	
	# Test enemies structure
	if stats.enemies.has("active") and stats.enemies.has("available") and stats.enemies.has("created") and stats.enemies.has("reused") and stats.enemies.has("reuse_rate"):
		_pass("test_statistics_enemies_structure")
	else:
		_fail("test_statistics_enemies_structure", "Enemies stats should have all fields")
	
	# Test hit_effects structure
	if stats.hit_effects.has("active") and stats.hit_effects.has("available") and stats.hit_effects.has("created") and stats.hit_effects.has("reused") and stats.hit_effects.has("reuse_rate"):
		_pass("test_statistics_hit_effects_structure")
	else:
		_fail("test_statistics_hit_effects_structure", "Hit effects stats should have all fields")
	
	pool.queue_free()

func test_reuse_rate_calculation() -> void:
	var pool = _create_object_pool()
	
	var stats = pool.get_statistics()
	
	# Reuse rate should be a float between 0 and 100
	if typeof(stats.arrows.reuse_rate) == TYPE_FLOAT:
		_pass("test_reuse_rate_type")
	else:
		_fail("test_reuse_rate_type", "Reuse rate should be float")
	
	if stats.arrows.reuse_rate >= 0.0 and stats.arrows.reuse_rate <= 100.0:
		_pass("test_reuse_rate_range")
	else:
		_fail("test_reuse_rate_range", "Reuse rate should be between 0 and 100")
	
	# Test reuse rate calculation manually
	# If nothing created/reused yet, rate should be 0
	if stats.arrows.created == 0 and stats.arrows.reused == 0:
		if stats.arrows.reuse_rate == 0.0:
			_pass("test_reuse_rate_zero")
		else:
			_fail("test_reuse_rate_zero", "Reuse rate should be 0 when no activity")
	
	pool.queue_free()

func test_cleanup_invalid_instances() -> void:
	var pool = _create_object_pool()
	
	# Get some objects
	var arrow = pool.get_arrow()
	var enemy = pool.get_enemy()
	
	# Get initial active counts
	var initial_stats = pool.get_statistics()
	var initial_active_arrows = initial_stats.arrows.active
	var initial_active_enemies = initial_stats.enemies.active
	
	# Queue free the objects to make them invalid
	arrow.queue_free()
	enemy.queue_free()
	
	await get_tree().create_timer(0.1).timeout
	
	# Run cleanup
	pool.cleanup_invalid_instances()
	
	# Check that invalid instances are cleaned up
	var after_cleanup_stats = pool.get_statistics()
	
	# Active counts should be reduced after cleanup
	if after_cleanup_stats.arrows.active < initial_active_arrows:
		_pass("test_cleanup_arrows")
	else:
		_fail("test_cleanup_arrows", "Arrow cleanup should reduce active count")
	
	if after_cleanup_stats.enemies.active < initial_active_enemies:
		_pass("test_cleanup_enemies")
	else:
		_fail("test_cleanup_enemies", "Enemy cleanup should reduce active count")
	
	pool.queue_free()

func test_return_invalid_instance() -> void:
	var pool = _create_object_pool()
	
	# Create an arrow, queue it free, then try to return it
	var arrow = pool.get_arrow()
	arrow.queue_free()
	
	await get_tree().create_timer(0.1).timeout
	
	# This should not crash
	pool.return_arrow(arrow)
	_pass("test_return_invalid_instance")
	
	pool.queue_free()

func test_warm_pools() -> void:
	var pool = _create_object_pool()
	
	# warm_pools should exist and not crash
	pool.warm_pools()
	_pass("test_warm_pools")
	
	pool.queue_free()

func test_log_statistics() -> void:
	var pool = _create_object_pool()
	
	# log_statistics should exist and not crash
	pool.log_statistics()
	_pass("test_log_statistics")
	
	pool.queue_free()
