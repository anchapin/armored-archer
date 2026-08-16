/**
 * RPG System module.
 * @fileoverview Handles XP gains and stat allocation.
 */

import { Runtime } from '../types/nakama';

import { getCacheManager } from '../utils/cache';
import { invalidatePlayerStatsCache } from '../utils/db_optimizer';
import { getPlayerStatsWithCache } from '../utils/player-data-helpers';
import { safeParse, createErrorResponse } from '../utils/safeParse';
import { logAudit } from './audit';
import { applyCurrencyDelta, getCurrency } from './currency';
import { registerRpcWithMetrics } from './metrics';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import { getLevelForXp } from './xp_manager';

/**
 * Helper function to save player stats to storage and invalidate cache.
 */
function savePlayerStats(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  playerStats: PlayerStats,
  action: string
): void {
  nk.storageWrite([
    {
      collection: 'player_stats',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(playerStats),
    },
  ]);

  invalidatePlayerStatsCache(ctx.userId, logger);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    action,
    'player_stats',
    playerStats as unknown as Record<string, unknown>,
    'success'
  );
}

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
 * Request payload for stat respec.
 *
 * @property new_allocation - New stat allocation
 * @property use_free_respec - Whether to use free respec
 */
export interface RespecRequest {
  new_allocation: {
    attack: number;
    defense: number;
    dodge: number;
    crit_rate: number;
  };
  use_free_respec: boolean;
}

/**
 * Request payload for build save.
 *
 * @property build_slot - Build slot number (1-3)
 * @property build_name - Display name for the build
 * @property stats - Stat allocation for the build
 * @property level - Player level when build was saved
 */
export interface BuildSaveRequest {
  build_slot: number;
  build_name: string;
  stats: {
    attack: number;
    defense: number;
    dodge: number;
    crit_rate: number;
  };
  level: number;
}

/**
 * Request payload for build load.
 *
 * @property build_slot - Build slot number (1-3)
 */
export interface BuildLoadRequest {
  build_slot: number;
}

/**
 * Build data structure.
 *
 * @property name - Display name
 * @property stats - Stat allocation
 * @property level - Level when saved
 * @property timestamp - Unix timestamp
 */
export interface BuildData {
  name: string;
  stats: {
    attack: number;
    defense: number;
    dodge: number;
    crit_rate: number;
  };
  level: number;
  timestamp: number;
}

/**
 * Respec data structure.
 *
 * @property last_respec_time - Unix timestamp of last respec
 * @property free_respecs_used - Number used this season
 * @property current_season_id - Current season identifier
 */
export interface RespecData {
  last_respec_time: number;
  free_respecs_used: number;
  current_season_id: string;
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
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'gain_xp',
      'player_stats',
      { xp_amount: 'unknown' },
      'failure',
      validation.error
    );
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
        logAudit(
          nk,
          ctx.userId,
          ctx.ipAddress ?? null,
          'gain_xp',
          'player_stats',
          { xp_amount: request.xp_amount },
          'failure',
          'Failed to parse player stats'
        );
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

  savePlayerStats(nk, ctx, logger, playerStats, 'gain_xp');

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
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'allocate_stats',
      'player_stats',
      { stat_name: 'unknown', points: 0 },
      'failure',
      validation.error
    );
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
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'allocate_stats',
      'player_stats',
      { stat_name: request.stat_name, points: request.points },
      'failure',
      'Player stats not found'
    );
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
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'allocate_stats',
      'player_stats',
      { stat_name: request.stat_name, points: request.points },
      'failure',
      'Failed to parse player stats'
    );
    return createErrorResponse('INVALID_DATA', 'Failed to parse player stats');
  }
  const playerStats: PlayerStats = parseResult.data;

  if (playerStats.ability_points < request.points) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'allocate_stats',
      'player_stats',
      {
        stat_name: request.stat_name,
        points: request.points,
        available_points: playerStats.ability_points,
      },
      'failure',
      'Not enough ability points'
    );
    return JSON.stringify({
      error: 'Not enough ability points',
    });
  }

  playerStats.ability_points -= request.points;
  playerStats.stats[request.stat_name as keyof typeof playerStats.stats] += request.points;

  savePlayerStats(nk, ctx, logger, playerStats, 'allocate_stats');

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

  const cache = getCacheManager(logger);
  return getPlayerStatsWithCache(nk, logger, ctx, cache);
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
  return getLevelForXp(xp);
}

// --- Respec System ---

