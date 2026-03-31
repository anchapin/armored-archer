#!/bin/bash
set -e

# Parse command line arguments
OUTPUT_MODE="human"  # Default: human-readable output
OUTPUT_FILE=""

for arg in "$@"; do
    case $arg in
        --json)
            OUTPUT_MODE="json"
            OUTPUT_FILE="data/test-pyramid-results.json"
            ;;
        --ci)
            OUTPUT_MODE="ci"
            ;;
        --help|-h)
            echo "Usage: $0 [--json] [--ci] [--help]"
            echo ""
            echo "Options:"
            echo "  --json    Output results to data/test-pyramid-results.json"
            echo "  --ci      Output CI-friendly format (key=value pairs)"
            echo "  --help    Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Tolerance for pyramid ratios (±10%)
UNIT_MIN=60
UNIT_MAX=80
INTEGRATION_MIN=10
INTEGRATION_MAX=30
E2E_MAX=20

# Count TypeScript/Jest tests (backend/src/__tests__ or backend/tests/)
TS_UNIT=$(find backend/src -name "*.test.ts" 2>/dev/null | wc -l)
if [ $TS_UNIT -eq 0 ]; then
    TS_UNIT=$(find backend/tests -name "*.test.ts" 2>/dev/null | wc -l)
fi

# TypeScript integration tests (if they exist)
TS_INTEGRATION=$(find backend/tests -path "*/integration/*" -name "*.test.ts" 2>/dev/null | wc -l)

# Count Go tests by directory (legacy support)
GO_UNIT=$(find backend/tests/unit -name "*_test.go" 2>/dev/null | wc -l)
GO_INTEGRATION=$(find backend/tests/integration -name "*_test.go" 2>/dev/null | wc -l)
GO_E2E=$(find backend/tests/e2e -name "*_test.go" 2>/dev/null | wc -l)

# Count Godot tests by directory
if [ "$OUTPUT_MODE" = "human" ]; then
    echo "Counting Godot frontend tests..."
fi
GODOT_UNIT=$(find test/suites/player test/suites/combat test/suites/gear test/suites/network test/suites/matchmaking test/suites/season test/suites/store test/suites/campaign test/suites/gem test/suites/transmog test/suites/analytics test/suites/object_pool -name "test_*.gd" 2>/dev/null | wc -l)
GODOT_INTEGRATION=$(find test/suites/integration -name "test_*.gd" 2>/dev/null | wc -l)
GODOT_E2E=$(find test/suites/e2e -name "test_*.gd" 2>/dev/null | wc -l)

# Calculate totals (TypeScript + Go + Godot)
TOTAL_UNIT=$((TS_UNIT + GO_UNIT + GODOT_UNIT))
TOTAL_INTEGRATION=$((TS_INTEGRATION + GO_INTEGRATION + GODOT_INTEGRATION))
TOTAL_E2E=$((GO_E2E + GODOT_E2E))
TOTAL_TESTS=$((TOTAL_UNIT + TOTAL_INTEGRATION + TOTAL_E2E))

if [ $TOTAL_TESTS -eq 0 ]; then
    if [ "$OUTPUT_MODE" = "human" ]; then
        echo "❌ No tests found!"
    fi
    exit 1
fi

# Calculate percentages
UNIT_PCT=$((TOTAL_UNIT * 100 / TOTAL_TESTS))
INTEGRATION_PCT=$((TOTAL_INTEGRATION * 100 / TOTAL_TESTS))
E2E_PCT=$((TOTAL_E2E * 100 / TOTAL_TESTS))

# Validate ratios
PYRAMID_VALID=1
VIOLATIONS=()

if [ $UNIT_PCT -lt $UNIT_MIN ] || [ $UNIT_PCT -gt $UNIT_MAX ]; then
    VIOLATIONS+=("Unit tests $UNIT_PCT% (target: 70% ±10%)")
    PYRAMID_VALID=0
fi

