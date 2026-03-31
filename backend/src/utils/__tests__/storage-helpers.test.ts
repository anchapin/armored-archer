/**
 * Tests for storage-helpers utility
 */

import {
  STORAGE_COLLECTIONS,
  storageObjectExists,
  getStorageValue,
  parseStorageValueJson,
  createStorageWrite,
} from '../storage-helpers';

describe('storage-helpers', () => {
  describe('STORAGE_COLLECTIONS', () => {
    it('should define all expected collections', () => {
      expect(STORAGE_COLLECTIONS.PLAYER_STATS).toBe('player_stats');
      expect(STORAGE_COLLECTIONS.PLAYER_INVENTORY).toBe('player_inventory');
      expect(STORAGE_COLLECTIONS.PLAYER_PROGRESSION).toBe('player_progression');
      expect(STORAGE_COLLECTIONS.SEASON_DATA).toBe('season_data');
      expect(STORAGE_COLLECTIONS.MATCH_DATA).toBe('match_data');
    });
  });

  describe('storageObjectExists', () => {
    it('should return true for non-empty array', () => {
      expect(storageObjectExists([{ value: '{}' } as any])).toBe(true);
    });

    it('should return false for empty array', () => {
      expect(storageObjectExists([])).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(storageObjectExists(undefined as any)).toBe(false);
    });

    it('should return false for null', () => {
      expect(storageObjectExists(null as any)).toBe(false);
    });
  });

  describe('getStorageValue', () => {
    it('should return value from first object', () => {
      const objects = [{ value: '{"key":"value"}' }] as any[];
      expect(getStorageValue(objects)).toBe('{"key":"value"}');
    });

    it('should return null for empty array', () => {
      expect(getStorageValue([])).toBeNull();
    });

    it('should return null for object without value', () => {
      const objects = [{}] as any[];
      expect(getStorageValue(objects)).toBeNull();
    });

    it('should return null for null object in array', () => {
      expect(getStorageValue([null] as any)).toBeNull();
    });
  });

  describe('parseStorageValueJson', () => {
    it('should return fallback for null value', () => {
      const result = parseStorageValueJson(null, { default: true });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ default: true });
    });

    it('should return fallback for empty string', () => {
      const result = parseStorageValueJson('', { default: true });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ default: true });
    });

    it('should parse valid JSON', () => {
      const result = parseStorageValueJson('{"level":5}', null);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ level: 5 });
    });

    it('should return failure for invalid JSON', () => {
      const result = parseStorageValueJson('not json', null);
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
    });

    it('should log error when logger provided', () => {
      const mockLogger = { error: jest.fn() } as any;
      parseStorageValueJson('invalid', null, mockLogger, 'test_context');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('createStorageWrite', () => {
    it('should create write object with string value', () => {
      const result = createStorageWrite('collection', 'key', 'user123', 'string_value');
      expect(result).toEqual({
        collection: 'collection',
        key: 'key',
        userId: 'user123',
        value: 'string_value',
      });
    });

    it('should stringify object value', () => {
      const result = createStorageWrite('collection', 'key', 'user123', { level: 5 });
      expect(result.value).toBe('{"level":5}');
    });
  });
});
