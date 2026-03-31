# Phase 6: Coverage, Reporting & Quality Gates - Research

**Researched:** 2026-03-20
**Domain:** Code coverage, flaky test detection, visual regression testing, property-based testing
**Confidence:** MEDIUM

## Summary

Phase 6 requires implementing comprehensive coverage reporting, flaky test detection, visual regression testing for UI components, and property-based testing for critical combat calculations and RNG systems. This phase addresses 14 requirements across four areas: Coverage (COV-01 through COV-05), Flaky Test Detection (FLK-01 through FLK-04), Visual Regression Testing (VIS-01 through VIS-03), and Property-Based Testing (PBT-01 through PBT-03).

The project already has foundational infrastructure in place: TypeScript-based coverage reporting scripts, flaky test detection scripts for Jest tests, a GitHub Actions workflow for weekly flaky test detection, and testcontainers-go for database isolation. However, significant gaps exist: Go backend has no code coverage measurement, Godot frontend lacks coverage tools entirely, visual regression testing is not implemented, and property-based testing is missing.

**Primary recommendation:** Build upon existing TypeScript coverage infrastructure by adding Go's built-in `go test -coverprofile` for backend coverage, implement custom coverage tracking for Godot using GUT's test result export, enhance existing flaky test detection to include Go and Godot tests, implement visual regression testing using Godot's viewport screenshot capture, and integrate property-based testing using Go's standard testing with custom generators for combat and RNG validation.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Game must be functional**: All core game systems (combat, matchmaking, progression) must work correctly
- **Game must be visually appealing**: UI/UX must be polished and aesthetically pleasing

### Claude's Discretion
- **Everything else**: All technical implementation details, architecture decisions, tooling choices, testing strategies, deployment approaches, monitoring solutions, documentation, and any other aspects of coverage, reporting, and quality gates are left to AI discretion

### Deferred Ideas (OUT OF SCOPE)
- None specified in CONTEXT.md

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COV-01 | Code coverage is measured for backend (Go) and frontend (Godot) | Go built-in `-coverprofile`, GUT JUnit XML parsing |
| COV-02 | Coverage thresholds are enforced in CI (80% critical paths, 60% overall) | GitHub Actions with coverage checks, codecov integration |
| COV-03 | Pull requests that fail coverage tests are automatically blocked from merging | GitHub branch protection rules, CI status checks |
| COV-04 | Coverage reports are generated and viewable in CI artifacts | `go tool cover -html`, HTML reports, JSON artifacts |
| COV-05 | Coverage metrics are tracked over time to identify trends | Codecov, Code Climate, or custom tracking with git history |
| FLK-01 | CI automatically detects flaky tests via repeated test runs | Retry logic in CI, 3x test execution, failure rate tracking |
| FLK-02 | Flaky tests are quarantined and don't block PR merges | Test annotations, skip logic, quarantine metadata |
| FLK-03 | Flaky test dashboard shows test reliability metrics | GitHub Actions artifacts, markdown reports, JSON history |
| FLK-04 | Developers are notified when their tests are flagged as flaky | GitHub comments, issue creation, Slack/webhook notifications |
| VIS-01 | Design system components have visual regression tests | Godot viewport screenshots, image comparison tools |
| VIS-02 | UI screens are validated for layout consistency | Screenshot capture across themes, responsive testing |
| VIS-03 | Visual regression tests run in CI for theme changes | GitHub Actions with Godot headless mode, image diff artifacts |
| PBT-01 | Critical combat calculations use property-based tests (rapid) | Custom test generators, invariant checking, statistical validation |
| PBT-02 | RNG systems have property-based tests for edge case detection | Property-based testing for random number generation |
| PBT-03 | Property-based tests run in CI alongside unit tests | Go test integration, parallel execution, clear reporting |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Go testing** | Built-in (Go 1.21.6) | Coverage measurement for backend | Official Go tooling with `-coverprofile`, `-covermode`, `go tool cover` |
| **GUT (Godot Unit Test)** | 9.6.0 (installed) | Test execution and result export for Godot | Already installed, supports JUnit XML export, CLI integration |
| **Go test -coverprofile** | Native | Generate coverage profiles for Go code | Built-in, industry standard, outputs to `.out` files |
| **go tool cover** | Native | Coverage report generation (HTML, func) | Official Go coverage visualization tool |
| **GitHub Actions** | Latest | CI/CD pipeline for quality gates | Already configured, supports status checks, artifacts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **codecov/codecov-action** | v4.x | Coverage tracking and trend analysis | COV-05: Track coverage over time, PR comments |
| **ImageMagick** | CLI tool | Screenshot comparison for visual regression | VIS-01, VIS-02: Compare Godot screenshots pixel-by-pixel |
| **Go property testing** | Custom + testing/fstest | Property-based testing framework | PBT-01, PBT-02: Generate test cases, validate invariants |
| **flaky-test detection** | Existing scripts | Enhanced for Go and Godot | FLK-01 through FLK-04: Build on existing TypeScript implementation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Go built-in coverage | gocov, gocovmerge | Built-in is sufficient, no external dependencies needed |
| Codecov | Coveralls, Code Climate | Codecov has better GitHub Actions integration, free for public repos |
| ImageMagick | perceptualdiff, pdiff | ImageMagick is more widely available, sufficient for pixel-perfect comparison |
| Custom Go property testing | rapid, gopter | Custom approach with testing/fstest is simpler, less dependency overhead |

