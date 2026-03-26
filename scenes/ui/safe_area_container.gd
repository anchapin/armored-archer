extends MarginContainer

var _margin_left_offset: float = 0.0
var _margin_top_offset: float = 0.0
var _margin_right_offset: float = 0.0
var _margin_bottom_offset: float = 0.0

func _ready() -> void:
	if SafeAreaManager.safe_area_changed.is_connected(_on_safe_area_changed):
		SafeAreaManager.safe_area_changed.disconnect(_on_safe_area_changed)

	var _err = SafeAreaManager.safe_area_changed.connect(_on_safe_area_changed)
	_update_margins()

func set_margin_offset(left: float = 0.0, top: float = 0.0, right: float = 0.0, bottom: float = 0.0) -> void:
	_margin_left_offset = left
	_margin_top_offset = top
	_margin_right_offset = right
	_margin_bottom_offset = bottom
	_update_margins()

func _on_safe_area_changed() -> void:
	_update_margins()

func _update_margins() -> void:
	var safe_margins: Dictionary = SafeAreaManager.get_safe_margins()
	add_theme_constant_override("margin_left", int(safe_margins.left + _margin_left_offset))
	add_theme_constant_override("margin_top", int(safe_margins.top + _margin_top_offset))
	add_theme_constant_override("margin_right", int(safe_margins.right + _margin_right_offset))
	add_theme_constant_override("margin_bottom", int(safe_margins.bottom + _margin_bottom_offset))

func _exit_tree() -> void:
	# Disconnect signal to prevent memory leaks
	if SafeAreaManager.safe_area_changed.is_connected(_on_safe_area_changed):
		SafeAreaManager.safe_area_changed.disconnect(_on_safe_area_changed)
