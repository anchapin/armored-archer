extends Node

# =============================================================================
# DESIGN TOKENS - Armored Archer (Updated for Tactile Heroism)
# =============================================================================
# Centralized design constants for consistent UI across all screens.
# Now updated to match Tactile Heroism design system from Stitch.
#
# Design System: Tactile Heroism (The Illuminated Legend)
# Based on "Digital Pop-Up Book" metaphor with:
# - No-Line Rule: No 1px solid borders for layout
# - Glass & Gradient Rule: Main actions use subtle gradients
# - 3D Bubbly Buttons: Inner shadows create physical depth
# - Ambient Shadows: Soft, tinted shadows instead of harsh dark ones
# =============================================================================

# =============================================================================
# TACTILE HEROISM COLOR PALETTE (LIGHT MODE)
# =============================================================================

# --- Surface Hierarchy (The "No-Line" Rule) ---
## Use surface colors for depth instead of borders
const COLOR_SURFACE := Color("#fdffda")  # Primary canvas (parchment map)
const COLOR_SURFACE_CONTAINER := Color("#f6f3eb")  # Interaction area
const COLOR_SURFACE_CONTAINER_LOW := Color("#fcf9f1")  # Lifted card/item
const COLOR_SURFACE_CONTAINER_LOWEST := Color("#ffffff")  # Active element
const COLOR_SURFACE_CONTAINER_HIGH := Color("#f0eee5")  # Nested look
const COLOR_SURFACE_CONTAINER_HIGHEST := Color("#ebe8df")  # Deepest nest
const COLOR_SURFACE_VARIANT := Color("#ebe8df")
const COLOR_SURFACE_BRIGHT := Color("#fdffda")
const COLOR_SURFACE_DIM := Color("#e5e2d9")

# --- Content Colors ---
const COLOR_ON_SURFACE := Color("#383833")  # Primary text
const COLOR_OUTLINE_VARIANT := Color("#bbb9b3")  # For ghost borders

# --- Ambient & Glass Effects ---
const COLOR_AMBIENT_SHADOW := Color(0.22, 0.22, 0.2, 0.06)  # Tinted ambient shadow (6% on_surface)
const COLOR_GHOST_BORDER := Color(0.733, 0.725, 0.702, 0.15)  # Ghost border (15% outline_variant)
const COLOR_GLASS_OVERLAY := Color(1, 1, 1, 0.8)  # Glass effect with 80% opacity

# --- Primary (Royal Blue) ---
const COLOR_PRIMARY := Color("#0060ce")  # Main primary color
const COLOR_PRIMARY_CONTAINER := Color("#6e9fff")  # Light primary for containers
const COLOR_PRIMARY_DIM := Color("#0054b7")  # Darker primary for depth
const COLOR_PRIMARY_FIXED := Color("#6e9fff")  # Fixed primary (hover)
const COLOR_PRIMARY_FIXED_DIM := Color("#5391ff")  # Fixed dim primary
const COLOR_PRIMARY_TINT := Color("#0060ce")  # Tinted primary
const COLOR_ON_PRIMARY := Color("#ffffff")  # Text on primary
const COLOR_ON_PRIMARY_CONTAINER := Color("#002150")  # Text on primary container

# --- Secondary (Gold) - Use sparingly for "Legendary" or "Epic" highlights only ---
const COLOR_SECONDARY := Color("#8d5900")  # Main secondary (gold)
const COLOR_SECONDARY_CONTAINER := Color("#ffc885")  # Secondary container
const COLOR_SECONDARY_DIM := Color("#7d4e00")  # Dimmer secondary
const COLOR_SECONDARY_FIXED := Color("#ffc885")  # Fixed secondary
const COLOR_SECONDARY_FIXED_DIM := Color("#ffb554")  # Fixed dim secondary
const COLOR_ON_SECONDARY := Color("#ffffff")  # Text on secondary
const COLOR_ON_SECONDARY_CONTAINER := Color("#ddcebf")  # Text on secondary container

