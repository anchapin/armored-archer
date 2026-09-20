/**
 * Fairness Telemetry Module
 * @fileoverview Handles fairness telemetry for hit resolution, disconnects, timeouts, and ranking deltas.
 *
 * This module collects and stores fairness-related data for analysis and game balancing.
 * All telemetry is stored in Nakama storage for later analysis and can be queried
 * via RPC endpoints.
 */

import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { toStorageValue } from '../utils/storage-helpers';
import { logAudit } from './audit';
import { registerRpcWithMetrics } from './metrics';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

// --- Storage Collections ---
const COLLECTION_HIT_RESOLUTION = 'fairness_hit_resolution';
const COLLECTION_DISCONNECTS = 'fairness_disconnects';
const COLLECTION_TIMEOUTS = 'fairness_timeouts';
const COLLECTION_RANKING_DELTAS = 'fairness_ranking_deltas';
const COLLECTION_PUNCH_UP_LOSSES = 'fairness_punch_up_losses';

/**
 * Hit resolution event data.
 *
 * @property event_id - Unique identifier for this event
 * @property match_id - ID of the match where hit occurred
 * @property timestamp - When the hit resolution occurred
 * @property attacker_id - ID of attacking player
 * @property defender_id - ID of defending player
 * @property hit - Whether the attack hit
 * @property damage - Damage dealt
 * @property is_crit - Whether the hit was critical
 * @property angle - Angle of attack in radians
 * @property power - Power level of attack (0.0-1.0)
 * @property attacker_health - Attacker's health at time of attack
 * @property defender_health - Defender's health at time of attack
 * @property turn - Turn number when hit occurred
 */
export interface HitResolutionEvent {
  event_id: string;
  match_id: string;
  timestamp: number;
  attacker_id: string;
  defender_id: string;
  hit: boolean;
  damage: number;
  is_crit: boolean;
  angle: number;
  power?: number;
  attacker_health: number;
  defender_health: number;
  turn: number;
}

/**
 * Disconnect event data.
 *
 * @property event_id - Unique identifier for this event
 * @property match_id - ID of the match where disconnect occurred
 * @property timestamp - When the disconnect occurred
 * @property user_id - ID of user who disconnected
 * @property opponent_id - ID of opponent
 * @property disconnect_reason - Reason for disconnect (network_error, user_quit, timeout, etc.)
 * @property match_status - Status of match when disconnect occurred
 * @property match_type - Type of match (ranked or casual)
 * @property current_turn_user_id - User whose turn it was when disconnect happened
 * @property was_winning - Whether disconnecting user was winning at time of disconnect
 */
export interface DisconnectEvent {
  event_id: string;
  match_id: string;
  timestamp: number;
  user_id: string;
  opponent_id: string;
  disconnect_reason: string;
  match_status: string;
  match_type: 'ranked' | 'casual';
  current_turn_user_id: string;
  was_winning?: boolean;
  health_before_disconnect?: number;
  opponent_health_before_disconnect?: number;
}

/**
 * Timeout event data.
 *
 * @property event_id - Unique identifier for this event
 * @property match_id - ID of the match where timeout occurred
 * @property timestamp - When the timeout occurred
 * @property timed_out_user_id - ID of user who timed out
 * @property opponent_id - ID of opponent
 * @property timeout_type - Type of timeout (turn_timeout, match_timeout, consecutive_timeouts)
 * @property consecutive_timeouts - Number of consecutive timeouts for this user
 * @property match_type - Type of match (ranked or casual)
 * @property turn - Turn number when timeout occurred
 * @property turn_duration_ms - Duration of the timed-out turn in milliseconds
 */
export interface TimeoutEvent {
  event_id: string;
  match_id: string;
  timestamp: number;
  timed_out_user_id: string;
  opponent_id: string;
  timeout_type: 'turn_timeout' | 'match_timeout' | 'consecutive_timeouts';
  consecutive_timeouts: number;
  match_type: 'ranked' | 'casual';
  turn: number;
  turn_duration_ms: number;
}

