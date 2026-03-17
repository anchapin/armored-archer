"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setMetricsCallbacks = setMetricsCallbacks;
exports.setEndpointRateLimit = setEndpointRateLimit;
exports.getEndpointRateLimit = getEndpointRateLimit;
exports.checkRateLimit = checkRateLimit;
exports.logRateLimitViolation = logRateLimitViolation;
exports.resetUserRateLimit = resetUserRateLimit;
exports.cleanupExpiredEntries = cleanupExpiredEntries;
exports.getRateLimitStats = getRateLimitStats;
exports.createRateLimitedRpcHandler = createRateLimitedRpcHandler;
var tslib_1 = require("tslib");
var logger_1 = require("../config/logger");
var recordRateLimitViolation = function () { };
var updateActiveUsersCount = function () { };
function setMetricsCallbacks(recordViolation, updateUsers) {
    recordRateLimitViolation = recordViolation;
    updateActiveUsersCount = updateUsers;
}
var rateLimitStore = new Map();
var defaultConfig = {
    maxRequests: 100,
    windowMs: 60000,
};
var endpointConfigs = new Map();
function getKey(userId, endpoint) {
    return "".concat(userId, ":").concat(endpoint);
}
function getCurrentWindowResetTime(windowMs) {
    return Date.now() + windowMs;
}
function setEndpointRateLimit(endpoint, config) {
    endpointConfigs.set(endpoint, config);
}
function getEndpointRateLimit(endpoint) {
    return endpointConfigs.get(endpoint) || defaultConfig;
}
function checkRateLimit(userId, endpoint) {
    var config = getEndpointRateLimit(endpoint);
    var key = getKey(userId, endpoint);
    var now = Date.now();
    var state = rateLimitStore.get(key);
    if (!state || now >= state.resetTime) {
        state = {
            count: 0,
            resetTime: getCurrentWindowResetTime(config.windowMs),
        };
        rateLimitStore.set(key, state);
    }
    var remaining = Math.max(0, config.maxRequests - state.count);
    if (state.count >= config.maxRequests) {
        var retryAfter = Math.ceil((state.resetTime - now) / 1000);
        return {
            allowed: false,
            remaining: 0,
            resetTime: state.resetTime,
            retryAfter: retryAfter,
        };
    }
    state.count++;
    return {
        allowed: true,
        remaining: remaining - 1,
        resetTime: state.resetTime,
    };
}
function logRateLimitViolation(endpoint, userId, retryAfter) {
    logger_1.logger.warn('Rate limit violation', {
        endpoint: endpoint,
        userId: userId,
        retryAfter: retryAfter,
        timestamp: Date.now(),
    });
    recordRateLimitViolation(endpoint);
}
function resetUserRateLimit(userId, endpoint) {
    var key = getKey(userId, endpoint);
    rateLimitStore.delete(key);
}
function cleanupExpiredEntries() {
    var now = Date.now();
    var entriesToDelete = [];
    rateLimitStore.forEach(function (state, key) {
        if (now >= state.resetTime) {
            entriesToDelete.push(key);
        }
    });
    entriesToDelete.forEach(function (key) { return rateLimitStore.delete(key); });
    updateActiveUsersCount(rateLimitStore.size);
}
setInterval(cleanupExpiredEntries, 60000);
function getRateLimitStats() {
    var endpointStats = new Map();
    rateLimitStore.forEach(function (_, key) {
        var _a = tslib_1.__read(key.split(':'), 2), endpoint = _a[1];
        var userId = key.split(':')[0];
        if (!endpointStats.has(endpoint)) {
            endpointStats.set(endpoint, new Set());
        }
        endpointStats.get(endpoint).add(userId);
    });
    return {
        totalEntries: rateLimitStore.size,
        endpoints: Array.from(endpointStats.entries()).map(function (_a) {
            var _b = tslib_1.__read(_a, 2), endpoint = _b[0], users = _b[1];
            return ({
                endpoint: endpoint,
                activeUsers: users.size,
            });
        }),
    };
}
function createRateLimitedRpcHandler(endpoint, handler) {
    return function (ctx, loggerParam, nk, payload) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var userId, rateLimitResult;
            return tslib_1.__generator(this, function (_a) {
                userId = ctx.userId || 'anonymous';
                rateLimitResult = checkRateLimit(userId, endpoint);
                if (!rateLimitResult.allowed) {
                    logRateLimitViolation(endpoint, userId, rateLimitResult.retryAfter || 0);
                    return [2 /*return*/, JSON.stringify({
                            success: false,
                            error: {
                                code: 'RATE_LIMIT_EXCEEDED',
                                message: 'Rate limit exceeded. Please try again later.',
                                retryAfter: rateLimitResult.retryAfter,
                                resetTime: rateLimitResult.resetTime,
                            },
                        })];
                }
                return [2 /*return*/, handler(ctx, loggerParam, nk, payload)];
            });
        });
    };
}
