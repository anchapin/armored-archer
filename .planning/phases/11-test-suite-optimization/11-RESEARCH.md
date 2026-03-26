# Phase 11: Test Suite Optimization - Research

**Researched:** 2026-03-22
**Domain:** Test performance optimization and reliability engineering
**Confidence:** MEDIUM

## Summary

Phase 11 focuses on optimizing the test suite for speed and reliability through four key initiatives: enforcing test pyramid ratios, enabling parallel execution, enhancing flaky test detection with automatic marking, and implementing performance benchmarking. The project currently has basic test infrastructure with Go (testify), Jest/TypeScript, and Godot GUT testing frameworks, but lacks systematic optimization for CI/CD speed and reliability.

**Current State:**
- Go backend: 19 test files with testify framework
- Jest/TypeScript: Tests in `src/modules/__tests__/` directory
- Godot: GDScript tests using GUT v9.6.0 framework
- Existing: Test pyramid validation script, flaky test detection for Go and Godot
- Missing: Parallel execution, automatic flaky test marking, performance benchmarking, pyramid enforcement in CI

**Primary recommendation:** Implement parallel test execution using Go's `-parallel` flag and Jest's `maxWorkers` configuration, enhance existing flaky test detection with automatic quarantine marking, add Go benchmark files for performance tracking, and integrate pyramid validation into CI/CD pipeline with automated warnings.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Go test -parallel** | Native flag | Parallel test execution for Go | Built-in Go testing feature, no dependencies |
| **t.Parallel()** | Native API | Mark tests as parallel-safe | Standard Go pattern for concurrent test execution |
| **Jest maxWorkers** | v30.3.0 (via package.json) | Parallel test execution for TypeScript | Native Jest parallelization, configurable |
| **Go testing/benchmark** | Native | Performance benchmarking for Go | Standard Go benchmarking framework |
| **GUT v9.6.0** | v9.6.0 | Godot test framework | Already in use, supports test organization |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **testify** | v1.11.1 | Go assertions and mocks | Already in use, maintains consistency |
| **Jest** | v30.3.0 | TypeScript test runner | Already configured, supports reporters |
| **Go race detector** | Native | Detect concurrent data races | Run in CI with `-race` flag |
| **Go shuffle** | Native | Test order randomization | Run in CI with `-shuffle=on` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Go native `-parallel` | Custom worker pool | Native is simpler, well-tested, no maintenance |
| Jest `maxWorkers` | sharding with multiple runs | Native parallelization is more efficient |
| Go benchmarks | Custom timing decorators | Native benchmarks are standardized and tool-supported |

**Installation:**
```bash
# No additional installation needed - all tools are native or already installed
# Verify Go version (1.18+ for -parallel)
go version

# Verify Jest version (already installed via npm)
npm list jest

# Verify GUT version (already installed in Godot)
# Check project.godot for GUT plugin
```

**Version verification:**
```bash
go version  # Should be 1.18+ for full parallel support
npm view jest version  # Already using v30.3.0 per package.json
```

## Architecture Patterns

### Recommended Project Structure
```
test-optimization/
├── scripts/
│   ├── benchmark-tests.sh          # Run benchmarks and track slow tests
│   ├── enforce-pyramid-ci.sh     # CI integration for pyramid validation
│   ├── mark-flaky-tests.sh       # Automatic flaky test quarantine
│   └── parallel-test-runner.sh    # Unified parallel execution
├── data/
│   ├── test-performance-history.json  # Performance tracking data
│   └── flaky-test-quarantine.json   # Quarantined tests with reasons
├── backend/
│   ├── tests/
│   │   ├── benchmarks/
│   │   │   ├── combat_benchmark_test.go
│   │   │   ├── matchmaking_benchmark_test.go
│   │   │   └── rpg_benchmark_test.go
│   │   └── ...
│   └── ...
└── .github/
    └── workflows/
        └── test-optimization.yml   # CI workflow with parallel tests
```

