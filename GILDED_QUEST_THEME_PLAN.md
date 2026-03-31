# Armored Archer → Gilded Quest Theme Update Plan

## Executive Summary
Update Armored Archer's Main Lobby UI to match the "Gilded Quest" aesthetic from Google Stitch Main Lobby project. This includes dark obsidian surfaces with golden loot glow, tactile metallic elements, and the "Relic Archive" design language.

---

## 1. Current State Analysis

### Existing Assets
| Component | Current State | Priority |
|-----------|---------------|----------|
| `ArcherDesignTokens.gd` | Partial Stitch colors defined | HIGH |
| `main_menu.gd` | Basic theming, needs full update | HIGH |
| `main_menu.tscn` | Layout exists, needs styling | HIGH |
| `ThemeManager.gd` | Dark/light toggle, needs Gilded mode | MEDIUM |
| Base UI components | Generic styling | HIGH |

### Key Design Differences
| Aspect | Current (Armored Archer) | Target (Gilded Quest) |
|--------|---------------------------|----------------------|
| Background | `#0F0F1A` dark blue | `#0e0e0e` obsidian |
| Primary | `#4A90D9` blue | `#ffac54` golden |
| Surface tiers | Simple hierarchy | Metallic plate stacking |
| Buttons | Flat with hover | Gradient with tactile press |
| Typography | Default fonts | Epilogue/Space Grotesk/Lexend |
| Elevation | Shadows | Luminance + ambient glows |
| Borders | 1px solid | No-line (background shift) |

---

## 2. Target Design System (from Stitch)

### Color Palette

#### Surface Hierarchy (Metallic Plates)
```
surface_dim          → #0e0e0e     (Base - game world)
surface              → #0e0e0e     (Same as dim for dark mode)
surface_container    → #191a1a     (Floating panels)
surface_container_low → #131313    (Stat blocks)
surface_container_lowest → #000000 (Input sockets)
surface_container_high → #1f2020   (Elevated panels)
surface_container_highest → #262626 (Actionable insets)
surface_variant      → #262626     (Item slots)
surface_bright       → #2c2c2c    (Highlights)
```

#### Primary Colors (Golden Loot Glow)
```
primary              → #ffac54     (Gold)
primary_dim          → #ec8c00     (Darker gold)
primary_container    → #ff9800     (Orange gold)
primary_fixed        → #ff9800     (Strong gold)
primary_fixed_dim    → #ec8c00     (Stronger gold)
on_primary           → #583100     (On gold text)
on_primary_container → #4a2800     (On orange text)
```

#### Tertiary (Uncommon Rarity Green)
```
tertiary             → #7ef839     (Bright green)
tertiary_container   → #70ea28     (Container green)
tertiary_fixed       → #70ea28     (Fixed green)
tertiary_dim         → #62db13     (Darker green)
on_tertiary          → #235a00     (Text on green)
```

#### Error (Epic Rarity Orange)
```
error                → #ff7351     (Orange-red)
error_container      → #b92902     (Container)
error_dim            → #d53d18     (Darker)
on_error             → #450900     (Text)
on_error_container   → #ffd2c8     (Light text)
```

#### Secondary (Iron)
```
secondary            → #efe0d1     (Warm beige)
secondary_container  → #4f453a     (Dark iron)
secondary_dim        → #e1d2c3     (Light iron)
on_secondary         → #5a5045     (Text)
on_secondary_container → #ddcebf  (Light text)
```

#### Text Colors
```
on_surface           → #ffffff     (Primary text - but Stitch uses #383833 for light!)
on_surface_variant   → #adaaaa     (Secondary text)
outline              → #767575     (Borders)
outline_variant      → #484848     (Subtle borders)
inverse_surface     → #fcf9f8     (Inverted)
inverse_on_surface   → #565555     (Inverted text)
inverse_primary      → #8c5100     (Inverted gold)
```

### Typography Scale
| Style | Font | Weight | Size |
|-------|------|--------|------|
| display-lg | EPILOGUE | Bold | 36px+ |
| title-md | SPACE_GROTESK | Medium | 20px |
| body-lg | SPACE_GROTESK | Regular | 16px |
| label-md | LEXEND | Regular | 12px |

