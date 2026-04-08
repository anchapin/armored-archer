# Armored Archer - Requirements

**Current Milestone:** v4.0.0 - Gameplay Refinement
**Last Updated:** 2026-04-08

---

## Requirements

### Validated Requirements

*Shipped and confirmed valuable.*

- ✓ **UI/UX Design System** — v2.2.0 — DesignTokens, ThemeManager, 8 base components, all screens migrated
- ✓ **Go Backend Migration** — v2.0.0 — Complete TypeScript to Go migration with 234 integration tests
- ✓ **Core Gameplay** — v1.x — Combat, matchmaking, gear, progression, seasons
- ✓ **Alpha Launch** — v2.1.0 — Monitoring, observability, user onboarding
- ✓ **Test Infrastructure** — v2.3.0 — Go testify, Godot GUT, unified test runner, fixtures, mocks
- ✓ **Visual Improvements** — v3.0.0 — Particle effects, post-processing shaders
- ✓ **Polish & Juice** — v3.1.0 — Enhanced UI animations, audio polish
- ✓ **Pixel Art** — v3.2.0 — 1,100+ sprites, pixel-perfect rendering, character/enemy animations
- ✓ **Tactical Gameplay** — v3.4.0 — PvP backend integration, PvE campaign, enemy AI, loot system, campaign persistence

### Active Requirements

*Current scope. Building toward these.*

#### COMBAT-01: Attack Timing Refinement
Player attacks have consistent timing with clear wind-up and release frames.

#### COMBAT-02: Hit Detection Feedback
Visual feedback shows when attacks connect (damage numbers, hit effects, screen shake).

#### COMBAT-03: Damage Calculation Validation
Damage formulas are consistent between PvP and PvE modes with clear stat-to-damage mapping.

#### COMBAT-04: Weapon Variety
Multiple weapon types (bows, crossbows) have distinct attack patterns, ranges, and power curves.

#### COMBAT-05: Critical Hit Reactions
Enemies flash white when critically hit, pause briefly, then react with distinct animations.

#### ENEMY-01: New Enemy Types
3-5 new enemy types added (e.g., elementals, flying, swarmers) with unique AI patterns.

#### ENEMY-02: Boss Encounter System
3 boss types with distinct phases, special attacks, and loot tables.

#### ENEMY-03: AI Pattern Variety
Enemies use varied behaviors (aggressive, defensive, pack-hunting, ambush) across encounter types.

#### PVP-01: Weapon/Power Balancing
Weapon damage curves balanced across all tiers to prevent one-shot exploits.

#### PVP-02: Matchmaking Fairness
Ranking system accounts for player skill difference with balanced matchmaking pools.

#### PVP-03: Ranking System
Leaderboards track seasonal progress with decay to prevent farming.

#### PROG-01: XP Curve Tuning
Level progression uses satisfying growth curves (early levels faster, later levels more grindy but rewarding).

#### PROG-02: Level Scaling
Enemy difficulty scales appropriately with player level (both damage and AI behavior).

#### PROG-03: Stat Allocation System
Players can respec stats with cost to encourage diverse builds.

#### PROG-04: Gear Stat Balance
Equipment stats have diminishing returns to prevent power stacking exploits.

#### JUICE-01: Impact Effects
Strong attacks have screen shake and particle bursts on impact.

#### JUICE-02: Damage Indicators
Floating damage numbers show amount dealt with appropriate color coding (green for weak, red for critical).

#### JUICE-03: Hit Reactions
Player character briefly flinches or stutters when taking damage.

#### JUICE-04: Kill Feedback
Enemies have clear death animations with ragdoll-like effects.

#### DIFFICULTY-01: Dynamic Difficulty Adjustment
Game adjusts difficulty based on player performance (win streaks increase challenge, losing streaks reduce it).

#### DIFFICULTY-02: Pacing Variety
Encounters include varied pacing (intense combat, exploration puzzles, narrative downtime).

#### DIFFICULTY-03: Clear Progression Indicators
Players always know what to do next (map markers, quest objectives, level requirements).

---

## Out of Scope

### Deferred Features
*Items moved to future milestones or explicitly not in current scope.*

- New game modes (Capture the Flag, Survival Mode)
- Guild/Team system
- Trading/Auction house
- Housing/Base building
- Pet/Mount system
- Complex crafting beyond gear stat system
- Weather effects system

### Explicitly Excluded

*Items decided NOT to build and the reasoning.*

- Backend rewrite from Go back to TypeScript (maintain Go performance)
- Godot engine upgrade (stay on 4.x for stability)
- Mobile platform expansion (focus on Linux/Web first)
- In-app purchase overhaul (revenuecat integration sufficient for now)
- Voice chat system (text chat meets current needs)

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMBAT-01 | Phase 1 | Pending |
| COMBAT-02 | Phase 1 | Pending |
| COMBAT-03 | Phase 1 | Pending |
| COMBAT-04 | Phase 1 | Pending |
| COMBAT-05 | Phase 1 | Pending |
| ENEMY-01 | Phase 2 | Pending |
| ENEMY-02 | Phase 2 | Pending |
| ENEMY-03 | Phase 2 | Pending |
| JUICE-01 | Phase 3 | Pending |
| JUICE-02 | Phase 3 | Pending |
| JUICE-03 | Phase 3 | Pending |
| JUICE-04 | Phase 3 | Pending |
| PVP-01 | Phase 4 | Pending |
| PVP-02 | Phase 4 | Pending |
| PVP-03 | Phase 4 | Pending |
| PROG-01 | Phase 5 | Pending |
| PROG-02 | Phase 5 | Pending |
| PROG-03 | Phase 5 | Pending |
| PROG-04 | Phase 5 | Pending |
| DIFFICULTY-01 | Phase 5 | Pending |
| DIFFICULTY-02 | Phase 5 | Pending |
| DIFFICULTY-03 | Phase 5 | Pending |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
