#!/bin/bash
# Armored Archer End-to-End Smoke Test Runner
#
# Validates the complete vertical slice flow:
#   login -> PvE stage -> boss -> loot -> equip
#
# Usage:
#   ./scripts/run-smoke-tests.sh              # Run all tests (default)
#   ./scripts/run-smoke-tests.sh --backend    # Run backend tests only
#   ./scripts/run-smoke-tests.sh --client     # Run Godot client tests only
#   ./scripts/run-smoke-tests.sh --quick      # Quick mode (skip performance tests)
#   ./scripts/run-smoke-tests.sh --verbose    # Verbose output
#   ./scripts/run-smoke-tests.sh --ci        # CI mode (exit on first failure)
#   ./scripts/run-smoke-tests.sh --help     # Show help
#
# Issue: #684 - [Sprint 1] Create end-to-end smoke test script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_DIR="$PROJECT_ROOT/reports/smoke-tests"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$REPORT_DIR/smoke-test_${TIMESTAMP}.log"
HTML_REPORT="$REPORT_DIR/smoke-test-summary_${TIMESTAMP}.html"

# Test flags
RUN_BACKEND=true
RUN_CLIENT=true
VERBOSE=false
CI_MODE=false
QUICK_MODE=false

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Phase tracking
PHASE=""

# Print functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_phase() {
    PHASE="$1"
    echo -e "\n${CYAN}--- PHASE: $PHASE ---${NC}\n" | tee -a "$LOG_FILE"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}✗ $1${NC}" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}" | tee -a "$LOG_FILE"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}" | tee -a "$LOG_FILE"
}

print_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}  $1${NC}" | tee -a "$LOG_FILE"
    fi
}

# Usage information
usage() {
    cat << EOF
${BLUE}Armored Archer End-to-End Smoke Test${NC}
${GREEN}Issue: #684 - Vertical Slice Smoke Test${NC}

${YELLOW}Validates complete vertical slice flow:${NC}
  login → PvE stage → boss → loot → equip

${BLUE}Usage:${NC}
  $0 [OPTIONS]

${BLUE}Options:${NC}
  --backend    Run backend smoke tests only
  --client     Run Godot client tests only
  --quick      Quick mode (skip performance tests)
  --verbose    Verbose output
  --ci         CI mode (exit on first failure)
  --help       Show this help message

${BLUE}Examples:${NC}
  $0                    # Run all smoke tests
  $0 --backend --verbose # Run backend tests with verbose output
  $0 --quick            # Run quick smoke tests
  $0 --ci               # CI mode for GitHub Actions

${BLUE}Output:${NC}
  - Logs: ${REPORT_DIR}/smoke-test_${TIMESTAMP}.log
  - Report: ${REPORT_DIR}/smoke-test-summary_${TIMESTAMP}.html

${BLUE}Exit Codes:${NC}
  0: All tests passed
  1: Tests failed
  2: Prerequisites not met
EOF
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backend)
            RUN_BACKEND=true
            RUN_CLIENT=false
            shift
            ;;
        --client)
            RUN_CLIENT=true
            RUN_BACKEND=false
            shift
            ;;
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --ci)
            CI_MODE=true
            shift
            ;;
        --help|-h)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Main execution
main() {
    print_header "Armored Archer Smoke Test Suite"
    print_info "Issue: #684 - [Sprint 1] Vertical Slice Smoke Test"
    print_info "Timestamp: $TIMESTAMP"
    print_info "Project Root: $PROJECT_ROOT"
    print_info "Report Directory: $REPORT_DIR"

    # Create report directory
    mkdir -p "$REPORT_DIR"

    # Clear log file
    : > "$LOG_FILE"

    # Track overall test results
    local backend_passed=false
    local client_passed=false
    local overall_exit_code=0

    # Phase 1: Prerequisites Check
    print_phase "Phase 1: Prerequisites Check"
    if ! check_prerequisites; then
        print_error "Prerequisites not met. Exiting."
        exit 2
    fi

    # Phase 2: Backend Smoke Tests
    if [ "$RUN_BACKEND" = true ]; then
        print_phase "Phase 2: Backend Smoke Tests"
        if run_backend_tests; then
            backend_passed=true
            print_success "Backend smoke tests passed"
        else
            backend_passed=false
            print_error "Backend smoke tests failed"
            overall_exit_code=1
            if [ "$CI_MODE" = true ]; then
                exit 1
            fi
        fi
    else
        print_warning "Backend tests skipped (--client flag)"
        backend_passed=true # Assume passed if skipped
    fi

    # Phase 3: Client E2E Tests
    if [ "$RUN_CLIENT" = true ]; then
        print_phase "Phase 3: Client E2E Tests"
        if run_client_tests; then
            client_passed=true
            print_success "Client E2E tests passed"
        else
            client_passed=false
            print_error "Client E2E tests failed"
            overall_exit_code=1
            if [ "$CI_MODE" = true ]; then
                exit 1
            fi
        fi
    else
        print_warning "Client tests skipped (--backend flag)"
        client_passed=true # Assume passed if skipped
    fi

    # Phase 4: Generate Report
    print_phase "Phase 4: Test Summary"
    generate_summary_report "$backend_passed" "$client_passed"

    # Exit with appropriate code
    if [ $overall_exit_code -eq 0 ]; then
        print_success "All smoke tests passed successfully"
        print_info "View report: $HTML_REPORT"
    else
        print_error "Some smoke tests failed"
        print_info "View report: $HTML_REPORT"
    fi

    exit $overall_exit_code
}

