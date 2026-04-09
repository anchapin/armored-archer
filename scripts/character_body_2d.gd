extends CharacterBody2D
class_name CharacterBody2DScript

## Base character body script for the player
## Handles movement, physics, and basic character behavior

# --- Health Stats ---
@export var max_health: int = 500
var current_health: int

# --- Movement Stats ---
@export var move_speed: float = 200.0
@export var acceleration: float = 800.0
@export var friction: float = 1000.0

# --- State ---
var is_moving: bool = false
var is_aiming: bool = false
var aim_direction: Vector2 = Vector2.RIGHT
var virtual_move_direction: Vector2 = Vector2.ZERO
var virtual_aim_direction: Vector2 = Vector2.ZERO

# --- Signals ---
signal movement_started
signal movement_stopped
signal aim_direction_changed(direction: Vector2)

# --- Node References ---
@onready var body_sprite: Sprite2D = $BodySprite
@onready var bow_pivot: Node2D = $BowPivot
@onready var animation_player: AnimationPlayer = $AnimationPlayer

# --- Pacing Tracking ---
var encounter_start_time: float = 0.0
var in_combat: bool = false
var pacing_manager: Node


func _ready() -> void:
	# Initialize character state
	is_moving = false
	is_aiming = false
	current_health = max_health
	# Add player to group for ShootingManager
	add_to_group("Player")

	# Get pacing manager reference
	pacing_manager = get_node_or_null("/root/PacingManager")


func _physics_process(delta: float) -> void:
	# Get input direction from keyboard or virtual joystick
	var input_direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")

	# Use virtual joystick input if available (takes priority over keyboard)
	if virtual_move_direction != Vector2.ZERO:
		input_direction = virtual_move_direction

	# Apply movement
	if input_direction != Vector2.ZERO:
		velocity = velocity.move_toward(input_direction * move_speed, acceleration * delta)
		if not is_moving:
			is_moving = true
			movement_started.emit()
	else:
		velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
		if is_moving and velocity.length() < 10.0:
			is_moving = false
			movement_stopped.emit()

	# Handle aiming from keyboard or virtual joystick
	var aim_pressed := Input.is_action_pressed("aim") or virtual_aim_direction != Vector2.ZERO

	if aim_pressed:
		is_aiming = true
		_update_aim_direction()
	else:
		is_aiming = false

	# Handle shooting input (Space or Y key)
	if Input.is_action_just_pressed("shoot"):
		_handle_shoot()

	# Update ShootingManager for cooldowns and auto-shoot
	var shooting_manager = get_node_or_null("/root/ShootingManager")
	if shooting_manager and shooting_manager.has_method("handle_auto_shoot"):
		shooting_manager.handle_auto_shoot(delta)

	# Move the character
	var _moved = move_and_slide()


	# Clamp player position to viewport bounds
	_clamp_to_viewport()


## Handle shooting when player presses shoot button
func _handle_shoot() -> void:
	var shooting_manager = get_node_or_null("/root/ShootingManager")
	if not shooting_manager:
		return

	# Get bow position for arrow spawn
	var shoot_position := global_position
	if bow_pivot:
		shoot_position = bow_pivot.global_position

	# Get aim direction (default to facing right if not aiming)
	var shoot_dir := aim_direction
	if shoot_dir == Vector2.ZERO:
		shoot_dir = Vector2.RIGHT

	# Shoot arrow
	shooting_manager.shoot_arrow(shoot_position, shoot_dir)

	# Play draw/release animation
	if animation_player:
		if animation_player.has_animation("draw"):
			animation_player.play("draw")
		if animation_player.has_animation("release"):
			animation_player.play("release")


## Set virtual joystick movement direction (for touch controls)
func set_virtual_move_direction(vector: Vector2) -> void:
	virtual_move_direction = vector


