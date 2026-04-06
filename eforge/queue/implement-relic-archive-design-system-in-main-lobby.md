---
title: Implement Relic Archive Design System in Main Lobby
created: 2026-04-06
---

# Implement Relic Archive Design System in Main Lobby

## Problem / Motivation

The current Godot Armored Archer project uses a light-mode only design system ("Tactile Heroism"), but the desired aesthetic from the Stitch "Main Lobby" project requires a dark mode "The Relic Archive" design system with specific characteristics:
- Dark Mode with VIBRANT color variant
- No-Line Rule (background shift architecture instead of borders)
- Surface Hierarchy for depth (metallic plate stacking)
- Asymmetrical Layouts for dynamic "ready-to-fire" positioning
- Loot Glow Effects for CTAs and rewards
- Armored Angular Design (ROUND_FOUR corner radius)

The gap between current and desired state includes missing dark mode palette, no surface hierarchy system, current components using borders instead of the No-Line Rule, centered/symmetrical UI instead of asymmetrical layouts, no soft shadow system, and missing font assets (Epilogue, Space Grotesk, Lexend).

## Goal

Implement the "The Relic Archive" design system from the Stitch "Main Lobby" project into the Godot Armored Archer game's main menu scene to achieve a tactical, high-contrast ARPG aesthetic with dark mode, surface hierarchy, no-line rule, and asymmetrical layouts.

## Approach

The implementation follows an 8-phase approach with sequential dependencies:

1. **Phase 1: Design Tokens Extension** - Extend `ArcherDesignTokens.gd` with Relic Archive dark mode palette including surface hierarchy colors (RA_SURFACE, RA_SURFACE_CONTAINER tiers), primary colors (RA_PRIMARY, RA_PRIMARY_DIM), accent colors (RA_TERTIARY, RA_ERROR), and ambient effect colors (RA_AMBIENT_SHADOW_COLOR, RA_GHOST_BORDER_COLOR).

2. **Phase 2: Theme Manager Update** - Add dark mode state to `ThemeManager`, create theme switching function, and apply Relic Archive colors to dark theme.

3. **Phase 3: Base Component Updates** - Update base UI components to support No-Line Rule and surface hierarchy:
   - `base_button.gd`: Remove borders, add gradient support, implement "sink" animation (scale 0.96 on press)
   - `base_container.gd`: Add surface tier property, remove borders, use background color shifts
   - `base_panel.gd`: Implement surface container tiers, add ambient glow option, support ghost borders
   - `base_label.gd`: Add Epilogue, Space Grotesk, Lexend font support, add "heroic display" typography

