#!/bin/bash

# Smoke Test Runner for Armored Archer Backend
# Executes comprehensive smoke tests for all RPC endpoints
# Usage: ./scripts/run-smoke-tests.sh [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
TEST_DIR="$BACKEND_DIR/tests/integration"
REPORT_DIR="$BACKEND_DIR/reports/smoke-tests"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Default options
RUN_ALL=true
SPECIFIC_SUITE=""
VERBOSE=false
COVERAGE=false
JSON_OUTPUT=false
QUICK_MODE=false

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Print functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Usage information
usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -a, --all           Run all smoke tests (default)"
    echo "  -s, --suite SUITE   Run specific test suite (auth, player, combat, gear, matchmaking, season, store, performance, errors)"
    echo "  -v, --verbose       Enable verbose output"
    echo "  -c, --coverage      Generate coverage report"
    echo "  -j, --json          Output results as JSON"
    echo "  -q, --quick         Quick mode (skip performance tests)"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --all                    # Run all tests"
    echo "  $0 --suite combat           # Run only combat tests"
    echo "  $0 --verbose --coverage     # Run with verbose output and coverage"
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--all)
            RUN_ALL=true
            shift
            ;;
        -s|--suite)
            RUN_ALL=false
            SPECIFIC_SUITE="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -j|--json)
            JSON_OUTPUT=true
            shift
            ;;
        -q|--quick)
            QUICK_MODE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Change to backend directory
cd "$BACKEND_DIR"

print_header "Armored Archer Smoke Test Suite"
echo "Timestamp: $TIMESTAMP"
echo "Backend Directory: $BACKEND_DIR"
echo "Test Directory: $TEST_DIR"

# Check prerequisites
print_header "Checking Prerequisites"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi
print_success "Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_success "npm found: $(npm --version)"

# Check if test dependencies are installed
if [ ! -d "node_modules" ]; then
    print_warning "Node modules not found, running npm install..."
    npm install
fi

# Check if Nakama is running
print_info "Checking Nakama server availability..."
NAKAMA_HOST=${NAKAMA_HOST:-localhost}
NAKAMA_PORT=${NAKAMA_PORT:-7350}

if curl -s "http://${NAKAMA_HOST}:${NAKAMA_PORT}/healthcheck" > /dev/null 2>&1; then
    print_success "Nakama server is running at ${NAKAMA_HOST}:${NAKAMA_PORT}"
else
    print_warning "Nakama server not responding at ${NAKAMA_HOST}:${NAKAMA_PORT}"
    print_info "Tests may fail if Nakama is not running"
    print_info "Start Nakama with: docker-compose up -d"
fi

# Create report directory
mkdir -p "$REPORT_DIR"

# Run test function
run_test_suite() {
    local suite_name=$1
    local test_pattern=$2

    print_header "Running $suite_name Tests"

    local start_time=$(date +%s)
    local jest_opts="--testPathPattern=$test_pattern"

    if [ "$VERBOSE" = true ]; then
        jest_opts="$jest_opts --verbose"
    fi

    if [ "$COVERAGE" = true ]; then
        jest_opts="$jest_opts --coverage --coverageDirectory=coverage/$suite_name"
    fi

    # Run the tests
    if npm run test:integration -- $jest_opts 2>&1 | tee "$REPORT_DIR/${suite_name}_${TIMESTAMP}.log"; then
        print_success "$suite_name tests passed"
        ((PASSED_TESTS++))
    else
        print_error "$suite_name tests failed"
        ((FAILED_TESTS++))
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    print_info "$suite_name tests completed in ${duration}s"

    ((TOTAL_TESTS++))
}

# Main test execution
print_header "Starting Smoke Tests"