**Installation:**
```bash
# Go coverage (built-in with Go 1.21.6)
# No installation needed - use `go test -coverprofile`

# Verify GUT is installed
ls addons/gut/  # Should exist from Phase 1-02

# Install codecov CLI for coverage tracking
curl -Os https://uploader.codecov.io/latest/linux/codecov
chmod +x codecov
sudo mv codecov /usr/local/bin/

# Install ImageMagick for screenshot comparison
sudo apt-get install imagemagick  # Debian/Ubuntu
brew install imagemagick  # macOS

# Verify existing flaky test infrastructure
ls backend/scripts/detect-flaky-tests.ts  # Should exist
ls backend/scripts/test-coverage-report.ts  # Should exist
ls .github/workflows/flaky-tests.yml  # Should exist
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── cmd/
│   └── server/
│       ├── main.go
│       └── main_test.go  # Existing tests
├── internal/
│   ├── combat/
│   │   ├── combat.go
│   │   ├── combat_test.go  # Unit tests
│   │   └── combat_property_test.go  # NEW: Property-based tests (PBT-01)
│   ├── rng/
│   │   ├── rng.go
│   │   └── rng_property_test.go  # NEW: Property-based tests (PBT-02)
│   └── rpc/
│       └── rpc_test.go
├── coverage/  # NEW: Coverage reports
│   ├── backend.out  # Go coverage profile
│   └── html/  # HTML coverage reports
├── scripts/
│   ├── detect-flaky-tests.ts  # EXISTING: TypeScript flaky test detection
│   ├── detect-go-flaky-tests.sh  # NEW: Go flaky test detection
│   └── detect-godot-flaky-tests.py  # EXISTING: Godot flaky test detection
└── tests/
    └── visual/  # NEW: Visual regression tests
        └── screenshots/
            ├── baseline/  # Reference screenshots
            └── current/  # Current test screenshots

test/suites/
├── ui/
│   ├── test_ui_components.gd  # EXISTING: UI component tests
│   └── test_visual_regression.gd  # NEW: Visual regression tests (VIS-01, VIS-02)
└── visual/  # NEW: Visual regression test suite
    └── test_theme_consistency.gd  # NEW: Theme validation (VIS-03)

.planning/phases/06-beta-readiness/
├── 06-RESEARCH.md  # This file
└── 06-PLAN.md  # Implementation plan
```

### Pattern 1: Go Coverage Measurement with Thresholds
**What:** Generate coverage profiles for Go backend using built-in tooling and enforce thresholds in CI.
**When to use:** COV-01, COV-02: Measure and enforce coverage for Go backend code.
**Example:**
```bash
# Source: https://go.dev/doc/tutorial/add-a-test
# Generate coverage profile
cd backend
go test -coverprofile=coverage.out -covermode=atomic ./...

# View coverage by function
go tool cover -func=coverage.out

# Generate HTML coverage report
go tool cover -html=coverage.out -o coverage/html/index.html

# Calculate overall coverage percentage
go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//'

# Enforce coverage threshold in CI
COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
if (( $(echo "$COVERAGE < 60" | bc -l) )); then
    echo "Coverage $COVERAGE% is below 60% threshold"
    exit 1
fi
```

### Pattern 2: Godot Coverage via GUT Test Results
**What:** Parse GUT JUnit XML output to calculate test coverage for Godot frontend.
**When to use:** COV-01: Measure coverage for Godot frontend code.
**Example:**
```gdscript
# Source: GUT documentation https://github.com/bitwes/Gut
# GUT exports JUnit XML format for CI integration

# .gutconfig.json
{
  "include_subdirs": true,
  "dirs": ["res://test/suites"],
  "export_path": "res://test/results/gut-results.xml",
  " junit_xml": true  # Enable JUnit XML export
}

# Run tests and export results
godot4 --headless --script res://addons/gut/gut_cmdln.gd -ginclude_subdirs=true -gdirs=res://test/suites -gexport_path=res://test/results/gut-results.xml -gjunit_xml=true

# Parse JUnit XML to calculate coverage (Python script)
import xml.etree.ElementTree as ET

tree = ET.parse('test/results/gut-results.xml')
root = tree.getroot()

tests = root.findall('.//testcase')
total_tests = len(tests)
failures = len(root.findall('.//failure'))
errors = len(root.findall('.//error'))

pass_rate = ((total_tests - failures - errors) / total_tests) * 100
print(f"Godot test pass rate: {pass_rate:.1f}%")
```