# --- Tertiary (Emerald) ---
const COLOR_TERTIARY := Color("#00734e")  # Main tertiary (emerald)
const COLOR_TERTIARY_CONTAINER := Color("#69f6b8")  # Tertiary container
const COLOR_TERTIARY_DIM := Color("#006544")  # Dim tertiary
const COLOR_TERTIARY_FIXED := Color("#69f6b8")  # Fixed tertiary
const COLOR_TERTIARY_FIXED_DIM := Color("#62db13")  # Fixed dim tertiary
const COLOR_ON_TERTIARY := Color("#ffffff")  # Text on tertiary
const COLOR_ON_TERTIARY_CONTAINER := Color("#1e5000")  # Text on tertiary container

# --- Gradients ---
const COLOR_GRADIENT_PRIMARY_START := Color("#0060ce")  # Primary gradient start
const COLOR_GRADIENT_PRIMARY_END := Color("#6e9fff")  # Primary gradient end

# --- Additional Surface Colors ---
const COLOR_SURFACE_TINT := Color("#0060ce")  # Surface tint
const COLOR_INVERSE_SURFACE := Color("#0e0e0b")  # Inverse surface
const COLOR_INVERSE_ON_SURFACE := Color("#9f9d97")  # Inverse on-surface
const COLOR_SURFACE_VARIANT := Color("#262626")  # Surface variant

# =============================================================================
# TYPOGRAPHY FONTS
# =============================================================================

## Plus Jakarta Sans - Display & Headlines (Hero Moments)
const FONT_PLUS_JAKARTA_SANS_PATH := "res://fonts/Plus_Jakarta_Sans.ttf"

## Be Vietnam Pro - Titles & Body (Heavy Lifting)
const FONT_BE_VIETNAM_PRO_PATH := "res://fonts/Be_Vietnam_Pro.ttf"

## Inter - Labels & UI elements
const FONT_INTER_PATH := "res://fonts/Inter.ttf"

# Note: Font files need to be added to project.godot as custom fonts

# =============================================================================
# BUTTON DEPTH STYLES (3D Bubbly)
# =============================================================================

## Inner shadow for button "thickness" effect
const BUTTON_INSET_SHADOW_COLOR := Color(0, 0, 0, 0.2)  # 20% opacity inset shadow
const BUTTON_INSET_SHADOW_OFFSET := Vector2(0, 4)  # Offset from bottom
const BUTTON_INSET_SHADOW_BLUR := 4  # Blur for soft edge

## Button corner radii
const BUTTON_RADIUS_MD := 24  # 1.5rem - Standard buttons
const BUTTON_RADIUS_LG := 32  # 2rem - Large buttons
const BUTTON_RADIUS_XL := 48  # 3rem - Extra large buttons (for hero buttons)

# =============================================================================
# SPACING
# =============================================================================

const SPACING_XXS := 2
const SPACING_XS := 4
const SPACING_SM := 8
const SPACING_MD := 12
const SPACING_LG := 16
const SPACING_XL := 24
const SPACING_2XL := 32
const SPACING_3XL := 48

## Large spacing for "breathing room" around hero items
const SPACING_20 := 80  # 5rem
const SPACING_24 := 96  # 6rem

# =============================================================================
# CORNER RADIUS
# =============================================================================

const RADIUS_NONE := 0
const RADIUS_SM := 4
const RADIUS_MD := 8
const RADIUS_LG := 12
const RADIUS_XL := 16
const RADIUS_FULL := 9999  # Circle/fully rounded

## Modal corner radius for "bubbly" adventurous mood
const RADIUS_XL_MODAL := 48  # 3rem

# =============================================================================
# SHADOWS
# =============================================================================

## Shadow offset (x, y)
const SHADOW_OFFSET_SM := Vector2(0, 1)
const SHADOW_OFFSET_MD := Vector2(0, 2)
const SHADOW_OFFSET_LG := Vector2(0, 4)

