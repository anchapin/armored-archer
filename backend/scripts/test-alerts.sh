#!/bin/bash
# Alert Testing Script for Armored Archer Backend
# Phase 2.3 - Alert Configuration & Testing
#
# This script tests all 6 alert rules (2 critical, 4 warning)
# by simulating conditions that trigger each alert.
#
# Usage:
#   ./test-alerts.sh [alert_name] [options]
#
# Examples:
#   ./test-alerts.sh --all              # Test all alerts
#   ./test-alerts.sh GameServerDown     # Test specific alert
#   ./test-alerts.sh HighErrorRate --count 50
#   ./test-alerts.sh --verify           # Verify alert rules loaded
#   ./test-alerts.sh --cleanup          # Clean up test data
#
# Prerequisites:
#   - Docker and docker-compose running
#   - Nakama server accessible
#   - Prometheus accessible
#   - Alertmanager accessible
#   - Authentication token for RPC calls

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAKAMA_URL="${NAKAMA_URL:-http://localhost:7350}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://localhost:9093}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"

# Authentication token (get from login or set manually)
AUTH_TOKEN="${AUTH_TOKEN:-}"

# Test parameters
TEST_ERROR_COUNT=50
TEST_LATENCY_MS=600
TEST_MEMORY_MB=500
TEST_DURATION=300  # 5 minutes default

# ============================================
# Helper Functions
# ============================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Nakama is running
    if ! curl -s -f "${NAKAMA_URL}/health" > /dev/null 2>&1; then
        log_error "Nakama server is not accessible at ${NAKAMA_URL}"
        exit 1
    fi
    log_success "Nakama is running"
    
    # Check if Prometheus is running
    if ! curl -s -f "${PROMETHEUS_URL}/-/healthy" > /dev/null 2>&1; then
        log_error "Prometheus is not accessible at ${PROMETHEUS_URL}"
        exit 1
    fi
    log_success "Prometheus is running"
    
    # Check if Alertmanager is running
    if ! curl -s -f "${ALERTMANAGER_URL}/-/healthy" > /dev/null 2>&1; then
        log_error "Alertmanager is not accessible at ${ALERTMANAGER_URL}"
        exit 1
    fi
    log_success "Alertmanager is running"
    
    # Check if auth token is set
    if [ -z "$AUTH_TOKEN" ]; then
        log_warning "AUTH_TOKEN not set. Some tests may fail."
        log_info "Set AUTH_TOKEN environment variable or login first"
    fi
}

get_auth_token() {
    if [ -n "$AUTH_TOKEN" ]; then
        echo "$AUTH_TOKEN"
        return
    fi
    
    log_info "Attempting to get auth token..."
    # Default Nakama credentials: defaultkey
    # You may need to customize this
    RESPONSE=$(curl -s -X POST "${NAKAMA_URL}/v2/account/authenticate/device" \
        -u "defaultkey:" \
        -H "Content-Type: application/json" \
        -d '{"id": "test-device-'$(date +%s)'"}')
    
    TOKEN=$(echo "$RESPONSE" | jq -r '.token' 2>/dev/null || echo "")
    
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        log_success "Got auth token"
        echo "$TOKEN"
    else
        log_warning "Failed to get auth token"
        echo ""
    fi
}

# ============================================
# Alert Testing Functions
# ============================================

test_game_server_down() {
    log_info "Testing GameServerDown alert..."
    log_warning "This test will stop the Nakama container!"
    
    read -p "Do you want to proceed? (y/N): " confirm
    if [ "$confirm" != "y" ]; then
        log_info "Skipping GameServerDown test"
        return
    fi
    
    log_info "Stopping Nakama container..."
    docker stop nakama 2>/dev/null || true
    
    log_info "Waiting 90 seconds for alert to fire..."
    sleep 90
    
    log_info "Checking alert status..."
    check_alerts "GameServerDown"
    
    log_info "Restarting Nakama container..."
    docker start nakama 2>/dev/null || true
    
    log_info "Waiting for Nakama to recover..."
    sleep 30
    
    if curl -s -f "${NAKAMA_URL}/health" > /dev/null 2>&1; then
        log_success "Nakama recovered successfully"
    else
        log_error "Nakama failed to recover!"
    fi
}

test_high_error_rate() {
    log_info "Testing HighErrorRate alert..."
    
    TOKEN=$(get_auth_token)
    if [ -z "$TOKEN" ]; then
        log_error "Cannot test without auth token"
        return
    fi
    
    log_info "Generating $TEST_ERROR_COUNT errors..."
    
    for i in $(seq 1 $TEST_ERROR_COUNT); do
        curl -s -X POST "${NAKAMA_URL}/v2/rpc/armored_archer/test_error" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"count": 1}' > /dev/null &
    done
    
    wait
    
    log_info "Waiting 3 minutes for alert to fire..."
    sleep 180
    
    log_info "Checking alert status..."
    check_alerts "HighErrorRate"
    
    log_success "HighErrorRate test completed"
}

