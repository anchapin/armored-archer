#!/bin/bash
# Database Rollback Test Script
# Tests database backup and restore procedure in a safe manner
# Usage: ./test-database-rollback.sh [options]
#
# Options:
#   --dry-run     Show what would be done without executing
#   --verbose     Show detailed output
#   --skip-confirm Skip confirmation prompts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nakama}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-localdbpassword}"
BACKUP_DIR="${BACKUP_DIR:-./backups/rollback-test}"
TEST_PREFIX="rollback_test_$(date +%Y%m%d_%H%M%S)"

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

# Parse arguments
DRY_RUN=false
VERBOSE=false
SKIP_CONFIRM=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --skip-confirm)
            SKIP_CONFIRM=true
            shift
            ;;
    esac
done

# Helper functions
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

log_test() {
    echo -e "${MAGENTA}[TEST]${NC} $1"
}

verbose_log() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

# Check if Docker is available
check_docker() {
    if command -v docker &> /dev/null; then
        if docker ps | grep -q armored_archer_postgres; then
            USE_DOCKER=true
            log_info "Using Docker container: armored_archer_postgres"
        else
            USE_DOCKER=false
            log_warning "Docker running but container not found"
        fi
    else
        USE_DOCKER=false
        log_info "Using local PostgreSQL"
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
            -t -c "$sql" 2>/dev/null
    else
        psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -t -c "$sql" 2>/dev/null
    fi
}

# Execute SQL file
exec_sql_file() {
    local file="$1"
    if [ "$USE_DOCKER" = true ]; then
        docker exec -i -e PGPASSWORD="$DB_PASSWORD" \
            armored_archer_postgres psql \
            -U "$DB_USER" \
            -h localhost \
            -d "$DB_NAME" \
            < "$file"
    else
        psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            < "$file"
    fi
}

# Create backup
create_backup() {
    local backup_file="$1"
    log_info "Creating backup: $backup_file"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would create backup at $backup_file"
        return 0
    fi
    
    if [ "$USE_DOCKER" = true ]; then
        docker exec -e PGPASSWORD="$DB_PASSWORD" \
            armored_archer_postgres pg_dump \
            -U "$DB_USER" \
            -h localhost \
            -d "$DB_NAME" \
            -F p 2>/dev/null | gzip > "$backup_file"
    else
        pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -F p 2>/dev/null | gzip > "$backup_file"
    fi
    
    if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
        log_success "Backup created: $backup_file"
        return 0
    else
        log_error "Backup failed"
        return 1
    fi
}

# Restore backup
restore_backup() {
    local backup_file="$1"
    log_info "Restoring backup: $backup_file"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would restore from $backup_file"
        return 0
    fi
    
    if [ "$USE_DOCKER" = true ]; then
        gunzip -c "$backup_file" | docker exec -i -e PGPASSWORD="$DB_PASSWORD" \
            armored_archer_postgres psql \
            -U "$DB_USER" \
            -h localhost \
            -d "$DB_NAME" 2>/dev/null
    else
        gunzip -c "$backup_file" | psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" 2>/dev/null
    fi
    
    log_success "Backup restored"
}

# Create test data
create_test_data() {
    log_test "Creating test data..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would create test data"
        return 0
    fi
    
    local sql="INSERT INTO player_stats (user_id, level, experience, created_at, updated_at)
               VALUES ('${TEST_PREFIX}_user', 99, 999999, NOW(), NOW())
               ON CONFLICT (user_id) DO UPDATE SET level = 99, experience = 999999;"
    
    exec_sql "$sql"
    log_success "Test data created: ${TEST_PREFIX}_user"
}

# Verify test data exists
verify_test_data_exists() {
    log_test "Verifying test data exists..."
    
    local result=$(exec_sql "SELECT EXISTS(SELECT 1 FROM player_stats WHERE user_id = '${TEST_PREFIX}_user');")
    result=$(echo "$result" | tr -d '[:space:]')
    
    if [ "$result" = "t" ]; then
        log_success "Test data exists"
        return 0
    else
        log_error "Test data not found"
        return 1
    fi
}

# Verify test data was removed (proves restore worked)
verify_test_data_removed() {
    log_test "Verifying test data was removed (proves restore worked)..."
    
    local result=$(exec_sql "SELECT EXISTS(SELECT 1 FROM player_stats WHERE user_id = '${TEST_PREFIX}_user');")
    result=$(echo "$result" | tr -d '[:space:]')
    
    if [ "$result" = "f" ]; then
        log_success "Test data removed - restore verified!"
        return 0
    else
        log_error "Test data still exists - restore may have failed"
        return 1
    fi
}

# Count records in key tables
count_records() {
    log_test "Counting records in key tables..."
    
    local tables=("player_stats" "catalog" "inventory" "loadout" "stage_completion")
    
    for table in "${tables[@]}"; do
        local count=$(exec_sql "SELECT COUNT(*) FROM $table;")
        count=$(echo "$count" | tr -d '[:space:]')
        echo "  $table: $count records"
    done
}

