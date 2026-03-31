# Phase 8: Fix Broken Packages & Establish Quality Gates - Research

**Researched:** 2026-03-20
**Domain:** Go testing infrastructure, quality gates, coverage tracking
**Confidence:** MEDIUM

## Summary

Phase 8 requires fixing compilation errors in 4 Go backend packages (rpg, season, store, notifications) to enable accurate baseline coverage measurement, then implementing quality gates to prevent coverage gaming. The phase focuses on establishing test quality standards through assertion requirements, mutation testing, and coverage threshold enforcement. Primary recommendations include using testify's assertion analysis, implementing custom CI/CD scripts for coverage enforcement, and creating a gap analysis tool to identify untested functions.

**Primary recommendation:** Fix compilation errors first to enable accurate baseline measurement, then layer in quality gates incrementally starting with assertion enforcement.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| testify | v1.11.1 | Test assertions, assertion counting | Already in project, industry-standard Go assertions |
| go test | Built-in | Test execution, coverage profiling | Go's native testing tool, reliable and well-documented |
| go tool cover | Built-in | Coverage report generation | Official Go coverage tool, integrates with CI/CD |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| grep | Built-in | Analyze coverage reports | Filter coverage output for gaps |
| awk | Built-in | Parse and analyze coverage data | Extract metrics from coverage reports |
| bash | Built-in | CI/CD scripting | Automate quality gate enforcement |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| testify assertion counting | Custom counter implementation | testify is battle-tested, less maintenance |
| go tool cover | gocov | go tool cover is official, better toolchain integration |
| CI/CD scripts | Third-party coverage services | CI/CD scripts are free, more control, no external dependencies |

**Installation:**
```bash
# All required tools are Go built-ins or already installed
go test -v ./...          # Run tests
go tool cover -func=...   # Generate coverage report
go build ./...          # Build packages to check compilation
```

**Version verification:**
```bash
go version              # Verify Go version
go list -m github.com/stretchr/testify  # Verify testify version
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── internal/
│   ├── rpg/              # Fixed package (was broken)
│   ├── season/           # Fixed package (was broken)
│   ├── store/            # Fixed package (was broken)
│   └── notifications/    # Fixed package (was broken)
├── tests/
│   ├── quality/
│   │   ├── coverage_gates.sh      # CI/CD enforcement scripts
│   │   ├── analyze_gaps.sh       # Gap analysis tool
│   │   └── mutation_config.yaml   # Mutation testing config
│   └── testhelpers/
│       └── quality/
│           └── assertion_counter.go  # Custom assertion tracking (if needed)
└── scripts/
    └── enforce_coverage.sh  # Main CI/CD entry point
```

### Pattern 1: Assertion Requirement Enforcement
**What:** Ensure every test file contains at least one assertion using testify
**When to use:** Prevents tests from passing without meaningful checks
**Example:**
```go
// Source: https://github.com/stretchr/testify
func TestCalculateDamage(t *testing.T) {
    result := calculateDamage(100, 50)
    assert.Equal(t, 50, result) // Required: at least one assertion
}
```

**Implementation:**
```go
// tests/quality/assertion_counter.go
package quality

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

var assertionCount = 0

type RecordingReporter struct {
    testing.TB
}

func (r *RecordingReporter) Errorf(format string, args ...interface{}) {
    r.TB.Errorf(format, args...)
}

func (r *RecordingReporter) FailNow() {
    r.TB.FailNow()
}

// Helper to check if assertions exist in test files
func HasAssertions(testFile string) bool {
    // Parse test file and check for assert.* calls
    content, err := os.ReadFile(testFile)
    if err != nil {
        return false
    }
    // Check for common assertion patterns
    patterns := []string{
        `assert\.Equal`,
        `assert\.True`,
        `assert\.False`,
        `assert\.NotNil`,
        `assert\.Nil`,
        `assert\.EqualError`,
    }
    for _, pattern := range patterns {
        if bytes.Contains(content, []byte(pattern)) {
            return true
        }
    }
    return false
}
```

