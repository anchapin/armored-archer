---
phase: 7
slug: test-infrastructure-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | go test (backend), k6 (load tests) |
| **Config file** | backend/go.mod (go test), backend/tests/load/k6.config.js (k6) |
| **Quick run command** | `cd backend && go test ./tests/testhelpers/... -v -run TestFactory` |
| **Full suite command** | `cd backend && go test ./... -bench=. -benchmem && ./tests/load/run-load-tests.sh` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && go test ./tests/testhelpers/... -v -run TestFactory`
- **After every plan wave:** Run `cd backend && go test ./... -bench=. -benchmem`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PERF-01 | unit | `cd backend && go test ./internal/rpc/... -bench=BenchmarkGetPlayerStats -run=^$` | ✅ | ⬜ pending |
| 07-01-02 | 01 | 1 | PERF-01 | unit | `cd backend && go test ./internal/rpc/... -bench=BenchmarkGetLeaderboard -run=^$` | ✅ | ⬜ pending |
| 07-01-03 | 01 | 1 | PERF-01 | unit | `cd backend && go test ./internal/rpc/... -bench=BenchmarkGetInventory -run=^$` | ✅ | ⬜ pending |
| 07-02-01 | 02 | 1 | PERF-03 | integration | `cd backend && ./tests/load/run-load-tests.sh` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/testhelpers/fixtures.go` — factory functions exist (from Phase 2)
- [ ] `backend/tests/testhelpers/fixtures_builder.go` — builder pattern exists (from Phase 2)
- [ ] `backend/tests/testhelpers/db_testcontainers.go` — testcontainers setup exists (from Phase 2)
- [ ] `backend/tests/load/scenarios/*.js` — k6 load test scenarios exist (from Phase 4)

*Existing infrastructure covers all phase requirements (Phase 2 fixtures + Phase 4 benchmarks/load tests).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Load test isolation | PERF-03 | Requires verifying load tests run without manual backend startup | 1. Stop Nakama/PostgreSQL: `make backend-stop`<br>2. Run load tests: `cd backend && ./tests/load/run-load-tests.sh`<br>3. Verify tests start database automatically via testcontainers |
| Test data consistency | PERF-01 | Requires comparing benchmark vs integration test data | 1. Run benchmark: `cd backend && go test ./internal/rpc/... -bench=. -benchmem`<br>2. Run integration test: `cd backend && go test ./tests/testhelpers/... -v`<br>3. Verify both use same factory functions (`NewTestPlayer()`, `NewTestGear()`) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