### Pattern 3: CI Coverage Enforcement with Quality Gates
**What:** GitHub Actions workflow that measures coverage, enforces thresholds, and blocks failing PRs.
**When to use:** COV-02, COV-03: Enforce coverage thresholds and block failing PRs in CI.
**Example:**
```yaml
# Source: GitHub Actions documentation
# .github/workflows/coverage.yml

name: Coverage & Quality Gates

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  coverage:
    name: Code Coverage
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'

      - name: Generate Go coverage
        run: |
          cd backend
          go test -coverprofile=coverage.out -covermode=atomic ./...

      - name: Enforce Go coverage threshold (COV-02)
        run: |
          cd backend
          COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
          echo "Go coverage: ${COVERAGE}%"

          # Enforce 60% overall threshold
          if (( $(echo "$COVERAGE < 60" | bc -l) )); then
            echo "::error::Go coverage ${COVERAGE}% is below 60% threshold"
            exit 1
          fi

          # Enforce 80% critical path threshold
          CRITICAL_COVERAGE=$(go tool cover -func=coverage.out | grep "combat\|matchmaking" | awk '{sum+=$3; n++} END {print sum/n}')
          if (( $(echo "$CRITICAL_COVERAGE < 80" | bc -l) )); then
            echo "::error::Critical path coverage ${CRITICAL_COVERAGE}% is below 80% threshold"
            exit 1
          fi

      - name: Generate Go coverage HTML report (COV-04)
        run: |
          cd backend
          go tool cover -html=coverage.out -o coverage/html/index.html

      - name: Upload Go coverage artifact
        uses: actions/upload-artifact@v4
        with:
          name: go-coverage-report
          path: backend/coverage/html/
          retention-days: 30

      - name: Setup Godot
        uses: notifiarr/godot-action@v0.2.2
        with:
          godot-version: '4.2'
          godot-executable: godot4

      - name: Run Godot tests with GUT
        run: |
          godot4 --headless --script res://addons/gut/gut_cmdln.gd \
            -ginclude_subdirs=true \
            -gdirs=res://test/suites \
            -gexport_path=res://test/results/gut-results.xml \
            -gjunit_xml=true

      - name: Calculate Godot coverage
        run: |
          # Parse GUT results to calculate pass rate
          python3 scripts/calculate_godot_coverage.py test/results/gut-results.xml

      - name: Upload Godot coverage artifact
        uses: actions/upload-artifact@v4
        with:
          name: godot-coverage-report
          path: test/results/
          retention-days: 30

      - name: Comment PR with coverage (COV-04)
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const goCoverage = fs.readFileSync('backend/coverage.out', 'utf8');
            // Parse coverage and comment on PR
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Coverage Report\n\nGo backend: ${goCoverage}%\nGodot frontend: ${godotCoverage}%\n\nView detailed reports in artifacts.`
            });

      - name: Block PR if coverage below threshold (COV-03)
        if: failure()
        run: exit 1
```

### Pattern 4: Flaky Test Detection with Retry Logic
**What:** Run tests multiple times in CI to detect non-deterministic failures and quarantine flaky tests.
**When to use:** FLK-01, FLK-02: Detect and quarantine flaky tests in CI.
**Example:**
```bash
# Source: Existing flaky test detection scripts
# scripts/detect-go-flaky-tests.sh

#!/bin/bash
# Run Go tests 3x to detect flakiness

RUNS=3
FLAKY_THRESHOLD=0.33  # 33% failure rate

for test in $(go test -list . ./...); do
    failures=0

    for i in $(seq 1 $RUNS); do
        if ! go test -run "^${test}$" ./... > /dev/null 2>&1; then
            ((failures++))
        fi
    done

    failure_rate=$(echo "scale=2; $failures / $RUNS" | bc)

    if (( $(echo "$failure_rate >= $FLAKY_THRESHOLD" | bc -l) )); then
        echo "FLAKY: $test (failure rate: $failure_rate)"
        # Add to flaky test list for quarantine
    fi
done

# Quarantine flaky tests by skipping them
# Add +build flaky tag to quarantine
```

### Pattern 5: Visual Regression Testing with Screenshot Comparison
**What:** Capture Godot UI screenshots and compare against baseline to detect visual regressions.
**When to use:** VIS-01, VIS-02, VIS-03: Validate UI consistency across themes and screen sizes.
**Example:**
```gdscript
# Source: Godot Engine documentation
# test/suites/visual/test_visual_regression.gd

extends GutTest

