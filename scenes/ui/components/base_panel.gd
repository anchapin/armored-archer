class_name BasePanel
extends PanelContainer

# =============================================================================
# BASE PANEL - Armored Archer (Relic Archive Update)
# =============================================================================
# Reusable panel component with consistent styling.
# Now supports Relic Archive design system:
# - Surface hierarchy for depth (metallic plate stacking)
# - No-Line Rule (background shift architecture instead of borders)
# - Ambient glow effects (soft, tinted shadows)
# - Ghost borders (15% opacity for empty slots)
# =============================================================================

@export var panel_type: String = "default"  # default, card, modal, popup, surface
@export var surface_tier: String = "base"  # Relic Archive surface tier
@export var show_shadow: bool = false
@export var show_ambient_glow: bool = false
@export var corner_radius: int = ArcherDesignTokens.RADIUS_SM
@export var use_ghost_border: bool = false

var _is_dark_theme: bool = true

# --- Lifecycle ---
func _ready() -> void:
	_setup_panel()

func _setup_panel() -> void:
	_apply_panel_style()

# --- Style Updates ---
func _apply_panel_style() -> void:
	var bg_color: Color
	var shadow_color: Color
	var radius: int = corner_radius

	# Apply Relic Archive surface tier if dark mode
	if _is_dark_theme:
		bg_color = ArcherDesignTokens.get_ra_surface_tier_color(surface_tier)
		shadow_color = ArcherDesignTokens.get_ra_ambient_shadow_color()

		# Use Relic Archive roundness (RA_ROUNDNESS_FOUR for machined feel)
		if corner_radius == ArcherDesignTokens.RADIUS_SM:
			radius = ArcherDesignTokens.RA_ROUNDNESS_FOUR
	else:
		bg_color = ArcherDesignTokens.COLOR_SURFACE_CONTAINER
		shadow_color = ArcherDesignTokens.COLOR_AMBIENT_SHADOW

	# Adjust background color by panel type
	match panel_type:
		"card":
			bg_color = bg_color.lightened(0.05) if not _is_dark_theme else bg_color.darkened(0.05)
		"modal":
			bg_color = bg_color.lightened(0.1) if not _is_dark_theme else bg_color.darkened(0.1)
		"popup":
			bg_color = bg_color.lightened(0.15) if not _is_dark_theme else bg_color.darkened(0.15)
		"surface":
			# Surface tier already applied above
			pass

	var style := StyleBoxFlat.new()
	style.bg_color = bg_color

	# No-Line Rule: Use corner radius for depth, remove solid borders
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius

	# Ghost border (15% outline_variant for empty slots)
	if use_ghost_border:
		style.border_width_left = 1
		style.border_width_top = 1
		style.border_width_right = 1
		style.border_width_bottom = 1
		if _is_dark_theme:
			style.border_color = ArcherDesignTokens.get_ra_ghost_border_color()
		else:
			style.border_color = ArcherDesignTokens.get_ghost_border_color()
	else:
		# No-Line Rule: Remove all borders
		style.border_width_left = 0
		style.border_width_top = 0
		style.border_width_right = 0
		style.border_width_bottom = 0

	# Shadow or Ambient Glow
	if show_ambient_glow and _is_dark_theme:
		# Ambient glow (soft, tinted shadow)
		style.shadow_color = shadow_color
		style.shadow_size = ArcherDesignTokens.get_ra_ambient_shadow_blur()
		style.shadow_offset = ArcherDesignTokens.AMBIENT_SHADOW_OFFSET
	elif show_shadow:
		# Regular shadow
		style.shadow_color = shadow_color
		style.shadow_size = ArcherDesignTokens.SHADOW_BLUR_MD
		style.shadow_offset = ArcherDesignTokens.SHADOW_OFFSET_MD

	add_theme_stylebox_override("panel", style)

# --- Public Methods ---
func set_panel_type(new_type: String) -> void:
	panel_type = new_type
	_apply_panel_style()

func set_surface_tier(new_tier: String) -> void:
	surface_tier = new_tier
	_apply_panel_style()

func set_dark_theme(is_dark: bool) -> void:
	_is_dark_theme = is_dark
	_apply_panel_style()

func set_corner_radius(radius: int) -> void:
	corner_radius = radius
	_apply_panel_style()

func set_show_shadow(show: bool) -> void:
	show_shadow = show
	_apply_panel_style()

func set_show_ambient_glow(show: bool) -> void:
	show_ambient_glow = show
	_apply_panel_style()

func set_use_ghost_border(use: bool) -> void:
	use_ghost_border = use
	_apply_panel_style()

func get_is_dark_theme() -> bool:
	return _is_dark_theme
