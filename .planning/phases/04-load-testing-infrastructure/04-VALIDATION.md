---
phase: 04
slug: load-testing-infrastructure
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-20
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Go testing/benchmark + k6 v0.49.0 + GUT 9.6.0 |
| **Config file** | .github/workflows/load-test.yml (existing) |
| **Quick run command** | `cd backend && go test -bench=. -run=^$ ./src/...` |
| **Full suite command** | `make test-performance` (to be created) |
| **Estimated runtime** | ~300 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && go test -bench=. -run=^$ ./src/...`
- **After every plan wave:** Run `make test-performance` (full benchmark + k6 + Godot performance suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-00-01 | 00 | 0 | PERF-01 | stub creation | `cd backend && go test -bench=. -run=^$ ./internal/rpc/... 2>&1 \| grep SKIP` | ✅ W0 | ⬜ pending |
| 04-00-02 | 00 | 0 | PERF-01 | stub creation | `cd backend && go test -bench=. -run=^$ ./internal/rpc/... 2>&1 \| grep SKIP` | ✅ W0 | ⬜ pending |
| 04-00-03 | 00 | 0 | PERF-02 | stub creation | `godot4 --headless --script test/suites/performance/test_60fps_gameplay_loops.gd 2>&1 \| grep -i skip` | ✅ W0 | ⬜ pending |
| 04-00-04 | 00 | 0 | PERF-05 | stub creation | `cat .github/workflows/benchmark-regression.yml \| grep -E "(name:\|on:\|jobs:)"` | ✅ W0 | ⬜ pending |
| 04-01-01 | 01 | 2 | PERF-01 | benchmark | `cd backend && go test -bench=BenchmarkGetPlayerStats -run=^$ ./internal/rpc/...` | ✅ W0 | ⬜ pending |
| 04-01-02 | 01 | 2 | PERF-01 | benchmark | `cd backend && go test -bench=BenchmarkGetLeaderboard -run=^$ ./internal/rpc/...` | ✅ W0 | ⬜ pending |
| 04-01-03 | 01 | 2 | PERF-01 | benchmark | `cd backend && go test -bench=BenchmarkGetInventory -run=^$ ./internal/rpc/...` | ✅ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | PERF-02 | performance | `godot4 --headless --script test/suites/performance/test_60fps_gameplay_loops.gd` | ✅ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | PERF-03 | load test | `k6 run --vus 100 --duration 30s load-test/scenarios/player_stats.js` | ✅ existing | ⬜ pending |
| 04-03-02 | 03 | 3 | PERF-04 | load test | `k6 run --vus 100 --duration 30s load-test/scenarios/mixed_workload.js` | ✅ existing | ⬜ pending |
| 04-04-01 | 04 | 4 | PERF-05 | regression | `cd backend && benchstat old.txt new.txt` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/internal/rpc/rpc_bench_test.go` — stubs for Go benchmarks (PERF-01)
- [x] `backend/internal/rpc/feedback_bench_test.go` — stubs for Go feedback benchmarks (PERF-01)
- [x] `test/suites/performance/test_60fps_gameplay_loops.gd` — Godot 60 FPS validation test stubs (PERF-02)
- [x] `load-test/scenarios/` — k6 scripts (already exist for PERF-03, PERF-04)
- [x] `.github/workflows/benchmark-regression.yml` — CI workflow stub for benchmark regression detection (PERF-05)
- [ ] `Makefile` — add `test-performance` target (added in Plan 04-04)

*Note: k6 scripts and GitHub Actions load test workflow already exist from previous work. Wave 0 stubs created in Plan 04-00.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Load test report review | PERF-03 | Requires human interpretation of k6 metrics | Run `k6 run --vus 100 --duration 60s load-test/scenarios/mixed_workload.js` and verify: p95 latency < 200ms, error rate < 1%, 100+ VUs sustained |
| Godot FPS visual validation | PERF-02 | Headless mode may not catch rendering issues | Run game manually, observe core gameplay (movement, combat), confirm consistent 60 FPS during action |
| Performance baseline thresholds | PERF-05 | Requires project-specific performance targets | Review benchmark results, set baseline thresholds based on p95 latency < 200ms target |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 04-00 creates all stubs)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter

**Approval:** pending
