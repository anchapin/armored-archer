/**
 * Cache management utility providing LRU cache instances with metrics tracking.
 *
 * This module provides a centralized cache manager for managing multiple named cache
 * instances with configurable size limits and TTL. It tracks hit/miss metrics for
 * performance monitoring and debugging.
 *
 * Key features:
 * - Multiple named cache instances with independent configuration
 * - Automatic TTL (time-to-live) expiration
 * - Hit/miss metrics tracking per cache
 * - Singleton pattern for global cache access
 *
 * @module utils/cache
 */

import { LRUCache as LRUCacheClass } from 'lru-cache';
import { logCacheOperation } from '../config/logger';
import { Runtime } from '../types/nakama';
import { CacheValueType } from '../types/shared';
import { getCacheEntry, setCacheEntry, deleteCacheEntry } from './cache-helpers';

type LRUCache<K, V> = InstanceType<typeof LRUCacheClass<K, V>>;

/**
 * Cache performance metrics.
 *
 * @property hits - Number of cache hits (successful retrievals)
 * @property misses - Number of cache misses (failed retrievals)
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
}

/**
 * Manages multiple named LRU cache instances with metrics tracking.
 *
 * The CacheManager provides a centralized way to create, access, and manage
 * multiple cache instances with different configurations. Each cache tracks
 * its own hit/miss metrics for performance monitoring.
 *
 * @example
 * const manager = new CacheManager(logger);
 * const cache = manager.createCache('player_stats', 100, 60000);
 * manager.set('player_stats', 'user123', stats);
 * const result = manager.get<PlayerStats>('player_stats', 'user123');
 */
class CacheManager {
  private caches: Map<string, LRUCache<string, CacheValueType>>;
  private metrics: Map<string, CacheMetrics>;
  private logger: Runtime.Logger | null;

  /**
   * Creates a new CacheManager instance.
   *
   * @param logger - Optional logger for debug/error logging
   */
  constructor(logger: Runtime.Logger | null = null) {
    this.caches = new Map();
    this.metrics = new Map();
    this.logger = logger;
  }

  /**
   * Creates a new named cache with configured size and TTL.
   *
   * @param name - Unique name for this cache instance
   * @param max - Maximum number of entries in the cache
   * @param ttl - Time-to-live in milliseconds (0 means no expiration)
   * @returns The created LRU cache instance
   */
  createCache(name: string, max: number, ttl: number): LRUCache<string, CacheValueType> {
    const cache = new LRUCacheClass<string, CacheValueType>({
      max: max,
      ttl: ttl,
    });

    this.caches.set(name, cache);
    this.metrics.set(name, { hits: 0, misses: 0 });

    if (this.logger) {
      this.logger.info('Cache created', {
        cacheName: name,
        max,
        ttl,
        operation: 'cache_create',
      });
    }

    return cache;
  }

  get<T extends CacheValueType>(cacheName: string, key: string): T | undefined {
    const cache = this.caches.get(cacheName);
    const metrics = this.metrics.get(cacheName);

    const value = getCacheEntry(
      cache,
      metrics,
      this.logger,
      cacheName,
      key
    );

    return value as T;
  }

  set(cacheName: string, key: string, value: CacheValueType): void {
    const cache = this.caches.get(cacheName);

    setCacheEntry(
      cache,
      this.logger,
      cacheName,
      key,
      value
    );
  }

  delete(cacheName: string, key: string): void {
    const cache = this.caches.get(cacheName);

    deleteCacheEntry(
      cache,
      this.logger,
      cacheName,
      key
    );
  }

  clear(cacheName: string): void {
    const cache = this.caches.get(cacheName);
    const metrics = this.metrics.get(cacheName);

    if (!cache || !metrics) {
      if (this.logger) {
        this.logger.error('Cache not found', {
          cacheName,
          operation: 'cache_not_found',
        });
      }
      return;
    }

    cache.clear();
    metrics.hits = 0;
    metrics.misses = 0;

    logCacheOperation('clear', cacheName, '*');
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

  /**
   * Destroys all caches and clears all metrics.
   * This is important for proper cleanup of internal timers in lru-cache.
   */
  destroy(): void {
    for (const [name, cache] of this.caches.entries()) {
      // lru-cache v11+ has a destroy method that stops internal timers
      if (typeof cache.destroy === 'function') {
        cache.destroy();
      } else {
        cache.clear();
      }
      logCacheOperation('destroy', name, '*');
    }
    this.caches.clear();
    this.metrics.clear();
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

/**
 * Resets the cache manager singleton instance.
 * This should be called in test teardown to prevent resource leaks.
 */
export function resetCacheManager(): void {
  if (cacheManagerInstance) {
    cacheManagerInstance.destroy();
    cacheManagerInstance = null;
  }
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
