# Phase 1: Test Infrastructure Foundation - Research

**Researched:** 2026-03-19
**Domain:** Testing & QA Infrastructure for Go Backend (Nakama) and Godot 4 Game Client
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational testing infrastructure for both Go backend and Godot client. The project already has testify v1.11.1 in go.mod and a basic custom test framework for Godot, but lacks unified test reporting, test pyramid enforcement, race detection in CI, and proper test isolation. The recommended approach leverages Go's native testing with testify for assertions and test suites, enhances the Godot test framework with GUT (Godot Unit Test) for comprehensive GDScript testing, and implements a unified test runner with CI/CD integration.

**Primary recommendation:** Use testify v1.11.1 (already in go.mod) for Go backend assertions and test suites, integrate GUT 9.5.0 for Godot 4 client testing, implement a unified test runner script that executes both backends and generates consolidated reports, enforce test pyramid ratios via automated checks, and enable Go race detector in CI for all concurrent code.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **testify** | v1.11.1 | Go assertions, mocks, and test suites | Industry standard for Go testing; already in go.mod; provides readable assertions, suite support, and mocking |
| **GUT** | 9.5.0 | Godot 4 unit testing framework | Most mature GDScript testing framework; supports assertions, doubling, CI integration, JUnit XML output |
| **Go testing** | Native (Go 1.25.0) | Built-in Go test framework | Official Go testing; integrates with testify; supports race detection via `-race` flag |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **testcontainers-go** | Latest | Database isolation for integration tests | Phase 2: Spins up isolated PostgreSQL instances per test suite; prevents test pollution |
| **golangci-lint** | Latest | Go linting with testify support | CI/CD: Run alongside tests to catch common mistakes; use testifylint to avoid common testify issues |
| **JUnit XML formatter** | Built-in to GUT | Test result format for CI reporting | CI/CD: Convert Godot test results to JUnit format for GitHub Actions reporting |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| testify | Native Go `testing` only | More verbose; no assertion helpers; no suite support; testify is superior |
| GUT | Custom Godot test framework | Current framework is basic; GUT provides comprehensive assertions, mocking, CI integration |
| Unified runner | Separate test commands | Simpler but no consolidated reporting; unified runner provides single source of truth for test results |

**Installation:**
```bash
# Go backend (testify already installed)
cd backend
go test ./...  # Run all tests
go test -race ./...  # Run with race detector
go test -v ./...  # Verbose output

# Godot client (install GUT)
# Download GUT 9.5.0 for Godot 4.5+ from:
# https://github.com/bitwes/Gut/releases
# Extract addons/gut to project root
# Enable GUT plugin in Project Settings > Plugins

# Run Godot tests (after GUT installation)
godot4 --headless --script res://test/run_all_tests.gd
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── tests/
│   ├── testhelpers/          # Shared test utilities
│   │   ├── assertions.go     # Custom assertions on top of testify
│   │   └── fixtures.go       # Test data fixtures (Phase 2)
│   ├── player/               # Player system tests
│   ├── combat/               # Combat system tests
│   └── ...
├── internal/
│   ├── player/
│   │   ├── player.go         # Production code
│   │   └── player_test.go    # Unit tests (co-located)
│   └── ...
test/
├── run_all_tests.gd          # Unified test runner (enhance with GUT)
├── test_framework.gd         # Legacy framework (migrate to GUT)
├── suites/                   # GUT test suites
│   ├── player/
│   │   └── test_player_stats.gd
│   └── combat/
│       └── test_combat_manager.gd
└── helpers/                  # Test helpers and fixtures
    └── test_helpers.gd
```

### Pattern 1: Table-Driven Tests in Go
**What:** Use Go's table-driven test pattern with testify assertions for testing multiple scenarios
**When to use:** Testing functions with multiple input/output combinations
**Example:**
```go
// Source: https://github.com/stretchr/testify
func TestXPRequiredForLevel(t *testing.T) {
	tests := []struct {
		level    int
		expected int
	}{
		{1, 100},
		{2, 200},
		{5, 500},
		{10, 1000},
		{50, 5000},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("level_%d", tt.level), func(t *testing.T) {
			result := player.XPRequiredForLevel(tt.level)
			assert.Equal(t, tt.expected, result, "XP for level %d", tt.level)
		})
	}
}
```

