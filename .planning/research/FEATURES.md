# Feature Landscape: v3.3.0 Polish & Juice

**Domain:** Mobile 2D Game Visual Effects
**Researched:** 2026-03-27

## Table Stakes

Core effects expected in any polished mobile game.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Hit particles | Combat feedback essential | Low | GPUParticles2D with collision |
| Death explosions | Enemy defeat satisfaction | Low | Burst emitter, short lifetime |
| Arrow trails | Projectile visualization | Low | TrailRenderer-style particles |
| Screen shake | Damage/impact feel | Low | Camera2D offset animation |
| Damage overlay | Visual health feedback | Low | Red vignette on low HP |

## Differentiators

Features that set polished games apart.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Armor break effect | Visual gear destruction | Medium | Shader-based color flash |
| Enemy flash on hit | Attack register feedback | Low | White flash shader |
| Slow-mo on critical | Highlight special hits | Medium | Time scale manipulation |
| Glowing equipment | Gear rarity visibility | Medium | WorldEnvironment glow |
| Screen vignette | Focus attention | Low | WorldEnvironment vignette |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Heavy post-processing | Kills mobile battery/performance | Subtle glow only |
| Particle overload | Frame drops on low-end devices | Cap active particles |
| Complex shader effects | Compatibility issues | Simple single-pass shaders |

## MVP Recommendation

Prioritize:
1. Hit particles (essential combat feedback)
2. Death explosions (enemy defeat)
3. Screen shake (impact feel)
4. Damage overlay (health feedback)

Defer: Complex shader effects (armor break) - requires more research
