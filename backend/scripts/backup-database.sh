#!/bin/bash
# Database Backup Script for Alpha Environment
# Creates a full PostgreSQL backup before migrations
# Usage: ./backup-database.sh [backup_directory]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="nakama_backup_${TIMESTAMP}.sql.gz"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nakama}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-localdbpassword}"

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

echo "=========================================="
echo "Armored Archer - Database Backup Script"
echo "=========================================="
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Database: $DB_NAME"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  User: $DB_USER"
echo "  Backup Directory: $BACKUP_DIR"
echo "  Backup File: $BACKUP_FILE"
echo ""

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}Creating backup directory: $BACKUP_DIR${NC}"
    mkdir -p "$BACKUP_DIR"
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
echo "=========================================="
echo "Starting Backup Process"
echo "=========================================="
echo ""

# Function to perform backup
perform_backup() {
    local output_file="$1"
    
    if [ "$USE_DOCKER" = true ]; then
        # Using Docker container
        echo -e "${BLUE}Executing pg_dump from Docker container...${NC}"
        docker exec -e PGPASSWORD="$DB_PASSWORD" \
            armored_archer_postgres pg_dump \
            -U "$DB_USER" \
            -h localhost \
            -d "$DB_NAME" \
            -F p \
            --verbose 2>&1 | gzip > "$output_file"
    else
        # Using local psql
        echo -e "${BLUE}Executing pg_dump...${NC}"
        pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -F p \
            --verbose 2>&1 | gzip > "$output_file"
    fi
}

# Perform the backup
echo -e "${YELLOW}Creating database backup...${NC}"
if perform_backup "$BACKUP_DIR/$BACKUP_FILE"; then
    echo -e "${GREEN}✓ Backup created successfully${NC}"
else
    echo -e "${RED}✗ Backup failed${NC}"
    exit 1
fi

# Verify backup file exists and has content
echo ""
echo "=========================================="
echo "Backup Verification"
echo "=========================================="
echo ""

if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓ Backup file exists${NC}"
    echo "  Location: $BACKUP_DIR/$BACKUP_FILE"
    echo "  Size: $BACKUP_SIZE"
    
    # Verify backup is not empty
    if [ -s "$BACKUP_DIR/$BACKUP_FILE" ]; then
        echo -e "${GREEN}✓ Backup file is not empty${NC}"
    else
        echo -e "${RED}✗ Backup file is empty${NC}"
        exit 1
    fi
    
    # Verify backup can be decompressed
    echo -e "${BLUE}Verifying backup integrity...${NC}"
    if gzip -t "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null; then
        echo -e "${GREEN}✓ Backup file integrity verified${NC}"
    else
        echo -e "${RED}✗ Backup file is corrupted${NC}"
        exit 1
    fi
    
    # Count SQL statements in backup
    STATEMENT_COUNT=$(zcat "$BACKUP_DIR/$BACKUP_FILE" | grep -c "^" || true)
    echo "  Lines in backup: $STATEMENT_COUNT"
    
    # Check for key tables
    echo ""
    echo -e "${BLUE}Checking for key tables in backup:${NC}"
    for table in player_stats catalog inventory loadout stage_completion device_tokens notification_preferences scheduled_notifications notification_history boss_defeats unlocked_modifier_pools; do
        if zcat "$BACKUP_DIR/$BACKUP_FILE" | grep -q "CREATE TABLE.*$table"; then
            echo -e "  ${GREEN}✓${NC} $table"
        else
            echo -e "  ${YELLOW}⚠${NC} $table (not found, may be created by migration)"
        fi
    done
else
    echo -e "${RED}✗ Backup file not found${NC}"
    exit 1
fi

# Create checksum
echo ""
echo "=========================================="
echo "Creating Checksum"
echo "=========================================="
echo ""

CHECKSUM_FILE="$BACKUP_DIR/${BACKUP_FILE}.sha256"
sha256sum "$BACKUP_DIR/$BACKUP_FILE" > "$CHECKSUM_FILE"
echo -e "${GREEN}✓ Checksum created: $CHECKSUM_FILE${NC}"
echo "  $(cat $CHECKSUM_FILE)"

# Create backup metadata
METADATA_FILE="$BACKUP_DIR/${BACKUP_FILE}.metadata.json"
cat > "$METADATA_FILE" << EOF
{
  "backup_file": "$BACKUP_FILE",
  "timestamp": "$TIMESTAMP",
  "database": "$DB_NAME",
  "host": "$DB_HOST",
  "port": "$DB_PORT",
  "user": "$DB_USER",
  "size": "$BACKUP_SIZE",
  "checksum_file": "${BACKUP_FILE}.sha256",
  "backup_method": "pg_dump",
  "compression": "gzip"
}
EOF

echo -e "${GREEN}✓ Metadata created: $METADATA_FILE${NC}"

# Cleanup old backups (keep last 7 days)
echo ""
echo "=========================================="
echo "Cleanup Old Backups"
echo "=========================================="
echo ""

OLD_BACKUPS=$(find "$BACKUP_DIR" -name "nakama_backup_*.sql.gz" -mtime +7 2>/dev/null | wc -l)
if [ "$OLD_BACKUPS" -gt 0 ]; then
    echo -e "${YELLOW}Found $OLD_BACKUPS backups older than 7 days${NC}"
    find "$BACKUP_DIR" -name "nakama_backup_*.sql.gz" -mtime +7 -delete
    find "$BACKUP_DIR" -name "nakama_backup_*.metadata.json" -mtime +7 -delete
    find "$BACKUP_DIR" -name "nakama_backup_*.sha256" -mtime +7 -delete
    echo -e "${GREEN}✓ Old backups cleaned up${NC}"
else
    echo -e "${BLUE}No old backups to clean up${NC}"
fi

# Summary
echo ""
echo "=========================================="
echo "Backup Summary"
echo "=========================================="
echo ""
echo -e "${GREEN}✓ Backup completed successfully!${NC}"
echo ""
echo "Backup Details:"
echo "  File: $BACKUP_DIR/$BACKUP_FILE"
echo "  Size: $BACKUP_SIZE"
echo "  Checksum: $(cat $CHECKSUM_FILE)"
echo ""
echo "To restore this backup:"
echo "  ./restore-database.sh $BACKUP_DIR/$BACKUP_FILE"
echo ""
echo "=========================================="

# Unset password
unset PGPASSWORD

exit 0
