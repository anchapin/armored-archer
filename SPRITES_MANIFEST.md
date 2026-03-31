# Armored Archer Pixel Art Assets Manifest

**Generation Date:** 2026-03-26  
**Total Sprites Generated:** 239 files  
**Success Rate:** 100%

---

## 📋 Asset Inventory

### Player Character Sprites (144 files)
**Location:** `assets/sprites/player/`  
**Size:** 32×32 pixels  
**Palette:** 16-color fantasy archer theme

#### Animation Sets (All with 4-directional support: down, up, left, right)

| Animation | Frames | Total Sprites | Purpose |
|-----------|--------|---------------|---------|
| `idle_*_*.png` | 6 | 24 | Breathing animation |
| `walk_*_*.png` | 6 | 24 | Walking gait |
| `attack_*_*.png` | 7 | 28 | Bow draw & release |
| `bow_draw_*_*.png` | 7 | 28 | Aiming pose |
| `hit_*_*.png` | 3 | 12 | Damage reaction |
| `death_*_*.png` | 7 | 28 | Falling animation |

**File Format:** `{animation}_{direction}_{frame}.png`

**Example Files:**
```
idle_down_0.png
walk_left_3.png
attack_up_6.png
bow_draw_right_2.png
hit_down_1.png
death_up_4.png
```

---

### Enemy Sprites (64 files)
**Location:** `assets/sprites/enemies/`  
**Size:** 32×32 pixels

#### Enemy Types (4 variants)

| Enemy Type | Color Scheme | Frames | Total | Files |
|-----------|--------------|--------|-------|-------|
| Goblin | Green | 4 | 16 | `goblin_idle_*_*.png` |
| Skeleton | Bone/White | 4 | 16 | `skeleton_idle_*_*.png` |
| Shadow Runner | Dark Purple | 4 | 16 | `shadow_runner_idle_*_*.png` |
| Brute | Brown/Tan | 4 | 16 | `brute_idle_*_*.png` |

Each enemy type includes idle animations in all 4 directions with 4 frames.

**File Format:** `{enemy_type}_idle_{direction}_{frame}.png`

---

### Equipment Sprites (21 files)

#### Bows (4 files) — 48×48 pixels
**Location:** `assets/sprites/equipment/bows/`

| Bow Type | Color | Damage | File |
|----------|-------|--------|------|
| Wooden | Brown | Low | `wooden.png` |
| Composite | Enhanced Brown | Medium | `composite.png` |
| Elven | Green/Gold | High | `elven.png` |
| Dragon | Red/Orange | Very High | `dragon.png` |

#### Arrows (5 files) — 32×32 pixels
**Location:** `assets/sprites/equipment/arrows/`

| Arrow Type | Color | Material | File |
|-----------|-------|----------|------|
| Wooden | Brown | Wood | `wooden.png` |
| Iron | Gray | Iron | `iron.png` |
| Steel | Silver-Gray | Steel | `steel.png` |
| Silver | White | Silver | `silver.png` |
| Enchanted | Gold/Blue | Magical | `enchanted.png` |

#### Armor Pieces (4 files) — 32×32 pixels
**Location:** `assets/sprites/equipment/armor/`

| Armor Type | Color | Protection | File |
|-----------|-------|-----------|------|
| Leather | Brown | Low | `leather.png` |
| Chain | Gray | Medium | `chain.png` |
| Plate | Dark Gray | High | `plate.png` |
| Dragon | Red/Gold | Very High | `dragon.png` |

#### Helmets (4 files) — 32×32 pixels
**Location:** `assets/sprites/equipment/helms/`

| Helm Type | Color | Bonus | File |
|-----------|-------|-------|------|
| Leather | Brown | +1 DEF | `leather.png` |
| Chain | Gray | +2 DEF | `chain.png` |
| Plate | Dark Gray | +3 DEF | `plate.png` |
| Dragon | Red/Gold | +4 DEF | `dragon.png` |

#### Amulets (4 files) — 32×32 pixels
**Location:** `assets/sprites/equipment/amulets/`

| Amulet Type | Color | Stat Bonus | File |
|-----------|-------|-----------|------|
| Health | Red | +HP Regen | `health.png` |
| Mana | Blue | +Mana Pool | `mana.png` |
| Speed | Yellow | +Attack Speed | `speed.png` |
| Strength | Orange | +Damage | `strength.png` |

---

### UI Icons (10 files)
**Location:** `assets/sprites/ui/`  
**Size:** 32×32 pixels

| Icon Name | Color | Purpose | File |
|-----------|-------|---------|------|
| health | Red | HP Display | `health.png` |
| mana | Blue | Mana Display | `mana.png` |
| speed | Yellow | Speed Stat | `speed.png` |
| strength | Orange | Damage Stat | `strength.png` |
| inventory | Brown | Item Storage | `inventory.png` |
| equipment | Gray | Gear Screen | `equipment.png` |
| map | Brown | World Map | `map.png` |
| quest | Gold | Quest Marker | `quest.png` |
| settings | Gray | Options Menu | `settings.png` |
| close | Red | Close Button | `close.png` |

---

## 🎨 Technical Specifications

### Palettes
- **Player Archer:** 16-color palette (skin, brown, green, white, orange, red, grays)
- **Enemy Types:** Distinct 16-color palettes per type
- **Equipment:** Color-coded by rarity/type
- **UI:** Standard color scheme (red, blue, yellow, orange, green, etc.)

### Image Format
- **Format:** PNG with alpha transparency
- **Color Mode:** RGBA
- **Compression:** Lossless
- **No Anti-aliasing:** Crisp pixel art edges

### Dimensions
- **Character/Enemy:** 32×32 pixels
- **Large Equipment (Bows):** 48×48 pixels
- **Small Equipment/UI:** 32×32 pixels

