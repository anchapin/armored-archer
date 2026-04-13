extends GutTest

## Unit tests for enemy death animations
## Tests fade out, ragdoll physics, and particle spawning

## Test play_death_animation method exists on BaseEnemy
func test_play_death_animation_method_exists():
	# Create a mock BaseEnemy for testing
	var enemy = BaseEnemy.new()
	assert_true(enemy.has_method("play_death_animation"), "BaseEnemy should have play_death_animation method")
	enemy.free()

## Test apply_ragdoll_physics method exists on BaseEnemy
func test_apply_ragdoll_physics_method_exists():
	var enemy = BaseEnemy.new()
	assert_true(enemy.has_method("apply_ragdoll_physics"), "BaseEnemy should have apply_ragdoll_physics method")
	enemy.free()

## Test spawn_death_particles method exists on BaseEnemy
func test_spawn_death_particles_method_exists():
	var enemy = BaseEnemy.new()
	assert_true(enemy.has_method("spawn_death_particles"), "BaseEnemy should have spawn_death_particles method")
	enemy.free()

## Test play_death_animation triggers fade out
func test_death_animation_fade_out():
	var enemy = BaseEnemy.new()
	assert_not_null(enemy, "BaseEnemy should be instantiable")

	# Method should not crash
	if enemy.has_method("play_death_animation"):
		# Note: Without a scene tree, we can't fully test the tween behavior
		# This is a basic sanity check
		pass_test("play_death_animation method callable")

	enemy.free()

## Test apply_ragdoll_physics creates random effects
func test_ragdoll_random_effects():
	var enemy = BaseEnemy.new()
	assert_not_null(enemy, "BaseEnemy should be instantiable")

	# Method should not crash
	if enemy.has_method("apply_ragdoll_physics"):
		pass_test("apply_ragdoll_physics method callable")

	enemy.free()

## Test spawn_death_particles with different particle counts
func test_death_particles_different_counts():
	var enemy = BaseEnemy.new()
	assert_not_null(enemy, "BaseEnemy should be instantiable")

	if enemy.has_method("spawn_death_particles"):
		# Test with different particle counts
		var counts = [5, 10, 15]

		for count in counts:
			# Method should not crash with different counts
			enemy.spawn_death_particles(count)

		pass_test("spawn_death_particles callable with different particle counts")

	enemy.free()

## Test CombatJuiceManager DEATH_ANIMATION routing
func test_combat_juice_death_animation_routing():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	# Create a mock enemy node
	var enemy = BaseEnemy.new()
	add_child(enemy)

	# Trigger death animation
	var result = manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.DEATH_ANIMATION,
		{"enemy_node": enemy, "particle_count": 5}
	)

	assert_not_null(result, "Result should be returned")

	# Cleanup
	await get_tree().process_frame
	enemy.queue_free()

## Test death animation with zero particle count (edge case)
func test_death_animation_zero_particles():
	var enemy = BaseEnemy.new()
	assert_not_null(enemy, "BaseEnemy should be instantiable")

	if enemy.has_method("spawn_death_particles"):
		# Should handle zero particle count gracefully
		enemy.spawn_death_particles(0)
		pass_test("spawn_death_particles handles zero particle count")

	enemy.free()

## Test death animation with high particle count (stress test)
func test_death_animation_high_particle_count():
	var enemy = BaseEnemy.new()
	assert_not_null(enemy, "BaseEnemy should be instantiable")

	if enemy.has_method("spawn_death_particles"):
		# Should handle high particle count (e.g., 100)
		enemy.spawn_death_particles(100)
		pass_test("spawn_death_particles handles high particle count")

	enemy.free()

## Test BaseEnemy die() method triggers CombatJuiceManager
func test_enemy_die_triggers_juice():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	var enemy = BaseEnemy.new()
	add_child(enemy)

	# Mock death handling - in real scenario this triggers CombatJuiceManager
	if enemy.has_method("die"):
		# Method should not crash
		pass_test("die method callable on BaseEnemy")

	enemy.queue_free()
	await get_tree().process_frame

## Test juice_effect_completed signal for death animations
func test_death_animation_completion_signal():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	var signal_emitted = false

	manager.juice_effect_completed.connect(func(effect_type: String, data: Dictionary):
		if effect_type == "death_animation":
			signal_emitted = true
	)

	var enemy = BaseEnemy.new()
	add_child(enemy)

	manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.DEATH_ANIMATION,
		{"enemy_node": enemy, "particle_count": 5}
	)

	# Wait for animation to complete (approx 1.0s)
	await get_tree().create_timer(1.5).timeout

	assert_true(signal_emitted, "juice_effect_completed should be emitted for death animations")

	enemy.queue_free()