### Pattern 2: Testify Suite for Setup/Teardown
**What:** Use testify's suite package for shared setup/teardown logic
**When to use:** Multiple tests need common setup (database connections, test data)
**Example:**
```go
// Source: https://github.com/stretchr/testify
type PlayerTestSuite struct {
	suite.Suite
	db *sql.DB
}

func (suite *PlayerTestSuite) SetupTest() {
	// Runs before each test
	suite.db = setupTestDB()
}

func (suite *PlayerTestSuite) TearDownTest() {
	// Runs after each test
	suite.db.Close()
}

func (suite *PlayerTestSuite) TestPlayerCreation() {
	// Test code here
	assert.NotNil(suite.T(), suite.db)
}

func TestPlayerTestSuite(t *testing.T) {
	suite.Run(t, new(PlayerTestSuite))
}
```

### Pattern 3: GUT Test Structure for Godot
**What:** Use GUT's test structure with inner classes and before_each/after_each
**When to use:** Godot tests needing setup/teardown and organized test grouping
**Example:**
```gdscript
# Source: https://github.com/bitwes/Gut
extends GutTest

var _player_stats: PlayerStatsManager

func before_each():
	_player_stats = PlayerStatsManager.new()
	add_child_autofree(_player_stats)

func after_each():
	_player_stats = null

func test_default_level():
	assert_eq(_player_stats.level, 1, "Level should start at 1")

func test_xp_gain_no_level_up():
	_player_stats.add_xp(50)
	assert_eq(_player_stats.level, 1, "Should still be level 1")
	assert_eq(_player_stats.xp, 50, "XP should be 50")
```

### Pattern 4: Unified Test Runner
**What:** Single script that runs both Go and Godot tests and generates consolidated report
**When to use:** CI/CD pipelines and local development for complete test feedback
**Example:**
```bash
#!/bin/bash
# scripts/run_all_tests.sh

set -e

echo "🧪 Running Go backend tests..."
cd backend
go test -v -race ./... 2>&1 | tee go-test-results.txt
cd ..

echo "🎮 Running Godot client tests..."
godot4 --headless --script res://test/run_all_tests.gd 2>&1 | tee godot-test-results.txt

echo "✅ All tests passed!"
```

### Anti-Patterns to Avoid
- **Testing private methods:** Test public interfaces only; coupling tests to implementation breaks on refactoring
- **Shared test state:** Tests should be isolated; use fresh instances per test (before_each in GUT, SetupTest in testify)
- **Ignoring race detector warnings:** Race conditions are critical bugs; always run `-race` in CI for concurrent code
- **Hard-coded test data:** Use factory functions (Phase 2) for consistent, maintainable test data
- **Sleeping in tests:** Use proper synchronization (channels, signals) instead of arbitrary delays

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test assertions | Custom assert functions | testify assertions | Readable error messages; extensive assertion library; battle-tested |
| Mock objects | Manual mock implementations | testify/mock or uber/mock | Interface-based mocking; expectation verification; less boilerplate |
| Test suites | Custom setup/teardown logic | testify/suite | Standard pattern; consistent lifecycle hooks; integrates with go test |
| Godot test framework | Custom test runner | GUT framework | Comprehensive assertions; doubling/mocking; CI integration; JUnit output |
| Database isolation | Shared test database | testcontainers-go | Isolated instances per test; prevents pollution; parallel test execution |

**Key insight:** Custom testing infrastructure accumulates technical debt and maintenance burden. Industry-standard tools (testify, GUT) are battle-tested, well-documented, and provide features you'd eventually need to build anyway.

## Common Pitfalls

### Pitfall 1: Ice Cream Cone Anti-Pattern
**What goes wrong:** Too many slow E2E tests, not enough fast unit tests; test suite becomes sluggish
**Why it happens:** E2E tests are easier to write for complex scenarios; lack of test architecture discipline
**How to avoid:** Enforce 70/20/10 test pyramid (unit/integration/E2E) via automated checks; track test execution time; make E2E tests expensive to write
**Warning signs:** Test suite takes >10 minutes; flaky tests due to timing issues; developers avoid running tests locally

### Pitfall 2: Testing Private Implementation Details
**What goes wrong:** Tests break when refactoring; false negatives; brittle test suite
**Why it happens:** Testing internal functions/methods instead of observable behavior
**How to avoid:** Test public interfaces and observable behavior only; use black-box testing for integration tests; treat code under test as a black box
**Warning signs:** Tests break after code refactoring with no behavior change; tests access unexported functions

### Pitfall 3: Skipping Race Detector in Concurrent Code
**What goes wrong:** Race conditions in production; data corruption; non-deterministic bugs
**Why it happens:** Race detector slows tests 10x; developers skip it for faster feedback
**How to avoid:** Always run `go test -race` in CI for concurrent Nakama code; treat race warnings as critical bugs; use `-short` flag for quick local runs
**Warning signs:** Non-deterministic test failures; production bugs that can't be reproduced locally; data corruption under load

