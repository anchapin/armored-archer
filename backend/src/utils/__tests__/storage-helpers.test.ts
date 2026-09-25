/**
 * Tests for storage-helpers utility
 */

import {
  STORAGE_COLLECTIONS,
  storageObjectExists,
  getStorageValue,
  parseStorageValueJson,
  createStorageWrite,
  readPlayerStats,
  writePlayerStats,
  batchStorageRead,
  batchStorageWrite,
  StorageReadOptions,
  StorageWriteOptions,
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

  describe('readPlayerStats', () => {
    it('should call storageRead with correct parameters', () => {
      const mockNk = { storageRead: jest.fn().mockReturnValue([]) };
      readPlayerStats(mockNk as any, 'user123');
      expect(mockNk.storageRead).toHaveBeenCalledWith([
        {
          collection: 'player_stats',
          key: 'user123',
          userId: 'user123',
        },
      ]);
    });

    it('should return storage objects', () => {
      const mockObjects = [{ value: '{"level":5}' }];
      const mockNk = { storageRead: jest.fn().mockReturnValue(mockObjects) };
      const result = readPlayerStats(mockNk as any, 'user123');
      expect(result).toEqual(mockObjects);
    });
  });

  describe('writePlayerStats', () => {
    it('should call storageWrite with correct parameters', () => {
      const mockNk = { storageWrite: jest.fn() };
      const stats = { level: 5, xp: 1000 };
      writePlayerStats(mockNk as any, 'user123', stats);
      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        {
          collection: 'player_stats',
          key: 'user123',
          userId: 'user123',
          value: stats,
        },
      ]);
    });
  });

  describe('batchStorageRead', () => {
    it('should call storageRead with mapped reads', () => {
      const mockNk = { storageRead: jest.fn().mockReturnValue([]) };
      const reads: StorageReadOptions[] = [
        { collection: 'col1', key: 'key1', userId: 'user1' },
        { collection: 'col2', key: 'key2', userId: 'user1' },
      ];
      batchStorageRead(mockNk as any, reads);
      expect(mockNk.storageRead).toHaveBeenCalledWith([
        { collection: 'col1', key: 'key1', userId: 'user1' },
        { collection: 'col2', key: 'key2', userId: 'user1' },
      ]);
    });

    it('should return empty array for empty reads', () => {
      const mockNk = { storageRead: jest.fn() };
      const result = batchStorageRead(mockNk as any, []);
      expect(result).toEqual([]);
      expect(mockNk.storageRead).not.toHaveBeenCalled();
    });

    it('should return results from storageRead', () => {
      const mockObjects = [{ value: '{"a":1}' }, { value: '{"b":2}' }];
      const mockNk = { storageRead: jest.fn().mockReturnValue(mockObjects) };
      const result = batchStorageRead(mockNk as any, [
        { collection: 'col', key: 'key', userId: 'user' },
      ]);
      expect(result).toEqual(mockObjects);
    });
  });

  describe('batchStorageWrite', () => {
    it('should call storageWrite with mapped writes', () => {
      const mockNk = { storageWrite: jest.fn() };
      const writes: StorageWriteOptions[] = [
        { collection: 'col1', key: 'key1', userId: 'user1', value: 'val1' },
      ];
      batchStorageWrite(mockNk as any, writes);
      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        { collection: 'col1', key: 'key1', userId: 'user1', value: 'val1' },
      ]);
    });

    it('should not call storageWrite for empty writes', () => {
      const mockNk = { storageWrite: jest.fn() };
      batchStorageWrite(mockNk as any, []);
      expect(mockNk.storageWrite).not.toHaveBeenCalled();
    });

    it('should pass object values directly to storageWrite', () => {
      const mockNk = { storageWrite: jest.fn() };
      const writes: StorageWriteOptions[] = [
        { collection: 'col', key: 'key', userId: 'user', value: { foo: 'bar' } },
      ];
      batchStorageWrite(mockNk as any, writes);
      const callArg = mockNk.storageWrite.mock.calls[0][0];
      expect(callArg[0].value).toEqual({ foo: 'bar' });
    });

    it('should keep string values as-is', () => {
      const mockNk = { storageWrite: jest.fn() };
      const writes: StorageWriteOptions[] = [
        { collection: 'col', key: 'key', userId: 'user', value: 'already-string' },
      ];
      batchStorageWrite(mockNk as any, writes);
      const callArg = mockNk.storageWrite.mock.calls[0][0];
      expect(callArg[0].value).toBe('already-string');
    });
  });
});
