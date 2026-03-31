# Phase 03: UI Polish & Micro-interactions - Context

**Phase:** 03 - UI Polish & Micro-interactions
**Goal:** Tween-based animations for UI elements

## Locked Decisions

| Decision | Source | Rationale |
|----------|--------|-----------|
| Use Godot 4 Tween API | design_tokens.gd | Modern GDScript 2.0 with `create_tween()` |
| Animation durations from design_tokens | design_tokens.gd lines 206-210 | Consistent UX: ANIM_DURATION_FAST (0.1s), NORMAL (0.2s), SLOW (0.3s) |
| Ease functions from design_tokens | design_tokens.gd lines 213-214 | ANIM_EASE_OUT (0.25), ANIM_EASE_IN_OUT (0.42) |
| Device-tier optimization | UITransitionOptimizer.gd | Budget devices get faster transitions |

## Technical Constraints

1. **Mobile Performance Target:** 60 FPS - animations must be GPU-accelerated, no heavy raycasts
2. **No GDScript yield:** Use `await` for async animations (project uses GDScript 2.0)
3. **Tween pooling:** Avoid creating new Tweens per animation - use tween sequences efficiently

## Dependencies

- Phase 01: Particle Effects Foundation ✅
- Phase 02: Post-Processing & Screen Effects ✅

## Existing Infrastructure

### Animation Constants (design_tokens.gd)
- `ANIM_DURATION_FAST := 0.1`
- `ANIM_DURATION_NORMAL := 0.2`
- `ANIM_DURATION_SLOW := 0.3`
- `ANIM_EASE_OUT := 0.25` (cubic)
- `ANIM_EASE_IN_OUT := 0.42` (cubic)

### Existing Tween Usage
- `loading_indicator.gd`: Fade in/out, progress spinner (lines 87-118)
- `UITransitionOptimizer.gd`: Scene transition timing (no Tweens yet)

### Missing/Incomplete
- `base_button.gd`: No tween animations for press/hover states
- No reusable tween utility functions
- No smooth screen transitions between menus

## Claude's Discretion

- Whether to create a dedicated `AnimationUtils` autoload or extend existing components
- Exact easing curves and timing (use constants from design_tokens)
- Screen transition style: fade, slide, or both with device tier consideration