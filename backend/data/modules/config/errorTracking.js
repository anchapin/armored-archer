"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorTrackingConfig = void 0;
exports.initializeSentry = initializeSentry;
exports.setSessionContext = setSessionContext;
exports.setGameStateContext = setGameStateContext;
exports.clearContext = clearContext;
exports.setRequestContext = setRequestContext;
exports.captureException = captureException;
exports.captureMessage = captureMessage;
exports.captureRpcError = captureRpcError;
exports.createErrorBoundary = createErrorBoundary;
exports.withErrorTracking = withErrorTracking;
exports.captureDatabaseError = captureDatabaseError;
exports.captureCacheError = captureCacheError;
var tslib_1 = require("tslib");
var Sentry = tslib_1.__importStar(require("@sentry/node"));
var config_1 = require("../config");
var logger_1 = require("./logger");
exports.errorTrackingConfig = {
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.NODE_ENV || config_1.config.environment,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
    enabled: process.env.SENTRY_ENABLED === 'true' || config_1.config.environment === 'production',
    includeGameState: process.env.SENTRY_INCLUDE_GAME_STATE !== 'false',
    includeSessionContext: process.env.SENTRY_INCLUDE_SESSION_CONTEXT !== 'false',
};
function initializeSentry() {
    if (!exports.errorTrackingConfig.enabled || !exports.errorTrackingConfig.dsn) {
        logger_1.logger.info('Sentry is disabled - missing DSN or disabled by config');
        return;
    }
    Sentry.init({
        dsn: exports.errorTrackingConfig.dsn,
        environment: exports.errorTrackingConfig.environment,
        tracesSampleRate: exports.errorTrackingConfig.tracesSampleRate,
        beforeSend: function (event, _hint) {
            // Remove sensitive headers for privacy
            if (event.request) {
                event.request.headers = undefined;
            }
            // Add environment tag
            if (!event.tags) {
                event.tags = {};
            }
            event.tags.environment = exports.errorTrackingConfig.environment;
            return event;
        },
        // Add release information if available
        release: process.env.APP_VERSION || 'unknown',
    });
    logger_1.logger.info("Sentry initialized in ".concat(exports.errorTrackingConfig.environment, " environment"));
}
/**
 * Sets persistent context for a user session.
 * This context will be included in all subsequent error events for this scope.
 *
 * @param context - The session context to set
 */
function setSessionContext(context) {
    if (!exports.errorTrackingConfig.enabled) {
        return;
    }
    Sentry.setContext('session', {
        userId: context.userId,
        username: context.username,
        sessionId: context.sessionId,
        ipAddress: context.ipAddress,
        platform: context.platform,
        appVersion: context.appVersion,
        connectionType: context.connectionType,
        serverRegion: context.serverRegion,
    });
    // Also set user in Sentry's built-in user context
    Sentry.setUser({
        id: context.userId,
        username: context.username,
        ip_address: context.ipAddress,
    });
}
/**
 * Sets game state context for error tracking.
 * This provides debugging information about player state at time of error.
 *
 * @param gameState - The game state context to set
 */
function setGameStateContext(gameState) {
    if (!exports.errorTrackingConfig.enabled || !exports.errorTrackingConfig.includeGameState) {
        return;
    }
    Sentry.setContext('gameState', {
        playerId: gameState.playerId,
        level: gameState.level,
        xp: gameState.xp,
        health: gameState.health,
        maxHealth: gameState.maxHealth,
        mana: gameState.mana,
        maxMana: gameState.maxMana,
        gold: gameState.gold,
        gems: gameState.gems,
        currentMatchId: gameState.currentMatchId,
        matchState: gameState.matchState,
        seasonId: gameState.seasonId,
        inventorySize: gameState.inventorySize,
        equippedItems: gameState.equippedItems,
        stats: gameState.stats,
    });
}
/**
 * Clears all custom context.
 * Use this to prevent context leakage between requests.
 */
function clearContext() {
    if (!exports.errorTrackingConfig.enabled) {
        return;
    }
    Sentry.setContext('session', {});
    Sentry.setContext('gameState', {});
    Sentry.setContext('request', {});
    Sentry.setUser(null);
}
/**
 * Sets request context for error tracking.
 *
 * @param request - The request context to set
 */
function setRequestContext(request) {
    if (!exports.errorTrackingConfig.enabled) {
        return;
    }
    Sentry.setContext('request', {
        rpcName: request.rpcName,
        requestId: request.requestId,
        method: request.method,
        payload: request.payload,
        serverRegion: request.serverRegion,
    });
}
/**
 * Captures an exception with extended context information.
 *
 * @param error - The error to capture
 * @param context - Extended context with user, game state, and request info
 */
function captureException(error, context) {
    var _a;
    if (context === void 0) { context = {}; }
    if (!exports.errorTrackingConfig.enabled) {
        return;
    }
    var tags = {};
    if (context.userId) {
        tags.userId = context.userId;
    }
    if (context.rpc) {
        tags.rpc = context.rpc;
    }
    var extra = tslib_1.__assign(tslib_1.__assign({}, context.extra), { timestamp: new Date().toISOString() });
    // Add game state if provided
    if (context.gameState && exports.errorTrackingConfig.includeGameState) {
        extra.gameState = context.gameState;
    }
    // Add request info if provided
    if (context.request) {
        extra.request = {
            rpcName: context.request.rpcName,
            requestId: context.request.requestId,
            payload: context.request.payload,
        };
    }
    Sentry.captureException(error, {
        tags: tags,
        extra: extra,
        // Ensure user context is set
        user: ((_a = context.user) === null || _a === void 0 ? void 0 : _a.userId)
            ? {
                id: context.user.userId,
                username: context.user.username,
            }
            : undefined,
    });
}
/**
 * Captures a message with extended context information.
 *
 * @param message - The message to capture
 * @param level - Severity level
 * @param context - Extended context with user, game state, and request info
 */
