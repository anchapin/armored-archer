# Login Screen - Handles Nakama authentication UI
# Updated: 2026-03-15 - Fixed button null reference issue
extends Control

# --- UI References ---
var loading_label: Label
var status_label: Label
var retry_button: Button
var test_connection_button: Button
var progress_bar: ProgressBar

# --- State ---
var is_connecting: bool = false

# --- Signals ---
signal login_complete(success: bool)

# --- Initialization ---
func _ready() -> void:
	# Get UI nodes manually with error checking
	var vbox: VBoxContainer = $VBoxContainer

	loading_label = vbox.get_node_or_null("LoadingLabel") as Label
	status_label = vbox.get_node_or_null("StatusLabel") as Label
	retry_button = vbox.get_node_or_null("RetryButton") as Button
	test_connection_button = vbox.get_node_or_null("TestConnectionButton") as Button
	progress_bar = vbox.get_node_or_null("ProgressBar") as ProgressBar

	# Verify critical nodes
	if not loading_label or not status_label or not progress_bar:
		push_error("LoginScreen: Critical UI nodes not found!")
		return

	# Connect NetworkManager signals
	var _err1 = NetworkManager.session_created.connect(_on_session_created)
	var _err2 = NetworkManager.connection_status_changed.connect(_on_connection_status_changed)

	# Connect button signals
	if retry_button:
		var _err3 = retry_button.pressed.connect(_on_retry_pressed)
		retry_button.hide()

	if test_connection_button:
		var _err4 = test_connection_button.pressed.connect(_on_test_connection_pressed)
		test_connection_button.hide()

	_start_authentication()

func _start_authentication() -> void:
	is_connecting = true
	loading_label.text = "Connecting..."
	status_label.text = "Authenticating with Nakama server..."
	progress_bar.value = 0.0

	var tween: Tween = create_tween()
	var _t1 = tween.tween_property(progress_bar, "value", 50.0, 1.0)
	var _t2 = tween.tween_interval(0.5)

	# NetworkManager auto-connects in _ready(), so we just wait for the signal

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

		if retry_button:
			retry_button.show()
		if test_connection_button:
			test_connection_button.show()  # Show debug button on failure

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
			if retry_button:
				retry_button.show()
			if test_connection_button:
				test_connection_button.show()  # Show debug button on failure

func _on_retry_pressed() -> void:
	if retry_button:
		retry_button.hide()
	_start_authentication()

func _on_test_connection_pressed() -> void:
	var err = get_tree().change_scene_to_file("res://scenes/ui/connection_test_scene.tscn")
	if err != OK:
		push_error("Failed to load connection test scene: %d" % err)

# --- Navigation ---
func _load_main_menu() -> void:
	var _err = get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

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