### Pattern 2: Coverage Threshold Enforcement
**What:** CI/CD script that fails if coverage is below threshold
**When to use:** Prevent regression, enforce quality standards
**Example:**
```bash
#!/bin/bash
# Source: Custom CI/CD pattern

# Run tests with coverage
go test -coverprofile=coverage.out ./...

# Calculate overall coverage
total=$(go tool cover -func=coverage.out | grep "^total:" | awk '{print $3}' | sed 's/%//')

OVERALL_THRESHOLD=60.0
CRITICAL_PACKAGES="combat matchmaking progression"

# Check overall threshold
if (( $(echo "$total < $OVERALL_THRESHOLD" | bc -l) )); then
    echo "ERROR: Coverage $total% is below threshold $OVERALL_THRESHOLD%"
    exit 1
fi

# Check critical packages
for pkg in $CRITICAL_PACKAGES; do
    pkg_coverage=$(go tool cover -func=coverage.out | grep "internal/$pkg/" | awk '{sum+=$3} END {print sum/NR}')
    if (( $(echo "$pkg_coverage < 80.0" | bc -l) )); then
        echo "ERROR: Critical package $pkg has coverage $pkg_coverage% (threshold 80%)"
        exit 1
    fi
done

echo "Coverage $total% meets thresholds"
```

### Pattern 3: Gap Analysis Tool
**What:** Script that identifies functions with 0% coverage
**When to use:** Generate prioritized list of functions needing tests
**Example:**
```bash
#!/bin/bash
# Source: Custom gap analysis pattern

go test -coverprofile=coverage.out ./...

# Extract function-level coverage
go tool cover -func=coverage.out | grep -v "^total:" | while read line; do
    func=$(echo "$line" | awk '{print $1}')
    pkg=$(echo "$line" | awk '{print $2}')
    coverage=$(echo "$line" | awk '{print $3}' | sed 's/%//')

    if [ "$coverage" = "0.0%" ]; then
        echo "$pkg/$func: 0% coverage"
    fi
done | sort > gaps.txt

echo "Found $(wc -l < gaps.txt) functions with 0% coverage"
```

### Anti-Patterns to Avoid
- **Coverage without assertions:** Tests that execute code but don't verify behavior (prevents coverage gaming)
- **Ignoring broken packages:** Can't measure what you can't compile (enables accurate baseline)
- **Binary pass/fail thresholds:** Graduated enforcement (30% → 45% → 60%) prevents overwhelming refactoring burden

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Assertion counting | Custom tracking code | testify.TB hook | testify provides assertion tracking out of the box |
| Coverage parsing | Custom regex on output | go tool cover -func | Official tool handles all edge cases |
| CI/CD integration | Custom GitHub Action | shell scripts | Shell scripts are simpler, debuggable, and portable |
| Mutation testing | Custom mutation generator | Existing mutation tools | Mutation testing is complex, tools handle edge cases |

**Key insight:** Quality gates rely on official Go tools (go test, go tool cover) and existing libraries (testify) to avoid reinventing the wheel and ensure reliability.

## Common Pitfalls

### Pitfall 1: Assuming Coverage Equals Quality
**What goes wrong:** Tests with 100% coverage but no assertions pass gates but don't catch bugs
**Why it happens:** Coverage measures execution, not verification
**How to avoid:** Enforce minimum assertion count per test file (INF-03)
**Warning signs:** Coverage reports look good but bug reports keep coming in

### Pitfall 2: Trying to Measure Broken Packages
**What goes wrong:** Cannot generate accurate baseline coverage if packages don't compile
**Why it happens:** go test -cover requires compilation before execution
**How to avoid:** Fix compilation errors FIRST (INF-01) before measuring baseline (INF-02)
**Warning signs:** "cannot find package" errors, missing coverage data

### Pitfall 3: Enforcing High Thresholds Too Early
**What goes wrong:** Massive refactoring required to meet aggressive targets
**Why it happens:** Jumping from 17% to 60% in one phase is overwhelming
**How to avoid:** Use incremental gates: 30% → 45% → 60% (INF-06)
**Warning signs:** Developers resist coverage gates, merge conflicts pile up

### Pitfall 4: Ignoring Package-Level Variation
**What goes wrong:** Low-risk packages drag down overall coverage metric
**Why it happens:** Single threshold doesn't account for code criticality
**How to avoid:** Implement package-level tracking (INF-07) and different thresholds for critical paths (80% for combat/matchmaking/progression)
**Warning signs:** High-priority bugs appear in critical systems despite "good" overall coverage

### Pitfall 5: Manual Threshold Enforcement
**What goes wrong:** Developers forget to check coverage before merging
**Why it happens:** Manual processes are error-prone and inconsistent
**How to avoid:** Automate in CI/CD pipeline (INF-06)
**Warning signs:** Coverage regression happens sporadically

## Code Examples

Verified patterns from official sources:

