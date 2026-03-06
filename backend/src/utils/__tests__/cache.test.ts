import { CacheManager, getCacheManager, initializeCaches } from '../cache';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), info: jest.fn(), error: jest.fn() };
    cacheManager = new CacheManager(mockLogger);
    cacheManager.createCache('test', 100, 60);
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
          operation: 'cache_create'
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
  });
});

describe('CacheManager singleton', () => {
  it('getCacheManager returns same instance', () => {
    const cm1 = getCacheManager();
    const cm2 = getCacheManager();
    expect(cm1).toBe(cm2);
  });

  it('initializeCaches sets up default caches', () => {
    const cm = initializeCaches();
    expect(cm.getCacheInfo('player_stats')).toBeDefined();
    expect(cm.getCacheInfo('leaderboards')).toBeDefined();
  });
});
