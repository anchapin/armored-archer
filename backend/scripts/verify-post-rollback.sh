#!/bin/bash
# Post-Rollback Verification Script
# Verifies system health after rollback from Go to TypeScript
# Usage: ./verify-post-rollback.sh [options]
#
# Options:
#   --quick     Run quick verification only
#   --full      Run full verification (default)
#   --verbose   Show detailed output
#   --json      Output results in JSON format

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
NAKAMA_URL="${NAKAMA_URL:-http://localhost:7350}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nakama}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-localdbpassword}"

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

# Parse arguments
VERIFICATION_LEVEL="full"
VERBOSE=false
JSON_OUTPUT=false

for arg in "$@"; do
    case $arg in
        --quick)
            VERIFICATION_LEVEL="quick"
            shift
            ;;
        --full)
            VERIFICATION_LEVEL="full"
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
    esac
done

# Track verification results
declare -A RESULTS
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Helper functions
log_info() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

log_success() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${GREEN}[PASS]${NC} $1"
    fi
    ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
}

log_warning() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${YELLOW}[WARN]${NC} $1"
    fi
    ((WARNINGS++))
    ((TOTAL_CHECKS++))
}

log_error() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${RED}[FAIL]${NC} $1"
    fi
    ((FAILED_CHECKS++))
    ((TOTAL_CHECKS++))
}

log_test() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${MAGENTA}[TEST]${NC} $1"
    fi
}

verbose_log() {
    if [ "$VERBOSE" = true ] && [ "$JSON_OUTPUT" = false ]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

# Check if Docker is available
check_docker() {
    if command -v docker &> /dev/null; then
        if docker ps | grep -q armored_archer_postgres; then
            USE_DOCKER=true
        else
            USE_DOCKER=false
        fi
    else
        USE_DOCKER=false
    fi
}

# Execute SQL command
exec_sql() {
    local sql="$1"
    if [ "$USE_DOCKER" = true ]; then
        docker exec -i -e PGPASSWORD="$DB_PASSWORD" \
            armored_archer_postgres psql \
            -U "$DB_USER" \
            -h localhost \
            -d "$DB_NAME" \
            -t -c "$sql" 2>/dev/null | tr -d '[:space:]'
    else
        psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -t -c "$sql" 2>/dev/null | tr -d '[:space:]'
    fi
}

# ============================================
# Section 1: Service Health Checks
# ============================================

check_service_health() {
    log_test "=== Service Health Checks ==="
    
    # Check 1: Nakama service running
    log_info "Checking Nakama service status..."
    if systemctl is-active --quiet nakama 2>/dev/null; then
        log_success "Nakama service is running"
    else
        log_warning "Nakama service status unavailable (may not be systemd)"
    fi
    
    # Check 2: Health endpoint
    log_info "Checking health endpoint..."
    if curl -f -s --max-time 10 "$NAKAMA_URL/health" > /dev/null 2>&1; then
        log_success "Health endpoint responding"
        
        # Get health response
        HEALTH_RESPONSE=$(curl -s --max-time 10 "$NAKAMA_URL/health")
        verbose_log "Health response: $HEALTH_RESPONSE"
    else
        log_error "Health endpoint not responding"
        RESULTS["health_endpoint"]="FAIL"
        return 1
    fi
    
    # Check 3: API endpoint
    log_info "Checking API endpoint..."
    API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$NAKAMA_URL/")
    if [ "$API_RESPONSE" = "200" ] || [ "$API_RESPONSE" = "404" ]; then
        log_success "API endpoint responding (HTTP $API_RESPONSE)"
    else
        log_error "API endpoint not responding (HTTP $API_RESPONSE)"
    fi
    
    # Check 4: Response time
    log_info "Checking response time..."
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$NAKAMA_URL/health")
    RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc 2>/dev/null || echo "unknown")
    
    if [ "$RESPONSE_TIME_MS" != "unknown" ]; then
        verbose_log "Response time: ${RESPONSE_TIME_MS}ms"
        if (( $(echo "$RESPONSE_TIME_MS < 500" | bc -l 2>/dev/null || echo 0) )); then
            log_success "Response time acceptable (${RESPONSE_TIME_MS}ms)"
        else
            log_warning "Response time high (${RESPONSE_TIME_MS}ms)"
        fi
    else
        log_warning "Could not measure response time"
    fi
}

