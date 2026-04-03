extends ColorRect

## DamageOverlay - Red vignette effect for low player health.
## Shows when player HP is below 30%, fades in/out smoothly.

# --- Configuration ---
@export var show_threshold: float = 0.3  # Show when HP < 30%
@export var fade_duration: float = 0.5  # Time to fade in/out

# --- State ---
var _current_health: int = 100
var _max_health: int = 100
var _is_visible: bool = false
var _tween: Tween = null

# --- References ---
@onready var _game_manager: Node = get_node_or_null("/root/GameManager")


func _ready() -> void:
	# Connect to GameManager health changes if available
	if _game_manager and _game_manager.has_signal("health_changed"):
		_game_manager.health_changed.connect(_on_health_changed)
		_current_health = _game_manager.player_current_health
		_max_health = _game_manager.player_max_health
		_update_visibility()


func _on_health_changed(new_health: int, max_health: int) -> void:
	"""Handle health changes from GameManager."""
	_current_health = new_health
	_max_health = max_health
	_update_visibility()


func _update_visibility() -> void:
	"""Show or hide the damage overlay based on health percentage."""
	if _max_health <= 0:
		return

	var health_percent := float(_current_health) / float(_max_health)
	var should_show := health_percent < show_threshold

	if should_show != _is_visible:
		_is_visible = should_show
		if should_show:
			_fade_in()
		else:
			_fade_out()


func _fade_in() -> void:
	"""Fade in the damage overlay."""
	visible = true
	if _tween:
		_tween.kill()

	_tween = create_tween()
	_tween.set_ease(Tween.EASE_OUT)
	_tween.set_trans(Tween.TRANS_SINE)

	# Animate intensity from 0.0 to 0.6 based on health severity
	var severity := 1.0 - (float(_current_health) / float(_max_health * show_threshold))
	severity = clamp(severity, 0.3, 0.8)

	_tween.tween_property(self, "material:shader_parameter/intensity", severity, fade_duration)


func _fade_out() -> void:
	"""Fade out the damage overlay."""
	if _tween:
		_tween.kill()

	_tween = create_tween()
	_tween.set_ease(Tween.EASE_IN)
	_tween.set_trans(Tween.TRANS_SINE)
	_tween.tween_property(self, "material:shader_parameter/intensity", 0.0, fade_duration)
	_tween.tween_callback(_hide)


func _hide() -> void:
	"""Hide the overlay after fade out completes."""
	visible = false


func set_health(current: int, max: int) -> void:
	"""Manually set health values (for testing or external control)."""
	_current_health = current
	_max_health = max
	_update_visibility()


func is_active() -> bool:
	"""Check if the damage overlay is currently visible."""
	return _is_visible
