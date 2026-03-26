# Phase 16: Go Coverage to 60% - Research

**Researched:** 2026-03-22
**Domain:** Go test coverage improvement, CI/CD threshold enforcement, gap analysis automation
**Confidence:** HIGH

## Summary

Phase 16 focuses on systematically increasing Go test coverage from 35.3% to 60% across 27 internal packages through incremental threshold enforcement, gap analysis automation, and targeted test writing. The phase builds on existing infrastructure (gap analysis scripts, coverage gates, factory fixtures, testcontainers) to provide a manageable path to the 60% target.

**Primary recommendation:** Use the existing gap analysis automation to prioritize test writing by critical path (HIGH: combat/matchmaking/rpg, MEDIUM: store/season/notifications, LOW: utilities), enforce incremental gates (45% → 52.5% → 60%) to prevent overwhelming developers, and leverage factory fixtures/testcontainers for fast, isolated test execution.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase focused on test coverage improvement. The scope, requirements, and success criteria are clearly defined:

- **Coverage targets**: Overall 60%, progression 50% → 75%, matchmaking 65% → 80%, store/season/notifications 30-35% → 50-55%
- **Incremental gates**: 45% → 52.5% → 60% to prevent overwhelming developers
- **Gap analysis automation**: Script to identify zero-coverage functions systematically
- **Test infrastructure leverage**: Use existing factory fixtures (testhelpers) and testcontainers for fast, isolated test execution

Implementation approach follows established patterns from v2.3.0/v2.4.0:
- Table-driven tests for edge cases
- Statistical validation for coverage measurements
- CI/CD threshold enforcement with PR feedback
- Focus on critical path packages first

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. All requirements are technical infrastructure tasks with clear implementation paths.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COV-01 | Increase Go coverage from 34.5% to 60% across all 27 packages | Gap analysis automation identifies zero-coverage functions, incremental gates enable systematic progress, factory fixtures/testcontainers enable fast test writing |
| COV-02 | Implement incremental threshold gates (45% → 52.5% → 60%) | Existing coverage_gates.sh already implements stage-based enforcement, needs enhancement for 45%/52.5%/60% stages |
| COV-03 | Increase progression package coverage from 50% to 75% | RPG functions identified (CalculateLevel, XPRequiredForLevel already 100%, AddXP 90%), edge cases in stat allocation validation need tests |
| COV-04 | Increase matchmaking package coverage from 65% to 80% | Matchmaking core functions high coverage (NewPvPMatch, Accept, Complete, IsExpired 100%), gap in integration scenarios with real players |
| COV-05 | Increase store, season, notifications packages coverage from 30-35% to 50-55% | Store: core functions 100% (NewCurrencyBalance, AddCurrency), edge cases in spending/refunds need tests. Season/notifications: low coverage (30%), systematic test writing required |
| COV-06 | Automate gap analysis to identify zero-coverage functions | Existing gap-analysis.sh provides priority scoring (HIGH/MEDIUM/LOW), JSON output for programmatic consumption, fixture suggestions per package |
| COV-07 | Leverage existing factory fixtures and testcontainers for new tests | PlayerBuilder (WithLevel, WithStats, WithGear, WithXP), GearBuilder (WithType, WithRarity), TestDB with snapshot/restore for fast database reset |
| COV-08 | Enforce overall 60% coverage threshold in CI/CD | GitHub Actions workflow coverage-threshold.yml already enforces thresholds, needs stage-based gate configuration (Stage 1: 45%, Stage 2: 52.5%, Stage 3: 60%) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| go test (builtin) | 1.25.0 | Go's built-in testing framework | Official, no dependencies, integrates with coverage tool |
| go tool cover (builtin) | 1.25.0 | Coverage analysis and reporting | Built-in to Go toolchain, generates func/html reports |
| testify | v1.11.1 | Assertion library (assert, require, mock) | Industry standard for Go testing, provides rich assertions |
| testcontainers-go | v0.41.0 | Isolated PostgreSQL containers for integration tests | Fast database reset (100ms vs 5s), eliminates external dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lib/pq | v1.11.2 | PostgreSQL driver | Database operations in testcontainers |
| testcontainers-go/modules/postgres | v0.41.0 | PostgreSQL container module | Integration tests requiring database |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| testcontainers-go | sqlite in-memory | SQLite is faster but production uses PostgreSQL - testcontainers ensures parity |
| testify | gomega | Testify is more widely adopted in Go ecosystem, gomega has more fluent API but steeper learning curve |