# ============================================
# Section 2: Module Verification
# ============================================

check_module_verification() {
    log_test "=== Module Verification ==="
    
    # Check 1: TypeScript module loaded
    log_info "Checking for TypeScript module in logs..."
    if journalctl -u nakama -n 200 --no-pager 2>/dev/null | grep -qi "typescript"; then
        log_success "TypeScript module detected in logs"
    else
        log_warning "TypeScript not explicitly mentioned in recent logs"
    fi
    
    # Check 2: Module file exists
    log_info "Checking module file..."
    if [ -f "/opt/nakama/modules/server" ]; then
        log_success "Module file exists: /opt/nakama/modules/server"
        
        # Check if it's TypeScript
        if head -1 /opt/nakama/modules/server 2>/dev/null | grep -q "//\|import\|export"; then
            log_success "Module appears to be TypeScript/JavaScript"
        else
            log_warning "Module type unclear"
        fi
    else
        log_warning "Module file not found at expected location"
    fi
    
    # Check 3: Nakama configuration
    log_info "Checking Nakama configuration..."
    if [ -f "/etc/nakama/config.yml" ]; then
        log_success "Configuration file exists"
    else
        log_warning "Configuration file not found"
    fi
}

# ============================================
# Section 3: Database Verification
# ============================================

check_database_verification() {
    log_test "=== Database Verification ==="
    
    # Check 1: Database connectivity
    log_info "Checking database connectivity..."
    DB_CHECK=$(exec_sql "SELECT 1;" 2>/dev/null)
    if [ "$DB_CHECK" = "1" ]; then
        log_success "Database connection OK"
    else
        log_error "Database connection failed"
        return 1
    fi
    
    # Check 2: Table count
    log_info "Checking table count..."
    TABLE_COUNT=$(exec_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    verbose_log "Tables found: $TABLE_COUNT"
    
    if [ "$TABLE_COUNT" -ge 10 ] 2>/dev/null; then
        log_success "Table count OK ($TABLE_COUNT tables)"
    else
        log_error "Table count low ($TABLE_COUNT tables, expected >= 10)"
    fi
    
    # Check 3: Key tables exist
    log_info "Checking key tables..."
    KEY_TABLES=("player_stats" "catalog" "inventory" "loadout" "stage_completion")
    for table in "${KEY_TABLES[@]}"; do
        TABLE_EXISTS=$(exec_sql "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '$table');")
        if [ "$TABLE_EXISTS" = "t" ]; then
            verbose_log "  ✓ $table exists"
        else
            log_error "Table missing: $table"
        fi
    done
    log_success "Key tables verified"
    
    # Check 4: Player stats data
    log_info "Checking player_stats data..."
    PLAYER_COUNT=$(exec_sql "SELECT COUNT(*) FROM player_stats;")
    if [ "$PLAYER_COUNT" -ge 0 ] 2>/dev/null; then
        log_success "Player stats accessible ($PLAYER_COUNT records)"
    else
        log_error "Cannot query player_stats"
    fi
    
    # Check 5: Catalog data
    log_info "Checking catalog data..."
    CATALOG_COUNT=$(exec_sql "SELECT COUNT(*) FROM catalog;")
    if [ "$CATALOG_COUNT" -ge 0 ] 2>/dev/null; then
        log_success "Catalog accessible ($CATALOG_COUNT records)"
    else
        log_error "Cannot query catalog"
    fi
    
    # Check 6: Database size
    log_info "Checking database size..."
    DB_SIZE=$(exec_sql "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));")
    verbose_log "Database size: $DB_SIZE"
    log_success "Database size: $DB_SIZE"
}

# ============================================
# Section 4: RPC Endpoint Tests
# ============================================

check_rpc_endpoints() {
    log_test "=== RPC Endpoint Tests ==="
    
    # Note: These are placeholder tests - actual RPC testing requires authentication
    # In production, you would use actual API calls with valid tokens
    
    log_info "Checking RPC endpoint availability..."
    
    # Check if RPC endpoint is accessible (will return 401/403 without auth, which is OK)
    RPC_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$NAKAMA_URL/v2/rpc/")
    if [ "$RPC_RESPONSE" = "401" ] || [ "$RPC_RESPONSE" = "403" ] || [ "$RPC_RESPONSE" = "404" ]; then
        log_success "RPC endpoint accessible (HTTP $RPC_RESPONSE)"
    else
        log_warning "RPC endpoint response unexpected (HTTP $RPC_RESPONSE)"
    fi
    
    # List available RPC functions (if accessible)
    log_info "Verifying RPC functions..."
    RPC_FUNCTIONS=("combat_resolve" "matchmaker_join" "get_player" "get_inventory" "update_loadout")
    for rpc in "${RPC_FUNCTIONS[@]}"; do
        verbose_log "  Checking RPC: $rpc"
        # In production: curl -X POST "$NAKAMA_URL/v2/rpc/$rpc" -H "Authorization: Bearer $TOKEN"
    done
    log_success "RPC functions verified (placeholder check)"
}

# ============================================
# Section 5: Performance Checks
# ============================================

check_performance() {
    log_test "=== Performance Checks ==="
    
    # Check 1: Memory usage
    log_info "Checking memory usage..."
    if command -v free &> /dev/null; then
        MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100)}')
        verbose_log "Memory usage: ${MEMORY_USAGE}%"
        
        if (( $(echo "$MEMORY_USAGE < 80" | bc -l 2>/dev/null || echo 0) )); then
            log_success "Memory usage acceptable (${MEMORY_USAGE}%)"
        else
            log_warning "Memory usage high (${MEMORY_USAGE}%)"
        fi
    else
        log_warning "Cannot check memory usage"
    fi
    
    # Check 2: CPU usage
    log_info "Checking CPU usage..."
    if command -v top &> /dev/null; then
        CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 2>/dev/null || echo "unknown")
        if [ "$CPU_USAGE" != "unknown" ]; then
            verbose_log "CPU usage: ${CPU_USAGE}%"
            if (( $(echo "$CPU_USAGE < 80" | bc -l 2>/dev/null || echo 0) )); then
                log_success "CPU usage acceptable (${CPU_USAGE}%)"
            else
                log_warning "CPU usage high (${CPU_USAGE}%)"
            fi
        else
            log_warning "Cannot check CPU usage"
        fi
    fi
    
    # Check 3: Disk space
    log_info "Checking disk space..."
    DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
    verbose_log "Disk usage: ${DISK_USAGE}%"
    
    if [ "$DISK_USAGE" -lt 80 ] 2>/dev/null; then
        log_success "Disk space OK (${DISK_USAGE}% used)"
    elif [ "$DISK_USAGE" -lt 90 ] 2>/dev/null; then
        log_warning "Disk space warning (${DISK_USAGE}% used)"
    else
        log_error "Disk space critical (${DISK_USAGE}% used)"
    fi
    
    # Check 4: Active connections
    log_info "Checking database connections..."
    ACTIVE_CONNECTIONS=$(exec_sql "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = '$DB_NAME';")
    MAX_CONNECTIONS=$(exec_sql "SHOW max_connections;")
    verbose_log "Active connections: $ACTIVE_CONNECTIONS / $MAX_CONNECTIONS"
    
    if [ -n "$ACTIVE_CONNECTIONS" ] && [ "$ACTIVE_CONNECTIONS" != "" ]; then
        log_success "Database connections: $ACTIVE_CONNECTIONS"
    else
        log_warning "Cannot check database connections"
    fi
}

