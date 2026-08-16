/**
 * Matchmaker module.
 * @fileoverview Implements matchmaking and ranking for PvP matches.
 */

import { TurnData, PlayerStats } from '../types/game';
import { Runtime } from '../types/nakama';
import { safeParse } from '../utils/safeParse';
import {
  isPlayerFlagged,
  getFlagReason,
  recordMatchResult,
  getPlayerMatchHistory,
} from './anti_cheat';
import { logAudit } from './audit';
import { applyCurrencyDelta, type CurrencyDelta } from './currency';
import {
  logRankingDelta,
  logPunchUpLoss,
  type RankingDeltaEvent,
  type PunchUpLossEvent,
} from './fairness_telemetry';
import { incrementPunchUpLoss, incrementPunchUpWatchFlag } from './metrics';
import { recordPunchUpLossAndEvaluate } from './punchup_watch';
import {
  checkRateLimit,
  checkMatchCooldown,
  recordMatchAction,
  checkConcurrentMatchLimit,
  checkDuplicateTurn,
  cleanupTurnTracking,
  detectWinTrading,
} from './rate_limit';
import {
  getCurrentSeason,
  applyEloUpdates,
  getEloKFactors,
  getLeaderboardEntry,
  recordPlayerActivity,
  SeasonInfo,
} from './season_system';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import { getLevelForXp } from './xp_manager';

/**
 * PvP match data structure.
 *
 * @property match_id - Unique identifier for the match
 * @property creator_id - ID of the match creator
 * @property opponent_id - ID of the opponent
 * @property creator_rank - Rank of the creator
 * @property opponent_rank - Rank of the opponent
 * @property match_type - Type of match ("ranked" or "casual")
 * @property is_punch_up - Whether this is a punch-up match
 * @property status - Current match status
 * @property created_at - Timestamp when match was created
 * @property updated_at - Timestamp when match was last updated
 * @property creator_turn_data - Optional turn data for creator
 * @property opponent_turn_data - Optional turn data for opponent
 * @property winner - Optional winner if match completed
 * @property expires_at - Timestamp when match will be considered abandoned/expired
 * @property last_turn_timestamp - Timestamp of the last turn action
 * @property current_turn - Current turn number (1-based)
 * @property current_player - User ID of player whose turn it is
 * @property turn_time_limit_ms - Time limit per turn in milliseconds
 * @property creator_health - Creator's current HP
 * @property opponent_health - Opponent's current HP
 * @property max_turns - Maximum number of turns before forced end
 * @property creator_consecutive_timeouts - Number of consecutive timeouts by creator
 * @property opponent_consecutive_timeouts - Number of consecutive timeouts by opponent
 */
export interface PvPMatch {
  match_id: string;
  creator_id: string;
  opponent_id: string;
  creator_rank: number;
  opponent_rank: number;
  match_type: 'ranked' | 'casual';
  is_punch_up: boolean;
  status: 'pending' | 'active' | 'completed' | 'expired';
  created_at: number;
  updated_at: number;
  creator_turn_data?: TurnData;
  opponent_turn_data?: TurnData;
  winner?: string;
  /**
   * How the server reached a terminal state for this match (health_zero,
   * forfeit, timeout, disconnect, max_turns, draw). Set by server-side
   * resolution paths only — never by client input (ADR-0002).
   */
  end_reason?: MatchEndReason;
  /**
   * Timestamp of the settlement run that applied Elo/XP/rewards. Its presence
   * makes re-settlement attempts idempotent (double-settlement guard).
   */
  settled_at?: number;
  expires_at: number;
  last_turn_timestamp: number;
  // Async duel lifecycle fields
  current_turn: number;
  current_player: string;
  turn_time_limit_ms: number;
  creator_health: number;
  opponent_health: number;
  max_turns: number;
  creator_consecutive_timeouts: number;
  opponent_consecutive_timeouts: number;
}

/**
 * Server-side reason a match reached a terminal state. Mirrors the resolution
 * semantics of combat_system.ts (health-zero, forfeit, timeout) plus the
 * turn engine's max-turns/draw outcomes.
 */
export type MatchEndReason =
  | 'health_zero'
  | 'forfeit'
  | 'timeout'
  | 'disconnect'
  | 'max_turns'
  | 'draw';

/**
 * Server-declared terminal state of a match, derived exclusively from
 * server-held state (never from client-asserted payloads).
 *
 * @property kind - 'already_settled' (settlement already ran),
 *                  'winner' (terminal winner declared/resolvable),
 *                  'draw' (terminal with no winner)
 * @property winner - Server-declared winner user ID (absent for draws)
 * @property endReason - Server-side reason the match reached terminal state
 * @property settledAt - Settlement timestamp when kind is 'already_settled'
 */
export interface ServerTerminalState {
  kind: 'already_settled' | 'winner' | 'draw';
  winner?: string;
  endReason: MatchEndReason;
  settledAt?: number;
}

/**
 * Request payload for creating a match.
 *
 * @property match_type - Type of match to create
 * @property is_punch_up - Whether to allow punch-up matches
 * @property target_opponent_id - Optional specific opponent to challenge
 */
export interface CreateMatchRequest {
  match_type: 'ranked' | 'casual';
  is_punch_up?: boolean;
  target_opponent_id?: string;
}

/**
 * Request payload for accepting a match.
 *
 * @property match_id - ID of the match to accept
 */
export interface AcceptMatchRequest {
  match_id: string;
}

/**
 * Request payload for listing matches.
 *
 * @property match_type - Optional filter by match type
 * @property min_rank - Optional minimum rank filter
 * @property max_rank - Optional maximum rank filter
 * @property limit - Maximum number of matches to return
 */
export interface ListMatchesRequest {
  match_type?: 'ranked' | 'casual';
  min_rank?: number;
  max_rank?: number;
  limit?: number;
}

/**
 * Request payload for completing a match.
 *
 * ADR-0002: the client-supplied winner/loser is advisory/logging only. The
 * settlement winner is derived exclusively from server match state; these
 * fields are accepted for backwards compatibility with existing client call
 * sites and are never honored for settlement.
 *
 * @property match_id - ID of the match to settle
 * @property winner_id - Advisory: client-asserted winner (ignored for settlement)
 * @property loser_id - Advisory: client-asserted loser (ignored for settlement)
 * @property is_punch_up - Advisory: client-asserted punch-up flag (server record wins)
 */
export interface CompleteMatchRequest {
  match_id: string;
  winner_id?: string;
  loser_id?: string;
  is_punch_up?: boolean;
}

/**
 * Registers the list matches RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcListMatches(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/list_matches', rpcListMatches);
}

/**
 * Checks whether a match passes the listing filter criteria.
 *
 * @param match - The PvP match to check
 * @param userId - The requesting user's ID (to exclude own matches)
 * @param request - The filter parameters from the list request
 * @returns True if the match should be included in results
 */
function matchPassesFilter(match: PvPMatch, userId: string, request: ListMatchesRequest): boolean {
  if (match.status !== 'pending') return false;
  if (request.match_type && match.match_type !== request.match_type) return false;
  if (match.creator_id === userId) return false;
  if (request.min_rank !== undefined && match.creator_rank < request.min_rank) return false;
  if (request.max_rank !== undefined && match.creator_rank > request.max_rank) return false;
  return true;
}

/**
 * Lists available PvP matches with filtering options.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing filter parameters
 * @returns JSON string with list of matches and player rank
 *
 * @example
 * // Request payload
 * { "match_type": "ranked", "limit": 10 }
 *
 * // Response
 * {
 *   "success": true,
 *   "matches": [ ... ],
 *   "player_rank": 15,
 *   "total": 8
 * }
 */
export function rpcListMatches(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('List matches called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.list_matches, payload, 'list_matches');
  if (!validation.success) {
    return createValidationErrorResponse('list_matches', validation.error);
  }

  const request = validation.data || {};
  const limit = request.limit || 20;

  const objects = nk.storageRead([
    {
      collection: 'player_stats',
      key: ctx.userId,
      userId: ctx.userId,
    },
  ]);

  if (objects.length === 0) {
    return JSON.stringify({
      error: 'Player stats not found',
    });
  }

  const playerStatsResult = safeParse<PlayerStats>(
    objects[0].value,
    null,
    logger,
    'rpcListMatches:playerStats'
  );
  if (!playerStatsResult.success || !playerStatsResult.data) {
    return JSON.stringify({ error: 'Failed to parse player stats' });
  }
  const playerStats = playerStatsResult.data;
  const playerRank = calculateRank(playerStats);

  const matches = nk.storageList(ctx.userId, 'pvp_matches', limit, '', '');

  const filteredMatches: PvPMatch[] = [];

  for (const object of matches) {
    const matchResult = safeParse<PvPMatch>(object.value, null, logger, 'rpcListMatches:match');
    if (!matchResult.success || !matchResult.data) {
      logger.warn('Skipping corrupted match record for user: %s', ctx.userId);
      continue;
    }
    const match = matchResult.data;

    if (matchPassesFilter(match, ctx.userId, request)) {
      filteredMatches.push(match);
    }
  }

  filteredMatches.sort((a, b) => b.created_at - a.created_at);

  return JSON.stringify({
    success: true,
    matches: filteredMatches.slice(0, limit),
    player_rank: playerRank,
    total: filteredMatches.length,
  });
}

/**
 * Registers the create match RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcCreateMatch(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/create_match', rpcCreateMatch);
}

/**
 * Creates a new PvP match with optional direct challenge.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match creation parameters
 * @returns JSON string with created match data
 *
 * @example
 * // Request payload
 * { "match_type": "ranked", "target_opponent_id": "user_456" }
 *
 * // Response
 * {
 *   "success": true,
 *   "match": { ... }
 * }
 */
// eslint-disable-next-line complexity
export function rpcCreateMatch(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Create match called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.create_match, payload, 'create_match');
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'create_match',
      'pvp_matches',
      { match_type: 'unknown', is_punch_up: false, target_opponent_id: 'none' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('create_match', validation.error);
  }

  // Anti-abuse: Check rate limiting
  const rateLimitCheck = checkRateLimit(ctx.userId, 'create_match');
  if (!rateLimitCheck.allowed) {
    logger.warn(
      'Create match rate limited for user: %s, reason: %s',
      ctx.userId,
      rateLimitCheck.reason
    );
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'create_match',
      'pvp_matches',
      { reason: rateLimitCheck.reason },
      'failure',
      'rate_limit'
    );
    return JSON.stringify({
      error: 'Rate limit exceeded. Please try again later.',
      retry_after_ms: rateLimitCheck.retryAfter,
    });
  }

  // Anti-abuse: Check cooldown
  const cooldownCheck = checkMatchCooldown(ctx.userId, 'create');
  if (!cooldownCheck.allowed) {
    logger.warn('Create match cooldown for user: %s', ctx.userId);
    return JSON.stringify({
      error: 'Please wait before creating another match.',
      retry_after_ms: cooldownCheck.retryAfter,
    });
  }

  // Anti-abuse: Check concurrent match limit
  const concurrentCheck = checkConcurrentMatchLimit(ctx.userId);
  if (!concurrentCheck.allowed) {
    logger.warn('Concurrent match limit reached for user: %s', ctx.userId);
    return JSON.stringify({
      error: `You have ${concurrentCheck.activeCount} active matches. Maximum is ${concurrentCheck.limit}. Complete or abandon some matches first.`,
      active_matches: concurrentCheck.activeCount,
      limit: concurrentCheck.limit,
    });
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
    return JSON.stringify({
      error: 'Player stats not found',
    });
  }

  const playerStatsResult = safeParse<PlayerStats>(
    objects[0].value,
    null,
    logger,
    'rpcCreateMatch:playerStats'
  );
  if (!playerStatsResult.success || !playerStatsResult.data) {
    return JSON.stringify({ error: 'Failed to parse player stats' });
  }
  const playerStats = playerStatsResult.data;
  const playerRank = calculateRank(playerStats);

  if (request.target_opponent_id) {
    const targetStats = nk.storageRead([
      {
        collection: 'player_stats',
        key: request.target_opponent_id,
        userId: request.target_opponent_id,
      },
    ]);

    if (targetStats.length === 0) {
      return JSON.stringify({
        error: 'Target player not found',
      });
    }

    const targetPlayerStatsResult = safeParse<PlayerStats>(
      targetStats[0].value,
      null,
      logger,
      'rpcCreateMatch:targetStats'
    );
    if (!targetPlayerStatsResult.success || !targetPlayerStatsResult.data) {
      return JSON.stringify({ error: 'Failed to parse target player stats' });
    }
    const targetPlayerStats = targetPlayerStatsResult.data;
    const targetRank = calculateRank(targetPlayerStats);

    // Auto-detect punch-up eligibility
    const punchUpInfo = isPunchUpMatch(
      playerRank,
      targetRank,
      ctx.userId,
      request.target_opponent_id
    );

    // Validate punch-up eligibility
    const validationError = validatePunchUpEligibility(
      playerRank,
      targetRank,
      punchUpInfo,
      request.is_punch_up || false
    );
    if (validationError) {
      return validationError;
    }

    const rankDiff = Math.abs(playerRank - targetRank);

    // Use auto-detected punch-up status or explicitly requested
    const isPunchUp = punchUpInfo.is_punch_up || request.is_punch_up || false;

    const match: PvPMatch = {
      match_id: generateMatchId(),
      creator_id: ctx.userId,
      opponent_id: request.target_opponent_id,
      creator_rank: playerRank,
      opponent_rank: targetRank,
      match_type: request.match_type,
      is_punch_up: isPunchUp,
      status: 'pending',
      created_at: Date.now(),
      updated_at: Date.now(),
      expires_at: Date.now() + 300000, // 5 minutes
      last_turn_timestamp: Date.now(),
      // Async duel lifecycle fields (default values for pending match)
      current_turn: 1,
      current_player: ctx.userId,
      turn_time_limit_ms: TURN_TIMEOUT_MS,
      creator_health: BASE_HEALTH,
      opponent_health: BASE_HEALTH,
      max_turns: DEFAULT_MAX_TURNS,
      creator_consecutive_timeouts: 0,
      opponent_consecutive_timeouts: 0,
    };

    nk.storageWrite([
      {
        collection: 'pvp_matches',
        key: match.match_id,
        userId: ctx.userId,
        value: JSON.stringify(match),
      },
    ]);

    // Anti-abuse: Record match creation
    recordMatchAction(ctx.userId, 'create', match.match_id);

    return JSON.stringify({
      success: true,
      match: match,
      punch_up_info: isPunchUp
        ? {
            is_punch_up: true,
            rank_difference: rankDiff,
            underdog_id: punchUpInfo.underdog_id,
            underdog_rank: punchUpInfo.underdog_rank,
            favorite_rank: punchUpInfo.favorite_rank,
            reward_multiplier: punchUpInfo.reward_multiplier,
            description: generatePunchUpDescription(punchUpInfo),
          }
        : null,
    });
  } else {
    const now = Date.now();
    // Pending matches expire after 24 hours
    const PENDING_MATCH_EXPIRY_MS = 24 * 60 * 60 * 1000;
    const match: PvPMatch = {
      match_id: generateMatchId(),
      creator_id: ctx.userId,
      opponent_id: '',
      creator_rank: playerRank,
      opponent_rank: 0,
      match_type: request.match_type,
      is_punch_up: false,
      status: 'pending',
      created_at: now,
      updated_at: now,
      expires_at: now + PENDING_MATCH_EXPIRY_MS,
      last_turn_timestamp: now,
      // Async duel lifecycle fields (default values for pending match)
      current_turn: 1,
      current_player: ctx.userId,
      turn_time_limit_ms: TURN_TIMEOUT_MS,
      creator_health: BASE_HEALTH,
      opponent_health: BASE_HEALTH,
      max_turns: DEFAULT_MAX_TURNS,
      creator_consecutive_timeouts: 0,
      opponent_consecutive_timeouts: 0,
    };

    nk.storageWrite([
      {
        collection: 'pvp_matches',
        key: match.match_id,
        userId: ctx.userId,
        value: JSON.stringify(match),
      },
    ]);

    // Anti-abuse: Record match creation
    recordMatchAction(ctx.userId, 'create', match.match_id);

    return JSON.stringify({
      success: true,
      match: match,
    });
  }
}

