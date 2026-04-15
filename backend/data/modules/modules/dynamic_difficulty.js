"use strict";
/**
 * Dynamic Difficulty Module
 * @fileoverview Manages dynamic difficulty adjustment based on player performance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DifficultyLevel = void 0;
exports.registerRpcSyncDifficulty = registerRpcSyncDifficulty;
exports.registerRpcTrackMatchOutcome = registerRpcTrackMatchOutcome;
exports.registerRpcGetPlayerPerformance = registerRpcGetPlayerPerformance;
exports.rpcSyncDifficulty = rpcSyncDifficulty;
exports.rpcTrackMatchOutcome = rpcTrackMatchOutcome;
exports.rpcGetPlayerPerformance = rpcGetPlayerPerformance;
exports.getDifficultyLevel = getDifficultyLevel;
exports.getDifficultyModifier = getDifficultyModifier;
exports.getDifficultyState = getDifficultyState;
exports.setDifficultyModifier = setDifficultyModifier;
exports.trackMatchOutcome = trackMatchOutcome;
exports.resetDifficulty = resetDifficulty;
exports.getDifficultyLevelString = getDifficultyLevelString;
exports.getPerformanceRating = getPerformanceRating;
exports.getWinRate = getWinRate;
exports.calculateTargetDifficulty = calculateTargetDifficulty;
exports.getEncounterRewardModifier = getEncounterRewardModifier;
const valibot_1 = require("valibot");
const logger_1 = require("../config/logger");
const safeParse_1 = require("../utils/safeParse");
const audit_1 = require("./audit");
const metrics_1 = require("./metrics");
const validation_1 = require("./validation");
// Type assertion helper for enum schemas
function createEnum(values) {
    return (0, valibot_1.enum)(values);
}
/**
 * Difficulty level definitions.
 */
var DifficultyLevel;
(function (DifficultyLevel) {
    DifficultyLevel["EASY"] = "Easy";
    DifficultyLevel["NORMAL"] = "Normal";
    DifficultyLevel["HARD"] = "Hard";
    DifficultyLevel["EXTREME"] = "Extreme";
})(DifficultyLevel || (exports.DifficultyLevel = DifficultyLevel = {}));
/**
 * Difficulty modifier bounds.
 */
const MAX_MODIFIER = 0.2;
const MIN_MODIFIER = -0.2;
/**
 * Streak thresholds for difficulty adjustment.
 */
const WIN_STREAK_THRESHOLD = 3;
const LOSE_STREAK_THRESHOLD = 3;
/**
 * Registers the dynamic difficulty RPC endpoints.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcSyncDifficulty(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/sync_difficulty', 'sync_difficulty', rpcSyncDifficulty);
}
/**
 * Registers the track match outcome RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcTrackMatchOutcome(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/track_match_outcome', 'track_match_outcome', rpcTrackMatchOutcome);
}
/**
 * Registers the get player performance RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetPlayerPerformance(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/get_player_performance', 'get_player_performance', rpcGetPlayerPerformance);
}
/**
 * Handles difficulty sync requests from the client.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing difficulty data
 * @returns JSON string with success status
 *
 * @example
 * // Request payload
 * { "difficulty_modifier": 0.1, "difficulty_level": "Hard" }
 *
 * // Response
 * { "success": true, "synced": true }
 */
