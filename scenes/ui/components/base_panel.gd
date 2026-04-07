class_name BasePanel
extends PanelContainer

# =============================================================================
# BASE PANEL - Armored Archer
# =============================================================================
# Reusable panel component with consistent styling.
# Use as container for grouped UI elements.
# =============================================================================

@export var panel_type: String = "default"  # default, card, modal, popup
@export var show_shadow: bool = false
@export var corner_radius: int = ArcherDesignTokens.RADIUS_MD

var _is_dark_theme: bool = true

# --- Lifecycle ---
func _ready() -> void:
	_setup_panel()

func _setup_panel() -> void:
	_apply_panel_style()

# --- Style Updates ---
func _apply_panel_style() -> void:
	var bg_color: Color
	var border_color: Color
	var shadow_color: Color
	
	if _is_dark_theme:
		bg_color = ArcherDesignTokens.COLOR_SURFACE_DARK
		border_color = ArcherDesignTokens.COLOR_BORDER_DARK
		shadow_color = Color.BLACK
	else:
		bg_color = ArcherDesignTokens.COLOR_SURFACE_LIGHT
		border_color = ArcherDesignTokens.COLOR_BORDER_LIGHT
		shadow_color = Color.BLACK
	
	match panel_type:
		"card":
			bg_color = bg_color.lightened(0.05) if not _is_dark_theme else bg_color.darkened(0.05)
		"modal":
			bg_color = bg_color.lightened(0.1) if not _is_dark_theme else bg_color.darkened(0.1)
		"popup":
			bg_color = bg_color.lightened(0.15) if not _is_dark_theme else bg_color.darkened(0.15)
	
	var style := StyleBoxFlat.new()
	style.bg_color = bg_color
	style.corner_radius_top_left = corner_radius
	style.corner_radius_top_right = corner_radius
	style.corner_radius_bottom_left = corner_radius
	style.corner_radius_bottom_right = corner_radius
	
	# Border
	style.border_width_left = ArcherDesignTokens.BORDER_WIDTH_SM
	style.border_width_top = ArcherDesignTokens.BORDER_WIDTH_SM
	style.border_width_right = ArcherDesignTokens.BORDER_WIDTH_SM
	style.border_width_bottom = ArcherDesignTokens.BORDER_WIDTH_SM
	style.border_color = border_color
	
	# Shadow
	if show_shadow:
		style.shadow_color = shadow_color
		style.shadow_size = ArcherDesignTokens.SHADOW_BLUR_MD
		style.shadow_offset = ArcherDesignTokens.SHADOW_OFFSET_MD
	
	add_theme_stylebox_override("panel", style)

# --- Public Methods ---
func set_panel_type(new_type: String) -> void:
	panel_type = new_type
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

func get_is_dark_theme() -> bool:
	return _is_dark_theme
