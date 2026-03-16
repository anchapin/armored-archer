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


func _physics_process(delta: float) -> void:
	# Get input direction
	var input_direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	
	# Apply movement
	if input_direction != Vector2.ZERO:
		velocity = velocity.move_toward(input_direction * move_speed, acceleration * delta)
		is_moving = true
	else:
		velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
		is_moving = false
	
	# Handle aiming
	if Input.is_action_pressed("aim"):
		is_aiming = true
		_update_aim_direction()
	else:
		is_aiming = false

	# Move the character
	var _moved = move_and_slide()


func _update_aim_direction() -> void:
	# Get aim direction from right stick or mouse
	var aim_input := Input.get_vector("aim_left", "aim_right", "aim_up", "aim_down")
	
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
