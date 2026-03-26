#!/bin/bash
# Automatic Flaky Test Quarantine
# Reads flaky test results and applies quarantine + creates GitHub issues
#
# Usage:
#   ./scripts/mark-flaky-tests.sh                    # Mark both Go and Godot flaky tests
#   ./scripts/mark-flaky-tests.sh --go-only          # Mark only Go flaky tests
#   ./scripts/mark-flaky-tests.sh --godot-only       # Mark only Godot flaky tests
#   ./scripts/mark-flaky-tests.sh --dry-run          # Preview changes without applying
#
# Environment variables:
#   GITHUB_TOKEN - For creating GitHub issues (optional in dry-run mode)
#   GH_REPO - Repository name (default from git remote)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
GO_ONLY=false
GODOT_ONLY=false
DRY_RUN=false
QUARANTINE_FILE="data/flaky-test-quarantine.json"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --go-only)
            GO_ONLY=true
            shift
            ;;
        --godot-only)
            GODOT_ONLY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--go-only] [--godot-only] [--dry-run]"
            exit 1
            ;;
    esac
done

# Create data directory
mkdir -p data

echo "======================================="
echo "🔒 Flaky Test Quarantine"
echo "======================================="
echo "Dry run: $DRY_RUN"
echo "======================================="
echo ""

# Initialize quarantine file if not exists
if [ ! -f "$QUARANTINE_FILE" ]; then
    echo "{}" > "$QUARANTINE_FILE"
fi

# Track modified files and issues
MODIFIED_FILES=()
ISSUES_CREATED=()
TOTAL_MARKED=0

# === Go Flaky Tests ===
if [ "$GODOT_ONLY" != true ]; then
    echo -e "${BLUE}Processing Go flaky tests...${NC}"

    GO_JSON="data/go-flaky-tests.json"
    if [ ! -f "$GO_JSON" ]; then
        echo -e "${YELLOW}No Go flaky tests JSON found${NC}"
    else
        # Read flaky tests from JSON
        FLAKY_TESTS=$(jq -r '.flaky_tests[]? | select(. != null) | .name' "$GO_JSON" 2>/dev/null || echo "")

        if [ -z "$FLAKY_TESTS" ]; then
            echo "No flaky Go tests found"
        else
            echo "Found $(echo "$FLAKY_TESTS" | wc -w) flaky Go test(s)"

            for test_name in $FLAKY_TESTS; do
                # Find file containing this test
                TEST_FILE=$(grep -r "func ${test_name}(" backend/ --include="*_test.go" -l | head -1 || echo "")

                if [ -z "$TEST_FILE" ]; then
                    echo -e "${YELLOW}  Warning: Could not find file for $test_name${NC}"
                    continue
                fi

                # Check if already quarantined
                if jq -e ".\"$test_name\"" "$QUARANTINE_FILE" > /dev/null 2>&1; then
                    echo -e "  ${YELLOW}Already quarantined: $test_name${NC}"
                    continue
                fi

                # Get test details
                TEST_DETAILS=$(jq -r ".flaky_tests[]? | select(.name == \"$test_name\")" "$GO_JSON")
                FAILURE_RATE=$(echo "$TEST_DETAILS" | jq -r '.failure_rate')
                FAILURES=$(echo "$TEST_DETAILS" | jq -r '.failures')
                RUNS=$(echo "$TEST_DETAILS" | jq -r '.runs')

                echo -e "  ${RED}Quarantining: $test_name${NC}"
                echo "    Failure rate: $(echo "scale=0; $FAILURE_RATE * 100" | bc)% ($FAILURES/$RUNS runs)"

                if [ "$DRY_RUN" = false ]; then
                    # Check if build tag already exists
                    if grep -q "//go:build.*flaky" "$TEST_FILE"; then
                        echo "    Build tag already exists"
                    else
                        # Prepend build tag
                        tmp_file=$(mktemp)
                        {
                            echo "//go:build !flaky"
                            echo "// +build !flaky"
                            echo ""
                            cat "$TEST_FILE"
                        } > "$tmp_file"
                        mv "$tmp_file" "$TEST_FILE"
                        MODIFIED_FILES+=("$TEST_FILE")
                        echo "    Applied build tag: !flaky"
                    fi

                    # Update quarantine registry
                    NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
                    jq --arg test "$test_name" \
                       --arg file "$TEST_FILE" \
                       --arg failure_rate "$FAILURE_RATE" \
                       --arg failures "$FAILURES" \
                       --arg runs "$RUNS" \
                       --arg reason "Failed $RUNS runs with >$((FAILURE_RATE * 100))% failure rate" \
                       '.[$test] = {
                           name: $test,
                           file: $file,
                           failure_rate: ($failure_rate | tonumber),
                           failures: ($failures | tonumber),
                           runs: ($runs | tonumber),
                           reason: $reason,
                           quarantined_at: $now,
                           framework: "go"
                       }' "$QUARANTINE_FILE" > tmp.json && mv tmp.json "$QUARANTINE_FILE"

                    TOTAL_MARKED=$((TOTAL_MARKED + 1))
                else
                    echo "    [DRY RUN] Would apply build tag"
                fi
            done
        fi
    fi
