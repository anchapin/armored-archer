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
@export var color: Color = Color(1, 0.675, 0.329)  # Golden (RA_PRIMARY)
@export var background_color: Color = Color(0, 0, 0, 0.3)
@export var indicator_size: Vector2 = Vector2(64, 64)
@export var line_width: float = 4.0

@export_group("Animation")
@export var rotation_speed: float = 2.0  # rotations per second
@export var fade_in_duration: float = 0.2
@export var fade_out_duration: float = 0.2
@export var pulse_enabled: bool = true

# --- State ---
var _is_animating: bool = false
var _rotation: float = 0.0
var _tween: Tween = null

# --- Nodes ---
@onready var _center_container: CenterContainer = $CenterContainer
@onready var _spinner: ProgressBar = $CenterContainer/Spinner

func _ready() -> void:
	visible = false
	modulate.a = 0.0
	setup_spinner()

func _process(delta: float) -> void:
	if _is_animating:
		_rotation += delta * rotation_speed * TAU
		if _spinner and is_instance_valid(_spinner):
			_spinner.rotation = _rotation
			# Add subtle pulse effect
			if pulse_enabled:
				var pulse = 0.9 + 0.1 * sin(Time.get_ticks_msec() * 0.005)
				_spinner.scale = Vector2(pulse, pulse)

func setup_spinner() -> void:
	# Create a circular progress indicator using a texture
	if not _spinner:
		return
	
	_spinner.custom_minimum_size = indicator_size
	
	# Use a StyleBoxFlat for the spinner background
	var style = StyleBoxFlat.new()
	style.bg_color = background_color
	style.corner_radius_top_left = indicator_size.x / 2
	style.corner_radius_top_right = indicator_size.x / 2
	style.corner_radius_bottom_left = indicator_size.x / 2
	style.corner_radius_bottom_right = indicator_size.x / 2
	style.set_border_width_all(0)
	
	# Create a progress fill style with golden gradient effect
	var fill_style = StyleBoxFlat.new()
	fill_style.bg_color = color
	fill_style.corner_radius_top_left = indicator_size.x / 2
	fill_style.corner_radius_top_right = indicator_size.x / 2
	fill_style.corner_radius_bottom_left = indicator_size.x / 2
	fill_style.corner_radius_bottom_right = indicator_size.x / 2
	style.set_border_width_all(line_width / 2)
	
	# Apply styles
	_spinner.add_theme_stylebox_override("background", style)
	_spinner.add_theme_stylebox_override("fill", fill_style)
	
	# Configure progress bar
	_spinner.min_value = 0
	_spinner.max_value = 100
	_spinner.value = 25
	_spinner.fill_mode = ProgressBar.FILL_BEGIN_TO_END
	_spinner.show_percentage = false
	
	# Add glow effect for golden color
	var glow_style = StyleBoxFlat.new()
	glow_style.bg_color = Color(0, 0, 0, 0)
	glow_style.shadow_color = color
	glow_style.shadow_size = 8
	glow_style.corner_radius_top_left = indicator_size.x / 2 + 4
	glow_style.corner_radius_top_right = indicator_size.x / 2 + 4
	glow_style.corner_radius_bottom_left = indicator_size.x / 2 + 4
	glow_style.corner_radius_bottom_right = indicator_size.x / 2 + 4
	add_theme_stylebox_override("panel", glow_style)

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
	
	# Animate the progress value
	_animate_progress()

func stop() -> void:
	if not _is_animating:
		return
	
	_is_animating = false
	
	# Fade out
	if _tween:
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(self, "modulate:a", 0.0, fade_out_duration).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_SINE)
	_tween.tween_callback(func(): visible = false)

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
	
	# Add dark background
	var bg = ColorRect.new()
	bg.color = Color(0, 0, 0, 0.5)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	
	if message != "":
		var label = Label.new()
		label.text = message
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		label.position.y = indicator_size.y + 20
		label.add_theme_color_override("font_color", Color(1, 0.675, 0.329))  # Golden
		label.add_theme_font_size_override("font_size", 20)
		label.add_theme_color_override("font_outline_color", Color(0, 0, 0))
		label.add_theme_constant_override("outline_size", 1)
		add_child(label)
	else:
		# Default loading message with dots animation
		_create_loading_dots()
	
	start()

func _create_loading_dots() -> void:
	var container = HBoxContainer.new()
	container.alignment = BoxContainer.ALIGNMENT_CENTER
	container.position.y = indicator_size.y + 30
	
	# Create 3 animated dots
	for i in range(3):
		var dot = Label.new()
		dot.text = "•"
		dot.add_theme_font_size_override("font_size", 24)
		dot.add_theme_color_override("font_color", Color(1, 0.675, 0.329))
		dot.set_meta("index", i)
		container.add_child(dot)
	
	# Add animation
	var tween = create_tween()
	tween.set_loops()
	for i in range(3):
		tween.tween_callback(func():
			for child in container.get_children():
				if child is Label:
					child.modulate.a = 0.3
			if i < container.get_child_count():
				container.get_child(i).modulate.a = 1.0
		).set_delay(0.0)
		tween.tween_interval(0.3)
	
	add_child(container)

## Hide the full screen overlay
func hide_overlay() -> void:
	stop()
	await get_tree().create_timer(fade_out_duration).timeout
	# Remove any labels we added
	for child in get_children():
		if child is Label or child is HBoxContainer:
			child.queue_free()
		elif child is ColorRect:
			child.queue_free()
