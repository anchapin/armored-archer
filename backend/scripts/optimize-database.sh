#!/bin/bash
# Database Performance Optimization Script
# Runs ANALYZE, checks index usage, and optimizes database performance
# Usage: ./optimize-database.sh

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
LOG_FILE="$LOG_DIR/optimization_${TIMESTAMP}.log"

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
echo "Database Performance Optimization"
echo "=========================================="
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Database: $DB_NAME"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Log File: $LOG_FILE"
echo ""

# Start logging
echo "Database Optimization Started: $(date)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ============================================
# 1. Run ANALYZE on all tables
# ============================================

echo "=========================================="
echo "1. Running ANALYZE"
echo "=========================================="
echo ""

echo -e "${BLUE}Running ANALYZE on all tables...${NC}" | tee -a "$LOG_FILE"

if [ "$USE_DOCKER" = true ]; then
    docker exec -it armored_archer_postgres psql -U "$DB_USER" -h localhost -d "$DB_NAME" -c "ANALYZE VERBOSE;" 2>&1 | tee -a "$LOG_FILE"
else
    $PSQL_CMD -c "ANALYZE VERBOSE;" 2>&1 | tee -a "$LOG_FILE"
fi

echo -e "${GREEN}✓ ANALYZE completed${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ============================================
# 2. Check Table Statistics
# ============================================

echo "=========================================="
echo "2. Table Statistics"
echo "=========================================="
echo ""

echo -e "${BLUE}Table statistics after ANALYZE:${NC}" | tee -a "$LOG_FILE"

$PSQL_CMD -c "
SELECT 
    relname as table_name,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    CASE 
        WHEN n_live_tup > 0 
        THEN round(100.0 * n_dead_tup / n_live_tup, 2) 
        ELSE 0 
    END as dead_pct,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
" 2>/dev/null | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# ============================================
# 3. Index Usage Analysis
# ============================================

echo "=========================================="
echo "3. Index Usage Analysis"
echo "=========================================="
echo ""

echo -e "${BLUE}Index usage statistics:${NC}" | tee -a "$LOG_FILE"

$PSQL_CMD -c "
SELECT 
    schemaname,
    relname as table_name,
    indexrelname as index_name,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
" 2>/dev/null | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# ============================================
# 4. Identify Unused Indexes
# ============================================

echo "=========================================="
echo "4. Unused Indexes Check"
echo "=========================================="
echo ""

echo -e "${BLUE}Indexes with zero scans (potential candidates for removal):${NC}" | tee -a "$LOG_FILE"

$PSQL_CMD -c "
SELECT 
    schemaname,
    relname as table_name,
    indexrelname as index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan = 0
    AND indexrelname NOT LIKE '%_pkey'  -- Don't suggest removing primary keys
ORDER BY pg_relation_size(indexrelid) DESC;
" 2>/dev/null | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# ============================================
# 5. Table Size Analysis
# ============================================

echo "=========================================="
echo "5. Table Size Analysis"
echo "=========================================="
echo ""

echo -e "${BLUE}Table and index sizes:${NC}" | tee -a "$LOG_FILE"

$PSQL_CMD -c "
SELECT 
    relname as table_name,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size,
    pg_size_pretty(pg_relation_size(relid)) as table_size,
    pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as index_size,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC;
" 2>/dev/null | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# ============================================
# 6. Database Size
# ============================================

echo "=========================================="
echo "6. Database Size"
echo "=========================================="
echo ""

echo -e "${BLUE}Total database size:${NC}" | tee -a "$LOG_FILE"

$PSQL_CMD -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME')) as database_size;" 2>/dev/null | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# ============================================
# 7. Check for Bloat
# ============================================

echo "=========================================="
echo "7. Table Bloat Check"
echo "=========================================="
echo ""

echo -e "${BLUE}Tables with potential bloat (dead tuples > 10%):${NC}" | tee -a "$LOG_FILE"

$PSQL_CMD -c "
SELECT 
    relname as table_name,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    CASE 
        WHEN n_live_tup > 0 
        THEN round(100.0 * n_dead_tup / n_live_tup, 2) 
        ELSE 0 
    END as dead_pct,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND n_dead_tup > 0
    AND (n_live_tup > 0 AND 100.0 * n_dead_tup / n_live_tup > 10)
