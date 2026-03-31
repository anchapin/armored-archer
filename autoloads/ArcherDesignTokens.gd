extends Node

# =============================================================================
# DESIGN TOKENS - Armored Archer
# =============================================================================
# Centralized design constants for consistent UI across all screens.
# Use these tokens instead of hardcoded colors/values.
# NOTE: Available as global singleton via autoload - access as ArcherDesignTokens
# =============================================================================

# --- PRIMARY COLORS ---
## Main brand color - used for primary actions, highlights
const COLOR_PRIMARY := Color("#4A90D9")
const COLOR_PRIMARY_HOVER := Color("#5BA0E9")
const COLOR_PRIMARY_PRESSED := Color("#3A80C9")
const COLOR_PRIMARY_DISABLED := Color("#7AB3E8")

## Secondary color - used for secondary actions, accents
const COLOR_SECONDARY := Color("#6B7280")
const COLOR_SECONDARY_HOVER := Color("#7B8290")
const COLOR_SECONDARY_PRESSED := Color("#5B6270")

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

# --- NEUTRAL COLORS ---

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

# --- GILDED QUEST DESIGN SYSTEM (DARK OBSIDIAN) ---

## Surface Hierarchy (Metallic Plates)
# Base layer - game world background
const COLOR_SURFACE_DIM := Color("#0e0e0e")
const COLOR_BACKGROUND := Color("#0e0e0e")

# Floating panels
const COLOR_SURFACE := Color("#0e0e0e")

# Nested containers (stacked plates effect)
const COLOR_SURFACE_CONTAINER_LOWEST := Color("#000000")
const COLOR_SURFACE_CONTAINER_LOW := Color("#131313")
const COLOR_SURFACE_CONTAINER := Color("#191a1a")
const COLOR_SURFACE_CONTAINER_HIGH := Color("#1f2020")
const COLOR_SURFACE_CONTAINER_HIGHEST := Color("#262626")

# Surface variants
const COLOR_SURFACE_VARIANT := Color("#262626")
const COLOR_SURFACE_BRIGHT := Color("#2c2c2c")

# Text colors (dark theme)
const COLOR_ON_SURFACE := Color("#ffffff")
const COLOR_ON_SURFACE_VARIANT := Color("#adaaaa")
const COLOR_OUTLINE := Color("#767575")
const COLOR_OUTLINE_VARIANT := Color("#484848")

# Ghost border (15% opacity for "etched metal" look)
const COLOR_GHOST_BORDER := Color(0.733, 0.725, 0.702, 0.15)
const COLOR_AMBIENT_SHADOW := Color(0.22, 0.22, 0.2, 0.12)  # 12% opacity
const COLOR_GLASS_OVERLAY := Color(0.055, 0.055, 0.055, 0.6)  # 60% opacity

## Primary Colors (Golden Loot Glow)
const COLOR_PRIMARY_GILDED := Color("#ffac54")       # Gold - main brand
const COLOR_PRIMARY_DIM := Color("#ec8c00")          # Darker gold
const COLOR_PRIMARY_CONTAINER := Color("#ff9800")    # Orange gold
const COLOR_PRIMARY_FIXED := Color("#ff9800")        # Strong gold
const COLOR_PRIMARY_FIXED_DIM := Color("#ec8c00")    # Stronger gold
const COLOR_ON_PRIMARY := Color("#583100")            # Text on gold
const COLOR_ON_PRIMARY_CONTAINER := Color("#4a2800") # Text on orange

# Light variants for hover/pressed
const COLOR_PRIMARY_HOVER_GILDED := Color("#ffb86c")
const COLOR_PRIMARY_PRESSED_GILDED := Color("#cc8a43")

## Tertiary Colors (Uncommon Rarity - Green)
const COLOR_TERTIARY := Color("#7ef839")            # Bright green
const COLOR_TERTIARY_CONTAINER := Color("#70ea28")  # Container green
const COLOR_TERTIARY_FIXED := Color("#70ea28")       # Fixed green
const COLOR_TERTIARY_DIM := Color("#62db13")         # Darker green
const COLOR_ON_TERTIARY := Color("#235a00")          # Text on green
const COLOR_ON_TERTIARY_CONTAINER := Color("#1e5000") # Text on container
const COLOR_TERTIARY_HOVER := Color("#8ef949")
const COLOR_TERTIARY_PRESSED := Color("#5ecb03")

## Error Colors (Epic Rarity - Orange-Red)
const COLOR_ERROR_GILDED := Color("#ff7351")         # Orange-red
const COLOR_ERROR_CONTAINER := Color("#b92902")      # Container
const COLOR_ERROR_DIM := Color("#d53d18")            # Darker
const COLOR_ON_ERROR := Color("#450900")             # Text
const COLOR_ON_ERROR_CONTAINER := Color("#ffd2c8")   # Light text
const COLOR_ERROR_HOVER_GILDED := Color("#ff8361")
const COLOR_ERROR_PRESSED_GILDED := Color("#df5d41")

