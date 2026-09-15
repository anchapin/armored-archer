extends Node

## VFXManager - Centralized combat visual effects system.
## Manages particle effects, damage popups, screen shake, and other combat VFX.

# --- Singleton Instance ---
static var instance: VFXManager

# --- Particle Effects ---
const HIT_EFFECT_PATH := "res://assets/particles/hit_effect.tscn"
const CRIT_EFFECT_PATH := "res://assets/particles/crit_effect.tscn"
const MISS_EFFECT_PATH := "res://assets/particles/miss_effect.tscn"
const FIRE_EFFECT_PATH := "res://assets/particles/fire_effect.tscn"
const ICE_EFFECT_PATH := "res://assets/particles/ice_effect.tscn"
const LIGHTNING_EFFECT_PATH := "res://assets/particles/lightning_effect.tscn"
const CHARGE_EFFECT_PATH := "res://assets/particles/charge_effect.tscn"
const DEATH_EFFECT_PATH := "res://assets/particles/death_effect.tscn"
const ARROW_TRAIL_PATH := "res://assets/particles/arrow_trail.tscn"

# --- Scene References ---
const DAMAGE_POPUP_SCENE := "res://scenes/damage_popup.tscn"
const SCREEN_SHAKE_SCENE := "res://scenes/screen_shake.tscn"

# --- Preloaded Scenes ---
var _hit_effect: PackedScene
var _crit_effect: PackedScene
var _miss_effect: PackedScene
var _fire_effect: PackedScene
var _ice_effect: PackedScene
var _lightning_effect: PackedScene
var _charge_effect: PackedScene
var _death_effect: PackedScene
var _arrow_trail: PackedScene
var _damage_popup_scene: PackedScene

# --- Screen Shake Instance ---
var _screen_shake: Node = null


func _ready() -> void:
	instance = self
	_preload_scenes()


func _preload_scenes() -> void:
	"""Preload all particle effect scenes for instant playback."""
	_hit_effect = load(HIT_EFFECT_PATH)
	_crit_effect = load(CRIT_EFFECT_PATH)
	_miss_effect = load(MISS_EFFECT_PATH)
	_fire_effect = load(FIRE_EFFECT_PATH)
	_ice_effect = load(ICE_EFFECT_PATH)
	_lightning_effect = load(LIGHTNING_EFFECT_PATH)
	_charge_effect = load(CHARGE_EFFECT_PATH)
	_death_effect = load(DEATH_EFFECT_PATH)
	_arrow_trail = load(ARROW_TRAIL_PATH)
	_damage_popup_scene = load(DAMAGE_POPUP_SCENE)

	# Preload screen shake (lazy initialization)
	_screen_shake = null


func _ensure_screen_shake() -> void:
	"""Ensure screen shake is initialized."""
	# Check if existing screen shake is still valid (scene might have changed)
	if _screen_shake != null and is_instance_valid(_screen_shake):
		return

	var screen_shake_scene := load(SCREEN_SHAKE_SCENE)
	_screen_shake = screen_shake_scene.instantiate()
	var current_scene := get_tree().current_scene
	if current_scene == null:
		push_warning("VFXManager: No current scene - screen shake not attached")
		return
	current_scene.add_child(_screen_shake)


# === Particle Effect Methods ===

func play_hit_effect(global_position: Vector2) -> void:
	"""Play standard hit particle effect (issue #1090: routed through ObjectPool)."""
	_spawn_pooled_particle("hit", global_position)


func play_crit_effect(global_position: Vector2) -> void:
	"""Play critical hit effect with gold particles."""
	_spawn_pooled_particle("crit", global_position)
	_trigger_crit_shake()
	_trigger_slow_motion()


func play_miss_effect(global_position: Vector2) -> void:
	"""Play miss/dodge effect with gray particles."""
	_spawn_pooled_particle("miss", global_position)


func play_fire_effect(global_position: Vector2) -> void:
	"""Play fire elemental damage effect."""
	_spawn_pooled_particle("fire", global_position)


func play_ice_effect(global_position: Vector2) -> void:
	"""Play ice/frost elemental damage effect."""
	_spawn_pooled_particle("ice", global_position)


func play_lightning_effect(global_position: Vector2) -> void:
	"""Play lightning elemental damage effect."""
	_spawn_pooled_particle("lightning", global_position)
	_trigger_lightning_shake()


