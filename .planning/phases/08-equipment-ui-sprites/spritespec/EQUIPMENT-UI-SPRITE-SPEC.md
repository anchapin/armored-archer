# Phase 08: Equipment & UI Sprite Specification

## Overview

This document defines the pixel art specifications for equipment items (bows, arrows, armor, helms) and UI elements (icons, backgrounds, buttons).

---

## 1. General Specifications

| Property | Value |
|----------|-------|
| **Canvas Size** | 32x32 (icons), 64x64 (equipment), 128x128 (backgrounds) |
| **Pixel Scale** | 1:1 (no scaling) |
| **Color Palette** | 16-color max (indexed) |
| **File Format** | PNG with transparency |

---

## 2. Equipment Sprites

### 2.1 Bows

#### 2.1.1 Wooden Bow (Common)
- **Size:** 48x48
- **Rarity:** Common
- **States:** idle, draw, fire (3 sprites)

**Visual Design:**
- Simple curved wooden bow
- Center grip wrapped
- Bowstring natural color
- No decoration

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Wood Light | #C4A065 |
| 1 | Wood Mid | #8B6914 |
| 2 | Wood Dark | #5C4510 |
| 3 | Grip | #5C3D1E |
| 4 | String | #E8E0D0 |
| 5 | Outline | #2A1A05 |

---

#### 2.1.2 Composite Bow (Rare)
- **Size:** 48x48
- **Rarity:** Rare
- **States:** idle, draw, fire (3 sprites)

**Visual Design:**
- Layered construction (wood + bone/horn)
- Decorative wrapping
- Curved tips
- Reinforced grip

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Wood | #A67C52 |
| 1 | Bone | #E8E0D0 |
| 2 | Wrapping | #882222 |
| 3 | Metal | #888890 |
| 4 | String | #F5F5DC |
| 5 | Outline | #2A1A05 |

---

#### 2.1.3 Elven Bow (Epic)
- **Size:** 48x48
- **Rarity:** Epic
- **States:** idle, draw, fire (3 sprites)

**Visual Design:**
- Elegant curved shape
- Leaf motifs
- Glowing accents
- Magical appearance

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Wood | #4A7C3A |
| 1 | Wood Dark | #2A5030 |
| 2 | Gold Accent | #FFD700 |
| 3 | Glow | #44FF44 |
| 4 | Leaves | #6B9B4A |
| 5 | Outline | #1A2A10 |

---

#### 2.1.4 Dragon Bow (Legendary)
- **Size:** 48x48
- **Rarity:** Legendary
- **States:** idle, draw, fire (3 sprites)

**Visual Design:**
- Dragon motif
- Scale texture on limbs
- Ruby/gem in center
- Fiery glow effect

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Scale Light | #882222 |
| 1 | Scale Dark | #551111 |
| 2 | Gold | #FFD700 |
| 3 | Ruby | #FF2222 |
| 4 | Flame | #FF660040 |
| 5 | Outline | #220808 |

---

### 2.2 Arrows

#### 2.2.1 Wooden Arrow (Common)
- **Size:** 32x8 (horizontal) or 8x32 (vertical)
- **Rarity:** Common
- **States:** normal, equipped (2 sprites)

**Visual Design:**
- Simple wooden shaft
- Feather fletching (brown)
- Pointed tip

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Shaft | #C4A065 |
| 1 | Fletching | #8B6914 |
| 2 | Tip | #707070 |
| 3 | Outline | #2A1A05 |

---

#### 2.2.2 Iron Arrow (Rare)
- **Size:** 32x8
- **Rarity:** Rare
- **States:** normal, equipped (2 sprites)

**Visual Design:**
- Metal shaft
- Steel tip
- Red fletching

---

#### 2.2.3 Dragon Arrow (Legendary)
- **Size:** 32x8
- **Rarity:** Legendary
- **States:** normal, equipped (2 sprites)

**Visual Design:**
- Flaming tip
- Scale-pattern shaft
- Fire trail effect

---

### 2.3 Armor

#### 2.3.1 Leather Armor (Common)
- **Size:** 48x48
- **Slot:** chest
- **Rarity:** Common

