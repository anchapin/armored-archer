# Stack Research: Pixel Art Sprites

**Domain:** 2D pixel art sprite creation and integration
**Project:** Armored Archer v3.2.0 Pixel Art Sprites
**Researched:** 2026-03-24
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

**Godot 4.x has ALL native sprite capabilities required.** No external libraries needed.

| Technology | Version | Purpose | Why Recommended |
|-----------|---------|---------|-----------------|
| **AnimatedSprite2D** | Godot 4.x | Character animation | SpriteFrames resource for frame-based animation, supports individual PNGs or sprite sheets |
| **Sprite2D** | Godot 4.x | Static sprites | Weapons, armor icons, UI elements |
| **AtlasTexture** | Godot 4.x | Sprite sheet slicing | Extract individual frames from packed sheets for efficient rendering |
| **SpriteFrames** | Godot 4.x | Animation library | Organize multiple animations (idle, walk, attack) per character |
| **TextureFilter: Nearest** | Godot 4.x | Pixel-perfect scaling | CRITICAL: Prevents blur on scaled sprites |
| **Viewport Stretch Mode** | Godot 4.x | Resolution scaling | Ensures integer scaling for crisp pixels |
| **Lossless Compression** | Godot 4.x | Texture import | Prevents artifacting on pixel art |

### Pixel Art Creation Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **Aseprite** ($19.99) | Professional pixel art | Full animation workflow, sprite sheets, tilemaps. Industry standard. |
| **Pixelorama** (Free) | Open-source alternative | Same engine as Godot, excellent sprite sheet export, tilemap support |
| **Godot built-in** | Sprite editing | Quick tweaks, basic sprite sheet slicing via Import dock |

**Recommendation:** Aseprite for professional work; Pixelorama for budget-conscious or open-source preference. Both export to formats Godot handles natively.

### Project Settings Required

**Current project.godot needs updates for pixel art:**

| Setting | Current | Required | Why |
|---------|---------|----------|-----|
| `textures/default_texture_filter` | 1 (Linear) | 0 (Nearest) | CRITICAL: Keeps pixels sharp when scaled |
| `window/stretch/mode` | Not set | "viewport" | Renders at base res, scales viewport |
| `window/stretch/aspect` | Not set | "keep" | Maintains aspect ratio with letterboxing |

```ini
# Add to project.godot for pixel art
[rendering]
textures/default_texture_filter=0

[display]
window/stretch/mode="viewport"
window/stretch/aspect="keep"
window/stretch_scale_mode="integer"  # Godot 4.3+ only
```

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **None required** | - | - | All sprite features built into Godot 4.x |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Linear texture filter** | Blurs pixel art | Set to Nearest (0) in project settings |
| **VRAM compression** | Artifacts on small sprites | Use Lossless or Uncompressed |
| **Mipmaps** | Unnecessary for pixel art | Disable in import settings |
| **Non-integer scaling** | Uneven pixels | Use viewport mode with integer scaling |
| **canvas_items stretch mode** | Filters individual sprites | Use viewport mode for full-game scaling |

## Integration Patterns

### Sprite Import Settings

Each PNG imported needs these settings in the Import dock:

```
Preset: 2D
Repeat: Disabled
Filter: Nearest (off)
Mipmaps: Off
Compression: Lossless or Uncompressed
```

### Character Animation Setup

```gdscript
# CharacterSprite.gd - Using AnimatedSprite2D
extends CharacterBody2D

@onready var _sprite: AnimatedSprite2D = $AnimatedSprite2D

func _ready() -> void:
    # Configure sprite frames (done in editor, shown here for reference)
    _sprite.sprite_frames = _load_sprite_frames()
    _sprite.play("idle")

func _process(delta: float) -> void:
    var velocity := velocity.normalized()
    if velocity.length() > 0.1:
        _sprite.play("walk")
        _sprite.flip_h = velocity.x < 0
    else:
        _sprite.play("idle")

func attack() -> void:
    _sprite.play("attack")
    await _sprite.animation_finished
    _sprite.play("idle")
```

