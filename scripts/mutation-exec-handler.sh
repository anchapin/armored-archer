#!/bin/bash
set -e

# Custom execution script for go-mutesting
# Handles MUTATE_ORIGINAL/MUTATE_CHANGED environment variables
# Integrates with testcontainers and flaky test quarantine

# Input validation - ensure required environment variables are set
if [ -z "$MUTATE_ORIGINAL" ] || [ -z "$MUTATE_CHANGED" ]; then
    echo "Error: Required environment variables not set"
    echo "MUTATE_ORIGINAL: ${MUTATE_ORIGINAL:-not set}"
    echo "MUTATE_CHANGED: ${MUTATE_CHANGED:-not set}"
    exit 1
fi

# Mutation setup: replace original file with mutated
cp "$MUTATE_CHANGED" "$MUTATE_ORIGINAL"

# Change to package directory
cd "$(dirname "$MUTATE_ORIGINAL")"

# Test infrastructure integration
# Export testcontainers environment variables
export TESTDB_HOST=localhost
export TESTDB_PORT=5432

# Quarantine handling: check if flaky-test-quarantine.json exists
QUARANTINE_FILE="../../../data/flaky-test-quarantine.json"
QUARANTINE_RUN_ARGS=""

if [ -f "$QUARANTINE_FILE" ]; then
    # Check if quarantine has any entries
    QUARANTINE_COUNT=$(jq 'length' "$QUARANTINE_FILE" 2>/dev/null || echo 0)

    if [ "$QUARANTINE_COUNT" -gt 0 ]; then
        # Build skip list from quarantine keys
        QUARANTINED_TESTS=$(jq -r 'keys[]' "$QUARANTINE_FILE" 2>/dev/null | tr '\n' '|')
        if [ -n "$QUARANTINED_TESTS" ]; then
            # Use -run flag to skip quarantined tests (negated regex)
            QUARANTINE_RUN_ARGS="-run='^((?!(Quarantined|$(echo $QUARANTINED_TESTS | sed 's/|/|Quarantined|/g'))).)*\$'"
        fi
    fi
fi

# Test execution with timeout (default 30s if not set)
# go-mutesting may provide timeout as just a number, append 's' if needed
TIMEOUT="${MUTATE_TIMEOUT:-30s}"
if [[ "$TIMEOUT" =~ ^[0-9]+$ ]]; then
    TIMEOUT="${TIMEOUT}s"
fi
echo "Running tests with timeout: $TIMEOUT"

# Construct test command
TEST_CMD="go test -v -timeout=\"$TIMEOUT\""
if [ -n "$QUARANTINE_RUN_ARGS" ]; then
    TEST_CMD="$TEST_CMD $QUARANTINE_RUN_ARGS"
fi
TEST_CMD="$TEST_CMD ."

echo "Executing: $TEST_CMD"
eval $TEST_CMD

# Mutation result determination
# If tests PASS (exit 0): mutation was killed (good)
# If tests FAIL (exit non-zero): mutation survived (bad)
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    # Mutation killed - tests caught the bug
    echo "Mutation killed by tests"
    exit 0
else
    # Mutation survived - tests didn't catch the bug
    echo "Mutation survived - tests did not detect change"
    exit 1
fi

# Cleanup: go-mutesting manages file restoration
# No need to restore original file manually