func play_charge_effect(global_position: Vector2, parent: Node) -> void:
	"""Play charging effect - attached to a parent node for continuous effects.

	Issue #1136: charge effects now come from ObjectPool (prewarm and
	device-tier budgeting apply). The effect loops while parented; the caller
	is responsible for releasing it via ObjectPool.return_charge_effect()
	when the charge ends (mirrors the arrow-trail contract).
	"""
	if not parent:
		push_warning("VFXManager: Charge effect parent not provided")
		return
	if not _charge_effect:
		return

	var effect: GPUParticles2D = ObjectPool.get_charge_effect()
	# Prewarmed charge particles are parented under ObjectPool; reparent into
	# the requested parent (mirrors the pooled arrow-trail pattern).
	if effect.get_parent() == null:
		parent.add_child(effect)
	else:
		effect.reparent(parent)
	effect.global_position = global_position


func play_death_effect(global_position: Vector2) -> void:
	"""Play death explosion effect for enemy defeat."""
	_spawn_pooled_particle("death", global_position)
	trigger_heavy_shake()


func spawn_arrow_trail(parent: Node) -> GPUParticles2D:
	"""Attach arrow trail particle to a parent node (e.g., Arrow).

	Issue #1090: trail now comes from ObjectPool.get_arrow_trail(). The returned
	trail loops while parented; the caller (or arrow return-to-pool logic) is
	responsible for releasing it via ObjectPool.return_arrow_trail().
	"""
	if not parent:
		push_warning("VFXManager: Arrow trail parent not provided")
		return null

	var trail: GPUParticles2D = ObjectPool.get_arrow_trail()
	# Prewarmed trails are still parented under ObjectPool; reparent into the
	# requested parent (mirrors the pooled-particle pattern above).
	if trail.get_parent() == null:
		parent.add_child(trail)
	else:
		trail.reparent(parent)
	return trail


# === Pool-routed particle spawn (issue #1090) ===

## Acquire the matching particle from ObjectPool and auto-release it back
## when the GPUParticles2D `finished` signal fires (one-shot effects end here).
## Charge effects use get_charge_effect() directly (issue #1136) since they
## loop while attached to a parent — see play_charge_effect,
## spawn_power_up_pickup_vfx, and attach_power_up_vfx.
func _spawn_pooled_particle(effect_type: String, global_position: Vector2) -> void:
	var current_scene := get_tree().current_scene
	if current_scene == null:
		push_warning("VFXManager: No current scene; particle skipped")
		return

	var pool := get_node_or_null("/root/ObjectPool")
	if pool == null:
		push_warning("VFXManager: ObjectPool autoload missing; particle skipped")
		return

	var effect: GPUParticles2D = null
	match effect_type:
		"hit":
			effect = ObjectPool.get_hit_effect()
		"death":
			effect = ObjectPool.get_death_effect()
		"crit":
			effect = ObjectPool.get_crit_effect()
		"miss":
			effect = ObjectPool.get_miss_effect()
		"fire":
			effect = ObjectPool.get_fire_effect()
		"ice":
			effect = ObjectPool.get_ice_effect()
		"lightning":
			effect = ObjectPool.get_lightning_effect()
		_:
			effect = ObjectPool.get_hit_effect()

	if effect == null:
		push_warning("VFXManager: ObjectPool returned null for '%s'" % effect_type)
		return

	# Reparent into the live scene (pool holds it as a child of ObjectPool)
	if effect.get_parent() == null:
		current_scene.add_child(effect)
	elif effect.get_parent() != current_scene:
		effect.reparent(current_scene)

	effect.global_position = global_position
	effect.emitting = true
	if effect.one_shot:
		effect.restart()

	# Auto-return to pool when the one-shot finishes. We reconnect the
	# finished signal fresh each spawn in case a prior spawn leaked a binding.
	for conn in effect.finished.get_connections():
		effect.finished.disconnect(conn["callable"])
	effect.finished.connect(func() -> void: _return_pooled_particle(effect_type, effect))


