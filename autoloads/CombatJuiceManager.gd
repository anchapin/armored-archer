## Combat Juice Manager autoload for coordinating all combat juice effects.
## Owns screen shake and screen flash directly (ImpactManager was consolidated
## into this autoload in issue #1660 phase 2) and coordinates VFXManager
## (damage popups via ObjectPool — issue #1090; elemental impact VFX),
## plus hit reactions (flinch, stutter) and death animations.
##
## Signals:
## - juice_effect_queued(effect_type: String, data: Dictionary): Emitted when juice effect is queued
## - juice_effect_started(effect_type: String): Emitted when juice effect starts
## - juice_effect_completed(effect_type: String, data: Dictionary): Emitted when juice effect finishes

extends Node

# --- Signals ---
signal juice_effect_queued(effect_type: String, data: Dictionary)
signal juice_effect_started(effect_type: String)
signal juice_effect_completed(effect_type: String, data: Dictionary)
signal shake_started()
signal shake_completed()

# --- Effect Types ---
enum EffectType {
	SCREEN_SHAKE,
	IMPACT_VFX,
	DAMAGE_NUMBER,
	HIT_REACTION,
	DEATH_ANIMATION,
	POWER_UP_START,
	POWER_UP_ACTIVE,
	POWER_UP_END
}

# --- State ---
var _juice_effects: Dictionary = {}
var _active_effects: Dictionary = {}
var _current_time_scale: float = 1.0
var _is_slow_motion: bool = false

# --- Manager References ---
var _vfx_manager: Node

# --- Screen shake state (consolidated from ImpactManager, issue #1660) ---
var shake_config: Dictionary = {
	"light": {"intensity": 2, "duration": 0.2, "decay": true},
	"medium": {"intensity": 5, "duration": 0.4, "decay": true},
	"heavy": {"intensity": 10, "duration": 0.6, "decay": true}
}
var _camera: Camera2D
var _current_shake: Dictionary = {}
var _is_shaking: bool = false
var _active_shake_duration: float = 0.0
var _shake_timer: float = 0.0

# --- Configuration ---
var _max_concurrent_effects: int = 5

# --- Constants ---
const DEFAULT_TIME_SCALE: float = 1.0
const CRIT_TIME_SCALE: float = 0.3
const CRIT_DURATION: float = 0.5

# --- Initialization ---
func _ready() -> void:
	_juice_effects = {}
	_active_effects = {}
	_current_time_scale = DEFAULT_TIME_SCALE
	_is_slow_motion = false

	# Get manager references
	_vfx_manager = get_node_or_null("/root/VFXManager")
	_camera = get_viewport().get_camera_2d()

# --- Public API ---

## Register a juice effect handler
##
## Parameters:
##   effect_type: Type of effect (SCREEN_SHAKE, IMPACT_VFX, DAMAGE_NUMBER, etc.)
##   effect_handler: Node with methods to handle the effect
##
## Returns:
##   bool: True if registration successful
func register_impact_effect(effect_type: EffectType, effect_handler: Node) -> bool:
	if not effect_handler or not effect_handler.has_method("handle_juice_effect"):
		push_error("CombatJuiceManager: Effect handler must implement handle_juice_effect()")
		return false

	_juice_effects[effect_type] = effect_handler
	return true

## Central entry point for all combat juice
##
## Parameters:
##   effect_type: Type of effect to trigger
##   data: Dictionary of effect-specific data
##
## This is the main method called by CombatManager, player, enemies, etc.
## to trigger all combat juice effects at once.
func trigger_combat_juice(effect_type: EffectType, data: Dictionary) -> void:
	_trigger_haptic(effect_type, data)

	# Route to appropriate handler
	match effect_type:
		EffectType.SCREEN_SHAKE:
			_trigger_screen_shake(data)
		EffectType.IMPACT_VFX:
			_trigger_impact_vfx(data)
		EffectType.DAMAGE_NUMBER:
			_trigger_damage_number(data)
		EffectType.HIT_REACTION:
			_trigger_hit_reaction(data)
		EffectType.DEATH_ANIMATION:
			_trigger_death_animation(data)
		EffectType.POWER_UP_START:
			_trigger_power_up_start(data)
		EffectType.POWER_UP_ACTIVE:
			_trigger_power_up_active(data)
		EffectType.POWER_UP_END:
			_trigger_power_up_end(data)

# --- Haptic Integration ---

