/**
 * Shared storage utilities for consistent storage operations across the codebase.
 * This module extracts common patterns for Nakama storage operations.
 */
import { Runtime } from '../types/nakama';
/**
 * Standard storage collection names
 */
export declare const STORAGE_COLLECTIONS: {
    readonly PLAYER_STATS: "player_stats";
    readonly PLAYER_INVENTORY: "player_inventory";
    readonly PLAYER_PROGRESSION: "player_progression";
    readonly SEASON_DATA: "season_data";
    readonly MATCH_DATA: "match_data";
};
/**
 * Standard storage read options
 */
export interface StorageReadOptions {
    collection: string;
    key: string;
    userId: string;
}
/**
 * Standard storage write options
 */
export interface StorageWriteOptions {
    collection: string;
    key: string;
    userId: string;
    value: Record<string, unknown> | string;
}
/**
 * Read player stats from storage with error handling
 */
export declare function readPlayerStats(nk: Runtime.Nakama, userId: string): Runtime.StorageObject[];
/**
 * Write player stats to storage with error handling
 */
export declare function writePlayerStats(nk: Runtime.Nakama, userId: string, stats: Record<string, unknown>): void;
/**
 * Check if storage object exists
 */
export declare function storageObjectExists(objects: Runtime.StorageObject[]): boolean;
/**
 * Extract value from storage object with safety check
 */
export declare function getStorageValue(objects: Runtime.StorageObject[]): string | null;
/**
 * Parse storage value JSON with fallback
 */
export declare function parseStorageValueJson<T>(value: string | null, fallback: T, logger?: Runtime.Logger, context?: string): {
    success: boolean;
    data: T | null;
};
/**
 * Create storage write object
 */
export declare function createStorageWrite(collection: string, key: string, userId: string, value: Record<string, unknown> | string): {
    collection: string;
    key: string;
    userId: string;
    value: string;
};
/**
 * Batch storage read
 */
export declare function batchStorageRead(nk: Runtime.Nakama, reads: StorageReadOptions[]): Runtime.StorageObject[];
/**
 * Batch storage write
 */
export declare function batchStorageWrite(nk: Runtime.Nakama, writes: StorageWriteOptions[]): void;