### Animation Frame Rates (Recommended)
- **Idle:** 4-6 FPS (breathing animation)
- **Walk:** 6-8 FPS
- **Attack:** 10-12 FPS (bow draw and release)
- **Hit/Death:** 8-10 FPS

---

## 🚀 Integration Guide

### Godot 4.x Integration

#### 1. Player Character Setup
```gdscript
extends AnimatedSprite2D

func _ready():
    sprite_frames = load("res://assets/sprites/player/player_animations.tres")
    play("idle_down")
    
func _process(_delta):
    if Input.is_action_pressed("ui_right"):
        animation = "walk_right"
```

#### 2. Enemy Spawning
```gdscript
var goblin = preload("res://scenes/enemies/Goblin.tscn").instantiate()
# Goblin uses goblin_idle_down_0.png through goblin_idle_right_3.png
```

#### 3. Equipment Display
```gdscript
var bow_texture = load("res://assets/sprites/equipment/bows/elven.png")
$BowSprite.texture = bow_texture
```

---

## 📁 Directory Structure

```
assets/sprites/
├── player/ (144 sprites)
│   ├── idle_down_0.png through idle_right_5.png
│   ├── walk_down_0.png through walk_right_5.png
│   ├── attack_down_0.png through attack_right_6.png
│   ├── bow_draw_down_0.png through bow_draw_right_6.png
│   ├── hit_down_0.png through hit_right_2.png
│   └── death_down_0.png through death_right_6.png
│
├── enemies/ (64 sprites)
│   ├── goblin_idle_down_0.png through goblin_idle_right_3.png
│   ├── skeleton_idle_down_0.png through skeleton_idle_right_3.png
│   ├── shadow_runner_idle_down_0.png through shadow_runner_idle_right_3.png
│   └── brute_idle_down_0.png through brute_idle_right_3.png
│
├── equipment/ (21 sprites)
│   ├── bows/ (4 files, 48×48)
│   │   ├── wooden.png
│   │   ├── composite.png
│   │   ├── elven.png
│   │   └── dragon.png
│   ├── arrows/ (5 files, 32×32)
│   │   ├── wooden.png
│   │   ├── iron.png
│   │   ├── steel.png
│   │   ├── silver.png
│   │   └── enchanted.png
│   ├── armor/ (4 files, 32×32)
│   │   ├── leather.png
│   │   ├── chain.png
│   │   ├── plate.png
│   │   └── dragon.png
│   ├── helms/ (4 files, 32×32)
│   │   ├── leather.png
│   │   ├── chain.png
│   │   ├── plate.png
│   │   └── dragon.png
│   └── amulets/ (4 files, 32×32)
│       ├── health.png
│       ├── mana.png
│       ├── speed.png
│       └── strength.png
│
└── ui/ (10 sprites)
    ├── health.png
    ├── mana.png
    ├── speed.png
    ├── strength.png
    ├── inventory.png
    ├── equipment.png
    ├── map.png
    ├── quest.png
    ├── settings.png
    └── close.png
```

---

## ✅ Generation Report

### Statistics
- **Player Sprites:** 144 (6 animations × 4 directions × varied frames)
- **Enemy Sprites:** 64 (4 types × 4 directions × 4 frames)
- **Equipment Sprites:** 21 (4 bows + 5 arrows + 4 armor + 4 helms + 4 amulets)
- **UI Icons:** 10 (stat icons + menu icons)
- **Total Generated:** 239 sprites
- **Failed:** 0
- **Success Rate:** 100%

### Generation Scripts
- `scripts/generate_pixel_art.py` — Base character & UI sprites
- `scripts/generate_advanced_sprites.py` — Equipment & advanced sprites

### Quality Assurance
✅ All sprites verified as valid PNG files  
✅ Correct dimensions (32×32 and 48×48)  
✅ Alpha transparency preserved  
✅ Consistent pixel art style  
✅ 16-color palettes applied  
✅ File naming convention followed  
✅ No missing frames  

---

## 🎯 Asset Categories by Use Case

### Combat System
- `player/attack_*.png` — Attack animation
- `player/hit_*.png` — Damage feedback
- `player/death_*.png` — Defeat animation

### Movement & Navigation
- `player/idle_*.png` — Idle stance
- `player/walk_*.png` — Movement animation
- `enemies/*/idle_*.png` — Enemy behavior

### Equipment Management
- `equipment/bows/*.png` — Weapon selection
- `equipment/armor/*.png` — Defense gear
- `equipment/amulets/*.png` — Stat bonuses

### UI & HUD
- `ui/health.png` — HP indicator
- `ui/mana.png` — Resource bar
- `ui/stats/*.png` — Stat display
- `ui/menu/*.png` — Interface buttons

---

## 📝 Notes

- All sprites use **crisp pixel art** (no anti-aliasing)
- **Transparency:** All sprites include alpha channel for proper layering
- **Performance:** Minimal file sizes (160-300 bytes each) for efficient loading
- **Scalability:** Pixel art scales cleanly at 2x, 3x, 4x multiples
- **Customization:** Palettes can be easily adjusted in generation scripts

---

## 🔄 Future Enhancement Opportunities

1. **Additional Enemy Types:** Scout, Swarmer, Tank, Guardian
2. **Extended Animations:** Run, dodge, special attack animations
3. **Boss Sprites:** Larger variants with unique animations
4. **Visual Effects:** Spell animations, projectile trails
5. **Alternative Skins:** Different character costumes/outfits
6. **Particle Effects:** Death explosions, spell impacts
7. **Environmental Sprites:** NPCs, objects, decorations

---

**Generated by:** Armored Archer Pixel Art Generator v1.0  
**License:** Project assets — use as specified in project LICENSE  
**Last Updated:** 2026-03-26
