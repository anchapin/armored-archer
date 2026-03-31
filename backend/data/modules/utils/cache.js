"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_SIZES = exports.TTL = exports.CacheManager = void 0;
exports.getCacheManager = getCacheManager;
exports.resetCacheManager = resetCacheManager;
exports.initializeCaches = initializeCaches;
var tslib_1 = require("tslib");
var lru_cache_1 = require("lru-cache");
var logger_1 = require("../config/logger");
var cache_helpers_1 = require("./cache-helpers");
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
var CacheManager = /** @class */ (function () {
    /**
     * Creates a new CacheManager instance.
     *
     * @param logger - Optional logger for debug/error logging
     */
    function CacheManager(logger) {
        if (logger === void 0) { logger = null; }
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
    CacheManager.prototype.createCache = function (name, max, ttl) {
        var cache = new lru_cache_1.LRUCache({
            max: max,
            ttl: ttl,
        });
        this.caches.set(name, cache);
        this.metrics.set(name, { hits: 0, misses: 0 });
        if (this.logger) {
            this.logger.info('Cache created', {
                cacheName: name,
                max: max,
                ttl: ttl,
                operation: 'cache_create',
            });
        }
        return cache;
    };
    CacheManager.prototype.get = function (cacheName, key) {
        var cache = this.caches.get(cacheName);
        var metrics = this.metrics.get(cacheName);
        var value = (0, cache_helpers_1.getCacheEntry)(cache, metrics, this.logger, cacheName, key);
        return value;
    };
    CacheManager.prototype.set = function (cacheName, key, value) {
        var cache = this.caches.get(cacheName);
        (0, cache_helpers_1.setCacheEntry)(cache, this.logger, cacheName, key, value);
    };
    CacheManager.prototype.delete = function (cacheName, key) {
        var cache = this.caches.get(cacheName);
        (0, cache_helpers_1.deleteCacheEntry)(cache, this.logger, cacheName, key);
    };
    CacheManager.prototype.clear = function (cacheName) {
        var cache = this.caches.get(cacheName);
        var metrics = this.metrics.get(cacheName);
        if (!cache || !metrics) {
            if (this.logger) {
                this.logger.error('Cache not found', {
                    cacheName: cacheName,
                    operation: 'cache_not_found',
                });
            }
            return;
        }
        cache.clear();
        metrics.hits = 0;
        metrics.misses = 0;
        (0, logger_1.logCacheOperation)('clear', cacheName, '*');
    };
    CacheManager.prototype.getMetrics = function (cacheName) {
        return this.metrics.get(cacheName);
    };
    CacheManager.prototype.getAllMetrics = function () {
        var e_1, _a;
        var result = {};
        try {
            for (var _b = tslib_1.__values(this.metrics.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = tslib_1.__read(_c.value, 2), name = _d[0], metrics = _d[1];
                result[name] = tslib_1.__assign({}, metrics);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return result;
    };
    CacheManager.prototype.getCacheInfo = function (cacheName) {
        var _a;
        var cache = this.caches.get(cacheName);
        if (!cache) {
            return undefined;
        }
        return {
            size: cache.size,
            max: cache.max,
            ttl: (_a = cache.ttl) !== null && _a !== void 0 ? _a : 0,
        };
    };
    /**
     * Destroys all caches and clears all metrics.
     * This is important for proper cleanup of internal timers in lru-cache.
     */
    CacheManager.prototype.destroy = function () {
        var e_2, _a;
        try {
            for (var _b = tslib_1.__values(this.caches.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = tslib_1.__read(_c.value, 2), name = _d[0], cache = _d[1];
                // lru-cache v11+ has a destroy method that stops internal timers
                if (typeof cache.destroy === 'function') {
                    cache.destroy();
                }
                else {
                    cache.clear();
                }
                (0, logger_1.logCacheOperation)('destroy', name, '*');
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        this.caches.clear();
        this.metrics.clear();
    };
    return CacheManager;
}());
exports.CacheManager = CacheManager;
var TTL = {
    SHORT: 60 * 1000,
    MEDIUM: 5 * 60 * 1000,
    LONG: 30 * 60 * 1000,
};
exports.TTL = TTL;
var CACHE_SIZES = {
    SMALL: 100,
    MEDIUM: 500,
    LARGE: 1000,
};
exports.CACHE_SIZES = CACHE_SIZES;
var cacheManagerInstance = null;
function getCacheManager(logger) {
    if (!cacheManagerInstance) {
        cacheManagerInstance = new CacheManager(logger || null);
    }
    return cacheManagerInstance;
}
/**
 * Resets the cache manager singleton instance.
 * This should be called in test teardown to prevent resource leaks.
 */
function resetCacheManager() {
    if (cacheManagerInstance) {
        cacheManagerInstance.destroy();
        cacheManagerInstance = null;
    }
}
function initializeCaches(logger) {
    var manager = getCacheManager(logger);
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