## Set virtual joystick aim direction (for touch controls)
func set_virtual_aim_direction(vector: Vector2) -> void:
	virtual_aim_direction = vector
	if vector != Vector2.ZERO:
		aim_direction = vector.normalized()
		_rotate_bow_toward_aim()


func _update_aim_direction() -> void:
	# Get aim direction from virtual joystick, right stick, or keyboard
	var aim_input := Input.get_vector("aim_left", "aim_right", "aim_up", "aim_down")

	# Use virtual joystick aim if available
	if virtual_aim_direction != Vector2.ZERO:
		aim_input = virtual_aim_direction

	if aim_input != Vector2.ZERO:
		aim_direction = aim_input.normalized()
		_rotate_bow_toward_aim()
		emit_signal("aim_direction_changed", aim_direction)


func _rotate_bow_toward_aim() -> void:
	# Rotate bow pivot to face aim direction
	if bow_pivot:
		bow_pivot.rotation = aim_direction.angle()


func get_aim_direction() -> Vector2:
	return aim_direction


func is_player_aiming() -> bool:
	return is_aiming


## Handle taking damage from enemies
func take_damage(amount: int) -> void:
	current_health -= amount

	# Track combat engagement for pacing
	if not in_combat:
		_start_combat_encounter()

	if current_health <= 0:
		_end_combat_encounter()
		die()


## Handle player death
func die() -> void:
	# Trigger game over
	var game_mgr = get_node_or_null("/root/GameManager")
	if game_mgr and game_mgr.has_method("end_game"):
		game_mgr.end_game(false)

## Clamp player position to viewport bounds
func _clamp_to_viewport() -> void:
	var camera = get_viewport().get_camera_2d()
	if not camera:
		return

	var viewport_size = get_viewport_rect().size
	var half_size = viewport_size / 2.0
	var margin = 20.0  # Keep player slightly inside edges

	var min_x = camera.global_position.x - half_size.x + margin
	var max_x = camera.global_position.x + half_size.x - margin
	var min_y = camera.global_position.y - half_size.y + margin
	var max_y = camera.global_position.y + half_size.y - margin

	global_position.x = clamp(global_position.x, min_x, max_x)
	global_position.y = clamp(global_position.y, min_y, max_y)

# --- Pacing & Variety ---

## Starts tracking combat encounter for pacing metrics.
func _start_combat_encounter() -> void:
	"""Starts tracking combat encounter for pacing metrics."""
	if not pacing_manager:
		return

	in_combat = true
	encounter_start_time = Time.get_unix_time_from_system()

## Ends tracking combat encounter and records pacing metrics.
func _end_combat_encounter() -> void:
	"""Ends tracking combat encounter and records pacing metrics."""
	if not pacing_manager or not in_combat:
		return

	var duration = Time.get_unix_time_from_system() - encounter_start_time

	# Track pacing state with combat type
	pacing_manager.track_pacing_state(PacingManager.ContentType.COMBAT, duration)

	in_combat = false
	encounter_start_time = 0.0

## Gets current combat duration for pacing.
##
## Returns:
##   float: Combat duration in seconds, or 0 if not in combat
func get_combat_duration() -> float:
	"""Gets current combat duration for pacing.

	Returns:
		float: Combat duration in seconds, or 0 if not in combat
	"""
	if not in_combat:
		return 0.0

	return Time.get_unix_time_from_system() - encounter_start_time

## Manually starts an encounter of a specific type (for exploration/narrative content).
##
## Parameters:
##   encounter_type: PacingManager.ContentType enum value
func start_encounter(encounter_type: int) -> void:
	"""Manually starts an encounter of a specific type.

	Parameters:
		encounter_type: PacingManager.ContentType enum value
	"""
	if not pacing_manager:
		return

	in_combat = true
	encounter_start_time = Time.get_unix_time_from_system()

## Ends current encounter and records pacing metrics.
func end_encounter() -> void:
	"""Ends current encounter and records pacing metrics."""
	_end_combat_encounter()
