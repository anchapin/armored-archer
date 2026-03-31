# Roadmap: Armored Archer v3.2.0 - Pixel Art

**Milestone:** v3.2.0  
**Goal:** Create all needed pixel art sprites to replace Godot placeholder textures  
**Granularity:** standard

## Core Value

**Players can enjoy a polished, responsive archery game with reliable performance and minimal bugs.**

## Phases

- [x] **Phase 05: Project Settings & Import Pipeline** - Configure project.godot for pixel-perfect rendering (completed 2026-03-24)
- [ ] **Phase 06: Player Character Animation** - Create player sprites with animations
- [ ] **Phase 07: Enemy Sprites** - Create enemy sprites for all types
- [ ] **Phase 08: Equipment & UI Sprites** - Create weapons, armor, UI icons, backgrounds

---

## Phase Details

### Phase 05: Project Settings & Import Pipeline

**Goal:** Configure Godot project for pixel-perfect rendering with proper import pipeline

**Depends on:** Nothing (first phase)

**Requirements:** PROJ-01, PROJ-02, PROJ-03, PROJ-04

**Success Criteria** (what must be TRUE):
  1. User can open project.godot and see Nearest texture filter configured (not Linear)
  2. User can verify viewport stretch mode is set to canvas_items with integer scaling
  3. User can import sprites using Lossless compression with no mipmaps
  4. User can navigate folder structure for characters/, enemies/, equipment/, ui/, backgrounds/

**Plans:** 3/3 plans complete
- [x] 05-01-PLAN.md — Configure viewport stretch settings
- [x] 05-02-PLAN.md — Document pixel art import settings
- [x] 05-03-PLAN.md — Create missing folder structure

---

### Phase 06: Player Character Animation

**Goal:** Create player character sprites with full animation set

**Depends on:** Phase 05

**Requirements:** PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06, PLAY-07, PLAY-08

**Success Criteria** (what must be TRUE):
  1. User can see player idle animation playing (4-8 frames loop)
  2. User can see player walk animation with 4-directional movement
  3. User can see player attack animation when attacking (6-8 frames)
  4. User can see bow draw animation during aim (6-8 frames)
  5. User can see player hit/damage animation when taking damage
  6. User can see player death animation when health reaches zero
  7. User can verify AnimatedSprite2D with SpriteFrames is attached to player
  8. User can observe animation state machine responds to GameManager signals (idle, walk, attack, hit, death states)

**Plans:** 2/2 plans
- [x] 06-01-PLAN.md — Create sprite assets and SpriteFrames configuration
- [x] 06-02-PLAN.md — Implement AnimatedSprite2D and connect GameManager signals

---

### Phase 07: Enemy Sprites

**Goal:** Create all enemy type sprites with animations

**Depends on:** Phase 05

**Requirements:** ENEM-01, ENEM-02, ENEM-03, ENEM-04, ENEM-05, ENEM-06, ENEM-07, ENEM-08, ENEM-09, ENEM-10

**Success Criteria** (what must be TRUE):
  1. User can see melee enemies with idle, walk, attack, hit, death animations
  2. User can see ranged enemies with all animation states
  3. User can see speed enemies with all animation states
  4. User can see swarmer enemies with all animation states
  5. User can see brute enemies with all animation states
  6. User can see scout enemies with all animation states
  7. User can see guardian enemies with all animation states
  8. User can see necromancer enemies with all animation states
  9. User can see boss enemies (fire, ice, earth, wind, electric variants) with animations
  10. User can verify EnemyAnimationMixin provides shared animation logic across enemy types

**Plans:** TBD

---

### Phase 08: Equipment & UI Sprites

**Goal:** Create weapon, armor, UI icons, and background sprites

**Depends on:** Phase 05

**Requirements:** WEAP-01, WEAP-02, WEAP-03, WEAP-04, WEAP-05, UI-01, UI-02, UI-03, UI-04, UI-05, BG-01, BG-02, BG-03, BG-04

