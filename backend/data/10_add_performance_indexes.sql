-- Migration: 10_add_performance_indexes
-- Description: Adds performance indexes for frequently queried columns to achieve P95 < 50ms query latency
-- Date: 2026-03-20
-- Phase: 05 - Performance Optimization (Plan 05-04)

BEGIN;

-- Performance indexes for Phase 5 optimization
-- Target: P95 query latency < 50ms
--
-- Index selection based on:
-- 1. Hot-path RPC query patterns (GetPlayerStats, GetInventory, GetFeedbackStatistics, etc.)
-- 2. WHERE clause columns from EXPLAIN ANALYZE
-- 3. JOIN columns frequently used
-- 4. ORDER BY columns for leaderboards and sorting
--
-- Composite indexes for multi-column queries
-- Partial indexes for status-based filtering
-- B-tree indexes (default) for equality and range queries

-- Player stats queries (GetPlayerStats, AllocateStats, GainXP)
-- Index on user_id for primary key lookups (may already exist as PK, but ensuring coverage)
CREATE INDEX IF NOT EXISTS idx_player_stats_user_id
ON player_stats(user_id);

-- Composite index for player progression queries (level + experience queries)
CREATE INDEX IF NOT EXISTS idx_player_stats_user_level
ON player_stats(user_id, level);

-- Index for experience-based queries (leaderboards by XP)
CREATE INDEX IF NOT EXISTS idx_player_stats_experience
ON player_stats(experience DESC);

-- Inventory queries (GetInventory, EquipGear)
-- Index on user_id for inventory lookups
CREATE INDEX IF NOT EXISTS idx_inventory_user_id
ON inventory(user_id);

-- Composite index for user's gear by type (JOIN with catalog)
CREATE INDEX IF NOT EXISTS idx_inventory_user_gear
ON inventory(user_id, gear_id);

-- Index for acquisition time queries (recent gear)
CREATE INDEX IF NOT EXISTS idx_inventory_acquired_at
ON inventory(acquired_at DESC);

-- Gear queries (GenerateGear, GetInventory with gear type)
-- Composite index on gear_type and rarity for filtered gear queries
CREATE INDEX IF NOT EXISTS idx_catalog_gear_type_rarity
ON catalog(gear_type, rarity);

-- Index for rarity-based queries (legendary gear, etc.)
CREATE INDEX IF NOT EXISTS idx_catalog_rarity
ON catalog(rarity);

-- Loadout queries (GetLoadout, EquipGear)
-- Index on user_id for loadout lookups (unique constraint already provides index)
CREATE INDEX IF NOT EXISTS idx_loadout_user_id
ON loadout(user_id);

-- Feedback queries (GetFeedbackStatistics, GetFeedbackSubmissions)
-- Composite index on category, status, and submitted_at for dashboard queries
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_category_status
ON feedback_submissions(category, status, submitted_at DESC);

-- Index for user's feedback history
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_user_id
ON feedback_submissions(user_id, submitted_at DESC);

-- Index for priority-based triage
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_priority_status
ON feedback_submissions(priority, status);

-- Index for assigned feedback (developer dashboard)
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_assigned_to
ON feedback_submissions(assigned_to) WHERE assigned_to IS NOT NULL;

-- Partial index for open feedback (status != resolved/closed/rejected)
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_open
ON feedback_submissions(status, submitted_at DESC)
WHERE status NOT IN ('resolved', 'closed', 'rejected');

-- Feedback votes (if table exists)
CREATE INDEX IF NOT EXISTS idx_feedback_votes_feedback_id
ON feedback_votes(feedback_id);

-- Index for user's voted feedback
CREATE INDEX IF NOT EXISTS idx_feedback_votes_user_id
ON feedback_votes(user_id, created_at DESC);

-- Beta users queries
CREATE INDEX IF NOT EXISTS idx_beta_users_user_id
ON beta_users(user_id);

-- Index for active beta users
CREATE INDEX IF NOT EXISTS idx_beta_users_status
ON beta_users(status) WHERE status = 'active';

-- Beta invitations queries
CREATE INDEX IF NOT EXISTS idx_beta_invitations_code
ON beta_invitations(code);

-- Index for active invitations
CREATE INDEX IF NOT EXISTS idx_beta_invitations_status
ON beta_invitations(status, created_at DESC)
WHERE status = 'active';

-- Notifications (if table exists from migration 006)
-- Index for user's unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
ON notifications(user_id, is_read, created_at DESC);

-- Partial index for unread notifications only
CREATE INDEX IF NOT EXISTS idx_notifications_unread
ON notifications(user_id, created_at DESC)
WHERE is_read = false;

COMMIT;

-- Comments for documentation
COMMENT ON INDEX idx_player_stats_user_id IS 'Performance index for player stats lookups by user_id';
COMMENT ON INDEX idx_player_stats_user_level IS 'Composite index for user progression queries';
COMMENT ON INDEX idx_inventory_user_id IS 'Performance index for inventory lookups by user_id';
COMMENT ON INDEX idx_feedback_submissions_category_status IS 'Composite index for feedback dashboard queries (category + status + time)';
COMMENT ON INDEX idx_feedback_submissions_open IS 'Partial index for open feedback items only (excluding resolved/closed/rejected)';