## Return a particle to its matching ObjectPool, reparenting it back under
## the pool so the next acquire can find it.
func _return_pooled_particle(effect_type: String, effect: Node) -> void:
	if not is_instance_valid(effect):
		return
	var pool := get_node_or_null("/root/ObjectPool")
	if pool == null:
		return

	# Detach the finished binding so a stray emission can't double-return.
	for conn in effect.finished.get_connections():
		effect.finished.disconnect(conn["callable"])

	# Reparent back under ObjectPool (no-op if already there)
	if effect.get_parent() != pool:
		if effect.get_parent() != null:
			effect.reparent(pool)
		else:
			pool.add_child(effect)

	match effect_type:
		"hit":
			ObjectPool.return_hit_effect(effect)
		"death":
			ObjectPool.return_death_effect(effect)
		"crit":
			ObjectPool.return_crit_effect(effect)
		"miss":
			ObjectPool.return_miss_effect(effect)
		"fire":
			ObjectPool.return_fire_effect(effect)
		"ice":
			ObjectPool.return_ice_effect(effect)
		"lightning":
			ObjectPool.return_lightning_effect(effect)
		_:
			ObjectPool.return_hit_effect(effect)


# === Damage Popup Methods ===

func show_damage_popup(
	damage: int,
	global_position: Vector2,
	is_crit: bool = false,
	is_miss: bool = false,
	is_heal: bool = false
) -> void:
	"""Display a floating damage number at the given position.

	Issue #1090: popup Label is acquired from ObjectPool.get_damage_popup() and
	reparented into the live scene. The popup returns itself to the pool from
	its own _process when its lifetime expires (see scripts/damage_popup.gd).
	A safety-net tween also calls return_damage_popup() in case _process is
	disabled (e.g. when the scene tree is paused for a popup that was just
		reparented but never reached its lifetime tick).
	"""
	var pool := get_node_or_null("/root/ObjectPool")
	if pool == null:
		push_warning("VFXManager: ObjectPool not available; popup skipped")
		return

	var current_scene := get_tree().current_scene
	if current_scene == null:
		push_warning("VFXManager: No current scene; popup skipped")
		return

	var popup: Label = pool.get_damage_popup()
	if popup == null:
		push_warning("VFXManager: ObjectPool returned null damage popup")
		return

	# Reparent into the live scene if needed (pool holds it under ObjectPool)
	if popup.get_parent() == null:
		current_scene.add_child(popup)
	elif popup.get_parent() != current_scene:
		popup.reparent(current_scene)

	popup.global_position = global_position + Vector2(0, -30)
	popup.setup_damage(damage, is_crit, is_miss, is_heal)

	# Safety net: if _process never reaches the lifetime threshold (e.g. the
	# popup was added while the scene tree was paused, or the popup script
	# was somehow disabled), this tween guarantees the slot is returned.
	var lifetime: float = float(popup.lifetime) if "lifetime" in popup else 1.0
	var tween := _make_tween()
	tween.tween_interval(lifetime + 0.1)
	tween.tween_callback(func() -> void:
		if is_instance_valid(popup):
			pool.return_damage_popup(popup)
	)


# === Screen Shake Methods ===

func trigger_light_shake() -> void:
	"""Light screen shake for minor impacts."""
	_ensure_screen_shake()
	if _screen_shake:
		_screen_shake.shake_light()


func trigger_medium_shake() -> void:
	"""Medium screen shake for regular hits."""
	_ensure_screen_shake()
	if _screen_shake:
		_screen_shake.shake_medium()


func trigger_heavy_shake() -> void:
	"""Heavy screen shake for critical hits."""
	_ensure_screen_shake()
	if _screen_shake:
		_screen_shake.shake_heavy()


func trigger_impact_shake() -> void:
	"""Impact screen shake for boss hits/explosions."""
	_ensure_screen_shake()
	if _screen_shake:
		_screen_shake.shake_impact()


func _trigger_crit_shake() -> void:
	"""Internal: Trigger shake for critical hits."""
	trigger_heavy_shake()


func _trigger_lightning_shake() -> void:
	"""Internal: Trigger shake for lightning hits."""
	trigger_medium_shake()


func _trigger_slow_motion() -> void:
	"""Internal: Trigger slow-motion for critical hits."""
	var effects_manager: Node = get_node_or_null("/root/EffectsManager")
	if effects_manager and effects_manager.has_method("trigger_slow_motion"):
		effects_manager.trigger_slow_motion()


# === Combo Combat VFX ===