function captureMessage(message, level, context) {
    var _a;
    if (level === void 0) { level = 'info'; }
    if (context === void 0) { context = {}; }
    if (!exports.errorTrackingConfig.enabled) {
        return;
    }
    var tags = {};
    if (context.userId) {
        tags.userId = context.userId;
    }
    if (context.rpc) {
        tags.rpc = context.rpc;
    }
    var extra = tslib_1.__assign(tslib_1.__assign({}, context.extra), { timestamp: new Date().toISOString() });
    // Add game state if provided
    if (context.gameState && exports.errorTrackingConfig.includeGameState) {
        extra.gameState = context.gameState;
    }
    // Add request info if provided
    if (context.request) {
        extra.request = {
            rpcName: context.request.rpcName,
            requestId: context.request.requestId,
            payload: context.request.payload,
        };
    }
    Sentry.captureMessage(message, {
        level: level,
        tags: tags,
        extra: extra,
        user: ((_a = context.user) === null || _a === void 0 ? void 0 : _a.userId)
            ? {
                id: context.user.userId,
                username: context.user.username,
            }
            : undefined,
    });
}
/**
 * Captures an RPC error with full context.
 * This is the recommended way to capture RPC errors.
 *
 * @param rpcName - Name of the RPC
 * @param userId - User ID making the request
 * @param error - The error that occurred
 * @param payload - Optional payload for debugging
 * @param sessionContext - Optional session context
 * @param gameStateContext - Optional game state context
 */
function captureRpcError(rpcName, userId, error, payload, sessionContext, gameStateContext) {
    if (!exports.errorTrackingConfig.enabled) {
        return;
    }
    var tags = {
        rpc: rpcName,
    };
    if (userId) {
        tags.userId = userId;
    }
    var extra = {
        timestamp: new Date().toISOString(),
    };
    if (payload) {
        extra.payload = payload;
    }
    // Set contexts if provided
    if (sessionContext) {
        Sentry.setContext('session', {
            userId: sessionContext.userId,
            username: sessionContext.username,
            sessionId: sessionContext.sessionId,
            platform: sessionContext.platform,
            appVersion: sessionContext.appVersion,
        });
        Sentry.setUser({
            id: sessionContext.userId,
            username: sessionContext.username,
        });
    }
    if (gameStateContext && exports.errorTrackingConfig.includeGameState) {
        Sentry.setContext('gameState', gameStateContext);
        extra.gameState = gameStateContext;
    }
    Sentry.captureException(error, {
        tags: tags,
        extra: extra,
    });
    // Clear context after capturing to prevent leakage
    clearContext();
}
/**
 * Creates an error boundary for wrapping async operations.
 * Catches errors and sends them to Sentry with proper context.
 *
 * @param context - Error context to include
 * @returns Object with safeExecute method
 */
function createErrorBoundary(context) {
    return {
        /**
         * Executes a function and captures any errors that occur.
         * @param fn - The function to execute
         * @returns The result of the function, or undefined if error
         */
        safeExecute: function (fn) {
            return tslib_1.__awaiter(this, void 0, void 0, function () {
                var error_1;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, fn()];
                        case 1: return [2 /*return*/, _a.sent()];
                        case 2:
                            error_1 = _a.sent();
                            captureException(error_1, context);
                            return [2 /*return*/, undefined];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        },
        /**
         * Executes a synchronous function and captures any errors that occur.
         * @param fn - The function to execute
         * @returns The result of the function, or undefined if error
         */
        safeExecuteSync: function (fn) {
            try {
                return fn();
            }
            catch (error) {
                captureException(error, context);
                return undefined;
            }
        },
    };
}
/**
 * Higher-order function that wraps an async function with error tracking.
 *
 * @param fn - The function to wrap
 * @param context - Error context to include
 * @returns Wrapped function that captures errors
 */
function withErrorTracking(fn, context) {
    var _this = this;
    return (function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var error_2;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fn.apply(void 0, tslib_1.__spreadArray([], tslib_1.__read(args), false))];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_2 = _a.sent();
                        captureException(error_2, tslib_1.__assign(tslib_1.__assign({}, context), { extra: tslib_1.__assign(tslib_1.__assign({}, context.extra), { functionArgs: JSON.stringify(args) }) }));
                        throw error_2;
                    case 3: return [2 /*return*/];
                }
            });
        });
    });
}
/**
 * Captures database operation errors with context.
 *
 * @param operation - The database operation (read, write, delete, etc.)
 * @param collection - The collection being operated on
 * @param error - The error that occurred
 * @param context - Additional context
 */
function captureDatabaseError(operation, collection, error, context) {
    if (context === void 0) { context = {}; }
    captureException(error, tslib_1.__assign(tslib_1.__assign({}, context), { extra: tslib_1.__assign(tslib_1.__assign({}, context.extra), { databaseOperation: operation, collection: collection, timestamp: new Date().toISOString() }) }));
}
/**
 * Captures cache operation errors with context.
 *
 * @param operation - The cache operation (get, set, delete, etc.)
 * @param cacheName - The name of the cache
 * @param key - The cache key
 * @param error - The error that occurred
 * @param context - Additional context
 */
function captureCacheError(operation, cacheName, key, error, context) {
    if (context === void 0) { context = {}; }
    captureException(error, tslib_1.__assign(tslib_1.__assign({}, context), { extra: tslib_1.__assign(tslib_1.__assign({}, context.extra), { cacheOperation: operation, cacheName: cacheName, cacheKey: key, timestamp: new Date().toISOString() }) }));
}