**Visual Design:**
- Simple leather tunic
- Buckled straps
- No metal elements

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Leather | #8B5A2B |
| 1 | Leather Dark | #5C3D1E |
| 2 | Strap | #4A3020 |
| 3 | Buckle | #888890 |
| 4 | Stitching | #5C3D1E |
| 5 | Outline | #2A1508 |

---

#### 2.3.2 Chainmail (Rare)
- **Size:** 48x48
- **Slot:** chest
- **Rarity:** Rare

**Visual Design:**
- Metal ring pattern
- Shoulder guards
- Leather underlayer

---

#### 2.3.3 Plate Armor (Epic)
- **Size:** 48x48
- **Slot:** chest
- **Rarity:** Epic

**Visual Design:**
- Full plate coverage
- Emissive core/gem
- Gold trim
- Helmet included

---

#### 2.3.4 Dragon Scale Armor (Legendary)
- **Size:** 48x48
- **Slot:** chest
- **Rarity:** Legendary

**Visual Design:**
- Scale pattern
- Wing-like shoulder pieces
- Fiery glow accents

---

### 2.4 Helmets

#### 2.4.1 Leather Cap (Common)
- **Size:** 32x32
- **Slot:** head
- **Rarity:** Common

**Visual Design:**
- Simple leather cap
- Chin strap
- Soft shape

---

#### 2.4.2 Iron Helm (Rare)
- **Size:** 32x32
- **Slot:** head
- **Rarity:** Rare

**Visual Design:**
- Full face coverage
- Eye slits
- Nasal guard

---

#### 2.4.3 Dragon Helm (Legendary)
- **Size:** 32x32
- **Slot:** head
- **Rarity:** Legendary

**Visual Design:**
- Dragon face design
- Horns
- Glowing eyes

---

### 2.5 Amulets (Slot: amulet)

| Name | Rarity | Size | Description |
|------|--------|------|-------------|
| Simple Amulet | Common | 16x16 | Basic pendant |
| Ruby Amulet | Rare | 16x16 | Red gem |
| Sapphire Amulet | Epic | 16x16 | Blue gem with glow |
| Dragon Amulet | Legendary | 16x16 | Fire effects |

---

## 3. UI Sprites

### 3.1 HUD Elements

#### 3.1.1 Health Bar
- **Size:** 120x16 (full bar), 16x16 (icon)
- **States:** full, half, low, empty

**Visual Design:**
- Potion bottle shape icon
- Red liquid fill
- Glass reflection
- Outline

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Glass | #88CCFF |
| 1 | Liquid Full | #FF4444 |
| 2 | Liquid Half | #FF8844 |
| 3 | Liquid Low | #444444 |
| 4 | Outline | #1A1A1A |

---

#### 3.1.2 Arrow Count
- **Size:** 16x16 (icon)
- **States:** normal, low (warning at <5)

**Visual Design:**
- Arrow bundle icon
- Feather detail
- Number display nearby

---

#### 3.1.3 Ability Icons
- **Size:** 32x32 each
- **Abilities:** Dodge Roll, Special Arrow, Ultimate

**Design Guidelines:**
- Clear, readable at small sizes
- Distinct silhouettes
- Cooldown overlay (grayscale + timer)

---

### 3.2 Menu Buttons

#### 3.2.1 Main Menu Buttons
- **Size:** 160x48 (standard button)
- **States:** normal, hover, pressed, disabled

**Visual Design:**
- Rounded rectangle
- Icon + text
- Tactile/pressed appearance
- Glow on hover

**Color Palette (Gilded Quest Theme):**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Background | #3D5A80 |
| 1 | Background Hover | #4A6B91 |
| 2 | Background Pressed | #2D4A70 |
| 3 | Text | #FDFFDA |
| 4 | Border | #0060CE |
| 5 | Glow | #FFD70040 |

---

#### 3.2.2 Back Button
- **Size:** 48x48
- **States:** normal, hover, pressed

**Visual Design:**
- Arrow pointing left
- Circular background

---

### 3.3 Inventory Icons

#### 3.3.1 Equipment Slots
- **Size:** 48x48 each
- **Slots:** Helm, Armor, Bow, Arrow, Amulet
- **States:** empty, filled, selected

**Visual Design:**
- Square with rounded corners
- Slot type icon in center (when empty)
- Border highlights when selected
- Item icon when filled

---