test_high_latency() {
    log_info "Testing HighLatency alert..."
    
    TOKEN=$(get_auth_token)
    if [ -z "$TOKEN" ]; then
        log_error "Cannot test without auth token"
        return
    fi
    
    log_info "Generating high latency requests (${TEST_LATENCY_MS}ms)..."
    
    # Start background process to generate latency
    (
        for i in $(seq 1 100); do
            curl -s -X POST "${NAKAMA_URL}/v2/rpc/armored_archer/test_latency" \
                -H "Authorization: Bearer $TOKEN" \
                -H "Content-Type: application/json" \
                -d "{\"delay_ms\": $TEST_LATENCY_MS}" > /dev/null &
        done
        wait
    ) &
    
    LATENCY_PID=$!
    
    log_info "Waiting 11 minutes for alert to fire (10m threshold)..."
    
    # Show progress
    for i in $(seq 1 11); do
        sleep 60
        log_info "Minute $i/11..."
        
        # Check current latency
        LATENCY=$(curl -s "${PROMETHEUS_URL}/api/v1/query" \
            -G --data-urlencode "query=histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m]))" \
            | jq -r '.data.result[0].value[1] // "N/A"' 2>/dev/null || echo "N/A")
        log_info "Current P95 latency: ${LATENCY}s"
    done
    
    # Stop latency generation
    kill $LATENCY_PID 2>/dev/null || true
    
    log_info "Checking alert status..."
    check_alerts "HighLatency"
    
    log_success "HighLatency test completed"
}

test_disk_space_low() {
    log_info "Testing DiskSpaceLow alert..."
    log_warning "This test creates a large file to fill disk space!"
    
    read -p "Do you want to proceed? (y/N): " confirm
    if [ "$confirm" != "y" ]; then
        log_info "Skipping DiskSpaceLow test"
        return
    fi
    
    TEST_FILE="/tmp/test_disk_fill_$$"
    log_info "Creating test file: $TEST_FILE"
    
    # Check current disk space
    log_info "Current disk usage:"
    df -h /
    
    # Get 10% of available space
    AVAILABLE=$(df -P / | tail -1 | awk '{print $4}')
    TEN_PERCENT=$((AVAILABLE * 10 / 100))
    
    log_info "Creating ${TEN_PERCENT}K test file..."
    dd if=/dev/zero of="$TEST_FILE" bs=1024 count=$TEN_PERCENT 2>/dev/null || {
        log_warning "Could not create full test file (disk may be smaller than expected)"
    }
    
    log_info "New disk usage:"
    df -h /
    
    log_info "Waiting 6 minutes for alert to fire..."
    sleep 360
    
    log_info "Checking alert status..."
    check_alerts "DiskSpaceLow"
    
    log_info "Cleaning up test file..."
    rm -f "$TEST_FILE"
    
    log_info "Disk usage after cleanup:"
    df -h /
    
    log_success "DiskSpaceLow test completed"
}

test_high_memory_usage() {
    log_info "Testing HighMemoryUsage alert..."
    log_warning "This test allocates memory on the server!"
    
    read -p "Do you want to proceed? (y/N): " confirm
    if [ "$confirm" != "y" ]; then
        log_info "Skipping HighMemoryUsage test"
        return
    fi
    
    TOKEN=$(get_auth_token)
    if [ -z "$TOKEN" ]; then
        log_error "Cannot test without auth token"
        return
    fi
    
    log_info "Allocating ${TEST_MEMORY_MB}MB memory..."
    
    # Start memory allocation
    curl -s -X POST "${NAKAMA_URL}/v2/rpc/armored_archer/test_memory" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"mb\": $TEST_MEMORY_MB}" > /dev/null &
    
    log_info "Waiting 16 minutes for alert to fire (15m threshold)..."
    
    # Show progress and memory usage
    for i in $(seq 1 16); do
        sleep 60
        log_info "Minute $i/16..."
        
        # Check memory usage
        MEMORY=$(curl -s "${PROMETHEUS_URL}/api/v1/query" \
            -G --data-urlencode "query=(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100" \
            | jq -r '.data.result[0].value[1] // "N/A"' 2>/dev/null || echo "N/A")
        log_info "Current memory usage: ${MEMORY}%"
    done
    
    log_info "Checking alert status..."
    check_alerts "HighMemoryUsage"
    
    log_success "HighMemoryUsage test completed"
}