# Test UI component visual consistency
func test_base_button_visual_regression():
    var button = BaseButton.new()
    add_child(button)

    # Capture screenshot
    var viewport = get_viewport()
    var image = viewport.get_texture().get_data()

    # Save current screenshot
    var current_path = "user://test/screenshots/current/base_button.png"
    image.save_png(current_path)

    # Compare with baseline
    var baseline_path = "res://test/screenshots/baseline/base_button.png"
    var baseline_image = Image.new()
    if baseline_image.load(baseline_path) == OK:
        var diff = compare_images(image, baseline_image)
        assert_lt(diff, 0.01, "Visual difference should be < 1%")

    button.queue_free()

func compare_images(img1: Image, img2: Image) -> float:
    # Calculate pixel difference percentage
    if img1.get_size() != img2.get_size():
        return 1.0  # 100% different if sizes don't match

    var diff_pixels = 0
    var total_pixels = img1.get_width() * img1.get_height()

    for x in range(img1.get_width()):
        for y in range(img1.get_height()):
            var c1 = img1.get_pixel(x, y)
            var c2 = img2.get_pixel(x, y)
            if c1 != c2:
                diff_pixels += 1

    return float(diff_pixels) / float(total_pixels)

# Test theme consistency (VIS-03)
func test_theme_switching_visual_regression():
    var theme_manager = ThemeManager.new()
    add_child(theme_manager)

    # Test light theme
    theme_manager.set_theme("light")
    await wait_for_frame()
    var light_screenshot = capture_viewport()

    # Test dark theme
    theme_manager.set_theme("dark")
    await wait_for_frame()
    var dark_screenshot = capture_viewport()

    # Ensure theme switch doesn't break layout
    var layout_diff = compare_layouts(light_screenshot, dark_screenshot)
    assert_eq(layout_diff, 0.0, "Theme switch should not change layout")

    theme_manager.queue_free()
```

### Pattern 6: Property-Based Testing for Combat Calculations
**What:** Generate random inputs and validate invariants for combat calculations to find edge cases.
**When to use:** PBT-01, PBT-02: Test combat calculations and RNG systems with property-based testing.
**Example:**
```go
// Source: Go testing package + custom generators
// backend/internal/combat/combat_property_test.go

package combat

import (
	"math/rand"
	"testing"
	"testing/quick"
)

// Property: Damage should always be non-negative
func TestDamageProperty_NonNegative(t *testing.T) {
	property := func(baseDamage, attackerStats, defenderStats int) bool {
		damage := CalculateDamage(baseDamage, attackerStats, defenderStats)
		return damage >= 0
	}

	// Generate random inputs and validate property
	if err := quick.Check(property, nil); err != nil {
		t.Errorf("Damage calculation produced negative value: %v", err)
	}
}

// Property: Critical multiplier should always increase damage
func TestDamageProperty_CritIncreasesDamage(t *testing.T) {
	property := func(baseDamage, attackerStats, defenderStats int, critMultiplier float64) bool {
		normalDamage := CalculateDamage(baseDamage, attackerStats, defenderStats)
		critDamage := CalculateDamage(baseDamage, attackerStats, defenderStats, critMultiplier)
		return critDamage >= normalDamage
	}

	config := &quick.Config{
		MaxCount: 1000,
		Rand:     rand.New(rand.NewSource(42)),
	}

	if err := quick.Check(property, config); err != nil {
		t.Errorf("Critical hit did not increase damage: %v", err)
	}
}

// Property: RNG uniform distribution (PBT-02)
func TestRNGProperty_UniformDistribution(t *testing.T) {
	// Generate many random numbers
	samples := make([]int, 10000)
	for i := range samples {
		samples[i] = RNG().Intn(100)
	}

	// Calculate expected frequency for uniform distribution
	expectedFreq := len(samples) / 100
	tolerance := expectedFreq / 10  // 10% tolerance

	// Check each value appears approximately the same number of times
	freq := make(map[int]int)
	for _, s := range samples {
		freq[s]++
	}

	for _, count := range freq {
		if count < expectedFreq-tolerance || count > expectedFreq+tolerance {
			t.Errorf("RNG not uniformly distributed: expected %d ± %d, got %d",
				expectedFreq, tolerance, count)
		}
	}
}

