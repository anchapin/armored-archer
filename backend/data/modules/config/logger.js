"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createRpcMetadata = createRpcMetadata;
exports.createSystemEventMetadata = createSystemEventMetadata;
exports.logRpcEntry = logRpcEntry;
exports.logRpcExit = logRpcExit;
exports.logRpcError = logRpcError;
exports.logSystemEvent = logSystemEvent;
exports.logCacheOperation = logCacheOperation;
exports.logDatabaseOperation = logDatabaseOperation;
exports.captureRpcErrorWithContext = captureRpcErrorWithContext;
var tslib_1 = require("tslib");
var winston_1 = tslib_1.__importDefault(require("winston"));
var config_1 = require("../config");
var errorTracking_1 = require("./errorTracking");
var logScrubber_1 = require("./logScrubber");
/**
 * Initialize log scrubber with configuration from config.
 */
function initializeLogScrubber() {
    return new logScrubber_1.LogScrubber({
        enabled: config_1.config.logger.scrubLogs,
        additionalSensitiveFields: config_1.config.logger.additionalSensitiveFields,
        maxDepth: config_1.config.logger.maxScrubDepth,
    });
}
// Create the log scrubber instance with configuration
var logScrubberInstance = initializeLogScrubber();
/**
 * Custom format that scrubs sensitive data from log messages and metadata.
 */
var scrubFormat = winston_1.default.format(function (info) {
    var message = info.message, level = info.level, meta = tslib_1.__rest(info, ["message", "level"]);
    // Scrub the message if it's a string
    var scrubbedMessage = message;
    if (typeof message === 'string') {
        var scrubbed = logScrubberInstance.scrubLog(message, meta);
        scrubbedMessage = scrubbed.message;
    }
    // Scrub metadata
    var scrubbedMeta = meta;
    if (typeof meta === 'object' && meta !== null) {
        scrubbedMeta = logScrubberInstance.scrub(meta);
    }
    return tslib_1.__assign(tslib_1.__assign({}, scrubbedMeta), { level: level, message: scrubbedMessage });
});
/**
 * Log levels for the application.
 * Uses custom levels for more granular control in different environments.
 */
var logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};
/**
 * Color mappings for console output.
 */
var logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
};
winston_1.default.addColors(logColors);
/**
 * Creates a structured metadata object for RPC operations.
 *
 * @param options - RPC context options
 * @returns Structured metadata object
 */
function createRpcMetadata(options) {
    var metadata = {
        rpcName: options.rpcName,
    };
    if (options.userId) {
        metadata.userId = options.userId;
    }
    if (options.requestId) {
        metadata.requestId = options.requestId;
    }
    if (options.payload) {
        metadata.payload =
            typeof options.payload === 'string' ? options.payload : JSON.stringify(options.payload);
    }
    return metadata;
}
/**
 * Creates a metadata object for system events.
 *
 * @param event - The event name
 * @param data - Additional event data
 * @returns Structured metadata object
 */
function createSystemEventMetadata(event, data) {
    if (data === void 0) { data = {}; }
    return tslib_1.__assign({ event: event }, data);
}
/**
 * JSON format for structured logging.
 * Outputs logs in JSON format with consistent fields.
 * Includes log scrubbing to prevent sensitive data in logs.
 */
var jsonFormat = winston_1.default.format.combine(scrubFormat(), winston_1.default.format.timestamp({
    format: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
}), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json());
/**
 * Console format for human-readable output.
 * Includes colors and formatted output for development.
 * Includes log scrubbing to prevent sensitive data in logs.
 */
var consoleFormat = winston_1.default.format.combine(scrubFormat(), winston_1.default.format.colorize({ all: true }), winston_1.default.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
}), winston_1.default.format.printf(function (_a) {
    var timestamp = _a.timestamp, level = _a.level, message = _a.message, meta = tslib_1.__rest(_a, ["timestamp", "level", "message"]);
    // Build structured context string
    var contextParts = [];
    if (meta.requestId) {
        contextParts.push("req:".concat(meta.requestId));
    }
    if (meta.userId) {
        contextParts.push("user:".concat(meta.userId));
    }
    if (meta.rpcName) {
        contextParts.push("rpc:".concat(meta.rpcName));
    }
    if (meta.event) {
        contextParts.push("event:".concat(meta.event));
    }
    if (meta.operation) {
        contextParts.push("op:".concat(meta.operation));
    }
    var msg = "".concat(timestamp, " [").concat(level, "]: ").concat(message);
    if (contextParts.length > 0) {
        msg += " [".concat(contextParts.join(', '), "]");
    }
    if (Object.keys(meta).length > 0) {
        // Filter out fields already shown in context
        var filteredMeta = tslib_1.__assign({}, meta);
        delete filteredMeta.requestId;
        delete filteredMeta.userId;
        delete filteredMeta.rpcName;
        delete filteredMeta.event;
        delete filteredMeta.operation;
        if (Object.keys(filteredMeta).length > 0) {
            msg += " ".concat(JSON.stringify(filteredMeta));
        }
    }
    return msg;
}));
/**
 * Get the appropriate format based on configuration.
 */
