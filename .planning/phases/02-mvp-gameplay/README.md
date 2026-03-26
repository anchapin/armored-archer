# MVP Gameplay Phases - Visual & UX Rescue

**Mission**: Transform the grey box prototype into a playable, visually coherent MVP

**Start Date**: 2026-03-16
**Duration**: 2-3 weeks
**Priority**: **CRITICAL** - Game is currently unplayable (grey box, broken UX)

---

## 🎯 Problem Statement

The current game state:
- ❌ **Visuals**: Everything is grey/placeholder - can't distinguish enemies, player, or environment
- ❌ **UX**: UI elements overlap, modals transparent, buttons unusable
- ❌ **Gameplay**: Can't see what's happening, no visual feedback, no clarity
- ❌ **Priority Mismatch**: Previous phases focused on backend infrastructure while game itself is broken

## 🎯 Success Criteria

When these phases are complete:
- ✅ Player can **see** the game world clearly (colored background, distinct sprites)
- ✅ Player can **control** their character without UI interference
- ✅ Player can **understand** what's happening (damage numbers, health bars, enemy visibility)
- ✅ Player can **complete** the core gameplay loop (spawn → move → shoot → kill → progress)
- ✅ UI is **usable** (no overlapping, readable text, clear buttons)

---

## 📋 Phase Structure

### Phase 1: Visual Foundation (Days 1-5)
**Goal**: Replace grey boxes with colored, distinguishable sprites

**Plans**:
- [1.1] Background & Environment Colors
- [1.2] Player Sprite & Colors
- [1.3] Enemy Sprites & Colors
- [1.4] Arrow Projectile Visuals
- [1.5] Basic Particle Effects

**Success Criteria**:
- [ ] Game world has colored background (not grey)
- [ ] Player character is clearly visible and distinct
- [ ] Enemies are visible and distinguishable by type
- [ ] Arrows are visible when shooting
- [ ] Basic hit effects visible

**Checkpoint**: Human verify - "I can see what's happening in the game"

---

### Phase 2: UX & UI Fixes (Days 6-10)
**Goal**: Fix overlapping UI, make interface usable

**Plans**:
- [2.1] UI Layout Audit & Documentation
- [2.2] Modal Transparency Fixes
- [2.3] Button Overlap Resolution
- [2.4] Touch Control Calibration
- [2.5] Health Bar & Damage Popup Visibility

**Success Criteria**:
- [ ] No UI elements overlap
- [ ] Modals are opaque and readable
- [ ] Buttons are clickable and properly sized
- [ ] Touch joysticks work without interference
- [ ] Health bars visible and accurate

**Checkpoint**: Human verify - "I can use the UI without frustration"

---

### Phase 3: Core Gameplay Loop (Days 11-15)
**Goal**: Make the actual game playable and clear

**Plans**:
- [3.1] Enemy Spawning Visibility (see enemies spawn)
- [3.2] Combat Feedback (damage numbers, hit markers)
- [3.3] Player Movement & Collision (feel boundaries)
- [3.4] Death & Respawn Clarity
- [3.5] Win/Loss State Visibility

**Success Criteria**:
- [ ] Player can see enemies spawning
- [ ] Damage dealt is clearly shown with numbers
- [ ] Player knows when they hit/miss
- [ ] Death is clear with respawn option
- [ ] Victory/defeat is visually obvious

**Checkpoint**: Human verify - "I can play a complete game loop"

---

### Phase 4: Polish & Content (Days 16-21)
**Goal**: Add juice, audio, and progression clarity

**Plans**:
- [4.1] Screen Shake & Impact Effects
- [4.2] Audio Implementation (SFX, music)
- [4.3] Progression UI (XP, level up feedback)
- [4.4] Menu Flow & Navigation
- [4.5] Performance Optimization

**Success Criteria**:
- [ ] Combat feels impactful with screen shake
- [ ] Audio feedback for actions
- [ ] Level up feels rewarding
- [ ] Menus navigate smoothly
- [ ] Game runs at target framerate

**Checkpoint**: Human verify - "The game feels good to play"

---

## 🎨 Visual Style Guide

### Color Palette (Placeholder → Final)

