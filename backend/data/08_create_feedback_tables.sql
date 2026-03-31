-- Migration: 08_create_feedback_tables
-- Description: Creates tables for user feedback collection including feedback submissions, categories, and developer responses
-- Date: 2026-03-16
-- Phase: v2.1.0 - Phase 3.2 (Feedback Collection System)

-- Enum: feedback_category
-- Categories for feedback classification
CREATE TYPE feedback_category AS ENUM (
    'bug',              -- Bug reports
    'suggestion',       -- Feature suggestions
    'balance',          -- Game balance feedback
    'performance',      -- Performance issues
    'ui_ux',           -- UI/UX feedback
    'audio',           -- Audio/sound feedback
    'other'            -- Other feedback
);

-- Enum: feedback_priority
-- Priority levels for feedback triage
CREATE TYPE feedback_priority AS ENUM (
    'low',             -- Low priority
    'medium',          -- Medium priority
    'high',            -- High priority
    'critical'         -- Critical priority (blocking issues)
);

-- Enum: feedback_status
-- Status tracking for feedback items
CREATE TYPE feedback_status AS ENUM (
    'submitted',       -- Newly submitted
    'acknowledged',    -- Acknowledged by team
    'in_review',       -- Under review
    'planned',         -- Planned for future release
    'in_progress',     -- Currently being worked on
    'resolved',        -- Resolved/fixed
    'closed',          -- Closed (won't fix, duplicate, etc.)
    'rejected'         -- Rejected (invalid, spam, etc.)
);

-- Table: feedback_categories
-- Master table for feedback categories (optional customization)
CREATE TABLE IF NOT EXISTS feedback_categories (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color_code TEXT NOT NULL DEFAULT '#808080',  -- Hex color for UI display
    icon_name TEXT,                               -- Icon identifier for UI
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for active categories
CREATE INDEX idx_feedback_categories_active ON feedback_categories(is_active) WHERE is_active = true;

-- Trigger to update updated_at
CREATE TRIGGER update_feedback_categories_updated_at
    BEFORE UPDATE ON feedback_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE feedback_categories IS 'Master table for feedback categories with UI metadata';
COMMENT ON COLUMN feedback_categories.color_code IS 'Hex color code for category visualization';
COMMENT ON COLUMN feedback_categories.icon_name IS 'Icon identifier for UI display';

-- Insert default categories
INSERT INTO feedback_categories (name, description, color_code, icon_name, sort_order) VALUES
    ('bug', 'Bug reports and issues', '#DC2626', 'bug', 1),
    ('suggestion', 'Feature suggestions and ideas', '#2563EB', 'lightbulb', 2),
    ('balance', 'Game balance feedback', '#7C3AED', 'scale', 3),
    ('performance', 'Performance and optimization', '#EA580C', 'gauge', 4),
    ('ui_ux', 'User interface and experience', '#0891B2', 'layout', 5),
    ('audio', 'Audio and sound feedback', '#059669', 'volume', 6),
    ('other', 'Other feedback', '#6B7280', 'ellipsis', 7)
ON CONFLICT (name) DO NOTHING;

-- Table: feedback_submissions
-- Stores user feedback submissions
CREATE TABLE IF NOT EXISTS feedback_submissions (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category feedback_category NOT NULL DEFAULT 'other',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority feedback_priority NOT NULL DEFAULT 'medium',
    status feedback_status NOT NULL DEFAULT 'submitted',
    
    -- Context information
    game_version TEXT NOT NULL DEFAULT 'unknown',
    platform TEXT NOT NULL DEFAULT 'unknown',
    device_info TEXT,                          -- Device model, OS version, etc.
    session_id TEXT,                           -- Game session identifier
    
    -- Optional attachments
    screenshot_url TEXT,                       -- URL to uploaded screenshot
    replay_data JSONB DEFAULT '{}',            -- Optional replay/context data
    
    -- Triage and assignment
    assigned_to TEXT,                          -- Developer username assigned
    tags TEXT[] DEFAULT '{}',                  -- Custom tags for filtering
    internal_notes TEXT,                       -- Internal developer notes
    
    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_feedback_submissions_user_id ON feedback_submissions(user_id);
CREATE INDEX idx_feedback_submissions_category ON feedback_submissions(category);
CREATE INDEX idx_feedback_submissions_status ON feedback_submissions(status);
CREATE INDEX idx_feedback_submissions_priority ON feedback_submissions(priority);
CREATE INDEX idx_feedback_submissions_submitted_at ON feedback_submissions(submitted_at DESC);
CREATE INDEX idx_feedback_submissions_assigned_to ON feedback_submissions(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_feedback_submissions_tags ON feedback_submissions USING GIN(tags);

-- Composite index for dashboard queries
CREATE INDEX idx_feedback_submissions_status_category ON feedback_submissions(status, category);

-- Trigger to update updated_at
CREATE TRIGGER update_feedback_submissions_updated_at
    BEFORE UPDATE ON feedback_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE feedback_submissions IS 'Stores user feedback submissions with categorization and status tracking';
COMMENT ON COLUMN feedback_submissions.category IS 'Feedback category (bug, suggestion, balance, etc.)';
COMMENT ON COLUMN feedback_submissions.priority IS 'Priority level for triage';
COMMENT ON COLUMN feedback_submissions.status IS 'Current status in workflow';
COMMENT ON COLUMN feedback_submissions.game_version IS 'Game version when feedback was submitted';
COMMENT ON COLUMN feedback_submissions.platform IS 'Platform (iOS, Android, etc.)';
COMMENT ON COLUMN feedback_submissions.device_info IS 'Device model and OS information';
COMMENT ON COLUMN feedback_submissions.session_id IS 'Game session identifier for debugging';
COMMENT ON COLUMN feedback_submissions.screenshot_url IS 'URL to uploaded screenshot attachment';
COMMENT ON COLUMN feedback_submissions.replay_data IS 'JSON data containing replay or context information';
COMMENT ON COLUMN feedback_submissions.assigned_to IS 'Developer username assigned to this feedback';
COMMENT ON COLUMN feedback_submissions.tags IS 'Custom tags for filtering and organization';
COMMENT ON COLUMN feedback_submissions.internal_notes IS 'Internal developer notes (not visible to users)';

-- Table: feedback_responses
-- Stores developer responses to feedback
CREATE TABLE IF NOT EXISTS feedback_responses (
    response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES feedback_submissions(feedback_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- Developer who responded
    response_text TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,  -- Internal note vs public response
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for feedback responses
CREATE INDEX idx_feedback_responses_feedback_id ON feedback_responses(feedback_id);
CREATE INDEX idx_feedback_responses_user_id ON feedback_responses(user_id);
CREATE INDEX idx_feedback_responses_is_internal ON feedback_responses(is_internal);

-- Trigger to update updated_at
CREATE TRIGGER update_feedback_responses_updated_at
    BEFORE UPDATE ON feedback_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE feedback_responses IS 'Stores developer responses to feedback submissions';
COMMENT ON COLUMN feedback_responses.is_internal IS 'True for internal notes, false for public responses';

-- Table: feedback_votes
-- Allows users to vote on feedback submissions (for suggestions)
CREATE TABLE IF NOT EXISTS feedback_votes (
    vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES feedback_submissions(feedback_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type INTEGER NOT NULL CHECK (vote_type IN (1, -1)),  -- 1 for upvote, -1 for downvote
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure one vote per user per feedback
    UNIQUE(feedback_id, user_id)
);

-- Index for vote counting
CREATE INDEX idx_feedback_votes_feedback_id ON feedback_votes(feedback_id);
CREATE INDEX idx_feedback_votes_user_id ON feedback_votes(user_id);

COMMENT ON TABLE feedback_votes IS 'User votes on feedback submissions for prioritization';
COMMENT ON COLUMN feedback_votes.vote_type IS '1 for upvote, -1 for downvote';

-- Table: feedback_notifications
-- Tracks notifications sent to users about their feedback
CREATE TABLE IF NOT EXISTS feedback_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES feedback_submissions(feedback_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'status_change',      -- Status changed (e.g., submitted -> in_progress)
        'developer_response', -- Developer responded
        'resolved',          -- Feedback resolved
        'assigned',          -- Assigned to developer
        'mention'            -- User mentioned in response
    )),
    old_value TEXT,                    -- Previous value (e.g., old status)
    new_value TEXT,                    -- New value (e.g., new status)
    message TEXT NOT NULL,             -- Notification message
    is_read BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for user notifications
CREATE INDEX idx_feedback_notifications_user_id ON feedback_notifications(user_id);
CREATE INDEX idx_feedback_notifications_feedback_id ON feedback_notifications(feedback_id);
CREATE INDEX idx_feedback_notifications_is_read ON feedback_notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_feedback_notifications_sent_at ON feedback_notifications(sent_at DESC);

COMMENT ON TABLE feedback_notifications IS 'Tracks notifications sent to users about feedback updates';
COMMENT ON COLUMN feedback_notifications.notification_type IS 'Type of notification event';
COMMENT ON COLUMN feedback_notifications.old_value IS 'Previous value before change';
COMMENT ON COLUMN feedback_notifications.new_value IS 'New value after change';
COMMENT ON COLUMN feedback_notifications.is_read IS 'Whether user has read the notification';

-- Function: get_feedback_with_votes
-- Gets feedback submissions with vote counts
CREATE OR REPLACE FUNCTION get_feedback_with_votes(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_category feedback_category DEFAULT NULL,
    p_status feedback_status DEFAULT NULL
)
RETURNS TABLE (
    feedback_id UUID,
    user_id UUID,
    category feedback_category,
    title TEXT,
    description TEXT,
    priority feedback_priority,
    status feedback_status,
    game_version TEXT,
    platform TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    vote_count BIGINT,
    comment_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fs.feedback_id,
        fs.user_id,
        fs.category,
        fs.title,
        fs.description,
        fs.priority,
        fs.status,
        fs.game_version,
        fs.platform,
        fs.submitted_at,
        COALESCE(v.vote_count, 0)::BIGINT AS vote_count,
        COALESCE(r.comment_count, 0)::BIGINT AS comment_count
    FROM feedback_submissions fs
    LEFT JOIN (
        SELECT feedback_id, SUM(vote_type) AS vote_count
        FROM feedback_votes
        GROUP BY feedback_id
    ) v ON fs.feedback_id = v.feedback_id
    LEFT JOIN (
        SELECT feedback_id, COUNT(*)::BIGINT AS comment_count
        FROM feedback_responses
        WHERE is_internal = false
        GROUP BY feedback_id
    ) r ON fs.feedback_id = r.feedback_id
    WHERE (p_category IS NULL OR fs.category = p_category)
      AND (p_status IS NULL OR fs.status = p_status)
    ORDER BY fs.submitted_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function: submit_feedback_fn
-- Submits new feedback and returns the feedback_id
CREATE OR REPLACE FUNCTION submit_feedback_fn(
    p_user_id UUID,
    p_category feedback_category,
    p_title TEXT,
    p_description TEXT,
    p_game_version TEXT DEFAULT 'unknown',
    p_platform TEXT DEFAULT 'unknown',
    p_device_info TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_screenshot_url TEXT DEFAULT NULL,
    p_replay_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_feedback_id UUID;
BEGIN
    INSERT INTO feedback_submissions (
        user_id, category, title, description, game_version,
        platform, device_info, session_id, screenshot_url, replay_data
    )
    VALUES (
        p_user_id, p_category, p_title, p_description, p_game_version,
        p_platform, p_device_info, p_session_id, p_screenshot_url, p_replay_data
    )
    RETURNING feedback_id INTO v_feedback_id;
    
    RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql;

-- Function: update_feedback_status_fn
-- Updates feedback status and creates notification
CREATE OR REPLACE FUNCTION update_feedback_status_fn(
    p_feedback_id UUID,
    p_new_status feedback_status,
    p_assigned_to TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_status feedback_status;
    v_user_id UUID;
BEGIN
    -- Get current status and user_id
    SELECT status, user_id INTO v_old_status, v_user_id
    FROM feedback_submissions
    WHERE feedback_id = p_feedback_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Update status
    UPDATE feedback_submissions
    SET 
        status = p_new_status,
        assigned_to = COALESCE(p_assigned_to, assigned_to),
        reviewed_at = CASE 
            WHEN p_new_status IN ('in_review', 'in_progress') AND reviewed_at IS NULL 
            THEN NOW() 
            ELSE reviewed_at 
        END,
        resolved_at = CASE 
            WHEN p_new_status = 'resolved' AND resolved_at IS NULL 
            THEN NOW() 
            ELSE resolved_at 
        END
    WHERE feedback_id = p_feedback_id;
    
    -- Create notification
    INSERT INTO feedback_notifications (
        feedback_id, user_id, notification_type,
        old_value, new_value, message
    )
    VALUES (
        p_feedback_id, v_user_id, 'status_change',
        v_old_status::TEXT, p_new_status::TEXT,
        format('Feedback status changed from %s to %s', v_old_status, p_new_status)
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: add_feedback_response_fn
-- Adds a response to feedback
CREATE OR REPLACE FUNCTION add_feedback_response_fn(
    p_feedback_id UUID,
    p_user_id UUID,
    p_response_text TEXT,
    p_is_internal BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    v_response_id UUID;
    v_feedback_user_id UUID;
BEGIN
    -- Get feedback owner
    SELECT user_id INTO v_feedback_user_id
    FROM feedback_submissions
    WHERE feedback_id = p_feedback_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Insert response
    INSERT INTO feedback_responses (feedback_id, user_id, response_text, is_internal)
    VALUES (p_feedback_id, p_user_id, p_response_text, p_is_internal)
    RETURNING response_id INTO v_response_id;
    
    -- Create notification if not internal
    IF NOT p_is_internal THEN
        INSERT INTO feedback_notifications (
            feedback_id, user_id, notification_type, message
        )
        VALUES (
            p_feedback_id, v_feedback_user_id, 'developer_response',
            NULL, NULL, 'A developer has responded to your feedback'
        );
    END IF;
    
    RETURN v_response_id;
END;
$$ LANGUAGE plpgsql;

-- Function: get_feedback_statistics_fn
-- Gets feedback statistics for dashboard
CREATE OR REPLACE FUNCTION get_feedback_statistics_fn(
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_submissions BIGINT,
    total_resolved BIGINT,
    total_pending BIGINT,
    avg_resolution_time_hours DOUBLE PRECISION,
    submissions_by_category JSONB,
    submissions_by_status JSONB,
    submissions_by_priority JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        -- Total counts
        (SELECT COUNT(*) FROM feedback_submissions WHERE submitted_at >= NOW() - (p_days || ' days')::INTERVAL)::BIGINT AS total_submissions,
        (SELECT COUNT(*) FROM feedback_submissions WHERE status = 'resolved' AND resolved_at >= NOW() - (p_days || ' days')::INTERVAL)::BIGINT AS total_resolved,
        (SELECT COUNT(*) FROM feedback_submissions WHERE status IN ('submitted', 'acknowledged', 'in_review'))::BIGINT AS total_pending,
        
        -- Average resolution time
        (
            SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - submitted_at)) / 3600)
            FROM feedback_submissions
            WHERE status = 'resolved' AND resolved_at IS NOT NULL
        ) AS avg_resolution_time_hours,
        
        -- Grouped statistics
        (
            SELECT jsonb_object_agg(category, count)
            FROM (
                SELECT category::TEXT AS category, COUNT(*) AS count
                FROM feedback_submissions
                WHERE submitted_at >= NOW() - (p_days || ' days')::INTERVAL
                GROUP BY category
            ) t
        ) AS submissions_by_category,
        
        (
            SELECT jsonb_object_agg(status::TEXT, count)
            FROM (
                SELECT status::TEXT, COUNT(*) AS count
                FROM feedback_submissions
                WHERE submitted_at >= NOW() - (p_days || ' days')::INTERVAL
                GROUP BY status
            ) t
        ) AS submissions_by_status,
        
        (
            SELECT jsonb_object_agg(priority::TEXT, count)
            FROM (
                SELECT priority::TEXT, COUNT(*) AS count
                FROM feedback_submissions
                WHERE submitted_at >= NOW() - (p_days || ' days')::INTERVAL
                GROUP BY priority
            ) t
        ) AS submissions_by_priority;
END;
$$ LANGUAGE plpgsql;

-- View: feedback_dashboard_view
-- Provides a denormalized view for dashboard queries
CREATE OR REPLACE VIEW feedback_dashboard_view AS
SELECT 
    fs.feedback_id,
    fs.user_id,
    u.username AS submitter_username,
    fs.category,
    fs.title,
    fs.description,
    fs.priority,
    fs.status,
    fs.game_version,
    fs.platform,
    fs.device_info,
    fs.assigned_to,
    fs.tags,
    fs.submitted_at,
    fs.reviewed_at,
    fs.resolved_at,
    COALESCE(v.vote_count, 0) AS vote_count,
    COALESCE(r.public_response_count, 0) AS response_count,
    COALESCE(n.unread_count, 0) AS unread_notification_count
FROM feedback_submissions fs
LEFT JOIN users u ON fs.user_id = u.id
LEFT JOIN (
    SELECT feedback_id, SUM(vote_type) AS vote_count
    FROM feedback_votes
    GROUP BY feedback_id
) v ON fs.feedback_id = v.feedback_id
LEFT JOIN (
    SELECT feedback_id, COUNT(*) AS public_response_count
    FROM feedback_responses
    WHERE is_internal = false
    GROUP BY feedback_id
) r ON fs.feedback_id = r.feedback_id
LEFT JOIN (
    SELECT feedback_id, COUNT(*) AS unread_count
    FROM feedback_notifications
    WHERE is_read = false
    GROUP BY feedback_id
) n ON fs.feedback_id = n.feedback_id;

COMMENT ON VIEW feedback_dashboard_view IS 'Denormalized view for feedback dashboard with vote counts and response counts';

-- Insert sample data for testing (will be removed in production)
-- Uncomment for testing:
-- SELECT submit_feedback_fn(
--     '00000000-0000-0000-0000-000000000000'::UUID,  -- Replace with actual user_id
--     'bug'::feedback_category,
--     'Test Bug Report',
--     'This is a test bug report for development',
--     '2.1.0',
--     'android',
--     'Pixel 7, Android 14',
--     NULL,
--     NULL,
--     '{}'::JSONB
-- );
