/**
 * Shared storage utilities for consistent storage operations across the codebase.
 * This module extracts common patterns for Nakama storage operations.
 */

import { Runtime } from '../types/nakama';
import { safeParse } from './safeParse';

/**
 * Standard storage collection names
 */
export const STORAGE_COLLECTIONS = {
  PLAYER_STATS: 'player_stats',
  PLAYER_INVENTORY: 'player_inventory',
  PLAYER_PROGRESSION: 'player_progression',
  SEASON_DATA: 'season_data',
  MATCH_DATA: 'match_data',
} as const;

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
export function readPlayerStats(nk: Runtime.Nakama, userId: string): Runtime.StorageObject[] {
  return nk.storageRead([
    {
      collection: STORAGE_COLLECTIONS.PLAYER_STATS,
      key: userId,
      userId: userId,
    },
  ]);
}

/**
 * Write player stats to storage with error handling
 */
export function writePlayerStats(
  nk: Runtime.Nakama,
  userId: string,
  stats: Record<string, unknown>
): void {
  nk.storageWrite([
    {
      collection: STORAGE_COLLECTIONS.PLAYER_STATS,
      key: userId,
      userId: userId,
      value: stats,
    },
  ]);
}

/**
 * Check if storage object exists
 */
export function storageObjectExists(objects: Runtime.StorageObject[]): boolean {
  return objects !== undefined && objects !== null && objects.length > 0;
}

/**
 * Extract value from storage object with safety check
 */
export function getStorageValue(objects: Runtime.StorageObject[]): string | null {
  if (!storageObjectExists(objects)) {
    return null;
  }
  const obj = objects[0];
  if (!obj || !obj.value) {
    return null;
  }
  return typeof obj.value === 'string' ? obj.value : JSON.stringify(obj.value);
}

/**
 * Parse storage value JSON with fallback
 */
export function parseStorageValueJson<T>(
  value: string | null,
  fallback: T,
  logger?: Runtime.Logger,
  context?: string
): { success: boolean; data: T | null } {
  if (!value) {
    return { success: true, data: fallback };
  }

  try {
    const parsed = JSON.parse(value);
    return { success: true, data: parsed as T };
  } catch (error) {
    if (logger && context) {
      logger.error(`Failed to parse storage value for ${context}: ${error}`);
    }
    return { success: false, data: null };
  }
}

/**
 * Create storage write object
 */
export function createStorageWrite(
  collection: string,
  key: string,
  userId: string,
  value: Record<string, unknown> | string
): { collection: string; key: string; userId: string; value: string } {
  return {
    collection,
    key,
    userId,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  };
}

/**
 * Batch storage read
 */
export function batchStorageRead(
  nk: Runtime.Nakama,
  reads: StorageReadOptions[]
): Runtime.StorageObject[] {
  if (reads.length === 0) {
    return [];
  }

  return nk.storageRead(
    reads.map((r) => ({
      collection: r.collection,
      key: r.key,
      userId: r.userId,
    }))
  );
}

/**
 * Batch storage write
 */
export function batchStorageWrite(nk: Runtime.Nakama, writes: StorageWriteOptions[]): void {
  if (writes.length === 0) {
    return;
  }

  // Post-#1135: goja storageWrite accepts plain objects/strings and
  // JSON-marshals internally. Pass values through unchanged.
  nk.storageWrite(
    writes.map((w) => ({
      collection: w.collection,
      key: w.key,
      userId: w.userId,
      value: w.value,
    }))
  );
}

/**
 * Read and parse a storage object with consistent error handling.
 * Returns { data, error } — one will always be null.
 *
 * This is the primary helper for the common "storageRead → length check → JSON.parse" pattern
 * that appears 25+ times across the codebase.
 */
export function readAndParseStorage<T>(
  nk: Runtime.Nakama,
  collection: string,
  key: string,
  userId: string,
  logger: Runtime.Logger,
  context: string,
  defaultValue?: T
): { data: T; error: null } | { data: null; error: string } {
  const objects = nk.storageRead([{ collection, key, userId }]);

  if (objects.length === 0 || !objects[0].value) {
    if (defaultValue !== undefined) {
      return { data: defaultValue, error: null };
    }
    return { data: null, error: `${collection} not found` };
  }

  const raw =
    typeof objects[0].value === 'string' ? objects[0].value : JSON.stringify(objects[0].value);
  const result = safeParse<T>(raw, null, logger, context);
  if (!result.success || !result.data) {
    return { data: null, error: `Failed to parse ${collection}` };
  }

  return { data: result.data, error: null };
}

/**
 * Write a typed object to Nakama storage.
 * Replaces the common pattern of nk.storageWrite([{ collection, key, userId, value: toStorageValue(data) }]).
 */
export function writeStorageObject<T extends Record<string, unknown>>(
  nk: Runtime.Nakama,
  collection: string,
  key: string,
  userId: string,
  data: T
): void {
  nk.storageWrite([
    {
      collection,
      key,
      userId,
      value: toStorageValue(data),
    },
  ]);
}

/**
 * Normalize a storage-write `value` to the plain object Nakama's JS
 * storageWrite requires (it JSON-marshals internally; a raw string panics
 * with "expects 'value' value to be an object" — issue #1135).
 * Call sites that already hold a pre-stringified payload pass the JSON
 * string here; it is parsed back to the original object.
 */
export function toStorageValue(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      // Stringified array/number/bool — wrap in an envelope so goja's
      // String/Array marshal path produces a non-undefined top-level value.
      return { value: parsed };
    } catch {
      // fall through
    }
    return { value };
  }
  if (value && typeof value === 'object') {
    // Objects AND arrays are valid JSON values (goja's storageWrite accepts
    // both). Pass arrays through unwrapped; an unwrapped object passed
    // through becomes the top-level record.
    return value as Record<string, unknown>;
  }
  return { value: value as unknown };
}

/**
 * Extract the raw JSON string from a storage object's `value` (which may be
 * a pre-parsed object depending on the runtime path — issue #1135).
 */
export function getStorageRawValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Alias of getStorageRawValue for inline use at call sites (issue #1135).
 */
export const asStorageJson = getStorageRawValue;