**Installation:**
```bash
# Core testing (included with Go 1.25.0)
# No installation required for go test and go tool cover

# testify for assertions (already in go.mod)
go get github.com/stretchr/testify

# testcontainers for integration tests (already in go.mod)
go get github.com/testcontainers/testcontainers-go
go get github.com/testcontainers/testcontainers-go/modules/postgres
```

**Version verification:**
```bash
go version  # Go 1.25.0
go list -m github.com/stretchr/testify  # v1.11.1
go list -m github.com/testcontainers/testcontainers-go  # v0.41.0
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── tests/
│   ├── quality/
│   │   ├── coverage_gates.sh      # Threshold enforcement with stage gates
│   │   └── analyze_gaps.sh       # Gap analysis automation
│   ├── testhelpers/
│   │   ├── fixtures_builder.go     # Factory pattern for test data
│   │   ├── db_testcontainers.go   # PostgreSQL isolation
│   │   └── testhelpers.go       # Assertion utilities
│   ├── rpg/
│   │   ├── rpg_test.go           # Existing RPG tests
│   │   └── rpg_coverage_test.go # NEW: RPG coverage tests
│   ├── matchmaking/
│   │   ├── matchmaking_test.go     # Existing matchmaking tests
│   │   └── matchmaking_coverage_test.go # NEW: Matchmaking coverage tests
│   ├── store/
│   │   └── store_coverage_test.go # NEW: Store coverage tests
│   ├── season/
│   │   └── season_coverage_test.go # NEW: Season coverage tests
│   ├── notifications/
│   │   └── notifications_coverage_test.go # NEW: Notifications coverage tests
│   ├── gear/
│   │   └── gear_coverage_test.go # NEW: Gear coverage tests
│   ├── player/
│   │   └── player_coverage_test.go # NEW: Player coverage tests
│   ├── rpc/
│   │   └── rpc_coverage_test.go # NEW: RPC coverage tests
│   └── utility/
│       └── utility_coverage_test.go # NEW: Utility coverage tests
├── internal/
│   ├── rpg/
│   ├── matchmaking/
│   ├── store/
│   ├── season/
│   └── notifications/
└── data/
    └── coverage-gaps.json        # JSON output from gap analysis
```

### Pattern 1: Table-Driven Tests for Multiple Scenarios
**What:** Use struct slices to define test cases, iterate to execute with consistent assertions
**When to use:** Testing a function with multiple input/output combinations
**Example:**
```go
func TestCalculateLevel(t *testing.T) {
	tests := []struct {
		totalXP  int
		expected int
	}{
		{0, 1},
		{50, 1},
		{100, 1},
		{200, 1},
		{400, 2},
		{900, 3},
		{10000, 10},
		{100000, 31},
	}

	for _, tt := range tests {
		result := rpg.CalculateLevel(tt.totalXP)
		testhelpers.AssertEqual(t, tt.expected, result,
			fmt.Sprintf("Level for %d XP", tt.totalXP))
	}
}
```

### Pattern 2: Factory Pattern for Test Data
**What:** Use builder methods to create test objects with sensible defaults, override specific fields via chaining
**When to use:** Creating complex test objects (players, gear, matches) repeatedly
**Example:**
```go
player := testhelpers.NewPlayerBuilder().
	WithLevel(10).
	WithStats(25, 20, 15, 8).
	WithGear(*testhelpers.NewTestGearWithType("bow", "rare")).
	Build()
```

### Pattern 3: Testcontainers for Database Isolation
**What:** Create isolated PostgreSQL containers per test suite, use snapshot/restore for fast reset
**When to use:** Integration tests requiring database state, avoid external dependencies
**Example:**
```go
ctx := context.Background()
tdb := testhelpers.SetupTestDB(ctx, t)
defer testhelpers.TeardownTestDB(ctx, tdb)

// Reset to initial snapshot before each test
func (s *MyTestSuite) SetupTest() {
	testhelpers.ResetTestDB(s.ctx, s.testDB)
}
```

### Pattern 4: Gap-Driven Test Writing
**What:** Use gap analysis output to identify zero-coverage functions, prioritize by critical path
**When to use:** Systematic coverage improvement, avoiding guesswork
**Example:**
```bash
# Run gap analysis to get prioritized list
make analyze-gaps

# Output shows:
# HIGH PRIORITY: rpg.CalculateLevel (0% coverage)
# MEDIUM PRIORITY: store.SpendCurrency (0% coverage)

# Write tests for high-priority gaps first
```

