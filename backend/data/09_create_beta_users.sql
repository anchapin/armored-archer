-- ============================================
-- Beta Users and Invitations Schema
-- Armored Archer - Beta Testing Infrastructure
-- ============================================

-- Beta Users table
CREATE TABLE IF NOT EXISTS beta_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    invite_code VARCHAR(20) UNIQUE,
    registered_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed')),
    feedback_count INTEGER DEFAULT 0,
    last_feedback_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Beta Invitations table
CREATE TABLE IF NOT EXISTS beta_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    used_at TIMESTAMP,
    max_uses INTEGER DEFAULT 1,
    uses_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked'))
);

-- Indexes for performance
CREATE INDEX idx_beta_users_user_id ON beta_users(user_id);
CREATE INDEX idx_beta_users_status ON beta_users(status);
CREATE INDEX idx_beta_invitations_code ON beta_invitations(code);
CREATE INDEX idx_beta_invitations_status ON beta_invitations(status);

-- Comments
COMMENT ON TABLE beta_users IS 'Tracks beta testing participants';
COMMENT ON TABLE beta_invitations IS 'Tracks beta invitation codes';

-- Function to generate invite code
CREATE OR REPLACE FUNCTION generate_beta_invite_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
BEGIN
    -- Generate format: BETA-XXXX-XXXX-XXXX
    code := 'BETA-' || 
           upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
           upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
           upper(substring(md5(random()::text) from 1 for 4));
    
    -- Ensure unique
    WHILE EXISTS (SELECT 1 FROM beta_invitations WHERE code = code) LOOP
        code := 'BETA-' || 
                upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
                upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
                upper(substring(md5(random()::text) from 1 for 4));
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to register a new beta user
CREATE OR REPLACE FUNCTION register_beta_user(
    p_user_id UUID,
    p_invite_code TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    beta_user_id UUID
) AS $$
DECLARE
    v_beta_user_id UUID;
    v_max_users INTEGER := 500;
    v_current_count INTEGER;
BEGIN
    -- Check current beta user count
    SELECT COUNT(*) INTO v_current_count 
    FROM beta_users 
    WHERE status = 'active';

    -- If invite code provided, validate it
    IF p_invite_code IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM beta_invitations 
            WHERE code = p_invite_code 
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > NOW())
            AND uses_count < max_uses
        ) THEN
            RETURN QUERY SELECT FALSE, 'Invalid or expired invitation code', NULL;
            RETURN;
        END IF;
    ELSE
        -- Check if we've reached max users
        IF v_current_count >= v_max_users THEN
            RETURN QUERY SELECT FALSE, 'Beta user limit reached', NULL;
            RETURN;
        END IF;
    END IF;

    -- Check if user already registered
    IF EXISTS (SELECT 1 FROM beta_users WHERE user_id = p_user_id) THEN
        RETURN QUERY SELECT FALSE, 'User already registered as beta tester', NULL;
        RETURN;
    END IF;

    -- Create beta user record
    INSERT INTO beta_users (user_id, invite_code)
    VALUES (p_user_id, p_invite_code)
    RETURNING id INTO v_beta_user_id;

    -- Update invitation if used
    IF p_invite_code IS NOT NULL THEN
        UPDATE beta_invitations 
        SET uses_count = uses_count + 1, 
            used_at = NOW(),
            status = CASE 
                WHEN uses_count + 1 >= max_uses THEN 'used' 
                ELSE status 
            END
        WHERE code = p_invite_code;
    END IF;

    RETURN QUERY SELECT TRUE, 'Successfully registered as beta user', v_beta_user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON beta_users TO nakama;
GRANT SELECT, INSERT, UPDATE, DELETE ON beta_invitations TO nakama;
GRANT EXECUTE ON FUNCTION generate_beta_invite_code() TO nakama;
GRANT EXECUTE ON FUNCTION register_beta_user(UUID, TEXT) TO nakama;
