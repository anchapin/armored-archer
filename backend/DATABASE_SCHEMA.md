# Database Schema Documentation

This document provides comprehensive documentation for the Armored Archer Nakama backend database schema.

## Overview

The database uses PostgreSQL with the Nakama game server framework. The schema is managed through SQL migration files located in `backend/data/`.

## Connection Details

```
Host: localhost (via Docker Compose)
Port: 5432
Database: nakama
User: postgres
Password: localdbpassword
```

## Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      users      │     │   player_stats  │     │     catalog     │
│   (Nakama)      │────▶│                 │     │                 │
│                 │     │ user_id (PK/FK) │     │   gear_id (PK)  │
│   id (UUID)     │     │ level           │     │ gear_type       │
│   username      │     │ experience       │     │ name            │
│   email         │     │ ability_points  │     │ rarity          │
│   ...           │     │ stats (JSONB)   │     │ base_stats      │
└────────┬────────┘     └─────────────────┘     │ modifiers (JSONB│
         │                                            │ icon_url        │
         │                                            │ description     │
         │                                            └────────┬────────┘
         │                                                     │
         │              ┌─────────────────┐                      │
         │              │    loadout      │◀─────────────────────┘
         │              │                 │
         │              │ user_id (PK/FK) │
         │    ┌─────────│ helm_gear_id   │
         │    │         │ armor_gear_id  │
         │    │         │ bow_gear_id    │
         │    │         │ arrow_gear_id  │
         │    │         │ amulet_gear_id │
         │    └─────────┴─────────────────┘
         │              │
         │              ▼
         │      ┌─────────────────┐
         │      │    inventory    │
         │      │                 │
         │      │ inventory_id(PK)│
         │      │ user_id (FK)    │────▶ users
         │      │ gear_id (FK)    │────▶ catalog
         │      │ acquired_at     │
         │      └─────────────────┘
         │
         │
         ▼
┌────────────────────┐
│   match_results   │
│                  │
│ result_id (PK)   │
│ match_id         │
│ creator_id (FK)   │◀─────────────┐
│ opponent_id (FK)   │              │
│ winner_id (FK)     │              │
│ loser_id (FK)      │              │
│ match_type        │              │
│ ...              │              │
└────────────────────┘              │
                                  │
                                  ▼
                           ┌─────────────────┐
                           │      users      │
                           │   (Nakama)      │
                           │                 │
                           │   id (UUID)     │
                           └─────────────────┘
```

## Tables

### 1. player_stats

Stores player progression data including level, experience, and allocated stats.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | UUID | PRIMARY KEY, REFERENCES users(id) ON DELETE CASCADE | Unique user identifier |
| `level` | INTEGER | NOT NULL, DEFAULT 1, CHECK (level >= 1) | Player level |
| `experience` | BIGINT | NOT NULL, DEFAULT 0, CHECK (experience >= 0) | Total experience points |
| `ability_points` | INTEGER | NOT NULL, DEFAULT 0, CHECK (ability_points >= 0) | Unspent ability points |
| `stats` | JSONB | NOT NULL, DEFAULT '{}' | Allocated ability points |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_player_stats_level` ON `player_stats(level)`
- `idx_player_stats_experience` ON `player_stats(experience)`

**Triggers:**
- `update_player_stats_updated_at` - Updates `updated_at` on row modification

**Comments:**
- Table: 'Stores player progression data including level, experience, and allocated stats'
- Column `stats`: 'JSONB object storing allocated ability points across different stats'

**Usage Example:**
```sql
-- Create player stats for a new user
INSERT INTO player_stats (user_id, level, experience, ability_points, stats)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 1, 0, 0, '{"attack_power": 0}');

-- Get player level and experience
SELECT level, experience, stats FROM player_stats 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
```

---

### 2. catalog

Master catalog of all base gear available in the game.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `gear_id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique gear identifier |
| `gear_type` | gear_type | NOT NULL | Type of gear (enum) |
| `name` | TEXT | NOT NULL | Gear name |
| `rarity` | gear_rarity | NOT NULL | Gear rarity (enum) |
| `base_stats` | JSONB | NOT NULL, DEFAULT '{}' | Base stat bonuses |
| `modifiers` | JSONB | NOT NULL, DEFAULT '[]' | Special modifiers |
| `icon_url` | TEXT | NULLABLE | Icon image URL |
| `description` | TEXT | NULLABLE | Gear description |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Enums:**

```sql
CREATE TYPE gear_type AS ENUM ('helm', 'armor', 'bow', 'arrow', 'amulet');
CREATE TYPE gear_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');
```

**Indexes:**
- `idx_catalog_gear_type` ON `catalog(gear_type)`
- `idx_catalog_rarity` ON `catalog(rarity)`
- `idx_catalog_base_stats` ON `catalog` USING GIN(base_stats)
- `idx_catalog_modifiers` ON `catalog` USING GIN(modifiers)

**Triggers:**
- `update_catalog_updated_at` - Updates `updated_at` on row modification

**Comments:**
- Table: 'Master catalog of all base gear available in the game'
- Column `base_stats`: 'JSONB object storing base stat bonuses for this gear'
- Column `modifiers`: 'JSONB array of special modifiers (e.g., piercing, elemental effects)'

**Usage Example:**
```sql
-- Query all legendary bows
SELECT gear_id, name, rarity, base_stats, modifiers
FROM catalog
WHERE gear_type = 'bow' AND rarity = 'legendary';

-- Query gear with specific base stat
SELECT * FROM catalog
WHERE base_stats @> '{"attack_power": 15}';
```

---

### 3. inventory

Tracks gear items owned by players.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `inventory_id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | Unique inventory entry ID |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Owner user |
| `gear_id` | UUID | NOT NULL, REFERENCES catalog(gear_id) ON DELETE CASCADE | Owned gear |
| `acquired_at` | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT NOW() | When gear was acquired |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT NOW() | Creation timestamp |

**Constraints:**
- UNIQUE(user_id, gear_id) - One entry per gear type per user

**Foreign Keys:**
- `user_id` → `users(id)`
- `gear_id` → `catalog(gear_id)`

**Usage Example:**
```sql
-- Add gear to player inventory
INSERT INTO inventory (user_id, gear_id)
VALUES ('550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001')
ON CONFLICT (user_id, gear_id) DO NOTHING;

-- Get player's inventory with gear details
SELECT i.*, c.name, c.gear_type, c.rarity, c.base_stats
FROM inventory i
JOIN catalog c ON i.gear_id = c.gear_id
WHERE i.user_id = '550e8400-e29b-41d4-a716-446655440000';
```

---

### 4. loadout

Stores the 5 equipment slots for each player.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `loadout_id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | Unique loadout ID |
| `user_id` | UUID | NOT NULL, UNIQUE, REFERENCES users(id) ON DELETE CASCADE | Owner user |
| `helm_gear_id` | UUID | NULLABLE, REFERENCES catalog(gear_id) ON DELETE SET NULL | Equipped helm |
| `armor_gear_id` | UUID | NULLABLE, REFERENCES catalog(gear_id) ON DELETE SET NULL | Equipped armor |
| `bow_gear_id` | UUID | NULLABLE, REFERENCES catalog(gear_id) ON DELETE SET NULL | Equipped bow |
| `arrow_gear_id` | UUID | NULLABLE, REFERENCES catalog(gear_id) ON DELETE SET NULL | Equipped arrow |
| `amulet_gear_id` | UUID | NULLABLE, REFERENCES catalog(gear_id) ON DELETE SET NULL | Equipped amulet |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT NOW() | Last update timestamp |

**Constraints:**
- UNIQUE(user_id) - One loadout per user

**Foreign Keys:**
- All gear columns → `catalog(gear_id)`

**Triggers:**
- `update_loadout_updated_at` - Updates `updated_at` on row modification

**Usage Example:**
```sql
-- Get player loadout with gear details
SELECT 
  l.*,
  helm.name as helm_name, armor.name as armor_name,
  bow.name as bow_name, arrow.name as arrow_name,
  amulet.name as amulet_name
FROM loadout l
LEFT JOIN catalog helm ON l.helm_gear_id = helm.gear_id
LEFT JOIN catalog armor ON l.armor_gear_id = armor.gear_id
LEFT JOIN catalog bow ON l.bow_gear_id = bow.gear_id
LEFT JOIN catalog arrow ON l.arrow_gear_id = arrow.gear_id
LEFT JOIN catalog amulet ON l.amulet_gear_id = amulet.gear_id
WHERE l.user_id = '550e8400-e29b-41d4-a716-446655440000';

-- Equip an item
UPDATE loadout 
SET bow_gear_id = '660e8400-e29b-41d4-a716-446655440001',
    updated_at = NOW()
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
```

---

### 5. match_results

Stores completed PvP match results for historical tracking and analytics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `result_id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique match result identifier |
| `match_id` | TEXT | NOT NULL | ID of the match from matchmaker system |
| `creator_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | User ID of the player who created the match |
| `opponent_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | User ID of the player who accepted the match |
| `winner_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | User ID of the match winner |
| `loser_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | User ID of the match loser |
| `match_type` | TEXT | NOT NULL, CHECK (match_type IN ('ranked', 'casual')) | Type of match (ranked or casual) |
| `is_punch_up` | BOOLEAN | NOT NULL, DEFAULT false | Whether this was a punch-up match (high risk/reward) |
| `creator_rank` | INTEGER | NOT NULL | Creator's rank at match start |
| `opponent_rank` | INTEGER | NOT NULL | Opponent's rank at match start |
| `creator_old_elo` | INTEGER | NULLABLE | Creator's Elo rating before the match |
| `creator_new_elo` | INTEGER | NULLABLE | Creator's Elo rating after the match |
| `opponent_old_elo` | INTEGER | NULLABLE | Opponent's Elo rating before the match |
| `opponent_new_elo` | INTEGER | NULLABLE | Opponent's Elo rating after the match |
| `total_turns` | INTEGER | NOT NULL, DEFAULT 0 | Total number of turns played |
| `duration_seconds` | INTEGER | NOT NULL, DEFAULT 0 | Duration of the match in seconds |
| `end_reason` | TEXT | NOT NULL, CHECK (end_reason IN ('health_zero', 'forfeit', 'timeout', 'disconnect')) | Reason match ended |
| `combat_log` | JSONB | NOT NULL, DEFAULT '[]' | Full combat log as JSONB array |
| `creator_health_remaining` | INTEGER | NOT NULL, DEFAULT 0 | Creator's health at match end |
| `opponent_health_remaining` | INTEGER | NOT NULL, DEFAULT 0 | Opponent's health at match end |
| `creator_stats_at_match` | JSONB | NOT NULL, DEFAULT '{}' | Creator's stats at match start as JSONB |
| `opponent_stats_at_match` | JSONB | NOT NULL, DEFAULT '{}' | Opponent's stats at match start as JSONB |
| `season_id` | TEXT | NULLABLE | Season ID for seasonal ranking |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Timestamp when match result was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Timestamp when match result was last updated |

**Indexes:**
- `idx_match_results_match_id` ON `match_results(match_id)`
- `idx_match_results_creator_id` ON `match_results(creator_id)`
- `idx_match_results_opponent_id` ON `match_results(opponent_id)`
- `idx_match_results_winner_id` ON `match_results(winner_id)`
- `idx_match_results_match_type` ON `match_results(match_type)`
- `idx_match_results_created_at` ON `match_results(created_at DESC)`
- `idx_match_results_season_id` ON `match_results(season_id)`
- `idx_match_results_user_history` ON `match_results(GREATEST(creator_id, opponent_id), created_at DESC)`

**Triggers:**
- `match_results_updated_at_trigger` - Updates `updated_at` on row modification

**Comments:**
- Table: 'Stores completed PvP match results for historical data and analytics'
- Column `end_reason`: 'Reason match ended (health_zero, forfeit, timeout, disconnect)'
- Column `combat_log`: 'Full combat log as JSONB array'
- Column `season_id`: 'Season ID for seasonal ranking'

**Usage Example:**
```sql
-- Get a user's match history
SELECT
  mr.*,
  u1.username as creator_name,
  u2.username as opponent_name
FROM match_results mr
JOIN users u1 ON mr.creator_id = u1.id
JOIN users u2 ON mr.opponent_id = u2.id
WHERE mr.creator_id = $1 OR mr.opponent_id = $1
ORDER BY mr.created_at DESC
LIMIT 20;

-- Get match statistics for analytics
SELECT
  match_type,
  AVG(total_turns) as avg_turns,
  AVG(duration_seconds) as avg_duration,
  COUNT(*) as total_matches
FROM match_results
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY match_type;

-- Get win rate for a player
SELECT
  COUNT(*) as total_matches,
  SUM(CASE WHEN winner_id = $1 THEN 1 ELSE 0 END) as wins,
  ROUND(SUM(CASE WHEN winner_id = $1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as win_rate
FROM match_results
WHERE creator_id = $1 OR opponent_id = $1;
```

---

### 6. Composite Performance Indexes (migration 016)

Added in `016_add_composite_performance_indexes.sql` (issue #1146) for the `gear_db.ts` queries introduced by #1069, which filter by `user_id` and sort by a timestamp. The pre-existing single-column `user_id` indexes forced a sort after the scan; these composite indexes satisfy filter + ordering from a single index scan.

**Indexes:**
- `idx_inventory_items_user_id_created_at` ON `inventory_items(user_id, created_at DESC)` — serves `getPlayerGearFromDB` (`WHERE user_id = $1 ORDER BY created_at DESC`)
- `idx_boss_defeats_user_id_first_defeated_at` ON `boss_defeats(user_id, first_defeated_at ASC)` — serves `getDefeatedBossesFromDB` (`WHERE user_id = $1 ORDER BY first_defeated_at ASC`)
- `idx_unlocked_modifier_pools_user_id_unlocked_at` ON `unlocked_modifier_pools(user_id, unlocked_at ASC)` — serves `getUnlockedModifierPoolsFromDB` (`WHERE user_id = $1 ORDER BY unlocked_at ASC`)

---

## Migration Files

| File | Description |
|------|-------------|
| `001_create_player_stats.sql` | Creates player_stats table with level, experience, and stats |
| `002_create_catalog.sql` | Creates catalog table with gear types and rarities |
| `003_create_inventory.sql` | Creates inventory table for player gear ownership |
| `004_create_loadout.sql` | Creates loadout table with 5 equipment slots |
| `014_create_match_results.sql` | Creates match_results table for PvP match history |
| `016_add_composite_performance_indexes.sql` | Adds composite (user_id, timestamp) indexes on inventory_items, boss_defeats, unlocked_modifier_pools |

## Running Migrations

### Using Docker Compose

```bash
# Start the backend services
cd backend && ./start.sh

# Run migrations
docker exec -it armored_archer_server /nakama/nakama migrate up

# View current schema
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\dt'
```

### Using Make

```bash
make backend-up          # Start backend
make backend-migrate    # Run migrations
make backend-logs       # View logs
make backend-down       # Stop backend
```

## Schema Testing

Run the schema migration tests to verify the database is properly configured:

```bash
cd backend
npm install
npm run test:schema
```

Tests verify:
- All required tables exist
- Column structures match expectations
- Primary keys and foreign keys are correct
- CHECK constraints are enforced
- Indexes are created
- Triggers function correctly
- Data integrity is maintained

## Best Practices

1. **Always use migrations** - Never modify the schema directly; use SQL migration files
2. **Add comments** - Document tables and columns for future developers
3. **Use JSONB wisely** - Use for flexible data but index frequently queried paths
4. **Consider performance** - Add indexes for commonly filtered/sorted columns
5. **Handle NULLs** - Be explicit about NULL vs NOT NULL for each column

## Future Schema Changes

When adding new tables or modifying existing ones:

1. Create a new migration file in `backend/data/` with an incrementing number
2. Include UP and DOWN logic or use `IF NOT EXISTS` / `DROP TABLE IF EXISTS`
3. Update this documentation
4. Add schema tests to verify the changes
5. Test migrations on a staging environment before production

## Schema Change Tracking

### Version History

The database schema is versioned using migration files. Each migration has an incrementing prefix that indicates its order in the sequence.

| Version | Migration File | Description | Date |
|---------|---------------|-------------|------|
| 1 | `001_create_player_stats.sql` | Creates player_stats table | 2024-02-28 |
| 2 | `002_create_catalog.sql` | Creates catalog table with enums | 2024-02-28 |
| 3 | `003_create_inventory.sql` | Creates inventory table | 2024-02-28 |
| 4 | `004_create_loadout.sql` | Creates loadout table | 2024-02-28 |
| 14 | `014_create_match_results.sql` | Creates match_results table for PvP match history | 2026-04-15 |
| 16 | `016_add_composite_performance_indexes.sql` | Adds composite (user_id, timestamp) performance indexes | 2026-09-15 |

### CI/CD Schema Validation

Schema validation runs automatically in CI/CD via the `schema-validation` job in `.github/workflows/ci.yml`:

1. **PostgreSQL Setup**: Starts a PostgreSQL 15 instance
2. **Nakama Installation**: Downloads and configures Nakama server
3. **Migration Execution**: Runs all migration files in order
4. **Schema Tests**: Validates the schema using `npm run test:schema`

The schema tests verify:
- All required tables exist with correct columns
- Primary keys and foreign keys are properly defined
- CHECK constraints are enforced
- Indexes are created on appropriate columns
- Triggers function correctly
- Table and column comments are present

### Making Schema Changes

When making schema changes:

1. **Create a new migration**: Add a new file with the next sequential number
2. **Update documentation**: Add the change to the Version History table
3. **Update tests**: Ensure schema tests cover the new/changed structure
4. **Run validation**: Ensure `npm run test:schema` passes locally
5. **CI validation**: The PR must pass the `schema-validation` job