### Pitfall 4: Brittle Godot Autoload Tests
**What goes wrong:** Tests pollute each other's state; flaky failures; hard to debug
**Why it happens:** Godot autoloads are global singletons; shared state across tests
**How to avoid:** Use GUT's `before_each()` to create fresh autoload instances; design autoloads with reset methods; use dependency injection for testability
**Warning signs:** Tests pass individually but fail in suite; test order affects results; state leaks between tests

### Pitfall 5: Test Data Sprawl
**What goes wrong:** Duplicate test data; hard to maintain; inconsistent test scenarios
**Why it happens:** Copy-pasting test setup; no centralized test data management
**How to avoid:** Use factory pattern for test data (Phase 2); builder pattern for flexible test objects; shared fixtures via JSON
**Warning signs:** Same test data copied across multiple files; hard to update test scenarios; inconsistent data breaks tests

## Code Examples

Verified patterns from official sources:

### Go Test with Testify Assertions
```go
// Source: https://github.com/stretchr/testify
package player_test

import (
	"testing"
	"github.com/stretchr/testify/assert"
	"github.com/anchapin/armored-archer/backend/internal/player"
)

func TestDefaultPlayerStats(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")

	assert.Equal(t, "user123", stats.UserID, "UserID should match")
	assert.Equal(t, 1, stats.Level, "Level should be 1")
	assert.Equal(t, 0, stats.XP, "XP should be 0")
	assert.Equal(t, 10, stats.Stats.Attack, "Attack should be 10")
}
```

### Go Test with Race Detector
```bash
# Run tests with race detector
cd backend
go test -race ./...

# CI configuration
# .github/workflows/test.yml
- name: Run tests with race detector
  run: |
    go test -v -race -timeout=30s ./...
```

### GUT Test Structure
```gdscript
# Source: https://github.com/bitwes/Gut
extends GutTest

var _player: PlayerStatsManager

func before_each():
	_player = PlayerStatsManager.new()
	add_child_autofree(_player)

func test_level_starts_at_one():
	assert_eq(_player.level, 1, "New player should start at level 1")

func test_add_xp_increases_xp():
	_player.add_xp(100)
	assert_eq(_player.xp, 100, "XP should increase by amount added")

func test_level_up_at_threshold():
	_player.add_xp(100)  # Level 1 threshold
	assert_eq(_player.level, 2, "Should level up after reaching XP threshold")
```

