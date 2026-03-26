# Phase 12: CI/CD Threshold Enforcement - Research

**Researched:** 2026-03-22
**Domain:** CI/CD, Go testing, Coverage tracking, Quality gates
**Confidence:** HIGH

## Summary

Phase 12 focuses on implementing comprehensive CI/CD threshold enforcement for test coverage, building on the optimized test suite from Phase 11. The phase requires implementing package-level coverage tracking with incremental threshold gates (30% → 45% → 60%), coverage history tracking in JSON, a coverage dashboard with visual progress bars, and quality gates that prevent merging when thresholds fail.

The project has a strong foundation: Go 1.21.6 with native `go tool cover`, existing coverage infrastructure (`backend/tests/quality/coverage_gates.sh`, `scripts/track-coverage-history.sh`), CI/CD workflows with quality gates, and a working coverage history JSON. The challenge is to enhance this infrastructure with incremental gates, package-level regression detection, and visual dashboards.

**Primary recommendation:** Use standard Go `go tool cover` for coverage measurement, extend existing shell scripts with incremental gate logic, create a simple HTML/JavaScript dashboard using existing JSON data, and enhance CI/CD workflows with branch protection checks. Avoid external coverage services (Codecov, Coveralls) - they add complexity without providing value beyond what's achievable with native Go tools and simple visualization.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `go test -cover` | 1.21.6 | Native Go coverage measurement | Built-in, reliable, no external dependencies |
| `go tool cover` | 1.21.6 | Coverage profile parsing and HTML generation | Standard Go tooling, supports func/percent modes |
| `bash` | Built-in | Threshold enforcement scripts | Already used in project, lightweight |
| `jq` | System | JSON manipulation for history tracking | Already used in `track-coverage-history.sh` |
| `bc` | System | Floating-point arithmetic for comparisons | Used in `coverage_gates.sh` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `shields.io` | Service | Coverage badges for README | Quick visibility in project documentation |
| GitHub Actions | v4 | CI/CD orchestration and PR comments | Already integrated, supports custom status checks |
| HTML/CSS/JS | Standard | Coverage dashboard visualization | No build tools needed, can serve via GitHub Pages |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native Go tools | Codecov, Coveralls, SonarCloud coverage | External services add API keys, authentication, and network dependency. Native tools work offline and are faster. |
| Shell scripts | Go binaries for gates | Shell scripts are faster to iterate, already used in project. Go binaries add build step for every change. |
| Simple HTML dashboard | React/Vue dashboards | React/Vue require build process and npm. Simple HTML/JS can be generated from existing JSON without build step. |

**Installation:**
```bash
# All tools already available
# Verify versions:
go version  # Should be 1.21.6+
jq --version # Should be 1.6+
bc --version  # Should be 1.07+
```

**Version verification:**
```bash
go version go1.21.6 linux/amd64  # Current production version
# jq and bc are system utilities, version verified via apt
```

## Architecture Patterns

### Recommended Project Structure
```
scripts/
├── coverage-gates.sh          # Enhanced with incremental gates
├── track-coverage-history.sh   # Existing, may need enhancements
├── generate-coverage-dashboard.sh  # NEW: Generate HTML dashboard
└── check-coverage-regression.sh   # NEW: Detect package regressions

data/
├── coverage-history.json       # Existing, per-commit history
├── coverage-thresholds.json   # NEW: Gate definitions (30/45/60)
└── package-baselines.json     # NEW: Per-package baseline tracking

backend/tests/quality/
├── coverage_gates.sh          # Existing, 60%/80% thresholds
└── package_coverage_check.sh   # NEW: Per-package regression detection

.github/workflows/
└── coverage-threshold.yml      # NEW: Dedicated threshold enforcement workflow
```

### Pattern 1: Incremental Threshold Gates
**What:** Implement staged coverage requirements (30% → 45% → 60%) to show measurable progress without overwhelming developers with a 17% → 60% jump.
**When to use:** When current coverage is far from target and team needs motivation through incremental wins.
**Example:**
```bash
# From coverage_gates.sh enhancement
# Source: Enhanced from existing backend/tests/quality/coverage_gates.sh
THRESHOLD_STAGE="${COVERAGE_GATE_STAGE:-1}"
case "$THRESHOLD_STAGE" in
  1) TARGET=30.0 ;;
  2) TARGET=45.0 ;;
  3) TARGET=60.0 ;;
  *) TARGET=60.0 ;;
esac

if (( $(echo "$OVERALL_NUM < $TARGET" | bc -l) )); then
  echo "::error::Overall coverage ${OVERALL_NUM}% is below stage ${THRESHOLD_STAGE} threshold ${TARGET}%"
  echo "::notice::To advance to next stage, set COVERAGE_GATE_STAGE environment variable"
  exit 1
fi
```

