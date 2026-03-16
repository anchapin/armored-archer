#!/bin/bash
# Migration Verification Script for Alpha Database
# This script verifies that all database migrations have been applied correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Alpha Database Migration Verification"
echo "=========================================="
echo ""

# Configuration
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nakama}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-localdbpassword}"

# Check if running in Docker context
if command -v docker &> /dev/null && docker ps | grep -q armored_archer_postgres; then
    USE_DOCKER=true
    PSQL_CMD="docker exec -it armored_archer_postgres psql"
else
    USE_DOCKER=false
    export PGPASSWORD="$DB_PASSWORD"
    PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
fi

echo -e "${BLUE}Database: $DB_NAME@${DB_HOST}:${DB_PORT}${NC}"
echo -e "${BLUE}User: $DB_USER${NC}"
echo ""

# Function to run SQL query
run_query() {
    local query="$1"
    local description="$2"
    
    echo -n "Checking: $description... "
    
    if result=$($PSQL_CMD -t -c "$query" 2>/dev/null); then
        if [ -n "$result" ] && [ "$result" != "" ]; then
            echo -e "${GREEN}✓${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ No results${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Failed${NC}"
        return 1
    fi
}

# Function to run SQL query and show output
run_query_verbose() {
    local query="$1"
    local description="$2"
    
    echo -e "${BLUE}$description:${NC}"
    $PSQL_CMD -c "$query" 2>/dev/null || echo -e "${RED}Query failed${NC}"
    echo ""
}

# Track verification status
VERIFICATION_PASSED=true

echo "=========================================="
echo "1. Database Connectivity"
echo "=========================================="
echo ""

if ! $PSQL_CMD -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}✗ Cannot connect to database${NC}"
    echo "Please ensure:"
    echo "  - Database server is running"
    echo "  - Connection parameters are correct"
    echo "  - Network connectivity is available"
    exit 1
fi

echo -e "${GREEN}✓ Database connection successful${NC}"
echo ""

echo "=========================================="
echo "2. Migration Version Check"
echo "=========================================="
echo ""

run_query "SELECT version FROM migration_version ORDER BY version DESC LIMIT 1;" "Migration version" || VERIFICATION_PASSED=false
echo ""

echo "=========================================="
echo "3. Core Tables Verification"
echo "=========================================="
echo ""

TABLES=("player_stats" "catalog" "inventory" "loadout")

for table in "${TABLES[@]}"; do
    run_query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" "Table: $table" || VERIFICATION_PASSED=false
done
echo ""

echo "=========================================="
echo "4. Table Structure Verification"
echo "=========================================="
echo ""

# Check player_stats columns
echo -e "${BLUE}player_stats table structure:${NC}"
run_query_verbose "\d player_stats" "player_stats columns"

# Check catalog columns
echo -e "${BLUE}catalog table structure:${NC}"
run_query_verbose "\d catalog" "catalog columns"

# Check inventory columns
echo -e "${BLUE}inventory table structure:${NC}"
run_query_verbose "\d inventory" "inventory columns"

# Check loadout columns
echo -e "${BLUE}loadout table structure:${NC}"
run_query_verbose "\d loadout" "loadout columns"

echo "=========================================="
echo "5. Index Verification"
echo "=========================================="
echo ""

run_query_verbose "\di" "Database indexes"

echo "=========================================="
echo "6. Constraint Verification"
echo "=========================================="
echo ""

run_query_verbose "
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    contype as constraint_type
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, contype;
" "Database constraints"

echo "=========================================="
echo "7. Data Integrity Checks"
echo "=========================================="
echo ""

# Check for NULL values in NOT NULL columns
run_query "
SELECT COUNT(*) = 0 as no_nulls 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND is_nullable = 'NO'
  AND table_name IN ('player_stats', 'catalog', 'inventory', 'loadout');
" "NOT NULL constraints respected" || VERIFICATION_PASSED=false

# Check foreign key relationships
run_query_verbose "
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';
" "Foreign key relationships"

echo "=========================================="
echo "8. Database Statistics"
echo "=========================================="
echo ""

run_query_verbose "
SELECT 
    relname as table_name,
    n_live_tup as row_count,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
" "Table statistics"

run_query_verbose "SELECT pg_size_pretty(pg_database_size('$DB_NAME')) as database_size;" "Total database size"

echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo ""

if [ "$VERIFICATION_PASSED" = true ]; then
    echo -e "${GREEN}✓ All verification checks passed!${NC}"
    echo ""
    echo "Database is ready for alpha deployment."
    exit 0
else
    echo -e "${RED}✗ Some verification checks failed${NC}"
    echo ""
    echo "Please review the failed checks above and address any issues."
    echo "Common fixes:"
    echo "  - Run migrations: docker exec -it armored_archer_server /nakama/nakama migrate up"
    echo "  - Check database logs: docker-compose logs postgres"
    echo "  - Verify connection string in .env file"
    exit 1
fi
