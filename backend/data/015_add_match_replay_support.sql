-- Migration 015: Add match replay support for debugging
-- Enhances match_results table with replay-specific fields and creates indexes

-- Add replay-related columns to match_results table
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS replay_data JSONB DEFAULT '{}';
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS replay_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS debug_notes TEXT;
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS qa_flagged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS qa_flagged_reason TEXT;
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS replay_access_count INTEGER NOT NULL DEFAULT 0;

-- Create indexes for replay queries
CREATE INDEX IF NOT EXISTS idx_match_results_replay_enabled ON match_results(replay_enabled) WHERE replay_enabled = true;
CREATE INDEX IF NOT EXISTS idx_match_results_qa_flagged ON match_results(qa_flagged) WHERE qa_flagged = true;
CREATE INDEX IF NOT EXISTS idx_match_results_replay_access ON match_results(match_id, replay_access_count DESC);

-- Add column comments
COMMENT ON COLUMN match_results.replay_data IS 'Additional replay data including turn-by-turn state snapshots';
COMMENT ON COLUMN match_results.replay_enabled IS 'Whether this match can be replayed for debugging';
COMMENT ON COLUMN match_results.debug_notes IS 'Manual debug notes added by developers/QA';
COMMENT ON COLUMN match_results.qa_flagged IS 'Whether this match has been flagged for QA investigation';
COMMENT ON COLUMN match_results.qa_flagged_reason IS 'Reason why this match was flagged by QA';
COMMENT ON COLUMN match_results.replay_access_count IS 'Number of times this replay has been accessed for debugging';

-- Create a function to mark a match for QA investigation
CREATE OR REPLACE FUNCTION flag_match_for_qa(
  p_match_id TEXT,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE match_results
  SET qa_flagged = true,
      qa_flagged_reason = p_reason,
      updated_at = NOW()
  WHERE match_id = p_match_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create a function to increment replay access count
CREATE OR REPLACE FUNCTION increment_replay_access(p_match_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE match_results
  SET replay_access_count = replay_access_count + 1,
      updated_at = NOW()
  WHERE match_id = p_match_id;
END;
$$ LANGUAGE plpgsql;

-- Add table comment
COMMENT ON TABLE match_results IS 'Stores completed PvP match results for historical data, analytics, and replay debugging';
