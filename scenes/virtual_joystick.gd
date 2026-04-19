extends Control

# --- Virtual Joystick Configuration ---
@export var joystick_radius: float = 100.0
@export var deadzone: float = 0.15
@export var return_speed: float = 10.0
@export var relative_joystick_size: float = 0.3

# --- Visual Components ---
@onready var background: ColorRect = $Background
@onready var thumb: ColorRect = $Background/Thumb

# --- State Variables ---
var touch_index: int = -1
var is_active: bool = false
var output_vector: Vector2 = Vector2.ZERO
var _thumb_returning: bool = false

signal joystick_moved(vector: Vector2)
signal joystick_released()

func _ready() -> void:
	set_process_input(true)
	_scale_joystick_to_viewport()

func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			if touch_index == -1:
				var joy_center: Vector2 = _get_joystick_center()
				if event.position.distance_to(joy_center) <= joystick_radius * 1.5:
					touch_index = event.index
					is_active = true
					_thumb_returning = false
					update_thumb_position(event.position)
					get_viewport().set_input_as_handled()
		else:
			if event.index == touch_index:
				_release_joystick()
				get_viewport().set_input_as_handled()

	elif event is InputEventScreenDrag:
		if event.index == touch_index:
			update_thumb_position(event.position)
			get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
	if not is_active and _thumb_returning:
		var perf_profiler: Node = get_node_or_null("/root/PerformanceProfiler")
		if perf_profiler and perf_profiler.is_budget_device():
			if Engine.get_frames_drawn() % 2 != 0:
				return
		return_thumb_center(delta)

func _get_joystick_center() -> Vector2:
	if background:
		return background.global_position + background.size / 2.0
	return global_position + size / 2.0

func update_thumb_position(touch_pos: Vector2) -> void:
	if not background or not thumb:
		return

	var center: Vector2 = _get_joystick_center()
	var direction: Vector2 = touch_pos - center
	var distance: float = direction.length()

	if distance > 0:
		direction = direction.normalized()

	var thumb_distance: float = min(distance, joystick_radius)
	thumb.global_position = center + direction * thumb_distance - thumb.size / 2.0

	if distance > deadzone * joystick_radius:
		output_vector = direction * (thumb_distance / joystick_radius)
	else:
		output_vector = Vector2.ZERO

	joystick_moved.emit(output_vector)

func return_thumb_center(delta: float) -> void:
	if not background or not thumb:
		return

	var center: Vector2 = _get_joystick_center()
	var current_thumb_pos: Vector2 = thumb.global_position + thumb.size / 2.0

	var direction: Vector2 = center - current_thumb_pos
	var distance: float = direction.length()

	if distance > 1.0:
		direction = direction.normalized()
		thumb.global_position += direction * return_speed * joystick_radius * delta
	else:
		thumb.global_position = center - thumb.size / 2.0
		_thumb_returning = false

func _release_joystick() -> void:
	touch_index = -1
	is_active = false
	output_vector = Vector2.ZERO
	_thumb_returning = true
	joystick_released.emit()

func _scale_joystick_to_viewport() -> void:
	var viewport_size: Vector2 = get_viewport_rect().size
	var scale_factor: float = min(viewport_size.x, viewport_size.y) * relative_joystick_size / 200.0

	joystick_radius *= scale_factor

	if background:
		var new_bg_size: Vector2 = background.size * scale_factor
		background.offset_left = -new_bg_size.x / 2.0
		background.offset_top = -new_bg_size.y / 2.0
		background.offset_right = new_bg_size.x / 2.0
		background.offset_bottom = new_bg_size.y / 2.0

	if thumb:
		var new_thumb_size: Vector2 = thumb.size * scale_factor
		thumb.offset_left = -new_thumb_size.x / 2.0
		thumb.offset_top = -new_thumb_size.y / 2.0
		thumb.offset_right = new_thumb_size.x / 2.0
		thumb.offset_bottom = new_thumb_size.y / 2.0
