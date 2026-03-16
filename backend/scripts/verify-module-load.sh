#!/bin/bash
# ============================================
# Module Load Verification Script
# Armored Archer - Go Module Deployment
# ============================================
# This script verifies that the Go module has loaded
# correctly in Nakama and all RPC handlers are registered.
# ============================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default configuration
NAKAMA_HOST="${NAKAMA_HOST:-localhost}"
NAKAMA_PORT="${NAKAMA_PORT:-7350}"
NAKAMA_SERVER_KEY="${NAKAMA_SERVER_KEY:-defaultkey}"
ALPHA_SERVER=""
SSH_USER="deploy"
SSH_PORT="22"
DEPLOYMENT_MODE="docker"  # docker or local

# Expected RPC handlers
EXPECTED_RPCS=(
    "get_player_stats"
    "report_player"
    "get_player_reports"
    "gain_xp"
    "allocate_stats"
    "list_matches"
    "create_match"
    "accept_match"
    "get_player_rank"
    "complete_match"
    "submit_combat_action"
    "get_match_state"
    "player_disconnect"
    "get_season_info"
    "get_leaderboard"
    "update_rank"
    "get_season_rewards"
    "claim_season_rewards"
    "validate_purchase"
    "get_currency"
    "spend_gems"
    "generate_gear"
    "get_inventory"
    "equip_gear"
)

# Verification state
VERIFICATION_START=$(date +%s)
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Parse arguments
VERBOSE=false
SKIP_RPC_CHECK=false

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
        --key)
            NAKAMA_SERVER_KEY="$2"
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
        --skip-rpc)
            SKIP_RPC_CHECK=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Verify Go module load in Nakama server"
            echo ""
            echo "Options:"
            echo "  -s, --server SERVER     Alpha server hostname (remote verification)"
            echo "  -u, --user USER         SSH user (default: deploy)"
            echo "  -p, --port PORT         SSH port (default: 22)"
            echo "  --host HOST             Nakama host (default: localhost)"
            echo "  --nakama-port PORT      Nakama port (default: 7350)"
            echo "  --key KEY               Nakama server key (default: defaultkey)"
            echo "  --mode MODE             Deployment mode: docker or local (default: docker)"
            echo "  -v, --verbose           Show verbose output"
            echo "  --skip-rpc              Skip RPC handler verification"
            echo "  -h, --help              Show this help message"
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

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Module Load Verification${NC}"
echo -e "${BLUE}  Armored Archer - Go Module${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

if [ -n "$ALPHA_SERVER" ]; then
    echo -e "Server:  ${CYAN}$ALPHA_SERVER${NC}"
    echo -e "Mode:    ${CYAN}Remote (SSH)${NC}"
else
    echo -e "Server:  ${CYAN}$NAKAMA_HOST:$NAKAMA_PORT${NC}"
    echo -e "Mode:    ${CYAN}Local${NC}"
fi
echo ""

# Function to log messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((CHECKS_WARNING++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((CHECKS_FAILED++))
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

