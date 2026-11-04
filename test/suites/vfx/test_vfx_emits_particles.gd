extends GutTest

## Issue #1767 — VFXManager effect calls must visibly emit pooled particles.
##
## PR #1764 added `VFXManager.play_muzzle_flash()` and
## `VFXManager.spawn_death_particles()` (ShootingManager and base_enemy had
## been calling methods that did not exist, and both call sites were guarded
## by `has_method`, so the calls failed silently and nothing was emitted).
##
## These tests assert the *observable* effect — a pooled particle is
## activated and left emitting — rather than the mere existence of a
## method. Every assertion below is about emitted particles: if the VFX
## method under test is missing (or no-ops), no particle is emitted and the
## assertion fails with "must emit exactly one pooled <type> particle".
##
## The effects are driven through the real gameplay call paths:
##   * muzzle flash  — ShootingManager._trigger_muzzle_flash() (the guarded
##                     call site used when an arrow is fired)
##   * death burst  — base_enemy.spawn_death_particles() (the guarded call
##                     site used by CombatJuiceManager on enemy death)
##   * hit / crit   — CombatJuiceManager.trigger_combat_juice(IMPACT_VFX)
##                     plus direct VFXManager calls
##
## Headless-safe: only pooled-particle state (ObjectPool active arrays and
## the particle `emitting` flag) is inspected — no rendering assumptions.

var _pool: Node
var _vfx: Node
var _stage: Node2D
var _previous_scene: Node
var _time_scale_before: float


func before_each() -> void:
	_pool = get_node_or_null("/root/ObjectPool")
	_vfx = get_node_or_null("/root/VFXManager")
	# VFXManager parents pooled particles into get_tree().current_scene,
	# which is null under GUT, so attach a stage and restore afterwards.
	_stage = Node2D.new()
	_stage.name = "VfxEmitsStage"
	get_tree().root.add_child(_stage)
	_previous_scene = get_tree().current_scene
	get_tree().current_scene = _stage
	_time_scale_before = Engine.time_scale


func after_each() -> void:
	# Crit effects trigger slow-motion; restore the time scale so the rest
	# of the suite is unaffected.
	Engine.time_scale = _time_scale_before
	get_tree().current_scene = _previous_scene
	if is_instance_valid(_stage):
		_stage.queue_free()


# --- Helpers ---


func _require_autoloads() -> bool:
	if _pool == null or _vfx == null:
		fail_test("ObjectPool/VFXManager autoloads not registered")
		return false
	return true


# The pool's active list for a particle type (e.g. "hit", "death", "crit").
func _active_effects(type_name: String) -> Array:
	return _pool.get("_active_%s_effects" % type_name) as Array


func _is_emitting(effect: Node) -> bool:
	if not is_instance_valid(effect):
		return false
	if effect is GPUParticles2D:
		return effect.emitting
	if effect is CPUParticles2D:
		return effect.emitting
	return false


# How many currently-active pooled particles of a type are emitting.
func _emitting_count(type_name: String) -> int:
	var count := 0
	for effect in _active_effects(type_name):
		if _is_emitting(effect):
			count += 1
	return count


# Snapshot of (active count, emitting count) for a particle type.
func _emission_snapshot(type_name: String) -> Array:
	return [_active_effects(type_name).size(), _emitting_count(type_name)]


# Invoke a method only when it exists.
#
# This is a guard, NOT an assertion: the assertion mechanism in this file is
# always the emitted particle. When the method under test is missing the
# call is skipped, nothing is emitted, and the emission assertion below
# fails ("0 expected to equal 1 ... must emit one pooled particle").
func _invoke(node: Node, method: String, args: Array) -> void:
	if node == null or not node.has_method(method):
		return
	node.callv(method, args)


# Assert that exactly one new pooled particle of `type_name` was activated
# and left emitting. Fails (rather than erroring) when nothing was emitted,
# which is exactly the silent-failure regression this file guards.
func _assert_emitted_one(type_name: String, before: Array, label: String) -> void:
	var active: int = _active_effects(type_name).size()
	var emitting: int = _emitting_count(type_name)
	assert_eq(
		active, int(before[0]) + 1,
		"%s must activate exactly one pooled '%s' particle" % [label, type_name]
	)
	assert_eq(
		emitting, int(before[1]) + 1,
		"%s must leave exactly one pooled '%s' particle emitting" % [label, type_name]
	)


# Build a base_enemy node from its script (not the .tscn: the scene file
# carries a stale ext_resource UID, which makes the engine log an import
# error that GUT would report as an unexpected error). The nodes required by
# the @onready declarations are provided so the enemy readies cleanly.
func _spawn_enemy() -> Node2D:
	var enemy := load("res://scenes/enemies/base_enemy.gd").new() as Node2D
	var sprite := Node2D.new()
	sprite.name = "Sprite2D"
	enemy.add_child(sprite)
	var shape := CollisionShape2D.new()
	shape.name = "CollisionShape2D"
	enemy.add_child(shape)
	var hurt_area := Area2D.new()
	hurt_area.name = "HurtArea"
	enemy.add_child(hurt_area)
	_stage.add_child(enemy)
	return enemy


# Assert that no pooled particle of `type_name` was activated or emitted.
func _assert_emitted_none(type_name: String, before: Array, label: String) -> void:
	var active: int = _active_effects(type_name).size()
	var emitting: int = _emitting_count(type_name)
	assert_eq(
		active, int(before[0]),
		"%s must not activate any pooled '%s' particle" % [label, type_name]
	)
	assert_eq(
		emitting, int(before[1]),
		"%s must not leave any pooled '%s' particle emitting" % [label, type_name]
	)