ORDER BY n_dead_tup DESC;
" 2>/dev/null | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# ============================================
# 8. Query Performance Check
# ============================================

echo "=========================================="
echo "8. Query Performance (pg_stat_statements)"
echo "=========================================="
echo ""

echo -e "${BLUE}Top 10 queries by total execution time:${NC}" | tee -a "$LOG_FILE"

# Check if pg_stat_statements is available
if $PSQL_CMD -c "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements';" 2>/dev/null | grep -q "1"; then
    $PSQL_CMD -c "
    SELECT 
        query,
        calls,
        round(total_exec_time::numeric / 1000, 2) as total_time_sec,
        round(mean_exec_time::numeric / 1000, 2) as mean_time_sec,
        round(shared_blks_hit::numeric / NULLIF(shared_blks_hit + shared_blks_read, 0), 4) as cache_hit_ratio
    FROM pg_stat_statements
    WHERE dbid = (SELECT oid FROM pg_database WHERE datname = '$DB_NAME')
    ORDER BY total_exec_time DESC
    LIMIT 10;
    " 2>/dev/null | tee -a "$LOG_FILE"
else
    echo "pg_stat_statements extension not installed. Install with: CREATE EXTENSION pg_stat_statements;" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"

# ============================================
# 9. Connection Statistics
# ============================================

echo "=========================================="
echo "9. Connection Statistics"
echo "=========================================="
echo ""

echo -e "${BLUE}Current connections:${NC}" | tee -a "$LOG_FILE"

$PSQL_CMD -c "
SELECT 
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active,
    count(*) FILTER (WHERE state = 'idle') as idle,
    count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
    count(*) FILTER (WHERE wait_event_type = 'Lock') as waiting_on_lock
FROM pg_stat_activity
WHERE datname = '$DB_NAME';
" 2>/dev/null | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# ============================================
# 10. Vacuum Recommendations
# ============================================

echo "=========================================="
echo "10. Vacuum Recommendations"
echo "=========================================="
echo ""

echo -e "${BLUE}Tables that may need VACUUM (dead tuples > 1000):${NC}" | tee -a "$LOG_FILE"

$PSQL_CMD -c "
SELECT 
    relname as table_name,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    CASE 
        WHEN last_vacuum IS NULL AND last_autovacuum IS NULL THEN 'Never vacuumed'
        WHEN last_vacuum IS NULL THEN 'Only autovacuum'
        ELSE 'Recently vacuumed'
    END as vacuum_status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
" 2>/dev/null | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# ============================================
# 11. Configuration Check
# ============================================

echo "=========================================="
echo "11. PostgreSQL Configuration"
echo "=========================================="
echo ""

echo -e "${BLUE}Key PostgreSQL settings:${NC}" | tee -a "$LOG_FILE"

$PSQL_CMD -c "
SELECT name, setting, unit
FROM pg_settings
WHERE name IN (
    'shared_buffers',
    'effective_cache_size',
    'work_mem',
    'maintenance_work_mem',
    'random_page_cost',
    'effective_io_concurrency',
    'max_connections',
    'autovacuum',
    'autovacuum_max_workers',
    'autovacuum_naptime',
    'autovacuum_vacuum_threshold',
    'autovacuum_analyze_threshold'
)
ORDER BY name;
" 2>/dev/null | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# ============================================
# Summary
# ============================================

echo "=========================================="
echo "Optimization Summary"
echo "=========================================="
echo "" | tee -a "$LOG_FILE"

echo -e "${GREEN}✓ Database optimization completed!${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Optimization completed at: $(date)" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Recommendations:" | tee -a "$LOG_FILE"
echo "  1. Review unused indexes for potential removal" | tee -a "$LOG_FILE"
echo "  2. Run VACUUM on tables with high dead tuple percentage" | tee -a "$LOG_FILE"
echo "  3. Monitor slow queries using pg_stat_statements" | tee -a "$LOG_FILE"
echo "  4. Consider connection pooling if connections are high" | tee -a "$LOG_FILE"
echo "  5. Review autovacuum settings for high-traffic tables" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "=========================================="

exit 0
