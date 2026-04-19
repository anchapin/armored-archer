## Manages safe area margins for notched displays and rounded corners.
## Adjusts UI positioning to avoid screen unsafe areas.
##
extends Node

signal safe_area_changed

var safe_margins: Dictionary = {"left": 0.0, "top": 0.0, "right": 0.0, "bottom": 0.0}

func _ready() -> void:
	"""Sets up signal connections and calculates initial safe area."""
	var _err = get_tree().root.size_changed.connect(_on_screen_size_changed)
	_update_safe_area()

func _update_safe_area() -> void:
	"""Calculates safe area margins from display server and converts to viewport coordinates."""
	var safe_rect: Rect2i = DisplayServer.get_display_safe_area()
	var screen_size: Vector2i = DisplayServer.screen_get_size()

	# Raw screen-pixel margins
	var raw_left: float = float(safe_rect.position.x)
	var raw_top: float = float(safe_rect.position.y)
	var raw_right: float = float(screen_size.x - safe_rect.end.x)
	var raw_bottom: float = float(screen_size.y - safe_rect.end.y)

	# Convert to viewport coordinates (project uses 640x360 with canvas_items stretch)
	var viewport: Viewport = get_viewport()
	if viewport and screen_size.x > 0 and screen_size.y > 0:
		var viewport_size: Vector2 = viewport.get_visible_rect().size
		var scale_x: float = viewport_size.x / float(screen_size.x)
		var scale_y: float = viewport_size.y / float(screen_size.y)
		safe_margins.left = raw_left * scale_x
		safe_margins.top = raw_top * scale_y
		safe_margins.right = raw_right * scale_x
		safe_margins.bottom = raw_bottom * scale_y
	else:
		safe_margins.left = raw_left
		safe_margins.top = raw_top
		safe_margins.right = raw_right
		safe_margins.bottom = raw_bottom

	safe_area_changed.emit()

func _on_screen_size_changed() -> void:
	"""Updates safe area when screen size changes."""
	_update_safe_area()

func get_safe_margins() -> Dictionary:
	"""Returns current safe area margins.

	Returns:
		Dictionary: Margins with keys "left", "top", "right", "bottom"
	"""
	return safe_margins

func apply_to_control(control: Control) -> void:
	"""Applies safe area margins to a Control node.

	Parameters:
		control: Control node to adjust with safe area offsets
	"""
	control.offset_left += safe_margins.left
	control.offset_top += safe_margins.top
	control.offset_right -= safe_margins.right
	control.offset_bottom -= safe_margins.bottom
