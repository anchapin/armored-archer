-- Inventory Table
-- Links players to gear they've earned via gameplay
-- Tracks which gear each player owns

CREATE TABLE IF NOT EXISTS inventory (
  inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gear_id UUID NOT NULL REFERENCES catalog(gear_id) ON DELETE CASCADE,
  
  -- Timestamps
  acquired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Unique constraint: player can only own one instance of each base gear
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_user_gear ON inventory(user_id, gear_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_gear_id ON inventory(gear_id);
CREATE INDEX IF NOT EXISTS idx_inventory_acquired_at ON inventory(acquired_at);

-- Add comments
COMMENT ON TABLE inventory IS 'Tracks gear owned by each player';
COMMENT ON COLUMN inventory.acquired_at IS 'Timestamp when the player acquired this gear piece';
