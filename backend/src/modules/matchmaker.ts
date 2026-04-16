/**
 * Matchmaker module.
 * @fileoverview Implements matchmaking and ranking for PvP matches.
 */

import { TurnData, PlayerStats } from '../types/game';
import { Runtime } from '../types/nakama';
import { safeParse } from '../utils/safeParse';
import { readAndParseStorage } from '../utils/storage-helpers';
import { isPlayerFlagged, getFlagReason, recordMatchResult } from './anti_cheat';
import { logAudit } from './audit';
import { logRankingDelta, type RankingDeltaEvent } from './fairness_telemetry';
import {
  getCurrentSeason,
  applyEloUpdates,
  getLeaderboardEntry,
  recordPlayerActivity,
  applyRankDecay,
  SeasonInfo,
} from './season_system';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

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
 * @property match_id - ID of the match to complete
 * @property winner_id - ID of the match winner
 * @property loser_id - ID of the match loser
 * @property is_punch_up - Whether this was a punch-up match
 */
export interface CompleteMatchRequest {
  match_id: string;
  winner_id: string;
  loser_id: string;
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
 * Registers the get player rank RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetPlayerRank(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_player_rank', rpcGetPlayerRank);
}

/**
 * Retrieves a player's current rank and stats.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with player rank and stats
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "rank": 15,
 *   "level": 5,
 *   "xp": 450
 * }
 */
export function rpcGetPlayerRank(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get player rank called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_player_rank, payload, 'get_player_rank');
  if (!validation.success) {
    return createValidationErrorResponse('get_player_rank', validation.error);
  }

  const statsResult = readAndParseStorage<PlayerStats>(
    nk,
    'player_stats',
    ctx.userId,
    ctx.userId,
    logger,
    'rpcGetPlayerRank'
  );
  if (statsResult.error) {
    return JSON.stringify({ error: 'Player stats not found' });
  }
  const playerStats = statsResult.data!;
  const rank = calculateRank(playerStats);

  // Apply rank decay check - this updates the player's rank if they've been inactive
  const decayedRank = applyRankDecay(nk, ctx.userId, rank);

  return JSON.stringify({
    success: true,
    rank: decayedRank,
    level: playerStats.level,
    xp: playerStats.xp,
  });
}

/**
 * Calculates a player's rank based on level and stats.
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
 * Completes a PvP match and updates player ranks using Elo rating system.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match completion data
 * @returns JSON string with match result and rank changes
 *
 * @example
 * // Request payload
 * { "match_id": "match_123", "winner_id": "user_1", "loser_id": "user_2", "is_punch_up": false }
 *
 * // Response
 * {
 *   "success": true,
 *   "match": { ... },
 *   "winner": { "user_id": "user_1", "old_rank": 1200, "new_rank": 1220, "rank_change": 20, "xp_gained": 150, "old_season_position": 42, "new_season_position": 40, "rewards": [...] },
 *   "loser": { "user_id": "user_2", "old_rank": 1200, "new_rank": 1180, "rank_change": -20, "xp_gained": 50, "old_season_position": 43, "new_season_position": 44, "rewards": [...] },
 *   "is_punch_up": false
 * }
 */
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
      { match_id: 'unknown', winner_id: 'unknown', loser_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('complete_match', validation.error);
  }

  const request = validation.data;

  // Anti-cheat: Check if players are flagged
  const winnerFlagged = checkPlayerFlagged(logger, request.winner_id, 'winner');
  if (winnerFlagged) return winnerFlagged;

  const loserFlagged = checkPlayerFlagged(logger, request.loser_id, 'loser');
  if (loserFlagged) return loserFlagged;

  // Fetch and validate the match
  const matchResult = getAndValidateMatch(nk, ctx, request, logger);
  if (matchResult.error || !matchResult.match) {
    return JSON.stringify({ error: matchResult.error || 'Match not found' });
  }
  const match = matchResult.match;

  // Validate winner/loser are valid participants
  const participantError = validateMatchParticipants(match, request);
  if (participantError) {
    return JSON.stringify({ error: participantError });
  }

  const isPunchUp = request.is_punch_up || match.is_punch_up;

  // Process match result
  return processMatchResult(ctx, logger, nk, request, match, isPunchUp);
}

/**
 * Fetch and validate the match from storage
 */
function getAndValidateMatch(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  request: { match_id: string },
  logger: Runtime.Logger
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

  if (match.status !== 'active') {
    return { error: 'Match is not active' };
  }

  if (match.creator_id !== ctx.userId && match.opponent_id !== ctx.userId) {
    return { error: 'Not authorized to complete this match' };
  }

  return { match };
}

/**
 * Validate that winner and loser are valid match participants
 */