/**
 * Ranking delta event data.
 *
 * @property event_id - Unique identifier for this event
 * @property match_id - ID of the match
 * @property timestamp - When the ranking change occurred
 * @property winner_id - ID of match winner
 * @property loser_id - ID of match loser
 * @property winner_old_rank - Winner's rank before match
 * @property winner_new_rank - Winner's rank after match
 * @property winner_rank_change - Winner's rank change (positive for gain, negative for loss)
 * @property loser_old_rank - Loser's rank before match
 * @property loser_new_rank - Loser's rank after match
 * @property loser_rank_change - Loser's rank change (positive for gain, negative for loss)
 * @property match_type - Type of match (ranked or casual)
 * @property is_punch_up - Whether this was a punch-up match
 * @property winner_old_season_position - Winner's season position before match
 * @property winner_new_season_position - Winner's season position after match
 * @property loser_old_season_position - Loser's season position before match
 * @property loser_new_season_position - Loser's season position after match
 * @property season_id - ID of the season
 */
export interface RankingDeltaEvent {
  event_id: string;
  match_id: string;
  timestamp: number;
  winner_id: string;
  loser_id: string;
  winner_old_rank: number;
  winner_new_rank: number;
  winner_rank_change: number;
  loser_old_rank: number;
  loser_new_rank: number;
  loser_rank_change: number;
  match_type: 'ranked' | 'casual';
  is_punch_up: boolean;
  winner_old_season_position: number;
  winner_new_season_position: number;
  loser_old_season_position: number;
  loser_new_season_position: number;
  season_id: string;
}

/**
 * Punch-up underdog loss event (issue #864 / LC-T3).
 *
 * Emitted for every settled punch-up underdog loss so reviewers can audit
 * amplified deductions and correlate them with the anti-abuse watch verdict.
 *
 * @property event_id - Unique identifier for this event
 * @property match_id - ID of the settled match
 * @property timestamp - Settlement timestamp (ms since epoch)
 * @property season_id - Season the ladder rating belongs to
 * @property loser_id - Underdog who lost the punch-up wager
 * @property winner_id - Favorite who won the punch-up
 * @property loser_old_rank - Underdog's ladder rating before settlement
 * @property loser_new_rank - Underdog's ladder rating after settlement
 * @property loser_rank_change - Elo delta applied to the underdog (negative)
 * @property loser_xp_gained - XP granted to the underdog (strictly positive)
 * @property winner_rank_change - Elo delta applied to the winner
 * @property amplified - Whether the 2x-K amplified deduction was applied
 * @property winner_k_factor - K-factor used for the winner's Elo gain
 * @property loser_k_factor - K-factor used for the loser's deduction
 * @property end_reason - Server-declared match end reason
 * @property watch - Anti-abuse watch verdict for this loss (LC-T3)
 */
export interface PunchUpLossEvent {
  event_id: string;
  match_id: string;
  timestamp: number;
  season_id: string;
  loser_id: string;
  winner_id: string;
  loser_old_rank: number;
  loser_new_rank: number;
  loser_rank_change: number;
  loser_xp_gained: number;
  winner_rank_change: number;
  amplified: boolean;
  winner_k_factor: number;
  loser_k_factor: number;
  end_reason: string;
  watch: {
    flagged: boolean;
    reason: string;
    pair_loss_count: number;
    player_loss_count: number;
  };
}

/**
 * Fairness analytics summary for querying.
 */
export interface FairnessSummary {
  hit_resolution_stats: {
    total_hits: number;
    total_misses: number;
    total_critical_hits: number;
    avg_damage: number;
  };
  disconnect_stats: {
    total_disconnects: number;
    disconnects_by_reason: Record<string, number>;
    disconnects_when_winning: number;
  };
  timeout_stats: {
    total_timeouts: number;
    timeouts_by_type: Record<string, number>;
    avg_consecutive_timeouts: number;
  };
  ranking_stats: {
    total_matches: number;
    avg_rank_change: number;
    max_positive_change: number;
    max_negative_change: number;
  };
  period_start: number;
  period_end: number;
}

