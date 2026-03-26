# Asymmetric Card Pattern

## Overview
Cards in the Gilded Quest UI use intentional asymmetry to create visual interest and depth, following the "Digital Pop-Up Book" creative direction.

## Visual Pattern

### Icon Overlap
- Icon can extend past the top-left corner of the card
- Typical overlap: -8px to -12px on X-axis, -8px to -12px on Y-axis
- This creates a "sticker" or "pop-out" effect

### Spacing Tokens
Use these spacing values for visual breathing room:
- **4px (xs)** - Tight spacing, element grouping
- **8px (sm)** - Related elements, icon-to-text
- **12px (md)** - Standard padding, internal gaps
- **16px (lg)** - Section separation, card padding
- **20px (xl)** - Major section breaks
- **24px (xxl)** - Card-to-card gaps, hero spacing

## Implementation

### StyleBoxFlat
Use `card_asymmetric.tres` as the base StyleBox:
```
- bg_color: surface_container_lowest (#ffffff)
- corner_radius: 16px
- shadow: subtle (4-8px shadow_size)
```

### Layout Structure
```
┌─────────────────────────────────┐
│  [Icon]                         │ ← Icon overlaps corner
│         Card Title              │
│         Card description text   │
│         with proper spacing     │
└─────────────────────────────────┘
```

### Code Example (GDScript)
```gdscript
# Apply asymmetric icon placement
var icon = $Icon
icon.position = Vector2(-8, -8)  # Overlap top-left corner

# Or use negative margins
var style = card_container.get_theme_stylebox("card")
# Icon container uses negative margin-left/margin_top
```

## Related Files
- `res://themes/styleboxes/card_asymmetric.tres` - Base StyleBoxFlat
- `res://themes/gilded_quest_theme.tres` - Theme resource with card style