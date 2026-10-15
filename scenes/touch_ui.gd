extends Control

enum ControlsMode { AUTO, TOUCH, DESKTOP }
@export var controls_mode: ControlsMode = ControlsMode.AUTO
const STICK_SIZE: float = 120.0
const EDGE_PADDING: float = 12.0

@onready var movement_joystick: Control = get_node_or_null("MovementJoystick")
@onready var aiming_joystick: Control = get_node_or_null("AimingJoystick")

# --- Signal connections for cleanup ---
var _movement_joystick_callable: Callable
var _movement_joystick_released_callable: Callable
var _touch_aim_started: bool = false
var _aiming_joystick_moved_callable: Callable
var _aiming_joystick_released_callable: Callable
var _safe_area_changed_callable: Callable

var player: CharacterBody2D

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	apply_controls_mode()
	_connect_signals()
	_connect_safe_area_manager()

	await get_tree().process_frame
	if not is_instance_valid(player) and get_parent() and get_parent().has_node("Player"):
		player = get_parent().get_node_or_null("Player")

	_adjust_joysticks_for_safe_area()

func set_player(new_player: CharacterBody2D) -> void:
	player = new_player

func _connect_signals() -> void:
	if movement_joystick:
		_movement_joystick_callable = _on_movement_joystick_moved
		movement_joystick.joystick_moved.connect(_movement_joystick_callable)
		_movement_joystick_released_callable = _on_movement_joystick_released
		movement_joystick.joystick_released.connect(_movement_joystick_released_callable)
	if aiming_joystick:
		_aiming_joystick_moved_callable = _on_aiming_joystick_moved
		_aiming_joystick_released_callable = _on_aiming_joystick_released
		aiming_joystick.joystick_moved.connect(_aiming_joystick_moved_callable)
		aiming_joystick.joystick_released.connect(_aiming_joystick_released_callable)

func _connect_safe_area_manager() -> void:
	var safe_area_manager: Node = get_node_or_null("/root/SafeAreaManager")
	if safe_area_manager:
		_safe_area_changed_callable = _on_safe_area_changed
		safe_area_manager.safe_area_changed.connect(_safe_area_changed_callable)

func _exit_tree() -> void:
	# Clean up connected signals to prevent memory leaks
	_cleanup_signal_connection(movement_joystick, "joystick_moved", _movement_joystick_callable)
	_cleanup_signal_connection(movement_joystick, "joystick_released", _movement_joystick_released_callable)
	_cleanup_signal_connection(aiming_joystick, "joystick_moved", _aiming_joystick_moved_callable)
	_cleanup_signal_connection(aiming_joystick, "joystick_released", _aiming_joystick_released_callable)

	var safe_area_manager: Node = get_node_or_null("/root/SafeAreaManager")
	_cleanup_signal_connection(safe_area_manager, "safe_area_changed", _safe_area_changed_callable)

func _cleanup_signal_connection(node: Node, signal_name: String, callable: Callable) -> void:
	if node and callable.is_valid() and node.is_connected(signal_name, callable):
		node.disconnect(signal_name, callable)

func _on_safe_area_changed() -> void:
	clear_input()
	_adjust_joysticks_for_safe_area()

func apply_controls_mode() -> void:
	var touch_enabled: bool = controls_mode == ControlsMode.TOUCH or (
		controls_mode == ControlsMode.AUTO and DisplayServer.is_touchscreen_available())
	if not touch_enabled:
		clear_input()
	for joystick in [movement_joystick, aiming_joystick]:
		if joystick:
			joystick.visible = touch_enabled
			joystick.set_process_input(touch_enabled)

func _adjust_joysticks_for_safe_area() -> void:
	var margins: Dictionary = SafeAreaManager.get_safe_margins()
	var bottom: float = maxf(0.0, margins.bottom) + EDGE_PADDING
	if movement_joystick:
		var left: float = maxf(0.0, margins.left) + EDGE_PADDING
		movement_joystick.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
		movement_joystick.offset_left = left
		movement_joystick.offset_right = left + STICK_SIZE
		movement_joystick.offset_top = -bottom - STICK_SIZE
		movement_joystick.offset_bottom = -bottom
	if aiming_joystick:
		var right: float = maxf(0.0, margins.right) + EDGE_PADDING
		aiming_joystick.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
		aiming_joystick.offset_left = -right - STICK_SIZE
		aiming_joystick.offset_right = -right
		aiming_joystick.offset_top = -bottom - STICK_SIZE
		aiming_joystick.offset_bottom = -bottom

func _on_movement_joystick_moved(vector: Vector2) -> void:
	if is_instance_valid(player):
		player.set_virtual_move_direction(vector)
		if vector != Vector2.ZERO:
			TutorialManager.on_input_action("move_right")

func _on_movement_joystick_released() -> void:
	if is_instance_valid(player):
		player.set_virtual_move_direction(Vector2.ZERO)

func _on_aiming_joystick_moved(vector: Vector2) -> void:
	if is_instance_valid(player):
		player.set_virtual_aim_direction(vector)
		if vector != Vector2.ZERO:
			_touch_aim_started = true
			TutorialManager.on_input_action("aim_right")

func _on_aiming_joystick_released() -> void:
	if is_instance_valid(player):
		if _touch_aim_started:
			player._handle_shoot()
			TutorialManager.on_input_action("shoot")
		player.set_virtual_aim_direction(Vector2.ZERO)
	_touch_aim_started = false

## Cancel held touches without treating cancellation as a shot release.
func clear_input() -> void:
	_touch_aim_started = false
	for joystick in [movement_joystick, aiming_joystick]:
		if joystick and joystick.has_method("_release_joystick"):
			joystick._release_joystick()
	if is_instance_valid(player):
		player.set_virtual_move_direction(Vector2.ZERO)
		player.set_virtual_aim_direction(Vector2.ZERO)