## Shadow blur
const SHADOW_BLUR_SM := 2
const SHADOW_BLUR_MD := 4
const SHADOW_BLUR_LG := 8

## Shadow alpha
const SHADOW_ALPHA_SM := 0.1
const SHADOW_ALPHA_MD := 0.2
const SHADOW_ALPHA_LG := 0.3

## Ambient shadow settings (soft, tinted, large blur)
const AMBIENT_SHADOW_BLUR_MIN := 20  # Minimum blur for ambient shadows
const AMBIENT_SHADOW_BLUR_MAX := 40  # Maximum blur for floating elements
const AMBIENT_SHADOW_OFFSET := Vector2(0, 0)  # No offset for ambient

# =============================================================================
# ANIMATION
# =============================================================================

## Durations (in seconds)
const ANIM_DURATION_INSTANT := 0.0
const ANIM_DURATION_FAST := 0.1
const ANIM_DURATION_NORMAL := 0.2
const ANIM_DURATION_SLOW := 0.3
const ANIM_DURATION_SLOWER := 0.5

## Easing (approximations of easing curves)
const ANIM_EASE_OUT := 0.25  # Cubic ease-out
const ANIM_EASE_IN_OUT := 0.42  # Cubic ease-in-out

# =============================================================================
# BORDERS
# =============================================================================

const BORDER_WIDTH_NONE := 0
const BORDER_WIDTH_SM := 1
const BORDER_WIDTH_MD := 2
const BORDER_WIDTH_LG := 3

# =============================================================================
# OPACITY
# =============================================================================

const OPACITY_DISABLED := 0.4
const OPACITY_HIDDEN := 0.0
const OPACITY_TRANSPARENT := 0.5
const OPACITY_FULL := 1.0

# =============================================================================
# Z-INDEX LAYERS
# =============================================================================

const Z_BASE := 0
const Z_BELOW := -10
const Z_OVERLAY := 100
const Z_POPUP := 200
const Z_MODAL := 300
const Z_TOAST := 400

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

## Get primary color with state
static func get_primary_color(state: String = "default") -> Color:
	match state:
		"hover": return COLOR_PRIMARY_FIXED
		"pressed": return COLOR_PRIMARY_DIM
		"disabled": return Color(1, 1, 1, 0.4)  # 40% opacity
		_: return COLOR_PRIMARY

## Get secondary color with state
static func get_secondary_color(state: String = "default") -> Color:
	match state:
		"hover": return COLOR_SECONDARY_FIXED
		"pressed": return COLOR_SECONDARY_DIM
		"disabled": return Color(1, 1, 1, 0.4)  # 40% opacity
		_: return COLOR_SECONDARY

## Get surface color by tier for depth hierarchy
## Use instead of borders for "No-Line Rule"
static func get_surface_tier_color(tier: String) -> Color:
	match tier:
		"base":
			return COLOR_SURFACE
		"container":
			return COLOR_SURFACE_CONTAINER
		"low":
			return COLOR_SURFACE_CONTAINER_LOW
		"lowest":
			return COLOR_SURFACE_CONTAINER_LOWEST
		"high":
			return COLOR_SURFACE_CONTAINER_HIGH
		"highest":
			return COLOR_SURFACE_CONTAINER_HIGHEST
		"variant":
			return COLOR_SURFACE_VARIANT
		"dim":
			return COLOR_SURFACE_DIM
		"bright":
			return COLOR_SURFACE_BRIGHT
		_:
			return COLOR_SURFACE

## Get ambient shadow color (tinted, soft)
## Use for floating elements like tooltips, dragged items
static func get_ambient_shadow_color() -> Color:
	return COLOR_AMBIENT_SHADOW

