import { Runtime } from '../types/nakama';
import { LRUCache as LRUCacheClass } from 'lru-cache';
import { CacheValueType } from '../types/shared';

type LRUCache<K, V> = InstanceType<typeof LRUCacheClass<K, V>>;

export interface CacheMetrics {
  hits: number;
  misses: number;
}

class CacheManager {
  private caches: Map<string, LRUCache<string, CacheValueType>>;
  private metrics: Map<string, CacheMetrics>;
  private logger: Runtime.Logger | null;

  constructor(logger: Runtime.Logger | null = null) {
    this.caches = new Map();
    this.metrics = new Map();
    this.logger = logger;
  }

  createCache(name: string, max: number, ttl: number): LRUCache<string, CacheValueType> {
    const cache = new LRUCacheClass<string, CacheValueType>({
      max: max,
      ttl: ttl,
    });

    this.caches.set(name, cache);
    this.metrics.set(name, { hits: 0, misses: 0 });

    if (this.logger) {
      this.logger.info('Cache %s created with max=%d, ttl=%dms', name, max, ttl);
    }

    return cache;
  }

  get<T extends CacheValueType>(cacheName: string, key: string): T | undefined {
    const cache = this.caches.get(cacheName);
    const metrics = this.metrics.get(cacheName);

    if (!cache || !metrics) {
      if (this.logger) {
        this.logger.error('Cache %s not found', cacheName);
      }
      return undefined;
    }

    const value = cache.get(key);

    if (value !== undefined) {
      metrics.hits++;
      if (this.logger) {
        this.logger.debug('Cache HIT: %s:%s', cacheName, key);
      }
    } else {
      metrics.misses++;
      if (this.logger) {
        this.logger.debug('Cache MISS: %s:%s', cacheName, key);
      }
    }

    return value as T;
  }

  set(cacheName: string, key: string, value: CacheValueType): void {
    const cache = this.caches.get(cacheName);

    if (!cache) {
      if (this.logger) {
        this.logger.error('Cache %s not found', cacheName);
      }
      return;
    }

    cache.set(key, value);

    if (this.logger) {
      this.logger.debug('Cache SET: %s:%s', cacheName, key);
    }
  }

  delete(cacheName: string, key: string): void {
    const cache = this.caches.get(cacheName);

    if (!cache) {
      if (this.logger) {
        this.logger.error('Cache %s not found', cacheName);
      }
      return;
    }

    cache.delete(key);

    if (this.logger) {
      this.logger.debug('Cache DELETE: %s:%s', cacheName, key);
    }
  }

  clear(cacheName: string): void {
    const cache = this.caches.get(cacheName);
    const metrics = this.metrics.get(cacheName);

    if (!cache || !metrics) {
      if (this.logger) {
        this.logger.error('Cache %s not found', cacheName);
      }
      return;
    }

    cache.clear();
    metrics.hits = 0;
    metrics.misses = 0;

    if (this.logger) {
      this.logger.info('Cache %s cleared', cacheName);
    }
  }

  getMetrics(cacheName: string): CacheMetrics | undefined {
    return this.metrics.get(cacheName);
  }

  getAllMetrics(): Record<string, CacheMetrics> {
    const result: Record<string, CacheMetrics> = {};

    for (const [name, metrics] of this.metrics.entries()) {
      result[name] = { ...metrics };
    }

    return result;
  }

  getCacheInfo(cacheName: string): { size: number; max: number; ttl: number } | undefined {
    const cache = this.caches.get(cacheName);

    if (!cache) {
      return undefined;
    }

    return {
      size: cache.size,
      max: cache.max,
      ttl: cache.ttl ?? 0,
    };
  }
}

const TTL = {
  SHORT: 60 * 1000,
  MEDIUM: 5 * 60 * 1000,
  LONG: 30 * 60 * 1000,
} as const;

const CACHE_SIZES = {
  SMALL: 100,
  MEDIUM: 500,
  LARGE: 1000,
} as const;

let cacheManagerInstance: CacheManager | null = null;

export function getCacheManager(logger?: Runtime.Logger): CacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager(logger || null);
  }
  return cacheManagerInstance;
}

export function initializeCaches(logger?: Runtime.Logger): CacheManager {
  const manager = getCacheManager(logger);

  manager.createCache('player_stats', CACHE_SIZES.MEDIUM, TTL.SHORT);
  manager.createCache('leaderboards', CACHE_SIZES.SMALL, TTL.SHORT);
  manager.createCache('season_info', CACHE_SIZES.SMALL, TTL.MEDIUM);
  manager.createCache('store_catalog', CACHE_SIZES.SMALL, TTL.LONG);
  manager.createCache('gear_definitions', CACHE_SIZES.SMALL, TTL.LONG);

  if (logger) {
    logger.info('All caches initialized');
  }

  return manager;
}

export { CacheManager, TTL, CACHE_SIZES };
