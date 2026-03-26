# Design Tokens - Armored Archer

This document catalogs the design tokens used throughout the Armored Archer UI. All UI elements should use these tokens instead of hardcoded values.

## Usage

```gdscript
# In GDScript, import and use tokens directly
extends Control

func _ready() -> void:
    var button = Button.new()
    button.modulate = DesignTokens.COLOR_PRIMARY
    button.add_theme_font_size_override("font_size", DesignTokens.FONT_SIZE_LG)
```

## Colors

### Primary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `COLOR_PRIMARY` | `#4A90D9` | Primary actions, highlights |
| `COLOR_PRIMARY_HOVER` | `#5BA0E9` | Primary button hover state |
| `COLOR_PRIMARY_PRESSED` | `#3A80C9` | Primary button pressed state |
| `COLOR_PRIMARY_DISABLED` | `#7AB3E8` | Primary button disabled state |

### Secondary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `COLOR_SECONDARY` | `#6B7280` | Secondary actions, accents |
| `COLOR_SECONDARY_HOVER` | `#7B8290` | Secondary hover |
| `COLOR_SECONDARY_PRESSED` | `#5B6270` | Secondary pressed |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `COLOR_SUCCESS` | `#22C55E` | Positive outcomes |
| `COLOR_WARNING` | `#F59E0B` | Caution states |
| `COLOR_ERROR` | `#EF4444` | Errors, destructive |
| `COLOR_INFO` | `#3B82F6` | Information |

### Neutral Colors (Dark Theme)

| Token | Hex | Usage |
|-------|-----|-------|
| `COLOR_BACKGROUND_DARK` | `#0F0F1A` | Main background |
| `COLOR_SURFACE_DARK` | `#1A1A2E` | Cards, panels |
| `COLOR_SURFACE_VARIANT_DARK` | `#252540` | Elevated surfaces |
| `COLOR_BORDER_DARK` | `#2D2D4A` | Borders |

### Neutral Colors (Light Theme)

| Token | Hex | Usage |
|-------|-----|-------|
| `COLOR_BACKGROUND_LIGHT` | `#F8FAFC` | Main background |
| `COLOR_SURFACE_LIGHT` | `#FFFFFF` | Cards, panels |
| `COLOR_SURFACE_VARIANT_LIGHT` | `#F1F5F9` | Elevated surfaces |
| `COLOR_BORDER_LIGHT` | `#E2E8F0` | Borders |

### Text Colors

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `COLOR_TEXT_PRIMARY_DARK` | `#F8FAFC` | - | Primary text |
| `COLOR_TEXT_SECONDARY_DARK` | `#94A3B8` | - | Secondary text |
| `COLOR_TEXT_DISABLED_DARK` | `#64748B` | - | Disabled text |
| `COLOR_TEXT_PRIMARY_LIGHT` | - | `#0F172A` | Primary text |
| `COLOR_TEXT_SECONDARY_LIGHT` | - | `#475569` | Secondary text |
| `COLOR_TEXT_DISABLED_LIGHT` | - | `#94A3B8` | Disabled text |

### Game-Specific Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `COLOR_HEALTH` | `#22C55E` | Health bar (full) |
| `COLOR_HEALTH_LOW` | `#EF4444` | Health bar (low) |
| `COLOR_HEALTH_MEDIUM` | `#F59E0B` | Health bar (medium) |
| `COLOR_MANA` | `#3B82F6` | Mana/energy |
| `COLOR_GOLD` | `#F59E0B` | Gold currency |
| `COLOR_GEMS` | `#8B5CF6` | Gem currency |
| `COLOR_PLAYER` | `#22C55E` | Player indicators |
| `COLOR_ENEMY` | `#EF4444` | Enemy indicators |
| `COLOR_ALLY` | `#3B82F6` | Ally indicators |

### Gear Rarity Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `COLOR_RARITY_COMMON` | `#9CA3AF` | Common gear |
| `COLOR_RARITY_RARE` | `#3B82F6` | Rare gear |
| `COLOR_RARITY_EPIC` | `#8B5CF6` | Epic gear |
| `COLOR_RARITY_LEGENDARY` | `#F59E0B` | Legendary gear |

## Typography

### Font Sizes

| Token | Size | Usage |
|-------|------|-------|
| `FONT_SIZE_XS` | 10px | Tiny labels |
| `FONT_SIZE_SM` | 12px | Captions |
| `FONT_SIZE_BASE` | 14px | Body text |
| `FONT_SIZE_LG` | 16px | Large body |
| `FONT_SIZE_XL` | 18px | Subheadings |
| `FONT_SIZE_2XL` | 20px | Headings |
| `FONT_SIZE_TITLE` | 24px | Titles |
| `FONT_SIZE_HEADER` | 28px | Headers |
| `FONT_SIZE_DISPLAY` | 32px | Display text |

### Font Scaling

| Token | Value | Usage |
|-------|-------|-------|
| `FONT_SCALE_MIN` | 0.8 | Minimum accessibility scale |
| `FONT_SCALE_DEFAULT` | 1.0 | Default scale |
| `FONT_SCALE_MAX` | 1.5 | Maximum accessibility scale |

