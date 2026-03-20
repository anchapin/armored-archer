# Phase 05: Complete Test Infrastructure Foundation (Gap Closure) - Research

**Researched:** 2026-03-20
**Domain:** Unified Test Infrastructure, Test Pyramid Enforcement, Race Detection, Test Isolation
**Confidence:** HIGH

## Summary

Phase 05 closes gaps identified in the v2.3.0 milestone audit where Phase 1 requirements FND-03 through FND-06 were marked as "orphaned" - marked complete in REQUIREMENTS.md but never actually implemented. This phase implements the missing foundational testing infrastructure: a unified test runner that executes both Go backend and Godot frontend tests with consolidated reporting, automated test pyramid enforcement (70/20/10 unit/integration/E2E ratio), Go race detector integration in CI, and test isolation verification via shuffle flags.

The project already has testify v1.11.1 for Go, GUT 9.6.0 for Godot (installed in Phase 1-02), and existing CI workflows. The gap is that these components operate independently with no unified orchestration, no pyramid ratio enforcement, race detector not enabled in CI, and no test isolation verification. This phase bridges those gaps with minimal invasive changes to existing infrastructure.

**Primary recommendation:** Implement a bash-based unified test runner (`scripts/test-all.sh`) that orchestrates Go and Godot test execution, create a test pyramid classification and validation script (`scripts/check-test-pyramid.sh`), enable Go race detector in CI workflows via `-race` flag, and add `-shuffle=on` flag to both Go and Godot test execution to verify test isolation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Bash** | Native (any 4.x+) | Unified test runner orchestration | Universal scripting; CI/CD compatible; process control; exit code handling |
| **Go testing** | Native (Go 1.25.0) | Built-in test execution with flags | Official Go testing; `-race` flag for data race detection; `-shuffle` flag for isolation |
| **GUT** | 9.6.0 (installed) | Godot 4 unit testing framework | Already installed in Phase 1-02; supports test execution via CLI |
| **testify** | v1.11.1 (in go.mod) | Go assertions and test suites | Already in go.mod; industry standard for Go testing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **JUnit XML** | Built-in to GUT | Test result format for unified reporting | CI/CD: Aggregate test results from both Go and Godot into single report |
| **go test flags** | Native | Race detection, shuffle, coverage | CI: `-race` for data races, `-shuffle=on` for isolation, `-coverprofile` for coverage |
| **jq** | CLI tool | JSON parsing for test result aggregation | Optional: Parse JSON test outputs for unified reporting |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bash unified runner | Makefile target `make test-all` | Make is cleaner for deps but bash provides better process control and error handling for multi-language testing |
| Directory-based test classification | File naming conventions | Directory structure is clearer; naming conventions require documentation and can be inconsistent |
| `-shuffle=on` flag | Manual test reordering | Shuffle is automated and random; manual is error-prone and doesn't catch all order dependencies |

**Installation:**
```bash
# No new installations needed - all tools already in place
# Verify existing tools:
go version  # Go 1.21.6+ installed
godot4 --version  # Godot 4.x (may need PATH setup)
jq --version  # Optional: for JSON parsing in unified runner

# Verify existing test frameworks:
cd backend && go list -m github.com/stretchr/testify  # v1.1.11.1
ls addons/gut/  # GUT 9.6.0 installed from Phase 1-02
```

## Architecture Patterns

### Recommended Project Structure
```
scripts/
├── test-all.sh              # Unified test runner (NEW - FND-03)
├── check-test-pyramid.sh    # Test pyramid validator (NEW - FND-04)
└── local-godot-tests.sh     # Existing Godot test runner (reference)

backend/tests/
├── unit/                    # Unit tests (70% target)
│   ├── player/
│   ├── combat/
│   └── ...
├── integration/             # Integration tests (20% target)
│   ├── db_suite_test.go
│   └── rpc/
└── e2e/                     # E2E tests (10% target)
    └── (rare, full-stack tests)

test/suites/                 # Godot tests (already organized by subsystem)
├── player/                  # Unit tests (70% target)
├── combat/                  # Unit tests (70% target)
├── integration/             # Integration tests (20% target) - NEW classification
└── e2e/                     # E2E tests (10% target) - NEW classification

.github/workflows/
├── test.yml                 # Existing: Godot tests
├── ci.yml                   # Existing: Backend tests (NEEDS: -race flag for FND-05)
└── unified-test.yml         # NEW: Unified test workflow with pyramid check (FND-04)
```