func play_combat_vfx(
	damage: int,
	global_position: Vector2,
	effect_type: String = "hit",
	is_crit: bool = false,
	is_miss: bool = false,
	is_heal: bool = false
) -> void:
	"""Play full combat VFX: particles + damage popup + screen shake.

	Args:
		damage: Damage amount to display
		global_position: World position for effects
		effect_type: Type of effect ("hit", "fire", "ice", "lightning", "charge", "death")
		is_crit: Whether this is a critical hit
		is_miss: Whether the attack missed
		is_heal: Whether this is a heal (negative damage shown as +)
	"""
	# Play appropriate particle effect
	match effect_type:
		"crit":
			play_crit_effect(global_position)
		"miss":
			play_miss_effect(global_position)
		"fire":
			play_fire_effect(global_position)
		"ice":
			play_ice_effect(global_position)
		"lightning":
			play_lightning_effect(global_position)
		"charge":
			# Charge is special - it attaches to parent
			pass
		"death":
			play_death_effect(global_position)
		_:  # "hit" or default
			play_hit_effect(global_position)

	# Show damage popup (skip for charge and death effects)
	if effect_type != "charge" and effect_type != "death":
		show_damage_popup(damage, global_position, is_crit, is_miss, is_heal)

	# Trigger screen shake based on effect type
	match effect_type:
		"crit":
			trigger_heavy_shake()
		"lightning":
			trigger_medium_shake()
		"death":
			trigger_impact_shake()
		"hit":
			if is_crit:
				trigger_heavy_shake()
			elif not is_miss:
				trigger_medium_shake()

## Clean up resources when the node exits the tree
func _exit_tree() -> void:
	# Clean up screen shake instance if it exists
	if _screen_shake != null and is_instance_valid(_screen_shake):
		_screen_shake.queue_free()
		_screen_shake = null

	# Clear preloaded scenes to release memory
	_hit_effect = null
	_crit_effect = null
	_miss_effect = null
	_fire_effect = null
	_ice_effect = null
	_lightning_effect = null
	_charge_effect = null
	_death_effect = null
	_arrow_trail = null
	_damage_popup_scene = null

	# Clear singleton instance
	instance = null

	if OS.get_environment("E2E_TEST") != "1":
		print("[VFXManager] Cleanup complete - all resources released")

# === Power-Up VFX Methods ===

## Spawn power-up pickup particle effect
##
## Parameters:
##   position: Vector2 where to spawn the effect
##   power_up_type: String ("speed", "damage", "invincibility", "health")
func spawn_power_up_pickup_vfx(position: Vector2, power_up_type: String = "speed") -> void:
	"""Spawn a one-time particle effect when power-up is collected.

	Issue #1136: the burst particle comes from ObjectPool.get_charge_effect()
	and auto-returns to the pool when the burst tween finishes (previously a
	fresh instantiate() + queue_free per pickup). The charge scene loops, so
	`finished` never fires; the tween is the deterministic return path
	(mirrors the damage-popup safety-net tween).
	"""
	if not _charge_effect:
		return

	var pool := get_node_or_null("/root/ObjectPool")
	var current_scene := get_tree().current_scene
	if pool == null or current_scene == null:
		push_warning("VFXManager: ObjectPool/current scene missing; pickup VFX skipped")
		return

	var effect: GPUParticles2D = pool.get_charge_effect()
	if effect == null:
		push_warning("VFXManager: ObjectPool returned null charge effect")
		return

	if effect.get_parent() == null:
		current_scene.add_child(effect)
	elif effect.get_parent() != current_scene:
		effect.reparent(current_scene)

	effect.global_position = position
	effect.emitting = true
	effect.modulate = _get_power_up_vfx_color(power_up_type)

	# Add initial burst scale, fade out, then return the particle to the pool.
	var tween = _make_tween()
	tween.tween_property(effect, "scale", Vector2(1.5, 1.5), 0.3).set_trans(Tween.TRANS_BACK)
	tween.tween_property(effect, "modulate:a", 0.0, 0.5)
	tween.tween_callback(func() -> void: _return_charge_effect(effect))

