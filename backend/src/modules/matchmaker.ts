import { Runtime } from '../types/nakama';
import { TurnData, PlayerStats } from '../types/game';
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
 */
export interface PvPMatch {
  match_id: string;
  creator_id: string;
  opponent_id: string;
  creator_rank: number;
  opponent_rank: number;
  match_type: 'ranked' | 'casual';
  is_punch_up: boolean;
  status: 'pending' | 'active' | 'completed';
  created_at: number;
  updated_at: number;
  creator_turn_data?: TurnData;
  opponent_turn_data?: TurnData;
  winner?: string;
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
    const match: PvPMatch = {
      match_id: generateMatchId(),
      creator_id: ctx.userId,
      opponent_id: '',
      creator_rank: playerRank,
      opponent_rank: 0,
      match_type: request.match_type,
      is_punch_up: false,
      status: 'pending',
      created_at: Date.now(),
      updated_at: Date.now(),
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
  match.opponent_id = ctx.userId;
  match.opponent_rank = calculateRank(playerStats);
  match.status = 'active';
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

  return JSON.stringify({
    success: true,
    rank: rank,
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
