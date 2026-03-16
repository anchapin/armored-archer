#!/bin/bash
# ============================================
# Full Deployment Automation Script
# Armored Archer - Go Module Deployment
# ============================================
# This script automates the complete deployment process:
# Build → Transfer → Deploy → Verify
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
ALPHA_SERVER="${ALPHA_SERVER:-alpha.armored-archer.com}"
ALPHA_USER="${ALPHA_USER:-deploy}"
ALPHA_PORT="${ALPHA_PORT:-22}"
REMOTE_BASE_DIR="/opt/nakama"
REMOTE_MODULE_DIR="$REMOTE_BASE_DIR/modules"
LOCAL_BUILD_DIR="build"
LOCAL_MODULE_FILE="server.so"
DEPLOYMENT_MODE="docker"  # docker or systemd
BACKUP_ENABLED=true
RUN_PRE_CHECKS=true
RUN_HEALTH_CHECK=true
SKIP_BUILD=false

# Deployment state
DEPLOYMENT_START=$(date +%s)
DEPLOYMENT_SUCCESS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--server)
            ALPHA_SERVER="$2"
            shift 2
            ;;
        -u|--user)
            ALPHA_USER="$2"
            shift 2
            ;;
        -p|--port)
            ALPHA_PORT="$2"
            shift 2
            ;;
        --mode)
            DEPLOYMENT_MODE="$2"
            shift 2
            ;;
        --no-backup)
            BACKUP_ENABLED=false
            shift
            ;;
        --no-pre-checks)
            RUN_PRE_CHECKS=false
            shift
            ;;
        --no-health-check)
            RUN_HEALTH_CHECK=false
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Automated deployment of Go module to alpha server"
            echo ""
            echo "Options:"
            echo "  -s, --server SERVER     Alpha server hostname (default: alpha.armored-archer.com)"
            echo "  -u, --user USER         SSH user (default: deploy)"
            echo "  -p, --port PORT         SSH port (default: 22)"
            echo "  --mode MODE             Deployment mode: docker or systemd (default: docker)"
            echo "  --no-backup             Skip backup of existing module"
            echo "  --no-pre-checks         Skip pre-deployment checks"
            echo "  --no-health-check       Skip post-deployment health check"
            echo "  --skip-build            Skip build step (use existing build)"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

SSH_HOST="$ALPHA_USER@$ALPHA_SERVER"
SSH_OPTS="-p $ALPHA_PORT -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Armored Archer - Automated Deployment${NC}"
echo -e "${BLUE}  Go Module to Alpha Server${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Server:  ${CYAN}$ALPHA_SERVER${NC}"
echo -e "User:    ${CYAN}$ALPHA_USER${NC}"
echo -e "Mode:    ${CYAN}$DEPLOYMENT_MODE${NC}"
echo ""

# Function to log messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_phase() {
    echo ""
    echo -e "${MAGENTA}============================================${NC}"
    echo -e "${MAGENTA}  Phase: $1${NC}"
    echo -e "${MAGENTA}============================================${NC}"
    echo ""
}

# Cleanup on failure
cleanup_on_failure() {
    log_error "Deployment failed!"
    
    if [ "$BACKUP_ENABLED" = true ] && [ -n "${BACKUP_FILE:-}" ]; then
        log_info "Rollback available: $BACKUP_FILE"
        log_info "To rollback: ssh $SSH_HOST 'sudo cp $BACKUP_FILE $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE && sudo systemctl restart nakama'"
    fi
    
    exit 1
}

trap cleanup_on_failure ERR

# Phase 1: Pre-Deployment Checks
if [ "$RUN_PRE_CHECKS" = true ]; then
    log_phase "1 - Pre-Deployment Checks"
    
    if [ -x "scripts/pre-deployment-check.sh" ]; then
        log_info "Running pre-deployment checks..."
        if ! ./scripts/pre-deployment-check.sh --quiet; then
            log_error "Pre-deployment checks failed"
            exit 1
        fi
        log_success "Pre-deployment checks passed"
    else
        log_warn "Pre-deployment check script not found, skipping..."
    fi
else
    log_phase "1 - Pre-Deployment Checks (Skipped)"
fi

# Phase 2: Build Go Module
log_phase "2 - Building Go Module"

if [ "$SKIP_BUILD" = true ]; then
    log_info "Skipping build step (using existing build)"
    if [ ! -f "$LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE" ]; then
        log_error "Build file not found: $LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE"
        exit 1
    fi
    log_success "Using existing build: $LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE"
else
    log_info "Building Go module..."
    if [ -x "scripts/build-production.sh" ]; then
        if ! ./scripts/build-production.sh; then
            log_error "Build failed"
            exit 1
        fi
        log_success "Build completed successfully"
    else
        log_error "Build script not found or not executable"
        exit 1
    fi
fi