4. **Phase 4: Main Lobby Scene Redesign** - Redesign `main_menu.tscn` with asymmetrical layout structure:
   - Background: RA_SURFACE (#0e0e0e)
   - Top Bar: surface_container with left-aligned player info (asymmetrical) and right-aligned currency with RA_PRIMARY glow
   - Center Content: Weighted layout with Title (Epilogue), Subtitle (Space Grotesk), Character Preview (centered, overlapping UI), Action Buttons (aligned left: Play, Loadout, PvP, Shop)
   - Bottom Bar: surface_container_low with season info and settings

5. **Phase 5: Font Asset Integration** - Download/copy font files (Epilogue-Bold, Epilogue-Regular, SpaceGrotesk-Bold, SpaceGrotesk-Regular, Lexend-Regular), add to `project.godot` as custom fonts, update `ArcherDesignTokens.gd` with font paths, apply fonts to base components.

6. **Phase 6: Ambient Glow Effects** - Create `ambient_glow_panel.gd` component using RA_AMBIENT_SHADOW_COLOR with 24px blur, apply to active equipment slots, dragged items, floating tooltips, and loot drops.

7. **Phase 7: Rarity Pillar Component** - Create `rarity_pillar.gd` vertical progress bar styled with RA_SURFACE_VARIANT "well", animate color transition from RA_TERTIARY to RA_ERROR, integrate with gear stats display.

8. **Phase 8: Testing & Verification** - Create test scene showcasing all components, verify dark mode colors, test surface hierarchy depth, verify No-Line Rule compliance, check asymmetrical layouts, test ambient glow effects, verify typography, test button interactions.

**Technical Decisions & Constraints:**
- Use StyleBoxFlat gradient for buttons (Godot native)
- Use background color shifts instead of borders (No-Line Rule)
- Make ambient glow optional/configurable for performance
- Use feature flags or theme switching if design conflicts arise
- Estimated total time: ~11.5 hours

## Scope

### In Scope

- **Design Tokens Extension**: Adding Relic Archive palette constants to `ArcherDesignTokens.gd` including surface hierarchy colors, primary colors, accent colors, and ambient effect colors
- **Theme Manager Update**: Adding dark mode state and theme switching functionality to `ThemeManager`
- **Base Component Updates**: Modifying `base_button.gd`, `base_container.gd`, `base_panel.gd`, `base_label.gd` to support No-Line Rule, surface hierarchy, gradients, and new fonts
- **Main Lobby Redesign**: Completely restructuring `main_menu.tscn` with asymmetrical layout, new background colors, and Relic Archive styling
- **Font Integration**: Adding Epilogue, Space Grotesk, and Lexend font files to the project
- **Ambient Glow Effects**: Creating `ambient_glow_panel.gd` component with 24px blur, 12% opacity soft shadows
- **Rarity Pillar Component**: Creating `rarity_pillar.gd` vertical progress bar for armor durability
- **Testing & Verification**: Creating test scene and verifying all design system aspects

### Out of Scope

- Changes to other scenes beyond `main_menu.tscn`
- Modifications to core game systems (Gameplay, Combat, Networking)
- Implementation of the actual game modes (Play, Loadout, PvP, Shop buttons)
- Backend or database changes
- Performance optimization beyond ambient glow configurability
- Support for mobile-specific UI adaptations
- Localization/internationalization
- Accessibility features beyond existing DesignTokens support

## Acceptance Criteria

1. **Visual Fidelity**: Main lobby matches Stitch design with 90%+ similarity to "The Relic Archive" aesthetic
2. **Dark Mode Palette**: Correct Relic Archive color palette applied (RA_SURFACE #0e0e0e, RA_SURFACE_CONTAINER tiers, RA_PRIMARY #ffac54, RA_TERTIARY #7ef839, RA_ERROR #ff7351, etc.)
3. **No-Line Rule**: All UI uses background shifts instead of 1px borders; no solid white borders present
4. **Typography**: Correct fonts applied (Epilogue for heroic display, Space Grotesk for tactical stats, Lexend for micro-labels)
5. **Surface Hierarchy**: Clear visual depth through surface tiers (background → surface_container → surface_container_high → surface_container_highest)
6. **Asymmetry**: Layout feels dynamic with asymmetrical spacing (e.g., spacing-8 left, spacing-4 right), not perfectly centered
7. **Interactivity**: Buttons have proper press animation (scale 0.96) and hover states with gradient backgrounds (RA_PRIMARY → RA_PRIMARY_DIM)
8. **Performance**: No performance degradation from new styling; ambient glow is optional/configurable
9. **Component Functionality**: All base components (button, container, panel, label) correctly support new design tokens
10. **Theme Switching**: ThemeManager successfully switches between light and dark modes
11. **Ambient Glows**: Soft, tinted shadow system (24px blur, 12% opacity) works for active items
12. **Rarity Pillar**: Vertical progress bar correctly animates color transition from RA_TERTIARY to RA_ERROR
13. **Currency Display**: Gold/gem highlights use RA_PRIMARY color with glow effects
14. **Text Colors**: Large text blocks use RA_ON_SURFACE_VARIANT (#adaaaa) instead of pure white (#ffffff)
15. **Corner Radius**: All rounded corners use ROUND_FOUR (4px) for "armored" and angular aesthetic, not above xl (0.75rem)