/**
 * Registers the accept match RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcAcceptMatch(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/accept_match', rpcAcceptMatch);
}

/**
 * Accepts a pending PvP match and starts the game.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match_id
 * @returns JSON string with accepted match data
 *
 * @example
 * // Request payload
 * { "match_id": "match_123" }
 *
 * // Response
 * {
 *   "success": true,
 *   "match": { ... }
 * }
 */
// eslint-disable-next-line complexity
export function rpcAcceptMatch(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Accept match called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.accept_match, payload, 'accept_match');
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'accept_match',
      'pvp_matches',
      { match_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('accept_match', validation.error);
  }

  const request = validation.data;

  // Anti-abuse: Check rate limiting
  const rateLimitCheck = checkRateLimit(ctx.userId, 'accept_match');
  if (!rateLimitCheck.allowed) {
    logger.warn(
      'Accept match rate limited for user: %s, reason: %s',
      ctx.userId,
      rateLimitCheck.reason
    );
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'accept_match',
      'pvp_matches',
      { reason: rateLimitCheck.reason },
      'failure',
      'rate_limit'
    );
    return JSON.stringify({
      error: 'Rate limit exceeded. Please try again later.',
      retry_after_ms: rateLimitCheck.retryAfter,
    });
  }

  // Anti-abuse: Check cooldown
  const cooldownCheck = checkMatchCooldown(ctx.userId, 'accept');
  if (!cooldownCheck.allowed) {
    logger.warn('Accept match cooldown for user: %s', ctx.userId);
    return JSON.stringify({
      error: 'Please wait before accepting another match.',
      retry_after_ms: cooldownCheck.retryAfter,
    });
  }

  // Anti-abuse: Check concurrent match limit
  const concurrentCheck = checkConcurrentMatchLimit(ctx.userId);
  if (!concurrentCheck.allowed) {
    logger.warn('Concurrent match limit reached for user: %s', ctx.userId);
    return JSON.stringify({
      error: `You have ${concurrentCheck.activeCount} active matches. Complete or abandon some matches first.`,
      active_matches: concurrentCheck.activeCount,
      limit: concurrentCheck.limit,
    });
  }

  const objects = nk.storageRead([
    {
      collection: 'pvp_matches',
      key: request.match_id,
      userId: ctx.userId,
    },
  ]);

  if (objects.length === 0) {
    return JSON.stringify({
      error: 'Match not found',
    });
  }

  const matchResult = safeParse<PvPMatch>(objects[0].value, null, logger, 'rpcAcceptMatch:match');
  if (!matchResult.success || !matchResult.data) {
    return JSON.stringify({ error: 'Failed to parse match data' });
  }
  const match: PvPMatch = matchResult.data;

  if (match.creator_id === ctx.userId) {
    return JSON.stringify({
      error: 'Cannot accept your own match',
    });
  }

  if (match.status !== 'pending') {
    return JSON.stringify({
      error: 'Match is no longer available',
    });
  }

  const playerObjects = nk.storageRead([
    {
      collection: 'player_stats',
      key: ctx.userId,
      userId: ctx.userId,
    },
  ]);

  if (playerObjects.length === 0) {
    return JSON.stringify({
      error: 'Player stats not found',
    });
  }

  const playerStatsResult = safeParse<PlayerStats>(
    playerObjects[0].value,
    null,
    logger,
    'rpcAcceptMatch:playerStats'
  );
  if (!playerStatsResult.success || !playerStatsResult.data) {
    return JSON.stringify({ error: 'Failed to parse player stats' });
  }
  const playerStats = playerStatsResult.data;
  const now = Date.now();
  // Active matches expire after 7 days of inactivity
  const ACTIVE_MATCH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
  match.opponent_id = ctx.userId;
  match.opponent_rank = calculateRank(playerStats);
  match.status = 'active';
  match.updated_at = now;
  match.expires_at = now + ACTIVE_MATCH_EXPIRY_MS;
  match.last_turn_timestamp = now;

  // Initialize turn-based combat fields
  match.current_turn = 1;
  match.current_player = match.creator_id; // Creator always goes first
  match.turn_time_limit_ms = TURN_TIMEOUT_MS;
  match.creator_health = BASE_HEALTH;
  match.opponent_health = BASE_HEALTH;
  match.max_turns = DEFAULT_MAX_TURNS;
  match.creator_consecutive_timeouts = 0;
  match.opponent_consecutive_timeouts = 0;

  nk.storageWrite([
    {
      collection: 'pvp_matches',
      key: match.match_id,
      userId: match.creator_id,
      value: JSON.stringify(match),
    },
  ]);

  // Anti-abuse: Record match acceptance
  recordMatchAction(ctx.userId, 'accept', match.match_id);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'accept_match',
    'pvp_matches',
    {
      match_id: match.match_id,
      creator_id: match.creator_id,
      match_type: match.match_type,
      is_punch_up: match.is_punch_up,
    },
    'success'
  );

  return JSON.stringify({
    success: true,
    match: match,
  });
}

/**
 * Calculates a player's rank based on level and stats.
 *
 * This is the Power Rating derivation (build strength). It is recomputed
 * from player_stats on every use — matchmaking, punch-up eligibility,
 * and the consolidated get_player_rank RPC in season_leaderboard (which
 * exposes it as the explicit `power_rating` response field, issue #871).
 * It is never persisted and never decays (issue #865).
 *
 * @param playerStats - Player statistics data
 * @returns Calculated player rank
 */
export function calculateRank(playerStats: PlayerStats): number {
  const baseRank = playerStats.level * 10;
  const statsTotal =
    playerStats.stats.attack +
    playerStats.stats.defense +
    playerStats.stats.dodge +
    playerStats.stats.crit_rate;

  return Math.floor(baseRank + statsTotal / 4);
}

/**
 * Punch-up eligibility result.
 */
export interface PunchUpInfo {
  is_punch_up: boolean;
  rank_difference: number;
  underdog_rank: number;
  favorite_rank: number;
  underdog_id: string;
  reward_multiplier: number;
}

/**
 * Determines if a match is a punch-up and calculates the reward multiplier.
 * A punch-up occurs when a lower-ranked player challenges a higher-ranked opponent
 * with a significant rank difference.
 *
 * Punch-up rules:
 * - Minimum rank difference of 5 to qualify
 * - Maximum rank difference of 15 (to prevent abuse)
 * - Both players must be above minimum rank threshold (20)
 * - Reward multiplier scales with rank difference (1.2x to 2.0x)
 *
 * @param rank1 - Rank of player 1
 * @param rank2 - Rank of player 2
 * @param playerId1 - ID of player 1
 * @param playerId2 - ID of player 2
 * @returns Punch-up information including whether it's a punch-up and reward multiplier
 */
export function isPunchUpMatch(
  rank1: number,
  rank2: number,
  playerId1: string,
  playerId2: string
): PunchUpInfo {
  const rankDiff = Math.abs(rank1 - rank2);

  // Not a punch-up if rank difference is too small or too large
  if (rankDiff < PUNCH_UP_RANK_DIFF_THRESHOLD || rankDiff > PUNCH_UP_MAX_RANK_DIFF) {
    return {
      is_punch_up: false,
      rank_difference: rankDiff,
      underdog_rank: Math.min(rank1, rank2),
      favorite_rank: Math.max(rank1, rank2),
      underdog_id: rank1 < rank2 ? playerId1 : playerId2,
      reward_multiplier: 1.0,
    };
  }

  // Both players must be above minimum rank to prevent low-level abuse
  if (Math.min(rank1, rank2) < PUNCH_UP_MIN_RANK) {
    return {
      is_punch_up: false,
      rank_difference: rankDiff,
      underdog_rank: Math.min(rank1, rank2),
      favorite_rank: Math.max(rank1, rank2),
      underdog_id: rank1 < rank2 ? playerId1 : playerId2,
      reward_multiplier: 1.0,
    };
  }

  // Calculate reward multiplier based on rank difference
  // Interpolate between min and max multipliers
  const multiplierRange = PUNCH_UP_XP_MULTIPLIER_MAX - PUNCH_UP_XP_MULTIPLIER_MIN;
  const rankDiffRange = PUNCH_UP_MAX_RANK_DIFF - PUNCH_UP_RANK_DIFF_THRESHOLD;
  const normalizedDiff = (rankDiff - PUNCH_UP_RANK_DIFF_THRESHOLD) / rankDiffRange;
  const rewardMultiplier = PUNCH_UP_XP_MULTIPLIER_MIN + multiplierRange * normalizedDiff;

  return {
    is_punch_up: true,
    rank_difference: rankDiff,
    underdog_rank: Math.min(rank1, rank2),
    favorite_rank: Math.max(rank1, rank2),
    underdog_id: rank1 < rank2 ? playerId1 : playerId2,
    reward_multiplier: parseFloat(rewardMultiplier.toFixed(2)),
  };
}

/**
 * Calculates the reward penalty for a favorite player in a punch-up match.
 * Favorites receive reduced rewards proportional to the rank difference.
 *
 * @param isPunchUp - Whether this is a punch-up match
 * @param rankDifference - The absolute difference in ranks
 * @returns Multiplier to apply to favorite's rewards (0.5 to 1.0)
 */
export function calculateFavoritePenalty(isPunchUp: boolean, rankDifference: number): number {
  if (!isPunchUp) {
    return 1.0; // No penalty for normal matches
  }

  // Calculate penalty based on rank difference
  // Larger rank difference = harsher penalty
  const penaltyRange = FAVORITE_REWARD_PENALTY_MIN - FAVORITE_REWARD_PENALTY_MAX;
  const rankDiffRange = PUNCH_UP_MAX_RANK_DIFF - PUNCH_UP_RANK_DIFF_THRESHOLD;
  const normalizedDiff = Math.min(
    (rankDifference - PUNCH_UP_RANK_DIFF_THRESHOLD) / rankDiffRange,
    1.0
  );
  const penalty = FAVORITE_REWARD_PENALTY_MIN - penaltyRange * normalizedDiff;

  return parseFloat(penalty.toFixed(2));
}

/**
 * Calculates gem bonus for punch-up wins.
 * Scales with rank difference to incentivize challenging stronger opponents.
 *
 * @param rankDifference - The absolute difference in ranks
 * @returns Number of gems to award
 */
export function calculatePunchUpGemBonus(rankDifference: number): number {
  // Interpolate between min and max gem bonus
  const gemRange = PUNCH_UP_GEM_BONUS_MAX - PUNCH_UP_GEM_BONUS_MIN;
  const rankDiffRange = PUNCH_UP_MAX_RANK_DIFF - PUNCH_UP_RANK_DIFF_THRESHOLD;
  const normalizedDiff = Math.min(
    (rankDifference - PUNCH_UP_RANK_DIFF_THRESHOLD) / rankDiffRange,
    1.0
  );
  const gemBonus = PUNCH_UP_GEM_BONUS_MIN + Math.floor(gemRange * normalizedDiff);

  return gemBonus;
}

/**
 * Generates a player-friendly description of punch-up mechanics.
 *
 * @param punchUpInfo - Punch-up information
 * @returns Human-readable description
 */
export function generatePunchUpDescription(punchUpInfo: PunchUpInfo): string {
  const { rank_difference, reward_multiplier } = punchUpInfo;

  // Determine intensity level
  let intensity = 'moderate';
  if (rank_difference >= 12) intensity = 'extreme';
  else if (rank_difference >= 8) intensity = 'high';
  else if (rank_difference <= 6) intensity = 'slight';

  // Calculate gem bonus
  const gemBonus = calculatePunchUpGemBonus(rank_difference);

  // Format multiplier to always show decimal places
  const formattedMultiplier = reward_multiplier.toFixed(1);

  return (
    `Punch-up match (${intensity} difference of ${rank_difference} ranks). ` +
    `Underdogs receive ${formattedMultiplier}x XP bonus and ${gemBonus} bonus gems on win. ` +
    `Favorites receive reduced rewards (${Math.round((1 - calculateFavoritePenalty(true, rank_difference)) * 100)}% penalty).`
  );
}

