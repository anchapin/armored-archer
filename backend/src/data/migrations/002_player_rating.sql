-- Migration: Player Rating Tables
-- Creates tables for ELO-based skill rating system
-- Migrates player ratings, rating history, and statistics

-- Player ratings table (current state per player per mode)
CREATE TABLE IF NOT EXISTS player_ratings (
	id VARCHAR(36) PRIMARY KEY,
	player_id VARCHAR(36) NOT NULL,
	mode VARCHAR(3) NOT NULL CHECK (mode IN ('1v1', '2v2')),
	rating INTEGER NOT NULL DEFAULT 1200,
	matches INTEGER NOT NULL DEFAULT 0,
	wins INTEGER NOT NULL DEFAULT 0,
	losses INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMP NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
	CONSTRAINT fk_player_rating FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
	CONSTRAINT uk_player_mode UNIQUE (player_id, mode)
);

-- Rating history table (track all rating changes)
CREATE TABLE IF NOT EXISTS rating_history (
	id VARCHAR(36) PRIMARY KEY,
	player_id VARCHAR(36) NOT NULL,
	mode VARCHAR(3) NOT NULL CHECK (mode IN ('1v1', '2v2')),
	old_rating INTEGER NOT NULL,
	new_rating INTEGER NOT NULL,
	opponent_rating INTEGER NOT NULL,
	is_win BOOLEAN NOT NULL,
	timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
	CONSTRAINT fk_rating_history_player FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_ratings_player ON player_ratings(player_id);
CREATE INDEX IF NOT EXISTS idx_player_ratings_mode ON player_ratings(mode);
CREATE INDEX IF NOT EXISTS idx_player_ratings_rating ON player_ratings(rating DESC);
CREATE INDEX IF NOT EXISTS idx_rating_history_player ON rating_history(player_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_mode ON rating_history(mode);
CREATE INDEX IF NOT EXISTS idx_rating_history_timestamp ON rating_history(timestamp DESC);

-- Statistics view for player rating analytics
CREATE OR REPLACE VIEW player_rating_stats AS
SELECT
	pr.player_id,
	pr.mode,
	COUNT(*) as total_matches,
	SUM(CASE WHEN rh.is_win = true THEN 1 ELSE 0 END) as total_wins,
	SUM(CASE WHEN rh.is_win = false THEN 1 ELSE 0 END) as total_losses,
	AVG(rh.new_rating) as avg_rating,
	MAX(rh.new_rating) as max_rating,
	MIN(rh.new_rating) as min_rating,
	MAX(pr.rating) as current_rating
FROM player_ratings pr
LEFT JOIN rating_history rh ON rh.player_id = pr.player_id AND rh.mode = pr.mode
GROUP BY pr.player_id, pr.mode;
