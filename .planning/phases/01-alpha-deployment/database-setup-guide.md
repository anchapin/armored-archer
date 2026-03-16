# Alpha Database Setup Guide

**Milestone**: v2.1.0 - Alpha Launch & Stabilization
**Phase**: 1.1 - Alpha Environment Setup
**Task**: 1.1.3 - Database Setup
**Date**: 2026-03-16

---

## Overview

This document describes the database setup procedure for the alpha environment, including migration execution, backup configuration, and verification steps.

---

## Database Architecture

### Components

| Component | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 14-alpine | Primary database |
| Nakama | 3.21.1 | Game server with embedded database logic |
| Redis | 7-alpine | Session cache and matchmaking |

### Database Schema

The alpha database includes the following core tables:

1. **player_stats** - Player level, experience, ability points, stats
2. **catalog** - Master gear catalog with types, rarities, stats
3. **inventory** - Player gear ownership
4. **loadout** - 5 equipment slots (helm, armor, bow, arrow, amulet)

### Migration Files

Location: `/home/alex/armored-archer/migrations/`

| File | Description |
|------|-------------|
| `001_create_player_stats.sql` | Creates player_stats table |
| `002_create_catalog.sql` | Creates gear catalog table |
| `003_create_inventory.sql` | Creates inventory table |
| `004_create_loadout.sql` | Creates loadout table |

---

## Setup Procedure

### Step 1: Start Database Services

```bash
# Navigate to backend directory
cd backend

# Start all services (includes PostgreSQL)
make services-start

# Or using docker-compose directly
docker-compose up -d postgres
```

### Step 2: Verify Database Connection

```bash
# Wait for PostgreSQL to be ready
docker-compose exec postgres pg_isready -U postgres -d nakama

# Expected output: postgres:5432 - accepting connections
```

### Step 3: Run Database Migrations

```bash
# Using Nakama migrate command
docker exec -it armored_archer_server /nakama/nakama migrate up --database.address postgres://postgres:localdbpassword@postgres:5432/nakama

# Or using make command
make backend-migrate
```

### Step 4: Verify Migrations

```bash
# Check migration version
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT * FROM migration_version;"

# List all tables
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\dt'

# Expected tables:
# - player_stats
# - catalog
# - inventory
# - loadout
# - (plus Nakama system tables)
```

### Step 5: Verify Table Structures

```bash
# Check player_stats table structure
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\d player_stats'

# Check catalog table structure
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\d catalog'

# Check inventory table structure
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\d inventory'

# Check loadout table structure
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\d loadout'
```

---

## Database Backup Configuration

### Manual Backup

```bash
# Create backup
docker exec armored_archer_postgres pg_dump -U postgres nakama > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker exec -i armored_archer_postgres psql -U postgres nakama < backup_YYYYMMDD_HHMMSS.sql
```

### Automated Backup Script

Create `/opt/backups/armored-archer/backup-database.sh`:

```bash
#!/bin/bash
# Automated Database Backup Script

set -e

BACKUP_DIR="/opt/backups/armored-archer"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/nakama_backup_${DATE}.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create compressed backup
docker exec armored_archer_postgres pg_dump -U postgres nakama | gzip > "$BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
    echo "Backup created: $BACKUP_FILE"
    # Keep only last 7 days of backups
    find "$BACKUP_DIR" -name "nakama_backup_*.sql.gz" -mtime +7 -delete
    echo "Old backups cleaned up"
else
    echo "Backup failed!"
    exit 1
fi
```

### Cron Job for Automated Backups

Add to crontab (`crontab -e`):

```bash
# Daily backup at 2 AM
0 2 * * * /opt/backups/armored-archer/backup-database.sh >> /var/log/db-backup.log 2>&1
```

---

## Database Optimization

### Run ANALYZE

```bash
# Analyze all tables for query optimization
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "ANALYZE;"
```

### Configure Connection Pooling

Edit `nakama.yml`:

```yaml
database:
  pool_size: 20  # Adjust based on expected load
  max_idle_connections: 5
  max_open_connections: 25
  conn_max_lifetime: 5m
```

### Verify Index Usage

```bash
# Check index usage statistics
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
"
```

---

## Database Monitoring

### Key Metrics to Monitor

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|-------------------|
| Connections | 70% of max | 90% of max |
| Disk Usage | 80% | 95% |
| Query Time (avg) | 100ms | 500ms |
| Cache Hit Ratio | < 95% | < 90% |
| Dead Tuples | > 10% | > 20% |

### Monitoring Queries

```sql
-- Check active connections
SELECT count(*) as active_connections FROM pg_stat_activity;

-- Check database size
SELECT pg_size_pretty(pg_database_size('nakama')) as database_size;

-- Check cache hit ratio
SELECT 
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;

-- Check long-running queries
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

---

## Rollback Procedure

### Rollback Single Migration

```bash
# If a migration fails, you can manually rollback
docker exec -it armored_archer_postgres psql -U postgres -d nakama << EOF
BEGIN;
-- Add rollback SQL here
ROLLBACK;
EOF
```

### Full Database Restore

```bash
# Stop application
docker-compose down

# Restore from backup
gunzip < backup_YYYYMMDD_HHMMSS.sql.gz | docker exec -i armored_archer_postgres psql -U postgres nakama

# Restart services
docker-compose up -d
```

---

## Verification Checklist

- [ ] PostgreSQL service is running
- [ ] Database `nakama` exists
- [ ] All migrations executed successfully
- [ ] All expected tables exist
- [ ] Table structures match schema
- [ ] Indexes created correctly
- [ ] Constraints applied
- [ ] Backup procedure tested
- [ ] Monitoring queries working
- [ ] Connection pooling configured

---

## Troubleshooting

### Issue: Migration Fails

```bash
# Check migration logs
docker-compose logs nakama | grep migrate

# Check database logs
docker-compose logs postgres | grep ERROR

# Verify database connection
docker exec armored_archer_postgres psql -U postgres -d nakama -c "SELECT 1;"
```

### Issue: Connection Refused

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Verify network connectivity
docker-compose exec nakama nc -zv postgres 5432
```

### Issue: Table Not Found

```bash
# List all tables
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\dt'

# Check migration version
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT * FROM migration_version;"

# Re-run migrations
docker exec -it armored_archer_server /nakama/nakama migrate up
```

---

## Next Steps

After database setup is complete:

1. Proceed to Task 1.1.4 - Access Control & Security
2. Configure database monitoring in Grafana
3. Set up alerting for database metrics
4. Test database backup and restore procedures

---

**Created**: 2026-03-16
**Status**: 📋 Ready for Execution
