# Pre-Migration Backup Procedure

**Phase**: 1.2 - Database Migration Execution
**Milestone**: v2.1.0 - Alpha Launch & Stabilization
**Created**: 2026-03-16

---

## Overview

This document outlines the procedure for creating and verifying database backups before executing migrations on the alpha environment.

---

## Backup Scripts Location

- **Backup Script**: `/home/alex/armored-archer/backend/scripts/backup-database.sh`
- **Restore Script**: `/home/alex/armored-archer/backend/scripts/restore-database.sh`

---

## Pre-Backup Checklist

Before creating a backup, ensure:

- [ ] Database server is running and healthy
- [ ] Sufficient disk space available (at least 2x database size)
- [ ] Backup directory exists or can be created
- [ ] Network connectivity to database is stable
- [ ] No long-running queries or transactions

---

## Creating a Backup

### Option 1: Using Backup Script (Recommended)

```bash
cd /home/alex/armored-archer/backend

# Create backup with default settings
./scripts/backup-database.sh

# Create backup in custom directory
./scripts/backup-database.sh /path/to/backup/location

# Create backup with custom database connection
DB_HOST=alpha-db DB_PORT=5432 DB_NAME=nakama DB_USER=postgres ./scripts/backup-database.sh
```

### Option 2: Manual pg_dump

```bash
# Using Docker
docker exec armored_archer_postgres pg_dump \
  -U postgres \
  -h localhost \
  -d nakama \
  -F p | gzip > nakama_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Using local psql
export PGPASSWORD="your_password"
pg_dump \
  -h alpha-db \
  -p 5432 \
  -U postgres \
  -d nakama \
  -F p | gzip > nakama_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Option 3: Full Database Cluster Backup

```bash
# Using pg_dumpall for full cluster backup
docker exec armored_archer_postgres pg_dumpall \
  -U postgres | gzip > nakama_cluster_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

---

## Backup Verification

### Automated Verification

The backup script automatically verifies:
1. File exists and is not empty
2. Gzip integrity (can be decompressed)
3. SHA256 checksum created
4. Key tables present in backup

### Manual Verification

```bash
# Check file exists and size
ls -lh nakama_backup_*.sql.gz

# Verify gzip integrity
gzip -t nakama_backup_YYYYMMDD_HHMMSS.sql.gz

# Verify checksum
sha256sum -c nakama_backup_YYYYMMDD_HHMMSS.sql.gz.sha256

# Preview backup contents
zcat nakama_backup_YYYYMMDD_HHMMSS.sql.gz | head -50

# Count tables in backup
zcat nakama_backup_YYYYMMDD_HHMMSS.sql.gz | grep -c "CREATE TABLE"

# Check for specific tables
zcat nakama_backup_YYYYMMDD_HHMMSS.sql.gz | grep "CREATE TABLE.*player_stats"
zcat nakama_backup_YYYYMMDD_HHMMSS.sql.gz | grep "CREATE TABLE.*catalog"
zcat nakama_backup_YYYYMMDD_HHMMSS.sql.gz | grep "CREATE TABLE.*inventory"
zcat nakama_backup_YYYYMMDD_HHMMSS.sql.gz | grep "CREATE TABLE.*loadout"
```

---

## Backup Storage

### Local Storage

Backups are stored in `./backups/` directory by default:
```
backend/backups/
├── nakama_backup_20260316_120000.sql.gz
├── nakama_backup_20260316_120000.sql.gz.sha256
└── nakama_backup_20260316_120000.sql.gz.metadata.json
```

### Remote Storage (Recommended for Production)

```bash
# Copy to remote server
scp nakama_backup_*.sql.gz backup-server:/backups/nakama/

# Copy to S3
aws s3 cp nakama_backup_*.sql.gz s3://your-bucket/backups/nakama/

# Copy to Google Cloud Storage
gsutil cp nakama_backup_*.sql.gz gs://your-bucket/backups/nakama/
```

---

## Restore Procedure

### Test Restore (Recommended Before Migration)

