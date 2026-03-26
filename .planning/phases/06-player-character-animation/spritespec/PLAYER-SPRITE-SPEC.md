# Phase 06: Player Character Sprite Specification

## Overview

This document defines the pixel art specifications for the player character animations. The player is an archer with directional movement and multiple action states.

---

## 1. General Specifications

| Property | Value |
|----------|-------|
| **Canvas Size** | 32x32 pixels per frame |
| **Pixel Scale** | 1:1 (no scaling) |
| **Color Palette** | 16-color max (indexed) |
| **Animation FPS** | Variable per state (see below) |
| **File Format** | PNG with transparency |

---

## 2. Animation States

### 2.1 Idle Animation
- **Frames:** 6 frames
- **FPS:** 8 fps (750ms loop)
- **Direction:** 4 (down, up, left, right)
- **Total Sprites:** 24 (4 directions × 6 frames)
- **Naming:** `idle_{direction}_{frame}.png`

**Visual Description:**
- Standing pose with slight breathing motion
- Bow held loosely at side (not drawn)
- Small bob up/down (1-2 pixels)
- Hair/cloth sway subtle

**Frame Breakdown:**
1. Frame 0 (0ms): Neutral standing
2. Frame 1 (125ms): Slight inhale, chest rises 1px
3. Frame 2 (250ms): Peak inhale
4. Frame 3 (375ms): Exhale starts
5. Frame 4 (500ms): Back to neutral
6. Frame 5 (625ms): Slight delay before loop

---

### 2.2 Walk Animation
- **Frames:** 6 frames
- **FPS:** 12 fps (500ms loop)
- **Direction:** 4 (down, up, left, right)
- **Total Sprites:** 24 (4 directions × 6 frames)
- **Naming:** `walk_{direction}_{frame}.png`

**Visual Description:**
- Walking/running gait
- Legs alternate in walking motion
- Arms swing slightly opposite to legs
- Bow bounces slightly on back

**Frame Breakdown:**
1. Frame 0 (0ms): Right foot forward
2. Frame 1 (83ms): Right foot planted, body forward
3. Frame 2 (166ms): Left foot forward (passing phase)
4. Frame 3 (250ms): Left foot planted
5. Frame 4 (333ms): Right foot forward (passing phase)
6. Frame 5 (416ms): Return to frame 0

---

### 2.3 Attack Animation
- **Frames:** 7 frames
- **FPS:** 10 fps (700ms total, non-looping)
- **Direction:** 4 (down, up, left, right)
- **Total Sprites:** 28 (4 directions × 7 frames)
- **Naming:** `attack_{direction}_{frame}.png`

**Visual Description:**
- Draw bow string fully
- Release arrow with follow-through
- Return to idle stance

**Frame Breakdown:**
1. Frame 0 (0ms): Start - bow raised, string not drawn
2. Frame 1 (100ms): Draw - string pulled to ear
3. Frame 2 (200ms): Aim - hold at full draw
4. Frame 3 (300ms): Release - string snaps forward
5. Frame 4 (400ms): Follow-through - bow tilts back
6. Frame 5 (500ms): Return - returning to neutral
7. Frame 6 (600ms): Complete - back to idle position

**Key Visual Elements:**
- Bow fully curved when drawn
- Arrow visible nocked
- String stretched to cheek/ear
- Release shows string snap forward

---

### 2.4 Bow Draw Animation
- **Frames:** 7 frames
- **FPS:** 8 fps (875ms loop)
- **Direction:** 4 (down, up, left, right)
- **Total Sprites:** 28 (4 directions × 7 frames)
- **Naming:** `bow_draw_{direction}_{frame}.png`

**Visual Description:**
- Aiming stance while holding bow drawn
- String held at full draw
- Arrow aimed in direction
- Subtle sway/breathing while holding

**Frame Breakdown:**
1. Frame 0 (0ms): Start draw
2. Frame 1 (125ms): Drawing
3. Frame 2 (250ms): Half draw
4. Frame 3 (375ms): Three-quarter draw
5. Frame 4 (500ms): Full draw, holding
6. Frame 5 (625ms): Slight adjustment (breathing)
7. Frame 6 (750ms): Hold position (loop back)

**Loop Behavior:** This animation loops while player holds aim

---

### 2.5 Hit/Damage Animation
- **Frames:** 3 frames
- **FPS:** 10 fps (300ms total, non-looping)
- **Direction:** 4 (down, up, left, right)
- **Total Sprites:** 12 (4 directions × 3 frames)
- **Naming:** `hit_{direction}_{frame}.png`

**Visual Description:**
- Knockback reaction
- Flash red briefly (optional overlay)
- Brief stagger pose

**Frame Breakdown:**
1. Frame 0 (0ms): Impact - body jerks back
2. Frame 1 (100ms): Stagger - off-balance pose
3. Frame 2 (200ms): Recover - starting to stabilize

---

### 2.6 Death Animation
- **Frames:** 7 frames
- **FPS:** 8 fps (875ms total, non-looping)
- **Direction:** 4 (down, up, left, right)
- **Total Sprites:** 28 (4 directions × 7 frames)
- **Naming:** `death_{direction}_{frame}.png`

