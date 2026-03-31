## Base Loading Indicator
## Animated loading spinner with customizable appearance
##
## Usage:
##   var indicator = loading_indicator.instantiate()
##   add_child(indicator)
##   indicator.start()
##   indicator.stop()
##
extends Control

# --- Configuration ---
@export_group("Appearance")
@export var color: Color = Color.WHITE
@export var background_color: Color = Color(1, 1, 1, 0.3)
@export var indicator_size: Vector2 = Vector2(64, 64)
@export var line_width: float = 4.0

# --- Animation Styles ---
enum AnimationStyle { SPINNER, PULSE, DOTS }

@export_group("Animation")
@export var animation_style: AnimationStyle = AnimationStyle.SPINNER
@export var rotation_speed: float = 2.0  # rotations per second
@export var fade_in_duration: float = 0.2
@export var fade_out_duration: float = 0.2

# --- State ---
var _is_animating: bool = false
var _rotation: float = 0.0
var _tween: Tween = null
var _pulse_tween: Tween = null
var _dots_tween: Tween = null

# --- Nodes ---
@onready var _center_container: CenterContainer = $CenterContainer
@onready var _spinner: ProgressBar = $CenterContainer/Spinner
# Dots container will be created dynamically for DOTS style

func _ready() -> void:
	visible = false
	modulate.a = 0.0
	setup_spinner()
	_create_dots_container()

# Create dots container for DOTS animation style
var _dots_container: HBoxContainer = null
var _dots: Array[Sprite2D] = []

func _create_dots_container() -> void:
	_dots_container = HBoxContainer.new()
	_dots_container.name = "DotsContainer"
	_dots_container.alignment = BoxContainer.ALIGNMENT_CENTER
	_dots_container.spacing = 8
	_dots_container.visible = false
	_center_container.add_child(_dots_container)
	
	# Create 3 dots
	for i in range(3):
		var dot := Sprite2D.new()
		# Create a simple circular texture
		var circle := CircleMesh.new()
		circle.radius = 8.0
		circle.height = 16.0
		dot.mesh = circle
		dot.modulate = color
		dot.scale = Vector2(0.8, 0.8)
		_dots_container.add_child(dot)
		_dots.append(dot)

func _process(delta: float) -> void:
	if _is_animating:
		_rotation += delta * rotation_speed * TAU
		if _spinner and is_instance_valid(_spinner):
			_spinner.rotation = _rotation

func setup_spinner() -> void:
	# Create a circular progress indicator using a texture
	if not _spinner:
		return
	
	_spinner.custom_minimum_size = indicator_size
	
	# Use a StyleBoxFlat for the spinner
	var style = StyleBoxFlat.new()
	style.bg_color = background_color
	style.corner_radius_top_left = indicator_size.x / 2
	style.corner_radius_top_right = indicator_size.x / 2
	style.corner_radius_bottom_left = indicator_size.x / 2
	style.corner_radius_bottom_right = indicator_size.x / 2
	style.set_border_width_all(0)
	
	# Create a progress fill style
	var fill_style = StyleBoxFlat.new()
	fill_style.bg_color = color
	fill_style.corner_radius_top_left = indicator_size.x / 2
	fill_style.corner_radius_top_right = indicator_size.x / 2
	fill_style.corner_radius_bottom_left = indicator_size.x / 2
	fill_style.corner_radius_bottom_right = indicator_size.x / 2
	fill_style.set_border_width_all(line_width / 2)
	
	# Apply styles
	_spinner.add_theme_stylebox_override("background", style)
	_spinner.add_theme_stylebox_override("fill", fill_style)
	
	# Configure progress bar
	_spinner.min_value = 0
	_spinner.max_value = 100
	_spinner.value = 25
	_spinner.show_percentage = false

func start() -> void:
	if _is_animating:
		return
	
	_is_animating = true
	visible = true
	
	# Fade in
	if _tween:
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(self, "modulate:a", 1.0, fade_in_duration).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	
	# Start animation based on style
	_start_loading_animation()

func _start_loading_animation() -> void:
	match animation_style:
		AnimationStyle.SPINNER:
			_spinner.visible = true
			_dots_container.visible = false
			_animate_progress()
		AnimationStyle.PULSE:
			_spinner.visible = true
			_dots_container.visible = false
			_animate_pulse()
		AnimationStyle.DOTS:
			_spinner.visible = false
			_dots_container.visible = true
			_animate_dots()

func _stop_animation() -> void:
	# Clean up all tweens to prevent memory leaks
	if _tween:
		_tween.kill()
		_tween = null
	
	if _pulse_tween:
		_pulse_tween.kill()
		_pulse_tween = null
	
	if _dots_tween:
		_dots_tween.kill()
		_dots_tween = null
	
	# Reset spinner and dots visibility
	_spinner.visible = true
	if _dots_container:
		_dots_container.visible = false
		for dot in _dots:
			dot.scale = Vector2(0.8, 0.8)

func stop() -> void:
	if not _is_animating:
		return
	
	_is_animating = false
	
	# Stop all animations
	_stop_animation()
	
	# Fade out
	if _tween:
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(self, "modulate:a", 0.0, fade_out_duration).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_SINE)
	_tween.tween_callback(func(): visible = false)

func _animate_pulse() -> void:
	if not _is_animating:
		return
	
	_pulse_tween = create_tween().set_loops()
	var base_scale := _spinner.scale
	_pulse_tween.tween_property(_spinner, "scale", base_scale * 1.2, 0.5)
	_pulse_tween.tween_property(_spinner, "scale", base_scale, 0.5)

func _animate_dots() -> void:
	if not _is_animating or _dots.is_empty():
		return
	
	_dots_tween = create_tween().set_loops()
	
	# Animate dots in sequence: dot1 -> dot2 -> dot3 -> repeat
	var base_scale := Vector2(0.8, 0.8)
	var large_scale := Vector2(1.3, 1.3)
	var delay := 0.15
	
	for i in range(3):
		var dot := _dots[i]
		_dots_tween.tween_property(dot, "scale", large_scale, 0.2)
		_dots_tween.tween_property(dot, "scale", base_scale, 0.2)
		if i < 2:
			_dots_tween.tween_interval(delay)

func set_animation_style(style: AnimationStyle) -> void:
	animation_style = style
	if _is_animating:
		_stop_animation()
		_start_loading_animation()

func _animate_progress() -> void:
	if not _is_animating:
		return
	
	# Cycle through values for spinning effect
	var tween = create_tween()
	var duration = 1.0 / rotation_speed
	
	# Animate from 0 to 100
	tween.tween_property(_spinner, "value", 100.0, duration).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_LINEAR)
	tween.tween_callback(_animate_progress)

func is_animating() -> bool:
	return _is_animating

func set_color(new_color: Color) -> void:
	color = new_color
	setup_spinner()

func set_indicator_size(new_size: Vector2) -> void:
	indicator_size = new_size
	setup_spinner()

# --- Full Screen Overlay ---

## Show as a full screen overlay with optional message
func show_overlay(message: String = "") -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	modulate.a = 0.0
	
	if message != "":
		var label = Label.new()
		label.text = message
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		label.position.y = indicator_size.y + 20
		label.add_theme_font_size_override("font_size", 16)
		add_child(label)
	
	start()

## Hide the full screen overlay
func hide_overlay() -> void:
	stop()
	await get_tree().create_timer(fade_out_duration).timeout
	# Remove any labels we added
	for child in get_children():
		if child is Label:
			child.queue_free()
