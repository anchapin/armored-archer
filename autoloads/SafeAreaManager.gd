extends Node

signal safe_area_changed

var safe_margins: Dictionary = {"left": 0.0, "top": 0.0, "right": 0.0, "bottom": 0.0}

func _ready() -> void:
	get_tree().root.size_changed.connect(_on_screen_size_changed)
	_update_safe_area()

func _update_safe_area() -> void:
	var screen_size: Vector2i = DisplayServer.screen_get_size()
	var safe_rects: Array[Rect2i] = DisplayServer.screen_get_safe_rects()
	
	if safe_rects.is_empty():
		safe_margins = {"left": 0.0, "top": 0.0, "right": 0.0, "bottom": 0.0}
		return
	
	var safe_rect: Rect2i = safe_rects[0]
	safe_margins.left = float(safe_rect.position.x)
	safe_margins.top = float(safe_rect.position.y)
	safe_margins.right = float(screen_size.x - safe_rect.end.x)
	safe_margins.bottom = float(screen_size.y - safe_rect.end.y)
	
	safe_area_changed.emit()

func _on_screen_size_changed() -> void:
	_update_safe_area()

func get_safe_margins() -> Dictionary:
	return safe_margins

func apply_to_control(control: Control) -> void:
	control.offset_left += safe_margins.left
	control.offset_top += safe_margins.top
	control.offset_right -= safe_margins.right
	control.offset_bottom -= safe_margins.bottom
