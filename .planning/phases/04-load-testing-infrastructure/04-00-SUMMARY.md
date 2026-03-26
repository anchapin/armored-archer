---
phase: 04-load-testing-infrastructure
plan: 00
subsystem: Performance Testing Infrastructure
tags: [benchmarks, testing, ci-cd, wave-0]
dependency_graph:
  requires:
    - backend/internal/rpc/rpc.go (RPC handlers)
    - backend/tests/testhelpers/db_testcontainers.go (Test setup)
  provides:
    - backend/internal/rpc/rpc_bench_test.go (Benchmark stubs)
    - backend/internal/rpc/feedback_bench_test.go (Feedback benchmarks)
    - test/suites/performance/test_60fps_gameplay_loops.gd (Godot performance tests)
    - .github/workflows/benchmark-regression.yml (CI workflow)
  affects:
    - Plans 04-01 through 04-04 (implementation plans)
tech_stack:
  added:
    - Go testing framework (benchmarks)
    - GUT test framework (Godot performance tests)
    - GitHub Actions workflows
  patterns:
    - Test stub pattern (Wave 0 validation)
    - Benchmark testing
    - CI regression detection
key_files:
  created:
    - backend/internal/rpc/rpc_bench_test.go
    - backend/internal/rpc/feedback_bench_test.go
    - test/suites/performance/test_60fps_gameplay_loops.gd
    - .github/workflows/benchmark-regression.yml
decisions: []
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-20"
  tasks_completed: 4
  files_created: 4
  lines_of_code: 107
---

# Phase 04 Plan 00: Wave 0 Test Stubs Summary

## One-Liner

Created minimal test stub files for all performance, benchmark, and CI regression tests using Wave 0 validation pattern, establishing test infrastructure discoverability before implementation.

## Objective

Create minimal test stub files for all performance, benchmark, and CI regression tests. These stubs provide the test structure and discoverability without implementation, enabling fast verification after subsequent implementation plans.

## Execution Summary

**Plan Type:** Execute (autonomous)
**Tasks:** 4/4 completed
**Commits:** 4 atomic commits
**Duration:** 2 minutes
**Status:** ✅ COMPLETE

All test stub files were successfully created following the Wave 0 validation pattern. Each stub is discoverable by its respective test runner and contains descriptive TODO comments pointing to the implementation plan.

## Completed Tasks

### Task 1: Go benchmark stub file for core RPC handlers
**Commit:** 663c6745
**File:** `backend/internal/rpc/rpc_bench_test.go`

Created 4 benchmark stub functions:
- `BenchmarkGetPlayerStats` - Core player stats retrieval
- `BenchmarkGetLeaderboard` - Leaderboard with JOIN queries
- `BenchmarkGetInventory` - Inventory with catalog JOIN
- `BenchmarkGetPlayerStatsParallel` - Concurrent access simulation

All benchmarks use `b.Skip()` with descriptive TODO comments pointing to Plan 04-01.

### Task 2: Go benchmark stub file for feedback RPC handlers
**Commit:** 9c559e17
**File:** `backend/internal/rpc/feedback_bench_test.go`

Created 3 benchmark stub functions:
- `BenchmarkSubmitFeedback` - Feedback submission with INSERT
- `BenchmarkGetFeedbackStatistics` - Statistics query with aggregates
- `BenchmarkGetFeedbackStatisticsCached` - Cache hit performance

All benchmarks use `b.Skip()` with descriptive TODO comments pointing to Plan 04-01.

### Task 3: Godot 60 FPS test stub file
**Commit:** 42e68c53
**File:** `test/suites/performance/test_60fps_gameplay_loops.gd`

Created 4 test stub functions:
- `test_core_gameplay_60_fps` - Core gameplay FPS target validation
- `test_combat_calculations_performance` - Combat calculation speed
- `test_ui_rendering_performance` - UI rendering performance
- `test_multiple_enemies_performance` - Performance with multiple enemies

All tests use `gut.skip()` with descriptive TODO comments pointing to Plan 04-02.

### Task 4: CI workflow stub file for benchmark regression
**Commit:** e7e4c207
**File:** `.github/workflows/benchmark-regression.yml`

Created GitHub Actions workflow stub with:
- Workflow triggers (pull_request, push to main/develop)
- Placeholder benchmark job structure
- Comprehensive TODO comments for implementation steps

Full implementation planned for Plan 04-04.

## Verification Results

### Per-Task Verification
✅ **Task 1:** `rpc_bench_test.go` exists with 4 benchmark stubs, all skip
✅ **Task 2:** `feedback_bench_test.go` exists with 3 benchmark stubs, all skip
✅ **Task 3:** `test_60fps_gameplay_loops.gd` exists with 4 test stubs, all skip
✅ **Task 4:** `benchmark-regression.yml` exists with valid YAML structure

