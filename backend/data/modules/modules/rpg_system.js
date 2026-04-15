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
exports.registerRpcRespecStats = registerRpcRespecStats;
exports.rpcRespecStats = rpcRespecStats;
exports.registerRpcSaveBuild = registerRpcSaveBuild;
exports.registerRpcLoadBuild = registerRpcLoadBuild;
exports.registerRpcGetBuilds = registerRpcGetBuilds;
exports.rpcSaveBuild = rpcSaveBuild;
exports.rpcLoadBuild = rpcLoadBuild;
exports.rpcGetBuilds = rpcGetBuilds;
const valibot_1 = require("valibot");
const cache_1 = require("../utils/cache");
const db_optimizer_1 = require("../utils/db_optimizer");
const player_data_helpers_1 = require("../utils/player-data-helpers");
const safeParse_1 = require("../utils/safeParse");
const audit_1 = require("./audit");
const metrics_1 = require("./metrics");
const validation_1 = require("./validation");
/**
 * Helper function to save player stats to storage and invalidate cache.
 */
function savePlayerStats(nk, ctx, logger, playerStats, action) {
    nk.storageWrite([
        {
            collection: 'player_stats',
            key: ctx.userId,
            userId: ctx.userId,
            value: JSON.stringify(playerStats),
        },
    ]);
    (0, db_optimizer_1.invalidatePlayerStatsCache)(ctx.userId, logger);
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, action, 'player_stats', playerStats, 'success');
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
    logger.info('Gain XP called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.gain_xp, payload, 'gain_xp');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'gain_xp', 'player_stats', { xp_amount: 'unknown' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('gain_xp', validation.error);
    }
    const request = validation.data;
    const objects = nk.storageRead([
        {
            collection: 'player_stats',
            key: ctx.userId,
            userId: ctx.userId,
        },
    ]);
    let playerStats;
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
        const value = objects[0].value;
        if (value) {
            const parseResult = (0, safeParse_1.safeParse)(value, null, logger, 'storage_data');
            if (!parseResult.success || !parseResult.data) {
                logger.error('Failed to parse data');
                (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'gain_xp', 'player_stats', { xp_amount: request.xp_amount }, 'failure', 'Failed to parse player stats');
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
    const oldLevel = playerStats.level;
    playerStats.xp += request.xp_amount;
    const newLevel = calculateLevel(playerStats.xp);
    playerStats.level = newLevel;
    if (newLevel > oldLevel) {
        const levelsGained = newLevel - oldLevel;
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
    logger.info('Allocate stats called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.allocate_stats, payload, 'allocate_stats');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'allocate_stats', 'player_stats', { stat_name: 'unknown', points: 0 }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('allocate_stats', validation.error);
    }
    const request = validation.data;
    const objects = nk.storageRead([
        {
            collection: 'player_stats',
            key: ctx.userId,
            userId: ctx.userId,
        },
    ]);
    if (objects.length === 0) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'allocate_stats', 'player_stats', { stat_name: request.stat_name, points: request.points }, 'failure', 'Player stats not found');
        return JSON.stringify({
            error: 'Player stats not found',
        });
    }
    const parseResult = (0, safeParse_1.safeParse)(objects[0].value ?? '{}', null, logger, 'player_stats');
    if (!parseResult.success || !parseResult.data) {
        logger.error('Failed to parse player stats for user: %s', ctx.userId);
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'allocate_stats', 'player_stats', { stat_name: request.stat_name, points: request.points }, 'failure', 'Failed to parse player stats');
        return (0, safeParse_1.createErrorResponse)('INVALID_DATA', 'Failed to parse player stats');
    }
    const playerStats = parseResult.data;
    if (playerStats.ability_points < request.points) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'allocate_stats', 'player_stats', {
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
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_player_stats, payload, 'get_player_stats');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('get_player_stats', validation.error);
    }
    const cache = (0, cache_1.getCacheManager)(logger);
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
    const baseXP = 100;
    const growthFactor = 1.5;
    let level = 1;
    let xpForNextLevel = baseXP;
    while (xp >= xpForNextLevel) {
        xp -= xpForNextLevel;
        level++;
        xpForNextLevel = Math.floor(xpForNextLevel * growthFactor);
    }
    return level;
}
// --- Respec System ---
const RESPEC_COST_PERCENT = 0.05; // 5% of current gems
const RESPEC_MIN_COST = 100; // Minimum gem cost
const RESPEC_MAX_COST = 1000; // Maximum gem cost
const RESPEC_COOLDOWN_SECONDS = 86400; // 24 hours
const FREE_RESPEC_PER_SEASON = 1;
/**
 * Registers the respec stats RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcRespecStats(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/respec_stats', 'respec_stats', rpcRespecStats);
}
/**
 * Validates respec request data and loads required data.
 */