## Get ambient shadow blur size
## Use larger blur for "floating" elements
static func get_ambient_shadow_blur(is_floating: bool = false) -> int:
	return AMBIENT_SHADOW_BLUR_MAX if is_floating else AMBIENT_SHADOW_BLUR_MIN

## Get ghost border color (low opacity outline_variant)
## Use sparingly for empty equipment slots only
static func get_ghost_border_color() -> Color:
	return COLOR_GHOST_BORDER

## Get button depth settings for 3D bubbly effect
## Returns Dictionary with {color, offset, blur}
static func get_button_depth_settings() -> Dictionary:
	return {
		"color": BUTTON_INSET_SHADOW_COLOR,
		"offset": BUTTON_INSET_SHADOW_OFFSET,
		"blur": BUTTON_INSET_SHADOW_BLUR
	}

## Get button corner radius by size
static func get_button_radius(size: String = "md") -> int:
	match size:
		"xl": return BUTTON_RADIUS_XL
		_: return BUTTON_RADIUS_MD

## Get modal corner radius for bubbly mood
static func get_modal_radius() -> int:
	return RADIUS_XL_MODAL

## Check if a color is light (for text contrast)
static func is_color_light(color: Color) -> bool:
	# Calculate luminance using relative luminance formula
	return (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) > 0.5

## Get appropriate text color for a background
static func get_text_color_for_background(bg_color: Color, light_color: Color = COLOR_ON_SURFACE, dark_color: Color = Color.WHITE) -> Color:
	if is_color_light(bg_color):
		return COLOR_ON_SURFACE
	else:
		return dark_color

## Get gradient colors for buttons and CTAs
## Returns Array[Color] with [start_color, end_color]
static func get_gradient_colors(type: String = "primary") -> Array[Color]:
	match type:
		"primary":
			return [COLOR_GRADIENT_PRIMARY_START, COLOR_GRADIENT_PRIMARY_END]
		"secondary":
			return [COLOR_SECONDARY, COLOR_SECONDARY_CONTAINER]
		"tertiary":
			return [COLOR_TERTIARY, COLOR_TERTIARY_CONTAINER]
		_:
			return [COLOR_GRADIENT_PRIMARY_START, COLOR_GRADIENT_PRIMARY_END]

## Get scaled font size
static func get_scaled_font_size(base_size: int, scale: float = 1.0) -> int:
	return int(base_size * clampf(scale, 0.8, 1.5))

## Get health bar color based on percentage
static func get_health_color(percentage: float) -> Color:
	if percentage <= 0.25:
		return Color(0.94, 0.27, 0.31, 1)  # Critical (red)
	elif percentage <= 0.5:
		return Color(0.96, 0.71, 0.35, 1)  # Low (orange)
	else:
		return COLOR_TERTIARY  # Healthy (emerald)

## Get rarity color
static func get_rarity_color(rarity: String) -> Color:
	match rarity:
		"common": return Color(0.61, 0.61, 0.61, 1)  # Gray
		"rare": return COLOR_PRIMARY  # Blue
		"epic": return COLOR_SECONDARY  # Gold/Orange
		"legendary": return Color(1, 0.77, 0.22, 1)  # Purple

# =============================================================================
# LEGACY COLORS (For backward compatibility - deprecate over time)
# =============================================================================

# --- PRIMARY COLORS ---
const COLOR_PRIMARY_LEGACY := Color("#4A90D9")  # Legacy primary blue
const COLOR_PRIMARY_HOVER_LEGACY := Color("#5BA0E9")  # Legacy primary hover
const COLOR_PRIMARY_PRESSED_LEGACY := Color("#3A80C9")  # Legacy primary pressed
const COLOR_PRIMARY_DISABLED_LEGACY := Color("#7AB3E8")  # Legacy primary disabled

## Secondary color - used for secondary actions, accents
const COLOR_SECONDARY_LEGACY := Color("#6B7280")  # Legacy secondary
const COLOR_SECONDARY_HOVER_LEGACY := Color("#7B8290")  # Legacy secondary hover
const COLOR_SECONDARY_PRESSED_LEGACY := Color("#5B6270")  # Legacy secondary pressed

