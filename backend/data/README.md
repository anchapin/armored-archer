# Nakama Database Migrations

This directory contains SQL migration files for the Armored Archer game database.

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

When Nakama starts (via docker-compose), it automatically runs all pending migrations.

To manually run migrations:
```bash
docker exec -it armored_archer_server /nakama/nakama migrate up --database.address postgres:localdbpassword@postgres:5432/nakama
```

## Schema Design Notes

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
