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
import { getHealthStatus } from './health_monitor';

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

  const health = getHealthStatus();

  return JSON.stringify({
    status: health.healthy ? 'ok' : 'degraded',
    timestamp: Date.now(),
    version: '0.1.0',
    metrics: health.metrics,
    monitoring: health.isMonitoring,
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
  return getPlayerStatsWithCache(nk, logger, ctx, cacheManager);
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
 * Enhances reports with match details from the database when match_id is present.
 * This is useful for dispute resolution and QA debugging.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string with optional user_id filter
 * @returns JSON string with reports and match details
 */
export function rpcGetPlayerReports(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
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

  // Enhance reports with match details when available
  const enhancedReports = reports.map((report: any) => {
    if (!report.match_id) {
      return report;
    }

    try {
      // Try to fetch match details from the database
      const matchResult = nk.dbQuery(
        `
        SELECT
          match_id,
          creator_id,
          opponent_id,
          winner_id,
          loser_id,
          match_type,
          is_punch_up,
          end_reason,
          created_at,
          creator_health_remaining,
          opponent_health_remaining
        FROM match_results
        WHERE match_id = $1
        LIMIT 1
      `,
        [report.match_id]
      ) as any[];

      if (matchResult && matchResult.length > 0) {
        const match = matchResult[0];
        return {
          ...report,
          match_details: {
            match_id: match.match_id,
            creator_id: match.creator_id,
            opponent_id: match.opponent_id,
            winner_id: match.winner_id,
            loser_id: match.loser_id,
            match_type: match.match_type,
            is_punch_up: match.is_punch_up,
            end_reason: match.end_reason,
            created_at: match.created_at,
            creator_health_remaining: match.creator_health_remaining,
            opponent_health_remaining: match.opponent_health_remaining,
          },
        };
      }
    } catch (error) {
      getLogger().warn('Failed to fetch match details for report', {
        error: error instanceof Error ? error.message : String(error),
        matchId: report.match_id,
      });
    }

    return report;
  });

  return JSON.stringify({
    success: true,
    reports: enhancedReports,
    total: enhancedReports.length,
  });
}
