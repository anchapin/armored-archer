# Roadmap: Armored Archer

**Current Milestone:** v3.6.0 - [Planning]
**Last Updated:** 2026-04-08

---

## Milestones

- ✅ **v2.0.0 Go Backend Migration** - Phases 1-15 (shipped 2026-03-15)
- ✅ **v2.1.0 Alpha Launch & Stabilization** - Phases 1-6 (shipped 2026-03-17)
- ✅ **v2.2.0 UI/UX Polish** - Phases 1-4 (shipped 2026-03-18)
- ✅ **v2.3.0 Testing & QA Infrastructure** - Phases 1-5 (shipped 2026-03-24)
- ✅ **v3.0.0 Visual Improvements** - Phases 1-4 (shipped 2026-03-24)
- ✅ **v3.1.0 Polish & Juice** - Phases 1-4 (shipped 2026-03-27)
- ✅ **v3.2.0 Pixel Art** - Phases 05-08 (shipped 2026-04-08)
- ✅ **v3.3.0 - Polish & Juice** - Phases 1-4 (shipped 2026-03-27)
- ✅ **v3.4.0 Tactical Gameplay & PvE Campaign** - Phases 1-5 (shipped 2026-04-06)
- ✅ **v3.5.0 Alpha Readiness** - Test Infrastructure Phases 1-5 (shipped 2026-03-23)
- 🚧 **v3.6.0** - Phases TBD (planned)

---

<details>
<summary>✅ v2.0.0 Go Backend Migration (Phases 1-15) - SHIPPED 2026-03-15</summary>

### Phase 1: Foundation & Setup
**Goal**: Go project structure, build pipeline, and basic modules working in Nakama

### Phase 2: Database & Storage Layer
**Goal**: All database operations, storage helpers, and caching migrated

### Phase 3: Core RPC Infrastructure
**Goal**: RPC handler infrastructure and common utilities migrated

### Phase 4: Player Systems
**Goal**: Player-related RPC handlers and logic migrated

### Phase 5: Combat System
**Goal**: Combat logic, match state, and disconnect handling migrated

### Phase 6: Matchmaking System
**Goal**: Match creation, listing, and completion migrated

### Phase 7: Gear & Inventory System
**Goal**: Gear generation, inventory management, and loadout migrated

### Phase 8: RPG & Progression System
**Goal**: XP, level, stat allocation migrated

### Phase 9: Season & Leaderboard System
**Goal**: Seasonal content, leaderboards, and rewards migrated

### Phase 10: Store & IAP System
**Goal**: In-app purchase validation and processing migrated

### Phase 11: Notifications & Scheduling
**Goal**: Push notifications and scheduled tasks migrated

### Phase 12: Observability & Health
**Goal**: Metrics, health checks, alerting migrated

### Phase 13: Integration Testing
**Goal**: All integration tests converted and passing

### Phase 14: Cleanup & Documentation
**Goal**: TypeScript removed, docs updated, ready for alpha

### Phase 15: Alpha Readiness
**Goal**: Final validation, performance check, alpha deployment

**Completion Summary**: 68% faster response times, 50% less memory usage, 234 integration tests, 0 critical vulnerabilities
</details>

<details>
<summary>✅ v2.1.0 Alpha Launch & Stabilization (Phases 1-6) - SHIPPED 2026-03-17</summary>

### Phase 1: Alpha Deployment
**Goal**: Deploy alpha version with monitoring

### Phase 2: Monitoring & Observability
**Goal**: Comprehensive metrics, logging, and alerting

### Phase 3: Alpha User Onboarding
**Goal**: User feedback systems and onboarding flow

### Phase 4: Stability & Bug Fixes
**Goal**: Resolve critical and high-severity bugs

### Phase 5: Performance Optimization
**Goal**: Optimize response times and resource usage

### Phase 6: Beta Readiness
**Goal**: Prepare for beta launch with stable platform

**Completion Summary**: 50+ active alpha users, error rate < 0.5%, P95 latency < 80ms, 0 critical/high bugs
</details>

<details>
<summary>✅ v2.2.0 UI/UX Polish (Phases 1-4) - SHIPPED 2026-03-18</summary>

### Phase 1: Design System Foundation
**Goal**: DesignTokens and ThemeManager implementation

