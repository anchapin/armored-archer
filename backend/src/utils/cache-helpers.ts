/**
 * Shared cache utilities for consistent cache operations across the codebase.
 * This module extracts common patterns for cache management.
 */

import { CacheValueType } from '../types/shared';

/**
 * Cache operation types for logging
 */
export type CacheOperation = 'hit' | 'miss' | 'set' | 'delete' | 'clear' | 'destroy';

/**
 * Log cache operation for debugging and metrics
 */
export function logCacheOperation(
  operation: CacheOperation,
  cacheName: string,
  key: string
): void {
  // This is a shared implementation - actual logging is done by CacheManager
  // which has access to the logger
}

/**
 * Validate cache key format
 */
export function isValidCacheKey(key: string): boolean {
  return typeof key === 'string' && key.length > 0 && key.length <= 256;
}

/**
 * Validate cache name format
 */
export function isValidCacheName(name: string): boolean {
  return typeof name === 'string' && name.length > 0 && name.length <= 64;
}

/**
 * Sanitize cache key for logging (truncate if too long)
 */
export function sanitizeCacheKeyForLog(key: string, maxLength: number = 100): string {
  if (key.length <= maxLength) {
    return key;
  }
  return key.substring(0, maxLength) + '...';
}

/**
 * Standard cache key prefixes for different data types
 */
export const CACHE_KEYS = {
  PLAYER_STATS: 'player_stats',
  LEADERBOARD: 'leaderboard',
  SEASON_INFO: 'season_info',
  STORE_CATALOG: 'store_catalog',
  GEAR_DEFINITIONS: 'gear_definitions',
} as const;

/**
 * Get cache key for player data
 */
export function getPlayerCacheKey(userId: string, type: string): string {
  return `${type}:${userId}`;
}

/**
 * Invalidate all cache entries for a user (multi-cache)
 * This is a helper function to invalidate related caches when user data changes
 */
export function getRelatedCacheKeys(userId: string): string[] {
  return [
    getPlayerCacheKey(userId, CACHE_KEYS.PLAYER_STATS),
    getPlayerCacheKey(userId, CACHE_KEYS.LEADERBOARD),
  ];
}
