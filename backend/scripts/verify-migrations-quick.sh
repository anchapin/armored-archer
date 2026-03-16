#!/bin/bash
# Quick Migration Verification Script
# Provides a quick summary check of migration status
# Usage: ./verify-migrations-quick.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nakama}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-localdbpassword}"

export PGPASSWORD="$DB_PASSWORD"

# Check if Docker is available and container is running
USE_DOCKER=false
if command -v docker &> /dev/null; then
    if docker ps | grep -q armored_archer_postgres; then
        USE_DOCKER=true
        PSQL_CMD="docker exec -it armored_archer_postgres psql -U $DB_USER -h localhost -d $DB_NAME"
    else
        PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
    fi
else
    PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
fi

echo "=========================================="
echo "Quick Migration Verification"
echo "=========================================="
echo ""

# Track verification status
PASS_COUNT=0
FAIL_COUNT=0

# Function to run check
run_check() {
    local name="$1"
    local query="$2"
    local expected="$3"
    
    result=$($PSQL_CMD -t -c "$query" 2>/dev/null | tr -d ' ')
    
    if [ "$result" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} $name: $result"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}✗${NC} $name: $result (expected: $expected)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# Function to run check with minimum value
run_check_min() {
    local name="$1"
    local query="$2"
    local min="$3"
    
    result=$($PSQL_CMD -t -c "$query" 2>/dev/null | tr -d ' ')
    
    if [ "$result" -ge "$min" ] 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $name: $result (≥ $min)"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}✗${NC} $name: $result (expected ≥ $min)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

echo "1. Table Count Verification"
echo "-------------------------------------------"
run_check "  Total tables" "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" "11"
echo ""

echo "2. Core Tables Check"
echo "-------------------------------------------"
for table in player_stats catalog inventory loadout stage_completion device_tokens notification_preferences scheduled_notifications notification_history boss_defeats unlocked_modifier_pools; do
    result=$($PSQL_CMD -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null | tr -d ' ')
    if [ "$result" = "t" ]; then
        echo -e "${GREEN}✓${NC} $table exists"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}✗${NC} $table missing"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done
echo ""

echo "3. Enum Types Check"
echo "-------------------------------------------"
run_check "  gear_type enum" "SELECT count(*) FROM pg_type WHERE typname = 'gear_type' AND typnamespace = 'public'::regnamespace;" "1"
run_check "  gear_rarity enum" "SELECT count(*) FROM pg_type WHERE typname = 'gear_rarity' AND typnamespace = 'public'::regnamespace;" "1"
echo ""

echo "4. Index Count Check"
echo "-------------------------------------------"
run_check_min "  Total indexes" "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';" "20"
echo ""

echo "5. Foreign Key Check"
echo "-------------------------------------------"
run_check_min "  Foreign keys" "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';" "8"
echo ""

echo "6. Trigger Check"
echo "-------------------------------------------"
run_check_min "  Triggers" "SELECT count(DISTINCT trigger_name) FROM information_schema.triggers WHERE trigger_schema = 'public';" "6"
echo ""

echo "7. Function Check"
echo "-------------------------------------------"
run_check "  update_updated_at_column" "SELECT count(*) FROM pg_proc WHERE proname = 'update_updated_at_column';" "1"
echo ""

echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo ""
echo -e "Passed: ${GREEN}$PASS_COUNT${NC}"
echo -e "Failed: ${RED}$FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All verification checks passed!${NC}"
    echo ""
    echo "Database migrations verified successfully."
    exit 0
else
    echo -e "${RED}✗ Some verification checks failed${NC}"
    echo ""
    echo "Please review the failed checks above."
    echo "Run full verification: ./scripts/verify-migrations.sh"
    exit 1
fi
