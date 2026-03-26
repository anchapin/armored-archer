---
phase: 07-test-infrastructure-integration
plan: 02
subsystem: testing
tags: [testcontainers, k6, load-testing, nakama, automated-provisioning]

# Dependency graph
requires:
  - phase: 02-fixtures-mocks-layer
    provides: testcontainers SetupTestDB(), TeardownTestDB()
  - phase: 04-load-testing-infrastructure
    provides: k6 load test scenarios (concurrent_players.js, smoke.js)
provides:
  - Nakama testcontainers helper (SetupNakamaServer(), TeardownNakamaServer())
  - Load test integration test (TestK6LoadTestsWithTestcontainers)
  - Fail-fast NAKAMA_URL requirement in k6 scripts
  - Automated load test execution without manual service startup
affects: []

# Tech tracking
tech-stack:
  added: [testcontainers-go (Nakama GenericContainer)]
  patterns: [testcontainers for service provisioning, fail-fast environment variable validation]

key-files:
  created:
    - backend/tests/testhelpers/nakama_testcontainers.go
  modified:
    - backend/tests/load/load_test_test.go
    - backend/tests/load/scenarios/concurrent_players.js
    - backend/tests/load/k6.conf.js

key-decisions:
  - "Use testcontainers GenericContainer for Nakama server (not Docker Compose)"
  - "Fail-fast if NAKAMA_URL not set (no silent localhost fallback)"
  - "Run database migrations in test before starting Nakama"

patterns-established:
  - "Pattern: testcontainers service provisioning for automated setup"
  - "Pattern: fail-fast environment variable validation with helpful error messages"

requirements-completed: [PERF-03]

# Metrics
duration: 1min
completed: 2026-03-20
---

# Phase 07: Test Infrastructure Integration Plan 02 Summary

**Nakama testcontainers helper with automated service provisioning, fail-fast NAKAMA_URL validation, and load test integration test**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-20T20:14:39Z
- **Completed:** 2026-03-20T20:15:48Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments

- Nakama testcontainers helper (SetupNakamaServer, TeardownNakamaServer, GetEndpoint)
- Load test integration test (TestK6LoadTestsWithTestcontainers) with automated database and Nakama provisioning
- Fail-fast NAKAMA_URL requirement in concurrent_players.js and k6.conf.js
- Eliminated manual service startup dependency for load tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Nakama testcontainers helper in testhelpers** - `0de32309` (feat)
2. **Task 2: Add TestK6LoadTestsWithTestcontainers integration test** - `8959ef40` (feat)
3. **Task 3: Update concurrent_players.js to require NAKAMA_URL** - `e29951d5` (feat)
4. **Task 4: Update k6.conf.js to require NAKAMA_URL** - `cb9ebc56` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified

- `backend/tests/testhelpers/nakama_testcontainers.go` - Nakama server testcontainers setup helper with SetupNakamaServer(), TeardownNakamaServer(), GetEndpoint()
- `backend/tests/load/load_test_test.go` - Added TestK6LoadTestsWithTestcontainers integration test
- `backend/tests/load/scenarios/concurrent_players.js` - Fail-fast if NAKAMA_URL not set (removed localhost fallback)
- `backend/tests/load/k6.conf.js` - Fail-fast if NAKAMA_URL not set (removed localhost fallback)

## Decisions Made

- **Use testcontainers GenericContainer for Nakama**: Avoids manual Docker Compose setup, provides automated cleanup and programmatic control
- **Fail-fast NAKAMA_URL validation**: Prevents silent failures from attempting to connect to non-existent localhost, provides helpful error message
- **Run migrations before Nakama startup**: Ensures database schema exists before Nakama server connects to testcontainers database

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Load tests can now run in CI without manual service startup
- PERF-03 requirement satisfied (load tests use testcontainers for automated database provisioning)
- Ready for Phase 07-01 (Go benchmark refactoring to use factory functions)

---
*Phase: 07-test-infrastructure-integration*
*Completed: 2026-03-20*
