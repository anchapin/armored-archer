"use strict";
/**
 * RPG System module.
 * @fileoverview Handles XP gains and stat allocation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRpcGainXP = registerRpcGainXP;
exports.rpcGainXP = rpcGainXP;
exports.registerRpcAllocateStats = registerRpcAllocateStats;
exports.rpcAllocateStats = rpcAllocateStats;
exports.registerRpcGetPlayerStats = registerRpcGetPlayerStats;
exports.rpcGetPlayerStats = rpcGetPlayerStats;
exports.calculateLevel = calculateLevel;
var cache_1 = require("../utils/cache");
var db_optimizer_1 = require("../utils/db_optimizer");
var player_data_helpers_1 = require("../utils/player-data-helpers");
var safeParse_1 = require("../utils/safeParse");
var audit_1 = require("./audit");
var metrics_1 = require("./metrics");
var validation_1 = require("./validation");
/**
 * Helper function to save player stats to storage and invalidate cache.
 */
function savePlayerStats(nk, ctx, logger, playerStats, action) {
    var _a;
    nk.storageWrite([
        {
            collection: 'player_stats',
            key: ctx.userId,
            userId: ctx.userId,
            value: JSON.stringify(playerStats),
        },
    ]);
    (0, db_optimizer_1.invalidatePlayerStatsCache)(ctx.userId, logger);
    (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, action, 'player_stats', playerStats, 'success');
}
/**
 * Registers the gain XP RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGainXP(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/gain_xp', 'gain_xp', rpcGainXP);
}
/**
 * Handles XP gain requests and level progression.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing xp_amount and source
 * @returns JSON string with success status and updated player stats
 *
 * @example
 * // Request payload
 * { "xp_amount": 100, "source": "pve" }
 *
 * // Response
 * {
 *   "success": true,
 *   "player_stats": { ... },
 *   "xp_gained": 100,
 *   "levels_gained": 1
 * }
 */
function rpcGainXP(ctx, logger, nk, payload) {
    var _a, _b;
    logger.info('Gain XP called for user: %s', ctx.userId);
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.gain_xp, payload, 'gain_xp');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'gain_xp', 'player_stats', { xp_amount: 'unknown' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('gain_xp', validation.error);
    }
    var request = validation.data;
    var objects = nk.storageRead([
        {
            collection: 'player_stats',
            key: ctx.userId,
            userId: ctx.userId,
        },
    ]);
    var playerStats;
    if (objects.length === 0) {
        playerStats = {
            user_id: ctx.userId,
            level: 1,
            xp: 0,
            ability_points: 0,
            stats: {
                attack: 10,
                defense: 10,
                dodge: 10,
                crit_rate: 5,
            },
        };
    }
    else {
        var value = objects[0].value;
        if (value) {
            var parseResult = (0, safeParse_1.safeParse)(value, null, logger, 'storage_data');
            if (!parseResult.success || !parseResult.data) {
                logger.error('Failed to parse data');
                (0, audit_1.logAudit)(nk, ctx.userId, (_b = ctx.ipAddress) !== null && _b !== void 0 ? _b : null, 'gain_xp', 'player_stats', { xp_amount: request.xp_amount }, 'failure', 'Failed to parse player stats');
                return (0, safeParse_1.createErrorResponse)('INVALID_DATA', 'Failed to parse data');
            }
            playerStats = parseResult.data;
        }
        else {
            playerStats = {
                user_id: ctx.userId,
                level: 1,
                xp: 0,
                ability_points: 0,
                stats: {
                    attack: 10,
                    defense: 10,
                    dodge: 10,
                    crit_rate: 5,
                },
            };
        }
    }
    var oldLevel = playerStats.level;
    playerStats.xp += request.xp_amount;
    var newLevel = calculateLevel(playerStats.xp);
    playerStats.level = newLevel;
    if (newLevel > oldLevel) {
        var levelsGained = newLevel - oldLevel;
        playerStats.ability_points += levelsGained;
        logger.info('User %s leveled up from %d to %d, gained %d ability points', ctx.userId, oldLevel, newLevel, levelsGained);
    }
    savePlayerStats(nk, ctx, logger, playerStats, 'gain_xp');
    return JSON.stringify({
        success: true,
        player_stats: playerStats,
        xp_gained: request.xp_amount,
        levels_gained: Math.max(0, newLevel - oldLevel),
    });
}
/**
 * Registers the stat allocation RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcAllocateStats(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/allocate_stats', 'allocate_stats', rpcAllocateStats);
}
/**
 * Handles stat allocation requests for ability points.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing stat_name and points
 * @returns JSON string with success status and updated player stats
 *
 * @example
 * // Request payload
 * { "stat_name": "attack", "points": 5 }
 *
 * // Response
 * {
 *   "success": true,
 *   "player_stats": { ... }
 * }
 */
