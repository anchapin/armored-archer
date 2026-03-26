#!/bin/bash
# Quarantine flaky Go tests by applying build tags
# Reads flaky tests from JSON and prepends build tags to test files

set -e

echo "Quarantining flaky Go tests..."

# Check if flaky tests JSON exists
if [ ! -f "data/go-flaky-tests.json" ]; then
    echo "No flaky tests JSON found at data/go-flaky-tests.json"
    echo "Run detect-go-flaky-tests.sh first"
    exit 1
fi

# Read flaky tests from JSON
FLAKY_TESTS=$(jq -r '.flaky_tests[].name' data/go-flaky-tests.json 2>/dev/null || echo "")

if [ -z "$FLAKY_TESTS" ]; then
    echo "No flaky tests found in JSON"
    exit 0
fi

echo "Found flaky tests:"
echo "$FLAKY_TESTS"
echo ""

# Track modified files
MODIFIED_FILES=()

# For each flaky test, prepend build tag to test file
for test_name in $FLAKY_TESTS; do
    echo "Processing $test_name..."

    # Find the file containing this test
    TEST_FILE=$(grep -r "func ${test_name}(" backend/ --include="*_test.go" -l | head -1 || echo "")

    if [ -z "$TEST_FILE" ]; then
        echo "  Warning: Could not find file for test $test_name"
        continue
    fi

    echo "  Found in $TEST_FILE"

    # Check if build tag already exists
    if grep -q "//go:build.*flaky" "$TEST_FILE"; then
        echo "  Build tag already exists, skipping"
        continue
    fi

    # Prepend build tag to file
    tmp_file=$(mktemp)
    {
        echo "//go:build !flaky"
        echo "// +build !flaky"
        echo ""
        cat "$TEST_FILE"
    } > "$tmp_file"

    mv "$tmp_file" "$TEST_FILE"
    echo "  Quarantined $test_name in $TEST_FILE"

    MODIFIED_FILES+=("$TEST_FILE")
done

echo ""
echo "Quarantine complete!"
echo "Modified ${#MODIFIED_FILES[@]} file(s)"

# Update quarantine.go registry with flaky test details
if [ ${#MODIFIED_FILES[@]} -gt 0 ]; then
    echo ""
    echo "Note: Update QuarantinedTests map in backend/tests/testhelpers/quarantine.go"
    echo "with the following entries:"

    # Extract test names and failure rates from JSON
    jq -r '.flaky_tests[] | "\(.name): \(.failure_rate * 100)% failure rate, quarantined \(.timestamp)"' data/go-flaky-tests.json | while read -r line; do
        echo "  \"$line\","
    done
fi

echo ""
echo "To run quarantined tests: go test -tags=flaky ./..."