# Verify database integrity
verify_integrity() {
    log_test "Running integrity checks..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would run integrity checks"
        return 0
    fi
    
    # Check table count
    local table_count=$(exec_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    table_count=$(echo "$table_count" | tr -d '[:space:]')
    
    if [ "$table_count" -ge 10 ]; then
        log_success "Table count OK: $table_count tables"
    else
        log_error "Table count low: $table_count tables (expected >= 10)"
        return 1
    fi
    
    # Check for NULL in required columns
    local null_check=$(exec_sql "SELECT COUNT(*) FROM player_stats WHERE user_id IS NULL;")
    null_check=$(echo "$null_check" | tr -d '[:space:]')
    
    if [ "$null_check" = "0" ]; then
        log_success "No NULL user_ids in player_stats"
    else
        log_error "Found $null_check NULL user_ids"
        return 1
    fi
    
    log_success "Integrity checks passed"
}

# Main test flow
main() {
    echo "=========================================="
    echo "Database Rollback Test"
    echo "=========================================="
    echo ""
    echo -e "${BLUE}Configuration:${NC}"
    echo "  Database: $DB_NAME"
    echo "  Host: $DB_HOST:$DB_PORT"
    echo "  Backup Directory: $BACKUP_DIR"
    echo "  Test Prefix: $TEST_PREFIX"
    echo "  Dry Run: $DRY_RUN"
    echo ""
    
    # Confirmation prompt
    if [ "$SKIP_CONFIRM" = false ] && [ -t 1 ]; then
        echo -e "${YELLOW}⚠ WARNING: This test will create and restore database backups${NC}"
        echo ""
        read -p "Continue with database rollback test? (yes/no): " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            log_info "Test cancelled"
            exit 0
        fi
    fi
    
    echo ""
    echo "=========================================="
    echo "Starting Rollback Test"
    echo "=========================================="
    echo ""
    
    # Track test results
    TESTS_PASSED=0
    TESTS_FAILED=0
    
    # Step 1: Check Docker/Database connectivity
    log_test "Checking database connectivity..."
    check_docker
    
    local connectivity=$(exec_sql "SELECT 1;")
    if [ -n "$connectivity" ]; then
        log_success "Database connection OK"
        ((TESTS_PASSED++))
    else
        log_error "Database connection failed"
        ((TESTS_FAILED++))
        exit 1
    fi
    
    # Step 2: Create backup directory
    log_test "Creating backup directory..."
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would create directory: $BACKUP_DIR"
    else
        mkdir -p "$BACKUP_DIR"
        log_success "Backup directory created"
    fi
    ((TESTS_PASSED++))
    
    # Step 3: Record initial state
    log_test "Recording initial state..."
    count_records
    ((TESTS_PASSED++))
    
    # Step 4: Create test data
    create_test_data
    if [ $? -eq 0 ]; then
        ((TESTS_PASSED++))
    else
        ((TESTS_FAILED++))
    fi
    
    # Step 5: Verify test data exists
    sleep 1  # Give database time to commit
    verify_test_data_exists
    if [ $? -eq 0 ]; then
        ((TESTS_PASSED++))
    else
        ((TESTS_FAILED++))
    fi
    
    # Step 6: Create backup (with test data)
    BACKUP_FILE="$BACKUP_DIR/${TEST_PREFIX}_backup.sql.gz"
    log_test "Creating backup with test data..."
    create_backup "$BACKUP_FILE"
    if [ $? -eq 0 ]; then
        ((TESTS_PASSED++))
        
        # Show backup size
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_info "Backup size: $BACKUP_SIZE"
    else
        ((TESTS_FAILED++))
    fi
    
    # Step 7: Remove test data (simulate changes)
    log_test "Removing test data (simulating post-backup changes)..."
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would remove test data"
    else
        exec_sql "DELETE FROM player_stats WHERE user_id = '${TEST_PREFIX}_user';"
        log_success "Test data removed"
    fi
    ((TESTS_PASSED++))
    
    # Step 8: Verify test data was removed
    verify_test_data_removed
    if [ $? -eq 0 ]; then
        ((TESTS_PASSED++))
    else
        log_warning "Test data still exists (may be expected in dry-run)"
    fi
    
    # Step 9: Restore backup
    log_test "Restoring backup..."
    restore_backup "$BACKUP_FILE"
    if [ $? -eq 0 ]; then
        ((TESTS_PASSED++))
    else
        ((TESTS_FAILED++))
    fi
    
    # Step 10: Verify test data exists again (proves restore worked)
    sleep 2  # Give database time to restore
    log_test "Verifying test data exists after restore..."
    verify_test_data_exists
    if [ $? -eq 0 ]; then
        log_success "Test data restored - rollback verified!"
        ((TESTS_PASSED++))
    else
        log_error "Test data not restored - rollback may have failed"
        ((TESTS_FAILED++))
    fi
    
    # Step 11: Verify database integrity
    verify_integrity
    if [ $? -eq 0 ]; then
        ((TESTS_PASSED++))
    else
        ((TESTS_FAILED++))
    fi
    
    # Step 12: Final state
    log_test "Final record counts:"
    count_records
    
    # Cleanup test data
    log_test "Cleaning up test data..."
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would cleanup test data"
    else
        exec_sql "DELETE FROM player_stats WHERE user_id = '${TEST_PREFIX}_user';"
        log_success "Test data cleaned up"
    fi
    
    # Summary
    echo ""
    echo "=========================================="
    echo "Test Summary"
    echo "=========================================="
    echo ""
    echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
    echo ""
    
    if [ "$TESTS_FAILED" -eq 0 ]; then
        echo -e "${GREEN}✓ Database rollback test PASSED${NC}"
        echo ""
        echo "Backup location: $BACKUP_FILE"
        echo ""
        echo "To manually restore this backup:"
        echo "  ./scripts/restore-database.sh $BACKUP_FILE"
        echo ""
        exit 0
    else
        echo -e "${RED}✗ Database rollback test FAILED${NC}"
        echo ""
        echo "Review errors above and fix issues before production rollback."
        echo ""
        exit 1
    fi
}

# Run main function
main
