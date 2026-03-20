-- Migration: 10_add_performance_indexes_concurrent
-- Description: Adds performance indexes using CONCURRENTLY for production deployments
-- Date: 2026-03-20
-- Phase: 05 - Performance Optimization (Plan 05-04)
--
-- IMPORTANT: Use this file for production deployments to avoid table locks.
-- Run with: psql -U postgres -d nakama -f 10_add_performance_indexes_concurrent.sql
--
-- Note: CREATE INDEX CONCURRENTLY cannot be run in a transaction block.
-- Each index is created separately.

-- Performance indexes for Phase 5 optimization
-- Target: P95 query latency < 50ms
--
-- This file uses CREATE INDEX CONCURRENTLY to avoid locking tables during index creation.
-- This is critical for production deployments where you cannot afford downtime.

-- Player stats queries (GetPlayerStats, AllocateStats, GainXP)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_stats_user_id
ON player_stats(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_stats_user_level
ON player_stats(user_id, level);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_stats_experience
ON player_stats(experience DESC);

-- Inventory queries (GetInventory, EquipGear)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_user_id
ON inventory(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_user_gear
ON inventory(user_id, gear_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_acquired_at
ON inventory(acquired_at DESC);

-- Gear queries (GenerateGear, GetInventory with gear type)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catalog_gear_type_rarity
ON catalog(gear_type, rarity);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catalog_rarity
ON catalog(rarity);

-- Loadout queries (GetLoadout, EquipGear)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loadout_user_id
ON loadout(user_id);

-- Feedback queries (GetFeedbackStatistics, GetFeedbackSubmissions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_submissions_category_status
ON feedback_submissions(category, status, submitted_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_submissions_user_id
ON feedback_submissions(user_id, submitted_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_submissions_priority_status
ON feedback_submissions(priority, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_submissions_assigned_to
ON feedback_submissions(assigned_to) WHERE assigned_to IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_submissions_open
ON feedback_submissions(status, submitted_at DESC)
WHERE status NOT IN ('resolved', 'closed', 'rejected');

-- Feedback votes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_votes_feedback_id
ON feedback_votes(feedback_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_votes_user_id
ON feedback_votes(user_id, created_at DESC);

-- Beta users queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_beta_users_user_id
ON beta_users(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_beta_users_status
ON beta_users(status) WHERE status = 'active';

-- Beta invitations queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_beta_invitations_code
ON beta_invitations(code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_beta_invitations_status
ON beta_invitations(status, created_at DESC)
WHERE status = 'active';

-- Notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read
ON notifications(user_id, is_read, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread
ON notifications(user_id, created_at DESC)
WHERE is_read = false;
