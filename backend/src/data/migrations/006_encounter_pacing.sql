-- Migration: Encounter Pacing System
-- Description: Creates tables and indexes for tracking encounter pacing and fatigue metrics
-- Version: 006

-- Pacing state table for per-player pacing data
CREATE TABLE IF NOT EXISTS pacing_state (
    player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    recent_encounters JSONB NOT NULL DEFAULT '[]',
    combat_streak INTEGER NOT NULL DEFAULT 0,
    exploration_streak INTEGER NOT NULL DEFAULT 0,
    current_fatigue FLOAT NOT NULL DEFAULT 0.0,
    session_encounters INTEGER NOT NULL DEFAULT 0,
    combat_time_accumulated FLOAT NOT NULL DEFAULT 0.0,
    updated_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

-- Pacing history table for analytics
CREATE TABLE IF NOT EXISTS pacing_history (
    id BIGSERIAL PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    encounter_type VARCHAR(20) NOT NULL CHECK (encounter_type IN ('combat', 'exploration', 'narrative', 'puzzle')),
    duration FLOAT NOT NULL,
    intensity FLOAT NOT NULL,
    fatigue_level VARCHAR(20) NOT NULL,
    fatigue_before FLOAT NOT NULL,
    fatigue_after FLOAT NOT NULL,
    session_encounters INTEGER NOT NULL,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

-- Pacing recommendations table
CREATE TABLE IF NOT EXISTS pacing_recommendations (
    id BIGSERIAL PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    should_break BOOLEAN NOT NULL,
    break_duration INTEGER NOT NULL,
    suggested_next_type VARCHAR(20) NOT NULL CHECK (suggested_next_type IN ('combat', 'exploration', 'narrative', 'puzzle')),
    reason TEXT NOT NULL,
    pacing_score FLOAT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pacing_history_player_id ON pacing_history(player_id);
CREATE INDEX IF NOT EXISTS idx_pacing_history_created_at ON pacing_history(created_at);
CREATE INDEX IF NOT EXISTS idx_pacing_history_type ON pacing_history(encounter_type);
CREATE INDEX IF NOT EXISTS idx_pacing_recommendations_player_id ON pacing_recommendations(player_id);
CREATE INDEX IF NOT EXISTS idx_pacing_recommendations_created_at ON pacing_recommendations(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pacing_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = EXTRACT(EPOCH FROM NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pacing_state_timestamp ON pacing_state;
CREATE TRIGGER trigger_update_pacing_state_timestamp
    BEFORE UPDATE ON pacing_state
    FOR EACH ROW
    EXECUTE FUNCTION update_pacing_state_timestamp();

-- Comments for documentation
COMMENT ON TABLE pacing_state IS 'Stores per-player pacing state including fatigue and encounter streaks';
COMMENT ON TABLE pacing_history IS 'Stores historical pacing data for analytics and optimization';
COMMENT ON TABLE pacing_recommendations IS 'Stores pacing recommendations generated for players';
COMMENT ON COLUMN pacing_state.current_fatigue IS 'Current fatigue level from 0.0 to 100.0';
COMMENT ON COLUMN pacing_history.intensity IS 'Encounter intensity from 0.0 to 1.0';
COMMENT ON COLUMN pacing_recommendations.pacing_score IS 'Overall pacing score from 0 to 100';
