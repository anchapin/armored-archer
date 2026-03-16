#!/bin/bash

# Analytics Event Validation Script for Armored Archer Alpha
# This script validates that analytics events are properly structured and firing.

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
PROJECT_DIR="$(dirname "$BACKEND_DIR")"
VERBOSE=false
CI_MODE=false
EVENT_FILTER=""
LOG_FILE=""
ERROR_COUNT=0
WARNING_COUNT=0

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --ci)
            CI_MODE=true
            shift
            ;;
        -e|--event)
            EVENT_FILTER="$2"
            shift 2
            ;;
        -o|--output)
            LOG_FILE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose      Enable verbose output"
            echo "  --ci               CI mode (exit with error on any issue)"
            echo "  -e, --event NAME   Filter by specific event name"
            echo "  -o, --output FILE  Write output to log file"
            echo "  -h, --help         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                              # Validate all events"
            echo "  $0 --verbose                    # Verbose output"
            echo "  $0 --event alpha_session_start  # Validate specific event"
            echo "  $0 --ci                         # CI mode"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNING_COUNT++)) || true
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((ERROR_COUNT++)) || true
}

log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}[DEBUG]${NC} $1"
    fi
}

# Header
echo "========================================"
echo "  Armored Archer Analytics Validator"
echo "========================================"
echo ""
echo "Mode: $([ "$CI_MODE" = true ] && echo "CI" || echo "Development")"
echo "Verbose: $VERBOSE"
[ -n "$EVENT_FILTER" ] && echo "Event Filter: $EVENT_FILTER"
echo ""

# Function to check if Go file compiles
check_go_compilation() {
    log_info "Checking Go compilation..."
    
    cd "$BACKEND_DIR"
    
    if go build ./internal/analytics/... 2>/dev/null; then
        log_success "Analytics package compiles successfully"
        return 0
    else
        log_error "Analytics package failed to compile"
        return 1
    fi
}

