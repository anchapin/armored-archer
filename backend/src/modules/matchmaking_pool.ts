/**
 * Matchmaking Pool module.
 * @fileoverview Implements rating-based pool matching with wait time expansion.
 */

import { Runtime } from '../types/nakama';
import { safeParse } from '../utils/safeParse';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

/**
 * Player in matchmaking queue.
 *
 * @property user_id - Player's user ID
 * @property mode - Match mode ("1v1" or "2v2")
 * @property rating - Player's rating
 * @property joined_at - Timestamp when player joined queue
 * @property bracket_size - Current rating bracket size
 */
export interface QueuedPlayer {
  user_id: string;
  mode: '1v1' | '2v2';
  rating: number;
  joined_at: number;
  bracket_size: number;
}

/**
 * Matchmaking pool state.
 *
 * @property players - Array of queued players
 * @property last_match_time - Timestamp of last match made
 */
export interface MatchmakingPool {
  players: QueuedPlayer[];
  last_match_time: number;
}

/**
 * Join pool request payload.
 *
 * @property mode - Match mode to join
 * @property rating - Player's current rating
 */
export interface JoinPoolRequest {
  mode: '1v1' | '2v2';
  rating: number;
}

/**
 * Leave pool request payload.
 *
 * @property mode - Match mode to leave
 */
export interface LeavePoolRequest {
  mode: '1v1' | '2v2';
}

/**
 * Queue status response.
 *
 * @property queue_position - Position in queue
 * @property estimated_wait - Estimated wait time in seconds
 */
export interface QueueStatusResponse {
  queue_position: number;
  estimated_wait: number;
}

// --- Constants ---
const INITIAL_BRACKET_SIZE = 100;
const EXPANDED_BRACKET_SIZE = 200;
const WIDE_BRACKET_SIZE = 300;
const EXPANSION_TIME_1 = 30 * 1000; // 30 seconds in ms
const EXPANSION_TIME_2 = 60 * 1000; // 60 seconds in ms
const MAX_WAIT_TIME = 90 * 1000; // 90 seconds in ms
const POOL_STORAGE_KEY = 'matchmaking_pool';

/**
 * Get the current pool from storage.
 */
function getPool(nk: Runtime.Nakama, mode: '1v1' | '2v2'): MatchmakingPool {
  const poolKey = `${POOL_STORAGE_KEY}_${mode}`;
  const objects = nk.storageRead([
    {
      collection: 'matchmaking',
      key: poolKey,
      userId: 'system',
    },
  ]);

  if (objects.length === 0) {
    return { players: [], last_match_time: Date.now() };
  }

  const result = safeParse<MatchmakingPool>(objects[0].value, null, undefined, 'getPool');
  if (result.success && result.data) {
    return result.data;
  }

  return { players: [], last_match_time: Date.now() };
}

/**
 * Save the pool to storage.
 */
function savePool(nk: Runtime.Nakama, pool: MatchmakingPool, mode: '1v1' | '2v2'): void {
  const poolKey = `${POOL_STORAGE_KEY}_${mode}`;
  nk.storageWrite([
    {
      collection: 'matchmaking',
      key: poolKey,
      userId: 'system',
      value: JSON.stringify(pool),
    },
  ]);
}

/**
 * Calculate bracket size based on wait time.
 */
function calculateBracketSize(waitTime: number): number {
  if (waitTime >= MAX_WAIT_TIME) {
    return -1; // -1 indicates any rating
  } else if (waitTime >= EXPANSION_TIME_2) {
    return WIDE_BRACKET_SIZE;
  } else if (waitTime >= EXPANSION_TIME_1) {
    return EXPANDED_BRACKET_SIZE;
  } else {
    return INITIAL_BRACKET_SIZE;
  }
}

/**
 * Check if two players are compatible for matching.
 */
