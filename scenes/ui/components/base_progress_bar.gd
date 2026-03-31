class_name BaseProgressBar
extends ProgressBar

# =============================================================================
# BASE PROGRESS BAR - Armored Archer
# =============================================================================
# Reusable progress bar component for health bars, experience bars, etc.
# Uses DesignTokens for styling.
# =============================================================================

@export var bar_color: Color = DesignTokens.COLOR_HEALTH
@export var background_color: Color = DesignTokens.COLOR_SURFACE_VARIANT_DARK
@export var is_rounded: bool = true

@onready var _fill: ColorRect = $Fill
@onready var _background: ColorRect = $Background

# --- Lifecycle ---
func _ready() -> void:
	_setup_styles()

# =============================================================================
# PUBLIC API
# =============================================================================

## Set the progress value (0.0 to 1.0)
func set_progress(value: float) -> void:
	value = clampf(value, 0.0, 1.0)
	
	if has_theme_stylebox("fill"):
		# Use Godot's built-in progress bar styling
		progress_ratio = value
	else:
		# Manual positioning for custom implementation
		if _fill:
			_fill.size.x = size.x * value

## Set the bar color
func set_bar_color(color: Color) -> void:
	bar_color = color
	if _fill:
		_fill.color = color

## Set the background color
func set_background_color(color: Color) -> void:
	background_color = color
	if _background:
		_background.color = color

## Get current progress value
func get_progress() -> float:
	if has_theme_stylebox("fill"):
		return progress_ratio
	else:
		if _fill and size.x > 0:
			return _fill.size.x / size.x
	return 0.0

# =============================================================================
# STYLING
# =============================================================================

func _setup_styles() -> void:
	# Set up the progress bar styling
	custom_minimum_size = Vector2(0, 20)
	
	if is_rounded:
		theme_type_variation = "FlatProgressBar"
	
	# Apply colors
	modulate = bar_color

func _get_fill_rect() -> ColorRect:
	if not _fill:
		_fill = ColorRect.new()
		_fill.color = bar_color
		_fill.set_anchors_preset(Control.PRESET_FULL_RECT)
		add_child(_fill)
	return _fill

func _get_background_rect() -> ColorRect:
	if not _background:
		_background = ColorRect.new()
		_background.color = background_color
		_background.set_anchors_preset(Control.PRESET_FULL_RECT)
		_background.z_index = -1
		add_child(_background)
	return _background
