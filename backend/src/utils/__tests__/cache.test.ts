import { CacheManager, getCacheManager, initializeCaches, resetCacheManager } from '../cache';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), info: jest.fn(), error: jest.fn() };
    cacheManager = new CacheManager(mockLogger);
    cacheManager.createCache('test', 100, 60);
  });

  afterEach(() => {
    // Clean up the cache manager to prevent resource leaks
    cacheManager.destroy();
  });

  describe('constructor', () => {
    it('creates with null logger by default', () => {
      const manager = new CacheManager();
      manager.createCache('noLog', 10, 100);
      manager.set('noLog', 'k', 'v');
      expect(manager.get('noLog', 'k')).toBe('v');
      manager.destroy();
    });
  });

  describe('createCache', () => {
    it('creates a new cache with options', () => {
      expect(cacheManager.getCacheInfo('test')).toBeDefined();
    });

    it('logs cache creation', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cache created',
        expect.objectContaining({
          cacheName: 'test',
          max: 100,
          ttl: 60,
          operation: 'cache_create',
        })
      );
    });
  });

  describe('get', () => {
    it('returns value when present', () => {
      cacheManager.set('test', 'key1', 'value1');
      expect(cacheManager.get('test', 'key1')).toBe('value1');
    });

    it('returns undefined for missing key', () => {
      expect(cacheManager.get('test', 'missing')).toBeUndefined();
    });

    it('increments hits metric', () => {
      cacheManager.set('test', 'k', 'v');
      cacheManager.get('test', 'k');
      const metrics = cacheManager.getMetrics('test');
      expect(metrics?.hits).toBe(1);
    });

    it('increments misses metric', () => {
      cacheManager.get('test', 'missing');
      const metrics = cacheManager.getMetrics('test');
      expect(metrics?.misses).toBe(1);
    });
  });

  describe('set', () => {
    it('sets value for key', () => {
      cacheManager.set('test', 'k', 'v');
      expect(cacheManager.get('test', 'k')).toBe('v');
    });

    it('overwrites existing value', () => {
      cacheManager.set('test', 'k', 'v1');
      cacheManager.set('test', 'k', 'v2');
      expect(cacheManager.get('test', 'k')).toBe('v2');
    });

    it('does nothing for non-existent cache', () => {
      cacheManager.set('nonexistent', 'k', 'v'); // no error
    });
  });

  describe('delete', () => {
    it('deletes existing key', () => {
      cacheManager.set('test', 'k', 'v');
      cacheManager.delete('test', 'k');
      expect(cacheManager.get('test', 'k')).toBeUndefined();
    });

    it('does nothing for missing key', () => {
      cacheManager.delete('test', 'missing');
      expect(cacheManager.get('test', 'missing')).toBeUndefined();
    });

    it('handles delete on non-existent cache without logger', () => {
      const manager = new CacheManager(null);
      manager.createCache('temp', 10, 100);
      // Delete on a cache that doesn't exist - no logger, so no error log
      expect(() => manager.delete('nonexistent', 'k')).not.toThrow();
      manager.destroy();
    });
  });

  describe('clear', () => {
    it('clears all entries', () => {
      cacheManager.set('test', 'k1', 'v1');
      cacheManager.set('test', 'k2', 'v2');
      cacheManager.clear('test');
      expect(cacheManager.get('test', 'k1')).toBeUndefined();
    });

    it('resets metrics', () => {
      cacheManager.set('test', 'k', 'v');
      cacheManager.get('test', 'k'); // hit
      cacheManager.clear('test');
      const metrics = cacheManager.getMetrics('test');
      expect(metrics?.hits).toBe(0);
      expect(metrics?.misses).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('returns metrics object', () => {
      cacheManager.set('test', 'k', 'v');
      cacheManager.get('test', 'k');
      const metrics = cacheManager.getMetrics('test');
      expect(metrics).toBeDefined();
      expect(metrics?.hits).toBe(1);
    });
  });

  describe('getAllMetrics', () => {
    it('returns all metrics for all caches', () => {
      cacheManager.set('test', 'k', 'v');
      const all = cacheManager.getAllMetrics();
      expect(all['test']).toBeDefined();
    });
  });

  describe('getCacheInfo', () => {
    it('returns info including size', () => {
      cacheManager.set('test', 'k', 'v');
      const info = cacheManager.getCacheInfo('test');
      expect(info).toBeDefined();
      expect(info.size).toBeGreaterThanOrEqual(1);
    });

    it('defaults ttl to 0 when cache ttl is undefined', () => {
      const manager = new CacheManager(null);
      const cache = manager.createCache('ttlTest', 10, 5000);
      // Force ttl to undefined to trigger the ?? 0 branch
      (cache as any).ttl = undefined;
      const info = manager.getCacheInfo('ttlTest');
      expect(info).toBeDefined();
      expect(info.ttl).toBe(0);
      manager.destroy();
    });
  });

  describe('clear with non-existent cache', () => {
    it('handles clearing a non-existent cache gracefully', () => {
      expect(() => cacheManager.clear('nonexistent_clear')).not.toThrow();
    });

    it('logs error when clearing non-existent cache', () => {
      cacheManager.clear('nonexistent_log');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cache not found',
        expect.objectContaining({
          cacheName: 'nonexistent_log',
          operation: 'cache_not_found',
        })
      );
    });

    it('handles clearing non-existent cache without logger', () => {
      const manager = new CacheManager(null);
      manager.createCache('temp', 10, 100);
      expect(() => manager.clear('nonexistent')).not.toThrow();
      manager.destroy();
    });
  });

  describe('get with non-existent cache', () => {
    it('returns undefined for non-existent cache', () => {
      expect(cacheManager.get('nonexistent_cache', 'key')).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('cleans up all caches', () => {
      cacheManager.set('test', 'k', 'v');
      cacheManager.destroy();
      // After destroy, getting should return undefined
      expect(cacheManager.get('test', 'k')).toBeUndefined();
    });
  });

  describe('getCacheInfo with non-existent cache', () => {
    it('returns undefined for non-existent cache', () => {
      expect(cacheManager.getCacheInfo('nonexistent_info')).toBeUndefined();
    });
  });
});

describe('CacheManager singleton', () => {
  afterEach(() => {
    // Clean up the singleton to prevent resource leaks between tests
    resetCacheManager();
  });

  it('getCacheManager returns same instance', () => {
    const cm1 = getCacheManager();
    const cm2 = getCacheManager();
    expect(cm1).toBe(cm2);
  });

  it('getCacheManager with logger uses provided logger', () => {
    const customLogger = { debug: jest.fn(), info: jest.fn(), error: jest.fn() };
    const cm = getCacheManager(customLogger as any);
    cm.createCache('custom', 10, 1000);
    expect(customLogger.info).toHaveBeenCalledWith(
      'Cache created',
      expect.objectContaining({ cacheName: 'custom' })
    );
  });

  it('initializeCaches sets up default caches', () => {
    const cm = initializeCaches();
    expect(cm.getCacheInfo('player_stats')).toBeDefined();
    expect(cm.getCacheInfo('leaderboards')).toBeDefined();
  });

  it('initializeCaches with logger logs initialization', () => {
    const customLogger = { debug: jest.fn(), info: jest.fn(), error: jest.fn() };
    const cm = initializeCaches(customLogger as any);
    expect(cm.getCacheInfo('player_stats')).toBeDefined();
    expect(customLogger.info).toHaveBeenCalledWith('All caches initialized');
  });
});

describe('CacheManager destroy edge cases', () => {
  it('handles cache without destroy method by calling clear', () => {
    const manager = new CacheManager(null);
    const cache = manager.createCache('test', 100, 60);
    manager.set('test', 'k', 'v');

    // Replace destroy with undefined to trigger the else branch
    (cache as any).destroy = undefined;

    manager.destroy();
    // After destroy, caches map should be empty
    expect(manager.get('test', 'k')).toBeUndefined();
  });

  it('handles destroy when cache has destroy as non-function', () => {
    const manager = new CacheManager(null);
    const cache = manager.createCache('test', 100, 60);
    manager.set('test', 'k', 'v');

    // Set destroy to a non-function value
    (cache as any).destroy = 'not-a-function';

    manager.destroy();
    expect(manager.get('test', 'k')).toBeUndefined();
  });
});
