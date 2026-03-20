#!/bin/bash
# Test Pyramid Validation
# Validates test distribution follows 70/20/10 rule (unit/integration/E2E)
#
# Target Distribution:
# - Unit Tests: 70% (±10% tolerance: 60-80%)
# - Integration Tests: 20% (±10% tolerance: 10-30%)
# - E2E Tests: 10% (±10% tolerance: 0-20%)
#
# Usage:
#   ./scripts/check-test-pyramid.sh              # Check all tests
#   ./scripts/check-test-pyramid.sh --backend    # Check backend only
#   ./scripts/check-test-pyramid.sh --frontend   # Check frontend only
#
# TODO (05-02): Implement full test counting and percentage calculation
# TODO (05-02): Add tolerance validation and error reporting
# TODO (05-02): Implement backend/frontend split mode

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Tolerance constants (percentage ranges)
UNIT_MIN=60
UNIT_MAX=80
INTEGRATION_MIN=10
INTEGRATION_MAX=30
E2E_MAX=20

# Test directory patterns
# TODO (05-02): Make these configurable for different project structures
GO_UNIT_DIR="backend/tests/unit"
GO_INTEGRATION_DIR="backend/tests/integration"
GO_E2E_DIR="backend/tests/e2e"

GODOT_UNIT_DIRS="test/suites/player test/suites/combat test/suites/gear"
GODOT_INTEGRATION_DIR="test/suites/integration"
GODOT_E2E_DIR="test/suites/e2e"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Count Go tests by directory
count_go_tests() {
    log_info "Counting Go tests..."

    # TODO (05-02): Validate directories exist before counting
    # TODO (05-02): Handle missing directories gracefully (count as 0)

    # Count unit tests
    GO_UNIT=$(find "$PROJECT_ROOT/$GO_UNIT_DIR" -name "*_test.go" 2>/dev/null | wc -l)
    log_info "Unit tests: $GO_UNIT"

    # Count integration tests
    GO_INTEGRATION=$(find "$PROJECT_ROOT/$GO_INTEGRATION_DIR" -name "*_test.go" 2>/dev/null | wc -l)
    log_info "Integration tests: $GO_INTEGRATION"

    # Count E2E tests
    GO_E2E=$(find "$PROJECT_ROOT/$GO_E2E_DIR" -name "*_test.go" 2>/dev/null | wc -l)
    log_info "E2E tests: $GO_E2E"

    # Calculate Go totals
    GO_TOTAL=$((GO_UNIT + GO_INTEGRATION + GO_E2E))

    if [ $GO_TOTAL -eq 0 ]; then
        log_warning "No Go tests found"
        return 1
    fi

    log_success "Total Go tests: $GO_TOTAL"
    echo ""
}

# Count Godot tests by directory
count_godot_tests() {
    log_info "Counting Godot tests..."

    # TODO (05-02): Validate directories exist before counting
    # TODO (05-02): Handle missing directories gracefully (count as 0)

    # Count unit tests (from multiple directories)
    GODOT_UNIT=0
    for dir in $GODOT_UNIT_DIRS; do
        count=$(find "$PROJECT_ROOT/$dir" -name "test_*.gd" 2>/dev/null | wc -l)
        GODOT_UNIT=$((GODOT_UNIT + count))
    done
    log_info "Unit tests: $GODOT_UNIT"

    # Count integration tests
    GODOT_INTEGRATION=$(find "$PROJECT_ROOT/$GODOT_INTEGRATION_DIR" -name "test_*.gd" 2>/dev/null | wc -l)
    log_info "Integration tests: $GODOT_INTEGRATION"

    # Count E2E tests
    GODOT_E2E=$(find "$PROJECT_ROOT/$GODOT_E2E_DIR" -name "test_*.gd" 2>/dev/null | wc -l)
    log_info "E2E tests: $GODOT_E2E"

    # Calculate Godot totals
    GODOT_TOTAL=$((GODOT_UNIT + GODOT_INTEGRATION + GODOT_E2E))

    if [ $GODOT_TOTAL -eq 0 ]; then
        log_warning "No Godot tests found"
        return 1
    fi

    log_success "Total Godot tests: $GODOT_TOTAL"
    echo ""
}