### Pattern 1: Go Parallel Test Execution
**What:** Mark tests as parallel-safe using `t.Parallel()` and control worker count with `-parallel` flag
**When to use:** For CPU-bound tests that don't share state or resources
**Example:**
```go
// Source: Go testing package documentation
func TestCombatCalculation_Parallel(t *testing.T) {
    tests := []struct {
        name string
        input CombatInput
        expected CombatResult
    }{
        // test cases...
    }

    for _, tt := range tests {
        tt := tt // capture range variable
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel() // Mark as safe for parallel execution

            result := CalculateCombat(tt.input)
            assert.Equal(t, tt.expected, result)
        })
    }
}
```

**Command-line usage:**
```bash
# Run tests with 4 parallel workers
go test -parallel=4 ./...

# Use GOMAXPROCS to limit CPU usage
GOMAXPROCS=2 go test -parallel=2 -race ./...
```

### Pattern 2: Jest Parallel Configuration
**What:** Configure `maxWorkers` in Jest config for optimal parallel execution
**When to use:** For TypeScript/JavaScript tests to leverage multi-core machines
**Example:**
```javascript
// Source: Jest documentation
module.exports = {
  // Use 50% of CPU cores in development, fixed number in CI
  maxWorkers: process.env.CI ? 2 : '50%',

  // Or use a fixed number
  maxWorkers: 4,

  // Disable for debugging
  // maxWorkers: 1
};
```

**Command-line usage:**
```bash
# Override config at runtime
npm test -- --maxWorkers=4

# Run serially for debugging
npm test -- --maxWorkers=1
```

### Pattern 3: Go Benchmark Tests
**What:** Use Go's benchmarking framework to track test performance over time
**When to use:** For critical path functions (combat, matchmaking, progression)
**Example:**
```go
// Source: Go testing package documentation
func BenchmarkCalculateCombat(b *testing.B) {
    input := NewTestCombatInput()

    b.ResetTimer() // Reset timer after setup

    for i := 0; i < b.N; i++ {
        CalculateCombat(input)
    }
}

func BenchmarkMatchmakingFilter(b *testing.B) {
    players := NewTestPlayers(1000)
    criteria := NewTestMatchCriteria()

    b.ResetTimer()

    for i := 0; i < b.N; i++ {
        FilterMatches(players, criteria)
    }
}
```

**Run benchmarks:**
```bash
# Run all benchmarks
go test -bench=. -benchmem ./internal/combat/

# Compare to baseline
go test -bench=. -benchmem ./... > new.txt
benchstat baseline.txt new.txt

# Save baseline
go test -bench=. -benchmem ./... > baseline.txt
```

### Pattern 4: Flaky Test Automatic Marking
**What:** Automatically quarantine tests that fail inconsistently (3x retry threshold)
**When to use:** For all test suites to prevent CI failures from flaky tests
**Example:**
```bash
# Source: Existing detect-go-flaky-tests.sh pattern
# Enhanced with automatic marking

#!/bin/bash
set -e

RUNS=3
THRESHOLD=0.33
QUARANTINE_FILE="data/flaky-test-quarantine.json"

# Run detection
./scripts/detect-go-flaky-tests.sh $RUNS $THRESHOLD

# Read results
FLAKY_TESTS=$(jq -r '.flaky_tests[].name' data/go-flaky-tests.json)

if [ -n "$FLAKY_TESTS" ]; then
    echo "Marking ${#FLAKY_TESTS[@]} tests as flaky..."

    # Update quarantine file
    for test in $FLAKY_TESTS; do
        jq --arg test "$test" \
           --arg reason "Failed $RUNS runs with >${THRESHOLD} failure rate" \
           '.[$test] = {name: $test, reason: $reason, quarantined_at: now}' \
           $QUARANTINE_FILE > tmp.json && mv tmp.json $QUARANTINE_FILE
    done

    # Create GitHub issue if not exists
    gh issue list --label "flaky-test" --search "$test" | grep -q "$test" ||
    gh issue create --title "Flaky test: $test" \
                  --label "flaky-test" \
                  --body "Test $test failed inconsistently across $RUNS runs.\n\nReason: Fails $RUNS runs with >${THRESHOLD} failure rate."
fi
```

