/**
 * Shared utilities for player data storage operations.
 * This module extracts common patterns for reading player data from storage.
 */

import { Runtime } from '../types/nakama';
import { getRedisClient } from './redis';

/**
 * Result of a storage read operation
 */
export interface StorageReadResult<T> {
  /** Whether the data was found */
  found: boolean;
  /** The parsed data if found, undefined otherwise */
  data?: T;
  /** Error message if an error occurred */
  error?: string;
}

/**
 * Standard error response for player data not found
 */
export const PLAYER_DATA_NOT_FOUND_RESPONSE = {
  error: 'Player data not found',
};

/**
 * Standard error response for unexpected failures when reading player data
 * (e.g. parse/runtime errors). This is distinct from "not found".
 */
export const PLAYER_DATA_READ_ERROR_RESPONSE = {
  error: 'Failed to read player data',
};

/**
 * Creates a "not found" JSON response for player data.
 * This ensures consistent error responses across the codebase.
 *
 * @param customMessage - Optional custom error message
 * @returns JSON string with error response
 */
export function createPlayerDataNotFoundResponse(customMessage?: string): string {
  return JSON.stringify({
    error: customMessage || 'Player data not found',
  });
}

/**
 * Creates an error response for failures when reading player data.
 * This ensures consistent error responses across the codebase.
 *
 * @param customMessage - Optional custom error message
 * @returns JSON string with error response
 */
export function createPlayerDataReadErrorResponse(customMessage?: string): string {
  return JSON.stringify({
    error: customMessage || 'Failed to read player data',
  });
}

/**
 * Read player data from storage with consistent error handling.
 * This helper reduces duplication in storage read operations.
 *
 * @param nk - Nakama server interface
 * @param ctx - Nakama runtime context
 * @param collection - Storage collection name
 * @param key - Storage key (usually userId)
 * @param parseFn - Function to parse the stored value
 * @returns StorageReadResult with parsed data or error
 */
export function readPlayerData<T>(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  collection: string,
  key: string,
  parseFn: (value: unknown) => T | null
): StorageReadResult<T> {
  try {
    const objects = nk.storageRead([
      {
        collection,
        key,
        userId: ctx.userId,
      },
    ]);

    if (objects.length === 0) {
      return { found: false };
    }

    const parsed = parseFn(objects[0].value);

    if (parsed === null) {
      return { found: false, error: 'Invalid data format' };
    }

    return { found: true, data: parsed };
  } catch (error) {
    return {
      found: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Read player data from storage synchronously (for use in RPC handlers).
 * This is a simplified version that returns the raw value.
 *
 * @param nk - Nakama server interface
 * @param userId - User ID for the storage key
 * @param collection - Storage collection name
 * @returns The storage objects array (empty if not found)
 */
export function readPlayerStorage(
  nk: Runtime.Nakama,
  userId: string,
  collection: string
): { value: unknown }[] {
  return nk.storageRead([
    {
      collection,
      key: userId,
      userId,
    },
  ]);
}

/**
 * Read player data from storage with caching support.
 * This helper combines storage read with caching for improved performance.
 *
 * @param nk - Nakama server interface
 * @param logger - Nakama logger instance
 * @param ctx - Nakama runtime context
 * @param collection - Storage collection name
 * @param cacheManager - Cache manager instance (optional)
 * @param cacheName - Cache name for storing results
 * @param parseFn - Function to parse the stored value
 * @param ttlSeconds - Cache TTL in seconds (default: 60)
 * @returns StorageReadResult with parsed data or error
 */
const REDIS_PLAYER_STATS_KEY_PREFIX = 'psc';

function getRedisPlayerStatsKey(userId: string): string {
  return `${REDIS_PLAYER_STATS_KEY_PREFIX}:${userId}`;
}

async function getPlayerStatsFromRedisCache(userId: string): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    return await redis.get(getRedisPlayerStatsKey(userId));
  } catch {
    return null;
  }
}

async function setPlayerStatsToRedisCache(
  userId: string,
  data: string,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.setex(getRedisPlayerStatsKey(userId), ttlSeconds, data);
  } catch {
    // Redis write failure is non-fatal; in-memory cache remains the primary
  }
}

