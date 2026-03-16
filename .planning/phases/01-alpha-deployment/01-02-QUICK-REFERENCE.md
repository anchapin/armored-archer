# Phase 1.2 - Quick Reference Card

**Database Migration Execution - Alpha Deployment**

---

## Quick Start Commands

### 1. Pre-Migration Backup

```bash
cd /home/alex/armored-archer/backend

# Create backup
./scripts/backup-database.sh

# Verify backup
ls -lh ./backups/nakama_backup_*.sql.gz
```

### 2. Execute Migrations

```bash
# Run migrations
./scripts/migrate-database.sh

# Or using Nakama directly
docker exec -it armored_archer_server /nakama/nakama migrate up
```

### 3. Verify Migrations

```bash
# Quick verification
./scripts/verify-migrations-quick.sh

# Full verification
./scripts/verify-migrations.sh
```

### 4. Data Integrity Checks

```bash
# Run integrity checks
./scripts/data-integrity-checks.sh
```

### 5. Performance Optimization

```bash
# Optimize database
./scripts/optimize-database.sh
```

---

## Manual Verification Commands

```bash
# Connect to database
docker exec -it armored_archer_postgres psql -U postgres -d nakama

# Check tables (should show 11)
\dt

# Check migration version
SELECT * FROM migration_version;

# Check table count
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

# Exit
\q
```

---

## Rollback Commands

```bash
# Restore from backup
./scripts/restore-database.sh ./backups/nakama_backup_YYYYMMDD_HHMMSS.sql.gz

# Or manually
gunzip -c nakama_backup.sql.gz | \
  docker exec -i -e PGPASSWORD="password" \
  armored_archer_postgres psql -U postgres -h localhost -d nakama
```

---

## File Locations

### Scripts
- `/home/alex/armored-archer/backend/scripts/backup-database.sh`
- `/home/alex/armored-archer/backend/scripts/restore-database.sh`
- `/home/alex/armored-archer/backend/scripts/migrate-database.sh`
- `/home/alex/armored-archer/backend/scripts/verify-migrations-quick.sh`
- `/home/alex/armored-archer/backend/scripts/verify-migrations.sh`
- `/home/alex/armored-archer/backend/scripts/data-integrity-checks.sh`
- `/home/alex/armored-archer/backend/scripts/optimize-database.sh`

### Documentation
- `/home/alex/armored-archer/.planning/phases/01-alpha-deployment/01-02-SUMMARY.md`
- `/home/alex/armored-archer/.planning/phases/01-alpha-deployment/01-02-migration-preparation.md`
- `/home/alex/armored-archer/.planning/phases/01-alpha-deployment/01-02-backup-procedure.md`
- `/home/alex/armored-archer/.planning/phases/01-alpha-deployment/01-02-migration-execution.md`
- `/home/alex/armored-archer/.planning/phases/01-alpha-deployment/01-02-performance-optimization.md`

### Logs
- `/home/alex/armored-archer/backend/logs/`

### Backups
- `/home/alex/armored-archer/backend/backups/`

---

## Expected Results

### Tables (11 total)
```
player_stats
catalog
inventory
loadout
stage_completion
device_tokens
notification_preferences
scheduled_notifications
notification_history
boss_defeats
unlocked_modifier_pools
```

### Migration Version
```
 version
---------
       7
```

---

## Troubleshooting

### Cannot connect to database
```bash
docker ps | grep postgres
docker-compose logs postgres
```

### Migration fails
```bash
# Check logs
tail -f ./logs/migration_*.log

# Restore and retry
./scripts/restore-database.sh ./backups/nakama_backup_*.sql.gz
./scripts/migrate-database.sh
```

### Permission denied
```bash
chmod +x ./scripts/*.sh
```

---

## Human Verification Checklist

- [ ] Backup created successfully
- [ ] Migrations completed without errors
- [ ] All 11 tables exist
- [ ] Migration version is 7
- [ ] Data integrity checks pass
- [ ] Performance is acceptable

**Resume Signal**: "Database migrations verified, proceed to Go module deployment"

---

*Quick Reference - Phase 1.2 - Database Migration Execution*