func _trigger_haptic(effect_type: EffectType, data: Dictionary) -> void:
	var haptic = get_node_or_null("/root/HapticManager")
	if not haptic:
		return
	match effect_type:
		EffectType.SCREEN_SHAKE:
			haptic.medium_tap()
		EffectType.IMPACT_VFX:
			if data.get("is_critical", false):
				haptic.heavy_tap()
			else:
				haptic.light_tap()
		EffectType.DEATH_ANIMATION:
			haptic.success_pulse()
		EffectType.HIT_REACTION:
			haptic.damage_pulse()
		EffectType.POWER_UP_START:
			haptic.success_pulse()
		EffectType.POWER_UP_END:
			haptic.light_tap()


# --- Individual Effect Triggers ---

## Trigger screen shake (light/medium/heavy intensity)
##
## Parameters:
##   attack_strength: String ("light", "medium", "heavy")
##   duration: Shake duration in seconds
##   decay: Whether to decay smoothly or not
func _trigger_screen_shake(data: Dictionary) -> Dictionary:
	juice_effect_started.emit("screen_shake", data)

	var result = shake_screen(data.attack_strength, data.duration, data.decay)

	juice_effect_completed.emit("screen_shake", result)
	return result

## Trigger impact VFX (particle bursts)
##
## Parameters:
##   data: Dictionary with "position", "type", "count"
##
##   position: Vector2 where VFX spawns
##   type: Particle type from impact_effects dictionary
##   count: Number of particles to spawn
func _trigger_impact_vfx(data: Dictionary) -> Dictionary:
	# Issue #1660: the pre-consolidation code called
	# _impact_manager.spawn_impact_vfx(...) — a method that never existed on
	# ImpactManager (or anywhere else), so this effect hard-errored whenever
	# it fired. Elemental impact particles live on VFXManager; route there.
	if not _vfx_manager:
		return {"success": false, "error": "VFXManager not found"}

	juice_effect_started.emit("impact_vfx", data)

	var method_by_type := {
		"fire": "play_fire_effect",
		"ice": "play_ice_effect",
		"lightning": "play_lightning_effect",
		"crit": "play_crit_effect",
		"miss": "play_miss_effect",
	}
	var method: String = method_by_type.get(str(data.get("type", "")), "play_hit_effect")
	if not _vfx_manager.has_method(method):
		return {"success": false, "error": "VFXManager missing %s" % method}
	_vfx_manager.call(method, data.position)
	var result := {"success": true, "method": method}

	juice_effect_completed.emit("impact_vfx", result)
	return result

## Trigger floating damage number
##
## Parameters:
##   data: Dictionary with "position", "damage", "is_critical"
##
##   position: Vector2 where number spawns
##   damage: Damage amount to display
##   is_critical: True for critical hits (> 100%)
##
## Issue #1090: route through VFXManager (which now owns the pooled popup
## path). The DamageIndicatorManager autoload has been consolidated into
## VFXManager — there is no longer a separate damage-number manager.
func _trigger_damage_number(data: Dictionary) -> Dictionary:
	if not _vfx_manager:
		return {"success": false, "error": "VFXManager not found"}

	juice_effect_started.emit("damage_number", data)

	_vfx_manager.show_damage_popup(
		data.damage,
		data.position,
		data.is_critical,
		false,
		false
	)

	var result = {"success": true, "position": data.position}
	juice_effect_completed.emit("damage_number", result)
	return result

## Trigger player hit reaction (flinch/stutter)
##
## Parameters:
##   data: Dictionary with "reaction_type", "source"
##
##   reaction_type: "flinch" or "stutter"
##   source: Source of damage (melee, ranged, etc.)
func _trigger_hit_reaction(data: Dictionary) -> Dictionary:
	# Route to player character
	var player = get_node_or_null("/root/PlayerCharacter")
	if not player or not player.has_method("on_damage_taken"):
		return {"success": false, "error": "Player or method not found"}

	juice_effect_started.emit("hit_reaction", data)

	var result = player.on_damage_taken(data.damage, data.source)

	juice_effect_completed.emit("hit_reaction", result)
	return result

## Trigger enemy death animation
##
## Parameters:
##   data: Dictionary with "enemy_node", "particle_count"
##
##   enemy_node: Enemy that died
##   particle_count: Number of death particles
func _trigger_death_animation(data: Dictionary) -> Dictionary:
	var enemy_node = data.get("enemy_node")
	var particle_count = data.get("particle_count", 5)

	if not is_instance_valid(enemy_node):
		return {"success": false, "error": "Enemy node not provided"}

	var enemy_id: String = str(enemy_node.get_instance_id())
	juice_effect_started.emit("death_animation", data)

	# Trigger enemy's death animation
	if enemy_node.has_method("play_death_animation"):
		enemy_node.play_death_animation()

	# Spawn death particles
	if enemy_node.has_method("spawn_death_particles"):
		enemy_node.spawn_death_particles(particle_count)

	# Wait for animation to complete (approx 1.0s)
	await get_tree().create_timer(1.0).timeout

	# Return enemy to pool
	var object_pool = get_node_or_null("/root/ObjectPool")
	# Stage teardown may free the enemy while the animation timer is pending.
	# Check before passing it to a typed pool method; its own guard is too late.
	if is_instance_valid(enemy_node) and object_pool and object_pool.has_method("return_enemy"):
		object_pool.return_enemy(enemy_node)

	var result = {"success": true, "enemy_id": enemy_id}
	juice_effect_completed.emit("death_animation", result)
	return result