const RESPEC_COST_PERCENT = 0.05; // 5% of current gems
const RESPEC_MIN_COST = 100; // Minimum gem cost
const RESPEC_MAX_COST = 1000; // Maximum gem cost
const RESPEC_COOLDOWN_SECONDS = 86400; // 24 hours
const FREE_RESPEC_PER_SEASON = 1;

/**
 * Registers the respec stats RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcRespecStats(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/respec_stats',
    'respec_stats',
    rpcRespecStats
  );
}

/**
 * Validates respec request data and loads required data.
 */
function validateRespecRequest(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  payload: string
): {
  error?: { message: string; auditDetails: Record<string, unknown> };
  data?: { playerStats: PlayerStats; respecData: RespecData; request: RespecRequest };
} {
  // Validate payload
  const validation = validatePayload(ZodSchemas.respec_stats, payload, 'respec_stats');
  if (!validation.success) {
    return {
      error: {
        message: validation.error,
        auditDetails: {},
      },
    };
  }
  const request = validation.data;

  // Load player stats
  const playerStatsResult = loadPlayerStats(nk, ctx.userId);
  if (!playerStatsResult.success || !playerStatsResult.data) {
    return {
      error: {
        message: playerStatsResult.error || 'Failed to load player stats',
        auditDetails: {},
      },
    };
  }
  const playerStats = playerStatsResult.data;

  // Validate allocation matches available points
  const allocationValidation = validateStatAllocation(playerStats, request.new_allocation);
  if (!allocationValidation.valid) {
    return {
      error: {
        message: allocationValidation.error || 'Invalid allocation',
        auditDetails: {},
      },
    };
  }

  // Load and validate respec data
  const respecDataResult = loadRespecData(nk, ctx.userId);
  const defaultRespecData: RespecData = {
    last_respec_time: 0,
    free_respecs_used: 0,
    current_season_id: '',
  };
  const respecData = respecDataResult.success
    ? (respecDataResult.data as RespecData)
    : defaultRespecData;

  const cooldownCheck = checkRespecCooldown(respecData, request.use_free_respec || false);
  if (cooldownCheck.onCooldown) {
    return {
      error: {
        message: `Respec is on cooldown (${cooldownCheck.cooldownRemaining}s remaining)`,
        auditDetails: { cooldown_remaining: cooldownCheck.cooldownRemaining },
      },
    };
  }

  return {
    data: {
      playerStats,
      respecData,
      request,
    },
  };
}

/**
 * Handles stat respec requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing new_allocation and use_free_respec
 * @returns JSON string with success status and updated player stats
 *
 * @example
 * // Request payload
 * { "new_allocation": {"attack": 15, "defense": 12, "dodge": 10, "crit_rate": 8}, "use_free_respec": false }
 *
 * // Response
 * {
 *   "success": true,
 *   "player_stats": { ... },
 *   "cost_paid": 150
 * }
 */
export function rpcRespecStats(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Respec stats called for user: %s', ctx.userId);

  const validation = validateRespecRequest(nk, ctx, payload);
  if (validation.error) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'respec_stats',
      'player_stats',
      validation.error.auditDetails,
      'failure',
      validation.error.message
    );
    return JSON.stringify({
      error: validation.error.message,
    });
  }

  const { playerStats, respecData, request } = validation.data!;

  // Determine if free respec can be used
  const useFreeRespec = canUseFreeRespec(respecData, request.use_free_respec || false);

  // Respec costs are validated against and paid from the unified currency
  // ledger (issue #860). The old path debited a dead wallet key (`gem`)
  // that no reader ever saw, making paid respecs effectively free.
  const playerCurrency = getCurrency(nk, ctx.userId, logger);

  // Calculate and validate cost
  const costResult = calculateAndValidateCost(playerCurrency.gems, useFreeRespec);
  if (costResult.error) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'respec_stats',
      'player_stats',
      { cost: costResult.costPaid },
      'failure',
      costResult.error
    );
    return JSON.stringify({
      error: costResult.error,
      cost: costResult.costPaid,
    });
  }

  // Deduct gems from the unified currency ledger if not using free respec
  if (!useFreeRespec) {
    applyCurrencyDelta(nk, ctx.userId, { gems: -costResult.costPaid }, 'respec_stats', logger);
  }

  // Apply new allocation
  playerStats.stats = {
    attack: request.new_allocation.attack,
    defense: request.new_allocation.defense,
    dodge: request.new_allocation.dodge,
    crit_rate: request.new_allocation.crit_rate,
  };

  // Update respec data
  const currentTime = Math.floor(Date.now() / 1000);
  (respecData as RespecData).last_respec_time = currentTime;
  if (useFreeRespec) {
    (respecData as RespecData).free_respecs_used++;
  }
  saveRespecData(nk, ctx.userId, respecData as RespecData);
  // Save player stats
  savePlayerStats(nk, ctx, logger, playerStats, 'respec_stats');

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'respec_stats',
    'player_stats',
    { cost_paid: costResult.costPaid, used_free_respec: useFreeRespec },
    'success'
  );

  return JSON.stringify({
    success: true,
    player_stats: playerStats,
    cost_paid: costResult.costPaid,
    used_free_respec: useFreeRespec,
  });
}