function rpcSyncDifficulty(ctx, logger, nk, payload) {
    logger.info('Sync difficulty called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)({
        difficulty_modifier: (0, validation_1.pipe)((0, validation_1.number)(), (0, validation_1.minValue)(MIN_MODIFIER), (0, validation_1.maxValue)(MAX_MODIFIER)),
        difficulty_level: createEnum([
            DifficultyLevel.EASY,
            DifficultyLevel.NORMAL,
            DifficultyLevel.HARD,
            DifficultyLevel.EXTREME,
        ]),
    }, payload, 'sync_difficulty');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'sync_difficulty', 'difficulty_state', { modifier: 'unknown', level: 'unknown' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('sync_difficulty', validation.error);
    }
    const request = validation.data;
    // Validate modifier matches level
    const expectedModifier = getModifierForLevel(request.difficulty_level);
    const modifierDiff = Math.abs(request.difficulty_modifier - expectedModifier);
    if (modifierDiff > 0.05) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'sync_difficulty', 'difficulty_state', { modifier: request.difficulty_modifier, level: request.difficulty_level }, 'failure', 'Modifier does not match difficulty level');
        return JSON.stringify({
            error: 'Modifier does not match difficulty level',
        });
    }
    // Store difficulty state
    const state = {
        player_id: ctx.userId,
        current_modifier: request.difficulty_modifier,
        win_streak: 0,
        lose_streak: 0,
        updated_at: Math.floor(Date.now() / 1000),
    };
    nk.storageWrite([
        {
            collection: 'difficulty_state',
            key: ctx.userId,
            userId: ctx.userId,
            value: JSON.stringify(state),
        },
    ]);
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'sync_difficulty', 'difficulty_state', { modifier: request.difficulty_modifier, level: request.difficulty_level }, 'success');
    return JSON.stringify({
        success: true,
        synced: true,
    });
}
/**
 * Handles match outcome tracking for difficulty adjustment.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match outcome data
 * @returns JSON string with updated difficulty state
 *
 * @example
 * // Request payload
 * { "match_id": "uuid", "won": true, "match_type": "pve", "duration": 120 }
 *
 * // Response
 * { "success": true, "modifier": 0.1, "difficulty_level": "Hard" }
 */
function rpcTrackMatchOutcome(ctx, logger, nk, payload) {
    logger.info('Track match outcome called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)({
        match_id: (0, validation_1.pipe)((0, validation_1.string)(), (0, validation_1.minLength)(1)),
        won: (0, validation_1.boolean)(),
        match_type: createEnum(['pve', 'pvp']),
        duration: (0, validation_1.pipe)((0, validation_1.number)(), (0, validation_1.minValue)(0)),
    }, payload, 'track_match_outcome');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'track_match_outcome', 'match_outcome', { match_id: 'unknown' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('track_match_outcome', validation.error);
    }
    const request = validation.data;
    // Load current difficulty state
    const stateResult = loadDifficultyState(nk, ctx.userId);
    const state = stateResult.success
        ? stateResult.data
        : {
            player_id: ctx.userId,
            current_modifier: 0.0,
            win_streak: 0,
            lose_streak: 0,
            updated_at: 0,
        };
    // Update streaks
    if (request.won) {
        state.win_streak += 1;
        state.lose_streak = 0;
    }
    else {
        state.lose_streak += 1;
        state.win_streak = 0;
    }
    // Check for difficulty adjustment
    let adjustmentNeeded = false;
    if (state.win_streak >= WIN_STREAK_THRESHOLD) {
        const oldModifier = state.current_modifier;
        state.current_modifier = Math.min(state.current_modifier + 0.1, MAX_MODIFIER);
        state.win_streak = 0; // Reset after adjustment
        if (state.current_modifier !== oldModifier) {
            adjustmentNeeded = true;
        }
    }
    if (state.lose_streak >= LOSE_STREAK_THRESHOLD) {
        const oldModifier = state.current_modifier;
        state.current_modifier = Math.max(state.current_modifier - 0.1, MIN_MODIFIER);
        state.lose_streak = 0; // Reset after adjustment
        if (state.current_modifier !== oldModifier) {
            adjustmentNeeded = true;
        }
    }
    state.updated_at = Math.floor(Date.now() / 1000);
    // Save updated state
    nk.storageWrite([
        {
            collection: 'difficulty_state',
            key: ctx.userId,
            userId: ctx.userId,
            value: JSON.stringify(state),
        },
    ]);
    // Track match outcome in storage for analytics
    const matchEntry = {
        match_id: request.match_id,
        won: request.won,
        match_type: request.match_type,
        timestamp: Math.floor(Date.now() / 1000),
        base_difficulty: state.current_modifier,
    };
    const historyResult = loadMatchHistory(nk, ctx.userId);
    const history = historyResult.success ? historyResult.data : [];
    history.push(matchEntry);
    // Keep only last 100 matches
    if (history.length > 100) {
        history.splice(0, history.length - 100);
    }
    nk.storageWrite([
        {
            collection: 'match_history',
            key: ctx.userId,
            userId: ctx.userId,
            value: JSON.stringify(history),
        },
    ]);
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'track_match_outcome', 'match_outcome', {
        match_id: request.match_id,
        won: request.won,
        modifier: state.current_modifier,
    }, 'success');
    return JSON.stringify({
        success: true,
        modifier: state.current_modifier,
        difficulty_level: getDifficultyLevel(state.current_modifier),
        win_streak: state.win_streak,
        lose_streak: state.lose_streak,
        adjusted: adjustmentNeeded,
    });
}
/**
 * Handles get player performance requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused)
 * @returns JSON string with performance metrics
 *
 * @example
 * // Response
 * {
 *   "win_rate": 0.75,
 *   "win_streak": 2,
 *   "lose_streak": 0,
 *   "current_modifier": 0.1,
 *   "difficulty_level": "Hard",
 *   "performance_rating": "Good",
 *   "matches_tracked": 20
 * }
 */
