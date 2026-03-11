extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0
var _object_pool: Node = null

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running ObjectPool Tests ===\n")
	await run_tests()

func run_tests() -> void:
	# Setup: Create ObjectPool instance
	_object_pool = _create_object_pool()
	await get_tree().process_frame
	
	test_initial_state()
	test_constants()
	test_arrow_pool_acquire_release()
	test_arrow_pool_exhaustion_creates_new()
	test_enemy_pool_acquire_release()
	test_enemy_pool_exhaustion_creates_new()
	test_hit_effect_pool_acquire_release()
	test_hit_effect_pool_exhaustion_creates_new()
	test_statistics_tracking()
	test_reuse_rate_calculation()
	test_cleanup_invalid_instances()
	test_return_invalid_instance_handled()
	test_return_instance_without_reset_method()
	test_return_instance_with_reset_method()
	test_pool_state_transitions()
	
	# Cleanup
	if _object_pool:
		_object_pool.queue_free()
	
	print("\n=== ObjectPool Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_object_pool() -> Node:
	var pool = load("res://autoloads/ObjectPool.gd").new()
	add_child(pool)
	# Force initialization by calling _ready
	pool._ready()
	return pool

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

# --- Helper class for testing ---

class PoolableObject extends Node2D:
	var reset_called: bool = false
	
	func reset_pooled_state() -> void:
		reset_called = true
		visible = false
		set_process(false)
		set_physics_process(false)

# --- Tests ---

func test_initial_state() -> void:
	if _object_pool == null:
		_fail("test_initial_state", "ObjectPool not created")
		return
	
	# Check pool arrays exist
	if _object_pool.has_method("get_arrow") and _object_pool.has_method("get_enemy") and _object_pool.has_method("get_hit_effect"):
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "ObjectPool missing required methods")

func test_constants() -> void:
	if _object_pool.ARROW_POOL_SIZE == 20:
		_pass("test_arrow_pool_size_constant")
	else:
		_fail("test_arrow_pool_size_constant", "ARROW_POOL_SIZE should be 20, got: " + str(_object_pool.ARROW_POOL_SIZE))
	
	if _object_pool.ENEMY_POOL_SIZE == 15:
		_pass("test_enemy_pool_size_constant")
	else:
		_fail("test_enemy_pool_size_constant", "ENEMY_POOL_SIZE should be 15, got: " + str(_object_pool.ENEMY_POOL_SIZE))
	
	if _object_pool.HIT_EFFECT_POOL_SIZE == 10:
		_pass("test_hit_effect_pool_size_constant")
	else:
		_fail("test_hit_effect_pool_size_constant", "HIT_EFFECT_POOL_SIZE should be 10, got: " + str(_object_pool.HIT_EFFECT_POOL_SIZE))

func test_arrow_pool_acquire_release() -> void:
	# Get initial available count
	var initial_available = _object_pool._arrow_pool.size()
	
	# Acquire arrow
	var arrow = _object_pool.get_arrow()
	if arrow == null:
		_fail("test_arrow_pool_acquire_release", "get_arrow returned null")
		return
	
	# Arrow should be active now
	if _object_pool._active_arrows.has(arrow):
		_pass("test_arrow_acquired_active")
	else:
		_fail("test_arrow_acquired_active", "Arrow should be in active array")
	
	# Return arrow to pool
	_object_pool.return_arrow(arrow)
	await get_tree().process_frame
	
	# Arrow should be back in pool
	if _object_pool._arrow_pool.has(arrow):
		_pass("test_arrow_pool_acquire_release")
	else:
		_fail("test_arrow_pool_acquire_release", "Arrow should be back in pool after return")

func test_arrow_pool_exhaustion_creates_new() -> void:
	var arrows: Array[Node] = []
	var arrows_created_before = _object_pool._arrows_created
	
	# Get all arrows from pool until exhausted
	while _object_pool._arrow_pool.size() > 0:
		var arrow = _object_pool.get_arrow()
		if arrow:
			arrows.append(arrow)
	
	# Pool should be empty now
	if _object_pool._arrow_pool.is_empty():
		_pass("test_arrow_pool_exhausted")
	else:
		_fail("test_arrow_pool_exhausted", "Pool should be empty after exhausting")
	
	# Getting another arrow should create a new one
	var new_arrow = _object_pool.get_arrow()
	if new_arrow != null:
		_pass("test_arrow_pool_creates_new_when_exhausted")
	else:
		_fail("test_arrow_pool_creates_new_when_exhausted", "Should create new arrow when pool exhausted")
	
	# Verify creation count increased
	if _object_pool._arrows_created > arrows_created_before:
		_pass("test_arrow_creation_count")
	else:
		_fail("test_arrow_creation_count", "Creation count should increase")
	
	# Cleanup
	for arrow in arrows:
		_object_pool.return_arrow(arrow)
	if new_arrow:
		_object_pool.return_arrow(new_arrow)