if [ $INTEGRATION_PCT -lt $INTEGRATION_MIN ] || [ $INTEGRATION_PCT -gt $INTEGRATION_MAX ]; then
    VIOLATIONS+=("Integration tests $INTEGRATION_PCT% (target: 20% ±10%)")
    PYRAMID_VALID=0
fi

if [ $E2E_PCT -gt $E2E_MAX ] && [ $TOTAL_E2E -gt 0 ]; then
    VIOLATIONS+=("E2E tests $E2E_PCT% (target: 10% ±10%)")
    PYRAMID_VALID=0
fi

# Display breakdown in human-readable mode
if [ "$OUTPUT_MODE" = "human" ]; then
    echo "Test Distribution:"
    echo "  Backend (TypeScript): $TS_UNIT unit, $TS_INTEGRATION integration"
    echo "  Backend (Go): $GO_UNIT unit, $GO_INTEGRATION integration"
    echo "  Godot (GDScript): $GODOT_UNIT unit, $GODOT_INTEGRATION integration, $GODOT_E2E e2e"
    echo ""
    echo "  Total: Unit $TOTAL_UNIT, Integration $TOTAL_INTEGRATION, E2E $TOTAL_E2E"
    echo ""
fi

# Output based on mode
if [ "$OUTPUT_MODE" = "json" ]; then
    # Create data directory if not exists
    mkdir -p data
    # Build JSON violations array
    VIOLATIONS_JSON=""
    if [ ${#VIOLATIONS[@]} -gt 0 ]; then
        VIOLATIONS_JSON="["
        for i in "${!VIOLATIONS[@]}"; do
            if [ $i -gt 0 ]; then
                VIOLATIONS_JSON+=","
            fi
            VIOLATIONS_JSON+="\"${VIOLATIONS[$i]}\""
        done
        VIOLATIONS_JSON+="]"
    else
        VIOLATIONS_JSON="[]"
    fi

    # Generate JSON output
    cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "total_tests": $TOTAL_TESTS,
  "unit_tests": $TOTAL_UNIT,
  "unit_pct": $UNIT_PCT,
  "integration_tests": $TOTAL_INTEGRATION,
  "integration_pct": $INTEGRATION_PCT,
  "e2e_tests": $TOTAL_E2E,
  "e2e_pct": $E2E_PCT,
  "valid": $([ $PYRAMID_VALID -eq 1 ] && echo "true" || echo "false"),
  "violations": $VIOLATIONS_JSON
}
EOF

elif [ "$OUTPUT_MODE" = "ci" ]; then
    # CI-friendly key=value output
    echo "TEST_PYRAMID_TOTAL=$TOTAL_TESTS"
    echo "TEST_PYRAMID_UNIT_PCT=$UNIT_PCT"
    echo "TEST_PYRAMID_INTEGRATION_PCT=$INTEGRATION_PCT"
    echo "TEST_PYRAMID_E2E_PCT=$E2E_PCT"
    echo "TEST_PYRAMID_VALID=$([ $PYRAMID_VALID -eq 1 ] && echo "true" || echo "false")"

else
    # Human-readable output (default)
    echo "Test Distribution:"
    echo "  Unit tests:        $TOTAL_UNIT ($UNIT_PCT%)"
    echo "  Integration tests: $TOTAL_INTEGRATION ($INTEGRATION_PCT%)"
    echo "  E2E tests:         $TOTAL_E2E ($E2E_PCT%)"
    echo "  Total:             $TOTAL_TESTS"
    echo ""

    # Display violations if any
    if [ ${#VIOLATIONS[@]} -gt 0 ]; then
        for violation in "${VIOLATIONS[@]}"; do
            echo "❌ Test pyramid violation: $violation"
        done
        echo "======================================="
        exit 1
    else
        echo "✅ Test pyramid validated: Unit $UNIT_PCT%, Integration $INTEGRATION_PCT%, E2E $E2E_PCT%"
        echo "======================================="
        exit 0
    fi
fi

# Exit code based on validity
if [ $PYRAMID_VALID -eq 1 ]; then
    exit 0
else
    exit 1
fi
