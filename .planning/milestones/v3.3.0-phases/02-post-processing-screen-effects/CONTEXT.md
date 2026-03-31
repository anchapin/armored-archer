# Context: Phase 02 - Post-Processing & Screen Effects

**Phase:** 02
**Milestone:** v3.3.0 Polish & Juice
**Goal:** WorldEnvironment setup, camera shake, screen effects

## Locked Decisions

1. **WorldEnvironment** - Use Godot 4 WorldEnvironment node for post-processing
2. **Camera shake via script** - Custom CameraController for shake effects
3. **Mobile-optimized settings** - Lower quality settings for budget devices

## Technical Context

### Existing Infrastructure
- **screen_shake.tscn** - Already exists with shake methods (shake_light, shake_medium, shake_heavy)
- **VFXManager** - Has screen shake triggers (trigger_light_shake, trigger_medium_shake, etc.)
- **project.godot** - Viewport configured for 640x360

### Dependencies
- Phase 02 depends on Phase 01 (particle effects foundation must exist)

## Implementation Scope

### Deliverables
1. WorldEnvironment configuration with glow, vignette (mobile-optimized)
2. Camera shake integration with existing screen_shake.tscn
3. Damage overlay (red vignette) on low HP
4. Slow-motion effect on critical hits

### Success Criteria
- Post-processing works on mobile (60 FPS target)
- Screen shake triggers on damage/heavy impacts
- Red vignette displays when player HP < 30%
- Slow-mo triggers on critical hits

---
*Context created: 2026-03-27*
