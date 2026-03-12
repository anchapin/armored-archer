-- Migration: 005_create_stage_completion.sql
-- Description: Create stage_completion table for PvE stage progression tracking
-- Created: 2024-01-15

CREATE TABLE IF NOT EXISTS stage_completion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    stage_id TEXT NOT NULL,
    stage_prefix TEXT NOT NULL,
    stars_earned INTEGER NOT NULL CHECK (stars_earned >= 0 AND stars_earned <= 3),
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, stage_id)
);

-- Index for efficient queries on user's completed stages
CREATE INDEX IF NOT EXISTS idx_stage_completion_user_id ON stage_completion(user_id);

-- Index for filtering by stage_prefix (e.g., "campaign_", "dungeon_")
CREATE INDEX IF NOT EXISTS idx_stage_completion_prefix ON stage_completion(user_id, stage_prefix);
