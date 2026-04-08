class_name RarityPillar
extends Control

# =============================================================================
# RARITY PILLAR - Armored Archer (Relic Archive)
# =============================================================================
# Vertical progress bar styled with Relic Archive design.
# Use for displaying armor durability or similar metrics.
#
# Features:
# - Vertical orientation (pillar) instead of horizontal bar
# - Color transition from RA_TERTIARY (green) to RA_ERROR (orange/red)
# - Surface tier "well" background for physical gauge appearance
# - No-Line Rule: Use color shifts instead of borders
# - Animated fill transition
# =============================================================================

signal value_changed(new_value: float)

@export var min_value: float = 0.0
@export var max_value: float = 100.0
@export var current_value: float = 100.0
@export var bar_width: int = 12
@export var animate_fill: bool = true

var _is_dark_theme: bool = true
var _display_value: float = 100.0
var _tween: Tween

# --- Scene References ---
@onready var _background: ColorRect = $Background
@onready var _fill: ColorRect = $Fill
@onready var _container: VBoxContainer = $Container

# --- Lifecycle ---
func _ready() -> void:
	_setup_pillar()
	set_value(current_value)

func _setup_pillar() -> void:
	_apply_pillar_style()

# --- Style Updates ---
func _apply_pillar_style() -> void:
	var well_color: Color
	var fill_color: Color

	# Get Relic Archive colors
	if _is_dark_theme:
		well_color = ArcherDesignTokens.RA_SURFACE_VARIANT
		fill_color = ArcherDesignTokens.RA_TERTIARY
	else:
		well_color = ArcherDesignTokens.COLOR_SURFACE_VARIANT
		fill_color = ArcherDesignTokens.COLOR_TERTIARY

	# Apply background (well)
	if _background:
		var bg_style := StyleBoxFlat.new()
		bg_style.bg_color = well_color

		# No-Line Rule: Use corner radius
		bg_style.corner_radius_top_left = ArcherDesignTokens.RA_ROUNDNESS_FOUR
		bg_style.corner_radius_top_right = ArcherDesignTokens.RA_ROUNDNESS_FOUR
		bg_style.corner_radius_bottom_left = ArcherDesignTokens.RA_ROUNDNESS_FOUR
		bg_style.corner_radius_bottom_right = ArcherDesignTokens.RA_ROUNDNESS_FOUR

		_background.add_theme_stylebox_override("panel", bg_style)

	# Apply initial fill color
	if _fill:
		_fill.color = _get_fill_color(_display_value)

# --- Fill Color Calculation ---
func _get_fill_color(value: float) -> Color:
	# Calculate percentage (0.0 to 1.0)
	var percentage := clampf((value - min_value) / (max_value - min_value), 0.0, 1.0)

	# Relic Archive: transition from RA_TERTIARY (green) to RA_ERROR (orange/red)
	if _is_dark_theme:
		var tertiary_color = ArcherDesignTokens.RA_TERTIARY
		var error_color = ArcherDesignTokens.RA_ERROR

		# Linear interpolation between tertiary and error
		return tertiary_color.lerp(error_color, 1.0 - percentage)
	else:
		var tertiary_color = ArcherDesignTokens.COLOR_TERTIARY
		var error_color = ArcherDesignTokens.COLOR_ERROR

		# Linear interpolation between tertiary and error
		return tertiary_color.lerp(error_color, 1.0 - percentage)

# --- Value Updates ---
func set_value(value: float) -> void:
	current_value = clampf(value, min_value, max_value)

	if animate_fill:
		_animate_fill_value(current_value)
	else:
		_display_value = current_value
		_update_fill_visual()

	value_changed.emit(current_value)

func _animate_fill_value(target_value: float) -> void:
	# Cancel existing tween
	if _tween and _tween.is_valid():
		_tween.kill()

	# Create new tween
	_tween = create_tween()
	_tween.tween_method(self, "_set_display_value", _display_value, target_value, 0.3) \
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)

func _set_display_value(value: float) -> void:
	_display_value = value
	_update_fill_visual()

func _update_fill_visual() -> void:
	if not _fill:
		return

	# Update fill color based on current value
	_fill.color = _get_fill_color(_display_value)

	# Calculate fill percentage
	var percentage := clampf((_display_value - min_value) / (max_value - min_value), 0.0, 1.0)

	# Update fill size (vertical fill)
	var total_height := custom_minimum_size.y
	var fill_height := total_height * percentage

	_fill.custom_minimum_size = Vector2(bar_width, fill_height)

# --- Public Methods ---
func get_value() -> float:
	return current_value

func get_percentage() -> float:
	if max_value == min_value:
		return 1.0
	return clampf((current_value - min_value) / (max_value - min_value), 0.0, 1.0)

func set_bar_width(width: int) -> void:
	bar_width = width
	_apply_pillar_style()

func set_dark_theme(is_dark: bool) -> void:
	_is_dark_theme = is_dark
	_apply_pillar_style()
	_update_fill_visual()

func get_is_dark_theme() -> bool:
	return _is_dark_theme