function _arePlayersCompatible(player1: QueuedPlayer, player2: QueuedPlayer): boolean {
  // Must be same mode
  if (player1.mode !== player2.mode) {
    return false;
  }

  // For 2v2 mode, we need 4 players, so this is simplified to finding pairs
  // Real implementation would need to handle team composition

  const now = Date.now();
  const waitTime1 = now - player1.joined_at;
  const waitTime2 = now - player2.joined_at;

  const bracket1 = calculateBracketSize(waitTime1);
  const bracket2 = calculateBracketSize(waitTime2);

  // If either has any rating bracket (-1), they're compatible
  if (bracket1 === -1 || bracket2 === -1) {
    return true;
  }

  // Check rating difference against smaller bracket
  const bracketSize = Math.min(bracket1, bracket2);
  const ratingDiff = Math.abs(player1.rating - player2.rating);

  return ratingDiff <= bracketSize;
}

/**
 * Find the best match for a player.
 */
function findBestMatch(player: QueuedPlayer, pool: MatchmakingPool): QueuedPlayer | null {
  const now = Date.now();
  const waitTime = now - player.joined_at;
  const bracketSize = calculateBracketSize(waitTime);

  // Filter candidates by mode
  const candidates = pool.players.filter(
    (p) => p.user_id !== player.user_id && p.mode === player.mode
  );

  if (candidates.length === 0) {
    return null;
  }

  // If any rating bracket, return first available
  if (bracketSize === -1) {
    return candidates[0];
  }

  // Find players within current bracket
  const inBracket = candidates.filter((p) => Math.abs(p.rating - player.rating) <= bracketSize);

  if (inBracket.length === 0) {
    // No one in bracket, check if we should expand
    return null;
  }

  // Prioritize closest rating
  inBracket.sort((a, b) => {
    const diffA = Math.abs(a.rating - player.rating);
    const diffB = Math.abs(b.rating - player.rating);
    return diffA - diffB;
  });

  return inBracket[0];
}

/**
 * Register the join pool RPC endpoint.
 */
export function registerRpcJoinPool(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/join_matchmaking_pool', rpcJoinPool);
}

/**
 * Joins the matchmaking pool.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing join parameters
 * @returns JSON string with queue position and estimated wait
 */
export function rpcJoinPool(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Join pool called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.join_pool, payload, 'join_pool');
  if (!validation.success) {
    return createValidationErrorResponse('join_pool', validation.error);
  }

  const request = validation.data;

  // Get current pool
  const pool = getPool(nk, request.mode);

  // Check if player is already in pool
  const existingPlayer = pool.players.find((p) => p.user_id === ctx.userId);
  if (existingPlayer) {
    return JSON.stringify({
      error: 'Already in matchmaking pool',
    });
  }

  // Add player to pool
  const now = Date.now();
  const newPlayer: QueuedPlayer = {
    user_id: ctx.userId,
    mode: request.mode,
    rating: request.rating,
    joined_at: now,
    bracket_size: calculateBracketSize(0),
  };

  pool.players.push(newPlayer);
  savePool(nk, pool, request.mode);

  // Calculate queue position and estimated wait
  const queuePosition = pool.players.length;

  // Simple estimation: 30 seconds per person ahead, max 90 seconds
  const estimatedWait = Math.min(queuePosition * 30, MAX_WAIT_TIME / 1000);

  logger.info(
    'Player %s joined pool for mode %s with rating %d. Position: %d',
    ctx.userId,
    request.mode,
    request.rating,
    queuePosition
  );

  return JSON.stringify({
    success: true,
    queue_position: queuePosition,
    estimated_wait: estimatedWait,
  });
}

/**
 * Register the leave pool RPC endpoint.
 */
export function registerRpcLeavePool(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/leave_matchmaking_pool', rpcLeavePool);
}

/**
 * Leaves the matchmaking pool.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing leave parameters
 * @returns JSON string with success status
 */