function getFormat() {
    return config_1.config.logger.format === 'json' ? jsonFormat : consoleFormat;
}
var transports = [
    new winston_1.default.transports.Console({
        format: getFormat(),
    }),
];
if (config_1.config.logger.output === 'file' || process.env.LOG_FILE_PATH) {
    var logFilePath = process.env.LOG_FILE_PATH || './logs/app.log';
    transports.push(new winston_1.default.transports.File({
        filename: logFilePath,
        format: jsonFormat,
        level: 'debug',
    }), new winston_1.default.transports.File({
        filename: logFilePath.replace('.log', '.error.log'),
        level: 'error',
        format: jsonFormat,
    }));
}
/**
 * Winston logger instance configured for structured logging.
 *
 * Features:
 * - Configurable log levels via LOG_LEVEL env var
 * - JSON and console output formats
 * - File output support
 * - Custom log levels for granular control
 */
exports.logger = winston_1.default.createLogger({
    levels: logLevels,
    level: config_1.config.logger.level,
    format: jsonFormat,
    transports: transports,
    exitOnError: false,
    defaultMeta: {
        environment: config_1.config.environment,
        service: 'armored-archer-backend',
    },
});
/**
 * Logs an RPC entry event.
 * Should be called at the beginning of RPC handler execution.
 *
 * @param rpcName - Name of the RPC being executed
 * @param userId - User ID making the request
 * @param requestId - Unique request identifier
 * @param payload - Optional request payload
 */
function logRpcEntry(rpcName, userId, requestId, payload) {
    exports.logger.info('RPC entry', {
        rpc: rpcName,
        userId: userId,
        requestId: requestId,
        payload: payload
            ? typeof payload === 'string'
                ? payload
                : JSON.stringify(payload)
            : undefined,
        operation: 'rpc_entry',
    });
}
/**
 * Logs an RPC exit event.
 * Should be called after successful RPC handler completion.
 *
 * @param rpcName - Name of the RPC that completed
 * @param userId - User ID who made the request
 * @param requestId - Unique request identifier
 * @param durationMs - Time taken to execute the RPC in milliseconds
 */
function logRpcExit(rpcName, userId, requestId, durationMs) {
    exports.logger.info('RPC exit', {
        rpc: rpcName,
        userId: userId,
        requestId: requestId,
        durationMs: durationMs,
        operation: 'rpc_exit',
    });
}
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
function logRpcError(rpcName, userId, requestId, error, durationMs) {
    exports.logger.error('RPC error', {
        rpc: rpcName,
        userId: userId,
        requestId: requestId,
        durationMs: durationMs,
        error: error.message,
        stack: error.stack,
        operation: 'rpc_error',
    });
}
/**
 * Logs a system-level event.
 * Used for tracking system initialization, configuration changes, etc.
 *
 * @param level - Log level for the event
 * @param event - Event name
 * @param data - Additional event data
 */
function logSystemEvent(level, event, data) {
    if (data === void 0) { data = {}; }
    exports.logger[level]('System event', tslib_1.__assign(tslib_1.__assign({ event: event }, data), { operation: 'system_event' }));
}
/**
 * Logs a cache operation for debugging and monitoring.
 *
 * @param operation - Cache operation (hit, miss, set, delete)
 * @param cacheName - Name of the cache
 * @param key - Cache key
 * @param metadata - Additional metadata
 */
function logCacheOperation(operation, cacheName, key, metadata) {
    exports.logger.debug("Cache ".concat(operation), tslib_1.__assign({ cacheName: cacheName, key: key, operation: "cache_".concat(operation) }, metadata));
}
/**
 * Logs database operation for debugging and monitoring.
 *
 * @param operation - Database operation type
 * @param collection - Storage collection name
 * @param metadata - Additional metadata
 */
function logDatabaseOperation(operation, collection, metadata) {
    exports.logger.debug("Database ".concat(operation), tslib_1.__assign({ collection: collection, operation: "db_".concat(operation) }, metadata));
}
/**
 * Captures an RPC error with Sentry for error tracking.
 * This version supports extended context for better debugging.
 *
 * @param rpcName - Name of the RPC that errored
 * @param userId - User ID who made the request
 * @param requestId - Unique request identifier
 * @param error - The error that occurred
 * @param durationMs - Time taken before the error occurred
 * @param payload - Optional payload for debugging
 * @param sessionContext - Optional session context
 * @param gameStateContext - Optional game state context
 */
function captureRpcErrorWithContext(rpcName, userId, requestId, error, durationMs, payload, sessionContext, gameStateContext) {
    // Log the error locally
    logRpcError(rpcName, userId, requestId, error, durationMs);
    // Also send to Sentry with full context
    (0, errorTracking_1.captureRpcError)(rpcName, userId, error, payload, sessionContext, gameStateContext);
}
