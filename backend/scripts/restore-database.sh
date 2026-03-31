#!/bin/bash
# Database Restore Script for Alpha Environment
# Restores a PostgreSQL backup
# Usage: ./restore-database.sh <backup_file>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${RED}✗ Error: Backup file not specified${NC}"
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/*.sql.gz 2>/dev/null || echo "  No backups found in ./backups/"
    exit 1
fi

BACKUP_FILE="$1"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nakama}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-localdbpassword}"

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

echo "=========================================="
echo "Armored Archer - Database Restore Script"
echo "=========================================="
echo ""

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}✗ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# Verify checksum if available
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
    echo -e "${BLUE}Verifying backup integrity...${NC}"
    if sha256sum -c "$CHECKSUM_FILE" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Checksum verified${NC}"
    else
        echo -e "${RED}✗ Checksum verification failed${NC}"
        echo "Backup file may be corrupted!"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Checksum file not found, skipping verification${NC}"
fi

# Check if Docker is available and container is running
USE_DOCKER=false
if command -v docker &> /dev/null; then
    if docker ps | grep -q armored_archer_postgres; then
        USE_DOCKER=true
        echo -e "${GREEN}✓ Using Docker container: armored_archer_postgres${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}⚠ WARNING: This will overwrite the current database!${NC}"
echo ""
echo "Restore Details:"
echo "  Backup File: $BACKUP_FILE"
echo "  Database: $DB_NAME"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  User: $DB_USER"
echo ""

# Confirmation prompt
if [ -t 1 ]; then
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo -e "${YELLOW}Restore cancelled${NC}"
        exit 0
    fi
fi

echo ""
echo "=========================================="
echo "Starting Restore Process"
echo "=========================================="
echo ""

# Function to restore database
restore_database() {
    if [ "$USE_DOCKER" = true ]; then
        # Using Docker container
        echo -e "${BLUE}Decompressing and restoring to Docker container...${NC}"
        gunzip -c "$BACKUP_FILE" | docker exec -i -e PGPASSWORD="$DB_PASSWORD" \
            armored_archer_postgres psql \
            -U "$DB_USER" \
            -h localhost \
            -d "$DB_NAME"
    else
        # Using local psql
        echo -e "${BLUE}Decompressing and restoring...${NC}"
        gunzip -c "$BACKUP_FILE" | psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME"
    fi
}

# Perform the restore
if restore_database; then
    echo -e "${GREEN}✓ Restore completed successfully${NC}"
else
    echo -e "${RED}✗ Restore failed${NC}"
    exit 1
fi

# Verify restore
echo ""
echo "=========================================="
echo "Restore Verification"
echo "=========================================="
echo ""

# Check if tables exist
echo -e "${BLUE}Verifying restored tables...${NC}"

if [ "$USE_DOCKER" = true ]; then
    TABLE_COUNT=$(docker exec -it armored_archer_postgres psql -U "$DB_USER" -h localhost -d "$DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
else
    TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
fi

echo "  Tables found: $TABLE_COUNT"

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Tables restored successfully${NC}"
else
    echo -e "${RED}✗ No tables found, restore may have failed${NC}"
    exit 1
fi

# List restored tables
echo ""
echo -e "${BLUE}Restored tables:${NC}"
if [ "$USE_DOCKER" = true ]; then
    docker exec -it armored_archer_postgres psql -U "$DB_USER" -h localhost -d "$DB_NAME" -c "\dt"
else
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt"
fi

# Summary
echo ""
echo "=========================================="
echo "Restore Summary"
echo "=========================================="
echo ""
echo -e "${GREEN}✓ Database restore completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run migrations if needed: docker exec -it armored_archer_server /nakama/nakama migrate up"
echo "  2. Verify data: ./verify-migrations.sh"
echo ""
echo "=========================================="

# Unset password
unset PGPASSWORD

exit 0
