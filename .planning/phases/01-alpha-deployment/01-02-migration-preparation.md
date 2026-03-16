# Migration Preparation Documentation

**Phase**: 1.2 - Database Migration Execution
**Milestone**: v2.1.0 - Alpha Launch & Stabilization
**Created**: 2026-03-16

---

## 1. Migration Scripts Overview

### Migration Files Location
All migration scripts are located in: `/home/alex/armored-archer/backend/data/`

### Migration Order and Dependencies

| Order | File | Description | Dependencies |
|-------|------|-------------|--------------|
| 1 | `001_create_player_stats.sql` | Creates player_stats table with level, experience, and stats | None (depends on Nakama `users` table) |
| 2 | `002_create_catalog.sql` | Creates catalog table with gear types and rarities | None |
| 3 | `003_create_inventory.sql` | Creates inventory table for player gear ownership | `001`, `002` (FK to users and catalog) |
| 4 | `004_create_loadout.sql` | Creates loadout table with 5 equipment slots | `002` (FK to catalog) |
| 5 | `005_create_stage_completion.sql` | Creates stage_completion table for PvE progression | None |
| 6 | `006_create_notifications.sql` | Creates notification tables (device_tokens, preferences, scheduled, history) | None (depends on Nakama `users` table) |
| 7 | `007_create_boss_defeat_tracking.sql` | Creates boss_defeats and unlocked_modifier_pools tables | None |

### Migration Scripts Review

#### 001_create_player_stats.sql
**Purpose**: Store player progression data
**Key Features**:
- Primary key: `user_id` (UUID, references Nakama users table)
- Level system with CHECK constraints (level >= 1)
- Experience tracking (BIGINT, >= 0)
- JSONB stats field for flexible stat allocation
- Auto-updating `updated_at` timestamp trigger
- Indexes on `level` and `experience` for leaderboard queries

**Rollback**:
```sql
DROP TRIGGER IF EXISTS update_player_stats_updated_at ON player_stats;
DROP INDEX IF EXISTS idx_player_stats_experience;
DROP INDEX IF EXISTS idx_player_stats_level;
DROP TABLE IF EXISTS player_stats;
DROP FUNCTION IF EXISTS update_updated_at_column();
```

#### 002_create_catalog.sql
**Purpose**: Master catalog of all base gear
**Key Features**:
- Creates `gear_type` and `gear_rarity` enums
- UUID primary key with auto-generation
- JSONB fields for `base_stats` and `modifiers`
- GIN indexes on JSONB fields for flexible querying
- Indexes on `gear_type` and `rarity` for filtering

**Rollback**:
```sql
DROP TRIGGER IF EXISTS update_catalog_updated_at ON catalog;
DROP INDEX IF EXISTS idx_catalog_modifiers;
DROP INDEX IF EXISTS idx_catalog_base_stats;
DROP INDEX IF EXISTS idx_catalog_rarity;
DROP INDEX IF EXISTS idx_catalog_gear_type;
DROP TABLE IF EXISTS catalog;
DROP TYPE IF EXISTS gear_rarity;
DROP TYPE IF EXISTS gear_type;
DROP FUNCTION IF EXISTS update_updated_at_column();
```

#### 003_create_inventory.sql
**Purpose**: Track gear owned by players
**Key Features**:
- Composite unique constraint (user_id, gear_id) - one instance per gear per user
- Foreign keys to `users` and `catalog` with CASCADE delete
- Indexes for user lookup, gear lookup, and acquisition time

**Rollback**:
```sql
DROP INDEX IF EXISTS idx_inventory_acquired_at;
DROP INDEX IF EXISTS idx_inventory_gear_id;
DROP INDEX IF EXISTS idx_inventory_user_id;
DROP INDEX IF EXISTS idx_inventory_user_gear;
DROP TABLE IF EXISTS inventory;
```

#### 004_create_loadout.sql
**Purpose**: Store equipped gear (5 slots)
**Key Features**:
- Unique `user_id` constraint (one loadout per user)
- 5 nullable gear slots (helm, armor, bow, arrow, amulet)
- Foreign keys with SET NULL on delete
- Individual indexes on each gear slot for equip/unequip queries

**Rollback**:
```sql
DROP TRIGGER IF EXISTS update_loadout_updated_at ON loadout;
DROP INDEX IF EXISTS idx_loadout_amulet_gear;
DROP INDEX IF EXISTS idx_loadout_arrow_gear;
DROP INDEX IF EXISTS idx_loadout_bow_gear;
DROP INDEX IF EXISTS idx_loadout_armor_gear;
DROP INDEX IF EXISTS idx_loadout_helm_gear;
DROP INDEX IF EXISTS idx_loadout_user_id;
DROP TABLE IF EXISTS loadout;
```

#### 005_create_stage_completion.sql
**Purpose**: Track PvE stage completion with star ratings
**Key Features**:
- Unique constraint on (user_id, stage_id)
- Star rating system (0-3 stars)
- Score tracking
- Indexes for user queries and stage prefix filtering

**Rollback**:
```sql
DROP INDEX IF EXISTS idx_stage_completion_prefix;
DROP INDEX IF EXISTS idx_stage_completion_user_id;
DROP TABLE IF EXISTS stage_completion;
```

#### 006_create_notifications.sql
**Purpose**: Push notification system
**Key Features**:
- `device_tokens`: FCM token storage with platform tracking
- `notification_preferences`: User preferences with quiet hours
- `scheduled_notifications`: Batch notification scheduling
- `notification_history`: Analytics and delivery tracking
- Helper function `get_user_notification_preferences()`

