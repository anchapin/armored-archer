#!/bin/bash
# Benchmark Runner (issue #1031 re-baseline)
#
# Previously ran `go test -bench` against the Go backend and compared results
# with benchstat against backend/tests/benchmarks/baseline.txt. The Go backend
# migration was abandoned and deleted, so this script now delegates to the
# TypeScript performance-threshold suite
# (backend/tests/integration/low_end_device_performance.test.ts).
#
# Usage:
#   ./scripts/benchmark-tests.sh                    # Run the benchmark suite
#   ./scripts/benchmark-tests.sh --history          # Show performance history

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
HISTORY_FILE="data/test-performance-history.json"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --history)
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
            ;;
        --update-baseline|--compare)
            echo -e "${YELLOW}The Go benchstat baseline machinery was retired with the Go backend (issue #1031).${NC}"
            echo "The benchmark gate is now the TypeScript performance-threshold suite."
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--history]"
            exit 1
            ;;
    esac
done

echo "======================================="
echo "Benchmark Runner (TypeScript backend)"
echo "======================================="

cd backend
npm run test:benchmark

echo -e "${GREEN}Benchmark suite passed.${NC}"
echo "======================================="
exit 0