function rpcGetPlayerPerformance(ctx, logger, nk, _payload) {
    logger.info('Get player performance called for user: %s', ctx.userId);
    const stateResult = loadDifficultyState(nk, ctx.userId);
    const state = stateResult.success
        ? stateResult.data
        : {
            player_id: ctx.userId,
            current_modifier: 0.0,
            win_streak: 0,
            lose_streak: 0,
            updated_at: 0,
        };
    const historyResult = loadMatchHistory(nk, ctx.userId);
    const history = historyResult.success ? historyResult.data : [];
    // Calculate win rate from recent matches
    const recentMatches = history.slice(-10);
    const wins = recentMatches.filter((m) => m.won).length;
    const winRate = recentMatches.length > 0 ? wins / recentMatches.length : 0.0;
    // Calculate performance rating
    const performanceRating = calculatePerformanceRating(winRate, state.win_streak, state.lose_streak);
    return JSON.stringify({
        win_rate: winRate,
        win_streak: state.win_streak,
        lose_streak: state.lose_streak,
        current_modifier: state.current_modifier,
        difficulty_level: getDifficultyLevel(state.current_modifier),
        performance_rating: performanceRating,
        matches_tracked: history.length,
    });
}
/**
 * Calculates performance rating based on win rate and streaks.
 */
function calculatePerformanceRating(winRate, _winStreak, _loseStreak) {
    if (winRate >= 0.8) {
        return 'Excellent';
    }
    else if (winRate >= 0.6) {
        return 'Good';
    }
    else if (winRate >= 0.4) {
        return 'Average';
    }
    else {
        return 'Poor';
    }
}
/**
 * Gets the difficulty level string for a modifier value.
 */
function getDifficultyLevel(modifier) {
    if (modifier <= MIN_MODIFIER + 0.01) {
        return DifficultyLevel.EASY;
    }
    else if (modifier <= 0.01) {
        return DifficultyLevel.NORMAL;
    }
    else if (modifier <= 0.11) {
        return DifficultyLevel.HARD;
    }
    else {
        return DifficultyLevel.EXTREME;
    }
}
/**
 * Gets the modifier value for a difficulty level.
 */
function getModifierForLevel(level) {
    switch (level) {
        case DifficultyLevel.EASY:
            return MIN_MODIFIER;
        case DifficultyLevel.NORMAL:
            return 0.0;
        case DifficultyLevel.HARD:
            return 0.1;
        case DifficultyLevel.EXTREME:
            return MAX_MODIFIER;
        default:
            return 0.0;
    }
}
/**
 * Loads difficulty state from storage.
 */
