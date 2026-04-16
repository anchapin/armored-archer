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

    if (!request.is_punch_up && Math.abs(playerRank - targetRank) > 3) {
      return JSON.stringify({
        error: 'Rank difference too large for direct challenge',
      });
    }

    const match: PvPMatch = {
      match_id: generateMatchId(),
      creator_id: ctx.userId,
      opponent_id: request.target_opponent_id,
      creator_rank: playerRank,
      opponent_rank: targetRank,
      match_type: request.match_type,
      is_punch_up: request.is_punch_up || false,
      status: 'pending',
      created_at: Date.now(),
      updated_at: Date.now(),
      expires_at: Date.now() + 300000, // 5 minutes
      last_turn_timestamp: Date.now(),
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

  // Calculate XP gains
  const winnerXPGained = calculateXPGain(true, isPunchUp);
  const loserXPGained = calculateXPGain(false, isPunchUp);

  // Calculate per-match rewards
  const winnerRewards = calculateMatchRewards(true, isPunchUp, winnerXPGained);
  const loserRewards = calculateMatchRewards(false, isPunchUp, loserXPGained);

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
 * Calculates XP gain based on match result and type.
 *
 * @param isWinner - Whether the player won the match
 * @param isPunchUp - Whether this was a punch-up match
 * @returns XP gained
 */
function calculateXPGain(isWinner: boolean, isPunchUp: boolean): number {
  const baseXP = isWinner ? 100 : 25;
  const punchUpMultiplier = isPunchUp ? 1.5 : 1.0;
  return Math.round(baseXP * punchUpMultiplier);
}

/**
 * Calculates per-match rewards based on result and type.
 *
 * @param isWinner - Whether the player won the match
 * @param isPunchUp - Whether this was a punch-up match
 * @param xpGained - XP gained in the match
 * @returns Array of match rewards
 */
function calculateMatchRewards(
  isWinner: boolean,
  isPunchUp: boolean,
  xpGained: number
): MatchReward[] {
  const rewards: MatchReward[] = [];

  // XP is always awarded as a reward
  rewards.push({
    name: 'XP',
    quantity: xpGained,
    type: 'xp',
  });

  // Coins awarded based on result
  const coins = isWinner ? 50 : 10;
  rewards.push({
    name: 'Coins',
    quantity: coins,
    type: 'coin',
  });

  // Bonus gems for punch-up wins
  if (isWinner && isPunchUp) {
    rewards.push({
      name: 'Gems',
      quantity: 5,
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
  const limit = request.limit || 20;
  const offset = request.offset || 0;

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

  const matches = nk.storageList(ctx.userId, 'pvp_matches', limit, '', '');

  const filteredMatches: Array<{
    match_id: string;
    match_type: 'ranked' | 'casual';
    is_punch_up: boolean;
    status: 'completed';
    created_at: number;
    updated_at: number;
    winner?: string;
    creator_id: string;
    opponent_id: string;
    creator_rank: number;
    opponent_rank: number;
    is_victory: boolean;
  }> = [];

  for (const object of matches) {
    const matchResult = safeParse<PvPMatch>(object.value, null, logger, 'rpcGetMatchHistory:match');
    if (!matchResult.success || !matchResult.data) {
      logger.warn('Skipping corrupted match record for user: %s', ctx.userId);
      continue;
    }
    const match = matchResult.data;

    if (match.status !== 'completed') {
      continue;
    }

    if (request.match_type && match.match_type !== request.match_type) {
      continue;
    }

    const isVictory = match.winner === ctx.userId;

    filteredMatches.push({
      match_id: match.match_id,
      match_type: match.match_type,
      is_punch_up: match.is_punch_up,
      status: match.status,
      created_at: match.created_at,
      updated_at: match.updated_at,
      winner: match.winner,
      creator_id: match.creator_id,
      opponent_id: match.opponent_id,
      creator_rank: match.creator_rank,
      opponent_rank: match.opponent_rank,
      is_victory: isVictory,
    });
  }

  filteredMatches.sort((a, b) => b.updated_at - a.updated_at);

  const paginatedMatches = filteredMatches.slice(offset, offset + limit);

  const wins = filteredMatches.filter((m) => m.is_victory).length;
  const losses = filteredMatches.filter((m) => !m.is_victory).length;
  const winRate = wins + losses > 0 ? wins / (wins + losses) : 0;

  return JSON.stringify({
    success: true,
    matches: paginatedMatches,
    total: filteredMatches.length,
    stats: {
      wins: wins,
      losses: losses,
      win_rate: Math.round(winRate * 100) / 100,
    },
  });
}
