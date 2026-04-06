extends Node

# =============================================================================
# THEME MANAGER - Armored Archer
# =============================================================================
# Manages Tactile Heroism design system state.
# Uses ArcherDesignTokens for colors, this manager for theme state.
#
# Design System: Tactile Heroism (The Illuminated Legend)
# Single tactile theme based on "Digital Pop-Up Book" metaphor.
# =============================================================================

signal theme_changed(enabled: bool)

# --- Theme State ---
var _theme_enabled: bool = true  # Single toggle for accessibility

# --- Persistence ---
const THEME_CONFIG_PATH := "user://theme.cfg"
const THEME_KEY := "theme_enabled"

# =============================================================================
# LIFECYCLE
# =============================================================================

func _ready() -> void:
	_load_theme()

# =============================================================================
# PERSISTENCE
# =============================================================================

func _load_theme() -> void:
	var config = ConfigFile.new()
	var err = config.load(THEME_CONFIG_PATH)
	if err == OK:
		var saved_theme = config.get_value("settings", THEME_KEY, true)
		_theme_enabled = saved_theme
	else:
		# Default to theme enabled
		_theme_enabled = true

func _save_theme() -> void:
	var config = ConfigFile.new()
	config.set_value("settings", THEME_KEY, _theme_enabled)
	var err = config.save(THEME_CONFIG_PATH)
	if err != OK:
		push_warning("ThemeManager: Failed to save theme preference")

# =============================================================================
# PUBLIC API
# =============================================================================

## Check if tactile theme is enabled
func is_theme_enabled() -> bool:
	return _theme_enabled

## Enable or disable tactile theme (for accessibility)
func set_tactile_theme(enabled: bool) -> void:
	_theme_enabled = enabled
	_save_theme()
	theme_changed.emit(enabled)

## Toggle tactile theme state
func toggle_theme() -> void:
	set_tactile_theme(not _theme_enabled)

# =============================================================================
# THEME COLORS (Tactile Heroism)
# =============================================================================

## Returns Tactile Heroism color palette
func get_theme_colors() -> Dictionary:
	# Return Tactile Heroism colors (Royal Blue, Light mode)
	return {
		"surface": ArcherDesignTokens.COLOR_SURFACE,
		"surface_container": ArcherDesignTokens.COLOR_SURFACE_CONTAINER,
		"surface_low": ArcherDesignTokens.COLOR_SURFACE_CONTAINER_LOW,
		"surface_lowest": ArcherDesignTokens.COLOR_SURFACE_CONTAINER_LOWEST,
		"surface_high": ArcherDesignTokens.COLOR_SURFACE_CONTAINER_HIGH,
		"surface_variant": ArcherDesignTokens.COLOR_SURFACE_VARIANT,
		"surface_dim": ArcherDesignTokens.COLOR_SURFACE_DIM,
		"surface_bright": ArcherDesignTokens.COLOR_SURFACE_BRIGHT,
		"on_surface": ArcherDesignTokens.COLOR_ON_SURFACE,
		"primary": ArcherDesignTokens.COLOR_PRIMARY,
		"primary_container": ArcherDesignTokens.COLOR_PRIMARY_CONTAINER,
		"primary_dim": ArcherDesignTokens.COLOR_PRIMARY_DIM,
		"primary_fixed": ArcherDesignTokens.COLOR_PRIMARY_FIXED,
		"primary_fixed_dim": ArcherDesignTokens.COLOR_PRIMARY_FIXED_DIM,
		"on_primary": ArcherDesignTokens.COLOR_ON_PRIMARY,
		"on_primary_container": ArcherDesignTokens.COLOR_ON_PRIMARY_CONTAINER,
		"secondary": ArcherDesignTokens.COLOR_SECONDARY,
		"secondary_container": ArcherDesignTokens.COLOR_SECONDARY_CONTAINER,
		"secondary_dim": ArcherDesignTokens.COLOR_SECONDARY_DIM,
		"secondary_fixed": ArcherDesignTokens.COLOR_SECONDARY_FIXED,
		"secondary_fixed_dim": ArcherDesignTokens.COLOR_SECONDARY_FIXED_DIM,
		"on_secondary": ArcherDesignTokens.COLOR_ON_SECONDARY,
		"on_secondary_container": ArcherDesignTokens.COLOR_ON_SECONDARY_CONTAINER,
		"tertiary": ArcherDesignTokens.COLOR_TERTIARY,
		"tertiary_container": ArcherDesignTokens.COLOR_TERTIARY_CONTAINER,
		"tertiary_dim": ArcherDesignTokens.COLOR_TERTIARY_DIM,
		"tertiary_fixed": ArcherDesignTokens.COLOR_TERTIARY_FIXED,
		"tertiary_fixed_dim": ArcherDesignTokens.COLOR_TERTIARY_FIXED_DIM,
		"on_tertiary": ArcherDesignTokens.COLOR_ON_TERTIARY,
		"on_tertiary_container": ArcherDesignTokens.COLOR_ON_TERTIARY_CONTAINER,
		"ambient_shadow": ArcherDesignTokens.COLOR_AMBIENT_SHADOW,
	}