**Rollback**:
```sql
DROP FUNCTION IF EXISTS get_user_notification_preferences;
DROP INDEX IF EXISTS idx_notification_history_status;
DROP INDEX IF EXISTS idx_notification_history_delivered_at;
DROP INDEX IF EXISTS idx_notification_history_notification_type;
DROP INDEX IF EXISTS idx_notification_history_user_id;
DROP TABLE IF EXISTS notification_history;
DROP INDEX IF EXISTS idx_scheduled_notifications_status;
DROP INDEX IF EXISTS idx_scheduled_notifications_scheduled_for;
DROP INDEX IF EXISTS idx_scheduled_notifications_user_id;
DROP TABLE IF EXISTS scheduled_notifications;
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
DROP INDEX IF EXISTS idx_notification_preferences_user_id;
DROP TABLE IF EXISTS notification_preferences;
DROP TRIGGER IF EXISTS update_device_tokens_updated_at ON device_tokens;
DROP INDEX IF EXISTS idx_device_tokens_last_used_at;
DROP INDEX IF EXISTS idx_device_tokens_device_token;
DROP INDEX IF EXISTS idx_device_tokens_user_id;
DROP TABLE IF EXISTS device_tokens;
DROP FUNCTION IF EXISTS update_updated_at_column();
```

#### 007_create_boss_defeat_tracking.sql
**Purpose**: Boss defeat tracking and modifier unlocks
**Key Features**:
- `boss_defeats`: Track defeat count per boss per user
- `unlocked_modifier_pools`: Track unlocked modifier pools
- Indexes for user and boss/modifier lookups

**Rollback**:
```sql
DROP INDEX IF EXISTS idx_unlocked_modifier_pools_modifier_id;
DROP INDEX IF EXISTS idx_unlocked_modifier_pools_user_id;
DROP INDEX IF EXISTS idx_boss_defeats_boss_id;
DROP INDEX IF EXISTS idx_boss_defeats_user_id;
DROP TABLE IF EXISTS unlocked_modifier_pools;
DROP TABLE IF EXISTS boss_defeats;
```

---

## 2. Pre-Migration Testing Checklist

### Staging/Dev Environment Testing

Before running migrations on alpha environment:

```bash
# 1. Start local development environment
cd backend
./start.sh

# 2. Verify database is accessible
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT 1;"

# 3. Run migrations
docker exec -it armored_archer_server /nakama/nakama migrate up

# 4. Verify all tables created
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "\dt"

# 5. Run schema tests
npm run test:schema

# 6. Verify migration version
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT * FROM migration_version;"
```

### Expected Test Results

- All 7 migrations should complete without errors
- Schema tests should pass (run `npm run test:schema`)
- All tables should be visible with `\dt`
- Migration version should show version 7

---

## 3. Migration Execution Plan

### Prerequisites

1. **Docker Compose** installed and running
2. **PostgreSQL 14** container accessible
3. **Nakama server** container running
4. **Backup completed** (see Task 1.2.2)
5. **Low-traffic window** scheduled

### Migration Commands

```bash
# Option 1: Using Docker Compose (Recommended)
docker exec -it armored_archer_server /nakama/nakama migrate up

# Option 2: Using Make
make backend-migrate

# Option 3: Direct psql (if not using Nakama migration system)
cd backend/data
for file in $(ls *.sql | sort); do
  echo "Executing $file..."
  docker exec -i armored_archer_postgres psql -U postgres -d nakama -f /nakama/data/migrations/$file
done
```

### Monitoring During Migration

```bash
# Watch migration logs
docker-compose logs -f nakama

# Monitor database connections
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT count(*) FROM pg_stat_activity;"

# Monitor database size
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT pg_size_pretty(pg_database_size('nakama'));"
```

---

## 4. Rollback Procedure

### Full Rollback (All Migrations)

```bash
# Stop Nakama server
docker-compose stop nakama

# Connect to database
docker exec -it armored_archer_postgres psql -U postgres -d nakama

# Execute rollback scripts in reverse order
# (Use the rollback SQL provided in Section 1 for each migration)

# Restart Nakama
docker-compose start nakama
```

### Partial Rollback (Specific Migration)

If migration N fails:
1. Rollback migrations N, N-1, N-2... until the failing migration can be fixed
2. Fix the migration script
3. Re-run all migrations from the beginning

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration script syntax error | Low | High | Test on staging first |
| Foreign key constraint violation | Low | Medium | Ensure migration order is correct |
| Database connection loss | Low | High | Have backup ready, use transactions |
| Nakama server crash during migration | Very Low | High | Stop Nakama before migration, restart after |
| Data corruption | Very Low | Critical | Full backup before migration, verify after |

---

## 6. Communication Plan

### Before Migration
- [ ] Notify team of migration window
- [ ] Confirm backup completed successfully
- [ ] Verify staging environment tested

### During Migration
- [ ] Log all migration output
- [ ] Monitor database CPU and memory
- [ ] Document any manual interventions

### After Migration
- [ ] Run verification scripts
- [ ] Confirm all tables exist
- [ ] Run data integrity checks
- [ ] Notify team migration complete

---

## 7. Downtime Requirements

**Estimated Downtime**: 5-10 minutes

- Backup creation: 2-5 minutes
- Migration execution: 1-2 minutes
- Verification: 2-3 minutes

**Schedule**: During lowest traffic window (typically 2-4 AM local time)

---

**Status**: ✅ Preparation Complete
**Next Step**: Execute Task 1.2.2 - Pre-Migration Backup
