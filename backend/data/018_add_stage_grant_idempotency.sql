-- Stage grant idempotency (reward integration contract, PR 1 of 2)
-- Stable per-effect grant IDs let a retried stage completion resume instead
-- of double-granting or losing effects. Gear rows carry a nullable grant_id
-- with a partial unique index; NULLs (all pre-existing rows) never conflict.

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS grant_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_grant_id
  ON inventory_items(grant_id)
  WHERE grant_id IS NOT NULL;

COMMENT ON COLUMN inventory_items.grant_id IS 'Deterministic stage-completion grant key (user:stage:attempt:effect); enforces insert-once for resumed completions';
