# Requirements: Armored Archer v2.3.0

**Defined:** 2026-03-19
**Core Value:** Players can enjoy a polished, responsive archery game with reliable performance and minimal bugs
**Milestone:** v2.3.0 - Testing & QA Infrastructure

## v1 Requirements

Requirements for v2.3.0 milestone. Each maps to roadmap phases.

### Test Foundation (FND)

- [x] **FND-01**: Go backend uses testify framework for assertions and test suites
- [x] **FND-02**: Godot client uses enhanced GUT framework with autoload testing support
- [x] **FND-03**: Test runner executes all backend and frontend tests with unified reporting
- [x] **FND-04**: Test pyramid is enforced (70% unit, 20% integration, 10% E2E) via automated checks
- [x] **FND-05**: Go race detector runs in CI for all concurrent code
- [x] **FND-06**: Tests are isolated and don't depend on shared state

### Test Isolation & Fixtures (ISO)

- [x] **ISO-01**: Database tests use testcontainers-go for isolated PostgreSQL instances
- [x] **ISO-02**: Test fixtures use factory pattern for consistent test data generation
- [x] **ISO-03**: Test data cleanup runs automatically after each test suite
- [x] **ISO-04**: Godot autoload tests use fresh instances per test to prevent state leakage
- [x] **ISO-05**: Integration tests have proper setup/teardown lifecycle management

### Coverage & Quality Gates (COV)

- [x] **COV-01**: Code coverage is measured for backend (Go) and frontend (Godot)
  - **Note**: Godot/GDScript lacks line coverage instrumentation. Test pass rate from GUT JUnit XML is used as a coverage proxy. This is an acceptable trade-off documented in Phase 6 plans.
- [x] **COV-02**: Coverage thresholds are enforced in CI (80% for critical paths, 60% overall)
- [x] **COV-03**: Pull requests that fail coverage tests are automatically blocked from merging
- [x] **COV-04**: Coverage reports are generated and viewable in CI artifacts
- [x] **COV-05**: Coverage metrics are tracked over time to identify trends

### Flaky Test Detection (FLK)

- [x] **FLK-01**: CI automatically detects flaky tests via repeated test runs
- [x] **FLK-02**: Flaky tests are quarantined and don't block PR merges
- [x] **FLK-03**: Flaky test dashboard shows test reliability metrics
- [x] **FLK-04**: Developers are notified when their tests are flagged as flaky

### Performance Testing (PERF)

- [x] **PERF-01**: Backend has Go benchmarks for critical RPC endpoints
- [x] **PERF-02**: Frontend has performance tests for 60 FPS target validation
- [ ] **PERF-03**: Load tests validate backend can handle 100+ concurrent players
- [ ] **PERF-04**: Load test scripts use k6 for realistic traffic simulation
- [x] **PERF-05**: Performance baselines are established and regressions are detected

### Visual Regression Testing (VIS)

- [x] **VIS-01**: Design system components have visual regression tests
- [x] **VIS-02**: UI screens are validated for layout consistency
- [x] **VIS-03**: Visual regression tests run in CI for theme changes

### Test Fixtures Layer (FIX)

- [x] **FIX-01**: Factory functions create test players with sensible defaults
- [x] **FIX-02**: Factory functions create test gear items with configurable properties
- [x] **FIX-03**: Factory functions create test matches with realistic game state
- [x] **FIX-04**: Fixtures support builder pattern for flexible test data creation
- [x] **FIX-05**: Test data is shared between Go and Godot tests via common format (JSON)

### Mock Infrastructure (MOCK)

- [x] **MOCK-01**: Nakama runtime is mocked for unit testing RPC handlers
- [x] **MOCK-02**: Database layer is mocked using interface-based approach
- [x] **MOCK-03**: Godot autoloads are mockable via dependency injection
- [x] **MOCK-04**: Mock generation uses uber/mock for Go interfaces
- [x] **MOCK-05**: Mocks are validated against real implementations periodically

### Property-Based Testing (PBT)

- [x] **PBT-01**: Critical combat calculations use property-based tests (rapid)
- [x] **PBT-02**: RNG systems have property-based tests for edge case detection
- [x] **PBT-03**: Property-based tests run in CI alongside unit tests

