class_name ArcherAccessibilityManager
extends Node

# =============================================================================
# ACCESSIBILITY MANAGER - Armored Archer
# =============================================================================
# Manages accessibility settings including font scaling and high contrast mode.
# Ensures WCAG AA compliance and provides accessible UI experience.
# =============================================================================

signal settings_changed()

# --- Dependency Injection ---
var _config_file: ConfigFile = null

# --- Accessibility State ---
var _font_scale: float = 1.0
var _high_contrast: bool = false
var _reduced_motion: bool = false
var _screen_reader_enabled: bool = false

# --- Constants ---
const FONT_SCALE_MIN := 0.8
const FONT_SCALE_MAX := 1.5
const FONT_SCALE_DEFAULT := 1.0

# --- Persistence ---
const ACCESSIBILITY_CONFIG_PATH := "user://accessibility.cfg"

# --- Constructor with Dependency Injection ---
func _init(config_file: ConfigFile = null):
	_config_file = config_file

# --- High Contrast Colors ---
var _high_contrast_colors: Dictionary = {
	"dark": {
		"background": Color("#000000"),
		"surface": Color("#1A1A1A"),
		"text_primary": Color("#FFFFFF"),
		"text_secondary": Color("#CCCCCC"),
		"border": Color("#FFFFFF"),
		"primary": Color("#00FFFF"),
	},
	"light": {
		"background": Color("#FFFFFF"),
		"surface": Color("#F0F0F0"),
		"text_primary": Color("#000000"),
		"text_secondary": Color("#333333"),
		"border": Color("#000000"),
		"primary": Color("#0000FF"),
	}
}

# --- Lifecycle ---
func _ready() -> void:
	# Initialize ConfigFile if not injected (for production autoload usage)
	if _config_file == null:
		_config_file = ConfigFile.new()
	_load_settings()

# =============================================================================
# PUBLIC API
# =============================================================================

## Get current font scale
func get_font_scale() -> float:
	return _font_scale

## Set font scale (0.8 to 1.5)
func set_font_scale(scale: float) -> void:
	_font_scale = clampf(scale, FONT_SCALE_MIN, FONT_SCALE_MAX)
	_save_settings()
	settings_changed.emit()

## Get scaled font size
func get_scaled_font_size(base_size: int) -> int:
	return int(base_size * _font_scale)

## Check if high contrast mode is enabled
func is_high_contrast_enabled() -> bool:
	return _high_contrast

## Toggle high contrast mode
func set_high_contrast(enabled: bool) -> void:
	_high_contrast = enabled
	_save_settings()
	settings_changed.emit()

## Check if reduced motion is enabled
func is_reduced_motion_enabled() -> bool:
	return _reduced_motion

## Toggle reduced motion
func set_reduced_motion(enabled: bool) -> void:
	_reduced_motion = enabled
	_save_settings()
	settings_changed.emit()

## Check if screen reader is enabled
func is_screen_reader_enabled() -> bool:
	return _screen_reader_enabled

## Toggle screen reader support
func set_screen_reader_enabled(enabled: bool) -> void:
	_screen_reader_enabled = enabled
	_save_settings()
	settings_changed.emit()

## Get accessibility color for current theme
func get_accessibility_color(color_key: String, is_dark: bool = true) -> Color:
	if not _high_contrast:
		return Color.MAGENTA  # Fallback to normal theme
	
	var theme_key = "dark" if is_dark else "light"
	var colors = _high_contrast_colors.get(theme_key, _high_contrast_colors["dark"])
	
	if colors.has(color_key):
		return colors[color_key]
	
	return Color.MAGENTA

## Get all accessibility settings as dictionary
func get_settings() -> Dictionary:
	return {
		"font_scale": _font_scale,
		"high_contrast": _high_contrast,
		"reduced_motion": _reduced_motion,
		"screen_reader": _screen_reader_enabled,
	}

## Apply settings from dictionary
func apply_settings(settings: Dictionary) -> void:
	if settings.has("font_scale"):
		set_font_scale(settings["font_scale"])
	if settings.has("high_contrast"):
		set_high_contrast(settings["high_contrast"])
	if settings.has("reduced_motion"):
		set_reduced_motion(settings["reduced_motion"])
	if settings.has("screen_reader"):
		set_screen_reader_enabled(settings["screen_reader"])

# =============================================================================
# PERSISTENCE
# =============================================================================

func _load_settings() -> void:
	var err = _config_file.load(ACCESSIBILITY_CONFIG_PATH)

	if err == OK:
		_font_scale = _config_file.get_value("accessibility", "font_scale", FONT_SCALE_DEFAULT)
		_high_contrast = _config_file.get_value("accessibility", "high_contrast", false)
		_reduced_motion = _config_file.get_value("accessibility", "reduced_motion", false)
		_screen_reader_enabled = _config_file.get_value("accessibility", "screen_reader", false)
	else:
		# Use defaults
		_font_scale = FONT_SCALE_DEFAULT
		_high_contrast = false
		_reduced_motion = false
		_screen_reader_enabled = false

func _save_settings() -> void:
	_config_file.set_value("accessibility", "font_scale", _font_scale)
	_config_file.set_value("accessibility", "high_contrast", _high_contrast)
	_config_file.set_value("accessibility", "reduced_motion", _reduced_motion)
	_config_file.set_value("accessibility", "screen_reader", _screen_reader_enabled)

	var err = _config_file.save(ACCESSIBILITY_CONFIG_PATH)
	if err != OK:
		push_warning("AccessibilityManager: Failed to save settings")

# =============================================================================
# ACCESSIBILITY HELPERS
# =============================================================================

## Check if a color combination meets WCAG AA contrast ratio
static func meets_wcag_aa(foreground: Color, background: Color, font_size: int = 14) -> bool:
	var contrast = _get_contrast_ratio(foreground, background)
	
	if font_size >= 18:
		return contrast >= 3.0  # Large text
	return contrast >= 4.5  # Normal text

## Check if a color combination meets WCAG AAA contrast ratio
static func meets_wcag_aaa(foreground: Color, background: Color, font_size: int = 14) -> bool:
	var contrast = _get_contrast_ratio(foreground, background)
	
	if font_size >= 18:
		return contrast >= 4.5  # Large text
	return contrast >= 7.0  # Normal text

## Calculate contrast ratio between two colors
static func _get_contrast_ratio(color1: Color, color2: Color) -> float:
	var l1 = _get_relative_luminance(color1)
	var l2 = _get_relative_luminance(color2)
	
	var lighter = max(l1, l2)
	var darker = min(l1, l2)
	
	return (lighter + 0.05) / (darker + 0.05)

## Calculate relative luminance of a color
static func _get_relative_luminance(color: Color) -> float:
	var r = _linearize(color.r)
	var g = _linearize(color.g)
	var b = _linearize(color.b)
	
	return 0.2126 * r + 0.7152 * g + 0.0722 * b

## Convert sRGB to linear RGB
static func _linearize(value: float) -> float:
	if value <= 0.03928:
		return value / 12.92
	return pow((value + 0.055) / 1.055, 2.4)

## Add accessibility label to a node
static func set_accessibility_label(node: Control, label: String) -> void:
	node.accessibility_label = label

## Add accessibility description to a node
static func set_accessibility_description(node: Control, description: String) -> void:
	node.accessibility_description = description
