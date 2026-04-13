# ADR-001: Authoritative Backend Runtime Decision

**Status:** Accepted
**Date:** 2026-04-13
**Context:** Sprint 0 — Architecture Decision and Backlog Lock (GitHub #672)

---

## Context

The Armored Archer project currently has **two backend implementations** for the Nakama game server:

### TypeScript Backend (`backend/src/`)
- **Current Status:** ACTIVE (deployed via `js_entrypoint: "modules/index.js"`)
- **Location:** `backend/src/modules/`
- **Features:**
  - 30+ RPC handlers with comprehensive error handling
  - Rate limiting per endpoint
  - OpenTelemetry tracing (OTEL) integration
  - Sentry error tracking
  - Structured logging (Winston)
  - Progressive rollout flags
  - N+1 query detection
  - Health monitoring
  - Circuit breakers for resilience
  - Analytics and event tracking
  - Notification scheduling
  - Campaign progression tracking
  - Store/IAP validation
  - Anti-cheat mechanisms
  - Tech debt tracking
  - Extensive test coverage (234 integration tests)
- **Deployment:** Docker Compose builds `npm run build:full` → `build/index.js`
- **Entry Point:** `backend/src/index.ts` → `InitModule`

### Go Backend (`backend/internal/`, `backend/cmd/`)
- **Current Status:** DISABLED (commented out in `nakama.yml`)
- **Location:** `backend/internal/`, `backend/cmd/server/main.go`
- **Features:**
  - Basic RPC handlers (~20)
  - Cache manager implementation
  - Database abstraction layer
  - Config system
  - Basic observability
- **Disabled Reason:** Comment in `nakama.yml` states "Go backend disabled - built with incompatible Go version"
- **Entry Point:** `backend/cmd/server/main.go` → `InitModule`

### Stack Ambidity Issues

1. **Confusing documentation:** `PROJECT.md` claims "Go 1.21+ for Nakama backend" but TypeScript is actually running
2. **Makefile confusion:** Both `backend-test` and `backend-test-go` targets exist
3. **Unclear ownership:** Which implementation is the "source of truth"?
4. **Duplicate code:** Similar RPC handlers exist in both implementations
5. **Maintenance burden:** Two codebases to maintain and test

---

## Decision

**Choose TypeScript as the authoritative backend runtime.**

### Rationale

| Factor | TypeScript | Go | Verdict |
|---------|-------------|-----|---------|
| **Feature completeness** | 30+ RPCs, observability, anti-cheat, notifications | ~20 RPCs, basic features | ✅ TypeScript |
| **Deployment state** | Currently deployed and working | Disabled (incompatible version) | ✅ TypeScript |
| **Test coverage** | 234 integration tests, extensive unit tests | Basic tests | ✅ TypeScript |
| **Observability** | Full OTEL, Sentry, Prometheus, Grafana, Tempo | Basic metrics | ✅ TypeScript |
| **Error tracking** | Sentry integration with error insights pipeline | None | ✅ TypeScript |
| **Rate limiting** | Per-endpoint rate limits | None | ✅ TypeScript |
| **Resilience** | Circuit breakers, health monitoring | None | ✅ TypeScript |
| **Monitoring** | Health checks, dead code detection, tech debt tracking | None | ✅ TypeScript |
| **Documentation** | Inline JSDoc, READMEs, architecture docs | Minimal | ✅ TypeScript |
| **Team familiarity** | Existing tooling, scripts, CI/CD | New language | ✅ TypeScript |

### Specific Reasons

1. **Production-ready feature set:** TypeScript backend has battle-tested observability, error tracking, and resilience patterns
2. **Immediate deployment risk:** Go backend is explicitly disabled due to compatibility issues
3. **Regression risk:** Removing TypeScript backend would require re-implementing 10+ critical production features
4. **Time-to-MVP:** TypeScript backend is MVP-ready; Go backend requires weeks of feature parity work
5. **Test infrastructure:** All CI/CD pipelines run against TypeScript implementation

---

## Consequences

### Positive
- ✅ Clear single source of truth for backend logic
- ✅ Eliminate maintenance burden of dual implementations
- ✅ Faster MVP development (no migration effort required)
- ✅ Preserve existing investment in TypeScript observability and monitoring
- ✅ Continue leveraging Nakama's first-class JavaScript runtime support

### Negative
- ✗ TypeScript runtime performance is ~10-15% slower than Go (acceptable for MVP scale)
- ✗ Must maintain Node.js dependencies in deployment
- ✗ Go backend investment (~2,000 LOC) becomes technical debt

### Migration
- **Action:** Deprecate and remove Go backend
- **Timeline:** Phase out over 2 weeks during Sprint 0-1
- **Tasks:**
  1. [ ] Mark Go backend as deprecated in README
  2. [ ] Remove Go backend from Makefile (`backend-test-go`, `backend-build-go`, `backend-lint-go`)
  3. [ ] Move Go tests to archived location
  4. [ ] Remove Go backend from CI/CD
  5. [ ] Delete `backend/internal/`, `backend/cmd/`, `backend/go.mod`, `backend/go.sum`

---

## Alternatives Considered

### Alternative 1: Migrate to Go Backend
**Rejected:** Too high risk for MVP timeline
- Requires re-implementing OTEL, Sentry, rate limiting, circuit breakers
- Unknown compatibility issues with Nakama Go runtime
- Would delay MVP by 4-6 weeks

### Alternative 2: Maintain Both
**Rejected:** Increases complexity, maintenance burden, and confusion
- No clear ownership model
- Doubles testing surface area
- Confusing for new developers

### Alternative 3: Hybrid (Critical path in Go, admin in TS)
**Rejected:** Adds deployment complexity and requires dual runtime support
- Two build pipelines
- Two deployment artifacts
- Increased cognitive load

---

## References

- GitHub Issue #672: Sprint 0 — Architecture Decision and Backlog Lock
- Nakama.js documentation: https://heroiclabs.com/docs/nakama/javascript
- Nakama Go documentation: https://heroiclabs.com/docs/nakama/golang
- Current deployment: `backend/nakama.yml` line 14: `js_entrypoint: "modules/index.js"`

---

*Decision by: Architecture Sprint Team*
*Approved by: Sprint 0 Review*
*Next Review: Post-MVP (after v1.0.0 launch)*
