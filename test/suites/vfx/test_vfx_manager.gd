extends GutTest

## Issue #1090 / #1185 — VFXManager routing coverage.
##
## Verifies that the production VFXManager wiring routes death/crit/miss/
## fire/ice/lightning spawns, damage popups, and arrow trails through the
## ObjectPool autoload, and that CombatJuiceManager.trigger_combat_juice()
## dispatches its typed EffectType enum (String→EffectType fix, issue
## #1056) to the pooled popup path. Issue #1136 adds coverage for the
## charge_effect paths (play_charge_effect and the power-up pickup/attach
## VFX) routed through the charge pool.
##
## Uses the registered /root/VFXManager and /root/ObjectPool autoloads on
## purpose: the routing under test resolves the pool via /root lookups, so
## exercising the real wiring catches detached-production-path regressions.

var _pool: Node
var _vfx: Node
var _stage: Node2D
var _previous_scene: Node
var _juice_script: GDScript


func before_all() -> void:
	_juice_script = load("res://autoloads/CombatJuiceManager.gd")


func before_each() -> void:
	_pool = get_node_or_null("/root/ObjectPool")
	_vfx = get_node_or_null("/root/VFXManager")
	# VFXManager parents pooled particles into get_tree().current_scene,
	# which is null under GUT. current_scene must be a direct child of the
	# scene root, so attach the stage there and restore the previous scene
	# afterwards.
	_stage = Node2D.new()
	_stage.name = "VfxRoutingStage"
	get_tree().root.add_child(_stage)
	_previous_scene = get_tree().current_scene
	get_tree().current_scene = _stage


func after_each() -> void:
	get_tree().current_scene = _previous_scene
	if is_instance_valid(_stage):
		_stage.queue_free()


# --- Helpers ---

# Fail fast with a clear message when the autoloads are not registered.
func _require_autoloads() -> bool:
	if _pool == null or _vfx == null:
		fail_test("ObjectPool/VFXManager autoloads not registered")
		return false
	return true


# created + reused for a pool type: how many acquires reached ObjectPool.
func _acquires(type_name: String) -> int:
	var stats: Dictionary = \
		(_pool.get_statistics() as Dictionary)[type_name + "_effects"]
	return stats.created + stats.reused


func _popup_acquires() -> int:
	var stats: Dictionary = \
		(_pool.get_statistics() as Dictionary).damage_popups
	return stats.created + stats.reused


func _trail_acquires() -> int:
	var stats: Dictionary = \
		(_pool.get_statistics() as Dictionary).arrow_trails
	return stats.created + stats.reused


# --- Pooled particle routing ---


# play_<type>_effect() must acquire exactly one particle from ObjectPool,
# reparent it into the current scene, and auto-return it to the pool when
# the one-shot `finished` signal fires.
func test_play_elemental_effects_route_through_object_pool() -> void:
	if not _require_autoloads():
		return
	for type_name in ["crit", "miss", "fire", "ice", "lightning", "death"]:
		var before: int = _acquires(type_name)
		_vfx.call("play_%s_effect" % type_name, Vector2(20.0, 20.0))
		assert_eq(
			_acquires(type_name) - before, 1,
			"play_%s_effect() must acquire exactly one particle from the pool"
				% type_name
		)
		var effect: GPUParticles2D = \
			(_pool.get("_active_%s_effects" % type_name) as Array).back()
		assert_eq(
			effect.get_parent(), _stage,
			"%s particle must be parented into the current scene" % type_name
		)
		assert_true(
			effect.emitting,
			"%s particle must be emitting after spawn" % type_name
		)

		# Auto-return wiring: the finished signal must send it back to the
		# pool (reparented under ObjectPool), not queue_free it.
		effect.emit_signal("finished")
		await get_tree().process_frame
		assert_true(
			(_pool.get("_%s_effect_pool" % type_name) as Array).has(effect),
			"%s particle must return to its pool on the finished signal"
				% type_name
		)


