class_name BaseIcon
extends TextureRect

# =============================================================================
# BASE ICON - Armored Archer
# =============================================================================
# Reusable icon component for consistent icon handling.
# Supports tinting, scaling, and accessibility.
# =============================================================================

@export var icon_color: Color = Color.WHITE
@export var hover_color: Color = Color(1.1, 1.1, 1.1, 1.0)  # Slight brightening
@export var disabled_color: Color = Color(0.5, 0.5, 0.5, 1.0)
@export var is_disabled: bool = false

var _default_texture: Texture2D
var _is_hovered: bool = false

# --- Lifecycle ---
func _ready() -> void:
	_setup_icon()

# =============================================================================
# PUBLIC API
# =============================================================================

## Set the icon texture
func set_icon(texture: Texture2D) -> void:
	texture = texture
	_default_texture = texture
	if texture:
		expand_mode = ExpandMode.EXPAND_IGNORE_SIZE
		stretch_mode = StretchMode.STRETCH_KEEP_ASPECT_CENTERED

## Set the icon color/tint
func set_icon_color(color: Color) -> void:
	icon_color = color
	_update_color()

## Get current icon color
func get_icon_color() -> Color:
	return icon_color

## Set disabled state
func set_disabled(disabled: bool) -> void:
	is_disabled = disabled
	_update_color()

## Check if icon is disabled
func get_disabled() -> bool:
	return is_disabled

## Set icon size
func set_icon_size(size: Vector2) -> void:
	custom_minimum_size = size

# =============================================================================
# INTERNAL
# =============================================================================

func _setup_icon() -> void:
	# Set default stretch mode for icons
	stretch_mode = StretchMode.STRETCH_KEEP_ASPECT_CENTERED
	expand_mode = ExpandMode.EXPAND_IGNORE_SIZE
	
	# Enable mouse detection for hover effects
	mouse_filter = Control.MOUSE_FILTER_PASS
	
	_update_color()

func _update_color() -> void:
	if is_disabled:
		modulate = disabled_color
	elif _is_hovered:
		modulate = hover_color
	else:
		modulate = icon_color

func _on_mouse_entered() -> void:
	_is_hovered = true
	_update_color()

func _on_mouse_exited() -> void:
	_is_hovered = false
	_update_color()

# =============================================================================
# ACCESSIBILITY
# =============================================================================

var _accessibility_label: String = ""

## Set accessibility label for screen readers
func set_accessibility_label(label: String) -> void:
	# Note: Godot 4.x has built-in accessibility properties
	# For custom implementation, store the label
	_accessibility_label = label

func get_accessibility_label() -> String:
	return _accessibility_label
