# Phase 04: Load Testing Infrastructure - Research

**Researched:** 2026-03-20
**Domain:** Performance testing, load testing, benchmarking
**Confidence:** HIGH

## Summary

Phase 04 requires implementing comprehensive performance testing infrastructure for the Armored Archer game backend and frontend. The project already has foundational k6 load testing scripts and Godot performance tests, but lacks Go benchmarks for RPC handlers, systematic performance baseline management, and CI-based regression detection.

The phase must address five requirements (PERF-01 through PERF-05) covering Go benchmarks for critical RPC endpoints, Godot 60 FPS validation, k6 load testing for 100+ concurrent players, and performance regression detection in CI. Current infrastructure includes k6 v0.49.0 load tests, GitHub Actions workflow, and Godot performance benchmark tests using GUT framework.

**Primary recommendation:** Build upon existing k6 and Godot test infrastructure by adding Go benchmarks for RPC handlers, establishing performance baselines stored in version control, and implementing CI-based regression detection using benchmark comparison tools.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERF-01 | Backend has Go benchmarks for critical RPC endpoints (combat, matchmaking, gear operations) | Go testing/benchmark framework, benchstat for comparison |
| PERF-02 | Frontend has performance tests for 60 FPS target validation | Godot Engine.get_frames_per_second(), GUT test framework |
| PERF-03 | Load tests validate backend can handle 100+ concurrent players | k6 load testing with staged ramp-up, threshold validation |
| PERF-04 | Load test scripts use k6 for realistic traffic simulation | k6 JavaScript API, Nakama RPC authentication patterns |
| PERF-05 | Performance baselines are established and regressions are detected | benchstat, GitHub Actions benchmark comparison, threshold enforcement |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Go testing/benchmark** | Go 1.25+ | Benchmark framework for RPC handlers | Built-in to Go, supports b.Run(), b.ResetTimer(), reporting ns/op |
| **k6** | v0.49.0 | Load testing framework for HTTP/RPC endpoints | Industry standard for load testing, supports thresholds, staging, JSON output |
| **GUT (Godot Unit Test)** | 9.6.0 | Godot performance testing framework | Already integrated, supports assertions, test suites, CI integration |
| **benchstat** | Latest (Go tool) | Benchmark comparison and regression detection | Official Go tool for comparing benchmark results, detects statistically significant changes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **testify** | v1.11.1 | Assertion helpers in benchmark tests | For complex benchmark assertions beyond raw timing |
| **Prometheus client_golang** | v1.23.2 | Performance metrics collection | Already installed for monitoring, can expose benchmark metrics |
| **GitHub Actions** | Latest | CI/CD pipeline for regression detection | Already configured for load tests, extends to benchmarks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| k6 | Locust, JMeter, Gatling | k6 has better JavaScript support, developer-friendly, simpler threshold syntax |
| benchstat | gobenchdata, benchmark-action | benchstat is official Go tool, statistical rigor; alternatives have richer web UIs |
| Godot built-in FPS | Third-party profilers | Built-in is sufficient for 60 FPS validation; third-party tools add complexity |

**Installation:**
```bash
# Go benchmarks (built-in with Go 1.25+)
# No installation needed

# k6 load testing
curl https://github.com/grafana/k6/releases/download/v0.49.0/k6-v0.49.0-linux-amd64.tar.gz -L | tar xvz
sudo mv k6-v0.49.0-linux-amd64/k6 /usr/local/bin/

# benchstat for benchmark comparison
go install golang.org/x/perf/cmd/benchstat@latest

# GUT for Godot (already installed)
# Located at: res://addons/gut
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── cmd/
│   └── server/
│       ├── main.go              # RPC handlers
│       └── main_bench_test.go   # Benchmark entry point
├── internal/
│   ├── rpc/
│   │   ├── rpc.go               # GetPlayerStats, GetLeaderboard, etc.
│   │   ├── feedback.go          # Feedback RPC handlers
│   │   └── rpc_bench_test.go    # RPC benchmarks
│   └── cache/
│       └── cache_bench_test.go  # Cache performance benchmarks
├── tests/
│   ├── benchmarks/
│   │   ├── benchmarks.go        # Benchmark suite
│   │   └── baseline.txt         # Performance baseline (version-controlled)
│   └── load/
│       ├── scenarios/
│       │   ├── smoke.js         # Already exists
│       │   ├── player_stats.js  # Already exists
│       │   ├── leaderboard.js   # Already exists
│       │   └── mixed_workload.js # Already exists
│       └── load_test_test.go    # Already exists

test/suites/performance/
├── test_performance_benchmarks.gd  # Already exists (FPS, frame time)
├── test_60fps_gameplay_loops.gd    # NEW: Core gameplay 60 FPS validation
└── test_rpc_latency_validation.gd  # NEW: Client-side RPC latency tests

.planning/phases/04-load-testing-infrastructure/
├── 04-RESEARCH.md                  # This file
└── 04-PLAN.md                      # Implementation plan
```

