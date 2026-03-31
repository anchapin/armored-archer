"use strict";
/**
 * Structured Logger Module.
 * @fileoverview Provides structured logging for Nakama RPC handlers with JSON format.
 * Ensures all logs include: timestamp, level, message, and context.
 * Includes integration with log scrubbing for sensitive data protection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLogger = void 0;
exports.createRpcContext = createRpcContext;
exports.createSystemEventContext = createSystemEventContext;
exports.createStructuredLogger = createStructuredLogger;
var tslib_1 = require("tslib");
var logScrubber_1 = require("./logScrubber");
/**
 * Creates a structured metadata object for RPC operations.
 *
 * @param options - RPC context options
 * @returns Structured metadata object
 */
function createRpcContext(options) {
    var context = {
        rpcName: options.rpcName,
    };
    if (options.userId) {
        context.userId = options.userId;
    }
    if (options.requestId) {
        context.requestId = options.requestId;
    }
    if (options.payload) {
        context.payload =
            typeof options.payload === 'string' ? options.payload : JSON.stringify(options.payload);
    }
    return context;
}
/**
 * Creates a metadata object for system events.
 *
 * @param event - The event name
 * @param data - Additional event data
 * @returns Structured metadata object
 */
function createSystemEventContext(event, data) {
    if (data === void 0) { data = {}; }
    return tslib_1.__assign({ event: event }, data);
}
/**
 * Structured Logger class that wraps Nakama's Runtime.Logger
 * and outputs logs in JSON format with structured context.
 *
 * Features:
 * - JSON output format for easy parsing
 * - Consistent log structure: timestamp, level, message, context
 * - Automatic context enrichment
 * - Integration with Nakama's logging system
 */
