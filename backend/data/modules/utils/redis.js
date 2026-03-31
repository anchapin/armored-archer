"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
exports.getRedis = getRedis;
exports.closeRedisConnection = closeRedisConnection;
exports.closeRedis = closeRedis;
var tslib_1 = require("tslib");
var ioredis_1 = tslib_1.__importDefault(require("ioredis"));
var config_1 = require("../config");
var redisClient = null;
/**
 * Gets or initializes the Redis client.
 * Returns null if Redis is not enabled or fails to connect.
 *
 * @param logger - Optional Nakama logger
 * @returns Redis client or null
 */
function getRedisClient(logger) {
    if (!config_1.config.redis.enabled) {
        return null;
    }
    if (redisClient) {
        return redisClient;
    }
    try {
        redisClient = new ioredis_1.default({
            host: config_1.config.redis.host,
            port: config_1.config.redis.port,
            password: config_1.config.redis.password,
            db: config_1.config.redis.db,
            retryStrategy: function (times) {
                var delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
        });
        redisClient.on('error', function (err) {
            if (logger) {
                logger.error('Redis error: %s', err.message);
            }
            else {
                // Fallback to basic logging when no logger provided
                // In Nakama runtime, this will use the default logger
                var defaultLogger = {
                    error: function (msg) {
                        var args = [];
                        for (var _i = 1; _i < arguments.length; _i++) {
                            args[_i - 1] = arguments[_i];
                        }
                        // eslint-disable-next-line no-console
                        console.error.apply(console, tslib_1.__spreadArray([msg], tslib_1.__read(args), false));
                    },
                    warn: function (msg) {
                        var args = [];
                        for (var _i = 1; _i < arguments.length; _i++) {
                            args[_i - 1] = arguments[_i];
                        }
                        // eslint-disable-next-line no-console
                        console.warn.apply(console, tslib_1.__spreadArray([msg], tslib_1.__read(args), false));
                    },
                    info: function (msg) {
                        var args = [];
                        for (var _i = 1; _i < arguments.length; _i++) {
                            args[_i - 1] = arguments[_i];
                        }
                        // eslint-disable-next-line no-console
                        console.info.apply(console, tslib_1.__spreadArray([msg], tslib_1.__read(args), false));
                    },
                    debug: function (msg) {
                        var args = [];
                        for (var _i = 1; _i < arguments.length; _i++) {
                            args[_i - 1] = arguments[_i];
                        }
                        // eslint-disable-next-line no-console
                        console.debug.apply(console, tslib_1.__spreadArray([msg], tslib_1.__read(args), false));
                    },
                };
                defaultLogger.error('Redis error: %s', err.message);
            }
        });
        redisClient.on('connect', function () {
            if (logger) {
                logger.info('Connected to Redis');
            }
        });
        return redisClient;
    }
    catch (error) {
        if (logger) {
            logger.error('Failed to initialize Redis client: %s', error);
        }
        return null;
    }
}
/**
 * Legacy alias for getRedisClient.
 */
function getRedis(logger) {
    return getRedisClient(logger);
}
/**
 * Close the Redis connection.
 */
function closeRedisConnection() {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!redisClient) return [3 /*break*/, 2];
                    return [4 /*yield*/, redisClient.quit()];
                case 1:
                    _a.sent();
                    redisClient = null;
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
/**
 * Legacy alias for closeRedisConnection.
 */
function closeRedis() {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, closeRedisConnection()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
