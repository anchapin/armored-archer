-- Migration 016: composite indexes (user_id, created_at DESC) on the
-- three gear tables moved from player_inventory Nakama storage to
-- PostgreSQL by issue #1069 (#1146).
--
-- The existing single-column user_id indexes (012_create_inventory_items,
-- 007_create_boss_defeat_tracking, 015_add_match_replay_support) are
-- retained for FK checks; the new composite indexes additionally cover the
-- latest-first queries added by gear_db.ts (the per-stage settlement and
-- getPlayerInventoryFromDB paths order by created_at DESC).
--
-- Concurrent CREATE INDEX avoids blocking writes for the duration of the
-- build. CREATE INDEX IF NOT EXISTS keeps the migration idempotent on
-- re-apply (Nakama re-runs the migration set on container start per the
-- Docker stack design). CONCURRENTLY is not allowed inside a transaction
-- block; this file therefore MUST be applied by `nakama migrate up` which
-- runs each .sql in its own implicit single-statement transaction.
--
-- Rollback (manual, in case of measured regression on a hot index):
--   DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_items_user_created;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_boss_defeats_user_created;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_unlocked_modifier_pools_user_created;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_inventory_items_user_created
  ON inventory_items (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_boss_defeats_user_created
  ON boss_defeats (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_unlocked_modifier_pools_user_created
  ON unlocked_modifier_pools (user_id, created_at DESC);