/**
 * Validates punch-up eligibility and returns error response if invalid.
 *
 * @param playerRank - The challenger's rank
 * @param targetRank - The target's rank
 * @param punchUpInfo - Pre-calculated punch-up information
 * @param requestedPunchUp - Whether punch-up was explicitly requested
 * @returns Error JSON string if invalid, null if valid
 */
function validatePunchUpEligibility(
  playerRank: number,
  targetRank: number,
  punchUpInfo: PunchUpInfo,
  requestedPunchUp: boolean
): string | null {
  const rankDiff = Math.abs(playerRank - targetRank);

  // Validate rank difference constraints
  if (rankDiff > PUNCH_UP_MAX_RANK_DIFF) {
    return JSON.stringify({
      error: `Rank difference too large. Maximum allowed is ${PUNCH_UP_MAX_RANK_DIFF}.`,
      rank_difference: rankDiff,
      max_allowed: PUNCH_UP_MAX_RANK_DIFF,
    });
  }

  // If punch-up is explicitly requested but not valid, return error
  if (requestedPunchUp && !punchUpInfo.is_punch_up) {
    if (rankDiff < PUNCH_UP_RANK_DIFF_THRESHOLD) {
      return JSON.stringify({
        error: `Rank difference too small for punch-up. Minimum required is ${PUNCH_UP_RANK_DIFF_THRESHOLD}.`,
        rank_difference: rankDiff,
        min_required: PUNCH_UP_RANK_DIFF_THRESHOLD,
      });
    }
    if (Math.min(playerRank, targetRank) < PUNCH_UP_MIN_RANK) {
      return JSON.stringify({
        error: `Both players must be rank ${PUNCH_UP_MIN_RANK} or higher for punch-up.`,
        player_rank: playerRank,
        target_rank: targetRank,
        min_rank: PUNCH_UP_MIN_RANK,
      });
    }
  }

  return null;
}

/**
 * Generates a unique match ID.
 *
 * @returns Unique match identifier string
 */
export function generateMatchId(): string {
  return 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Checks if a player is flagged and returns error response if so.
 */
function checkPlayerFlagged(
  logger: Runtime.Logger,
  playerId: string,
  playerType: 'winner' | 'loser'
): string | null {
  if (isPlayerFlagged(playerId)) {
    logger.warn(
      'Complete match blocked - %s flagged: %s reason: %s',
      playerType,
      playerId,
      getFlagReason(playerId)
    );
    const errorMsg =
      playerType === 'winner'
        ? `Player is flagged for review: ${getFlagReason(playerId)}`
        : `Opponent is flagged for review: ${getFlagReason(playerId)}`;
    return JSON.stringify({
      success: false,
      error_code: 'PLAYER_FLAGGED',
      error: errorMsg,
    });
  }
  return null;
}

/**
 * Registers the complete match RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcCompleteMatch(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/complete_match', rpcCompleteMatch);
}

/**
 * Match result reward data structure.
 *
 * @property name - Name of the reward
 * @property quantity - Quantity of the reward
 * @property type - Type of reward (coin, gem, etc.)
 */
export interface MatchReward {
  name: string;
  quantity: number;
  type: 'coin' | 'gem' | 'xp';
}

/**
 * Completes a PvP match and updates player ranks using the Elo rating system.
 *
 * ADR-0002 — server-declared match settlement: the winner is derived
 * exclusively from server match state (declared winner from a server-side
 * resolution path, combat-system MatchState, health-zero, or max-turns).
 * The client-supplied `winner_id`/`loser_id` payload is advisory/logging
 * only and is never honored for settlement.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing the match settlement trigger
 * @returns JSON string with match result and rank changes
 *
 * @example
 * // Request payload (client-supplied winner is advisory only)
 * { "match_id": "match_123", "winner_id": "user_1", "loser_id": "user_2" }
 *
 * // Response (settled from server state)
 * {
 *   "success": true,
 *   "match": { ... },
 *   "winner": { "user_id": "user_1", "old_rank": 1200, "new_rank": 1220, "rank_change": 20, "xp_gained": 150, "old_season_position": 42, "new_season_position": 40, "rewards": [...] },
 *   "loser": { "user_id": "user_2", "old_rank": 1200, "new_rank": 1180, "rank_change": -20, "xp_gained": 50, "old_season_position": 43, "new_season_position": 44, "rewards": [...] },
 *   "is_punch_up": false,
 *   "end_reason": "health_zero"
 * }
 */
// eslint-disable-next-line complexity
export function rpcCompleteMatch(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Complete match called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.complete_match, payload, 'complete_match');
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'complete_match',
      'pvp_matches',
      { match_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('complete_match', validation.error);
  }

  const request = validation.data;

  // Anti-abuse: Check rate limiting
  const rateLimitCheck = checkRateLimit(ctx.userId, 'complete_match');
  if (!rateLimitCheck.allowed) {
    logger.warn(
      'Complete match rate limited for user: %s, reason: %s',
      ctx.userId,
      rateLimitCheck.reason
    );
    return JSON.stringify({
      error: 'Rate limit exceeded. Please try again later.',
      retry_after_ms: rateLimitCheck.retryAfter,
    });
  }

  // Anti-abuse: Check cooldown
  const cooldownCheck = checkMatchCooldown(ctx.userId, 'complete');
  if (!cooldownCheck.allowed) {
    logger.warn('Complete match cooldown for user: %s', ctx.userId);
    return JSON.stringify({
      error: 'Please wait before completing another match.',
      retry_after_ms: cooldownCheck.retryAfter,
    });
  }

  // Fetch the match. A 'completed' status is allowed here: server-side
  // resolution paths (combat system health-zero/forfeit/timeout) declare the
  // winner without settling Elo/XP, leaving settlement to this trigger.
  const matchResult = getAndValidateMatch(nk, ctx, request, logger, { allowCompleted: true });
  if (matchResult.error || !matchResult.match) {
    return JSON.stringify({ error: matchResult.error || 'Match not found' });
  }
  const match = matchResult.match;

  // Resolve the server-declared terminal state — the sole source of
  // winner truth (ADR-0002).
  const terminalState = resolveServerTerminalState(nk, match, logger);

  if (!terminalState) {
    logger.warn(
      'Complete match rejected - no server terminal state: match=%s, user=%s',
      match.match_id,
      ctx.userId
    );
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'complete_match',
      'pvp_matches',
      { match_id: match.match_id, match_status: match.status },
      'failure',
      'no_server_terminal_state'
    );
    return JSON.stringify({
      success: false,
      error: 'Match cannot be settled: no server-side terminal state',
      error_code: 'NO_SERVER_TERMINAL_STATE',
    });
  }

  // Idempotent double-settlement: a prior settlement already applied
  // Elo/XP/rewards — return the recorded outcome without re-settling.
  if (terminalState.kind === 'already_settled') {
    logger.info(
      'Complete match idempotent replay: match=%s, settled_at=%d',
      match.match_id,
      terminalState.settledAt
    );
    return JSON.stringify({
      success: true,
      already_settled: true,
      match_id: match.match_id,
      winner: terminalState.winner,
      end_reason: terminalState.endReason,
      settled_at: terminalState.settledAt,
    });
  }

  // Terminal draw: no winner to settle (no Elo/XP/reward application).
  if (terminalState.kind === 'draw') {
    return settleDrawMatch(nk, ctx, logger, match);
  }

  const serverWinnerId = terminalState.winner as string;
  const serverLoserId = serverWinnerId === match.creator_id ? match.opponent_id : match.creator_id;

  // Advisory logging: record client-asserted payload disagreements with the
  // server-declared outcome for telemetry. Never blocks settlement.
  logAdvisoryPayloadMismatch(nk, ctx, logger, match, request, serverWinnerId);

  // Anti-cheat: Check if players are flagged (server-derived participants)
  const winnerFlagged = checkPlayerFlagged(logger, serverWinnerId, 'winner');
  if (winnerFlagged) return winnerFlagged;

  const loserFlagged = checkPlayerFlagged(logger, serverLoserId, 'loser');
  if (loserFlagged) return loserFlagged;

  // Anti-abuse: Win trading detection (server-derived participants)
  const winnerHistory = getPlayerMatchHistory(serverWinnerId);
  const loserHistory = getPlayerMatchHistory(serverLoserId);

  if (winnerHistory && loserHistory) {
    const winnerRecentMatches = winnerHistory.matches
      .filter((m) => m.opponentId === serverLoserId)
      .filter((m) => m.result === 'win' || m.result === 'loss')
      .slice(-10);

    const winTradingCheck = detectWinTrading(
      serverWinnerId,
      serverLoserId,
      winnerRecentMatches.map((m) => ({
        result: m.result as 'win' | 'loss',
        timestamp: m.timestamp,
      }))
    );

    if (winTradingCheck.suspicious) {
      logger.warn(
        'Potential win trading detected between %s and %s: pattern=%s, confidence=%.2f',
        serverWinnerId,
        serverLoserId,
        winTradingCheck.pattern,
        winTradingCheck.confidence
      );
      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'complete_match',
        'pvp_matches',
        {
          match_id: match.match_id,
          winner_id: serverWinnerId,
          loser_id: serverLoserId,
          win_trading_pattern: winTradingCheck.pattern,
          confidence: winTradingCheck.confidence,
        },
        'failure',
        'win_trading_suspicion'
      );
    }
  }

  // Server-recorded punch-up flag only — client-asserted is_punch_up is
  // advisory (it would otherwise amplify rewards from client input).
  const isPunchUp = match.is_punch_up;

  // Process match result from the server-declared winner
  const settlement: ServerSettlementRequest = {
    match_id: match.match_id,
    winner_id: serverWinnerId,
    loser_id: serverLoserId,
    end_reason: terminalState.endReason,
  };
  return processMatchResult(ctx, logger, nk, settlement, match, isPunchUp);
}

/**
 * Settlement instruction derived from server state (never client input).
 *
 * @property match_id - ID of the match to settle
 * @property winner_id - Server-declared winner user ID
 * @property loser_id - Server-declared loser user ID
 * @property end_reason - Server-side terminal reason for audit/telemetry
 */
interface ServerSettlementRequest {
  match_id: string;
  winner_id: string;
  loser_id: string;
  end_reason?: MatchEndReason;
}

/**
 * Minimal snapshot of the combat system's MatchState needed for
 * server-declared settlement. Kept local to avoid a runtime import cycle
 * with combat_system.ts (which imports PvPMatch from this module).
 */
interface CombatStateSnapshot {
  winner?: string;
  status: string;
  forfeit_reason?: string;
  creator_health: number;
  opponent_health: number;
}

/**
 * Reads the combat system's match state (pvp_match_states collection).
 *
 * @param nk - Nakama server interface
 * @param match - The PvP match being settled
 * @param logger - Nakama logger instance
 * @returns Combat state snapshot, or null when absent/unparseable
 */