# Calculate and validate percentages
calculate_percentages() {
    log_info "Calculating test distribution..."

    # Combined totals
    TOTAL_UNIT=$((GO_UNIT + GODOT_UNIT))
    TOTAL_INTEGRATION=$((GO_INTEGRATION + GODOT_INTEGRATION))
    TOTAL_E2E=$((GO_E2E + GODOT_E2E))
    TOTAL_TESTS=$((GO_TOTAL + GODOT_TOTAL))

    # TODO (05-02): Handle division by zero if TOTAL_TESTS is 0
    # TODO (05-02): Add validation to ensure totals are consistent

    if [ $TOTAL_TESTS -eq 0 ]; then
        log_error "No tests found in any category"
        exit 1
    fi

    # Calculate percentages
    UNIT_PERCENT=$((TOTAL_UNIT * 100 / TOTAL_TESTS))
    INTEGRATION_PERCENT=$((TOTAL_INTEGRATION * 100 / TOTAL_TESTS))
    E2E_PERCENT=$((TOTAL_E2E * 100 / TOTAL_TESTS))

    log_info "Total tests: $TOTAL_TESTS"
    echo ""
}

# Validate test pyramid ratios
validate_pyramid() {
    print_header "Test Pyramid Validation"

    local validation_passed=true

    # Display and validate unit tests
    echo "Unit Tests:"
    echo "  Count: $TOTAL_UNIT"
    echo "  Percentage: ${UNIT_PERCENT}%"
    echo "  Target: 70% (range: ${UNIT_MIN}-${UNIT_MAX}%)"

    if [ $UNIT_PERCENT -ge $UNIT_MIN ] && [ $UNIT_PERCENT -le $UNIT_MAX ]; then
        log_success "Unit tests within target range ✅"
    else
        log_error "Unit tests outside target range ❌"
        validation_passed=false
    fi
    echo ""

    # Display and validate integration tests
    echo "Integration Tests:"
    echo "  Count: $TOTAL_INTEGRATION"
    echo "  Percentage: ${INTEGRATION_PERCENT}%"
    echo "  Target: 20% (range: ${INTEGRATION_MIN}-${INTEGRATION_MAX}%)"

    if [ $INTEGRATION_PERCENT -ge $INTEGRATION_MIN ] && [ $INTEGRATION_PERCENT -le $INTEGRATION_MAX ]; then
        log_success "Integration tests within target range ✅"
    else
        log_error "Integration tests outside target range ❌"
        validation_passed=false
    fi
    echo ""

    # Display and validate E2E tests
    echo "E2E Tests:"
    echo "  Count: $TOTAL_E2E"
    echo "  Percentage: ${E2E_PERCENT}%"
    echo "  Target: 10% (range: 0-${E2E_MAX}%)"

    if [ $E2E_PERCENT -le $E2E_MAX ]; then
        log_success "E2E tests within target range ✅"
    else
        log_error "E2E tests outside target range ❌"
        validation_passed=false
    fi
    echo ""

    # Display summary
    print_header "Summary"
    echo "Total Tests: $TOTAL_TESTS"
    echo "  Unit:        ${UNIT_PERCENT}% ($TOTAL_UNIT tests)"
    echo "  Integration: ${INTEGRATION_PERCENT}% ($TOTAL_INTEGRATION tests)"
    echo "  E2E:         ${E2E_PERCENT}% ($TOTAL_E2E tests)"
    echo ""

    if [ "$validation_passed" = true ]; then
        log_success "Test pyramid validation passed! ✅"
        return 0
    else
        log_error "Test pyramid validation failed! ❌"
        echo ""
        log_warning "Adjust test distribution to meet target ratios:"
        echo "  Unit: ${UNIT_MIN}-${UNIT_MAX}%"
        echo "  Integration: ${INTEGRATION_MIN}-${INTEGRATION_MAX}%"
        echo "  E2E: 0-${E2E_MAX}%"
        return 1
    fi
}

# Main execution
main() {
    local check_backend=true
    local check_frontend=true

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backend)
                check_frontend=false
                shift
                ;;
            --frontend)
                check_backend=false
                shift
                ;;
            --help)
                echo "Test Pyramid Validation"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --backend    Check backend tests only"
                echo "  --frontend   Check frontend tests only"
                echo "  --help       Show this help message"
                echo ""
                echo "Target Distribution:"
                echo "  Unit:        70% (range: 60-80%)"
                echo "  Integration: 20% (range: 10-30%)"
                echo "  E2E:         10% (range: 0-20%)"
                echo ""
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    cd "$PROJECT_ROOT"

    print_header "Test Pyramid Validation"

    # Count tests
    if [ "$check_backend" = true ]; then
        count_go_tests || true
    fi

    if [ "$check_frontend" = true ]; then
        count_godot_tests || true
    fi

    # Calculate and validate
    calculate_percentages
    validate_pyramid
}

# Make executable with: chmod +x scripts/check-test-pyramid.sh
main "$@"