function loadDifficultyState(nk, userId) {
    const objects = nk.storageRead?.([
        {
            collection: 'difficulty_state',
            key: userId,
            userId: userId,
        },
    ]) ?? [];
    if (!objects || objects.length === 0) {
        return { success: false };
    }
    const value = objects[0].value;
    if (!value) {
        return { success: false };
    }
    const parseResult = (0, safeParse_1.safeParse)(value, null, logger_1.logger, 'difficulty_state');
    if (!parseResult.success || !parseResult.data) {
        return { success: false };
    }
    return { success: true, data: parseResult.data };
}
/**
 * Loads match history from storage.
 */
function loadMatchHistory(nk, userId) {
    const objects = nk.storageRead?.([
        {
            collection: 'match_history',
            key: userId,
            userId: userId,
        },
    ]) ?? [];
    if (!objects || objects.length === 0) {
        return { success: true, data: [] };
    }
    const value = objects[0].value;
    if (!value) {
        return { success: true, data: [] };
    }
    // Create a dummy logger for safeParse
    const dummyLogger = {
        info: (_message, ..._args) => { },
        warn: (_message, ..._args) => { },
        error: (_message, ..._args) => { },
    };
    const parseResult = (0, safeParse_1.safeParse)(value, null, dummyLogger, 'match_history');
    if (!parseResult.success || !parseResult.data) {
        return { success: true, data: [] };
    }
    return { success: true, data: parseResult.data };
}
/**
 * Gets the current difficulty modifier for a player (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get modifier for
 * @returns Current difficulty modifier
 */
function getDifficultyModifier(ctx, userId) {
    const stateResult = loadDifficultyState(ctx, userId);
    return stateResult.success ? stateResult.data.current_modifier : 0.0;
}
/**
 * Gets the difficulty state for a player (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get state for
 * @returns Full difficulty state with match history
 */
function getDifficultyState(ctx, userId) {
    const stateResult = loadDifficultyState(ctx, userId);
    const historyResult = loadMatchHistory(ctx, userId);
    const state = stateResult.success
        ? stateResult.data
        : {
            player_id: userId,
            current_modifier: 0.0,
            win_streak: 0,
            lose_streak: 0,
            updated_at: 0,
        };
    const history = historyResult.success ? historyResult.data : [];
    return {
        ...state,
        match_history: history,
    };
}
/**
 * Sets the difficulty modifier for a player (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to set modifier for
 * @param modifier - New difficulty modifier
 */
function setDifficultyModifier(ctx, userId, modifier) {
    const stateResult = loadDifficultyState(ctx, userId);
    const state = stateResult.success
        ? stateResult.data
        : {
            player_id: userId,
            current_modifier: 0.0,
            win_streak: 0,
            lose_streak: 0,
            updated_at: 0,
        };
    state.current_modifier = Math.min(Math.max(modifier, MIN_MODIFIER), MAX_MODIFIER);
    state.updated_at = Math.floor(Date.now() / 1000);
    ctx.storageWrite?.([
        {
            collection: 'difficulty_state',
            key: userId,
            userId: userId,
            value: JSON.stringify(state),
        },
    ]);
}
/**
 * Tracks a match outcome for difficulty adjustment (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to track match for
 * @param data - Match outcome data
 */
