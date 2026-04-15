-- Inventory Items Table
-- Stores unique gear instances generated for players
-- Each instance has its own stats, modifiers, and unique ID

CREATE TYPE gear_type AS ENUM ('helm', 'armor', 'bow', 'arrow', 'amulet');
CREATE TYPE gear_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');

-- Create inventory_items table for unique gear instances
CREATE TABLE IF NOT EXISTS inventory_items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Gear properties
  gear_type gear_type NOT NULL,
  name TEXT NOT NULL,
  rarity gear_rarity NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,

  -- JSONB for unique stats on this instance
  -- Example: [{"name": "attack_power", "base_value": 10, "value": 15}]
  stats JSONB NOT NULL DEFAULT '[]',

  -- JSONB for unique modifiers on this instance
  -- Example: [{"id": "piercing_arrow", "name": "Piercing Arrow", "description": "...", "stat": "attack", "value_range": [8, 8], "rarity": "rare", "boss_unlock": "boss_wind"}]
  modifiers JSONB NOT NULL DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure each gear instance is unique per user
  CONSTRAINT unique_gear_instance UNIQUE (item_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_gear_type ON inventory_items(gear_type);
CREATE INDEX IF NOT EXISTS idx_inventory_items_rarity ON inventory_items(rarity);
CREATE INDEX IF NOT EXISTS idx_inventory_items_stats ON inventory_items USING GIN(stats);
CREATE INDEX IF NOT EXISTS idx_inventory_items_modifiers ON inventory_items USING GIN(modifiers);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE inventory_items IS 'Stores unique gear instances generated for players with custom stats and modifiers';
COMMENT ON COLUMN inventory_items.stats IS 'JSONB array of stat objects with base_value and final value';
COMMENT ON COLUMN inventory_items.modifiers IS 'JSONB array of modifier objects unique to this gear instance';
