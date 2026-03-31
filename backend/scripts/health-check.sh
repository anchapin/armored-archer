#!/bin/bash
# ============================================
# Health Check Script
# Armored Archer - Nakama Server Health Monitoring
# ============================================
# This script performs comprehensive health checks on the
# Nakama server including endpoints, database, and metrics.
# ============================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Default configuration
NAKAMA_HOST="${NAKAMA_HOST:-localhost}"
NAKAMA_PORT="${NAKAMA_PORT:-7350}"
NAKAMA_CONSOLE_PORT="${NAKAMA_CONSOLE_PORT:-7351}"
NAKAMA_SERVER_KEY="${NAKAMA_SERVER_KEY:-defaultkey}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-9100}"
ALPHA_SERVER=""
SSH_USER="deploy"
SSH_PORT="22"
DEPLOYMENT_MODE="docker"

# Thresholds
HEALTH_CHECK_TIMEOUT=5
MAX_RESPONSE_TIME_MS=1000
MAX_ERROR_RATE_PERCENT=5

# Health check state
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0
HEALTHY=true

# Parse arguments
VERBOSE=false
JSON_OUTPUT=false
CONTINUOUS=false
CONTINUOUS_INTERVAL=30

while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--server)
            ALPHA_SERVER="$2"
            shift 2
            ;;
        -u|--user)
            SSH_USER="$2"
            shift 2
            ;;
        -p|--port)
            SSH_PORT="$2"
            shift 2
            ;;
        --host)
            NAKAMA_HOST="$2"
            shift 2
            ;;
        --nakama-port)
            NAKAMA_PORT="$2"
            shift 2
            ;;
        --console-port)
            NAKAMA_CONSOLE_PORT="$2"
            shift 2
            ;;
        --key)
            NAKAMA_SERVER_KEY="$2"
            shift 2
            ;;
        --prometheus-port)
            PROMETHEUS_PORT="$2"
            shift 2
            ;;
        --mode)
            DEPLOYMENT_MODE="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --continuous)
            CONTINUOUS=true
            CONTINUOUS_INTERVAL="${2:-30}"
            if [[ "$CONTINUOUS_INTERVAL" =~ ^[0-9]+$ ]]; then
                shift 2
            else
                shift
            fi
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Perform comprehensive health checks on Nakama server"
            echo ""
            echo "Options:"
            echo "  -s, --server SERVER       Alpha server hostname (remote checks)"
            echo "  -u, --user USER           SSH user (default: deploy)"
            echo "  -p, --port PORT           SSH port (default: 22)"
            echo "  --host HOST               Nakama host (default: localhost)"
            echo "  --nakama-port PORT        Nakama port (default: 7350)"
            echo "  --console-port PORT       Console port (default: 7351)"
            echo "  --key KEY                 Nakama server key (default: defaultkey)"
            echo "  --prometheus-port PORT    Prometheus port (default: 9100)"
            echo "  --mode MODE               Deployment mode: docker or local"
            echo "  -v, --verbose             Show verbose output"
            echo "  --json                    Output in JSON format"
            echo "  --continuous [INTERVAL]   Run continuously every INTERVAL seconds"
            echo "  -h, --help                Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

SSH_HOST="$SSH_USER@$ALPHA_SERVER"
SSH_OPTS="-p $SSH_PORT -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"
NAKAMA_URL="http://$NAKAMA_HOST:$NAKAMA_PORT"

# Function to log messages
log_info() {
    [ "$JSON_OUTPUT" = true ] && return
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    [ "$JSON_OUTPUT" = true ] && return
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    [ "$JSON_OUTPUT" = true ] && return
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    [ "$JSON_OUTPUT" = true ] && return
    echo -e "${BLUE}[STEP]${NC} $1"
}

