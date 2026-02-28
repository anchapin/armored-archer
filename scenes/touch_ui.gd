extends Control

# --- Virtual Joystick References ---
@onready var movement_joystick: Control = $MovementJoystick
@onready var aiming_joystick: Control = $AimingJoystick

# --- Player Reference ---
var player: CharacterBody2D

func _ready() -> void:
	# Connect joystick signals
	movement_joystick.joystick_moved.connect(_on_movement_joystick_moved)
	aiming_joystick.joystick_moved.connect(_on_aiming_joystick_moved)
	aiming_joystick.joystick_released.connect(_on_aiming_joystick_released)
	
	# Find player in the scene tree (Player is a sibling of TouchUI under Main)
	await get_tree().process_frame
	if get_parent() and get_parent().has_node("Player"):
		player = get_parent().get_node("Player")

func _on_movement_joystick_moved(vector: Vector2) -> void:
	if player:
		player.set_virtual_move_direction(vector)

func _on_aiming_joystick_moved(vector: Vector2) -> void:
	if player:
		player.set_virtual_aim_direction(vector)

func _on_aiming_joystick_released() -> void:
	if player:
		player.set_virtual_aim_direction(Vector2.ZERO)