### Pattern 1: Go RPC Handler Benchmark
**What:** Benchmark functions measuring RPC handler performance with realistic database queries.
**When to use:** For all hot-path RPC handlers (GetPlayerStats, GetLeaderboard, GetInventory, SubmitFeedback).
**Example:**
```go
// Source: https://pkg.go.dev/testing#hdr-Benchmarks
func BenchmarkGetPlayerStats(b *testing.B) {
    // Setup: Create test database with testcontainers
    ctx := context.Background()
    db := setupTestDB(ctx)
    defer db.Close()

    // Create test user with stats
    userID := createTestUser(ctx, db, "benchmark_user")
    logger := &mockLogger{}
    nk := &mockNakamaModule{}

    // Reset timer to exclude setup time
    b.ResetTimer()

    for i := 0; i < b.N; i++ {
        // Benchmark the RPC handler
        _, err := GetPlayerStats(ctx, logger, db, nk, "{}")
        if err != nil {
            b.Fatalf("GetPlayerStats failed: %v", err)
        }
    }
}

// Benchmark with different payload sizes
func BenchmarkGetPlayerStatsLargeStats(b *testing.B) {
    // Similar setup but with large stats JSON
    // ...
}

// Benchmark concurrent access
func BenchmarkGetPlayerStatsParallel(b *testing.B) {
    // Test concurrent RPC handler performance
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            // RPC handler call
        }
    })
}
```

### Pattern 2: k6 Load Test Scenario
**What:** k6 JavaScript scripts simulating realistic player traffic patterns.
**When to use:** For validating 100+ concurrent player requirement (PERF-03).
**Example:**
```javascript
// Source: https://k6.io/docs/
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const rpcLatency = new Trend('rpc_latency');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Ramp to 100 users (PERF-03 requirement)
    { duration: '5m', target: 100 },  // Sustain 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'errors': ['rate<0.01'],           // Error rate < 1%
    'rpc_latency': ['p(95)<100'],     // P95 latency < 100ms
    'http_req_duration': ['p(95)<100'],
  },
};

export default function() {
  const token = authenticate(__ENV.TEST_USER_EMAIL, __ENV.TEST_USER_PASSWORD);

  // Call hot-path RPC endpoints
  const response = http.post(
    `${__ENV.NAKAMA_URL}/v2/rpc/get_player_stats`,
    JSON.stringify({}),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has player data': (r) => r.json().payload !== undefined,
  });

  errorRate.add(!success);
  rpcLatency.add(response.timings.duration);

  sleep(1); // Simulate realistic think time
}

function authenticate(email, password) {
  const response = http.post(
    `${__ENV.NAKAMA_URL}/v2/account/authenticate/email?create=false`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  return response.json().token;
}
```

### Pattern 3: Godot 60 FPS Performance Test
**What:** GUT test scripts validating 60 FPS target for core gameplay loops.
**When to use:** For PERF-02 requirement (60 FPS target validation).
**Example:**
```gdscript
# Source: Godot Engine documentation, GUT framework
extends GutTest

# Test core gameplay loop maintains 60 FPS
func test_core_gameplay_60_fps():
    var game_manager = GameManager.new()
    add_child(game_manager)

    # Simulate 60 seconds of gameplay
    var fps_samples = []
    var test_duration_sec = 60
    var frame_count = 0

    while frame_count < (test_duration_sec * 60):
        game_manager._process(1.0 / 60.0)
        var fps = Engine.get_frames_per_second()
        fps_samples.append(fps)
        frame_count += 1
        await wait_for_physics_frame()

    # Calculate average FPS
    var avg_fps = 0.0
    for sample in fps_samples:
        avg_fps += sample
    avg_fps /= fps_samples.size()

    # Assert average FPS >= 55 (allow 5 FPS margin)
    assert_gt(avg_fps, 55.0, "Average FPS should be >= 55 (target: 60)")

    # Assert no severe frame drops
    var min_fps = fps_samples.min()
    assert_gt(min_fps, 30.0, "Minimum FPS should be > 30")

    game_manager.queue_free()

# Test combat calculations maintain 60 FPS
func test_combat_calculations_performance():
    var combat_manager = CombatManager.new()
    add_child(combat_manager)

    # Benchmark combat calculation
    var start_time = Time.get_ticks_msec()
    var iterations = 1000

    for i in range(iterations):
        combat_manager.calculate_damage(
            100,  # base damage
            50,   # attacker stats
            40,   # defender stats
            1.5   # crit multiplier
        )

    var end_time = Time.get_ticks_msec()
    var duration_ms = end_time - start_time
    var avg_time_per_calc = float(duration_ms) / float(iterations)

    # Each calculation should take < 1ms at 60 FPS (16.67ms budget)
    assert_lt(avg_time_per_calc, 1.0, "Combat calculation should take < 1ms")

    combat_manager.queue_free()
```

