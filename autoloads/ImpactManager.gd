## Impact Manager autoload for screen shake and impact effects.
## Provides screen shake configuration and particle burst spawning.
##
## Signals:
## - shake_started(): Emitted when screen shake starts
## - shake_completed(): Emitted when screen shake finishes

extends Node

# --- Signals ---
signal shake_started()
signal shake_completed()

# --- Shake Configuration ---
var shake_config: Dictionary = {
	"light": {"intensity": 2, "duration": 0.2, "decay": true},
	"medium": {"intensity": 5, "duration": 0.4, "decay": true},
	"heavy": {"intensity": 10, "duration": 0.6, "decay": true}
}

# --- State ---
var _camera: Camera2D
var _current_shake: Dictionary = {}
var _is_shaking: bool = false
var _active_shake_duration: float = 0.0
var _shake_timer: float = 0.0

# --- Node References ---
var _vfx_manager: Node

# --- Initialization ---
func _ready() -> void:
	_camera = get_viewport_camera()
	_vfx_manager = get_node_or_null("/root/VFXManager")

# --- Helper Methods ---

## Get the viewport camera
func get_viewport_camera() -> Camera2D:
	var viewport = get_viewport()
	if not viewport:
		return null
	return viewport.get_camera_2d()

# --- Public API ---

## Shake screen with configurable intensity and duration
##
## Parameters:
##   intensity: Shake strength ("light", "medium", "heavy")
##   duration: Shake duration in seconds
##   decay: Whether to decay smoothly
##
## Returns:
##   Dictionary: Result dictionary
func shake_screen(intensity: String, duration: float, decay: bool) -> Dictionary:
	if not shake_config.has(intensity):
		return {"success": false, "error": "Invalid shake intensity: %s" % intensity}

	var config = shake_config[intensity]
	_is_shaking = true
	_current_shake = config
	_active_shake_duration = duration

	shake_started.emit()

	var result = {}

	# Wait for shake duration
	await get_tree().create_timer(duration).timeout

	# Decay shake smoothly
	if decay:
		for i in range(10):
			var progress = float(i) / 10.0
			_apply_shake_progress(progress)
			await get_tree().process_frame
			_current_shake.intensity = _current_shake.intensity * (1.0 - progress)
		_is_shaking = true
		_shake_timer += get_process_delta_time() * _current_shake.duration
		_is_shaking = false
		_current_shake = {}
		_active_shake_duration = 0.0
		shake_completed.emit(result)

	return result

## Apply shake progress
##
## Parameters:
##   progress: Progress value (0.0 to 1.0)
func _apply_shake_progress(progress: float) -> void:
	# Apply camera offset based on shake intensity
	if _camera and _current_shake:
		var intensity = _current_shake.intensity * progress
		var offset_range = _current_shake.intensity * 5.0
		var offset_x = (randf() - 0.5) * offset_range
		var offset_y = (randf() - 0.5) * offset_range

		_camera.offset = Vector2(offset_x, offset_y)

## Get current shake state
##
## Returns:
##   Dictionary: {"is_shaking": bool, "active_shake_duration": float}
func get_shake_state() -> Dictionary:
	return {
		"is_shaking": _is_shaking,
		"active_shake_duration": _active_shake_duration
	}

## Check if shake is currently active
##
## Returns:
##   bool: True if shaking
func is_shake_active() -> bool:
	return _is_shaking

func _process(delta: float) -> void:
	if _is_shaking:
		_shake_timer -= delta
		if _shake_timer <= 0:
			_complete_shake()

## Complete current shake
func _complete_shake() -> void:
	_is_shaking = false
	_current_shake = {}
	_active_shake_duration = 0.0
	shake_completed.emit({"success": true})

# --- Screen Flash for Power-ups ---

## Flash the screen with a color for power-up effects
##
## Parameters:
##   color: Color to flash
##   duration: Duration in seconds
func flash_screen(color: Color, duration: float) -> void:
	# Create a full-screen overlay for the flash
	var viewport = get_viewport()
	if not viewport:
		return

	var canvas_layer = CanvasLayer.new()
	canvas_layer.layer = 100  # Top layer

	var flash = ColorRect.new()
	flash.color = color
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	flash.set_anchors_preset(Control.PRESET_FULL_RECT)
	flash.mouse_default_cursor_shape = Control.CURSOR_ARROW

	canvas_layer.add_child(flash)
	viewport.add_child(canvas_layer)

	# Fade out and remove
	var tween = create_tween()
	tween.tween_property(flash, "modulate:a", 0.0, duration).set_trans(Tween.TRANS_SINE)
	tween.tween_callback(canvas_layer.queue_free)

# --- Helper for creating tweens (Godot 4.x compatible) ---
func create_tween() -> Tween:
	return get_tree().create_tween()