### Assertion Requirement Enforcement
```go
// Source: https://pkg.go.dev/github.com/stretchr/testify@v1.11.1
package quality_test

import (
    "testing"
    "os"
    "path/filepath"
    "strings"
)

func TestAllTestsHaveAssertions(t *testing.T) {
    testFiles := findTestFiles()
    for _, file := range testFiles {
        content, _ := os.ReadFile(file)
        if !hasAssertion(content) {
            t.Errorf("Test file %s has no assertions", file)
        }
    }
}

func findTestFiles() []string {
    var files []string
    filepath.Walk(".", func(path string, info os.FileInfo, err error) error {
        if strings.HasSuffix(path, "_test.go") {
            files = append(files, path)
        }
        return nil
    })
    return files
}

func hasAssertion(content []byte) bool {
    patterns := []string{
        "assert.Equal",
        "assert.True",
        "assert.False",
    }
    for _, pattern := range patterns {
        if bytes.Contains(content, []byte(pattern)) {
            return true
        }
    }
    return false
}
```

### Coverage Threshold Script
```bash
#!/bin/bash
# Source: Official Go tool cover documentation
# https://pkg.go.dev/cmd/cover

OVERALL_THRESHOLD=60.0
CRITICAL_THRESHOLD=80.0

run_tests() {
    go test -coverprofile=coverage.out ./...
}

check_overall_threshold() {
    total=$(go tool cover -func=coverage.out | grep "^total:" | awk '{print $3}' | sed 's/%//')
    echo "Overall coverage: $total%"
    if (( $(echo "$total < $OVERALL_THRESHOLD" | bc -l) )); then
        echo "FAIL: Coverage below $OVERALL_THRESHOLD% threshold"
        return 1
    fi
    return 0
}

check_critical_packages() {
    critical="internal/combat internal/matchmaking internal/rpg"
    for pkg in $critical; do
        # Extract coverage for specific package
        pkg_cov=$(go tool cover -func=coverage.out | \
            grep "^$pkg/" | \
            awk '{sum+=$3} END {print sum/NR}' | \
            sed 's/%//')
        echo "Critical package $pkg: $pkg_cov%"
        if (( $(echo "$pkg_cov < $CRITICAL_THRESHOLD" | bc -l) )); then
            echo "FAIL: $pkg below $CRITICAL_THRESHOLD% threshold"
            return 1
        fi
    done
    return 0
}

# Main execution
run_tests
check_overall_threshold || exit 1
check_critical_packages || exit 1
echo "All coverage thresholds met"
```

### Gap Analysis Script
```bash
#!/bin/bash
# Source: Custom analysis pattern

generate_coverage_report() {
    go test -coverprofile=coverage.out ./...
}

analyze_gaps() {
    echo "Analyzing coverage gaps..."
    go tool cover -func=coverage.out | \
        grep -v "^total:" | \
        while read line; do
            func=$(echo "$line" | awk '{print $1}')
            pkg=$(echo "$line" | awk '{print $2}')
            coverage=$(echo "$line" | awk '{print $3}' | sed 's/%//')

            if [ "$coverage" = "0.0%" ]; then
                echo "$pkg/$func: 0% coverage"
            fi
        done | sort > gaps.txt

    count=$(wc -l < gaps.txt)
    echo "Found $count functions with 0% coverage"
    echo "See gaps.txt for full list"
}

generate_coverage_report
analyze_gaps
```

