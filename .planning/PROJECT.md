# Armored Archer

## Current Milestone: v3.6.0 - Planning

**Goal:** [To be determined via `/gsd:new-milestone`]

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
- ✓ **Test Infrastructure** — v2.3.0 — Go testify, Godot GUT, unified test runner, fixtures, mocks
- ✓ **Visual Improvements** — v3.0.0 — Particle effects, post-processing shaders
- ✓ **Polish & Juice** — v3.1.0 — Enhanced UI animations, audio polish
- ✓ **Pixel Art** — v3.2.0 — 1,100+ sprites, pixel-perfect rendering, character/enemy animations
- ✓ **Tactical Gameplay** — v3.4.0 — PvP backend integration, PvE campaign, enemy AI, loot system, campaign persistence
- ✓ **Alpha Readiness** — v3.5.0 — Test infrastructure (75 plans), 73.3% overall coverage, CI quality gates, load testing benchmarks

### Active

*Current scope. Planning next milestone.*

- [ ] [To be defined via `/gsd:new-milestone`]


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
- testify for Go backend tests
- Godot GUT framework for client tests

**Current Codebase State:**
- Godot LOC: ~83,839 lines
- Backend: Go migration complete, TypeScript removed
- Coverage: 73.3% overall, 92-95% on critical paths (v3.5.0 achieved)
- Sprites: 1,100+ pixel art assets created
- Animations: Player character, 8 enemy types fully animated
- Equipment: 31 equipment sprites, 5 UI icons
- Test Infrastructure: Go testify, Godot GUT 9.6.0, testcontainers, CI quality gates

**Prior Work:**
- v2.0.0 migrated backend from TypeScript to Go with 234 integration tests
- v2.2.0 built comprehensive UI/UX design system
- v2.1.0 added monitoring and observability (Prometheus, Grafana)
- v3.0.0 added particle effects and post-processing shaders
- v3.1.0 enhanced UI animations and audio polish
- v3.2.0 created 1,100+ sprites with pixel-perfect rendering
- v3.4.0 implemented PvP and PvE gameplay loops with campaign progression
- v3.5.0 built comprehensive test infrastructure (75 plans, 73.3% coverage, CI gates)

## Constraints

- **Tech Stack**: Godot 4.x, Go 1.21+, Nakama 3.x, PostgreSQL — Must work with existing stack
- **CI/CD**: GitHub Actions — Tests must run in existing pipeline
- **Timeline**: 2-3 weeks — Aggressive but achievable with focus on infrastructure
- **Performance**: Tests must complete in reasonable time (CI timeout limits)
- **Maintenance**: Test infrastructure must be maintainable, not a burden

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Testify framework for Go | Leverage mature assertion library instead of custom helpers | ✓ Good (v3.5.0) |
| Testcontainers for DB isolation | Realistic integration tests with disposable containers | ✓ Good (v3.5.0) |
| ConfigFile DI for Godot autoloads | Enable autoload mocking without singleton issues | ✓ Good (v3.5.0) |
| Coverage target 60% (v3.5.0) | Incremental improvement from previous state | ✓ Achieved (73.3% actual) |

---
*Last updated: 2026-04-08 after completing v3.5.0 milestone*
