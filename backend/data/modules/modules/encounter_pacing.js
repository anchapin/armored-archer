"use strict";
/**
 * Encounter Pacing Module
 * @fileoverview Manages encounter pacing tracking and analytics for fatigue prevention.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentType = void 0;
exports.registerRpcLogEncounterPacing = registerRpcLogEncounterPacing;
exports.registerRpcGetPacingReport = registerRpcGetPacingReport;
exports.rpcLogEncounterPacing = rpcLogEncounterPacing;
exports.rpcGetPacingReport = rpcGetPacingReport;
exports.classifyEncounter = classifyEncounter;
exports.getPacingTargets = getPacingTargets;
exports.trackPacingState = trackPacingState;
exports.getPacingState = getPacingState;
exports.getPacingMetrics = getPacingMetrics;
exports.getFatigueLevel = getFatigueLevel;
exports.suggestBreak = suggestBreak;
exports.getRecommendedEncounterType = getRecommendedEncounterType;
exports.resetPacingState = resetPacingState;
const valibot_1 = require("valibot");
const safeParse_1 = require("../utils/safeParse");
const audit_1 = require("./audit");
const metrics_1 = require("./metrics");
const validation_1 = require("./validation");
/**
 * Content type enum for encounters.
 */
var ContentType;
(function (ContentType) {
    ContentType["COMBAT"] = "combat";
    ContentType["EXPLORATION"] = "exploration";
    ContentType["NARRATIVE"] = "narrative";
    ContentType["PUZZLE"] = "puzzle";
})(ContentType || (exports.ContentType = ContentType = {}));
// Pacing targets
const TARGET_COMBAT_RATIO = 0.6;
const TARGET_EXPLORATION_RATIO = 0.2;
const TARGET_NARRATIVE_RATIO = 0.2;
const MAX_COMBAT_STREAK = 5;
const MIN_EXPLORATION_STREAK = 3;
const FATIGUE_THRESHOLD_HIGH = 70;
const FATIGUE_THRESHOLD_CRITICAL = 85;
/**
 * Registers the log encounter pacing RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcLogEncounterPacing(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/log_encounter_pacing', 'log_encounter_pacing', rpcLogEncounterPacing);
}
/**
 * Registers the get pacing report RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetPacingReport(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/get_pacing_report', 'get_pacing_report', rpcGetPacingReport);
}
/**
 * Handles encounter pacing logging requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing pacing metrics
 * @returns JSON string with success status
 */
function rpcLogEncounterPacing(ctx, logger, nk, payload) {
    logger.info('Log encounter pacing called for user: %s', ctx.userId);
    const validation = (0, validation_1.validatePayload)({
        total_encounters: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
        recent_encounters: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
        combat_count: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
        exploration_count: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
        narrative_count: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
        puzzle_count: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
        combat_ratio: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(1)),
        exploration_ratio: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(1)),
        narrative_ratio: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(1)),
        puzzle_ratio: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(1)),
        combat_streak: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
        exploration_streak: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
        current_fatigue: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0), (0, valibot_1.maxValue)(100)),
        fatigue_level: (0, valibot_1.string)(),
        combat_time_total: (0, valibot_1.pipe)((0, valibot_1.number)(), (0, valibot_1.minValue)(0)),
    }, payload, 'log_encounter_pacing');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'log_encounter_pacing', 'pacing_metrics', { metrics: 'invalid' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('log_encounter_pacing', validation.error);
    }
    const request = validation.data;
    // Create pacing entry
    const pacingEntry = {
        player_id: ctx.userId,
        type: ContentType.COMBAT, // Default type for now
        duration: 0,
        timestamp: Math.floor(Date.now() / 1000),
        intensity: 0,
    };
    // Load current pacing state
    const stateResult = loadPacingState(nk, ctx.userId);
    const state = stateResult.success ? stateResult.data : createDefaultPacingState(ctx.userId);
    // Update state with new metrics
    state.session_encounters = request.total_encounters;
    state.combat_streak = request.combat_streak;
    state.exploration_streak = request.exploration_streak;
    state.current_fatigue = request.current_fatigue;
    state.combat_time_accumulated = request.combat_time_total;
    state.updated_at = Math.floor(Date.now() / 1000);
    // Add entry to recent encounters
    state.recent_encounters.push(pacingEntry);
    // Keep only last 10 encounters
    if (state.recent_encounters.length > 10) {
        state.recent_encounters.splice(0, state.recent_encounters.length - 10);
    }
    // Save updated state
    nk.storageWrite([
        {
            collection: 'pacing_state',
            key: ctx.userId,
            userId: ctx.userId,
            value: JSON.stringify(state),
        },
    ]);
    (0, audit_1.logAudit)(nk, ctx.userId, ctx.ipAddress ?? null, 'log_encounter_pacing', 'pacing_metrics', { fatigue: request.current_fatigue, combat_streak: request.combat_streak }, 'success');
    return JSON.stringify({
        success: true,
        logged: true,
    });
}
/**
 * Handles get pacing report requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused)
 * @returns JSON string with pacing analytics
 */
