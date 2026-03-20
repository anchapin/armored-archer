#!/bin/bash
# Detect flaky Go tests via 3x retry logic
# Runs each test multiple times and identifies tests with failure rate >= threshold

set -e

# Parse arguments
RUNS=${1:-3}
THRESHOLD=${2:-0.33}

echo "Running Go flaky test detection..."
echo "Runs: $RUNS, Threshold: $THRESHOLD"

# Create data directory
mkdir -p data

# Change to backend directory
cd backend

# List all test functions
TESTS=$(go test -list . ./... 2>/dev/null | grep "^Test" || true)

if [ -z "$TESTS" ]; then
    echo "No tests found"
    cd ..
    echo '{"flaky_tests": [], "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "runs": '$RUNS', "threshold": '$THRESHOLD'}' > data/go-flaky-tests.json
    exit 0
fi

# Track flaky tests
FLAKY_TESTS=()
FLAKY_DATA=()

# Test each function multiple times
for test in $TESTS; do
    failures=0

    echo "Testing $test..."
    for i in $(seq 1 $RUNS); do
        if ! go test -run "^${test}$" ./... > /dev/null 2>&1; then
            ((failures++))
        fi
    done

    # Calculate failure rate
    failure_rate=$(echo "scale=2; $failures / $RUNS" | bc)

    # Check if flaky (failure rate >= threshold)
    if (( $(echo "$failure_rate >= $THRESHOLD" | bc -l) )); then
        echo "  FLAKY: $test (failure rate: $failure_rate, failures: $failures/$RUNS)"
        FLAKY_TESTS+=("$test")

        # Find the file containing this test
        TEST_FILE=$(grep -r "func ${test}(" . --include="*_test.go" -l | head -1 || echo "")
        TEST_FILE=${TEST_FILE#./}  # Remove ./

        # Build JSON object for this test
        FLAKY_DATA+=("{\"name\": \"$test\", \"failure_rate\": $failure_rate, \"failures\": $failures, \"runs\": $RUNS, \"file\": \"$TEST_FILE\"}")
    fi
done

cd ..

# Build JSON array
FLAKY_JSON="["
FIRST=true
for entry in "${FLAKY_DATA[@]}"; do
    if [ "$FIRST" = true ]; then
        FLAKY_JSON+="$entry"
        FIRST=false
    else
        FLAKY_JSON+=",$entry"
    fi
done
FLAKY_JSON+="]"

# Output JSON to file
echo "{\"flaky_tests\": $FLAKY_JSON, \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"runs\": $RUNS, \"threshold\": $THRESHOLD}" > data/go-flaky-tests.json

echo ""
echo "Flaky test detection complete!"
echo "Found ${#FLAKY_TESTS[@]} flaky test(s)"
echo "Results written to data/go-flaky-tests.json"
