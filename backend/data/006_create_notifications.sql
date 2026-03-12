-- Migration: 006_create_notifications
-- Description: Creates tables for push notifications including device tokens, preferences, and scheduled notifications
-- Date: 2024-03-12

-- Table: device_tokens
-- Stores FCM device tokens for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
    app_version TEXT,
    fcm_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for efficient user device lookup
CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);

-- Index for token lookup
CREATE INDEX idx_device_tokens_device_token ON device_tokens(device_token);

-- Index for cleanup queries
CREATE INDEX idx_device_tokens_last_used_at ON device_tokens(last_used_at);

-- Trigger to update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_device_tokens_updated_at
    BEFORE UPDATE ON device_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE device_tokens IS 'Stores FCM device tokens for push notifications';
COMMENT ON COLUMN device_tokens.user_id IS 'User ID who owns this device';
COMMENT ON COLUMN device_tokens.device_token IS 'Unique device identifier';
COMMENT ON COLUMN device_tokens.platform IS 'Mobile platform (android or ios)';
COMMENT ON COLUMN device_tokens.app_version IS 'App version on this device';
COMMENT ON COLUMN device_tokens.fcm_token IS 'Firebase Cloud Messaging token';

-- Table: notification_preferences
-- Stores user notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    daily_rewards_enabled BOOLEAN NOT NULL DEFAULT true,
    events_enabled BOOLEAN NOT NULL DEFAULT true,
    pvp_challenges_enabled BOOLEAN NOT NULL DEFAULT true,
    promotions_enabled BOOLEAN NOT NULL DEFAULT true,
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start TIME NOT NULL DEFAULT '22:00:00',
    quiet_hours_end TIME NOT NULL DEFAULT '08:00:00',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for user preference lookup
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE notification_preferences IS 'Stores user notification preferences';
COMMENT ON COLUMN notification_preferences.user_id IS 'User ID';
COMMENT ON COLUMN notification_preferences.daily_rewards_enabled IS 'Enable daily reward notifications';
COMMENT ON COLUMN notification_preferences.events_enabled IS 'Enable event notifications';
COMMENT ON COLUMN notification_preferences.pvp_challenges_enabled IS 'Enable PvP challenge notifications';
COMMENT ON COLUMN notification_preferences.promotions_enabled IS 'Enable promotion notifications';
COMMENT ON COLUMN notification_preferences.notifications_enabled IS 'Master toggle for all notifications';
COMMENT ON COLUMN notification_preferences.quiet_hours_enabled IS 'Enable quiet hours';
COMMENT ON COLUMN notification_preferences.quiet_hours_start IS 'Quiet hours start time';
COMMENT ON COLUMN notification_preferences.quiet_hours_end IS 'Quiet hours end time';
COMMENT ON COLUMN notification_preferences.timezone IS 'User timezone for quiet hours';

-- Table: scheduled_notifications
-- Stores scheduled notifications for batch sending
CREATE TABLE IF NOT EXISTS scheduled_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('daily_reward', 'event', 'pvp_challenge', 'promotion', 'custom')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for scheduling queries
CREATE INDEX idx_scheduled_notifications_user_id ON scheduled_notifications(user_id);
CREATE INDEX idx_scheduled_notifications_scheduled_for ON scheduled_notifications(scheduled_for);
CREATE INDEX idx_scheduled_notifications_status ON scheduled_notifications(status) WHERE status = 'pending';

CREATE TRIGGER update_scheduled_notifications_updated_at
    BEFORE UPDATE ON scheduled_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE scheduled_notifications IS 'Stores scheduled notifications for batch sending';
COMMENT ON COLUMN scheduled_notifications.notification_type IS 'Type of notification';
COMMENT ON COLUMN scheduled_notifications.scheduled_for IS 'When to send the notification';
COMMENT ON COLUMN scheduled_notifications.status IS 'Notification delivery status';
COMMENT ON COLUMN scheduled_notifications.retry_count IS 'Number of retry attempts';
COMMENT ON COLUMN scheduled_notifications.max_retries IS 'Maximum retry attempts allowed';

-- Table: notification_history
-- Stores notification delivery history for analytics
CREATE TABLE IF NOT EXISTS notification_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    device_token TEXT NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    clicked_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'clicked', 'failed')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Index for analytics queries
CREATE INDEX idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX idx_notification_history_notification_type ON notification_history(notification_type);
CREATE INDEX idx_notification_history_delivered_at ON notification_history(delivered_at);
CREATE INDEX idx_notification_history_status ON notification_history(status);

COMMENT ON TABLE notification_history IS 'Stores notification delivery history for analytics';
COMMENT ON COLUMN notification_history.notification_id IS 'Reference to scheduled_notifications';
COMMENT ON COLUMN notification_history.status IS 'Delivery status';
COMMENT ON COLUMN notification_history.metadata IS 'Additional metadata for analytics';

-- Function: get_user_notification_preferences
-- Gets notification preferences for a user, creating defaults if not exists
CREATE OR REPLACE FUNCTION get_user_notification_preferences(p_user_id UUID)
RETURNS TABLE (
    preference_id UUID,
    user_id UUID,
    daily_rewards_enabled BOOLEAN,
    events_enabled BOOLEAN,
    pvp_challenges_enabled BOOLEAN,
    promotions_enabled BOOLEAN,
    notifications_enabled BOOLEAN,
    quiet_hours_enabled BOOLEAN,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Return existing preferences or create default
    RETURN QUERY
    SELECT np.*
    FROM notification_preferences np
    WHERE np.user_id = p_user_id;

    IF NOT FOUND THEN
        -- Insert default preferences
        INSERT INTO notification_preferences (user_id)
        VALUES (p_user_id)
        RETURNING *;
    END IF;
END;
$$ LANGUAGE plpgsql;
