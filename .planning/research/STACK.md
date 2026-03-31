# Technology Stack: v3.3.0 Polish & Juice

**Project:** Armored Archer
**Researched:** 2026-03-27

## Recommended Stack

### Core Effects Technology
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GPUParticles2D | Godot 4.x | All particle effects | GPU-accelerated, mobile-friendly |
| WorldEnvironment | Godot 4.x | Post-processing | Built-in glow, vignette, color grade |
| Camera2D | Godot 4.x | Screen effects | Screen shake, smooth follow |
| Tween | Godot 4.x | UI animations | Smooth micro-interactions |

### Object Pooling
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ObjectPool (existing) | - | Particle pooling | Prevents GC spikes |

### Shaders
| Technology | Purpose | Why |
|------------|---------|-----|
| ColorSwapShader | Armor break effects | GPU-based color manipulation |
| HitFlashShader | Enemy hit flash | Simple single-pass effect |

## Sources
- Godot 4.x Documentation: ParticleSystems2D
- Godot 4.x Documentation: WorldEnvironment
- Godot 4.x Documentation: Tween system