### Spacing Scale
```
spacing-1 → 0.25rem (4px)
spacing-2 → 0.5rem (8px)
spacing-3 → 0.75rem (12px)
spacing-4 → 0.9rem (14.4px)
spacing-5 → 1rem (16px)
spacing-6 → 1.5rem (24px)
spacing-7 → 2rem (32px)
spacing-8 → 2.5rem (40px)
```

### Component Specifications

#### Primary Button (The Relic)
- Gradient: `primary` → `primary_dim` (top to bottom)
- Corner radius: 0.25rem (machined part feel)
- Press state: scale 0.96, background shifts to `primary_fixed_dim`
- Glow: subtle `primary` glow on hover

#### Secondary Button (The Iron)
- Background: `secondary_container` (`#4f453a`)
- Text: `on_secondary_container` (`#ddcebf`)
- Feel: forged iron

#### Cards & Equipment Slots
- No dividers - use vertical spacing (`spacing-4` = 14.4px)
- Rarity indicators: 4px vertical accent bar on left edge
- Use `outline_variant` at 15% opacity for "etched metal" look

#### Input Fields (Tactile Sockets)
- Background: `surface_container_lowest` (`#000000`)
- Active state: `outline` (`#767575`) glow
- Error: `error_dim` text + 5% `error` glow behind

#### The Rarity Pillar (Custom)
- Vertical progress bar for "Armor Durability"
- Fill: `tertiary` → `error` as depletes
- Well: `surface_variant` to look like physical gauge

---

## 3. Implementation Phases

### Phase 1: Foundation (Design Tokens)
**Files:**
- `autoloads/ArcherDesignTokens.gd`

**Actions:**
1. [ ] Add complete Gilded Quest color palette to DesignTokens
2. [ ] Add spacing scale constants
3. [ ] Add typography scale with font paths
4. [ ] Add component-specific token groups
5. [ ] Add utility functions for gradients and glows

**Verification:**
- Color constants accessible via `ArcherDesignTokens.COLOR_*`
- Spacing constants useable in layout

### Phase 2: Base Components Update
**Files:**
- `scenes/ui/components/base_button.gd`
- `scenes/ui/components/base_container.gd`
- `scenes/ui/components/base_panel.gd`
- `scenes/ui/components/base_label.gd`
- `scenes/ui/components/base_progress_bar.gd`

**Actions:**
1. [ ] Update base_button to support:
   - Gradient backgrounds (primary/secondary variants)
   - Tactile press animation (scale 0.96)
   - Glow effects on hover
   - Rarity accent bar support
2. [ ] Update base_container for:
   - Surface tier backgrounds
   - No-line design (background shift only)
   - Ambient glow support
3. [ ] Update base_panel for metallic plate styling
4. [ ] Update base_label for typography scale
5. [ ] Update base_progress_bar for Rarity Pillar style

**Verification:**
- All base components render with Gilded styling
- Press animations work smoothly
- Glow effects visible

### Phase 3: Main Menu Redesign
**Files:**
- `scenes/ui/main_menu.tscn`
- `scenes/ui/main_menu.gd`

**Actions:**
1. [ ] Redesign main_menu layout for:
   - Asymmetrical spacing (dynamic, "ready-to-fire" feel)
   - Overlapping UI elements over character art
   - Golden primary buttons (Play, PvP)
   - Iron secondary buttons (Settings, Quit)
   - Gem/currency display with `primary` highlight
2. [ ] Add ambient glow behind active elements
3. [ ] Implement rarity-colored loadout slots
4. [ ] Add campaign/season indicators with proper styling

