"use strict";
/**
 * Shared utilities for player data storage operations.
 * This module extracts common patterns for reading player data from storage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAYER_DATA_READ_ERROR_RESPONSE = exports.PLAYER_DATA_NOT_FOUND_RESPONSE = void 0;
exports.createPlayerDataNotFoundResponse = createPlayerDataNotFoundResponse;
exports.createPlayerDataReadErrorResponse = createPlayerDataReadErrorResponse;
exports.readPlayerData = readPlayerData;
exports.readPlayerStorage = readPlayerStorage;
exports.readPlayerDataWithCache = readPlayerDataWithCache;
exports.parsePlayerStatsValue = parsePlayerStatsValue;
exports.getPlayerStatsWithCache = getPlayerStatsWithCache;
/**
 * Standard error response for player data not found
 */
exports.PLAYER_DATA_NOT_FOUND_RESPONSE = {
    error: 'Player data not found',
};
/**
 * Standard error response for unexpected failures when reading player data
 * (e.g. parse/runtime errors). This is distinct from "not found".
 */
exports.PLAYER_DATA_READ_ERROR_RESPONSE = {
    error: 'Failed to read player data',
};
/**
 * Creates a "not found" JSON response for player data.
 * This ensures consistent error responses across the codebase.
 *
 * @param customMessage - Optional custom error message
 * @returns JSON string with error response
 */
function createPlayerDataNotFoundResponse(customMessage) {
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
function createPlayerDataReadErrorResponse(customMessage) {
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
function readPlayerData(nk, ctx, collection, key, parseFn) {
    try {
        var objects = nk.storageRead([
            {
                collection: collection,
                key: key,
                userId: ctx.userId,
            },
        ]);
        if (objects.length === 0) {
            return { found: false };
        }
        var parsed = parseFn(objects[0].value);
        if (parsed === null) {
            return { found: false, error: 'Invalid data format' };
        }
        return { found: true, data: parsed };
    }
    catch (error) {
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
function readPlayerStorage(nk, userId, collection) {
    return nk.storageRead([
        {
            collection: collection,
            key: userId,
            userId: userId,
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
function readPlayerDataWithCache(nk, logger, ctx, collection, cacheManager, cacheName, parseFn, _ttlSeconds) {
    if (_ttlSeconds === void 0) { _ttlSeconds = 60; }
    var cacheKey = ctx.userId;
    // Try cache first
    if (cacheManager) {
        var cached = cacheManager.get(cacheName, cacheKey);
        if (cached !== undefined) {
            try {
                var parsed = parseFn(JSON.parse(cached));
                if (parsed !== null) {
                    return { found: true, data: parsed };
                }
            }
            catch (_a) {
                // Cache entry is invalid, continue to storage read
            }
        }
    }
    // Read from storage
    var storageResult = readPlayerData(nk, ctx, collection, cacheKey, parseFn);
    // Log error if storage read failed (distinct from "not found")
    if (storageResult.error) {
        logger.error('Failed to read player data from storage', {
            collection: collection,
            key: cacheKey,
            error: storageResult.error,
        });
    }
    // Cache the result if found
    if (storageResult.found && storageResult.data && cacheManager) {
        cacheManager.set(cacheName, cacheKey, JSON.stringify(storageResult.data));
    }
    return storageResult;
}
// --- Shared Player Stats Helpers ---
/**
 * Parse player stats from storage value
 */
function parsePlayerStatsValue(value) {
    if (!value) {
        return null;
    }
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch (_a) {
            return null;
        }
    }
    if (typeof value === 'object') {
        return value;
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
function getPlayerStatsWithCache(nk, logger, ctx, cacheManager) {
    var result = readPlayerDataWithCache(nk, logger, ctx, 'player_stats', cacheManager, 'player_stats', parsePlayerStatsValue);
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