// --- Build Save/Load System ---

/**
 * Registers the save build RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcSaveBuild(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(initializer, 'armored_archer/save_build', 'save_build', rpcSaveBuild);
}

/**
 * Registers the load build RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcLoadBuild(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(initializer, 'armored_archer/load_build', 'load_build', rpcLoadBuild);
}

/**
 * Registers the get builds RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetBuilds(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(initializer, 'armored_archer/get_builds', 'get_builds', rpcGetBuilds);
}

/**
 * Handles build save requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing build data
 * @returns JSON string with success status
 */
export function rpcSaveBuild(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Save build called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.save_build, payload, 'save_build');
  if (!validation.success) {
    return createValidationErrorResponse('save_build', validation.error);
  }

  const request = validation.data;

  const buildData: BuildData = {
    name: request.build_name,
    stats: request.stats,
    level: request.level,
    timestamp: Math.floor(Date.now() / 1000),
  };

  nk.storageWrite([
    {
      collection: 'player_builds',
      key: `${ctx.userId}_slot_${request.build_slot}`,
      userId: ctx.userId,
      value: JSON.stringify(buildData),
    },
  ]);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'save_build',
    'player_builds',
    { build_slot: request.build_slot, build_name: request.build_name },
    'success'
  );

  return JSON.stringify({
    success: true,
    build_data: buildData,
  });
}

/**
 * Handles build load requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing build_slot
 * @returns JSON string with build data
 */
export function rpcLoadBuild(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Load build called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.load_build, payload, 'load_build');
  if (!validation.success) {
    return createValidationErrorResponse('load_build', validation.error);
  }

  const request = validation.data;

  const objects = nk.storageRead([
    {
      collection: 'player_builds',
      key: `${ctx.userId}_slot_${request.build_slot}`,
      userId: ctx.userId,
    },
  ]);

  if (objects.length === 0) {
    return JSON.stringify({
      error: 'Build not found',
    });
  }

  const value = objects[0].value;
  if (!value) {
    return JSON.stringify({
      error: 'Build data corrupted',
    });
  }

  const parseResult = safeParse<BuildData>(value, null, logger, 'build_data');
  if (!parseResult.success || !parseResult.data) {
    return JSON.stringify({
      error: 'Failed to parse build data',
    });
  }

  const buildData = parseResult.data;

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'load_build',
    'player_builds',
    { build_slot: request.build_slot, build_name: buildData.name },
    'success'
  );

  return JSON.stringify({
    success: true,
    build_data: buildData,
  });
}

/**
 * Handles get builds requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused)
 * @returns JSON string with all builds
 */
export function rpcGetBuilds(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  _payload: string
): string {
  logger.info('Get builds called for user: %s', ctx.userId);

  const objects = nk.storageRead([
    {
      collection: 'player_builds',
      key: `${ctx.userId}_slot_1`,
      userId: ctx.userId,
    },
    {
      collection: 'player_builds',
      key: `${ctx.userId}_slot_2`,
      userId: ctx.userId,
    },
    {
      collection: 'player_builds',
      key: `${ctx.userId}_slot_3`,
      userId: ctx.userId,
    },
  ]);

  const builds: Record<number, BuildData> = {};
  objects.forEach((obj) => {
    const key = obj.key;
    const match = key.match(/slot_(\d+)$/);
    if (match) {
      const slot = parseInt(match[1], 10);
      const parseResult = safeParse<BuildData>(obj.value || '{}', null, logger, 'build_data');
      if (parseResult.success && parseResult.data) {
        builds[slot] = parseResult.data;
      }
    }
  });

  return JSON.stringify({
    success: true,
    builds: builds,
  });
}