function readCombatMatchState(
  nk: Runtime.Nakama,
  match: PvPMatch,
  logger: Runtime.Logger
): CombatStateSnapshot | null {
  let objects: ReturnType<Runtime.Nakama['storageRead']> = [];
  try {
    objects = nk.storageRead([
      { collection: 'pvp_match_states', key: match.match_id, userId: match.creator_id },
    ]);
  } catch (error) {
    logger.warn(
      'Failed reading combat match state for %s: %s',
      match.match_id,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }

  if (objects.length === 0 || !objects[0].value) {
    return null;
  }

  const stateResult = safeParse<CombatStateSnapshot>(
    objects[0].value,
    null,
    logger,
    'rpcCompleteMatch:combatState'
  );
  if (!stateResult.success || !stateResult.data) {
    return null;
  }
  return stateResult.data;
}

/**
 * Maps a combat-system forfeit reason to a match end reason.
 *
 * @param forfeitReason - Forfeit reason recorded on the combat state
 * @returns Mapped MatchEndReason (defaults to health_zero when no reason)
 */
function mapForfeitReasonToMatchEndReason(forfeitReason?: string): MatchEndReason {
  if (forfeitReason === 'timeout') return 'timeout';
  if (forfeitReason === 'disconnect') return 'disconnect';
  if (forfeitReason) return 'forfeit';
  return 'health_zero';
}

/**
 * Maps a turn-engine end reason (checkMatchEndConditions) to a MatchEndReason.
 *
 * @param reason - Turn-engine end reason string
 * @returns Mapped MatchEndReason
 */
function mapTurnEndReasonToMatchEndReason(reason?: string): MatchEndReason {
  if (!reason) return 'health_zero';
  if (reason === 'draw') return 'draw';
  if (reason.startsWith('max_turns')) return 'max_turns';
  return 'health_zero';
}

/**
 * Resolves a terminal state from the combat system's MatchState
 * (health-zero / forfeit / timeout / disconnect resolution).
 *
 * @param nk - Nakama server interface
 * @param match - The PvP match being resolved
 * @param logger - Nakama logger instance
 * @returns ServerTerminalState, or null when the combat state holds no
 *          terminal outcome
 */
function resolveCombatStateTerminal(
  nk: Runtime.Nakama,
  match: PvPMatch,
  logger: Runtime.Logger
): ServerTerminalState | null {
  const combatState = readCombatMatchState(nk, match, logger);
  if (!combatState) {
    return null;
  }

  // Winner declared by the combat system (forfeit, timeout, disconnect,
  // or a health-zero resolution already recorded).
  if (combatState.winner) {
    return {
      kind: 'winner',
      winner: combatState.winner,
      endReason: mapForfeitReasonToMatchEndReason(combatState.forfeit_reason),
    };
  }

  // Health-zero declared only in the combat state
  if (combatState.creator_health <= 0 && combatState.opponent_health > 0) {
    return { kind: 'winner', winner: match.opponent_id, endReason: 'health_zero' };
  }
  if (combatState.opponent_health <= 0 && combatState.creator_health > 0) {
    return { kind: 'winner', winner: match.creator_id, endReason: 'health_zero' };
  }

  return null;
}

/**
 * Resolves the server-declared terminal state of a match. This is the SOLE
 * source of winner truth for settlement (ADR-0002) — client-asserted
 * payloads are never consulted.
 *
 * Resolution priority:
 * 1. `settled_at` on the match — settlement already ran (idempotent replay)
 * 2. `winner` on the match — declared by a server resolution path
 *    (combat system updateMatchStatus, turn engine)
 * 3. Combat system MatchState — declared winner (forfeit/timeout/disconnect)
 *    or health-zero
 * 4. Turn engine end conditions on the match — health-zero, max-turns
 *    (winner by remaining health), or draw
 *
 * @param nk - Nakama server interface
 * @param match - The PvP match to resolve
 * @param logger - Nakama logger instance
 * @returns ServerTerminalState, or null when no server-side terminal state exists
 */
function resolveServerTerminalState(
  nk: Runtime.Nakama,
  match: PvPMatch,
  logger: Runtime.Logger
): ServerTerminalState | null {
  // 1. Already settled — replay the recorded outcome idempotently
  if (match.settled_at) {
    if (match.winner) {
      return {
        kind: 'already_settled',
        winner: match.winner,
        endReason: match.end_reason ?? 'health_zero',
        settledAt: match.settled_at,
      };
    }
    return {
      kind: 'already_settled',
      endReason: match.end_reason ?? 'draw',
      settledAt: match.settled_at,
    };
  }

  // 2. Winner already declared by a server-side resolution path
  if (match.winner) {
    return { kind: 'winner', winner: match.winner, endReason: match.end_reason ?? 'health_zero' };
  }

  // 3. Combat system MatchState
  const combatTerminal = resolveCombatStateTerminal(nk, match, logger);
  if (combatTerminal) {
    return combatTerminal;
  }

  // 4. Turn engine end conditions (health-zero, max-turns, draw). A match
  // already marked completed without a winner is a settled draw.
  const endConditions = checkMatchEndConditions(match, logger);
  if (endConditions.shouldEnd) {
    if (endConditions.winner) {
      return {
        kind: 'winner',
        winner: endConditions.winner,
        endReason: mapTurnEndReasonToMatchEndReason(endConditions.reason),
      };
    }
    return { kind: 'draw', endReason: 'draw' };
  }
  if (match.status === 'completed') {
    return { kind: 'draw', endReason: 'draw' };
  }

  return null;
}

/**
 * Logs advisory mismatches between the client-asserted payload and the
 * server-declared winner for anti-cheat telemetry. Purely informational —
 * never influences settlement.
 *
 * @param nk - Nakama server interface
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param match - The match being settled
 * @param request - Client-supplied (advisory) payload fields
 * @param serverWinnerId - Server-declared winner user ID
 */
function logAdvisoryPayloadMismatch(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  match: PvPMatch,
  request: { winner_id?: string; loser_id?: string },
  serverWinnerId: string
): void {
  if (request.winner_id !== undefined && request.winner_id !== serverWinnerId) {
    logger.warn(
      'Advisory winner mismatch on match %s: client asserted %s, server declared %s',
      match.match_id,
      request.winner_id,
      serverWinnerId
    );
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'complete_match',
      'pvp_matches',
      {
        match_id: match.match_id,
        client_asserted_winner_id: request.winner_id,
        client_asserted_loser_id: request.loser_id,
        server_declared_winner_id: serverWinnerId,
      },
      'failure',
      'advisory_winner_mismatch'
    );
  }
}

/**
 * Settles a terminal draw: marks the match completed/settled without
 * applying Elo, XP, or rewards (no winner to reward).
 *
 * @param nk - Nakama server interface
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param match - The match to settle as a draw
 * @returns JSON string with the draw settlement result
 */
function settleDrawMatch(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  match: PvPMatch
): string {
  const now = Date.now();
  match.status = 'completed';
  match.updated_at = now;
  match.settled_at = now;
  match.end_reason = 'draw';

  nk.storageWrite([
    {
      collection: 'pvp_matches',
      key: match.match_id,
      userId: match.creator_id,
      value: JSON.stringify(match),
    },
  ]);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'complete_match',
    'pvp_matches',
    { match_id: match.match_id, result: 'draw' },
    'success'
  );

  logger.info('Match settled as draw: %s', match.match_id);

  return JSON.stringify({
    success: true,
    match: match,
    is_draw: true,
    end_reason: 'draw',
  });
}

/**
 * Fetch and validate the match from storage
 *
 * @param nk - Nakama server interface
 * @param ctx - Nakama runtime context
 * @param request - Request containing the match_id
 * @param logger - Nakama logger instance
 * @param options - When allowCompleted is true, matches already marked
 *                  completed by a server resolution path are accepted
 *                  (settlement trigger semantics per ADR-0002)
 */
function getAndValidateMatch(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  request: { match_id: string },
  logger: Runtime.Logger,
  options?: { allowCompleted?: boolean }
): { match?: PvPMatch; error?: string } {
  const objects = nk.storageRead([
    {
      collection: 'pvp_matches',
      key: request.match_id,
      userId: ctx.userId,
    },
  ]);

  if (objects.length === 0) {
    return { error: 'Match not found' };
  }

  const matchResult = safeParse<PvPMatch>(objects[0].value, null, logger, 'rpcForfeitMatch:match');
  if (!matchResult.success || !matchResult.data) {
    return { error: 'Failed to parse match data' };
  }
  const match: PvPMatch = matchResult.data;

  const statusAllowed =
    match.status === 'active' || (options?.allowCompleted && match.status === 'completed');
  if (!statusAllowed) {
    return { error: 'Match is not active' };
  }

  if (match.creator_id !== ctx.userId && match.opponent_id !== ctx.userId) {
    return { error: 'Not authorized to complete this match' };
  }

  return { match };
}

/**
 * Calculate old rank for a player from match data
 */
function calculateOldRank(match: PvPMatch, userId: string, matchType: string): number {
  if (matchType !== 'ranked') {
    return 0;
  }
  return userId === match.creator_id ? match.creator_rank : match.opponent_rank;
}

/**
 * Process ranked match updates (Elo, records, anti-cheat).
 *
 * @param nk - Nakama server interface
 * @param ctx - Nakama runtime context
 * @param winnerId - Server-declared winner user ID
 * @param loserId - Server-declared loser user ID
 * @param matchId - ID of the match being settled
 * @param currentSeason - Current season scope
 * @param isPunchUp - Whether the server match record marks this a punch-up
 * @param loserIsUnderdog - Whether the loser is the punch-up underdog
 * @returns New ranks, rank changes, and the per-side K-factors applied
 */
function processRankedMatchUpdates(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  winnerId: string,
  loserId: string,
  matchId: string,
  currentSeason: SeasonInfo,
  isPunchUp: boolean,
  loserIsUnderdog: boolean
): {
  winnerNewRank: number;
  loserNewRank: number;
  winnerRankChange: number;
  loserRankChange: number;
  winnerK: number;
  loserK: number;
} {
  // Get current Elo ratings from leaderboard
  const winnerEntry = getLeaderboardEntry(nk, winnerId, currentSeason.season_id);
  const loserEntry = getLeaderboardEntry(nk, loserId, currentSeason.season_id);

  const winnerOldElo = winnerEntry ? winnerEntry.score : 1000;
  const loserOldElo = loserEntry ? loserEntry.score : 1000;

  // Apply Elo updates
  const { winnerNewElo, loserNewElo } = applyEloUpdates(
    nk,
    ctx,
    currentSeason,
    winnerId,
    loserId,
    winnerOldElo,
    loserOldElo,
    isPunchUp,
    winnerEntry,
    loserEntry,
    loserIsUnderdog
  );

  // Record match results for anti-cheat analysis
  recordMatchResult(winnerId, matchId, loserId, 'win', true, winnerOldElo, winnerNewElo);
  recordMatchResult(loserId, matchId, winnerId, 'loss', true, loserOldElo, loserNewElo);

  const { winnerK, loserK } = getEloKFactors(isPunchUp, loserIsUnderdog);

  return {
    winnerNewRank: winnerNewElo,
    loserNewRank: loserNewElo,
    winnerRankChange: winnerNewElo - winnerOldElo,
    loserRankChange: loserNewElo - loserOldElo,
    winnerK,
    loserK,
  };
}

/**
 * Verify the match has not already been settled by a concurrent or repeated
 * request. Settlement idempotency is keyed on `settled_at`, which is written
 * exactly once by the settlement run that applies Elo/XP/rewards.
 *
 * Note: a match marked 'completed' by a server resolution path (combat
 * system) without `settled_at` is intentionally NOT blocked — its winner is
 * declared but unsettled, awaiting the settlement trigger (ADR-0002).
 */
function verifyMatchNotSettled(
  nk: Runtime.Nakama,
  match: PvPMatch,
  logger: Runtime.Logger
): { alreadySettledResponse: string | null; matchVersion: string | undefined } {
  const freshMatchObjects = nk.storageRead([
    { collection: 'pvp_matches', key: match.match_id, userId: match.creator_id },
  ]);
  if (freshMatchObjects.length > 0) {
    const freshMatchResult = safeParse<PvPMatch>(
      freshMatchObjects[0].value,
      null,
      logger,
      'processMatchResult:freshMatch'
    );
    if (freshMatchResult.success && freshMatchResult.data && freshMatchResult.data.settled_at) {
      logger.warn('Match %s already settled by concurrent request', match.match_id);
      return {
        alreadySettledResponse: JSON.stringify({
          success: true,
          already_settled: true,
          match_id: match.match_id,
          winner: freshMatchResult.data.winner,
          end_reason: freshMatchResult.data.end_reason ?? 'health_zero',
          settled_at: freshMatchResult.data.settled_at,
        }),
        matchVersion: undefined,
      };
    }
  }
  return {
    alreadySettledResponse: null,
    matchVersion: freshMatchObjects.length > 0 ? freshMatchObjects[0].version : undefined,
  };
}

/**
 * Calculate old and new season positions plus deltas for both players.
 */
function calculateSeasonPositions(
  nk: Runtime.Nakama,
  winnerId: string,
  loserId: string,
  seasonId: string
): {
  winnerOldPosition: number;
  loserOldPosition: number;
  winnerNewPosition: number;
  loserNewPosition: number;
  winnerDelta: number;
  loserDelta: number;
} {
  const winnerOldEntry = getLeaderboardEntry(nk, winnerId, seasonId);
  const loserOldEntry = getLeaderboardEntry(nk, loserId, seasonId);
  const winnerOldPosition = winnerOldEntry ? winnerOldEntry.rank : 0;
  const loserOldPosition = loserOldEntry ? loserOldEntry.rank : 0;

  // These will be fetched after rank updates
  const winnerNewEntry = getLeaderboardEntry(nk, winnerId, seasonId);
  const loserNewEntry = getLeaderboardEntry(nk, loserId, seasonId);
  const winnerNewPosition = winnerNewEntry ? winnerNewEntry.rank : 0;
  const loserNewPosition = loserNewEntry ? loserNewEntry.rank : 0;

  const winnerDelta =
    winnerOldPosition > 0 && winnerNewPosition > 0 ? winnerNewPosition - winnerOldPosition : 0;
  const loserDelta =
    loserOldPosition > 0 && loserNewPosition > 0 ? loserNewPosition - loserOldPosition : 0;

  return {
    winnerOldPosition,
    loserOldPosition,
    winnerNewPosition,
    loserNewPosition,
    winnerDelta,
    loserDelta,
  };
}

/**
 * Determines whether a settlement participant is the punch-up underdog.
 * The underdog concept only exists within a punch-up — outside one, no
 * player is an underdog regardless of rank.
 *
 * @param isPunchUp - Whether the server match record marks this a punch-up
 * @param playerId - Participant to test
 * @param punchUpInfo - Punch-up info resolved from server match ranks
 * @returns True only for the underdog of an actual punch-up
 */
function isPunchUpUnderdog(
  isPunchUp: boolean,
  playerId: string,
  punchUpInfo: PunchUpInfo
): boolean {
  return isPunchUp && playerId === punchUpInfo.underdog_id;
}

/**
 * Settlement facts about the losing side needed by the punch-up loss watch.
 *
 * @property loserOldRank - Loser's ladder rating before settlement
 * @property loserNewRank - Loser's ladder rating after settlement
 * @property loserRankChange - Elo delta applied to the loser (negative)
 * @property loserXpGained - XP granted to the loser (strictly positive)
 * @property winnerRankChange - Elo delta applied to the winner
 * @property winnerKFactor - K-factor used for the winner's Elo gain
 * @property loserKFactor - K-factor used for the loser's deduction
 */
interface PunchUpLossSettlementFacts {
  loserOldRank: number;
  loserNewRank: number;
  loserRankChange: number;
  loserXpGained: number;
  winnerRankChange: number;
  winnerKFactor: number;
  loserKFactor: number;
}

/**
 * Runs the LC-T3 punch-up wager abuse watch for a settled punch-up underdog
 * loss and emits the fairness telemetry event (issue #864). Detection and
 * logging only — never blocks or alters the settlement outcome.
 *
 * @param nk - Nakama server interface
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance (winston)
 * @param match - The settled match
 * @param winnerId - Server-declared winner (the favorite)
 * @param loserId - Server-declared loser (the underdog)
 * @param facts - Settlement facts for telemetry
 * @param seasonId - Current season ID
 * @param settledAt - Settlement timestamp (ms since epoch)
 */
