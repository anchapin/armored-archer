# Migration Execution Documentation

**Phase**: 1.2 - Database Migration Execution
**Milestone**: v2.1.0 - Alpha Launch & Stabilization
**Created**: 2026-03-16

---

## Overview

This document provides comprehensive instructions for executing database migrations on the alpha environment.

---

## Migration Scripts Location

- **Migration Script**: `/home/alex/armored-archer/backend/scripts/migrate-database.sh`
- **Migration Files**: `/home/alex/armored-archer/backend/data/*.sql`

---

## Pre-Migration Checklist

Before executing migrations:

- [ ] **Backup created**: Run `./scripts/backup-database.sh`
- [ ] **Backup verified**: Check backup file exists and is valid
- [ ] **Low-traffic window**: Schedule during minimal user activity
- [ ] **Team notified**: Alert team of potential downtime (5-10 minutes)
- [ ] **Logs ready**: Ensure logging directory exists
- [ ] **Rollback plan**: Review rollback procedures

---

## Migration Execution

### Option 1: Using Migration Script (Recommended)

```bash
cd /home/alex/armored-archer/backend

# Execute migrations with default settings
./scripts/migrate-database.sh

# Execute with custom environment
./scripts/migrate-database.sh alpha

# Execute with custom database connection
DB_HOST=alpha-db DB_PORT=5432 DB_NAME=nakama DB_USER=postgres \
  ./scripts/migrate-database.sh
```

### Option 2: Using Nakama Built-in Migration

```bash
# Using Docker Compose
docker exec -it armored_archer_server /nakama/nakama migrate up

# Using Make
make backend-migrate
```

### Option 3: Manual SQL Execution

```bash
# Execute all migrations in order
cd /home/alex/armored-archer/backend/data

for file in $(ls *.sql | sort); do
  echo "Executing $file..."
  docker exec -i armored_archer_postgres psql \
    -U postgres \
    -h localhost \
    -d nakama \
    -f /nakama/data/migrations/$file
done
```

---

## Migration Files Order

Migrations are executed in numerical order:

| Order | File | Description |
|-------|------|-------------|
| 1 | `001_create_player_stats.sql` | Player progression table |
| 2 | `002_create_catalog.sql` | Gear catalog table |
| 3 | `003_create_inventory.sql` | Player inventory table |
| 4 | `004_create_loadout.sql` | Player equipment table |
| 5 | `005_create_stage_completion.sql` | Stage completion tracking |
| 6 | `006_create_notifications.sql` | Push notification system |
| 7 | `007_create_boss_defeat_tracking.sql` | Boss defeat tracking |

---

## Monitoring During Migration

### Watch Migration Logs

```bash
# Real-time logs
docker-compose logs -f nakama

# PostgreSQL logs
docker-compose logs -f postgres
```

### Monitor Database Connections

```bash
# Check active connections
docker exec -it armored_archer_postgres psql \
  -U postgres -d nakama \
  -c "SELECT count(*) as active_connections FROM pg_stat_activity;"
```

### Monitor Database Size

```bash
# Check database size
docker exec -it armored_archer_postgres psql \
  -U postgres -d nakama \
  -c "SELECT pg_size_pretty(pg_database_size('nakama'));"
```

### Monitor Long-Running Queries

```bash
# Check for long-running queries
docker exec -it armored_archer_postgres psql \
  -U postgres -d nakama \
  -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query \
      FROM pg_stat_activity \
      WHERE (now() - pg_stat_activity.query_start) > interval '1 minute';"
```

---

## Migration Output

### Expected Output

```
==========================================
Armored Archer - Database Migration Script
==========================================

Configuration:
  Environment: alpha
  Database: nakama
  Host: localhost:5432
  User: postgres
  Migration Directory: /path/to/data
  Log File: /path/to/logs/migration_20260316_120000.log

Using Nakama migration system...

✓ Nakama migrations completed successfully

==========================================
Migration Verification
==========================================

Verifying migrations...

Migration version:
 version
---------
       7

Database tables:
               List of relations
 Schema |        Name        | Type  |  Owner
--------+--------------------+-------+----------
 public | player_stats       | table | postgres
 public | catalog            | table | postgres
 public | inventory          | table | postgres
 public | loadout            | table | postgres
 public | stage_completion   | table | postgres
 public | device_tokens      | table | postgres
 public | notification_preferences | table | postgres
 public | scheduled_notifications | table | postgres
 public | notification_history | table | postgres
 public | boss_defeats       | table | postgres
 public | unlocked_modifier_pools | table | postgres

Total tables: 11

==========================================
Migration Summary
==========================================

✓ All migrations completed successfully!

Migration completed at: Mon Mar 16 12:00:00 UTC 2026
Log file: /path/to/logs/migration_20260316_120000.log

Next steps:
  1. Run verification: ./scripts/verify-migrations.sh
  2. Run data integrity checks: ./scripts/data-integrity-checks.sh
  3. Run performance optimization: ./scripts/optimize-database.sh
```

