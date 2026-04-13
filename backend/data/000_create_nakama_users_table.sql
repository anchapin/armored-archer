-- Nakama users table (minimal version for schema validation)
-- This is a minimal subset of the Nakama users table to support schema validation tests.
-- In production, Nakama creates and manages this table.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT,
  lang_tag TEXT DEFAULT 'en',
  location TEXT,
  metadata JSONB DEFAULT '{}',
  edge_count INTEGER DEFAULT 0,
  create_time TIMESTAMPTZ DEFAULT NOW(),
  update_time TIMESTAMPTZ DEFAULT NOW(),
  disable_time TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name);
CREATE INDEX IF NOT EXISTS idx_users_create_time ON users(create_time);

-- Add comment
COMMENT ON TABLE users IS 'Nakama users table - minimal version for schema validation';
