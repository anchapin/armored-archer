/**
 * Shared utilities for player data storage operations.
 * This module extracts common patterns for reading player data from storage.
 */
import { Runtime } from '../types/nakama';
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
export declare const PLAYER_DATA_NOT_FOUND_RESPONSE: {
    error: string;
};
/**
 * Standard error response for unexpected failures when reading player data
 * (e.g. parse/runtime errors). This is distinct from "not found".
 */
export declare const PLAYER_DATA_READ_ERROR_RESPONSE: {
    error: string;
};
/**
 * Creates a "not found" JSON response for player data.
 * This ensures consistent error responses across the codebase.
 *
 * @param customMessage - Optional custom error message
 * @returns JSON string with error response
 */
export declare function createPlayerDataNotFoundResponse(customMessage?: string): string;
/**
 * Creates an error response for failures when reading player data.
 * This ensures consistent error responses across the codebase.
 *
 * @param customMessage - Optional custom error message
 * @returns JSON string with error response
 */
export declare function createPlayerDataReadErrorResponse(customMessage?: string): string;
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
export declare function readPlayerData<T>(nk: Runtime.Nakama, ctx: Runtime.Context, collection: string, key: string, parseFn: (value: unknown) => T | null): StorageReadResult<T>;
/**
 * Read player data from storage synchronously (for use in RPC handlers).
 * This is a simplified version that returns the raw value.
 *
 * @param nk - Nakama server interface
 * @param userId - User ID for the storage key
 * @param collection - Storage collection name
 * @returns The storage objects array (empty if not found)
 */
export declare function readPlayerStorage(nk: Runtime.Nakama, userId: string, collection: string): {
    value: unknown;
}[];
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
export declare function readPlayerDataWithCache<T>(nk: Runtime.Nakama, logger: Runtime.Logger, ctx: Runtime.Context, collection: string, cacheManager: {
    get: <T>(name: string, key: string) => T | undefined;
    set: (name: string, key: string, value: string) => void;
} | null | undefined, cacheName: string, parseFn: (value: unknown) => T | null, _ttlSeconds?: number): StorageReadResult<T>;
/**
 * Parse player stats from storage value
 */
export declare function parsePlayerStatsValue(value: unknown): {
    level: number;
    xp: number;
    stats: unknown;
} | null;
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
export declare function getPlayerStatsWithCache(nk: Runtime.Nakama, logger: Runtime.Logger, ctx: Runtime.Context, cacheManager: {
    get: <T>(name: string, key: string) => T | undefined;
    set: (name: string, key: string, value: string) => void;
}): string;