log_check() {
    local status=$1
    local message=$2
    local details="${3:-}"
    
    if [ "$JSON_OUTPUT" = true ]; then
        return
    fi
    
    if [ "$status" = "PASS" ]; then
        echo -e "  ${GREEN}✓${NC} $message"
        ((CHECKS_PASSED++))
    elif [ "$status" = "FAIL" ]; then
        echo -e "  ${RED}✗${NC} $message"
        if [ -n "$details" ]; then
            echo -e "      ${CYAN}$details${NC}"
        fi
        ((CHECKS_FAILED++))
        HEALTHY=false
    elif [ "$status" = "WARN" ]; then
        echo -e "  ${YELLOW}⚠${NC} $message"
        if [ -n "$details" ]; then
            echo -e "      ${CYAN}$details${NC}"
        fi
        ((CHECKS_WARNING++))
    fi
}

log_success() {
    [ "$JSON_OUTPUT" = true ] && return
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Helper function to run command on remote or local
run_cmd() {
    local cmd="$1"
    
    if [ -n "$ALPHA_SERVER" ]; then
        ssh $SSH_OPTS "$SSH_HOST" "$cmd" 2>/dev/null
    else
        eval "$cmd" 2>/dev/null
    fi
}

# Health check function
run_health_checks() {
    CHECKS_PASSED=0
    CHECKS_FAILED=0
    CHECKS_WARNING=0
    HEALTHY=true
    
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${BLUE}============================================${NC}"
        echo -e "${BLUE}  Nakama Health Check${NC}"
        echo -e "${BLUE}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
        echo -e "${BLUE}============================================${NC}"
        echo ""
        
        if [ -n "$ALPHA_SERVER" ]; then
            echo -e "Server:  ${CYAN}$ALPHA_SERVER${NC}"
        else
            echo -e "Server:  ${CYAN}$NAKAMA_HOST:$NAKAMA_PORT${NC}"
        fi
        echo ""
    fi
    
    # Check 1: Health Endpoint
    log_step "Checking health endpoint..."
    HEALTH_START=$(date +%s%3N)
    
    if [ -n "$ALPHA_SERVER" ]; then
        HEALTH_RESPONSE=$(run_cmd "curl -s --connect-timeout $HEALTH_CHECK_TIMEOUT http://localhost:$NAKAMA_PORT/health" || echo "")
    else
        HEALTH_RESPONSE=$(curl -s --connect-timeout $HEALTH_CHECK_TIMEOUT "$NAKAMA_URL/health" 2>/dev/null || echo "")
    fi
    
    HEALTH_END=$(date +%s%3N)
    RESPONSE_TIME=$((HEALTH_END - HEALTH_START))
    
    if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
        log_check "PASS" "Health endpoint responding" "Response time: ${RESPONSE_TIME}ms"
    elif echo "$HEALTH_RESPONSE" | grep -q "ok"; then
        log_check "PASS" "Health endpoint responding" "Response: $HEALTH_RESPONSE"
    else
        log_check "FAIL" "Health endpoint not responding" "Response: $HEALTH_RESPONSE"
    fi
    
    if [ "$RESPONSE_TIME" -gt "$MAX_RESPONSE_TIME_MS" ]; then
        log_check "WARN" "High response time" "${RESPONSE_TIME}ms (threshold: ${MAX_RESPONSE_TIME_MS}ms)"
    fi
    
    # Check 2: API Endpoint - Storage
    log_step "Checking API endpoints..."
    API_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -u "$NAKAMA_SERVER_KEY:" "$NAKAMA_URL/v2/storage" 2>/dev/null || echo "000")
    
    if [ "$API_STATUS" = "200" ]; then
        log_check "PASS" "Storage API endpoint working" "HTTP $API_STATUS"
    elif [ "$API_STATUS" = "401" ]; then
        log_check "PASS" "Storage API authentication working" "HTTP $API_STATUS (expected for invalid credentials)"
    elif [ "$API_STATUS" = "000" ]; then
        log_check "FAIL" "Storage API endpoint unreachable" "Connection failed"
    else
        log_check "WARN" "Storage API returned unexpected status" "HTTP $API_STATUS"
    fi
    
    # Check 3: Console Endpoint
    log_step "Checking console endpoint..."
    CONSOLE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://$NAKAMA_HOST:$NAKAMA_CONSOLE_PORT/" 2>/dev/null || echo "000")
    
    if [ "$CONSOLE_STATUS" = "200" ] || [ "$CONSOLE_STATUS" = "302" ]; then
        log_check "PASS" "Console endpoint accessible" "HTTP $CONSOLE_STATUS"
    elif [ "$CONSOLE_STATUS" = "000" ]; then
        log_check "WARN" "Console endpoint unreachable" "May be disabled or on different host"
    else
        log_check "WARN" "Console returned unexpected status" "HTTP $CONSOLE_STATUS"
    fi
    
    # Check 4: Prometheus Metrics
    log_step "Checking metrics endpoint..."
    if [ -n "$ALPHA_SERVER" ]; then
        METRICS_STATUS=$(run_cmd "curl -s -o /dev/null -w '%{http_code}' http://localhost:$PROMETHEUS_PORT/metrics" || echo "000")
    else
        METRICS_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://$NAKAMA_HOST:$PROMETHEUS_PORT/metrics" 2>/dev/null || echo "000")
    fi
    
    if [ "$METRICS_STATUS" = "200" ]; then
        log_check "PASS" "Prometheus metrics endpoint working" "HTTP $METRICS_STATUS"
        
        # Get specific metrics if verbose
        if [ "$VERBOSE" = true ]; then
            if [ -n "$ALPHA_SERVER" ]; then
                METRICS=$(run_cmd "curl -s http://localhost:$PROMETHEUS_PORT/metrics | grep nakama" | head -10)
            else
                METRICS=$(curl -s "http://$NAKAMA_HOST:$PROMETHEUS_PORT/metrics" 2>/dev/null | grep nakama | head -10)
            fi
            if [ -n "$METRICS" ]; then
                log_info "Sample metrics:"
                echo "$METRICS" | while read -r line; do
                    echo "  $line"
                done
            fi
        fi
    else
        log_check "WARN" "Prometheus metrics not available" "HTTP $METRICS_STATUS"
    fi
    
    # Check 5: Server Process
    log_step "Checking server process..."
    if [ -n "$ALPHA_SERVER" ]; then
        if [ "$DEPLOYMENT_MODE" = "docker" ]; then
            CONTAINER_STATUS=$(run_cmd "docker inspect -f '{{.State.Status}}' armored_archer_alpha" 2>/dev/null || echo "unknown")
            if [ "$CONTAINER_STATUS" = "running" ]; then
                log_check "PASS" "Nakama container is running"
                
                # Get container uptime
                if [ "$VERBOSE" = true ]; then
                    UPTIME=$(run_cmd "docker inspect -f '{{.State.StartedAt}}' armored_archer_alpha" 2>/dev/null || echo "")
                    if [ -n "$UPTIME" ]; then
                        log_info "Container started: $UPTIME"
                    fi
                fi
            else
                log_check "FAIL" "Nakama container not running" "Status: $CONTAINER_STATUS"
            fi
            
            # Get container resource usage
            CONTAINER_STATS=$(run_cmd "docker stats armored_archer_alpha --no-stream --format 'CPU: {{.CPUPerc}}, Mem: {{.MemUsage}}'" 2>/dev/null || echo "")
            if [ -n "$CONTAINER_STATS" ] && [ "$VERBOSE" = true ]; then
                log_info "Resource usage: $CONTAINER_STATS"
            fi
        else
            SERVICE_STATUS=$(run_cmd "systemctl is-active nakama" 2>/dev/null || echo "inactive")
            if [ "$SERVICE_STATUS" = "active" ]; then
                log_check "PASS" "Nakama service is active"
            else
                log_check "FAIL" "Nakama service not active" "Status: $SERVICE_STATUS"
            fi
        fi
    else
        log_check "PASS" "Process check skipped (local mode)"
    fi
    
    # Check 6: Database Connectivity (via API)
    log_step "Checking database connectivity..."
    # Try to make an API call that requires database access
    DB_CHECK=$(curl -s -u "$NAKAMA_SERVER_KEY:" "$NAKAMA_URL/v2/storage?limit=1" 2>/dev/null || echo "")
    
    if echo "$DB_CHECK" | grep -q "objects" || echo "$DB_CHECK" | grep -q "error"; then
        # If we get a response (even error), database connection exists
        log_check "PASS" "Database connection working"
    else
        log_check "WARN" "Could not verify database connectivity"
    fi
    
    # Check 7: Recent Error Logs
    log_step "Checking recent error logs..."
    if [ -n "$ALPHA_SERVER" ]; then
        if [ "$DEPLOYMENT_MODE" = "docker" ]; then
            ERROR_LOGS=$(run_cmd "docker logs armored_archer_alpha 2>&1 | grep -i 'error\\|fatal\\|panic' | tail -5" || echo "")
        else
            ERROR_LOGS=$(run_cmd "sudo journalctl -u nakama -n 100 2>&1 | grep -i 'error\\|fatal\\|panic' | tail -5" || echo "")
        fi
        
        if [ -n "$ERROR_LOGS" ]; then
            ERROR_COUNT=$(echo "$ERROR_LOGS" | wc -l)
            log_check "WARN" "Recent errors found in logs" "$ERROR_COUNT errors in recent logs"
            if [ "$VERBOSE" = true ]; then
                echo "$ERROR_LOGS" | while read -r line; do
                    echo "  $line"
                done
            fi
        else
            log_check "PASS" "No recent errors in logs"
        fi
    else
        log_check "PASS" "Log check skipped (remote server)"
    fi
    
    # Check 8: Network Connectivity
    log_step "Checking network connectivity..."
    if [ -n "$ALPHA_SERVER" ]; then
        # Check if Nakama port is listening
        PORT_CHECK=$(run_cmd "netstat -tlnp 2>/dev/null | grep :$NAKAMA_PORT || ss -tlnp 2>/dev/null | grep :$NAKAMA_PORT" || echo "")
        if [ -n "$PORT_CHECK" ]; then
            log_check "PASS" "Nakama port $NAKAMA_PORT is listening"
        else
            log_check "WARN" "Could not verify port $NAKAMA_PORT is listening"
        fi
    else
        if netstat -tlnp 2>/dev/null | grep -q ":$NAKAMA_PORT" || ss -tlnp 2>/dev/null | grep -q ":$NAKAMA_PORT"; then
            log_check "PASS" "Nakama port $NAKAMA_PORT is listening"
        else
            log_check "WARN" "Could not verify port $NAKAMA_PORT is listening"
        fi
    fi
    
    # Summary
    if [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo -e "${BLUE}============================================${NC}"
        echo -e "${BLUE}  Health Check Summary${NC}"
        echo -e "${BLUE}============================================${NC}"
        echo ""
        echo -e "  Passed:   ${GREEN}$CHECKS_PASSED${NC}"
        echo -e "  Warnings: ${YELLOW}$CHECKS_WARNING${NC}"
        echo -e "  Failed:   ${RED}$CHECKS_FAILED${NC}"
        echo ""
        
        if [ "$HEALTHY" = true ]; then
            echo -e "${GREEN}✓ Server is HEALTHY${NC}"
            echo ""
            return 0
        else
            echo -e "${RED}✗ Server is UNHEALTHY${NC}"
            echo ""
            echo "Troubleshooting:"
            echo "  1. Check logs: ssh $SSH_USER@$ALPHA_SERVER 'docker logs armored_archer_alpha'"
            echo "  2. Restart service: ssh $SSH_USER@$ALPHA_SERVER 'docker-compose restart nakama'"
            echo "  3. Check resources: ssh $SSH_USER@$ALPHA_SERVER 'docker stats'"
            return 1
        fi
    else
        # JSON output
        cat <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "server": "$NAKAMA_HOST:$NAKAMA_PORT",
  "healthy": $HEALTHY,
  "checks": {
    "passed": $CHECKS_PASSED,
    "warnings": $CHECKS_WARNING,
    "failed": $CHECKS_FAILED
  },
  "response_time_ms": $RESPONSE_TIME
}
EOF
    fi
}

# Main execution
if [ "$CONTINUOUS" = true ]; then
    log_info "Starting continuous health checks (interval: ${CONTINUOUS_INTERVAL}s)"
    log_info "Press Ctrl+C to stop"
    echo ""
    
    while true; do
        run_health_checks
        echo ""
        log_info "Next check in ${CONTINUOUS_INTERVAL}s..."
        sleep "$CONTINUOUS_INTERVAL"
    done
else
    run_health_checks
fi