function validateRespecRequest(nk, ctx, payload) {
    // Validate payload
    const validation = (0, validation_1.validatePayload)({
        new_allocation: {
            attack: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            defense: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            dodge: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            crit_rate: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
        },
        use_free_respec: (0, valibot_1.optional)((0, valibot_1.boolean)()),
    }, payload, 'respec_stats');
    if (!validation.success) {
        return {
            error: {
                message: validation.error,
                auditDetails: {},
            },
        };
    }
    const request = validation.data;
    // Load player stats
    const playerStatsResult = loadPlayerStats(nk, ctx.userId);
    if (!playerStatsResult.success || !playerStatsResult.data) {
        return {
            error: {
                message: playerStatsResult.error || 'Failed to load player stats',
                auditDetails: {},
            },
        };
    }
    const playerStats = playerStatsResult.data;
    // Validate allocation matches available points
    const allocationValidation = validateStatAllocation(playerStats, request.new_allocation);
    if (!allocationValidation.valid) {
        return {
            error: {
                message: allocationValidation.error || 'Invalid allocation',
                auditDetails: {},
            },
        };
    }
    // Load and validate respec data
    const respecDataResult = loadRespecData(nk, ctx.userId);
    const defaultRespecData = {
        last_respec_time: 0,
        free_respecs_used: 0,
        current_season_id: '',
    };
    const respecData = respecDataResult.success
        ? respecDataResult.data
        : defaultRespecData;
    const cooldownCheck = checkRespecCooldown(respecData, request.use_free_respec || false);
    if (cooldownCheck.onCooldown) {
        return {
            error: {
                message: `Respec is on cooldown (${cooldownCheck.cooldownRemaining}s remaining)`,
                auditDetails: { cooldown_remaining: cooldownCheck.cooldownRemaining },
            },
        };
    }
    return {
        data: {
            playerStats,
            respecData,
            request,
        },
    };
}
/**
 * Handles stat respec requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing new_allocation and use_free_respec
 * @returns JSON string with success status and updated player stats
 *
 * @example
 * // Request payload
 * { "new_allocation": {"attack": 15, "defense": 12, "dodge": 10, "crit_rate": 8}, "use_free_respec": false }
 *
 * // Response
 * {
 *   "success": true,
 *   "player_stats": { ... },
 *   "cost_paid": 150
 * }
 */
function rpcRespecStats(ctx, logger, nk, payload) {
    logger.info('Respec stats called for user: %s', ctx.userId);
    const validation = validateRespecRequest(nk, ctx, payload);
    if (validation.error) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'respec_stats', 'player_stats', validation.error.auditDetails, 'failure', validation.error.message);
        return JSON.stringify({
            error: validation.error.message,
        });
    }
    const { playerStats, respecData, request } = validation.data;
    // Determine if free respec can be used
    const useFreeRespec = canUseFreeRespec(respecData, request.use_free_respec || false);
    // Calculate and validate cost
    const costResult = calculateAndValidateCost(playerStats, useFreeRespec);
    if (costResult.error) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'respec_stats', 'player_stats', { cost: costResult.costPaid }, 'failure', costResult.error);
        return JSON.stringify({
            error: costResult.error,
            cost: costResult.costPaid,
        });
    }
    // Deduct gems if not using free respec
    if (!useFreeRespec) {
        nk.walletUpdate(ctx.userId, {
            gem: -costResult.costPaid,
        });
    }
    // Apply new allocation
    playerStats.stats = {
        attack: request.new_allocation.attack,
        defense: request.new_allocation.defense,
        dodge: request.new_allocation.dodge,
        crit_rate: request.new_allocation.crit_rate,
    };
    // Update respec data
    const currentTime = Math.floor(Date.now() / 1000);
    respecData.last_respec_time = currentTime;
    if (useFreeRespec) {
        respecData.free_respecs_used++;
    }
    saveRespecData(nk, ctx.userId, respecData);
    // Save player stats
    savePlayerStats(nk, ctx, logger, playerStats, 'respec_stats');
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'respec_stats', 'player_stats', { cost_paid: costResult.costPaid, used_free_respec: useFreeRespec }, 'success');
    return JSON.stringify({
        success: true,
        player_stats: playerStats,
        cost_paid: costResult.costPaid,
        used_free_respec: useFreeRespec,
    });
}
// --- Build Save/Load System ---
const MAX_BUILD_SLOTS = 3;
/**
 * Registers the save build RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcSaveBuild(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/save_build', 'save_build', rpcSaveBuild);
}
/**
 * Registers the load build RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcLoadBuild(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/load_build', 'load_build', rpcLoadBuild);
}
/**
 * Registers the get builds RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetBuilds(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/get_builds', 'get_builds', rpcGetBuilds);
}
/**
 * Handles build save requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing build data
 * @returns JSON string with success status
 */