---

## Error Handling

### Migration Fails - Syntax Error

If a migration fails due to a syntax error:

1. **Stop the migration** (Ctrl+C if running interactively)
2. **Check the logs** for the specific error
3. **Fix the migration script**
4. **Restore from backup** if database is in inconsistent state
5. **Re-run migrations**

```bash
# Check migration logs
tail -100 ./logs/migration_*.log

# Restore from backup
./scripts/restore-database.sh ./backups/nakama_backup_YYYYMMDD_HHMMSS.sql.gz

# Re-run migrations
./scripts/migrate-database.sh
```

### Migration Fails - Foreign Key Violation

If a migration fails due to foreign key constraints:

1. **Check migration order** - ensure dependencies are correct
2. **Check existing data** - may need to clean up orphaned records
3. **Use IF NOT EXISTS** - make migrations idempotent

```bash
# Check for orphaned records
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c \
  "SELECT i.* FROM inventory i LEFT JOIN users u ON i.user_id = u.id WHERE u.id IS NULL;"
```

### Migration Fails - Database Locked

If the database is locked:

```bash
# Check active connections
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c \
  "SELECT * FROM pg_stat_activity WHERE datname = 'nakama';"

# Terminate all connections except current
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity \
   WHERE datname = 'nakama' AND pid <> pg_backend_pid();"

# Re-run migration
./scripts/migrate-database.sh
```

---

## Rollback Procedure

### Full Rollback

If migrations need to be rolled back:

```bash
# 1. Stop Nakama server
docker-compose stop nakama

# 2. Restore from backup
./scripts/restore-database.sh ./backups/nakama_backup_YYYYMMDD_HHMMSS.sql.gz

# 3. Restart Nakama
docker-compose start nakama
```

### Partial Rollback (Specific Migration)

To rollback a specific migration:

1. **Create rollback SQL** for the specific migration
2. **Execute rollback SQL**
3. **Update migration_version** table

```sql
-- Example: Rollback migration 007
DROP TABLE IF EXISTS unlocked_modifier_pools;
DROP TABLE IF EXISTS boss_defeats;

-- Update migration version
UPDATE migration_version SET version = 6;
```

---

## Post-Migration Steps

After migrations complete:

1. **Run verification script**
   ```bash
   ./scripts/verify-migrations.sh
   ```

2. **Run data integrity checks**
   ```bash
   ./scripts/data-integrity-checks.sh
   ```

3. **Run performance optimization**
   ```bash
   ./scripts/optimize-database.sh
   ```

4. **Verify application connectivity**
   - Test API endpoints
   - Check application logs
   - Verify user operations

5. **Monitor for 24 hours**
   - Watch error logs
   - Monitor database performance
   - Check query response times

---

## Migration Logging

### Log File Location

Logs are stored in: `/home/alex/armored-archer/backend/logs/`

### Log File Format

```
migration_YYYYMMDD_HHMMSS.log
```

### Log Contents

- Migration start time
- Each migration file executed
- SQL execution results
- Errors (if any)
- Migration end time
- Verification results

### View Logs

```bash
# View latest migration log
tail -f ./logs/migration_*.log

# Search for errors
grep -i "error" ./logs/migration_*.log

# Search for specific migration
grep "005_create_stage_completion" ./logs/migration_*.log
```

---

## Troubleshooting

### Nakama Migration Command Not Found

```bash
# Check Nakama container is running
docker ps | grep nakama

# Check Nakama version
docker exec -it armored_archer_server /nakama/nakama --version

# Restart Nakama container
docker-compose restart nakama
```

### Permission Denied

```bash
# Fix script permissions
chmod +x ./scripts/migrate-database.sh

# Fix directory permissions
chmod 755 ./logs
```

### Connection Refused

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection string
echo $DATABASE_ADDRESS

# Test connection
docker exec armored_archer_postgres pg_isready -U postgres -d nakama
```

---

## Migration Best Practices

1. **Always backup first** - Never run migrations without a recent backup
2. **Test on staging** - Always test migrations on staging environment first
3. **Use transactions** - Wrap migrations in transactions when possible
4. **Make idempotent** - Use `IF NOT EXISTS` and `CREATE OR REPLACE`
5. **Document changes** - Update DATABASE_SCHEMA.md after each migration
6. **Version control** - Commit migration scripts before executing
7. **Monitor closely** - Watch logs and metrics during migration
8. **Have rollback plan** - Know how to rollback before migrating

---

**Status**: ✅ Migration Execution Documented
**Next Step**: Execute Task 1.2.4 - Migration Verification