# show_damage_popup() must acquire the Label from ObjectPool, configure it,
# and return it to the pool via the safety-net tween (issue #1090 keeps
# popups alive for reuse instead of queue_free'ing them).
func test_show_damage_popup_routes_through_pool_and_returns_via_safety_net() -> void:
	if not _require_autoloads():
		return
	var before: int = _popup_acquires()
	_vfx.show_damage_popup(42, Vector2(100.0, 100.0), true, false, false)
	assert_eq(
		_popup_acquires() - before, 1,
		"show_damage_popup() must acquire one popup from the pool"
	)
	var popup: Label = (_pool._active_damage_popups as Array).back()
	assert_eq(
		popup.get_parent(), _stage,
		"popup must be parented into the current scene"
	)
	assert_eq(
		popup.text, "42!", "crit popup must show the damage with a marker"
	)
	assert_true(popup.visible, "popup must be visible after spawn")

	# Isolate the safety-net tween by disabling the popup's own _process
	# return path, then wait past the tween's interval.
	popup.set_process(false)
	await wait_seconds(float(popup.lifetime) + 0.4)
	assert_true(
		is_instance_valid(popup),
		"popup must never be queue_free'd (issue #1090)"
	)
	assert_true(
		(_pool._damage_popup_pool as Array).has(popup),
		"safety-net tween must return the popup to the pool"
	)
	# The return path does not reparent; keep the shared autoload consistent.
	popup.reparent(_pool)


# spawn_arrow_trail() must source the trail from ObjectPool (issue #1090).
func test_spawn_arrow_trail_routes_through_pool() -> void:
	if not _require_autoloads():
		return
	var parent: Node2D = Node2D.new()
	add_child_autofree(parent)
	var before: int = _trail_acquires()
	var trail: GPUParticles2D = _vfx.spawn_arrow_trail(parent)
	assert_eq(
		_trail_acquires() - before, 1,
		"spawn_arrow_trail() must acquire one trail from the pool"
	)
	assert_eq(
		trail.get_parent(), parent,
		"trail must be attached to the requested parent"
	)
	assert_true(trail.emitting, "trail must be emitting while attached")

	_pool.return_arrow_trail(trail)
	assert_true(
		(_pool._arrow_trail_pool as Array).has(trail),
		"trail must be back in its pool after return"
	)
	# The return path does not reparent; keep the shared autoload consistent.
	trail.reparent(_pool)


# --- Charge effect routing (issue #1136) ---


# play_charge_effect() must acquire its looping particle from the charge
# pool and attach it to the requested parent; the caller releases it via
# ObjectPool.return_charge_effect() (mirrors the arrow-trail contract).
func test_play_charge_effect_routes_through_pool() -> void:
	if not _require_autoloads():
		return
	var parent: Node2D = Node2D.new()
	add_child_autofree(parent)
	var before: int = _acquires("charge")
	_vfx.play_charge_effect(Vector2(15.0, 15.0), parent)
	assert_eq(
		_acquires("charge") - before, 1,
		"play_charge_effect() must acquire exactly one particle from the pool"
	)
	var effect: GPUParticles2D = (_pool._active_charge_effects as Array).back()
	assert_eq(
		effect.get_parent(), parent,
		"charge particle must be attached to the requested parent"
	)
	assert_true(
		effect.emitting, "charge particle must be emitting while attached"
	)

	# Caller-driven release contract: return puts it back in the pool.
	_pool.return_charge_effect(effect)
	assert_true(
		(_pool._charge_effect_pool as Array).has(effect),
		"charge particle must return to its pool on release"
	)
	# The direct return path does not reparent; keep the shared autoload
	# consistent.
	effect.reparent(_pool)


# spawn_power_up_pickup_vfx() must acquire its burst from the charge pool,
# parent it into the current scene, and auto-return it via the burst tween
# instead of queue_free'ing it (issue #1136).
func test_power_up_pickup_vfx_routes_through_pool_and_auto_returns() -> void:
	if not _require_autoloads():
		return
	var before: int = _acquires("charge")
	_vfx.spawn_power_up_pickup_vfx(Vector2(50.0, 50.0), "speed")
	assert_eq(
		_acquires("charge") - before, 1,
		"spawn_power_up_pickup_vfx() must acquire one particle from the pool"
	)
	var effect: GPUParticles2D = (_pool._active_charge_effects as Array).back()
	assert_eq(
		effect.get_parent(), _stage,
		"pickup burst must be parented into the current scene"
	)
	assert_true(effect.emitting, "pickup burst must be emitting after spawn")
	assert_eq(
		effect.modulate, Color(0.3, 1.0, 0.5, 0.7),
		"pickup burst must use the power-up type color"
	)

	# Burst tween (0.3s scale + 0.5s fade) must return it to the pool.
	await wait_seconds(1.0)
	assert_true(
		is_instance_valid(effect),
		"pickup burst must never be queue_free'd (issue #1136)"
	)
	assert_true(
		(_pool._charge_effect_pool as Array).has(effect),
		"pickup burst must auto-return to the pool when the burst tween ends"
	)
	assert_eq(
		effect.get_parent(), _pool,
		"returned charge particle must be reparented under ObjectPool"
	)
	assert_eq(
		effect.modulate, Color(1, 1, 1, 1),
		"return must restore the authored modulate for the next acquire"
	)
	assert_eq(
		effect.scale, Vector2.ONE,
		"return must restore the authored scale for the next acquire"
	)


