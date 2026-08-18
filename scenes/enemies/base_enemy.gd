class_name BaseEnemy
extends CharacterBody2D

## Base enemy class for all enemy types.
## Provides common functionality for health, damage, and death handling.
##
## Usage:
## - Extend this class for custom enemy behavior
## - Override _ready(), _physics_process(), and take_damage() as needed
## - Call super._ready() in extended _ready() to ensure proper initialization
## - Implement _exit_tree() cleanup if overriding signal connections

# --- Stats ---
@export var max_health: int = 100
@export var move_speed: float = 150.0
@export var damage: int = 10
@export var xp_reward: int = 25

# --- State ---
var current_health: int
var collision_enabled: bool = false
var is_dead: bool = false

# --- Signals ---
signal died(xp_reward: int)
signal enemy_died(enemy: BaseEnemy)

# --- Node References ---
# Issue #913: 'sprite' is typed as Node2D so the reference works for both
# legacy Sprite2D nodes and the new AnimatedSprite2D nodes. Use
# 'animated_sprite' for sprite-frame-specific logic.
@onready var sprite: Node2D = $Sprite2D
@onready var animated_sprite: AnimatedSprite2D = _resolve_animated_sprite()
@onready var collision_shape: CollisionShape2D = $CollisionShape2D
@onready var hurt_area: Area2D = $HurtArea

func _resolve_animated_sprite() -> AnimatedSprite2D:
	"""Returns the Sprite2D node as an AnimatedSprite2D if applicable (issue #913)."""
	var node := get_node_or_null("Sprite2D")
	if node is AnimatedSprite2D:
		return node
	return null

func _is_e2e_test() -> bool:
	return OS.get_environment("E2E_TEST") == "1"

func _ready() -> void:
	# Set collision layer FIRST before any other initialization
	collision_layer = 2
	collision_mask = 1
	current_health = max_health

	add_to_group("Enemies")
	if hurt_area:
		var _err = hurt_area.body_entered.connect(_on_hurt_area_body_entered)

	# Issue #914: fire boss_intro on the SFX bus the first time this enemy is
	# added to the Boss group (boss subclasses do this in their own _ready()
	# before calling super). Pooled re-spawns don't replay the sting — the
	# AudioManager handles the dedupe via the standard event dispatch.
	if is_in_group("Boss"):
		var audio := get_node_or_null("/root/AudioManager")
		if audio and audio.has_method("play_event"):
			audio.play_event("boss_intro")

	# Register with auto-aim if available
	if not _is_e2e_test():
		var aim_mgr = get_node_or_null("/root/AutoAimManager")
		if aim_mgr and aim_mgr.has_method("register_enemy"):
			aim_mgr.register_enemy(self)

# Reset enemy state for reuse from object pool
func reset_for_spawn() -> void:
	current_health = max_health
	is_dead = false
	collision_layer = 2
	collision_mask = 1
	if not _is_e2e_test():
		var aim_mgr = get_node_or_null("/root/AutoAimManager")
		if aim_mgr and aim_mgr.has_method("register_enemy"):
			aim_mgr.register_enemy(self)

## Enable collision (for spawner after pooling)
func enable_collision() -> void:
	if collision_shape:
		if not _is_e2e_test():
			if collision_enabled:
				return
		collision_shape.disabled = false
		collision_enabled = true
func take_damage(amount: int) -> void:
	# Prevent re-damage on already dead enemies
	if is_dead:
		return
	current_health -= amount
	if current_health <= 0:
		is_dead = true
		die()

func die() -> void:
	var aim_mgr = get_node_or_null("/root/AutoAimManager")
	if aim_mgr and aim_mgr.has_method("unregister_enemy"):
		aim_mgr.unregister_enemy(self)

	# CRITICAL: Set is_dead flag immediately to prevent re-damage before deferred pool return
	is_dead = true

# Audio feedback — arrow_kill on the SFX bus (issue #911)
	# Issue #914: per-archetype death on the SFX bus (full inventory wiring).
	# Boss group membership overrides the archetype variant so the boss sting
	# plays once instead of the per-archetype fall-through.
	var audio_kill = get_node_or_null("/root/AudioManager")
	if audio_kill:
		if is_in_group("Boss"):
			if audio_kill.has_method("play_event"):
				audio_kill.play_event("boss_death")
		else:
			var archetype_event: String = archetype_death_event()
			if archetype_event != "" and audio_kill.has_method("play_event"):
				audio_kill.play_event(archetype_event)
		if audio_kill.has_method("play_arrow_kill"):
			audio_kill.play_arrow_kill()
		elif audio_kill.has_method("play_sfx"):
			audio_kill.play_sfx("arrow_kill")

	# Emit death signals first
	died.emit(xp_reward)

	# Trigger death animation through CombatJuiceManager
	var combat_juice = get_node_or_null("/root/CombatJuiceManager")
	if combat_juice and combat_juice.has_method("trigger_combat_juice"):
		# Pass enemy_node and particle_count params
		combat_juice.trigger_combat_juice(
			"DEATH_ANIMATION",
			{"enemy_node": self, "particle_count": 5}
		)
	else:
		# Fallback: Directly play death animation and spawn particles
		play_death_animation()
		spawn_death_particles(5)
		# Return to pool after animation
		_direct_return_to_pool()

