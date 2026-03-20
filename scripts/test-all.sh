#!/bin/bash
set -e
set -o pipefail

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