### Phase 2: Core UI Components
**Goal**: 8 base UI components with design tokens

### Phase 3: Screen Improvements
**Goal**: Migrate all major UI screens to design system

### Phase 4: Animation & Polish
**Goal**: UI animations and accessibility features

**Completion Summary**: DesignTokens (50+ tokens), 8 base components, all 11 UI screens migrated, UIAutomation system, AccessibilityManager, light/dark themes
</details>

<details>
<summary>✅ v3.1.0 Polish & Juice (Phases 1-4) - SHIPPED 2026-03-27</summary>

**Particle effects, post-processing, UI polish for enhanced visual feedback**

- [x] Phase 01: Particle System Foundation — particle nodes, emission patterns
- [x] Phase 02: Post-Processing Effects — bloom, color grading, screen effects
- [x] Phase 03: UI Polish & Animations — smooth transitions, hover states, loading indicators
- [x] Phase 04: Audio Polish & Effects — sound effects, audio balance, spatial audio

**Delivered:** particle system, post-processing shaders, UI animations, enhanced audio feedback
</details>

<details>
<summary>✅ v3.2.0 Pixel Art (Phases 05-08) - SHIPPED 2026-04-08</summary>

**Pixel-perfect rendering pipeline, character animations, enemy sprites, equipment, and UI icons**

- [x] Phase 05: Project Settings & Import Pipeline (3 plans) — pixel-perfect viewport, folder structure
- [x] Phase 06: Beta Readiness (2 plans) — beta deployment infrastructure, health verification
- [x] Phase 06: Coverage Reporting (5 plans) — coverage measurement, quality gates
- [x] Phase 06: Player Character Animation (3 plans) — 168 sprite frames, AnimatedSprite2D integration
- [x] Phase 07: Enemy Sprites (2 plans) — 928 enemy sprites, 8 types, full animations
- [x] Phase 07: Test Infrastructure (2 plans) — Go testify, Godot GUT enhancements
- [x] Phase 08: Equipment & UI Sprites (2 plans) — 31 equipment sprites, 5 UI icons
- [x] Phase 08: Fix Broken Packages (18 plans) — dependency fixes, linting, CI quality gates

**Delivered:** 36/36 requirements, ~1,100 sprites, ~83,839 Godot LOC, pixel-perfect rendering pipeline
</details>

<details>
<summary>✅ v3.4.0 Tactical Gameplay & PvE Campaign (Phases 1-5) - SHIPPED 2026-04-06</summary>

**Functional PvP and PvE gameplay loops with campaign progression**

- [x] Phase 01: PvP Backend Integration — matchmaking, combat sync, gear loadouts
- [x] Phase 02: Campaign Map & Encounters — campaign navigation, stage selection, difficulty tiers
- [x] Phase 03: Enemy AI & PvE Combat — enemy turn-taking, difficulty tactics
- [x] Phase 04: Loot System & Progression — loot drops, XP, inventory integration
- [x] Phase 05: Campaign State Persistence — server sync, cross-session progress

**Delivered:** playable PvP and PvE, campaign progression, loot system, persistence
</details>

<details>
<summary>✅ v3.5.0 Alpha Readiness (Phases 1-5) - SHIPPED 2026-03-23</summary>

**Comprehensive test infrastructure and QA processes to catch bugs early, ship with confidence, test at scale**

- [x] Phase 01: Test Infrastructure Foundation — Go testify framework, GUT 9.6.0, test helpers
- [x] Phase 02: Fixtures & Mocks Layer — testcontainers-go, PostgreSQL isolation, mock validation
- [x] Phase 03: Godot Test Framework Enhancement — autoload mocking, signal testing, dependency injection
- [x] Phase 04: Load Testing Infrastructure — benchmarks, CI regression detection, performance baselines
- [x] Phase 05: Coverage, Reporting & Quality Gates — 73.3% overall coverage, mutation testing, property-based tests

**Delivered:** 13 plans across 5 phases, 73.3% overall coverage (exceeds 60% target), automated quality gates, CI integration
</details>

---
*For v3.5.0 details, see [milestones/v3.5.0-ROADMAP.md](./milestones/v3.5.0-ROADMAP.md)*
*Roadmap updated: 2026-04-08*
*Next milestone: v3.6.0 - Planning*