# Verify build exists
if [ ! -f "$LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE" ]; then
    log_error "Build output not found"
    exit 1
fi

LOCAL_CHECKSUM=$(sha256sum "$LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE" | awk '{print $1}')
log_info "Build checksum: $LOCAL_CHECKSUM"

# Phase 3: Transfer to Server
log_phase "3 - Transferring to Alpha Server"

log_step "Testing SSH connection..."
if ! ssh $SSH_OPTS "$SSH_HOST" "echo 'Connection successful'" > /dev/null 2>&1; then
    log_error "Failed to connect to $ALPHA_SERVER via SSH"
    exit 1
fi
log_success "SSH connection established"

log_step "Preparing remote directory..."
ssh $SSH_OPTS "$SSH_HOST" "mkdir -p $REMOTE_MODULE_DIR" || {
    log_error "Failed to create remote module directory"
    exit 1
}

# Backup existing module
if [ "$BACKUP_ENABLED" = true ]; then
    log_step "Creating backup of existing module..."
    if ssh $SSH_OPTS "$SSH_HOST" "[ -f $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE ]"; then
        BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_FILE="$REMOTE_MODULE_DIR/${LOCAL_MODULE_FILE}.backup.$BACKUP_TIMESTAMP"
        ssh $SSH_OPTS "$SSH_HOST" "cp $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE $BACKUP_FILE" && \
            log_success "Backup created: $BACKUP_FILE" || \
            log_warn "Failed to create backup"
    else
        log_info "No existing module found, skipping backup"
    fi
fi

log_step "Transferring module..."
TRANSFER_START=$(date +%s)
scp $SSH_OPTS "$LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE" "$SSH_HOST:$REMOTE_MODULE_DIR/" || {
    log_error "Transfer failed"
    exit 1
}
TRANSFER_END=$(date +%s)
TRANSFER_TIME=$((TRANSFER_END - TRANSFER_START))
log_success "Transfer completed in ${TRANSFER_TIME}s"

log_step "Verifying file integrity..."
REMOTE_CHECKSUM=$(ssh $SSH_OPTS "$SSH_HOST" "sha256sum $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE" | awk '{print $1}')
if [ "$LOCAL_CHECKSUM" = "$REMOTE_CHECKSUM" ]; then
    log_success "Checksum verification passed"
else
    log_error "Checksum mismatch!"
    log_info "Local:  $LOCAL_CHECKSUM"
    log_info "Remote: $REMOTE_CHECKSUM"
    exit 1
fi

log_step "Setting permissions..."
ssh $SSH_OPTS "$SSH_HOST" "chmod 755 $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE" && \
    log_success "Permissions set" || \
    log_warn "Failed to set permissions"

ssh $SSH_OPTS "$SSH_HOST" "sudo chown nakama:nakama $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE" 2>/dev/null && \
    log_success "Ownership set to nakama:nakama" || \
    log_warn "Could not set ownership (may require manual intervention)"

# Phase 4: Deploy and Restart Nakama
log_phase "4 - Deploying Go Module"

if [ "$DEPLOYMENT_MODE" = "docker" ]; then
    log_info "Docker deployment mode"
    
    log_step "Updating Nakama configuration..."
    # Check if alpha config exists on server
    if ssh $SSH_OPTS "$SSH_HOST" "[ -f /opt/nakama/data/nakama.alpha.yml ]"; then
        log_success "Alpha configuration found on server"
    else
        log_info "Copying alpha configuration to server..."
        scp $SSH_OPTS "data/nakama.alpha.yml" "$SSH_HOST:/opt/nakama/data/nakama.alpha.yml" 2>/dev/null || \
            log_warn "Failed to copy alpha config (may already exist)"
    fi
    
    log_step "Restarting Nakama container..."
    ssh $SSH_OPTS "$SSH_HOST" "cd /opt/armored-archer/backend && docker-compose -f docker-compose.yml -f docker-compose.alpha.yml restart nakama" || {
        log_warn "Docker Compose restart failed, trying docker restart..."
        ssh $SSH_OPTS "$SSH_HOST" "docker restart armored_archer_alpha" || {
            log_error "Failed to restart Nakama container"
            exit 1
        }
    }
    log_success "Nakama container restarted"
    
elif [ "$DEPLOYMENT_MODE" = "systemd" ]; then
    log_info "Systemd deployment mode"
    
    log_step "Restarting Nakama service..."
    ssh $SSH_OPTS "$SSH_HOST" "sudo systemctl restart nakama" || {
        log_error "Failed to restart Nakama service"
        exit 1
    }
    log_success "Nakama service restarted"
else
    log_error "Unknown deployment mode: $DEPLOYMENT_MODE"
    exit 1
fi

# Phase 5: Wait for Startup
log_phase "5 - Waiting for Nakama Startup"

