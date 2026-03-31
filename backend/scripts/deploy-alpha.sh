#!/bin/bash
# ============================================
# Alpha Deployment Script
# Armored Archer - Go Module Transfer to Alpha Server
# ============================================
# This script transfers the built Go module to the alpha server
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
ALPHA_SERVER="${ALPHA_SERVER:-alpha.armored-archer.com}"
ALPHA_USER="${ALPHA_USER:-deploy}"
ALPHA_PORT="${ALPHA_PORT:-22}"
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
            echo "Deploy Go module to alpha Nakama server"
            echo ""
            echo "Options:"
            echo "  -s, --server SERVER   Alpha server hostname (default: alpha.armored-archer.com)"
            echo "  -u, --user USER       SSH user (default: deploy)"
            echo "  -p, --port PORT       SSH port (default: 22)"
            echo "  --no-backup           Skip backup of existing module"
            echo "  --no-verify           Skip checksum verification"
            echo "  -h, --help            Show this help message"
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
echo -e "${BLUE}  Armored Archer - Alpha Deployment${NC}"
echo -e "${BLUE}  Go Module Transfer${NC}"
echo -e "${BLUE}============================================${NC}"
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

# Check if local build exists
log_step "Checking for local build..."
if [ ! -f "$LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE" ]; then
    log_error "Module file not found: $LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE"
    log_info "Please build the module first: ./scripts/build-production.sh"
    exit 1
fi

LOCAL_CHECKSUM=$(sha256sum "$LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE" | awk '{print $1}')
log_info "Local checksum: $LOCAL_CHECKSUM"

# Test SSH connection
log_step "Testing SSH connection to $ALPHA_SERVER..."
if ! ssh $SSH_OPTS "$SSH_HOST" "echo 'Connection successful'" > /dev/null 2>&1; then
    log_error "Failed to connect to $ALPHA_SERVER via SSH"
    log_info "Please check:"
    echo "  - Server hostname/IP is correct"
    echo "  - SSH key is configured"
    echo "  - Network connectivity"
    exit 1
fi
log_success "SSH connection established"

# Check remote directory structure
log_step "Checking remote directory structure..."
ssh $SSH_OPTS "$SSH_HOST" "mkdir -p $REMOTE_MODULE_DIR" || {
    log_error "Failed to create remote module directory"
    exit 1
}
log_success "Remote directory ready: $REMOTE_MODULE_DIR"

# Backup existing module if exists
if [ "$BACKUP_ENABLED" = true ]; then
    log_step "Checking for existing module to backup..."
    if ssh $SSH_OPTS "$SSH_HOST" "[ -f $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE ]"; then
        BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_FILE="$REMOTE_MODULE_DIR/${LOCAL_MODULE_FILE}.backup.$BACKUP_TIMESTAMP"
        log_info "Backing up existing module to: $BACKUP_FILE"
        ssh $SSH_OPTS "$SSH_HOST" "cp $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE $BACKUP_FILE" || {
            log_warn "Failed to create backup, continuing anyway..."
        }
        log_success "Backup created"
    else
        log_info "No existing module found, skipping backup"
    fi
fi

# Transfer module
log_step "Transferring module to alpha server..."
TRANSFER_START=$(date +%s)

scp $SSH_OPTS "$LOCAL_BUILD_DIR/$LOCAL_MODULE_FILE" "$SSH_HOST:$REMOTE_MODULE_DIR/" || {
    log_error "Failed to transfer module"
    exit 1
}

TRANSFER_END=$(date +%s)
TRANSFER_TIME=$((TRANSFER_END - TRANSFER_START))

log_success "Transfer completed in ${TRANSFER_TIME}s"

# Verify checksum
if [ "$VERIFY_CHECKSUM" = true ]; then
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
fi

# Set permissions
log_step "Setting file permissions..."
ssh $SSH_OPTS "$SSH_HOST" "chmod 755 $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE" || {
    log_warn "Failed to set permissions"
}

# Try to set ownership (may require sudo)
log_info "Setting file ownership..."
if ssh $SSH_OPTS "$SSH_HOST" "sudo chown nakama:nakama $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE" 2>/dev/null; then
    log_success "Ownership set to nakama:nakama"
else
    log_warn "Could not set ownership (may require manual intervention)"
    log_info "Run manually: sudo chown nakama:nakama $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE"
fi

# Display deployment summary
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}  Deployment Successful!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Server:     ${CYAN}$ALPHA_SERVER${NC}"
echo -e "User:       ${CYAN}$ALPHA_USER${NC}"
echo -e "Port:       ${CYAN}$ALPHA_PORT${NC}"
echo -e "Remote Path:${CYAN}$REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE${NC}"
echo -e "Transfer:   ${GREEN}${TRANSFER_TIME}s${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Update Nakama configuration (if needed)"
echo "  2. Restart Nakama: ssh $SSH_HOST 'sudo systemctl restart nakama'"
echo "  3. Check logs: ssh $SSH_HOST 'sudo journalctl -u nakama -f'"
echo "  4. Run health check: ./scripts/health-check.sh"
echo ""
echo -e "${YELLOW}Rollback (if needed):${NC}"
if [ "$BACKUP_ENABLED" = true ] && [ -n "${BACKUP_FILE:-}" ]; then
    echo "  ssh $SSH_HOST 'sudo cp $BACKUP_FILE $REMOTE_MODULE_DIR/$LOCAL_MODULE_FILE'"
    echo "  ssh $SSH_HOST 'sudo systemctl restart nakama'"
fi
echo ""

exit 0