## Spacing

| Token | Size | Usage |
|-------|------|-------|
| `SPACING_XXS` | 2px | Tight spacing |
| `SPACING_XS` | 4px | Component internal |
| `SPACING_SM` | 8px | Related elements |
| `SPACING_MD` | 12px | Default spacing |
| `SPACING_LG` | 16px | Section spacing |
| `SPACING_XL` | 24px | Large gaps |
| `SPACING_2XL` | 32px | Section breaks |
| `SPACING_3XL` | 48px | Major sections |

## Corner Radius

| Token | Size | Usage |
|-------|------|-------|
| `RADIUS_NONE` | 0px | No rounding |
| `RADIUS_SM` | 4px | Small elements |
| `RADIUS_MD` | 8px | Default |
| `RADIUS_LG` | 12px | Large elements |
| `RADIUS_XL` | 16px | Cards, panels |
| `RADIUS_FULL` | 9999px | Fully rounded |

## Shadows

### Offset

| Token | Value | Usage |
|-------|-------|-------|
| `SHADOW_OFFSET_SM` | (0, 1) | Subtle |
| `SHADOW_OFFSET_MD` | (0, 2) | Default |
| `SHADOW_OFFSET_LG` | (0, 4) | Elevated |

### Blur

| Token | Value | Usage |
|-------|-------|-------|
| `SHADOW_BLUR_SM` | 2px | Subtle |
| `SHADOW_BLUR_MD` | 4px | Default |
| `SHADOW_BLUR_LG` | 8px | Elevated |

### Alpha

| Token | Value | Usage |
|-------|-------|-------|
| `SHADOW_ALPHA_SM` | 0.1 | Light |
| `SHADOW_ALPHA_MD` | 0.2 | Medium |
| `SHADOW_ALPHA_LG` | 0.3 | Heavy |

## Animation

### Durations (seconds)

| Token | Value | Usage |
|-------|-------|-------|
| `ANIM_DURATION_INSTANT` | 0.0 | Immediate |
| `ANIM_DURATION_FAST` | 0.1 | Quick transitions |
| `ANIM_DURATION_NORMAL` | 0.2 | Default |
| `ANIM_DURATION_SLOW` | 0.3 | Emphasized |
| `ANIM_DURATION_SLOWER` | 0.5 | Full animation |

### Easing

| Token | Value | Usage |
|-------|-------|-------|
| `ANIM_EASE_OUT` | 0.25 | Cubic ease-out |
| `ANIM_EASE_IN_OUT` | 0.42 | Cubic ease-in-out |

## Borders

| Token | Value | Usage |
|-------|-------|-------|
| `BORDER_WIDTH_NONE` | 0 | No border |
| `BORDER_WIDTH_SM` | 1px | Subtle |
| `BORDER_WIDTH_MD` | 2px | Default |
| `BORDER_WIDTH_LG` | 3px | Emphasized |

## Opacity

| Token | Value | Usage |
|-------|-------|-------|
| `OPACITY_DISABLED` | 0.4 | Disabled state |
| `OPACITY_HIDDEN` | 0.0 | Hidden |
| `OPACITY_TRANSPARENT` | 0.5 | Semi-transparent |
| `OPACITY_FULL` | 1.0 | Fully visible |

## Z-Index Layers

| Token | Value | Usage |
|-------|-------|-------|
| `Z_BASE` | 0 | Default layer |
| `Z_BELOW` | -10 | Behind everything |
| `Z_OVERLAY` | 100 | UI overlays |
| `Z_POPUP` | 200 | Popups |
| `Z_MODAL` | 300 | Modal dialogs |
| `Z_TOAST` | 400 | Toast notifications |

## Helper Functions

The `DesignTokens` class provides helper functions:

```gdscript
# Get primary color with state
var hover_color = DesignTokens.get_primary_color("hover")

# Get semantic color
var error_color = DesignTokens.get_semantic_color("error")

# Get background for current theme
var bg = DesignTokens.get_background_color(true)  # dark

# Get scaled font size
var size = DesignTokens.get_scaled_font_size(14, 1.2)

# Get health bar color based on percentage
var health_color = DesignTokens.get_health_color(0.3)  # Low health color

# Get rarity color
var epic_color = DesignTokens.get_rarity_color("epic")
```

## Theme Manager

Use `ThemeManager` for runtime theme switching:

```gdscript
# Toggle theme
ThemeManager.toggle_theme()

# Get current theme colors
var colors = ThemeManager.get_theme_colors()
var bg = ThemeManager.get_background_color()

# Listen for theme changes
ThemeManager.theme_changed.connect(_on_theme_changed)
```

## Accessibility Manager

Use `AccessibilityManager` for accessibility settings:

```gdscript
# Get scaled font size
var size = AccessibilityManager.get_scaled_font_size(14)

# Set font scale (0.8 to 1.5)
AccessibilityManager.set_font_scale(1.2)

# Enable high contrast
AccessibilityManager.set_high_contrast(true)

# Check WCAG compliance
var passes = AccessibilityManager.meets_wcag_aa(foreground, background)
```