## Direct pool return when CombatJuiceManager unavailable
func _direct_return_to_pool() -> void:
	"""Directly return enemy to pool (fallback when CombatJuiceManager unavailable)"""
	# CRITICAL: Directly notify spawner of enemy death (EnemySpawner is now an autoload)
	var spawner: Node = get_node_or_null("/root/EnemySpawner")
	if spawner and spawner.has_method("_on_enemy_exiting"):
		spawner._on_enemy_exiting(self)
	else:
		# Try emitting signal as fallback
		enemy_died.emit(self)

	# CRITICAL: Return enemy to pool via deferred call to ensure signals process first
	call_deferred("_return_to_pool_deferred")

func _return_to_pool_deferred() -> void:
	var object_pool = get_node_or_null("/root/ObjectPool")
	if object_pool and object_pool.has_method("return_enemy"):
		object_pool.return_enemy(self)

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		if body.has_method("take_damage"):
			body.take_damage(damage)

## Reset state when returning to pool - called by ObjectPool
func reset_pooled_state() -> void:
	# Note: Signals will be disconnected by the spawner when needed

	current_health = max_health
	collision_layer = 2
	collision_mask = 1
	is_dead = false
	collision_enabled = false
	position = Vector2.ZERO
	velocity = Vector2.ZERO

	# Disable collision
	if collision_shape:
		collision_shape.set_deferred("disabled", true)

	collision_layer = 2

	# Reset sprite
	if sprite:
		sprite.modulate = Color.WHITE

## Cleanup when enemy is freed
func _exit_tree() -> void:
	var aim_mgr = get_node_or_null("/root/AutoAimManager")
	if aim_mgr and aim_mgr.has_method("unregister_enemy"):
		aim_mgr.unregister_enemy(self)

## Death animation: Fade out and apply ragdoll physics
func play_death_animation() -> void:
	"""Fade out sprite over 0.5s and trigger ragdoll physics.

	Issue #913: when an AnimatedSprite2D is present, play the 'death' animation
	and await its completion before applying ragdoll physics. Falls back to the
	tween fade when only a static Sprite2D is available.
	"""
	# If an AnimatedSprite2D with a 'death' animation is available, play it and
	# wait for completion (so the body isn't freed mid-animation).
	if animated_sprite and animated_sprite.sprite_frames and animated_sprite.sprite_frames.has_animation(&"death"):
		animated_sprite.play(&"death")
		# Only await if the animation actually has frames to play; empty placeholder
		# frames would otherwise complete instantly and skip the death effect.
		if animated_sprite.sprite_frames.get_frame_count(&"death") > 0:
			await animated_sprite.animation_finished

	# Fade out sprite over 0.5s (still useful for visibility transition)
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "modulate:a", 0.0, 0.5)
		await tween.finished

	# Call ragdoll physics
	apply_ragdoll_physics()

## Apply ragdoll physics to create death effect
func apply_ragdoll_physics() -> void:
	"""Apply random rotation and velocity to create ragdoll effect"""
	if sprite:
		# Random rotation
		var rotation_amount = randf() * PI * 2
		sprite.rotation = rotation_amount

		# Random velocity vector (push effect)
		var ragdoll_velocity = Vector2(randf_range(-100, 100), randf_range(-100, 100))

		# Disable gravity
		ragdoll_velocity.y = 0.0

		# Apply rotation tween
		var tween = create_tween()
		tween.tween_property(sprite, "rotation", sprite.rotation + rotation_amount * 2.0, 0.5)

## Spawn death particle burst
func spawn_death_particles(particle_count: int = 5) -> void:
	"""Spawn death particle burst for satisfying kills"""
	var vfx_manager = get_node_or_null("/root/VFXManager")
	if vfx_manager and vfx_manager.has_method("spawn_death_particles"):
		vfx_manager.spawn_death_particles(global_position, particle_count)

## Resolve the per-archetype death event name (issue #914).
## Returns "" when the class isn't one of the four Ch1 archetypes — callers
## then fall through to the generic arrow_kill sound.
func archetype_death_event() -> String:
	var script: Script = get_script()
	if script == null:
		return ""
	var class_id: String = script.get_global_name() if script.has_method("get_global_name") else ""
	# get_global_name() requires the script be class_name-registered. Fall back
	# to the file basename for scripts that only declare `extends BaseEnemy`.
	if class_id == "":
		# resource_path is a property, not a method — has_method() is always
		# false for it, so read it directly (issue #989). It is only empty for
		# in-memory scripts, which have no archetype mapping anyway.
		var path: String = script.resource_path
		if path != "":
			class_id = path.get_file().get_basename()
	match class_id:
		"ScoutEnemy", "scout_enemy", "goblin":
			return "archetype_death_goblin"
		"SwarmerEnemy", "swarmer_enemy", "wolf":
			return "archetype_death_wolf"
		"GuardianEnemy", "guardian_enemy", "guardian":
			return "archetype_death_guardian"
		"ElementalEnemy", "elemental_enemy", "elemental":
			return "archetype_death_elemental"
	return ""
