"use strict";
/**
 * Player RPC module.
 * @fileoverview Exposes RPC endpoints for player stats and health checks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRpcHealthCheck = registerRpcHealthCheck;
exports.rpcHealthCheck = rpcHealthCheck;
exports.registerRpcGetPlayerStats = registerRpcGetPlayerStats;
exports.rpcGetPlayerStats = rpcGetPlayerStats;
exports.registerRpcReportPlayer = registerRpcReportPlayer;
exports.rpcReportPlayer = rpcReportPlayer;
exports.registerRpcGetPlayerReports = registerRpcGetPlayerReports;
exports.rpcGetPlayerReports = rpcGetPlayerReports;
const index_1 = require("../index");
const cache_1 = require("../utils/cache");
const anti_cheat_1 = require("./anti_cheat");
const metrics_1 = require("./metrics");
const validation_1 = require("./validation");
const player_data_helpers_1 = require("../utils/player-data-helpers");
/**
 * Helper to get structured logger for this module
 */
function getLogger() {
    return (0, index_1.getStructuredLogger)();
}
/**
 * Registers the health check RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcHealthCheck(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/health_check', 'health_check', rpcHealthCheck);
}
/**
 * Handles health check requests for monitoring.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param _nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with health status
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "status": "ok",
 *   "timestamp": 1234567890,
 *   "version": "0.1.0"
 * }
 */
function rpcHealthCheck(ctx, logger, _nk, payload) {
    getLogger().info('Armored Archer health check called', {
        rpcName: 'armored_archer/health_check',
    });
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.health_check, payload, 'health_check');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('health_check', validation.error);
    }
    return JSON.stringify({
        status: 'ok',
        timestamp: Date.now(),
        version: '0.1.0',
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
    getLogger().info('Getting player stats for user', {
        rpcName: 'armored_archer/get_player_stats',
        userId: ctx.userId,
    });
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_player_stats, payload, 'get_player_stats');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('get_player_stats', validation.error);
    }
    const cacheManager = (0, cache_1.getCacheManager)(logger);
    return (0, player_data_helpers_1.getPlayerStatsWithCache)(nk, logger, ctx, cacheManager);
}
/**
 * Registers the report player RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcReportPlayer(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/report_player', 'report_player', rpcReportPlayer);
}
/**
 * Handles player reports for suspicious activity.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param _nk - Nakama server interface
 * @param payload - JSON string with report details
 * @returns JSON string with report result
 */
function rpcReportPlayer(ctx, logger, _nk, payload) {
    getLogger().info('Player report requested', {
        rpcName: 'armored_archer/report_player',
        userId: ctx.userId,
    });
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.report_player, payload, 'report_player');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('report_player', validation.error);
    }
    const { reported_user_id, reason, match_id, additional_info } = validation.data;
    const result = (0, anti_cheat_1.submitPlayerReport)(ctx.userId, reported_user_id, reason, match_id, additional_info);
    if (!result.success) {
        return JSON.stringify({
            success: false,
            error: result.error,
        });
    }
    return JSON.stringify({
        success: true,
        report_id: result.reportId,
    });
}
/**
 * Registers the get player reports RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetPlayerReports(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/get_player_reports', 'get_player_reports', rpcGetPlayerReports);
}
/**
 * Retrieves reports for a player (admin/reporter view).
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param _nk - Nakama server interface
 * @param payload - JSON string with optional user_id filter
 * @returns JSON string with reports
 */
function rpcGetPlayerReports(ctx, logger, _nk, payload) {
    getLogger().info('Get player reports requested', {
        rpcName: 'armored_archer/get_player_reports',
        userId: ctx.userId,
    });
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_player_reports, payload, 'get_player_reports');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('get_player_reports', validation.error);
    }
    const { user_id } = validation.data;
    // If user_id provided, get reports for that user (admin view)
    // Otherwise, get reports filed by current user
    const reports = user_id ? (0, anti_cheat_1.getReportsForUser)(user_id) : (0, anti_cheat_1.getReportsForUser)(ctx.userId);
    return JSON.stringify({
        success: true,
        reports,
    });
}
