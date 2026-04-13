-- Weapon Balance Tables
-- Stores weapon balance adjustments and usage statistics for PvP balance tuning
-- Supports hotfixes without code deployment

CREATE TABLE IF NOT EXISTS weapon_balance_adjustments (
  adjustment_id TEXT PRIMARY KEY,
  weapon_id TEXT NOT NULL REFERENCES catalog(gear_id) ON DELETE CASCADE,
  multiplier NUMERIC(5, 2) NOT NULL CHECK (multiplier > 0 AND multiplier <= 10.0),
  reason TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reverted_at TIMESTAMP WITH TIME ZONE,
  reverted_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Index for querying adjustments by weapon
CREATE INDEX IF NOT EXISTS idx_weapon_balance_adjustments_weapon_id ON weapon_balance_adjustments(weapon_id);
CREATE INDEX IF NOT EXISTS idx_weapon_balance_adjustments_created_at ON weapon_balance_adjustments(created_at DESC);

-- Index for querying active adjustments (not reverted)
CREATE INDEX IF NOT EXISTS idx_weapon_balance_adjustments_active ON weapon_balance_adjustments(weapon_id)
  WHERE reverted_at IS NULL;

-- Comments for weapon_balance_adjustments table
COMMENT ON TABLE weapon_balance_adjustments IS 'Stores balance adjustment history for PvP weapons';
COMMENT ON COLUMN weapon_balance_adjustments.adjustment_id IS 'Unique identifier for the adjustment';
COMMENT ON COLUMN weapon_balance_adjustments.weapon_id IS 'Weapon being adjusted (references catalog.gear_id)';
COMMENT ON COLUMN weapon_balance_adjustments.multiplier IS 'Damage multiplier (1.0 = default, 0.5 = -50%, 1.5 = +50%)';
COMMENT ON COLUMN weapon_balance_adjustments.reason IS 'Admin-provided reason for the adjustment';
COMMENT ON COLUMN weapon_balance_adjustments.created_by IS 'Admin user who applied the adjustment';
COMMENT ON COLUMN weapon_balance_adjustments.reverted_at IS 'Timestamp when adjustment was reverted (NULL if active)';
COMMENT ON COLUMN weapon_balance_adjustments.reverted_by IS 'Admin user who reverted the adjustment';

-- Weapon usage statistics for balance tuning
CREATE TABLE IF NOT EXISTS weapon_usage_stats (
  weapon_id TEXT NOT NULL REFERENCES catalog(gear_id) ON DELETE CASCADE,
  matches_played INTEGER NOT NULL DEFAULT 0 CHECK (matches_played >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  total_rating_diff BIGINT NOT NULL DEFAULT 0,
  average_rating_diff NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (weapon_id)
);

-- Index for querying stats by win rate
CREATE INDEX IF NOT EXISTS idx_weapon_usage_stats_win_rate ON weapon_usage_stats(
  matches_played,
  (wins::float / NULLIF(matches_played, 0))
);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_weapon_usage_stats_updated_at
  BEFORE UPDATE ON weapon_usage_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for weapon_usage_stats table
COMMENT ON TABLE weapon_usage_stats IS 'Aggregates weapon usage statistics for balance tuning';
COMMENT ON COLUMN weapon_usage_stats.weapon_id IS 'Weapon being tracked';
COMMENT ON COLUMN weapon_usage_stats.matches_played IS 'Total number of matches played with this weapon';
COMMENT ON COLUMN weapon_usage_stats.wins IS 'Total wins with this weapon';
COMMENT ON COLUMN weapon_usage_stats.losses IS 'Total losses with this weapon';
COMMENT ON COLUMN weapon_usage_stats.total_rating_diff IS 'Cumulative rating difference (for calculating average)';
COMMENT ON COLUMN weapon_usage_stats.average_rating_diff IS 'Average rating difference across all matches';

-- Function to increment weapon usage stats
CREATE OR REPLACE FUNCTION increment_weapon_usage(
  p_weapon_id TEXT,
  p_match_result TEXT,
  p_rating_diff BIGINT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO weapon_usage_stats (weapon_id, matches_played, wins, losses, total_rating_diff)
  VALUES (
    p_weapon_id,
    1,
    CASE WHEN p_match_result = 'win' THEN 1 ELSE 0 END,
    CASE WHEN p_match_result = 'loss' THEN 1 ELSE 0 END,
    p_rating_diff
  )
  ON CONFLICT (weapon_id) DO UPDATE SET
    matches_played = weapon_usage_stats.matches_played + 1,
    wins = weapon_usage_stats.wins + CASE WHEN p_match_result = 'win' THEN 1 ELSE 0 END,
    losses = weapon_usage_stats.losses + CASE WHEN p_match_result = 'loss' THEN 1 ELSE 0 END,
    total_rating_diff = weapon_usage_stats.total_rating_diff + p_rating_diff,
    average_rating_diff = (weapon_usage_stats.total_rating_diff + p_rating_diff)::NUMERIC / (weapon_usage_stats.matches_played + 1),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_weapon_usage IS 'Increments weapon usage statistics after a match';

-- Function to get current balance multiplier for a weapon
CREATE OR REPLACE FUNCTION get_weapon_balance_multiplier(p_weapon_id TEXT) RETURNS NUMERIC(5, 2) AS $$
DECLARE
  v_multiplier NUMERIC(5, 2);
BEGIN
  -- Get the most recent non-reverted adjustment
  SELECT multiplier INTO v_multiplier
  FROM weapon_balance_adjustments
  WHERE weapon_id = p_weapon_id AND reverted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- Return 1.0 (no adjustment) if none found
  RETURN COALESCE(v_multiplier, 1.0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_weapon_balance_multiplier IS 'Returns the current balance multiplier for a weapon (1.0 if no adjustment)';
