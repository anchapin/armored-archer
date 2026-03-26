# Feature Landscape: Pixel Art Sprites

**Domain:** 2D Game Sprites (Godot 4.x)
**Project:** Armored Archer v3.2.0 - Pixel Art Sprites
**Researched:** 2026-03-24
**Context:** Adding pixel art sprites to replace Godot placeholder textures

---

## Executive Summary

The v3.2.0 milestone focuses on replacing existing placeholder textures with pixel art sprites. This requires configuring Godot's import pipeline, setting project-level pixel-perfect rendering, and creating AnimatedSprite2D-based character animations.

Key findings:
- **Import settings are critical** — Nearest filter, Lossless compression, no mipmaps
- **Project configuration is foundational** — Integer scale mode, canvas_items stretch
- **Animation uses AnimatedSprite2D** — SpriteFrames resource holds animations
- **State-driven animation is the target** — Connect GameManager states to sprite playback

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

### 1. Sprite Import Pipeline

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Nearest neighbor filtering | Prevents blur when scaling pixel art | Low | Set via Import dock or Project Settings |
| Lossless compression | Preserves crisp pixel edges | Low | Use "Lossless" or "Uncompressed" compression |
| Hframes/Vframes | Grid-based sprite sheet slicing | Low | Set on Sprite2D to slice sheets into frames |
| SpriteFrames resource | Animation container for AnimatedSprite2D | Low | Editor-built or script-generated |
| Mipmaps disabled | Prevents unwanted smoothing at distance | Low | Default for pixel art |
| Repeat disabled | Prevents tiling artifacts on single sprites | Low | Enable only for tileable textures |

**Implementation:** Each sprite PNG requires import settings:
```
Filter: Nearest (not Linear)
Compression: Lossless
Mipmaps: Off
Repeat: Disabled
Preset: 2D (or 2D Pixel for cleaner defaults)
```

### 2. Project Configuration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Default Texture Filter: Nearest | Global crisp rendering | Low | Project Settings → Rendering → Textures |
| Integer Scale Mode | Prevents subpixel artifacts | Low | Project Settings → Display → Window → Scale Mode = integer |
| Stretch Mode: canvas_items | Proper 2D scaling | Low | Recommended for pixel art |
| Viewport Resolution | Base render resolution | Medium | 320×180 or 640×360 typical for pixel art |

**Project Settings Required:**
```
Rendering > Textures > Canvas Textures > Default Texture Filter = Nearest
Display > Window > Stretch > Mode = canvas_items
Display > Window > Stretch > Scale Mode = integer
Display > Window > Size > Viewport Width/Height = 320×180 or 640×360
```

### 3. Animation System

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| AnimatedSprite2D | Primary animation node | Low | Supports multiple named animations |
| Animation playback control | Play/stop/pause via code | Low | `play("animation_name")`, `stop()` |
| Sprite sheet slicing | Import entire sheet at once | Low | "Add frames from a Sprite Sheet" in SpriteFrames |
| Frame-by-frame control | Manual frame selection | Low | `frame` property or `set_frame_and_progress()` |

### 4. Basic Sprite Types

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sprite2D | Static images | Low | For icons, tiles, backgrounds |
| AnimatedSprite2D | Animated characters | Low | Uses SpriteFrames resource |
| AtlasTexture | Optimized sprite sheets | Medium | Single texture + region definitions |

---

## Differentiators

Features that set product apart. Not expected, but valued.

### 1. Animation State Machine

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| State-driven animation | Smooth transitions between idle/walk/attack | Medium | Requires script to map game states to animations |
| Animation blending | Smooth transitions without snapping | High | Godot 4.2+ AnimationTree node |
| Directional animations | 4-8 way facing directions | Medium | Critical for top-down archer gameplay |

**Recommendation for Armored Archer:** Implement state-driven animation connecting GameManager states to AnimatedSprite2D playback. 8-directional needed for top-down archer (4 cardinal + 4 diagonal).

### 2. Pixel-Perfect Rendering Pipeline

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| GPU-based pixel snap | Eliminates subpixel jitter | Low | Project Setting: Rendering > 2D > Snap > Snap 2D Transforms to Pixel |
| Shader-based pixelation | Render at high-res, pixelate output | High | For retro CRT effects |
| Color palette management | Consistent color usage across sprites | Medium | Tools: Aseprite, Palette helper scripts |