### Mutation Testing Configuration (Conceptual)
```yaml
# mutation_config.yaml
# Source: Mutation testing best practices

# Mutation testing detects tests without meaningful assertions
# by introducing small code changes (mutations) and verifying
# tests still fail

mutation_operators:
  - ArithmeticOperatorMutator
  - ConditionalBoundaryMutator
  - NegateConditionalsMutator
  - RemoveConditionalMutator

threshold:
  mutation_score: 80  # Percentage of mutants killed
  timeout: 30s

# Package-specific configuration
packages:
  internal/combat:
    threshold: 85  # Critical path requires higher mutation score
  internal/rpg:
    threshold: 75
  internal/matchmaking:
    threshold: 80

# Test quality gates based on mutation score
quality_gates:
  - mutation_score < 60: FAIL - Tests are not killing mutants (no assertions)
  - mutation_score < 80: WARN - Test quality needs improvement
  - mutation_score >= 80: PASS - Good test quality
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual coverage checks | Automated CI/CD gates | v2.3.0 | Consistent enforcement, no manual errors |
| No quality gates | Assertion + mutation testing | v2.4.0 | Prevents coverage gaming, ensures test quality |
| Single threshold | Package-level thresholds | v2.4.0 | Accounts for code criticality |
| No gap analysis | Automated gap identification | v2.4.0 | Prioritizes testing work |

**Deprecated/outdated:**
- Manual coverage verification (replaced by CI/CD automation)
- Coverage as sole metric (replaced by coverage + assertion quality)
- Binary pass/fail (replaced by incremental gates)
- Testing without compilation (fixed packages first)

## Open Questions

1. **Mutation testing tool selection**
   - What we know: Need mutation testing to detect tests without meaningful assertions (INF-04)
   - What's unclear: Which specific Go mutation testing tool to use (gremlins, go-mutesting, go-mutator, or custom)
   - Recommendation: Evaluate gremlins and go-mutesting, choose based on active maintenance and ease of CI/CD integration

2. **Incremental threshold implementation strategy**
   - What we know: Need gates at 30% → 45% → 60% (INF-06)
   - What's unclear: Which gates to implement in Phase 8 vs Phase 12
   - Recommendation: Implement 60% overall + 80% critical path in Phase 8, defer incremental gates to Phase 12

3. **Package-level tracking persistence**
   - What we know: Need per-module visibility (INF-07)
   - What's unclear: How to store and track package-level coverage history
   - Recommendation: Use JSON file in .planning/metrics/ updated after each CI run

4. **Gap analysis output format**
   - What we know: Need automated identification of 0% coverage functions (INF-05)
   - What's unclear: Output format (console, JSON, CSV) and integration with CI/CD
   - Recommendation: Generate both console summary (for logs) and JSON (for programmatic consumption)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Go test + testify v1.11.1 |
| Config file | None - go test uses _test.go files |
| Quick run command | `go test -v -run TestSpecificFunc ./internal/combat` |
| Full suite command | `go test -v -coverprofile=coverage.out ./...` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INF-01 | Broken packages compile | manual | `go build ./internal/rpg ./internal/season ./internal/store ./internal/notifications` | ❌ Phase 0 |
| INF-02 | Baseline coverage measurement | integration | `go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out | head -20` | ❌ Phase 0 |
| INF-03 | All tests have assertions | unit | `go test -v ./...` + grep/assert test files | ❌ Phase 0 |
| INF-04 | Mutation testing configured | integration | `go test -coverprofile=coverage.out ./...` + mutation tool | ❌ Phase 0 |
| INF-05 | Gap analysis identifies 0% functions | integration | `go test -coverprofile=coverage.out ./... && ./tests/quality/analyze_gaps.sh` | ❌ Phase 0 |
| INF-06 | Coverage threshold enforcement | integration | `go test -coverprofile=coverage.out ./... && ./tests/quality/coverage_gates.sh` | ❌ Phase 0 |
| INF-07 | Package-level coverage tracking | integration | `go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out | grep internal/ | ❌ Phase 0 |

### Sampling Rate
- **Per task commit:** `go test -v -run TestModifiedPackage` (quick sanity check)
- **Per wave merge:** `go test -v -coverprofile=coverage.out ./... && ./tests/quality/coverage_gates.sh` (full quality gate check)
- **Phase gate:** Full suite green with all quality gates passing before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/quality/assertion_counter.go` - assertion counting helper
- [ ] `backend/tests/quality/coverage_gates.sh` - CI/CD enforcement script
- [ ] `backend/tests/quality/analyze_gaps.sh` - gap analysis tool
- [ ] `backend/tests/quality/mutation_config.yaml` - mutation testing configuration
- [ ] `backend/scripts/enforce_coverage.sh` - main CI/CD entry point

## Sources

### Primary (HIGH confidence)
- Go tool cover official documentation - [https://pkg.go.dev/cmd/cover](https://pkg.go.dev/cmd/cover)
- testify v1.11.1 documentation - [https://pkg.go.dev/github.com/stretchr/testify](https://pkg.go.dev/github.com/stretchr/testify)
- Go testing best practices - [https://golang.org/pkg/testing](https://golang.org/pkg/testing)
- Project .planning/config.json (v2.3.0 workflow.nyquist_validation enabled)

### Secondary (MEDIUM confidence)
- Test coverage quality gate patterns (from existing project .planning/phases/)
- Mutation testing concepts and theory (from REQUIREMENTS.md COV-01 scope analysis)

### Tertiary (LOW confidence)
- Go mutation testing tool selection (gremlins vs go-mutesting vs go-mutator) - **NEEDS VALIDATION**
- Incremental threshold implementation strategy - **NEEDS DECISION**

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - go test, go tool cover, and testify are well-documented and official
- Architecture: MEDIUM - Patterns are sound but need implementation experience to verify
- Pitfalls: HIGH - Based on common testing mistakes documented in Go best practices

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days for Go testing landscape, 7 days for tool selection decisions)
