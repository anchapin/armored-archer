class_name AmbientGlowPanel
extends PanelContainer

# =============================================================================
# AMBIENT GLOW PANEL - Armored Archer (Relic Archive)
# =============================================================================
# Panel with soft, tinted ambient shadow effect.
# Use for floating elements like:
# - Active equipment slots
# - Dragged items
# - Floating tooltips
# - Loot drops
#
# Ambient Glow Settings:
# - Blur: 24px (large, soft)
# - Opacity: 12% (subtle tint)
# - Color: Tertiary (green) or other tint colors
# - No-Line Rule: No solid borders, use color shifts
# =============================================================================

@export var glow_color: String = "tertiary"  # tertiary, primary, error
@export var glow_opacity: float = 0.12  # 12% opacity
@export var glow_blur: int = 24  # 24px blur
@export var corner_radius: int = ArcherDesignTokens.RA_ROUNDNESS_FOUR
@export var show_glow: bool = true

var _is_dark_theme: bool = true

# --- Lifecycle ---
func _ready() -> void:
	_setup_panel()

func _setup_panel() -> void:
	_apply_ambient_glow()

# --- Ambient Glow Application ---
func _apply_ambient_glow() -> void:
	var bg_color: Color
	var tint_color: Color

	# Get Relic Archive surface tier for background
	if _is_dark_theme:
		bg_color = ArcherDesignTokens.get_ra_surface_tier_color("container")
		tint_color = _get_glow_color()
	else:
		bg_color = ArcherDesignTokens.COLOR_SURFACE_CONTAINER
		tint_color = ArcherDesignTokens.COLOR_TERTIARY

	var style := StyleBoxFlat.new()
	style.bg_color = bg_color

	# No-Line Rule: Use corner radius, remove borders
	style.corner_radius_top_left = corner_radius
	style.corner_radius_top_right = corner_radius
	style.corner_radius_bottom_left = corner_radius
	style.corner_radius_bottom_right = corner_radius
	style.border_width_left = 0
	style.border_width_top = 0
	style.border_width_right = 0
	style.border_width_bottom = 0

	# Apply ambient glow
	if show_glow:
		var ambient_color = Color(tint_color.r, tint_color.g, tint_color.b, glow_opacity)
		style.shadow_color = ambient_color
		style.shadow_size = glow_blur
		style.shadow_offset = ArcherDesignTokens.AMBIENT_SHADOW_OFFSET

	add_theme_stylebox_override("panel", style)

func _get_glow_color() -> Color:
	# Get glow color based on setting
	if _is_dark_theme:
		match glow_color:
			"primary":
				return ArcherDesignTokens.RA_PRIMARY
			"tertiary":
				return ArcherDesignTokens.RA_TERTIARY
			"error":
				return ArcherDesignTokens.RA_ERROR
			_:
				return ArcherDesignTokens.RA_AMBIENT_SHADOW_COLOR
	else:
		match glow_color:
			"primary":
				return ArcherDesignTokens.COLOR_PRIMARY
			"tertiary":
				return ArcherDesignTokens.COLOR_TERTIARY
			"error":
				return ArcherDesignTokens.COLOR_ERROR
			_:
				return ArcherDesignTokens.COLOR_TERTIARY

# --- Public Methods ---
func set_glow_color(color_name: String) -> void:
	glow_color = color_name
	_apply_ambient_glow()

func set_glow_opacity(opacity: float) -> void:
	glow_opacity = clampf(opacity, 0.0, 1.0)
	_apply_ambient_glow()

func set_glow_blur(blur: int) -> void:
	glow_blur = blur
	_apply_ambient_glow()

func set_corner_radius(radius: int) -> void:
	corner_radius = radius
	_apply_ambient_glow()

func set_show_glow(show: bool) -> void:
	show_glow = show
	_apply_ambient_glow()

func set_dark_theme(is_dark: bool) -> void:
	_is_dark_theme = is_dark
	_apply_ambient_glow()

func get_is_dark_theme() -> bool:
	return _is_dark_theme
