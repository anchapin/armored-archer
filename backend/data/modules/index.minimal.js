// Minimal Nakama bundle - RPC handlers only
// Define handlers as named functions first (required by Nakama)

function healthCheck(ctx, logger, nk, payload) {
    return JSON.stringify({ status: 'ok', timestamp: Date.now() });
}

function getPlayerStats(ctx, logger, nk, payload) {
    return JSON.stringify({
        level: 1,
        xp: 0,
        hp: 100,
        attack: 10,
        defense: 5,
        ability_points: 0
    });
}

function gainXp(ctx, logger, nk, payload) {
    var input = payload ? JSON.parse(payload) : {};
    var xpGain = input.xp || 10;
    return JSON.stringify({
        success: true,
        xp_gained: xpGain,
        new_level: 1
    });
}

function allocateStats(ctx, logger, nk, payload) {
    return JSON.stringify({ success: true });
}

function submitCombatAction(ctx, logger, nk, payload) {
    return JSON.stringify({ success: true, damage: 10 });
}

function getMatchState(ctx, logger, nk, payload) {
    return JSON.stringify({ state: 'waiting' });
}

function createMatch(ctx, logger, nk, payload) {
    return JSON.stringify({ match_id: 'test-match-123' });
}

function acceptMatch(ctx, logger, nk, payload) {
    return JSON.stringify({ success: true });
}

function getLeaderboard(ctx, logger, nk, payload) {
    return JSON.stringify({ entries: [] });
}

function validatePurchase(ctx, logger, nk, payload) {
    return JSON.stringify({ valid: true });
}

function spendGems(ctx, logger, nk, payload) {
    return JSON.stringify({ success: true, gems_spent: 0, gems_remaining: 100 });
}

function generateGear(ctx, logger, nk, payload) {
    return JSON.stringify({
        gear_id: 'gear-1',
        name: 'Basic Bow',
        rarity: 'common',
        stats: { attack: 5 }
    });
}

function equipGear(ctx, logger, nk, payload) {
    return JSON.stringify({ success: true });
}

function stageComplete(ctx, logger, nk, payload) {
    return JSON.stringify({ success: true, stars: 3 });
}

function completeStage(ctx, logger, nk, payload) {
    return JSON.stringify({ success: true });
}

function listMatches(ctx, logger, nk, payload) {
    return JSON.stringify({ matches: [] });
}

function getPlayerRank(ctx, logger, nk, payload) {
    return JSON.stringify({ rank: 0, rating: 1000 });
}

function completeMatch(ctx, logger, nk, payload) {
    return JSON.stringify({ success: true });
}

// InitModule - register all RPCs
function InitModule(ctx, logger, nk, initializer) {
    logger.info('Initializing minimal RPC handlers');
    
    initializer.registerRpc('armored_archer/health_check', healthCheck);
    initializer.registerRpc('armored_archer/get_player_stats', getPlayerStats);
    initializer.registerRpc('armored_archer/gain_xp', gainXp);
    initializer.registerRpc('armored_archer/allocate_stats', allocateStats);
    initializer.registerRpc('armored_archer/submit_combat_action', submitCombatAction);
    initializer.registerRpc('armored_archer/get_match_state', getMatchState);
    initializer.registerRpc('armored_archer/create_match', createMatch);
    initializer.registerRpc('armored_archer/accept_match', acceptMatch);
    initializer.registerRpc('armored_archer/get_leaderboard', getLeaderboard);
    initializer.registerRpc('armored_archer/validate_purchase', validatePurchase);
    initializer.registerRpc('armored_archer/spend_gems', spendGems);
    initializer.registerRpc('armored_archer/generate_gear', generateGear);
    initializer.registerRpc('armored_archer/equip_gear', equipGear);
    initializer.registerRpc('armored_archer/stage_complete', stageComplete);
    initializer.registerRpc('armored_archer/complete_stage', completeStage);
    initializer.registerRpc('armored_archer/list_matches', listMatches);
    initializer.registerRpc('armored_archer/get_player_rank', getPlayerRank);
    initializer.registerRpc('armored_archer/complete_match', completeMatch);
    
    logger.info('Minimal RPC handlers registered successfully');
}
