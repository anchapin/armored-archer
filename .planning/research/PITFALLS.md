# Domain Pitfalls: v3.3.0 Polish & Juice

**Domain:** Godot 4 2D Visual Effects
**Researched:** 2026-03-27

## Critical Pitfalls

### Pitfall 1: Particle Overload on Mobile
- **What goes wrong:** Too many GPUParticles2D cause frame drops
- **Why it happens:** No cap on active particles, unlimited spawn
- **Consequences:** Game becomes unplayable on mid-range devices
- **Prevention:** Cap max particles (50-100), use particle limit in editor, implement spawn cooldown
- **Detection:** FPS counter drops below 30

### Pitfall 2: WorldEnvironment Performance Drain
- **What goes wrong:** Expensive post-processing enabled globally
- **Why it happens:** Glow, SSAO, etc. all enabled at once
- **Consequences:** Battery drain, frame drops on mobile
- **Prevention:** Test on low-end device, disable by default, enable selectively
- **Detection:** Battery drain reports, frame drops

### Pitfall 3: Screen Shake Addiction
- **What goes wrong:** Shake on every minor event
- **Why it happens:** Overuse for juice
- **Consequences:** Player nausea, disorientation
- **Prevention:** Limit to meaningful impacts only, use varying intensities
- **Detection:** User feedback about too much shake

## Moderate Pitfalls

### Pitfall 1: Tween Conflict
- **What goes wrong:** Multiple tweens on same property fight
- **Prevention:** Kill existing tween before starting new one

### Pitfall 2: Memory Leak from Particles
- **What goes wrong:** Particles not returning to pool
- **Prevention:** Ensure emits one_shot and autoreturns

## Minor Pitfalls

### Pitfall 1: Z-Fighting Effects
- **What goes wrong:** Particles render behind/below entities
- **Prevention:** Set proper z_index, use canvas z-layer

### Pitfall 2: Color Inconsistency
- **What goes wrong:** Effects do not match palette
- **Prevention:** Define color constants, reuse across effects

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Particles | Mobile overload | Cap + pool |
| Post-processing | Performance | Test on low-end |
| Screen shake | Overuse | Limit to hits only |
| UI animations | Tween conflicts | Kill before new |

## Sources
- Godot 4 performance documentation
- Mobile game development best practices
