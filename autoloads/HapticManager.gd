## Haptic Feedback Manager
## Centralized haptic feedback for mobile devices.
## Respects user preference, device tier, and platform capabilities.
extends Node

signal haptics_toggled(enabled: bool)

var _haptics_enabled: bool = true
var _is_mobile: bool = false
var _is_budget_device: bool = false
const _SETTINGS_PATH: String = "user://settings.json"


func _ready() -> void:
	_is_mobile = OS.has_feature("android") or OS.has_feature("ios")
	_load_settings()

	var profiler = get_node_or_null("/root/PerformanceProfiler")
	if profiler and profiler.has_method("is_budget_device"):
		_is_budget_device = profiler.is_budget_device()


func is_haptics_enabled() -> bool:
	return _haptics_enabled and _is_mobile


func set_haptics_enabled(enabled: bool) -> void:
	_haptics_enabled = enabled
	_save_settings()
	haptics_toggled.emit(enabled)


func light_tap() -> void:
	if not is_haptics_enabled():
		return
	Input.vibrate(30)


func medium_tap() -> void:
	if not is_haptics_enabled():
		return
	if _is_budget_device:
		Input.vibrate(20)
		return
	Input.vibrate(50)


func heavy_tap() -> void:
	if not is_haptics_enabled():
		return
	if _is_budget_device:
		Input.vibrate(30)
		return
	Input.vibrate(80)


func success_pulse() -> void:
	if not is_haptics_enabled():
		return
	if _is_budget_device:
		Input.vibrate(40)
		return
	Input.vibrate(50)
	await get_tree().create_timer(0.1).timeout
	Input.vibrate(50)


func damage_pulse() -> void:
	if not is_haptics_enabled():
		return
	if _is_budget_device:
		Input.vibrate(40)
		return
	Input.vibrate(60)
	await get_tree().create_timer(0.08).timeout
	Input.vibrate(40)


func _load_settings() -> void:
	if not FileAccess.file_exists(_SETTINGS_PATH):
		return
	var file = FileAccess.open(_SETTINGS_PATH, FileAccess.READ)
	if not file:
		return
	var json = JSON.new()
	if json.parse(file.get_as_text()) == OK:
		var data = json.data
		if data is Dictionary and data.has("haptics_enabled"):
			_haptics_enabled = data["haptics_enabled"]
	file.close()


func _save_settings() -> void:
	var data: Dictionary = {}
	if FileAccess.file_exists(_SETTINGS_PATH):
		var file = FileAccess.open(_SETTINGS_PATH, FileAccess.READ)
		if file:
			var json = JSON.new()
			if json.parse(file.get_as_text()) == OK:
				data = json.data
			file.close()
	data["haptics_enabled"] = _haptics_enabled
	var file = FileAccess.open(_SETTINGS_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data, "\t"))
		file.close()