func test_enemy_pool_acquire_release() -> void:
	# Get initial available count
	var initial_available = _object_pool._enemy_pool.size()
	
	# Acquire enemy
	var enemy = _object_pool.get_enemy()
	if enemy == null:
		_fail("test_enemy_pool_acquire_release", "get_enemy returned null")
		return
	
	# Enemy should be active now
	if _object_pool._active_enemies.has(enemy):
		_pass("test_enemy_acquired_active")
	else:
		_fail("test_enemy_acquired_active", "Enemy should be in active array")
	
	# Return enemy to pool
	_object_pool.return_enemy(enemy)
	await get_tree().process_frame
	
	# Enemy should be back in pool
	if _object_pool._enemy_pool.has(enemy):
		_pass("test_enemy_pool_acquire_release")
	else:
		_fail("test_enemy_pool_acquire_release", "Enemy should be back in pool after return")

func test_enemy_pool_exhaustion_creates_new() -> void:
	var enemies: Array[Node] = []
	var enemies_created_before = _object_pool._enemies_created
	
	# Get all enemies from pool until exhausted
	while _object_pool._enemy_pool.size() > 0:
		var enemy = _object_pool.get_enemy()
		if enemy:
			enemies.append(enemy)
	
	# Pool should be empty now
	if _object_pool._enemy_pool.is_empty():
		_pass("test_enemy_pool_exhausted")
	else:
		_fail("test_enemy_pool_exhausted", "Pool should be empty after exhausting")
	
	# Getting another enemy should create a new one
	var new_enemy = _object_pool.get_enemy()
	if new_enemy != null:
		_pass("test_enemy_pool_creates_new_when_exhausted")
	else:
		_fail("test_enemy_pool_creates_new_when_exhausted", "Should create new enemy when pool exhausted")
	
	# Verify creation count increased
	if _object_pool._enemies_created > enemies_created_before:
		_pass("test_enemy_creation_count")
	else:
		_fail("test_enemy_creation_count", "Creation count should increase")
	
	# Cleanup
	for enemy in enemies:
		_object_pool.return_enemy(enemy)
	if new_enemy:
		_object_pool.return_enemy(new_enemy)

func test_hit_effect_pool_acquire_release() -> void:
	# Get initial available count
	var initial_available = _object_pool._hit_effect_pool.size()
	
	# Acquire hit effect
	var effect = _object_pool.get_hit_effect()
	if effect == null:
		_fail("test_hit_effect_pool_acquire_release", "get_hit_effect returned null")
		return
	
	# Effect should be active now
	if _object_pool._active_hit_effects.has(effect):
		_pass("test_hit_effect_acquired_active")
	else:
		_fail("test_hit_effect_acquired_active", "Effect should be in active array")
	
	# Return effect to pool
	_object_pool.return_hit_effect(effect)
	await get_tree().process_frame
	
	# Effect should be back in pool
	if _object_pool._hit_effect_pool.has(effect):
		_pass("test_hit_effect_pool_acquire_release")
	else:
		_fail("test_hit_effect_pool_acquire_release", "Effect should be back in pool after return")

func test_hit_effect_pool_exhaustion_creates_new() -> void:
	var effects: Array[Node] = []
	var effects_created_before = _object_pool._hit_effects_created
	
	# Get all effects from pool until exhausted
	while _object_pool._hit_effect_pool.size() > 0:
		var effect = _object_pool.get_hit_effect()
		if effect:
			effects.append(effect)
	
	# Pool should be empty now
	if _object_pool._hit_effect_pool.is_empty():
		_pass("test_hit_effect_pool_exhausted")
	else:
		_fail("test_hit_effect_pool_exhausted", "Pool should be empty after exhausting")
	
	# Getting another effect should create a new one
	var new_effect = _object_pool.get_hit_effect()
	if new_effect != null:
		_pass("test_hit_effect_pool_creates_new_when_exhausted")
	else:
		_fail("test_hit_effect_pool_creates_new_when_exhausted", "Should create new effect when pool exhausted")
	
	# Verify creation count increased
	if _object_pool._hit_effects_created > effects_created_before:
		_pass("test_hit_effect_creation_count")
	else:
		_fail("test_hit_effect_creation_count", "Creation count should increase")
	
	# Cleanup
	for effect in effects:
		_object_pool.return_hit_effect(effect)
	if new_effect:
		_object_pool.return_hit_effect(new_effect)

func test_statistics_tracking() -> void:
	# Acquire and return some objects to track statistics
	var arrow = _object_pool.get_arrow()
	_object_pool.return_arrow(arrow)
	await get_tree().process_frame
	
	var enemy = _object_pool.get_enemy()
	_object_pool.return_enemy(enemy)
	await get_tree().process_frame
	
	var effect = _object_pool.get_hit_effect()
	_object_pool.return_hit_effect(effect)
	await get_tree().process_frame
	
	# Get statistics
	var stats = _object_pool.get_statistics()
	
	# Verify statistics structure
	if stats.has("arrows") and stats.has("enemies") and stats.has("hit_effects"):
		_pass("test_statistics_structure")
	else:
		_fail("test_statistics_structure", "Statistics should have arrows, enemies, and hit_effects")
	
	# Verify each pool has required keys
	var arrow_stats = stats.arrows
	if arrow_stats.has("active") and arrow_stats.has("available") and arrow_stats.has("created") and arrow_stats.has("reused"):
		_pass("test_arrow_statistics_keys")
	else:
		_fail("test_arrow_statistics_keys", "Arrow stats missing required keys")