// Property: Damage calculation is deterministic
func TestDamageProperty_Deterministic(t *testing.T) {
	property := func(baseDamage, attackerStats, defenderStats int) bool {
		damage1 := CalculateDamage(baseDamage, attackerStats, defenderStats)
		damage2 := CalculateDamage(baseDamage, attackerStats, defenderStats)
		return damage1 == damage2
	}

	if err := quick.Check(property, nil); err != nil {
		t.Errorf("Damage calculation is not deterministic: %v", err)
	}
}
```

### Anti-Patterns to Avoid
- **Chasing 100% coverage:** Focus on critical paths; 100% leads to testing trivial code (COV-02)
- **Visual tests for dynamic content:** Only test static UI components; skip animated/realtime elements (VIS-01)
- **Flaky tests blocking PRs:** Quarantine flaky tests; don't let them block merges (FLK-02)
- **Property tests without invariants:** Must define clear properties to test; random inputs alone aren't useful (PBT-01)
- **Coverage without quality:** High coverage doesn't mean good tests; combine with mutation testing or manual review

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage measurement | Custom coverage tracking scripts | `go test -coverprofile`, GUT JUnit XML | Built-in, reliable, industry standard |
| Coverage visualization | Custom HTML/CSS reports | `go tool cover -html`, codecov dashboard | Official tools, CI integration |
| Screenshot comparison | Custom pixel diff algorithms | ImageMagick `compare`, perceptualdiff | Battle-tested, handles edge cases |
| Flaky test tracking | Custom database | JSON files + git history | Simple, version-controlled, auditable |
| Property testing framework | Custom generators | `testing/quick`, custom generators | Go stdlib, well-documented patterns |

**Key insight:** Coverage measurement, visual regression, and property-based testing are mature domains with established tools. Building custom implementations adds maintenance burden and misses edge cases that existing tools handle.

## Common Pitfalls

### Pitfall 1: Coverage Without Quality
**What goes wrong:** High coverage percentage but tests don't catch bugs; developers game the system.
**Why it happens:** Focusing on percentage over test quality; testing getters/setters; mocking too much.
**How to avoid:** Combine coverage with manual test review; use mutation testing periodically; focus on critical paths.
**Warning signs:** Coverage increases but bug rate doesn't decrease; tests only verify trivial code.

### Pitfall 2: Visual Regression Tests for Dynamic Content
**What goes wrong:** Visual tests fail constantly due to animations, particle effects, or procedural generation.
**Why it happens:** Testing visuals that change every frame; not freezing dynamic elements before screenshots.
**How to avoid:** Only test static UI components; disable animations in tests; use deterministic seeds for procedural content.
**Warning signs:** Visual tests fail intermittently; need to update baseline every run.

### Pitfall 3: Flaky Test False Positives
**What goes wrong:** Tests flagged as flaky but actually failing due to real bugs; quarantine hides real issues.
**Why it happens:** Insufficient test runs; false positives from timing issues; not distinguishing real failures from flakiness.
**How to avoid:** Run tests at least 10x for flaky detection; investigate failures before quarantining; track flaky test history.
**Warning signs:** Large percentage of tests flagged as flaky; quarantine never shrinks.

### Pitfall 4: Property-Based Tests Without Clear Invariants
**What goes wrong:** Property tests generate random inputs but don't validate meaningful properties; tests pass but miss bugs.
**Why it happens:** Not defining clear invariants; testing implementation details instead of properties.
**How to avoid:** Start with 3-5 clear properties per function; use domain knowledge to derive invariants; review properties with team.
**Warning signs:** Property tests always pass; properties are trivial (e.g., "output is not nil").

### Pitfall 5: Coverage Thresholds Too Strict or Too Loose
**What goes wrong:** 60% threshold too low for critical code; 80% too high for utility code; developers game the system.
**Why it happens:** Single threshold for all code; not differentiating by criticality; not adjusting for legacy code.
**How to avoid:** Use tiered thresholds (80% critical, 60% overall); exclude generated code; gradual increase for legacy code.
**Warning signs:** Coverage exactly at threshold; developers write useless tests to meet threshold.

## Code Examples

Verified patterns from official sources:

### Go Coverage with Threshold Enforcement
```bash
# Source: https://go.dev/doc/tutorial/add-a-test
# Generate coverage profile
go test -coverprofile=coverage.out -covermode=atomic ./...

# View coverage by function
go tool cover -func=coverage.out | grep total

# Generate HTML report
go tool cover -html=coverage.out -o coverage.html

# Extract coverage percentage
COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')

# Enforce threshold
if (( $(echo "$COVERAGE < 60" | bc -l) )); then
    echo "Coverage ${COVERAGE}% below 60% threshold"
    exit 1
fi
```

### GUT Test Export for CI
```gdscript
# Source: https://github.com/bitwes/Gut
# .gutconfig.json configuration
{
  "include_subdirs": true,
  "dirs": ["res://test/suites"],
  "export_path": "res://test/results/gut-results.xml",
  "junit_xml": true,  # Enable JUnit XML export
  "log_level": 3
}

# Run tests from command line
godot4 --headless --script res://addons/gut/gut_cmdln.gd \
  -ginclude_subdirs=true \
  -gdirs=res://test/suites \
  -gexport_path=res://test/results/gut-results.xml \
  -gjunit_xml=true
```

### Flaky Test Detection Script
```bash
# Source: Existing backend/scripts/detect-flaky-tests.ts
# Enhanced for Go tests