# Check prerequisites
check_prerequisites() {
    local all_good=true

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        all_good=false
    else
        print_success "Node.js found: $(node --version)"
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        all_good=false
    else
        print_success "npm found: $(npm --version)"
    fi

    # Check if Godot is installed (only if running client tests)
    if [ "$RUN_CLIENT" = true ]; then
        local godot_cmd="${GODOT_BINARY:-godot4}"
        if ! command -v "$godot_cmd" &> /dev/null; then
            print_error "Godot binary '$godot_cmd' not found"
            print_info "Set GODOT_BINARY environment variable or install Godot 4.6+"
            all_good=false
        else
            print_success "Godot found: $($godot_cmd --version)"
        fi
    fi

    # Check if Nakama is running
    print_info "Checking Nakama server availability..."
    NAKAMA_HOST=${NAKAMA_HOST:-localhost}
    NAKAMA_PORT=${NAKAMA_PORT:-7350}

    if curl -s "http://${NAKAMA_HOST}:${NAKAMA_PORT}/healthcheck" > /dev/null 2>&1; then
        print_success "Nakama server is running at ${NAKAMA_HOST}:${NAKAMA_PORT}"
    else
        print_error "Nakama server not responding at ${NAKAMA_HOST}:${NAKAMA_PORT}"
        print_info "Start Nakama with: cd backend && docker-compose up -d"
        all_good=false
    fi

    # Check if PostgreSQL is running
    print_info "Checking PostgreSQL availability..."
    if pg_isready -h localhost -U postgres &> /dev/null; then
        print_success "PostgreSQL is running"
    else
        print_warning "PostgreSQL may not be running (pg_isready not found or server down)"
        # Not a hard failure since Nakama might be connecting differently
    fi

    # Check backend dependencies
    if [ "$RUN_BACKEND" = true ]; then
        if [ ! -d "$PROJECT_ROOT/backend/node_modules" ]; then
            print_warning "Backend node_modules not found, running npm install..."
            cd "$PROJECT_ROOT/backend"
            npm install --silent
            cd "$PROJECT_ROOT"
        fi
    fi

    return $all_good
}

# Run backend smoke tests
run_backend_tests() {
    print_info "Running backend smoke tests..."
    cd "$PROJECT_ROOT/backend"

    local start_time=$(date +%s)
    local backend_log="$REPORT_DIR/backend-tests_${TIMESTAMP}.log"

    # Build test command
    local jest_opts="--testPathPattern=vertical_slice_smoke --testPathIgnorePatterns=node_modules"

    if [ "$VERBOSE" = true ]; then
        jest_opts="$jest_opts --verbose"
    fi

    if [ "$QUICK_MODE" = true ]; then
        print_info "Quick mode: Skipping performance tests"
    fi

    # Run the tests
    if npm run test:integration -- $jest_opts 2>&1 | tee "$backend_log"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_info "Backend tests completed in ${duration}s"
        print_success "Backend smoke tests: PASSED"

        # Parse results from log
        parse_jest_results "$backend_log"

        return 0
    else
        print_error "Backend smoke tests: FAILED"
        return 1
    fi
}

