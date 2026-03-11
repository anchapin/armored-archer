-- Player Stats Table
-- Stores player levels, ability points, and allocated stats
-- Supports RPG progression with stat allocation system

CREATE TABLE IF NOT EXISTS player_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  experience BIGINT NOT NULL DEFAULT 0 CHECK (experience >= 0),
  ability_points INTEGER NOT NULL DEFAULT 0 CHECK (ability_points >= 0),
  
  -- JSONB for flexible stat allocation
  -- Stores allocated ability points: {"attack_power": 10, "defense": 5, "dodge_chance": 3, "crit_rate": 2}
  stats JSONB NOT NULL DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_stats_level ON player_stats(level);
CREATE INDEX IF NOT EXISTS idx_player_stats_experience ON player_stats(experience);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_player_stats_updated_at
  BEFORE UPDATE ON player_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE player_stats IS 'Stores player progression data including level, experience, and allocated stats';
COMMENT ON COLUMN player_stats.stats IS 'JSONB object storing allocated ability points across different stats';
