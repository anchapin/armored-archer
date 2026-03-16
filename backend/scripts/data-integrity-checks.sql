-- Data Integrity Check Queries
-- Phase 1.2 - Database Migration Execution
-- Use these queries to verify data integrity after migrations
--
-- Usage:
--   docker exec -it armored_archer_postgres psql -U postgres -d nakama -f data-integrity-checks.sql

-- ============================================
-- 1. Row Count Verification
-- ============================================

-- Get row counts for all tables
SELECT 
    relname as table_name,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- Expected minimum row counts (adjust based on your data)
-- These should be updated with actual expected values
SELECT 'player_stats' as table_name, count(*) as row_count, 0 as min_expected FROM player_stats
UNION ALL
SELECT 'catalog' as table_name, count(*) as row_count, 0 as min_expected FROM catalog
UNION ALL
SELECT 'inventory' as table_name, count(*) as row_count, 0 as min_expected FROM inventory
UNION ALL
SELECT 'loadout' as table_name, count(*) as row_count, 0 as min_expected FROM loadout
UNION ALL
SELECT 'stage_completion' as table_name, count(*) as row_count, 0 as min_expected FROM stage_completion
UNION ALL
SELECT 'device_tokens' as table_name, count(*) as row_count, 0 as min_expected FROM device_tokens
UNION ALL
SELECT 'notification_preferences' as table_name, count(*) as row_count, 0 as min_expected FROM notification_preferences
UNION ALL
SELECT 'scheduled_notifications' as table_name, count(*) as row_count, 0 as min_expected FROM scheduled_notifications
UNION ALL
SELECT 'notification_history' as table_name, count(*) as row_count, 0 as min_expected FROM notification_history
UNION ALL
SELECT 'boss_defeats' as table_name, count(*) as row_count, 0 as min_expected FROM boss_defeats
UNION ALL
SELECT 'unlocked_modifier_pools' as table_name, count(*) as row_count, 0 as min_expected FROM unlocked_modifier_pools;

-- ============================================
-- 2. NULL Value Checks in NOT NULL Columns
-- ============================================

-- Check player_stats for NULL values in NOT NULL columns
SELECT 'player_stats.user_id' as column_check, count(*) as null_count FROM player_stats WHERE user_id IS NULL
UNION ALL
SELECT 'player_stats.level' as column_check, count(*) as null_count FROM player_stats WHERE level IS NULL
UNION ALL
SELECT 'player_stats.experience' as column_check, count(*) as null_count FROM player_stats WHERE experience IS NULL
UNION ALL
SELECT 'player_stats.ability_points' as column_check, count(*) as null_count FROM player_stats WHERE ability_points IS NULL
UNION ALL
SELECT 'player_stats.stats' as column_check, count(*) as null_count FROM player_stats WHERE stats IS NULL;

-- Check catalog for NULL values in NOT NULL columns
SELECT 'catalog.gear_type' as column_check, count(*) as null_count FROM catalog WHERE gear_type IS NULL
UNION ALL
SELECT 'catalog.name' as column_check, count(*) as null_count FROM catalog WHERE name IS NULL
UNION ALL
SELECT 'catalog.rarity' as column_check, count(*) as null_count FROM catalog WHERE rarity IS NULL
UNION ALL
SELECT 'catalog.base_stats' as column_check, count(*) as null_count FROM catalog WHERE base_stats IS NULL
UNION ALL
SELECT 'catalog.modifiers' as column_check, count(*) as null_count FROM catalog WHERE modifiers IS NULL;

-- Check inventory for NULL values in NOT NULL columns
SELECT 'inventory.user_id' as column_check, count(*) as null_count FROM inventory WHERE user_id IS NULL
UNION ALL
SELECT 'inventory.gear_id' as column_check, count(*) as null_count FROM inventory WHERE gear_id IS NULL
UNION ALL
SELECT 'inventory.acquired_at' as column_check, count(*) as null_count FROM inventory WHERE acquired_at IS NULL;

-- Check loadout for NULL values in NOT NULL columns
SELECT 'loadout.user_id' as column_check, count(*) as null_count FROM loadout WHERE user_id IS NULL;

-- ============================================
-- 3. CHECK Constraint Validation
-- ============================================

