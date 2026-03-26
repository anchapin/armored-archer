# Project Research Summary

**Project:** Armored Archer v3.2.0 - Pixel Art Sprites
**Domain:** 2D Game Sprites (Godot 4.x)
**Researched:** 2026-03-24
**Confidence:** HIGH

## Executive Summary

The v3.2.0 milestone focuses on replacing existing Godot placeholder textures with pixel art sprites. This is a well-understood domain—Godot 4.x provides native sprite capabilities (AnimatedSprite2D, Sprite2D, AtlasTexture) that require no external libraries. The critical path involves configuring project-wide pixel-perfect rendering settings first, then building the animation system, then replacing sprites in dependency order (player → enemies → equipment → UI).

Key risks are well-documented: wrong texture filter causes blurry sprites (CRITICAL), wrong stretch mode causes pixel distortion (CRITICAL), VRAM compression causes artifacts (CRITICAL). All are preventable with correct project settings. The existing architecture (ModularCharacterSprite, GearSlot) requires minimal changes—primarily extending GearSlot with AnimatedSprite2D support for animated equipment.

## Key Findings

### Recommended Stack

**Core technologies (all Godot 4.x native):**
- **AnimatedSprite2D** — Character animation via SpriteFrames resource
- **Sprite2D** — Static sprites for weapons, armor, UI
- **AtlasTexture** — Efficient sprite sheet slicing
- **TextureFilter: Nearest** — CRITICAL: prevents blur on scaled sprites
- **Viewport Stretch Mode** — Ensures integer scaling for crisp pixels
- **Lossless Compression** — Prevents artifacting on pixel art

**Creation tools:**
- **Aseprite** ($19.99) — Industry standard for pixel art
- **Pixelorama** (Free) — Open-source alternative, excellent Godot integration

### Expected Features

**Must have (table stakes):**
- Sprite import pipeline with Nearest filter, Lossless compression, no mipmaps
- Project configuration (default texture filter = Nearest, integer scale mode)
- AnimatedSprite2D with SpriteFrames for character animations
- Basic sprite types (Sprite2D, AnimatedSprite2D, AtlasTexture)

**Should have (competitive):**
- State-driven animation connecting GameManager states to sprite playback
- 8-directional animations for top-down archer (4 cardinal + 4 diagonal)
- Sprite atlas optimization for reduced draw calls

**Defer (v2+):**
- Animation blending/transitions
- Transmog skin system (separate feature)
- Sprite atlas optimization (after all sprites complete)

### Architecture Approach

The integration adds two new components: `AnimatedCharacterSprite` (manages character animations) and `SpriteAnimationController` (controls animation state machine). Existing systems (GameManager, CombatManager, GearManager, TransmogManager) require no changes—they reference sprites generically. The `ModularCharacterSprite` + `GearSlot` pattern already uses layered composition, which extends naturally to animated equipment.

### Critical Pitfalls

1. **Blurry Sprites (PA-1)** — Wrong texture filter. **Fix:** Set `Project Settings → Rendering → Textures → Default Texture Filter = Nearest`, then reimport ALL existing textures.

2. **Pixel Distortion (PA-2)** — Wrong stretch mode. **Fix:** Set `Stretch → Mode = canvas_items`, `Aspect = keep`, `Scale Mode = integer` (Godot 4.3+).

3. **VRAM Compression Artifacts (PA-3)** — Using lossy compression. **Fix:** Set compress mode to Lossless for all pixel art textures.

4. **Tween Conflicts** — Multiple tweens fighting on same property. **Fix:** Always `kill()` existing tweens before creating new ones.

5. **Audio Node Leaks** — AudioStreamPlayers not cleaning up. **Fix:** Connect `finished` signal to `queue_free()` or use AudioManager autoload.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Project Settings & Import Pipeline
**Rationale:** Foundation for all pixel art assets—must be correct before importing any sprites.
**Delivers:** Configured project.godot with pixel-perfect settings, import presets, folder structure.
**Addresses:** FEATURES.md table stakes (Project Configuration, Sprite Import Pipeline).
**Avoids:** PITFALLS.md PA-1 (blurry sprites), PA-2 (pixel distortion), PA-3 (VRAM artifacts).

### Phase 2: Player Character Animation
**Rationale:** Most visible asset, core to gameplay, validates the entire pipeline.
**Delivers:** AnimatedCharacterSprite scene, SpriteAnimationController, idle/walk/attack/bow_draw animations.
**Addresses:** FEATURES.md player sprites (6 animations, 4-8 frames each).
**Avoids:** PITFALLS.md PA-6 (breaking existing placeholder system)—maintain same sprite sheet layout.

### Phase 3: Enemy Sprites
**Rationale:** Required for combat testing, follows validated player pipeline.
**Delivers:** Enemy base sprite scene, EnemyAnimationMixin, melee/ranged/boss enemy types.
**Addresses:** FEATURES.md enemy sprites (3 enemy types × 5-6 animations each).
**Avoids:** PITFALLS.md PA-5 (wrong sprite sheet layout)—use consistent frame dimensions.

### Phase 4: Equipment & UI Sprites
**Rationale:** Completes visual coverage, extends existing equipment system.
**Delivers:** Extended GearSlot with animated sprites, weapon animations, UI icons, background tiles.
**Addresses:** FEATURES.md equipment, UI, and background sprites.
**Avoids:** PITFALLS.md PA-4 (inconsistent texture filter)—verify all imported assets use Nearest.

### Phase Ordering Rationale

- **Settings first:** Project configuration affects ALL sprites—must be correct before import
- **Player first:** Most visible, validates animation system works with existing GameManager
- **Enemies second:** Combat requires enemy sprites; pipeline validated by player phase
- **Equipment/UI last:** Depends on GearSlot extension; lower risk of blocking issues

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** State-driven animation integration—complex signal wiring between GameManager and AnimatedSprite2D

Phases with standard patterns (skip research-phase):
- **Phase 1:** Well-documented Godot project settings
- **Phase 3-4:** Follow Phase 2 patterns, straightforward extension

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Godot 4.x documentation, verified by multiple community sources |
| Features | HIGH | Standard pixel art workflow, well-documented patterns |
| Architecture | HIGH | Extends existing ModularCharacterSprite pattern, minimal risk |
| Pitfalls | HIGH | Critical pitfalls documented in official docs; all have clear fixes |

**Overall confidence:** HIGH

### Gaps to Address

- **GildedSpritePalette integration:** Research assumes compatibility with existing palette system—verify during Phase 2 implementation
- **Mobile performance:** Sprite atlas optimization may be needed for low-end devices—test during Phase 4

## Sources

### Primary (HIGH confidence)
- Godot 4.4 Documentation: 2D Sprite Animation — AnimatedSprite2D, SpriteFrames
- Godot 4.4 Documentation: Importing Images — Compression modes, filtering options
- Godot 4.4 Documentation: Multiple Resolutions — Viewport, stretch modes
- GDQuest: Pixel Art Setup Godot 4 — Complete setup guide

### Secondary (MEDIUM confidence)
- itch.io: Godot 4.4 Settings for Pixel Art — Community best practices
- Bugnet: Fix Blurry Godot 2D Sprites — Troubleshooting blur issues

### Tertiary (LOW confidence)
- Specific export settings from sprite creation tools—validate during Phase 1

---

*Research completed: 2026-03-24*
*Ready for roadmap: yes*
