extends Control

@onready var movement_joystick: Control = $MovementJoystick
@onready var aiming_joystick: Control = $AimingJoystick

var player: CharacterBody2D

func _ready() -> void:
	movement_joystick.joystick_moved.connect(_on_movement_joystick_moved)
	aiming_joystick.joystick_moved.connect(_on_aiming_joystick_moved)
	aiming_joystick.joystick_released.connect(_on_aiming_joystick_released)
	
	SafeAreaManager.safe_area_changed.connect(_on_safe_area_changed)
	
	await get_tree().process_frame
	if get_parent() and get_parent().has_node("Player"):
		player = get_parent().get_node("Player")
	
	_adjust_joysticks_for_safe_area()

func _on_safe_area_changed() -> void:
	_adjust_joysticks_for_safe_area()

func _adjust_joysticks_for_safe_area() -> void:
	var safe_margins: Dictionary = SafeAreaManager.get_safe_margins()
	
	movement_joystick.offset_left = -200.0 - safe_margins.right
	movement_joystick.offset_bottom = 200.0 - safe_margins.bottom
	
	aiming_joystick.offset_right = 200.0 - safe_margins.left
	aiming_joystick.offset_top = -200.0 - safe_margins.top

func _on_movement_joystick_moved(vector: Vector2) -> void:
	if player:
		player.set_virtual_move_direction(vector)

func _on_aiming_joystick_moved(vector: Vector2) -> void:
	if player:
		player.set_virtual_aim_direction(vector)

func _on_aiming_joystick_released() -> void:
	if player:
		player.set_virtual_aim_direction(Vector2.ZERO)