function rpcGetPacingReport(ctx, logger, nk, _payload) {
    logger.info('Get pacing report called for user: %s', ctx.userId);
    // Load pacing state
    const stateResult = loadPacingState(nk, ctx.userId);
    const state = stateResult.success ? stateResult.data : createDefaultPacingState(ctx.userId);
    // Calculate metrics
    const metrics = calculateMetrics(state);
    // Generate recommendations
    const recommendations = generateRecommendations(metrics);
    // Calculate pacing score
    const pacingScore = calculatePacingScore(metrics);
    const response = {
        player_id: ctx.userId,
        metrics,
        recommendations,
        pacing_score: pacingScore,
    };
    return JSON.stringify(response);
}
/**
 * Calculates pacing metrics from pacing state.
 */
function calculateMetrics(state) {
    const combatCount = state.recent_encounters.filter((e) => e.type === ContentType.COMBAT).length;
    const explorationCount = state.recent_encounters.filter((e) => e.type === ContentType.EXPLORATION).length;
    const narrativeCount = state.recent_encounters.filter((e) => e.type === ContentType.NARRATIVE).length;
    const puzzleCount = state.recent_encounters.filter((e) => e.type === ContentType.PUZZLE).length;
    const total = state.recent_encounters.length;
    return {
        total_encounters: state.session_encounters,
        recent_encounters: total,
        combat_count: combatCount,
        exploration_count: explorationCount,
        narrative_count: narrativeCount,
        puzzle_count: puzzleCount,
        combat_ratio: total > 0 ? combatCount / total : 0,
        exploration_ratio: total > 0 ? explorationCount / total : 0,
        narrative_ratio: total > 0 ? narrativeCount / total : 0,
        puzzle_ratio: total > 0 ? puzzleCount / total : 0,
        combat_streak: state.combat_streak,
        exploration_streak: state.exploration_streak,
        current_fatigue: state.current_fatigue,
        fatigue_level: getFatigueLevelString(state.current_fatigue),
        combat_time_total: state.combat_time_accumulated,
    };
}
/**
 * Generates pacing recommendations based on metrics.
 */
function generateRecommendations(metrics) {
    const recommendation = {
        should_break: false,
        break_duration: 0,
        suggested_next_type: ContentType.COMBAT,
        reason: '',
    };
    // Check fatigue
    if (metrics.current_fatigue >= FATIGUE_THRESHOLD_CRITICAL) {
        recommendation.should_break = true;
        recommendation.break_duration = 300; // 5 minutes
        recommendation.suggested_next_type = ContentType.NARRATIVE;
        recommendation.reason = 'Critical fatigue detected';
    }
    else if (metrics.current_fatigue >= FATIGUE_THRESHOLD_HIGH) {
        recommendation.should_break = true;
        recommendation.break_duration = 120; // 2 minutes
        recommendation.suggested_next_type = ContentType.EXPLORATION;
        recommendation.reason = 'High fatigue detected';
    }
    // Check combat streak
    if (metrics.combat_streak > MAX_COMBAT_STREAK) {
        recommendation.should_break = true;
        recommendation.suggested_next_type = ContentType.EXPLORATION;
        recommendation.reason = 'Combat streak too long';
    }
    // Check exploration streak
    if (metrics.exploration_streak >= MIN_EXPLORATION_STREAK) {
        recommendation.suggested_next_type = ContentType.COMBAT;
        if (!recommendation.should_break) {
            recommendation.reason = 'Enough exploration, ready for combat';
        }
    }
    // Check pacing ratios
    if (metrics.combat_ratio > TARGET_COMBAT_RATIO) {
        recommendation.suggested_next_type = ContentType.EXPLORATION;
    }
    else if (metrics.exploration_ratio > TARGET_EXPLORATION_RATIO) {
        recommendation.suggested_next_type = ContentType.COMBAT;
    }
    return recommendation;
}
/**
 * Calculates overall pacing score (0-100).
 */