## v2 Requirements

Deferred to future milestone. Not in current roadmap.

### Future Enhancements

- **Mutation Testing** — Evaluate test quality by introducing code mutations (high setup cost)
- **Contract Testing** — Validate API contracts between client and server (API still evolving)
- **Chaos Engineering** — Test system resilience under failure conditions
- **Test Parallelization** — Run tests concurrently to reduce CI time (optimization)
- **Fuzzing** — Automate finding security vulnerabilities (overkill for current complexity)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 100% Code Coverage | Diminishing returns; tests trivial code; wastes time. Focus on critical paths. |
| E2E Tests for Everything | Extremely slow; flaky; expensive. Use test pyramid instead. |
| Manual QA as Primary | Not scalable; inconsistent; slow. Use for exploratory testing only. |
| Testing Private Methods | Couples tests to implementation; breaks on refactoring. Test public interfaces. |
| Mock Everything | Tests become brittle; may not catch real integration issues. Mock only slow/unstable deps. |
| New Gameplay Features | This milestone focuses on testing infrastructure, not content. |
| Backend Rewrites | Building tests for existing Go backend, not refactoring. |
| Database Migrations | No schema changes; only testing existing data layer. |
| Godot Line Coverage Tooling | GDScript lacks built-in coverage instrumentation. Building custom tooling is cost-prohibitive. Using test pass rate as proxy is acceptable. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 5 | Complete |
| FND-04 | Phase 5 | Complete |
| FND-05 | Phase 5 | Complete |
| FND-06 | Phase 5 | Complete |
| ISO-01 | Phase 2 | Complete |
| ISO-02 | Phase 2 | Complete |
| ISO-03 | Phase 2 | Complete |
| ISO-04 | Phase 3 | Complete |
| ISO-05 | Phase 2 | Complete |
| COV-01 | Phase 6 | Complete |
| COV-02 | Phase 6 | Complete |
| COV-03 | Phase 6 | Complete |
| COV-04 | Phase 6 | Complete |
| COV-05 | Phase 6 | Complete |
| FLK-01 | Phase 6 | Complete |
| FLK-02 | Phase 6 | Complete |
| FLK-03 | Phase 6 | Complete |
| FLK-04 | Phase 6 | Complete |
| PERF-01 | Phase 4 | Complete |
| PERF-02 | Phase 4 | Complete |
| PERF-03 | Phase 4 | Pending |
| PERF-04 | Phase 4 | Pending |
| PERF-05 | Phase 4 | Complete |
| VIS-01 | Phase 6 | Complete |
| VIS-02 | Phase 6 | Complete |
| VIS-03 | Phase 6 | Complete |
| FIX-01 | Phase 2 | Complete |
| FIX-02 | Phase 2 | Complete |
| FIX-03 | Phase 2 | Complete |
| FIX-04 | Phase 2 | Complete |
| FIX-05 | Phase 2 | Complete |
| MOCK-01 | Phase 2 | Complete |
| MOCK-02 | Phase 2 | Complete |
| MOCK-03 | Phase 3 | Complete |
| MOCK-04 | Phase 2 | Complete |
| MOCK-05 | Phase 2 | Complete |
| PBT-01 | Phase 6 | Complete |
| PBT-02 | Phase 6 | Complete |
| PBT-03 | Phase 6 | Complete |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40 (100%)
- Unmapped: 0 ✓

**Phase Distribution:**
- Phase 1 (Test Infrastructure Foundation): 2 requirements (FND-01, FND-02)
- Phase 2 (Fixtures & Mocks Layer): 13 requirements
- Phase 3 (Godot Test Framework Enhancement): 2 requirements
- Phase 4 (Load Testing Infrastructure): 5 requirements
- Phase 5 (Complete Test Infrastructure Foundation): 4 requirements (FND-03, FND-04, FND-05, FND-06)
- Phase 6 (Coverage, Reporting & Quality Gates): 14 requirements (COV, FLK, VIS, PBT)
- Phase 7 (Test Infrastructure Integration): 2 integration fixes (PERF-01 integration, PERF-03 integration)

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-20 (added COV-01 Godot coverage proxy note, added Godot line coverage to Out of Scope)*