## Attach a looping power-up VFX to a target node
##
## Parameters:
##   target: Node to attach effect to
##   power_up_type: String ("speed", "damage", "invincibility", "health")
func attach_power_up_vfx(target: Node, power_up_type: String = "speed") -> void:
	"""Attach a looping particle effect to a node for active power-up.

	Issue #1136: the looping particle comes from ObjectPool and is released
	back to the pool by detach_power_up_vfx() (previously a fresh
	instantiate() per activation with queue_free on detach).
	"""
	if not target or not _charge_effect:
		return

	var pool := get_node_or_null("/root/ObjectPool")
	if pool == null:
		push_warning("VFXManager: ObjectPool autoload missing; power-up VFX skipped")
		return

	var effect: GPUParticles2D = pool.get_charge_effect()
	if effect == null:
		push_warning("VFXManager: ObjectPool returned null charge effect")
		return

	# Prewarmed charge particles are parented under ObjectPool; reparent into
	# the target (mirrors the pooled arrow-trail pattern).
	if effect.get_parent() == null:
		target.add_child(effect)
	else:
		effect.reparent(target)
	effect.name = "PowerUpVFX"
	effect.emitting = true
	effect.modulate = _get_power_up_vfx_color(power_up_type)
	effect.one_shot = false

	# Add subtle pulsing animation; tracked via meta so the pool return can
	# kill it (the tween is tree-bound, not node-bound).
	var tween = _make_tween()
	effect.set_meta("vfx_pulse_tween", tween)
	tween.set_loops()
	tween.tween_property(effect, "scale", Vector2(1.2, 1.2), 0.5).set_trans(Tween.TRANS_SINE)
	tween.tween_property(effect, "scale", Vector2(0.8, 0.8), 0.5).set_trans(Tween.TRANS_SINE)

## Detach power-up VFX from target
##
## Parameters:
##   target: Node the effect is attached to
##   power_up_type: String type of power-up (unused but kept for consistency)
func detach_power_up_vfx(target: Node, power_up_type: String = "speed") -> void:
	"""Remove looping power-up VFX from a target node, returning it to the pool."""
	if not target:
		return

	var effect: GPUParticles2D = target.get_node_or_null("PowerUpVFX") as GPUParticles2D
	if effect:
		# Kill any prior fade tween so a repeated detach can't double-return.
		if effect.has_meta("vfx_fade_tween"):
			var prior: Tween = effect.get_meta("vfx_fade_tween")
			if prior != null and prior.is_valid():
				prior.kill()
		var tween = _make_tween()
		effect.set_meta("vfx_fade_tween", tween)
		tween.tween_property(effect, "modulate:a", 0.0, 0.3)
		tween.tween_callback(func() -> void: _return_charge_effect(effect))


## Return a charge effect to its ObjectPool (issue #1136), restoring the
## authored visual state (per-use tweens mutate modulate/scale) so the next
## acquire starts from a clean slate.
func _return_charge_effect(effect: GPUParticles2D) -> void:
	if not is_instance_valid(effect):
		return
	var pool := get_node_or_null("/root/ObjectPool")
	if pool == null:
		return
	# Idempotency: a second return for an already-pooled particle is a no-op.
	if effect.get_parent() == pool:
		return

	# Stop the looping pulse tween so the pooled particle stops animating.
	if effect.has_meta("vfx_pulse_tween"):
		var pulse: Tween = effect.get_meta("vfx_pulse_tween")
		if pulse != null and pulse.is_valid():
			pulse.kill()

	# Restore authored state for the next acquire (tweened per use).
	effect.modulate = Color(1, 1, 1, 1)
	effect.scale = Vector2.ONE

	# Reparent back under ObjectPool (no-op if already there).
	if effect.get_parent() != pool:
		if effect.get_parent() != null:
			effect.reparent(pool)
		else:
			pool.add_child(effect)

	ObjectPool.return_charge_effect(effect)

## Get VFX color for power-up type
func _get_power_up_vfx_color(power_up_type: String) -> Color:
	match power_up_type:
		"speed":
			return Color(0.3, 1.0, 0.5, 0.7)  # Green
		"damage":
			return Color(1.0, 0.5, 0.3, 0.7)  # Orange/red
		"invincibility":
			return Color(0.6, 0.8, 1.0, 0.7)  # Blue
		"health":
			return Color(1.0, 0.3, 0.4, 0.7)  # Red
		_:
			return Color(1, 0.675, 0.329, 0.7)  # Golden default

# --- Helper for creating tweens (Godot 4.x compatible) ---
func _make_tween() -> Tween:
	return get_tree().create_tween()