function runPunchUpLossWatch(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  match: PvPMatch,
  winnerId: string,
  loserId: string,
  facts: PunchUpLossSettlementFacts,
  seasonId: string,
  settledAt: number
): void {
  const watchVerdict = recordPunchUpLossAndEvaluate({
    matchId: match.match_id,
    winnerId,
    loserId,
    timestamp: settledAt,
  });

  incrementPunchUpLoss(seasonId);

  if (watchVerdict.flagged) {
    logger.warn(
      'LC-T3 punch-up wager abuse watch flag: match=%s, loser=%s, winner=%s, reason=%s, pair_losses=%d, player_losses=%d',
      match.match_id,
      loserId,
      winnerId,
      watchVerdict.reason,
      watchVerdict.pairLossCount,
      watchVerdict.playerLossCount
    );
    incrementPunchUpWatchFlag(watchVerdict.reason);
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'complete_match',
      'pvp_matches',
      {
        match_id: match.match_id,
        winner_id: winnerId,
        loser_id: loserId,
        watch_reason: watchVerdict.reason,
        pair_loss_count: watchVerdict.pairLossCount,
        player_loss_count: watchVerdict.playerLossCount,
      },
      'failure',
      'punch_up_watch_flag'
    );
  }

  const punchUpLossEvent: PunchUpLossEvent = {
    event_id: `punchup_loss_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    match_id: match.match_id,
    timestamp: settledAt,
    season_id: seasonId,
    loser_id: loserId,
    winner_id: winnerId,
    loser_old_rank: facts.loserOldRank,
    loser_new_rank: facts.loserNewRank,
    loser_rank_change: facts.loserRankChange,
    loser_xp_gained: facts.loserXpGained,
    winner_rank_change: facts.winnerRankChange,
    amplified: true,
    winner_k_factor: facts.winnerKFactor,
    loser_k_factor: facts.loserKFactor,
    end_reason: match.end_reason ?? 'health_zero',
    watch: {
      flagged: watchVerdict.flagged,
      reason: watchVerdict.reason,
      pair_loss_count: watchVerdict.pairLossCount,
      player_loss_count: watchVerdict.playerLossCount,
    },
  };

  // Non-blocking: log to telemetry but don't wait
  void logPunchUpLoss(nk, punchUpLossEvent);
}

/**
 * Process the match result, calculate ranks, and update storage.
 *
 * The winner/loser in `request` must be server-derived (ADR-0002) — either
 * from a server-side resolution path (combat system, turn engine, forfeit)
 * or resolved from server terminal state by rpcCompleteMatch.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param request - Server-derived settlement instruction
 * @param match - The match to settle
 * @param isPunchUp - Whether the match was a server-recorded punch-up
 * @returns JSON string with the settlement result
 */
function processMatchResult(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  request: ServerSettlementRequest,
  match: PvPMatch,
  isPunchUp: boolean
): string {
  // Guard double-settlement BEFORE applying Elo — a second settlement run
  // must never re-apply ranks, XP, or rewards.
  const settledVerification = verifyMatchNotSettled(nk, match, logger);
  if (settledVerification.alreadySettledResponse) {
    return settledVerification.alreadySettledResponse;
  }
  const matchVersion = settledVerification.matchVersion;

  // Record the server-declared winner on the match up front so downstream
  // calculations (punch-up rank lookup, telemetry) see consistent state.
  match.winner = request.winner_id;

  // Calculate punch-up info from SERVER match data (ranks recorded at match
  // creation). This is the sole source for underdog/favorite determination —
  // client-asserted payloads are advisory only (ADR-0002 / issue #864).
  const winnerOldRank =
    match.winner === match.creator_id ? match.creator_rank : match.opponent_rank;
  const loserOldRank =
    match.winner === match.opponent_id ? match.creator_rank : match.opponent_rank;
  const punchUpInfo = isPunchUpMatch(
    winnerOldRank,
    loserOldRank,
    request.winner_id,
    request.loser_id
  );

  // Determine if winner and loser are underdogs or favorites. The underdog
  // concept only exists within a punch-up; the amplified punch-up loss (2x
  // K-factor, issue #864) applies only when the LOSER is the underdog — the
  // winner side is never amplified.
  const winnerIsUnderdog = isPunchUpUnderdog(isPunchUp, request.winner_id, punchUpInfo);
  const loserIsUnderdog = isPunchUpUnderdog(isPunchUp, request.loser_id, punchUpInfo);

  // Initialize ranks for ranked matches
  let winnerNewRank = match.creator_rank;
  let loserNewRank = match.opponent_rank;
  let winnerRankChange = 0;
  let loserRankChange = 0;
  let winnerKFactor = 0;
  let loserKFactor = 0;

  // Process ranked match Elo and record updates
  if (match.match_type === 'ranked') {
    const currentSeason = getCurrentSeason();
    const rankedUpdates = processRankedMatchUpdates(
      nk,
      ctx,
      request.winner_id,
      request.loser_id,
      request.match_id,
      currentSeason,
      isPunchUp,
      loserIsUnderdog
    );
    winnerNewRank = rankedUpdates.winnerNewRank;
    loserNewRank = rankedUpdates.loserNewRank;
    winnerRankChange = rankedUpdates.winnerRankChange;
    loserRankChange = rankedUpdates.loserRankChange;
    winnerKFactor = rankedUpdates.winnerK;
    loserKFactor = rankedUpdates.loserK;
  }

  // Record player activity for rank decay tracking.
  recordPlayerActivity(nk, request.winner_id);
  recordPlayerActivity(nk, request.loser_id);

  // No decay at settlement (issue #865): inactivity decay applies to the
  // Ladder Rating when it is read (season_leaderboard), never here. The
  // former applyMatchRankDecay call was provably inert — both players'
  // activity is recorded immediately above, so applyRankDecay always saw
  // 0 inactive days and returned the score unchanged. winner/loser ranks
  // below are the pure Elo results from processRankedMatchUpdates.

  // Get season information for position tracking
  const currentSeason = getCurrentSeason();
  const winnerOldSeasonEntry = getLeaderboardEntry(nk, request.winner_id, currentSeason.season_id);
  const winnerOldSeasonPosition = winnerOldSeasonEntry ? winnerOldSeasonEntry.rank : 0;
  const loserOldSeasonEntry = getLeaderboardEntry(nk, request.loser_id, currentSeason.season_id);
  const loserOldSeasonPosition = loserOldSeasonEntry ? loserOldSeasonEntry.rank : 0;

  // Calculate XP gains with punch-up scaling
  const winnerXPParams: RewardCalculationParams = {
    isWinner: true,
    isPunchUp,
    matchType: match.match_type,
    isUnderdog: winnerIsUnderdog,
    rankDifference: punchUpInfo.rank_difference,
    rewardMultiplier: punchUpInfo.reward_multiplier,
  };
  const loserXPParams: RewardCalculationParams = {
    isWinner: false,
    isPunchUp,
    matchType: match.match_type,
    isUnderdog: loserIsUnderdog,
    rankDifference: punchUpInfo.rank_difference,
    rewardMultiplier: punchUpInfo.reward_multiplier,
  };

  const winnerXPGained = calculateXPGain(winnerXPParams);
  const loserXPGained = calculateXPGain(loserXPParams);

  // Calculate per-match rewards
  const winnerRewards = calculateMatchRewards(winnerXPParams, winnerXPGained);
  const loserRewards = calculateMatchRewards(loserXPParams, loserXPGained);

  // Award rewards to players (coins, gems) via the unified currency ledger
  awardMatchRewards(nk, logger, request.winner_id, winnerRewards);
  awardMatchRewards(nk, logger, request.loser_id, loserRewards);

  // Update player XP
  updatePlayerXP(nk, request.winner_id, winnerXPGained);
  updatePlayerXP(nk, request.loser_id, loserXPGained);

  // Update match status to completed and mark the settlement run. The
  // settled_at stamp is the double-settlement idempotency key: subsequent
  // settlement attempts replay the recorded outcome without re-applying.
  const now = Date.now();
  match.status = 'completed';
  match.winner = request.winner_id;
  match.updated_at = now;
  match.end_reason = request.end_reason ?? 'health_zero';
  match.settled_at = now;

  // Update the match in storage with version for conditional write
  nk.storageWrite([
    {
      collection: 'pvp_matches',
      key: match.match_id,
      userId: match.creator_id,
      value: JSON.stringify(match),
      version: matchVersion,
    },
  ]);

  // Anti-abuse: Record match completion
  recordMatchAction(ctx.userId, 'complete', match.match_id);
  recordMatchAction(
    request.winner_id === ctx.userId ? request.loser_id : request.winner_id,
    'complete',
    match.match_id
  );

  // Anti-abuse: Cleanup turn tracking
  cleanupTurnTracking(request.winner_id, match.match_id);
  cleanupTurnTracking(request.loser_id, match.match_id);

  // Log audit event
  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'complete_match',
    'pvp_matches',
    {
      match_id: match.match_id,
      winner_id: request.winner_id,
      loser_id: request.loser_id,
      match_type: match.match_type,
      is_punch_up: isPunchUp,
      end_reason: match.end_reason,
      winner_rank_change: winnerRankChange,
      loser_rank_change: loserRankChange,
    },
    'success'
  );

  logger.info(
    'Match completed: %s, winner: %s, loser: %s, type: %s, rank_change: %d',
    match.match_id,
    request.winner_id,
    request.loser_id,
    match.match_type,
    winnerRankChange
  );

  // Get new season positions after rank updates
  const seasonPositions = calculateSeasonPositions(
    nk,
    request.winner_id,
    request.loser_id,
    currentSeason.season_id
  );

  const winnerNewSeasonPosition = seasonPositions.winnerNewPosition;
  const loserNewSeasonPosition = seasonPositions.loserNewPosition;
  const winnerSeasonDelta = seasonPositions.winnerDelta;
  const loserSeasonDelta = seasonPositions.loserDelta;

  // Log ranking delta for fairness telemetry (non-blocking)
  if (match.match_type === 'ranked') {
    const rankingDeltaEvent: RankingDeltaEvent = {
      event_id: `rank_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      match_id: match.match_id,
      timestamp: Date.now(),
      winner_id: request.winner_id,
      loser_id: request.loser_id,
      winner_old_rank: calculateOldRank(match, request.winner_id, match.match_type),
      winner_new_rank: winnerNewRank,
      winner_rank_change: winnerRankChange,
      loser_old_rank: calculateOldRank(match, request.loser_id, match.match_type),
      loser_new_rank: loserNewRank,
      loser_rank_change: loserRankChange,
      match_type: match.match_type,
      is_punch_up: isPunchUp,
      winner_old_season_position: winnerOldSeasonPosition,
      winner_new_season_position: winnerNewSeasonPosition,
      loser_old_season_position: loserOldSeasonPosition,
      loser_new_season_position: loserNewSeasonPosition,
      season_id: currentSeason.season_id,
    };

    // Non-blocking: log to telemetry but don't wait
    void logRankingDelta(nk, rankingDeltaEvent);
  }

  // Punch-up underdog loss (issue #864): run the LC-T3 anti-abuse watch and
  // emit a fairness telemetry event for review. Watch is detection + logging
  // only — it never blocks or alters settlement.
  if (match.match_type === 'ranked' && isPunchUp && loserIsUnderdog) {
    runPunchUpLossWatch(
      nk,
      ctx,
      logger,
      match,
      request.winner_id,
      request.loser_id,
      {
        loserOldRank: calculateOldRank(match, request.loser_id, match.match_type),
        loserNewRank,
        loserRankChange,
        loserXpGained: loserXPGained,
        winnerRankChange,
        winnerKFactor,
        loserKFactor,
      },
      currentSeason.season_id,
      now
    );
  }

  return JSON.stringify({
    success: true,
    match: match,
    winner: {
      user_id: request.winner_id,
      old_rank: calculateOldRank(match, request.winner_id, match.match_type),
      new_rank: winnerNewRank,
      rank_change: winnerRankChange,
      xp_gained: winnerXPGained,
      old_season_position: winnerOldSeasonPosition,
      new_season_position: winnerNewSeasonPosition,
      season_position_delta: winnerSeasonDelta,
      rewards: winnerRewards,
    },
    loser: {
      user_id: request.loser_id,
      old_rank: calculateOldRank(match, request.loser_id, match.match_type),
      new_rank: loserNewRank,
      rank_change: loserRankChange,
      xp_gained: loserXPGained,
      old_season_position: loserOldSeasonPosition,
      new_season_position: loserNewSeasonPosition,
      season_position_delta: loserSeasonDelta,
      rewards: loserRewards,
    },
    is_punch_up: isPunchUp,
    end_reason: match.end_reason,
  });
}

/**
 * Parameters for calculating match rewards.
 */
interface RewardCalculationParams {
  isWinner: boolean;
  isPunchUp: boolean;
  matchType: 'ranked' | 'casual';
  isUnderdog: boolean;
  rankDifference: number;
  rewardMultiplier: number;
}

/**
 * Calculates XP gain based on match result and type.
 *
 * Ranked matches offer 100% XP rewards, casual matches offer 50% XP rewards.
 * Punch-up matches provide scaled multiplier bonuses (1.2x to 2.0x) based on rank difference.
 * Favorites in punch-up matches receive reduced rewards (50% to 70% of normal).
 *
 * Casual matches never expose the punch-up wager (issue #872): punch-up XP
 * shaping is applied to ranked matches only, regardless of any punch-up flag
 * recorded on the match.
 *
 * @param params - Reward calculation parameters
 * @returns XP gained
 */
