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
└─────────────────┘     └─────────────────┘     │ modifiers (JSONB│
                                                  │ icon_url        │
                                                  │ description     │
                                                  └────────┬────────┘
                                                           │
                          ┌─────────────────┐              │
                          │    loadout      │◀─────────────┘
                          │                 │
                          │ user_id (PK/FK) │
            ┌─────────────│ helm_gear_id   │
            │             │ armor_gear_id  │
            │             │ bow_gear_id    │
            │             │ arrow_gear_id  │
            │             │ amulet_gear_id │
            └─────────────┴─────────────────┘
                          │
                          ▼
                  ┌─────────────────┐
                  │    inventory    │
                  │                 │
                  │ inventory_id(PK)│
                  │ user_id (FK)    │────▶ users
                  │ gear_id (FK)    │────▶ catalog
                  │ acquired_at     │
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

## Migration Files

| File | Description |
|------|-------------|
| `001_create_player_stats.sql` | Creates player_stats table with level, experience, and stats |
| `002_create_catalog.sql` | Creates catalog table with gear types and rarities |
| `003_create_inventory.sql` | Creates inventory table for player gear ownership |
| `004_create_loadout.sql` | Creates loadout table with 5 equipment slots |

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