async function tryRedisPlayerStatsCache<T>(
  cacheKey: string,
  cacheName: string,
  cacheManager:
    | {
        get: <T>(name: string, key: string) => T | undefined;
        set: (name: string, key: string, value: string) => void;
      }
    | null
    | undefined,
  parseFn: (value: unknown) => T | null
): Promise<StorageReadResult<T> | null> {
  const redisCached = await getPlayerStatsFromRedisCache(cacheKey);
  if (redisCached === null) return null;
  try {
    const parsed = parseFn(JSON.parse(redisCached));
    if (parsed !== null) {
      if (cacheManager) {
        cacheManager.set(cacheName, cacheKey, redisCached);
      }
      return { found: true, data: parsed };
    }
  } catch {
    // Redis entry invalid
  }
  return null;
}

export async function readPlayerDataWithCache<T>(
  nk: Runtime.Nakama,
  logger: Runtime.Logger,
  ctx: Runtime.Context,
  collection: string,
  cacheManager:
    | {
        get: <T>(name: string, key: string) => T | undefined;
        set: (name: string, key: string, value: string) => void;
      }
    | null
    | undefined,
  cacheName: string,
  parseFn: (value: unknown) => T | null,
  _ttlSeconds: number = 60
): Promise<StorageReadResult<T>> {
  const cacheKey = ctx.userId;
  const isPlayerStats = cacheName === 'player_stats';

  // Try in-memory cache first
  if (cacheManager) {
    const cached = cacheManager.get<string>(cacheName, cacheKey);
    if (cached !== undefined) {
      try {
        const parsed = parseFn(JSON.parse(cached));
        if (parsed !== null) {
          return { found: true, data: parsed };
        }
      } catch {
        // Cache entry is invalid, continue to storage read
      }
    }
  }

  // Try Redis second-level cache for player stats (distributed across Nakama instances)
  if (isPlayerStats) {
    const redisResult = await tryRedisPlayerStatsCache(cacheKey, cacheName, cacheManager, parseFn);
    if (redisResult !== null) return redisResult;
  }

  // Read from storage
  const storageResult = readPlayerData(nk, ctx, collection, cacheKey, parseFn);

  // Log error if storage read failed (distinct from "not found")
  if (storageResult.error) {
    logger.error('Failed to read player data from storage', {
      collection,
      key: cacheKey,
      error: storageResult.error,
    });
  }

  // Cache the result if found (both in-memory and Redis for player stats)
  if (storageResult.found && storageResult.data) {
    if (cacheManager) {
      cacheManager.set(cacheName, cacheKey, JSON.stringify(storageResult.data));
    }
    if (isPlayerStats) {
      await setPlayerStatsToRedisCache(cacheKey, JSON.stringify(storageResult.data), _ttlSeconds);
    }
  }

  return storageResult;
}

// --- Shared Player Stats Helpers ---

/**
 * Parse player stats from storage value
 */
export function parsePlayerStatsValue(
  value: unknown
): { level: number; xp: number; stats: unknown } | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as { level: number; xp: number; stats: unknown };
  }
  return null;
}

/**
 * Get player stats from storage with caching.
 * This is a shared implementation for both player_rpc and rpg_system.
 *
 * @param nk - Nakama server interface
 * @param logger - Nakama logger instance
 * @param ctx - Nakama runtime context
 * @param cacheManager - Cache manager instance
 * @returns JSON string with player stats or error response
 */
export async function getPlayerStatsWithCache(
  nk: Runtime.Nakama,
  logger: Runtime.Logger,
  ctx: Runtime.Context,
  cacheManager: {
    get: <T>(name: string, key: string) => T | undefined;
    set: (name: string, key: string, value: string) => void;
  }
): Promise<string> {
  const result = await readPlayerDataWithCache(
    nk,
    logger,
    ctx,
    'player_stats',
    cacheManager,
    'player_stats',
    parsePlayerStatsValue
  );

  // Check for errors first (distinct from "not found")
  if (result.error) {
    logger.error('Failed to read player stats', { error: result.error, userId: ctx.userId });
    return createPlayerDataReadErrorResponse('Failed to read player stats');
  }

  if (!result.found) {
    return createPlayerDataNotFoundResponse('Player stats not found');
  }

  return JSON.stringify(result.data);
}
