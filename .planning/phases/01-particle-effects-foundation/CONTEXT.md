# Context: Phase 01 - Particle Effects Foundation

**Phase:** 01
**Milestone:** v3.3.0 Polish & Juice
**Goal:** Core particle system setup with object pooling

## Locked Decisions

1. **Godot 4 GPUParticles2D** - Primary particle system (research-confirmed)
2. **Object pooling required** - Pre-instantiate particles to avoid GC pressure on mobile
3. **Mobile-first optimization** - Cap active particles, performance throttling

## Technical Context

### Existing Infrastructure
- **ObjectPool.gd** - Generic object pool exists in autoloads
- **particles/** - 3 scene files: arrow_trail.tscn, combat_hit.tscn, enemy_death.tscn
- **CombatManager.gd** - Handles combat calculations, where hit/death triggers originate
- **project.godot** - Viewport configured for 640x360 with integer scaling

### Dependencies
- Phase 01 has no dependencies (first phase)
- Phase 02 depends on Phase 01 (post-processing builds on particles)
- Phase 03 depends on Phase 02 (UI builds on effects)

## Implementation Scope

### Deliverables
1. EffectsManager autoload - central orchestrator for all particle effects
2. Object pool for particle nodes (pre-instantiated GPUParticles2D)
3. Hit particles on enemy damage (triggered from CombatManager)
4. Death explosion particles on enemy defeat (triggered from CombatManager)

### Success Criteria
- All particle effects work on mobile (60 FPS target)
- No GC pressure from particle spawning
- EffectsManager singleton accessible from all game scripts

## Research Summary

See `.planning/research/SUMMARY.md` and `.planning/research/FEATURES.md` for full research.

**MVP Priority:**
1. Hit particles (essential combat feedback)
2. Death explosions (enemy defeat satisfaction)
3. Arrow trails (projectile visualization) - deferred to later phase if time permits

**Mobile pitfalls to avoid:**
- Over-particles causing frame drops
- Complex shader effects (compatibility issues)
- Heavy post-processing (battery drain)

---

*Context created: 2026-03-27*