-- Migration 014: Create match_results table
-- Stores completed PvP match results for historical data and analytics

CREATE TABLE IF NOT EXISTS match_results (
  result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('ranked', 'casual')),
  is_punch_up BOOLEAN NOT NULL DEFAULT false,
  creator_rank INTEGER NOT NULL,
  opponent_rank INTEGER NOT NULL,
  creator_old_elo INTEGER,
  creator_new_elo INTEGER,
  opponent_old_elo INTEGER,
  opponent_new_elo INTEGER,
  total_turns INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  end_reason TEXT NOT NULL CHECK (end_reason IN ('health_zero', 'forfeit', 'timeout', 'disconnect')),
  combat_log JSONB NOT NULL DEFAULT '[]',
  creator_health_remaining INTEGER NOT NULL DEFAULT 0,
  opponent_health_remaining INTEGER NOT NULL DEFAULT 0,
  creator_stats_at_match JSONB NOT NULL DEFAULT '{}',
  opponent_stats_at_match JSONB NOT NULL DEFAULT '{}',
  season_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON match_results(match_id);
CREATE INDEX IF NOT EXISTS idx_match_results_creator_id ON match_results(creator_id);
CREATE INDEX IF NOT EXISTS idx_match_results_opponent_id ON match_results(opponent_id);
CREATE INDEX IF NOT EXISTS idx_match_results_winner_id ON match_results(winner_id);
CREATE INDEX IF NOT EXISTS idx_match_results_match_type ON match_results(match_type);
CREATE INDEX IF NOT EXISTS idx_match_results_created_at ON match_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_results_season_id ON match_results(season_id);

-- Create composite index for user match history queries
CREATE INDEX IF NOT EXISTS idx_match_results_user_history ON match_results(
  GREATEST(creator_id, opponent_id),
  created_at DESC
);

-- Add table comment
COMMENT ON TABLE match_results IS 'Stores completed PvP match results for historical data and analytics';

-- Add column comments
COMMENT ON COLUMN match_results.result_id IS 'Unique identifier for this match result';
COMMENT ON COLUMN match_results.match_id IS 'ID of the match from matchmaker system';
COMMENT ON COLUMN match_results.creator_id IS 'User ID of the player who created the match';
COMMENT ON COLUMN match_results.opponent_id IS 'User ID of the player who accepted the match';
COMMENT ON COLUMN match_results.winner_id IS 'User ID of the match winner';
COMMENT ON COLUMN match_results.loser_id IS 'User ID of the match loser';
COMMENT ON COLUMN match_results.match_type IS 'Type of match (ranked or casual)';
COMMENT ON COLUMN match_results.is_punch_up IS 'Whether this was a punch-up match (high risk/reward)';
COMMENT ON COLUMN match_results.creator_rank IS 'Creator''s rank at match start';
COMMENT ON COLUMN match_results.opponent_rank IS 'Opponent''s rank at match start';
COMMENT ON COLUMN match_results.creator_old_elo IS 'Creator''s Elo rating before the match';
COMMENT ON COLUMN match_results.creator_new_elo IS 'Creator''s Elo rating after the match';
COMMENT ON COLUMN match_results.opponent_old_elo IS 'Opponent''s Elo rating before the match';
COMMENT ON COLUMN match_results.opponent_new_elo IS 'Opponent''s Elo rating after the match';
COMMENT ON COLUMN match_results.total_turns IS 'Total number of turns played';
COMMENT ON COLUMN match_results.duration_seconds IS 'Duration of the match in seconds';
COMMENT ON COLUMN match_results.end_reason IS 'Reason match ended (health_zero, forfeit, timeout, disconnect)';
COMMENT ON COLUMN match_results.combat_log IS 'Full combat log as JSONB array';
COMMENT ON COLUMN match_results.creator_health_remaining IS 'Creator''s health at match end';
COMMENT ON COLUMN match_results.opponent_health_remaining IS 'Opponent''s health at match end';
COMMENT ON COLUMN match_results.creator_stats_at_match IS 'Creator''s stats at match start as JSONB';
COMMENT ON COLUMN match_results.opponent_stats_at_match IS 'Opponent''s stats at match start as JSONB';
COMMENT ON COLUMN match_results.season_id IS 'Season ID for seasonal ranking';
COMMENT ON COLUMN match_results.created_at IS 'Timestamp when match result was created';
COMMENT ON COLUMN match_results.updated_at IS 'Timestamp when match result was last updated';

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_match_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER match_results_updated_at_trigger
BEFORE UPDATE ON match_results
FOR EACH ROW
EXECUTE FUNCTION update_match_results_updated_at();
