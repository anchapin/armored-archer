#!/bin/bash
set -e
set -o pipefail

# Armored Archer Unified Test Runner
#
# This script runs both Go backend and Godot frontend tests with:
# - Race detector (-race flag) to detect data races in concurrent Go code
# - Shuffle (-shuffle=on flag) to verify test isolation and catch shared state bugs
#
# Race Detector Notes:
# - Slows tests ~10x but catches critical concurrency bugs
# - GOMAXPROCS=2 recommended for better performance
# - Any data race will cause the test to fail with detailed report
#
# Shuffle Flag Notes:
# - Randomizes test execution order to detect shared state dependencies
# - Tests that pass individually but fail in suite have isolation issues
# - Each run uses different random seed for comprehensive coverage
#
# Usage:
#   ./scripts/test-all.sh              # Run all tests
#   make test-all                       # Run all tests via Makefile
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more test suites failed

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================="
echo "🧪 Armored Archer Unified Test Suite"
echo "======================================="

# Create test results directory
mkdir -p test-results

# Track overall success
OVERALL_SUCCESS=0

# Backend tests (Go with race detector and shuffle)
echo ""
echo -e "${YELLOW}📦 Backend Tests (Go + Testify)${NC}"
echo "-----------------------------------"
cd backend

# Run Go tests with race detector and shuffle (FND-05, FND-06)
if go test -v -race -shuffle=on -timeout=30s ./... 2>&1 | tee ../test-results/backend.txt; then
    echo -e "${GREEN}✅ Backend tests passed${NC}"
else
    echo -e "${RED}❌ Backend tests failed${NC}"
    OVERALL_SUCCESS=1
fi

cd ..

# Frontend tests (Godot with GUT)
echo ""
echo -e "${YELLOW}🎮 Frontend Tests (Godot + GUT)${NC}"
echo "-----------------------------------"

# Run Godot tests (GUT supports headless mode)
if godot4 --headless --script res://test/run_all_tests.gd 2>&1 | tee test-results/frontend.txt; then
    echo -e "${GREEN}✅ Frontend tests passed${NC}"
else
    echo -e "${RED}❌ Frontend tests failed${NC}"
    OVERALL_SUCCESS=1
fi

# Exit with appropriate code
echo ""
echo "======================================="
if [ $OVERALL_SUCCESS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo "======================================="
    exit 0
else
    echo -e "${RED}❌ Some tests failed - check logs above${NC}"
    echo "======================================="
    exit 1
fi
