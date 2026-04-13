-- Migration: Gear Balance Adjustments Table
-- Purpose: Track balance change history for gear items
-- Version: 011

-- Table: gear_balance_adjustments
-- Stores history of balance adjustments made to gear items
CREATE TABLE IF NOT EXISTS gear_balance_adjustments (
    id BIGSERIAL PRIMARY KEY,
    gear_id VARCHAR(255) NOT NULL,
    stat VARCHAR(50) NOT NULL,
    old_value DECIMAL(10, 2) NOT NULL,
    new_value DECIMAL(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

-- Index for querying adjustments by gear
CREATE INDEX IF NOT EXISTS idx_gear_balance_adjustments_gear_id
    ON gear_balance_adjustments(gear_id);

-- Index for querying recent adjustments
CREATE INDEX IF NOT EXISTS idx_gear_balance_adjustments_created_at
    ON gear_balance_adjustments(created_at DESC);

-- Table: gear_usage_tracking
-- Tracks usage statistics for balance tuning
CREATE TABLE IF NOT EXISTS gear_usage_tracking (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    gear_id VARCHAR(255) NOT NULL,
    equip_count INTEGER NOT NULL DEFAULT 0,
    last_action VARCHAR(50) NOT NULL,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, gear_id)
);

-- Index for querying user gear usage
CREATE INDEX IF NOT EXISTS idx_gear_usage_tracking_user_id
    ON gear_usage_tracking(user_id);

-- Index for querying gear usage across all users
CREATE INDEX IF NOT EXISTS idx_gear_usage_tracking_gear_id
    ON gear_usage_tracking(gear_id);

-- Table: gear_synergy_groups
-- Defines synergy groups for gear sets
CREATE TABLE IF NOT EXISTS gear_synergy_groups (
    id SERIAL PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table: gear_synergy_pieces
-- Maps gear pieces to synergy groups
CREATE TABLE IF NOT EXISTS gear_synergy_pieces (
    id SERIAL PRIMARY KEY,
    synergy_group_id INTEGER NOT NULL REFERENCES gear_synergy_groups(id) ON DELETE CASCADE,
    gear_id VARCHAR(255) NOT NULL,
    UNIQUE (synergy_group_id, gear_id)
);

-- Index for querying pieces in a synergy group
CREATE INDEX IF NOT EXISTS idx_gear_synergy_pieces_group_id
    ON gear_synergy_pieces(synergy_group_id);

-- Index for querying which groups a gear belongs to
CREATE INDEX IF NOT EXISTS idx_gear_synergy_pieces_gear_id
    ON gear_synergy_pieces(gear_id);

-- Table: gear_synergy_bonuses
-- Defines bonus tiers for synergy groups
CREATE TABLE IF NOT EXISTS gear_synergy_bonuses (
    id SERIAL PRIMARY KEY,
    synergy_group_id INTEGER NOT NULL REFERENCES gear_synergy_groups(id) ON DELETE CASCADE,
    pieces_required INTEGER NOT NULL,
    stat VARCHAR(50) NOT NULL,
    bonus_value DECIMAL(10, 2) NOT NULL,
    UNIQUE (synergy_group_id, pieces_required, stat)
);

-- Index for querying bonuses for a synergy group
CREATE INDEX IF NOT EXISTS idx_gear_synergy_bonuses_group_id
    ON gear_synergy_bonuses(synergy_group_id);

-- Index for querying bonuses by piece requirement
CREATE INDEX IF NOT EXISTS idx_gear_synergy_bonuses_pieces_required
    ON gear_synergy_bonuses(pieces_required);

-- Insert default synergy groups
INSERT INTO gear_synergy_groups (group_name, description) VALUES
    ('dragon_set', 'Legendary dragon-themed gear set'),
    ('iron_set', 'Common iron-themed gear set')
ON CONFLICT (group_name) DO NOTHING;

-- Insert dragon set pieces (synergy_group_id = 1)
INSERT INTO gear_synergy_pieces (synergy_group_id, gear_id) VALUES
    (1, 'helm_dragon'),
    (1, 'armor_plate'),
    (1, 'bow_crossbow'),
    (1, 'arrow_dragon'),
    (1, 'amulet_dragon')
ON CONFLICT (synergy_group_id, gear_id) DO NOTHING;

-- Insert dragon set bonuses
INSERT INTO gear_synergy_bonuses (synergy_group_id, pieces_required, stat, bonus_value) VALUES
    (1, 2, 'attack', 5.0),
    (1, 3, 'crit_rate', 3.0),
    (1, 4, 'health', 50.0),
    (1, 5, 'all', 10.0)
ON CONFLICT (synergy_group_id, pieces_required, stat) DO NOTHING;

-- Insert iron set pieces (synergy_group_id = 2)
INSERT INTO gear_synergy_pieces (synergy_group_id, gear_id) VALUES
    (2, 'helm_iron'),
    (2, 'armor_chain'),
    (2, 'bow_composite'),
    (2, 'arrow_iron'),
    (2, 'amulet_power')
ON CONFLICT (synergy_group_id, gear_id) DO NOTHING;

-- Insert iron set bonuses
INSERT INTO gear_synergy_bonuses (synergy_group_id, pieces_required, stat, bonus_value) VALUES
    (2, 2, 'defense', 5.0),
    (2, 3, 'health', 30.0),
    (2, 4, 'dodge', 2.0),
    (2, 5, 'defense', 15.0)
ON CONFLICT (synergy_group_id, pieces_required, stat) DO NOTHING;
