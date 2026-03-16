#!/bin/bash
# Automated Rollback Script for Armored Archer Backend
# Rolls back from Go backend to TypeScript backend
# Usage: ./rollback-automated.sh [options]
#
# Options:
#   --module-only     Rollback module only (no database restore)
#   --full            Full rollback including database restore
#   --dry-run         Show what would be done without executing
#   --force           Skip confirmation prompts
#   --verbose         Show detailed output
#   --test-mode       Run in test mode (no actual changes)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
NAKAMA_DIR="${NAKAMA_DIR:-/opt/nakama}"
BACKUP_DIR="${NAKAMA_DIR}/backup"
MODULES_DIR="${NAKAMA_DIR}/modules"
CONFIG_DIR="/etc/nakama"
LOG_DIR="${NAKAMA_DIR}/logs"
ROLLBACK_LOG="$LOG_DIR/rollback_$(date +%Y%m%d_%H%M%S).log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nakama}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Parse arguments
ROLLBACK_TYPE="full"
DRY_RUN=false
FORCE=false
VERBOSE=false
TEST_MODE=false

for arg in "$@"; do
    case $arg in
        --module-only)
            ROLLBACK_TYPE="module"
            shift
            ;;
        --full)
            ROLLBACK_TYPE="full"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --test-mode)
            TEST_MODE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --module-only   Rollback module only (no database restore)"
            echo "  --full          Full rollback including database restore"
            echo "  --dry-run       Show what would be done without executing"
            echo "  --force         Skip confirmation prompts"
            echo "  --verbose       Show detailed output"
            echo "  --test-mode     Run in test mode (no actual changes)"
            echo "  --help          Show this help message"
            exit 0
            ;;
    esac
done

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_line="[$timestamp] [$level] $message"
    
    # Log to file
    echo "$log_line" >> "$ROLLBACK_LOG" 2>/dev/null || true
    
    # Log to console based on level
    case $level in
        INFO)
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
        SUCCESS)
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
        WARNING)
            echo -e "${YELLOW}[WARNING]${NC} $message"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        STEP)
            echo -e "${MAGENTA}[STEP]${NC} $message"
            ;;
        *)
            echo "$message"
            ;;
    esac
}

verbose_log() {
    if [ "$VERBOSE" = true ]; then
        log "VERBOSE" "$1"
    fi
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ] && [ "$TEST_MODE" = false ] && [ "$DRY_RUN" = false ]; then
        log "ERROR" "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log "STEP" "Checking prerequisites..."
    
    local errors=0
    
    # Check TypeScript backup exists
    if [ ! -f "$BACKUP_DIR/server.ts" ]; then
        log "ERROR" "TypeScript backup not found: $BACKUP_DIR/server.ts"
        errors=$((errors + 1))
    else
        log "SUCCESS" "TypeScript backup found"
    fi
    
    # Check backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        log "ERROR" "Backup directory not found: $BACKUP_DIR"
        errors=$((errors + 1))
    else
        log "SUCCESS" "Backup directory exists"
    fi
    
    # Check Nakama service exists
    if ! systemctl list-unit-files | grep -q nakama; then
        log "WARNING" "Nakama systemd service not found"
    else
        log "SUCCESS" "Nakama service found"
    fi
    
    # Check database backup (for full rollback)
    if [ "$ROLLBACK_TYPE" = "full" ]; then
        local latest_backup=$(ls -t "$BACKUP_DIR"/nakama_backup_*.sql.gz 2>/dev/null | head -1)
        if [ -z "$latest_backup" ]; then
            log "WARNING" "No database backup found in $BACKUP_DIR"
        else
            log "SUCCESS" "Database backup found: $latest_backup"
        fi
    fi
    
    if [ $errors -gt 0 ]; then
        log "ERROR" "Prerequisites check failed with $errors errors"
        return 1
    fi
    
    log "SUCCESS" "Prerequisites check passed"
    return 0
}

# Stop Nakama service
stop_nakama() {
    log "STEP" "Stopping Nakama service..."
    
    if [ "$DRY_RUN" = true ] || [ "$TEST_MODE" = true ]; then
        log "INFO" "[DRY-RUN] Would stop Nakama service"
        return 0
    fi
    
    if systemctl stop nakama 2>/dev/null; then
        log "SUCCESS" "Nakama service stopped"
        sleep 2
        return 0
    else
        log "WARNING" "Failed to stop Nakama via systemctl, trying direct kill"
        pkill -f nakama || true
        sleep 2
        return 0
    fi
}

# Backup current Go module
backup_current_module() {
    log "STEP" "Backing up current Go module..."
    
    local backup_file="$MODULES_DIR/server.so.backup.$TIMESTAMP"
    
    if [ "$DRY_RUN" = true ] || [ "$TEST_MODE" = true ]; then
        log "INFO" "[DRY-RUN] Would backup $MODULES_DIR/server.so to $backup_file"
        return 0
    fi
    
    if [ -f "$MODULES_DIR/server.so" ]; then
        cp "$MODULES_DIR/server.so" "$backup_file"
        log "SUCCESS" "Go module backed up to: $backup_file"
    else
        log "WARNING" "No Go module found at $MODULES_DIR/server.so"
    fi
}

