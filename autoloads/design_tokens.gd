class_name DesignTokens
extends Node

# =============================================================================
# DESIGN TOKENS - Armored Archer
# =============================================================================
# Centralized design constants for consistent UI across all screens.
# Use these tokens instead of hardcoded colors/values.
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

## Font sizes - scaled (multiply base by scale factor)
const FONT_SCALE_MIN := 0.8
const FONT_SCALE_DEFAULT := 1.0
const FONT_SCALE_MAX := 1.5

# --- SPACING ---

const SPACING_XXS := 2
const SPACING_XS := 4
const SPACING_SM := 8
const SPACING_MD := 12
const SPACING_LG := 16
const SPACING_XL := 24
const SPACING_2XL := 32
const SPACING_3XL := 48

# --- CORNER RADIUS ---

const RADIUS_NONE := 0
const RADIUS_SM := 4
const RADIUS_MD := 8
const RADIUS_LG := 12
const RADIUS_XL := 16
const RADIUS_FULL := 9999  # Circle/fully rounded

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