if [ "$RUN_ALL" = true ]; then
    # Run all integration tests
    print_info "Running all integration tests..."

    start_time=$(date +%s)

    if [ "$QUICK_MODE" = true ]; then
        # Skip performance tests in quick mode
        EXCLUDE_PATTERN="low_end_device_performance"
        jest_opts="--testPathIgnorePatterns=$EXCLUDE_PATTERN"
    else
        jest_opts=""
    fi

    if [ "$VERBOSE" = true ]; then
        jest_opts="$jest_opts --verbose"
    fi

    if [ "$COVERAGE" = true ]; then
        jest_opts="$jest_opts --coverage --coverageDirectory=coverage/integration"
    fi

    if [ "$JSON_OUTPUT" = true ]; then
        jest_opts="$jest_opts --json --outputFile=$REPORT_DIR/test-results_${TIMESTAMP}.json"
    fi

    # Run all integration tests
    if npm run test:integration -- $jest_opts 2>&1 | tee "$REPORT_DIR/all-tests_${TIMESTAMP}.log"; then
        print_success "All smoke tests passed"
        PASSED_TESTS=1
    else
        print_error "Some smoke tests failed"
        FAILED_TESTS=1
    fi

    end_time=$(date +%s)
    duration=$((end_time - start_time))
    TOTAL_TESTS=1

else
    # Run specific test suite
    case $SPECIFIC_SUITE in
        auth|authentication)
            # Authentication tests are in network_resilience.test.ts
            run_test_suite "authentication" "network_resilience"
            ;;
        player|rpg)
            run_test_suite "player" "rpg_system"
            ;;
        combat)
            run_test_suite "combat" "combat_system"
            ;;
        gear|inventory)
            run_test_suite "gear" "gear_system"
            ;;
        matchmaking|matchmaker)
            run_test_suite "matchmaking" "matchmaker"
            ;;
        season)
            run_test_suite "season" "season_system"
            ;;
        store)
            run_test_suite "store" "store"
            ;;
        performance)
            run_test_suite "performance" "low_end_device_performance"
            ;;
        errors|error)
            # Error handling is tested across all suites
            run_test_suite "errors" "network_resilience"
            ;;
        *)
            print_error "Unknown test suite: $SPECIFIC_SUITE"
            echo "Available suites: auth, player, combat, gear, matchmaking, season, store, performance, errors"
            exit 1
            ;;
    esac
fi

# Print summary
print_header "Test Summary"
echo "Total Suites: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo -e "Skipped: $SKIPPED_TESTS"

if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "Pass Rate: ${GREEN}${PASS_RATE}%${NC}"
fi

# Generate summary report
SUMMARY_FILE="$REPORT_DIR/smoke-test-summary_${TIMESTAMP}.md"
cat > "$SUMMARY_FILE" << EOF
# Smoke Test Summary

**Date:** $(date)
**Backend Directory:** $BACKEND_DIR

## Results

| Metric | Value |
|--------|-------|
| Total Suites | $TOTAL_TESTS |
| Passed | $PASSED_TESTS |
| Failed | $FAILED_TESTS |
| Skipped | $SKIPPED_TESTS |
| Pass Rate | ${PASS_RATE:-0}% |

## Test Suites Executed

EOF

if [ "$RUN_ALL" = true ]; then
    cat >> "$SUMMARY_FILE" << EOF
- [x] Authentication Tests (network_resilience.test.ts)
- [x] Player System Tests (rpg_system.test.ts)
- [x] Combat System Tests (combat_system.test.ts)
- [x] Gear & Inventory Tests (gear_system.test.ts)
- [x] Matchmaking Tests (matchmaker.test.ts)
- [x] Season System Tests (season_system.test.ts)
- [x] Store System Tests (store.test.ts)
- [x] Performance Tests (low_end_device_performance.test.ts)
- [x] Error Handling Tests (network_resilience.test.ts)
EOF
else
    cat >> "$SUMMARY_FILE" << EOF
- [x] $SPECIFIC_SUITE Tests
EOF
fi

print_info "Summary report saved to: $SUMMARY_FILE"

# Exit with error code if any tests failed
if [ $FAILED_TESTS -gt 0 ]; then
    print_error "Smoke tests completed with failures"
    exit 1
else
    print_success "All smoke tests passed successfully"
    exit 0
fi