# Restore TypeScript module
restore_typescript_module() {
    log "STEP" "Restoring TypeScript module..."
    
    if [ "$DRY_RUN" = true ] || [ "$TEST_MODE" = true ]; then
        log "INFO" "[DRY-RUN] Would copy $BACKUP_DIR/server.ts to $MODULES_DIR/server"
        return 0
    fi
    
    # Copy TypeScript module
    cp "$BACKUP_DIR/server.ts" "$MODULES_DIR/server"
    
    # Set permissions
    chmod 644 "$MODULES_DIR/server"
    
    log "SUCCESS" "TypeScript module restored"
}

# Restore configuration
restore_configuration() {
    log "STEP" "Restoring configuration..."
    
    if [ "$DRY_RUN" = true ] || [ "$TEST_MODE" = true ]; then
        log "INFO" "[DRY-RUN] Would restore configuration from $BACKUP_DIR/config.yml"
        return 0
    fi
    
    if [ -f "$BACKUP_DIR/config.yml" ]; then
        cp "$BACKUP_DIR/config.yml" "$CONFIG_DIR/config.yml"
        log "SUCCESS" "Configuration restored"
    else
        log "WARNING" "No config backup found, skipping config restore"
    fi
}

# Restore database
restore_database() {
    log "STEP" "Restoring database..."
    
    if [ "$DRY_RUN" = true ] || [ "$TEST_MODE" = true ]; then
        log "INFO" "[DRY-RUN] Would restore database from latest backup"
        return 0
    fi
    
    # Find latest backup
    local latest_backup=$(ls -t "$BACKUP_DIR"/nakama_backup_*.sql.gz 2>/dev/null | head -1)
    
    if [ -z "$latest_backup" ]; then
        log "ERROR" "No database backup found"
        return 1
    fi
    
    log "INFO" "Restoring from: $latest_backup"
    
    # Verify checksum if available
    local checksum_file="${latest_backup}.sha256"
    if [ -f "$checksum_file" ]; then
        log "INFO" "Verifying checksum..."
        if sha256sum -c "$checksum_file" > /dev/null 2>&1; then
            log "SUCCESS" "Checksum verified"
        else
            log "ERROR" "Checksum verification failed"
            return 1
        fi
    fi
    
    # Check if using Docker
    if command -v docker &> /dev/null && docker ps | grep -q armored_archer_postgres; then
        log "INFO" "Using Docker container for restore"
        gunzip -c "$latest_backup" | docker exec -i -e PGPASSWORD="$DB_PASSWORD" \
            armored_archer_postgres psql \
            -U "$DB_USER" \
            -h localhost \
            -d "$DB_NAME" 2>/dev/null
    else
        log "INFO" "Using local psql for restore"
        export PGPASSWORD="$DB_PASSWORD"
        gunzip -c "$latest_backup" | psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" 2>/dev/null
    fi
    
    log "SUCCESS" "Database restored"
}

# Start Nakama service
start_nakama() {
    log "STEP" "Starting Nakama service..."
    
    if [ "$DRY_RUN" = true ] || [ "$TEST_MODE" = true ]; then
        log "INFO" "[DRY-RUN] Would start Nakama service"
        return 0
    fi
    
    if systemctl start nakama 2>/dev/null; then
        log "SUCCESS" "Nakama service started"
        sleep 5
        return 0
    else
        log "WARNING" "Failed to start Nakama via systemctl"
        return 1
    fi
}

# Verify Nakama health
verify_health() {
    log "STEP" "Verifying Nakama health..."
    
    if [ "$DRY_RUN" = true ] || [ "$TEST_MODE" = true ]; then
        log "INFO" "[DRY-RUN] Would verify health endpoint"
        return 0
    fi
    
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        attempt=$((attempt + 1))
        log "INFO" "Health check attempt $attempt/$max_attempts"
        
        if curl -f -s http://localhost:7350/health > /dev/null 2>&1; then
            log "SUCCESS" "Health check passed"
            return 0
        fi
        
        sleep 3
    done
    
    log "ERROR" "Health check failed after $max_attempts attempts"
    return 1
}

# Verify TypeScript module loaded
verify_typescript_loaded() {
    log "STEP" "Verifying TypeScript module loaded..."
    
    if [ "$DRY_RUN" = true ] || [ "$TEST_MODE" = true ]; then
        log "INFO" "[DRY-RUN] Would verify TypeScript module loaded"
        return 0
    fi
    
    # Check logs for TypeScript initialization
    if journalctl -u nakama -n 100 --no-pager | grep -qi "typescript"; then
        log "SUCCESS" "TypeScript module detected in logs"
        return 0
    else
        log "WARNING" "TypeScript not explicitly mentioned in recent logs"
        return 0  # Don't fail on this
    fi
}