function rpcAllocateStats(ctx, logger, nk, payload) {
    var _a, _b, _c, _d, _e;
    logger.info('Allocate stats called for user: %s', ctx.userId);
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.allocate_stats, payload, 'allocate_stats');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'allocate_stats', 'player_stats', { stat_name: 'unknown', points: 0 }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('allocate_stats', validation.error);
    }
    var request = validation.data;
    var objects = nk.storageRead([
        {
            collection: 'player_stats',
            key: ctx.userId,
            userId: ctx.userId,
        },
    ]);
    if (objects.length === 0) {
        (0, audit_1.logAudit)(nk, ctx.userId, (_b = ctx.ipAddress) !== null && _b !== void 0 ? _b : null, 'allocate_stats', 'player_stats', { stat_name: request.stat_name, points: request.points }, 'failure', 'Player stats not found');
        return JSON.stringify({
            error: 'Player stats not found',
        });
    }
    var parseResult = (0, safeParse_1.safeParse)((_c = objects[0].value) !== null && _c !== void 0 ? _c : '{}', null, logger, 'player_stats');
    if (!parseResult.success || !parseResult.data) {
        logger.error('Failed to parse player stats for user: %s', ctx.userId);
        (0, audit_1.logAudit)(nk, ctx.userId, (_d = ctx.ipAddress) !== null && _d !== void 0 ? _d : null, 'allocate_stats', 'player_stats', { stat_name: request.stat_name, points: request.points }, 'failure', 'Failed to parse player stats');
        return (0, safeParse_1.createErrorResponse)('INVALID_DATA', 'Failed to parse player stats');
    }
    var playerStats = parseResult.data;
    if (playerStats.ability_points < request.points) {
        (0, audit_1.logAudit)(nk, ctx.userId, (_e = ctx.ipAddress) !== null && _e !== void 0 ? _e : null, 'allocate_stats', 'player_stats', {
            stat_name: request.stat_name,
            points: request.points,
            available_points: playerStats.ability_points,
        }, 'failure', 'Not enough ability points');
        return JSON.stringify({
            error: 'Not enough ability points',
        });
    }
    playerStats.ability_points -= request.points;
    playerStats.stats[request.stat_name] += request.points;
    savePlayerStats(nk, ctx, logger, playerStats, 'allocate_stats');
    return JSON.stringify({
        success: true,
        player_stats: playerStats,
    });
}
/**
 * Registers the get player stats RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetPlayerStats(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/get_player_stats', 'get_player_stats', rpcGetPlayerStats);
}
/**
 * Retrieves player statistics with caching.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with player stats or error
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "level": 5,
 *   "xp": 450,
 *   "stats": { ... }
 * }
 */
function rpcGetPlayerStats(ctx, logger, nk, payload) {
    logger.info('Get player stats called for user: %s', ctx.userId);
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_player_stats, payload, 'get_player_stats');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('get_player_stats', validation.error);
    }
    var cache = (0, cache_1.getCacheManager)(logger);
    return (0, player_data_helpers_1.getPlayerStatsWithCache)(nk, logger, ctx, cache);
}
/**
 * Calculates player level based on experience points.
 *
 * @param xp - Experience points to calculate level for
 * @returns Calculated player level
 *
 * @example
 * calculateLevel(450); // returns 5
 */
function calculateLevel(xp) {
    var baseXP = 100;
    var growthFactor = 1.5;
    var level = 1;
    var xpForNextLevel = baseXP;
    while (xp >= xpForNextLevel) {
        xp -= xpForNextLevel;
        level++;
        xpForNextLevel = Math.floor(xpForNextLevel * growthFactor);
    }
    return level;
}
