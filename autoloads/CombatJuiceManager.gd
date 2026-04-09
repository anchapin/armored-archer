## Combat Juice Manager autoload for coordinating all combat juice effects.
## Coordinates ImpactManager (screen shake, VFX), DamageIndicatorManager (damage numbers),
## and hit reactions (flinch, stutter) and death animations.
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

# --- Effect Types ---
enum EffectType {
	SCREEN_SHAKE,
	IMPACT_VFX,
	DAMAGE_NUMBER,
	HIT_REACTION,
	DEATH_ANIMATION
}

# --- State ---
var _juice_effects: Dictionary = {}
var _active_effects: Dictionary = {}
var _current_time_scale: float = 1.0
var _is_slow_motion: bool = false

# --- Manager References ---
var _impact_manager: Node
var _damage_indicator_manager: Node

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
	_impact_manager = get_node_or_null("/root/ImpactManager")
	_damage_indicator_manager = get_node_or_null("/root/DamageIndicatorManager")

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

## Trigger combat juice event
##
## Parameters:
##   effect_type: Type of effect
##   data: Dictionary of effect-specific data
##
## Returns:
##   Dictionary: Result from effect handler
func trigger_combat_juice(effect_type: EffectType, data: Dictionary) -> Dictionary:
	if not _juice_effects.has(effect_type):
		push_warning("CombatJuiceManager: No handler registered for effect type: %s" % effect_type)
		return {}

	var handler = _juice_effects[effect_type]
	if not handler:
		return {}

	juice_effect_started.emit(effect_type.to_lower(), data)
	var result = handler.handle_juice_effect(data)

	juice_effect_completed.emit(effect_type.to_lower(), result)
	return result

## Central entry point for all combat juice
##
## Parameters:
##   effect_type: Type of effect to trigger
##   data: Dictionary of effect-specific data
##
## This is the main method called by CombatManager, player, enemies, etc.
## to trigger all combat juice effects at once.
func trigger_combat_juice(effect_type: EffectType, data: Dictionary) -> void:
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

# --- Individual Effect Triggers ---

## Trigger screen shake (light/medium/heavy intensity)
##
## Parameters:
##   attack_strength: String ("light", "medium", "heavy")
##   duration: Shake duration in seconds
##   decay: Whether to decay smoothly or not
func _trigger_screen_shake(data: Dictionary) -> Dictionary:
	if not _impact_manager:
		return {"success": false, "error": "ImpactManager not found"}

	juice_effect_started.emit("screen_shake", data)

	var result = _impact_manager.shake_screen(data.attack_strength, data.duration, data.decay)

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
	if not _impact_manager:
		return {"success": false, "error": "ImpactManager not found"}

	juice_effect_started.emit("impact_vfx", data)

	var result = _impact_manager.spawn_impact_vfx(data.position, data.type, data.count)

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
func _trigger_damage_number(data: Dictionary) -> Dictionary:
	if not _damage_indicator_manager:
		return {"success": false, "error": "DamageIndicatorManager not found"}

	juice_effect_started.emit("damage_number", data)

	var result = _damage_indicator_manager.spawn_damage_number(data.position, data.damage, data.is_critical)

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
	if not _impact_manager:
		return {"success": false, "error": "ImpactManager not found"}

	juice_effect_started.emit("death_animation", data)

	var result = _impact_manager.spawn_death_particles(data.enemy_node, data.particle_count)

	juice_effect_completed.emit("death_animation", result)
	return result

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
		var tween = create_tween()
		tween.tween_property(self, "_current_time_scale", scale)
		tween.tween_interval(0.1)
		tween.set_ease(Tween.EASE_IN_OUT)
	else:
		_current_time_scale = scale

# --- Helper for creating tweens (Godot 4.x compatible) ---
func create_tween() -> Tween:
	var tween = Tween.new()
	return tween