# --- Power-Up Effect Triggers ---

## Trigger power-up start animation and effects
##
## Parameters:
##   data: Dictionary with "power_up_type", "position", "duration"
##
##   power_up_type: String ("speed", "damage", "invincibility", "health")
##   position: Vector2 where pickup occurred
##   duration: Duration of the power-up in seconds
func _trigger_power_up_start(data: Dictionary) -> Dictionary:
	var power_up_type = data.get("power_up_type", "speed")
	var position = data.get("position", Vector2.ZERO)

	juice_effect_started.emit("power_up_start", data)

	# Spawn pickup VFX
	if _vfx_manager and _vfx_manager.has_method("spawn_power_up_pickup_vfx"):
		_vfx_manager.spawn_power_up_pickup_vfx(position, power_up_type)

	# Issue #914: loot_pickup sting fires when a power-up / pickup is consumed.
	var audio := get_node_or_null("/root/AudioManager")
	if audio and audio.has_method("play_event"):
		audio.play_event("loot_pickup")

	# Screen flash for power-up acquisition
	flash_screen(_get_power_up_color(power_up_type), 0.2)

	var result = {
		"success": true,
		"power_up_type": power_up_type,
		"position": position
	}
	juice_effect_completed.emit("power_up_start", result)
	return result

## Trigger power-up active visual effect (looping)
##
## Parameters:
##   data: Dictionary with "power_up_type", "target_node", "remaining"
##
##   power_up_type: String ("speed", "damage", "invincibility", "health")
##   target_node: Node to attach effect to (usually player)
##   remaining: Remaining duration in seconds
func _trigger_power_up_active(data: Dictionary) -> Dictionary:
	var power_up_type = data.get("power_up_type", "speed")
	var target_node = data.get("target_node")

	juice_effect_started.emit("power_up_active", data)

	# Spawn looping VFX on target
	if target_node and _vfx_manager and _vfx_manager.has_method("attach_power_up_vfx"):
		_vfx_manager.attach_power_up_vfx(target_node, power_up_type)

	var result = {
		"success": true,
		"power_up_type": power_up_type,
		"attached_to": target_node
	}
	juice_effect_completed.emit("power_up_active", result)
	return result

## Trigger power-up end animation
##
## Parameters:
##   data: Dictionary with "power_up_type", "target_node"
func _trigger_power_up_end(data: Dictionary) -> Dictionary:
	var power_up_type = data.get("power_up_type", "speed")
	var target_node = data.get("target_node")

	juice_effect_started.emit("power_up_end", data)

	# Remove looping VFX
	if target_node and _vfx_manager and _vfx_manager.has_method("detach_power_up_vfx"):
		_vfx_manager.detach_power_up_vfx(target_node, power_up_type)

	# Screen flash for power-up expiration
	flash_screen(Color(1, 1, 1, 0.1), 0.1)

	var result = {
		"success": true,
		"power_up_type": power_up_type
	}
	juice_effect_completed.emit("power_up_end", result)
	return result

## Get power-up color based on type
func _get_power_up_color(power_up_type: String) -> Color:
	match power_up_type:
		"speed":
			return Color(0.3, 1.0, 0.5)  # Green
		"damage":
			return Color(1.0, 0.5, 0.3)  # Orange/red
		"invincibility":
			return Color(0.6, 0.8, 1.0)  # Blue
		"health":
			return Color(1.0, 0.3, 0.4)  # Red
		_:
			return Color(1, 0.675, 0.329)  # Golden default

# --- Utility Methods ---

## Check if an effect type is currently active
##
## Parameters:
##   effect_type: Effect type to check
##
## Returns:
##   bool: True if effect is active
func is_effect_active(effect_type: EffectType) -> bool:
	return _active_effects.has(effect_type)

## Get current time scale
##
## Returns:
##   float: Current time scale (1.0 = normal, 0.3 = slow/crit, etc.)
func get_time_scale() -> float:
	return _current_time_scale

