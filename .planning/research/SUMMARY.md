# Research Summary: Armored Archer v3.3.0 — Polish & Juice

**Domain:** Mobile 2D Game (Godot 4)
**Researched:** 2026-03-27
**Overall confidence:** HIGH

## Executive Summary

This milestone focuses on visual effects expansion for the Armored Archer game. With pixel art assets now delivered (v3.2.0), we need to enhance the visual polish through particle effects, post-processing, screen effects, and UI animations. Godot 4 provides excellent 2D particle systems via GPUParticles2D and a robust WorldEnvironment for screen effects.

## Key Findings

- **Stack:** Godot 4's GPUParticles2D is the primary tool for all particle effects
- **Architecture:** Effects should be componentized and pooled for mobile performance
- **Critical pitfall:** Over-particles on mobile can cause frame drops; need throttling

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Particle Effects Foundation** - Core particle system setup, object pooling
   - Addresses: Basic hit/trail/death particles
   - Avoids: Performance issues from particle overload

2. **Post-Processing & Screen Effects** - WorldEnvironment, camera shake
   - Addresses: Glow, vignette, damage overlay
   - Avoids: Mobile GPU strain from expensive effects

3. **UI Polish & Micro-interactions** - Tween-based animations, transitions
   - Addresses: Screen transitions, button feedback, loading states

**Phase ordering rationale:** Particles are foundational (used by combat), then post-processing, then UI on top.

**Research flags for phases:**
- Phase 02: WorldEnvironment post-processing needs performance testing on mobile
- Phase 03: Standard patterns, unlikely to need research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Godot 4 documentation is comprehensive |
| Features | HIGH | Well-documented 2D game effects |
| Architecture | HIGH | Standard Godot patterns apply |
| Pitfalls | MEDIUM | Mobile performance is always a concern |

## Gaps to Address

- Specific sprite frame rates for Kenney assets
- Mobile device performance tier testing needed during implementation