**Visual Checklist:**
- [ ] Dark obsidian background (#0e0e0e)
- [ ] Golden Play button with gradient
- [ ] Iron Settings button
- [ ] Glowing accent elements
- [ ] No visible 1px borders

### Phase 4: Theme Manager Integration
**Files:**
- `autoloads/ThemeManager.gd`

**Actions:**
1. [ ] Add "gilded" theme mode option
2. [ ] Map all ThemeManager colors to Gilded Quest tokens
3. [ ] Add theme-specific component overrides
4. [ ] Persist theme preference

**Verification:**
- Theme toggle works in-game
- All UI updates when theme changes

### Phase 5: Cross-Screen Updates
**Files to update:**
- `scenes/ui/login_screen.tscn`
- `scenes/ui/loadout.tscn`
- `scenes/ui/gear_inventory.tscn`
- `scenes/ui/store_menu.tscn`
- `scenes/ui/leaderboard_menu.tscn`

**Actions:**
1. [ ] Apply Gilded Quest styling to all main screens
2. [ ] Ensure consistent surface tiers across screens
3. [ ] Add rarity color accents to gear screens
4. [ ] Update matchmaking/leaderboard with golden highlights

---

## 4. Technical Implementation Notes

### Gradient Implementation (GDScript)
```gdscript
# Example: Primary button gradient
var gradient := Gradient.new()
gradient.set_color(0, Color("#ffac54"))  # primary
gradient.set_color(1, Color("#ec8c00"))  # primary_dim

var gradient_texture := GradientTexture1D.new()
gradient_texture.gradient = gradient

var material := StandardMaterial3D.new()
material.albedo_texture = gradient_texture
```

### Ambient Glow Implementation
```gdscript
# Instead of shadows, use modulation for glow
var glow_color := Color(1.0, 0.67, 0.33, 0.12)  # primary at 12%
var glow := GlowMaterial.new()
glow.glow_color = glow_color
glow.glow_strength = 1.2
glow.glow_blur = 24
```

### No-Line Surface Transitions
```gdscript
# Use modulated background colors instead of borders
# Darker surface sits on lighter surface for "plate" effect
panel.modulate = Color(0.098, 0.098, 0.098, 1.0)  # surface_container_low
```

---

## 5. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Font files missing | High | Use fallback fonts, add font loading |
| Performance with glows | Medium | Limit glow to 1-2 elements, use simple alternatives |
| Breaking existing UI | Medium | Test each screen, provide fallback theme |
| Color accessibility | Low | Already includes high-contrast variants |

---

## 6. Success Criteria

### Visual Validation
- [ ] Dark obsidian background visible
- [ ] Golden primary buttons with gradient
- [ ] No 1px borders - only background shifts
- [ ] Ambient glows instead of shadows
- [ ] Consistent surface tier hierarchy

### Functional Validation
- [ ] All buttons respond to press with scale animation
- [ ] Theme toggle switches between modes
- [ ] Performance remains 60fps with glows disabled
- [ ] Text remains readable at all sizes

---

## 7. File Reference Map

### New/Modified Files
```
autoloads/
├── ArcherDesignTokens.gd        [UPDATE - Add full Gilded palette]
├── ThemeManager.gd              [UPDATE - Add gilded mode]

scenes/ui/components/
├── base_button.gd               [UPDATE - Gradient + tactile]
├── base_container.gd             [UPDATE - Surface tiers]
├── base_panel.gd                [UPDATE - Metallic plates]
├── base_label.gd                 [UPDATE - Typography scale]
├── base_progress_bar.gd         [UPDATE - Rarity Pillar]

scenes/ui/
├── main_menu.tscn               [UPDATE - Full redesign]
├── main_menu.gd                 [UPDATE - New theming]
├── login_screen.tscn            [UPDATE - Gilded styling]
├── loadout.tscn                 [UPDATE - Gilded styling]
├── gear_inventory.tscn           [UPDATE - Gilded styling]
└── [other screens...]           [UPDATE - Gilded styling]
```

---

## 8. Timeline Estimate

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1 | Foundation | 1-2 hrs |
| Phase 2 | Base Components | 2-3 hrs |
| Phase 3 | Main Menu | 2-3 hrs |
| Phase 4 | Theme Manager | 1 hr |
| Phase 5 | Cross-Screen | 2-4 hrs |
| **Total** | | **8-13 hrs** |

---

## 9. Next Action

**Immediate:** Update `ArcherDesignTokens.gd` with complete Gilded Quest color palette. Then proceed to Phase 2 base component updates.

---

*Plan generated: 2026-03-30*
*Reference: Stitch project "Main Lobby" (511335207036122308)*
*Design theme: Gilded Quest - "The Relic Archive"*