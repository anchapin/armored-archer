-- Migration: 007_create_boss_defeat_tracking.sql
-- Description: Create tables for tracking boss defeats and unlocked modifier pools per player
-- Issue: CG-006 - Implement boss modifier unlock system
-- Created: 2024-01-20

-- Table: boss_defeats
-- Tracks the number of times each player has defeated each boss
CREATE TABLE IF NOT EXISTS boss_defeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    boss_id TEXT NOT NULL,
    defeat_count INTEGER NOT NULL DEFAULT 1 CHECK (defeat_count >= 1),
    first_defeated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_defeated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, boss_id)
);

-- Table: unlocked_modifier_pools
-- Tracks which modifier pools have been unlocked by each player
CREATE TABLE IF NOT EXISTS unlocked_modifier_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    modifier_id TEXT NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    unlock_reason TEXT NOT NULL DEFAULT 'boss_defeat', -- 'boss_defeat', 'enemy_defeat', 'purchase', 'event'
    source_boss_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, modifier_id)
);

-- Index for efficient queries on user's boss defeats
CREATE INDEX IF NOT EXISTS idx_boss_defeats_user_id ON boss_defeats(user_id);

-- Index for filtering by specific boss
CREATE INDEX IF NOT EXISTS idx_boss_defeats_boss_id ON boss_defeats(boss_id);

-- Index for efficient queries on user's unlocked modifiers
CREATE INDEX IF NOT EXISTS idx_unlocked_modifier_pools_user_id ON unlocked_modifier_pools(user_id);

-- Index for filtering by modifier ID
CREATE INDEX IF NOT EXISTS idx_unlocked_modifier_pools_modifier_id ON unlocked_modifier_pools(modifier_id);

-- Comments for documentation
COMMENT ON TABLE boss_defeats IS 'Tracks the number of times each player has defeated each boss';
COMMENT ON TABLE unlocked_modifier_pools IS 'Tracks which modifier pools have been unlocked by each player';
COMMENT ON COLUMN boss_defeats.defeat_count IS 'Number of times the player has defeated this boss';
COMMENT ON COLUMN unlocked_modifier_pools.unlock_reason IS 'Reason for unlocking (boss_defeat, enemy_defeat, purchase, event)';
COMMENT ON COLUMN unlocked_modifier_pools.source_boss_id IS 'The boss that unlocked this modifier pool (if applicable)';
