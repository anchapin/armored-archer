# Armored Archer

## Current Milestone: v3.3.0 Polish & Juice

**Goal:** Expand visual effects with particles, post-processing, and UI animations

**Target features:**
- Particle effects foundation (hit particles, death explosions, arrow trails)
- Post-processing (glow, vignette, damage overlay)
- Screen effects (camera shake, slow-mo on critical)
- UI animations (transitions, button feedback, loading states)

---

## Previous: v3.2.0 Pixel Art — SHIPPED 2026-03-27

**Goal:** Create all needed pixel art sprites to replace Godot placeholder textures

**Status:** ✅ COMPLETE — Player, enemies, weapons, armor, UI icons delivered

---

## Previous: v3.1.0 Polish & Juice — SHIPPED 2026-03-24

**Goal:** Full juice pass across combat, UI, and audio

**Status:** ✅ COMPLETE — Audio foundation, combat feedback, UI polish delivered

---

## Previous: v3.0.0 Visual Improvements — SHIPPED 2026-03-24

**Goal:** Visual improvements on both interface (UI) and gameplay

**Status:** ✅ COMPLETE — Gilded Quest design system implemented

**Key Deliverables:**
- Gilded Quest design system with centralized Theme resource
- Typography scale (5 LabelSettings: 56px to 14px)
- Bubbly tactile button components with 3 states
- No-line layout system with tonal color shifts
- Glassmorphism shader for frosted glass modals
- GPU-accelerated combat particle effects (hit, trail, death)
- Hero moment post-processing shader with gold glow
- Character sprite and background infrastructure with palette management

**Key Deliverables:**
- 73.3% Go coverage (target: 60%) — 13.3 percentage points above target
- 88.73% weighted mutation score (all 6 packages passing thresholds)
- 31 property-based tests across 5 packages
- Godot line coverage instrumentation operational
- Stage 3 CI/CD gate enforcement (blocks merges below 60%)
- Fixture mapping in gap-analysis.sh for test guidance

---

## Previous: v2.3.0 Testing & QA Infrastructure (Shipped 2026-03-20)

**Delivered:** Comprehensive test infrastructure with 26 plans across 7 phases

**Infrastructure Delivered:**
- Unified test runner with race detector, test pyramid enforcement (70/20/10), and shuffle isolation
- testcontainers-go for PostgreSQL isolation with factory pattern fixtures (292 lines)
- Interface-based mocking with gomock, mock validation tests, and drift detection strategy
- Godot autoload test isolation with dependency injection and signal testing framework
- Go RPC benchmarks, Godot 60 FPS tests, and k6 load tests for 100+ concurrent players
- Code coverage measurement (Go: 17%, Godot: pass rate proxy), CI threshold enforcement (60%/80%)
- Flaky test detection, visual regression tests, and property-based testing for combat calculations
- Load tests automated with testcontainers, eliminating manual service startup dependency

**Quality Metrics:**
- Go test coverage: 17% overall (packages that compile successfully)
- Godot test pass rate: ~95% (22 test files, 13+ comprehensive tests)
- CI quality gates: Coverage thresholds, flaky test detection, benchmark regression detection
- Test infrastructure: 23,050 lines of Go code, 57 tasks completed

**Next Milestone Goals:**
- Improve test coverage to 60% overall threshold (currently at 17%)
- Fix pre-existing test compilation errors in rpg, season, store, notifications packages
- Expand critical path coverage beyond combat, matchmaking, and rpg modules

## What This Is

Armored Archer is a 2D top-down mobile archery game built with Godot 4 (client) and Go/Nakama (backend). The game features PvE auto-shooter combat, asynchronous turn-based PvP, gear system, and seasonal leaderboards.

## Core Value

**Players can enjoy a polished, responsive archery game with reliable performance and minimal bugs.**

Quality and reliability are foundational — every feature must be tested, every bug must be tracked, and every release must be verified.

## Requirements

### Validated

*Shipped and confirmed valuable.*