# --- SEMANTIC COLORS ---

## Success - positive outcomes, completed actions
const COLOR_SUCCESS := Color("#22C55E")
const COLOR_SUCCESS_HOVER := Color("#32D56E")
const COLOR_SUCCESS_PRESSED := Color("#12B54E")

## Warning - caution states, important notices
const COLOR_WARNING := Color("#F59E0B")
const COLOR_WARNING_HOVER := Color("#FFAE1B")
const COLOR_WARNING_PRESSED := Color("#E58E0B")

## Error - errors, destructive actions
const COLOR_ERROR := Color("#EF4444")
const COLOR_ERROR_HOVER := Color("#FF5454")
const COLOR_ERROR_PRESSED := Color("#DF3434")

## Info - informational states
const COLOR_INFO := Color("#3B82F6")
const COLOR_INFO_HOVER := Color("#4B92F6")
const COLOR_INFO_PRESSED := Color("#2B72E6")

# --- NEUTRAL COLORS (Legacy dark/light theme system) ---

## Background colors (dark theme)
const COLOR_BACKGROUND_DARK := Color("#0F0F1A")
const COLOR_SURFACE_DARK := Color("#1A1A2E")
const COLOR_SURFACE_VARIANT_DARK := Color("#252540")
const COLOR_BORDER_DARK := Color("#2D2D4A")

## Background colors (light theme)
const COLOR_BACKGROUND_LIGHT := Color("#F8FAFC")
const COLOR_SURFACE_LIGHT := Color("#FFFFFF")
const COLOR_SURFACE_VARIANT_LIGHT := Color("#F1F5F9")
const COLOR_BORDER_LIGHT := Color("#E2E8F0")

## Text colors (dark theme)
const COLOR_TEXT_PRIMARY_DARK := Color("#F8FAFC")
const COLOR_TEXT_SECONDARY_DARK := Color("#94A3B8")
const COLOR_TEXT_DISABLED_DARK := Color("#64748B")

## Text colors (light theme)
const COLOR_TEXT_PRIMARY_LIGHT := Color("#0F172A")
const COLOR_TEXT_SECONDARY_LIGHT := Color("#475569")
const COLOR_TEXT_DISABLED_LIGHT := Color("#94A3B8")

# --- GAME-SPECIFIC COLORS ---

## Health/HP colors
const COLOR_HEALTH := COLOR_TERTIARY
const COLOR_HEALTH_LOW := Color(0.94, 0.27, 0.31, 1)  # Critical red
const COLOR_HEALTH_MEDIUM := Color(0.96, 0.71, 0.35, 1)  # Low orange

## Mana/Energy colors
const COLOR_MANA := Color("#3B82F6")
const COLOR_MANA_LOW := COLOR_ERROR

## Gold/Currency colors
const COLOR_GOLD := COLOR_SECONDARY
const COLOR_GEMS := Color("#8B5CF6")

## Player/Enemy colors
const COLOR_PLAYER := COLOR_SUCCESS
const COLOR_ENEMY := COLOR_ERROR
const COLOR_ALLY := COLOR_INFO

## Rarity colors (gear)
const COLOR_RARITY_COMMON := Color(0.61, 0.61, 0.61, 1)  # Gray
const COLOR_RARITY_RARE := COLOR_PRIMARY  # Blue
const COLOR_RARITY_EPIC := COLOR_SECONDARY  # Gold/Orange
const COLOR_RARITY_LEGENDARY := Color(1, 0.77, 0.22, 1)  # Purple

# =============================================================================
# TYPOGRAPHY
# =============================================================================