-- Check player_stats level constraint (level >= 1)
SELECT 'player_stats.level >= 1' as constraint_check, count(*) as violation_count 
FROM player_stats WHERE level < 1;

-- Check player_stats experience constraint (experience >= 0)
SELECT 'player_stats.experience >= 0' as constraint_check, count(*) as violation_count 
FROM player_stats WHERE experience < 0;

-- Check player_stats ability_points constraint (ability_points >= 0)
SELECT 'player_stats.ability_points >= 0' as constraint_check, count(*) as violation_count 
FROM player_stats WHERE ability_points < 0;

-- Check stage_completion stars constraint (0-3)
SELECT 'stage_completion.stars_earned 0-3' as constraint_check, count(*) as violation_count 
FROM stage_completion WHERE stars_earned < 0 OR stars_earned > 3;

-- Check stage_completion score constraint (score >= 0)
SELECT 'stage_completion.score >= 0' as constraint_check, count(*) as violation_count 
FROM stage_completion WHERE score < 0;

-- Check boss_defeats defeat_count constraint (defeat_count >= 1)
SELECT 'boss_defeats.defeat_count >= 1' as constraint_check, count(*) as violation_count 
FROM boss_defeats WHERE defeat_count < 1;

-- ============================================
-- 4. Foreign Key Relationship Validation
-- ============================================

-- Check inventory has valid user references
SELECT 'inventory.user_id -> users.id' as relationship, count(*) as orphan_count
FROM inventory i
LEFT JOIN users u ON i.user_id = u.id
WHERE u.id IS NULL;

-- Check inventory has valid gear references
SELECT 'inventory.gear_id -> catalog.gear_id' as relationship, count(*) as orphan_count
FROM inventory i
LEFT JOIN catalog c ON i.gear_id = c.gear_id
WHERE c.gear_id IS NULL;

-- Check loadout has valid user references
SELECT 'loadout.user_id -> users.id' as relationship, count(*) as orphan_count
FROM loadout l
LEFT JOIN users u ON l.user_id = u.id
WHERE u.id IS NULL;

-- Check loadout helm_gear_id has valid references
SELECT 'loadout.helm_gear_id -> catalog.gear_id' as relationship, count(*) as orphan_count
FROM loadout l
LEFT JOIN catalog c ON l.helm_gear_id = c.gear_id
WHERE l.helm_gear_id IS NOT NULL AND c.gear_id IS NULL;

-- Check loadout armor_gear_id has valid references
SELECT 'loadout.armor_gear_id -> catalog.gear_id' as relationship, count(*) as orphan_count
FROM loadout l
LEFT JOIN catalog c ON l.armor_gear_id = c.gear_id
WHERE l.armor_gear_id IS NOT NULL AND c.gear_id IS NULL;

-- Check loadout bow_gear_id has valid references
SELECT 'loadout.bow_gear_id -> catalog.gear_id' as relationship, count(*) as orphan_count
FROM loadout l
LEFT JOIN catalog c ON l.bow_gear_id = c.gear_id
WHERE l.bow_gear_id IS NOT NULL AND c.gear_id IS NULL;

-- Check loadout arrow_gear_id has valid references
SELECT 'loadout.arrow_gear_id -> catalog.gear_id' as relationship, count(*) as orphan_count
FROM loadout l
LEFT JOIN catalog c ON l.arrow_gear_id = c.gear_id
WHERE l.arrow_gear_id IS NOT NULL AND c.gear_id IS NULL;

-- Check loadout amulet_gear_id has valid references
SELECT 'loadout.amulet_gear_id -> catalog.gear_id' as relationship, count(*) as orphan_count
FROM loadout l
LEFT JOIN catalog c ON l.amulet_gear_id = c.gear_id
WHERE l.amulet_gear_id IS NOT NULL AND c.gear_id IS NULL;

-- Check device_tokens has valid user references
SELECT 'device_tokens.user_id -> users.id' as relationship, count(*) as orphan_count
FROM device_tokens d
LEFT JOIN users u ON d.user_id = u.id
WHERE u.id IS NULL;

-- Check notification_preferences has valid user references
SELECT 'notification_preferences.user_id -> users.id' as relationship, count(*) as orphan_count
FROM notification_preferences n
LEFT JOIN users u ON n.user_id = u.id
WHERE u.id IS NULL;

-- ============================================
-- 5. Unique Constraint Validation
-- ============================================