- ✓ **UI/UX Design System** — v2.2.0 — DesignTokens, ThemeManager, 8 base components, all screens migrated
- ✓ **Go Backend Migration** — v2.0.0 — Complete TypeScript to Go migration with 234 integration tests
- ✓ **Core Gameplay** — v1.x — Combat, matchmaking, gear, progression, seasons
- ✓ **Alpha Launch** — v2.1.0 — Monitoring, observability, user onboarding
- ✓ **Beta Readiness** — v2.1.0 Phase 06 — Beta deployment infrastructure, Docker Compose configuration, automated health checks (19 tests), all 6 services healthy (postgres, redis, nakama, prometheus, grafana)
- ✓ **Test Infrastructure Foundation** — v2.3.0 — Phase 01 — testify for Go, GUT 9.6.0 for Godot, test helpers, domain-specific assertions, organized test suite structure (15 subsystems)
- ✓ **Fixtures & Mocks Layer** — v2.3.0 — Phase 02 — Testcontainers for PostgreSQL isolation, builder pattern fixtures (292 lines), JSON serialization for cross-platform sharing, interface extraction, mock generation (uber-go/mock), mock validation tests
- ✓ **Godot Test Framework Enhancement** — v2.3.0 — Phase 03 — Autoload test isolation with ConfigFile dependency injection pattern, GUT signal testing capabilities (watch_signals, wait_for_signal), 13 comprehensive tests for AccessibilityManager and ThemeManager, fresh instance isolation pattern (ISO-04, MOCK-03)
- ✓ **Load Testing** — v2.3.0 — Phase 04 — Go RPC benchmarks, Godot 60 FPS tests, k6 load tests (100+ concurrent users), CI regression detection with benchstat
- ✓ **Performance Optimization** — v2.3.0 — Phase 05 — Redis caching (5 named caches), database query optimization (22 indexes), connection pool tuning, LRU cache eviction, Prometheus metrics for cache/latency/error rate
- ✓ **Coverage, Reporting & Quality Gates** — v2.3.0 — Phase 06 — Go coverage reporting (17%), Godot coverage proxy (pass rate), CI thresholds (60%/80%), flaky test detection (3x retry), visual regression tests (8 UI components), property-based tests (13 tests), automated quality gates
- ✓ **Test Infrastructure Integration** — v2.3.0 — Phase 07 — Benchmarks use factory functions (15 lines raw SQL removed), load tests use testcontainers for automated Nakama provisioning, fail-fast NAKAMA_URL validation
- ✓ **Fix Broken Packages & Establish Quality Gates** — v2.4.0 — Phase 08 — All 27 Go packages compile and pass tests, baseline coverage measurement (34.5%), assertion quality gate, gap analysis script, CI threshold enforcement (60%/80%), package-level coverage tracking
- ✓ **Critical Path Coverage** — v2.4.0 — Phase 09 — 80%+ test coverage achieved on combat (83.7%), matchmaking, and progression systems using table-driven tests and statistical validation
- ✓ **Godot Frontend Test Coverage** — v2.4.0 — Phase 10 — 102 autoload tests (NetworkManager: 30, CombatManager: 29, GameManager: 30, AccessibilityManager: 6, ThemeManager: 7), 100% pass rate with Godot 4.6.1 + GUT 9.5.0, autoload-to-test mapping, isolation patterns documented (544 lines)
- ✓ **Test Suite Optimization** — v2.4.0 — Phase 11 — Parallel test execution (Go 4 workers, Jest 2 workers), flaky test detection with automatic quarantine (Go build tags, Godot JSON registry), 60 performance benchmarks for critical paths
- ✓ **CI/CD Threshold Enforcement** — v2.4.0 — Phase 12 — Package-level coverage tracking, incremental threshold gates (30%→45%→60%), regression detection, coverage dashboard with progress bars and trend charts, PR comment integration, 10 new Makefile targets
- ✓ **Godot Coverage Tools** — v2.5.0 — Phase 13 — Custom line coverage instrumentation (CoverageTracker, ScriptLineParser, CoverageExporter), HTML report generation with Jinja2, GUT 9.6.0 integration, 50% threshold enforcement in CI/CD, coverage dashboard extended with Godot metrics
- ✓ **Go Coverage to 60%** — v2.5.0 — Phase 16, 27 — 73.3% coverage achieved (exceeds 60% target), critical path at 90%+ (combat 92.3%, matchmaking 95.8%, RPG 94.4%), gap analysis automation with fixture suggestions
- ✓ **Mutation Testing Integration** — v2.5.0 — Phase 14, 23 — 88.73% weighted mutation score, all 6 packages pass thresholds (combat 94.74%, matchmaking 91.43%, rpg 75.26%, store 85.96%, season 86.76%, notifications 94.62%), nightly workflow configured
- ✓ **Property-Based Testing Expansion** — v2.5.0 — Phase 15, 22 — 31 property tests across 5 packages (progression, matchmaking, inventory, combat, RNG), all invariants verified, 100% pass rate
- ✓ **CI/CD Enforcement** — v2.5.0 — Phase 17, 26 — Stage 3 gate (60%) blocks merges, incremental gates (30%→45%→60%→73.3%), regression detection, PR comment integration operational
- ✓ **Gilded Quest Design System** — v3.0.0 — Centralized Theme resource, typography scale, no-line layout, glassmorphism shader
- ✓ **Combat Particles & Hero Moments** — v3.0.0 — GPU-accelerated particles, screen-space glow shader
- ✓ **Visual Assets Infrastructure** — v3.0.0 — Character sprites and backgrounds with palette management

### Active

*Current scope. Building toward these.*

- [ ] **Pixel Art Sprites** — Player, enemies, weapons, armor, UI icons, backgrounds

### Out of Scope

*Explicit boundaries. Includes reasoning to prevent re-adding.*

- **New gameplay features** — Focus on infrastructure improvements, not content expansion
- **Backend rewrites** — Building tests for existing Go backend, not refactoring
- **Database migrations** — No schema changes, only testing existing data layer
- **Client engine changes** — Testing Godot systems, not replacing them