### Pattern 1: Unified Test Runner (Bash Orchestration)
**What:** Single bash script that runs Go and Godot tests sequentially, captures exit codes, and generates consolidated report
**When to use:** CI/CD pipelines and local development for complete test feedback
**Example:**
```bash
#!/bin/bash
# scripts/test-all.sh
set -e

echo "======================================="
echo "🧪 Armored Archer Unified Test Suite"
echo "======================================="

# Track overall success
OVERALL_SUCCESS=0

# Backend tests (Go)
echo ""
echo "📦 Backend Tests (Go + Testify)"
echo "-----------------------------------"
cd backend
if go test -v -race -shuffle=on ./... 2>&1 | tee ../test-results/backend.txt; then
    echo "✅ Backend tests passed"
else
    echo "❌ Backend tests failed"
    OVERALL_SUCCESS=1
fi
cd ..

# Frontend tests (Godot)
echo ""
echo "🎮 Frontend Tests (Godot + GUT)"
echo "-----------------------------------"
if godot4 --headless --script res://test/run_all_tests.gd 2>&1 | tee test-results/frontend.txt; then
    echo "✅ Frontend tests passed"
else
    echo "❌ Frontend tests failed"
    OVERALL_SUCCESS=1
fi

# Exit with appropriate code
if [ $OVERALL_SUCCESS -eq 0 ]; then
    echo ""
    echo "======================================="
    echo "✅ All tests passed!"
    echo "======================================="
    exit 0
else
    echo ""
    echo "======================================="
    echo "❌ Some tests failed - check logs above"
    echo "======================================="
    exit 1
fi
```

### Pattern 2: Test Pyramid Classification (Directory Structure)
**What:** Organize tests into unit/, integration/, and e2e/ directories to enable automated ratio enforcement
**When to use:** All new test files; existing tests need migration
**Example:**
```
backend/tests/
├── unit/player/player_test.go           # Fast, no external deps
├── integration/db/db_suite_test.go      # Database testcontainers
└── e2e/full_match_flow_test.go          # Full Nakama + DB flow

test/suites/
├── player/test_player_stats.gd          # Unit: mocks autoloads
├── integration/test_network_flow.gd      # Integration: real Nakama connection
└── e2e/test_full_match_flow.gd          # E2E: complete game loop
```

### Pattern 3: Test Pyramid Enforcement (Automated Check)
**What:** Script that counts tests by category and validates 70/20/10 ratio
**When to use:** CI/CD pipeline to prevent ice cream cone anti-pattern
**Example:**
```bash
#!/bin/bash
# scripts/check-test-pyramid.sh

# Count Go tests by directory
GO_UNIT=$(find backend/tests/unit -name "*_test.go" 2>/dev/null | wc -l)
GO_INTEGRATION=$(find backend/tests/integration -name "*_test.go" 2>/dev/null | wc -l)
GO_E2E=$(find backend/tests/e2e -name "*_test.go" 2>/dev/null | wc -l)

# Count Godot tests by directory (similar pattern)
GODOT_UNIT=$(find test/suites/player -name "test_*.gd" 2>/dev/null | wc -l)
# ... etc

TOTAL_TESTS=$((GO_UNIT + GO_INTEGRATION + GO_E2E + GODOT_UNIT + GODOT_INTEGRATION + GODOT_E2E))

if [ $TOTAL_TESTS -eq 0 ]; then
    echo "❌ No tests found!"
    exit 1
fi

# Calculate percentages
UNIT_PCT=$((GO_UNIT * 100 / TOTAL_TESTS))
INTEGRATION_PCT=$((GO_INTEGRATION * 100 / TOTAL_TESTS))
E2E_PCT=$((GO_E2E * 100 / TOTAL_TESTS))

# Validate ratios (with tolerance ±10%)
if [ $UNIT_PCT -lt 60 ] || [ $UNIT_PCT -gt 80 ]; then
    echo "❌ Test pyramid violation: Unit tests $UNIT_PCT% (target: 70% ±10%)"
    exit 1
fi

if [ $INTEGRATION_PCT -lt 10 ] || [ $INTEGRATION_PCT -gt 30 ]; then
    echo "❌ Test pyramid violation: Integration tests $INTEGRATION_PCT% (target: 20% ±10%)"
    exit 1
fi

if [ $E2E_PCT -gt 20 ]; then
    echo "❌ Test pyramid violation: E2E tests $E2E_PCT% (target: 10% ±10%)"
    exit 1
fi

echo "✅ Test pyramid validated: Unit $UNIT_PCT%, Integration $INTEGRATION_PCT%, E2E $E2E_PCT%"
```

