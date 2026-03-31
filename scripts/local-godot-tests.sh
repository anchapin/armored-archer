#!/bin/bash
# Local Godot Testing Script
# Alternative to GitHub Actions when act CLI is unavailable
#
# Usage:
#   ./scripts/local-godot-tests.sh           # Run all tests
#   ./scripts/local-godot-tests.sh --lint    # Run linting only
#   ./scripts/local-godot-tests.sh --quick   # Run quick validation
#   ./scripts/local-godot-tests.sh --help    # Show help

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GODOT_BINARY="${GODOT_BINARY:-godot4}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR="$PROJECT_ROOT/test"

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

check_godot() {
    if command -v "$GODOT_BINARY" &> /dev/null; then
        log_info "Found Godot: $(which $GODOT_BINARY)"
        $GODOT_BINARY --version
        return 0
    else
        log_warning "Godot binary '$GODOT_BINARY' not found in PATH"
        log_info "Set GODOT_BINARY environment variable or install Godot 4.6+"
        return 1
    fi
}

run_lint() {
    log_info "Running GDScript linting..."
    
    if command -v gdlint &> /dev/null; then
        gdlint autoloads/*.gd scenes/**/*.gd scripts/*.gd test/*.gd 2>&1 || {
            log_error "GDScript linting failed"
            return 1
        }
        log_success "GDScript linting passed"
    else
        log_warning "gdlint not installed. Install with: pip install gdtoolkit"
        log_info "Skipping GDScript linting"
    fi
    return 0
}

run_syntax_check() {
    log_info "Running Godot syntax validation..."
    
    if ! check_godot; then
        log_warning "Cannot run syntax check without Godot"
        return 1
    fi
    
    # Run Godot in headless mode to validate project
    timeout 30 $GODOT_BINARY --headless --quit-after 5 2>&1 || {
        log_error "Godot project validation failed"
        return 1
    }
    
    log_success "Godot project validation passed"
    return 0
}

run_tests() {
    log_info "Running Godot test suite..."
    
    if ! check_godot; then
        log_warning "Cannot run tests without Godot"
        return 1
    fi
    
    # Check if test runner exists
    if [ ! -f "$TEST_DIR/run_all_tests.gd" ]; then
        log_error "Test runner not found: $TEST_DIR/run_all_tests.gd"
        return 1
    fi
    
    # Run tests
    timeout 120 $GODOT_BINARY --headless --script "$TEST_DIR/run_all_tests.gd" 2>&1 | tee /tmp/godot_test_output.txt || {
        log_error "Godot tests failed or timed out"
        return 1
    }
    
    # Check for failures
    if grep -q "Failed: [1-9]" /tmp/godot_test_output.txt; then
        log_error "Some tests failed!"
        grep "Failed:" /tmp/godot_test_output.txt
        return 1
    fi
    
    log_success "All Godot tests passed"
    return 0
}

run_quick_validation() {
    log_info "Running quick validation..."
    
    # Count test files
    TEST_COUNT=$(ls -1 "$TEST_DIR"/test_*.gd 2>/dev/null | wc -l)
    log_info "Found $TEST_COUNT test files"
    
    # Count test functions
    TOTAL_TESTS=0
    for test_file in "$TEST_DIR"/test_*.gd; do
        if [ -f "$test_file" ]; then
            COUNT=$(grep -c "func test_" "$test_file" 2>/dev/null || echo "0")
            TOTAL_TESTS=$((TOTAL_TESTS + COUNT))
        fi
    done
    log_info "Found $TOTAL_TESTS test functions"
    
    # Check for syntax errors in critical files
    log_info "Checking critical files for syntax errors..."
    CRITICAL_FILES=(
        "autoloads/NetworkManager.gd"
        "autoloads/CombatManager.gd"
        "autoloads/PlayerStatsManager.gd"
        "autoloads/GearManager.gd"
    )
    
    SYNTAX_ERRORS=0
    for file in "${CRITICAL_FILES[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            # Simple syntax check - look for common errors
            if grep -q "var _ =" "$PROJECT_ROOT/$file"; then
                log_error "Invalid 'var _ =' syntax in $file"
                SYNTAX_ERRORS=$((SYNTAX_ERRORS + 1))
            fi
        fi
    done
    
    if [ $SYNTAX_ERRORS -gt 0 ]; then
        log_error "Found $SYNTAX_ERRORS syntax errors"
        return 1
    fi
    
    log_success "Quick validation passed"
    return 0
}

show_help() {
    echo "Local Godot Testing Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --lint       Run GDScript linting only"
    echo "  --syntax     Run syntax validation only"
    echo "  --quick      Run quick validation (no Godot required)"
    echo "  --tests      Run full test suite"
    echo "  --all        Run all checks (default)"
    echo "  --help       Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  GODOT_BINARY  Path to Godot binary (default: godot4)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run all checks"
    echo "  $0 --quick            # Quick validation"
    echo "  $0 --lint --syntax    # Run linting and syntax check"
    echo ""
}

# Main execution
main() {
    local run_lint_flag=false
    local run_syntax_flag=false
    local run_tests_flag=false
    local run_quick_flag=false
    local run_all_flag=true
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --lint)
                run_lint_flag=true
                run_all_flag=false
                shift
                ;;
            --syntax)
                run_syntax_flag=true
                run_all_flag=false
                shift
                ;;
            --tests)
                run_tests_flag=true
                run_all_flag=false
                shift
                ;;
            --quick)
                run_quick_flag=true
                run_all_flag=false
                shift
                ;;
            --all)
                run_all_flag=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    cd "$PROJECT_ROOT"
    
    log_info "Starting local Godot tests..."
    echo ""
    
    local exit_code=0
    
    if [ "$run_all_flag" = true ]; then
        run_quick_flag=true
        run_lint_flag=true
        run_syntax_flag=true
        run_tests_flag=true
    fi
    
    if [ "$run_quick_flag" = true ]; then
        echo "=== Quick Validation ==="
        run_quick_validation || exit_code=1
        echo ""
    fi
    
    if [ "$run_lint_flag" = true ]; then
        echo "=== GDScript Linting ==="
        run_lint || exit_code=1
        echo ""
    fi
    
    if [ "$run_syntax_flag" = true ]; then
        echo "=== Syntax Validation ==="
        run_syntax_check || exit_code=1
        echo ""
    fi
    
    if [ "$run_tests_flag" = true ]; then
        echo "=== Test Suite ==="
        run_tests || exit_code=1
        echo ""
    fi
    
    if [ $exit_code -eq 0 ]; then
        log_success "All checks passed!"
    else
        log_error "Some checks failed!"
    fi
    
    return $exit_code
}

main "$@"