// --- Helper Functions ---

/**
 * Validates that the new stat allocation total matches the current total.
 */
function validateStatAllocation(
  currentStats: PlayerStats,
  newAllocation: Record<string, number>
): { valid: boolean; error?: string } {
  const currentTotalSpent = Object.values(currentStats.stats).reduce((a, b) => a + b, 0);
  const newTotalSpent = Object.values(newAllocation).reduce((a, b) => a + b, 0);

  if (newTotalSpent !== currentTotalSpent) {
    return {
      valid: false,
      error: `Total stat points must match (current: ${currentTotalSpent}, new: ${newTotalSpent})`,
    };
  }

  return { valid: true };
}

/**
 * Checks if respec is on cooldown.
 */
function checkRespecCooldown(
  respecData: RespecData,
  useFreeRespec: boolean
): {
  onCooldown: boolean;
  cooldownRemaining?: number;
} {
  const currentTime = Math.floor(Date.now() / 1000);
  const cooldownRemaining =
    RESPEC_COOLDOWN_SECONDS - (currentTime - (respecData?.last_respec_time || 0));

  if (cooldownRemaining > 0 && !useFreeRespec && respecData) {
    return { onCooldown: true, cooldownRemaining };
  }

  return { onCooldown: false };
}

/**
 * Determines if free respec can be used.
 */
function canUseFreeRespec(respecData: RespecData, useFreeRespec: boolean): boolean {
  if (!useFreeRespec) {
    return false;
  }

  const freeRespecsUsed = respecData?.free_respecs_used || 0;
  return freeRespecsUsed < FREE_RESPEC_PER_SEASON;
}

/**
 * Calculates the respec cost and validates the player has enough gems in
 * the unified currency ledger (issue #860).
 */
function calculateAndValidateCost(
  gemBalance: number,
  useFreeRespec: boolean
): { costPaid: number; error?: string } {
  if (useFreeRespec) {
    return { costPaid: 0 };
  }

  let costPaid = Math.floor(gemBalance * RESPEC_COST_PERCENT);
  costPaid = Math.max(RESPEC_MIN_COST, Math.min(RESPEC_MAX_COST, costPaid));

  if (gemBalance < costPaid) {
    return {
      costPaid,
      error: `Not enough gems for respec (cost: ${costPaid}, balance: ${gemBalance})`,
    };
  }

  return { costPaid };
}

/**
 * Loads player stats from storage.
 */
function loadPlayerStats(
  nk: Runtime.Nakama,
  userId: string
): { success: boolean; data?: PlayerStats; error?: string } {
  const objects = nk.storageRead([
    {
      collection: 'player_stats',
      key: userId,
      userId: userId,
    },
  ]);

  if (objects.length === 0) {
    return { success: false, error: 'Player stats not found' };
  }

  const value = objects[0].value;
  if (!value) {
    return { success: false, error: 'Player stats data is empty' };
  }

  const parseResult = safeParse<PlayerStats>(value, null, undefined as any, 'player_stats');
  if (!parseResult.success || !parseResult.data) {
    return { success: false, error: 'Failed to parse player stats' };
  }

  return { success: true, data: parseResult.data };
}

/**
 *
 */
function loadRespecData(
  nk: Runtime.Nakama,
  userId: string
): { success: boolean; data?: RespecData } {
  const objects = nk.storageRead([
    {
      collection: 'respec_data',
      key: userId,
      userId: userId,
    },
  ]);

  if (objects.length === 0) {
    return {
      success: true,
      data: {
        last_respec_time: 0,
        free_respecs_used: 0,
        current_season_id: '',
      },
    };
  }

  const value = objects[0].value;
  if (!value) {
    return {
      success: true,
      data: {
        last_respec_time: 0,
        free_respecs_used: 0,
        current_season_id: '',
      },
    };
  }

  const parseResult = safeParse<RespecData>(value, null, undefined as any, 'respec_data');
  if (!parseResult.success || !parseResult.data) {
    return {
      success: true,
      data: {
        last_respec_time: 0,
        free_respecs_used: 0,
        current_season_id: '',
      },
    };
  }

  return { success: true, data: parseResult.data };
}

/**
 *
 */
function saveRespecData(nk: Runtime.Nakama, userId: string, respecData: RespecData): void {
  nk.storageWrite([
    {
      collection: 'respec_data',
      key: userId,
      userId: userId,
      value: JSON.stringify(respecData),
    },
  ]);
}
