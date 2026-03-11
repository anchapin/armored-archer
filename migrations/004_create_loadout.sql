-- Loadout Table
-- Stores equipped gear for each player (5 slots)
-- Supports transmog system by linking to base gear

CREATE TABLE IF NOT EXISTS loadout (
  loadout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- 5 gear slots (can be NULL if slot is empty)
  helm_gear_id UUID REFERENCES catalog(gear_id) ON DELETE SET NULL,
  armor_gear_id UUID REFERENCES catalog(gear_id) ON DELETE SET NULL,
  bow_gear_id UUID REFERENCES catalog(gear_id) ON DELETE SET NULL,
  arrow_gear_id UUID REFERENCES catalog(gear_id) ON DELETE SET NULL,
  amulet_gear_id UUID REFERENCES catalog(gear_id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_loadout_user_id ON loadout(user_id);
CREATE INDEX IF NOT EXISTS idx_loadout_helm_gear ON loadout(helm_gear_id);
CREATE INDEX IF NOT EXISTS idx_loadout_armor_gear ON loadout(armor_gear_id);
CREATE INDEX IF NOT EXISTS idx_loadout_bow_gear ON loadout(bow_gear_id);
CREATE INDEX IF NOT EXISTS idx_loadout_arrow_gear ON loadout(arrow_gear_id);
CREATE INDEX IF NOT EXISTS idx_loadout_amulet_gear ON loadout(amulet_gear_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_loadout_updated_at
  BEFORE UPDATE ON loadout
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE loadout IS 'Stores currently equipped gear for each player (5 slots)';
COMMENT ON COLUMN loadout.helm_gear_id IS 'Equipped helmet (references catalog)';
COMMENT ON COLUMN loadout.armor_gear_id IS 'Equipped armor (references catalog)';
COMMENT ON COLUMN loadout.bow_gear_id IS 'Equipped bow (references catalog)';
COMMENT ON COLUMN loadout.arrow_gear_id IS 'Equipped arrow (references catalog)';
COMMENT ON COLUMN loadout.amulet_gear_id IS 'Equipped amulet (references catalog)';