function rpcSaveBuild(ctx, logger, nk, payload) {
    logger.info('Save build called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)({
        build_slot: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1), (0, valibot_1.maxValue)(MAX_BUILD_SLOTS)),
        build_name: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(50)),
        stats: {
            attack: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            defense: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            dodge: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
            crit_rate: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(0)),
        },
        level: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1)),
    }, payload, 'save_build');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('save_build', validation.error);
    }
    const request = validation.data;
    const buildData = {
        name: request.build_name,
        stats: request.stats,
        level: request.level,
        timestamp: Math.floor(Date.now() / 1000),
    };
    nk.storageWrite([
        {
            collection: 'player_builds',
            key: `${ctx.userId}_slot_${request.build_slot}`,
            userId: ctx.userId,
            value: JSON.stringify(buildData),
        },
    ]);
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'save_build', 'player_builds', { build_slot: request.build_slot, build_name: request.build_name }, 'success');
    return JSON.stringify({
        success: true,
        build_data: buildData,
    });
}
/**
 * Handles build load requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing build_slot
 * @returns JSON string with build data
 */
function rpcLoadBuild(ctx, logger, nk, payload) {
    logger.info('Load build called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)({
        build_slot: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.integer)(), (0, valibot_1.minValue)(1), (0, valibot_1.maxValue)(MAX_BUILD_SLOTS)),
    }, payload, 'load_build');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('load_build', validation.error);
    }
    const request = validation.data;
    const objects = nk.storageRead([
        {
            collection: 'player_builds',
            key: `${ctx.userId}_slot_${request.build_slot}`,
            userId: ctx.userId,
        },
    ]);
    if (objects.length === 0) {
        return JSON.stringify({
            error: 'Build not found',
        });
    }
    const value = objects[0].value;
    if (!value) {
        return JSON.stringify({
            error: 'Build data corrupted',
        });
    }
    const parseResult = (0, safeParse_1.safeParse)(value, null, logger, 'build_data');
    if (!parseResult.success || !parseResult.data) {
        return JSON.stringify({
            error: 'Failed to parse build data',
        });
    }
    const buildData = parseResult.data;
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'load_build', 'player_builds', { build_slot: request.build_slot, build_name: buildData.name }, 'success');
    return JSON.stringify({
        success: true,
        build_data: buildData,
    });
}
/**
 * Handles get builds requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused)
 * @returns JSON string with all builds
 */
function rpcGetBuilds(ctx, logger, nk, _payload) {
    logger.info('Get builds called for user: %s', ctx.userId);
    const objects = nk.storageRead([
        {
            collection: 'player_builds',
            key: `${ctx.userId}_slot_1`,
            userId: ctx.userId,
        },
        {
            collection: 'player_builds',
            key: `${ctx.userId}_slot_2`,
            userId: ctx.userId,
        },
        {
            collection: 'player_builds',
            key: `${ctx.userId}_slot_3`,
            userId: ctx.userId,
        },
    ]);
    const builds = {};
    objects.forEach((obj) => {
        const key = obj.key;
        const match = key.match(/slot_(\d+)$/);
        if (match) {
            const slot = parseInt(match[1], 10);
            const parseResult = (0, safeParse_1.safeParse)(obj.value || '{}', null, logger, 'build_data');
            if (parseResult.success && parseResult.data) {
                builds[slot] = parseResult.data;
            }
        }
    });
    return JSON.stringify({
        success: true,
        builds: builds,
    });
}
// --- Helper Functions ---
/**
 * Validates that the new stat allocation total matches the current total.
 */
