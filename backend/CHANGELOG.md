# Changelog

All notable changes to Armored Archer Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-04-19

### Added

- Funnel drop-off analytics for install→PvE→PvP→purchase conversion tracking
- Trust system audit logging for purchases and entitlements
- Balancing session simulator with simulated player cohorts
- Season telemetry for rank inflation, reward concentration, progression velocity
- Season admin tools for state validation and management
- Cross-device cosmetic sync for ownership and transmog
- Launch cosmetics packaging with Founder's bundle
- Store graceful fallback messaging for provider outages
- Feedback collector for beta user input
- Usability session plan and critical UX fixes

### Changed

- Tuned gameplay balance: stage pacing, drop rates, punch-up risk/reward, season rewards
- Consolidated crash/error monitoring, analytics, and health checks
- Enforced gems can only purchase cosmetics with zero combat impact
- Unified XP curves with season economy hardening
- Improved touch controls: dual joystick, aim smoothing, safe area handling, haptic feedback

### Fixed

- All P0/P1 trust-system blockers resolved
- CI pipeline failures (lint, complexity, coverage)
- Store/gem/transmog system bugs from Sprint 6
- Flaky parallel CI failures from Docker conflicts
- RPG system validation schemas
- Coverage workflow TypeScript migration

### Documentation

- Release Candidate Checklist & Sign-Off Package (`docs/RELEASE_CANDIDATE_CHECKLIST.md`)
- Release Notes v3.6.0 (`docs/RELEASE_NOTES_v3.6.0.md`)
- Closed Beta Checklist with owners and go/no-go criteria
- Support/FAQ playbook for beta users
- App store submission documentation and assets

---

## [1.1.0] - 2026-04-14

### 🔄 Changed - Backend Runtime Decision

**TypeScript Confirmed as Authoritative Backend**

After attempting a migration to Go, TypeScript has been confirmed as the authoritative backend runtime for Armored Archer.

### 🗑️ Removed - Go Backend Artifacts

- Moved `README_GO.md` to `.deprecated/` (Go backend documentation)
- Updated `MIGRATION_SUMMARY.md` with deprecation notice

### 📝 Documentation

- Updated `README.md` to remove misleading migration notice
- Added deprecation section documenting the abandoned Go migration
- Confirmed TypeScript as the active, running backend

### 💬 Context

The Go migration (started 2026-03-15) was abandoned due to:
- Incompatible Go version issues (disabled in nakama.yml)
- Incomplete migration (Phases 14-15 pending)
- TypeScript backend remains fully functional and actively developed

See `MIGRATION_SUMMARY.md` for full details on the abandoned migration.

---

## [1.0.0] - 2024-XX-XX

### ✨ Added

- Initial TypeScript backend implementation
- Nakama server integration with ES5 JavaScript runtime
- PostgreSQL database with migrations
- Redis caching layer
- Player stats system
- Combat system
- Gear generation and inventory
- Matchmaking (PvP)
- Seasonal system and leaderboards
- Store and IAP integration
- Push notifications
- Analytics tracking
- Circuit breaker pattern
- Structured logging
- Health checks
- Prometheus metrics
- Grafana dashboards

### 🔧 Build System

- TypeScript compilation with tsc
- Webpack bundling for Nakama runtime
- Babel transpilation to ES5
- Bundle validation scripts
- npm-based development workflow

### 🧪 Testing

- Jest test framework
- Integration tests
- Unit tests
- Code coverage reporting
- CI/CD integration

---

## Deprecated: Go Migration (Abandoned)

### Original Plan (Abandoned 2026-04-14)

A Go backend migration was attempted in 2026-03-15 but was never completed. The following was planned but never integrated:

### Planned but Never Released

- Go backend (internal/ packages)
- Go plugin system
- 234 integration tests (not integrated into CI)

### Reasons for Abandonment

1. **Incompatible Go Version**: Go backend disabled in nakama.yml
2. **Incomplete Migration**: Phases 14-15 (cleanup, alpha) never completed
3. **TypeScript Never Removed**: Source and build pipeline still active
4. **No Integration**: Never added to CI/CD or production

### Files from Abandoned Migration

The following files exist but are NOT active:
- `backend/internal/` - Go source code (deprecated)
- `backend/cmd/` - Go entry point (deprecated)
- `backend/go.mod`, `backend/go.sum` - Go modules (deprecated)
- `.deprecated/README_GO.md` - Go documentation (deprecated)

These can be removed if the team confirms TypeScript is the definitive choice.

---

**Current Runtime**: TypeScript (Nakama JS runtime)
**Backend Status**: TypeScript is authoritative and active
**Go Migration Status**: Abandoned
