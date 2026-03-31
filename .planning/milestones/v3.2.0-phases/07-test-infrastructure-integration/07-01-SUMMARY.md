---
phase: 07-test-infrastructure-integration
plan: 01
title: "Refactor Go benchmarks to use Phase 2 factory functions"
slug: "benchmark-factory-integration"
status: complete
date: "2026-03-20"
start_time: "2026-03-20T20:14:45Z"
end_time: "2026-03-20T20:25:30Z"
duration_seconds: 645
wave: 1
---

# Phase 07 Plan 01: Refactor Go Benchmarks to Use Factory Functions Summary

**One-liner:** Refactored 3 Go benchmarks (BenchmarkGetPlayerStats, BenchmarkGetLeaderboard, BenchmarkGetInventory) to use Phase 2 factory functions, eliminating 15 lines of raw SQL INSERT statements and ensuring test data consistency.

## Objective

Refactor Go benchmarks to use Phase 2 factory functions instead of raw SQL INSERT statements. This ensures test data consistency across benchmarks and integration tests by using the same factory functions, eliminates duplicate test data setup logic, and makes benchmarks easier to maintain.

## Tasks Completed

### Task 1: Refactor BenchmarkGetPlayerStats to use factory functions ✅
**Commit:** `73643cfc`

- Replaced raw SQL INSERT with `testhelpers.NewPlayerBuilder()`
- Used `json.Marshal()` for stats serialization (toJSON is unexported)
- Applied refactoring to both `BenchmarkGetPlayerStats` and `BenchmarkGetPlayerStatsParallel`
- Maintained `b.ResetTimer()` to exclude setup overhead from benchmark measurements
- **Lines changed:** 26 insertions, 4 deletions

**Verification:**
```bash
cd backend && go test -bench=BenchmarkGetPlayerStats -benchmem -run=^$ ./internal/rpc/
# Result: PASS - Benchmark runs successfully with factory functions
```

### Task 2: Refactor BenchmarkGetLeaderboard to use factory functions ✅
**Commit:** `00a158f2`

- Replaced hardcoded SQL INSERT loop with `testhelpers.NewPlayerBuilder()`
- Created 100 test players with levels 1-100 for realistic leaderboard distribution
- Builder's `WithLevel(i)` automatically scales stats (Attack=10+i, Defense=10+i, Dodge=10+(i/2), CritRate=5+(i/5))
- Maintained `b.ResetTimer()` to exclude setup overhead
- **Lines changed:** 11 insertions, 4 deletions

**Verification:**
```bash
cd backend && go test -bench=BenchmarkGetLeaderboard -benchmem -run=^$ ./internal/rpc/
# Result: PASS - Benchmark runs successfully with factory functions
```

### Task 3: Refactor BenchmarkGetInventory to use factory functions ✅
**Commit:** `2c1ae334`

- Replaced hardcoded gear stats map with `testhelpers.NewGearBuilder()`
- Created 20 catalog entries using builder pattern for consistent test data
- Used `WithStats(i*5, i*3, i*2, 0)` to maintain original stat progression
- Maintained `b.ResetTimer()` to exclude setup overhead
- **Lines changed:** 18 insertions, 9 deletions

**Verification:**
```bash
cd backend && go test -bench=BenchmarkGetInventory -benchmem -run=^$ ./internal/rpc/
# Result: PASS - Benchmark runs successfully with factory functions
```

## Overall Verification

All benchmarks run successfully and produce valid timing results:

```bash
cd backend && go test -bench=. -benchmem -run=^$ ./internal/rpc/
```

**Results:**
- ✅ BenchmarkGetPlayerStats: 938.6 ns/op, 624 B/op, 12 allocs/op
- ✅ BenchmarkGetLeaderboard: 841054 ns/op, 110218 B/op, 2481 allocs/op
- ✅ BenchmarkGetInventory: 940.0 ns/op, 624 B/op, 12 allocs/op
- ✅ BenchmarkGetPlayerStatsParallel: 266.0 ns/op, 624 B/op, 12 allocs/op

**Factory function usage verified:**
```bash
grep -n "testhelpers.New" backend/internal/rpc/rpc_bench_test.go
# Output:
# 127:	player := testhelpers.NewPlayerBuilder().
# 202:		player := testhelpers.NewPlayerBuilder().
# 288:		gear := testhelpers.NewGearBuilder().
# 374:	player := testhelpers.NewPlayerBuilder().
```

**Raw SQL INSERT removal verified:**
```bash
grep -n '"test-user-id", 10, 5000' backend/internal/rpc/rpc_bench_test.go
# Output: (no matches - hardcoded values successfully removed)
```

## Deviations from Plan

**None - plan executed exactly as written.**

All tasks completed without deviations. The plan's specifications were accurate and the factory functions from Phase 2 worked exactly as documented.

## Files Modified

### Primary Files
- `backend/internal/rpc/rpc_bench_test.go` - Refactored 3 benchmarks to use factory functions

### Factory Functions Used (from Phase 2)
- `backend/tests/testhelpers/fixtures.go` - Base factory functions (NewTestPlayer, NewTestGear)
- `backend/tests/testhelpers/fixtures_builder.go` - Builder pattern (NewPlayerBuilder, NewGearBuilder)

## Technical Details

### Key Changes

1. **BenchmarkGetPlayerStats (and Parallel variant)**
   - Before: Raw SQL INSERT with hardcoded values `("test-user-id", 10, 5000, 5, '{"strength": 50, "agility": 45, "intelligence": 30"}')`
   - After: Factory function with `testhelpers.NewPlayerBuilder().WithID("test-user-id").WithLevel(10).WithXP(5000).Build()`

