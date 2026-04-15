# Changelog

All notable changes to Armored Archer Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
