#!/bin/bash
# Unified Benchmark Runner with Slow Test Detection
# Runs benchmarks, identifies slow tests (>100ms), and tracks history
#
# Usage:
#   ./scripts/benchmark-tests.sh                    # Run all benchmarks
#   ./scripts/benchmark-tests.sh --update-baseline    # Update baseline
#   ./scripts/benchmark-tests.sh --compare             # Compare to baseline
#   ./scripts/benchmark-tests.sh --history             # Show performance history
#
# Slow test threshold: 100ms (configurable via SLOW_TEST_THRESHOLD env var)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SLOW_THRESHOLD=${SLOW_TEST_THRESHOLD:-100}  # 100ms default
UPDATE_BASELINE=false
COMPARE_TO_BASELINE=false
SHOW_HISTORY=false
BENCHMARKS_DIR="backend/tests/benchmarks"
RESULTS_FILE="$BENCHMARKS_DIR/new.txt"
BASELINE_FILE="$BENCHMARKS_DIR/baseline.txt"
HISTORY_FILE="data/test-performance-history.json"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --update-baseline)
            UPDATE_BASELINE=true
            shift
            ;;
        --compare)
            COMPARE_TO_BASELINE=true
            shift
            ;;
        --history)
            SHOW_HISTORY=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--update-baseline] [--compare] [--history]"
            exit 1
            ;;
    esac
done

# Show history if requested
if [ "$SHOW_HISTORY" = true ]; then
    if [ -f "$HISTORY_FILE" ]; then
        echo "======================================="
        echo "Performance History"
        echo "======================================="
        cat "$HISTORY_FILE" | jq -r '.history[-10:][] | "\(.timestamp): \(.total_benchmarks) benchmarks, avg \(.avg_time_ms)ms"'
        echo "======================================="
    else
        echo "No performance history found"
    fi
    exit 0
fi

echo "======================================="
echo "Benchmark Runner"
echo "======================================="
echo "Slow test threshold: ${SLOW_THRESHOLD}ms"
echo "======================================="
echo ""

START_TIME=$(date +%s)

# Create data directory
mkdir -p data

# Run benchmarks
echo "Running benchmarks..."
cd backend
go test -bench=. -benchmem -run=^Benchmark benchmarks/ > "$RESULTS_FILE" 2>&1 || true
cd ..

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "Benchmark results:"
cat "$RESULTS_FILE"
echo ""

# Identify slow benchmarks
echo "======================================="
echo "Slow Benchmark Detection (>${SLOW_THRESHOLD}ms)"
echo "======================================="

SLOW_COUNT=0
TOTAL_BENCHMARKS=0
TOTAL_TIME_MS=0

# Parse benchmark output
while IFS= read -r line; do
    # Match benchmark lines: BenchmarkName  N  time/op  B/op  allocs/op
    if [[ $line =~ ^Benchmark(.*)[[:space:]]+([0-9]+)[[:space:]]+([0-9.]+)[[:space:]]+ns/op ]]; then
        BENCHMARK_NAME="${BASH_REMATCH[1]}"
        ITERATIONS="${BASH_REMATCH[2]}"
        TIME_NS="${BASH_REMATCH[3]}"

        # Convert ns to ms
        TIME_MS=$(echo "scale=2; $TIME_NS / 1000000" | bc)

        TOTAL_BENCHMARKS=$((TOTAL_BENCHMARKS + 1))
        TOTAL_TIME_MS=$(echo "$TOTAL_TIME_MS + $TIME_MS" | bc)

        if (( $(echo "$TIME_MS > $SLOW_THRESHOLD" | bc -l) )); then
            echo -e "${RED}SLOW: $BENCHMARK_NAME${NC} ($TIME_MS ms per op)"
            SLOW_COUNT=$((SLOW_COUNT + 1))
        fi
    fi
done < "$RESULTS_FILE"

if [ $SLOW_COUNT -eq 0 ]; then
    echo -e "${GREEN}No slow benchmarks found${NC}"
else
    echo -e "${YELLOW}Found $SLOW_COUNT slow benchmark(s)${NC}"
fi

echo "======================================="

# Calculate average time
if [ $TOTAL_BENCHMARKS -gt 0 ]; then
    AVG_TIME_MS=$(echo "scale=2; $TOTAL_TIME_MS / $TOTAL_BENCHMARKS" | bc)
    echo "Total benchmarks: $TOTAL_BENCHMARKS"
    echo "Average time: ${AVG_TIME_MS}ms"
    echo "Execution time: ${ELAPSED}s"
fi

# Update performance history
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
HISTORY_ENTRY="{\"timestamp\": \"$NOW\", \"total_benchmarks\": $TOTAL_BENCHMARKS, \"slow_benchmarks\": $SLOW_COUNT, \"avg_time_ms\": ${AVG_TIME_MS:-0}, \"threshold_ms\": $SLOW_THRESHOLD, \"elapsed_s\": $ELAPSED}"

if [ -f "$HISTORY_FILE" ]; then
    # Append to existing history
    jq ".history += [$HISTORY_ENTRY]" "$HISTORY_FILE" > tmp.json && mv tmp.json "$HISTORY_FILE"
else
    # Create new history file
    echo "{\"history\": [$HISTORY_ENTRY]}" > "$HISTORY_FILE"
fi

echo -e "${GREEN}History updated: $HISTORY_FILE${NC}"
echo ""

# Compare to baseline if requested
if [ "$COMPARE_TO_BASELINE" = true ]; then
    echo "======================================="
    echo "Comparing to baseline..."
    echo "======================================="
    if [ -f "$BASELINE_FILE" ]; then
        bash "$BENCHMARKS_DIR/compare.sh" "$BASELINE_FILE" "$RESULTS_FILE"
    else
        echo -e "${YELLOW}No baseline file found${NC}"
        echo "Run with --update-baseline to create baseline"
    fi
fi

# Update baseline if requested
if [ "$UPDATE_BASELINE" = true ]; then
    echo "======================================="
    echo "Updating baseline..."
    echo "======================================="
    cp "$RESULTS_FILE" "$BASELINE_FILE"
    echo -e "${GREEN}Baseline updated: $BASELINE_FILE${NC}"
fi

echo "======================================="
exit 0