| Element | Placeholder Color | Final Style |
|---------|------------------|-------------|
| Background | #888888 (grey) | Gradient sky/ground |
| Player | #FFFFFF (white) | Armored archer sprite |
| Basic Enemy | #AAAAAA (grey) | Red/orange barbarian |
| Wind Enemy | #CCCCCC (light grey) | Blue/cyan mage |
| Boss | #666666 (dark grey) | Unique boss sprite |
| Arrow | #000000 (black) | Wooden/metal arrow |
| Ground | #888888 (grey) | Textured terrain |

### UI Style

| Element | Current Issue | Target |
|---------|--------------|--------|
| Modals | Transparent, unreadable | Opaque backgrounds |
| Buttons | Overlapping, small | Proper spacing, touch-friendly |
| Text | Low contrast | High contrast, readable |
| Health Bars | Hard to see | Bold, clear colors |

---

## 📊 Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Visible player/enemies | Critical | Low | P0 |
| Fix UI overlaps | Critical | Medium | P0 |
| Damage feedback | High | Low | P0 |
| Colored background | High | Low | P1 |
| Particle effects | Medium | Medium | P1 |
| Audio | Medium | Medium | P2 |
| Screen shake | Low | Low | P3 |

---

## 🛠 Technical Approach

### Sprite Strategy

**Option A: Use Existing Assets** (Recommended for MVP)
- Project already has sprite `.tres` files in `assets/sprites/`
- Import and apply to existing nodes
- Fastest path to visible game

**Option B: Placeholder Colors** (Fallback)
- Use ColorRect and simple shapes with distinct colors
- Only if sprite import is blocking
- Still better than grey

### UI Fix Strategy

1. **Audit**: Screenshot all UI issues with annotations
2. **Prioritize**: Fix game-breaking overlaps first (combat UI)
3. **Standardize**: Create UI style guide (sizes, spacing, colors)
4. **Test**: Verify on multiple screen sizes

---

## 📝 Testing Protocol

### Daily Playtesting

Each phase requires daily playtesting:
1. **Fresh install** on test device
2. **Complete core loop** without guidance
3. **Note friction points** (can't see, can't click, confusing)
4. **Fix immediately** before moving on

### Device Matrix

Test on:
- [ ] High-end iOS (iPhone 15 Pro)
- [ ] Mid-range Android
- [ ] Low-end device (performance check)

---

## 🎯 Definition of Done (Per Phase)

Each phase is complete when:
1. ✅ All tasks in phase plan are complete
2. ✅ Playtest passes without blocking issues
3. ✅ No critical bugs introduced
4. ✅ Performance target met (60fps on target devices)
5. ✅ Human sign-off at checkpoint

---

## 📈 Progress Tracking

### Visual Progress

```
Week 1:  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Phase 1 (Visuals)
Week 2:  ████████████████░░░░░░░░░░░░░░░░░░░░  Phase 2 (UX)
Week 3:  ████████████████████████░░░░░░░░░░░░  Phase 3 (Gameplay)
Week 4:  ████████████████████████████████░░░░  Phase 4 (Polish)
```

### Burnup Chart

```
Total Tasks: 20
Completed: 0
Remaining: 20

Progress: 0% ████████████████████████████████████░ 100%
```

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sprite import issues | High | Use placeholder colors, fix import later |
| UI anchor complexity | Medium | Use Godot containers, not manual positioning |
| Performance regression | Medium | Profile after each phase, optimize early |
| Scope creep | High | Strict MVP focus - "can you see and play?" |

---

## 🚀 Quick Start

```bash
# Open Godot project
godot project.godot

# Run game (F5)
# Test current state before starting fixes

# Document issues with screenshots
# Create task list in .planning/todos/
```

---

## 📞 Checkpoints

| Checkpoint | After Phase | Decision |
|------------|-------------|----------|
| Visual Check | Phase 1 | Can you see what's happening? |
| UX Check | Phase 2 | Can you use the interface? |
| Gameplay Check | Phase 3 | Can you complete a game loop? |
| Polish Check | Phase 4 | Does it feel good to play? |

**Each checkpoint requires human sign-off before proceeding.**

---

**Last Updated**: 2026-03-16
**Next Review**: After Phase 1 completion
**Status**: 🔄 **READY TO START**