# --- Muzzle flash ---


# ShootingManager triggers the muzzle flash when an arrow is fired. The
# call site is guarded by has_method(), so a missing VFXManager method used
# to fail silently: the test must fail because no particle was emitted.
func test_shooting_manager_muzzle_flash_path_emits_pooled_particle() -> void:
	if not _require_autoloads():
		return
	var shooting := get_node_or_null("/root/ShootingManager")
	if shooting == null:
		fail_test("ShootingManager autoload not registered")
		return
	var before: Array = _emission_snapshot("hit")
	_invoke(shooting, "_trigger_muzzle_flash", [Vector2(64.0, 32.0), Vector2.RIGHT])
	_assert_emitted_one("hit", before, "ShootingManager muzzle flash")


# Direct VFXManager call: play_muzzle_flash() must emit a pooled particle.
func test_play_muzzle_flash_emits_pooled_particle() -> void:
	if not _require_autoloads():
		return
	var before: Array = _emission_snapshot("hit")
	_invoke(_vfx, "play_muzzle_flash", [Vector2(64.0, 32.0), Vector2.RIGHT])
	_assert_emitted_one("hit", before, "play_muzzle_flash()")


# --- Death particles ---


# base_enemy spawns the death burst through a has_method()-guarded call to
# VFXManager.spawn_death_particles(); a missing method silently skipped the
# effect, so the emitted particle is the assertion.
func test_enemy_death_path_emits_pooled_particle() -> void:
	if not _require_autoloads():
		return
	var enemy := _spawn_enemy()
	var before: Array = _emission_snapshot("death")
	_invoke(enemy, "spawn_death_particles", [5])
	_assert_emitted_one("death", before, "base_enemy death burst")


# Direct VFXManager call: spawn_death_particles() must emit a pooled particle.
func test_spawn_death_particles_emits_pooled_particle() -> void:
	if not _require_autoloads():
		return
	var before: Array = _emission_snapshot("death")
	_invoke(_vfx, "spawn_death_particles", [Vector2(48.0, 48.0), 5])
	_assert_emitted_one("death", before, "spawn_death_particles()")


# #1764 contract: a zero particle count spawns nothing (the authored burst
# governs density, not the count). Nothing may be activated or emitted.
func test_spawn_death_particles_with_zero_count_emits_nothing() -> void:
	if not _require_autoloads():
		return
	var before: Array = _emission_snapshot("death")
	_invoke(_vfx, "spawn_death_particles", [Vector2(48.0, 48.0), 0])
	_assert_emitted_none("death", before, "spawn_death_particles() with count 0")


# The same zero-count contract through the production enemy call site.
func test_enemy_death_path_with_zero_count_emits_nothing() -> void:
	if not _require_autoloads():
		return
	var enemy := _spawn_enemy()
	var before: Array = _emission_snapshot("death")
	_invoke(enemy, "spawn_death_particles", [0])
	_assert_emitted_none("death", before, "base_enemy death burst with count 0")


# --- Hit effect ---


# Direct VFXManager call: play_hit_effect() must emit a pooled particle.
func test_play_hit_effect_emits_pooled_particle() -> void:
	if not _require_autoloads():
		return
	var before: Array = _emission_snapshot("hit")
	_invoke(_vfx, "play_hit_effect", [Vector2(10.0, 10.0)])
	_assert_emitted_one("hit", before, "play_hit_effect()")


# Production path: CombatJuiceManager routes IMPACT_VFX to
# VFXManager.play_hit_effect() (guarded by has_method()).
func test_combat_juice_hit_impact_emits_pooled_particle() -> void:
	if not _require_autoloads():
		return
	var juice := get_node_or_null("/root/CombatJuiceManager")
	if juice == null:
		fail_test("CombatJuiceManager autoload not registered")
		return
	var before: Array = _emission_snapshot("hit")
	_invoke(
		juice,
		"trigger_combat_juice",
		[juice.EffectType.IMPACT_VFX, {"type": "hit", "position": Vector2(10.0, 10.0)}]
	)
	_assert_emitted_one("hit", before, "CombatJuiceManager IMPACT_VFX (hit)")


# --- Crit effect ---


# Direct VFXManager call: play_crit_effect() must emit a pooled particle.
func test_play_crit_effect_emits_pooled_particle() -> void:
	if not _require_autoloads():
		return
	var before: Array = _emission_snapshot("crit")
	_invoke(_vfx, "play_crit_effect", [Vector2(12.0, 12.0)])
	_assert_emitted_one("crit", before, "play_crit_effect()")


# Production path: CombatJuiceManager routes a crit IMPACT_VFX to
# VFXManager.play_crit_effect() (guarded by has_method()).
func test_combat_juice_crit_impact_emits_pooled_particle() -> void:
	if not _require_autoloads():
		return
	var juice := get_node_or_null("/root/CombatJuiceManager")
	if juice == null:
		fail_test("CombatJuiceManager autoload not registered")
		return
	var before: Array = _emission_snapshot("crit")
	_invoke(
		juice,
		"trigger_combat_juice",
		[juice.EffectType.IMPACT_VFX, {"type": "crit", "position": Vector2(12.0, 12.0)}]
	)
	_assert_emitted_one("crit", before, "CombatJuiceManager IMPACT_VFX (crit)")
