# Performance Optimization Documentation

**Phase**: 1.2 - Database Migration Execution
**Milestone**: v2.1.0 - Alpha Launch & Stabilization
**Created**: 2026-03-16

---

## Overview

This document provides comprehensive instructions for optimizing database performance after migrations on the alpha environment.

---

## Optimization Script Location

- **Optimization Script**: `/home/alex/armored-archer/backend/scripts/optimize-database.sh`

---

## Post-Migration Optimization Checklist

After running migrations:

- [ ] **Run ANALYZE** - Update query planner statistics
- [ ] **Check index usage** - Verify indexes are being used
- [ ] **Review table bloat** - Check for dead tuples
- [ ] **Verify connection pool** - Ensure proper connection settings
- [ ] **Check query performance** - Review slow queries
- [ ] **Configure autovacuum** - Optimize vacuum settings

---

## Running Optimization

### Option 1: Using Optimization Script (Recommended)

```bash
cd /home/alex/armored-archer/backend

# Run full optimization
./scripts/optimize-database.sh

# Run with custom database connection
DB_HOST=alpha-db DB_PORT=5432 DB_NAME=nakama DB_USER=postgres \
  ./scripts/optimize-database.sh
```

### Option 2: Manual Commands

```bash
# Run ANALYZE on all tables
docker exec -it armored_archer_postgres psql \
  -U postgres -d nakama -c "ANALYZE VERBOSE;"

# Run VACUUM on specific tables
docker exec -it armored_archer_postgres psql \
  -U postgres -d nakama -c "VACUUM ANALYZE player_stats;"

# Run full VACUUM (more aggressive)
docker exec -it armored_archer_postgres psql \
  -U postgres -d nakama -c "VACUUM FULL VERBOSE;"
```

---

## Optimization Steps Explained

### 1. ANALYZE

**Purpose**: Updates query planner statistics for optimal query execution plans.

```sql
-- Run ANALYZE on all tables
ANALYZE VERBOSE;

-- Run ANALYZE on specific table
ANALYZE VERBOSE player_stats;

-- Run ANALYZE on specific column
ANALYZE VERBOSE player_stats(level);
```

**When to run**:
- After bulk data imports
- After migrations
- Weekly on high-traffic tables
- When query performance degrades

### 2. VACUUM

**Purpose**: Reclaims storage from dead tuples.

```sql
-- Standard VACUUM (non-blocking)
VACUUM;

-- VACUUM with ANALYZE
VACUUM ANALYZE;

-- Full VACUUM (blocking, reclaims more space)
VACUUM FULL;

-- VACUUM specific table
VACUUM ANALYZE player_stats;
```

**When to run**:
- When dead tuple percentage > 10%
- After large DELETE/UPDATE operations
- During maintenance windows

### 3. Index Analysis

**Purpose**: Identify unused or missing indexes.

```sql
-- Find unused indexes
SELECT 
    schemaname,
    relname as table_name,
    indexrelname as index_name,
    idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan = 0
    AND indexrelname NOT LIKE '%_pkey';

-- Find missing indexes (sequential scans on large tables)
SELECT 
    relname as table_name,
    seq_scan as sequential_scans,
    seq_tup_read as seq_tuples_read,
    idx_scan as index_scans
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC;
```

### 4. Connection Pooling

**Purpose**: Optimize database connections for application performance.

#### Recommended Settings for Alpha

```
max_connections: 100
shared_buffers: 256MB
effective_cache_size: 1GB
work_mem: 4MB
maintenance_work_mem: 64MB
```

#### Connection Pool Configuration

For Nakama:
```yaml
# nakama.yml
database:
  pool:
    max_idle_conns: 25
    max_open_conns: 100
    conn_max_lifetime: 5m
```

### 5. Query Performance Monitoring

**Purpose**: Identify and optimize slow queries.

#### Enable pg_stat_statements

```sql
-- Add to postgresql.conf
shared_preload_libraries = 'pg_stat_statements'

-- Create extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

#### Query Slow Queries

```sql
-- Top 10 slowest queries
SELECT 
    query,
    calls,
    round(total_exec_time::numeric / 1000, 2) as total_time_sec,
    round(mean_exec_time::numeric / 1000, 2) as mean_time_sec
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'nakama')
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Queries with most total time
SELECT 
    query,
    calls,
    round(total_exec_time::numeric / 1000, 2) as total_time_sec
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

### 6. Autovacuum Configuration

**Purpose**: Automatic vacuum tuning for optimal performance.

#### Recommended Settings

```sql
-- View current settings
SELECT name, setting, unit
FROM pg_settings
WHERE name LIKE 'autovacuum%'
ORDER BY name;

-- Recommended alpha settings
ALTER SYSTEM SET autovacuum = on;
ALTER SYSTEM SET autovacuum_max_workers = 3;
ALTER SYSTEM SET autovacuum_naptime = '60s';
ALTER SYSTEM SET autovacuum_vacuum_threshold = 50;
ALTER SYSTEM SET autovacuum_analyze_threshold = 50;
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.1;
ALTER SYSTEM SET autovacuum_analyze_scale_factor = 0.05;

-- Reload configuration
SELECT pg_reload_conf();
```

#### Per-Table Autovacuum Settings

