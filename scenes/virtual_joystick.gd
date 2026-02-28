extends Control

# --- Virtual Joystick Configuration ---
@export var joystick_radius: float = 100.0
@export var deadzone: float = 0.1
@export var return_speed: float = 10.0

# --- Visual Components ---
@onready var background: ColorRect = $Background
@onready var thumb: ColorRect = $Background/Thumb

# --- State Variables ---
var touch_index: int = -1
var is_active: bool = false
var output_vector: Vector2 = Vector2.ZERO

signal joystick_moved(vector: Vector2)
signal joystick_released()

func _ready() -> void:
	set_process_input(true)
	gui_input.connect(_on_gui_input)

func _process(delta: float) -> void:
	if not is_active:
		return_thumb_center(delta)

func _on_gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			if touch_index == -1:
				touch_index = event.index
				is_active = true
				update_thumb_position(event.position)
		else:
			if event.index == touch_index:
				touch_index = -1
				is_active = false
				output_vector = Vector2.ZERO
				joystick_released.emit()
	
	elif event is InputEventScreenDrag:
		if event.index == touch_index:
			update_thumb_position(event.position)

func update_thumb_position(touch_pos: Vector2) -> void:
	var center: Vector2 = background.global_position + background.size / 2
	var direction: Vector2 = touch_pos - center
	var distance: float = direction.length()
	
	if distance > 0:
		direction = direction.normalized()
	
	var thumb_distance: float = min(distance, joystick_radius)
	thumb.global_position = center + direction * thumb_distance - thumb.size / 2
	
	if distance > deadzone * joystick_radius:
		output_vector = direction * (thumb_distance / joystick_radius)
	else:
		output_vector = Vector2.ZERO
	
	joystick_moved.emit(output_vector)

func return_thumb_center(delta: float) -> void:
	var center: Vector2 = background.global_position + background.size / 2
	var current_thumb_pos: Vector2 = thumb.global_position + thumb.size / 2
	
	var direction: Vector2 = center - current_thumb_pos
	var distance: float = direction.length()
	
	if distance > 1.0:
		direction = direction.normalized()
		thumb.global_position += direction * return_speed * joystick_radius * delta
	else:
		thumb.global_position = center - thumb.size / 2