## Font sizes (base: 16px)
const FONT_SIZE_XS := 10
const FONT_SIZE_SM := 12
const FONT_SIZE_BASE := 14
const FONT_SIZE_LG := 16
const FONT_SIZE_XL := 18
const FONT_SIZE_2XL := 20
const FONT_SIZE_TITLE := 24
const FONT_SIZE_HEADER := 28
const FONT_SIZE_DISPLAY := 32
const FONT_SIZE_H1 := 32
const FONT_SIZE_H2 := 28
const FONT_SIZE_H3 := 24

## Display scale for "Hero Moments"
const FONT_SIZE_DISPLAY_LG := 56  # 3.5rem - Oversized for rewards/level-ups

## Font sizes - scaled (multiply base by scale factor)
const FONT_SCALE_MIN := 0.8
const FONT_SCALE_DEFAULT := 1.0
const FONT_SCALE_MAX := 1.5

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

## Get primary color with state (legacy compatibility)
static func get_primary_color(state: String = "default") -> Color:
	match state:
		"hover": return COLOR_PRIMARY_HOVER_LEGACY
		"pressed": return COLOR_PRIMARY_PRESSED_LEGACY
		"disabled": return COLOR_PRIMARY_DISABLED_LEGACY
		_: return COLOR_PRIMARY

## Get semantic color (success/warning/error/info)
static func get_semantic_color(type: String) -> Color:
	match type:
		"success": return COLOR_SUCCESS
		"warning": return COLOR_WARNING
		"error": return COLOR_ERROR
		"info": return COLOR_INFO
		_: return COLOR_INFO

## Get background color for current theme (legacy compatibility)
static func get_background_color(is_dark: bool = true) -> Color:
	return COLOR_BACKGROUND_DARK if is_dark else COLOR_BACKGROUND_LIGHT

## Get surface color for current theme (legacy compatibility)
static func get_surface_color(is_dark: bool = true) -> Color:
	return COLOR_SURFACE_DARK if is_dark else COLOR_SURFACE_LIGHT

## Get surface variant color for current theme (legacy compatibility)
static func get_surface_variant_color(is_dark: bool = true) -> Color:
	return COLOR_SURFACE_VARIANT_DARK if is_dark else COLOR_SURFACE_VARIANT_LIGHT

## Get border color for current theme (legacy compatibility)
static func get_border_color(is_dark: bool = true) -> Color:
	return COLOR_BORDER_DARK if is_dark else COLOR_BORDER_LIGHT

## Get primary text color for current theme (legacy compatibility)
static func get_text_primary_color(is_dark: bool = true) -> Color:
	return COLOR_TEXT_PRIMARY_DARK if is_dark else COLOR_TEXT_PRIMARY_LIGHT

## Get secondary text color for current theme (legacy compatibility)
static func get_text_secondary_color(is_dark: bool = true) -> Color:
	return COLOR_TEXT_SECONDARY_DARK if is_dark else COLOR_TEXT_SECONDARY_LIGHT

## Get disabled text color for current theme (legacy compatibility)
static func get_text_disabled_color(is_dark: bool = true) -> Color:
	return COLOR_TEXT_DISABLED_DARK if is_dark else COLOR_TEXT_DISABLED_LIGHT

## Get scaled font size
static func get_scaled_font_size(base_size: int, scale: float = 1.0) -> int:
	return int(base_size * clampf(scale, FONT_SCALE_MIN, FONT_SCALE_MAX))

## Get health bar color based on percentage
static func get_health_color(percentage: float) -> Color:
	if percentage <= 0.25:
		return COLOR_HEALTH_LOW
	elif percentage <= 0.5:
		return COLOR_HEALTH_MEDIUM
	else:
		return COLOR_HEALTH

## Get rarity color
static func get_rarity_color(rarity: String) -> Color:
	match rarity:
		"common": return COLOR_RARITY_COMMON
		"rare": return COLOR_RARITY_RARE
		"epic": return COLOR_RARITY_EPIC
		"legendary": return COLOR_RARITY_LEGENDARY
		_: return COLOR_RARITY_COMMON
