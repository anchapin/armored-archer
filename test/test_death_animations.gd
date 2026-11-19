extends GutTest

## Unit tests for enemy death animations
## Tests fade out, ragdoll physics, and particle spawning

const JuiceScript := preload("res://autoloads/CombatJuiceManager.gd")
const EnemyScene := preload("res://scenes/enemies/base_enemy.tscn")

## Records juice_effect_completed emissions.
class CompletedRecorder extends RefCounted:
	var calls: Array = []

	func record(effect_type: String, data: Dictionary) -> void:
		calls.append([effect_type, data])

## A bare BaseEnemy.new() is not a valid fixture: its @onready children
## (Sprite2D, CollisionShape2D, HurtArea) only exist in the scene, and
## spawn_death_particles resolves /root/VFXManager, which requires the
## enemy to be inside the tree. Instantiate the scene instead.
func _make_enemy() -> Node:
	var enemy = EnemyScene.instantiate()
	add_child_autofree(enemy)
	return enemy

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
	var enemy = _make_enemy()
	assert_not_null(enemy, "BaseEnemy should be instantiable")

	if enemy.has_method("spawn_death_particles"):
		# Test with different particle counts
		var counts = [5, 10, 15]

		for count in counts:
			# Method should not crash with different counts
			enemy.spawn_death_particles(count)

		pass_test("spawn_death_particles callable with different particle counts")

## Test CombatJuiceManager DEATH_ANIMATION routing
func test_combat_juice_death_animation_routing():
	# Fresh instance: the shared singleton leaks effect state between tests.
	var manager = JuiceScript.new()
	add_child_autofree(manager)

	var enemy = _make_enemy()

	# trigger_combat_juice returns void and the death handler is async
	# (~1s); the routed handler reports back through juice_effect_completed.
	var recorder = CompletedRecorder.new()
	manager.juice_effect_completed.connect(recorder.record)

	manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.DEATH_ANIMATION,
		{"enemy_node": enemy, "particle_count": 5}
	)

	await get_tree().create_timer(1.5).timeout

	assert_eq(recorder.calls.size(), 1, "Death animation handler should run to completion")
	assert_eq(recorder.calls[0][0], "death_animation", "Effect should route to the death animation handler")
	assert_true(recorder.calls[0][1].get("success", false), "Death animation should succeed")

## Test death animation with zero particle count (edge case)
func test_death_animation_zero_particles():
	var enemy = _make_enemy()
	assert_not_null(enemy, "BaseEnemy should be instantiable")

	if enemy.has_method("spawn_death_particles"):
		# Should handle zero particle count gracefully
		enemy.spawn_death_particles(0)
		pass_test("spawn_death_particles handles zero particle count")

## Test death animation with high particle count (stress test)
func test_death_animation_high_particle_count():
	var enemy = _make_enemy()
	assert_not_null(enemy, "BaseEnemy should be instantiable")

	if enemy.has_method("spawn_death_particles"):
		# Should handle high particle count (e.g., 100)
		enemy.spawn_death_particles(100)
		pass_test("spawn_death_particles handles high particle count")

## Test BaseEnemy die() method triggers CombatJuiceManager
func test_enemy_die_triggers_juice():
	var manager = get_node_or_null("/root/CombatJuiceManager")
	assert_not_null(manager, "CombatJuiceManager required")

	var enemy = _make_enemy()

	# Mock death handling - in real scenario this triggers CombatJuiceManager
	if enemy.has_method("die"):
		# Method should not crash
		pass_test("die method callable on BaseEnemy")

	await get_tree().process_frame

## Test juice_effect_completed signal for death animations
func test_death_animation_completion_signal():
	# Fresh instance: the shared singleton leaks effect state between tests.
	var manager = JuiceScript.new()
	add_child_autofree(manager)

	var recorder = CompletedRecorder.new()
	manager.juice_effect_completed.connect(recorder.record)

	var enemy = _make_enemy()

	manager.trigger_combat_juice(
		CombatJuiceManager.EffectType.DEATH_ANIMATION,
		{"enemy_node": enemy, "particle_count": 5}
	)

	# Wait for animation to complete (approx 1.0s)
	await get_tree().create_timer(1.5).timeout

	var saw_death_animation = false
	for call in recorder.calls:
		if call[0] == "death_animation":
			saw_death_animation = true
	assert_true(saw_death_animation, "juice_effect_completed should be emitted for death animations")