### Anti-Patterns to Avoid
- **Testing implementation details:** Test behavior, not internal logic. Mock external dependencies, don't test private functions.
- **Coverage for coverage's sake:** Don't write meaningless tests just to increase percentage. Focus on high-impact functions.
- **Skipping error paths:** Always test error handling paths (invalid inputs, failures, edge cases).
- **Hardcoded test data:** Use factory fixtures with defaults, override specific fields. Makes tests maintainable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage measurement | Custom line counting | `go tool cover -func coverage.out` | Handles Go's coverage format, excludes test files, calculates percentages correctly |
| Test isolation | SQLite in-memory | testcontainers PostgreSQL | Production parity, real database behavior, snapshot/restore for fast reset (100ms vs 5s) |
| Test data creation | Hardcoded structs | Factory fixtures (PlayerBuilder, GearBuilder) | Maintainable, consistent defaults, easy customization via chaining |
| Gap analysis | Manual grep/awk | `bash scripts/gap-analysis.sh` | Prioritizes by critical path, outputs JSON for automation, suggests fixtures |
| Coverage enforcement | Shell scripts with bc | `backend/tests/quality/coverage_gates.sh` | Already implements stage-based gates, package-specific thresholds, regression checking |

**Key insight:** Go's built-in testing tools (`go test`, `go tool cover`) are sufficient for most coverage needs. Testcontainers provides production-parity database isolation without external dependencies. Factory fixtures reduce test duplication and improve maintainability.

## Common Pitfalls

### Pitfall 1: Coverage Regression in PRs
**What goes wrong:** PR increases overall coverage but decreases coverage in specific packages (regression)
**Why it happens:** Overall percentage can increase even if individual packages lose coverage due to new low-coverage code
**How to avoid:** Use package-level regression checking in CI/CD (already implemented in coverage-threshold.yml), compare package coverage against baselines
**Warning signs:** GitHub Actions shows overall increase but specific packages show decrease in PR comments

### Pitfall 2: Testing Implementation Instead of Behavior
**What goes wrong:** Tests break when implementation changes even though behavior is unchanged
**Why it happens:** Testing internal logic, mocking private functions, checking exact return values without considering behavior
**How to avoid:** Test public APIs, use black-box testing, focus on input/output relationships, mock external dependencies
**Warning signs:** Test files import internal packages, tests call private functions, tests mock system calls

### Pitfall 3: Slow Test Execution Blocking CI/CD
**What goes wrong:** Tests take 10+ minutes, developers skip running them locally
**Why it happens:** Integration tests recreate database containers for every test, no parallelization, excessive test data setup
**How to avoid:** Use testcontainers snapshot/restore (100ms reset vs 5s recreation), parallelize tests with `go test -parallel`, use factory fixtures for fast data creation
**Warning signs:** CI/CD runs > 5 minutes, developers complain about slow tests, test suite not run locally

