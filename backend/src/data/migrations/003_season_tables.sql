-- Migration: Season Tables
-- Creates tables for seasonal ranking system with rating decay support
-- Stores season data, rankings, and historical archives

-- Seasons table (season configuration and status)
CREATE TABLE IF NOT EXISTS seasons (
    id VARCHAR(36) PRIMARY KEY,
    season_number INTEGER NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('upcoming', 'active', 'ended')),
    duration_days INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Season rankings table (persistent ranking storage with decay info)
CREATE TABLE IF NOT EXISTS season_rankings (
    id VARCHAR(36) PRIMARY KEY,
    season_id VARCHAR(36) NOT NULL,
    player_id VARCHAR(36) NOT NULL,
    mode VARCHAR(3) NOT NULL CHECK (mode IN ('1v1', '2v2')),
    rating INTEGER NOT NULL DEFAULT 1200,
    decayed_rating INTEGER NOT NULL DEFAULT 1200,
    matches INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    win_rate DECIMAL(5, 4) NOT NULL DEFAULT 0,
    punch_up_wins INTEGER NOT NULL DEFAULT 0,
    last_active TIMESTAMP NOT NULL DEFAULT NOW(),
    last_decay_check TIMESTAMP,
    total_decay_loss INTEGER NOT NULL DEFAULT 0,
    days_inactive INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_season_rankings_season FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    CONSTRAINT fk_season_rankings_player FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_season_player_mode UNIQUE (season_id, player_id, mode)
);

-- Season history table (archived season results)
CREATE TABLE IF NOT EXISTS season_history (
    id VARCHAR(36) PRIMARY KEY,
    season_id VARCHAR(36) NOT NULL,
    season_number INTEGER NOT NULL UNIQUE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    winner_id VARCHAR(36),
    winner_name VARCHAR(255),
    winner_rating INTEGER NOT NULL DEFAULT 0,
    total_players INTEGER NOT NULL DEFAULT 0,
    rewards_distributed BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_season_history_season FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    CONSTRAINT fk_season_history_winner FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Season rewards table (reward distribution tracking)
CREATE TABLE IF NOT EXISTS season_rewards (
    id VARCHAR(36) PRIMARY KEY,
    season_id VARCHAR(36) NOT NULL,
    player_id VARCHAR(36) NOT NULL,
    rank_tier VARCHAR(20) NOT NULL CHECK (rank_tier IN ('legendary', 'epic', 'rare', 'uncommon', 'common')),
    final_rank INTEGER NOT NULL,
    coins_awarded INTEGER NOT NULL DEFAULT 0,
    gems_awarded INTEGER NOT NULL DEFAULT 0,
    cosmetics_awarded TEXT, -- JSON array of cosmetic IDs
    claimed BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_season_rewards_season FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    CONSTRAINT fk_season_rewards_player FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_season_player UNIQUE (season_id, player_id)
);

-- Rating decay config table (decay settings per season)
CREATE TABLE IF NOT EXISTS rating_decay_config (
    id VARCHAR(36) PRIMARY KEY,
    season_id VARCHAR(36) NOT NULL UNIQUE,
    inactive_days_threshold INTEGER NOT NULL DEFAULT 7,
    decay_rate_percent DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    high_decay_threshold_days INTEGER NOT NULL DEFAULT 30,
    high_decay_rate_percent DECIMAL(5, 2) NOT NULL DEFAULT 2.00,
    minimum_rating INTEGER NOT NULL DEFAULT 1000,
    max_decay_loss INTEGER NOT NULL DEFAULT 200,
    last_decay_run TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_decay_config_season FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(status);
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(end_time) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_season_rankings_season ON season_rankings(season_id);
CREATE INDEX IF NOT EXISTS idx_season_rankings_player ON season_rankings(player_id);
CREATE INDEX IF NOT EXISTS idx_season_rankings_mode ON season_rankings(mode);
CREATE INDEX IF NOT EXISTS idx_season_rankings_rating ON season_rankings(decayed_rating DESC);
CREATE INDEX IF NOT EXISTS idx_season_rankings_rank ON season_rankings(season_id, decayed_rating DESC);

CREATE INDEX IF NOT EXISTS idx_season_history_season_number ON season_history(season_number DESC);

CREATE INDEX IF NOT EXISTS idx_season_rewards_season ON season_rewards(season_id);
CREATE INDEX IF NOT EXISTS idx_season_rewards_player ON season_rewards(player_id);
CREATE INDEX IF NOT EXISTS idx_season_rewards_claimed ON season_rewards(season_id, claimed);

CREATE INDEX IF NOT EXISTS idx_decay_config_season ON rating_decay_config(season_id);

-- Views for common queries

-- Active seasons view
CREATE OR REPLACE VIEW active_seasons AS
SELECT
    s.id,
    s.season_number,
    s.name,
    s.start_time,
    s.end_time,
    s.status,
    s.duration_days,
    EXTRACT(EPOCH FROM (s.end_time - NOW())) / 86400 AS days_remaining,
    COUNT(DISTINCT sr.player_id) AS total_players,
    MAX(sr.decayed_rating) AS top_rating
FROM seasons s
LEFT JOIN season_rankings sr ON sr.season_id = s.id
WHERE s.status = 'active'
GROUP BY s.id;

-- Top 100 leaderboard view
CREATE OR REPLACE VIEW top_100_leaderboard AS
SELECT
    sr.season_id,
    sr.player_id,
    sr.mode,
    sr.decayed_rating AS rating,
    sr.rating AS original_rating,
    sr.matches,
    sr.wins,
    sr.losses,
    sr.win_rate,
    sr.punch_up_wins,
    sr.days_inactive,
    RANK() OVER (PARTITION BY sr.season_id, sr.mode ORDER BY sr.decayed_rating DESC) AS rank
FROM season_rankings sr
JOIN seasons s ON sr.season_id = s.id
WHERE s.status = 'active';

-- Season summary view
CREATE OR REPLACE VIEW season_summary AS
SELECT
    s.id AS season_id,
    s.season_number,
    s.name,
    s.start_time,
    s.end_time,
    s.status,
    COUNT(DISTINCT sr.player_id) AS total_players,
    AVG(sr.decayed_rating) AS avg_rating,
    MAX(sr.decayed_rating) AS max_rating,
    MIN(sr.decayed_rating) AS min_rating,
    SUM(sr.wins) AS total_wins,
    SUM(sr.matches) AS total_matches
FROM seasons s
LEFT JOIN season_rankings sr ON sr.season_id = s.id
GROUP BY s.id;

-- Player season history view
CREATE OR REPLACE VIEW player_season_history AS
SELECT
    sr.player_id,
    s.season_number,
    s.name AS season_name,
    sr.final_rank,
    sr.rank_tier,
    sr.matches,
    sr.wins,
    sr.losses,
    sr.win_rate,
    sh.winner_id = sr.player_id AS is_winner,
    sh.total_players
FROM season_rankings sr
JOIN seasons s ON sr.season_id = s.id
LEFT JOIN season_history sh ON sh.season_id = s.id
WHERE s.status = 'ended'
ORDER BY s.season_number DESC;
