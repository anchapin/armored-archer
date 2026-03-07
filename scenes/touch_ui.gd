extends Control

@onready var movement_joystick: Control = get_node_or_null("MovementJoystick")
@onready var aiming_joystick: Control = get_node_or_null("AimingJoystick")

# --- Signal connections for cleanup ---
var _movement_joystick_connection: Callable = Callable()
var _aiming_joystick_moved_connection: Callable = Callable()
var _aiming_joystick_released_connection: Callable = Callable()
var _safe_area_changed_connection: Callable = Callable()

var player: CharacterBody2D

func _ready() -> void:
	_connect_signals()
	_connect_safe_area_manager()

	await get_tree().process_frame
	if get_parent() and get_parent().has_node("Player"):
		player = get_parent().get_node_or_null("Player")

	_adjust_joysticks_for_safe_area()

func _connect_signals() -> void:
	if movement_joystick:
		_movement_joystick_connection = movement_joystick.joystick_moved.connect(_on_movement_joystick_moved)
	if aiming_joystick:
		_aiming_joystick_moved_connection = aiming_joystick.joystick_moved.connect(_on_aiming_joystick_moved)
		_aiming_joystick_released_connection = aiming_joystick.joystick_released.connect(_on_aiming_joystick_released)

func _connect_safe_area_manager() -> void:
	var safe_area_manager: Node = get_node_or_null("/root/SafeAreaManager")
	if safe_area_manager:
		_safe_area_changed_connection = safe_area_manager.safe_area_changed.connect(_on_safe_area_changed)

func _exit_tree() -> void:
	# Clean up connected signals to prevent memory leaks
	_cleanup_signal_connection(movement_joystick, "joystick_moved", _movement_joystick_connection)
	_cleanup_signal_connection(aiming_joystick, "joystick_moved", _aiming_joystick_moved_connection)
	_cleanup_signal_connection(aiming_joystick, "joystick_released", _aiming_joystick_released_connection)

	var safe_area_manager: Node = get_node_or_null("/root/SafeAreaManager")
	_cleanup_signal_connection(safe_area_manager, "safe_area_changed", _safe_area_changed_connection)

func _cleanup_signal_connection(node: Node, signal_name: String, connection: Callable) -> void:
	if node and connection.is_valid() and node.is_connected(signal_name, connection):
		node.disconnect(signal_name, connection)

func _on_safe_area_changed() -> void:
	_adjust_joysticks_for_safe_area()

func _adjust_joysticks_for_safe_area() -> void:
	var safe_margins: Dictionary = SafeAreaManager.get_safe_margins()

	if movement_joystick:
		movement_joystick.offset_left = -200.0 - safe_margins.right
		movement_joystick.offset_bottom = 200.0 - safe_margins.bottom

	if aiming_joystick:
		aiming_joystick.offset_right = 200.0 - safe_margins.left
		aiming_joystick.offset_top = -200.0 - safe_margins.top

func _on_movement_joystick_moved(vector: Vector2) -> void:
	if player:
		player.set_virtual_move_direction(vector)

func _on_aiming_joystick_moved(vector: Vector2) -> void:
	if player:
		player.set_virtual_aim_direction(vector)

func _on_aiming_joystick_released() -> void:
	if player:
		player.set_virtual_aim_direction(Vector2.ZERO)