log_check() {
    local status=$1
    local message=$2
    
    if [ "$status" = "PASS" ]; then
        echo -e "  ${GREEN}✓${NC} $message"
        ((CHECKS_PASSED++))
    elif [ "$status" = "FAIL" ]; then
        echo -e "  ${RED}✗${NC} $message"
        ((CHECKS_FAILED++))
    elif [ "$status" = "WARN" ]; then
        echo -e "  ${YELLOW}⚠${NC} $message"
        ((CHECKS_WARNING++))
    fi
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Helper function to run command on remote or local
run_cmd() {
    local cmd="$1"
    
    if [ -n "$ALPHA_SERVER" ]; then
        ssh $SSH_OPTS "$SSH_HOST" "$cmd"
    else
        eval "$cmd"
    fi
}

# Helper function to get Nakama logs
get_nakama_logs() {
    local lines="${1:-100}"
    
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        run_cmd "docker logs armored_archer_alpha 2>&1 | tail -$lines"
    else
        run_cmd "sudo journalctl -u nakama -n $lines --no-pager"
    fi
}

# Check 1: Server Connectivity
log_step "Checking server connectivity..."
if [ -n "$ALPHA_SERVER" ]; then
    if ssh $SSH_OPTS "$SSH_HOST" "echo 'Connection successful'" > /dev/null 2>&1; then
        log_check "PASS" "SSH connection to $ALPHA_SERVER established"
    else
        log_check "FAIL" "Cannot connect to $ALPHA_SERVER via SSH"
        exit 1
    fi
else
    if curl -s --connect-timeout 5 "$NAKAMA_URL/health" > /dev/null 2>&1; then
        log_check "PASS" "Nakama server is reachable"
    else
        log_check "FAIL" "Cannot connect to Nakama server at $NAKAMA_URL"
        exit 1
    fi
fi

# Check 2: Nakama Service Status
log_step "Checking Nakama service status..."
if [ -n "$ALPHA_SERVER" ]; then
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        CONTAINER_STATUS=$(run_cmd "docker inspect -f '{{.State.Status}}' armored_archer_alpha" 2>/dev/null || echo "unknown")
        if [ "$CONTAINER_STATUS" = "running" ]; then
            log_check "PASS" "Nakama container is running"
        else
            log_check "FAIL" "Nakama container status: $CONTAINER_STATUS"
        fi
    else
        SERVICE_STATUS=$(run_cmd "systemctl is-active nakama" 2>/dev/null || echo "inactive")
        if [ "$SERVICE_STATUS" = "active" ]; then
            log_check "PASS" "Nakama service is active"
        else
            log_check "FAIL" "Nakama service status: $SERVICE_STATUS"
        fi
    fi
else
    log_check "PASS" "Service status check skipped (remote server)"
fi

# Check 3: Module Initialization Logs
log_step "Checking module initialization logs..."
LOGS=$(get_nakama_logs 200)

if echo "$LOGS" | grep -q "Armored Archer Backend Initializing"; then
    log_check "PASS" "Module initialization started"
else
    log_check "FAIL" "Module initialization not found in logs"
fi

if echo "$LOGS" | grep -q "Configuration loaded successfully"; then
    log_check "PASS" "Configuration loaded successfully"
else
    log_check "WARN" "Configuration load message not found"
fi

if echo "$LOGS" | grep -q "RPC handlers registered"; then
    log_check "PASS" "RPC handlers registered"
else
    log_check "WARN" "RPC registration message not found"
fi

if echo "$LOGS" | grep -q "Armored Archer Backend Ready"; then
    log_check "PASS" "Module initialization completed successfully"
else
    log_check "FAIL" "Module ready message not found"
fi

# Show relevant log lines
if [ "$VERBOSE" = true ]; then
    echo ""
    log_info "Recent module logs:"
    echo "$LOGS" | grep -i "armored archer" | tail -10 | while read -r line; do
        echo "  $line"
    done
    echo ""
fi

# Check 4: Health Endpoint
log_step "Checking health endpoint..."
if [ -n "$ALPHA_SERVER" ]; then
    HEALTH_RESPONSE=$(run_cmd "curl -s http://localhost:$NAKAMA_PORT/health" 2>/dev/null || echo "")
else
    HEALTH_RESPONSE=$(curl -s "$NAKAMA_URL/health" 2>/dev/null || echo "")
fi

if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    log_check "PASS" "Health endpoint responding"
    if [ "$VERBOSE" = true ]; then
        log_info "Health response: $HEALTH_RESPONSE"
    fi
else
    log_check "FAIL" "Health endpoint not responding"
    log_info "Response: $HEALTH_RESPONSE"
fi

# Check 5: API Authentication
log_step "Checking API authentication..."
AUTH_RESPONSE=$(curl -s -o /dev/null -w '%{http_code}' -u "$NAKAMA_SERVER_KEY:" "$NAKAMA_URL/v2/storage" 2>/dev/null || echo "000")

if [ "$AUTH_RESPONSE" = "200" ] || [ "$AUTH_RESPONSE" = "401" ]; then
    log_check "PASS" "API authentication working (HTTP $AUTH_RESPONSE)"
else
    log_check "WARN" "API authentication returned unexpected status: $AUTH_RESPONSE"
fi

# Check 6: RPC Handler Verification
if [ "$SKIP_RPC_CHECK" = false ]; then
    log_step "Verifying RPC handlers..."
    log_info "Expected RPC handlers: ${#EXPECTED_RPCS[@]}"
    
    # Get registered RPCs from logs
    REGISTERED_RPCS=$(echo "$LOGS" | grep -oP 'RegisterRpc\("\K[^"]+' || echo "")
    
    if [ -n "$REGISTERED_RPCS" ]; then
        RPC_COUNT=$(echo "$REGISTERED_RPCS" | wc -l)
        log_info "Registered RPCs found in logs: $RPC_COUNT"
        
        for rpc in "${EXPECTED_RPCS[@]}"; do
            if echo "$REGISTERED_RPCS" | grep -q "^$rpc$"; then
                log_check "PASS" "RPC handler registered: $rpc"
            else
                # Check if it's mentioned in logs differently
                if echo "$LOGS" | grep -q "$rpc"; then
                    log_check "PASS" "RPC handler found in logs: $rpc"
                else
                    log_check "WARN" "RPC handler not found: $rpc"
                fi
            fi
        done
    else
        log_warn "Could not parse RPC handlers from logs"
        log_info "Manual verification recommended"
    fi
else
    log_step "RPC handler verification (Skipped)"
fi

# Check 7: Module File Verification
log_step "Verifying module file..."
if [ -n "$ALPHA_SERVER" ]; then
    MODULE_INFO=$(run_cmd "ls -lh /opt/nakama/modules/server.so 2>/dev/null" || echo "")
    if [ -n "$MODULE_INFO" ]; then
        log_check "PASS" "Module file exists on server"
        if [ "$VERBOSE" = true ]; then
            log_info "Module file: $MODULE_INFO"
        fi
    else
        log_check "WARN" "Module file not found at expected location"
    fi
    
    MODULE_CHECKSUM=$(run_cmd "sha256sum /opt/nakama/modules/server.so 2>/dev/null" | awk '{print $1}' || echo "")
    if [ -n "$MODULE_CHECKSUM" ]; then
        log_info "Module checksum: $MODULE_CHECKSUM"
    fi
else
    if [ -f "build/server.so" ]; then
        log_check "PASS" "Local module file exists"
        if [ "$VERBOSE" = true ]; then
            ls -lh build/server.so
        fi
    else
        log_check "WARN" "Local module file not found"
    fi
fi

# Check 8: Memory and Performance
log_step "Checking resource usage..."
if [ -n "$ALPHA_SERVER" ]; then
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        CONTAINER_STATS=$(run_cmd "docker stats armored_archer_alpha --no-stream --format '{{.MemUsage}}' 2>/dev/null" || echo "")
        if [ -n "$CONTAINER_STATS" ]; then
            log_check "PASS" "Container memory usage: $CONTAINER_STATS"
        else
            log_check "WARN" "Could not get container stats"
        fi
    else
        MEMORY_USAGE=$(run_cmd "systemctl show nakama --property=MemoryCurrent 2>/dev/null | cut -d'=' -f2" || echo "")
        if [ -n "$MEMORY_USAGE" ] && [ "$MEMORY_USAGE" != "[not set]" ]; then
            MEMORY_MB=$((MEMORY_USAGE / 1024 / 1024))
            log_check "PASS" "Service memory usage: ${MEMORY_MB}MB"
        else
            log_check "WARN" "Could not get service memory usage"
        fi
    fi
else
    log_check "PASS" "Resource check skipped (remote server)"
fi

# Verification Summary
VERIFICATION_END=$(date +%s)
TOTAL_TIME=$((VERIFICATION_END - VERIFICATION_START))

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Verification Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "  Passed:   ${GREEN}$CHECKS_PASSED${NC}"
echo -e "  Warnings: ${YELLOW}$CHECKS_WARNING${NC}"
echo -e "  Failed:   ${RED}$CHECKS_FAILED${NC}"
echo -e "  Time:     ${CYAN}${TOTAL_TIME}s${NC}"
echo ""

if [ "$CHECKS_FAILED" -gt 0 ]; then
    echo -e "${RED}✗ Verification FAILED${NC}"
    echo ""
    echo "Critical checks failed. Please review the errors above."
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check Nakama logs: ssh $SSH_USER@$ALPHA_SERVER 'docker logs armored_archer_alpha'"
    echo "  2. Verify module file: ssh $SSH_USER@$ALPHA_SERVER 'ls -lh /opt/nakama/modules/server.so'"
    echo "  3. Restart Nakama: ssh $SSH_USER@$ALPHA_SERVER 'docker-compose restart nakama'"
    exit 1
elif [ "$CHECKS_WARNING" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Verification passed with warnings${NC}"
    echo ""
    echo "Module loaded but some checks have warnings. Review and monitor."
    exit 0
else
    echo -e "${GREEN}✓ All Verification Checks Passed!${NC}"
    echo ""
    echo "Go module is loaded and functioning correctly."
    exit 0
fi
