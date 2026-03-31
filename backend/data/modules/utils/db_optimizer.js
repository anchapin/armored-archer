"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchGetPlayerStats = batchGetPlayerStats;
exports.getPlayerStatsWithCache = getPlayerStatsWithCache;
exports.invalidatePlayerStatsCache = invalidatePlayerStatsCache;
var tslib_1 = require("tslib");
var cache_1 = require("./cache");
var safeParse_1 = require("./safeParse");
function batchGetPlayerStats(nk, userIds, logger) {
    var e_1, _a, e_2, _b, e_3, _c;
    var cacheManager = (0, cache_1.getCacheManager)(logger);
    var result = new Map();
    var uncachedUserIds = [];
    try {
        for (var userIds_1 = tslib_1.__values(userIds), userIds_1_1 = userIds_1.next(); !userIds_1_1.done; userIds_1_1 = userIds_1.next()) {
            var userId = userIds_1_1.value;
            var cachedStats = cacheManager.get('player_stats', userId);
            if (cachedStats !== undefined) {
                result.set(userId, cachedStats);
            }
            else {
                uncachedUserIds.push(userId);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (userIds_1_1 && !userIds_1_1.done && (_a = userIds_1.return)) _a.call(userIds_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    if (uncachedUserIds.length > 0) {
        var readRequests = uncachedUserIds.map(function (userId) { return ({
            collection: 'player_stats',
            key: userId,
            userId: userId,
        }); });
        var objects = nk.storageRead(readRequests);
        try {
            for (var objects_1 = tslib_1.__values(objects), objects_1_1 = objects_1.next(); !objects_1_1.done; objects_1_1 = objects_1.next()) {
                var obj = objects_1_1.value;
                if (obj.value) {
                    var parseResult = (0, safeParse_1.safeParse)(obj.value, null, logger, 'player_stats');
                    if (parseResult.success && parseResult.data) {
                        var stats = parseResult.data;
                        result.set(obj.userId, stats);
                        cacheManager.set('player_stats', obj.userId, stats);
                    }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (objects_1_1 && !objects_1_1.done && (_b = objects_1.return)) _b.call(objects_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        try {
            for (var uncachedUserIds_1 = tslib_1.__values(uncachedUserIds), uncachedUserIds_1_1 = uncachedUserIds_1.next(); !uncachedUserIds_1_1.done; uncachedUserIds_1_1 = uncachedUserIds_1.next()) {
                var userId = uncachedUserIds_1_1.value;
                if (!result.has(userId)) {
                    var defaultStats = {
                        user_id: userId,
                        level: 1,
                        xp: 0,
                        ability_points: 0,
                        stats: {
                            attack: 10,
                            defense: 10,
                            dodge: 10,
                            crit_rate: 5,
                        },
                    };
                    result.set(userId, defaultStats);
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (uncachedUserIds_1_1 && !uncachedUserIds_1_1.done && (_c = uncachedUserIds_1.return)) _c.call(uncachedUserIds_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
    }
    return result;
}
function getPlayerStatsWithCache(nk, userId, logger) {
    var cacheManager = (0, cache_1.getCacheManager)(logger);
    var cachedStats = cacheManager.get('player_stats', userId);
    if (cachedStats !== undefined) {
        return cachedStats;
    }
    var objects = nk.storageRead([
        {
            collection: 'player_stats',
            key: userId,
            userId: userId,
        },
    ]);
    if (objects.length > 0 && objects[0].value) {
        var parseResult = (0, safeParse_1.safeParse)(objects[0].value, null, logger, 'player_stats');
        if (parseResult.success && parseResult.data) {
            var stats = parseResult.data;
            cacheManager.set('player_stats', userId, stats);
            return stats;
        }
    }
    var defaultStats = {
        user_id: userId,
        level: 1,
        xp: 0,
        ability_points: 0,
        stats: {
            attack: 10,
            defense: 10,
            dodge: 10,
            crit_rate: 5,
        },
    };
    cacheManager.set('player_stats', userId, defaultStats);
    return defaultStats;
}
function invalidatePlayerStatsCache(userId, logger) {
    var cacheManager = (0, cache_1.getCacheManager)(logger);
    cacheManager.delete('player_stats', userId);
}