## Secondary Colors (Iron)
const COLOR_SECONDARY_IRON := Color("#efe0d1")            # Warm beige
const COLOR_SECONDARY_CONTAINER := Color("#4f453a")  # Dark iron
const COLOR_SECONDARY_DIM := Color("#e1d2c3")        # Light iron
const COLOR_SECONDARY_FIXED := Color("#efe0d1")       # Fixed
const COLOR_SECONDARY_FIXED_DIM := Color("#e1d2c3")  # Fixed darker
const COLOR_ON_SECONDARY := Color("#5a5045")          # Text
const COLOR_ON_SECONDARY_CONTAINER := Color("#ddcebf") # Light text

# Hover/pressed
const COLOR_SECONDARY_IRON_HOVER := Color("#f5e8d9")
const COLOR_SECONDARY_IRON_PRESSED := Color("#d9c8b5")

## Inverse Colors
const COLOR_INVERSE_SURFACE := Color("#fcf9f8")
const COLOR_INVERSE_ON_SURFACE := Color("#565555")
const COLOR_INVERSE_PRIMARY := Color("#8c5100")

## Surface Tint (for accent overlays)
const COLOR_SURFACE_TINT := Color("#ffac54")

# Aliases for backward compatibility
const COLOR_PRIMARY_STITCH := COLOR_PRIMARY_GILDED
const COLOR_TERTIARY_STITCH := COLOR_TERTIARY
const COLOR_ERROR_STITCH := COLOR_ERROR_GILDED
const COLOR_ON_PRIMARY_GILDED := COLOR_ON_PRIMARY

const COLOR_PRIMARY_M3 := Color("#0060ce")
const COLOR_PRIMARY_CONTAINER_M3 := Color("#6e9fff")
const COLOR_PRIMARY_DIM_M3 := Color("#0054b7")
const COLOR_PRIMARY_FIXED_M3 := Color("#6e9fff")
const COLOR_PRIMARY_FIXED_DIM_M3 := Color("#5391ff")
const COLOR_PRIMARY_TINT_M3 := Color("#0060ce")
const COLOR_ON_PRIMARY_M3 := Color("#ffffff")
const COLOR_ON_PRIMARY_CONTAINER_M3 := Color("#002150")

const COLOR_SECONDARY_M3 := Color("#8d5900")
const COLOR_SECONDARY_DIM_M3 := Color("#7d4e00")
const COLOR_SECONDARY_CONTAINER_M3 := Color("#ffc885")
const COLOR_SECONDARY_FIXED_M3 := Color("#ffc885")
const COLOR_SECONDARY_FIXED_DIM_M3 := Color("#ffb554")
const COLOR_ON_SECONDARY_M3 := Color("#ffffff")
const COLOR_ON_SECONDARY_CONTAINER_M3 := Color("#663f00")

const COLOR_TERTIARY_M3 := Color("#00734e")
const COLOR_TERTIARY_CONTAINER_M3 := Color("#69f6b8")
const COLOR_TERTIARY_FIXED_M3 := Color("#69f6b8")
const COLOR_TERTIARY_DIM_M3 := Color("#006544")
const COLOR_ON_TERTIARY_M3 := Color("#ffffff")

const COLOR_GRADIENT_PRIMARY_START := Color("#0060ce")
const COLOR_GRADIENT_PRIMARY_END := Color("#6e9fff")

const COLOR_SURFACE_TINT_M3 := Color("#0060ce")
const COLOR_INVERSE_SURFACE_M3 := Color("#0e0e0b")
const COLOR_INVERSE_ON_SURFACE_M3 := Color("#9f9d97")

const FONT_PLUS_JAKARTA_SANS_PATH := "res://fonts/Plus_Jakarta_Sans.ttf"
const FONT_BE_VIETNAM_PRO_PATH := "res://fonts/Be_Vietnam_Pro.ttf"

# Gilded Quest Typography Scale (Stitch Design System)
# Using fallbacks until Stitch fonts are imported
# Heroic Display - Epilogue (for boss names, level-up milestones)
const FONT_EPILOGUE_PATH := "res://fonts/Plus_Jakarta_Sans.ttf"
# Tactical Stats - Space Grotesk (for combat stats)
const FONT_SPACE_GROTESK_PATH := "res://fonts/Plus_Jakarta_Sans.ttf"
# Micro-Labels - Lexend (for secondary metadata)
const FONT_LEXEND_PATH := "res://fonts/Be_Vietnam_Pro.ttf"

