# Armored Archer

## Current Milestone: v4.0.0 Gameplay Refinement

**Goal:** Comprehensive gameplay improvements and balancing across combat, enemies, PvP, and progression systems.

**Target features:**
- Combat system refinement (attack timing, hit detection, damage calculation, weapon variety)
- Enemy variety & behaviors (new enemy types, AI patterns, boss encounters)
- PvP balance adjustments (weapon/power balancing, matchmaking fairness, ranking systems)
- Progression tuning (XP curves, level scaling, stat allocation, gear stat balance)
- Combat "juice" and feedback (impact effects, damage indicators, hit reactions)
- Game difficulty and pacing (address "too hard" and "bland" issues)

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

### Active

*Current scope. Building toward these.*

- [ ] **Performance Benchmarking** — Validate response times, memory usage, and frame rate targets
- [ ] **Load Testing** — Stress test with 1000+ concurrent users
- [ ] **Security Review** — Vulnerability assessment, input validation audit, penetration testing
- [ ] **Alpha Deployment** — Deployment pipeline, rollback procedures, environment configuration
- [ ] **Monitoring Setup** — Alert rules, dashboards, error tracking integration

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
- Coverage: 94.55% backend lines
- Sprites: 1,100+ pixel art assets created
- Animations: Player character, 8 enemy types fully animated
- Equipment: 31 equipment sprites, 5 UI icons

**Known Issues to Address:**
- Load testing not executed (k6 scripts ready)
- Security review pending for alpha launch
- Performance baselines not yet established
- Monitoring dashboards need alpha configuration

**Prior Work:**
- v2.0.0 migrated backend from TypeScript to Go with 234 integration tests
- v2.2.0 built comprehensive UI/UX design system
- v2.1.0 added monitoring and observability (Prometheus, Grafana)
- v3.0.0 added particle effects and post-processing shaders
- v3.1.0 enhanced UI animations and audio polish
- v3.2.0 created 1,100+ sprites with pixel-perfect rendering
- v3.4.0 implemented PvP and PvE gameplay loops with campaign progression

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
*Last updated: 2026-04-08 after completing v3.2.0, v3.4.0, and Phase 05 (Campaign Persistence)*