### Pattern 4: Race Detector Integration (CI/CD)
**What:** Enable Go's built-in race detector in CI workflows via `-race` flag
**When to use:** All CI test runs for Go backend code
**Example:**
```yaml
# .github/workflows/ci.yml (existing workflow - modify)
jobs:
  backend-test:
    name: Backend Tests with Race Detector
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'

      # NEW: Run tests with race detector (FND-05)
      - name: Run tests with race detector
        run: |
          cd backend
          go test -v -race -timeout=30s ./...
        env:
          # Race detector requires more CPUs
          GOMAXPROCS: 2
```

### Pattern 5: Test Isolation Verification (Shuffle Flag)
**What:** Use `-shuffle=on` flag to randomize test execution order and detect shared state dependencies
**When to use:** All CI test runs for both Go and Godot
**Example:**
```bash
# Go tests with shuffle (FND-06)
cd backend
go test -v -race -shuffle=on ./...

# Godot tests with shuffle (GUT doesn't support shuffle natively, so we run tests in random order via script)
# Alternative: Run test suite multiple times with different order
for i in {1..3}; do
    godot4 --headless --script res://test/run_all_tests.gd || exit 1
done
```

### Anti-Patterns to Avoid
- **Separate test commands for each language:** Creates fragmented feedback; use unified runner instead
- **Manual test pyramid validation:** Developers will forget; automate the check in CI
- **Skipping race detector for speed:** Race conditions are critical bugs; always run in CI even if slower
- **Hard-coded test execution order:** Tests should pass in any order; use shuffle to verify isolation
- **Ignoring test pyramid ratios:** Too many E2E tests create slow, flaky suites; enforce 70/20/10 automatically

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unified test runner | Custom Go/Rust/Python program | Bash script | Universal; CI/CD compatible; easy to debug; no compilation needed |
| Test classification | Custom test annotations/metadata | Directory structure | Clear; self-documenting; works with any language; no framework changes |
| Race detection | Custom concurrency validators | Go `-race` flag | Built-in; battle-tested; detects actual data races; zero setup |
| Test isolation | Custom state tracking | Go `-shuffle=on` flag | Built-in; randomizes order; detects implicit dependencies |
| Test result aggregation | Custom XML/JSON parser | Standard exit codes + JUnit XML | CI systems already consume JUnit; bash handles exit codes natively |

**Key insight:** The testing infrastructure needed for FND-03 through FND-06 is mostly about orchestrating existing tools correctly, not building new capabilities. Bash scripts, directory structure, and Go test flags provide everything needed.

## Common Pitfalls

### Pitfall 1: Fragmented Test Feedback
**What goes wrong:** Developers run Go tests but forget Godot tests, or vice versa; bugs slip through
**Why it happens:** Separate test commands with no unified entry point
**How to avoid:** Implement `scripts/test-all.sh` and make it the primary command (`make test-all`)
**Warning signs:** Developers only run tests for their language; CI passes but local tests fail

### Pitfall 2: Ice Cream Cone Anti-Pattern
**What goes wrong:** Too many slow E2E tests, not enough fast unit tests; test suite becomes sluggish (>10 min)
**Why it happens:** E2E tests are easier to write for complex scenarios; lack of enforcement
**How to avoid:** Implement `scripts/check-test-pyramid.sh` and run in CI; fail PRs outside 70/20/10 ±10% tolerance
**Warning signs:** Test suite takes >10 minutes; developers avoid running tests locally; flaky tests due to timing

### Pitfall 3: Undetected Race Conditions
**What goes wrong:** Data races in production; non-deterministic bugs; data corruption under load
**Why it happens:** Race detector slows tests 10x; developers skip it for faster feedback
**How to avoid:** Always run `go test -race` in CI; use `-short` flag for quick local runs; treat race warnings as critical bugs
**Warning signs:** Non-deterministic test failures; production bugs that can't be reproduced locally; crashes under concurrent load

### Pitfall 4: Test Order Dependencies
**What goes wrong:** Tests pass individually but fail in suite; test order affects results; state leaks between tests
**Why it happens:** Tests depend on shared state or execution order; no isolation verification
**How to avoid:** Run `go test -shuffle=on` in CI; use fresh instances per test (before_each in GUT, SetupTest in testify)
**Warning signs:** Tests pass individually but fail in suite; test order affects results; intermittent failures

