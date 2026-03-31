extends Node

## VFXManager - Centralized combat visual effects system.
## Manages visual effects (particles, screen shake) globally
## and other combat VFX.

# --- Particle Effects ---
const HIT_EFFECT_PATH := "res://assets/particles/hit_effect.tscn"
const CRIT_EFFECT_PATH := "res://assets/particles/crit_effect.tscn"
const MISS_EFFECT_PATH := "res://assets/particles/miss_effect.tscn"
const FIRE_EFFECT_PATH := "res://assets/particles/fire_effect.tscn"
const ICE_EFFECT_PATH := "res://assets/particles/ice_effect.tscn"
const LIGHTNING_EFFECT_PATH := "res://assets/particles/lightning_effect.tscn"
const CHARGE_EFFECT_PATH := "res://assets/particles/charge_effect.tscn"
const DEATH_EFFECT_PATH := "res://assets/particles/death_effect.tscn"

# --- Signals for Combat Integration ---
signal effect_triggered(effect_type: String, global_position: Vector2)

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
var _damage_popup_scene: PackedScene

# --- Screen Shake Instance ---
var _screen_shake: Node = null


func _ready() -> void:
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
	get_tree().current_scene.add_child(_screen_shake)


# === Particle Effect Methods ===

func play_hit_effect(global_position: Vector2) -> void:
	"""Play standard hit particle effect with pooling for performance."""
	_spawn_particle_pooled(_hit_effect, global_position, "hit")


func play_crit_effect(global_position: Vector2) -> void:
	"""Play critical hit effect with gold particles."""
	_spawn_particle_pooled(_crit_effect, global_position, "crit")
	_trigger_crit_shake()


func play_miss_effect(global_position: Vector2) -> void:
	"""Play miss/dodge effect with gray particles."""
	_spawn_particle_pooled(_miss_effect, global_position, "miss")


func play_fire_effect(global_position: Vector2) -> void:
	"""Play fire elemental damage effect."""
	_spawn_particle_pooled(_fire_effect, global_position, "fire")


func play_ice_effect(global_position: Vector2) -> void:
	"""Play ice/frost elemental damage effect."""
	_spawn_particle_pooled(_ice_effect, global_position, "ice")


func play_lightning_effect(global_position: Vector2) -> void:
	"""Play lightning elemental damage effect."""
	_spawn_particle_pooled(_lightning_effect, global_position, "lightning")
	_trigger_lightning_shake()


func play_charge_effect(global_position: Vector2, parent: Node) -> void:
	"""Play charging effect - attached to a parent node for continuous effects."""
	if _charge_effect:
		var effect: GPUParticles2D = _charge_effect.instantiate()
		parent.add_child(effect)
		effect.global_position = global_position


func play_death_effect(global_position: Vector2) -> void:
	"""Play death explosion particle effect with pooling."""
	_spawn_particle_pooled(_death_effect, global_position, "death")
	trigger_impact_shake()


func _spawn_particle_pooled(effect_scene: PackedScene, global_position: Vector2, effect_type: String) -> void:
	"""Spawn a particle effect using object pool for better performance."""
	if not effect_scene:
		push_warning("VFXManager: Effect scene not loaded")
		return

	# Try to get from pool first
	var effect: GPUParticles2D = null
	
	# Use ObjectPool if available for hit/death effects
	if effect_type == "hit" and ObjectPool.has_method("get_hit_effect"):
		effect = ObjectPool.get_hit_effect()
	elif effect_type == "death" and ObjectPool.has_method("get_death_effect"):
		effect = ObjectPool.get_death_effect()
	
	# Fall back to direct instantiation if pool not available
	if effect == null:
		effect = effect_scene.instantiate()
		get_tree().current_scene.add_child(effect)
	
	effect.global_position = global_position
	effect.emitting = true
	
	# Connect to return to pool after emission
	var pool_return_func: Callable
	if effect_type == "hit":
		pool_return_func = ObjectPool.return_hit_effect
	elif effect_type == "death":
		pool_return_func = ObjectPool.return_death_effect
	
	if pool_return_func:
		var _err = effect.finished.connect(func(): pool_return_func.call(effect))
	else:
		# No pool available, just clean up
		var _err = effect.finished.connect(effect.queue_free)