**Success Criteria** (what must be TRUE):
  1. User can see bow sprites (wooden, composite, crossbow variants) in equipment slots
  2. User can see arrow sprites (wooden, iron, dragon variants) displayed in inventory
  3. User can see armor sprites (leather, chain, plate variants) on character
  4. User can see helm sprites (basic, iron, dragon variants) on character
  5. User can verify GearSlot supports AnimatedSprite2D for equipment
  6. User can see main menu button icons rendered correctly
  7. User can see HUD icons (health, arrows, ability cooldowns) in combat
  8. User can see inventory slot icons displayed in inventory screen
  9. User can see equipment slot icons (helm, armor, bow, arrow, amulet) in loadout
  10. User can see store/cosmetic shop icons in store interface
  11. User can see main menu background tiles (no blur/pixelation)
  12. User can see gameplay arena background tiles during combat
  13. User can see forest background tiles in outdoor scenes
  14. User can see environment props (trees, rocks, obstacles) rendered crisply

**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 05. Project Settings & Import Pipeline | 3/3 | Complete    | 2026-03-24 |
| 06. Player Character Animation | 2/2 | Planned | - |
| 07. Enemy Sprites | 0/? | Not started | - |
| 08. Equipment & UI Sprites | 0/? | Not started | - |

---

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROJ-01 | Phase 05 | Pending |
| PROJ-02 | Phase 05 | Pending |
| PROJ-03 | Phase 05 | Complete |
| PROJ-04 | Phase 05 | Complete |
| PLAY-01 | Phase 06 | Pending |
| PLAY-02 | Phase 06 | Pending |
| PLAY-03 | Phase 06 | Pending |
| PLAY-04 | Phase 06 | Pending |
| PLAY-05 | Phase 06 | Pending |
| PLAY-06 | Phase 06 | Pending |
| PLAY-07 | Phase 06 | Pending |
| PLAY-08 | Phase 06 | Pending |
| ENEM-01 | Phase 07 | Pending |
| ENEM-02 | Phase 07 | Pending |
| ENEM-03 | Phase 07 | Pending |
| ENEM-04 | Phase 07 | Pending |
| ENEM-05 | Phase 07 | Pending |
| ENEM-06 | Phase 07 | Pending |
| ENEM-07 | Phase 07 | Pending |
| ENEM-08 | Phase 07 | Pending |
| ENEM-09 | Phase 07 | Pending |
| ENEM-10 | Phase 07 | Pending |
| WEAP-01 | Phase 08 | Pending |
| WEAP-02 | Phase 08 | Pending |
| WEAP-03 | Phase 08 | Pending |
| WEAP-04 | Phase 08 | Pending |
| WEAP-05 | Phase 08 | Pending |
| UI-01 | Phase 08 | Pending |
| UI-02 | Phase 08 | Pending |
| UI-03 | Phase 08 | Pending |
| UI-04 | Phase 08 | Pending |
| UI-05 | Phase 08 | Pending |
| BG-01 | Phase 08 | Pending |
| BG-02 | Phase 08 | Pending |
| BG-03 | Phase 08 | Pending |
| BG-04 | Phase 08 | Pending |

**Coverage:** 41/41 requirements mapped ✓

---

## Dependencies

```
Phase 05: Project Settings & Import Pipeline (foundation for all)
    ↓
Phase 06: Player Character Animation (depends on 05)
Phase 07: Enemy Sprites (depends on 05)
Phase 08: Equipment & UI Sprites (depends on 05)
```

---

## Milestone History

- ✅ **v3.1.0 Polish & Juice** — Phases 01-04 (shipped 2026-03-24)
- ✅ **v3.0.0 Visual Improvements** — Phases 1-4 (shipped 2026-03-24)

---

*Roadmap created: 2026-03-24*
*Granularity: standard (4 phases)*
*Requirements coverage: 41/41 (100%)*