# Function to validate event structure in Go code
validate_event_structure() {
    log_info "Validating event structure in Go code..."
    
    local analytics_file="$BACKEND_DIR/internal/analytics/alpha_events.go"
    
    if [ ! -f "$analytics_file" ]; then
        log_error "Alpha events file not found: $analytics_file"
        return 1
    fi
    
    # Check for required event types
    local required_events=(
        "EventAlphaRegistration"
        "EventAlphaSessionStart"
        "EventAlphaSessionEnd"
        "EventAlphaCombatMatchStarted"
        "EventAlphaCombatMatchCompleted"
        "EventAlphaGearEquipped"
        "EventAlphaMatchmakingQueueJoined"
        "EventAlphaStoreOpened"
        "EventAlphaPlayerLevelUp"
        "EventAlphaRPCError"
    )
    
    local missing_events=()
    
    for event in "${required_events[@]}"; do
        if ! grep -q "$event" "$analytics_file"; then
            missing_events+=("$event")
        fi
    done
    
    if [ ${#missing_events[@]} -eq 0 ]; then
        log_success "All required event types defined"
    else
        log_error "Missing event types: ${missing_events[*]}"
        return 1
    fi
    
    # Check for AlphaAnalyticsManager
    if grep -q "AlphaAnalyticsManager" "$analytics_file"; then
        log_success "AlphaAnalyticsManager struct defined"
    else
        log_error "AlphaAnalyticsManager struct not found"
        return 1
    fi
    
    # Check for LogAlphaEvent method
    if grep -q "LogAlphaEvent" "$analytics_file"; then
        log_success "LogAlphaEvent method defined"
    else
        log_error "LogAlphaEvent method not found"
        return 1
    fi
    
    return 0
}

# Function to validate Prometheus metrics
validate_prometheus_metrics() {
    log_info "Validating Prometheus metrics..."
    
    local metrics_file="$BACKEND_DIR/metrics/prometheus_metrics.go"
    
    if [ ! -f "$metrics_file" ]; then
        log_warning "Prometheus metrics file not found (optional)"
        return 0
    fi
    
    # Check for alpha-specific metrics
    local alpha_metrics=(
        "armored_archer_alpha_registrations_total"
        "armored_archer_alpha_sessions_active"
        "armored_archer_alpha_combat_matches_total"
    )
    
    local found_metrics=0
    
    for metric in "${alpha_metrics[@]}"; do
        if grep -q "$metric" "$metrics_file"; then
            log_verbose "Found metric: $metric"
            ((found_metrics++)) || true
        fi
    done
    
    if [ $found_metrics -gt 0 ]; then
        log_success "Found $found_metrics alpha metrics in prometheus_metrics.go"
    else
        log_warning "No alpha-specific metrics found in prometheus_metrics.go (may be defined elsewhere)"
    fi
    
    return 0
}

# Function to validate Grafana dashboard
validate_grafana_dashboard() {
    log_info "Validating Grafana dashboard..."
    
    local dashboard_file="$BACKEND_DIR/grafana/dashboards/05-alpha-analytics.json"
    
    if [ ! -f "$dashboard_file" ]; then
        log_error "Alpha analytics dashboard not found: $dashboard_file"
        return 1
    fi
    
    # Validate JSON structure
    if command -v python3 &> /dev/null; then
        if python3 -c "import json; json.load(open('$dashboard_file'))" 2>/dev/null; then
            log_success "Dashboard JSON is valid"
        else
            log_error "Dashboard JSON is invalid"
            return 1
        fi
    else
        log_warning "Python3 not available, skipping JSON validation"
    fi
    
    # Check for required panels
    local required_panels=(
        "Alpha Overview"
        "Registration Trends"
        "Combat Feature Usage"
        "Store"
        "Error Tracking"
        "Conversion Funnel"
    )
    
    local missing_panels=()
    
    for panel in "${required_panels[@]}"; do
        if ! grep -q "$panel" "$dashboard_file"; then
            missing_panels+=("$panel")
        fi
    done
    
    if [ ${#missing_panels[@]} -eq 0 ]; then
        log_success "All required dashboard sections present"
    else
        log_warning "Missing dashboard sections: ${missing_panels[*]}"
    fi
    
    # Check for Prometheus datasource
    if grep -q '"type": "prometheus"' "$dashboard_file"; then
        log_success "Prometheus datasource configured"
    else
        log_error "Prometheus datasource not found in dashboard"
        return 1
    fi
    
    return 0
}

# Function to validate event naming conventions
validate_event_naming() {
    log_info "Validating event naming conventions..."
    
    local analytics_file="$BACKEND_DIR/internal/analytics/alpha_events.go"
    
    # Check that all alpha events start with EventAlpha
    local non_conforming=$(grep -E "^\s*Event[A-Z][a-zA-Z]+\s+AlphaEventType\s*=" "$analytics_file" | grep -v "EventAlpha" || true)
    
    if [ -z "$non_conforming" ]; then
        log_success "All alpha events follow naming convention (EventAlpha*)"
    else
        log_warning "Non-conforming event names found: $non_conforming"
    fi
    
    # Check property naming (should be camelCase in struct, snake_case in JSON)
    if grep -q 'json:"[a-z_]*"' "$analytics_file"; then
        log_success "JSON property naming follows snake_case convention"
    else
        log_warning "Could not validate JSON property naming"
    fi
    
    return 0
}

# Function to check for required event properties
validate_event_properties() {
    log_info "Validating event properties..."
    
    local analytics_file="$BACKEND_DIR/internal/analytics/alpha_events.go"
    
    # Check for AlphaEventProperties struct
    if grep -q "type AlphaEventProperties struct" "$analytics_file"; then
        log_success "AlphaEventProperties struct defined"
    else
        log_error "AlphaEventProperties struct not found"
        return 1
    fi
    
    # Check for required properties
    local required_properties=(
        "UserID"
        "SessionID"
        "Timestamp"
        "Platform"
        "EventName"
    )
    
    local missing_props=()
    
    for prop in "${required_properties[@]}"; do
        if ! grep -q "$prop" "$analytics_file"; then
            missing_props+=("$prop")
        fi
    done
    
    if [ ${#missing_props[@]} -eq 0 ]; then
        log_success "Required event properties defined"
    else
        log_error "Missing properties: ${missing_props[*]}"
        return 1
    fi
    
    return 0
}

# Function to run Go tests
run_go_tests() {
    log_info "Running Go tests..."
    
    cd "$BACKEND_DIR"
    
    if go test ./internal/analytics/... -v 2>&1 | tee /tmp/analytics_test_output.txt; then
        log_success "Analytics tests passed"
        return 0
    else
        log_error "Analytics tests failed"
        if [ "$CI_MODE" = true ]; then
            return 1
        fi
        return 0
    fi
}

# Function to check for privacy compliance
validate_privacy_compliance() {
    log_info "Checking privacy compliance..."
    
    local analytics_file="$BACKEND_DIR/internal/analytics/alpha_events.go"
    
    # Check that we're not collecting sensitive data
    local sensitive_patterns=(
        "password"
        "credit_card"
        "ssn"
        "social_security"
        "bank_account"
        "email.*property"
    )
    
    local found_sensitive=0
    
    for pattern in "${sensitive_patterns[@]}"; do
        if grep -qi "$pattern" "$analytics_file"; then
            log_warning "Potentially sensitive data pattern found: $pattern"
            ((found_sensitive++)) || true
        fi
    done
    
    if [ $found_sensitive -eq 0 ]; then
        log_success "No sensitive data patterns detected"
    else
        log_warning "Found $found_sensitive potential sensitive data patterns - review required"
    fi
    
    return 0
}

# Function to generate validation report
generate_report() {
    echo ""
    echo "========================================"
    echo "  Validation Report"
    echo "========================================"
    echo ""
    echo "Errors:   $ERROR_COUNT"
    echo "Warnings: $WARNING_COUNT"
    echo ""
    
    if [ $ERROR_COUNT -eq 0 ] && [ $WARNING_COUNT -eq 0 ]; then
        echo -e "${GREEN}✓ All validations passed!${NC}"
        return 0
    elif [ $ERROR_COUNT -eq 0 ]; then
        echo -e "${YELLOW}✓ Validations passed with warnings${NC}"
        return 0
    else
        echo -e "${RED}✗ Validations failed with $ERROR_COUNT error(s)${NC}"
        return 1
    fi
}

# Main validation flow
main() {
    local start_time=$(date +%s)
    
    # Run validations
    check_go_compilation || true
    validate_event_structure || true
    validate_event_properties || true
    validate_event_naming || true
    validate_prometheus_metrics || true
    validate_grafana_dashboard || true
    validate_privacy_compliance || true
    
    # Run tests (optional, may not exist yet)
    if [ -f "$BACKEND_DIR/internal/analytics/alpha_events_test.go" ]; then
        run_go_tests || true
    else
        log_verbose "No test file found, skipping tests"
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    log_info "Validation completed in ${duration}s"
    
    # Generate report
    generate_report
    local exit_code=$?
    
    # Write to log file if specified
    if [ -n "$LOG_FILE" ]; then
        echo "Analytics validation completed at $(date)" > "$LOG_FILE"
        echo "Errors: $ERROR_COUNT, Warnings: $WARNING_COUNT" >> "$LOG_FILE"
    fi
    
    # Exit with error in CI mode if there are errors
    if [ "$CI_MODE" = true ] && [ $ERROR_COUNT -gt 0 ]; then
        exit 1
    fi
    
    exit $exit_code
}

# Run main function
main