func _spawn_particle(effect_scene: PackedScene, global_position: Vector2) -> void:
	"""Spawn a particle effect at the given position."""
	if not effect_scene:
		push_warning("VFXManager: Effect scene not loaded")
		return

	var effect: GPUParticles2D = effect_scene.instantiate()
	get_tree().current_scene.add_child(effect)
	effect.global_position = global_position

	# Auto-cleanup after effect completes
	effect.emitting = true
	var _err = effect.finished.connect(effect.queue_free)


# === Damage Popup Methods ===

func show_damage_popup(
	damage: int,
	global_position: Vector2,
	is_crit: bool = false,
	is_miss: bool = false,
	is_heal: bool = false
) -> void:
	"""Display a floating damage number at the given position."""
	if not _damage_popup_scene:
		push_warning("VFXManager: Damage popup scene not loaded")
		return

	var popup: Label = _damage_popup_scene.instantiate()
	get_tree().current_scene.add_child(popup)

	# Offset slightly above the target
	popup.global_position = global_position + Vector2(0, -30)
	popup.setup_damage(damage, is_crit, is_miss, is_heal)


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
	"""Impact screen shake for explosions/boss hits."""
	_ensure_screen_shake()
	if _screen_shake:
		_screen_shake.shake_impact()


# === Damage Overlay Methods ===

func show_damage_overlay(intensity: float) -> void:
	"""Show damage vignette overlay with given intensity (0.0-1.0)."""
	var overlay := _get_damage_overlay()
	if overlay:
		overlay.visible = true
		var mat = overlay.material as ShaderMaterial
		if mat:
			mat.set_shader_parameter("intensity", intensity)


func hide_damage_overlay() -> void:
	"""Hide damage vignette overlay."""
	var overlay := _get_damage_overlay()
	if overlay:
		overlay.visible = false


func _get_damage_overlay() -> ColorRect:
	"""Get or create the damage overlay instance."""
	var tree := get_tree()
	if not tree:
		return null
	
	var overlay := tree.get_first_node_in_group("DamageOverlay")
	
	if not overlay:
		# Try to load and instance
		var scene := load("res://scenes/ui/damage_overlay.tscn")
		if scene:
			overlay = scene.instantiate()
			overlay.add_to_group("DamageOverlay")
			tree.current_scene.add_child(overlay)
	
	return overlay


# === Slow Motion Methods ===

var _slow_motion_active: bool = false
var _original_time_scale: float = 1.0


func trigger_slow_motion(scale: float = 0.3, duration: float = 0.5) -> void:
	"""Trigger slow motion effect.
	
	Args:
		scale: Time scale (0.0-1.0). Lower = slower motion. Default 0.3
		duration: How long slow motion lasts in seconds. Default 0.5
	"""
	if _slow_motion_active:
		return  # Already in slow mo
	
	_slow_motion_active = true
	_original_time_scale = Engine.time_scale
	Engine.time_scale = scale
	
	# Reset after duration
	await get_tree().create_timer(duration).timeout
	stop_slow_motion()


func stop_slow_motion() -> void:
	"""Stop slow motion and restore normal time."""
	if _slow_motion_active:
		Engine.time_scale = _original_time_scale
		_slow_motion_active = false


func _trigger_crit_shake() -> void:
	"""Internal: Trigger shake for critical hits."""
	trigger_heavy_shake()


func _trigger_lightning_shake() -> void:
	"""Internal: Trigger shake for lightning hits."""
	trigger_medium_shake()


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
		effect_type: Type of effect ("hit", "fire", "ice", "lightning", "charge")
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
		_:  # "hit" or default
			play_hit_effect(global_position)

	# Show damage popup (skip for charge effect)
	if effect_type != "charge":
		show_damage_popup(damage, global_position, is_crit, is_miss, is_heal)

	# Trigger screen shake based on effect type
	match effect_type:
		"crit":
			trigger_heavy_shake()
		"lightning":
			trigger_medium_shake()
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
	_damage_popup_scene = null

	# Clear singleton instance - no longer using static var

	print("[VFXManager] Cleanup complete - all resources released")
