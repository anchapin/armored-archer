// Minimal Nakama bundle - RPC handlers only
var InitModule = function(ctx, logger, nk, initializer) {
    logger.info('Initializing minimal RPC handlers');
    
    // Health check RPC
    initializer.registerRpc('armored_archer/health_check', function(ctx, logger, nk, payload) {
        return JSON.stringify({ status: 'ok', timestamp: Date.now() });
    });
    
    // Player stats RPC
    initializer.registerRpc('armored_archer/get_player_stats', function(ctx, logger, nk, payload) {
        // Return mock player stats
        return JSON.stringify({
            level: 1,
            xp: 0,
            hp: 100,
            attack: 10,
            defense: 5,
            ability_points: 0
        });
    });
    
    // Gain XP RPC
    initializer.registerRpc('armored_archer/gain_xp', function(ctx, logger, nk, payload) {
        var input = payload ? JSON.parse(payload) : {};
        var xpGain = input.xp || 10;
        return JSON.stringify({
            success: true,
            xp_gained: xpGain,
            new_level: 1
        });
    });
    
    // Allocate stats RPC
    initializer.registerRpc('armored_archer/allocate_stats', function(ctx, logger, nk, payload) {
        return JSON.stringify({ success: true });
    });
    
    // Submit combat action RPC
    initializer.registerRpc('armored_archer/submit_combat_action', function(ctx, logger, nk, payload) {
        return JSON.stringify({ success: true, damage: 10 });
    });
    
    // Get match state RPC
    initializer.registerRpc('armored_archer/get_match_state', function(ctx, logger, nk, payload) {
        return JSON.stringify({ state: 'waiting' });
    });
    
    // Create match RPC
    initializer.registerRpc('armored_archer/create_match', function(ctx, logger, nk, payload) {
        return JSON.stringify({ match_id: 'test-match-123' });
    });
    
    // Accept match RPC
    initializer.registerRpc('armored_archer/accept_match', function(ctx, logger, nk, payload) {
        return JSON.stringify({ success: true });
    });
    
    // Get leaderboard RPC
    initializer.registerRpc('armored_archer/get_leaderboard', function(ctx, logger, nk, payload) {
        return JSON.stringify({ entries: [] });
    });
    
    // Validate purchase RPC
    initializer.registerRpc('armored_archer/validate_purchase', function(ctx, logger, nk, payload) {
        return JSON.stringify({ valid: true });
    });
    
    // Spend gems RPC
    initializer.registerRpc('armored_archer/spend_gems', function(ctx, logger, nk, payload) {
        return JSON.stringify({ success: true, gems_spent: 0, gems_remaining: 100 });
    });
    
    // Generate gear RPC
    initializer.registerRpc('armored_archer/generate_gear', function(ctx, logger, nk, payload) {
        return JSON.stringify({ 
            gear_id: 'gear-1',
            name: 'Basic Bow',
            rarity: 'common',
            stats: { attack: 5 }
        });
    });
    
    // Equip gear RPC
    initializer.registerRpc('armored_archer/equip_gear', function(ctx, logger, nk, payload) {
        return JSON.stringify({ success: true });
    });
    
    // Stage complete RPC
    initializer.registerRpc('armored_archer/stage_complete', function(ctx, logger, nk, payload) {
        return JSON.stringify({ success: true, stars: 3 });
    });
    
    // Complete stage RPC
    initializer.registerRpc('armored_archer/complete_stage', function(ctx, logger, nk, payload) {
        return JSON.stringify({ success: true });
    });
    
    logger.info('Minimal RPC handlers registered successfully');
    return;
};

module.exports = InitModule;
