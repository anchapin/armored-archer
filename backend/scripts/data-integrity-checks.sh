#!/bin/bash
# Data Integrity Check Script
# Runs comprehensive data integrity checks after migrations
# Usage: ./data-integrity-checks.sh

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
LOG_DIR="$(dirname "$0")/../logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/integrity_check_${TIMESTAMP}.log"

export PGPASSWORD="$DB_PASSWORD"

# Create log directory
mkdir -p "$LOG_DIR"

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
echo "Data Integrity Check Script"
echo "=========================================="
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Database: $DB_NAME"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Log File: $LOG_FILE"
echo ""

# Track check results
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# Function to run check
run_check() {
    local name="$1"
    local query="$2"
    local expected="$3"
    
    result=$($PSQL_CMD -t -c "$query" 2>/dev/null | tr -d ' \n')
    
    echo -n "  $name: " | tee -a "$LOG_FILE"
    
    if [ "$result" = "$expected" ]; then
        echo -e "${GREEN}PASS${NC} ($result)" | tee -a "$LOG_FILE"
        PASS_COUNT=$((PASS_COUNT + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC} ($result, expected: $expected)" | tee -a "$LOG_FILE"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return 1
    fi
}

# Function to run check expecting zero
run_check_zero() {
    local name="$1"
    local query="$2"
    
    result=$($PSQL_CMD -t -c "$query" 2>/dev/null | tr -d ' \n')
    
    echo -n "  $name: " | tee -a "$LOG_FILE"
    
    if [ "$result" = "0" ]; then
        echo -e "${GREEN}PASS${NC} (0)" | tee -a "$LOG_FILE"
        PASS_COUNT=$((PASS_COUNT + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC} ($result violations found)" | tee -a "$LOG_FILE"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return 1
    fi
}

# Function to run check expecting minimum
run_check_min() {
    local name="$1"
    local query="$2"
    local min="$3"
    
    result=$($PSQL_CMD -t -c "$query" 2>/dev/null | tr -d ' \n')
    
    echo -n "  $name: " | tee -a "$LOG_FILE"
    
    if [ "$result" -ge "$min" ] 2>/dev/null; then
        echo -e "${GREEN}PASS${NC} ($result ≥ $min)" | tee -a "$LOG_FILE"
        PASS_COUNT=$((PASS_COUNT + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC} ($result < $min)" | tee -a "$LOG_FILE"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return 1
    fi
}

# Start logging
echo "Data Integrity Check Started: $(date)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "=========================================="
echo "1. Row Count Checks"
echo "=========================================="
echo "" | tee -a "$LOG_FILE"

run_check_min "  Tables exist" "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" "1"

echo ""
echo "Row counts per table:" | tee -a "$LOG_FILE"
$PSQL_CMD -c "SELECT relname as table_name, n_live_tup as row_count FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC;" 2>/dev/null | tee -a "$LOG_FILE"

echo ""
echo "=========================================="
echo "2. NULL Value Checks"
echo "=========================================="
echo "" | tee -a "$LOG_FILE"

echo "Checking for NULL values in NOT NULL columns..." | tee -a "$LOG_FILE"
run_check_zero "  player_stats.user_id" "SELECT count(*) FROM player_stats WHERE user_id IS NULL;"
run_check_zero "  player_stats.level" "SELECT count(*) FROM player_stats WHERE level IS NULL;"
run_check_zero "  player_stats.experience" "SELECT count(*) FROM player_stats WHERE experience IS NULL;"
run_check_zero "  catalog.gear_type" "SELECT count(*) FROM catalog WHERE gear_type IS NULL;"
run_check_zero "  catalog.name" "SELECT count(*) FROM catalog WHERE name IS NULL;"
run_check_zero "  catalog.rarity" "SELECT count(*) FROM catalog WHERE rarity IS NULL;"
run_check_zero "  inventory.user_id" "SELECT count(*) FROM inventory WHERE user_id IS NULL;"
run_check_zero "  inventory.gear_id" "SELECT count(*) FROM inventory WHERE gear_id IS NULL;"
run_check_zero "  loadout.user_id" "SELECT count(*) FROM loadout WHERE user_id IS NULL;"

echo ""
echo "=========================================="
echo "3. CHECK Constraint Validation"
echo "=========================================="
echo "" | tee -a "$LOG_FILE"

echo "Checking CHECK constraints..." | tee -a "$LOG_FILE"
run_check_zero "  player_stats.level >= 1" "SELECT count(*) FROM player_stats WHERE level < 1;"
run_check_zero "  player_stats.experience >= 0" "SELECT count(*) FROM player_stats WHERE experience < 0;"
run_check_zero "  player_stats.ability_points >= 0" "SELECT count(*) FROM player_stats WHERE ability_points < 0;"
run_check_zero "  stage_completion.stars_earned 0-3" "SELECT count(*) FROM stage_completion WHERE stars_earned < 0 OR stars_earned > 3;"
run_check_zero "  stage_completion.score >= 0" "SELECT count(*) FROM stage_completion WHERE score < 0;"
run_check_zero "  boss_defeats.defeat_count >= 1" "SELECT count(*) FROM boss_defeats WHERE defeat_count < 1;"

echo ""
echo "=========================================="
echo "4. Foreign Key Relationship Validation"
echo "=========================================="
echo "" | tee -a "$LOG_FILE"

echo "Checking for orphan records..." | tee -a "$LOG_FILE"
run_check_zero "  inventory -> users" "SELECT count(*) FROM inventory i LEFT JOIN users u ON i.user_id = u.id WHERE u.id IS NULL;"
run_check_zero "  inventory -> catalog" "SELECT count(*) FROM inventory i LEFT JOIN catalog c ON i.gear_id = c.gear_id WHERE c.gear_id IS NULL;"
run_check_zero "  loadout -> users" "SELECT count(*) FROM loadout l LEFT JOIN users u ON l.user_id = u.id WHERE u.id IS NULL;"
run_check_zero "  device_tokens -> users" "SELECT count(*) FROM device_tokens d LEFT JOIN users u ON d.user_id = u.id WHERE u.id IS NULL;"
run_check_zero "  notification_preferences -> users" "SELECT count(*) FROM notification_preferences n LEFT JOIN users u ON n.user_id = u.id WHERE u.id IS NULL;"

echo ""
echo "=========================================="
echo "5. Unique Constraint Validation"
echo "=========================================="
echo "" | tee -a "$LOG_FILE"

echo "Checking for duplicate violations..." | tee -a "$LOG_FILE"
run_check_zero "  player_stats.user_id unique" "SELECT count(*) FROM (SELECT user_id FROM player_stats GROUP BY user_id HAVING count(*) > 1) t;"
run_check_zero "  inventory (user_id, gear_id) unique" "SELECT count(*) FROM (SELECT user_id, gear_id FROM inventory GROUP BY user_id, gear_id HAVING count(*) > 1) t;"
run_check_zero "  loadout.user_id unique" "SELECT count(*) FROM (SELECT user_id FROM loadout GROUP BY user_id HAVING count(*) > 1) t;"
run_check_zero "  notification_preferences.user_id unique" "SELECT count(*) FROM (SELECT user_id FROM notification_preferences GROUP BY user_id HAVING count(*) > 1) t;"
run_check_zero "  device_tokens.device_token unique" "SELECT count(*) FROM (SELECT device_token FROM device_tokens GROUP BY device_token HAVING count(*) > 1) t;"

echo ""
echo "=========================================="
echo "6. JSONB Validation"
echo "=========================================="
echo "" | tee -a "$LOG_FILE"

echo "Checking JSONB fields..." | tee -a "$LOG_FILE"
run_check_zero "  player_stats.stats is valid JSON" "SELECT count(*) FROM player_stats WHERE NOT (stats IS JSON);"
run_check_zero "  catalog.base_stats is valid JSON" "SELECT count(*) FROM catalog WHERE NOT (base_stats IS JSON);"
run_check_zero "  catalog.modifiers is valid JSON" "SELECT count(*) FROM catalog WHERE NOT (modifiers IS JSON);"

echo ""
echo "=========================================="
echo "7. Temporal Consistency"
echo "=========================================="
echo "" | tee -a "$LOG_FILE"

echo "Checking temporal consistency..." | tee -a "$LOG_FILE"
run_check_zero "  created_at not in future" "SELECT count(*) FROM (SELECT created_at FROM player_stats UNION ALL SELECT created_at FROM catalog UNION ALL SELECT created_at FROM inventory) t WHERE created_at > NOW();"
run_check_zero "  updated_at >= created_at (player_stats)" "SELECT count(*) FROM player_stats WHERE updated_at < created_at;"
run_check_zero "  updated_at >= created_at (catalog)" "SELECT count(*) FROM catalog WHERE updated_at < created_at;"

echo ""
echo "=========================================="
echo "8. Enum Value Validation"
echo "=========================================="
echo "" | tee -a "$LOG_FILE"

echo "Checking enum values..." | tee -a "$LOG_FILE"
echo "  gear_type values:" | tee -a "$LOG_FILE"
$PSQL_CMD -c "SELECT DISTINCT gear_type FROM catalog ORDER BY gear_type;" 2>/dev/null | tee -a "$LOG_FILE"

echo "  gear_rarity values:" | tee -a "$LOG_FILE"
$PSQL_CMD -c "SELECT DISTINCT rarity FROM catalog ORDER BY rarity;" 2>/dev/null | tee -a "$LOG_FILE"

echo "  device_tokens platform values:" | tee -a "$LOG_FILE"
$PSQL_CMD -c "SELECT DISTINCT platform FROM device_tokens ORDER BY platform;" 2>/dev/null | tee -a "$LOG_FILE"

echo ""
echo "=========================================="
echo "Data Integrity Summary"
echo "=========================================="
echo "" | tee -a "$LOG_FILE"
echo -e "Passed: ${GREEN}$PASS_COUNT${NC}" | tee -a "$LOG_FILE"
echo -e "Failed: ${RED}$FAIL_COUNT${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All data integrity checks passed!${NC}" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "Data integrity verified successfully." | tee -a "$LOG_FILE"
    exit 0
else
    echo -e "${RED}✗ Some data integrity checks failed${NC}" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "Please review the failed checks above and in the log file." | tee -a "$LOG_FILE"
    exit 1
fi
