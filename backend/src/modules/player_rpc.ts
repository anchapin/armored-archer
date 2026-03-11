/**
 * Player RPC module.
 * @fileoverview Exposes RPC endpoints for player stats and health checks.
 */

import { getStructuredLogger } from '../index';
import { Runtime } from '../types/nakama';
import { getCacheManager } from '../utils/cache';
import { submitPlayerReport, getReportsForUser } from './anti_cheat';
import { registerRpcWithMetrics } from './metrics';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import { getPlayerStatsWithCache } from '../utils/player-data-helpers';

/**
 * Helper to get structured logger for this module
 */
function getLogger() {
  return getStructuredLogger();
}

/**
 * Registers the health check RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcHealthCheck(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/health_check',
    'health_check',
    rpcHealthCheck
  );
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
export function rpcHealthCheck(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): string {
  getLogger().info('Armored Archer health check called', {
    rpcName: 'armored_archer/health_check',
  });

  const validation = validatePayload(ZodSchemas.health_check, payload, 'health_check');
  if (!validation.success) {
    return createValidationErrorResponse('health_check', validation.error);
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
export function registerRpcGetPlayerStats(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_player_stats',
    'get_player_stats',
    rpcGetPlayerStats
  );
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
export function rpcGetPlayerStats(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  getLogger().info('Getting player stats for user', {
    rpcName: 'armored_archer/get_player_stats',
    userId: ctx.userId,
  });

  const validation = validatePayload(ZodSchemas.get_player_stats, payload, 'get_player_stats');
  if (!validation.success) {
    return createValidationErrorResponse('get_player_stats', validation.error);
  }

  const cacheManager = getCacheManager(logger);
  return getPlayerStatsWithCache(nk, ctx, cacheManager);
}

/**
 * Registers the report player RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcReportPlayer(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/report_player',
    'report_player',
    rpcReportPlayer
  );
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
export function rpcReportPlayer(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): string {
  getLogger().info('Player report requested', {
    rpcName: 'armored_archer/report_player',
    userId: ctx.userId,
  });

  const validation = validatePayload(ZodSchemas.report_player, payload, 'report_player');
  if (!validation.success) {
    return createValidationErrorResponse('report_player', validation.error);
  }

  const { reported_user_id, reason, match_id, additional_info } = validation.data;

  const result = submitPlayerReport(
    ctx.userId,
    reported_user_id,
    reason,
    match_id,
    additional_info
  );

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
export function registerRpcGetPlayerReports(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_player_reports',
    'get_player_reports',
    rpcGetPlayerReports
  );
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
export function rpcGetPlayerReports(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): string {
  getLogger().info('Get player reports requested', {
    rpcName: 'armored_archer/get_player_reports',
    userId: ctx.userId,
  });

  const validation = validatePayload(ZodSchemas.get_player_reports, payload, 'get_player_reports');
  if (!validation.success) {
    return createValidationErrorResponse('get_player_reports', validation.error);
  }

  const { user_id } = validation.data;

  // If user_id provided, get reports for that user (admin view)
  // Otherwise, get reports filed by current user
  const reports = user_id ? getReportsForUser(user_id) : getReportsForUser(ctx.userId);

  return JSON.stringify({
    success: true,
    reports,
  });
}
