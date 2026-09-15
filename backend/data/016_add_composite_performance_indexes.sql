-- Migration: 016_add_composite_performance_indexes.sql
-- Description: Add composite (user_id, timestamp) indexes for gear_db queries post-#1069
-- Issue: #1146 - Performance: composite indexes on inventory_items / boss_defeats / unlocked_modifier_pools
-- Created: 2026-09-15
--
-- gear_db.ts reads filter by user_id and sort by a timestamp column:
--   getPlayerGearFromDB:            WHERE user_id = $1 ORDER BY created_at DESC
--   getDefeatedBossesFromDB:        WHERE user_id = $1 ORDER BY first_defeated_at ASC
--   getUnlockedModifierPoolsFromDB: WHERE user_id = $1 ORDER BY unlocked_at ASC
-- The existing single-column indexes on user_id force Postgres to sort each
-- player's rows after the scan. These composite indexes satisfy the filter and
-- the ordering from a single index scan.

-- Newest gear first (getPlayerGearFromDB)
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id_created_at
  ON inventory_items(user_id, created_at DESC);

-- Earliest boss defeat first (getDefeatedBossesFromDB)
CREATE INDEX IF NOT EXISTS idx_boss_defeats_user_id_first_defeated_at
  ON boss_defeats(user_id, first_defeated_at ASC);

-- Earliest unlock first (getUnlockedModifierPoolsFromDB)
CREATE INDEX IF NOT EXISTS idx_unlocked_modifier_pools_user_id_unlocked_at
  ON unlocked_modifier_pools(user_id, unlocked_at ASC);