### Pitfall 5: Manual Test Classification Errors
**What goes wrong:** Tests misclassified as unit/integration/E2E; pyramid ratios calculated incorrectly
**Why it happens:** Ad-hoc classification; no clear criteria; developers misjudge dependencies
**How to avoid:** Use directory structure for classification (unit/, integration/, e2e/); document criteria in CONTRIBUTING.md
**Warning signs:** Pyramid validation script fails; developers disagree on test classification; inconsistent ratios

## Code Examples

Verified patterns from official sources:

### Unified Test Runner Script
```bash
#!/bin/bash
# scripts/test-all.sh
# Source: Pattern based on standard bash orchestration practices

set -e  # Exit on error
set -o pipefail  # Catch errors in pipes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================="
echo "🧪 Armored Archer Unified Test Suite"
echo "======================================="

# Create test results directory
mkdir -p test-results

# Track overall success
OVERALL_SUCCESS=0

# Backend tests (Go with race detector and shuffle)
echo ""
echo -e "${YELLOW}📦 Backend Tests (Go + Testify)${NC}"
echo "-----------------------------------"
cd backend

# Run Go tests with race detector and shuffle (FND-05, FND-06)
if go test -v -race -shuffle=on -timeout=30s ./... 2>&1 | tee ../test-results/backend.txt; then
    echo -e "${GREEN}✅ Backend tests passed${NC}"
else
    echo -e "${RED}❌ Backend tests failed${NC}"
    OVERALL_SUCCESS=1
fi

cd ..

# Frontend tests (Godot with GUT)
echo ""
echo -e "${YELLOW}🎮 Frontend Tests (Godot + GUT)${NC}"
echo "-----------------------------------"

# Run Godot tests (GUT supports headless mode)
if godot4 --headless --script res://test/run_all_tests.gd 2>&1 | tee test-results/frontend.txt; then
    echo -e "${GREEN}✅ Frontend tests passed${NC}"
else
    echo -e "${RED}❌ Frontend tests failed${NC}"
    OVERALL_SUCCESS=1
fi

# Exit with appropriate code
echo ""
echo "======================================="
if [ $OVERALL_SUCCESS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo "======================================="
    exit 0
else
    echo -e "${RED}❌ Some tests failed - check logs above${NC}"
    echo "======================================="
    exit 1
fi
```

### Test Pyramid Validation Script
```bash
#!/bin/bash
# scripts/check-test-pyramid.sh
# Source: Pattern based on test pyramid best practices

set -e

echo "======================================="
echo "📊 Test Pyramid Validation"
echo "======================================="
echo ""

# Tolerance for pyramid ratios (±10%)
UNIT_MIN=60
UNIT_MAX=80
INTEGRATION_MIN=10
INTEGRATION_MAX=30
E2E_MAX=20

# Count Go tests by directory
echo "Counting Go backend tests..."
GO_UNIT=$(find backend/tests/unit -name "*_test.go" 2>/dev/null | wc -l)
GO_INTEGRATION=$(find backend/tests/integration -name "*_test.go" 2>/dev/null | wc -l)
GO_E2E=$(find backend/tests/e2e -name "*_test.go" 2>/dev/null | wc -l)

# Count Godot tests by directory
echo "Counting Godot frontend tests..."
GODOT_UNIT=$(find test/suites/player test/suites/combat test/suites/gear -name "test_*.gd" 2>/dev/null | wc -l)
GODOT_INTEGRATION=$(find test/suites/integration -name "test_*.gd" 2>/dev/null | wc -l)
GODOT_E2E=$(find test/suites/e2e -name "test_*.gd" 2>/dev/null | wc -l)

# Calculate totals
TOTAL_UNIT=$((GO_UNIT + GODOT_UNIT))
TOTAL_INTEGRATION=$((GO_INTEGRATION + GODOT_INTEGRATION))
TOTAL_E2E=$((GO_E2E + GODOT_E2E))
TOTAL_TESTS=$((TOTAL_UNIT + TOTAL_INTEGRATION + TOTAL_E2E))

if [ $TOTAL_TESTS -eq 0 ]; then
    echo "❌ No tests found!"
    exit 1
fi

# Calculate percentages
UNIT_PCT=$((TOTAL_UNIT * 100 / TOTAL_TESTS))
INTEGRATION_PCT=$((TOTAL_INTEGRATION * 100 / TOTAL_TESTS))
E2E_PCT=$((TOTAL_E2E * 100 / TOTAL_TESTS))

# Display results
echo "Test Distribution:"
echo "  Unit tests:        $TOTAL_UNIT ($UNIT_PCT%)"
echo "  Integration tests: $TOTAL_INTEGRATION ($INTEGRATION_PCT%)"
echo "  E2E tests:         $TOTAL_E2E ($E2E_PCT%)"
echo "  Total:             $TOTAL_TESTS"
echo ""

# Validate ratios
PYRAMID_VALID=1

if [ $UNIT_PCT -lt $UNIT_MIN ] || [ $UNIT_PCT -gt $UNIT_MAX ]; then
    echo "❌ Test pyramid violation: Unit tests $UNIT_PCT% (target: 70% ±10%)"
    PYRAMID_VALID=0
fi

if [ $INTEGRATION_PCT -lt $INTEGRATION_MIN ] || [ $INTEGRATION_PCT -gt $INTEGRATION_MAX ]; then
    echo "❌ Test pyramid violation: Integration tests $INTEGRATION_PCT% (target: 20% ±10%)"
    PYRAMID_VALID=0
fi

if [ $E2E_PCT -gt $E2E_MAX ]; then
    echo "❌ Test pyramid violation: E2E tests $E2E_PCT% (target: 10% ±10%)"
    PYRAMID_VALID=0
fi

if [ $PYRAMID_VALID -eq 1 ]; then
    echo "✅ Test pyramid validated: Unit $UNIT_PCT%, Integration $INTEGRATION_PCT%, E2E $E2E_PCT%"
    echo "======================================="
    exit 0
else
    echo "======================================="
    exit 1
fi
```