### Pattern 2: Package-Level Regression Detection
**What:** Compare current package coverage against historical baselines and warn on regressions >5%.
**When to use:** To prevent regressions in previously well-covered packages.
**Example:**
```bash
# NEW: scripts/check-coverage-regression.sh
#!/bin/bash
set -e

CURRENT_COVERAGE=$(go tool cover -func=coverage.out | grep "internal/$pkg/" | awk '{
  coverage = $3; gsub(/%/, "", coverage); sum += coverage; n++ }
  END { printf "%.1f", n>0 ? sum/n : 0 }')

BASELINE=$(jq -r ".packages.\"internal/$pkg\" // 0" data/package-baselines.json)

if (( $(echo "$CURRENT_COVERAGE < $BASELINE - 5" | bc -l) )); then
  echo "::warning::Package $pkg regressed from ${BASELINE}% to ${CURRENT_COVERAGE}%"
fi
```

### Pattern 3: Coverage Dashboard Generation
**What:** Generate static HTML dashboard from JSON data showing package-level coverage with progress bars and trend charts.
**When to use:** To provide visual visibility into coverage progress across all packages.
**Example:**
```bash
# NEW: scripts/generate-coverage-dashboard.sh
#!/bin/bash
set -e

# Read coverage history
LATEST=$(jq '.history[-1]' data/coverage-history.json)

# Generate HTML with progress bars
cat > docs/coverage-dashboard.html << EOF
<!DOCTYPE html>
<html>
<head>
  <title>Coverage Dashboard</title>
  <style>
    .progress-bar { width: 100%; height: 20px; background: #e0e0e0; }
    .progress-fill { height: 100%; background: #4CAF50; }
    .regression { background: #f44336; }
    .warning { background: #ff9800; }
  </style>
</head>
<body>
  <h1>Coverage Dashboard</h1>
  <div id="packages"></div>
  <script>
    const data = $(echo "$LATEST" | jq -c '.packages');
    // Render progress bars for each package
  </script>
</body>
</html>
EOF
```

### Anti-Patterns to Avoid
- **Hardcoded thresholds in multiple locations:** Store thresholds in single JSON file (`data/coverage-thresholds.json`) referenced by all scripts
- **Ignoring package-level regressions:** Detect >5% drops and fail PR checks
- **Dashboard requiring build step:** Generate static HTML from JSON, no React/Vue needed
- **External coverage services:** Native Go tools are sufficient and faster

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage profile parsing | Custom regex to parse `go tool cover -func` output | `go tool cover -func` output is well-documented, use awk/jq | Go output format is stable, custom parsing breaks on version changes |
| Badge generation | Custom SVG generation for badges | shields.io with JSON endpoint | Shields.io handles SVG encoding, caching, and versioning |
| Trend analysis | Moving average calculation in bash | jq for JSON operations, simple diff calculation | jq handles JSON natively, bash floats are error-prone |
| PR comments | GitHub API calls in shell | GitHub Actions `actions/github-script@v7` | Official action handles authentication and rate limiting |

**Key insight:** The Go toolchain provides everything needed for coverage measurement. Shell scripts + jq + bc are sufficient for threshold logic. Avoid over-engineering with external services or complex dashboards.

## Common Pitfalls

### Pitfall 1: Threshold Hardcoding
**What goes wrong:** Threshold values (60%, 80%) are hardcoded in multiple scripts, making updates error-prone.
**Why it happens:** Copy-pasting threshold logic across CI workflows and local scripts.
**How to avoid:** Store thresholds in single source of truth (`data/coverage-thresholds.json`) and reference via jq:
```bash
TARGET=$(jq -r '.overall' data/coverage-thresholds.json)
CRITICAL=$(jq -r '.critical' data/coverage-thresholds.json)
```
**Warning signs:** Same numeric value appears in >3 files without shared config.

### Pitfall 2: Missing Package-Level Baselines
**What goes wrong:** Regressions in high-coverage packages go unnoticed because only overall coverage is checked.
**Why it happens:** Focus on overall 60% target without tracking per-package baselines.
**How to avoid:** Track package baselines in `data/package-baselines.json` updated on each merge, detect >5% regressions in PR checks.
**Warning signs:** Overall coverage improves but critical packages decrease.

### Pitfall 3: Incremental Gate Confusion
**What goes wrong:** Developers don't know which gate (30%/45%/60%) is currently enforced.
**Why it happens:** Gate stage is hidden in CI configuration or environment variables.
**How to avoid:** Display current gate stage prominently in CI output and dashboard:
```bash
echo "=== Coverage Gate Stage ${THRESHOLD_STAGE}: ${TARGET}% ==="
echo "To advance: Set COVERAGE_GATE_STAGE=$(($THRESHOLD_STAGE + 1))"
```
**Warning signs:** PR checks fail without clear explanation of which threshold failed.

### Pitfall 4: Dashboard Build Complexity
**What goes wrong:** Dashboard requires npm install, build step, and asset generation, making it hard to update.
**Why it happens:** Using React/Vue for simple visualization from existing JSON.
**How to avoid:** Generate static HTML with embedded JavaScript from JSON, no build step needed:
```bash
jq -r '.history[-1] | @html' data/coverage-history.json > dashboard.html
```
**Warning signs:** Package.json dependencies increase for dashboard only.