function calculateXPGain(params: RewardCalculationParams): number {
  const rankedBaseXP = params.isWinner ? 100 : 25;
  const casualBaseXP = params.isWinner ? 50 : 15;

  // Casual matches award 50% of ranked XP
  let baseXP = params.matchType === 'ranked' ? rankedBaseXP : casualBaseXP;

  // Punch-up shaping is ranked-only (issue #872): a stake-free casual wager
  // would contradict the Punch-Up definition in CONTEXT.md.
  const isRankedPunchUp = params.matchType === 'ranked' && params.isPunchUp;

  if (isRankedPunchUp) {
    if (params.isUnderdog) {
      if (params.isWinner) {
        // Underdog win: bonus based on rank difference
        baseXP = Math.round(baseXP * params.rewardMultiplier);
      } else {
        // Underdog loss (issue #864): the wager consequence is the amplified
        // Ladder Rating deduction; the XP grant is reduced but NEVER negative
        // or zero — progression is never wagered.
        baseXP = Math.max(
          PUNCH_UP_LOSS_XP_MINIMUM,
          Math.round(baseXP * PUNCH_UP_LOSS_XP_MULTIPLIER)
        );
      }
    } else {
      // Favorite gets penalty based on rank difference
      const penalty = calculateFavoritePenalty(params.isPunchUp, params.rankDifference);
      baseXP = Math.round(baseXP * penalty);
    }
  }

  return baseXP;
}

/**
 * Calculates per-match rewards based on result and type.
 *
 * Ranked matches offer higher rewards and include punch-up gem bonuses.
 * Casual matches offer 50% coin rewards and no gem bonuses.
 *
 * Punch-up mechanics (ranked only):
 * - Underdogs: Scaled XP multiplier, bonus gems for wins
 * - Favorites: Reduced rewards (50-70% of normal), harsher penalties for losses
 *
 * Casual matches never expose the punch-up wager (issue #872): no punch-up
 * gem bonus and no favorite penalty are applied in casual mode.
 *
 * @param params - Reward calculation parameters
 * @param xpGained - XP gained in the match
 * @returns Array of match rewards
 */
function calculateMatchRewards(params: RewardCalculationParams, xpGained: number): MatchReward[] {
  const rewards: MatchReward[] = [];

  // XP is always awarded as a reward
  rewards.push({
    name: 'XP',
    quantity: xpGained,
    type: 'xp',
  });

  // Coins awarded based on result and match type
  // Ranked: 50 coins for win, 10 for loss
  // Casual: 25 coins for win, 5 for loss (50% of ranked)
  let coins: number;
  if (params.matchType === 'ranked') {
    coins = params.isWinner ? 50 : 10;
  } else {
    coins = params.isWinner ? 25 : 5;
  }

  // Punch-up shaping is ranked-only (issue #872): casual rewards are
  // punch-up-free regardless of any punch-up flag recorded on the match.
  const isRankedPunchUp = params.matchType === 'ranked' && params.isPunchUp;

  // Apply favorite penalty for punch-up matches
  if (isRankedPunchUp && !params.isUnderdog) {
    const penalty = calculateFavoritePenalty(params.isPunchUp, params.rankDifference);
    coins = Math.round(coins * penalty);
  }

  rewards.push({
    name: 'Coins',
    quantity: coins,
    type: 'coin',
  });

  // Bonus gems for punch-up underdog wins (ranked only)
  // Scale gem bonus based on rank difference
  if (params.isWinner && isRankedPunchUp && params.isUnderdog) {
    const gemBonus = calculatePunchUpGemBonus(params.rankDifference);
    rewards.push({
      name: 'Gems',
      quantity: gemBonus,
      type: 'gem',
    });
  }

  return rewards;
}

/**
 * Awards match rewards to a player.
 *
 * Writes to the authoritative `player_currency` storage ledger (issue #860)
 * so earned coins and punch-up gems are immediately visible via
 * get_currency and spendable via spend_gems. Reward type 'coin' maps to the
 * ledger's `coins` field (the canonical "Coins" currency, renamed from
 * `gold` in issue #866).
 *
 * @param nk - Nakama server interface
 * @param logger - Nakama logger instance
 * @param userId - ID of the player to award rewards to
 * @param rewards - Array of rewards to award
 */
function awardMatchRewards(
  nk: Runtime.Nakama,
  logger: Runtime.Logger,
  userId: string,
  rewards: MatchReward[]
): void {
  const delta: CurrencyDelta = {};

  for (const reward of rewards) {
    if (reward.type === 'coin') {
      delta.coins = (delta.coins || 0) + reward.quantity;
    } else if (reward.type === 'gem') {
      delta.gems = (delta.gems || 0) + reward.quantity;
    }
    // XP is handled separately
  }

  if (delta.gems !== undefined || delta.coins !== undefined) {
    applyCurrencyDelta(nk, userId, delta, 'match_rewards', logger);
  }
}

/**
 * Updates player XP in storage.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param xpGained - XP to add
 */
function updatePlayerXP(nk: Runtime.Nakama, userId: string, xpGained: number): void {
  const objects = nk.storageRead([
    {
      collection: 'player_stats',
      key: userId,
      userId: userId,
    },
  ]);

  if (objects.length === 0) {
    return;
  }

  const playerStatsResult = safeParse<PlayerStats>(
    objects[0].value,
    'updatePlayerXP',
    undefined,
    'updatePlayerXP'
  );
  if (!playerStatsResult.success || !playerStatsResult.data) {
    return;
  }

  const playerStats = playerStatsResult.data;
  playerStats.xp += xpGained;

  const oldLevel = playerStats.level;
  const newLevel = getLevelForXp(playerStats.xp);
  if (newLevel > oldLevel) {
    playerStats.level = newLevel;
    playerStats.ability_points = (playerStats.ability_points || 0) + (newLevel - oldLevel);
  }

  nk.storageWrite([
    {
      collection: 'player_stats',
      key: userId,
      userId: userId,
      value: JSON.stringify(playerStats),
      version: objects[0].version,
    },
  ]);
}

/**
 * Request payload for getting match history.
 *
 * @property match_type - Optional filter by match type
 * @property limit - Maximum number of matches to return
 * @property offset - Offset for pagination
 */
export interface GetMatchHistoryRequest {
  match_type?: 'ranked' | 'casual';
  limit?: number;
  offset?: number;
}

/**
 * Registers get match history RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetMatchHistory(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_match_history', rpcGetMatchHistory);
}

/**
 * Retrieves a player's match history with optional filtering.
 *
 * Queries the match_results database table for historical match data.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing optional filter parameters
 * @returns JSON string with match history
 *
 * @example
 * // Request payload
 * { "match_type": "ranked", "limit": 10, "offset": 0 }
 *
 * // Response
 * {
 *   "success": true,
 *   "matches": [ ... ],
 *   "total": 25,
 *   "stats": { "wins": 15, "losses": 10, "win_rate": 0.6 }
 * }
 */
export function rpcGetMatchHistory(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get match history called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_match_history, payload, 'get_match_history');
  if (!validation.success) {
    return createValidationErrorResponse('get_match_history', validation.error);
  }

  const request = validation.data || {};
  const limit = Math.min(request.limit || 20, 100); // Cap at 100 for performance
  const offset = request.offset || 0;

  try {
    // Build the query with optional filters
    let query = `
      SELECT
        mr.match_id,
        mr.match_type,
        mr.is_punch_up,
        mr.creator_id,
        mr.opponent_id,
        mr.winner_id,
        mr.loser_id,
        mr.creator_rank,
        mr.opponent_rank,
        mr.total_turns,
        mr.duration_seconds,
        mr.end_reason,
        mr.created_at,
        mr.updated_at,
        mr.creator_health_remaining,
        mr.opponent_health_remaining
      FROM match_results mr
      WHERE mr.creator_id = $1 OR mr.opponent_id = $1
    `;

    const params: any[] = [ctx.userId];
    let paramIndex = 2;

    // Add optional match_type filter
    if (request.match_type) {
      query += ` AND mr.match_type = $${paramIndex}`;
      params.push(request.match_type);
      paramIndex++;
    }

    // Add optional date range filter
    if (request.start_date) {
      query += ` AND mr.created_at >= $${paramIndex}`;
      params.push(new Date(request.start_date).toISOString());
      paramIndex++;
    }
    if (request.end_date) {
      query += ` AND mr.created_at <= $${paramIndex}`;
      params.push(new Date(request.end_date).toISOString());
      paramIndex++;
    }

    query += ` ORDER BY mr.created_at DESC`;

    // Get total count first
    const countQuery = query.replace(/SELECT[\s\S]+?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = nk.dbQuery(countQuery, params) as any[];
    const total = countResult[0]?.total || 0;

    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit);
    params.push(offset);

    const result = nk.dbQuery(query, params) as any[];

    const matches = result.map((row: any) => {
      const isVictory = row.winner_id === ctx.userId;
      const isCreator = row.creator_id === ctx.userId;
      const opponentId = isCreator ? row.opponent_id : row.creator_id;
      const playerRank = isCreator ? row.creator_rank : row.opponent_rank;
      const opponentRank = isCreator ? row.opponent_rank : row.creator_rank;

      return {
        match_id: row.match_id,
        match_type: row.match_type,
        is_punch_up: row.is_punch_up,
        status: 'completed',
        created_at: new Date(row.created_at).getTime(),
        updated_at: new Date(row.updated_at).getTime(),
        winner: row.winner_id,
        creator_id: row.creator_id,
        opponent_id: row.opponent_id,
        creator_rank: row.creator_rank,
        opponent_rank: row.opponent_rank,
        is_victory: isVictory,
        player_id: isCreator ? row.creator_id : row.opponent_id,
        player_rank: playerRank,
        opponent_id_calculated: opponentId,
        opponent_rank_calculated: opponentRank,
        total_turns: row.total_turns,
        duration_seconds: row.duration_seconds,
        end_reason: row.end_reason,
        player_health_remaining: isCreator
          ? row.creator_health_remaining
          : row.opponent_health_remaining,
        opponent_health_remaining: isCreator
          ? row.opponent_health_remaining
          : row.creator_health_remaining,
      };
    });

    // Calculate stats from all matches (not just paginated)
    const wins = matches.filter((m) => m.is_victory).length;
    const losses = matches.filter((m) => !m.is_victory).length;
    const winRate = wins + losses > 0 ? wins / (wins + losses) : 0;

    return JSON.stringify({
      success: true,
      matches: matches,
      total: total,
      stats: {
        wins: wins,
        losses: losses,
        win_rate: Math.round(winRate * 100) / 100,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to get match history from database', {
      error: errorMessage,
      userId: ctx.userId,
    });
    return JSON.stringify({
      success: false,
      error: 'Failed to retrieve match history',
    });
  }
}

/**
 * Registers the get match details RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetMatchDetails(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_match_details', rpcGetMatchDetails);
}

/**
 * Retrieves detailed information about a specific match including combat logs.
 *
 * This endpoint is intended for QA and dispute resolution. It returns comprehensive
 * match data including the full combat log, player stats at match start, and all
 * Elo changes.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string with match_id
 * @returns JSON string with detailed match information
 *
 * @example
 * // Request payload
 * { "match_id": "match_abc123" }
 *
 * // Response
 * {
 *   "success": true,
 *   "match": {
 *     "match_id": "match_abc123",
 *     "creator_id": "...",
 *     "opponent_id": "...",
 *     "winner_id": "...",
 *     "combat_log": [...],
 *     "creator_stats_at_match": {...},
 *     "opponent_stats_at_match": {...}
 *   }
 * }
 */
// eslint-disable-next-line complexity
export function rpcGetMatchDetails(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get match details called by user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_match_details, payload, 'get_match_details');
  if (!validation.success) {
    return createValidationErrorResponse('get_match_details', validation.error);
  }

  const { match_id } = validation.data;

  try {
    const query = `
      SELECT
        mr.*,
        u1.display_name as creator_username,
        u2.display_name as opponent_username
      FROM match_results mr
      LEFT JOIN users u1 ON mr.creator_id = u1.id
      LEFT JOIN users u2 ON mr.opponent_id = u2.id
      WHERE mr.match_id = $1
    `;

    const result = nk.dbQuery(query, [match_id]) as any[];

    if (!result || result.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Match not found',
      });
    }

    const row = result[0];

    // Parse JSONB fields
    let combatLog: any[] = [];
    let creatorStats: any = {};
    let opponentStats: any = {};

    try {
      combatLog =
        typeof row.combat_log === 'string' ? JSON.parse(row.combat_log) : row.combat_log || [];
    } catch {
      logger.warn('Failed to parse combat_log for match: %s', match_id);
    }

    try {
      creatorStats =
        typeof row.creator_stats_at_match === 'string'
          ? JSON.parse(row.creator_stats_at_match)
          : row.creator_stats_at_match || {};
    } catch {
      logger.warn('Failed to parse creator_stats_at_match for match: %s', match_id);
    }

    try {
      opponentStats =
        typeof row.opponent_stats_at_match === 'string'
          ? JSON.parse(row.opponent_stats_at_match)
          : row.opponent_stats_at_match || {};
    } catch {
      logger.warn('Failed to parse opponent_stats_at_match for match: %s', match_id);
    }

    const match = {
      match_id: row.match_id,
      result_id: row.result_id,
      creator_id: row.creator_id,
      opponent_id: row.opponent_id,
      creator_username: row.creator_username || 'Unknown',
      opponent_username: row.opponent_username || 'Unknown',
      winner_id: row.winner_id,
      loser_id: row.loser_id,
      match_type: row.match_type,
      is_punch_up: row.is_punch_up,
      creator_rank: row.creator_rank,
      opponent_rank: row.opponent_rank,
      creator_old_elo: row.creator_old_elo,
      creator_new_elo: row.creator_new_elo,
      opponent_old_elo: row.opponent_old_elo,
      opponent_new_elo: row.opponent_new_elo,
      total_turns: row.total_turns,
      duration_seconds: row.duration_seconds,
      end_reason: row.end_reason,
      combat_log: combatLog,
      creator_health_remaining: row.creator_health_remaining,
      opponent_health_remaining: row.opponent_health_remaining,
      creator_stats_at_match: creatorStats,
      opponent_stats_at_match: opponentStats,
      season_id: row.season_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    // Log access for audit trail
    logger.info('Match details accessed', {
      userId: ctx.userId,
      matchId: match_id,
      matchType: row.match_type,
    });

    return JSON.stringify({
      success: true,
      match: match,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to get match details', {
      error: errorMessage,
      userId: ctx.userId,
      matchId: match_id,
    });
    return JSON.stringify({
      success: false,
      error: 'Failed to retrieve match details',
    });
  }
}