# --- GAME-SPECIFIC COLORS ---

## Health/HP colors
const COLOR_HEALTH := Color("#22C55E")
const COLOR_HEALTH_LOW := Color("#EF4444")
const COLOR_HEALTH_MEDIUM := Color("#F59E0B")

## Mana/Energy colors
const COLOR_MANA := Color("#3B82F6")
const COLOR_MANA_LOW := Color("#EF4444")

## Gold/Currency colors
const COLOR_GOLD := Color("#F59E0B")
const COLOR_GEMS := Color("#8B5CF6")

## Player/Enemy colors
const COLOR_PLAYER := Color("#22C55E")
const COLOR_ENEMY := Color("#EF4444")
const COLOR_ALLY := Color("#3B82F6")

## Rarity colors (gear)
const COLOR_RARITY_COMMON := Color("#9CA3AF")
const COLOR_RARITY_RARE := Color("#3B82F6")
const COLOR_RARITY_EPIC := Color("#8B5CF6")
const COLOR_RARITY_LEGENDARY := Color("#F59E0B")

# --- TYPOGRAPHY ---

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

## Font sizes - scaled (multiply base by scale factor)
const FONT_SCALE_MIN := 0.8
const FONT_SCALE_DEFAULT := 1.0
const FONT_SCALE_MAX := 1.5

# --- SPACING SCALE (from Stitch) ---

## Base spacing scale (matches Gilded Quest design system)
const SPACING_XXS := 2
const SPACING_XS := 4
const SPACING_SM := 8
const SPACING_MD := 12
const SPACING_LG := 16
const SPACING_XL := 24
const SPACING_2XL := 32
const SPACING_3XL := 40  # 2.5rem

## Stitch-style spacing (using rem-based scale)
const SPACING_1 := 4    # 0.25rem
const SPACING_2 := 8    # 0.5rem
const SPACING_3 := 12   # 0.75rem
const SPACING_4 := 14   # 0.9rem - key separation value
const SPACING_5 := 16   # 1rem
const SPACING_6 := 24   # 1.5rem
const SPACING_7 := 32   # 2rem
const SPACING_8 := 40   # 2.5rem

# --- CORNER RADIUS ---

## Base radius values
const RADIUS_NONE := 0
const RADIUS_SM := 4
const RADIUS_MD := 8
const RADIUS_LG := 12
const RADIUS_XL := 16
const RADIUS_FULL := 9999  # Circle/fully rounded

## Gilded Quest-specific corner radius (machined part feel)
const RADIUS_DEFAULT := 4   # 0.25rem - primary buttons
const RADIUS_MACHINED := 4  # Forged iron feel
const RADIUS_SLIGHT := 8    # Slight rounding
const RADIUS_MODERATE := 12 # Moderate rounding
const RADIUS_NONE_GILDED := 0  # No rounding - armored feel

# --- SHADOWS ---

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

# --- ANIMATION ---

## Durations (in seconds)
const ANIM_DURATION_INSTANT := 0.0
const ANIM_DURATION_FAST := 0.1
const ANIM_DURATION_NORMAL := 0.2
const ANIM_DURATION_SLOW := 0.3
const ANIM_DURATION_SLOWER := 0.5

## Easing (approximations of easing curves)
const ANIM_EASE_OUT := 0.25  # Cubic ease-out
const ANIM_EASE_IN_OUT := 0.42  # Cubic ease-in-out

# --- BORDERS ---

const BORDER_WIDTH_NONE := 0
const BORDER_WIDTH_SM := 1
const BORDER_WIDTH_MD := 2
const BORDER_WIDTH_LG := 3

# --- OPACITY ---

const OPACITY_DISABLED := 0.4
const OPACITY_HIDDEN := 0.0
const OPACITY_TRANSPARENT := 0.5
const OPACITY_FULL := 1.0

# --- Z-INDEX LAYERS ---

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
		"hover": return COLOR_PRIMARY_HOVER
		"pressed": return COLOR_PRIMARY_PRESSED
		"disabled": return COLOR_PRIMARY_DISABLED
		_: return COLOR_PRIMARY

## Get primary color for theme (dark/light)
static func get_color_primary(is_dark: bool = true) -> Color:
	return COLOR_PRIMARY

## Get semantic color (success/warning/error/info)
static func get_semantic_color(type: String) -> Color:
	match type:
		"success": return COLOR_SUCCESS
		"warning": return COLOR_WARNING
		"error": return COLOR_ERROR
		"info": return COLOR_INFO
		_: return COLOR_INFO

