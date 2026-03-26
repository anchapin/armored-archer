#!/bin/bash
set -e

# Mutation Testing Orchestration Script
# Runs go-mutesting with custom exec handler and enforces thresholds

# Configuration
MUTATION_CONFIG="tests/quality/mutation_config.yaml"
MUTATION_BLACKLIST="../data/mutation-blacklist.txt"
EXEC_SCRIPT="scripts/mutation-exec-handler.sh"
GOMUTESTING_BIN="${HOME}/go/bin/go-mutesting"

# Check if go-mutesting is installed
if [ ! -f "$GOMUTESTING_BIN" ]; then
    echo "Error: go-mutesting not found at $GOMUTESTING_BIN"
    echo "Run: make mutation-install"
    exit 1
fi

# Default packages to test
# Format: "source_package:test_package"
DEFAULT_PACKAGES=(
    "github.com/anchapin/armored-archer/backend/internal/combat:tests/combat"
    "github.com/anchapin/armored-archer/backend/internal/matchmaking:tests/matchmaking"
    "github.com/anchapin/armored-archer/backend/internal/rpg:tests/rpg"
    "github.com/anchapin/armored-archer/backend/internal/store:tests/store"
    "github.com/anchapin/armored-archer/backend/internal/season:tests/season"
    "github.com/anchapin/armored-archer/backend/internal/notifications:tests/notifications"
)

# Allow package filter via command-line argument
if [ $# -gt 0 ]; then
    PACKAGES=("$@")
else
    PACKAGES=("${DEFAULT_PACKAGES[@]}")
fi

echo "=== Mutation Testing Orchestration ==="
echo "Packages: ${PACKAGES[*]}"
echo ""

# Function to get package threshold from config
get_threshold() {
    local package=$1
    # Extract the short package name (e.g., "internal/combat" from "github.com/anchapin/armored-archer/backend/internal/combat")
    local short_package=$(echo "$package" | sed 's|github.com/anchapin/armored-archer/backend/||')
    local threshold=$(grep -A 5 "^$short_package:" "$MUTATION_CONFIG" | grep "threshold:" | awk '{print $2}')
    echo "${threshold:-75}"  # Default to 75% if not found
}

# Function to run mutation tests for a package
run_mutation_tests() {
    local package_spec=$1
    local source_package=$(echo "$package_spec" | cut -d: -f1)
    local test_package=$(echo "$package_spec" | cut -d: -f2)
    local threshold=$(get_threshold "$source_package")

    echo "Testing package: $source_package (test: $test_package, threshold: ${threshold}%)"
    echo "---"

    # Build go-mutesting command
    local cmd="$GOMUTESTING_BIN"
    cmd="$cmd --exec ../$EXEC_SCRIPT"

    # Add blacklist if it has entries
    if [ -s "$MUTATION_BLACKLIST" ] && [ "$(wc -l < "$MUTATION_BLACKLIST")" -gt 1 ]; then
        cmd="$cmd --blacklist $MUTATION_BLACKLIST"
    fi

    cmd="$cmd $source_package"

    # Capture output
    local output
    output=$(eval $cmd 2>&1) || true

    echo "$output"
    echo ""

    # Extract mutation score from output
    local score=$(echo "$output" | grep -i "mutation score" | grep -oP '\d+\.?\d*' | head -1)

    if [ -z "$score" ]; then
        echo "Warning: Could not extract mutation score for $source_package"
        score=0
    fi

    # Convert decimal score to percentage (multiply by 100)
    local score_pct=$(echo "scale=2; $score * 100" | bc -l)
    local score_int=$(echo "$score_pct" | cut -d. -f1)
    local threshold_int=$(echo "$threshold" | cut -d. -f1)

    if [ "$score_int" -lt "$threshold_int" ]; then
        echo "FAIL: Mutation score ${score_pct}% is below threshold ${threshold}%"
        return 1
    else
        echo "PASS: Mutation score ${score_pct}% meets threshold ${threshold}%"
        return 0
    fi
}

# Track overall results
TOTAL_PACKAGES=${#PACKAGES[@]}
PASSED_PACKAGES=0
FAILED_PACKAGES=0

# JSON report structure
echo '{"packages": [' > /tmp/mutation-report.json

# Run mutation tests for each package
for i in "${!PACKAGES[@]}"; do
    package_spec=${PACKAGES[$i]}
    source_package=$(echo "$package_spec" | cut -d: -f1)

    if [ $i -gt 0 ]; then
        echo "," >> /tmp/mutation-report.json
    fi

    echo -n '{"name": "'"$source_package"'", ' >> /tmp/mutation-report.json

    if run_mutation_tests "$package_spec"; then
        PASSED_PACKAGES=$((PASSED_PACKAGES + 1))
        echo '"status": "pass"}' >> /tmp/mutation-report.json
    else
        FAILED_PACKAGES=$((FAILED_PACKAGES + 1))
        echo '"status": "fail"}' >> /tmp/mutation-report.json
    fi

    echo ""
done

# Close JSON report
echo ']}' >> /tmp/mutation-report.json

# Output summary
echo "=== Mutation Testing Summary ==="
echo "Total packages: $TOTAL_PACKAGES"
echo "Passed: $PASSED_PACKAGES"
echo "Failed: $FAILED_PACKAGES"
echo ""

# Output JSON report
echo "=== JSON Report ==="
cat /tmp/mutation-report.json
echo ""

# Clean up
rm -f /tmp/mutation-report.json

# Exit with error if any package failed
if [ $FAILED_PACKAGES -gt 0 ]; then
    echo "Error: $FAILED_PACKAGES package(s) failed mutation testing"
    exit 1
else
    echo "All packages passed mutation testing"
    exit 0
fi
