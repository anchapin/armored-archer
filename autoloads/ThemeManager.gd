class_name ArcherThemeManager
extends Node

# =============================================================================
# THEME MANAGER - Armored Archer
# =============================================================================
# Manages light/dark theme switching with persistence.
# Use DesignTokens for colors, this manager for theme state.
# =============================================================================

signal theme_changed(is_dark: bool)

# --- Dependency Injection ---
var _config_file: ConfigFile = null

# --- Theme State ---
var _current_theme: StringName = &"dark"
var _is_dark: bool = true

# --- Persistence ---
const THEME_CONFIG_PATH := "user://theme.cfg"
const THEME_KEY := "theme"

# --- Constructor with Dependency Injection ---
func _init(config_file: ConfigFile = null):
	_config_file = config_file

# --- Theme Data ---
var _themes: Dictionary = {
	"dark": {
		"name": "Dark",
		"background": Color("#0F0F1A"),
		"surface": Color("#1A1A2E"),
		"surface_variant": Color("#252540"),
		"border": Color("#2D2D4A"),
		"text_primary": Color("#F8FAFC"),
		"text_secondary": Color("#94A3B8"),
		"text_disabled": Color("#64748B"),
	},
	"light": {
		"name": "Light",
		"background": Color("#F8FAFC"),
		"surface": Color("#FFFFFF"),
		"surface_variant": Color("#F1F5F9"),
		"border": Color("#E2E8F0"),
		"text_primary": Color("#0F172A"),
		"text_secondary": Color("#475569"),
		"text_disabled": Color("#94A3B8"),
	}
}

# --- Lifecycle ---
func _ready() -> void:
	# Initialize ConfigFile if not injected (for production autoload usage)
	if _config_file == null:
		_config_file = ConfigFile.new()
	_load_theme()

# =============================================================================
# PUBLIC API
# =============================================================================

## Get current theme name
func get_theme_name() -> StringName:
	return _current_theme

## Check if dark theme is active
func is_dark_theme() -> bool:
	return _is_dark

## Check if light theme is active
func is_light_theme() -> bool:
	return not _is_dark

## Toggle between dark and light themes
func toggle_theme() -> void:
	set_theme("dark" if not _is_dark else "light")

## Set theme by name
func set_theme(theme_name: String) -> void:
	if theme_name != "dark" and theme_name != "light":
		push_warning("ThemeManager: Unknown theme '%s', defaulting to dark" % theme_name)
		theme_name = "dark"
	
	_current_theme = StringName(theme_name)
	_is_dark = (theme_name == "dark")
	_save_theme()
	theme_changed.emit(_is_dark)

## Get current theme colors
func get_theme_colors() -> Dictionary:
	return _themes.get(_current_theme, _themes["dark"])

## Get a specific color from current theme
func get_color(color_key: String) -> Color:
	var colors = get_theme_colors()
	if colors.has(color_key):
		return colors[color_key]
	push_warning("ThemeManager: Unknown color key '%s'" % color_key)
	return Color.MAGENTA

## Get background color
func get_background_color() -> Color:
	return get_color("background")

## Get surface color
func get_surface_color() -> Color:
	return get_color("surface")

## Get surface variant color
func get_surface_variant_color() -> Color:
	return get_color("surface_variant")

## Get border color
func get_border_color() -> Color:
	return get_color("border")

## Get primary text color
func get_text_primary_color() -> Color:
	return get_color("text_primary")

## Get secondary text color
func get_text_secondary_color() -> Color:
	return get_color("text_secondary")

## Get disabled text color
func get_text_disabled_color() -> Color:
	return get_color("text_disabled")

# =============================================================================
# PERSISTENCE
# =============================================================================

func _load_theme() -> void:
	var err = _config_file.load(THEME_CONFIG_PATH)

	if err == OK:
		var saved_theme = _config_file.get_value("settings", THEME_KEY, "dark")
		set_theme(saved_theme)
	else:
		# Default to dark theme
		set_theme("dark")

func _save_theme() -> void:
	_config_file.set_value("settings", THEME_KEY, _current_theme)

	var err = _config_file.save(THEME_CONFIG_PATH)
	if err != OK:
		push_warning("ThemeManager: Failed to save theme preference")

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

## Apply theme to a Control node and its children
func apply_theme_to_control(control: Control) -> void:
	if not control:
		return
	
	var colors = get_theme_colors()
	
	# Apply background color
	if control is Panel or control is PanelContainer:
		control.modulate = colors["surface"]
	elif control is Control:
		control.modulate = colors["background"]
	
	# Recursively apply to children
	for child in control.get_children():
		if child is Control:
			apply_theme_to_control(child)
