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
import { Runtime } from '../types/nakama';
import { CacheValueType } from '../types/shared';
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
declare class CacheManager {
    private caches;
    private metrics;
    private logger;
    /**
     * Creates a new CacheManager instance.
     *
     * @param logger - Optional logger for debug/error logging
     */
    constructor(logger?: Runtime.Logger | null);
    /**
     * Creates a new named cache with configured size and TTL.
     *
     * @param name - Unique name for this cache instance
     * @param max - Maximum number of entries in the cache
     * @param ttl - Time-to-live in milliseconds (0 means no expiration)
     * @returns The created LRU cache instance
     */
    createCache(name: string, max: number, ttl: number): LRUCache<string, CacheValueType>;
    get<T extends CacheValueType>(cacheName: string, key: string): T | undefined;
    set(cacheName: string, key: string, value: CacheValueType): void;
    delete(cacheName: string, key: string): void;
    clear(cacheName: string): void;
    getMetrics(cacheName: string): CacheMetrics | undefined;
    getAllMetrics(): Record<string, CacheMetrics>;
    getCacheInfo(cacheName: string): {
        size: number;
        max: number;
        ttl: number;
    } | undefined;
    /**
     * Destroys all caches and clears all metrics.
     * This is important for proper cleanup of internal timers in lru-cache.
     */
    destroy(): void;
}
declare const TTL: {
    readonly SHORT: number;
    readonly MEDIUM: number;
    readonly LONG: number;
};
declare const CACHE_SIZES: {
    readonly SMALL: 100;
    readonly MEDIUM: 500;
    readonly LARGE: 1000;
};
export declare function getCacheManager(logger?: Runtime.Logger): CacheManager;
/**
 * Resets the cache manager singleton instance.
 * This should be called in test teardown to prevent resource leaks.
 */
export declare function resetCacheManager(): void;
export declare function initializeCaches(logger?: Runtime.Logger): CacheManager;
export { CacheManager, TTL, CACHE_SIZES };
