class_name ThemeToggle
extends Control

# =============================================================================
# THEME TOGGLE - Armored Archer
# =============================================================================
# In-game theme toggle component for switching between light/dark themes.
# =============================================================================

signal theme_toggled(is_dark: bool)

@export var button_style: String = "icon_text"  # "icon_only", "text_only", "icon_text"

# --- References ---
var _theme_manager: Node
var _toggle_button: Button

# --- State ---
var _is_dark: bool = true

# =============================================================================
# LIFECYCLE
# =============================================================================

func _ready() -> void:
	# Get ThemeManager reference
	_theme_manager = get_node_or_null("/root/ThemeManager")
	
	# Create toggle button
	_create_toggle_button()
	
	# Connect to theme manager if available
	if _theme_manager:
		_theme_manager.theme_changed.connect(_on_theme_changed)
		_is_dark = _theme_manager.is_dark_theme()
	else:
		# Default to dark
		_is_dark = true
	
	_update_button_display()

# =============================================================================
# PRIVATE METHODS
# =============================================================================

func _create_toggle_button() -> void:
	_toggle_button = Button.new()
	_toggle_button.pressed.connect(_on_toggle_pressed)
	add_child(_toggle_button)
	
	# Set size
	_toggle_button.custom_minimum_size = Vector2(100, 40)

func _update_button_display() -> void:
	if not _toggle_button:
		return
	
	match button_style:
		"icon_only":
			var icon = "🌙" if _is_dark else "☀️"
			_toggle_button.text = icon
		"text_only":
			_toggle_button.text = "Dark" if _is_dark else "Light"
		"icon_text":
			var icon = "🌙 " if _is_dark else "☀️ "
			_toggle_button.text = icon + ("Dark" if _is_dark else "Light")
	
	# Apply design tokens if available
	if DesignTokens:
		if _is_dark:
			_toggle_button.modulate = DesignTokens.COLOR_TEXT_SECONDARY_DARK
		else:
			_toggle_button.modulate = DesignTokens.COLOR_TEXT_SECONDARY_LIGHT

func _on_toggle_pressed() -> void:
	if not _theme_manager:
		# Toggle local state if no theme manager
		_is_dark = not _is_dark
		theme_toggled.emit(_is_dark)
		_update_button_display()
		return
	
	# Toggle using theme manager
	_theme_manager.toggle_theme()

func _on_theme_changed(is_dark: bool) -> void:
	_is_dark = is_dark
	_update_button_display()
	theme_toggled.emit(is_dark)

# =============================================================================
# PUBLIC API
# =============================================================================

## Get current theme state
func is_dark_theme() -> bool:
	return _is_dark

## Set theme directly
func set_theme(is_dark: bool) -> void:
	_is_dark = is_dark
	if _theme_manager:
		_theme_manager.set_theme("dark" if is_dark else "light")
	_update_button_display()

## Toggle theme
func toggle() -> void:
	_on_toggle_pressed()

# =============================================================================
# CLEANUP
# =============================================================================

func _exit_tree() -> void:
	if _theme_manager and _theme_manager.theme_changed.is_connected(_on_theme_changed):
		_theme_manager.theme_changed.disconnect(_on_theme_changed)