function calculatePacingScore(metrics) {
    let score = 100;
    // Deduct for combat streak violations
    if (metrics.combat_streak > MAX_COMBAT_STREAK) {
        score -= (metrics.combat_streak - MAX_COMBAT_STREAK) * 10;
    }
    // Deduct for fatigue
    score -= metrics.current_fatigue * 0.3;
    // Deduct for ratio deviations
    const combatRatioDiff = Math.abs(metrics.combat_ratio - TARGET_COMBAT_RATIO);
    score -= combatRatioDiff * 30;
    const explorationRatioDiff = Math.abs(metrics.exploration_ratio - TARGET_EXPLORATION_RATIO);
    score -= explorationRatioDiff * 15;
    const narrativeRatioDiff = Math.abs(metrics.narrative_ratio - TARGET_NARRATIVE_RATIO);
    score -= narrativeRatioDiff * 15;
    return Math.max(0, Math.min(100, score));
}
/**
 * Gets fatigue level as a string.
 */
function getFatigueLevelString(fatigue) {
    if (fatigue >= FATIGUE_THRESHOLD_CRITICAL) {
        return 'Critical';
    }
    else if (fatigue >= FATIGUE_THRESHOLD_HIGH) {
        return 'High';
    }
    else if (fatigue >= 50.0) {
        return 'Medium';
    }
    else if (fatigue >= 25.0) {
        return 'Low';
    }
    else {
        return 'None';
    }
}
/**
 * Creates a default pacing state for a new player.
 */
function createDefaultPacingState(playerId) {
    return {
        player_id: playerId,
        recent_encounters: [],
        combat_streak: 0,
        exploration_streak: 0,
        current_fatigue: 0.0,
        session_encounters: 0,
        combat_time_accumulated: 0.0,
        updated_at: Math.floor(Date.now() / 1000),
    };
}
/**
 * Loads pacing state from storage.
 */
