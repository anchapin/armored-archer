class_name BaseEnemy
extends CharacterBody2D

## Base enemy class for all enemy types.
## Provides common functionality for health, damage, and death handling.
##
## Usage:
## - Extend this class for custom enemy behavior
## - Override _ready(), _physics_process(),and take_damage() as needed
## - Call super._ready() in extended _ready() to ensure proper initialization
## - Implement _exit_tree() cleanup if overriding signal connections

# --- Stats ---
@export var max_health: int = 100
@export var move_speed: float = 150.0
@export var damage: int = 10
@export var xp_reward: int = 25

# --- Enemy Type ---
@export var enemy_type: StringName = &"goblin"

# --- Animation State ---
enum AnimationState { IDLE, WALK, ATTACK, HIT, DEATH }
var current_state: AnimationState = AnimationState.IDLE
var facing_direction: Vector2 = Vector2.DOWN
var is_animation_locked: bool = false

# --- State ---
var current_health: int

# --- Signals ---
signal died(xp_reward: int)

# --- Node References ---
var animated_sprite: AnimatedSprite2D = null
@onready var collision_shape: CollisionShape2D = $CollisionShape2D
@onready var hurt_area: Area2D = $HurtArea

func _ready() -> void:
	current_health = max_health
	add_to_group("Enemies")

	# Get sprite node (may not exist in all enemy variants)
	animated_sprite = get_node_or_null("AnimatedSprite2D")

	# Set scale for 32x32 rendering (placeholders are 32x32, scaled up from 16x16)
	if animated_sprite:
		animated_sprite.scale = Vector2(2, 2)
		_play_animation("idle")

	if hurt_area:
		var _err = hurt_area.body_entered.connect(_on_hurt_area_body_entered)

	AutoAimManager.register_enemy(self)

# Reset enemy state for reuse from object pool
func reset_for_spawn() -> void:
	current_health = max_health
	current_state = AnimationState.IDLE
	is_animation_locked = false
	if animated_sprite:
		_play_animation("idle")
	AutoAimManager.register_enemy(self)

func _physics_process(delta: float) -> void:
	# Update facing direction based on velocity
	if velocity.length() > 0.1:
		_update_facing_direction()

	# Update animation based on state
	if not is_animation_locked:
		update_animation()

func take_damage(amount: int) -> void:
	current_health -= amount

	# Play hit animation
	if current_health > 0:
		_play_hit_animation()

	if current_health <= 0:
		die()

func _play_hit_animation() -> void:
	if animated_sprite and not is_animation_locked:
		is_animation_locked = true
		current_state = AnimationState.HIT
		_play_animation("hit")
		# Wait for hit animation to complete, then return to idle
		await animated_sprite.animation_finished
		is_animation_locked = false
		current_state = AnimationState.IDLE

func die() -> void:
	if animated_sprite:
		is_animation_locked = true
		current_state = AnimationState.DEATH
		_play_animation("death")
		# Wait for death animation before cleanup
		await animated_sprite.animation_finished

	AutoAimManager.unregister_enemy(self)
	died.emit(xp_reward)
	# Return enemy to object pool for reuse
	ObjectPool.return_enemy(self)

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		if body.has_method("take_damage"):
			body.take_damage(damage)

## Play animation with current enemy type and direction
func _play_animation(anim_state: String) -> void:
	if not animated_sprite:
		return

	var animation_name = str(enemy_type) + "_" + anim_state + "_" + _get_direction_suffix()

	# Check if animation exists
	if animated_sprite.sprite_frames and animated_sprite.sprite_frames.has_animation(animation_name):
		animated_sprite.play(animation_name)
	else:
		# Fallback: try without direction suffix
		var fallback_name = str(enemy_type) + "_" + anim_state + "_down"
		if animated_sprite.sprite_frames and animated_sprite.sprite_frames.has_animation(fallback_name):
			animated_sprite.play(fallback_name)

## Update animation based on current state
func update_animation() -> void:
	if not animated_sprite or is_animation_locked:
		return

	match current_state:
		AnimationState.IDLE:
			_play_animation("idle")
		AnimationState.WALK:
			_play_animation("walk")
		AnimationState.ATTACK:
			_play_animation("attack")
		AnimationState.HIT:
			_play_animation("hit")
		AnimationState.DEATH:
			_play_animation("death")

## Update facing direction based on velocity
func _update_facing_direction() -> void:
	if velocity.length() > 0.1:
		# Determine primary direction
		var abs_x = abs(velocity.x)
		var abs_y = abs(velocity.y)

		if abs_x > abs_y:
			if velocity.x > 0:
				facing_direction = Vector2.RIGHT
			else:
				facing_direction = Vector2.LEFT
		else:
			if velocity.y > 0:
				facing_direction = Vector2.DOWN
			else:
				facing_direction = Vector2.UP

		# Update state to walk if moving
		if current_state != AnimationState.WALK and current_state != AnimationState.HIT:
			current_state = AnimationState.WALK
	else:
		# Idle when not moving
		if current_state == AnimationState.WALK:
			current_state = AnimationState.IDLE

## Get direction suffix for animation name
func _get_direction_suffix() -> String:
	if facing_direction == Vector2.DOWN:
		return "down"
	elif facing_direction == Vector2.UP:
		return "up"
	elif facing_direction == Vector2.LEFT:
		return "left"
	elif facing_direction == Vector2.RIGHT:
		return "right"
	return "down"

## Reset state when returning to pool - called by ObjectPool
func reset_pooled_state() -> void:
	current_health = max_health
	current_state = AnimationState.IDLE
	is_animation_locked = false
	facing_direction = Vector2.DOWN
	position = Vector2.ZERO
	velocity = Vector2.ZERO

	# Disable collision
	if collision_shape:
		collision_shape.set_deferred("disabled", true)

	# Reset sprite animation
	if animated_sprite:
		animated_sprite.stop()
		_play_animation("idle")

## Cleanup when enemy is freed
func _exit_tree() -> void:
	AutoAimManager.unregister_enemy(self)