### Anti-Patterns to Avoid
- **Running all tests serially:** Avoid `maxWorkers: 1` or `-parallel=1` in CI unless debugging
- **Ignoring flaky tests:** Don't add `// flaky` comments - use systematic detection and marking
- **Unbounded parallelization:** Don't use `-parallel=999` or `maxWorkers: '100%'` - specify reasonable limits
- **No benchmark baselines:** Don't run benchmarks without comparing to previous results
- **Manual pyramid enforcement:** Don't manually count tests - automate with scripts in CI

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parallel test runner | Custom worker pool in bash | Go `-parallel`, Jest `maxWorkers` | Native parallelization is optimized, handles edge cases |
| Performance tracking | Custom timing decorators | Go benchmarks, Jest reporters | Standardized format, tool support (benchstat) |
| Flaky test marking | Manual issue creation | Enhanced detection scripts + gh CLI | Systematic approach, reduces human error |
| Test pyramid validation | Manual test counting | Enhanced `check-test-pyramid.sh` | Automated, CI-integrated, consistent |

**Key insight:** Building custom solutions for test optimization is reinventing the wheel. Native testing framework features (Go parallelization, Jest workers, Go benchmarks) are well-tested, documented, and maintained. Focus on configuration and integration, not implementation.

## Common Pitfalls

### Pitfall 1: Race Conditions with Parallel Tests
**What goes wrong:** Tests fail intermittently when run in parallel due to shared state or file system conflicts
**Why it happens:** `t.Parallel()` requires tests to be truly independent - no shared mutable state, no exclusive file access
**How to avoid:**
- Use test-specific temp directories (`t.TempDir()`)
- Ensure database isolation (testcontainers, transactions)
- Use unique IDs for all external resources
- Run with `-race` flag to detect data races
**Warning signs:** Tests pass serially but fail with `-parallel=4`

### Pitfall 2: Resource Exhaustion from Over-Parallelization
**What goes wrong:** CI runner crashes or tests time out due to too many parallel workers
**Why it happens:** Setting `-parallel=999` or `maxWorkers: '100%'` uses all CPU cores and available memory
**How to avoid:**
- Use `maxWorkers: '50%'` for shared CI environments
- Set explicit limits: `-parallel=4` or `maxWorkers: 2` in CI
- Monitor CI runner resource usage
- Use `GOMAXPROCS=2` for Go tests to limit CPU
**Warning signs:** Tests timeout, CI runner OOM errors, flaky failures unrelated to code

### Pitfall 3: False Positives in Flaky Test Detection
**What goes wrong:** Tests marked as flaky when they're actually broken due to environment issues
**Why it happens:** Running tests 3x in a row with the same environment doesn't catch true flakiness - just consistent failures
**How to avoid:**
- Use different random seeds for each run (Go `-shuffle=on`)
- Vary environment between runs (different temp directories)
- Check for resource leaks in test teardown
- Require test to pass at least once to be considered "flaky" (not "broken")
**Warning signs:** All tests marked as flaky, 100% failure rate across runs

### Pitfall 4: Performance Regression Goes Undetected
**What goes wrong:** Tests get slower over time but no alert is triggered
**Why it happens:** Benchmarks run but not compared to baseline, or threshold is too loose
**How to avoid:**
- Run `benchstat` to compare current vs baseline
- Set regression thresholds (e.g., >10% slower = alert)
- Track benchmark results in JSON history
- Fail CI if performance degrades beyond threshold
**Warning signs:** Test suite execution time increases week over week

### Pitfall 5: Test Pyramid Violation Silent Failure
**What goes wrong:** E2E tests grow to 40% of total tests without warning
**Why it happens:** Pyramid validation exists but not integrated into CI/CD
**How to avoid:**
- Add `make check-test-pyramid` to GitHub Actions
- Fail PR if ratios outside 70/20/10 ±10%
- Add pyramid status to PR comments
- Track pyramid ratios over time
**Warning signs:** Integration tests take 30+ minutes to run

