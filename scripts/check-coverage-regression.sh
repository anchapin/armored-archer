#!/bin/bash
set -e

# Coverage Regression Detection Script
# Compares current package coverage against baselines and detects regressions
# Usage: check-coverage-regression.sh [--update-baselines]

cd "$(dirname "$0")/.."

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Configuration files
THRESHOLDS_FILE="data/coverage-thresholds.json"
BASELINES_FILE="data/package-baselines.json"
COVERAGE_FILE="backend/coverage/coverage.out"

# Load thresholds
if [ ! -f "$THRESHOLDS_FILE" ]; then
    echo "ERROR: $THRESHOLDS_FILE not found"
    exit 1
fi

REGRESSION_WARNING=$(jq -r '.regression_warning' "$THRESHOLDS_FILE")
REGRESSION_FAILURE=$(jq -r '.regression_failure' "$THRESHOLDS_FILE")

# Parse arguments
UPDATE_BASELINES=false
if [ "$1" = "--update-baselines" ]; then
    UPDATE_BASELINES=true
fi

echo "=== Coverage Regression Detection ==="
echo "Regression warning threshold: ${REGRESSION_WARNING}%"
echo "Regression failure threshold: ${REGRESSION_FAILURE}%"
echo ""

if [ ! -f "$COVERAGE_FILE" ]; then
    echo "ERROR: $COVERAGE_FILE not found. Run coverage generation first."
    exit 1
fi

# Extract current package coverage from go tool cover output
# Create temporary file with package-level coverage
TEMP_PKG=$(mktemp)

go tool cover -func="$COVERAGE_FILE" | grep -v "^total:" | awk '{
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
        printf "%s|%.1f\n", p, avg
    }
}' | sort > "$TEMP_PKG"

REGRESSIONS_FOUND=0
FAILURES=0

# Compare each package against baseline
while IFS='|' read -r pkg coverage; do
    BASELINE=$(jq -r ".packages.\"$pkg\" // \"0.0\"" "$BASELINES_FILE")

    # Skip packages with no baseline data
    if [ "$BASELINE" = "null" ] || [ -z "$BASELINE" ]; then
        echo -n "  ${YELLOW}${pkg##*/}${NC}: "
        echo "No baseline (skipping)"
        continue
    fi

    # Calculate difference
    DIFF=$(echo "$coverage - $BASELINE" | bc -l 2>/dev/null || echo "0")
    DIFF_ABS=$(echo "$DIFF" | awk '{if ($1 < 0) print -$1; else print $1}')

    # Determine package name for display
    PKG_NAME="${pkg##*/}"

    if (( $(echo "$DIFF < -$REGRESSION_FAILURE" | bc -l 2>/dev/null || echo "0") )); then
        echo -n "  ${RED}${PKG_NAME}${NC}: "
        echo "${coverage}% (baseline: ${BASELINE}%, diff: ${DIFF}%) ${RED}[REGRESSION]${NC}"
        FAILURES=1
        REGRESSIONS_FOUND=1
    elif (( $(echo "$DIFF < -$REGRESSION_WARNING" | bc -l 2>/dev/null || echo "0") )); then
        echo -n "  ${YELLOW}${PKG_NAME}${NC}: "
        echo "${coverage}% (baseline: ${BASELINE}%, diff: ${DIFF}%) ${YELLOW}[WARNING]${NC}"
        REGRESSIONS_FOUND=1
    else
        echo -n "  ${GREEN}${PKG_NAME}${NC}: "
        echo "${coverage}% (baseline: ${BASELINE}%, diff: ${DIFF}%) ${GREEN}[OK]${NC}"
    fi

done < "$TEMP_PKG"

# Clean up
rm -f "$TEMP_PKG"

echo ""

# Update baselines if requested
if [ "$UPDATE_BASELINES" = true ]; then
    echo "Updating baselines from current coverage..."
    TEMP_BASELINES=$(mktemp)

    # Update metadata
    COMMIT=$(git rev-parse --short HEAD)
    DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    jq --arg commit "$COMMIT" \
       --arg date "$DATE" \
       '.metadata.last_updated = $date | .metadata.commit = $commit' \
       "$BASELINES_FILE" > "$TEMP_BASELINES"

    mv "$TEMP_BASELINES" "$BASELINES_FILE"

    # Update packages with current coverage
    while IFS='|' read -r pkg coverage; do
        jq --arg pkg "$pkg" \
           --arg cov "$coverage" \
           '.packages[$pkg] = ($cov | tonumber)' \
           "$BASELINES_FILE" > "${BASELINES_FILE}.tmp"
        mv "${BASELINES_FILE}.tmp" "$BASELINES_FILE"
    done < "$TEMP_PKG"

    echo "Baselines updated successfully"
    rm -f "$TEMP_PKG"
fi

# Exit with failure if regressions detected
if [ $FAILURES -eq 1 ]; then
    echo -e "${RED}FAIL: Coverage regressions detected${NC}"
    exit 1
elif [ $REGRESSIONS_FOUND -eq 1 ]; then
    echo -e "${YELLOW}WARN: Coverage warnings detected${NC}"
    exit 0
else
    echo -e "${GREEN}PASS: No coverage regressions${NC}"
    exit 0
fi