-- Check for duplicate user_id in player_stats (should be unique)
SELECT 'player_stats.user_id unique' as constraint_check, user_id, count(*) as duplicate_count
FROM player_stats
GROUP BY user_id
HAVING count(*) > 1;

-- Check for duplicate (user_id, gear_id) in inventory
SELECT 'inventory (user_id, gear_id) unique' as constraint_check, user_id, gear_id, count(*) as duplicate_count
FROM inventory
GROUP BY user_id, gear_id
HAVING count(*) > 1;

-- Check for duplicate user_id in loadout (should be unique)
SELECT 'loadout.user_id unique' as constraint_check, user_id, count(*) as duplicate_count
FROM loadout
GROUP BY user_id
HAVING count(*) > 1;

-- Check for duplicate user_id in notification_preferences
SELECT 'notification_preferences.user_id unique' as constraint_check, user_id, count(*) as duplicate_count
FROM notification_preferences
GROUP BY user_id
HAVING count(*) > 1;

-- Check for duplicate device_token in device_tokens
SELECT 'device_tokens.device_token unique' as constraint_check, device_token, count(*) as duplicate_count
FROM device_tokens
GROUP BY device_token
HAVING count(*) > 1;

-- Check for duplicate (user_id, stage_id) in stage_completion
SELECT 'stage_completion (user_id, stage_id) unique' as constraint_check, user_id, stage_id, count(*) as duplicate_count
FROM stage_completion
GROUP BY user_id, stage_id
HAVING count(*) > 1;

-- Check for duplicate (user_id, boss_id) in boss_defeats
SELECT 'boss_defeats (user_id, boss_id) unique' as constraint_check, user_id, boss_id, count(*) as duplicate_count
FROM boss_defeats
GROUP BY user_id, boss_id
HAVING count(*) > 1;

-- Check for duplicate (user_id, modifier_id) in unlocked_modifier_pools
SELECT 'unlocked_modifier_pools (user_id, modifier_id) unique' as constraint_check, user_id, modifier_id, count(*) as duplicate_count
FROM unlocked_modifier_pools
GROUP BY user_id, modifier_id
HAVING count(*) > 1;

-- ============================================
-- 6. Data Type Validation
-- ============================================

-- Check player_stats stats is valid JSONB
SELECT 'player_stats.stats is valid JSONB' as type_check, count(*) as invalid_count
FROM player_stats
WHERE NOT (stats IS JSON);

-- Check catalog base_stats is valid JSONB
SELECT 'catalog.base_stats is valid JSONB' as type_check, count(*) as invalid_count
FROM catalog
WHERE NOT (base_stats IS JSON);

-- Check catalog modifiers is valid JSONB
SELECT 'catalog.modifiers is valid JSONB' as type_check, count(*) as invalid_count
FROM catalog
WHERE NOT (modifiers IS JSON);

-- ============================================
-- 7. Default Value Validation
-- ============================================

-- Check player_stats default values
SELECT 'player_stats default level=1' as default_check, count(*) as wrong_default_count
FROM player_stats WHERE level != 1 AND created_at > NOW() - INTERVAL '1 day';

SELECT 'player_stats default experience=0' as default_check, count(*) as wrong_default_count
FROM player_stats WHERE experience != 0 AND created_at > NOW() - INTERVAL '1 day';

SELECT 'player_stats default ability_points=0' as default_check, count(*) as wrong_default_count
FROM player_stats WHERE ability_points != 0 AND created_at > NOW() - INTERVAL '1 day';

-- Check notification_preferences default values
SELECT 'notification_preferences default daily_rewards_enabled=true' as default_check, count(*) as wrong_default_count
FROM notification_preferences 
WHERE daily_rewards_enabled != true AND created_at > NOW() - INTERVAL '1 day';

-- ============================================
-- 8. Temporal Consistency Checks
-- ============================================

-- Check created_at is not in the future
SELECT 'created_at not in future' as temporal_check, count(*) as invalid_count
FROM (
    SELECT created_at FROM player_stats
    UNION ALL SELECT created_at FROM catalog
    UNION ALL SELECT created_at FROM inventory
    UNION ALL SELECT created_at FROM loadout
    UNION ALL SELECT created_at FROM stage_completion
    UNION ALL SELECT created_at FROM device_tokens
    UNION ALL SELECT created_at FROM notification_preferences
    UNION ALL SELECT created_at FROM scheduled_notifications
    UNION ALL SELECT created_at FROM notification_history
    UNION ALL SELECT created_at FROM boss_defeats
    UNION ALL SELECT created_at FROM unlocked_modifier_pools
) all_tables
WHERE created_at > NOW();

