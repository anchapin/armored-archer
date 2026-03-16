#!/bin/bash
# Database Migration Execution Script for Alpha Environment
# Executes all database migrations in order with logging and error handling
# Usage: ./migrate-database.sh [environment]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-alpha}"
MIGRATION_DIR="$(dirname "$0")/../data"
LOG_DIR="$(dirname "$0")/../logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/migration_${TIMESTAMP}.log"

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nakama}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-localdbpassword}"

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

# Create log directory
mkdir -p "$LOG_DIR"

echo "=========================================="
echo "Armored Archer - Database Migration Script"
echo "=========================================="
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Environment: $ENVIRONMENT"
echo "  Database: $DB_NAME"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  User: $DB_USER"
echo "  Migration Directory: $MIGRATION_DIR"
echo "  Log File: $LOG_FILE"
echo ""

# Check if migration directory exists
if [ ! -d "$MIGRATION_DIR" ]; then
    echo -e "${RED}✗ Migration directory not found: $MIGRATION_DIR${NC}"
    exit 1
fi

# Check if Docker is available and container is running
USE_DOCKER=false
if command -v docker &> /dev/null; then
    if docker ps | grep -q armored_archer_postgres; then
        USE_DOCKER=true
        echo -e "${GREEN}✓ Using Docker container: armored_archer_postgres${NC}"
    elif docker ps | grep -q armored_archer_server; then
        # Use Nakama container for migrations
        USE_DOCKER=true
        NAKAMA_CONTAINER=true
        echo -e "${GREEN}✓ Using Nakama container: armored_archer_server${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}⚠ WARNING: This will modify the database schema!${NC}"
echo ""

# Confirmation prompt (skip if not interactive)
if [ -t 1 ]; then
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo -e "${YELLOW}Migration cancelled${NC}"
        exit 0
    fi
fi

# Function to log messages
log() {
    local message="$1"
    echo -e "$message" | tee -a "$LOG_FILE"
}

# Function to run SQL command
run_sql() {
    local query="$1"
    if [ "$USE_DOCKER" = true ] && [ "$NAKAMA_CONTAINER" = true ]; then
        docker exec -i armored_archer_server psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -c "$query" 2>&1 | tee -a "$LOG_FILE"
    elif [ "$USE_DOCKER" = true ]; then
        docker exec -i -e PGPASSWORD="$DB_PASSWORD" \
            armored_archer_postgres psql \
            -U "$DB_USER" \
            -h localhost \
            -d "$DB_NAME" \
            -c "$query" 2>&1 | tee -a "$LOG_FILE"
    else
        psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -c "$query" 2>&1 | tee -a "$LOG_FILE"
    fi
}

# Function to run SQL file
run_sql_file() {
    local file="$1"
    if [ "$USE_DOCKER" = true ] && [ "$NAKAMA_CONTAINER" = true ]; then
        docker exec -i armored_archer_server psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -f "$file" 2>&1 | tee -a "$LOG_FILE"
    elif [ "$USE_DOCKER" = true ]; then
        # Copy file to container and execute
        docker cp "$file" armored_archer_postgres:/tmp/migration.sql
        docker exec -i -e PGPASSWORD="$DB_PASSWORD" \
            armored_archer_postgres psql \
            -U "$DB_USER" \
            -h localhost \
            -d "$DB_NAME" \
            -f /tmp/migration.sql 2>&1 | tee -a "$LOG_FILE"
    else
        psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -f "$file" 2>&1 | tee -a "$LOG_FILE"
    fi
}

echo ""
echo "=========================================="
echo "Starting Migration Execution"
echo "=========================================="
echo ""
log "${BLUE}Migration started at: $(date)${NC}"
log ""

# Option 1: Use Nakama's built-in migration system
if [ "$USE_DOCKER" = true ] && docker ps | grep -q armored_archer_server; then
    log "${BLUE}Using Nakama migration system...${NC}"
    log ""
    
    if docker exec -it armored_archer_server /nakama/nakama migrate up 2>&1 | tee -a "$LOG_FILE"; then
        log ""
        log -e "${GREEN}✓ Nakama migrations completed successfully${NC}"
    else
        log ""
        log -e "${RED}✗ Nakama migration failed${NC}"
        log ""
        log "Check logs for details: $LOG_FILE"
        exit 1
    fi
else
    # Option 2: Manual migration execution
    log "${BLUE}Executing migrations manually...${NC}"
    log ""
    
    # Get list of migration files in order
    MIGRATION_FILES=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | grep -E "^[0-9]+_" | sort)
    
    if [ -z "$MIGRATION_FILES" ]; then
        log -e "${RED}✗ No migration files found${NC}"
        exit 1
    fi
    
    MIGRATION_COUNT=$(echo "$MIGRATION_FILES" | wc -l)
    CURRENT=0
    
    log "Found $MIGRATION_COUNT migration files"
    log ""
    
    # Execute each migration
    for migration in $MIGRATION_FILES; do
        CURRENT=$((CURRENT + 1))
        filename=$(basename "$migration")
        
        log "=========================================="
        log "Migration $CURRENT/$MIGRATION_COUNT: $filename"
        log "=========================================="
        log ""
        
        if run_sql_file "$migration"; then
            log -e "${GREEN}✓ Migration completed successfully${NC}"
        else
            log -e "${RED}✗ Migration failed: $filename${NC}"
            log ""
            log "Migration stopped at: $filename"
            log "Check logs for details: $LOG_FILE"
            exit 1
        fi
        
        log ""
    done
fi

# Verify migrations
echo ""
echo "=========================================="
echo "Migration Verification"
echo "=========================================="
echo ""

log "${BLUE}Verifying migrations...${NC}"
log ""

# Check migration version (if Nakama migration table exists)
if run_sql "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'migration_version');" | grep -q "t"; then
    log "Migration version:"
    run_sql "SELECT * FROM migration_version ORDER BY version DESC LIMIT 1;"
    log ""
fi

# List all tables
log "Database tables:"
run_sql "\dt"
log ""

# Count tables
TABLE_COUNT=$(run_sql "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | grep -oE '[0-9]+' | tail -1)
log "Total tables: $TABLE_COUNT"
log ""

# Summary
echo ""
echo "=========================================="
echo "Migration Summary"
echo "=========================================="
echo ""
log -e "${GREEN}✓ All migrations completed successfully!${NC}"
log ""
log "Migration completed at: $(date)"
log "Log file: $LOG_FILE"
log ""
log "Next steps:"
log "  1. Run verification: ./scripts/verify-migrations.sh"
log "  2. Run data integrity checks: ./scripts/data-integrity-checks.sh"
log "  3. Run performance optimization: ./scripts/optimize-database.sh"
log ""
echo "=========================================="

# Unset password
unset PGPASSWORD

exit 0