## Get background color for current theme
static func get_background_color(is_dark: bool = true) -> Color:
	return COLOR_BACKGROUND_DARK if is_dark else COLOR_BACKGROUND_LIGHT

## Get surface color for current theme
static func get_surface_color(is_dark: bool = true) -> Color:
	return COLOR_SURFACE_DARK if is_dark else COLOR_SURFACE_LIGHT

## Get surface variant color for current theme
static func get_surface_variant_color(is_dark: bool = true) -> Color:
	return COLOR_SURFACE_VARIANT_DARK if is_dark else COLOR_SURFACE_VARIANT_LIGHT

## Get border color for current theme
static func get_border_color(is_dark: bool = true) -> Color:
	return COLOR_BORDER_DARK if is_dark else COLOR_BORDER_LIGHT

## Get primary text color for current theme
static func get_text_primary_color(is_dark: bool = true) -> Color:
	return COLOR_TEXT_PRIMARY_DARK if is_dark else COLOR_TEXT_PRIMARY_LIGHT

## Get secondary text color for current theme
static func get_text_secondary_color(is_dark: bool = true) -> Color:
	return COLOR_TEXT_SECONDARY_DARK if is_dark else COLOR_TEXT_SECONDARY_LIGHT

## Get disabled text color for current theme
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

# =============================================================================
# GILDED QUEST HELPER FUNCTIONS
# =============================================================================

## Get surface color for layered plates (0 = base, higher = more elevated)
static func get_layered_surface(layer: int) -> Color:
	match layer:
		0: return COLOR_SURFACE_DIM       # Base
		1: return COLOR_SURFACE_CONTAINER  # Floating panels
		2: return COLOR_SURFACE_CONTAINER_HIGH  # Elevated
		3: return COLOR_SURFACE_CONTAINER_HIGHEST # Highest
		-1: return COLOR_SURFACE_CONTAINER_LOW   # Lower
		-2: return COLOR_SURFACE_CONTAINER_LOWEST # Lowest
		_: return COLOR_SURFACE_CONTAINER

## Get primary button color for state
static func get_primary_button_color(state: String = "default") -> Color:
	match state:
		"default": return COLOR_PRIMARY_GILDED
		"hover": return COLOR_PRIMARY_HOVER_GILDED
		"pressed": return COLOR_PRIMARY_PRESSED_GILDED
		"disabled": return COLOR_PRIMARY_DIM
		_: return COLOR_PRIMARY_GILDED

## Get secondary button (iron) color for state
static func get_secondary_button_color(state: String = "default") -> Color:
	match state:
		"default": return COLOR_SECONDARY_CONTAINER
		"hover": return COLOR_SECONDARY_HOVER
		"pressed": return COLOR_SECONDARY_PRESSED
		"text": return COLOR_ON_SECONDARY_CONTAINER
		_: return COLOR_SECONDARY_CONTAINER

## Get ghost border color (15% opacity for etched metal look)
static func get_ghost_border_color() -> Color:
	return COLOR_GHOST_BORDER

## Get ambient glow color for active items
static func get_ambient_glow_color(color: Color, intensity: float = 0.12) -> Color:
	return Color(color.r, color.g, color.b, intensity)

## Get gradient colors for primary button (gold gradient)
static func get_primary_gradient_colors() -> Array[Color]:
	return [COLOR_PRIMARY_GILDED, COLOR_PRIMARY_DIM]

## Get gradient colors for tertiary button (green)
static func get_tertiary_gradient_colors() -> Array[Color]:
	return [COLOR_TERTIARY, COLOR_TERTIARY_DIM]

## Get gradient colors for error button (orange-red)
static func get_error_gradient_colors() -> Array[Color]:
	return [COLOR_ERROR_GILDED, COLOR_ERROR_DIM]

## Get rarity accent color (4px vertical bar on left edge)
static func get_rarity_accent_color(rarity: String) -> Color:
	match rarity:
		"common": return COLOR_RARITY_COMMON
		"rare": return COLOR_RARITY_RARE
		"epic": return COLOR_RARITY_EPIC
		"legendary": return COLOR_RARITY_LEGENDARY
		"uncommon": return COLOR_TERTIARY  # Green for uncommon
		_: return COLOR_RARITY_COMMON

## Get glass overlay color for modals
static func get_glass_overlay_color() -> Color:
	return COLOR_GLASS_OVERLAY

## Get text color based on importance
static func get_text_color(importance: String = "primary") -> Color:
	match importance:
		"primary": return COLOR_ON_SURFACE
		"secondary": return COLOR_ON_SURFACE_VARIANT
		"disabled": return COLOR_ON_SURFACE_VARIANT
		"inverse": return COLOR_INVERSE_ON_SURFACE
		_: return COLOR_ON_SURFACE