# attach/detach_power_up_vfx() must round-trip the looping particle through
# the charge pool instead of instantiate()/queue_free (issue #1136).
func test_power_up_attach_detach_round_trip_through_pool() -> void:
	if not _require_autoloads():
		return
	var target: Node2D = Node2D.new()
	add_child_autofree(target)
	var before: int = _acquires("charge")
	_vfx.attach_power_up_vfx(target, "damage")
	assert_eq(
		_acquires("charge") - before, 1,
		"attach_power_up_vfx() must acquire one particle from the pool"
	)
	var effect: GPUParticles2D = \
		target.get_node_or_null("PowerUpVFX") as GPUParticles2D
	assert_not_null(effect, "attached particle must be named PowerUpVFX")
	assert_true(effect.emitting, "attached particle must be emitting")
	assert_false(effect.one_shot, "attached particle must loop")
	assert_true(
		(_pool._active_charge_effects as Array).has(effect),
		"attached particle must be tracked as active"
	)

	_vfx.detach_power_up_vfx(target)
	await wait_seconds(0.5)
	assert_true(
		is_instance_valid(effect),
		"detached particle must never be queue_free'd (issue #1136)"
	)
	assert_true(
		(_pool._charge_effect_pool as Array).has(effect),
		"detach fade must return the particle to the pool"
	)
	assert_eq(
		effect.get_parent(), _pool,
		"detached particle must be reparented under ObjectPool"
	)
	assert_eq(
		effect.modulate, Color(1, 1, 1, 1),
		"return must restore the authored modulate for the next acquire"
	)


# --- CombatJuiceManager routing ---


# trigger_combat_juice(EffectType.DAMAGE_NUMBER, ...) must route to the
# pooled damage-popup path through VFXManager (post-#1056 enum dispatch).
func test_trigger_combat_juice_damage_number_routes_to_pooled_popup() -> void:
	if not _require_autoloads():
		return
	var juice: Node = _juice_script.new()
	add_child_autofree(juice)
	juice._vfx_manager = _vfx
	watch_signals(juice)

	var before: int = _popup_acquires()
	juice.trigger_combat_juice(
		_juice_script.EffectType.DAMAGE_NUMBER,
		{"damage": 42, "position": Vector2(5.0, 5.0), "is_critical": true}
	)
	assert_signal_emitted(
		juice, "juice_effect_started",
		"DAMAGE_NUMBER must emit juice_effect_started"
	)
	assert_signal_emitted(
		juice, "juice_effect_completed",
		"DAMAGE_NUMBER must emit juice_effect_completed"
	)
	assert_eq(
		_popup_acquires() - before, 1,
		"DAMAGE_NUMBER must reach the pooled popup path via VFXManager"
	)
	var popup: Label = (_pool._active_damage_popups as Array).back()
	assert_eq(
		popup.text, "42!", "juice payload must configure the pooled popup"
	)

	# Cleanup: return the popup and keep the shared autoload consistent.
	popup.set_process(false)
	_pool.return_damage_popup(popup)
	popup.reparent(_pool)


# The EffectType match table must dispatch SCREEN_SHAKE to the registered
# impact handler (regression for the String→EffectType fix, issue #1056).
func test_trigger_combat_juice_routes_typed_enums_to_handlers() -> void:
	var juice: Node = _juice_script.new()
	add_child_autofree(juice)
	# Double the real ImpactManager script so shake_screen exists on the
	# double and can be stubbed/spied (GUT rejects spies on methods the
	# doubled class does not define).
	var impact_script: GDScript = load("res://autoloads/ImpactManager.gd")
	var impact_stub: Node = double(impact_script).new()
	add_child_autofree(impact_stub)
	stub(impact_stub, "shake_screen").to_return({"success": true})
	juice._impact_manager = impact_stub

	juice.trigger_combat_juice(
		_juice_script.EffectType.SCREEN_SHAKE,
		{"attack_strength": "light", "duration": 0.2, "decay": true}
	)
	assert_called(
		impact_stub, "shake_screen", ["light", 0.2, true]
	)
