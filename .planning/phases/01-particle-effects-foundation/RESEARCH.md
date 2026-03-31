# Research: Phase 01 - Particle Effects Foundation

**Phase:** 01
**Goal:** Core particle system setup with object pooling

## Research Source

Research already completed in:
- `.planning/research/SUMMARY.md` - Executive summary
- `.planning/research/FEATURES.md` - Feature landscape

## Phase-Specific Research

### Technology Stack
- **GPUParticles2D** - Godot 4's primary 2D particle system
- **ObjectPool.gd** - Existing generic pool in autoloads
- **particles/** folder - Contains 3 placeholder scenes

### Implementation Approach

#### EffectsManager (Plan 01-01)
- Singleton autoload for orchestrating all visual effects
- Methods: `spawn_hit()`, `spawn_death()`, `spawn_arrow_trail()`
- Integrates with ObjectPool for particle instances
- Signal-based communication with CombatManager

#### Particle Pool (Plan 01-02)
- Extend ObjectPool for GPUParticles2D nodes
- Pre-instantiate particle scenes (arrow_trail, combat_hit, enemy_death)
- Configure emission parameters for reuse
- Mobile optimization: cap pool size, implement throttling

#### Hit/Death Effects (Plan 01-03)
- Trigger from CombatManager on damage/death events
- Position particles at enemy location
- Configure particle parameters (lifetime, amount, color)
- Arrow trail attached to Arrow scene

## Implementation Notes

### Mobile Performance Considerations
- Particles use GPU (GPUParticles2D) - runs on GPU, not CPU
- Limit active particle count to 100 per effect type
- Use `one_shot` property for burst effects
- Lifetime under 1 second for hit effects, 2 seconds for death

### Integration Points
- CombatManager.gd - Add signal emission for hit/death
- Arrow scene - Attach trail particles
- EnemyBase - Attach death particle emitter

---

*Research completed: 2026-03-27*
*Based on existing research files in .planning/research/*