function loadPacingState(nk, userId) {
    const objects = nk.storageRead?.([
        {
            collection: 'pacing_state',
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
    const parseResult = (0, safeParse_1.safeParse)(value, null, logger, 'pacing_state');
    if (!parseResult.success || !parseResult.data) {
        return { success: false };
    }
    return { success: true, data: parseResult.data };
}
// Dummy logger for compatibility
const logger = {
    info: (_message, ..._args) => { },
    warn: (_message, ..._args) => { },
    error: (_message, ..._args) => { },
    debug: (_message, ..._args) => { },
};
/**
 * Classifies an encounter based on its properties (test helper).
 *
 * @param encounter - Encounter data
 * @returns Content type of the encounter
 */
function classifyEncounter(encounter) {
    if (encounter.is_boss) {
        return ContentType.COMBAT;
    }
    // Boss encounters are always combat
    // Non-boss encounters based on biome and difficulty
    switch (encounter.biome) {
        case 'forest':
        case 'sky':
            return ContentType.COMBAT;
        case 'cavern':
            // Cavern encounters can be combat or puzzle based on difficulty
            return encounter.difficulty > 1 ? ContentType.PUZZLE : ContentType.COMBAT;
        default:
            return ContentType.COMBAT;
    }
}
/**
 * Gets pacing target constants (test helper).
 *
 * @returns Pacing target configuration
 */
function getPacingTargets() {
    return {
        TARGET_COMBAT_RATIO,
        TARGET_EXPLORATION_RATIO,
        TARGET_NARRATIVE_RATIO,
        MAX_COMBAT_STREAK,
        MIN_EXPLORATION_STREAK,
        FATIGUE_THRESHOLD_HIGH,
        FATIGUE_THRESHOLD_CRITICAL,
    };
}
/**
 * Tracks a pacing entry (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to track pacing for
 * @param type - Content type of the encounter
 * @param duration - Duration in seconds
 */
function trackPacingState(ctx, userId, type, duration) {
    const stateResult = loadPacingState(ctx, userId);
    const state = stateResult.success ? stateResult.data : createDefaultPacingState(userId);
    // Create pacing entry
    const pacingEntry = {
        player_id: userId,
        type,
        duration,
        timestamp: Math.floor(Date.now() / 1000),
        intensity: type === ContentType.COMBAT ? 1.0 : 0.3,
    };
    // Update streaks
    if (type === ContentType.COMBAT) {
        state.combat_streak += 1;
        state.exploration_streak = 0;
    }
    else if (type === ContentType.EXPLORATION) {
        state.exploration_streak += 1;
        state.combat_streak = 0;
    }
    else {
        state.combat_streak = 0;
        state.exploration_streak = 0;
    }
    // Add entry to recent encounters
    state.recent_encounters.push(pacingEntry);
    // Keep only last 10 encounters
    if (state.recent_encounters.length > 10) {
        state.recent_encounters.splice(0, state.recent_encounters.length - 10);
    }
    // Update combat time
    if (type === ContentType.COMBAT) {
        state.combat_time_accumulated += duration;
    }
    // Update fatigue based on duration and intensity
    const fatigueIncrease = duration * 0.1 * (1 + pacingEntry.intensity * 0.5);
    // Apply 1.5x fatigue multiplier if combat streak exceeds max
    const streakMultiplier = type === ContentType.COMBAT && state.combat_streak > MAX_COMBAT_STREAK ? 1.5 : 1.0;
    state.current_fatigue = Math.min(state.current_fatigue + fatigueIncrease * streakMultiplier, 100);
    state.session_encounters += 1;
    state.updated_at = Math.floor(Date.now() / 1000);
    ctx.storageWrite?.([
        {
            collection: 'pacing_state',
            key: userId,
            userId: userId,
            value: JSON.stringify(state),
        },
    ]);
}
/**
 * Gets pacing state for a player (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get state for
 * @returns Pacing state
 */
function getPacingState(ctx, userId) {
    const stateResult = loadPacingState(ctx, userId);
    return stateResult.success ? stateResult.data : createDefaultPacingState(userId);
}
/**
 * Gets pacing metrics for a player (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get metrics for
 * @returns Pacing metrics
 */
function getPacingMetrics(ctx, userId) {
    const state = getPacingState(ctx, userId);
    return calculateMetrics(state);
}
/**
 * Calculates fatigue level based on intensity and duration (test helper).
 *
 * @param intensity - Encounter intensity (0-1)
 * @param duration - Duration in seconds
 * @returns Fatigue value (0-100)
 */
function getFatigueLevel(intensity, duration) {
    const baseFatigue = duration * 0.1;
    const intensityMultiplier = 1.0 + intensity * 0.5;
    const fatigue = baseFatigue * intensityMultiplier;
    return Math.max(0, Math.min(100, fatigue));
}
/**
 * Suggests whether the player should take a break (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to check
 * @returns Break recommendation
 */
function suggestBreak(ctx, userId) {
    const metrics = getPacingMetrics(ctx, userId);
    if (metrics.current_fatigue >= FATIGUE_THRESHOLD_CRITICAL) {
        return {
            should_break: true,
            break_duration: 300, // 5 minutes
            reason: 'Critical fatigue detected',
            suggested_next_type: 'narrative',
        };
    }
    else if (metrics.current_fatigue >= FATIGUE_THRESHOLD_HIGH) {
        return {
            should_break: true,
            break_duration: 120, // 2 minutes
            reason: 'High fatigue detected',
            suggested_next_type: 'exploration',
        };
    }
    else if (metrics.combat_streak > MAX_COMBAT_STREAK) {
        return {
            should_break: true,
            break_duration: 60, // 1 minute
            reason: 'Combat streak too long',
            suggested_next_type: 'exploration',
        };
    }
    return {
        should_break: false,
        break_duration: 0,
        reason: '',
    };
}
/**
 * Gets the recommended encounter type for next encounter (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get recommendation for
 * @returns Recommended content type
 */
function getRecommendedEncounterType(ctx, userId) {
    const metrics = getPacingMetrics(ctx, userId);
    // If high fatigue, recommend narrative
    if (metrics.current_fatigue >= FATIGUE_THRESHOLD_HIGH) {
        return ContentType.NARRATIVE;
    }
    // If combat streak too long, recommend exploration
    if (metrics.combat_streak > MAX_COMBAT_STREAK) {
        return ContentType.EXPLORATION;
    }
    // If combat ratio too high, recommend exploration
    if (metrics.combat_ratio > TARGET_COMBAT_RATIO) {
        return ContentType.EXPLORATION;
    }
    // Default to combat
    return ContentType.COMBAT;
}
/**
 * Resets the pacing state for a player (test helper).
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to reset state for
 */
function resetPacingState(ctx, userId) {
    const defaultState = createDefaultPacingState(userId);
    ctx.storageWrite?.([
        {
            collection: 'pacing_state',
            key: userId,
            userId: userId,
            value: JSON.stringify(defaultState),
        },
    ]);
}
