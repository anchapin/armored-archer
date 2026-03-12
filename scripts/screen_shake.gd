extends Node

## Screen shake effect controller.
## Applies a camera shake effect to the current camera.

# --- Configuration ---
var shake_intensity: float = 10.0
var shake_duration: float = 0.3
var shake_frequency: float = 30.0

# --- State ---
var _is_shaking: bool = false
var _shake_time: float = 0.0
var _original_offset: Vector2 = Vector2.ZERO
var _camera: Camera2D = null


func _ready() -> void:
	# Find camera in scene
	_get_camera()


func _get_camera() -> void:
	"""Find the active camera in the scene."""
	var tree := get_tree()
	if tree:
		var current_scene := tree.current_scene
		if current_scene:
			_camera = current_scene.get_viewport().get_camera_2d()


func _process(delta: float) -> void:
	if not _is_shaking or _camera == null:
		return

	_shake_time += delta
	
	if _shake_time >= shake_duration:
		_stop_shake()
		return

	# Calculate shake offset using perlin-like noise
	var progress := _shake_time / shake_duration
	var intensity := shake_intensity * (1.0 - progress)  # Decay over time
	
	var offset := Vector2(
		_get_noise(_shake_time * shake_frequency) * intensity,
		_get_noise(_shake_time * shake_frequency + 100.0) * intensity
	)
	
	_camera.offset = offset


func _get_noise(time: float) -> float:
	"""Simple noise function using sin waves."""
	return sin(time * 12.9898) * sin(time * 78.233)


func start_shake(intensity: float = 10.0, duration: float = 0.3, frequency: float = 30.0) -> void:
	"""Start a screen shake with the given parameters."""
	if _camera == null:
		_get_camera()
	
	if _camera == null:
		push_warning("ScreenShake: No camera found")
		return

	shake_intensity = intensity
	shake_duration = duration
	shake_frequency = frequency
	
	_is_shaking = true
	_shake_time = 0.0
	_original_offset = _camera.offset


func _stop_shake() -> void:
	"""Stop the screen shake and reset camera offset."""
	_is_shaking = false
	if _camera:
		_camera.offset = Vector2.ZERO


func is_shaking() -> bool:
	"""Check if screen shake is currently active."""
	return _is_shaking


# --- Convenience methods ---

func shake_light() -> void:
	"""Start a light shake (for minor hits)."""
	start_shake(5.0, 0.15, 30.0)


func shake_medium() -> void:
	"""Start a medium shake (for regular hits)."""
	start_shake(10.0, 0.25, 30.0)


func shake_heavy() -> void:
	"""Start a heavy shake (for critical hits or big impacts)."""
	start_shake(20.0, 0.4, 35.0)


func shake_impact() -> void:
	"""Start an impact shake (for boss hits or explosions)."""
	start_shake(30.0, 0.5, 40.0)