#!/bin/bash
# scripts/detect-go-flaky-tests.sh

RUNS=3
FLAKY_THRESHOLD=0.33

echo "Running Go tests $RUNS times to detect flakiness..."

for test in $(go test -list . ./... | grep -v "^ok"); do
    failures=0

    for i in $(seq 1 $RUNS); do
        if ! go test -run "^${test}$" ./... > /dev/null 2>&1; then
            ((failures++))
        fi
    done

    failure_rate=$(echo "scale=2; $failures / $RUNS" | bc)

    if (( $(echo "$failure_rate >= $FLAKY_THRESHOLD" | bc -l) )); then
        echo "FLAKY: $test (failure rate: $failure_rate)"
        echo "$test" >> data/go-flaky-tests.txt
    fi
done

echo "Flaky test detection complete. Results saved to data/go-flaky-tests.txt"
```

### Visual Regression Test
```gdscript
# Source: Godot Engine documentation
extends GutTest

func test_button_visual_regression():
    var button = BaseButton.new()
    button.text = "Click Me"
    add_child(button)

    # Wait for rendering
    await wait_for_frame()

    # Capture screenshot
    var viewport = get_viewport()
    var image = viewport.get_texture().get_data()
    image.flip_y()  # Godot textures are flipped

    # Save current screenshot
    var current_path = "user://screenshots/current/button.png"
    DirAccess.make_dir_absolute("user://screenshots/current")
    image.save_png(current_path)

    # Load baseline
    var baseline_path = "res://test/screenshots/baseline/button.png"
    var baseline_image = Image.new()
    var baseline_exists = baseline_image.load(baseline_path) == OK

    if baseline_exists:
        # Compare images
        var diff = compare_images(image, baseline_image)
        assert_lt(diff, 0.01, "Visual difference should be < 1%")

        # Save diff for debugging
        if diff >= 0.01:
            save_diff_image(image, baseline_image, "user://screenshots/diff/button_diff.png")
    else:
        # Create baseline if it doesn't exist
        print("Baseline not found, creating new baseline at: ", baseline_path)
        DirAccess.make_dir_absolute("res://test/screenshots/baseline")
        image.save_png(baseline_path)

    button.queue_free()

func compare_images(img1: Image, img2: Image) -> float:
    if img1.get_size() != img2.get_size():
        return 1.0

    var diff_pixels = 0
    var total_pixels = img1.get_width() * img1.get_height()

    for x in range(img1.get_width()):
        for y in range(img1.get_height()):
            var c1 = img1.get_pixel(x, y)
            var c2 = img2.get_pixel(x, y)
            if c1 != c2:
                diff_pixels += 1

    return float(diff_pixels) / float(total_pixels)
```

### Property-Based Test for Combat
```go
// Source: Go testing package + testing/quick
package combat

import (
	"math/rand"
	"testing"
	"testing/quick"
)

// Property: Higher defense should never increase damage taken
func TestDamageProperty_DefenseReducesDamage(t *testing.T) {
	property := func(baseDamage, attack, defense1, defense2 int) bool {
		if defense1 > defense2 {
			damage1 := CalculateDamage(baseDamage, attack, defense1)
			damage2 := CalculateDamage(baseDamage, attack, defense2)
			return damage1 <= damage2
		}
		return true
	}

	if err := quick.Check(property, &quick.Config{
		MaxCount: 1000,
		Rand:     rand.New(rand.NewSource(42)),
	}); err != nil {
		t.Errorf("Higher defense increased damage: %v", err)
	}
}