#### 3.3.2 Item Rarity Border Colors
| Rarity | Border Color |
|--------|--------------|
| Common | #888888 |
| Rare | #4488FF |
| Epic | #AA44FF |
| Legendary | #FFD700 |

---

### 3.4 Icons (Store, etc.)

#### 3.4.1 Store Icons
- **Size:** 32x32 each
- **Items:** Coins, Gems, Shop, Settings

**Visual Design:**
- Simple, readable silhouettes
- Consistent style with HUD

---

#### 3.4.2 Navigation Icons
- **Size:** 32x32 each
- **Items:** Home, Profile, Friends, Leaderboard

---

## 4. Background Sprites

### 4.1 Main Menu Background

#### 4.1.1 Main Menu Tileset
- **Tile Size:** 128x128
- **Format:** Tilesheet (3x3 = 384x384)

**Visual Design:**
- Castle/castle interior
- Stone floor tiles
- Torchlight areas
- Banner decorations

**Color Palette:**
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Stone Light | #888880 |
| 1 | Stone Mid | #686860 |
| 2 | Stone Dark | #484840 |
| 3 | Torch Glow | #FF8844 |
| 4 | Banner | #882222 |
| 5 | Shadow | #222220 |

---

### 4.2 Gameplay Arena Background

#### 4.2.1 Arena Tileset
- **Tile Size:** 64x64
- **Format:** Tilesheet

**Visual Design:**
- Stone/dungeon floor
- Wall edges
- Pillar tiles
- Hazard tiles

---

### 4.3 Forest Background

#### 4.3.1 Forest Tileset
- **Tile Size:** 64x64
- **Format:** Tilesheet

**Visual Design:**
- Grass tiles
- Tree silhouettes
- Path tiles
- Flower patches

---

### 4.4 Environment Props

| Prop | Size | Description |
|------|------|-------------|
| Tree | 64x96 | Large tree silhouette |
| Rock | 48x32 | Boulder |
| Pillar | 32x64 | Stone pillar |
| Torch | 16x32 | Wall torch |
| Chest | 32x32 | Treasure chest |

---

## 5. Equipment Summary Table

### 5.1 Bows (4 types)

| Name | Rarity | Sprites | Total Files |
|------|--------|---------|--------------|
| Wooden Bow | Common | 3 | 3 |
| Composite Bow | Rare | 3 | 3 |
| Elven Bow | Epic | 3 | 3 |
| Dragon Bow | Legendary | 3 | 3 |

### 5.2 Arrows (4 types)

| Name | Rarity | Sprites | Total Files |
|------|--------|---------|--------------|
| Wooden Arrow | Common | 2 | 2 |
| Iron Arrow | Rare | 2 | 2 |
| Dragon Arrow | Legendary | 2 | 2 |

### 5.3 Armor (4 types)

| Name | Rarity | Sprites | Total Files |
|------|--------|---------|--------------|
| Leather Armor | Common | 1 | 1 |
| Chainmail | Rare | 1 | 1 |
| Plate Armor | Epic | 1 | 1 |
| Dragon Scale | Legendary | 1 | 1 |

### 5.4 Helmets (3 types)

| Name | Rarity | Sprites | Total Files |
|------|--------|---------|--------------|
| Leather Cap | Common | 1 | 1 |
| Iron Helm | Rare | 1 | 1 |
| Dragon Helm | Legendary | 1 | 1 |

### 5.5 Amulets (4 types)

| Name | Rarity | Size | Total Files |
|------|--------|------|-------------|
| Simple Amulet | Common | 1 | 1 |
| Ruby Amulet | Rare | 1 | 1 |
| Sapphire Amulet | Epic | 1 | 1 |
| Dragon Amulet | Legendary | 1 | 1 |

---

## 6. UI Summary Table

### 6.1 HUD Elements
| Element | Size | States | Total Files |
|---------|------|--------|-------------|
| Health Bar Icon | 16x16 | 4 | 4 |
| Arrow Count | 16x16 | 2 | 2 |
| Ability Icons | 32x32 | 3+cooldown | 9 |
| Minimap | 128x128 | 1 | 1 |

