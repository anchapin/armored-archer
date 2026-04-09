-- Migration: Difficulty Metrics Tracking
-- Description: Adds tables for tracking player difficulty state and match history
-- Version: 005

-- Create difficulty_state table for storing per-player difficulty settings
CREATE TABLE IF NOT EXISTS difficulty_state (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_modifier NUMERIC(3,2) NOT NULL DEFAULT 0.00 CHECK (current_modifier >= -0.20 AND current_modifier <= 0.20),
    win_streak INTEGER NOT NULL DEFAULT 0 CHECK (win_streak >= 0),
    lose_streak INTEGER NOT NULL DEFAULT 0 CHECK (lose_streak >= 0),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create match_history table for tracking match outcomes for difficulty adjustment
CREATE TABLE IF NOT EXISTS match_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id VARCHAR(255) NOT NULL,
    won BOOLEAN NOT NULL,
    match_type VARCHAR(10) NOT NULL CHECK (match_type IN ('pve', 'pvp')),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    base_difficulty NUMERIC(3,2) NOT NULL,
    UNIQUE(user_id, match_id)
);

-- Create indexes for performance queries
CREATE INDEX IF NOT EXISTS idx_difficulty_state_updated_at ON difficulty_state(updated_at);
CREATE INDEX IF NOT EXISTS idx_difficulty_state_modifier ON difficulty_state(current_modifier);
CREATE INDEX IF NOT EXISTS idx_match_history_user_id ON match_history(user_id);
CREATE INDEX IF NOT EXISTS idx_match_history_timestamp ON match_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_match_history_won ON match_history(won);

-- Add table comments
COMMENT ON TABLE difficulty_state IS 'Stores dynamic difficulty state per player including modifier and streaks';
COMMENT ON TABLE match_history IS 'Tracks match outcomes for difficulty adjustment and performance analytics';

-- Add column comments
COMMENT ON COLUMN difficulty_state.current_modifier IS 'Current difficulty modifier ranging from -0.20 (Easy) to 0.20 (Extreme)';
COMMENT ON COLUMN difficulty_state.win_streak IS 'Number of consecutive wins';
COMMENT ON COLUMN difficulty_state.lose_streak IS 'Number of consecutive losses';
COMMENT ON COLUMN match_history.match_type IS 'Type of match: pve (player vs environment) or pvp (player vs player)';
COMMENT ON COLUMN match_history.base_difficulty IS 'Difficulty modifier at time of match';