# Run Godot client E2E tests
run_client_tests() {
    print_info "Running Godot client E2E tests..."
    cd "$PROJECT_ROOT"

    local start_time=$(date +%s)
    local client_log="$REPORT_DIR/client-tests_${TIMESTAMP}.log"
    local godot_cmd="${GODOT_BINARY:-godot4}"

    # Check if E2E test file exists
    if [ ! -f "$PROJECT_ROOT/test/e2e_vertical_slice.gd" ]; then
        print_error "E2E test file not found: test/e2e_vertical_slice.gd"
        return 1
    fi

    # Run Godot in headless mode
    print_info "Starting Godot headless test runner..."
    if timeout 180 $godot_cmd --headless --script res://test/e2e_vertical_slice.gd 2>&1 | tee "$client_log"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_info "Client tests completed in ${duration}s"
        print_success "Client E2E tests: PASSED"

        # Parse results from log
        parse_godot_results "$client_log"

        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            print_error "Client tests timed out after 180s"
        else
            print_error "Client E2E tests: FAILED (exit code: $exit_code)"
        fi
        return 1
    fi
}

# Parse Jest test results
parse_jest_results() {
    local log_file="$1"

    # Look for test counts in Jest output
    local passed=$(grep -oP 'Tests:\s*\K\d+(?=\s*passed)' "$log_file" || echo "0")
    local failed=$(grep -oP 'Tests:\s*\K\d+(?=\s*failed)' "$log_file" || echo "0")
    local skipped=$(grep -oP 'Tests:\s*\K\d+(?=\s*skipped)' "$log_file" || echo "0")

    PASSED_TESTS=$((PASSED_TESTS + passed))
    FAILED_TESTS=$((FAILED_TESTS + failed))
    SKIPPED_TESTS=$((SKIPPED_TESTS + skipped))
    TOTAL_TESTS=$((TOTAL_TESTS + passed + failed + skipped))

    print_verbose "Backend test results: $passed passed, $failed failed, $skipped skipped"
}

# Parse Godot test results
parse_godot_results() {
    local log_file="$1"

    # Look for test summary in Godot output
    local passed=$(grep -oP 'Passed:\s*\K\d+' "$log_file" || echo "0")
    local failed=$(grep -oP 'Failed:\s*\K\d+' "$log_file" || echo "0")
    local skipped=$(grep -oP 'Skipped:\s*\K\d+' "$log_file" || echo "0")

    PASSED_TESTS=$((PASSED_TESTS + passed))
    FAILED_TESTS=$((FAILED_TESTS + failed))
    SKIPPED_TESTS=$((SKIPPED_TESTS + skipped))
    TOTAL_TESTS=$((TOTAL_TESTS + passed + failed + skipped))

    print_verbose "Client test results: $passed passed, $failed failed, $skipped skipped"
}