```sql
-- Aggressive autovacuum for high-traffic tables
ALTER TABLE player_stats SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

-- Less aggressive for static tables
ALTER TABLE catalog SET (
    autovacuum_enabled = false
);
```

---

## Performance Monitoring

### Key Metrics to Monitor

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Dead tuples | Rows pending vacuum | > 10% of live tuples |
| Cache hit ratio | Buffer cache efficiency | < 95% |
| Connection count | Active connections | > 80% of max |
| Query duration | Average query time | > 100ms |
| Index usage | Index scan ratio | < 50% of scans |
| Table bloat | Wasted space | > 20% |

### Monitoring Queries

```sql
-- Cache hit ratio
SELECT 
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;

-- Connection usage
SELECT 
    count(*) as used,
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max,
    round(100.0 * count(*) / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'), 2) as pct
FROM pg_stat_activity
WHERE datname = 'nakama';

-- Long-running queries
SELECT 
    pid,
    now() - query_start as duration,
    query
FROM pg_stat_activity
WHERE datname = 'nakama'
    AND state = 'active'
    AND now() - query_start > interval '1 minute'
ORDER BY duration DESC;
```

---

## Index Optimization

### Recommended Indexes

The migrations create these indexes automatically:

| Table | Index | Purpose |
|-------|-------|---------|
| player_stats | idx_player_stats_level | Level-based queries |
| player_stats | idx_player_stats_experience | Experience/leaderboard queries |
| catalog | idx_catalog_gear_type | Gear type filtering |
| catalog | idx_catalog_rarity | Rarity filtering |
| catalog | idx_catalog_base_stats | JSONB stat queries |
| catalog | idx_catalog_modifiers | JSONB modifier queries |
| inventory | idx_inventory_user_gear | Unique user-gear constraint |
| inventory | idx_inventory_user_id | User inventory queries |
| inventory | idx_inventory_gear_id | Gear ownership queries |
| loadout | idx_loadout_user_id | User loadout queries |
| loadout | idx_loadout_*_gear | Individual slot queries |

### Adding Additional Indexes

```sql
-- Index for stage completion queries
CREATE INDEX IF NOT EXISTS idx_stage_completion_user_stars 
ON stage_completion(user_id, stars_earned);

-- Index for notification scheduling
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending 
ON scheduled_notifications(scheduled_for) 
WHERE status = 'pending';

-- Index for boss defeat tracking
CREATE INDEX IF NOT EXISTS idx_boss_defeats_user_boss 
ON boss_defeats(user_id, boss_id);
```

### Index Maintenance

```sql
-- Reindex specific index
REINDEX INDEX idx_player_stats_level;

-- Reindex all indexes on table
REINDEX TABLE player_stats;

-- Reindex entire database
REINDEX DATABASE nakama;
```

---

## Performance Tuning Recommendations

### For Alpha Environment

```yaml
# PostgreSQL Settings (postgresql.conf)
shared_buffers: 256MB           # 25% of RAM
effective_cache_size: 1GB       # 75% of RAM
work_mem: 4MB                   # Per-operation memory
maintenance_work_mem: 64MB      # For VACUUM, CREATE INDEX
random_page_cost: 1.1           # For SSD storage
effective_io_concurrency: 200    # For SSD storage
max_connections: 100            # Adjust based on load

# Nakama Settings (nakama.yml)
database:
  pool:
    max_idle_conns: 25
    max_open_conns: 100
    conn_max_lifetime: 5m
```

### Query Optimization Tips

1. **Use prepared statements** - Reduces parsing overhead
2. **Batch operations** - Combine multiple operations
3. **Use indexes** - Ensure queries use appropriate indexes
4. **Avoid SELECT *** - Only fetch needed columns
5. **Use LIMIT** - Paginate large result sets
6. **Avoid N+1 queries** - Use JOINs instead

---

## Troubleshooting

### High Dead Tuple Count

```sql
-- Check dead tuples
SELECT 
    relname,
    n_dead_tup,
    n_live_tup,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;

-- Run VACUUM
VACUUM ANALYZE table_name;
```

### Low Cache Hit Ratio

```sql
-- Check cache hit ratio
SELECT 
    relname,
    heap_blks_hit,
    heap_blks_read,
    round(100.0 * heap_blks_hit / (heap_blks_hit + heap_blks_read), 2) as hit_ratio
FROM pg_statio_user_tables
WHERE schemaname = 'public'
ORDER BY hit_ratio ASC;

-- Increase shared_buffers if ratio < 95%
```

### Connection Exhaustion

```sql
-- Check connection usage
SELECT 
    count(*) as total,
    state,
    wait_event_type
FROM pg_stat_activity
WHERE datname = 'nakama'
GROUP BY state, wait_event_type;

-- Terminate idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'nakama'
    AND state = 'idle'
    AND query_start < NOW() - interval '10 minutes';
```

---

## Maintenance Schedule

### Daily
- [ ] Monitor query performance
- [ ] Check connection usage
- [ ] Review error logs

### Weekly
- [ ] Run ANALYZE on high-traffic tables
- [ ] Review slow query log
- [ ] Check index usage statistics

### Monthly
- [ ] Review and remove unused indexes
- [ ] Analyze table bloat
- [ ] Update PostgreSQL configuration if needed
- [ ] Review autovacuum effectiveness

---

**Status**: ✅ Performance Optimization Documented
**Next Step**: Create Phase 1.2 Summary Document