// --- Helper Functions ---

/**
 * Generates a unique event ID.
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Logs a hit resolution event to storage.
 *
 * @param nk - Nakama runtime module
 * @param event - Hit resolution event data
 */
export async function logHitResolution(
  nk: Runtime.Nakama,
  event: HitResolutionEvent
): Promise<void> {
  try {
    await nk.storageWrite([
      {
        collection: COLLECTION_HIT_RESOLUTION,
        key: event.event_id,
        userId: '00000000-0000-0000-0000-000000000000', // System user
        value: toStorageValue(event),
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    logger.debug(
      'Hit resolution logged: match=%s hit=%s damage=%d',
      event.match_id,
      event.hit,
      event.damage
    );

    // Log audit trail
    await logAudit(
      nk,
      '00000000-0000-0000-0000-000000000000',
      null,
      'hit_resolution_logged',
      'fairness_telemetry',
      {
        event_id: event.event_id,
        match_id: event.match_id,
        hit: event.hit,
        damage: event.damage,
      },
      'success'
    );
  } catch (error) {
    logger.error('Failed to log hit resolution', { error, matchId: event.match_id });
  }
}

/**
 * Logs a disconnect event to storage.
 *
 * @param nk - Nakama runtime module
 * @param event - Disconnect event data
 */
export async function logDisconnect(nk: Runtime.Nakama, event: DisconnectEvent): Promise<void> {
  try {
    await nk.storageWrite([
      {
        collection: COLLECTION_DISCONNECTS,
        key: event.event_id,
        userId: '00000000-0000-0000-0000-000000000000',
        value: toStorageValue(event),
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    logger.debug(
      'Disconnect logged: match=%s user=%s reason=%s',
      event.match_id,
      event.user_id,
      event.disconnect_reason
    );

    // Log audit trail
    await logAudit(
      nk,
      '00000000-0000-0000-0000-000000000000',
      null,
      'disconnect_logged',
      'fairness_telemetry',
      {
        event_id: event.event_id,
        match_id: event.match_id,
        user_id: event.user_id,
        reason: event.disconnect_reason,
      },
      'success'
    );
  } catch (error) {
    logger.error('Failed to log disconnect', { error, matchId: event.match_id });
  }
}

/**
 * Logs a timeout event to storage.
 *
 * @param nk - Nakama runtime module
 * @param event - Timeout event data
 */
export async function logTimeout(nk: Runtime.Nakama, event: TimeoutEvent): Promise<void> {
  try {
    await nk.storageWrite([
      {
        collection: COLLECTION_TIMEOUTS,
        key: event.event_id,
        userId: '00000000-0000-0000-0000-000000000000',
        value: toStorageValue(event),
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    logger.debug(
      'Timeout logged: match=%s user=%s type=%s',
      event.match_id,
      event.timed_out_user_id,
      event.timeout_type
    );

    // Log audit trail
    await logAudit(
      nk,
      '00000000-0000-0000-0000-000000000000',
      null,
      'timeout_logged',
      'fairness_telemetry',
      {
        event_id: event.event_id,
        match_id: event.match_id,
        timed_out_user_id: event.timed_out_user_id,
        timeout_type: event.timeout_type,
      },
      'success'
    );
  } catch (error) {
    logger.error('Failed to log timeout', { error, matchId: event.match_id });
  }
}

/**
 * Logs a ranking delta event to storage.
 *
 * @param nk - Nakama runtime module
 * @param event - Ranking delta event data
 */
export async function logRankingDelta(nk: Runtime.Nakama, event: RankingDeltaEvent): Promise<void> {
  try {
    await nk.storageWrite([
      {
        collection: COLLECTION_RANKING_DELTAS,
        key: event.event_id,
        userId: '00000000-0000-0000-0000-000000000000',
        value: toStorageValue(event),
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    logger.debug(
      'Ranking delta logged: match=%s winner_change=%d loser_change=%d',
      event.match_id,
      event.winner_rank_change,
      event.loser_rank_change
    );

    // Log audit trail
    await logAudit(
      nk,
      '00000000-0000-0000-0000-000000000000',
      null,
      'ranking_delta_logged',
      'fairness_telemetry',
      {
        event_id: event.event_id,
        match_id: event.match_id,
        winner_id: event.winner_id,
        loser_id: event.loser_id,
        winner_rank_change: event.winner_rank_change,
        loser_rank_change: event.loser_rank_change,
      },
      'success'
    );
  } catch (error) {
    logger.error('Failed to log ranking delta', { error, matchId: event.match_id });
  }
}

/**
 * Logs a punch-up underdog loss event to storage for LC-T3 review
 * (issue #864). Every settled punch-up loss is emitted, flagged or not, so
 * the amplified-deduction trail is auditable end to end.
 *
 * @param nk - Nakama runtime module
 * @param event - Punch-up loss event data
 */
export async function logPunchUpLoss(nk: Runtime.Nakama, event: PunchUpLossEvent): Promise<void> {
  try {
    await nk.storageWrite([
      {
        collection: COLLECTION_PUNCH_UP_LOSSES,
        key: event.event_id,
        userId: '00000000-0000-0000-0000-000000000000',
        value: toStorageValue(event),
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    logger.debug(
      'Punch-up loss logged: match=%s loser=%s rank_change=%d amplified=%s watch_flagged=%s',
      event.match_id,
      event.loser_id,
      event.loser_rank_change,
      String(event.amplified),
      String(event.watch.flagged)
    );

    // Log audit trail
    await logAudit(
      nk,
      '00000000-0000-0000-0000-000000000000',
      null,
      'punch_up_loss_logged',
      'fairness_telemetry',
      {
        event_id: event.event_id,
        match_id: event.match_id,
        loser_id: event.loser_id,
        winner_id: event.winner_id,
        loser_rank_change: event.loser_rank_change,
        amplified: event.amplified,
        watch_reason: event.watch.reason,
      },
      'success'
    );
  } catch (error) {
    logger.error('Failed to log punch-up loss', { error, matchId: event.match_id });
  }
}

/**
 * Query interface for fairness telemetry.
 */
export interface FairnessQuery {
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
  match_id?: string;
  user_id?: string;
  limit?: number;
}

/**
 * Retrieves fairness telemetry summary for a given date range.
 *
 * @param nk - Nakama runtime module
 * @param query - Query parameters
 * @returns Fairness summary data
 */
export async function getFairnessSummary(
  nk: Runtime.Nakama,
  query: FairnessQuery
): Promise<FairnessSummary> {
  const startTime = query.start_date
    ? new Date(query.start_date).getTime()
    : Date.now() - 7 * 24 * 60 * 60 * 1000; // Default to 7 days ago
  const endTime = query.end_date ? new Date(query.end_date).getTime() : Date.now();

  // Fetch hit resolution data
  const hitObjects = await nk.storageRead([
    {
      collection: COLLECTION_HIT_RESOLUTION,
      key: '*',
      userId: '00000000-0000-0000-0000-000000000000',
    },
  ]);

  // Fetch disconnect data
  const disconnectObjects = await nk.storageRead([
    {
      collection: COLLECTION_DISCONNECTS,
      key: '*',
      userId: '00000000-0000-0000-0000-000000000000',
    },
  ]);

  // Fetch timeout data
  const timeoutObjects = await nk.storageRead([
    {
      collection: COLLECTION_TIMEOUTS,
      key: '*',
      userId: '00000000-0000-0000-0000-000000000000',
    },
  ]);

  // Fetch ranking delta data
  const rankingObjects = await nk.storageRead([
    {
      collection: COLLECTION_RANKING_DELTAS,
      key: '*',
      userId: '00000000-0000-0000-0000-000000000000',
    },
  ]);

  // Filter by date range
  const filteredHits = hitObjects
    .map((obj) => obj.value as unknown as HitResolutionEvent)
    .filter((event) => event.timestamp >= startTime && event.timestamp <= endTime);

  const filteredDisconnects = disconnectObjects
    .map((obj) => obj.value as unknown as DisconnectEvent)
    .filter((event) => event.timestamp >= startTime && event.timestamp <= endTime);

  const filteredTimeouts = timeoutObjects
    .map((obj) => obj.value as unknown as TimeoutEvent)
    .filter((event) => event.timestamp >= startTime && event.timestamp <= endTime);

  const filteredRankings = rankingObjects
    .map((obj) => obj.value as unknown as RankingDeltaEvent)
    .filter((event) => event.timestamp >= startTime && event.timestamp <= endTime);

  // Calculate hit resolution stats
  const hitResolutionStats = {
    total_hits: filteredHits.filter((h) => h.hit).length,
    total_misses: filteredHits.filter((h) => !h.hit).length,
    total_critical_hits: filteredHits.filter((h) => h.is_crit).length,
    avg_damage:
      filteredHits.length > 0
        ? filteredHits.reduce((sum, h) => sum + h.damage, 0) / filteredHits.length
        : 0,
  };

  // Calculate disconnect stats
  const disconnectsByReason: Record<string, number> = {};
  for (const dc of filteredDisconnects) {
    disconnectsByReason[dc.disconnect_reason] =
      (disconnectsByReason[dc.disconnect_reason] || 0) + 1;
  }

  const disconnectStats = {
    total_disconnects: filteredDisconnects.length,
    disconnects_by_reason: disconnectsByReason,
    disconnects_when_winning: filteredDisconnects.filter((dc) => dc.was_winning).length,
  };

  // Calculate timeout stats
  const timeoutsByType: Record<string, number> = {};
  let totalConsecutiveTimeouts = 0;
  for (const to of filteredTimeouts) {
    timeoutsByType[to.timeout_type] = (timeoutsByType[to.timeout_type] || 0) + 1;
    totalConsecutiveTimeouts += to.consecutive_timeouts;
  }

  const timeoutStats = {
    total_timeouts: filteredTimeouts.length,
    timeouts_by_type: timeoutsByType,
    avg_consecutive_timeouts:
      filteredTimeouts.length > 0 ? totalConsecutiveTimeouts / filteredTimeouts.length : 0,
  };

  // Calculate ranking stats
  let totalRankChange = 0;
  let maxPositiveChange = 0;
  let maxNegativeChange = 0;
  for (const rd of filteredRankings) {
    const winnerChange = rd.winner_rank_change;
    const loserChange = rd.loser_rank_change;

    totalRankChange += Math.abs(winnerChange) + Math.abs(loserChange);
    maxPositiveChange = Math.max(maxPositiveChange, winnerChange, loserChange);
    maxNegativeChange = Math.min(maxNegativeChange, winnerChange, loserChange);
  }

  const rankingStats = {
    total_matches: filteredRankings.length,
    avg_rank_change:
      filteredRankings.length > 0 ? totalRankChange / (filteredRankings.length * 2) : 0,
    max_positive_change: maxPositiveChange,
    max_negative_change: maxNegativeChange,
  };

  return {
    hit_resolution_stats: hitResolutionStats,
    disconnect_stats: disconnectStats,
    timeout_stats: timeoutStats,
    ranking_stats: rankingStats,
    period_start: startTime,
    period_end: endTime,
  };
}

/**
 * RPC handler for logging hit resolution events.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
export async function rpcLogHitResolution(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.debug('LogHitResolution RPC called');

  const validation = validatePayload<HitResolutionEvent>(
    ZodSchemas.hit_resolution,
    payload,
    'hit_resolution'
  );
  if (!validation.success) {
    return createValidationErrorResponse('hit_resolution', validation.error);
  }

  // Ensure event ID is set
  if (!validation.data.event_id) {
    validation.data.event_id = generateEventId();
  }

  await logHitResolution(nk, validation.data);

  return JSON.stringify({
    success: true,
    event_id: validation.data.event_id,
  });
}

/**
 * RPC handler for logging disconnect events.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
export async function rpcLogDisconnect(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.debug('LogDisconnect RPC called');

  const validation = validatePayload<DisconnectEvent>(
    ZodSchemas.disconnect_event,
    payload,
    'disconnect_event'
  );
  if (!validation.success) {
    return createValidationErrorResponse('disconnect_event', validation.error);
  }

  // Ensure event ID is set
  if (!validation.data.event_id) {
    validation.data.event_id = generateEventId();
  }

  await logDisconnect(nk, validation.data);

  return JSON.stringify({
    success: true,
    event_id: validation.data.event_id,
  });
}

/**
 * RPC handler for logging timeout events.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
export async function rpcLogTimeout(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.debug('LogTimeout RPC called');

  const validation = validatePayload<TimeoutEvent>(
    ZodSchemas.timeout_event,
    payload,
    'timeout_event'
  );
  if (!validation.success) {
    return createValidationErrorResponse('timeout_event', validation.error);
  }

  // Ensure event ID is set
  if (!validation.data.event_id) {
    validation.data.event_id = generateEventId();
  }

  await logTimeout(nk, validation.data);

  return JSON.stringify({
    success: true,
    event_id: validation.data.event_id,
  });
}

/**
 * RPC handler for logging ranking delta events.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
export async function rpcLogRankingDelta(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.debug('LogRankingDelta RPC called');

  const validation = validatePayload<RankingDeltaEvent>(
    ZodSchemas.ranking_delta_event,
    payload,
    'ranking_delta_event'
  );
  if (!validation.success) {
    return createValidationErrorResponse('ranking_delta_event', validation.error);
  }

  // Ensure event ID is set
  if (!validation.data.event_id) {
    validation.data.event_id = generateEventId();
  }

  await logRankingDelta(nk, validation.data);

  return JSON.stringify({
    success: true,
    event_id: validation.data.event_id,
  });
}

/**
 * RPC handler for querying fairness telemetry summary.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
export async function rpcGetFairnessSummary(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.debug('GetFairnessSummary RPC called');

  const validation = validatePayload<FairnessQuery>(
    ZodSchemas.fairness_query,
    payload,
    'fairness_query'
  );
  if (!validation.success) {
    return createValidationErrorResponse('fairness_query', validation.error);
  }

  try {
    const summary = await getFairnessSummary(nk, validation.data);

    return JSON.stringify({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error('Failed to get fairness summary', { error });
    return JSON.stringify({
      success: false,
      error: 'Failed to retrieve fairness summary',
    });
  }
}

/**
 * Registers all fairness telemetry RPC endpoints.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerFairnessTelemetryEndpoints(initializer: Runtime.Initializer): void {
  // Event logging endpoints
  registerRpcWithMetrics(
    initializer,
    'armored_archer/log_hit_resolution',
    'log_hit_resolution',
    rpcLogHitResolution
  );
  registerRpcWithMetrics(
    initializer,
    'armored_archer/log_disconnect',
    'log_disconnect',
    rpcLogDisconnect
  );
  registerRpcWithMetrics(initializer, 'armored_archer/log_timeout', 'log_timeout', rpcLogTimeout);
  registerRpcWithMetrics(
    initializer,
    'armored_archer/log_ranking_delta',
    'log_ranking_delta',
    rpcLogRankingDelta
  );

  // Analytics query endpoints
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_fairness_summary',
    'get_fairness_summary',
    rpcGetFairnessSummary
  );
}