function validateMatchParticipants(
  match: PvPMatch,
  request: { winner_id: string; loser_id: string }
): string | null {
  // Validate winner and loser are the match participants
  if (
    (request.winner_id !== match.creator_id && request.winner_id !== match.opponent_id) ||
    (request.loser_id !== match.creator_id && request.loser_id !== match.opponent_id)
  ) {
    return 'Winner and loser must be match participants';
  }

  // Validate winner and loser are different
  if (request.winner_id === request.loser_id) {
    return 'Winner and loser must be different';
  }

  return null;
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
 * Process ranked match updates (Elo, records, anti-cheat)
 */
function processRankedMatchUpdates(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  winnerId: string,
  loserId: string,
  matchId: string,
  currentSeason: SeasonInfo,
  isPunchUp: boolean
): {
  winnerNewRank: number;
  loserNewRank: number;
  winnerRankChange: number;
  loserRankChange: number;
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
    loserEntry
  );

  // Record match results for anti-cheat analysis
  recordMatchResult(winnerId, matchId, loserId, 'win', true, winnerOldElo, winnerNewElo);
  recordMatchResult(loserId, matchId, winnerId, 'loss', true, loserOldElo, loserNewElo);

  return {
    winnerNewRank: winnerNewElo,
    loserNewRank: loserNewElo,
    winnerRankChange: winnerNewElo - winnerOldElo,
    loserRankChange: loserNewElo - loserOldElo,
  };
}

/**
 * Process the match result, calculate ranks, and update storage
 */
function processMatchResult(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  request: { match_id: string; winner_id: string; loser_id: string },
  match: PvPMatch,
  isPunchUp: boolean
): string {
  // Initialize ranks for ranked matches
  let winnerNewRank = match.creator_rank;
  let loserNewRank = match.opponent_rank;
  let winnerRankChange = 0;
  let loserRankChange = 0;

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
      isPunchUp
    );
    winnerNewRank = rankedUpdates.winnerNewRank;
    loserNewRank = rankedUpdates.loserNewRank;
    winnerRankChange = rankedUpdates.winnerRankChange;
    loserRankChange = rankedUpdates.loserRankChange;
  }

  // Record player activity for rank decay tracking
  recordPlayerActivity(nk, request.winner_id);
  recordPlayerActivity(nk, request.loser_id);

  // Apply rank decay if applicable (for inactive players)
  const { winnerNewRank: winnerDecayedRank, loserNewRank: loserDecayedRank } = applyMatchRankDecay(
    nk,
    request.winner_id,
    request.loser_id,
    winnerNewRank,
    loserNewRank,
    logger
  );

  winnerNewRank = winnerDecayedRank;
  loserNewRank = loserDecayedRank;

  // Get season information for position tracking
  const currentSeason = getCurrentSeason();
  const winnerOldSeasonEntry = getLeaderboardEntry(nk, request.winner_id, currentSeason.season_id);
  const loserOldSeasonEntry = getLeaderboardEntry(nk, request.loser_id, currentSeason.season_id);

  const winnerOldSeasonPosition = winnerOldSeasonEntry ? winnerOldSeasonEntry.rank : 0;
  const loserOldSeasonPosition = loserOldSeasonEntry ? loserOldSeasonEntry.rank : 0;

  // Calculate punch-up info for reward scaling
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

  // Determine if winner and loser are underdogs or favorites
  const winnerIsUnderdog = request.winner_id === punchUpInfo.underdog_id;
  const loserIsUnderdog = request.loser_id === punchUpInfo.underdog_id;

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

  // Award rewards to players (coins, gems)
  awardMatchRewards(nk, request.winner_id, winnerRewards);
  awardMatchRewards(nk, request.loser_id, loserRewards);

  // Update player XP
  updatePlayerXP(nk, request.winner_id, winnerXPGained);
  updatePlayerXP(nk, request.loser_id, loserXPGained);

  // Update match status to completed
  const now = Date.now();
  match.status = 'completed';
  match.winner = request.winner_id;
  match.updated_at = now;

  // Update the match in storage
  nk.storageWrite([
    {
      collection: 'pvp_matches',
      key: match.match_id,
      userId: match.creator_id,
      value: JSON.stringify(match),
    },
  ]);

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
  const winnerNewSeasonEntry = getLeaderboardEntry(nk, request.winner_id, currentSeason.season_id);
  const loserNewSeasonEntry = getLeaderboardEntry(nk, request.loser_id, currentSeason.season_id);

  const winnerNewSeasonPosition = winnerNewSeasonEntry ? winnerNewSeasonEntry.rank : 0;
  const loserNewSeasonPosition = loserNewSeasonEntry ? loserNewSeasonEntry.rank : 0;

  // Calculate season position delta (negative means moved up in rank)
  const winnerSeasonDelta =
    winnerOldSeasonPosition > 0 && winnerNewSeasonPosition > 0
      ? winnerNewSeasonPosition - winnerOldSeasonPosition
      : 0;
  const loserSeasonDelta =
    loserOldSeasonPosition > 0 && loserNewSeasonPosition > 0
      ? loserNewSeasonPosition - loserOldSeasonPosition
      : 0;

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
  });
}