# Run smoke tests
run_smoke_tests() {
    log "STEP" "Running smoke tests..."
    
    if [ "$DRY_RUN" = true ] || [ "$TEST_MODE" = true ]; then
        log "INFO" "[DRY-RUN] Would run smoke tests"
        return 0
    fi
    
    # Check if smoke test script exists
    if [ -f "./scripts/run-smoke-tests.sh" ]; then
        if ./scripts/run-smoke-tests.sh --quick 2>/dev/null; then
            log "SUCCESS" "Smoke tests passed"
            return 0
        else
            log "WARNING" "Smoke tests failed or timed out"
            return 1
        fi
    else
        log "WARNING" "Smoke test script not found"
        return 0
    fi
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    log "INFO" "Notification: [$status] $message"
    
    # TODO: Integrate with Slack/PagerDuty/Email
    # Example: curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"$message\"}" \
    #   $SLACK_WEBHOOK_URL
}

# Main rollback function
main() {
    echo "=========================================="
    echo "Automated Rollback Script"
    echo "=========================================="
    echo ""
    echo -e "${CYAN}Configuration:${NC}"
    echo "  Rollback Type: $ROLLBACK_TYPE"
    echo "  Nakama Directory: $NAKAMA_DIR"
    echo "  Backup Directory: $BACKUP_DIR"
    echo "  Log File: $ROLLBACK_LOG"
    echo "  Dry Run: $DRY_RUN"
    echo "  Test Mode: $TEST_MODE"
    echo "  Force: $FORCE"
    echo ""
    
    # Create log directory
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    
    # Start logging
    log "INFO" "Rollback script started"
    log "INFO" "Rollback type: $ROLLBACK_TYPE"
    
    # Check root
    check_root
    
    # Confirmation prompt
    if [ "$FORCE" = false ] && [ -t 1 ] && [ "$TEST_MODE" = false ] && [ "$DRY_RUN" = false ]; then
        echo ""
        echo -e "${YELLOW}⚠ WARNING: This will rollback the backend from Go to TypeScript${NC}"
        echo ""
        if [ "$ROLLBACK_TYPE" = "full" ]; then
            echo -e "${RED}This WILL restore the database from backup!${NC}"
        fi
        echo ""
        read -p "Are you sure you want to continue? (yes/no): " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            log "INFO" "Rollback cancelled by user"
            exit 0
        fi
    fi
    
    echo ""
    echo "=========================================="
    echo "Starting Rollback"
    echo "=========================================="
    echo ""
    
    # Track rollback status
    ROLLBACK_SUCCESS=true
    START_TIME=$(date +%s)
    
    # Step 1: Check prerequisites
    check_prerequisites
    if [ $? -ne 0 ]; then
        log "ERROR" "Prerequisites check failed"
        exit 1
    fi
    
    # Step 2: Stop Nakama
    stop_nakama
    
    # Step 3: Backup current module
    backup_current_module
    
    # Step 4: Restore TypeScript module
    restore_typescript_module
    
    # Step 5: Restore configuration
    restore_configuration
    
    # Step 6: Restore database (if full rollback)
    if [ "$ROLLBACK_TYPE" = "full" ]; then
        restore_database
        if [ $? -ne 0 ]; then
            log "ERROR" "Database restore failed"
            ROLLBACK_SUCCESS=false
        fi
    fi
    
    # Step 7: Start Nakama
    start_nakama
    if [ $? -ne 0 ]; then
        log "ERROR" "Failed to start Nakama"
        ROLLBACK_SUCCESS=false
    fi
    
    # Step 8: Verify health
    verify_health
    if [ $? -ne 0 ]; then
        log "ERROR" "Health check failed"
        ROLLBACK_SUCCESS=false
    fi
    
    # Step 9: Verify TypeScript loaded
    verify_typescript_loaded
    
    # Step 10: Run smoke tests
    run_smoke_tests
    
    # Calculate duration
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    # Summary
    echo ""
    echo "=========================================="
    echo "Rollback Summary"
    echo "=========================================="
    echo ""
    
    if [ "$ROLLBACK_SUCCESS" = true ]; then
        log "SUCCESS" "Rollback completed successfully!"
        log "INFO" "Duration: ${DURATION} seconds"
        echo ""
        echo -e "${GREEN}✓ All systems operational${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Monitor Grafana dashboard for anomalies"
        echo "  2. Review logs: tail -f $ROLLBACK_LOG"
        echo "  3. Run full test suite when ready"
        echo "  4. Notify team of successful rollback"
        echo ""
        send_notification "SUCCESS" "Rollback completed successfully in ${DURATION}s"
        exit 0
    else
        log "ERROR" "Rollback completed with errors"
        log "INFO" "Duration: ${DURATION} seconds"
        echo ""
        echo -e "${RED}✗ Rollback encountered issues${NC}"
        echo ""
        echo "Review logs: $ROLLBACK_LOG"
        echo ""
        echo "Troubleshooting:"
        echo "  1. Check Nakama status: systemctl status nakama"
        echo "  2. View logs: journalctl -u nakama -n 100"
        echo "  3. Check health: curl http://localhost:7350/health"
        echo ""
        send_notification "FAILURE" "Rollback completed with errors after ${DURATION}s"
        exit 1
    fi
}

# Run main function
main