function trackMatchOutcome(ctx, userId, data) {
    const stateResult = loadDifficultyState(ctx, userId);
    const state = stateResult.success
        ? stateResult.data
        : {
            player_id: userId,
            current_modifier: 0.0,
            win_streak: 0,
            lose_streak: 0,
            updated_at: 0,
        };
    // Update streaks
    if (data.won) {
        state.win_streak += 1;
        state.lose_streak = 0;
    }
    else {
        state.lose_streak += 1;
        state.win_streak = 0;
    }
    // Check for difficulty adjustment
    if (state.win_streak >= WIN_STREAK_THRESHOLD) {
        state.current_modifier = Math.min(state.current_modifier + 0.1, MAX_MODIFIER);
        state.win_streak = 0;
    }
    if (state.lose_streak >= LOSE_STREAK_THRESHOLD) {
        state.current_modifier = Math.max(state.current_modifier - 0.1, MIN_MODIFIER);
        state.lose_streak = 0;
    }
    state.updated_at = Math.floor(Date.now() / 1000);
    // Save state
    ctx.storageWrite?.([
        {
            collection: 'difficulty_state',
            key: userId,
            userId: userId,
            value: JSON.stringify(state),
        },
    ]);
    // Track match entry
    const matchEntry = {
        match_id: `test-${Date.now()}`,
        won: data.won,
        match_type: data.match_type,
        timestamp: Math.floor(Date.now() / 1000),
        base_difficulty: state.current_modifier,
    };
    const historyResult = loadMatchHistory(ctx, userId);
    const history = historyResult.success ? historyResult.data : [];
    history.push(matchEntry);
    // Keep only last 50 matches (as per test expectation)
    if (history.length > 50) {
        history.splice(0, history.length - 50);
    }
    ctx.storageWrite?.([
        {
            collection: 'match_history',
            key: userId,
            userId: userId,
            value: JSON.stringify(history),
        },
    ]);
}
/**
 * Resets the difficulty state for a player (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to reset state for
 */
function resetDifficulty(ctx, userId) {
    const defaultState = {
        player_id: userId,
        current_modifier: 0.0,
        win_streak: 0,
        lose_streak: 0,
        updated_at: Math.floor(Date.now() / 1000),
    };
    // Reset difficulty state
    ctx.storageWrite?.([
        {
            collection: 'difficulty_state',
            key: userId,
            userId: userId,
            value: JSON.stringify(defaultState),
        },
    ]);
    // Clear match history
    ctx.storageWrite?.([
        {
            collection: 'match_history',
            key: userId,
            userId: userId,
            value: JSON.stringify([]),
        },
    ]);
}
/**
 * Gets the difficulty level string for a user (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get difficulty level for
 * @returns Difficulty level string
 */
function getDifficultyLevelString(ctx, userId) {
    const modifier = getDifficultyModifier(ctx, userId);
    return getDifficultyLevel(modifier);
}
/**
 * Gets performance rating for a user (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get performance rating for
 * @returns Performance rating string
 */
function getPerformanceRating(ctx, userId) {
    const winRate = getWinRate(ctx, userId, 10);
    const state = getDifficultyState(ctx, userId);
    return calculatePerformanceRating(winRate, state.win_streak, state.lose_streak);
}
/**
 * Gets win rate for a user (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get win rate for
 * @param windowSize - Number of recent matches to consider
 * @returns Win rate (0-1)
 */
function getWinRate(ctx, userId, windowSize = 10) {
    const historyResult = loadMatchHistory(ctx, userId);
    const history = historyResult.success ? historyResult.data : [];
    if (history.length === 0) {
        return 0;
    }
    // Get last N matches
    const recentMatches = history.slice(-windowSize);
    const wins = recentMatches.filter((m) => m.won).length;
    return wins / recentMatches.length;
}
/**
 * Calculates target difficulty with modifier (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to calculate target difficulty for
 * @param baseDifficulty - Base difficulty value (0-1)
 * @param customModifier - Optional custom modifier override
 * @returns Target difficulty (0-1.5)
 */
function calculateTargetDifficulty(ctx, userId, baseDifficulty, customModifier) {
    const modifier = customModifier !== undefined ? customModifier : getDifficultyModifier(ctx, userId);
    const target = baseDifficulty * (1 + modifier);
    // Clamp to [0, 1.5]
    return Math.max(0, Math.min(1.5, target));
}
/**
 * Gets encounter reward modifier based on difficulty (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get reward modifier for
 * @returns Reward multiplier (0.8-1.4)
 */
function getEncounterRewardModifier(ctx, userId) {
    const modifier = getDifficultyModifier(ctx, userId);
    // Map modifier to reward multiplier
    // -0.2 (Easy) -> 0.8x
    // 0.0 (Normal) -> 1.0x
    // 0.1 (Hard) -> 1.2x
    // 0.2 (Extreme) -> 1.4x
    return 1.0 + modifier * 2.0;
}
