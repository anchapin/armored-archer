extends Control

# --- UI References ---
@onready var loading_label: Label = $VBoxContainer/LoadingLabel
@onready var status_label: Label = $VBoxContainer/StatusLabel
@onready var retry_button: Button = $VBoxContainer/RetryButton
@onready var progress_bar: ProgressBar = $VBoxContainer/ProgressBar

# --- State ---
var is_connecting: bool = false

# --- Signals ---
signal login_complete(success: bool)

# --- Initialization ---
func _ready() -> void:
	var _err1 = NetworkManager.session_created.connect(_on_session_created)
	var _err2 = NetworkManager.connection_status_changed.connect(_on_connection_status_changed)

	var _err3 = retry_button.pressed.connect(_on_retry_pressed)
	retry_button.hide()

	_start_authentication()

func _start_authentication() -> void:
	is_connecting = true
	loading_label.text = "Connecting..."
	status_label.text = "Authenticating with Nakama server..."
	progress_bar.value = 0.0

	var tween: Tween = create_tween()
	var _t1 = tween.tween_property(progress_bar, "value", 50.0, 1.0)
	var _t2 = tween.tween_interval(0.5)

	NetworkManager.authenticate_device()

# --- Signal Handlers ---
func _on_session_created(success: bool, error_message: String) -> void:
	is_connecting = false

	var tween: Tween = create_tween()

	if success:
		loading_label.text = "Connected!"
		status_label.text = "Welcome back, %s!" % NetworkManager.username
		progress_bar.value = 100.0

		var _t1 = tween.tween_interval(0.5)
		var _t2 = tween.tween_callback(_load_main_menu)

		login_complete.emit(true)
	else:
		loading_label.text = "Connection Failed"
		status_label.text = error_message
		progress_bar.value = 0.0

		retry_button.show()

func _on_connection_status_changed(is_online: bool) -> void:
	if is_online:
		if not is_connecting and not NetworkManager.is_connected:
			_start_authentication()
	else:
		loading_label.text = "Offline"
		status_label.text = "Please check your internet connection"
		progress_bar.value = 0.0

		if is_connecting:
			is_connecting = false
			retry_button.show()

func _on_retry_pressed() -> void:
	retry_button.hide()
	_start_authentication()

# --- Navigation ---
func _load_main_menu() -> void:
	var _err = get_tree().change_scene_to_file("res://scenes/main_menu.tscn")

# --- Progress Bar Animation ---
func _process(delta: float) -> void:
	if is_connecting:
		progress_bar.value += delta * 10
		if progress_bar.value > 50.0:
			progress_bar.value = 50.0

func _exit_tree() -> void:
	# Disconnect signals to prevent memory leaks
	if NetworkManager:
		if NetworkManager.session_created.is_connected(_on_session_created):
			NetworkManager.session_created.disconnect(_on_session_created)
		if NetworkManager.connection_status_changed.is_connected(_on_connection_status_changed):
			NetworkManager.connection_status_changed.disconnect(_on_connection_status_changed)