### Pitfall 4: Coverage Gaming
**What goes wrong:** Coverage percentage increases but test quality decreases (tests don't catch bugs)
**Why it happens:** Writing meaningless tests just to hit uncovered lines, skipping error paths, testing trivial functions
**How to avoid:** Use mutation testing (go-mutesting) to validate test quality, focus on critical path functions first, review test coverage for meaningful assertions
**Warning signs:** High coverage but low bug detection, tests with single assertion lines, no error path testing

### Pitfall 5: Incremental Threshold Overwhelm
**What goes wrong:** Developers burn out trying to reach 60% from 35.3% in one sprint
**Why it happens:** 25.5% gap is too large, no intermediate milestones, unclear next steps
**How to avoid:** Use incremental gates (45% → 52.5% → 60%), celebrate each milestone, provide gap analysis guidance
**Warning signs:** Coverage stays at 35.3% for multiple weeks, developers skip coverage gates, low morale

### Pitfall 6: Missing Error Path Coverage
**What goes wrong:** Coverage is high but error handling is untested, bugs in production
**Why it happens:** Focus on happy paths, error cases are harder to test, mocking failures is complex
**How to avoid:** Always test error returns, use table-driven tests for error scenarios, mock failures in external dependencies
**Warning signs:** Test files have no error assertions, 100% coverage on happy paths only, production errors in untested branches

## Code Examples

Verified patterns from existing codebase:

### Generate Coverage Report
```go
// Source: backend/scripts/generate-coverage-report.sh
go test -coverprofile=coverage.out -covermode=atomic -coverpkg=./internal/... ./... -v
```

### Extract Overall Coverage Percentage
```bash
# Source: backend/tests/quality/coverage_gates.sh
OVERALL=$(go tool cover -func="$COVERAGE_FILE" | grep "^total:" | awk '{print $3}' | sed 's/%//')
```

### Extract Package-Level Coverage
```bash
# Source: backend/tests/quality/coverage_gates.sh
pkg_cov=$(go tool cover -func="$COVERAGE_FILE" | grep "internal/$pkg/" | awk '{
    coverage = $3
    gsub(/%/, "", coverage)
    sum += coverage
    count++
} END {
    if (count > 0) printf "%.1f", sum/count
    else print "0.0"
}')
```

### Identify Zero-Coverage Functions
```bash
# Source: backend/scripts/gap-analysis.sh
go tool cover -func="$COVERAGE_FILE" | grep -v "^total:" | awk '$3 == "0.0%"'
```

### Factory Fixture Usage
```go
// Source: backend/tests/testhelpers/fixtures_builder.go
player := testhelpers.NewPlayerBuilder().
	WithLevel(10).
	WithStats(25, 20, 15, 8).
	WithGear(*testhelpers.NewTestGearWithType("bow", "rare")).
	Build()

// Verify player properties
testhelpers.AssertEqual(t, 10, player.Level, "Level should be 10")
testhelpers.AssertEqual(t, 25, player.Stats.Attack, "Attack should be 25")
```

### Testcontainers Setup with Snapshot
```go
// Source: backend/tests/testhelpers/db_testcontainers.go
ctx := context.Background()
tdb := testhelpers.SetupTestDB(ctx, t)
defer testhelpers.TeardownTestDB(ctx, tdb)

// Reset to initial snapshot before each test (100ms vs 5s recreation)
func (s *MyTestSuite) SetupTest() {
	testhelpers.ResetTestDB(s.ctx, s.testDB)
}
```

### Table-Driven Test Pattern
```go
// Source: backend/tests/rpg/rpg_test.go
func TestXPRequiredForLevel(t *testing.T) {
	tests := []struct {
		level    int
		expected int
	}{
		{1, 100},
		{2, 400},
		{3, 900},
		{5, 2500},
		{10, 10000},
	}

	for _, tt := range tests {
		result := rpg.XPRequiredForLevel(tt.level)
		testhelpers.AssertEqual(t, tt.expected, result,
			fmt.Sprintf("XP for level %d", tt.level))
	}
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual coverage calculation | `go tool cover -func` automation | Go 1.5+ (2015) | Coverage measurement built into toolchain |
| Coverage gates in shell scripts | GitHub Actions with stage enforcement | Phase 16 (2026) | Incremental gates (45% → 52.5% → 60%) prevent overwhelm |
| Manual gap analysis (grep/awk) | Prioritized gap analysis with JSON output | Phase 16 (2026) | Automation identifies zero-coverage functions with priority scoring |
| SQLite in-memory for tests | testcontainers PostgreSQL with snapshot/restore | Phase 14 (2026) | Production parity, fast reset (100ms vs 5s) |
| Hardcoded test data | Factory fixtures (PlayerBuilder, GearBuilder) | Phase 14 (2026) | Maintainable tests, consistent defaults, easy customization |

**Deprecated/outdated:**
- **Coverage tracking in spreadsheets:** Modern CI/CD pipelines automate coverage tracking and PR integration
- **Manual test data setup:** Factory fixtures reduce duplication and improve maintainability
- **Skipping integration tests due to external dependencies:** testcontainers provide isolated, reproducible environments
- **Coverage as a single percentage goal:** Package-specific targets (critical path vs. utilities) provide better guidance

## Open Questions

1. **Coverage threshold stage transition timing**
   - What we know: Incremental gates (45% → 52.5% → 60%) are implemented in coverage_gates.sh with COVERAGE_GATE_STAGE environment variable
   - What's unclear: When to advance from Stage 1 to Stage 2 to Stage 3 (time-based vs. coverage-based vs. manual decision)
   - Recommendation: Use coverage-based auto-advancement (when Stage 1 threshold met, automatically advance to Stage 2) to reduce manual intervention

2. **Gap analysis fixture suggestions accuracy**
   - What we know: gap-analysis.sh suggests fixtures based on package (testhelpers.NewPlayerBuilder for rpg, testhelpers.NewGearBuilder for gear)
   - What's unclear: Are fixture suggestions accurate for all zero-coverage functions, or do some functions need different fixture patterns
   - Recommendation: Validate fixture suggestions by reviewing a sample of gap analysis output, add custom fixture suggestions for edge cases

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Go 1.25.0 builtin `go test` + testify v1.11.1 |
| Config file | go.mod (test dependencies) |
| Quick run command | `cd backend && go test -run TestFunction ./internal/{package}/...` |
| Full suite command | `cd backend && go test -coverprofile=coverage.out -covermode=atomic -coverpkg=./internal/... ./...` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COV-01 | Overall coverage reaches 60% | integration | `go test -coverprofile=coverage.out -covermode=atomic -coverpkg=./internal/... ./... && go tool cover -func=coverage.out | grep total` | ✅ Phase 16-03 |
| COV-02 | Incremental gates (45% → 52.5% → 60%) | unit/integration | `cd backend/tests/quality && COVERAGE_GATE_STAGE=1 ./coverage_gates.sh` | ✅ Phase 16-01 |
| COV-03 | Progression coverage 50% → 75% | unit | `go test -coverprofile=/tmp/rpg_coverage.out ./internal/rpg/... && go tool cover -func=/tmp/rpg_coverage.out | grep rpg` | ✅ Phase 16-02 |
| COV-04 | Matchmaking coverage 65% → 80% | unit | `go test -coverprofile=/tmp/matchmaking_coverage.out ./internal/matchmaking/... && go tool cover -func=/tmp/matchmaking_coverage.out | grep matchmaking` | ✅ Phase 16-02 |
| COV-05 | Store/Season/Notifications coverage 30-35% → 50-55% | unit | `go test -coverprofile=/tmp/store_coverage.out ./internal/store/... && go tool cover -func=/tmp/store_coverage.out | grep store` | ✅ Phase 16-02 |
| COV-06 | Gap analysis automation identifies zero-coverage functions | unit | `bash backend/scripts/gap-analysis.sh` | ✅ Phase 16-01 |
| COV-07 | Tests leverage factory fixtures and testcontainers | integration | `go test -v ./tests/{package}/...` | ✅ Phase 16-02, 16-03 |
| COV-08 | 60% threshold enforced in CI/CD | integration | `github/workflows/coverage-threshold.yml` (runs on PR/push) | ✅ Phase 16-03 |

### Sampling Rate
- **Per task commit:** `go test -run TestFunction ./internal/{package}/...` (targeted test for specific function)
- **Per wave merge:** `go test -coverprofile=coverage.out -covermode=atomic -coverpkg=./internal/... ./...` (full coverage report)
- **Phase gate:** Full coverage report with threshold enforcement: `cd backend/tests/quality && ./coverage_gates.sh`

### Wave 0 Gaps
- ✅ `backend/tests/quality/coverage_gates.sh` — coverage threshold enforcement with stage gates
- ✅ `backend/scripts/gap-analysis.sh` — gap analysis automation with priority scoring
- ✅ `backend/tests/testhelpers/fixtures_builder.go` — factory fixtures for test data
- ✅ `backend/tests/testhelpers/db_testcontainers.go` — PostgreSQL isolation for integration tests
- ✅ `github/workflows/coverage-threshold.yml` — CI/CD coverage enforcement workflow
- ✅ Framework installation: Go 1.25.0 built-in testing, testify v1.11.1, testcontainers-go v0.41.0

Existing test infrastructure covers all phase requirements. No Wave 0 gaps.

## Sources

### Primary (HIGH confidence)
- Go 1.25.0 documentation — `go test` and `go tool cover` built-in tools
- testify v1.11.1 — Assertion library for Go testing (https://github.com/stretchr/testify)
- testcontainers-go v0.41.0 — Isolated PostgreSQL containers (https://github.com/testcontainers/testcontainers-go)
- backend/tests/quality/coverage_gates.sh — Stage-based coverage threshold enforcement
- backend/scripts/gap-analysis.sh — Priority scoring and fixture suggestions for zero-coverage functions
- backend/tests/testhelpers/fixtures_builder.go — Factory pattern for test data
- backend/tests/testhelpers/db_testcontainers.go — PostgreSQL isolation with snapshot/restore
- backend/tests/rpg/rpg_test.go — Table-driven test pattern examples

### Secondary (MEDIUM confidence)
- GitHub Actions coverage-threshold.yml — CI/CD integration with PR comments
- Makefile targets (`coverage-gates`, `analyze-gaps`) — Local test execution commands
- Coverage report format (`go tool cover -func`) — Coverage percentage extraction patterns

### Tertiary (LOW confidence)
- None (all findings verified against existing codebase and documentation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Go built-in tools, testify, testcontainers-go all verified in go.mod and existing code
- Architecture: HIGH - Existing patterns (table-driven tests, factory fixtures, testcontainers) documented in test files
- Pitfalls: HIGH - Identified from existing codebase issues (slow tests, coverage regressions, implementation testing)

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (30 days - Go testing tools are stable, coverage patterns well-established)
