/**
 * Tests for player-data-helpers utility
 */

import {
  createPlayerDataNotFoundResponse,
  createPlayerDataReadErrorResponse,
  parsePlayerStatsValue,
  readPlayerData,
  readPlayerStorage,
  readPlayerDataWithCache,
  getPlayerStatsWithCache,
  PLAYER_DATA_NOT_FOUND_RESPONSE,
  PLAYER_DATA_READ_ERROR_RESPONSE,
} from '../player-data-helpers';

describe('player-data-helpers', () => {
  describe('PLAYER_DATA_NOT_FOUND_RESPONSE', () => {
    it('should have correct error message', () => {
      expect(PLAYER_DATA_NOT_FOUND_RESPONSE).toEqual({ error: 'Player data not found' });
    });
  });

  describe('PLAYER_DATA_READ_ERROR_RESPONSE', () => {
    it('should have correct error message', () => {
      expect(PLAYER_DATA_READ_ERROR_RESPONSE).toEqual({ error: 'Failed to read player data' });
    });
  });

  describe('createPlayerDataNotFoundResponse', () => {
    it('should return default error message', () => {
      const result = createPlayerDataNotFoundResponse();
      expect(JSON.parse(result)).toEqual({ error: 'Player data not found' });
    });

    it('should return custom error message', () => {
      const result = createPlayerDataNotFoundResponse('Custom not found');
      expect(JSON.parse(result)).toEqual({ error: 'Custom not found' });
    });
  });

  describe('createPlayerDataReadErrorResponse', () => {
    it('should return default error message', () => {
      const result = createPlayerDataReadErrorResponse();
      expect(JSON.parse(result)).toEqual({ error: 'Failed to read player data' });
    });

    it('should return custom error message', () => {
      const result = createPlayerDataReadErrorResponse('Custom error');
      expect(JSON.parse(result)).toEqual({ error: 'Custom error' });
    });
  });

  describe('parsePlayerStatsValue', () => {
    it('should return null for undefined value', () => {
      expect(parsePlayerStatsValue(undefined)).toBeNull();
    });

    it('should return null for null value', () => {
      expect(parsePlayerStatsValue(null)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parsePlayerStatsValue('')).toBeNull();
    });

    it('should parse JSON string', () => {
      const input = '{"level":5,"xp":100,"stats":{}}';
      const result = parsePlayerStatsValue(input);
      expect(result).toEqual({ level: 5, xp: 100, stats: {} });
    });

    it('should return null for invalid JSON string', () => {
      expect(parsePlayerStatsValue('not json')).toBeNull();
    });

    it('should return object as-is when already parsed', () => {
      const input = { level: 5, xp: 100, stats: {} };
      const result = parsePlayerStatsValue(input);
      expect(result).toEqual(input);
    });

    it('should return null for non-object types', () => {
      expect(parsePlayerStatsValue(123)).toBeNull();
      expect(parsePlayerStatsValue(true)).toBeNull();
    });

    it('should return arrays as-is since they are objects', () => {
      expect(parsePlayerStatsValue([])).toEqual([]);
    });

    it('should return arrays as-is since they are objects', () => {
      expect(parsePlayerStatsValue([])).toEqual([]);
    });
  });

  describe('readPlayerData', () => {
    it('should return found with parsed data', () => {
      const mockNk = {
        storageRead: jest.fn().mockReturnValue([{ value: '{"level":5}' }]),
      };
      const mockCtx = { userId: 'user123' } as any;
      const parseFn = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);

      const result = readPlayerData(mockNk as any, mockCtx, 'player_stats', 'user123', parseFn);
      expect(result.found).toBe(true);
      expect(result.data).toEqual({ level: 5 });
    });

    it('should return not found for empty storage', () => {
      const mockNk = { storageRead: jest.fn().mockReturnValue([]) };
      const mockCtx = { userId: 'user123' } as any;

      const result = readPlayerData(mockNk as any, mockCtx, 'player_stats', 'user123', (v) => v);
      expect(result.found).toBe(false);
      expect(result.data).toBeUndefined();
    });

    it('should return error when parse function returns null', () => {
      const mockNk = {
        storageRead: jest.fn().mockReturnValue([{ value: 'data' }]),
      };
      const mockCtx = { userId: 'user123' } as any;

      const result = readPlayerData(mockNk as any, mockCtx, 'player_stats', 'user123', () => null);
      expect(result.found).toBe(false);
      expect(result.error).toBe('Invalid data format');
    });

    it('should return error when storageRead throws', () => {
      const mockNk = {
        storageRead: jest.fn().mockImplementation(() => {
          throw new Error('Storage failure');
        }),
      };
      const mockCtx = { userId: 'user123' } as any;

      const result = readPlayerData(mockNk as any, mockCtx, 'player_stats', 'user123', (v) => v);
      expect(result.found).toBe(false);
      expect(result.error).toBe('Storage failure');
    });

    it('should handle non-Error thrown', () => {
      const mockNk = {
        storageRead: jest.fn().mockImplementation(() => {
          throw 'string error';
        }),
      };
      const mockCtx = { userId: 'user123' } as any;

      const result = readPlayerData(mockNk as any, mockCtx, 'player_stats', 'user123', (v) => v);
      expect(result.found).toBe(false);
      expect(result.error).toBe('string error');
    });
  });

  describe('readPlayerStorage', () => {
    it('should call storageRead with correct params', () => {
      const mockNk = { storageRead: jest.fn().mockReturnValue([]) };
      readPlayerStorage(mockNk as any, 'user123', 'player_stats');
      expect(mockNk.storageRead).toHaveBeenCalledWith([
        { collection: 'player_stats', key: 'user123', userId: 'user123' },
      ]);
    });

    it('should return storage objects', () => {
      const mockObjects = [{ value: '{}' }];
      const mockNk = { storageRead: jest.fn().mockReturnValue(mockObjects) };
      const result = readPlayerStorage(mockNk as any, 'user123', 'player_stats');
      expect(result).toEqual(mockObjects);
    });
  });

  describe('readPlayerDataWithCache', () => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const mockCtx = { userId: 'user123' } as any;
    const parseFn = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return cached data when available', () => {
      const mockCache = {
        get: jest.fn().mockReturnValue('{"level":10}'),
        set: jest.fn(),
      };
      const mockNk = { storageRead: jest.fn() };

      const result = readPlayerDataWithCache(
        mockNk as any,
        mockLogger as any,
        mockCtx,
        'player_stats',
        mockCache as any,
        'player_stats',
        parseFn
      );
      expect(result.found).toBe(true);
      expect(result.data).toEqual({ level: 10 });
      expect(mockNk.storageRead).not.toHaveBeenCalled();
    });

    it('should fall through to storage when cache returns undefined', () => {
      const mockCache = {
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      };
      const mockNk = {
        storageRead: jest.fn().mockReturnValue([{ value: '{"level":5}' }]),
      };

      const result = readPlayerDataWithCache(
        mockNk as any,
        mockLogger as any,
        mockCtx,
        'player_stats',
        mockCache as any,
        'player_stats',
        parseFn
      );
      expect(result.found).toBe(true);
      expect(result.data).toEqual({ level: 5 });
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should read from storage when cache manager is null', () => {
      const mockNk = {
        storageRead: jest.fn().mockReturnValue([{ value: '{"level":3}' }]),
      };

      const result = readPlayerDataWithCache(
        mockNk as any,
        mockLogger as any,
        mockCtx,
        'player_stats',
        null,
        'player_stats',
        parseFn
      );
      expect(result.found).toBe(true);
      expect(result.data).toEqual({ level: 3 });
    });

    it('should log error when storage read fails', () => {
      const mockNk = {
        storageRead: jest.fn().mockImplementation(() => {
          throw new Error('DB error');
        }),
      };

      readPlayerDataWithCache(
        mockNk as any,
        mockLogger as any,
        mockCtx,
        'player_stats',
        null,
        'player_stats',
        parseFn
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle invalid cached data and fall through to storage', () => {
      const mockCache = {
        get: jest.fn().mockReturnValue('invalid-json'),
        set: jest.fn(),
      };
      const mockNk = {
        storageRead: jest.fn().mockReturnValue([{ value: '{"level":1}' }]),
      };

      const result = readPlayerDataWithCache(
        mockNk as any,
        mockLogger as any,
        mockCtx,
        'player_stats',
        mockCache as any,
        'player_stats',
        parseFn
      );
      expect(result.found).toBe(true);
      expect(mockNk.storageRead).toHaveBeenCalled();
    });

    it('should not cache when data is not found', () => {
      const mockCache = {
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      };
      const mockNk = { storageRead: jest.fn().mockReturnValue([]) };

      readPlayerDataWithCache(
        mockNk as any,
        mockLogger as any,
        mockCtx,
        'player_stats',
        mockCache as any,
        'player_stats',
        parseFn
      );
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('getPlayerStatsWithCache', () => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const mockCtx = { userId: 'user123' } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return player stats JSON when found', () => {
      const mockCache = {
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      };
      const mockNk = {
        storageRead: jest.fn().mockReturnValue([{ value: '{"level":5,"xp":100,"stats":{}}' }]),
      };

      const result = getPlayerStatsWithCache(
        mockNk as any,
        mockLogger as any,
        mockCtx,
        mockCache as any
      );
      const parsed = JSON.parse(result);
      expect(parsed.level).toBe(5);
      expect(parsed.xp).toBe(100);
    });

    it('should return error response when data not found', () => {
      const mockCache = {
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      };
      const mockNk = { storageRead: jest.fn().mockReturnValue([]) };

      const result = getPlayerStatsWithCache(
        mockNk as any,
        mockLogger as any,
        mockCtx,
        mockCache as any
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Player stats not found');
    });

    it('should return error response on storage error', () => {
      const mockCache = {
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      };
      const mockNk = {
        storageRead: jest.fn().mockImplementation(() => {
          throw new Error('DB failure');
        }),
      };

      const result = getPlayerStatsWithCache(
        mockNk as any,
        mockLogger as any,
        mockCtx,
        mockCache as any
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Failed to read player stats');
    });
  });
});
