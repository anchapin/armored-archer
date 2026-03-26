# Login Screen - Handles Nakama authentication UI
# Updated: 2026-03-15 - Fixed button null reference issue
# Updated: 2026-03-17 - Added design system support
extends Control
class_name LoginScreen

# Disabled theme preload due to stylebox errors
# const GILDED_THEME: Theme = preload("res://themes/gilded_quest_theme.tres")
const DISPLAY_LABEL_SETTINGS: LabelSettings = preload("res://themes/label_settings/display_large.tres")
const BODY_LABEL_SETTINGS: LabelSettings = preload("res://themes/label_settings/body.tres")
const BUTTON_FONT: Font = preload("res://themes/button_font.tres")

# --- UI References ---
@onready var background_gradient: ColorRect = get_node_or_null("BackgroundGradient")
@onready var hero_glow: ColorRect = get_node_or_null("HeroGlow")
@onready var content_panel: Panel = get_node_or_null("ContentPanel")
@onready var hero_backdrop: ColorRect = get_node_or_null("SafeAreaContainer/HeroBackdrop")

# These will be populated in _ready() after debug
var loading_label: Label
var status_label: Label
var progress_bar: ProgressBar
var retry_button: Button
var test_connection_button: Button

# Debug function to check children
func _get_children() -> void:
	if not content_panel:
		print("ContentPanel is null!")
		return
	print("ContentPanel children: ", content_panel.get_children())
	var v = content_panel.get_node_or_null("VBoxContainer")
	print("VBox via content_panel.get_node: ", v)
	if v:
		print("VBoxContainer children: ", v.get_children())

# --- Theme Manager Reference ---
@onready var theme_manager: ArcherThemeManager = get_node_or_null("/root/ThemeManager")

# --- State ---
var is_connecting: bool = false

# --- Signals ---
signal login_complete(success: bool)

# --- Initialization ---
func _ready() -> void:
	# Debug: Print which nodes are found/missing
	print("LoginScreen _ready: background_gradient=", background_gradient)
	print("LoginScreen _ready: hero_glow=", hero_glow)
	print("LoginScreen _ready: content_panel=", content_panel)
	print("LoginScreen _ready: hero_backdrop=", hero_backdrop)
	
	# Debug: check children hierarchy
	_get_children()
	
	# Try to get VBoxContainer and its children
	var vbox = null
	if content_panel:
		vbox = content_panel.get_node_or_null("VBoxContainer")
	
	print("After debug - vbox=", vbox)
	
	if not content_panel or not vbox:
		push_error("LoginScreen: Critical UI nodes not found! content_panel=", content_panel, " vbox=", vbox)
		return
	
	# Now get the children from VBoxContainer
	loading_label = vbox.get_node_or_null("LoadingLabel")
	status_label = vbox.get_node_or_null("StatusLabel")
	progress_bar = vbox.get_node_or_null("ProgressBar")
	retry_button = vbox.get_node_or_null("RetryButton")
	test_connection_button = vbox.get_node_or_null("TestConnectionButton")
	
	print("After debug - loading_label=", loading_label, " status_label=", status_label, " progress_bar=", progress_bar)
	
	if not loading_label or not status_label or not progress_bar:
		push_error("LoginScreen: Child nodes not found! loading_label=", loading_label, " status_label=", status_label, " progress_bar=", progress_bar)
		return

	# Skip theme to avoid stylebox errors - apply basic colors manually
	# theme = GILDED_THEME
	_apply_typography()
	_apply_basic_colors()

	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)

	# Connect NetworkManager signals
	var _err1 = NetworkManager.session_created.connect(_on_session_created)
	var _err2 = NetworkManager.connection_status_changed.connect(_on_connection_status_changed)

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

	# Trigger authentication - NetworkManager waits for explicit call now
	NetworkManager.authenticate_device()

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
		if not is_connecting and not NetworkManager.is_server_connected:
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
	
	# Disconnect theme manager
	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)

# --- Basic Colors ---
func _apply_basic_colors() -> void:
	# Set background gradient to a visible color (blue gradient)
	if background_gradient:
		background_gradient.modulate = Color(0.0, 0.376, 0.808, 1.0)  # Royal Blue

	# Set content panel to light parchment color
	if content_panel:
		content_panel.modulate = Color(0.965, 0.953, 0.922, 1.0)  # Light cream

	# Set text colors
	if loading_label:
		loading_label.modulate = Color(0.22, 0.22, 0.2, 1)  # Dark text
	if status_label:
		status_label.modulate = Color(0.42, 0.4, 0.36, 1)  # Medium gray text
	if progress_bar:
		progress_bar.modulate = Color(0.0, 0.376, 0.808, 1)  # Blue

	# Hero elements
	if hero_glow:
		hero_glow.modulate = Color(1, 0.95, 0.8, 0.4)  # Soft gold glow
	if hero_backdrop:
		hero_backdrop.modulate = Color(0.9, 0.85, 0.7, 0.3)  # Soft backdrop

# --- Theme Support ---
func _apply_theme() -> void:
	if not theme_manager:
		return

	# Get colors with safe defaults
	var colors: Dictionary = theme_manager.get_theme_colors()
	if colors.is_empty():
		print("ThemeManager colors empty, using defaults")
		return

	# Use safe Color defaults for each property
	var bg_color := Color(0.992, 1.0, 0.855, 1)  # Default parchment
	var surf_color := Color(0.965, 0.953, 0.922, 1)
	var text_color := Color(0.22, 0.22, 0.2, 1)

	if colors.has("background"):
		var c = colors["background"]
		if c is Color:
			bg_color = c
	if colors.has("surface_container"):
		var c = colors["surface_container"]
		if c is Color:
			surf_color = c

	# BUG FIX: Don't set modulate on root node - this washes out all colors
	# modulate = bg_color  # Removed - was causing grayscale effect
	if content_panel:
		content_panel.modulate = surf_color

	if loading_label:
		loading_label.modulate = text_color
	if status_label:
		status_label.modulate = Color(0.5, 0.5, 0.5)

	# Skip gradient updates to avoid errors - use solid colors instead
	_update_background_solid(bg_color)
	_update_hero_solid()

func _update_background_solid(color: Color) -> void:
	if background_gradient:
		background_gradient.modulate = color.lightened(0.1)

func _update_hero_solid() -> void:
	if hero_glow:
		hero_glow.modulate = Color(1, 0.95, 0.8, 0.3)  # Soft gold glow
	if hero_backdrop:
		hero_backdrop.modulate = Color(0.9, 0.85, 0.7, 0.5)

func _apply_gradient_to_rect(rect: TextureRect, start_color: Color, mid_color: Color, end_color: Color, width: int) -> void:
	if not rect:
		return
	var gradient = Gradient.new()
	gradient.colors = PackedColorArray([start_color, mid_color, end_color])
	gradient.offsets = PackedFloat32Array([0.0, 0.5, 1.0])

	var gradient_texture = GradientTexture2D.new()
	gradient_texture.gradient = gradient
	gradient_texture.width = width

	rect.texture = gradient_texture

func _apply_typography() -> void:
	if loading_label:
		loading_label.label_settings = DISPLAY_LABEL_SETTINGS
	if status_label:
		status_label.label_settings = BODY_LABEL_SETTINGS

	for button in [retry_button, test_connection_button]:
		if button:
			button.add_theme_font_override("font", BUTTON_FONT)

func _on_theme_changed(_is_dark: bool) -> void:
	_apply_theme()