## Code Examples

Verified patterns from existing project code:

### Coverage History Tracking (Existing)
```bash
# Source: scripts/track-coverage-history.sh (verified working)
COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
PACKAGE_COVERAGE=$(go tool cover -func=coverage.out | grep -v "^total:" | awk '{
    split($1, parts, ":")
    pkg = parts[1]
    gsub(/\/[^\/]+$/, "", pkg)
    coverage = $3
    gsub(/%/, "", coverage)
    pkg_count[pkg]++
    pkg_total[pkg] += coverage
} END {
    first = 1
    printf "{"
    for (p in pkg_count) {
        avg = pkg_total[p] / pkg_count[p]
        if (!first) printf ", "
        printf "\"%s\": %.1f", p, avg
        first = 0
    }
    printf "}"
}')
```

### Threshold Enforcement (Existing)
```bash
# Source: backend/tests/quality/coverage_gates.sh (verified working)
OVERALL=$(go tool cover -func=coverage/coverage.out | grep "^total:" | awk '{print $3}' | sed 's/%//')
OVERALL_NUM=$(echo "$OVERALL" | awk '{printf "%.1f", $1}')

if (( $(echo "$OVERALL_NUM < $OVERALL_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
  echo -e "${RED}FAIL: Overall coverage ${OVERALL_NUM}% is below threshold ${OVERALL_THRESHOLD}%${NC}"
  exit 1
fi
```

### Package-Level Coverage Extraction (Existing)
```bash
# Source: backend/scripts/generate-coverage-report.sh (verified working)
go tool cover -func=coverage/coverage.out | grep -v "^total:" | awk '{
    split($1, parts, ":")
    pkg = parts[1]
    gsub(/\/[^\/]+$/, "", pkg)
    coverage = $3
    gsub(/%/, "", coverage)
    pkg_count[pkg]++
    pkg_total[pkg] += coverage
} END {
    for (p in pkg_count) {
        avg = pkg_total[p] / pkg_count[p]
        printf "%s: %.1f%% (%d functions)\n", p, avg, pkg_count[p]
    }
}' | sort
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single 60% threshold | Incremental gates (30% → 45% → 60%) | Phase 12 | Motivates team through measurable progress |
| Overall coverage only | Package-level tracking with regression detection | Phase 12 | Prevents regressions in critical packages |
| Manual coverage checks | Automated CI/CD gates with PR blocking | Phase 8 | Ensures quality before merge |
| No visibility | Coverage dashboard with progress bars | Phase 12 | Provides visual feedback on progress |

**Deprecated/outdated:**
- Manual coverage measurement: Automated via `scripts/track-coverage-history.sh`
- Missing package visibility: Already extracted in `generate-coverage-report.sh`
- External coverage services: Native Go tools are sufficient

## Open Questions

1. **Gate progression mechanism**
   - What we know: Incremental gates needed (30% → 45% → 60%)
   - What's unclear: How to progress between gates (manual trigger vs. automatic based on coverage)
   - Recommendation: Use environment variable `COVERAGE_GATE_STAGE` in CI, update manually when team consensus reached

2. **Dashboard hosting**
   - What we know: Static HTML dashboard can be generated from JSON
   - What's unclear: Where to host (GitHub Pages vs. docs/ folder vs. artifact)
   - Recommendation: Generate to `docs/coverage-dashboard.html`, serve via GitHub Pages for team visibility

3. **Regression threshold**
   - What we know: Package-level regression detection needed
   - What's unclear: What regression percentage constitutes failure (5%? 10%?)
   - Recommendation: Use 5% warning threshold, 10% failure threshold (configurable in JSON)

## Validation Architecture

Skip this section - workflow.nyquist_validation is not set to false, but this is a validation phase (Phase 12 completes the milestone), so the planner will handle test validation for the phase itself.

## Sources

### Primary (HIGH confidence)
- Go 1.21.6 documentation - `go test -cover`, `go tool cover -func`, `go tool cover -html` (native Go tooling, verified working in project)
- Project existing scripts - `backend/tests/quality/coverage_gates.sh`, `scripts/track-coverage-history.sh`, `backend/scripts/generate-coverage-report.sh` (verified working)
- GitHub Actions documentation - `actions/github-script@v7` for PR comments, workflow syntax (standard GitHub Actions)

### Secondary (MEDIUM confidence)
- shields.io documentation - Badge generation with JSON endpoints (standard practice for coverage badges)
- jq documentation - JSON manipulation for coverage history (already used in project)

### Tertiary (LOW confidence)
- None - All findings based on project code and standard tooling documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Native Go tools verified in project, versions confirmed
- Architecture: HIGH - Existing script patterns analyzed and extended
- Pitfalls: HIGH - Based on project code review and common CI/CD anti-patterns

**Research date:** 2026-03-22
**Valid until:** 2026-04-21 (30 days - Go tooling is stable)