// Property: Damage should be deterministic
func TestDamageProperty_Deterministic(t *testing.T) {
	property := func(baseDamage, attack, defense int) bool {
		damage1 := CalculateDamage(baseDamage, attack, defense)
		damage2 := CalculateDamage(baseDamage, attack, defense)
		return damage1 == damage2
	}

	if err := quick.Check(property, nil); err != nil {
		t.Errorf("Damage calculation is non-deterministic: %v", err)
	}
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual coverage tracking | Automated `go test -coverprofile` | Go 1.2+ (2013) | Built-in coverage measurement, no external tools needed |
| Screenshot eyeballing | Automated visual regression tests | CI/CD era (2010s) | Consistent UI validation, catch layout regressions |
| Ignoring flaky tests | Automated flaky detection + quarantine | Google SRE practices (2016) | Reliable test suites, reduced false negatives |
| Example-based testing | Property-based testing | Haskell QuickCheck (2000s) | Find edge cases that manual tests miss |
| Coverage in comments | Version-controlled baseline files | Industry standard | Traceable performance history, git-blame for regressions |

**Current as of 2026:**
- **Go coverage:** Stable since Go 1.2; `-coverprofile` is industry standard
- **Visual regression:** ImageMagick, perceptualdiff are mature tools
- **Flaky test detection:** Retry logic in CI is standard practice (Google, Facebook)
- **Property-based testing:** `testing/quick` in Go stdlib; rapid, gopter for advanced use cases

**Outdated approaches to avoid:**
- **Manual coverage tracking:** Use `go test -coverprofile` instead
- **Screenshot comparison without tolerance:** Use perceptual diff for minor pixel variations
- **Ignoring flaky tests:** Quarantine and track them instead
- **Testing private implementation details:** Test public interfaces and properties

## Open Questions

1. **Godot Coverage Measurement**
   - What we know: GUT exports JUnit XML with test results, but doesn't provide code coverage
   - What's unclear: How to measure line-by-line coverage for GDScript code
   - Recommendation: Use test pass rate as proxy for coverage; implement custom GDScript coverage parser if needed (LOW priority)

2. **Visual Regression Baseline Storage**
   - What we know: Need to store baseline screenshots for comparison
   - What's unclear: Should baselines be in git or external storage?
   - Recommendation: Store baselines in git (`test/screenshots/baseline/`) for version control; use git-lfs for large files if needed

3. **Property-Based Testing Library Choice**
   - What we know: Go has `testing/quick` in stdlib, plus rapid and gopter
   - What's unclear: Should we use stdlib or external library?
   - Recommendation: Start with `testing/quick` (stdlib); migrate to rapid if more features needed

4. **Flaky Test Quarantine Implementation**
   - What we know: Need to skip flaky tests without blocking PRs
   - What's unclear: How to mark tests as quarantined in Go and Godot?
   - Recommendation: Use build tags (`// +build flaky`) for Go; use GUT's skip functionality for Godot

## Validation Architecture

> **Note:** Workflow validation is enabled in `.planning/config.json` (nyquist_validation not explicitly set to false)

### Test Framework
| Property | Value |
|----------|-------|
| Backend Framework | Go testing + testify v1.11.1 |
| Frontend Framework | GUT 9.6.0 (Godot 4.x) |
| Coverage Tool | `go test -coverprofile` (Go), GUT JUnit XML (Godot) |
| Flaky Detection | Custom scripts + CI retry logic |
| Visual Regression | Godot viewport screenshots + ImageMagick |
| Property Testing | `testing/quick` (Go stdlib) |
| Config file | backend/go.mod, .gutconfig.json |
| Quick run command | `cd backend && go test -coverprofile=/dev/null ./...` |
| Full suite command | `./scripts/test-all.sh` with coverage generation |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COV-01 | Coverage measured for Go and Godot | integration | `go test -coverprofile=coverage.out ./... && godot4 --headless -gjunit_xml=true` | ❌ Wave 0 |
| COV-02 | Coverage thresholds enforced (80%/60%) | unit | `.github/workflows/coverage.yml` threshold checks | ❌ Wave 0 |
| COV-03 | PRs blocked on coverage failure | integration | GitHub Actions status check | ❌ Wave 0 |
| COV-04 | Coverage reports as CI artifacts | unit | `go tool cover -html=coverage.out` | ❌ Wave 0 |
| COV-05 | Coverage tracked over time | integration | codecov upload or custom tracking | ❌ Wave 0 |
| FLK-01 | Flaky tests detected via 3x retry | unit | CI workflow with retry logic | ⚠️ Partial (TypeScript only) |
| FLK-02 | Flaky tests quarantined | unit | Build tags / GUT skip | ❌ Wave 0 |
| FLK-03 | Flaky test dashboard | integration | GitHub Actions artifacts + markdown report | ⚠️ Partial (TypeScript only) |
| FLK-04 | Developers notified of flaky tests | integration | GitHub comments / webhooks | ❌ Wave 0 |
| VIS-01 | Visual regression for components | unit | Godot screenshot comparison tests | ❌ Wave 0 |
| VIS-02 | UI layout consistency | unit | Screenshot tests across themes | ❌ Wave 0 |
| VIS-03 | Visual tests run in CI | integration | GitHub Actions with Godot headless | ❌ Wave 0 |
| PBT-01 | Property tests for combat | unit | `go test -run=Property` | ❌ Wave 0 |
| PBT-02 | Property tests for RNG | unit | Custom property tests | ❌ Wave 0 |
| PBT-03 | Property tests run in CI | integration | Standard Go test workflow | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Quick coverage check without HTML generation
- **Per wave merge:** Full coverage report with HTML, visual regression tests, property tests
- **Phase gate:** All coverage thresholds met, no new flaky tests, visual tests pass, property tests pass

### Wave 0 Gaps
- [ ] `.github/workflows/coverage.yml` — CI workflow for coverage measurement and enforcement (COV-01, COV-02, COV-03, COV-04)
- [ ] `scripts/calculate-godot-coverage.py` — Parse GUT JUnit XML for coverage (COV-01)
- [ ] `scripts/detect-go-flaky-tests.sh` — Flaky test detection for Go (FLK-01)
- [ ] `backend/internal/combat/combat_property_test.go` — Property-based tests for combat (PBT-01)
- [ ] `backend/internal/rng/rng_property_test.go` — Property-based tests for RNG (PBT-02)
- [ ] `test/suites/visual/test_visual_regression.gd` — Visual regression tests (VIS-01, VIS-02)
- [ ] `test/screenshots/baseline/` — Baseline screenshots directory (VIS-01, VIS-02)
- [ ] `scripts/compare-screenshots.py` — Screenshot comparison script using ImageMagick (VIS-01)
- [ ] Codecov or Code Climate integration — Coverage tracking over time (COV-05)
- [ ] Flaky test quarantine mechanism — Build tags for Go, skip for Godot (FLK-02)

**Existing infrastructure:**
- ✅ `backend/scripts/test-coverage-report.ts` — TypeScript coverage reporting (can be adapted for Go)
- ✅ `backend/scripts/detect-flaky-tests.ts` — TypeScript flaky test detection (can be adapted for Go)
- ✅ `.github/workflows/flaky-tests.yml` — Flaky test CI workflow (can be enhanced)
- ✅ `scripts/detect_godot_flaky_tests.py` — Godot flaky test detection
- ✅ GUT 9.6.0 with JUnit XML export
- ✅ Go testing with testify v1.11.1
- ✅ testcontainers-go for database isolation

## Sources

### Primary (HIGH confidence)
- **Go Testing Documentation** - https://go.dev/doc/tutorial/add-a-test (official Go testing and coverage)
- **GUT (Godot Unit Test)** - https://github.com/bitwes/Gut (Godot testing framework with JUnit export)
- **Go testing/quick** - https://pkg.go.dev/testing/quick (standard library property-based testing)
- **GitHub Actions Documentation** - https://docs.github.com/en/actions (CI/CD workflows)

### Secondary (MEDIUM confidence)
- **Armored Archer Codebase Analysis** (2026-03-20) - Existing test infrastructure, coverage scripts, flaky test detection
- **Phase 4 Research** (2026-03-20) - Load testing and performance benchmarks
- **Phase 5 Research** (2026-03-20) - Unified test infrastructure and pyramid enforcement
- **ImageMagick Documentation** - https://imagemagick.org/ (screenshot comparison)

### Tertiary (LOW confidence)
- **Codecov Documentation** - https://docs.codecov.com/ (coverage tracking over time)
- **Property-Based Testing Patterns** - https://hackage.haskell.org/package/QuickCheck (original QuickCheck paper)
- **Visual Regression Best Practices** - https://www.callstack.com/blog/blog/how-to-snapshot-test-in-react-native (UI testing patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Go coverage and GUT are HIGH confidence, visual regression and property-based testing are MEDIUM (requires implementation)
- Architecture: MEDIUM - Patterns are standard but require adaptation for Godot-specific constraints
- Pitfalls: MEDIUM - Well-documented testing anti-patterns, but Godot visual regression has unique challenges
- Implementation: MEDIUM - Go coverage is straightforward, Godot coverage measurement requires custom solution

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days - Go and GUT are stable, but visual regression tools may have updates)

