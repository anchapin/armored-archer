#!/bin/bash
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
GODOT_UNIT=$(find test/suites/player test/suites/combat test/suites/gear test/suites/network test/suites/matchmaking test/suites/season test/suites/store test/suites/campaign test/suites/gem test/suites/transmog test/suites/analytics test/suites/object_pool -name "test_*.gd" 2>/dev/null | wc -l)
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
