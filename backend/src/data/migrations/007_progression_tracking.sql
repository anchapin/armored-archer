-- Migration: Progression Tracking Tables
-- Description: Creates tables for tracking player progression, quests, objectives, and level requirements
-- Version: 007

-- Player progression table
CREATE TABLE IF NOT EXISTS player_progression (
    user_id VARCHAR(255) PRIMARY KEY,
    active_quests JSONB NOT NULL DEFAULT '[]',
    completed_quests TEXT[] NOT NULL DEFAULT '{}',
    total_quests_completed INTEGER NOT NULL DEFAULT 0,
    current_objectives_count INTEGER NOT NULL DEFAULT 0,
    completed_objectives_count INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Quest progress table
CREATE TABLE IF NOT EXISTS quest_progress (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    quest_id VARCHAR(255) NOT NULL,
    quest_type VARCHAR(50) NOT NULL,
    objectives JSONB NOT NULL DEFAULT '[]',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    priority INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, quest_id)
);

-- Quest objectives table (for detailed tracking)
CREATE TABLE IF NOT EXISTS quest_objectives (
    id SERIAL PRIMARY KEY,
    quest_progress_id INTEGER NOT NULL,
    objective_id VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    state VARCHAR(50) NOT NULL DEFAULT 'not_started',
    target INTEGER NOT NULL DEFAULT 1,
    current INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (quest_progress_id) REFERENCES quest_progress(id) ON DELETE CASCADE,
    UNIQUE(quest_progress_id, objective_id)
);

-- Map markers table (for server-side marker tracking)
CREATE TABLE IF NOT EXISTS map_markers (
    user_id VARCHAR(255) NOT NULL,
    stage_id VARCHAR(255) NOT NULL,
    marker_type VARCHAR(50) NOT NULL,
    description TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, stage_id, marker_type)
);

-- Level requirements table
CREATE TABLE IF NOT EXISTS level_requirements (
    level_or_stage VARCHAR(255) PRIMARY KEY,
    required_level INTEGER NOT NULL,
    description TEXT,
    rewards JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Level requirement achievements table (tracks when players meet requirements)
CREATE TABLE IF NOT EXISTS level_requirement_achievements (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    level_or_stage VARCHAR(255) NOT NULL,
    required_level INTEGER NOT NULL,
    achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (level_or_stage) REFERENCES level_requirements(level_or_stage) ON DELETE CASCADE,
    UNIQUE(user_id, level_or_stage)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quest_progress_user_id ON quest_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_quest_id ON quest_progress(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_completed_at ON quest_progress(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quest_objectives_quest_progress_id ON quest_objectives(quest_progress_id);
CREATE INDEX IF NOT EXISTS idx_quest_objectives_state ON quest_objectives(state);
CREATE INDEX IF NOT EXISTS idx_map_markers_user_id ON map_markers(user_id);
CREATE INDEX IF NOT EXISTS idx_map_markers_stage_id ON map_markers(stage_id);
CREATE INDEX IF NOT EXISTS idx_map_markers_marker_type ON map_markers(marker_type);
CREATE INDEX IF NOT EXISTS idx_level_requirement_achievements_user_id ON level_requirement_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_level_requirement_achievements_achieved_at ON level_requirement_achievements(achieved_at);

-- Insert default level requirements for campaign stages
INSERT INTO level_requirements (level_or_stage, required_level, description, rewards) VALUES
    ('1_1', 1, 'First stage of Chapter 1', '[]'::jsonb),
    ('1_2', 1, 'Second stage of Chapter 1', '[]'::jsonb),
    ('1_3', 1, 'Third stage of Chapter 1', '[]'::jsonb),
    ('1_4', 1, 'Fourth stage of Chapter 1', '[]'::jsonb),
    ('2_1', 5, 'First stage of Chapter 2', '[]'::jsonb),
    ('2_2', 5, 'Second stage of Chapter 2', '[]'::jsonb),
    ('2_3', 5, 'Third stage of Chapter 2', '[]'::jsonb),
    ('2_4', 5, 'Fourth stage of Chapter 2', '[]'::jsonb),
    ('3_1', 10, 'First stage of Chapter 3', '[]'::jsonb),
    ('3_2', 10, 'Second stage of Chapter 3', '[]'::jsonb),
    ('3_3', 10, 'Third stage of Chapter 3', '[]'::jsonb),
    ('3_4', 10, 'Fourth stage of Chapter 3', '[]'::jsonb)
ON CONFLICT (level_or_stage) DO NOTHING;

-- Add check constraints
ALTER TABLE quest_progress ADD CONSTRAINT chk_quest_type
    CHECK (quest_type IN ('stage_completion', 'boss_defeat', 'stat_target', 'level_target', 'collect_item', 'survival'));

ALTER TABLE quest_objectives ADD CONSTRAINT chk_objective_state
    CHECK (state IN ('not_started', 'in_progress', 'completed', 'failed'));

ALTER TABLE quest_objectives ADD CONSTRAINT chk_objective_progress
    CHECK (current >= 0 AND current <= target);

ALTER TABLE map_markers ADD CONSTRAINT chk_marker_type
    CHECK (marker_type IN ('quest', 'available', 'locked'));

-- Add trigger to update updated_at timestamp on level_requirements
CREATE OR REPLACE FUNCTION update_level_requirements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER level_requirements_updated_at_trigger
    BEFORE UPDATE ON level_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_level_requirements_updated_at();