### Sprite Sheet Workflow

1. **Create in Aseprite/Pixelorama** at target resolution (e.g., 32x32 per frame)
2. **Export as PNG sprite sheet** with 1px padding between frames
3. **Import to Godot** with Nearest filter
4. **Slice in editor:** Select sprite sheet → Import dock → Slice → Grid mode
5. **Create SpriteFrames:** Add frames from sprite sheet to animations

### AtlasTexture for Efficient Rendering

```gdscript
# Using AtlasTexture for sprite sheet frames (more efficient)
var sprite_sheet := preload("res://assets/characters/player_sheet.png")

func get_frame_atlas(frame_rect: Rect2) -> AtlasTexture:
    var atlas := AtlasTexture.new()
    atlas.atlas = sprite_sheet
    atlas.region = frame_rect
    return atlas
```

### Replacing Existing Placeholders

**Strategy:** Replace ColorRect/placeholder sprites with AnimatedSprite2D nodes:

1. Identify placeholder nodes in existing scenes
2. Create new sprite scenes with proper animations
3. Swap nodes, preserving script references
4. Update collision shapes to match new sprite bounds
5. Test animation state machines

## Asset Requirements

### Resolution Guidelines

| Asset Type | Recommended Size | Notes |
|------------|------------------|-------|
| Player character | 32x32 to 64x64 | At 1080p, 32px character = ~3% screen height |
| Enemies (small) | 16x16 to 32x32 | |
| Enemies (boss) | 64x64 to 128x128 | |
| Weapons (bow) | 32x64 to 64x128 | |
| Arrows | 8x8 to 16x16 | |
| UI icons | 32x32 to 64x64 | |
| Tile/background | 16x16 to 32x32 | Tilemap compatible |

### Animation Frame Guidelines

| Animation | Frame Count | FPS |
|-----------|-------------|-----|
| Idle | 4-8 | 4-8 |
| Walk | 6-8 | 8-12 |
| Attack (bow draw) | 4-6 | 12-15 |
| Attack (release) | 2-4 | 15-20 |
| Hit/stun | 2-4 | 8-10 |
| Death | 6-12 | 8-12 |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Godot 4.4+ | All features | Project uses 4.6 |
| Godot 4.3+ | Integer scaling | stretch_scale_mode setting |
| Aseprite 1.3+ | Export to PNG/sprite sheets | Current |
| Pixelorama 1.0+ | Export to PNG/sprite sheets | Godot-based, excellent integration |

## Sources

- [Godot 4.5 Docs: 2D Sprite Animation](https://docs.godotengine.org/en/4.5/tutorials/2d/2d_sprite_animation.html) — AnimatedSprite2D, SpriteFrames — HIGH confidence
- [GDQuest: Pixel Art Setup Godot 4](https://www.gdquest.com/library/pixel_art_setup_godot4/) — Texture filtering, viewport scaling — HIGH confidence
- [Bugnet: Fix Blurry Godot 2D Sprites](https://bugnet.io/blog/fix-godot-2d-sprites-blurry-when-scaled) — Nearest neighbor filtering — HIGH confidence
- [I Love Sprites: Pixel Art Sprite Sheets](https://ilovesprites.com/blog/pixel-art-sprite-sheets-scale-padding) — Padding, bleed prevention — HIGH confidence
- [SpriteCook: Godot Sprite Import Guide](https://www.spritecook.ai/godot-sprites) — Import workflow — MEDIUM confidence
- [Toxigon: Pixel Art Godot Tutorial](https://toxigon.com/how-to-create-pixel-art-for-your-godot-game) — Tool recommendations — MEDIUM confidence

---

*Stack research for: Pixel art sprites implementation (v3.2.0)*
*Researched: 2026-03-24*