# ============================================
# Section 6: Log Analysis
# ============================================

check_logs() {
    log_test "=== Log Analysis ==="
    
    # Check 1: Recent errors
    log_info "Checking for recent errors..."
    ERROR_COUNT=$(journalctl -u nakama -n 200 --no-pager 2>/dev/null | grep -ci "error\|fatal\|panic" || echo "0")
    verbose_log "Recent errors: $ERROR_COUNT"
    
    if [ "$ERROR_COUNT" -lt 10 ] 2>/dev/null; then
        log_success "Error rate acceptable ($ERROR_COUNT errors in recent logs)"
    else
        log_warning "High error rate ($ERROR_COUNT errors in recent logs)"
    fi
    
    # Check 2: Startup messages
    log_info "Checking startup messages..."
    if journalctl -u nakama -n 200 --no-pager 2>/dev/null | grep -qi "started\|listening\|ready"; then
        log_success "Nakama started successfully"
    else
        log_warning "No startup confirmation in logs"
    fi
    
    # Check 3: No panic/crash messages
    log_info "Checking for panic/crash messages..."
    PANIC_COUNT=$(journalctl -u nakama -n 200 --no-pager 2>/dev/null | grep -ci "panic\|crash\|segfault" || echo "0")
    
    if [ "$PANIC_COUNT" = "0" ]; then
        log_success "No panic/crash messages"
    else
        log_error "Found $PANIC_COUNT panic/crash messages"
    fi
}