**Visual Description:**
- Fall to ground
- Final pose lying down
- Bow may fall away

**Frame Breakdown:**
1. Frame 0 (0ms): Hit - caught in final blow
2. Frame 1 (125ms): Buckle - knees give out
3. Frame 2 (250ms): Fall - dropping to ground
4. Frame 3 (375ms): Landing - hit ground
5. Frame 4 (500ms): Collapse - torso falls
6. Frame 5 (625ms): Final - lying flat
7. Frame 6 (750ms): Dead - no movement

---

## 3. Color Palette

### Base Character Colors (Reference)
| Index | Color Name | Hex | Usage |
|-------|------------|-----|-------|
| 0 | Transparent | - | Background |
| 1 | Skin Light | #FFD4B8 | Face, hands |
| 2 | Skin Shadow | #D4A574 | Shading |
| 3 | Hair Dark | #2D1B0E | Hair base |
| 4 | Hair Light | #4A3222 | Hair highlights |
| 5 | Cloth Primary | #3D5A80 | Tunic |
| 6 | Cloth Shadow | #293D52 | Tunic shadows |
| 7 | Cloth Accent | #98C1D9 | Details |
| 8 | Leather Brown | #8B5A2B | Belt, boots |
| 9 | Leather Dark | #5C3D1E | Boots, straps |
| 10 | Bow Wood | #A67C52 | Bow |
| 11 | Bow Dark | #6B4423 | Bow shadow |
| 12 | String | #F5F5DC | Bowstring |
| 13 | Arrow Shaft | #D4A574 | Arrow |
| 14 | Arrow Tip | #707070 | Arrow head |
| 15 | Outline | #1A1A1A | 1px outline |

### Optional Element Colors
| Index | Color Name | Hex | Usage |
|-------|------------|-----|-------|
| 16 | Health Flash | #FF4444 | Damage flash |
| 17 | Gold Accent | #FFD700 | Trim, details |
| 18 | Shadow | #00000040 | Drop shadow |

---

## 4. Sprite Naming Convention

```
{animation_state}_{direction}_{frame_number}.png
```

**Examples:**
- `idle_down_0.png` - Idle animation, facing down, frame 0
- `walk_right_3.png` - Walk animation, facing right, frame 3
- `attack_up_5.png` - Attack animation, facing up, frame 5
- `death_left_6.png` - Death animation, facing left, frame 6 (final)

---

## 5. Direction Mapping

| Direction | Usage |
|-----------|-------|
| `down` | Player facing toward camera (south) |
| `up` | Player facing away from camera (north) |
| `left` | Player facing left (west) |
| `right` | Player facing right (east) |

---

## 6. Technical Requirements

### Import Settings (Godot)
- **Import Mode:** Lossless (VRAM Compression: disabled)
- **Filter:** Nearest (never Linear)
- **Mipmaps:** Disabled
- **Repeat:** Disabled
- **HDR:** Disabled

### SpriteFrames Configuration
The SpriteFrames resource should be configured:
```gdscript
# Animation: idle
idle_down: ["idle_down_0.png", "idle_down_1.png", ..., "idle_down_5.png"]
idle_up: ["idle_up_0.png", ..., "idle_up_5.png"]
idle_left: ["idle_left_0.png", ..., "idle_left_5.png"]
idle_right: ["idle_right_0.png", ..., "idle_right_5.png"]

# Animation: walk
walk_down: ["walk_down_0.png", ..., "walk_down_5.png"]
# ... etc

# All animations: loop = true for idle, walk, bow_draw
# All animations: loop = false for attack, hit, death
```

### FPS Settings
| Animation | FPS |
|-----------|-----|
| idle | 8 |
| walk | 12 |
| attack | 10 |
| bow_draw | 8 |
| hit | 10 |
| death | 8 |

---

## 7. Art Style Guidelines

### Consistency Rules
1. **Outline:** 1px dark outline on all characters (optional for pixel art style)
2. **Proportions:** Chibi style (large head, small body) - head ~40% of height
3. **Shading:** Simple 2-tone shading (light/shadow)
4. **Animation:** Smooth, readable silhouettes
5. **Color:** Limited palette, high contrast for readability

### Character Design Notes
- Archer with recognizable bow
- Hooded or capped character (hood adds silhouette)
- Visible quiver on back
- Tunic/armor with distinct color
- Boots visible

---

## 8. Deliverables Checklist

- [ ] 168 PNG files (24 animations × 7 frames average)
- [ ] Color palette documented
- [ ] All animations configured in SpriteFrames
- [ ] Direction mapping verified
- [ ] Import settings verified in Godot
- [ ] Animation timing verified (FPS)

---

## 9. File Output Location

```
assets/sprites/player/
├── idle_down_0.png ... idle_up_5.png (24 files)
├── walk_down_0.png ... walk_up_5.png (24 files)
├── attack_down_0.png ... attack_up_6.png (28 files)
├── bow_draw_down_0.png ... bow_draw_up_6.png (28 files)
├── hit_down_0.png ... hit_up_2.png (12 files)
├── death_down_0.png ... death_up_6.png (28 files)
└── player_sprites.tres (SpriteFrames resource)
```

---

*Specification Version: 1.0*
*Last Updated: 2026-03-24*