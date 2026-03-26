# Kenney Sprite Setup Guide

## Overview
This guide helps you integrate the downloaded Kenney sprites into the project.

## Step 1: Import Sprites in Godot

1. Open the project in Godot
2. The Kenney PNGs should auto-import (they're in `res://assets/sprites/kenney/`)
3. If not, right-click on the `kenney` folder and select "Import"

## Step 2: Configure Import Settings

For each sprite folder, ensure these import settings:

| Setting | Value |
|---------|-------|
| Filter | Nearest (never Linear!) |
| Compress | Lossless (or VRAM Compressed) |
| Mipmaps | Disabled |
| Repeat | Disabled |

**To batch-change:** Select multiple files, right-click → Import → Configure → Apply to selected

## Step 3: Update Player Sprites

### Option A: Quick Scale (Recommended for 16x16 sprites)

**Already implemented in code:**
- `character_body_2d.gd` - Player sprites scale = Vector2(2,2)
- `base_enemy.gd` - Enemy sprites scale = Vector2(2,2)

No manual setup needed - sprites will automatically scale up when game runs!

### Option B: Replace Texture References

1. Open `res://assets/sprites/player/player_sprites.tres`
2. For each animation frame, click the texture and browse to `res://assets/sprites/kenney/players/`
3. Select the matching PNG file

## Step 4: Map Sprites to Animations

### Player Animations (from Kenney players/)
| Animation | Kenney File | Notes |
|-----------|-------------|-------|
| idle_down | tile_0000.png | Static pose |
| walk_down | tile_0004.png | Walking frame |
| attack | tile_0008.png | Firing arrow |
| etc. | ... | Map all 4 directions |

### Enemy Animations (from Kenney enemies/)
| Enemy Type | Kenney File | Notes |
|------------|------------|-------|
| Goblin | roguelikeChar_*.png | Look for green sprites |
| Skeleton | roguelikeChar_*.png | Look for white/bone sprites |
| Orc | roguelikeChar_*.png | Look for large green sprites |

### Weapon Sprites (from Kenney weapons/)
| Weapon | Kenney File | Notes |
|--------|------------|-------|
| Bow | tile_0000.png | Basic bow |
| Arrow | tile_0008.png | Arrow sprite |
| Crossbow | tile_0016.png | Optional |

## Step 5: Test in Editor

1. Run the game (F5)
2. Check that player sprite appears and animates
3. Verify scale looks good on your target device size

## Common Issues

### Sprites look blurry
→ Import filter is set to "Linear" instead of "Nearest"

### Sprites too small
→ Set scale = Vector2(2, 2) on AnimatedSprite2D

### Animation not playing
→ Check SpriteFrames animation names match code references
→ Verify FPS settings in SpriteFrames

### Wrong colors (magenta background)
→ Use `roguelikeChar_transparent.png` not the magenta version

---

*Created: 2026-03-24*
*For: Armored Archer v3.2.0 Pixel Art*