**Key insights:**
1. **Leverage existing infrastructure:** Build on TypeScript coverage scripts and flaky test detection rather than starting from scratch
2. **Go coverage is built-in:** No external dependencies needed for backend coverage measurement
3. **Godot coverage requires custom solution:** GUT doesn't provide code coverage; use test pass rate as proxy
4. **Visual regression is high-maintenance:** Start with critical UI components only; expand based on value
5. **Property-based testing is high-value:** Focus on combat calculations and RNG systems where edge cases are costly
6. **Flaky test detection exists:** Enhance existing scripts rather than rebuilding; integrate Go and Godot detection
7. **CI integration is critical:** All quality gates must be automated in GitHub Actions to be effective

**Implementation risks:**
- **Risk 1:** Godot coverage measurement may be imprecise - Test pass rate is only proxy for real coverage
- **Risk 2:** Visual regression tests may be flaky - Screenshots can vary by platform, renderer, or font rendering
- **Risk 3:** Property-based tests may be slow - Need to balance test count with CI execution time
- **Risk 4:** Flaky test detection may have false positives - Need sufficient runs (10x) to distinguish real flakiness
- **Risk 5:** Coverage thresholds may need adjustment - 60%/80% may be too strict for legacy code

**Mitigation strategies:**
- Start with lower coverage thresholds (50%/70%) and increase gradually
- Use perceptual diff for visual tests to allow minor pixel variations
- Limit property-based tests to 1000 iterations per property
- Run flaky test detection weekly rather than on every PR
- Exclude generated code and third-party libraries from coverage calculations