test_database_connection_pool() {
    log_info "Testing DatabaseConnectionPoolExhausted alert..."
    
    TOKEN=$(get_auth_token)
    if [ -z "$TOKEN" ]; then
        log_error "Cannot test without auth token"
        return
    fi
    
    log_info "Generating database connections..."
    
    # Start many concurrent connections
    (
        for i in $(seq 1 50); do
            curl -s -X POST "${NAKAMA_URL}/v2/rpc/armored_archer/test_db_connection" \
                -H "Authorization: Bearer $TOKEN" \
                -H "Content-Type: application/json" \
                -d '{}' > /dev/null &
        done
        wait
    ) &
    
    DB_PID=$!
    
    log_info "Waiting 3 minutes for alert to fire..."
    
    # Show progress and connection pool usage
    for i in $(seq 1 3); do
        sleep 60
        log_info "Minute $i/3..."
        
        # Check connection pool
        POOL_USAGE=$(curl -s "${PROMETHEUS_URL}/api/v1/query" \
            -G --data-urlencode "query=nakama_database_connections_active / nakama_database_connections_max * 100" \
            | jq -r '.data.result[0].value[1] // "N/A"' 2>/dev/null || echo "N/A")
        log_info "Current pool usage: ${POOL_USAGE}%"
    done
    
    # Stop connection generation
    kill $DB_PID 2>/dev/null || true
    
    log_info "Checking alert status..."
    check_alerts "DatabaseConnectionPoolExhausted"
    
    log_success "DatabaseConnectionPoolExhausted test completed"
}

# ============================================
# Alert Verification Functions
# ============================================

check_alerts() {
    local alert_name="$1"
    
    log_info "Checking for alert: $alert_name"
    
    # Query Alertmanager for active alerts
    ALERTS=$(curl -s "${ALERTMANAGER_URL}/api/v2/alerts" \
        -G --data-urlencode "filter=alertname=$alert_name" \
        --data-urlencode "filter=status=active")
    
    ALERT_COUNT=$(echo "$ALERTS" | jq 'length' 2>/dev/null || echo "0")
    
    if [ "$ALERT_COUNT" -gt 0 ]; then
        log_success "Alert '$alert_name' is firing! (Count: $ALERT_COUNT)"
        echo "$ALERTS" | jq '.[0]' 2>/dev/null || true
        return 0
    else
        log_warning "Alert '$alert_name' is not firing yet"
        
        # Check Prometheus rules
        log_info "Checking Prometheus rule evaluation..."
        RULES=$(curl -s "${PROMETHEUS_URL}/api/v1/rules" \
            -G --data-urlencode "query=$alert_name")
        
        echo "$RULES" | jq '.data.groups[].rules[] | select(.name == "'$alert_name'")' 2>/dev/null || true
        
        return 1
    fi
}

verify_alert_rules() {
    log_info "Verifying alert rules are loaded in Prometheus..."
    
    # Get all rules
    RULES=$(curl -s "${PROMETHEUS_URL}/api/v1/rules")
    
    # Check for each alert
    ALERTS=("GameServerDown" "HighErrorRate" "HighLatency" "DiskSpaceLow" "HighMemoryUsage" "DatabaseConnectionPoolExhausted")
    
    for alert in "${ALERTS[@]}"; do
        if echo "$RULES" | jq -e '.data.groups[].rules[] | select(.name == "'$alert'")' > /dev/null 2>&1; then
            log_success "Rule loaded: $alert"
        else
            log_error "Rule NOT loaded: $alert"
        fi
    done
}

verify_prometheus_config() {
    log_info "Verifying Prometheus configuration..."
    
    # Check if alert_rules.yml is loaded
    CONFIG=$(curl -s "${PROMETHEUS_URL}/api/v1/status/config")
    
    if echo "$CONFIG" | grep -q "alert_rules.yml"; then
        log_success "alert_rules.yml is loaded"
    else
        log_error "alert_rules.yml is NOT loaded"
    fi
}

verify_alertmanager_config() {
    log_info "Verifying Alertmanager configuration..."
    
    # Get Alertmanager status
    STATUS=$(curl -s "${ALERTMANAGER_URL}/api/v2/status")
    
    log_info "Alertmanager cluster status:"
    echo "$STATUS" | jq '.cluster' 2>/dev/null || true
    
    # Check receivers
    log_info "Configured receivers:"
    curl -s "${ALERTMANAGER_URL}/api/v2/receivers" | jq '.[].name' 2>/dev/null || true
}

# ============================================
# Cleanup Functions
# ============================================

cleanup_test_data() {
    log_info "Cleaning up test data..."
    
    # Remove test files
    rm -f /tmp/test_disk_fill_*
    
    # Stop any background processes
    pkill -f "test_error" 2>/dev/null || true
    pkill -f "test_latency" 2>/dev/null || true
    pkill -f "test_memory" 2>/dev/null || true
    pkill -f "test_db_connection" 2>/dev/null || true
    
    log_success "Cleanup completed"
}