var StructuredLogger = /** @class */ (function () {
    /**
     * Creates a new StructuredLogger instance.
     *
     * @param runtimeLogger - The Nakama Runtime.Logger instance
     * @param serviceName - Name of the service (default: 'armored-archer-backend')
     * @param defaultContext - Default context to include in all logs
     * @param scrubber - Optional LogScrubber instance (defaults to global instance)
     */
    function StructuredLogger(runtimeLogger, serviceName, defaultContext, scrubber) {
        if (serviceName === void 0) { serviceName = 'armored-archer-backend'; }
        if (defaultContext === void 0) { defaultContext = {}; }
        if (scrubber === void 0) { scrubber = logScrubber_1.logScrubber; }
        this.runtimeLogger = runtimeLogger;
        this.serviceName = serviceName;
        this.defaultContext = defaultContext;
        this.scrubber = scrubber;
    }
    /**
     * Creates a child logger with additional default context.
     *
     * @param additionalContext - Additional context to merge with default
     * @returns New StructuredLogger with enriched context
     */
    StructuredLogger.prototype.child = function (additionalContext) {
        return new StructuredLogger(this.runtimeLogger, this.serviceName, tslib_1.__assign(tslib_1.__assign({}, this.defaultContext), additionalContext), this.scrubber);
    };
    /**
     * Scrubs sensitive data from message and context.
     *
     * @param level - Log level for per-level scrubbing
     * @param message - Log message
     * @param context - Log context
     * @returns Scrubbed message and context
     */
    StructuredLogger.prototype.scrub = function (level, message, context) {
        if (!this.scrubber.isEnabled()) {
            return { message: message, context: context };
        }
        var scrubbed = this.scrubber.scrubLogByLevel(message, level, context);
        return {
            message: scrubbed.message,
            context: scrubbed.meta || context,
        };
    };
    /**
     * Formats a log entry as JSON string.
     *
     * @param level - Log level
     * @param message - Log message
     * @param context - Log context
     * @param error - Optional error for stack trace
     * @returns JSON string representation of the log entry
     */
    StructuredLogger.prototype.formatLogEntry = function (level, message, context, error) {
        // Scrub sensitive data before formatting
        var _a = this.scrub(level, message, context), scrubbedMessage = _a.message, scrubbedContext = _a.context;
        var entry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: scrubbedMessage,
            context: tslib_1.__assign(tslib_1.__assign({}, this.defaultContext), scrubbedContext),
            service: this.serviceName,
        };
        if (error) {
            entry.stack = error.stack;
        }
        return JSON.stringify(entry);
    };
    /**
     * Logs an info level message.
     *
     * @param message - Log message
     * @param context - Log context
     */
    StructuredLogger.prototype.info = function (message, context) {
        if (context === void 0) { context = {}; }
        var formattedLog = this.formatLogEntry('info', message, context);
        this.runtimeLogger.info(formattedLog);
    };
    /**
     * Logs a warn level message.
     *
     * @param message - Log message
     * @param context - Log context
     */
    StructuredLogger.prototype.warn = function (message, context) {
        if (context === void 0) { context = {}; }
        var formattedLog = this.formatLogEntry('warn', message, context);
        this.runtimeLogger.warn(formattedLog);
    };
    /**
     * Logs an error level message.
     *
     * @param message - Log message
     * @param context - Log context
     * @param error - Optional error object for stack trace
     */
    StructuredLogger.prototype.error = function (message, context, error) {
        if (context === void 0) { context = {}; }
        var formattedLog = this.formatLogEntry('error', message, context, error);
        this.runtimeLogger.error(formattedLog);
    };
    /**
     * Logs a debug level message.
     *
     * @param message - Log message
     * @param context - Log context
     */
    StructuredLogger.prototype.debug = function (message, context) {
        if (context === void 0) { context = {}; }
        var formattedLog = this.formatLogEntry('debug', message, context);
        this.runtimeLogger.debug(formattedLog);
    };
    /**
     * Logs an RPC entry event.
     * Should be called at the beginning of RPC handler execution.
     *
     * @param rpcName - Name of the RPC being executed
     * @param userId - User ID making the request
     * @param requestId - Unique request identifier
     * @param payload - Optional request payload
     */
    StructuredLogger.prototype.logRpcEntry = function (rpcName, userId, requestId, payload) {
        this.info('RPC entry', createRpcContext({ rpcName: rpcName, userId: userId, requestId: requestId, payload: payload }));
    };
    /**
     * Logs an RPC exit event.
     * Should be called after successful RPC handler completion.
     *
     * @param rpcName - Name of the RPC that completed
     * @param userId - User ID who made the request
     * @param requestId - Unique request identifier
     * @param durationMs - Time taken to execute the RPC in milliseconds
     */
    StructuredLogger.prototype.logRpcExit = function (rpcName, userId, requestId, durationMs) {
        this.info('RPC exit', {
            rpcName: rpcName,
            userId: userId,
            requestId: requestId,
            durationMs: durationMs,
            operation: 'rpc_exit',
        });
    };
    /**
     * Logs an RPC error event.
     * Should be called when an RPC handler throws an error.
     *
     * @param rpcName - Name of the RPC that errored
     * @param userId - User ID who made the request
     * @param requestId - Unique request identifier
     * @param error - The error that occurred
     * @param durationMs - Time taken before the error occurred
     */
    StructuredLogger.prototype.logRpcError = function (rpcName, userId, requestId, error, durationMs) {
        this.error('RPC error', {
            rpcName: rpcName,
            userId: userId,
            requestId: requestId,
            durationMs: durationMs,
            operation: 'rpc_error',
            errorMessage: error.message,
        }, error);
    };
    /**
     * Logs a system-level event.
     * Used for tracking system initialization, configuration changes, etc.
     *
     * @param level - Log level for the event
     * @param event - Event name
     * @param data - Additional event data
     */
    StructuredLogger.prototype.logSystemEvent = function (level, event, data) {
        if (data === void 0) { data = {}; }
        this[level]('System event', createSystemEventContext(event, data));
    };
    /**
     * Logs a cache operation for debugging and monitoring.
     *
     * @param operation - Cache operation (hit, miss, set, delete)
     * @param cacheName - Name of the cache
     * @param key - Cache key
     * @param metadata - Additional metadata
     */
    StructuredLogger.prototype.logCacheOperation = function (operation, cacheName, key, metadata) {
        this.debug("Cache ".concat(operation), tslib_1.__assign({ cacheName: cacheName, key: key, operation: "cache_".concat(operation) }, metadata));
    };
    /**
     * Logs database operation for debugging and monitoring.
     *
     * @operation - Database operation type
     * @param collection - Storage collection name
     * @param metadata - Additional metadata
     */
    StructuredLogger.prototype.logDatabaseOperation = function (operation, collection, metadata) {
        this.debug("Database ".concat(operation), tslib_1.__assign({ collection: collection, operation: "db_".concat(operation) }, metadata));
    };
    return StructuredLogger;
}());
exports.StructuredLogger = StructuredLogger;
/**
 * Creates a new StructuredLogger instance.
 *
 * @param runtimeLogger - The Nakama Runtime.Logger instance
 * @param serviceName - Name of the service
 * @param defaultContext - Default context to include in all logs
 * @param scrubber - Optional LogScrubber instance (defaults to global instance)
 * @returns A new StructuredLogger instance
 */
function createStructuredLogger(runtimeLogger, serviceName, defaultContext, scrubber) {
    if (serviceName === void 0) { serviceName = 'armored-archer-backend'; }
    if (defaultContext === void 0) { defaultContext = {}; }
    if (scrubber === void 0) { scrubber = logScrubber_1.logScrubber; }
    return new StructuredLogger(runtimeLogger, serviceName, defaultContext, scrubber);
}
