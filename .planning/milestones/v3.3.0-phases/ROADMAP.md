# Roadmap: v3.3.0 Polish & Juice

## Goal
Expand visual effects with particles, post-processing, and UI animations

## Phase Structure

### Phase 01: Particle Effects Foundation
**Goal:** Core particle system setup with object pooling

**Depends on:** Nothing (first phase)

**Plans:** 3 plans expected
- 01-01: EffectsManager autoload + particle spawning ✅ COMPLETE
- 01-02: Particle pool implementation ✅ COMPLETE
- 01-03: Hit particles + death explosions ✅ COMPLETE

**Deliverables:**
- EffectsManager singleton for orchestrating all effects ✅
- Object pool for particle nodes (pre-instantiated) ✅
- Hit particles on enemy damage ✅
- Death explosion particles on enemy defeat ✅

---

### Phase 02: Post-Processing & Screen Effects
**Goal:** WorldEnvironment setup, camera shake, screen effects

**Depends on:** Phase 01

**Plans:** 3 plans expected
- 02-01: WorldEnvironment configuration (glow, vignette) ✅ COMPLETE
- 02-02: CameraController with screen shake ✅ COMPLETE
- 02-03: Damage overlay + slow-mo effects ✅ COMPLETE

**Deliverables:**
- Global WorldEnvironment with mobile-optimized settings ✅
- Camera shake on damage/heavy impacts ✅
- Red vignette overlay on low HP ✅
- Slow-motion on critical hits ✅

---

### Phase 03: UI Polish & Micro-interactions
**Goal:** Tween-based animations for UI elements

**Depends on:** Phase 02

**Plans:** 2-3 plans expected
- 03-01: UI animation utilities ✅ COMPLETE
- 03-02: Screen transitions ✅ COMPLETE
- 03-03: Button feedback + loading states ✅ COMPLETE

**Deliverables:**
- Tween utilities for reusable animations ✅
- Smooth screen transitions ✅
- Button press feedback animations ✅
- Loading indicator animations ✅

---

## Success Criteria

- [x] All particle effects work on mobile (60 FPS target)
- [x] No GC pressure from particle spawning
- [x] Screen shake limited to meaningful impacts
- [x] UI animations smooth (no frame drops)
- [x] WorldEnvironment performs well on low-end devices

---

## Milestone Status: ✅ COMPLETE

**Completion Date:** 2026-03-27
**Total Plans:** 9/9 (100%)
**Verification:** All phases verified and complete