### 3. Sprite Atlas Optimization

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Texture atlases | Reduced draw calls | Medium | ResourceImporterTextureAtlas or manual AtlasTextures |
| Packed scenes | Scene as single unit | Medium | For complex enemies with multiple sprites |
| Runtime sprite swapping | Load different skins/variants | Medium | Transmog system support |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Skeletal/Bone animation | Overhead for simple pixel art | Frame-by-frame spritesheets |
| High-res textures (1024+) | Wastes memory for pixel art | 16×16 to 64×64 per character typical |
| VRAM compression | Causes artifacts on pixel art | Use Lossless/Uncompressed |
| Linear filtering | Blurs pixel edges | Always use Nearest |

---

## Feature Dependencies

```
Sprite Import Settings
    ↓
Project Configuration (Nearest Filter, Integer Scale)
    ↓
AnimatedSprite2D + SpriteFrames
    ↓
Animation Playback (via code)
    ↓
State-Driven Animation System (optional, for polish)
```

---

## Sprite Requirements for Armored Archer

Based on PROJECT.md milestone goals:

| Category | Sprites Needed | Animation Frames Est. |
|----------|----------------|----------------------|
| Player | idle, walk, attack, bow_draw, hit, death | 4-8 frames each |
| Enemy - Melee | idle, walk, attack, hit, death | 4-8 frames each |
| Enemy - Ranged | idle, walk, aim, fire, hit, death | 4-8 frames each |
| Enemy - Boss | idle, walk, attack1, attack2, hit, death | 6-12 frames each |
| Weapons - Bow | idle, draw, fire | 3-6 frames |
| Weapons - Arrow | flight, impact | 2-4 frames |
| Armor/Helm | static variants | 1 frame each, multiple rarities |
| UI Icons | buttons, inventory, HUD | 1 frame each |
| Background Tiles | ground, walls, props | 1 frame each, tileable |

---

## MVP Recommendation

Prioritize:
1. **Project Settings** — Configure Nearest filter + integer scaling first (foundational)
2. **Player Sprite** — Core gameplay visibility, includes idle/walk/attack
3. **One Enemy Type** — Combat testing, melee or ranged
4. **Basic UI Icons** — Inventory, HUD elements visible in gameplay
5. **Background Tiles** — Test level rendering

Defer:
- **Animation blending/transitions** — Nice to have, not MVP
- **8-directional animation** — Can use 4-directional initially
- **Sprite atlas optimization** — After all sprites complete
- **Transmog skin system** — Separate feature, not sprite replacement

---

## Complexity Notes

| Area | Complexity | Reason |
|------|------------|--------|
| Import setup | Low | One-time project settings |
| AnimatedSprite2D | Low | Built-in Godot node |
| State machine | Medium | Requires script coordination |
| Atlas optimization | Medium | Requires planning sprite layout |
| Directional animations (8-way) | Medium | 8× animations per character |

---

## Sources

### HIGH Confidence (Official Documentation)

- **Godot 4.4 Documentation: 2D Sprite Animation** (https://docs.godotengine.org/en/4.4/tutorials/2d/2d_sprite_animation.html)
  - AnimatedSprite2D, SpriteFrames, sprite sheet handling
  - HIGH confidence: Official engine documentation

- **Godot 4.4 Documentation: Importing Images** (https://docs.godotengine.org/en/4.4/tutorials/assets_pipeline/importing_images.html)
  - Compression modes, mipmaps, filtering options
  - HIGH confidence: Official engine documentation

- **Godot 4.4 Documentation: Multiple Resolutions** (https://docs.godotengine.org/en/4.4/tutorials/rendering/multiple_resolutions.html)
  - Viewport settings, stretch modes, integer scaling
  - HIGH confidence: Official engine documentation

### MEDIUM Confidence (Community Patterns)

- **GDQuest: Setting up pixel art graphics in Godot 4** (https://www.gdquest.com/library/pixel_art_setup_godot4/)
  - Pixel-perfect setup guide
  - MEDIUM confidence: Established Godot tutorial resource

- **SpriteCook.ai: Godot Sprite Import Guide** (https://www.spritecook.ai/godot-sprites)
  - Import workflow, preset recommendations
  - MEDIUM confidence: Developer tool documentation

- **itch.io: Godot 4.4 Settings for Pixel Art** (2024-09)
  - Specific settings for viewport, stretch, scaling
  - MEDIUM confidence: Community blog

### LOW Confidence (Web Search - Unverified)

- Specific export settings from sprite creation tools (Aseprite, Piskel)
- Performance benchmarks for atlas vs. individual textures

---

*Feature research for: Armored Archer v3.2.0 Pixel Art Sprites*
*Researched: 2026-03-24*
*Confidence: HIGH*