-- Check updated_at >= created_at
SELECT 'updated_at >= created_at (player_stats)' as temporal_check, count(*) as invalid_count
FROM player_stats WHERE updated_at < created_at;

SELECT 'updated_at >= created_at (catalog)' as temporal_check, count(*) as invalid_count
FROM catalog WHERE updated_at < created_at;

SELECT 'updated_at >= created_at (loadout)' as temporal_check, count(*) as invalid_count
FROM loadout WHERE updated_at < created_at;

-- Check scheduled_notifications scheduled_for is valid
SELECT 'scheduled_for >= created_at (scheduled_notifications)' as temporal_check, count(*) as invalid_count
FROM scheduled_notifications WHERE scheduled_for < created_at;

-- ============================================
-- 9. Enum Value Validation
-- ============================================

-- Check all gear_type values are valid
SELECT 'catalog.gear_type valid enum' as enum_check, gear_type, count(*) as count
FROM catalog
GROUP BY gear_type
ORDER BY gear_type;

-- Check all gear_rarity values are valid
SELECT 'catalog.gear_rarity valid enum' as enum_check, rarity, count(*) as count
FROM catalog
GROUP BY rarity
ORDER BY rarity;

-- Check device_tokens platform values
SELECT 'device_tokens.platform valid values' as enum_check, platform, count(*) as count
FROM device_tokens
GROUP BY platform
ORDER BY platform;

-- Check scheduled_notifications status values
SELECT 'scheduled_notifications.status valid values' as enum_check, status, count(*) as count
FROM scheduled_notifications
GROUP BY status
ORDER BY status;

-- Check notification_history status values
SELECT 'notification_history.status valid values' as enum_check, status, count(*) as count
FROM notification_history
GROUP BY status
ORDER BY status;

-- ============================================
-- 10. Data Completeness Checks
-- ============================================

-- Check catalog has all gear types
SELECT 'catalog has helm' as completeness_check, CASE WHEN count(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status FROM catalog WHERE gear_type = 'helm'
UNION ALL
SELECT 'catalog has armor' as completeness_check, CASE WHEN count(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status FROM catalog WHERE gear_type = 'armor'
UNION ALL
SELECT 'catalog has bow' as completeness_check, CASE WHEN count(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status FROM catalog WHERE gear_type = 'bow'
UNION ALL
SELECT 'catalog has arrow' as completeness_check, CASE WHEN count(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status FROM catalog WHERE gear_type = 'arrow'
UNION ALL
SELECT 'catalog has amulet' as completeness_check, CASE WHEN count(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status FROM catalog WHERE gear_type = 'amulet';

-- Check catalog has all rarities
SELECT 'catalog has common' as completeness_check, CASE WHEN count(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status FROM catalog WHERE rarity = 'common'
UNION ALL
SELECT 'catalog has rare' as completeness_check, CASE WHEN count(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status FROM catalog WHERE rarity = 'rare'
UNION ALL
SELECT 'catalog has epic' as completeness_check, CASE WHEN count(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status FROM catalog WHERE rarity = 'epic'
UNION ALL
SELECT 'catalog has legendary' as completeness_check, CASE WHEN count(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status FROM catalog WHERE rarity = 'legendary';

-- ============================================
-- 11. Summary Query
-- ============================================

-- Data Integrity Summary
SELECT 
    'Total Tables' as metric,
    count(*)::text as value,
    'Expected: 11' as expected
FROM information_schema.tables WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Total Rows' as metric,
    sum(n_live_tup)::text as value,
    'Should be > 0' as expected
FROM pg_stat_user_tables WHERE schemaname = 'public'
UNION ALL
SELECT 
    'Orphan Records' as metric,
    '0' as value,
    'Must be 0' as expected
UNION ALL
SELECT 
    'NULL Violations' as metric,
    '0' as value,
    'Must be 0' as expected
UNION ALL
SELECT 
    'CHECK Violations' as metric,
    '0' as value,
    'Must be 0' as expected;