```bash
# 1. Create a test database
docker exec -it armored_archer_postgres createdb -U postgres nakama_test

# 2. Restore to test database
DB_NAME=nakama_test ./scripts/restore-database.sh ./backups/nakama_backup_YYYYMMDD_HHMMSS.sql.gz

# 3. Verify test restore
docker exec -it armored_archer_postgres psql -U postgres -d nakama_test -c "\dt"

# 4. Drop test database
docker exec -it armored_archer_postgres dropdb -U postgres nakama_test
```

### Full Restore (If Migration Fails)

```bash
cd /home/alex/armored-archer/backend

# List available backups
./scripts/restore-database.sh

# Restore latest backup
./scripts/restore-database.sh ./backups/nakama_backup_YYYYMMDD_HHMMSS.sql.gz

# Restore with custom connection
DB_HOST=alpha-db DB_PORT=5432 DB_NAME=nakama DB_USER=postgres \
  ./scripts/restore-database.sh /path/to/backup.sql.gz
```

### Manual Restore

```bash
# Decompress and restore
gunzip -c nakama_backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i -e PGPASSWORD="password" \
  armored_archer_postgres psql -U postgres -h localhost -d nakama
```

---

## Backup Retention Policy

### Automatic Cleanup

The backup script automatically:
- Keeps backups for 7 days
- Removes backups older than 7 days
- Preserves checksums and metadata

### Manual Retention

```bash
# Keep last 30 days of backups
find ./backups -name "nakama_backup_*.sql.gz" -mtime +30 -delete

# Keep only monthly backups (first of month)
find ./backups -name "nakama_backup_*.sql.gz" ! -name "*01_*" -mtime +30 -delete
```

---

## Backup Schedule

### Pre-Migration Backup

Always create a backup immediately before running migrations:

```bash
# 1. Stop application writes (if possible)
# 2. Create backup
./scripts/backup-database.sh

# 3. Verify backup
ls -lh ./backups/nakama_backup_*.sql.gz

# 4. Run migrations
docker exec -it armored_archer_server /nakama/nakama migrate up

# 5. Verify migrations
./scripts/verify-migrations.sh

# 6. Keep backup for 7 days minimum after successful migration
```

### Regular Backup Schedule

For alpha environment:
- **Frequency**: Daily at 2:00 AM
- **Retention**: 7 days

```bash
# Add to crontab
0 2 * * * cd /home/alex/armored-archer/backend && ./scripts/backup-database.sh /backups/nakama
```

---

## Troubleshooting

### Backup Fails - Connection Error

```bash
# Check database is running
docker ps | grep postgres

# Check network connectivity
docker exec armored_archer_postgres pg_isready -U postgres

# Check database exists
docker exec -it armored_archer_postgres psql -U postgres -c "\l"
```

### Backup Fails - Disk Space

```bash
# Check available disk space
df -h

# Clean up old backups
find ./backups -name "nakama_backup_*.sql.gz" -mtime +7 -delete

# Check database size
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT pg_size_pretty(pg_database_size('nakama'));"
```

### Restore Fails - Database Locked

```bash
# Check active connections
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT * FROM pg_stat_activity;"

# Terminate all connections except current
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'nakama' AND pid <> pg_backend_pid();"
```

---

## Backup Verification Checklist

After creating a backup, verify:

- [ ] Backup file exists
- [ ] Backup file size is reasonable (> 1KB)
- [ ] Checksum file created
- [ ] Gzip integrity verified
- [ ] Key tables present in backup
- [ ] Backup stored in secure location
- [ ] Metadata file created
- [ ] Old backups cleaned up (if applicable)

---

## Emergency Contacts

If backup/restore issues occur:

1. Check logs: `docker-compose logs postgres`
2. Check database status: `docker exec armored_archer_postgres pg_isready`
3. Review backup script output for errors
4. Consult DATABASE_SCHEMA.md for schema details

---

**Status**: ✅ Backup Procedure Documented
**Next Step**: Execute backup before migration