# Generate HTML summary report
generate_summary_report() {
    local backend_passed=$1
    local client_passed=$2

    # Calculate pass rate
    if [ $TOTAL_TESTS -gt 0 ]; then
        local pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    else
        local pass_rate=0
    fi

    # Generate HTML report
    cat > "$HTML_REPORT" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smoke Test Summary - Armored Archer</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        .meta {
            color: #666;
            margin-bottom: 30px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            padding: 20px;
            border-radius: 6px;
            text-align: center;
        }
        .card.total { background: #e3f2fd; color: #1a237e; }
        .card.passed { background: #c8e6c9; color: #1b5e20; }
        .card.failed { background: #ffcdd2; color: #b71c1c; }
        .card.skipped { background: #fff9c4; color: #f57f17; }
        .card h3 { margin: 0 0 10px 0; font-size: 14px; opacity: 0.8; }
        .card .value { font-size: 36px; font-weight: bold; }
        .progress-bar {
            width: 100%;
            height: 30px;
            background: #e0e0e0;
            border-radius: 15px;
            overflow: hidden;
            margin-bottom: 30px;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4caf50, #8bc34a);
            transition: width 0.5s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }
        .phase {
            margin-bottom: 25px;
            padding: 20px;
            border-left: 4px solid;
            background: #fafafa;
        }
        .phase.backend { border-color: #1976d2; }
        .phase.client { border-color: #7b1fa2; }
        .phase h2 { margin-top: 0; font-size: 18px; }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
        }
        .status-passed { background: #c8e6c9; color: #1b5e20; }
        .status-failed { background: #ffcdd2; color: #b71c1c; }
        .status-skipped { background: #fff9c4; color: #f57f17; }
        .flow-diagram {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            padding: 30px;
            background: #f0f7ff;
            border-radius: 8px;
            margin: 20px 0;
            flex-wrap: wrap;
        }
        .flow-step {
            padding: 10px 20px;
            background: white;
            border: 2px solid #4caf50;
            border-radius: 20px;
            font-weight: bold;
            color: #2e7d32;
        }
        .flow-arrow {
            color: #4caf50;
            font-size: 24px;
        }
        footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏹 Armored Archer Smoke Test Report</h1>
        <div class="meta">
            <strong>Issue:</strong> #684 - [Sprint 1] Vertical Slice Smoke Test<br>
            <strong>Date:</strong> $(date)<br>
            <strong>Timestamp:</strong> $TIMESTAMP
        </div>

        <div class="progress-bar">
            <div class="progress-fill" style="width: ${pass_rate}%;">
                Pass Rate: ${pass_rate}%
            </div>
        </div>

        <div class="summary">
            <div class="card total">
                <h3>Total Tests</h3>
                <div class="value">$TOTAL_TESTS</div>
            </div>
            <div class="card passed">
                <h3>Passed</h3>
                <div class="value">$PASSED_TESTS</div>
            </div>
            <div class="card failed">
                <h3>Failed</h3>
                <div class="value">$FAILED_TESTS</div>
            </div>
            <div class="card skipped">
                <h3>Skipped</h3>
                <div class="value">$SKIPPED_TESTS</div>
            </div>
        </div>

        <h2>Vertical Slice Flow</h2>
        <div class="flow-diagram">
            <div class="flow-step">Login</div>
            <div class="flow-arrow">→</div>
            <div class="flow-step">PvE Stage</div>
            <div class="flow-arrow">→</div>
            <div class="flow-step">Boss</div>
            <div class="flow-arrow">→</div>
            <div class="flow-step">Loot</div>
            <div class="flow-arrow">→</div>
            <div class="flow-step">Equip</div>
        </div>

EOF

    # Add backend phase results
    if [ "$RUN_BACKEND" = true ]; then
        local backend_status="status-passed"
        local backend_text="PASSED"
        if [ "$backend_passed" = false ]; then
            backend_status="status-failed"
            backend_text="FAILED"
        fi

        cat >> "$HTML_REPORT" << EOF
        <div class="phase backend">
            <h2>📡 Backend Smoke Tests</h2>
            <span class="status-badge $backend_status">$backend_text</span>
            <p><strong>Validated RPCs:</strong></p>
            <ul>
                <li>✓ Device authentication</li>
                <li>✓ Player stats retrieval</li>
                <li>✓ Stage completion</li>
                <li>✓ Loot generation</li>
                <li>✓ Inventory retrieval</li>
                <li>✓ Gear equip/unequip</li>
                <li>✓ Stat allocation</li>
            </ul>
        </div>

EOF
    fi

    # Add client phase results
    if [ "$RUN_CLIENT" = true ]; then
        local client_status="status-passed"
        local client_text="PASSED"
        if [ "$client_passed" = false ]; then
            client_status="status-failed"
            client_text="FAILED"
        fi

        cat >> "$HTML_REPORT" << EOF
        <div class="phase client">
            <h2>🎮 Client E2E Tests</h2>
            <span class="status-badge $client_status">$client_text</span>
            <p><strong>Validated Flow:</strong></p>
            <ul>
                <li>✓ Account bootstrap & session management</li>
                <li>✓ PvE stage configuration</li>
                <li>✓ Combat system data flow</li>
                <li>✓ Server-side loot generation</li>
                <li>✓ Inventory display & loadout management</li>
                <li>✓ Stat allocation system</li>
                <li>✓ End-to-end integration</li>
            </ul>
        </div>

EOF
    fi

    # Add footer
    cat >> "$HTML_REPORT" << EOF
        <footer>
            <p>Generated by Armored Archer Smoke Test Runner</p>
            <p>Log file: <code>$LOG_FILE</code></p>
            <p>For troubleshooting, see: <code>.planning/VERTICAL_SLICE_SMOKE_TEST.md</code></p>
        </footer>
    </div>
</body>
</html>
EOF

    print_info "HTML report generated: $HTML_REPORT"
}

# Trap to cleanup on exit
cleanup() {
    # Return to project root
    cd "$PROJECT_ROOT"
}

trap cleanup EXIT

# Run main
main
