# Architecture Patterns: v3.3.0 Polish & Juice

**Domain:** Godot 4 2D Visual Effects
**Researched:** 2026-03-27

## Recommended Architecture

### Effect Manager Pattern

EffectsManager (Autoload):
- spawn_particle(effect_type, position, params)
- trigger_screen_shake(intensity, duration)
- play_slow_motion(duration, timescale)
- flash_screen(color, duration)

### Component Structure

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| EffectsManager | Central effect orchestration | GameManager, CombatManager |
| ParticlePool | Reusable particle instances | ObjectPool |
| CameraController | Screen shake, follow | Player, Enemies |
| PostProcessor | WorldEnvironment control | EffectsManager |

### Data Flow

1. Combat event occurs (damage dealt)
2. CombatManager -> EffectsManager: spawn_effect()
3. EffectsManager -> ParticlePool: get_instance()
4. Particle plays, returns to pool on completion
5. Optional: CameraController triggers shake

## Patterns to Follow

### Pattern 1: Object Pooling for Particles
Pre-instantiate particle nodes, reuse on spawn. Use when any frequently-spawned effect.

### Pattern 2: Tween-based Screen Shake
Animate Camera2D offset for shake effect. Use when damage, heavy impacts.

### Pattern 3: WorldEnvironment Glow Control
Toggle glow intensity based on game state. Use for equipment glow, hero moments.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Creating Particles On-Demand
Instantiating new particle scenes every hit causes GC pressure and frame drops. Instead: use object pool.

### Anti-Pattern 2: Multiple WorldEnvironments
One per scene causes performance overhead. Instead: use single global, adjust via code.

## Scalability Considerations

| Concern | At 100 Users | At 10K Users | At 1M Users |
|---------|--------------|--------------|-------------|
| Particle count | 50 max | 100 max | 200 max |
| Screen shake | Every frame OK | Throttle 10/sec | 5/sec max |
| Glow | Enabled | Subtle only | Disabled |

## Sources
- Godot 4 official documentation
- Game programming patterns: Object Pool