## Get a specific surface color by tier
## Use instead of borders for "No-Line Rule"
func get_surface_color(tier: String = "base") -> Color:
	return ArcherDesignTokens.get_surface_tier_color(tier)

## Get gradient colors for buttons and CTAs
func get_gradient_colors(type: String = "primary") -> Array[Color]:
	return ArcherDesignTokens.get_gradient_colors(type)

## Get primary color (Royal Blue - Tactile Heroism)
func get_primary_color() -> Color:
	return ArcherDesignTokens.COLOR_PRIMARY

## Get secondary color (Gold - use sparingly for "Legendary" or "Epic" highlights only)
func get_secondary_color() -> Color:
	return ArcherDesignTokens.COLOR_SECONDARY

## Get on-surface color (primary text)
func get_text_color() -> Color:
	return ArcherDesignTokens.COLOR_ON_SURFACE

## Get ambient shadow color
func get_ambient_shadow_color() -> Color:
	return ArcherDesignTokens.COLOR_AMBIENT_SHADOW

## Get ghost border color
func get_ghost_border_color() -> Color:
	return ArcherDesignTokens.COLOR_GHOST_BORDER

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

## Apply tactile theme background to a Control node
## Uses surface color as base canvas (parchment map)
func apply_background(control: Control) -> void:
	if not control:
		return
	# Check if a background panel already exists
	var bg: ColorRect = control.get_node_or_null("_theme_background") as ColorRect
	if not bg:
		bg = ColorRect.new()
		bg.name = "_theme_background"
		bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
		control.add_child(bg)
		control.move_child(bg, 0)  # Behind everything
	bg.color = ArcherDesignTokens.COLOR_SURFACE
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)

## Apply surface tier background to a Control node
## Use for depth hierarchy instead of borders
func apply_surface_background(control: Control, tier: String = "base") -> void:
	if not control:
		return
	var bg: ColorRect = control.get_node_or_null("_surface_background") as ColorRect
	if not bg:
		bg = ColorRect.new()
		bg.name = "_surface_background"
		bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
		control.add_child(bg)
		control.move_child(bg, 0)
	bg.color = get_surface_color(tier)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)

## Apply ambient shadow to a Panel
## Use for floating elements like tooltips, modals
func apply_ambient_shadow(panel: Panel, is_floating: bool = false) -> void:
	if not panel:
		return
	var style := panel.get_theme_stylebox("panel") as StyleBoxFlat
	if style:
		style.shadow_color = get_ambient_shadow_color()
		style.shadow_size = ArcherDesignTokens.get_ambient_shadow_blur(is_floating)
		style.shadow_offset = ArcherDesignTokens.AMBIENT_SHADOW_OFFSET
		panel.add_theme_stylebox_override("panel", style)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

## Check if a color is light (for text contrast)
func is_color_light(color: Color) -> bool:
	# Calculate luminance using relative luminance formula
	return (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) > 0.5

## Get appropriate text color for a background
static func get_text_color_for_background(bg_color: Color, light_color: Color = ArcherDesignTokens.COLOR_ON_SURFACE, dark_color: Color = Color.WHITE) -> Color:
	if is_color_light(bg_color):
		return ArcherDesignTokens.COLOR_ON_SURFACE
	else:
		return dark_color