### Wave Verification
✅ All 7 Go benchmarks are discoverable by `go test -bench=.`
✅ All 4 Godot tests are discoverable by GUT
✅ CI workflow file exists with valid YAML
✅ All stubs use skip patterns with descriptive messages
✅ No implementation logic exists (stub structure only)

## Success Criteria

1. ✅ All 7 Go benchmark stubs exist and are discoverable by `go test -bench=.`
2. ✅ All 4 Godot test stubs exist and are discoverable by GUT
3. ✅ CI workflow stub exists with valid YAML structure
4. ✅ All stubs use `b.Skip()` or `gut.skip()` with descriptive messages pointing to implementation plan
5. ✅ No implementation logic exists — only stub structure
6. ✅ Wave 0 is complete, enabling Plans 04-01 through 04-04 to implement against these stubs

## Deviations from Plan

**None** - Plan executed exactly as written. All stubs were created successfully with proper structure and skip patterns.

## Files Created

| File | Purpose | Lines | Stubs |
|------|---------|-------|-------|
| `backend/internal/rpc/rpc_bench_test.go` | Core RPC benchmarks | 30 | 4 |
| `backend/internal/rpc/feedback_bench_test.go` | Feedback RPC benchmarks | 24 | 3 |
| `test/suites/performance/test_60fps_gameplay_loops.gd` | Godot 60 FPS tests | 21 | 4 |
| `.github/workflows/benchmark-regression.yml` | CI regression workflow | 32 | 1 job |

**Total:** 4 files, 107 lines, 12 stubs (7 benchmarks + 4 tests + 1 workflow)

## Next Steps

Wave 0 is now complete. The following plans can now implement against these stubs:

- **Plan 04-01:** Implement Go benchmarks with testcontainers, realistic data, and performance targets
- **Plan 04-02:** Implement Godot 60 FPS tests with gameplay simulation and performance assertions
- **Plan 04-03:** (Future) Load testing with k6 scripts
- **Plan 04-04:** Implement CI workflow with benchstat comparison and regression detection

## Technical Notes

### Stub Structure Pattern

All stubs follow a consistent pattern:
1. Descriptive function name
2. Documentation comment with purpose
3. TODO comment with implementation details and target plan
4. Skip call with descriptive message

This pattern ensures:
- Tests are discoverable by test runners
- Implementation requirements are clearly documented
- Dependencies between plans are explicit
- No accidental execution before implementation

### Test Discoverability

**Go Benchmarks:**
- Package: `rpc`
- File pattern: `*_bench_test.go`
- Discovery: `go test -bench=. ./internal/rpc/...`
- Count: 7 benchmarks (4 core + 3 feedback)

**Godot Tests:**
- Extends: `GutTest`
- File pattern: `test_*.gd`
- Discovery: GUT test framework auto-discovery
- Count: 4 performance tests

**CI Workflow:**
- Path: `.github/workflows/benchmark-regression.yml`
- Triggers: pull_request, push to main/develop
- Status: Placeholder awaiting implementation

## Integration Points

The stubs integrate with existing infrastructure:

- **RPC Handlers:** `backend/internal/rpc/rpc.go` provides functions to benchmark
- **Test Setup:** `backend/tests/testhelpers/db_testcontainers.go` provides database isolation
- **GUT Framework:** Already installed and configured for Godot testing
- **GitHub Actions:** Existing workflows provide CI/CD infrastructure

## Validation Checklist

- [x] All stub files exist at specified paths
- [x] All stubs use appropriate skip patterns
- [x] All stubs have descriptive TODO comments
- [x] All stubs point to implementation plans
- [x] No implementation logic exists in stubs
- [x] Wave verification passes (all stubs discoverable)
- [x] Success criteria met (6/6)
- [x] Ready for implementation in Plans 04-01 through 04-04

## Self-Check: PASSED

**File Existence:**
- ✅ backend/internal/rpc/rpc_bench_test.go
- ✅ backend/internal/rpc/feedback_bench_test.go
- ✅ test/suites/performance/test_60fps_gameplay_loops.gd
- ✅ .github/workflows/benchmark-regression.yml

**Commit Existence:**
- ✅ 663c6745 - test(04-00): add Go benchmark stub file for core RPC handlers
- ✅ 9c559e17 - test(04-00): add Go benchmark stub file for feedback RPC handlers
- ✅ 42e68c53 - test(04-00): add Godot 60 FPS test stub file
- ✅ e7e4c207 - test(04-00): add CI workflow stub file for benchmark regression

All claims verified. No missing items.
