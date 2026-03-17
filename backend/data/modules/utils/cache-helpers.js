"use strict";
/**
 * Shared cache utilities for consistent cache operations across the codebase.
 * This module extracts common patterns for cache management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_ERROR_MESSAGES = exports.CACHE_KEYS = void 0;
exports.logCacheOperation = logCacheOperation;
exports.isValidCacheKey = isValidCacheKey;
exports.isValidCacheName = isValidCacheName;
exports.sanitizeCacheKeyForLog = sanitizeCacheKeyForLog;
exports.getPlayerCacheKey = getPlayerCacheKey;
exports.getRelatedCacheKeys = getRelatedCacheKeys;
exports.getCacheEntry = getCacheEntry;
exports.setCacheEntry = setCacheEntry;
exports.deleteCacheEntry = deleteCacheEntry;
/**
 * Log cache operation for debugging and metrics
 */
function logCacheOperation(_operation, _cacheName, _key) {
    // This is a shared implementation - actual logging is done by CacheManager
    // which has access to the logger
}
/**
 * Validate cache key format
 */
function isValidCacheKey(key) {
    return typeof key === 'string' && key.length > 0 && key.length <= 256;
}
/**
 * Validate cache name format
 */
function isValidCacheName(name) {
    return typeof name === 'string' && name.length > 0 && name.length <= 64;
}
/**
 * Sanitize cache key for logging (truncate if too long)
 */
function sanitizeCacheKeyForLog(key, maxLength) {
    if (maxLength === void 0) { maxLength = 100; }
    if (key.length <= maxLength) {
        return key;
    }
    return key.substring(0, maxLength) + '...';
}
/**
 * Standard cache key prefixes for different data types
 */
exports.CACHE_KEYS = {
    PLAYER_STATS: 'player_stats',
    LEADERBOARD: 'leaderboard',
    SEASON_INFO: 'season_info',
    STORE_CATALOG: 'store_catalog',
    GEAR_DEFINITIONS: 'gear_definitions',
};
/**
 * Get cache key for player data
 */
function getPlayerCacheKey(userId, type) {
    return "".concat(type, ":").concat(userId);
}
/**
 * Invalidate all cache entries for a user (multi-cache)
 * This is a helper function to invalidate related caches when user data changes
 */
function getRelatedCacheKeys(userId) {
    return [
        getPlayerCacheKey(userId, exports.CACHE_KEYS.PLAYER_STATS),
        getPlayerCacheKey(userId, exports.CACHE_KEYS.LEADERBOARD),
    ];
}
/**
 * Standard cache not found error message
 */
exports.CACHE_ERROR_MESSAGES = {
    NOT_FOUND: 'Cache not found',
};
/**
 * Get a cache entry with consistent error handling and metrics logging.
 * This helper reduces duplication in cache get operations.
 *
 * @param cache - The cache Map
 * @param metrics - The metrics tracker
 * @param logger - Optional logger (can be null, undefined, or a logger)
 * @param cacheName - Name of the cache for logging
 * @param key - Cache key
 * @returns The cached value or undefined
 */
function getCacheEntry(cache, metrics, logger, cacheName, key) {
    if (!cache || !metrics) {
        if (logger) {
            logger.error(exports.CACHE_ERROR_MESSAGES.NOT_FOUND, {
                cacheName: cacheName,
                operation: 'cache_not_found',
            });
        }
        return undefined;
    }
    var value = cache.get(key);
    if (value !== undefined) {
        metrics.hits++;
        logCacheOperation('hit', cacheName, key);
    }
    else {
        metrics.misses++;
        logCacheOperation('miss', cacheName, key);
    }
    return value;
}
/**
 * Set a cache entry with consistent error handling.
 * This helper reduces duplication in cache set operations.
 *
 * @param cache - The cache Map
 * @param logger - Optional logger (can be null, undefined, or a logger)
 * @param cacheName - Name of the cache for logging
 * @param key - Cache key
 * @param value - Value to cache
 */
function setCacheEntry(cache, logger, cacheName, key, value) {
    if (!cache) {
        if (logger) {
            logger.error(exports.CACHE_ERROR_MESSAGES.NOT_FOUND, {
                cacheName: cacheName,
                operation: 'cache_not_found',
            });
        }
        return;
    }
    cache.set(key, value);
    logCacheOperation('set', cacheName, key);
}
/**
 * Delete a cache entry with consistent error handling.
 * This helper reduces duplication in cache delete operations.
 *
 * @param cache - The cache Map
 * @param logger - Optional logger (can be null, undefined, or a logger)
 * @param cacheName - Name of the cache for logging
 * @param key - Cache key to delete
 */
function deleteCacheEntry(cache, logger, cacheName, key) {
    if (!cache) {
        if (logger) {
            logger.error(exports.CACHE_ERROR_MESSAGES.NOT_FOUND, {
                cacheName: cacheName,
                operation: 'cache_not_found',
            });
        }
        return;
    }
    cache.delete(key);
    logCacheOperation('delete', cacheName, key);
}