### 6.2 Buttons
| Button Type | Size | States | Total Files |
|-------------|------|--------|-------------|
| Menu Button | 160x48 | 4 | 4 |
| Back Button | 48x48 | 3 | 3 |
| Icon Button | 32x32 | 3 | 3 |

### 6.3 Inventory
| Element | Size | States | Total Files |
|---------|------|--------|-------------|
| Equipment Slot | 48x48 | 3 | 5 (5 slots) |
| Item Icon | 32x32 | 1 | per item |
| Rarity Border | 48x48 | 4 | 4 |

### 6.4 Backgrounds
| Background | Tile Size | Tiles | Total |
|------------|-----------|-------|-------|
| Main Menu | 128x128 | 9 | 9 |
| Arena | 64x64 | 16 | 16 |
| Forest | 64x64 | 16 | 16 |
| Props | various | 5 | 5 |

---

## 7. Sprite Naming Convention

### Equipment
```
{type}_{name}_{state}.png
```

**Examples:**
- `bow_wooden_idle.png`
- `arrow_iron_equipped.png`
- `armor_leather.png`
- `helm_iron.png`

### UI
```
{ui_type}_{name}_{state}.png
```

**Examples:**
- `button_play_normal.png`
- `icon_health_full.png`
- `slot_armor_empty.png`
- `rarity_legendary.png`

### Backgrounds
```
background_{name}_{position}.png
```

**Examples:**
- `background_mainmenu_0_0.png`
- `background_arena_floor.png`
- `prop_tree_0.png`

---

## 8. Deliverables Checklist

### Equipment
- [ ] 4 bow sprites (all rarities)
- [ ] 4 arrow sprites (all rarities)
- [ ] 4 armor sprites (all rarities)
- [ ] 3 helmet sprites (all rarities)
- [ ] 4 amulet sprites (all rarities)

### UI
- [ ] HUD icons (health, arrows, abilities)
- [ ] Button states (normal, hover, pressed, disabled)
- [ ] Inventory slots (5 equipment + inventory grid)
- [ ] Rarity borders (4 colors)
- [ ] Store icons

### Backgrounds
- [ ] Main menu tileset (9 tiles)
- [ ] Arena tileset (16 tiles)
- [ ] Forest tileset (16 tiles)
- [ ] Environment props (5+ types)

---

## 9. File Output Location

```
assets/sprites/equipment/
├── bow/
│   ├── bow_wooden_idle.png
│   ├── bow_composite_idle.png
│   ├── bow_elven_idle.png
│   └── bow_dragon_idle.png
├── arrow/
│   ├── arrow_wooden.png
│   ├── arrow_iron.png
│   └── arrow_dragon.png
├── armor/
│   ├── armor_leather.png
│   ├── armor_chain.png
│   ├── armor_plate.png
│   └── armor_dragon.png
├── helm/
│   ├── helm_leather.png
│   ├── helm_iron.png
│   └── helm_dragon.png
├── amulet/
│   ├── amulet_simple.png
│   ├── amulet_ruby.png
│   ├── amulet_sapphire.png
│   └── amulet_dragon.png
└── equipment_sprites.tres

assets/sprites/ui/
├── buttons/
│   ├── button_play_*.png
│   └── button_back_*.png
├── icons/
│   ├── icon_health_*.png
│   ├── icon_arrow_*.png
│   └── icon_ability_*.png
├── slots/
│   ├── slot_*.png
│   └── rarity_*.png
└── ui_sprites.tres

assets/sprites/backgrounds/
├── mainmenu/
│   ├── mainmenu_tileset.png
│   └── mainmenu_props.png
├── arena/
│   └── arena_tileset.png
├── forest/
│   └── forest_tileset.png
└── props/
    ├── prop_tree.png
    ├── prop_rock.png
    └── prop_*.png
```

---

## 10. Technical Requirements

### Import Settings (Godot)
- **Import Mode:** Lossless for equipment, VRAM for backgrounds
- **Filter:** Nearest (never Linear)
- **Mipmaps:** Disabled
- **Repeat:** Enabled for tilesets
- **HDR:** Disabled

### Rarity Color Reference
```
Common:    #888888 (gray)
Rare:      #4488FF (blue)
Epic:      #AA44FF (purple)
Legendary: #FFD700 (gold)
```

---

*Specification Version: 1.0*
*Last Updated: 2026-03-24*