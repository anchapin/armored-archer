# Login Screen - Handles Nakama authentication UI
# Updated: 2026-03-15 - Fixed button null reference issue
# Updated: 2026-03-17 - Added design system support
extends Control

# --- UI References ---
var loading_label: Label
var status_label: Label
var retry_button: ArcheryBaseButton
var test_connection_button: ArcheryBaseButton
var progress_bar: ProgressBar
# Issue #908 — actionable error panel
var error_panel: PanelContainer
var error_title_label: Label
var error_message_label: Label
var guidance_label: Label
var error_retry_button: ArcheryBaseButton

# --- Theme Manager Reference ---
var theme_manager: Node

# --- State ---
var is_connecting: bool = false

# --- Signals ---
signal login_complete(success: bool)

# --- Initialization ---
func _ready() -> void:
	# Issue #913 — fade in from black so menu transitions feel seamless.
	_play_fade_in()

	# Get ThemeManager reference
	theme_manager = get_node_or_null("/root/ThemeManager")
	
	# Apply theme if available
	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)
	
	# Get UI nodes manually with error checking
	var vbox: VBoxContainer = $VBoxContainer

	loading_label = vbox.get_node_or_null("LoadingLabel") as Label
	status_label = vbox.get_node_or_null("StatusLabel") as Label
	retry_button = vbox.get_node_or_null("RetryButton") as ArcheryBaseButton
	test_connection_button = vbox.get_node_or_null("TestConnectionButton") as ArcheryBaseButton
	progress_bar = vbox.get_node_or_null("ProgressBar") as ProgressBar

	# Issue #908: error panel nodes (hidden by default)
	error_panel = get_node_or_null("ErrorPanel") as PanelContainer
	if error_panel:
		error_title_label = error_panel.get_node_or_null("ErrorVBox/ErrorTitleLabel") as Label
		error_message_label = error_panel.get_node_or_null("ErrorVBox/ErrorMessageLabel") as Label
		guidance_label = error_panel.get_node_or_null("ErrorVBox/GuidanceLabel") as Label
		error_retry_button = error_panel.get_node_or_null("ErrorVBox/ErrorRetryButton") as ArcheryBaseButton
		error_panel.hide()
		if error_retry_button:
			var _err5 = error_retry_button.pressed.connect(_on_error_retry_pressed)

	# Verify critical nodes
	if not loading_label or not status_label or not progress_bar:
		push_error("LoginScreen: Critical UI nodes not found!")
		return

	# Connect NetworkManager signals
	var _err1 = NetworkManager.session_created.connect(_on_session_created)
	var _err2 = NetworkManager.connection_status_changed.connect(_on_connection_status_changed)
	if NetworkManager.has_signal("auth_blocked"):
		var _err_blocked = NetworkManager.auth_blocked.connect(_on_auth_blocked)

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

	if success:
		loading_label.text = "Connected!"
		status_label.text = "Welcome back, %s!" % NetworkManager.username
		progress_bar.value = 100.0

		var tween: Tween = create_tween()
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

# Issue #908: when the bounded auth timer / health-gate fires, NetworkManager
# emits auth_blocked(reason, guidance). We hide the spinner, populate the
# error panel, and wait for the user to press Retry.
func _on_auth_blocked(reason: String, guidance: String) -> void:
	is_connecting = false
	if loading_label:
		loading_label.text = "Cannot connect"
	if status_label:
		status_label.text = reason
	if progress_bar:
		progress_bar.value = 0
	if error_panel:
		if error_title_label:
			error_title_label.text = "Cannot reach server"
		if error_message_label:
			error_message_label.text = reason
		if guidance_label:
			guidance_label.text = guidance
		error_panel.show()

func _on_error_retry_pressed() -> void:
	if error_panel:
		error_panel.hide()
	_start_authentication()

func _on_test_connection_pressed() -> void:
	_transition_to_scene("res://scenes/ui/connection_test_scene.tscn")

# --- Navigation ---
func _load_main_menu() -> void:
	_transition_to_scene("res://scenes/ui/main_menu.tscn")

# --- Fade Transitions (issue #913) ---
const FADE_OUT_DURATION: float = 0.2
const FADE_IN_DURATION: float = 0.2
var _fade_rect: ColorRect = null

## Fade-out current screen, swap scene, fade-in the next. Used for all menu
## transitions (login → main menu → campaign map at minimum).
func _transition_to_scene(scene_path: String) -> void:
	var ui_automation: Node = get_node_or_null("/root/UIAutomation")
	if ui_automation and ui_automation.has_method("are_animations_enabled") and not ui_automation.are_animations_enabled():
		get_tree().change_scene_to_file(scene_path)
		return

	var fade_rect := _ensure_fade_overlay()
	if not fade_rect:
		get_tree().change_scene_to_file(scene_path)
		return
	# Fade out black, then swap scenes
	var tween := create_tween()
	tween.tween_property(fade_rect, "color:a", 1.0, FADE_OUT_DURATION).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	tween.tween_callback(func(): get_tree().change_scene_to_file(scene_path))

## Build (or reuse) a fullscreen ColorRect used as a fade overlay.
func _ensure_fade_overlay() -> ColorRect:
	if _fade_rect and is_instance_valid(_fade_rect):
		return _fade_rect
	var rect := ColorRect.new()
	rect.name = "FadeOverlay"
	rect.color = Color(0, 0, 0, 0)
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(rect)
	_fade_rect = rect
	return rect

## Fade from black back to clear (used after a fade-out scene change).
func _play_fade_in() -> void:
	var fade_rect := _ensure_fade_overlay()
	if not fade_rect:
		return
	fade_rect.color = Color(0, 0, 0, 1.0)
	var tween := create_tween()
	tween.tween_property(fade_rect, "color:a", 0.0, FADE_IN_DURATION).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)

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
		if NetworkManager.has_signal("auth_blocked") and NetworkManager.auth_blocked.is_connected(_on_auth_blocked):
			NetworkManager.auth_blocked.disconnect(_on_auth_blocked)

	# Disconnect theme manager
	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)

# --- Theme Support ---
func _apply_theme() -> void:
	if not theme_manager:
		return
	
	var colors = theme_manager.get_theme_colors()
	
	# Apply background color
	theme_manager.apply_background(self)

func _on_theme_changed(is_dark: bool) -> void:
	_apply_theme()
