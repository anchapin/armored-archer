# Phase 05: Project Settings & Import Pipeline - Research

**Researched:** 2026-03-24
**Domain:** Godot 4.x pixel-perfect rendering configuration
**Confidence:** HIGH

## Summary

This phase configures Godot project settings for pixel-perfect rendering and establishes the import pipeline for sprite assets. The project already has `textures/default_texture_filter=1` (Nearest) set correctly in `project.godot`. Key work remaining: configure viewport stretch mode, set up import presets for pixel art, and verify/organize folder structure.

**Primary recommendation:** Add viewport stretch settings (`canvas_items` mode with `integer` scale mode) and create pixel art import presets. Current assets folder structure already has most directories in place.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROJ-01 | Configure project.godot with Nearest texture filter (not Linear) | Already set - `textures/default_texture_filter=1` |
| PROJ-02 | Set viewport stretch mode to canvas_items with integer scaling | Need to add stretch settings in project.godot |
| PROJ-03 | Create import presets for pixel art (Lossless compression, no mipmaps) | Need to create .import presets or configure manually |
| PROJ-04 | Set up folder structure for sprites (characters/, enemies/, equipment/, ui/, backgrounds/) | Most exist, verify/add missing |

## User Constraints

This is a Godot pixel art project. Focus on:
- Godot 4.x project settings for pixel-perfect rendering
- Texture import pipeline configuration
- 2D render settings and viewport configuration
- Folder structure conventions for sprite assets

No CONTEXT.md exists - planning from requirements only.

---

## Standard Stack

### Core Settings (project.godot)

| Setting | Current | Target | Purpose |
|---------|---------|--------|---------|
| `textures/default_texture_filter` | 1 (Nearest) ✓ | Keep as 1 | Pixel-perfect texture scaling |
| `display/window/stretch/mode` | Not set | `canvas_items` | Prevent scaling artifacts |
| `display/window/stretch/scale_mode` | Not set | `integer` (Godot 4.2+) | Whole-number scaling only |
| `display/window/size/viewport_width` | 1920 | 640 (recommended) | Base pixel art resolution |
| `display/window/size/viewport_height` | 1080 | 360 (recommended) | Base pixel art resolution |

**Installation:** No packages needed - all settings in `project.godot`

### Alternative Approaches

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `viewport` stretch mode | `canvas_items` | `viewport` mode renders at low-res then scales up - authentic retro feel but UI also pixelated |
| Large viewport (1920x1080) | Small viewport (640x360) | Smaller viewport = more visible world at once, classic pixel art feel |

---

## Architecture Patterns

### Recommended Project Structure

```
assets/
├── sprites/
│   ├── characters/       # Player sprites (idle, walk, attack, etc.)
│   ├── enemies/          # Enemy sprites (melee, ranged, boss, etc.)
│   ├── equipment/        # Weapons, armor, accessories
│   │   ├── bow/
│   │   ├── arrow/
│   │   ├── armor/
│   │   └── helm/
│   └── ui/              # Button icons, HUD elements
├── backgrounds/          # Tiles, parallax layers, environment
├── icons/               # App icons
├── particles/           # Particle effects
└── audio/               # Sound effects, music
```

### Current State (Pre-Phase 05)

```
assets/
├── sprites/
│   ├── characters/      ✓
│   ├── gear/            ✓ (but needs enemies/ at same level)
│   └── [root .tres files]
├── backgrounds/         ✓
├── icons/               ✓
├── particles/          ✓
└── audio/              ✓
```

**Gap:** No `assets/sprites/enemies/` or `assets/sprites/ui/` folders at top level.

### Pattern 1: Viewport + Integer Scaling

**What:** Configure Godot to render at low resolution and scale up by whole numbers only

**When to use:** Pixel art games where you want crisp, non-blurry sprites at any screen size

**Settings in project.godot:**
```ini
[display]

window/size/viewport_width=640
window/size/viewport_height=360
window/stretch/mode="canvas_items"
window/stretch/scale_mode="integer"
window/stretch/aspect="expand"

[rendering]

textures/default_texture_filter=1
```