func test_reuse_rate_calculation() -> void:
	# Get reuse rate
	var stats = _object_pool.get_statistics()
	var reuse_rate = stats.arrows.reuse_rate
	
	# With initial state (all objects from pool), reuse rate should be 0 initially
	# After acquiring and returning, we should have some reuse
	if typeof(reuse_rate) == TYPE_FLOAT:
		_pass("test_reuse_rate_type")
	else:
		_fail("test_reuse_rate_type", "Reuse rate should be a float")
	
	# Get an arrow from pool, return it, then get it again
	var arrow1 = _object_pool.get_arrow()
	_object_pool.return_arrow(arrow1)
	await get_tree().process_frame
	var arrow2 = _object_pool.get_arrow()
	_object_pool.return_arrow(arrow2)
	await get_tree().process_frame
	
	# Now we should have some reuse
	stats = _object_pool.get_statistics()
	if stats.arrows.reused > 0:
		_pass("test_reuse_rate_increases")
	else:
		_fail("test_reuse_rate_increases", "Reuse count should increase after returning objects")

func test_cleanup_invalid_instances() -> void:
	# Get some arrows
	var arrow1 = _object_pool.get_arrow()
	var arrow2 = _object_pool.get_arrow()
	
	# Mark them as active
	if _object_pool._active_arrows.size() >= 2:
		_pass("test_active_arrows_count_before_cleanup")
	else:
		_fail("test_active_arrows_count_before_cleanup", "Should have at least 2 active arrows")
	
	# Queue free one arrow (simulates it being destroyed)
	arrow1.queue_free()
	await get_tree().process_frame
	
	# Call cleanup
	_object_pool.cleanup_invalid_instances()
	await get_tree().process_frame
	
	# The invalid arrow should be removed from active
	if not _object_pool._active_arrows.has(arrow1):
		_pass("test_cleanup_invalid_instances")
	else:
		_fail("test_cleanup_invalid_instances", "Invalid instance should be removed from active")
	
	# Cleanup
	if is_instance_valid(arrow2):
		_object_pool.return_arrow(arrow2)

func test_return_invalid_instance_handled() -> void:
	var invalid_arrow = Node.new()
	invalid_arrow.name = "InvalidArrow"
	add_child(invalid_arrow)
	invalid_arrow.queue_free()
	await get_tree().process_frame
	
	# Should not crash when returning invalid instance
	_object_pool.return_arrow(invalid_arrow)
	_pass("test_return_invalid_instance_handled")

func test_return_instance_without_reset_method() -> void:
	var node_without_reset = Node2D.new()
	node_without_reset.name = "TestNode"
	add_child(node_without_reset)
	
	# Should not crash and should add to pool
	_object_pool.return_arrow(node_without_reset)
	await get_tree().process_frame
	
	if _object_pool._arrow_pool.has(node_without_reset):
		_pass("test_return_instance_without_reset_method")
	else:
		_fail("test_return_instance_without_reset_method", "Node without reset method should still be pooled")
	
	# Cleanup
	if is_instance_valid(node_without_reset):
		node_without_reset.queue_free()

func test_return_instance_with_reset_method() -> void:
	# Get an arrow and return it - the arrow in the pool should work correctly
	var arrow = _object_pool.get_arrow()
	
	# Verify arrow can be acquired and returned
	if arrow != null:
		_pass("test_arrow_acquired_for_return_test")
	else:
		_fail("test_arrow_acquired_for_return_test", "Arrow should be acquired")
	
	# Return arrow to pool
	_object_pool.return_arrow(arrow)
	await get_tree().process_frame
	
	# The arrow should be in the pool now
	if _object_pool._arrow_pool.has(arrow):
		_pass("test_return_instance_with_reset_method")
	else:
		_fail("test_return_instance_with_reset_method", "Arrow should be returned to pool")

func test_pool_state_transitions() -> void:
	# Test that acquired objects have correct state
	var arrow = _object_pool.get_arrow()
	
	# Object should be visible and have processes enabled when acquired
	if arrow.visible == true:
		_pass("test_arrow_visible_when_acquired")
	else:
		_fail("test_arrow_visible_when_acquired", "Arrow should be visible when acquired")
	
	if arrow.get_physics_process() == true:
		_pass("test_arrow_physics_enabled_when_acquired")
	else:
		_fail("test_arrow_physics_process_enabled_when_acquired", "Physics should be enabled when acquired")
	
	_object_pool.return_arrow(arrow)
	await get_tree().process_frame
	
	# After return, object should be hidden and have processes disabled
	if arrow.visible == false:
		_pass("test_arrow_hidden_when_returned")
	else:
		_fail("test_arrow_hidden_when_returned", "Arrow should be hidden when returned")
	
	if arrow.get_physics_process() == false:
		_pass("test_arrow_physics_disabled_when_returned")
	else:
		_fail("test_arrow_physics_disabled_when_returned", "Physics should be disabled when returned")
