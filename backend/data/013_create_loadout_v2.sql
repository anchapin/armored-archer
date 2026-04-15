-- Loadout Table V2
-- Stores equipped gear for each player (5 slots)
-- References inventory_items instead of catalog

DROP TABLE IF EXISTS loadout CASCADE;

CREATE TABLE IF NOT EXISTS loadout (
  loadout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- 5 gear slots (can be NULL if slot is empty)
  -- References inventory_items instead of catalog
  helm_item_id UUID REFERENCES inventory_items(item_id) ON DELETE SET NULL,
  armor_item_id UUID REFERENCES inventory_items(item_id) ON DELETE SET NULL,
  bow_item_id UUID REFERENCES inventory_items(item_id) ON DELETE SET NULL,
  arrow_item_id UUID REFERENCES inventory_items(item_id) ON DELETE SET NULL,
  amulet_item_id UUID REFERENCES inventory_items(item_id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure each slot is unique (no duplicate items equipped)
  CONSTRAINT loadout_no_duplicate_items CHECK (
    helm_item_id IS NULL OR
    (armor_item_id IS NULL OR armor_item_id <> helm_item_id) AND
    (bow_item_id IS NULL OR bow_item_id NOT IN (helm_item_id, armor_item_id)) AND
    (arrow_item_id IS NULL OR arrow_item_id NOT IN (helm_item_id, armor_item_id, bow_item_id)) AND
    (amulet_item_id IS NULL OR amulet_item_id NOT IN (helm_item_id, armor_item_id, bow_item_id, arrow_item_id))
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_loadout_user_id ON loadout(user_id);
CREATE INDEX IF NOT EXISTS idx_loadout_helm_item ON loadout(helm_item_id);
CREATE INDEX IF NOT EXISTS idx_loadout_armor_item ON loadout(armor_item_id);
CREATE INDEX IF NOT EXISTS idx_loadout_bow_item ON loadout(bow_item_id);
CREATE INDEX IF NOT EXISTS idx_loadout_arrow_item ON loadout(arrow_item_id);
CREATE INDEX IF NOT EXISTS idx_loadout_amulet_item ON loadout(amulet_item_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_loadout_updated_at
  BEFORE UPDATE ON loadout
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE loadout IS 'Stores currently equipped gear for each player (5 slots), references inventory_items';
COMMENT ON COLUMN loadout.helm_item_id IS 'Equipped helmet (references inventory_items)';
COMMENT ON COLUMN loadout.armor_item_id IS 'Equipped armor (references inventory_items)';
COMMENT ON COLUMN loadout.bow_item_id IS 'Equipped bow (references inventory_items)';
COMMENT ON COLUMN loadout.arrow_item_id IS 'Equipped arrow (references inventory_items)';
COMMENT ON COLUMN loadout.amulet_item_id IS 'Equipped amulet (references inventory_items)';
