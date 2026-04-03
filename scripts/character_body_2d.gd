extends CharacterBody2D
class_name CharacterBody2DScript

## Base character body script for the player
## Handles movement, physics, and basic character behavior

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


func _ready() -> void:
	# Initialize character state
	is_moving = false
	is_aiming = false
	# Add player to group for ShootingManager
	add_to_group("Player")


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