### Unified Test Runner Script
```bash
#!/bin/bash
# scripts/test-all.sh
set -e

echo "======================================="
echo "🧪 Armored Archer Test Suite"
echo "======================================="

# Backend tests
echo ""
echo "📦 Backend Tests (Go + Testify)"
echo "-----------------------------------"
cd backend
go test -v -race -coverprofile=coverage.out ./... 2>&1 | tee ../test-results/backend.txt
go tool cover -html=coverage.out -o ../test-results/coverage.html
cd ..

# Frontend tests
echo ""
echo "🎮 Frontend Tests (Godot + GUT)"
echo "-----------------------------------"
godot4 --headless --script res://test/run_all_tests.gd 2>&1 | tee test-results/frontend.txt

# Summary
echo ""
echo "======================================="
echo "✅ All tests passed!"
echo "Backend coverage: test-results/coverage.html"
echo "======================================="
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom test frameworks | testify + GUT | 2024-2025 | Industry-standard tools; better CI integration; comprehensive assertions |
| Manual mock objects | testify/mock and uber/mock | 2023-2024 | Interface-based mocking; expectation verification; less boilerplate |
| Shared test database | testcontainers-go | 2021-2023 | Isolated test environments; parallel execution; no test pollution |
| Basic test reporting | Unified JUnit XML + dashboards | 2022-2024 | CI/CD integration; test trends; flaky test detection |

**Deprecated/outdated:**
- **Custom assertion libraries:** testify has become the de facto standard; use testify instead
- **Godot 3.x testing tools:** Migrate to GUT 9.x for Godot 4.x; older versions lack features
- **Manual test runners:** Use unified test runner with CI integration; separate commands create fragmented feedback

## Open Questions

1. **Should we use testify/mock or uber/mock for interface mocking?**
   - What we know: testify/mock is simpler; uber/mock generates mocks from interfaces automatically
   - What's unclear: Which provides better developer experience for Nakama interface mocking
   - Recommendation: Start with testify/mock (built into testify); evaluate uber/mock in Phase 2 if boilerplate becomes burdensome

2. **How to enforce test pyramid ratios (70/20/10) automatically?**
   - What we know: Need to classify tests by type (unit/integration/E2E); check ratios in CI
   - What's unclear: Best way to classify tests; naming conventions vs annotations vs directory structure
   - Recommendation: Use directory structure (backend/tests/unit, backend/tests/integration) and script to count test files per category

3. **Should we migrate existing custom test framework to GUT immediately?**
   - What we know: Current framework is basic; GUT provides comprehensive features
   - What's unclear: Migration effort; compatibility with existing tests
   - Recommendation: Keep existing framework working; adopt GUT for new tests; migrate old tests incrementally during Phase 3

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend Framework | Go testing + testify v1.11.1 |
| Frontend Framework | GUT 9.5.0 (Godot 4.x) |
| Config file | backend/go.mod (Go), .gutconfig.json (GUT) |
| Quick run command | `cd backend && go test ./... && godot4 --headless --script res://test/run_all_tests.gd` |
| Full suite command | `./scripts/test-all.sh` (unified runner) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-01 | Go backend uses testify for assertions and test suites | unit | `cd backend && go test -v ./... | grep -E "(PASS|FAIL)"` | ✅ 234 existing tests need testify migration |
| FND-02 | Godot client uses enhanced GUT framework | unit | `godot4 --headless --script res://test/run_all_tests.gd` | ❌ GUT not installed; needs setup |
| FND-03 | Test runner executes all tests with unified reporting | integration | `./scripts/test-all.sh` | ❌ Script needs creation |
| FND-04 | Test pyramid enforced (70/20/10) via automated checks | integration | `./scripts/check-test-pyramid.sh` | ❌ Script needs creation |
| FND-05 | Go race detector runs in CI for concurrent code | unit | `cd backend && go test -race ./...` | ❌ CI workflow needs update |
| FND-06 | Tests are isolated and don't depend on shared state | unit | `go test -shuffle=on ./... && godot4 --headless res://test/run_all_tests.gd` | ❌ Need isolation verification |

### Sampling Rate
- **Per task commit:** `cd backend && go test -short ./... && godot4 --headless --script res://test/run_all_tests.gd`
- **Per wave merge:** `./scripts/test-all.sh` (full suite with race detector and coverage)
- **Phase gate:** Full suite green with race detector enabled before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/testhelpers/assertions.go` — migrate existing testhelpers to testify
- [ ] `backend/tests/testhelpers/fixtures.go` — create fixture foundation (Phase 2 preparation)
- [ ] `test/suites/` directory structure — organize tests into GUT suites
- [ ] `.gutconfig.json` — GUT configuration for CI integration
- [ ] `scripts/test-all.sh` — unified test runner script
- [ ] `scripts/check-test-pyramid.sh` — test pyramid validation script
- [ ] `.github/workflows/test.yml` — update to include race detector
- [ ] `addons/gut/` — install GUT 9.5.0 for Godot 4.x

## Sources

### Primary (HIGH confidence)
- [Testify GitHub Repository](https://github.com/stretchr/testify) - Assertions, mocking, and test suites for Go
- [GUT (Godot Unit Test) GitHub Repository](https://github.com/bitwes/Gut) - Unit testing framework for Godot 4.x
- [Testcontainers for Go Documentation](https://golang.testcontainers.org/) - Database isolation for integration tests
- [Go Testing Documentation](https://go.dev/doc/tutorial/add-a-test) - Official Go testing guide
- [Go Race Detector](https://go.dev/doc/articles/race_detector) - Official race detection documentation

### Secondary (MEDIUM confidence)
- [Armored Archer Codebase Analysis](2026-03-19) - 234 existing Go integration tests, custom Godot test framework, testify v1.11.1 in go.mod
- [Google Testing Blog](https://testing.googleblog.com/) - Testing strategies and test pyramid principles
- [Martin Fowler - Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) - Industry-standard test automation strategy

### Tertiary (LOW confidence)
- [Nakama Testing Examples](https://github.com/heroiclabs/nakama-community-examples) - Limited official testing documentation; community patterns only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools have official documentation and industry adoption; testify already in go.mod
- Architecture: HIGH - Patterns are well-established (table-driven tests, testify suites, GUT structure)
- Pitfalls: HIGH - Sources from official Go documentation, established testing anti-patterns, and project analysis

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days - testing tools are stable, but verify latest GUT version before Phase 3)
