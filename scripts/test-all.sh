#!/bin/bash
# Armored Archer Unified Test Suite
# Runs both Go backend tests and Godot frontend tests with unified reporting
#
# Usage:
#   ./scripts/test-all.sh                    # Run all tests
#   ./scripts/test-all.sh --backend-only     # Run backend tests only
#   ./scripts/test-all.sh --frontend-only    # Run frontend tests only
#   ./scripts/test-all.sh --quick            # Quick validation (no race detector)
#
# TODO (05-01): Implement full test execution logic with exit code tracking
# TODO (05-01): Add test result aggregation and unified reporting
# TODO (05-01): Implement --quick mode for faster iteration

set -e -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results"

# Test command configurations
# TODO (05-01): Make these configurable via command-line flags
GO_TEST_CMD="go test -v -race -shuffle=on -timeout=30s ./..."
GODOT_TEST_CMD="godot4 --headless --script res://test/run_all_tests.gd"

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

# Create test results directory
create_results_dir() {
    log_info "Creating test results directory..."
    mkdir -p "$TEST_RESULTS_DIR"
    log_success "Test results directory: $TEST_RESULTS_DIR"
}

# Run backend tests
run_backend_tests() {
    print_header "Backend Tests (Go)"

    if [ ! -d "$BACKEND_DIR" ]; then
        log_error "Backend directory not found: $BACKEND_DIR"
        return 1
    fi

    cd "$BACKEND_DIR"

    # TODO (05-01): Check if Go is installed
    # TODO (05-01): Validate backend dependencies are installed
    # TODO (05-01): Track exit code for result aggregation

    log_info "Running Go tests with race detector and shuffle..."
    $GO_TEST_CMD 2>&1 | tee ../test-results/backend.txt
    local backend_exit_code=${PIPESTATUS[0]}

    cd "$PROJECT_ROOT"

    # TODO (05-01): Parse test results and extract pass/fail counts
    # TODO (05-01): Return appropriate exit code

    if [ $backend_exit_code -eq 0 ]; then
        log_success "Backend tests passed"
        return 0
    else
        log_error "Backend tests failed with exit code: $backend_exit_code"
        return 1
    fi
}

# Run frontend tests
run_frontend_tests() {
    print_header "Frontend Tests (Godot)"

    # TODO (05-01): Check if Godot is installed
    # TODO (05-01): Validate test runner exists
    # TODO (05-01): Track exit code for result aggregation

    log_info "Running Godot test suite..."
    $GODOT_TEST_CMD 2>&1 | tee test-results/frontend.txt
    local frontend_exit_code=${PIPESTATUS[0]}

    # TODO (05-01): Parse test results and extract pass/fail counts
    # TODO (05-01): Return appropriate exit code

    if [ $frontend_exit_code -eq 0 ]; then
        log_success "Frontend tests passed"
        return 0
    else
        log_error "Frontend tests failed with exit code: $frontend_exit_code"
        return 1
    fi
}

# Display unified results
display_results() {
    print_header "Test Results Summary"

    # TODO (05-01): Aggregate results from test-results/backend.txt and test-results/frontend.txt
    # TODO (05-01): Display unified pass/fail status with color-coded indicators
    # TODO (05-01): Show total test count, passed, failed, and execution time

    log_info "Full results available in: $TEST_RESULTS_DIR"
    echo "  - Backend:  test-results/backend.txt"
    echo "  - Frontend: test-results/frontend.txt"
}

# Main execution
main() {
    local run_backend=true
    local run_frontend=true
    local backend_exit_code=0
    local frontend_exit_code=0

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backend-only)
                run_frontend=false
                shift
                ;;
            --frontend-only)
                run_backend=false
                shift
                ;;
            --quick)
                # TODO (05-01): Implement quick mode without race detector
                log_warning "Quick mode not yet implemented"
                shift
                ;;
            --help)
                echo "Armored Archer Unified Test Suite"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --backend-only     Run backend tests only"
                echo "  --frontend-only    Run frontend tests only"
                echo "  --quick            Quick validation (no race detector)"
                echo "  --help             Show this help message"
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

    print_header "Armored Archer Unified Test Suite"
    log_info "Starting test execution..."
    echo ""

    create_results_dir

    # Run tests
    if [ "$run_backend" = true ]; then
        run_backend_tests || backend_exit_code=$?
        echo ""
    fi

    if [ "$run_frontend" = true ]; then
        run_frontend_tests || frontend_exit_code=$?
        echo ""
    fi

    # Display results
    display_results

    # Exit with appropriate code
    # TODO (05-01): Implement proper exit code logic based on both test suites
    if [ $backend_exit_code -ne 0 ] || [ $frontend_exit_code -ne 0 ]; then
        log_error "Some tests failed!"
        exit 1
    fi

    log_success "All tests passed!"
    exit 0
}

# Make executable with: chmod +x scripts/test-all.sh
main "$@"
