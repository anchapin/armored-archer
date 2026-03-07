# Nakama Database Migrations

This directory contains SQL migration files for the Armored Archer game database.

## Quick Commands

Run migrations via Make:
```bash
make backend-migrate      # Run all pending migrations
make backend-migrate-new   # Create new migration file
make backend-db-schema     # Display current schema
```

## Migration Files

### 001_create_player_stats.sql
Creates the `player_stats` table which stores:
- Player level and experience
- Unallocated ability points
- Allocated stats (stored as JSONB)
  - attack_power
  - defense
  - dodge_chance
  - crit_rate
  - etc.

### 002_create_catalog.sql
Creates the `catalog` table (master gear catalog) which stores:
- All base gear available in the game
- Gear type: helm, armor, bow, arrow, amulet
- Rarity: common, rare, epic, legendary
- Base stats (JSONB)
- Modifiers (JSONB array)
- Visual/icon references

### 003_create_inventory.sql
Creates the `inventory` table which stores:
- Links between players and gear they own
- Acquisition timestamps
- Ensures each player can only own one instance of each base gear

### 004_create_loadout.sql
Creates the `loadout` table which stores:
- Currently equipped gear for each player
- 5 slots: helm, armor, bow, arrow, amulet
- Supports the transmog system (base gear + cosmetic skins)

## Running Migrations

### Automatic (Recommended)
When Nakama starts (via docker-compose), it automatically runs all pending migrations.

### Manual
```bash
docker exec -it armored_archer_server /nakama/nakama migrate up --database.address postgres://postgres:localdbpassword@postgres:5432/nakama
```

Or use Make:
```bash
make backend-migrate
```

## Creating New Migrations

Use the Make target to create a new migration with proper naming:
```bash
make backend-migrate-new
# Enter migration name when prompted (e.g., add_season_table)
```

Or create manually with format: `###_description.sql`
```bash
# Migrations are numbered sequentially
cp 004_create_loadout.sql 005_add_season_table.sql
```

### Migration Template
```sql
-- Migration: add_season_table
-- Created: 2026-03-06

BEGIN;

-- Add your SQL here
CREATE TABLE IF NOT EXISTS season (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
```

## Schema Design Principles

- **Foreign Keys**: All tables that reference Nakama users use `user_id UUID REFERENCES users(id) ON DELETE CASCADE`
- **JSONB**: Used for flexible data storage (stats, modifiers) while maintaining queryability with GIN indexes
- **Indexes**: Added on frequently queried columns and JSONB fields for performance
- **Timestamps**: All tables have `created_at` and `updated_at` with triggers for automatic updates
- **Constraints**: Added CHECK constraints for data validation (e.g., level >= 1, experience >= 0)

## Transmog System Support

The schema separates base gear (stats/modifiers) from cosmetic skins:
- `catalog` stores base gear earned via gameplay
- Cosmetic skins (not yet implemented) will store only visual data
- Client combines base gear + skin for rendering

## Schema Inspection

View current tables:
```bash
make backend-db-schema
# Or directly:
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\dt'
```

View table structure:
```bash
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\d player_stats'
```

## Troubleshooting

### Migration fails
1. Check Docker is running: `docker ps`
2. Start backend: `make backend-start`
3. Check migration file syntax
4. Review Nakama logs: `docker logs armored_archer_server`

### Database reset
⚠️ This will delete all data!
```bash
docker-compose down -v  # Remove volumes
make backend-start      # Fresh start with migrations
```
