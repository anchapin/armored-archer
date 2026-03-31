import {
  isValidCacheKey,
  isValidCacheName,
  sanitizeCacheKeyForLog,
  CACHE_KEYS,
  getPlayerCacheKey,
  getRelatedCacheKeys,
  getCacheEntry,
  setCacheEntry,
  deleteCacheEntry,
  CacheOperation,
} from '../cache-helpers';

describe('cache-helpers', () => {
  describe('isValidCacheKey', () => {
    test('should return true for valid cache keys', () => {
      expect(isValidCacheKey('player_stats:user123')).toBe(true);
      expect(isValidCacheKey('a')).toBe(true);
      expect(isValidCacheKey('key'.repeat(64))).toBe(true); // 256 chars
    });

    test('should return false for invalid cache keys', () => {
      expect(isValidCacheKey('')).toBe(false);
      expect(isValidCacheKey('a'.repeat(257))).toBe(false); // > 256 chars
    });
  });

  describe('isValidCacheName', () => {
    test('should return true for valid cache names', () => {
      expect(isValidCacheName('playerStats')).toBe(true);
      expect(isValidCacheName('a')).toBe(true);
      expect(isValidCacheName('a'.repeat(64))).toBe(true); // 64 chars
    });

    test('should return false for invalid cache names', () => {
      expect(isValidCacheName('')).toBe(false);
      expect(isValidCacheName('a'.repeat(65))).toBe(false); // > 64 chars
      expect(isValidCacheName(null as any)).toBe(false);
    });
  });

  describe('sanitizeCacheKeyForLog', () => {
    test('should return key unchanged if under max length', () => {
      const key = 'short-key';
      expect(sanitizeCacheKeyForLog(key)).toBe(key);
      expect(sanitizeCacheKeyForLog(key, 50)).toBe(key);
    });

    test('should truncate keys exceeding max length', () => {
      const longKey = 'a'.repeat(200);
      const result = sanitizeCacheKeyForLog(longKey, 100);
      expect(result.length).toBe(103); // 100 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    test('should use custom max length', () => {
      const key = 'a'.repeat(50);
      const result = sanitizeCacheKeyForLog(key, 20);
      expect(result.length).toBe(23); // 20 + '...'
    });
  });

  describe('CACHE_KEYS', () => {
    test('should have expected key prefixes', () => {
      expect(CACHE_KEYS.PLAYER_STATS).toBe('player_stats');
      expect(CACHE_KEYS.LEADERBOARD).toBe('leaderboard');
      expect(CACHE_KEYS.SEASON_INFO).toBe('season_info');
      expect(CACHE_KEYS.STORE_CATALOG).toBe('store_catalog');
      expect(CACHE_KEYS.GEAR_DEFINITIONS).toBe('gear_definitions');
    });
  });

  describe('getPlayerCacheKey', () => {
    test('should return formatted cache key', () => {
      expect(getPlayerCacheKey('user123', 'player_stats')).toBe('player_stats:user123');
      expect(getPlayerCacheKey('abc', 'leaderboard')).toBe('leaderboard:abc');
    });
  });

  describe('getRelatedCacheKeys', () => {
    test('should return array of related cache keys', () => {
      const keys = getRelatedCacheKeys('user123');
      expect(keys).toContain('player_stats:user123');
      expect(keys).toContain('leaderboard:user123');
      expect(keys.length).toBe(2);
    });
  });

  describe('getCacheEntry', () => {
    let mockCache: Map<string, any>;
    let mockMetrics: { hits: number; misses: number };
    let mockLogger: any;

    beforeEach(() => {
      mockCache = new Map();
      mockMetrics = { hits: 0, misses: 0 };
      mockLogger = {
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };
    });

    test('should return cached value and increment hits', () => {
      mockCache.set('key1', { data: 'value' });
      const result = getCacheEntry(mockCache, mockMetrics, mockLogger, 'testCache', 'key1');

      expect(result).toEqual({ data: 'value' });
      expect(mockMetrics.hits).toBe(1);
      expect(mockMetrics.misses).toBe(0);
    });

    test('should return undefined and increment misses for missing key', () => {
      const result = getCacheEntry(mockCache, mockMetrics, mockLogger, 'testCache', 'nonexistent');

      expect(result).toBeUndefined();
      expect(mockMetrics.hits).toBe(0);
      expect(mockMetrics.misses).toBe(1);
    });

    test('should handle undefined cache', () => {
      const result = getCacheEntry(undefined, mockMetrics, mockLogger, 'testCache', 'key1');

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle undefined metrics', () => {
      const result = getCacheEntry(mockCache, undefined, mockLogger, 'testCache', 'key1');

      expect(result).toBeUndefined();
    });

    test('should handle null logger', () => {
      const result = getCacheEntry(mockCache, mockMetrics, null, 'testCache', 'key1');

      expect(result).toBeUndefined();
    });
  });

  describe('setCacheEntry', () => {
    let mockCache: Map<string, any>;
    let mockLogger: any;

    beforeEach(() => {
      mockCache = new Map();
      mockLogger = {
        error: jest.fn(),
        info: jest.fn(),
      };
    });

    test('should set value in cache', () => {
      setCacheEntry(mockCache, mockLogger, 'testCache', 'key1', { data: 'value' });

      expect(mockCache.get('key1')).toEqual({ data: 'value' });
    });

    test('should handle undefined cache', () => {
      setCacheEntry(undefined, mockLogger, 'testCache', 'key1', 'value');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle null logger', () => {
      setCacheEntry(mockCache, null, 'testCache', 'key1', 'value');

      expect(mockCache.get('key1')).toBe('value');
    });
  });

  describe('deleteCacheEntry', () => {
    let mockCache: Map<string, any>;
    let mockLogger: any;

    beforeEach(() => {
      mockCache = new Map();
      mockCache.set('key1', 'value1');
      mockLogger = {
        error: jest.fn(),
        info: jest.fn(),
      };
    });

    test('should delete entry from cache', () => {
      deleteCacheEntry(mockCache, mockLogger, 'testCache', 'key1');

      expect(mockCache.has('key1')).toBe(false);
    });

    test('should handle deletion of non-existent key', () => {
      expect(() => deleteCacheEntry(mockCache, mockLogger, 'testCache', 'nonexistent')).not.toThrow();
    });

    test('should handle undefined cache', () => {
      deleteCacheEntry(undefined, mockLogger, 'testCache', 'key1');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});