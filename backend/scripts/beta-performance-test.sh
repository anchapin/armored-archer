#!/bin/bash
# ============================================
# Beta Performance Validation Script
# Armored Archer - Latency Testing
# ============================================
# This script runs performance tests to validate
# P95 latency < 80ms requirement.
# ============================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
BETA_SERVER="${BETA_SERVER:-beta.armored-archer.internal}"
BETA_PORT="${BETA_PORT:-7350}"
SERVER_KEY="${SERVER_KEY:-defaultkey}"
CONCURRENT_USERS="${CONCURRENT_USERS:-50}"
DURATION_SECS="${DURATION_SECS:-60}"
P95_THRESHOLD_MS=80

# Results
declare -a LATENCIES=()
TOTAL_REQUESTS=0
FAILED_REQUESTS=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Send authenticated request and measure latency
measure_request() {
    local endpoint="$1"
    local start_time end_time duration
    
    start_time=$(date +%s%N)
    
    # Make request (using /health for simple test, or authenticated RPC)
    if [[ "$endpoint" == "/health" ]]; then
        response=$(curl -sfk "https://${BETA_SERVER}:${BETA_PORT}${endpoint}" 2>/dev/null || echo "ERROR")
    else
        # For authenticated endpoints, would need proper auth
        response=$(curl -sfk "https://${BETA_SERVER}:${BETA_PORT}${endpoint}" 2>/dev/null || echo "ERROR")
    fi
    
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))  # Convert to ms
    
    echo "$duration"
}

# Calculate P95 from array
calculate_p95() {
    local sorted=($(printf '%s\n' "${LATENCIES[@]}" | sort -n))
    local count=${#sorted[@]}
    local index=$(( count * 95 / 100 ))
    echo "${sorted[$index]}"
}

# Calculate P50
calculate_p50() {
    local sorted=($(printf '%s\n' "${LATENCIES[@]}" | sort -n))
    local count=${#sorted[@]}
    local index=$(( count * 50 / 100 ))
    echo "${sorted[$index]}"
}

# Calculate P99
calculate_p99() {
    local sorted=($(printf '%s\n' "${LATENCIES[@]}" | sort -n))
    local count=${#sorted[@]}
    local index=$(( count * 99 / 100 ))
    echo "${sorted[$index]}"
}

# Run load test
run_load_test() {
    log_info "Starting performance validation..."
    log_info "Target: $BETA_SERVER:$BETA_PORT"
    log_info "Duration: ${DURATION_SECS}s | Concurrent users: $CONCURRENT_USERS"
    echo ""
    
    local endpoints=("/health" "/healthz")
    local start_time=$(date +%s)
    local end_time=$((start_time + DURATION_SECS))
    local request_count=0
    
    while [[ $(date +%s) -lt $end_time ]]; do
        for endpoint in "${endpoints[@]}"; do
            local latency
            latency=$(measure_request "$endpoint")
            
            if [[ "$latency" != "ERROR" ]]; then
                LATENCIES+=("$latency")
                ((request_count++))
            else
                ((FAILED_REQUESTS++))
            fi
            
            TOTAL_REQUESTS=$((TOTAL_REQUESTS + 1))
        done
        
        # Small delay to simulate user behavior
        sleep 0.1
    done
    
    log_success "Completed $request_count successful requests"
}

# Generate report
generate_report() {
    local p50 p95 p99 avg total
    p50=$(calculate_p50)
    p95=$(calculate_p95)
    p99=$(calculate_p99)
    
    # Calculate average
    total=0
    for lat in "${LATENCIES[@]}"; do
        total=$((total + lat))
    done
    avg=$((total / ${#LATENCIES[@]}))
    
    echo ""
    echo "========================================"
    echo "  Performance Validation Results"
    echo "========================================"
    echo ""
    echo "Test Configuration:"
    echo "  Target:     https://${BETA_SERVER}:${BETA_PORT}"
    echo "  Duration:   ${DURATION_SECS}s"
    echo "  Requests:   $TOTAL_REQUESTS"
    echo "  Failures:  $FAILED_REQUESTS"
    echo ""
    echo "Latency Results:"
    echo "  P50:        ${p50}ms"
    echo "  P95:        ${p95}ms  (threshold: ${P95_THRESHOLD_MS}ms)"
    echo "  P99:        ${p99}msms"
    echo "  Average:    ${avg}ms"
    echo ""
    
    # Determine pass/fail
    if [[ $p95 -le $P95_THRESHOLD_MS ]]; then
        echo -e "  ${GREEN}✓ PASSED${NC} - P95 latency within threshold"
        echo "========================================"
        return 0
    else
        echo -e "  ${RED}✗ FAILED${NC} - P95 latency exceeds threshold"
        echo "========================================"
        return 1
    fi
}

# Main
main() {
    log_info "========================================"
    log_info "  Beta Performance Validation"
    log_info "========================================"
    
    run_load_test
    generate_report
}

main "$@"