reset_alerts() {
    log_info "Resetting all alerts..."
    
    # Silence all alerts for 1 hour
    curl -s -X POST "${ALERTMANAGER_URL}/api/v2/silences" \
        -H "Content-Type: application/json" \
        -d '{
            "matchers": [{"name": "alertname", "value": ".*", "isRegex": true}],
            "startsAt": "'$(date -Iseconds)'",
            "endsAt": "'$(date -d "+1 hour" -Iseconds)'",
            "createdBy": "test-alerts.sh",
            "comment": "Reset after alert testing"
        }'
    
    log_success "Alerts silenced for 1 hour"
}

# ============================================
# Main Execution
# ============================================

show_help() {
    cat << EOF
Alert Testing Script for Armored Archer Backend

Usage: ./test-alerts.sh [command] [options]

Commands:
  --all                     Test all alerts
  --critical                Test critical alerts only
  --warning                 Test warning alerts only
  
  GameServerDown            Test GameServerDown alert
  HighErrorRate             Test HighErrorRate alert
  HighLatency               Test HighLatency alert
  DiskSpaceLow              Test DiskSpaceLow alert
  HighMemoryUsage           Test HighMemoryUsage alert
  DatabaseConnectionPool    Test DatabaseConnectionPoolExhausted alert
  
  --verify                  Verify alert rules and configuration
  --cleanup                 Clean up test data
  --reset                   Reset/silence all alerts
  --help                    Show this help message

Options:
  --count N                 Number of errors to generate (default: 50)
  --latency N               Latency in ms (default: 600)
  --memory N                Memory in MB (default: 500)
  --duration N              Test duration in seconds (default: 300)

Environment Variables:
  NAKAMA_URL                Nakama server URL (default: http://localhost:7350)
  PROMETHEUS_URL            Prometheus URL (default: http://localhost:9090)
  ALERTMANAGER_URL          Alertmanager URL (default: http://localhost:9093)
  AUTH_TOKEN                Authentication token for RPC calls

Examples:
  ./test-alerts.sh --all
  ./test-alerts.sh HighErrorRate --count 100
  ./test-alerts.sh --verify
  ./test-alerts.sh --cleanup

EOF
}

main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    case "$1" in
        --help|-h)
            show_help
            exit 0
            ;;
        --verify)
            check_prerequisites
            verify_prometheus_config
            verify_alert_rules
            verify_alertmanager_config
            exit 0
            ;;
        --cleanup)
            cleanup_test_data
            exit 0
            ;;
        --reset)
            reset_alerts
            exit 0
            ;;
        --all)
            check_prerequisites
            log_info "Testing all alerts..."
            
            log_info "=== Testing Critical Alerts ==="
            test_high_error_rate
            # Skip GameServerDown in automated test
            log_warning "Skipping GameServerDown (requires manual confirmation)"
            
            log_info "=== Testing Warning Alerts ==="
            test_high_latency
            # Skip disk and memory tests in automated mode
            log_warning "Skipping DiskSpaceLow and HighMemoryUsage (require manual confirmation)"
            test_database_connection_pool
            
            log_success "All automated tests completed"
            exit 0
            ;;
        --critical)
            check_prerequisites
            test_high_error_rate
            exit 0
            ;;
        --warning)
            check_prerequisites
            test_high_latency
            test_database_connection_pool
            exit 0
            ;;
        GameServerDown)
            check_prerequisites
            test_game_server_down
            exit 0
            ;;
        HighErrorRate)
            check_prerequisites
            shift
            while [ $# -gt 0 ]; do
                case "$1" in
                    --count) TEST_ERROR_COUNT="$2"; shift 2 ;;
                    *) shift ;;
                esac
            done
            test_high_error_rate
            exit 0
            ;;
        HighLatency)
            check_prerequisites
            shift
            while [ $# -gt 0 ]; do
                case "$1" in
                    --latency) TEST_LATENCY_MS="$2"; shift 2 ;;
                    *) shift ;;
                esac
            done
            test_high_latency
            exit 0
            ;;
        DiskSpaceLow)
            check_prerequisites
            test_disk_space_low
            exit 0
            ;;
        HighMemoryUsage)
            check_prerequisites
            shift
            while [ $# -gt 0 ]; do
                case "$1" in
                    --memory) TEST_MEMORY_MB="$2"; shift 2 ;;
                    *) shift ;;
                esac
            done
            test_high_memory_usage
            exit 0
            ;;
        DatabaseConnectionPool)
            check_prerequisites
            test_database_connection_pool
            exit 0
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