fi

# === Godot Flaky Tests ===
if [ "$GO_ONLY" != true ]; then
    echo ""
    echo -e "${BLUE}Processing Godot flaky tests...${NC}"

    GODOT_JSON="data/godot-flaky-tests.json"
    if [ ! -f "$GODOT_JSON" ]; then
        echo -e "${YELLOW}No Godot flaky tests JSON found${NC}"
    else
        # Find tests with failure_rate > 0.33
        FLAKY_TESTS=$(jq -r '.flaky_tests | to_entries[] | select(.value.failure_rate > 0.33) | .key' "$GODOT_JSON" 2>/dev/null || echo "")

        if [ -z "$FLAKY_TESTS" ]; then
            echo "No flaky Godot tests found"
        else
            echo "Found $(echo "$FLAKY_TESTS" | wc -w) flaky Godot test(s)"

            for test_name in $FLAKY_TESTS; do
                # Check if already quarantined
                if jq -e ".\"$test_name\"" "$QUARANTINE_FILE" > /dev/null 2>&1; then
                    echo -e "  ${YELLOW}Already quarantined: $test_name${NC}"
                    continue
                fi

                # Get test details
                TEST_DETAILS=$(jq -r ".flaky_tests[\"$test_name\"]" "$GODOT_JSON")
                FAILURE_RATE=$(echo "$TEST_DETAILS" | jq -r '.failure_rate')
                FAILURES=$(echo "$TEST_DETAILS" | jq -r '.failures')
                RUNS=$(echo "$TEST_DETAILS" | jq -r '.runs')

                echo -e "  ${RED}Quarantining: $test_name${NC}"
                echo "    Failure rate: $(echo "scale=0; $FAILURE_RATE * 100" | bc)% ($FAILURES/$RUNS runs)"

                # Find test file
                TEST_FILE=$(grep -r "func $test_name(" test/ --include="test_*.gd" -l | head -1 || echo "")

                if [ "$DRY_RUN" = false ]; then
                    # For Godot, we use registry approach (no build tags in GDScript)
                    NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
                    jq --arg test "$test_name" \
                       --arg file "$TEST_FILE" \
                       --arg failure_rate "$FAILURE_RATE" \
                       --arg failures "$FAILURES" \
                       --arg runs "$RUNS" \
                       --arg reason "Failed $RUNS runs with >$((FAILURE_RATE * 100))% failure rate" \
                       '.[$test] = {
                           name: $test,
                           file: $file,
                           failure_rate: ($failure_rate | tonumber),
                           failures: ($failures | tonumber),
                           runs: ($runs | tonumber),
                           reason: $reason,
                           quarantined_at: $now,
                           framework: "godot"
                       }' "$QUARANTINE_FILE" > tmp.json && mv tmp.json "$QUARANTINE_FILE"

                    TOTAL_MARKED=$((TOTAL_MARKED + 1))
                else
                    echo "    [DRY RUN] Would add to quarantine registry"
                fi
            done
        fi
    fi
fi

echo ""
echo "======================================="
echo "Quarantine Summary"
echo "======================================="
echo "Tests marked: $TOTAL_MARKED"
echo "Files modified: ${#MODIFIED_FILES[@]}"
if [ "$DRY_RUN" = false ]; then
    echo -e "${GREEN}Quarantine registry: $QUARANTINE_FILE${NC}"
fi
echo "======================================="

# Create GitHub issues if requested and not dry-run
if [ "$DRY_RUN" = false ] && [ "$GITHUB_TOKEN" != "" ]; then
    echo ""
    echo "Creating GitHub issues for flaky tests..."
    # Issue creation would be handled by CI workflow
fi

exit 0