## Set time scale for critical hits
##
## Parameters:
##   scale: Time scale multiplier to apply
func set_time_scale(scale: float, smooth: bool = true) -> void:
	_current_time_scale = scale
	_is_slow_motion = smooth

	if _is_slow_motion:
		# Use tween to smooth transition
		var tween = get_tree().create_tween()
		tween.tween_property(self, "_current_time_scale", scale, 0.1)
		tween.set_ease(Tween.EASE_IN_OUT)
	else:
		_current_time_scale = scale

# --- Screen shake / flash API (consolidated from ImpactManager, issue #1660) ---

## Get the viewport camera
func get_viewport_camera() -> Camera2D:
	var viewport = get_viewport()
	if not viewport:
		return null
	return viewport.get_camera_2d()

## Shake screen with configurable intensity and duration
##
## Parameters:
##   intensity: Shake strength ("light", "medium", "heavy")
##   duration: Shake duration in seconds
##   decay: Whether to decay smoothly
##
## Returns:
##   Dictionary: Result dictionary
func shake_screen(intensity: String, duration: float, decay: bool) -> Dictionary:
	if not shake_config.has(intensity):
		return {"success": false, "error": "Invalid shake intensity: %s" % intensity}

	# Issue #1660: synchronous starter + deferred coroutine worker. The
	# pre-consolidation ImpactManager.shake_screen was itself a coroutine,
	# but callers reached it through a dynamically-typed Node reference, so
	# it ran fire-and-forget and returned null. As a direct self-call a
	# coroutine must be awaited (parse error), so the timed portion lives
	# in _run_shake_async and this method returns its result immediately.
	_is_shaking = true
	_current_shake = shake_config[intensity]
	_active_shake_duration = duration

	shake_started.emit()

	_run_shake_async.call_deferred(duration, decay)
	return {"success": true}

## Coroutine worker for the timed shake + decay (see shake_screen).
func _run_shake_async(duration: float, decay: bool) -> void:
	# Wait for shake duration
	await get_tree().create_timer(duration).timeout

	# Decay shake smoothly
	if decay:
		for i in range(10):
			var progress = float(i) / 10.0
			_apply_shake_progress(progress)
			await get_tree().process_frame
			_current_shake.intensity = _current_shake.intensity * (1.0 - progress)
		_is_shaking = true
		_shake_timer += get_process_delta_time() * _current_shake.duration
		_is_shaking = false
		_current_shake = {}
		_active_shake_duration = 0.0
		shake_completed.emit({"success": true})

## Apply shake progress
##
## Parameters:
##   progress: Progress value (0.0 to 1.0)
func _apply_shake_progress(progress: float) -> void:
	# Apply camera offset based on shake intensity
	if _camera and _current_shake:
		var intensity = _current_shake.intensity * progress
		var offset_range = _current_shake.intensity * 5.0
		var offset_x = (randf() - 0.5) * offset_range
		var offset_y = (randf() - 0.5) * offset_range

		_camera.offset = Vector2(offset_x, offset_y)

## Get current shake state
##
## Returns:
##   Dictionary: {"is_shaking": bool, "active_shake_duration": float}
func get_shake_state() -> Dictionary:
	return {
		"is_shaking": _is_shaking,
		"active_shake_duration": _active_shake_duration
	}

## Check if shake is currently active
##
## Returns:
##   bool: True if shaking
func is_shake_active() -> bool:
	return _is_shaking

func _process(delta: float) -> void:
	if _is_shaking:
		_shake_timer -= delta
		if _shake_timer <= 0:
			_complete_shake()

## Complete current shake
func _complete_shake() -> void:
	_is_shaking = false
	_current_shake = {}
	_active_shake_duration = 0.0
	shake_completed.emit({"success": true})

## Flash the screen with a color for power-up effects
##
## Parameters:
##   color: Color to flash
##   duration: Duration in seconds
func flash_screen(color: Color, duration: float) -> void:
	# Create a full-screen overlay for the flash
	var viewport = get_viewport()
	if not viewport:
		return

	var canvas_layer = CanvasLayer.new()
	canvas_layer.layer = 100  # Top layer

	var flash = ColorRect.new()
	flash.color = color
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	flash.set_anchors_preset(Control.PRESET_FULL_RECT)
	flash.mouse_default_cursor_shape = Control.CURSOR_ARROW

	canvas_layer.add_child(flash)
	viewport.add_child(canvas_layer)

	# Fade out and remove
	var tween = _make_tween()
	tween.tween_property(flash, "modulate:a", 0.0, duration).set_trans(Tween.TRANS_SINE)
	tween.tween_callback(canvas_layer.queue_free)

## Helper for creating tweens (Godot 4.x compatible)
func _make_tween() -> Tween:
	return get_tree().create_tween()
