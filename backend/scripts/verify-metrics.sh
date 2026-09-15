#!/bin/bash
# verify-metrics.sh - Metrics Verification Script for Armored Archer Backend
# 
# This script verifies that Prometheus metrics are properly configured and exposed.
# It checks:
#   1. Prometheus configuration validity
#   2. Metrics endpoint availability
#   3. Expected metrics presence
#   4. Metric format validation
#   5. Alert rules validation
#
# Usage:
#   ./verify-metrics.sh [options]
#
# Options:
#   -v, --verbose     Enable verbose output
#   -q, --quiet       Quiet mode (only errors)
#   -h, --help        Show this help message
#   -e, --env ENV     Environment (development, alpha, production)
#   -t, --timeout N   Request timeout in seconds (default: 10)
#
# Exit Codes:
#   0 - All checks passed
#   1 - Configuration errors
#   2 - Metrics endpoint errors
#   3 - Missing expected metrics
#   4 - Alert rules errors

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$BACKEND_DIR")"

# Default configuration
VERBOSE=false
QUIET=false
ENVIRONMENT="development"
TIMEOUT=10
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
NAKAMA_URL="${NAKAMA_URL:-http://localhost:7350}"
# Runtime HTTP key — must match runtime.http.key and the http_key params in
# backend/prometheus.yml (default "defaulthttpkey")
NAKAMA_HTTP_KEY="${NAKAMA_HTTP_KEY:-defaulthttpkey}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARN=0

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    if [ "$QUIET" = false ]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

