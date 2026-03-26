---
phase: 11
slug: test-suite-optimization
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-22
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.3.0 (backend), Go test 1.18+ (if Go tests), GUT 9.6.0 (Godot) |
| **Config file** | backend/jest.config.js, test/gut_config.json |
| **Quick run command** | `make backend-test` (backend), `godot --headless --script res://test/run_autoload_tests.gd` (Godot) |
| **Full suite command** | `make test` (runs all tests) |
| **Estimated runtime** | ~30-60 seconds after optimization (target: <5 minutes with parallelization) |

---

## Sampling Rate

- **After every task commit:** Run `make backend-test` or relevant test suite for modified component
- **After every plan wave:** Run `make test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | OPT-01 | integration | `./scripts/check-test-pyramid.sh` | No | ⬜ pending |
| 11-01-02 | 01 | 1 | OPT-01 | integration | `grep -A 30 "test-pyramid-validation:" .github/workflows/test.yml` | No | ⬜ pending |
| 11-02-01 | 02 | 1 | OPT-02 | integration | `grep -q "\-parallel=" scripts/test-all.sh` | No | ⬜ pending |
| 11-02-02 | 02 | 1 | OPT-02 | integration | `grep -q "maxWorkers" backend/jest.config.js` | No | ⬜ pending |
| 11-02-03 | 02 | 1 | OPT-02 | integration | `grep -q "test-parallel:" Makefile` | No | ⬜ pending |
| 11-03-01 | 03 | 2 | OPT-03 | integration | `grep -q "AUTO_MARK" scripts/detect-go-flaky-tests.sh` | No | ⬜ pending |
| 11-03-02 | 03 | 2 | OPT-03 | integration | `test -x scripts/mark-flaky-tests.sh` | No | ⬜ pending |
| 11-03-03 | 03 | 2 | OPT-03 | integration | `grep -q "auto-quarantine" .github/workflows/flaky-tests.yml` | No | ⬜ pending |
| 11-04-01 | 04 | 1 | OPT-04 | unit | `test -f backend/tests/benchmarks/combat_benchmark_test.go` | No | ⬜ pending |
| 11-04-02 | 04 | 1 | OPT-04 | unit | `test -f backend/tests/benchmarks/matchmaking_benchmark_test.go` | No | ⬜ pending |
| 11-04-03 | 04 | 1 | OPT-04 | unit | `test -f backend/tests/benchmarks/rpg_benchmark_test.go` | No | ⬜ pending |
| 11-05-01 | 05 | 2 | OPT-04 | integration | `test -x scripts/benchmark-tests.sh` | No | ⬜ pending |
| 11-05-02 | 05 | 2 | OPT-04 | integration | `grep -q "benchmark-slow:" Makefile` | No | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Nyquist Compliance Verification

### Wave 0 Scripts
None required - all scripts are created by plans 01-05.

### Automated Commands Verification
All tasks have automated verification commands in their `<verify>` sections:
- Plan 01: `./scripts/check-test-pyramid.sh --json` and grep commands for workflow validation
- Plan 02: grep commands for parallel flag and maxWorkers config
- Plan 03: grep commands for AUTO_MARK flag and auto-quarantine workflow
- Plan 04: file existence checks for benchmark files
- Plan 05: executable and grep checks for benchmark runner

### Watch Mode Flags
No watch mode flags (--watch, -w, --watchAll) detected in any verification commands.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI execution time < 5 minutes | OPT-02 | Requires actual GitHub Actions run with parallel workers | Run full test suite in GitHub Actions after implementation, measure time |
| Flaky test quarantine visibility | OPT-03 | Requires GitHub issue creation verification | After flaky test detected, verify GitHub issue created with proper labels |
| Performance regression alerting | OPT-04 | Requires baseline comparison verification | Compare new benchmark results against baseline, verify alert on >10% regression |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 not required (scripts created by plans)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
