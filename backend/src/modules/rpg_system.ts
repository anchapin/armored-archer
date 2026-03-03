/**
 * RPG System module.
 * @fileoverview Handles XP gains and stat allocation.
 */

import { Runtime } from '../types/nakama';
import { safeParse, createErrorResponse } from '../utils/safeParse';
import { getCacheManager } from '../utils/cache';
import { invalidatePlayerStatsCache } from '../utils/db_optimizer';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import { registerRpcWithMetrics } from './metrics';

/**
 * Player statistics data structure.
 *
 * @property user_id - Unique identifier for the player
 * @property level - Current player level
 * @property xp - Current experience points
 * @property ability_points - Points available for stat allocation
 * @property stats - Player combat statistics
 */
export interface PlayerStats {
  user_id: string;
  level: number;
  xp: number;
  ability_points: number;
  stats: {
    attack: number;
    defense: number;
    dodge: number;
    crit_rate: number;
  };
}

/**
 * Request payload for gaining XP.
 *
 * @property xp_amount - Amount of XP to gain
 * @property source - Source of XP gain ("pve" or "pvp")
 */
export interface XPGainRequest {
  xp_amount: number;
  source: string; // "pve" or "pvp"
}

/**
 * Request payload for stat allocation.
 *
 * @property stat_name - Name of stat to increase
 * @property points - Number of points to allocate
 */
export interface StatAllocationRequest {
  stat_name: string; // "attack", "defense", "dodge", "crit_rate"
  points: number;
}

/**
 * Registers the gain XP RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGainXP(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(initializer, 'armored_archer/gain_xp', 'gain_xp', rpcGainXP);
}

/**
 * Handles XP gain requests and level progression.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing xp_amount and source
 * @returns JSON string with success status and updated player stats
 *
 * @example
 * // Request payload
 * { "xp_amount": 100, "source": "pve" }
 *
 * // Response
 * {
 *   "success": true,
 *   "player_stats": { ... },
 *   "xp_gained": 100,
 *   "levels_gained": 1
 * }
 */
export function rpcGainXP(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Gain XP called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.gain_xp, payload, 'gain_xp');
  if (!validation.success) {
    return createValidationErrorResponse('gain_xp', validation.error);
  }

  const request = validation.data;

  const objects = nk.storageRead([
    {
      collection: 'player_stats',
      key: ctx.userId,
      userId: ctx.userId,
    },
  ]);

  let playerStats: PlayerStats;

  if (objects.length === 0) {
    playerStats = {
      user_id: ctx.userId,
      level: 1,
      xp: 0,
      ability_points: 0,
      stats: {
        attack: 10,
        defense: 10,
        dodge: 10,
        crit_rate: 5,
      },
    };
  } else {
    const value = objects[0].value;
    if (value) {
      const parseResult = safeParse<PlayerStats>(value, null, logger, 'storage_data');
      if (!parseResult.success || !parseResult.data) {
        logger.error('Failed to parse data');
        return createErrorResponse('INVALID_DATA', 'Failed to parse data');
      }
      playerStats = parseResult.data;
    } else {
      playerStats = {
        user_id: ctx.userId,
        level: 1,
        xp: 0,
        ability_points: 0,
        stats: {
          attack: 10,
          defense: 10,
          dodge: 10,
          crit_rate: 5,
        },
      };
    }
  }

  const oldLevel = playerStats.level;
  playerStats.xp += request.xp_amount;

  const newLevel = calculateLevel(playerStats.xp);
  playerStats.level = newLevel;

  if (newLevel > oldLevel) {
    const levelsGained = newLevel - oldLevel;
    playerStats.ability_points += levelsGained;
    logger.info(
      'User %s leveled up from %d to %d, gained %d ability points',
      ctx.userId,
      oldLevel,
      newLevel,
      levelsGained
    );
  }

  nk.storageWrite([
    {
      collection: 'player_stats',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(playerStats),
    },
  ]);

  invalidatePlayerStatsCache(ctx.userId, logger);

  return JSON.stringify({
    success: true,
    player_stats: playerStats,
    xp_gained: request.xp_amount,
    levels_gained: Math.max(0, newLevel - oldLevel),
  });
}

/**
 * Registers the stat allocation RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcAllocateStats(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/allocate_stats',
    'allocate_stats',
    rpcAllocateStats
  );
}

/**
 * Handles stat allocation requests for ability points.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing stat_name and points
 * @returns JSON string with success status and updated player stats
 *
 * @example
 * // Request payload
 * { "stat_name": "attack", "points": 5 }
 *
 * // Response
 * {
 *   "success": true,
 *   "player_stats": { ... }
 * }
 */
export function rpcAllocateStats(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Allocate stats called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.allocate_stats, payload, 'allocate_stats');
  if (!validation.success) {
    return createValidationErrorResponse('allocate_stats', validation.error);
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

  const parseResult = safeParse<PlayerStats>(
    objects[0].value ?? '{}',
    null,
    logger,
    'player_stats'
  );
  if (!parseResult.success || !parseResult.data) {
    logger.error('Failed to parse player stats for user: %s', ctx.userId);
    return createErrorResponse('INVALID_DATA', 'Failed to parse player stats');
  }
  const playerStats: PlayerStats = parseResult.data;

  if (playerStats.ability_points < request.points) {
    return JSON.stringify({
      error: 'Not enough ability points',
    });
  }

  playerStats.ability_points -= request.points;
  playerStats.stats[request.stat_name as keyof typeof playerStats.stats] += request.points;

  nk.storageWrite([
    {
      collection: 'player_stats',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(playerStats),
    },
  ]);

  invalidatePlayerStatsCache(ctx.userId, logger);

  return JSON.stringify({
    success: true,
    player_stats: playerStats,
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
  logger.info('Get player stats called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_player_stats, payload, 'get_player_stats');
  if (!validation.success) {
    return createValidationErrorResponse('get_player_stats', validation.error);
  }

  const cacheManager = getCacheManager(logger);
  const cachedStats = cacheManager.get<string>('player_stats', ctx.userId);

  if (cachedStats !== undefined) {
    return cachedStats;
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

  const stats = objects[0].value ?? '{}';
  cacheManager.set('player_stats', ctx.userId, stats);

  return stats;
}

/**
 * Calculates player level based on experience points.
 *
 * @param xp - Experience points to calculate level for
 * @returns Calculated player level
 *
 * @example
 * calculateLevel(450); // returns 5
 */
export function calculateLevel(xp: number): number {
  const baseXP = 100;
  const growthFactor = 1.5;
  let level = 1;
  let xpForNextLevel = baseXP;

  while (xp >= xpForNextLevel) {
    xp -= xpForNextLevel;
    level++;
    xpForNextLevel = Math.floor(xpForNextLevel * growthFactor);
  }

  return level;
}