2. **BenchmarkGetLeaderboard**
   - Before: Loop with hardcoded SQL INSERT for 100 users
   - After: Loop with `testhelpers.NewPlayerBuilder().WithID(fmt.Sprintf("user-%d", i)).WithLevel(i).WithXP(i * 1000).Build()`

3. **BenchmarkGetInventory**
   - Before: Loop with hardcoded map `baseStats := map[string]int{"attack": i*5, "defense": i*3, "speed": i*2}`
   - After: Loop with `testhelpers.NewGearBuilder().WithID(fmt.Sprintf("gear-%d", i)).WithType("bow").WithRarity("rare").WithStats(i*5, i*3, i*2, 0).Build()`

### Implementation Notes

1. **JSON Serialization**: Used `json.Marshal(player)` instead of `player.toJSON()` because the `toJSON()` method is unexported (lowercase) in the testhelpers package.

2. **Stat Scaling**: The `PlayerBuilder.WithLevel(i)` method automatically scales stats:
   - Attack: 10 + level
   - Defense: 10 + level
   - Dodge: 10 + (level / 2)
   - CritRate: 5 + (level / 5)

3. **Benchmark Timing**: All refactored benchmarks maintain `b.ResetTimer()` after factory function calls to exclude setup overhead from benchmark measurements.

## Success Criteria

All success criteria met:

1. ✅ **All 3 benchmarks use testhelpers factory functions** - Verified with grep (4 matches found)
2. ✅ **Raw SQL INSERT with hardcoded values removed** - Verified with grep (no matches found)
3. ✅ **Benchmarks run successfully and produce timing results** - All benchmarks PASS with valid ns/op, B/op, allocs/op
4. ✅ **Test data consistency between benchmarks and integration tests** - Both use same factory functions from testhelpers package
5. ✅ **b.ResetTimer() called after factory function calls** - Verified in all 3 benchmarks

## Decisions Made

### Decision 1: Use json.Marshal() instead of toJSON()
**Context:** The `TestPlayer.toJSON()` method is unexported (lowercase), so it cannot be accessed from the rpc package.
**Decision:** Use Go's standard `json.Marshal(player)` for JSON serialization.
**Rationale:** Maintains encapsulation while providing the required functionality. The `MarshalJSON()` method is properly implemented on `TestPlayer` struct.

### Decision 2: Maintain b.ResetTimer() position
**Context:** Factory function calls add small overhead that should be excluded from benchmark measurements.
**Decision:** Keep `b.ResetTimer()` immediately after factory function calls and before the benchmark loop.
**Rationale:** Ensures benchmark accuracy by measuring only the RPC handler performance, not test data setup.

## Performance Impact

Benchmark results show no significant performance degradation from using factory functions:

- **BenchmarkGetPlayerStats:** ~938 ns/op (similar to baseline ~1059 ns/op before refactoring)
- **BenchmarkGetLeaderboard:** ~841054 ns/op (similar to baseline)
- **BenchmarkGetInventory:** ~940 ns/op (similar to baseline)

Factory functions are called during setup (before `b.ResetTimer()`), so they do not affect benchmark timing results.

## Integration Points

### Phase 2 Integration
- **Fixtures Layer:** Successfully integrated with `backend/tests/testhelpers/fixtures.go`
- **Builder Pattern:** Successfully integrated with `backend/tests/testhelpers/fixtures_builder.go`
- **Testcontainers:** Successfully integrated with `backend/tests/testhelpers/db_testcontainers.go`

### Phase 4 Integration
- **Go Benchmarks:** Refactored `backend/internal/rpc/rpc_bench_test.go` to use Phase 2 fixtures
- **Load Tests:** Not in scope for this plan (addressed in Plan 07-02)

## Lessons Learned

1. **Factory Function Benefits**: Using factory functions eliminated 15 lines of duplicate test data setup code and ensured consistency across test types.

2. **Builder Pattern Flexibility**: The builder pattern made it easy to create test data with specific properties (level, XP, stats) while maintaining sensible defaults.

3. **Benchmark Timing**: Critical to call `b.ResetTimer()` after factory function calls to exclude setup overhead from benchmark measurements.

4. **Unexported Methods**: Need to use standard library functions (`json.Marshal`) when testhelper methods are unexported.

## Next Steps

**Plan 07-02:** Refactor load tests to use testcontainers for automated database provisioning (PERF-03 integration requirement).

## Metrics

| Metric | Value |
|--------|-------|
| **Tasks Completed** | 3/3 (100%) |
| **Commits** | 3 atomic commits |
| **Files Modified** | 1 file (rpc_bench_test.go) |
| **Lines Changed** | 55 insertions, 17 deletions |
| **Duration** | 10 minutes 45 seconds |
| **Benchmarks Refactored** | 3 (BenchmarkGetPlayerStats, BenchmarkGetLeaderboard, BenchmarkGetInventory) |
| **Raw SQL INSERT Removed** | 15 lines |
| **Factory Function Calls Added** | 4 (NewPlayerBuilder × 3, NewGearBuilder × 1) |

## Requirements Satisfied

- ✅ **PERF-01 (integration)**: Go benchmarks use Phase 02 factory functions instead of raw SQL INSERT

---

**Plan Status:** ✅ **COMPLETE**

All tasks executed successfully. Benchmarks now use factory functions for test data consistency.