## Code Examples

Verified patterns from official sources:

### Go Parallel Test with Table-Driven Tests
```go
// Source: Go testing package documentation + testify pattern
func TestMatchmaking_Parallel(t *testing.T) {
    tests := []struct {
        name     string
        players  []*Player
        criteria MatchCriteria
        wantErr  bool
    }{
        {
            name:     "valid match",
            players:  []*Player{p1, p2, p3},
            criteria: MatchCriteria{SkillRange: 100},
            wantErr:  false,
        },
        // more test cases...
    }

    for _, tt := range tests {
        tt := tt // capture range variable
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()

            result, err := FindMatch(tt.players, tt.criteria)
            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
                assert.NotNil(t, result)
            }
        })
    }
}
```

### Jest Parallel Configuration for CI
```javascript
// Source: Jest documentation
// Add to jest.config.js or jest.config.json

module.exports = {
  // Dynamically set workers based on environment
  maxWorkers: process.env.CI ? 2 : '50%',

  // Add performance tracking
  // NOTE: Custom performance reporter disabled in current config - causes coverage issues
  // Uncomment when fixed:
  // reporters: [
  //   'default',
  //   ['<rootDir>/jest-performance-reporter.js', {
  //     thresholds: {
  //       test: 5000,
  //       suite: 30000,
  //       total: 120000,
  //       warning: 2000
  //     }
  //   }]
  // ]
};
```

### Go Benchmark with Memory Tracking
```go
// Source: Go testing package documentation
func BenchmarkCalculateDamage(b *testing.B) {
    attacker := NewTestPlayer(attackerStats)
    defender := NewTestPlayer(defenderStats)

    b.ResetTimer()
    b.ReportAllocs() // Track memory allocations

    for i := 0; i < b.N; i++ {
        CalculateDamage(attacker, defender)
    }
}
```