**Source:** [Godot 4.4 Multiple Resolutions Documentation](https://docs.godotengine.org/en/4.4/tutorials/viewports/multiple_resolutions.html)

### Pattern 2: Pixel Art Import Preset

**What:** Configure texture import settings for crisp pixel art

**When to use:** Every sprite imported into the project

**Import Settings:**
- **Filter:** Nearest (not Linear)
- **Compression:** Lossless (VRAM Compression: disabled)
- **Mipmaps:** Disabled
- **Repeat:** Disabled (or Repeat if tiled)

**How to apply:**
1. Select texture in FileSystem
2. Go to Import tab
3. Select "2D Pixel" preset OR manually configure
4. For batch: Select multiple files → Import tab → Configure → Check "Import All"

**Source:** [GDQuest Pixel Art Setup Guide](https://www.gdquest.com/library/pixel_art_setup_godot4/)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pixel-perfect scaling | Custom shader scaling | Built-in integer scale_mode | Godot 4.2+ handles this natively |
| Texture filtering | Per-sprite filter setting | Default texture filter + inherit | Set once in project.godot |
| Import presets | Manually configure each sprite | Import presets (.import files) | Batch import with correct settings |

**Key insight:** Godot 4.x has native support for pixel-perfect rendering via project settings. Don't over-engineer with custom solutions.

---

## Common Pitfalls

### Pitfall 1: Linear Texture Filter (Blurry Sprites)
**What goes wrong:** Sprites appear blurry or fuzzy instead of crisp
**Why it happens:** Default filter is `Linear` (0), causing interpolation between pixels
**How to avoid:** Set `textures/default_texture_filter=1` (Nearest) in project.godot
**Warning signs:** Sprites look "soft" or "mushy" when zoomed in

### Pitfall 2: Non-Integer Scaling (Pixel Distortion)
**What goes wrong:** Pixels become rectangular (stretched or squashed)
**Why it happens:** Stretch mode allows fractional scaling (e.g., 1.5x, 2.7x)
**How to avoid:** Set `display/window/stretch/scale_mode="integer"` (Godot 4.2+)
**Warning signs:** Animation looks "wobbly" as camera moves

### Pitfall 3: VRAM Compression Artifacts
**What goes wrong:** Colors bleed, banding appears in gradients
**Why it happens:** VRAM compression (ETC2/ASTC) is designed for photos, not pixel art
**How to avoid:** Use Lossless compression (disable VRAM) for pixel art sprites
**Warning signs:** Dithering patterns broken, color shifts

### Pitfall 4: Mipmaps with Pixel Art
**What goes wrong:** Sprites shimmer or flash when camera moves
**Why it happens:** Mipmaps are pre-blurred versions for distance - wrong for pixel art
**How to avoid:** Disable mipmaps in import settings
**Warning signs:** Flickering on diagonal movement

---

## Code Examples

### Verifying Current Texture Filter Setting

```ini
# In project.godot - verify this line exists:
[rendering]
textures/default_texture_filter=1
```

**Source:** project.godot line 136 (already correct)

### Adding Viewport Stretch Settings

```ini
# Add to project.godot under [display] section:

[display]

# Base resolution for pixel art (640x360 scales cleanly to 1080p, 1440p, 4K)
window/size/viewport_width=640
window/size/viewport_height=360

# Stretch settings for pixel-perfect scaling
window/stretch/mode="canvas_items"
window/stretch/scale_mode="integer"
window/stretch/aspect="expand"
```

### Creating Import Preset (.import file)

```ini
# For each sprite .png file, create corresponding .import:
[remap]

importer="texture"
type="CompressedTexture2D"
uid="uid://path/to/sprite.png"
[deps]

files=[PackedStringArray("res://path/to/sprite.png")]
[params]

compress/mode=0  ; 0 = Lossless (VRAM disabled)
compress/high_quality=false
compress/lossy_quality=0.7
compress/hdr_compression=1
compress/bptc_ldr=0
compress/channels=1
mipmaps/generate=false  ; Disabled for pixel art
mipmaps/limit=-1
roughness/mode=0
roughness/src_normal=""
process/fix_alpha_border=true
process/premult_alpha=false
process/normal_map_invert_y=false
process/hdr_as_srgb=false
process/hdr_clamp_exposure=false
process/size_limit=0
detect_3d/compress_to=1

# CRITICAL for pixel art:
filter/texture_filter=1  ; 1 = Nearest
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Linear filter | Nearest filter | Always for pixel art | Crisp pixels |
| Fractional scaling | Integer scaling | Godot 4.2+ | No pixel distortion |
| Viewport mode | canvas_items + viewport | Godot 4.x | Better UI clarity |

**Deprecated/outdated:**
- `display/window/stretch/mode = "2d"` - Removed in Godot 4.x
- GPU pixel snap - No longer needed with integer scaling

---

## Open Questions

1. **Should viewport resolution change from 1920x1080 to 640x360?**
   - Current: 1920x1080 viewport
   - Recommendation: 640x360 for authentic pixel art feel
   - Tradeoff: Smaller viewport = smaller visible area, but classic retro look
   - **Decision needed:** Whether to change base resolution or keep current

2. **Should existing .tres sprite files be reimported?**
   - Current sprites are Godot-native format (.tres)
   - May have been imported with wrong settings
   - **Recommendation:** Verify in editor, reimport if blurry

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | N/A - Manual verification |
| Config file | project.godot |
| Quick run command | Open project in Godot editor |
| Full suite command | Play game, observe sprites |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-01 | Nearest texture filter configured | Manual | Open Project Settings → Rendering → Textures | ✓ project.godot line 136 |
| PROJ-02 | Viewport stretch mode = canvas_items with integer | Manual | Check project.godot for stretch settings | ❌ Needs to be added |
| PROJ-03 | Import presets for Lossless + no mipmaps | Manual | Import test sprite, verify settings | ❌ Needs setup |
| PROJ-04 | Folder structure exists | Bash | `ls assets/sprites/` | ✓ Partial |

### Wave 0 Gaps
- [ ] Add viewport stretch settings to project.godot
- [ ] Verify/import pixel art preset configuration
- [ ] Create missing folders: `assets/sprites/enemies/`, `assets/sprites/ui/`

---

## Sources

### Primary (HIGH confidence)
- [Godot 4.4 Multiple Resolutions Documentation](https://docs.godotengine.org/en/4.4/tutorials/viewports/multiple_resolutions.html) - Official documentation
- [GDQuest Pixel Art Setup Guide](https://www.gdquest.com/library/pixel_art_setup_godot4/) - Comprehensive tutorial
- [Itch.io: Godot 4.4 Settings for Pixel Art](https://itch.io/blog/806788/godot-44-settings-for-pixel-art) - Practical guide

### Secondary (MEDIUM confidence)
- [Medium: Doing pixel-perfect in Godot the right way](https://medium.com/codex/doing-pixel-perfect-in-godot-the-right-way-77cd39f8f23d) - Quick reference

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All settings are well-documented in official docs
- Architecture: HIGH - Folder structure verified against existing project
- Pitfalls: HIGH - Common issues well-documented in community

**Research date:** 2026-03-24
**Valid until:** 6 months (project settings are stable in Godot 4.x)