### Race Detector in CI (GitHub Actions)
```yaml
# .github/workflows/ci.yml (modify existing backend-test job)
# Source: Go race detector documentation

name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  backend-test:
    name: Backend Tests with Race Detector
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'
          cache: true

      - name: Download Go dependencies
        run: |
          cd backend
          go mod download

      # NEW: Run tests with race detector (FND-05)
      - name: Run tests with race detector
        run: |
          cd backend
          go test -v -race -shuffle=on -timeout=30s ./...
        env:
          # Race detector requires more CPUs for better performance
          GOMAXPROCS: 2
          # Set timezone for consistent time handling
          TZ: UTC
```

### Test Isolation with Shuffle Flag
```bash
# Run Go tests with shuffle to detect shared state dependencies (FND-06)
cd backend

# Shuffle with random seed (different each run)
go test -v -race -shuffle=on ./...

# Shuffle with specific seed (reproducible)
go test -v -race -shuffle=1658725273820123456 ./...

# Godot tests: GUT doesn't support shuffle natively, so we run tests multiple times
# to catch order-dependent failures
for i in {1..3}; do
    echo "Test run $i..."
    godot4 --headless --script res://test/run_all_tests.gd || exit 1
done
```

### Makefile Integration
```makefile
# Makefile (add these targets)

.PHONY: test test-all test-backend test-frontend check-test-pyramid

# Default test target - run unified test suite
test: test-all

# Unified test runner (FND-03)
test-all:
	@echo "🧪 Running unified test suite..."
	@./scripts/test-all.sh

# Backend tests only
test-backend:
	@echo "📦 Running backend tests..."
	@cd backend && go test -v -race -shuffle=on ./...

# Frontend tests only
test-frontend:
	@echo "🎮 Running frontend tests..."
	@godot4 --headless --script res://test/run_all_tests.gd

# Test pyramid validation (FND-04)
check-test-pyramid:
	@echo "📊 Validating test pyramid ratios..."
	@./scripts/check-test-pyramid.sh
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate test commands | Unified test runner | Ongoing (this phase) | Single source of truth; better CI integration; consolidated reporting |
| Manual pyramid checks | Automated ratio enforcement | Ongoing (this phase) | Prevents ice cream cone anti-pattern; enforces best practices automatically |
| Race detector opt-in | Race detector in CI | Ongoing (this phase) | Catches data races early; prevents production bugs; improved code quality |
| Fixed test execution order | Randomized execution order | Go 1.17+ (2021) | Detects shared state dependencies; improves test isolation; catches hidden bugs |

**Current as of 2026:**
- **Go race detector:** Stable since Go 1.1; enhanced in Go 1.17 with shuffle flag
- **Test pyramid enforcement:** Industry best practice since 2010s; automation via scripts is standard
- **Unified test runners:** Common in polyglot projects; bash orchestration is standard approach
- **Test isolation:** Shuffle flags built into Go 1.17+; other languages use similar approaches

**Outdated approaches to avoid:**
- **Skipping race detector:** Never acceptable for concurrent code; always run in CI
- **Manual test execution:** Developers forget commands; automate via unified runner
- **Ignoring test pyramid:** Leads to slow, flaky suites; enforce automatically
- **Hard-coded test order:** Masks shared state bugs; use shuffle to detect dependencies

## Open Questions

1. **How should we handle existing tests that don't fit the unit/integration/E2E classification?**
   - What we know: Current tests are in backend/tests/ and test/suites/ without clear categorization
   - What's unclear: Migration strategy for existing tests; how to classify legacy code
   - Recommendation: Create `backend/tests/unit/` and `backend/tests/integration/` directories; move existing tests based on dependencies; leave legacy tests in place temporarily with deprecation notice

2. **Should test pyramid enforcement be hard or soft failure in CI?**
   - What we know: Need to enforce 70/20/10 ratio but allow some flexibility during development
   - What's unclear: Whether to block PRs or just warn when pyramid is violated
   - Recommendation: Start with warning-only (soft failure) to allow migration; transition to hard failure after 2 weeks once tests are reorganized

3. **How to handle Godot test shuffle when GUT doesn't support `-shuffle` flag?**
   - What we know: Go has `-shuffle=on` built-in; GUT doesn't support shuffle natively
   - What's unclear: Best way to randomize Godot test execution order
   - Recommendation: Run Godot tests multiple times (3x) in CI as workaround; investigate GUT plugin options for future enhancement

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend Framework | Go testing + testify v1.11.1 |
| Frontend Framework | GUT 9.6.0 (Godot 4.x) |
| Config file | backend/go.mod (Go), .gutconfig.json (GUT) |
| Quick run command | `make test-all` (unified runner) |
| Full suite command | `./scripts/test-all.sh` (with race detector and shuffle) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-03 | Unified test runner executes all tests with consolidated reporting | integration | `./scripts/test-all.sh` | ❌ Script needs creation (Wave 0) |
| FND-04 | Test pyramid enforced (70/20/10) via automated checks | integration | `./scripts/check-test-pyramid.sh` | ❌ Script needs creation (Wave 0) |
| FND-05 | Go race detector runs in CI for concurrent code | unit | `cd backend && go test -race ./...` | ❌ CI workflow needs update (Wave 0) |
| FND-06 | Tests are isolated and don't depend on shared state | unit | `cd backend && go test -shuffle=on ./...` | ❌ CI workflow needs update (Wave 0) |

### Sampling Rate
- **Per task commit:** `./scripts/test-all.sh` (quick run without race detector for speed)
- **Per wave merge:** `./scripts/test-all.sh` with race detector and full coverage
- **Phase gate:** Full suite green with pyramid validation before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/test-all.sh` — unified test runner script (FND-03)
- [ ] `scripts/check-test-pyramid.sh` — test pyramid validation script (FND-04)
- [ ] `.github/workflows/ci.yml` — update backend-test job to include `-race` flag (FND-05)
- [ ] `.github/workflows/ci.yml` — update backend-test job to include `-shuffle=on` flag (FND-06)
- [ ] `backend/tests/unit/` — create directory structure for unit tests (FND-04)
- [ ] `backend/tests/integration/` — create directory structure for integration tests (FND-04)
- [ ] `backend/tests/e2e/` — create directory structure for e2e tests (FND-04)
- [ ] `test/suites/integration/` — create directory for Godot integration tests (FND-04)
- [ ] `test/suites/e2e/` — create directory for Godot e2e tests (FND-04)
- [ ] `Makefile` — add `test-all`, `check-test-pyramid` targets (FND-03, FND-04)