/**
 * Apply rank decay to match participants
 */
function applyMatchRankDecay(
  nk: Runtime.Nakama,
  winnerId: string,
  loserId: string,
  winnerRank: number,
  loserRank: number,
  logger: Runtime.Logger
): { winnerNewRank: number; loserNewRank: number } {
  const winnerDecayedRank = applyRankDecay(nk, winnerId, winnerRank);
  const loserDecayedRank = applyRankDecay(nk, loserId, loserRank);

  if (winnerDecayedRank !== winnerRank) {
    logger.info(
      'Rank decay applied for winner %s: %d -> %d',
      winnerId,
      winnerRank,
      winnerDecayedRank
    );
  }
  if (loserDecayedRank !== loserRank) {
    logger.info('Rank decay applied for loser %s: %d -> %d', loserId, loserRank, loserDecayedRank);
  }

  return { winnerNewRank: winnerDecayedRank, loserNewRank: loserDecayedRank };
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
 * @param params - Reward calculation parameters
 * @returns XP gained
 */
function calculateXPGain(params: RewardCalculationParams): number {
  const rankedBaseXP = params.isWinner ? 100 : 25;
  const casualBaseXP = params.isWinner ? 50 : 15;

  // Casual matches award 50% of ranked XP
  let baseXP = params.matchType === 'ranked' ? rankedBaseXP : casualBaseXP;

  if (params.isPunchUp) {
    if (params.isUnderdog) {
      // Underdog gets bonus based on rank difference
      baseXP = Math.round(baseXP * params.rewardMultiplier);
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
 * Punch-up mechanics:
 * - Underdogs: Scaled XP multiplier, bonus gems for wins
 * - Favorites: Reduced rewards (50-70% of normal), harsher penalties for losses
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

  // Apply favorite penalty for punch-up matches
  if (params.isPunchUp && !params.isUnderdog) {
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
  if (params.isWinner && params.isPunchUp && params.isUnderdog && params.matchType === 'ranked') {
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
 * @param nk - Nakama server interface
 * @param userId - ID of the player to award rewards to
 * @param rewards - Array of rewards to award
 */
function awardMatchRewards(nk: Runtime.Nakama, userId: string, rewards: MatchReward[]): void {
  const walletChanges: { [key: string]: number } = {};

  for (const reward of rewards) {
    if (reward.type === 'coin') {
      walletChanges['coins'] = (walletChanges['coins'] || 0) + reward.quantity;
    } else if (reward.type === 'gem') {
      walletChanges['gems'] = (walletChanges['gems'] || 0) + reward.quantity;
    }
    // XP is handled separately
  }

  if (Object.keys(walletChanges).length > 0) {
    nk.walletUpdate(userId, walletChanges);
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

  // Check for level up (simple formula: level * 100 XP required for next level)
  const xpForNextLevel = playerStats.level * 100;
  if (playerStats.xp >= xpForNextLevel) {
    playerStats.level += 1;
    playerStats.xp -= xpForNextLevel;
    // Award ability point on level up
    playerStats.ability_points = (playerStats.ability_points || 0) + 1;
  }

  nk.storageWrite([
    {
      collection: 'player_stats',
      key: userId,
      userId: userId,
      value: JSON.stringify(playerStats),
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
      // eslint-disable-next-line no-empty
    } catch {
      logger.warn('Failed to parse combat_log for match: %s', match_id);
    }

    try {
      creatorStats =
        typeof row.creator_stats_at_match === 'string'
          ? JSON.parse(row.creator_stats_at_match)
          : row.creator_stats_at_match || {};
      // eslint-disable-next-line no-empty
    } catch {
      logger.warn('Failed to parse creator_stats_at_match for match: %s', match_id);
    }

    try {
      opponentStats =
        typeof row.opponent_stats_at_match === 'string'
          ? JSON.parse(row.opponent_stats_at_match)
          : row.opponent_stats_at_match || {};
      // eslint-disable-next-line no-empty
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

  // Determine opponent
  const opponentId = ctx.userId === match.creator_id ? match.opponent_id : match.creator_id;

  // Complete match with opponent as winner
  const completeRequest: CompleteMatchRequest = {
    match_id: match.match_id,
    winner_id: opponentId,
    loser_id: ctx.userId,
    is_punch_up: match.is_punch_up,
  };

  // Use existing complete match logic
  const result = processMatchResult(ctx, logger, nk, completeRequest, match, match.is_punch_up);

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
    // Handle draw
    match.status = 'completed';
    match.updated_at = Date.now();

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

  const completeRequest: CompleteMatchRequest = {
    match_id: match.match_id,
    winner_id: endResult.winner,
    loser_id: loserId,
    is_punch_up: match.is_punch_up,
  };

  return processMatchResult(ctx, logger, nk, completeRequest, match, match.is_punch_up);
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