function validateStatAllocation(currentStats, newAllocation) {
    const currentTotalSpent = Object.values(currentStats.stats).reduce((a, b) => a + b, 0);
    const newTotalSpent = Object.values(newAllocation).reduce((a, b) => a + b, 0);
    if (newTotalSpent !== currentTotalSpent) {
        return {
            valid: false,
            error: `Total stat points must match (current: ${currentTotalSpent}, new: ${newTotalSpent})`,
        };
    }
    return { valid: true };
}
/**
 * Checks if respec is on cooldown.
 */
function checkRespecCooldown(respecData, useFreeRespec) {
    const currentTime = Math.floor(Date.now() / 1000);
    const cooldownRemaining = RESPEC_COOLDOWN_SECONDS - (currentTime - (respecData?.last_respec_time || 0));
    if (cooldownRemaining > 0 && !useFreeRespec && respecData) {
        return { onCooldown: true, cooldownRemaining };
    }
    return { onCooldown: false };
}
/**
 * Determines if free respec can be used.
 */
function canUseFreeRespec(respecData, useFreeRespec) {
    if (!useFreeRespec) {
        return false;
    }
    const freeRespecsUsed = respecData?.free_respecs_used || 0;
    return freeRespecsUsed < FREE_RESPEC_PER_SEASON;
}
/**
 * Calculates the respec cost and validates player has enough gems.
 */
function calculateAndValidateCost(playerStats, useFreeRespec) {
    if (useFreeRespec) {
        return { costPaid: 0 };
    }
    // Use gem balance from player stats (already loaded)
    const statsWithGems = playerStats.stats;
    const gemBalance = statsWithGems.gems || 0;
    let costPaid = Math.floor(gemBalance * RESPEC_COST_PERCENT);
    costPaid = Math.max(RESPEC_MIN_COST, Math.min(RESPEC_MAX_COST, costPaid));
    if (gemBalance < costPaid) {
        return {
            costPaid,
            error: `Not enough gems for respec (cost: ${costPaid}, balance: ${gemBalance})`,
        };
    }
    return { costPaid };
}
/**
 * Loads player stats from storage.
 */
function loadPlayerStats(nk, userId) {
    const objects = nk.storageRead([
        {
            collection: 'player_stats',
            key: userId,
            userId: userId,
        },
    ]);
    if (objects.length === 0) {
        return { success: false, error: 'Player stats not found' };
    }
    const value = objects[0].value;
    if (!value) {
        return { success: false, error: 'Player stats data is empty' };
    }
    const parseResult = (0, safeParse_1.safeParse)(value, null, undefined, 'player_stats');
    if (!parseResult.success || !parseResult.data) {
        return { success: false, error: 'Failed to parse player stats' };
    }
    return { success: true, data: parseResult.data };
}
/**
 *
 */
function loadRespecData(nk, userId) {
    const objects = nk.storageRead([
        {
            collection: 'respec_data',
            key: userId,
            userId: userId,
        },
    ]);
    if (objects.length === 0) {
        return {
            success: true,
            data: {
                last_respec_time: 0,
                free_respecs_used: 0,
                current_season_id: '',
            },
        };
    }
    const value = objects[0].value;
    if (!value) {
        return {
            success: true,
            data: {
                last_respec_time: 0,
                free_respecs_used: 0,
                current_season_id: '',
            },
        };
    }
    const parseResult = (0, safeParse_1.safeParse)(value, null, undefined, 'respec_data');
    if (!parseResult.success || !parseResult.data) {
        return {
            success: true,
            data: {
                last_respec_time: 0,
                free_respecs_used: 0,
                current_season_id: '',
            },
        };
    }
    return { success: true, data: parseResult.data };
}
/**
 *
 */
function saveRespecData(nk, userId, respecData) {
    nk.storageWrite([
        {
            collection: 'respec_data',
            key: userId,
            userId: userId,
            value: JSON.stringify(respecData),
        },
    ]);
}