*(All Wave 0 gaps are infrastructure setup; actual test migration can happen incrementally)*

## Implementation Approach

### Recommended Sequence

**Wave 0: Infrastructure Setup (Day 1)**
1. Create `scripts/test-all.sh` - unified test runner
2. Create `scripts/check-test-pyramid.sh` - pyramid validation
3. Update `.github/workflows/ci.yml` - add `-race` and `-shuffle=on` flags
4. Create directory structure: `backend/tests/{unit,integration,e2e}/`
5. Create directory structure: `test/suites/{integration,e2e}/`
6. Update Makefile with `test-all` and `check-test-pyramid` targets
7. Verify unified runner works: `./scripts/test-all.sh`
8. Verify pyramid check works: `./scripts/check-test-pyramid.sh`

**Wave 1: Test Migration (Days 2-3)**
1. Migrate existing Go tests to unit/integration/e2e structure
2. Migrate existing Godot tests to unit/integration/e2e structure
3. Update CI workflows to use unified runner
4. Run pyramid validation and fix violations
5. Document classification criteria in CONTRIBUTING.md

**Wave 2: CI Integration (Day 4)**
1. Add pyramid validation to CI workflow
2. Configure failure thresholds (start with warnings)
3. Add unified test results artifact to CI
4. Verify CI passes with all changes