/**
 * Registers the admin query matches RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcAdminQueryMatches(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/admin_query_matches', rpcAdminQueryMatches);
}

/**
 * Admin endpoint for querying matches with advanced filters for debugging.
 *
 * Allows QA to search matches by player, date range, match type, end reason,
 * and other criteria. This is a powerful debugging tool for dispute resolution.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string with filter parameters
 * @returns JSON string with matching matches
 *
 * @example
 * // Request payload
 * {
 *   "user_id": "player123",
 *   "match_type": "ranked",
 *   "start_date": "2024-01-01",
 *   "end_date": "2024-01-31",
 *   "limit": 50
 * }
 */
// eslint-disable-next-line complexity
export function rpcAdminQueryMatches(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Admin query matches called by user: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.admin_query_matches,
    payload,
    'admin_query_matches'
  );
  if (!validation.success) {
    return createValidationErrorResponse('admin_query_matches', validation.error);
  }

  const request = validation.data || {};
  const limit = Math.min(request.limit || 50, 200); // Cap at 200 for admin queries
  const offset = request.offset || 0;

  try {
    // Build the query with optional filters
    let query = `
      SELECT
        mr.match_id,
        mr.match_type,
        mr.is_punch_up,
        mr.creator_id,
        mr.opponent_id,
        mr.winner_id,
        mr.loser_id,
        mr.creator_rank,
        mr.opponent_rank,
        mr.total_turns,
        mr.duration_seconds,
        mr.end_reason,
        mr.created_at,
        mr.updated_at,
        mr.creator_health_remaining,
        mr.opponent_health_remaining,
        mr.season_id,
        u1.display_name as creator_username,
        u2.display_name as opponent_username
      FROM match_results mr
      LEFT JOIN users u1 ON mr.creator_id = u1.id
      LEFT JOIN users u2 ON mr.opponent_id = u2.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Filter by user ID (either creator or opponent)
    if (request.user_id) {
      query += ` AND (mr.creator_id = $${paramIndex} OR mr.opponent_id = $${paramIndex})`;
      params.push(request.user_id);
      paramIndex++;
    }

    // Filter by match type
    if (request.match_type) {
      query += ` AND mr.match_type = $${paramIndex}`;
      params.push(request.match_type);
      paramIndex++;
    }

    // Filter by end reason
    if (request.end_reason) {
      query += ` AND mr.end_reason = $${paramIndex}`;
      params.push(request.end_reason);
      paramIndex++;
    }

    // Filter by season
    if (request.season_id) {
      query += ` AND mr.season_id = $${paramIndex}`;
      params.push(request.season_id);
      paramIndex++;
    }

    // Filter by punch-up
    if (request.is_punch_up !== undefined) {
      query += ` AND mr.is_punch_up = $${paramIndex}`;
      params.push(request.is_punch_up);
      paramIndex++;
    }

    // Add date range filter
    if (request.start_date) {
      query += ` AND mr.created_at >= $${paramIndex}`;
      params.push(new Date(request.start_date).toISOString());
      paramIndex++;
    }
    if (request.end_date) {
      query += ` AND mr.created_at <= $${paramIndex}`;
      params.push(new Date(request.end_date).toISOString());
      paramIndex++;
    }

    // Get total count first
    const countQuery = query
      .replace(/SELECT[\s\S]+?FROM/, 'SELECT COUNT(*) as total FROM')
      .replace(/LEFT JOIN[\s\S]+?WHERE/, 'WHERE');
    const countResult = nk.dbQuery(countQuery, params) as any[];
    const total = countResult[0]?.total || 0;

    // Add ordering and pagination
    query += ` ORDER BY mr.created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit);
    params.push(offset);

    const result = nk.dbQuery(query, params) as any[];

    const matches = result.map((row: any) => ({
      match_id: row.match_id,
      match_type: row.match_type,
      is_punch_up: row.is_punch_up,
      creator_id: row.creator_id,
      opponent_id: row.opponent_id,
      creator_username: row.creator_username || 'Unknown',
      opponent_username: row.opponent_username || 'Unknown',
      winner_id: row.winner_id,
      loser_id: row.loser_id,
      creator_rank: row.creator_rank,
      opponent_rank: row.opponent_rank,
      total_turns: row.total_turns,
      duration_seconds: row.duration_seconds,
      end_reason: row.end_reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
      creator_health_remaining: row.creator_health_remaining,
      opponent_health_remaining: row.opponent_health_remaining,
      season_id: row.season_id,
    }));

    // Log admin query for audit trail
    logger.info('Admin match query executed', {
      userId: ctx.userId,
      filters: request,
      resultCount: matches.length,
      totalMatches: total,
    });

    return JSON.stringify({
      success: true,
      matches: matches,
      total: total,
      page: Math.floor(offset / limit) + 1,
      per_page: limit,
      total_pages: Math.ceil(total / limit),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to execute admin match query', {
      error: errorMessage,
      userId: ctx.userId,
      filters: request,
    });
    return JSON.stringify({
      success: false,
      error: 'Failed to query matches',
    });
  }
}

// =============================================================================
// ASYNC DUEL LIFECYCLE - Turn-Based PvP System
// =============================================================================

/**
 * Configuration constants for async duel timeouts and limits.
 */
const TURN_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours per turn
const MAX_CONSECUTIVE_TIMEOUTS = 2; // Auto-forfeit after 2 consecutive timeouts
const DEFAULT_MAX_TURNS = 10; // Maximum number of turns before forced end
const BASE_HEALTH = 100; // Base health for both players

/**
 * Punch-up configuration constants.
 * Punch-up allows lower-ranked players to challenge higher-ranked opponents
 * with enhanced rewards for winning and reduced rewards for the favorite.
 */
const PUNCH_UP_RANK_DIFF_THRESHOLD = 5; // Minimum rank difference to qualify as punch-up
const PUNCH_UP_MAX_RANK_DIFF = 15; // Maximum allowed rank difference for punch-up
const PUNCH_UP_MIN_RANK = 20; // Minimum rank to be eligible for punch-up (prevents low-level abuse)
const PUNCH_UP_XP_MULTIPLIER_MIN = 1.2; // Minimum XP multiplier for punch-up (small diff)
const PUNCH_UP_XP_MULTIPLIER_MAX = 2.0; // Maximum XP multiplier for punch-up (large diff)
const PUNCH_UP_GEM_BONUS_MIN = 3; // Minimum gems for punch-up win
const PUNCH_UP_GEM_BONUS_MAX = 10; // Maximum gems for punch-up win
const FAVORITE_REWARD_PENALTY_MIN = 0.7; // Minimum reward multiplier for favorites (30% reduction)
const FAVORITE_REWARD_PENALTY_MAX = 0.5; // Maximum reward multiplier for favorites (50% reduction)
const PUNCH_UP_LOSS_XP_MULTIPLIER = 0.5; // Issue #864: reduced XP grant on punch-up loss
const PUNCH_UP_LOSS_XP_MINIMUM = 1; // XP on any loss is strictly positive (progression is never wagered)

/**
 * Turn result data structure.
 */
interface TurnResult {
  creator_hit: boolean;
  opponent_hit: boolean;
  creator_damage: number;
  opponent_damage: number;
}

/**
 * Request payload for submitting a turn.
 */
export interface SubmitTurnRequest {
  match_id: string;
  action_type: 'shoot'; // Future: expand with more action types
  angle: number;
  power?: number;
}

/**
 * Request payload for forfeiting a match.
 */
export interface ForfeitMatchRequest {
  match_id: string;
}

/**
 * Registers the submit turn RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcSubmitTurn(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/submit_turn', rpcSubmitTurn);
}

/**
 * Submits a player's turn action for the current round.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing turn data
 * @returns JSON string with updated match state
 *
 * @example
 * // Request payload
 * { "match_id": "match_123", "action_type": "shoot", "angle": 1.57, "power": 0.9 }
 *
 * // Response (waiting for opponent)
 * {
 *   "success": true,
 *   "match": { ... },
 *   "turn_submitted": true
 * }
 *
 * // Response (both turns submitted, results calculated)
 * {
 *   "success": true,
 *   "match": { ... },
 *   "turn_result": { ... },
 *   "turn_completed": true
 * }
 */

/**
 * Stores turn data for a player.
 */
function storePlayerTurnData(match: PvPMatch, isCreator: boolean, turnData: TurnData): void {
  if (isCreator) {
    match.creator_turn_data = turnData;
  } else {
    match.opponent_turn_data = turnData;
  }
}

/**
 * Resets consecutive timeout counters for the submitting player.
 */
function resetConsecutiveTimeouts(match: PvPMatch, isCreator: boolean): void {
  if (isCreator && match.creator_consecutive_timeouts > 0) {
    match.creator_consecutive_timeouts = 0;
  } else if (!isCreator && match.opponent_consecutive_timeouts > 0) {
    match.opponent_consecutive_timeouts = 0;
  }
}

/**
 * Saves match state to storage.
 */
function saveMatchState(nk: Runtime.Nakama, match: PvPMatch): void {
  nk.storageWrite([
    {
      collection: 'pvp_matches',
      key: match.match_id,
      userId: match.creator_id,
      value: JSON.stringify(match),
    },
  ]);
}

/**
 * Processes turn when both players have submitted.
 */
function processCompleteTurn(
  match: PvPMatch,
  isCreator: boolean,
  now: number,
  logger: Runtime.Logger
): { turnResult: ReturnType<typeof calculateTurnResults>; shouldContinue: boolean } {
  const turnResult = calculateTurnResults(
    match.creator_turn_data!,
    match.opponent_turn_data!,
    match,
    logger
  );

  // Apply damage
  match.creator_health = Math.max(0, match.creator_health - turnResult.opponent_damage);
  match.opponent_health = Math.max(0, match.opponent_health - turnResult.creator_damage);

  // Clear turn data for next round
  match.creator_turn_data = undefined;
  match.opponent_turn_data = undefined;

  // Check for match end conditions
  const matchEndResult = checkMatchEndConditions(match, logger);

  if (matchEndResult.shouldEnd) {
    return { turnResult, shouldContinue: false };
  }

  // Advance to next turn
  match.current_turn += 1;
  match.current_player = isCreator ? match.opponent_id : match.creator_id;
  match.updated_at = now;

  return { turnResult, shouldContinue: true };
}

/**
 * Handles turn submission for asynchronous PvP matches.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing turn data
 * @returns JSON string with updated match state
 *
 * @example
 * // Request payload
 * { "match_id": "match_123", "action_type": "shoot", "angle": 1.57, "power": 0.9 }
 *
 * // Response (waiting for opponent)
 * {
 *   "success": true,
 *   "match": { ... },
 *   "turn_submitted": true
 * }
 *
 * // Response (both turns submitted, results calculated)
 * {
 *   "success": true,
 *   "match": { ... },
 *   "turn_result": { ... },
 *   "turn_completed": true
 * }
 */
// eslint-disable-next-line complexity
export function rpcSubmitTurn(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Submit turn called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.submit_turn, payload, 'submit_turn');
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'submit_turn',
      'pvp_matches',
      { match_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('submit_turn', validation.error);
  }

  const request = validation.data;

  // Anti-abuse: Check rate limiting
  const rateLimitCheck = checkRateLimit(ctx.userId, 'submit_turn');
  if (!rateLimitCheck.allowed) {
    logger.warn(
      'Submit turn rate limited for user: %s, reason: %s',
      ctx.userId,
      rateLimitCheck.reason
    );
    return JSON.stringify({
      error: 'Rate limit exceeded. Please try again later.',
      retry_after_ms: rateLimitCheck.retryAfter,
    });
  }

  // Fetch the match
  const matchResult = getMatchForTurnSubmission(nk, ctx, request.match_id, logger);
  if (matchResult.error || !matchResult.match) {
    return JSON.stringify({ error: matchResult.error || 'Match not found' });
  }
  const match = matchResult.match;

  // Check if match is active
  if (match.status !== 'active') {
    return JSON.stringify({
      error: 'Match is not active',
      match_status: match.status,
    });
  }

  // Check if it's the player's turn
  if (match.current_player !== ctx.userId) {
    return JSON.stringify({
      error: 'It is not your turn',
      current_player: match.current_player,
    });
  }

  // Anti-abuse: Check for duplicate turn submission
  const duplicateCheck = checkDuplicateTurn(ctx.userId, request.match_id, match.current_turn);
  if (duplicateCheck.isDuplicate) {
    logger.warn(
      'Duplicate turn submission detected for user: %s in match: %s, turn: %d',
      ctx.userId,
      request.match_id,
      match.current_turn
    );
    return JSON.stringify({
      error: 'You have already submitted a turn for this round.',
      turn_number: match.current_turn,
    });
  }

  const now = Date.now();

  // Check for timeout
  const timeoutCheck = checkTurnTimeout(match, now);
  if (timeoutCheck.shouldForfeit) {
    // Auto-forfeit due to consecutive timeouts
    return handleTimeoutForfeit(nk, ctx, logger, match, ctx.userId);
  }

  // Determine which player is submitting
  const isCreator = ctx.userId === match.creator_id;

  // Reset consecutive timeout counters
  resetConsecutiveTimeouts(match, isCreator);

  // Store the turn data
  const turnData: TurnData = {
    action_type: request.action_type,
    angle: request.angle,
    power: request.power ?? 1.0,
  };
  storePlayerTurnData(match, isCreator, turnData);

  // Update timestamp
  match.last_turn_timestamp = now;

  // Check if both players have submitted turns
  if (match.creator_turn_data && match.opponent_turn_data) {
    const { turnResult, shouldContinue } = processCompleteTurn(match, isCreator, now, logger);

    if (!shouldContinue) {
      const matchEndResult = checkMatchEndConditions(match, logger);
      return completeMatchFromTurn(nk, ctx, logger, match, matchEndResult);
    }

    saveMatchState(nk, match);

    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'submit_turn',
      'pvp_matches',
      { match_id: match.match_id, turn: match.current_turn - 1 },
      'success'
    );

    // Return with turn results
    return JSON.stringify({
      success: true,
      match: match,
      turn_result: turnResult,
      turn_completed: true,
    });
  }

  // Only one turn submitted, waiting for opponent
  match.updated_at = now;
  saveMatchState(nk, match);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'submit_turn',
    'pvp_matches',
    { match_id: match.match_id, turn: match.current_turn },
    'success'
  );

  return JSON.stringify({
    success: true,
    match: match,
    turn_submitted: true,
  });
}

