# Accessibility Guidelines - Armored Archer

This document outlines the accessibility standards and guidelines for the Armored Archer UI.

## Overview

Armored Archer aims to be accessible to all players. This includes players with visual impairments, motor disabilities, and other accessibility needs.

> **Note (issue #1751):** the accessibility-settings autoload was removed as dead
> code — it was never called by any game code. The runtime helpers it offered
> (font scaling, high contrast, reduced motion, screen reader toggles) are not
> currently wired into the UI. The guidelines below describe the standards
> the UI must meet; use the engine-native equivalents listed per section.

## Color Contrast (WCAG)

All UI text must meet WCAG AA contrast ratios:

- **Normal text**: 4.5:1 contrast ratio
- **Large text** (18px+): 3.0:1 contrast ratio
- **UI components**: 3.0:1 contrast ratio

### Design Tokens with WCAG Compliance

The `DesignTokens` class provides colors that meet WCAG AA:

```gdscript
# Dark theme - guaranteed contrast
var text = DesignTokens.COLOR_TEXT_PRIMARY_DARK  # #F8FAFC on #0F0F1A = 15.5:1
var secondary = DesignTokens.COLOR_TEXT_SECONDARY_DARK  # #94A3B8 on #0F0F1A = 7.3:1

# Light theme - guaranteed contrast
var text = DesignTokens.COLOR_TEXT_PRIMARY_LIGHT  # #0F172A on #F8FAFC = 14.5:1
var secondary = DesignTokens.COLOR_TEXT_SECONDARY_LIGHT  # #475569 on #F8FAFC = 7.1:1
```

## Font Scaling

The game supports 80% to 150% font scaling:

- 80%: For users who need smaller text
- 100%: Default
- 120%: Moderate enlargement
- 150%: Maximum accessibility

### Implementation

Scale font sizes locally where they are applied (no global font-scale
singleton is registered):

```gdscript
# Scale a font size at the call site
var size = int(base_size * font_scale)

# Apply to label
label.add_theme_font_size_override("font_size", size)
```

## Reduced Motion

For users sensitive to motion:

```gdscript
# Check the reduced-motion preference where the animation is triggered
if reduced_motion_enabled:
    # Skip animations
    pass
else:
    # Play animations
    play_animation()
```

## High Contrast Mode

High contrast mode provides:

- Pure black/white backgrounds
- Higher contrast colors
- Clearer borders

```gdscript
# Get a high contrast color from the design tokens
var bg = DesignTokens.COLOR_BACKGROUND_DARK
```

## Screen Reader Support

For screen reader users:

```gdscript
# Add accessibility labels
button.accessibility_label = "Play Game"
button.accessibility_description = "Start a new campaign game"

# In custom controls
self.accessibility_label = "Health Bar"
self.accessibility_description = "Shows current health percentage"
```

## Best Practices

### Do

- Use DesignTokens for all colors
- Test with font scale at 80% and 150%
- Add accessibility labels to interactive elements
- Provide visual feedback for all actions

### Don't

- Use color alone to convey information
- Rely on small text (<14px)
- Use animations longer than 300ms without reduced motion option
- Forget to test high contrast mode

## Testing Checklist

- [ ] All text passes WCAG AA at 100% scale
- [ ] All text passes WCAG AA at 150% scale
- [ ] High contrast mode is usable
- [ ] Reduced motion works correctly
- [ ] Screen reader labels are present
- [ ] Color is not the only indicator of state