log_info "Waiting for Nakama to start (30 seconds)..."
sleep 30

log_step "Checking Nakama status..."
if [ "$DEPLOYMENT_MODE" = "docker" ]; then
    CONTAINER_STATUS=$(ssh $SSH_OPTS "$SSH_HOST" "docker inspect -f '{{.State.Status}}' armored_archer_alpha" 2>/dev/null || echo "unknown")
    if [ "$CONTAINER_STATUS" = "running" ]; then
        log_success "Nakama container is running"
    else
        log_error "Nakama container is not running: $CONTAINER_STATUS"
        log_info "Check logs: ssh $SSH_HOST 'docker logs armored_archer_alpha'"
        exit 1
    fi
elif [ "$DEPLOYMENT_MODE" = "systemd" ]; then
    SERVICE_STATUS=$(ssh $SSH_OPTS "$SSH_HOST" "systemctl is-active nakama" 2>/dev/null || echo "inactive")
    if [ "$SERVICE_STATUS" = "active" ]; then
        log_success "Nakama service is active"
    else
        log_error "Nakama service is not active: $SERVICE_STATUS"
        log_info "Check logs: ssh $SSH_HOST 'sudo journalctl -u nakama -n 50'"
        exit 1
    fi
fi

# Phase 6: Verify Module Load
log_phase "6 - Verifying Module Load"

log_step "Checking module initialization logs..."
if [ "$DEPLOYMENT_MODE" = "docker" ]; then
    MODULE_LOGS=$(ssh $SSH_OPTS "$SSH_HOST" "docker logs armored_archer_alpha 2>&1 | grep -i 'armored archer'" | tail -5)
else
    MODULE_LOGS=$(ssh $SSH_OPTS "$SSH_HOST" "sudo journalctl -u nakama -n 100 2>&1 | grep -i 'armored archer'" | tail -5)
fi

if echo "$MODULE_LOGS" | grep -q "Backend Ready"; then
    log_success "Go module initialized successfully"
    echo "$MODULE_LOGS" | while read -r line; do
        log_info "  $line"
    done
elif echo "$MODULE_LOGS" | grep -q "Armored Archer"; then
    log_warn "Module initialization in progress or partial"
    echo "$MODULE_LOGS" | while read -r line; do
        log_info "  $line"
    done
else
    log_error "Module initialization not found in logs"
    log_info "Check logs manually: ssh $SSH_HOST 'docker logs armored_archer_alpha | tail -100'"
    exit 1
fi

# Phase 7: Health Check
if [ "$RUN_HEALTH_CHECK" = true ]; then
    log_phase "7 - Running Health Check"
    
    log_step "Testing health endpoint..."
    HEALTH_RESPONSE=$(ssh $SSH_OPTS "$SSH_HOST" "curl -s http://localhost:7350/health" 2>/dev/null || echo "")
    
    if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
        log_success "Health endpoint responding"
        log_info "Response: $HEALTH_RESPONSE"
    else
        log_warn "Health endpoint not responding as expected"
        log_info "Response: $HEALTH_RESPONSE"
    fi
    
    log_step "Checking API responsiveness..."
    API_RESPONSE=$(ssh $SSH_OPTS "$SSH_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:7350/health" 2>/dev/null || echo "000")
    
    if [ "$API_RESPONSE" = "200" ]; then
        log_success "API responding with HTTP 200"
    else
        log_warn "API returned HTTP $API_RESPONSE"
    fi
else
    log_phase "7 - Health Check (Skipped)"
fi

# Deployment Summary
DEPLOYMENT_END=$(date +%s)
TOTAL_TIME=$((DEPLOYMENT_END - DEPLOYMENT_START))

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}  Deployment Completed Successfully!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Server:        ${CYAN}$ALPHA_SERVER${NC}"
echo -e "Mode:          ${CYAN}$DEPLOYMENT_MODE${NC}"
echo -e "Total Time:    ${GREEN}${TOTAL_TIME}s${NC}"
echo -e "Module:        ${GREEN}$REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE${NC}"
echo -e "Status:        ${GREEN}Running${NC}"
echo ""

if [ "$BACKUP_ENABLED" = true ] && [ -n "${BACKUP_FILE:-}" ]; then
    echo -e "${YELLOW}Rollback:${NC}"
    echo "  ssh $SSH_HOST 'sudo cp $BACKUP_FILE $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE'"
    echo "  ssh $SSH_HOST 'sudo systemctl restart nakama'"
    echo ""
fi

echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Run verification: ./scripts/verify-module-load.sh --server $ALPHA_SERVER"
echo "  2. Run health check: ./scripts/health-check.sh --server $ALPHA_SERVER"
echo "  3. Monitor logs: ssh $SSH_HOST 'docker logs -f armored_archer_alpha'"
echo ""

DEPLOYMENT_SUCCESS=true

exit 0
