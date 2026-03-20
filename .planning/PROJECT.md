# Armored Archer

## Current Milestone: v2.3.0 Testing & QA Infrastructure

**Goal:** Build comprehensive test infrastructure and QA processes to catch bugs early, ship with confidence, test at scale, and streamline QA workflows.

**Target features:**
- Comprehensive test coverage (backend, frontend, integration)
- Automated CI/CD quality gates
- Load testing and performance benchmarks
- QA workflow automation and bug tracking

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
- ✓ **Test Infrastructure Foundation** — v2.3.0 — Phase 01 — testify for Go, GUT 9.6.0 for Godot, test helpers, domain-specific assertions, organized test suite structure (15 subsystems)
- ✓ **Fixtures & Mocks Layer** — v2.3.0 — Phase 02 — Testcontainers for PostgreSQL isolation, builder pattern fixtures (292 lines), JSON serialization for cross-platform sharing, interface extraction, mock generation (uber-go/mock), mock validation tests
- ✓ **Godot Test Framework Enhancement** — v2.3.0 — Phase 03 — Autoload test isolation with ConfigFile dependency injection pattern, GUT signal testing capabilities (watch_signals, wait_for_signal), 13 comprehensive tests for AccessibilityManager and ThemeManager, fresh instance isolation pattern (ISO-04, MOCK-03)
- ✓ **Load Testing** — v2.3.0 — Phase 04 — Go RPC benchmarks, Godot 60 FPS tests, k6 load tests (100+ concurrent users), CI regression detection with benchstat
- ✓ **Performance Optimization** — v2.3.0 — Phase 05 — Redis caching (5 named caches), database query optimization (22 indexes), connection pool tuning, LRU cache eviction, Prometheus metrics for cache/latency/error rate

### Active

*Current scope. Building toward these.*

- [ ] **Beta Readiness** — Beta deployment, production monitoring, user support workflows, documentation

### Out of Scope

*Explicit boundaries. Includes reasoning to prevent re-adding.*

- **New gameplay features** — This milestone focuses on infrastructure, not content
- **Backend rewrites** — Building tests for existing Go backend, not refactoring
- **Database migrations** — No schema changes, only testing existing data layer
- **Client engine changes** — Testing Godot systems, not replacing them

### Out of Scope

*Explicit boundaries. Includes reasoning to prevent re-adding.*

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
- Godot test framework for client tests

**Known Issues to Address:**
- Test coverage is incomplete (backend has some tests, frontend has minimal)
- No automated regression testing
- No load/stress testing infrastructure
- Manual QA is ad-hoc, no systematic workflow
- CI/CD lacks comprehensive quality gates

**Prior Work:**
- v2.0.0 migrated backend from TypeScript to Go with 234 integration tests
- v2.2.0 built comprehensive UI/UX design system
- v2.1.0 added monitoring and observability (Prometheus, Grafana)

## Constraints

- **Tech Stack**: Godot 4.x, Go 1.21+, Nakama 3.x, PostgreSQL — Must work with existing stack
- **CI/CD**: GitHub Actions — Tests must run in existing pipeline
- **Timeline**: 2-3 weeks — Aggressive but achievable with focus on infrastructure
- **Performance**: Tests must complete in reasonable time (CI timeout limits)
- **Maintenance**: Test infrastructure must be maintainable, not a burden

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus on testing infrastructure | Quality foundation before scaling | — Pending |
| Build comprehensive coverage | Catch bugs early, reduce manual QA | — Pending |
| Automated quality gates | Ship with confidence | — Pending |

---
*Last updated: 2026-03-20 after Phase 05 (Complete Test Infrastructure Foundation) completion*
