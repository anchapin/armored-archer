#!/bin/bash
# ============================================
# Beta Deployment Script
# Armored Archer - Go Module Transfer to Beta Server
# ============================================
# This script transfers the built Go module to the beta server
# and sets up the necessary permissions and configuration.
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
BETA_SERVER="${BETA_SERVER:-beta.armored-archer.com}"
BETA_USER="${BETA_USER:-deploy}"
BETA_PORT="${BETA_PORT:-22}"
REMOTE_BASE_DIR="/opt/nakama"
REMOTE_MODULE_DIR="$REMOTE_BASE_DIR/modules"
LOCAL_BUILD_DIR="build"
LOCAL_MODULE_FILE="server.so"
BACKUP_ENABLED=true
VERIFY_CHECKSUM=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--server)
            BETA_SERVER="$2"
            shift 2
            ;;
        -u|--user)
            BETA_USER="$2"
            shift 2
            ;;
        -p|--port)
            BETA_PORT="$2"
            shift 2
            ;;
        --no-backup)
            BACKUP_ENABLED=false
            shift
            ;;
        --no-verify)
            VERIFY_CHECKSUM=false
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -s, --server SERVER     Beta server hostname (default: beta.armored-archer.com)"
            echo "  -u, --user USER        SSH user (default: deploy)"
            echo "  -p, --port PORT        SSH port (default: 22)"
            echo "  --no-backup            Skip backup before deployment"
            echo "  --no-verify            Skip checksum verification"
            echo "  -h, --help             Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

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

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."
    
    # Check if Go module exists
    if [[ ! -f "$LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE" ]]; then
        log_error "Go module not found at $LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE"
        log_info "Run 'go build' first to create the module"
        exit 1
    fi
    
    # Verify Go module checksum
    if [[ "$VERIFY_CHECKSUM" == "true" ]]; then
        MODULE_CHECKSUM=$(sha256sum "$LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE" | cut -d' ' -f1)
        log_info "Module checksum: $MODULE_CHECKSUM"
    fi
    
    # Check SSH connection
    if ! ssh -o ConnectTimeout=5 -o BatchMode=yes -p "$BETA_PORT" "${BETA_USER}@${BETA_SERVER}" "echo 'Connection OK'" > /dev/null 2>&1; then
        log_error "Cannot connect to beta server $BETA_USER@$BETA_SERVER"
        exit 1
    fi
    
    log_success "Pre-deployment checks passed"
}

# Create backup of existing module
create_backup() {
    if [[ "$BACKUP_ENABLED" != "true" ]]; then
        log_warn "Backup disabled, skipping..."
        return
    fi
    
    log_info "Creating backup of existing module..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="$REMOTE_BASE_DIR/backups"
    
    ssh -p "$BETA_PORT" "${BETA_USER}@${BETA_SERVER}" << EOF
        mkdir -p "$BACKUP_DIR"
        if [[ -f "$REMOTE_MODULE_DIR/server.so" ]]; then
            cp "$REMOTE_MODULE_DIR/server.so" "$BACKUP_DIR/server.so.$TIMESTAMP"
            echo "Backup created: server.so.$TIMESTAMP"
        fi
EOF
    
    log_success "Backup created"
}

# Deploy Go module
deploy_module() {
    log_info "Deploying Go module to beta server..."
    
    # Create remote directory if it doesn't exist
    ssh -p "$BETA_PORT" "${BETA_USER}@${BETA_SERVER}" "mkdir -p $REMOTE_MODULE_DIR"
    
    # Transfer the module
    scp -P "$BETA_PORT" "$LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE" "${BETA_USER}@${BETA_SERVER}:$REMOTE_MODULE_DIR/server.so"
    
    # Set permissions
    ssh -p "$BETA_PORT" "${BETA_USER}@${BETA_SERVER}" "chmod 644 $REMOTE_MODULE_DIR/server.so"
    
    log_success "Module deployed to $REMOTE_MODULE_DIR"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Verify file exists and get checksum
    REMOTE_CHECKSUM=$(ssh -p "$BETA_PORT" "${BETA_USER}@${BETA_SERVER}" "sha256sum $REMOTE_MODULE_DIR/server.so | cut -d' ' -f1")
    
    if [[ "$VERIFY_CHECKSUM" == "true" ]] && [[ "$REMOTE_CHECKSUM" != "$MODULE_CHECKSUM" ]]; then
        log_error "Checksum mismatch! Deployment may be corrupted."
        log_error "Local:  $MODULE_CHECKSUM"
        log_error "Remote: $REMOTE_CHECKSUM"
        exit 1
    fi
    
    log_success "Deployment verified successfully"
}

# Restart Nakama service
restart_nakama() {
    log_info "Restarting Nakama service..."
    
    ssh -p "$BETA_PORT" "${BETA_USER}@${BETA_SERVER}" "sudo systemctl restart nakama"
    
    # Wait for service to start
    sleep 5
    
    # Check service status
    if ssh -p "$BETA_PORT" "${BETA_USER}@${BETA_SERVER}" "systemctl is-active --quiet nakama"; then
        log_success "Nakama service restarted"
    else
        log_error "Failed to restart Nakama service"
        exit 1
    fi
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    BETA_URL="https://${BETA_SERVER}:7350"
    
    # Wait for Nakama to be ready
    MAX_RETRIES=10
    RETRY_COUNT=0
    
    while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
        if curl -sfk "$BETA_URL/health" > /dev/null 2>&1; then
            log_success "Health check passed"
            return 0
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        log_info "Waiting for service... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 3
    done
    
    log_error "Health check failed"
    return 1
}

# Main deployment flow
main() {
    log_info "=========================================="
    log_info "  Beta Deployment Starting"
    log_info "=========================================="
    log_info "Server: $BETA_USER@$BETA_SERVER:$BETA_PORT"
    log_info "Module: $LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE"
    log_info "=========================================="
    
    pre_deployment_checks
    create_backup
    deploy_module
    verify_deployment
    restart_nakama
    
    if run_health_checks; then
        log_success "=========================================="
        log_success "  Beta Deployment Complete!"
        log_success "=========================================="
        log_info "Server: $BETA_SERVER"
        log_info "API: https://$BETA_SERVER:7350"
        log_info "Console: https://$BETA_SERVER:7351"
    else
        log_error "Deployment completed but health checks failed"
        log_info "Check logs: ssh $BETA_USER@$BETA_SERVER 'journalctl -u nakama -n 100'"
        exit 1
    fi
}

main "$@"
