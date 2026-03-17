"use strict";
/**
 * Shared storage utilities for consistent storage operations across the codebase.
 * This module extracts common patterns for Nakama storage operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORAGE_COLLECTIONS = void 0;
exports.readPlayerStats = readPlayerStats;
exports.writePlayerStats = writePlayerStats;
exports.storageObjectExists = storageObjectExists;
exports.getStorageValue = getStorageValue;
exports.parseStorageValueJson = parseStorageValueJson;
exports.createStorageWrite = createStorageWrite;
exports.batchStorageRead = batchStorageRead;
exports.batchStorageWrite = batchStorageWrite;
/**
 * Standard storage collection names
 */
exports.STORAGE_COLLECTIONS = {
    PLAYER_STATS: 'player_stats',
    PLAYER_INVENTORY: 'player_inventory',
    PLAYER_PROGRESSION: 'player_progression',
    SEASON_DATA: 'season_data',
    MATCH_DATA: 'match_data',
};
/**
 * Read player stats from storage with error handling
 */
function readPlayerStats(nk, userId) {
    return nk.storageRead([
        {
            collection: exports.STORAGE_COLLECTIONS.PLAYER_STATS,
            key: userId,
            userId: userId,
        },
    ]);
}
/**
 * Write player stats to storage with error handling
 */
function writePlayerStats(nk, userId, stats) {
    nk.storageWrite([
        {
            collection: exports.STORAGE_COLLECTIONS.PLAYER_STATS,
            key: userId,
            userId: userId,
            value: JSON.stringify(stats),
        },
    ]);
}
/**
 * Check if storage object exists
 */
function storageObjectExists(objects) {
    return objects !== undefined && objects !== null && objects.length > 0;
}
/**
 * Extract value from storage object with safety check
 */
function getStorageValue(objects) {
    if (!storageObjectExists(objects)) {
        return null;
    }
    var obj = objects[0];
    if (!obj || !obj.value) {
        return null;
    }
    return obj.value;
}
/**
 * Parse storage value JSON with fallback
 */
function parseStorageValueJson(value, fallback, logger, context) {
    if (!value) {
        return { success: true, data: fallback };
    }
    try {
        var parsed = JSON.parse(value);
        return { success: true, data: parsed };
    }
    catch (error) {
        if (logger && context) {
            logger.error("Failed to parse storage value for ".concat(context, ": ").concat(error));
        }
        return { success: false, data: null };
    }
}
/**
 * Create storage write object
 */
function createStorageWrite(collection, key, userId, value) {
    return {
        collection: collection,
        key: key,
        userId: userId,
        value: typeof value === 'string' ? value : JSON.stringify(value),
    };
}
/**
 * Batch storage read
 */
function batchStorageRead(nk, reads) {
    if (reads.length === 0) {
        return [];
    }
    return nk.storageRead(reads.map(function (r) { return ({
        collection: r.collection,
        key: r.key,
        userId: r.userId,
    }); }));
}
/**
 * Batch storage write
 */
function batchStorageWrite(nk, writes) {
    if (writes.length === 0) {
        return;
    }
    nk.storageWrite(writes.map(function (w) { return ({
        collection: w.collection,
        key: w.key,
        userId: w.userId,
        value: typeof w.value === 'string' ? w.value : JSON.stringify(w.value),
    }); }));
}
