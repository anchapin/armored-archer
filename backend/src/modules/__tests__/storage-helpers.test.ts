import {
  STORAGE_COLLECTIONS,
  storageObjectExists,
  getStorageValue,
  parseStorageValueJson,
  createStorageWrite,
  batchStorageRead,
  batchStorageWrite,
  readPlayerStats,
  writePlayerStats,
} from '../../utils/storage-helpers';

const createMockNk = (overrides = {}) => ({
  storageRead: jest.fn().mockReturnValue([]),
  storageWrite: jest.fn().mockReturnValue([]),
  ...overrides,
});

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('storage-helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('STORAGE_COLLECTIONS', () => {
    it('has expected keys', () => {
      expect(STORAGE_COLLECTIONS.PLAYER_STATS).toBe('player_stats');
      expect(STORAGE_COLLECTIONS.PLAYER_INVENTORY).toBe('player_inventory');
      expect(STORAGE_COLLECTIONS.PLAYER_PROGRESSION).toBe('player_progression');
      expect(STORAGE_COLLECTIONS.SEASON_DATA).toBe('season_data');
      expect(STORAGE_COLLECTIONS.MATCH_DATA).toBe('match_data');
    });
  });

  describe('storageObjectExists', () => {
    it('returns false for null', () => {
      expect(storageObjectExists(null as any)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(storageObjectExists(undefined as any)).toBe(false);
    });

    it('returns false for empty array', () => {
      expect(storageObjectExists([])).toBe(false);
    });

    it('returns true for non-empty array', () => {
      expect(
        storageObjectExists([
          {
            collection: 'test',
            key: 'test',
            userId: 'user1',
            value: '{}',
            version: 'v1',
            permissionRead: 1,
            permissionWrite: 1,
            createTime: 0,
            updateTime: 0,
          },
        ])
      ).toBe(true);
    });
  });

  describe('getStorageValue', () => {
    it('returns null for null objects', () => {
      expect(getStorageValue(null as any)).toBeNull();
    });

    it('returns null for empty array', () => {
      expect(getStorageValue([])).toBeNull();
    });

    it('returns null for object with falsy value', () => {
      expect(
        getStorageValue([
          {
            collection: 'test',
            key: 'test',
            userId: 'user1',
            value: '',
            version: 'v1',
            permissionRead: 1,
            permissionWrite: 1,
            createTime: 0,
            updateTime: 0,
          },
        ])
      ).toBeNull();
    });

    it('returns first value from valid objects', () => {
      expect(
        getStorageValue([
          {
            collection: 'test',
            key: 'test',
            userId: 'user1',
            value: '{"level":5}',
            version: 'v1',
            permissionRead: 1,
            permissionWrite: 1,
            createTime: 0,
            updateTime: 0,
          },
        ])
      ).toBe('{"level":5}');
    });
  });

  describe('parseStorageValueJson', () => {
    it('parses valid JSON successfully', () => {
      const result = parseStorageValueJson('{"level":5,"xp":100}', {});
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ level: 5, xp: 100 });
    });

    it('returns failure for invalid JSON', () => {
      const logger = createMockLogger();
      const result = parseStorageValueJson('{invalid', {}, logger, 'test context');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse storage value for test context')
      );
    });

    it('returns fallback for null value', () => {
      const fallback = { default: true };
      const result = parseStorageValueJson(null, fallback);
      expect(result.success).toBe(true);
      expect(result.data).toBe(fallback);
    });

    it('returns fallback for empty string value', () => {
      const fallback = 'default';
      const result = parseStorageValueJson('', fallback);
      expect(result.success).toBe(true);
      expect(result.data).toBe('default');
    });

    it('logs error with logger and context on parse failure', () => {
      const logger = createMockLogger();
      parseStorageValueJson('bad json', null, logger, 'my_context');
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('my_context')
      );
    });

    it('does not log when no logger or context provided', () => {
      const result = parseStorageValueJson('bad json', null);
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
    });
  });

  describe('createStorageWrite', () => {
    it('preserves string value as-is', () => {
      const result = createStorageWrite('player_stats', 'key1', 'user1', '{"level":1}');
      expect(result).toEqual({
        collection: 'player_stats',
        key: 'key1',
        userId: 'user1',
        value: '{"level":1}',
      });
    });

    it('stringifies object value', () => {
      const result = createStorageWrite('player_stats', 'key1', 'user1', { level: 5, xp: 100 });
      expect(result).toEqual({
        collection: 'player_stats',
        key: 'key1',
        userId: 'user1',
        value: JSON.stringify({ level: 5, xp: 100 }),
      });
    });
  });

  describe('batchStorageRead', () => {
    it('returns empty array for empty reads', () => {
      const nk = createMockNk();
      const result = batchStorageRead(nk as any, []);
      expect(result).toEqual([]);
      expect(nk.storageRead).not.toHaveBeenCalled();
    });

    it('calls nk.storageRead with mapped reads', () => {
      const storageObjects = [
        {
          collection: 'col1',
          key: 'key1',
          userId: 'user1',
          value: '{}',
          version: 'v1',
          permissionRead: 1,
          permissionWrite: 1,
          createTime: 0,
          updateTime: 0,
        },
      ];
      const nk = createMockNk({ storageRead: jest.fn().mockReturnValue(storageObjects) });

      const reads = [
        { collection: 'col1', key: 'key1', userId: 'user1' },
        { collection: 'col2', key: 'key2', userId: 'user1' },
      ];

      const result = batchStorageRead(nk as any, reads);

      expect(nk.storageRead).toHaveBeenCalledTimes(1);
      expect(nk.storageRead).toHaveBeenCalledWith([
        { collection: 'col1', key: 'key1', userId: 'user1' },
        { collection: 'col2', key: 'key2', userId: 'user1' },
      ]);
      expect(result).toBe(storageObjects);
    });
  });

  describe('batchStorageWrite', () => {
    it('does nothing for empty writes', () => {
      const nk = createMockNk();
      batchStorageWrite(nk as any, []);
      expect(nk.storageWrite).not.toHaveBeenCalled();
    });

    it('calls nk.storageWrite with stringified writes', () => {
      const nk = createMockNk();

      batchStorageWrite(nk as any, [
        { collection: 'col1', key: 'key1', userId: 'user1', value: '{"a":1}' },
        { collection: 'col2', key: 'key2', userId: 'user1', value: { b: 2 } },
      ]);

      expect(nk.storageWrite).toHaveBeenCalledTimes(1);
      expect(nk.storageWrite).toHaveBeenCalledWith([
        { collection: 'col1', key: 'key1', userId: 'user1', value: '{"a":1}' },
        { collection: 'col2', key: 'key2', userId: 'user1', value: '{"b":2}' },
      ]);
    });
  });

  describe('readPlayerStats', () => {
    it('reads from player_stats collection', () => {
      const storageObjects = [
        {
          collection: 'player_stats',
          key: 'user1',
          userId: 'user1',
          value: '{}',
          version: 'v1',
          permissionRead: 1,
          permissionWrite: 1,
          createTime: 0,
          updateTime: 0,
        },
      ];
      const nk = createMockNk({ storageRead: jest.fn().mockReturnValue(storageObjects) });

      const result = readPlayerStats(nk as any, 'user1');

      expect(nk.storageRead).toHaveBeenCalledWith([
        { collection: 'player_stats', key: 'user1', userId: 'user1' },
      ]);
      expect(result).toBe(storageObjects);
    });
  });

  describe('writePlayerStats', () => {
    it('writes stringified stats to player_stats collection', () => {
      const nk = createMockNk();
      const stats = { level: 5, xp: 100 };

      writePlayerStats(nk as any, 'user1', stats);

      expect(nk.storageWrite).toHaveBeenCalledWith([
        {
          collection: 'player_stats',
          key: 'user1',
          userId: 'user1',
          value: JSON.stringify(stats),
        },
      ]);
    });
  });
});
