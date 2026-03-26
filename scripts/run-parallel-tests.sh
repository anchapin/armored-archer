#!/bin/bash
# Unified Parallel Test Runner
# Runs tests with optimal parallelization for CI and local development
#
# Usage:
#   ./scripts/run-parallel-tests.sh           # Default: 4 Go workers, 2 Jest workers
#   ./scripts/run-parallel-tests.sh --go-only   # Run only Go tests
#   ./scripts/run-parallel-tests.sh --jest-only  # Run only Jest tests
#   TEST_PARALLEL_WORKERS=8 ./scripts/run-parallel-tests.sh  # Custom Go workers
#   JEST_MAX_WORKERS=4 ./scripts/run-parallel-tests.sh    # Custom Jest workers
#
# Environment variables:
#   TEST_PARALLEL_WORKERS - Number of Go parallel workers (default: 4)
#   JEST_MAX_WORKERS - Number of Jest max workers (default: 2 in CI, '50%' locally)
#   CI - Set to 'true' in CI environments

set -e
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PARALLEL_WORKERS=${TEST_PARALLEL_WORKERS:-4}
GO_ONLY=${1:-false}
JEST_ONLY=${1:-false}

echo "======================================="
echo "🚀 Parallel Test Runner"
echo "======================================="
echo "Configuration:"
echo "  Go parallel workers: $PARALLEL_WORKERS"
echo "  Jest max workers: ${JEST_MAX_WORKERS:-auto (CI: 2, dev: 50%)}"
echo "  CI mode: ${CI:-false}"
echo "======================================="
echo ""

START_TIME=$(date +%s)
OVERALL_SUCCESS=0

# Create test results directory
mkdir -p test-results

# Go backend tests (parallel)
if [ "$JEST_ONLY" != "--jest-only" ]; then
    echo -e "${BLUE}📦 Go Backend Tests${NC}"
    echo "-----------------------------------"
    cd backend

    if go test -v -race -shuffle=on -parallel=$PARALLEL_WORKERS -timeout=30s ./... 2>&1 | tee ../test-results/go-tests.txt; then
        echo -e "${GREEN}✅ Go tests passed${NC}"
    else
        echo -e "${RED}❌ Go tests failed${NC}"
        OVERALL_SUCCESS=1
    fi
    cd ..
fi

# Jest/TypeScript tests (parallel)
if [ "$GO_ONLY" != "--go-only" ]; then
    echo ""
    echo -e "${BLUE}📜 Jest/TypeScript Tests${NC}"
    echo "-----------------------------------"
    cd backend

    if npm test 2>&1 | tee ../test-results/jest-tests.txt; then
        echo -e "${GREEN}✅ Jest tests passed${NC}"
    else
        echo -e "${RED}❌ Jest tests failed${NC}"
        OVERALL_SUCCESS=1
    fi
    cd ..
fi

# Godot tests (serial - GUT does not support parallel execution)
echo ""
echo -e "${BLUE}🎮 Godot Tests (serial)${NC}"
echo "-----------------------------------"
if godot4 --headless --script res://test/run_all_tests.gd 2>&1 | tee test-results/godot-tests.txt; then
    echo -e "${GREEN}✅ Godot tests passed${NC}"
else
    echo -e "${RED}❌ Godot tests failed${NC}"
    OVERALL_SUCCESS=1
fi

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "======================================="
if [ $OVERALL_SUCCESS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo -e "Total execution time: ${ELAPSED}s${NC}"
    echo "======================================="
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo -e "Total execution time: ${ELAPSED}s${NC}"
    echo "======================================="
    exit 1
fi
