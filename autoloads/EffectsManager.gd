extends Node

## EffectsManager - Centralized control for time-based effects and screen overlays.
## Manages slow-motion, damage overlay, and other temporal effects.

# --- Singleton Instance ---
static var instance: EffectsManager

# --- Configuration ---
const DEFAULT_TIME_SCALE := 1.0
const CRIT_TIME_SCALE := 0.3
const CRIT_DURATION := 0.5

# --- State ---
var _target_time_scale: float = DEFAULT_TIME_SCALE
var _current_time_scale: float = DEFAULT_TIME_SCALE
var _time_scale_tween: Tween = null
var _is_slow_motion: bool = false

# --- Damage Overlay Reference ---
var _damage_overlay: ColorRect = null


func _ready() -> void:
	instance = self
	# Don't initialize damage overlay immediately - it will be lazy-loaded
	# when first needed, to avoid issues during headless initialization



func _process(delta: float) -> void:
	# Smoothly interpolate to target time scale
	if _current_time_scale != _target_time_scale:
		var interpolation_speed := 10.0
		_current_time_scale = move_toward(
			_current_time_scale,
			_target_time_scale,
			interpolation_speed * delta
		)
		Engine.time_scale = _current_time_scale


# === Slow Motion Methods ===

func trigger_slow_motion(duration: float = CRIT_DURATION, time_scale: float = CRIT_TIME_SCALE) -> void:
	"""Trigger slow-motion effect for specified duration.

	Parameters:
		duration: How long the slow-motion lasts (in seconds)
		time_scale: The time scale multiplier (0.1 = 10% speed, 1.0 = normal)
	"""
	if _time_scale_tween:
		_time_scale_tween.kill()

	_target_time_scale = time_scale
	_is_slow_motion = true

	# Return to normal time after duration
	_time_scale_tween = create_tween()
	_time_scale_tween.tween_interval(duration)
	_time_scale_tween.tween_callback(_restore_normal_time)


func _restore_normal_time() -> void:
	"""Restore normal time scale."""
	_target_time_scale = DEFAULT_TIME_SCALE
	_is_slow_motion = false


func is_slow_motion_active() -> bool:
	"""Check if slow-motion is currently active."""
	return _is_slow_motion


# === Damage Overlay Methods ===

func _ensure_damage_overlay() -> void:
	"""Ensure damage overlay is instantiated and added to scene."""
	if _damage_overlay != null and is_instance_valid(_damage_overlay):
		return

	var overlay_scene := load("res://scenes/effects/damage_overlay.tscn")
	if not overlay_scene:
		push_error("EffectsManager: Failed to load damage overlay scene")
		return

	_damage_overlay = overlay_scene.instantiate()
	var current_scene := get_tree().current_scene
	if current_scene == null:
		push_warning("EffectsManager: No current scene - damage overlay not attached")
		return
	current_scene.add_child(_damage_overlay)
	_damage_overlay.visible = false


func show_damage_overlay(current_health: int, max_health: int) -> void:
	"""Show damage overlay based on health percentage.

	Parameters:
		current_health: Current player health
		max_health: Maximum player health
	"""
	_ensure_damage_overlay()
	if _damage_overlay and _damage_overlay.has_method("set_health"):
		_damage_overlay.set_health(current_health, max_health)


func hide_damage_overlay() -> void:
	"""Hide the damage overlay immediately."""
	_ensure_damage_overlay()
	if _damage_overlay:
		_damage_overlay.set_health(100, 100)  # Full health hides overlay


# === Combat Event Methods ===

func on_critical_hit() -> void:
	"""Handle critical hit event - trigger slow-motion and screen effects."""
	# Trigger slow-motion
	trigger_slow_motion()

	# VFXManager handles screen shake and particles
	var vfx_manager: Node = get_node_or_null("/root/VFXManager")
	if vfx_manager:
		vfx_manager.trigger_heavy_shake()


func on_player_damage(_damage: int, current_health: int, max_health: int) -> void:
	"""Handle player damage event - update damage overlay.

	Parameters:
		damage: Amount of damage taken
		current_health: Current player health
		max_health: Maximum player health
	"""
	show_damage_overlay(current_health, max_health)


func on_player_heal(current_health: int, max_health: int) -> void:
	"""Handle player heal event - update damage overlay.

	Parameters:
		current_health: Current player health
		max_health: Maximum player health
	"""
	show_damage_overlay(current_health, max_health)


# === Utility Methods ===

func set_time_scale(scale: float, smooth: bool = true) -> void:
	"""Manually set the time scale.

	Parameters:
		scale: Time scale multiplier (0.1 to 1.0 or higher for fast forward)
		smooth: If true, interpolate to new scale; if false, set immediately
	"""
	if smooth:
		_target_time_scale = scale
	else:
		_target_time_scale = scale
		_current_time_scale = scale
		Engine.time_scale = scale


func get_time_scale() -> float:
	"""Get the current time scale."""
	return Engine.time_scale