### Out of Scope

- **New gameplay features** — This milestone focuses on infrastructure, not content
- **Backend rewrites** — Building tests for existing Go backend, not refactoring
- **Database migrations** — No schema changes, only testing existing data layer
- **Client engine changes** — Testing Godot systems, not replacing them

## Context

**Technical Environment:**
- Godot 4.x for game client (GDScript)
- Go 1.21+ for Nakama backend
- PostgreSQL for data persistence
- Jest for existing backend tests
- GUT 9.5.0 for Godot test framework
- testify v1.11.1 for Go assertions
- testcontainers-go for PostgreSQL isolation

**Current State (Post v2.4.0):**
- Go test coverage: 34.5% overall (up from 17% baseline) across 27 packages
- Godot test pass rate: 100% (22 test files, 102 autoload tests)
- CI/CD: Coverage thresholds enforced (60% overall, 80% critical), incremental gates (30%→45%→60%), regression detection active
- Test infrastructure: Parallel execution (Go 4 workers, Jest 2 workers), flaky test quarantine, 60 performance benchmarks, coverage dashboard with PR integration
- 89,588 lines of code (Go + GDScript), 482 files modified over 19 days

**Prior Work:**
- v2.0.0 migrated backend from TypeScript to Go with 234 integration tests
- v2.2.0 built comprehensive UI/UX design system
- v2.1.0 added monitoring and observability (Prometheus, Grafana)
- v2.3.0 established comprehensive test infrastructure foundation
- v2.4.0 improved test coverage and added CI/CD threshold enforcement

## Constraints

- **Tech Stack**: Godot 4.x, Go 1.21+, Nakama 3.x, PostgreSQL — Must work with existing stack
- **CI/CD**: GitHub Actions — Tests must run in existing pipeline
- **Timeline**: 2-3 weeks — Aggressive but achievable with focus on infrastructure
- **Performance**: Tests must complete in reasonable time (CI timeout limits)
- **Maintenance**: Test infrastructure must be maintainable, not a burden

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus on testing infrastructure | Quality foundation before scaling | ✓ Good — 26 plans delivered, comprehensive infrastructure in place |
| Build comprehensive coverage | Catch bugs early, reduce manual QA | ✓ Good — Coverage measurement, CI thresholds, quality gates operational |
| Automated quality gates | Ship with confidence | ✓ Good — Flaky test detection, benchmark regression, visual regression all working |
| testcontainers for isolation | Fast, isolated tests without external deps | ✓ Good — PostgreSQL and Nakama containers automated, tests run in isolation |
| Pass rate as Godot coverage proxy | Godot lacks line coverage instrumentation | ✓ Good — Documented in REQUIREMENTS.md, acceptable trade-off |
| Mock validation tests | Prevent drift between mocks and real implementation | ✓ Good — 15 validation tests catch interface changes early |
| Unified test runner | Single command for all tests | ✓ Good — `./scripts/test-all.sh` runs Go and Godot tests with consolidated report |
| Test pyramid enforcement | Maintain 70/20/10 unit/integration/E2E ratio | ✓ Good — Automated check in CI, prevents test suite bloat |
| Property-based testing | Find edge cases in combat and RNG systems | ✓ Good — 13 rapid tests catch edge cases unit tests miss |
| Critical path first (80% before 60%) | Maximize bug detection per test written | ✓ Good — Combat, matchmaking, progression at 80%+ coverage before targeting overall 60% |
| Incremental threshold gates (30%→45%→60%) | Prevent overwhelming developers with 17%→60% jump | ✓ Good — Measurable progress, achievable milestones |
| Go build tags for flaky test quarantine | Standard Go practice for conditional compilation | ✓ Good — Automatic quarantine preserves test code while preventing execution |
| Gap analysis script for zero-coverage functions | Identify untested areas systematically | ✓ Good — Priority recommendations by package, enables focused test writing |
| Static HTML coverage dashboard | No build step required, view directly in browser | ✓ Good — Progress bars, trend charts, responsive design without dependencies |
| PR comment integration for coverage feedback | Immediate visibility into coverage changes | ✓ Good — Automated comments with summary table, dashboard artifact upload |
| PR comment integration for coverage feedback | Immediate visibility into coverage changes | ✓ Good — Automated comments with summary table, dashboard artifact upload |
a| **Phase 16: Go Coverage to 60%** — Shipped 2026-03-22
   - Built comprehensive test infrastructure with gap analysis automation and incremental threshold enforcement
   - Improved coverage from 34.5% to 47.4% through systematic test writing
   - Critical packages exceeded targets: RPG 94.4%, Matchmaking 95.8%, Store 91.0%, Season 90.1%
   - Logger and cache packages closed (0% → 100%)
   - CI/CD gates verified and operational
   - 47.4% overall coverage achieved (12.6% gap from 60% target, acceptable as strategic milestone)
   166→---

---
*Last updated: 2026-03-24 after v3.2.0 milestone start*