### Pattern 4: CI Performance Regression Detection
**What:** GitHub Actions workflow comparing benchmark results against baseline.
**When to use:** For PERF-05 requirement (detect performance regressions).
**Example:**
```yaml
# Source: GitHub Actions documentation, benchstat usage
name: Performance Benchmarks

on:
  pull_request:
    paths:
      - 'backend/**'
  push:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'

      - name: Run Go benchmarks
        run: |
          cd backend
          go test -bench=. -benchmem -run=^$ ./... > benchmark-new.txt

      - name: Fetch baseline benchmarks
        run: |
          cd backend
          # Fetch baseline from main branch
          git checkout origin/main -- tests/benchmarks/baseline.txt

      - name: Compare with baseline
        run: |
          cd backend
          go install golang.org/x/perf/cmd/benchstat@latest
          benchstat tests/benchmarks/baseline.txt benchmark-new.txt

      - name: Fail on regression
        run: |
          # Parse benchstat output for regressions
          # Fail if any metric shows >10% regression
          # ...

      - name: Update baseline on main
        if: github.ref == 'refs/heads/main'
        run: |
          cd backend
          cp benchmark-new.txt tests/benchmarks/baseline.txt
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add tests/benchmarks/baseline.txt
          git commit -m "chore: update performance baseline"
          git push
```

### Anti-Patterns to Avoid
- **Benchmarking with debug builds**: Always use release builds (`go test -gcflags=-l`) for accurate timings
- **Testing with cold cache**: Warm up caches before measuring to get realistic performance
- **Ignoring GC pauses**: Use `benchtime` large enough to capture GC behavior
- **Testing without realistic data**: Use production-like data sizes and query patterns
- **Hardcoded thresholds**: Store baselines in version control, not hardcoded values
- **Testing on noisy CI runners**: Pin runner types or use statistical significance testing

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Benchmark comparison logic | Custom benchmark diff scripts | `benchstat` tool | Statistical rigor, handles noise, official Go tool |
| Load testing framework | Custom concurrent HTTP clients | k6 | Built-in staging, thresholds, metrics, reporting |
| FPS measurement | Custom frame time tracking | `Engine.get_frames_per_second()` | Built-in, accurate, Godot-native |
| Performance metrics collection | Custom metric recording | Prometheus client_golang | Already integrated, standardized format |
| Benchmark result storage | Custom database | Git-tracked baseline.txt | Version control, diff-friendly, simple |

**Key insight:** Custom benchmark tooling often lacks statistical rigor for handling microbenchmark noise. k6 handles connection pooling, authentication, and staged ramp-up which are error-prone to implement manually. Godot's built-in FPS counter is more accurate than custom frame timing logic.

## Common Pitfalls

### Pitfall 1: Cold Start Bias in Benchmarks
**What goes wrong:** First few iterations are slower due to cache warmup, skewing results.
**Why it happens:** CPU caches, JIT compilation, database connection pools aren't warm.
**How to avoid:** Use `b.ResetTimer()` after setup, use `b.Run()` for sub-benchmarks, run sufficient iterations.
**Warning signs:** High variance between runs, first iteration always slowest.

### Pitfall 2: Testing on Noisy CI Infrastructure
**What goes wrong:** Benchmark results fluctuate wildly between CI runs, causing false regressions.
**Why it happens:** Shared runners have variable CPU, network, disk I/O.
**How to avoid:** Use `benchstat` for statistical significance, increase `benchtime`, run multiple samples, pin runner types.
**Warning signs:** Regression alerts that disappear on re-run, high standard deviation.

### Pitfall 3: Load Testing Without Realistic Data
**What goes wrong:** Load tests pass but production fails due to unrealistic data patterns.
**Why it happens:** Testing with empty databases, small payloads, simple queries.
**How to avoid:** Use testcontainers with populated databases, realistic JSON sizes, production-like query patterns.
**Warning signs:** Load tests pass but production is slow, database queries faster in tests than production.

