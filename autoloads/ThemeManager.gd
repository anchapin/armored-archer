class_name ArcherThemeManager
extends Node

# =============================================================================
# THEME MANAGER - Armored Archer
# =============================================================================
# Manages light/dark theme switching with persistence.
# Use DesignTokens for colors, this manager for theme state.
# =============================================================================

signal theme_changed(is_dark: bool)
signal font_changed(font: Font)

# --- Dependency Injection ---
var _config_file: ConfigFile = null

# --- Theme State ---
var _current_theme: StringName = &"gilded_dark"
var _is_dark: bool = false
var _default_font_path: String = "res://fonts/Plus_Jakarta_Sans.ttf"
var _current_font_path: String = "res://fonts/Plus_Jakarta_Sans.ttf"
var _cached_font: Font = null

# --- Persistence ---
const THEME_CONFIG_PATH := "user://theme.cfg"
const THEME_KEY := "theme"
const FONT_KEY := "font"

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
	"gilded": {
		"name": "Gilded Quest",
		"background": Color("#0e0e0e"),
		"surface": Color("#0e0e0e"),
		"surface_variant": Color("#262626"),
		"surface_container": Color("#191a1a"),
		"surface_container_low": Color("#131313"),
		"surface_container_lowest": Color("#000000"),
		"surface_container_high": Color("#1f2020"),
		"surface_bright": Color("#2c2c2c"),
		"surface_dim": Color("#0e0e0e"),
		"surface_tint": Color("#ffac54"),
		"border": Color("#484848"),
		"outline_variant": Color("#484848"),
		"text_primary": Color("#ffffff"),
		"text_secondary": Color("#adaaaa"),
		"text_disabled": Color("#767575"),
		"on_surface": Color("#ffffff"),
		"primary": Color("#ffac54"),
		"primary_container": Color("#ff9800"),
		"primary_dim": Color("#ec8c00"),
		"primary_fixed": Color("#ff9800"),
		"primary_tint": Color("#ffac54"),
		"secondary": Color("#efe0d1"),
		"tertiary": Color("#7ef839"),
		"gradient_primary_start": Color("#ffac54"),
		"gradient_primary_end": Color("#ec8c00"),
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
	_load_font()

# --- Private Methods ---
func _load_font() -> void:
	if _current_font_path.is_empty():
		return
	var font_res = load(_current_font_path)
	if font_res != null and font_res is Font:
		_cached_font = font_res
		font_changed.emit(_cached_font)

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
	if not _themes.has(theme_name):
		push_warning("ThemeManager: Unknown theme '%s', defaulting to gilded quest" % theme_name)
		theme_name = "gilded"
	
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
		var saved_theme = _config_file.get_value("settings", THEME_KEY, "gilded")
		set_theme(saved_theme)
	else:
		# Default to gilded quest palette
		set_theme("gilded")

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