/**
 * Registers the get async match state RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetAsyncMatchState(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_async_match_state', rpcGetAsyncMatchState);
}

/**
 * Retrieves the current state of an async match.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match_id
 * @returns JSON string with match state
 */
export function rpcGetAsyncMatchState(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get async match state called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_match_state, payload, 'get_async_match_state');
  if (!validation.success) {
    return createValidationErrorResponse('get_async_match_state', validation.error);
  }

  const request = validation.data;

  // Fetch the match
  const matchResult = getAndValidateMatch(nk, ctx, request, logger);
  if (matchResult.error || !matchResult.match) {
    return JSON.stringify({ error: matchResult.error || 'Match not found' });
  }
  const match = matchResult.match;

  // Check for timeout on state retrieval
  const now = Date.now();
  const timeoutCheck = checkTurnTimeout(match, now);

  // Calculate time remaining for current turn
  const timeRemainingMs = Math.max(0, match.turn_time_limit_ms - (now - match.last_turn_timestamp));

  // Determine player-specific information
  const isCreator = ctx.userId === match.creator_id;
  const myHealth = isCreator ? match.creator_health : match.opponent_health;
  const opponentHealth = isCreator ? match.opponent_health : match.creator_health;
  const isMyTurn = match.current_player === ctx.userId;

  // Handle timeout detection
  if (timeoutCheck.hasTimedOut) {
    if (timeoutCheck.shouldForfeit) {
      // Auto-forfeit due to consecutive timeouts
      const forfeitResult = handleTimeoutForfeit(nk, ctx, logger, match, match.current_player);
      // Return forfeit result
      return forfeitResult;
    } else {
      // Generate default turn for timed-out player
      handleFirstTimeout(nk, logger, match, match.current_player);
    }
  }

  return JSON.stringify({
    success: true,
    match: match,
    is_my_turn: isMyTurn,
    my_health: myHealth,
    opponent_health: opponentHealth,
    time_remaining_ms: timeRemainingMs,
    time_until_timeout: timeRemainingMs,
  });
}

/**
 * Registers the forfeit match RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcForfeitMatch(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/forfeit_match', rpcForfeitMatch);
}

/**
 * Player voluntarily forfeits the match.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match_id
 * @returns JSON string with match completion data
 */
export function rpcForfeitMatch(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Forfeit match called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.forfeit_match, payload, 'forfeit_match');
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'forfeit_match',
      'pvp_matches',
      { match_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('forfeit_match', validation.error);
  }

  const request = validation.data;

  // Fetch and validate the match
  const matchResult = getAndValidateMatch(nk, ctx, request, logger);
  if (matchResult.error || !matchResult.match) {
    return JSON.stringify({ error: matchResult.error || 'Match not found' });
  }
  const match = matchResult.match;

  // Check if match is active
  if (match.status !== 'active') {
    return JSON.stringify({
      error: 'Match is not active',
      match_status: match.status,
    });
  }

  // Determine opponent (server-declared winner: the non-forfeiting player)
  const opponentId = ctx.userId === match.creator_id ? match.opponent_id : match.creator_id;

  // Settle with the opponent as winner — derived server-side from the
  // forfeiting caller's identity, never from client-asserted payloads.
  const settlement: ServerSettlementRequest = {
    match_id: match.match_id,
    winner_id: opponentId,
    loser_id: ctx.userId,
    end_reason: 'forfeit',
  };

  // Use existing complete match logic
  const result = processMatchResult(ctx, logger, nk, settlement, match, match.is_punch_up);

  // Add forfeit information
  const resultObj = JSON.parse(result);
  if (resultObj.success) {
    resultObj.forfeited_by = ctx.userId;
    resultObj.forfeit_reason = 'voluntary';
  }

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'forfeit_match',
    'pvp_matches',
    {
      match_id: match.match_id,
      forfeited_by: ctx.userId,
      winner: opponentId,
    },
    'success'
  );

  return JSON.stringify(resultObj);
}

// =============================================================================
// HELPER FUNCTIONS FOR ASYNC DUEL LIFECYCLE
// =============================================================================

/**
 * Fetches and validates a match for turn submission.
 */
function getMatchForTurnSubmission(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  matchId: string,
  logger: Runtime.Logger
): { match?: PvPMatch; error?: string } {
  const objects = nk.storageRead([
    {
      collection: 'pvp_matches',
      key: matchId,
      userId: ctx.userId,
    },
  ]);

  if (objects.length === 0) {
    // Try reading with creator_id as userId
    const creatorObjects = nk.storageRead([
      {
        collection: 'pvp_matches',
        key: matchId,
        userId: ctx.userId, // This will be creator_id
      },
    ]);

    if (creatorObjects.length === 0) {
      return { error: 'Match not found' };
    }
  }

  const matchResult = safeParse<PvPMatch>(
    objects[0].value,
    null,
    logger,
    'getMatchForTurnSubmission:match'
  );
  if (!matchResult.success || !matchResult.data) {
    return { error: 'Failed to parse match data' };
  }
  const match = matchResult.data;

  // Verify user is a participant
  if (match.creator_id !== ctx.userId && match.opponent_id !== ctx.userId) {
    return { error: 'Not a participant in this match' };
  }

  return { match };
}

/**
 * Checks if the current turn has timed out.
 */
function checkTurnTimeout(
  match: PvPMatch,
  now: number
): {
  hasTimedOut: boolean;
  shouldForfeit: boolean;
} {
  const timeSinceLastTurn = now - match.last_turn_timestamp;
  const hasTimedOut = timeSinceLastTurn > match.turn_time_limit_ms;

  if (!hasTimedOut) {
    return { hasTimedOut: false, shouldForfeit: false };
  }

  const playerWhoTimedOut = match.current_player;
  const consecutiveTimeouts =
    playerWhoTimedOut === match.creator_id
      ? match.creator_consecutive_timeouts
      : match.opponent_consecutive_timeouts;

  const shouldForfeit = consecutiveTimeouts + 1 >= MAX_CONSECUTIVE_TIMEOUTS;

  return { hasTimedOut, shouldForfeit };
}

/**
 * Handles the first timeout for a player by generating a default turn.
 */
function handleFirstTimeout(
  nk: Runtime.Nakama,
  logger: Runtime.Logger,
  match: PvPMatch,
  timedOutPlayerId: string
): void {
  logger.warn('Player %s timed out in match %s (first timeout)', timedOutPlayerId, match.match_id);

  // Generate default turn data
  const defaultTurnData: TurnData = {
    action_type: 'shoot',
    angle: Math.PI / 2, // Straight shot
    power: 1.0, // Full power
  };

  // Store the default turn
  if (timedOutPlayerId === match.creator_id) {
    match.creator_turn_data = defaultTurnData;
    match.creator_consecutive_timeouts += 1;
  } else {
    match.opponent_turn_data = defaultTurnData;
    match.opponent_consecutive_timeouts += 1;
  }

  match.last_turn_timestamp = Date.now();

  // Save updated match state
  nk.storageWrite([
    {
      collection: 'pvp_matches',
      key: match.match_id,
      userId: match.creator_id,
      value: JSON.stringify(match),
    },
  ]);

  // Send timeout notification to the player
  sendTimeoutNotification(nk, timedOutPlayerId, match.match_id, 1);
}

/**
 * Handles forfeit due to consecutive timeouts.
 */
function handleTimeoutForfeit(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  match: PvPMatch,
  timedOutPlayerId: string
): string {
  logger.warn(
    'Player %s forfeited match %s due to consecutive timeouts',
    timedOutPlayerId,
    match.match_id
  );

  const opponentId = timedOutPlayerId === match.creator_id ? match.opponent_id : match.creator_id;

  // Mark match as completed
  match.status = 'completed';
  match.winner = opponentId;
  match.updated_at = Date.now();

  // Save match state
  nk.storageWrite([
    {
      collection: 'pvp_matches',
      key: match.match_id,
      userId: match.creator_id,
      value: JSON.stringify(match),
    },
  ]);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'timeout_forfeit',
    'pvp_matches',
    {
      match_id: match.match_id,
      forfeited_by: timedOutPlayerId,
      winner: opponentId,
    },
    'success'
  );

  // Return forfeit result
  return JSON.stringify({
    success: true,
    match: match,
    forfeited_by: timedOutPlayerId,
    forfeit_reason: 'consecutive_timeouts',
    winner_id: opponentId,
  });
}

/**
 * Calculates turn results based on both players' actions.
 */
function calculateTurnResults(
  creatorTurn: TurnData,
  opponentTurn: TurnData,
  match: PvPMatch,
  logger: Runtime.Logger
): TurnResult {
  // Simple damage calculation based on power and angle
  // In a real implementation, this would use the combat system
  const creatorBaseDamage = Math.round(10 * (creatorTurn.power ?? 1.0));
  const opponentBaseDamage = Math.round(10 * (opponentTurn.power ?? 1.0));

  // Calculate hit probability based on angle deviation from ideal
  // Ideal shot is straight up (PI/2)
  const creatorAngleDeviation = Math.abs(creatorTurn.angle - Math.PI / 2);
  const opponentAngleDeviation = Math.abs(opponentTurn.angle - Math.PI / 2);

  const creatorHitProbability = Math.max(0.3, 1 - creatorAngleDeviation / Math.PI);
  const opponentHitProbability = Math.max(0.3, 1 - opponentAngleDeviation / Math.PI);

  const creatorHit = Math.random() < creatorHitProbability;
  const opponentHit = Math.random() < opponentHitProbability;

  logger.info(
    'Turn calculated - Creator hit: %s (dmg: %d), Opponent hit: %s (dmg: %d)',
    creatorHit,
    creatorBaseDamage,
    opponentHit,
    opponentBaseDamage
  );

  return {
    creator_hit: creatorHit,
    opponent_hit: opponentHit,
    creator_damage: creatorHit ? creatorBaseDamage : 0,
    opponent_damage: opponentHit ? opponentBaseDamage : 0,
  };
}

/**
 * Checks if the match should end.
 */
function checkMatchEndConditions(
  match: PvPMatch,
  _logger: Runtime.Logger
): {
  shouldEnd: boolean;
  winner?: string;
  reason?: string;
} {
  // Check for HP-based win
  if (match.creator_health <= 0) {
    return { shouldEnd: true, winner: match.opponent_id, reason: 'creator_defeated' };
  }
  if (match.opponent_health <= 0) {
    return { shouldEnd: true, winner: match.creator_id, reason: 'opponent_defeated' };
  }

  // Check for max turns
  if (match.current_turn >= match.max_turns) {
    // Compare remaining HP
    if (match.creator_health > match.opponent_health) {
      return { shouldEnd: true, winner: match.creator_id, reason: 'max_turns_creator_wins' };
    } else if (match.opponent_health > match.creator_health) {
      return { shouldEnd: true, winner: match.opponent_id, reason: 'max_turns_opponent_wins' };
    } else {
      // Draw - no winner
      return { shouldEnd: true, winner: undefined, reason: 'draw' };
    }
  }

  return { shouldEnd: false };
}

/**
 * Completes a match from turn-based combat.
 */
function completeMatchFromTurn(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  match: PvPMatch,
  endResult: { shouldEnd: boolean; winner?: string; reason?: string }
): string {
  if (!endResult.winner) {
    // Handle draw — terminal with no winner: mark completed and settled
    // (no Elo/XP/rewards). settled_at makes replayed triggers idempotent.
    const now = Date.now();
    match.status = 'completed';
    match.updated_at = now;
    match.end_reason = 'draw';
    match.settled_at = now;

    nk.storageWrite([
      {
        collection: 'pvp_matches',
        key: match.match_id,
        userId: match.creator_id,
        value: JSON.stringify(match),
      },
    ]);

    return JSON.stringify({
      success: true,
      match: match,
      is_draw: true,
      reason: endResult.reason,
    });
  }

  const loserId = endResult.winner === match.creator_id ? match.opponent_id : match.creator_id;

  // Winner comes from the turn engine's server-side end conditions
  // (health-zero or max-turns health comparison) — never client input.
  const settlement: ServerSettlementRequest = {
    match_id: match.match_id,
    winner_id: endResult.winner,
    loser_id: loserId,
    end_reason: endResult.reason?.startsWith('max_turns') ? 'max_turns' : 'health_zero',
  };

  return processMatchResult(ctx, logger, nk, settlement, match, match.is_punch_up);
}

/**
 * Sends a timeout notification to a player.
 */
function sendTimeoutNotification(
  nk: Runtime.Nakama,
  userId: string,
  matchId: string,
  consecutiveCount: number
): void {
  try {
    nk.notificationSend(
      userId,
      'Your turn has timed out',
      {
        match_id: matchId,
        event: 'turn_timeout',
        consecutive_count: consecutiveCount,
        message:
          consecutiveCount >= MAX_CONSECUTIVE_TIMEOUTS
            ? 'You have forfeited the match due to consecutive timeouts.'
            : 'A default turn was submitted. Please submit your next turn promptly.',
      },
      1001, // Timeout notification code
      true, // persistent
      'system' // senderId
    );
  } catch (error) {
    // Non-blocking: notification failure should not affect match logic
    console.error('Failed to send timeout notification:', error);
  }
}