### Pitfall 4: Ignoring Memory Allocations in Benchmarks
**What goes wrong:** Code is fast but allocates heavily, causing GC pauses in production.
**Why it happens:** Only measuring time, not `ns/op` or `B/op` (allocations per operation).
**How to avoid:** Use `-benchmem` flag, monitor `allocs/op`, use `sync.Pool` for object reuse.
**Warning signs:** High throughput but high latency percentiles (P99), GC pressure in monitoring.

### Pitfall 5: Godot FPS Testing with V-Sync Enabled
**What goes wrong:** FPS tests always report 60 FPS even when performance is bad.
**Why it happens:** V-Sync caps FPS to monitor refresh rate, masking performance issues.
**How to avoid:** Disable V-Sync in project settings for tests, measure frame time directly, use `performance.get_monitor()` for CPU/GPU time.
**Warning signs:** FPS is exactly 60.0 or 30.0 (monitor refresh rate), frame time varies wildly.

## Code Examples

Verified patterns from official sources:

### Go Benchmark with Sub-measurements
```go
// Source: https://pkg.go.dev/testing#hdr-Benchmarks
func BenchmarkRPCHandlers(b *testing.B) {
    db := setupTestDB()
    defer db.Close()

    b.Run("GetPlayerStats", func(b *testing.B) {
        for i := 0; i < b.N; i++ {
            GetPlayerStats(context.Background(), nil, db, nil, "{}")
        }
    })

    b.Run("GetLeaderboard", func(b *testing.B) {
        for i := 0; i < b.N; i++ {
            GetLeaderboard(context.Background(), nil, db, nil, "{}")
        }
    })

    b.Run("GetInventory", func(b *testing.B) {
        for i := 0; i < b.N; i++ {
            GetInventory(context.Background(), nil, db, nil, "{}")
        }
    })
}
```

### k6 Thresholds for Performance SLOs
```javascript
// Source: https://k6.io/docs/using-k6/thresholds/
export const options = {
  thresholds: {
    // Error rate must be < 1%
    'errors': ['rate<0.01'],

    // P95 latency must be < 100ms
    'http_req_duration': ['p(95)<100'],

    // P99 latency must be < 200ms
    'http_req_duration': ['p(99)<200'],

    // Throughput must be > 100 req/s
    'http_reqs': ['rate>100'],
  },
};
```

### Godot Frame Time Measurement
```gdscript
# Source: Godot Engine documentation
func test_frame_time_validation():
    var frame_times = []

    for i in range(60):  # Measure 60 frames
        var start = Time.get_ticks_usec()
        # Simulate game logic
        await get_tree().process_frame
        var end = Time.get_ticks_usec()

        var frame_time_ms = (end - start) / 1000.0
        frame_times.append(frame_time_ms)

    # At 60 FPS, each frame should take ~16.67ms
    var avg_frame_time = 0.0
    for t in frame_times:
        avg_frame_time += t
    avg_frame_time /= frame_times.size()

    assert_lt(avg_frame_time, 17.0, "Average frame time should be < 17ms for 60 FPS")
```

