-- Catalog Table (Base Gear)
-- Stores master catalog of all available gear with stats and modifiers
-- Base gear is earned via gameplay (not purchased)

CREATE TYPE gear_type AS ENUM ('helm', 'armor', 'bow', 'arrow', 'amulet');
CREATE TYPE gear_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');

CREATE TABLE IF NOT EXISTS catalog (
  gear_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gear_type gear_type NOT NULL,
  name TEXT NOT NULL,
  rarity gear_rarity NOT NULL,
  
  -- JSONB for flexible stat configuration
  -- Example: {"attack_power": 15, "defense": 10, "dodge_chance": 5}
  base_stats JSONB NOT NULL DEFAULT '{}',
  
  -- JSONB array of modifier objects
  -- Example: [{"type": "piercing", "value": 10}, {"type": "elemental_fire", "value": 5}]
  modifiers JSONB NOT NULL DEFAULT '[]',
  
  -- Optional visual/icon reference
  icon_url TEXT,
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_catalog_gear_type ON catalog(gear_type);
CREATE INDEX IF NOT EXISTS idx_catalog_rarity ON catalog(rarity);
CREATE INDEX IF NOT EXISTS idx_catalog_base_stats ON catalog USING GIN(base_stats);
CREATE INDEX IF NOT EXISTS idx_catalog_modifiers ON catalog USING GIN(modifiers);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_catalog_updated_at
  BEFORE UPDATE ON catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE catalog IS 'Master catalog of all base gear available in the game';
COMMENT ON COLUMN catalog.base_stats IS 'JSONB object storing base stat bonuses for this gear';
COMMENT ON COLUMN catalog.modifiers IS 'JSONB array of special modifiers (e.g., piercing, elemental effects)';