**Wave 3: Validation (Day 5)**
1. Run full test suite with race detector
2. Verify pyramid ratios are within tolerance
3. Check for race condition warnings
4. Verify test isolation via shuffle flag
5. Document any issues found and fixed

### Dependencies and Risks

**Dependencies:**
- Go 1.21.6+ (already installed)
- Godot 4.x (may need PATH setup in CI)
- testify v1.11.1 (already in go.mod)
- GUT 9.6.0 (already installed)

**Risks:**
- **Risk 1:** Godot 4.x not in CI PATH - May need to download Godot in workflow
  - **Mitigation:** Check existing .github/workflows/test.yml for Godot setup pattern
- **Risk 2:** Test migration breaks existing tests - Moving tests may change import paths
  - **Mitigation:** Run tests after each migration; fix import paths incrementally
- **Risk 3:** Race detector slows down CI significantly - Tests may take 10x longer
  - **Mitigation:** Run race detector in parallel job; use `-short` flag for quick iterations
- **Risk 4:** Pyramid validation too strict initially - May block valid development
  - **Mitigation:** Start with warning-only mode; transition to hard failure after migration period

### Rollback Plan

If unified runner causes issues:
1. Revert to individual test commands: `make backend-test` and `make frontend-test`
2. Remove pyramid validation from CI (keep script for manual use)
3. Disable race detector with `-short` flag for quick feedback
4. Revert test directory structure changes if import paths are broken

## Sources

### Primary (HIGH confidence)
- [Go Testing Documentation](https://go.dev/doc/tutorial/add-a-test) - Official Go testing guide with `-race` and `-shuffle` flags
- [Go Race Detector](https://go.dev/doc/articles/race_detector) - Official race detection documentation
- [Testify GitHub Repository](https://github.com/stretchr/testify) - Assertions, mocking, and test suites for Go (v1.11.1 in go.mod)
- [GUT (Godot Unit Test) GitHub Repository](https://github.com/bitwes/Gut) - Unit testing framework for Godot 4.x (9.6.0 installed)
- [Martin Fowler - Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) - Industry-standard test automation strategy

### Secondary (MEDIUM confidence)
- [Armored Archer Codebase Analysis](2026-03-20) - Existing test infrastructure, CI workflows, testify v1.11.1, GUT 9.6.0
- [Milestone Audit v2.3.0](2026-03-20) - Identified orphaned requirements FND-03 through FND-06
- [Phase 1 Research](2026-03-19) - Foundation research on testify, GUT, and testing patterns
- [GitHub Actions Documentation](https://docs.github.com/en/actions) - CI/CD workflow configuration

### Tertiary (LOW confidence)
- [Nakama Testing Examples](https://github.com/heroiclabs/nakama-community-examples) - Limited official testing documentation; community patterns only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools are already installed and verified in codebase
- Architecture: HIGH - Patterns are standard bash/Go practices; no new frameworks needed
- Pitfalls: HIGH - Well-documented testing anti-patterns; Go race detector is stable since 1.1
- Implementation: HIGH - Low-risk infrastructure changes; existing tools just need orchestration

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days - Go and GUT are stable, but verify Godot 4.x availability in CI)

**Key insights:**
1. This phase is about orchestration, not new tools - everything needed is already installed
2. Gap closure is straightforward: bash scripts + CI workflow updates + directory reorganization
3. Risk is low: changes are additive; existing tests continue working during migration
4. Value is high: unified testing prevents fragmentation; pyramid enforcement prevents technical debt