### benchstat for Regression Detection
```bash
# Source: https://golang.org/x/perf/cmd/benchstat
# Run benchmarks on current branch
go test -bench=. -benchmem ./... > new.txt

# Compare with baseline
benchstat baseline.txt new.txt

# Output:
# name          old time/op  new time/op  delta
# GetPlayerStats 12.3ms ± 2% 13.5ms ± 3%  +9.76% (p=0.016 n=5+5)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual benchmark comparison | `benchstat` statistical comparison | Go 1.8+ | Automated regression detection with statistical significance |
| Single-stage load tests | k6 staged ramp-up with thresholds | k6 0.40+ | Realistic traffic patterns, automated SLO validation |
| FPS counter eyeballing | Automated GUT frame time tests | Godot 4.x | CI-integrated performance validation |
| Baseline in comments | Version-controlled baseline files | Industry standard | Traceable performance history, git-blame for regressions |

**Deprecated/outdated:**
- **hand-rolled benchmark comparison scripts**: Use `benchstat` instead
- **Apache Bench (ab)**: Replaced by k6 for modern load testing
- **Godot 3.x profiling**: Godot 4.x has improved performance monitoring tools
- **`testing.Benchmark` manual invocation**: Use `go test -bench.` instead

## Open Questions

1. **RPC Handler Authentication Overhead**
   - What we know: RPC handlers require authentication, but benchmarks may skip this
   - What's unclear: Should benchmarks include authentication overhead or test handler logic in isolation?
   - Recommendation: Create two benchmark variants - one with auth (realistic) and one without (isolated handler logic)

2. **Database Query Performance Baselines**
   - What we know: RPC handlers depend on database query performance
   - What's unclear: Should we benchmark RPC handlers with real DB queries or mock the database layer?
   - Recommendation: Use testcontainers for realistic DB performance in critical path benchmarks, mock for unit-level benchmarks

3. **Godot Performance Test Environment**
   - What we know: Godot performance varies by hardware and graphics settings
   - What's unclear: How to ensure consistent 60 FPS validation across different CI runners?
   - Recommendation: Use headless mode (`--headless`) for consistent testing, set graphics mode to GLES2 for predictability

## Validation Architecture

> **Note:** Workflow validation is enabled in `.planning/config.json` (nyquist_validation not explicitly set to false)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Go testing + benchstat, k6 v0.49.0, GUT 9.6.0 |
| Config file | backend/tests/load/k6.conf.js, test/suites/performance/*.gd |
| Quick run command | `cd backend && go test -bench=. -benchmem -run=^$ ./...` |
| Full suite command | `make backend-test && cd test/suites/performance && godot4 --headless --script test_all.gd` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Go benchmarks for RPC endpoints | benchmark | `go test -bench=BenchmarkRPCHandlers -benchmem ./internal/rpc/` | ❌ Wave 0 |
| PERF-02 | 60 FPS target validation | unit | `godot4 --headless --script test/suites/performance/test_60fps_gameplay_loops.gd` | ❌ Wave 0 |
| PERF-03 | 100+ concurrent player load test | load | `cd backend/tests/load && k6 run scenarios/mixed_workload.js` | ✅ Partial |
| PERF-04 | k6 realistic traffic simulation | load | `cd backend/tests/load && k6 run scenarios/player_stats.js` | ✅ Yes |
| PERF-05 | Performance regression detection | benchmark | `benchstat baseline.txt new.txt` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `go test -bench=. -benchmem -run=^$ ./internal/rpc/...`
- **Per wave merge:** Full benchmark suite + k6 load tests
- **Phase gate:** All benchmarks pass, no regressions detected by benchstat, load tests meet thresholds

### Wave 0 Gaps
- [ ] `backend/internal/rpc/rpc_bench_test.go` — Go benchmarks for RPC handlers (PERF-01)
- [ ] `backend/tests/benchmarks/baseline.txt` — Performance baseline file (PERF-05)
- [ ] `test/suites/performance/test_60fps_gameplay_loops.gd` — 60 FPS gameplay validation (PERF-02)
- [ ] `.github/workflows/benchmark.yml` — CI workflow for benchmark regression detection (PERF-05)
- [ ] `benchstat` installation in CI — Add to GitHub Actions setup

**Existing infrastructure:**
- ✅ k6 v0.49.0 load test scenarios (player_stats.js, leaderboard.js, mixed_workload.js)
- ✅ GitHub Actions load-test.yml workflow
- ✅ Godot performance benchmark tests (test_performance_benchmarks.gd)
- ✅ Load test validation (load_test_test.go)

## Sources

### Primary (HIGH confidence)
- **Go testing package** - https://pkg.go.dev/testing#hdr-Benchmarks (official Go benchmark documentation)
- **k6 Documentation** - https://k6.io/docs/ (official k6 load testing guide)
- **benchstat tool** - https://golang.org/x/perf/cmd/benchstat (official Go benchmark comparison)
- **GUT Framework** - https://gitlab.com/wez/weztree/-/tree/master/gut (Godot unit testing framework)

### Secondary (MEDIUM confidence)
- **GitHub Actions Documentation** - https://docs.github.com/en/actions (workflow configuration)
- **Godot Engine Documentation** - https://docs.godotengine.org/en/stable/tutorials/performance/index.html (performance profiling)
- **Nakama Documentation** - https://heroiclabs.com/docs/nakama/ (RPC handler patterns)

### Tertiary (LOW confidence)
- **Testcontainers-go** - https://golang.testcontainers.org/ (database isolation for benchmarks)
- **Prometheus Go Client** - https://github.com/prometheus/client_golang (metrics collection)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools are industry standards with official documentation
- Architecture: HIGH - Patterns verified against official Go, k6, and Godot documentation
- Pitfalls: HIGH - Based on common performance testing anti-patterns documented in official sources

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days - stable tooling ecosystem)

**Existing Infrastructure Assessment:**
- k6 load tests: ✅ Well-structured, includes thresholds and staging
- Godot performance tests: ✅ Comprehensive FPS and memory leak detection
- Go benchmarks: ❌ Missing - need to implement for RPC handlers
- CI regression detection: ⚠️ Partial - load test workflow exists but no benchmark comparison
- Performance baselines: ❌ Missing - need to establish and version-control baseline files
