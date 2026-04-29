extends Control

# --- Virtual Joystick Configuration ---
@export var joystick_radius: float = 100.0
@export var deadzone: float = 0.15
@export var return_speed: float = 10.0
@export var relative_joystick_size: float = 0.3

# --- Visual Components ---
@onready var background: TextureRect = $Background
@onready var thumb: TextureRect = $Background/Thumb

# --- State Variables ---
var touch_index: int = -1
var is_active: bool = false
var output_vector: Vector2 = Vector2.ZERO
var _thumb_returning: bool = false

# --- Visual Constants ---
const BASE_OPACITY: float = 0.3
const ACTIVE_OPACITY: float = 0.6
const THUMB_BASE_SCALE: float = 1.0
const THUMB_ACTIVE_SCALE: float = 1.2
const OPACITY_SMOOTH_SPEED: float = 8.0

signal joystick_moved(vector: Vector2)
signal joystick_released()

func _ready() -> void:
	set_process_input(true)
	_scale_joystick_to_viewport()
	_add_visual_effects()

func _add_visual_effects() -> void:
	# Add glow effect to thumb when active
	if thumb:
		var thumb_material := ShaderMaterial.new()
		thumb.material = thumb_material

func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			if touch_index == -1:
				var joy_center: Vector2 = _get_joystick_center()
				if event.position.distance_to(joy_center) <= joystick_radius * 1.5:
					touch_index = event.index
					is_active = true
					_thumb_returning = false
					_update_visual_state(true)
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
	
	# Smooth opacity transitions
	_update_opacity_smooth(delta)
	# Add subtle pulse animation when inactive
	if not is_active and not _thumb_returning:
		_add_idle_pulse(delta)

func _update_opacity_smooth(delta: float) -> void:
	var target_opacity: float = is_active ? ACTIVE_OPACITY : BASE_OPACITY
	if background:
		var current: Color = background.modulate
		background.modulate = Color(current.r, current.g, current.b, lerp(current.a, target_opacity, delta * OPACITY_SMOOTH_SPEED))

func _add_idle_pulse(delta: float) -> void:
	# Subtle breathing animation for the background
	if background:
		var pulse: float = 0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.002)
		background.modulate.a = BASE_OPACITY + pulse * 0.05

func _update_visual_state(active: bool) -> void:
	# Scale thumb when active
	if thumb:
		var tween := create_tween()
		var scale: float = active ? THUMB_ACTIVE_SCALE : THUMB_BASE_SCALE
		tween.tween_property(thumb, "scale", Vector2(scale, scale), 0.1).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	
	# Update opacity
	if background:
		var tween := create_tween()
		var target_opacity: float = active ? ACTIVE_OPACITY : BASE_OPACITY
		tween.tween_property(background, "modulate:a", target_opacity, 0.15).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)

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