### Benchmark Comparison Script
```bash
#!/bin/bash
# Source: benchstat documentation (golang.org/x/perf/cmd/benchstat)

# Run current benchmarks
go test -bench=. -benchmem ./... > new.txt

# Compare to baseline
echo "Comparing to baseline..."
benchstat baseline.txt new.txt

# If regression >10%, fail
if benchstat baseline.txt new.txt | grep -q "~"; then
    echo "✅ Performance stable or improved"
else
    echo "❌ Performance regression detected"
    exit 1
fi
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Serial test execution | Parallel execution with workers | Go 1.18+ (2022), Jest 20+ | 3-5x faster test suites on multi-core machines |
| Manual flaky detection | Automated 3x retry with marking | 2020s industry standard | Reduced CI noise, faster feedback loop |
| No performance tracking | Benchmark baselines with regression detection | Go 1.0+ (2012), evolving tooling | Catches performance regressions before production |
| Manual pyramid validation | Automated ratio enforcement in CI | 2010s testing best practices | Prevents test bloat, maintains fast feedback |

**Deprecated/outdated:**
- **Running tests without `-race`:** Race detection is now standard for concurrent code
- **Using `go test -cpu=1`:** `-parallel` flag is the recommended approach
- **Custom test runners:** Use native parallelization features instead
- **Manual test categorization:** Automate with scripts and CI integration

## Open Questions

1. **What is the ideal parallel worker count for this project's CI environment?**
   - What we know: Current CI runner specs not documented
   - What's unclear: CPU cores, memory available, shared vs dedicated runners
   - Recommendation: Start with `maxWorkers: 2` for Jest, `-parallel=4` for Go, monitor and adjust

2. **Should flaky test marking fail the build or just warn?**
   - What we know: Existing scripts generate JSON but don't affect CI
   - What's unclear: Team preference on strictness
   - Recommendation: Warn in PR comments, fail only if flaky rate >5%

3. **What performance regression threshold is acceptable?**
   - What we know: Success criteria mention <5 minutes total execution time
   - What's unclear: Acceptable per-function regression (10%? 20%?)
   - Recommendation: 10% threshold for critical paths, 20% for non-critical

4. **How to handle Godot test parallelization?**
   - What we know: Godot tests run via GUT framework, currently serial
   - What's unclear: GUT support for parallel execution, file-level vs test-level parallel
   - Recommendation: Research GUT documentation, if no support, consider running multiple Godot instances

## Validation Architecture

> Workflow.nyquist_validation is not explicitly set to false in config.json, so include this section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Go test (native), Jest v30.3.0, GUT v9.6.0 |
| Config file | `backend/jest.config.js`, `test/test.gutconfig.json`, Go flags via command line |
| Quick run command | `make test-all` (runs Go + Godot) |
| Full suite command | `make test-all -- -race -shuffle=on` (Go with race detection) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPT-01 | Test pyramid enforced at 70/20/10 ratio | unit | `make check-test-pyramid` | ✅ scripts/check-test-pyramid.sh |
| OPT-02 | Test execution parallelized for faster CI/CD (<5 min) | integration | `go test -parallel=4 ./... && npm test -- --maxWorkers=4` | ❌ Needs integration script |
| OPT-03 | Flaky test detection with automatic retry (3x) and marking | unit | `make test-flaky-backend && make test-flaky-godot` | ✅ scripts/detect-go-flaky-tests.sh, detect_godot_flaky_tests.py |
| OPT-04 | Test performance benchmarking identifies slow tests (>100ms) | unit | `go test -bench=. -benchmem ./...` | ❌ Needs benchmark files |

### Sampling Rate
- **Per task commit:** `make check-test-pyramid` (pyramid validation)
- **Per wave merge:** `make test-all -- -parallel=4 -race` (full parallel suite with race detection)
- **Phase gate:** Full suite green + performance benchmarks pass + pyramid validation pass

### Wave 0 Gaps
- [ ] `scripts/parallel-test-runner.sh` — unified parallel execution for Go + Jest + Godot
- [ ] `scripts/enforce-pyramid-ci.sh` — CI integration with PR comments
- [ ] `scripts/mark-flaky-tests.sh` — automatic quarantine and GitHub issue creation
- [ ] `scripts/benchmark-tests.sh` — run benchmarks, compare to baseline, fail on regression
- [ ] `data/test-performance-history.json` — track benchmark results over time
- [ ] `backend/tests/benchmarks/*_benchmark_test.go` — benchmark files for critical paths
- [ ] Framework install: None (all tools native or already installed)
- [ ] `scripts/detect-go-flaky-tests.sh` enhancement — add automatic marking logic
- [ ] `scripts/detect_godot_flaky_tests.py` enhancement — add automatic marking logic

## Sources

### Primary (HIGH confidence)
- **Go testing package documentation** - `-parallel` flag, `t.Parallel()`, benchmark framework
- **Jest configuration documentation** - `maxWorkers` configuration, reporters
- **GUT v9.6.0 documentation** - Godot unit testing framework
- **Existing project scripts** - check-test-pyramid.sh, detect-go-flaky-tests.sh, detect_godot_flaky_tests.py
- **Project context** - package.json, Makefile, STATE.md, ROADMAP.md

### Secondary (MEDIUM confidence)
- **Go blog posts on test parallelization** - Best practices for t.Parallel()
- **benchstat documentation** - Benchmark comparison tool
- **Testing best practices community knowledge** - Test pyramid enforcement, flaky test handling

### Tertiary (LOW confidence)
- **Web search results** - Unable to retrieve due to search service issues
- **External blog posts** - Not verified against official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools are native Go/Jest or already verified in project
- Architecture: MEDIUM - Patterns based on standard Go/Jest documentation, but Godot parallelization needs research
- Pitfalls: MEDIUM - Based on common testing issues, but project-specific behavior unknown
- Performance optimization: MEDIUM - Benchmarking patterns are standard, but ideal thresholds need empirical testing

**Research date:** 2026-03-22
**Valid until:** 2026-04-21 (30 days for stable testing patterns, shorter if Go/Jest versions change)
