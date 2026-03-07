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

# --- Signal connections for cleanup ---
var _safe_area_changed_connection: Callable = Callable()

signal joystick_moved(vector: Vector2)
signal joystick_released()

func _ready() -> void:
	set_process_input(true)
	gui_input.connect(_on_gui_input)

	# Connect to SafeAreaManager signal with proper cleanup
	var safe_area_manager: Node = get_node_or_null("/root/SafeAreaManager")
	if safe_area_manager:
		_safe_area_changed_connection = safe_area_manager.safe_area_changed.connect(_on_safe_area_changed)

func _exit_tree() -> void:
	# Clean up connected signals to prevent memory leaks
	var safe_area_manager: Node = get_node_or_null("/root/SafeAreaManager")
	if safe_area_manager and _safe_area_changed_connection.is_valid():
		if safe_area_manager.is_connected("safe_area_changed", _on_safe_area_changed):
			safe_area_manager.disconnect("safe_area_changed", _safe_area_changed_connection)

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
	if not background or not thumb:
		return

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
	if not background or not thumb:
		return

	var center: Vector2 = background.global_position + background.size / 2
	var current_thumb_pos: Vector2 = thumb.global_position + thumb.size / 2

	var direction: Vector2 = center - current_thumb_pos
	var distance: float = direction.length()

	if distance > 1.0:
		direction = direction.normalized()
		thumb.global_position += direction * return_speed * joystick_radius * delta
	else:
		thumb.global_position = center - thumb.size / 2

func _on_safe_area_changed() -> void:
	_adjust_joysticks_for_safe_area()

func _adjust_joysticks_for_safe_area() -> void:
	var safe_margins: Dictionary = SafeAreaManager.get_safe_margins()

	if background:
		background.offset_left = -200.0 - safe_margins.right
		background.offset_bottom = 200.0 - safe_margins.bottom

	# Note: We would need aiming_joystick reference here too, but this is movement joystick