log_success() {
    if [ "$QUIET" = false ]; then
        echo -e "${GREEN}[PASS]${NC} $1"
    fi
    ((CHECKS_PASSED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((CHECKS_WARN++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1" >&2
    ((CHECKS_FAILED++))
}

log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "[DEBUG] $1"
    fi
}

show_help() {
    cat << EOF
Metrics Verification Script for Armored Archer Backend

Usage: $(basename "$0") [options]

Options:
  -v, --verbose     Enable verbose output
  -q, --quiet       Quiet mode (only errors)
  -h, --help        Show this help message
  -e, --env ENV     Environment (development, alpha, production)
  -t, --timeout N   Request timeout in seconds (default: 10)

Examples:
  $(basename "$0")                          # Run with defaults
  $(basename "$0") -v                       # Verbose output
  $(basename "$0") -e alpha                 # Check alpha environment
  $(basename "$0") -t 30                    # 30 second timeout

Exit Codes:
  0 - All checks passed
  1 - Configuration errors
  2 - Metrics endpoint errors
  3 - Missing expected metrics
  4 - Alert rules errors
EOF
}

# ============================================================================
# Check Functions
# ============================================================================

check_prometheus_config() {
    log_info "Checking Prometheus configuration..."
    
    local config_file="$BACKEND_DIR/config/prometheus.yml"
    local alt_config_file="$BACKEND_DIR/prometheus.yml"
    
    if [ -f "$config_file" ]; then
        log_verbose "Found config at: $config_file"
        CONFIG_FILE="$config_file"
    elif [ -f "$alt_config_file" ]; then
        log_verbose "Found config at: $alt_config_file"
        CONFIG_FILE="$alt_config_file"
    else
        log_error "Prometheus configuration file not found"
        return 1
    fi
    
    # Validate YAML syntax (if yq or python available)
    if command -v yq &> /dev/null; then
        if yq eval '.' "$CONFIG_FILE" > /dev/null 2>&1; then
            log_success "Prometheus configuration YAML is valid"
        else
            log_error "Prometheus configuration YAML is invalid"
            return 1
        fi
    elif command -v python3 &> /dev/null; then
        if python3 -c "import yaml; yaml.safe_load(open('$CONFIG_FILE'))" 2>/dev/null; then
            log_success "Prometheus configuration YAML is valid"
        else
            log_error "Prometheus configuration YAML is invalid"
            return 1
        fi
    else
        log_warning "Cannot validate YAML syntax (yq or python3 not available)"
    fi
    
    # Check for required sections
    if grep -q "scrape_configs:" "$CONFIG_FILE"; then
        log_success "Configuration contains scrape_configs section"
    else
        log_error "Configuration missing scrape_configs section"
        return 1
    fi
    
    # Check for armored_archer jobs
    if grep -q "armored_archer" "$CONFIG_FILE"; then
        log_success "Configuration contains Armored Archer scrape jobs"
    else
        log_warning "Configuration missing Armored Archer scrape jobs"
    fi
    
    return 0
}

check_alerts_config() {
    log_info "Checking alert rules configuration..."
    
    local alerts_file="$BACKEND_DIR/alerts.yml"
    
    if [ ! -f "$alerts_file" ]; then
        log_warning "Alerts configuration not found at $alerts_file"
        return 0
    fi
    
    # Validate YAML syntax
    if command -v yq &> /dev/null; then
        if yq eval '.' "$alerts_file" > /dev/null 2>&1; then
            log_success "Alert rules YAML is valid"
        else
            log_error "Alert rules YAML is invalid"
            return 1
        fi
    elif command -v python3 &> /dev/null; then
        if python3 -c "import yaml; yaml.safe_load(open('$alerts_file'))" 2>/dev/null; then
            log_success "Alert rules YAML is valid"
        else
            log_error "Alert rules YAML is invalid"
            return 1
        fi
    else
        log_verbose "Skipping YAML validation (yq/python3 not available)"
    fi
    
    # Check for required alert groups
    if grep -q "groups:" "$alerts_file"; then
        log_success "Alert rules contains groups section"
    else
        log_error "Alert rules missing groups section"
        return 1
    fi
    
    # Count alert rules
    local alert_count
    alert_count=$(grep -c "- alert:" "$alerts_file" || echo "0")
    log_verbose "Found $alert_count alert rules"
    
    if [ "$alert_count" -gt 0 ]; then
        log_success "Found $alert_count alert rules"
    else
        log_warning "No alert rules found"
    fi
    
    return 0
}

check_prometheus_server() {
    log_info "Checking Prometheus server availability..."
    
    if ! curl -s --connect-timeout "$TIMEOUT" "$PROMETHEUS_URL/-/healthy" > /dev/null 2>&1; then
        log_warning "Prometheus server not available at $PROMETHEUS_URL"
        log_verbose "Skipping Prometheus server checks"
        return 0
    fi
    
    log_success "Prometheus server is healthy"
    
    # Check Prometheus targets
    log_verbose "Checking scrape targets..."
    local targets_response
    if targets_response=$(curl -s --connect-timeout "$TIMEOUT" "$PROMETHEUS_URL/api/v1/targets" 2>/dev/null); then
        local active_targets
        active_targets=$(echo "$targets_response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len([t for t in data['data']['activeTargets'] if t['health']=='up']))" 2>/dev/null || echo "0")
        log_success "Prometheus has $active_targets healthy targets"
    else
        log_warning "Could not query Prometheus targets API"
    fi
    
    return 0
}

check_metrics_endpoint() {
    log_info "Checking metrics endpoints..."
    
    # Check Nakama metrics endpoint
    log_verbose "Checking Nakama metrics endpoint..."
    if curl -s --connect-timeout "$TIMEOUT" "$NAKAMA_URL/metrics" > /dev/null 2>&1; then
        log_success "Nakama metrics endpoint is accessible"
        
        # Check for Go runtime metrics
        local nakama_metrics
        nakama_metrics=$(curl -s --connect-timeout "$TIMEOUT" "$NAKAMA_URL/metrics" 2>/dev/null)
        
        if echo "$nakama_metrics" | grep -q "go_goroutines"; then
            log_success "Nakama exposes Go runtime metrics"
        else
            log_warning "Nakama metrics missing Go runtime metrics"
        fi
    else
        log_warning "Nakama metrics endpoint not accessible at $NAKAMA_URL/metrics"
    fi
    
    # Check custom RPC metrics endpoints. These are the app-metric scrape
    # RPCs registered in backend/src/modules/metrics.ts and scraped by
    # backend/prometheus.yml (issue #1074): each requires ?unwrap plus the
    # runtime HTTP key, exactly like the Prometheus scrape params.
    local rpc_endpoints=(
        "/v2/rpc/armored_archer/prometheus_metrics"
        "/v2/rpc/armored_archer/prometheus_deployment"
        "/v2/rpc/armored_archer/prometheus_health"
        "/v2/rpc/armored_archer/prometheus_rollout"
    )
    
    for endpoint in "${rpc_endpoints[@]}"; do
        log_verbose "Checking endpoint: $endpoint"
        if curl -sf --connect-timeout "$TIMEOUT" "${NAKAMA_URL}${endpoint}?unwrap=&http_key=${NAKAMA_HTTP_KEY}" > /dev/null 2>&1; then
            log_success "Endpoint accessible: $endpoint"
        else
            log_warning "Endpoint not accessible: $endpoint"
        fi
    done
    
    return 0
}

check_expected_metrics() {
    log_info "Checking for expected metrics..."
    
    # Define expected metrics
    local expected_metrics=(
        "armored_archer_rpc_requests_total"
        "armored_archer_rpc_errors_total"
        "armored_archer_rpc_request_duration_seconds"
        "armored_archer_active_players"
        "armored_archer_matches_created_total"
        "armored_archer_matchmaking_queue_size"
        "armored_archer_database_query_duration_seconds"
        "armored_archer_cache_hits_total"
        "armored_archer_cache_misses_total"
        "armored_archer_memory_usage_bytes"
        "armored_archer_cpu_usage_percent"
        "armored_archer_goroutine_count"
        "armored_archer_request_queue_depth"
        "armored_archer_purchases_total"
        "armored_archer_revenue_cents_total"
        "armored_archer_gear_generated_total"
        "armored_archer_combat_actions_total"
        "armored_archer_xp_gained_total"
        "armored_archer_level_ups_total"
        "armored_archer_error_rate_percent"
    )
    
    local found_count=0
    local missing_metrics=()
    
    # Try to query Prometheus for each metric
    for metric in "${expected_metrics[@]}"; do
        log_verbose "Checking metric: $metric"
        
        # Query Prometheus API
        local query_result
        if query_result=$(curl -s --connect-timeout "$TIMEOUT" \
            "$PROMETHEUS_URL/api/v1/query?query=$metric" 2>/dev/null); then
            
            local status
            status=$(echo "$query_result" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "error")
            
            if [ "$status" = "success" ]; then
                log_verbose "  Metric found: $metric"
                ((found_count++))
            else
                missing_metrics+=("$metric")
            fi
        else
            missing_metrics+=("$metric")
        fi
    done
    
    if [ ${#expected_metrics[@]} -gt 0 ]; then
        local percentage=$((found_count * 100 / ${#expected_metrics[@]}))
        log_info "Found $found_count/${#expected_metrics[@]} expected metrics ($percentage%)"
        
        if [ $percentage -ge 80 ]; then
            log_success "Sufficient metrics coverage ($percentage%)"
        elif [ $percentage -ge 50 ]; then
            log_warning "Partial metrics coverage ($percentage%)"
        else
            log_error "Low metrics coverage ($percentage%)"
        fi
    fi
    
    if [ ${#missing_metrics[@]} -gt 0 ] && [ "$VERBOSE" = true ]; then
        log_verbose "Missing metrics:"
        for metric in "${missing_metrics[@]}"; do
            log_verbose "  - $metric"
        done
    fi
    
    return 0
}

check_go_metrics_module() {
    log_info "Checking Go metrics module..."
    
    local metrics_file="$BACKEND_DIR/metrics/prometheus_metrics.go"
    
    if [ ! -f "$metrics_file" ]; then
        log_warning "Go metrics module not found at $metrics_file"
        return 0
    fi
    
    log_success "Go metrics module found"
    
    # Check for metric definitions
    local metric_count
    metric_count=$(grep -c "prometheus.New" "$metrics_file" || echo "0")
    log_verbose "Found $metric_count Prometheus metric definitions"
    
    if [ "$metric_count" -ge 10 ]; then
        log_success "Sufficient metric definitions ($metric_count >= 10)"
    else
        log_warning "Limited metric definitions ($metric_count < 10)"
    fi
    
    # Check for required metric types
    local has_counter has_gauge has_histogram
    has_counter=$(grep -c "CounterVec" "$metrics_file" || echo "0")
    has_gauge=$(grep -c "GaugeVec" "$metrics_file" || echo "0")
    has_histogram=$(grep -c "HistogramVec" "$metrics_file" || echo "0")
    
    log_verbose "Metric types: Counter=$has_counter, Gauge=$has_gauge, Histogram=$has_histogram"
    
    if [ "$has_counter" -gt 0 ] && [ "$has_gauge" -gt 0 ] && [ "$has_histogram" -gt 0 ]; then
        log_success "All metric types present (Counter, Gauge, Histogram)"
    else
        log_warning "Missing metric types"
    fi
    
    return 0
}

check_docker_compose() {
    log_info "Checking Docker Compose configuration..."
    
    local compose_files=(
        "$BACKEND_DIR/docker-compose.yml"
        "$BACKEND_DIR/docker-compose.alpha.yml"
    )
    
    local found_compose=false
    
    for compose_file in "${compose_files[@]}"; do
        if [ -f "$compose_file" ]; then
            log_verbose "Found Docker Compose file: $compose_file"
            found_compose=true
            
            # Check for Prometheus service
            if grep -q "prometheus:" "$compose_file"; then
                log_success "Prometheus service defined in $(basename "$compose_file")"
            else
                log_warning "Prometheus service not found in $(basename "$compose_file")"
            fi
            
            # Check for Grafana service
            if grep -q "grafana:" "$compose_file"; then
                log_success "Grafana service defined in $(basename "$compose_file")"
            else
                log_warning "Grafana service not found in $(basename "$compose_file")"
            fi
            
            # Check for node_exporter
            if grep -q "node_exporter:" "$compose_file"; then
                log_success "Node Exporter service defined in $(basename "$compose_file")"
            else
                log_verbose "Node Exporter not found in $(basename "$compose_file")"
            fi
        fi
    done
    
    if [ "$found_compose" = false ]; then
        log_warning "No Docker Compose files found"
    fi
    
    return 0
}

generate_report() {
    echo ""
    echo "============================================"
    echo "         METRICS VERIFICATION REPORT        "
    echo "============================================"
    echo ""
    echo "Environment: $ENVIRONMENT"
    echo "Timestamp:   $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo ""
    echo "Results:"
    echo "  ${GREEN}Passed:${NC}   $CHECKS_PASSED"
    echo "  ${RED}Failed:${NC}   $CHECKS_FAILED"
    echo "  ${YELLOW}Warnings:${NC} $CHECKS_WARN"
    echo ""
    
    local total=$((CHECKS_PASSED + CHECKS_FAILED))
    if [ $total -gt 0 ]; then
        local pass_rate=$((CHECKS_PASSED * 100 / total))
        echo "Pass Rate:   $pass_rate%"
    fi
    
    echo ""
    echo "============================================"
    
    if [ $CHECKS_FAILED -gt 0 ]; then
        echo -e "${RED}VERIFICATION FAILED${NC}"
        return 1
    elif [ $CHECKS_WARN -gt 0 ]; then
        echo -e "${YELLOW}VERIFICATION PASSED WITH WARNINGS${NC}"
        return 0
    else
        echo -e "${GREEN}VERIFICATION PASSED${NC}"
        return 0
    fi
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -q|--quiet)
                QUIET=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -e|--env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    echo "============================================"
    echo "  Armored Archer Metrics Verification      "
    echo "============================================"
    echo ""
    log_info "Environment: $ENVIRONMENT"
    log_info "Timeout: ${TIMEOUT}s"
    log_info "Prometheus URL: $PROMETHEUS_URL"
    log_info "Nakama URL: $NAKAMA_URL"
    echo ""
    
    # Run checks
    check_prometheus_config || true
    check_alerts_config || true
    check_docker_compose || true
    check_go_metrics_module || true
    check_prometheus_server || true
    check_metrics_endpoint || true
    check_expected_metrics || true
    
    # Generate report
    generate_report
    exit_code=$?
    
    exit $exit_code
}

# Run main function
main "$@"