export function rpcLeavePool(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Leave pool called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.leave_pool, payload, 'leave_pool');
  if (!validation.success) {
    return createValidationErrorResponse('leave_pool', validation.error);
  }

  const request = validation.data;

  // Get current pool
  const pool = getPool(nk, request.mode);

  // Find and remove player
  const playerIndex = pool.players.findIndex((p) => p.user_id === ctx.userId);
  if (playerIndex === -1) {
    return JSON.stringify({
      error: 'Not in matchmaking pool',
    });
  }

  pool.players.splice(playerIndex, 1);
  savePool(nk, pool, request.mode);

  logger.info('Player %s left pool for mode %s', ctx.userId, request.mode);

  return JSON.stringify({
    success: true,
  });
}

/**
 * Register the get queue status RPC endpoint.
 */
export function registerRpcGetQueueStatus(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_queue_status', rpcGetQueueStatus);
}

/**
 * Gets the current queue status.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing mode
 * @returns JSON string with queue position and estimated wait
 */
export function rpcGetQueueStatus(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get queue status called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_queue_status, payload, 'get_queue_status');
  if (!validation.success) {
    return createValidationErrorResponse('get_queue_status', validation.error);
  }

  const request = validation.data;

  // Get current pool
  const pool = getPool(nk, request.mode);

  // Find player
  const player = pool.players.find((p) => p.user_id === ctx.userId);
  if (!player) {
    return JSON.stringify({
      error: 'Not in matchmaking pool',
    });
  }

  // Calculate current position
  const queuePosition = pool.players.findIndex((p) => p.user_id === ctx.userId) + 1;

  // Calculate wait time
  const now = Date.now();
  const waitTime = now - player.joined_at;

  // Update bracket size
  const bracketSize = calculateBracketSize(waitTime);
  player.bracket_size = bracketSize;
  savePool(nk, pool, request.mode);

  // Try to find a match
  const matchedPlayer = findBestMatch(player, pool);
  if (matchedPlayer) {
    logger.info(
      'Match found for %s with %s in mode %s',
      ctx.userId,
      matchedPlayer.user_id,
      request.mode
    );

    // Remove both players from pool
    const filteredPlayers = pool.players.filter(
      (p) => p.user_id !== ctx.userId && p.user_id !== matchedPlayer.user_id
    );
    pool.players = filteredPlayers;
    pool.last_match_time = now;
    savePool(nk, pool, request.mode);

    return JSON.stringify({
      success: true,
      match_found: true,
      opponent_id: matchedPlayer.user_id,
      opponent_rating: matchedPlayer.rating,
    });
  }

  // No match found, return queue status
  const estimatedWait = Math.min(queuePosition * 30, MAX_WAIT_TIME / 1000);

  return JSON.stringify({
    success: true,
    match_found: false,
    queue_position: queuePosition,
    estimated_wait: estimatedWait,
    current_bracket_size: bracketSize,
    wait_time_seconds: waitTime / 1000,
  });
}

/**
 * Background task to process matchmaking.
 * This would typically be run by a cron job or scheduled task.
 */
export function processMatchmaking(logger: Runtime.Logger, nk: Runtime.Nakama): void {
  const modes: ('1v1' | '2v2')[] = ['1v1', '2v2'];

  for (const mode of modes) {
    const pool = getPool(nk, mode);

    if (pool.players.length < 2) {
      continue; // Not enough players
    }

    // Sort by wait time (longest waiting first)
    const sortedPlayers = [...pool.players].sort((a, b) => a.joined_at - b.joined_at);

    // Try to find matches
    for (let i = 0; i < sortedPlayers.length; i++) {
      const player = sortedPlayers[i];
      const match = findBestMatch(player, pool);

      if (match) {
        logger.info('Auto-matched %s with %s in mode %s', player.user_id, match.user_id, mode);

        // Remove matched players
        pool.players = pool.players.filter(
          (p) => p.user_id !== player.user_id && p.user_id !== match.user_id
        );

        pool.last_match_time = Date.now();
        savePool(nk, pool, mode);

        // Here you would trigger a notification to both players
        // via Nakama's notification system
        break; // Start fresh after a match
      }
    }
  }
}
