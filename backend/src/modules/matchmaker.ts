/**
 * Matchmaker module.
 * @fileoverview Implements matchmaking and ranking for PvP matches.
 */

import { TurnData, PlayerStats } from '../types/game';
import { Runtime } from '../types/nakama';
import { isPlayerFlagged, getFlagReason, recordMatchResult } from './anti_cheat';
import { logAudit } from './audit';
import {
  getCurrentSeason,
  applyEloUpdates,
  getLeaderboardEntry,
  recordPlayerActivity,
  applyRankDecay,
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

  const playerStats = JSON.parse(objects[0].value);
  const playerRank = calculateRank(playerStats);

  const matches = nk.storageList(ctx.userId, 'pvp_matches', limit, '', '');

  const filteredMatches: PvPMatch[] = [];

  for (const object of matches) {
    const match: PvPMatch = JSON.parse(object.value);

    if (match.status !== 'pending') {
      continue;
    }

    if (request.match_type && match.match_type !== request.match_type) {
      continue;
    }

    if (match.creator_id === ctx.userId) {
      continue;
    }

    if (request.min_rank !== undefined && match.creator_rank < request.min_rank) {
      continue;
    }

    if (request.max_rank !== undefined && match.creator_rank > request.max_rank) {
      continue;
    }

    filteredMatches.push(match);
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

  const playerStats = JSON.parse(objects[0].value);
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

    const targetPlayerStats = JSON.parse(targetStats[0].value);
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

  const match: PvPMatch = JSON.parse(objects[0].value);

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

  const playerStats = JSON.parse(playerObjects[0].value);
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

  const playerStats = JSON.parse(objects[0].value);
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
 *   "winner": { "user_id": "user_1", "old_rank": 1200, "new_rank": 1220, "rank_change": 20 },
 *   "loser": { "user_id": "user_2", "old_rank": 1200, "new_rank": 1180, "rank_change": -20 }
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
  const matchResult = getAndValidateMatch(nk, ctx, request);
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
  request: { match_id: string }
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

  const match: PvPMatch = JSON.parse(objects[0].value);

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
  // Only process rank changes for ranked matches
  let winnerNewRank = match.creator_rank;
  let loserNewRank = match.opponent_rank;
  let winnerRankChange = 0;
  let loserRankChange = 0;

  if (match.match_type === 'ranked') {
    const currentSeason = getCurrentSeason();

    // Get current Elo ratings from leaderboard
    const winnerEntry = getLeaderboardEntry(nk, request.winner_id, currentSeason.season_id);
    const loserEntry = getLeaderboardEntry(nk, request.loser_id, currentSeason.season_id);

    const winnerOldElo = winnerEntry ? winnerEntry.score : 1000;
    const loserOldElo = loserEntry ? loserEntry.score : 1000;

    // Apply Elo updates
    const { winnerNewElo, loserNewElo } = applyEloUpdates(
      nk,
      ctx,
      currentSeason,
      request.winner_id,
      request.loser_id,
      winnerOldElo,
      loserOldElo,
      isPunchUp,
      winnerEntry,
      loserEntry
    );

    winnerNewRank = winnerNewElo;
    loserNewRank = loserNewElo;
    winnerRankChange = winnerNewElo - winnerOldElo;
    loserRankChange = loserNewElo - loserOldElo;

    // Record match results for anti-cheat analysis
    recordMatchResult(
      request.winner_id,
      request.match_id,
      request.loser_id,
      'win',
      true,
      winnerOldElo,
      winnerNewElo
    );
    recordMatchResult(
      request.loser_id,
      request.match_id,
      request.winner_id,
      'loss',
      true,
      loserOldElo,
      loserNewElo
    );
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

  return JSON.stringify({
    success: true,
    match: match,
    winner: {
      user_id: request.winner_id,
      old_rank:
        match.match_type === 'ranked'
          ? request.winner_id === match.creator_id
            ? match.creator_rank
            : match.opponent_rank
          : 0,
      new_rank: winnerNewRank,
      rank_change: winnerRankChange,
    },
    loser: {
      user_id: request.loser_id,
      old_rank:
        match.match_type === 'ranked'
          ? request.loser_id === match.creator_id
            ? match.creator_rank
            : match.opponent_rank
          : 0,
      new_rank: loserNewRank,
      rank_change: loserRankChange,
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