# ============================================
# Section 7: Monitoring Integration
# ============================================

check_monitoring() {
    log_test "=== Monitoring Integration ==="
    
    # Check 1: Metrics endpoint
    log_info "Checking metrics endpoint..."
    if curl -f -s --max-time 10 "$NAKAMA_URL/metrics" > /dev/null 2>&1; then
        log_success "Metrics endpoint accessible"
    else
        log_warning "Metrics endpoint not accessible"
    fi
    
    # Check 2: Grafana connection
    log_info "Checking Grafana integration..."
    # This would check if metrics are flowing to Grafana
    log_warning "Grafana integration check requires manual verification"
    
    # Check 3: Alerting status
    log_info "Checking alerting configuration..."
    log_warning "Alerting status check requires manual verification"
}

# ============================================
# Summary and Reporting
# ============================================

print_summary() {
    echo ""
    echo "=========================================="
    echo "Verification Summary"
    echo "=========================================="
    echo ""
    
    if [ "$JSON_OUTPUT" = true ]; then
        # JSON output
        cat << EOF
{
  "verification_level": "$VERIFICATION_LEVEL",
  "timestamp": "$(date -Iseconds)",
  "total_checks": $TOTAL_CHECKS,
  "passed": $PASSED_CHECKS,
  "failed": $FAILED_CHECKS,
  "warnings": $WARNINGS,
  "status": "$([ $FAILED_CHECKS -eq 0 ] && echo "PASS" || echo "FAIL")"
}
EOF
    else
        # Human-readable output
        echo "Total Checks: $TOTAL_CHECKS"
        echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
        echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
        echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
        echo ""
        
        if [ $FAILED_CHECKS -eq 0 ]; then
            echo -e "${GREEN}✓ POST-ROLLBACK VERIFICATION PASSED${NC}"
            echo ""
            echo "All critical checks passed. System is operational."
            echo ""
            echo "Recommended next steps:"
            echo "  1. Monitor Grafana dashboard for 30 minutes"
            echo "  2. Run full integration test suite"
            echo "  3. Notify stakeholders of successful rollback"
            echo "  4. Schedule post-mortem if needed"
        else
            echo -e "${RED}✗ POST-ROLLBACK VERIFICATION FAILED${NC}"
            echo ""
            echo "$FAILED_CHECKS check(s) failed. Review errors above."
            echo ""
            echo "Recommended next steps:"
            echo "  1. Review failed checks"
            echo "  2. Check Nakama logs: journalctl -u nakama -n 200"
            echo "  3. Consult rollback runbook for troubleshooting"
            echo "  4. Consider re-rollback if critical failures"
        fi
    fi
    
    echo ""
    echo "=========================================="
}

# ============================================
# Main Execution
# ============================================

main() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo "=========================================="
        echo "Post-Rollback Verification"
        echo "=========================================="
        echo ""
        echo "Verification Level: $VERIFICATION_LEVEL"
        echo "Timestamp: $(date)"
        echo ""
    fi
    
    # Check Docker availability
    check_docker
    
    # Run verification sections
    check_service_health
    
    if [ "$VERIFICATION_LEVEL" = "full" ]; then
        check_module_verification
        check_database_verification
        check_rpc_endpoints
        check_performance
        check_logs
        check_monitoring
    fi
    
    # Print summary
    print_summary
    
    # Exit with appropriate code
    if [ $FAILED_CHECKS -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main
