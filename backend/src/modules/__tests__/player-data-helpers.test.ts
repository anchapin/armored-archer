import {
  PLAYER_DATA_NOT_FOUND_RESPONSE,
  PLAYER_DATA_READ_ERROR_RESPONSE,
  createPlayerDataNotFoundResponse,
  createPlayerDataReadErrorResponse,
  readPlayerData,
  readPlayerStorage,
  readPlayerDataWithCache,
  parsePlayerStatsValue,
  getPlayerStatsWithCache,
} from '../../utils/player-data-helpers';

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

const createMockCtx = (overrides = {}) => ({
  userId: 'test-user-123',
  username: 'testuser',
  variables: {} as Record<string, string>,
  env: {} as Record<string, string>,
  sessionExpiry: 999999,
  ...overrides,
});

const createMockCacheManager = (overrides = {}) => ({
  get: jest.fn(),
  set: jest.fn(),
  ...overrides,
});

const createStorageObject = (value: string, overrides = {}) => ({
  collection: 'test',
  key: 'key1',
  userId: 'test-user-123',
  value,
  version: 'v1',
  permissionRead: 1,
  permissionWrite: 1,
  createTime: 0,
  updateTime: 0,
  ...overrides,
});

describe('player-data-helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('response constants', () => {
    it('has expected PLAYER_DATA_NOT_FOUND_RESPONSE', () => {
      expect(PLAYER_DATA_NOT_FOUND_RESPONSE).toEqual({ error: 'Player data not found' });
    });

    it('has expected PLAYER_DATA_READ_ERROR_RESPONSE', () => {
      expect(PLAYER_DATA_READ_ERROR_RESPONSE).toEqual({ error: 'Failed to read player data' });
    });
  });

  describe('createPlayerDataNotFoundResponse', () => {
    it('returns default message when no custom message', () => {
      const result = JSON.parse(createPlayerDataNotFoundResponse());
      expect(result).toEqual({ error: 'Player data not found' });
    });

    it('returns custom message when provided', () => {
      const result = JSON.parse(createPlayerDataNotFoundResponse('Custom not found'));
      expect(result).toEqual({ error: 'Custom not found' });
    });
  });

  describe('createPlayerDataReadErrorResponse', () => {
    it('returns default message when no custom message', () => {
      const result = JSON.parse(createPlayerDataReadErrorResponse());
      expect(result).toEqual({ error: 'Failed to read player data' });
    });

    it('returns custom message when provided', () => {
      const result = JSON.parse(createPlayerDataReadErrorResponse('Custom read error'));
      expect(result).toEqual({ error: 'Custom read error' });
    });
  });

  describe('readPlayerData', () => {
    it('returns found with parsed data when storage has data', () => {
      const parseFn = jest.fn((value: unknown) => {
        if (typeof value === 'string') return JSON.parse(value);
        return value;
      });
      const nk = createMockNk({
        storageRead: jest.fn().mockReturnValue([createStorageObject('{"level":5}')]),
      });
      const ctx = createMockCtx();

      const result = readPlayerData(nk as any, ctx as any, 'player_stats', 'key1', parseFn);

      expect(result.found).toBe(true);
      expect(result.data).toEqual({ level: 5 });
      expect(result.error).toBeUndefined();
    });

    it('returns found false when storage returns empty array', () => {
      const parseFn = jest.fn();
      const nk = createMockNk({ storageRead: jest.fn().mockReturnValue([]) });
      const ctx = createMockCtx();

      const result = readPlayerData(nk as any, ctx as any, 'player_stats', 'key1', parseFn);

      expect(result.found).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeUndefined();
      expect(parseFn).not.toHaveBeenCalled();
    });

    it('returns found false with error when parse function returns null', () => {
      const parseFn = jest.fn().mockReturnValue(null);
      const nk = createMockNk({
        storageRead: jest.fn().mockReturnValue([createStorageObject('bad data')]),
      });
      const ctx = createMockCtx();

      const result = readPlayerData(nk as any, ctx as any, 'player_stats', 'key1', parseFn);

      expect(result.found).toBe(false);
      expect(result.error).toBe('Invalid data format');
    });

    it('returns found false with error message when nk.storageRead throws', () => {
      const parseFn = jest.fn();
      const nk = createMockNk({
        storageRead: jest.fn().mockImplementation(() => {
          throw new Error('Storage read failed');
        }),
      });
      const ctx = createMockCtx();

      const result = readPlayerData(nk as any, ctx as any, 'player_stats', 'key1', parseFn);

      expect(result.found).toBe(false);
      expect(result.error).toBe('Storage read failed');
    });

    it('handles non-Error thrown objects', () => {
      const parseFn = jest.fn();
      const nk = createMockNk({
        storageRead: jest.fn().mockImplementation(() => {
          throw 'string error';
        }),
      });
      const ctx = createMockCtx();

      const result = readPlayerData(nk as any, ctx as any, 'player_stats', 'key1', parseFn);

      expect(result.found).toBe(false);
      expect(result.error).toBe('string error');
    });
  });

  describe('readPlayerStorage', () => {
    it('reads from storage with collection and userId', () => {
      const storageObjects = [createStorageObject('{"level":3}')];
      const nk = createMockNk({
        storageRead: jest.fn().mockReturnValue(storageObjects),
      });

      const result = readPlayerStorage(nk as any, 'user-abc', 'player_stats');

      expect(nk.storageRead).toHaveBeenCalledWith([
        { collection: 'player_stats', key: 'user-abc', userId: 'user-abc' },
      ]);
      expect(result).toBe(storageObjects);
    });

    it('returns empty array when nothing found', () => {
      const nk = createMockNk({ storageRead: jest.fn().mockReturnValue([]) });

      const result = readPlayerStorage(nk as any, 'user-abc', 'player_stats');

      expect(result).toEqual([]);
    });
  });

  describe('readPlayerDataWithCache', () => {
    it('returns cached data on cache hit', () => {
      const cachedData = { level: 10, xp: 500, stats: {} };
      const cacheManager = createMockCacheManager({
        get: jest.fn().mockReturnValue(JSON.stringify(cachedData)),
      });
      const nk = createMockNk();
      const logger = createMockLogger();
      const ctx = createMockCtx();
      const parseFn = jest.fn((value: unknown) => value as any);

      const result = readPlayerDataWithCache(
        nk as any,
        logger as any,
        ctx as any,
        'player_stats',
        cacheManager as any,
        'player_stats',
        parseFn
      );

      expect(result.found).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(nk.storageRead).not.toHaveBeenCalled();
    });

    it('falls through to storage on cache miss', () => {
      const storageData = { level: 5, xp: 100, stats: {} };
      const cacheManager = createMockCacheManager({
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      });
      const nk = createMockNk({
        storageRead: jest.fn().mockReturnValue([createStorageObject(JSON.stringify(storageData))]),
      });
      const logger = createMockLogger();
      const ctx = createMockCtx();
      const parseFn = jest.fn((value: unknown) => {
        if (typeof value === 'string') return JSON.parse(value);
        return value;
      });

      const result = readPlayerDataWithCache(
        nk as any,
        logger as any,
        ctx as any,
        'player_stats',
        cacheManager as any,
        'player_stats',
        parseFn
      );

      expect(result.found).toBe(true);
      expect(result.data).toEqual(storageData);
      expect(nk.storageRead).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'player_stats',
        'test-user-123',
        JSON.stringify(storageData)
      );
    });

    it('falls through to storage when cache entry is invalid JSON', () => {
      const cacheManager = createMockCacheManager({
        get: jest.fn().mockReturnValue('not valid json'),
      });
      const nk = createMockNk({
        storageRead: jest.fn().mockReturnValue([createStorageObject('{"level":1}')]),
      });
      const logger = createMockLogger();
      const ctx = createMockCtx();
      const parseFn = jest.fn((value: unknown) => {
        if (typeof value === 'string') return JSON.parse(value);
        return value;
      });

      const result = readPlayerDataWithCache(
        nk as any,
        logger as any,
        ctx as any,
        'player_stats',
        cacheManager as any,
        'player_stats',
        parseFn
      );

      expect(result.found).toBe(true);
      expect(nk.storageRead).toHaveBeenCalledTimes(1);
    });

    it('reads directly from storage when cacheManager is null', () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockReturnValue([createStorageObject('{"level":1}')]),
      });
      const logger = createMockLogger();
      const ctx = createMockCtx();
      const parseFn = jest.fn((value: unknown) => {
        if (typeof value === 'string') return JSON.parse(value);
        return value;
      });

      const result = readPlayerDataWithCache(
        nk as any,
        logger as any,
        ctx as any,
        'player_stats',
        null,
        'player_stats',
        parseFn
      );

      expect(result.found).toBe(true);
      expect(nk.storageRead).toHaveBeenCalledTimes(1);
    });

    it('reads directly from storage when cacheManager is undefined', () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockReturnValue([createStorageObject('{"level":1}')]),
      });
      const logger = createMockLogger();
      const ctx = createMockCtx();
      const parseFn = jest.fn((value: unknown) => {
        if (typeof value === 'string') return JSON.parse(value);
        return value;
      });

      const result = readPlayerDataWithCache(
        nk as any,
        logger as any,
        ctx as any,
        'player_stats',
        undefined,
        'player_stats',
        parseFn
      );

      expect(result.found).toBe(true);
      expect(nk.storageRead).toHaveBeenCalledTimes(1);
    });

    it('logs error when storage read fails', () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockImplementation(() => {
          throw new Error('Storage error');
        }),
      });
      const logger = createMockLogger();
      const ctx = createMockCtx();
      const parseFn = jest.fn();

      const result = readPlayerDataWithCache(
        nk as any,
        logger as any,
        ctx as any,
        'player_stats',
        null,
        'player_stats',
        parseFn
      );

      expect(result.found).toBe(false);
      expect(result.error).toBe('Storage error');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to read player data from storage',
        expect.objectContaining({
          collection: 'player_stats',
          key: 'test-user-123',
          error: 'Storage error',
        })
      );
    });
  });

  describe('parsePlayerStatsValue', () => {
    it('returns null for null value', () => {
      expect(parsePlayerStatsValue(null)).toBeNull();
    });

    it('returns null for undefined value', () => {
      expect(parsePlayerStatsValue(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parsePlayerStatsValue('')).toBeNull();
    });

    it('parses valid JSON string', () => {
      const stats = { level: 5, xp: 100, stats: { attack: 10 } };
      const result = parsePlayerStatsValue(JSON.stringify(stats));
      expect(result).toEqual(stats);
    });

    it('returns null for invalid JSON string', () => {
      expect(parsePlayerStatsValue('{not json')).toBeNull();
    });

    it('returns object as-is when value is an object', () => {
      const stats = { level: 3, xp: 50, stats: { defense: 5 } };
      const result = parsePlayerStatsValue(stats);
      expect(result).toBe(stats);
    });

    it('returns null for number value', () => {
      expect(parsePlayerStatsValue(42)).toBeNull();
    });

    it('returns null for boolean value', () => {
      expect(parsePlayerStatsValue(true)).toBeNull();
    });
  });

  describe('getPlayerStatsWithCache', () => {
    it('returns error response when storage read has error', () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockImplementation(() => {
          throw new Error('DB connection lost');
        }),
      });
      const logger = createMockLogger();
      const ctx = createMockCtx();
      const cacheManager = createMockCacheManager({
        get: jest.fn().mockReturnValue(undefined),
      });

      const result = getPlayerStatsWithCache(
        nk as any,
        logger as any,
        ctx as any,
        cacheManager as any
      );

      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ error: 'Failed to read player stats' });
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to read player stats',
        expect.objectContaining({ userId: 'test-user-123' })
      );
    });

    it('returns not-found response when data not in storage', () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockReturnValue([]),
      });
      const logger = createMockLogger();
      const ctx = createMockCtx();
      const cacheManager = createMockCacheManager({
        get: jest.fn().mockReturnValue(undefined),
      });

      const result = getPlayerStatsWithCache(
        nk as any,
        logger as any,
        ctx as any,
        cacheManager as any
      );

      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ error: 'Player stats not found' });
    });

    it('returns stats JSON when data is found', () => {
      const statsData = { level: 7, xp: 250, stats: { attack: 20 } };
      const nk = createMockNk({
        storageRead: jest.fn().mockReturnValue([createStorageObject(JSON.stringify(statsData))]),
      });
      const logger = createMockLogger();
      const ctx = createMockCtx();
      const cacheManager = createMockCacheManager({
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      });

      const result = getPlayerStatsWithCache(
        nk as any,
        logger as any,
        ctx as any,
        cacheManager as any
      );

      const parsed = JSON.parse(result);
      expect(parsed).toEqual(statsData);
    });

    it('returns cached stats when available', () => {
      const cachedStats = { level: 10, xp: 500, stats: { defense: 30 } };
      const nk = createMockNk();
      const logger = createMockLogger();
      const ctx = createMockCtx();
      const cacheManager = createMockCacheManager({
        get: jest.fn().mockReturnValue(JSON.stringify(cachedStats)),
      });

      const result = getPlayerStatsWithCache(
        nk as any,
        logger as any,
        ctx as any,
        cacheManager as any
      );

      const parsed = JSON.parse(result);
      expect(parsed).toEqual(cachedStats);
      expect(nk.storageRead).not.toHaveBeenCalled();
    });
  });
});
