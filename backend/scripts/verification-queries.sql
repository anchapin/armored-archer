-- Migration Verification Queries
-- Phase 1.2 - Database Migration Execution
-- Use these queries to verify migrations completed successfully
-- 
-- Usage: 
--   docker exec -it armored_archer_postgres psql -U postgres -d nakama -f verification-queries.sql
--   Or copy/paste individual queries into psql

-- ============================================
-- 1. Database Connectivity
-- ============================================

-- Test basic connectivity
SELECT 1 as connectivity_test;

-- ============================================
-- 2. Migration Version Check
-- ============================================

-- Check if migration_version table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'migration_version'
) as migration_version_exists;

-- Get current migration version
SELECT version FROM migration_version ORDER BY version DESC LIMIT 1;

-- ============================================
-- 3. Table Existence Verification
-- ============================================

-- List all tables in public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify specific tables exist
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            'player_stats', 'catalog', 'inventory', 'loadout',
            'stage_completion', 'device_tokens', 'notification_preferences',
            'scheduled_notifications', 'notification_history',
            'boss_defeats', 'unlocked_modifier_pools'
        ) THEN 'EXPECTED'
        ELSE 'OTHER'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY status DESC, table_name;

-- ============================================
-- 4. Table Structure Verification
-- ============================================

-- Check player_stats columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'player_stats'
ORDER BY ordinal_position;

-- Check catalog columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'catalog'
ORDER BY ordinal_position;

-- Check inventory columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'inventory'
ORDER BY ordinal_position;

-- Check loadout columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'loadout'
ORDER BY ordinal_position;

-- Check stage_completion columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'stage_completion'
ORDER BY ordinal_position;

-- Check device_tokens columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'device_tokens'
ORDER BY ordinal_position;

-- Check notification_preferences columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'notification_preferences'
ORDER BY ordinal_position;

-- Check scheduled_notifications columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'scheduled_notifications'
ORDER BY ordinal_position;

-- Check notification_history columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'notification_history'
ORDER BY ordinal_position;

-- Check boss_defeats columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'boss_defeats'
ORDER BY ordinal_position;

-- Check unlocked_modifier_pools columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'unlocked_modifier_pools'
ORDER BY ordinal_position;

-- ============================================
-- 5. Enum Type Verification
-- ============================================

-- List all enum types
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname;

-- Verify gear_type enum
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'gear_type')
ORDER BY enumsortorder;

-- Verify gear_rarity enum
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'gear_rarity')
ORDER BY enumsortorder;

-- ============================================
-- 6. Index Verification
-- ============================================

-- List all indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Count indexes per table
SELECT 
    tablename,
    count(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY index_count DESC;

-- ============================================
-- 7. Constraint Verification
-- ============================================

-- List all constraints
SELECT
    conname as constraint_name,
    conrelid::regclass as table_name,
    CASE contype
        WHEN 'c' THEN 'CHECK'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 't' THEN 'TRIGGER'
        ELSE contype::text
    END as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, contype;

-- Verify primary keys
SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Verify foreign keys
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Verify unique constraints
SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Verify CHECK constraints
SELECT
    conname as constraint_name,
    conrelid::regclass as table_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE contype = 'c'
    AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text;

-- ============================================
-- 8. Trigger Verification
-- ============================================

-- List all triggers
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Verify update_updated_at_column function exists
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name = 'update_updated_at_column';

-- ============================================
-- 9. Table and Column Comments
-- ============================================

-- List table comments
SELECT 
    objrelid::regclass as table_name,
    objdescription(objoid) as comment
FROM pg_description
WHERE objsubid = 0
    AND objoid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)
ORDER BY table_name;

-- List column comments for key tables
SELECT 
    c.column_name,
    pgd.description as comment
FROM information_schema.columns c
LEFT JOIN pg_description pgd 
    ON pgd.objoid = (c.table_name::regclass)::oid 
    AND pgd.objsubid = c.ordinal_position
WHERE c.table_schema = 'public'
    AND c.table_name IN ('player_stats', 'catalog', 'inventory', 'loadout')
ORDER BY c.table_name, c.ordinal_position;

-- ============================================
-- 10. Database Statistics
-- ============================================

-- Table row counts
SELECT 
    relname as table_name,
    n_live_tup as row_count,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- Database size
SELECT 
    pg_size_pretty(pg_database_size('nakama')) as database_size,
    pg_size_pretty(pg_total_relation_size('player_stats')) as player_stats_size,
    pg_size_pretty(pg_total_relation_size('catalog')) as catalog_size,
    pg_size_pretty(pg_total_relation_size('inventory')) as inventory_size,
    pg_size_pretty(pg_total_relation_size('loadout')) as loadout_size;

-- Index usage statistics
SELECT 
    schemaname,
    relname as table_name,
    indexrelname as index_name,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ============================================
-- 11. Verification Summary Query
-- ============================================

-- Comprehensive verification summary
SELECT 
    'Tables' as check_type,
    count(*) as count,
    'Expected: 11 tables' as expected
FROM information_schema.tables 
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Indexes' as check_type,
    count(*) as count,
    'Should be > 20' as expected
FROM pg_indexes 
WHERE schemaname = 'public'
UNION ALL
SELECT 
    'Foreign Keys' as check_type,
    count(*) as count,
    'Expected: 8+ FKs' as expected
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
    AND table_schema = 'public'
UNION ALL
SELECT 
    'Triggers' as check_type,
    count(*) as count,
    'Expected: 6+ triggers' as expected
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
UNION ALL
SELECT 
    'Enum Types' as check_type,
    count(DISTINCT t.typname) as count,
    'Expected: 2 (gear_type, gear_rarity)' as expected
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typnamespace = 'public'::regnamespace;
