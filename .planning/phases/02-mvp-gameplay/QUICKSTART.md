# MVP Gameplay Rescue - Quick Start Guide

**Created**: 2026-03-16
**Status**: 🔄 READY TO START

---

## 🎯 The Problem

The game is currently unplayable:
- ❌ **Visuals**: Everything is grey - can't see player, enemies, or action
- ❌ **UX**: UI overlaps, transparent modals, unusable buttons
- ❌ **Gameplay**: No clear feedback, can't understand what's happening

## 🎯 The Solution

**4-week MVP sprint** to make the game playable and fun:

| Week | Focus | Outcome |
|------|-------|---------|
| 1 | Visual Foundation | Can see what's happening |
| 2 | UX & UI Fixes | Can use the interface |
| 3 | Core Gameplay | Can play complete loop |
| 4 | Polish & Content | Feels good to play |

---

## 📁 Where to Find Phase Plans

All MVP gameplay phases are in:
```
.planning/phases/02-mvp-gameplay/
```

### Phase Documents

| File | Description | Priority |
|------|-------------|----------|
| `README.md` | Overview & strategy | Start here |
| `01-01-background-colors.md` | Fix background visuals | P0 |
| `01-02-player-sprite.md` | Fix player appearance | P0 |
| `01-03-enemy-sprites.md` | Fix enemy visibility | P0 |
| `01-04-arrow-visuals.md` | Fix arrow projectiles | P0 |
| `01-05-particle-effects.md` | Add hit/death effects | P1 |
| `02-01-ui-audit.md` | Document UI issues | P0 |
| `02-02-modal-transparency.md` | Fix modal backgrounds | P0 |
| `02-03-button-overlaps.md` | Fix button layout | P0 |
| `02-04-touch-controls.md` | Calibrate controls | P0 |
| `02-05-health-bar-visibility.md` | Fix health/damage UI | P0 |
| `03-core-gameplay.md` | Complete gameplay loop | P0 |
| `04-polish-content.md` | Audio, juice, performance | P2 |

---

## 🚀 How to Start

### Step 1: Read the Overview

```bash
cat .planning/phases/02-mvp-gameplay/README.md
```

Understand the problem, success criteria, and approach.

### Step 2: Document Current State

Before fixing anything, document what's broken:

```bash
# Create issue tracking
mkdir -p .planning/todos
touch .planning/todos/ui-issues.md
touch .planning/todos/visual-issues.md
```

Take screenshots of:
- Main game scene (grey box)
- Any UI overlaps
- Transparent modals
- Unclear gameplay moments

### Step 3: Start with Phase 1.1

```bash
cat .planning/phases/02-mvp-gameplay/01-01-background-colors.md
```

Follow the tasks in order:
1. Audit current background
2. Choose color palette
3. Implement background color
4. Verify visibility

### Step 4: Daily Checkpoints

At the end of each day:
1. What did you fix?
2. Can you play the game now?
3. What's blocking you?
4. What's next?

---

## ✅ Success Criteria (Per Phase)

### Phase 1: Visual Foundation
- [ ] "I can see what's happening in the game"
- [ ] Player is visible and distinct
- [ ] Enemies are visible and distinct
- [ ] Arrows are visible when flying
- [ ] Background is not grey

### Phase 2: UX & UI Fixes
- [ ] "I can use the UI without frustration"
- [ ] No UI elements overlap
- [ ] Modals are opaque and readable
- [ ] Buttons are clickable
- [ ] Touch controls work properly

### Phase 3: Core Gameplay
- [ ] "I can play a complete game loop"
- [ ] Enemy spawns are visible
- [ ] Combat feedback is clear
- [ ] Death and respawn are obvious
- [ ] Win/loss states are clear

### Phase 4: Polish
- [ ] "The game feels good to play"
- [ ] Screen shake adds impact
- [ ] Audio feedback exists
- [ ] Game runs at 60fps

---

## 🛠 Quick Commands

```bash
# Open Godot project
godot project.godot

# Run game (in Godot, press F5)

# View phase plans
cat .planning/phases/02-mvp-gameplay/README.md
cat .planning/phases/02-mvp-gameplay/01-01-background-colors.md

# Track progress
cat .planning/MILESTONES.md
cat .planning/ROADMAP.md
```

---

## 📞 Human Checkpoints

**Required before starting each phase:**

| Checkpoint | Question | Decision |
|------------|----------|----------|
| Before Phase 1 | "Are visuals the top priority?" | Go/No-Go |
| Before Phase 2 | "Should we fix UX next?" | Go/No-Go |
| Before Phase 3 | "Is gameplay clear enough?" | Go/No-Go |
| Before Phase 4 | "Ready for polish?" | Go/No-Go |

**At each checkpoint:**
1. Show current game state
2. Demonstrate what works
3. Get approval to proceed
4. Adjust priorities if needed

---

## 🎯 Definition of Done (MVP)

The MVP is complete when:

1. ✅ A new player can:
   - See the game world clearly
   - Understand their controls
   - Complete a full game loop
   - Know if they won or lost

2. ✅ The game feels:
   - Visually coherent (not placeholder grey)
   - Responsive (controls work)
   - Satisfying (feedback on actions)
   - Playable at 60fps

3. ✅ Playtesters can:
   - Play without guidance
   - Understand what's happening
   - Provide meaningful feedback

---

## 📈 After MVP Complete

Once MVP gameplay is solid:

1. **Resume v2.1.0** (Alpha Launch & Stabilization)
2. **Deploy to alpha** testers
3. **Gather feedback** from real players
4. **Iterate** based on feedback

---

## 🚨 If You Get Stuck

### Visual Import Issues

If sprites won't load:
- Use simple colored rectangles (ColorRect nodes)
- Document the import issue
- Move forward, fix import later

### UI Layout Issues

If Godot containers are confusing:
- Use simple anchor presets (Full Rect, Top Left, etc.)
- Avoid manual positioning
- Ask for help with Godot UI system

### Performance Issues

If game is slow:
- Profile with Godot's built-in profiler
- Check for too many particles/nodes
- Use object pooling for arrows/enemies

---

## 📞 Contact & Resources

**Documentation**:
- Phase plans: `.planning/phases/02-mvp-gameplay/`
- Milestones: `.planning/MILESTONES.md`
- Roadmap: `.planning/ROADMAP.md`

**Godot Resources**:
- Godot Docs: https://docs.godotengine.org/
- GDScript Reference: https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/index.html

---

**Last Updated**: 2026-03-16
**Next Review**: After Phase 1.1 completion
**Status**: 🔄 READY TO START
