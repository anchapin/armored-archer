"use strict";
/**
 * Log Scrubbing Module
 *
 * Provides functionality to scrub sensitive data from log messages before they are written.
 * This prevents sensitive information such as passwords, tokens, and personal identifiable
 * information (PII) from being exposed in logs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logScrubber = exports.LogScrubber = exports.defaultLogScrubberConfig = void 0;
exports.scrubSensitiveData = scrubSensitiveData;
var tslib_1 = require("tslib");
/**
 * Default sensitive field names that should be scrubbed.
 * These field names are checked case-insensitively.
 */
var DEFAULT_SENSITIVE_FIELDS = [
    'password',
    'passwd',
    'secret',
    'token',
    'access_token',
    'refresh_token',
    'api_key',
    'apikey',
    'private_key',
    'auth',
    'authorization',
    'credential',
    'ssn',
    'social_security',
    'credit_card',
    'card_number',
    'cvv',
    'pin',
    'session_id',
    'session_token',
];
/**
 * Regular expressions for detecting sensitive data patterns.
 */
var SENSITIVE_PATTERNS = [
    // JWT tokens
    {
        pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
        replacement: '[JWT_REDACTED]',
    },
    // AWS access keys
    {
        pattern: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
        replacement: '[AWS_KEY_REDACTED]',
    },
    // Generic API keys (high entropy strings)
    {
        pattern: /api[_-]?key["']?\s*[:=]\s*["']?([a-zA-Z0-9_-]{20,})["']?/gi,
        replacement: 'api_key=[API_KEY_REDACTED]',
    },
    // Passwords in URLs or config
    {
        pattern: /(?:password|passwd|pwd)["']?\s*[:=]\s*["']?([^"'\s,}]+)["']?/gi,
        replacement: 'password=[PASSWORD_REDACTED]',
    },
    // Bearer tokens
    {
        pattern: /Bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]*/g,
        replacement: 'Bearer [TOKEN_REDACTED]',
    },
    // Base64 encoded secrets (common in configs)
    {
        pattern: /["'](?:secret|token|key)["']\s*[:=]\s*["']([A-Za-z0-9+/=]{32,})["']/g,
        replacement: '"secret":"[SECRET_REDACTED]"',
    },
    // Credit card numbers (basic pattern)
    {
        pattern: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
        replacement: '[CREDIT_CARD_REDACTED]',
    },
    // Social Security Number pattern
    {
        pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
        replacement: '[SSN_REDACTED]',
    },
    // Private keys (PEM format)
    {
        pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
        replacement: '[PRIVATE_KEY_REDACTED]',
    },
    // Google API keys
    {
        pattern: /AIza[0-9A-Za-z_-]{20,}/g,
        replacement: '[GOOGLE_API_KEY_REDACTED]',
    },
    // Stripe API keys
    {
        pattern: /(?:sk|pk)_(?:live|test)_[0-9a-zA-Z]{24,}/g,
        replacement: '[STRIPE_KEY_REDACTED]',
    },
    // GitHub tokens
    {
        pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g,
        replacement: '[GITHUB_TOKEN_REDACTED]',
    },
    // Connection strings with credentials (e.g., PostgreSQL, MySQL, MongoDB)
    {
        pattern: /(?:mongodb(?:\+srv)?|mysql|postgresql|redis):\/\/[^:]+:[^@]+@/gi,
        replacement: '[CONNECTION_STRING_REDACTED]://[user]:[password]@',
    },
    // Basic Auth credentials in URLs
    {
        pattern: /:\/\/[^:]+:[^@]+@/g,
        replacement: '://[credentials_redacted]@',
    },
    // Slack tokens
    {
        pattern: /xox[baprs]-[0-9a-zA-Z-]+/g,
        replacement: '[SLACK_TOKEN_REDACTED]',
    },
    // Azure access tokens
    {
        pattern: /(?:<|eyJ[A-Za-z0-9+/=]*\.)[A-Za-z0-9+/=]{20,}/g,
        replacement: '[AZURE_TOKEN_REDACTED]',
    },
    // Generic secret patterns in JSON
    {
        pattern: /"(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret[_-]?key)["']\s*:\s*"[^"]+"/gi,
        replacement: '"[KEY]_redacted": "[REDACTED]"',
    },
];
/**
 * Default configuration for log scrubbing.
 */
exports.defaultLogScrubberConfig = {
    enabled: true,
    additionalSensitiveFields: [],
    excludedFields: [],
    customPatterns: [],
    maxDepth: 10,
    scrubKeys: true,
};
/**
 * Combines default sensitive fields with custom additions.
 *
 * @param additionalFields - Additional field names to treat as sensitive
 * @param excludedFields - Field names to exclude from scrubbing
 * @returns Set of lowercase sensitive field names
 */
function buildSensitiveFieldSet(additionalFields, excludedFields) {
    var e_1, _a, e_2, _b;
    if (additionalFields === void 0) { additionalFields = []; }
    if (excludedFields === void 0) { excludedFields = []; }
    var excludedSet = new Set(excludedFields.map(function (f) { return f.toLowerCase(); }));
    var fields = new Set();
    try {
        for (var DEFAULT_SENSITIVE_FIELDS_1 = tslib_1.__values(DEFAULT_SENSITIVE_FIELDS), DEFAULT_SENSITIVE_FIELDS_1_1 = DEFAULT_SENSITIVE_FIELDS_1.next(); !DEFAULT_SENSITIVE_FIELDS_1_1.done; DEFAULT_SENSITIVE_FIELDS_1_1 = DEFAULT_SENSITIVE_FIELDS_1.next()) {
            var field = DEFAULT_SENSITIVE_FIELDS_1_1.value;
            if (!excludedSet.has(field.toLowerCase())) {
                fields.add(field.toLowerCase());
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (DEFAULT_SENSITIVE_FIELDS_1_1 && !DEFAULT_SENSITIVE_FIELDS_1_1.done && (_a = DEFAULT_SENSITIVE_FIELDS_1.return)) _a.call(DEFAULT_SENSITIVE_FIELDS_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    try {
        for (var additionalFields_1 = tslib_1.__values(additionalFields), additionalFields_1_1 = additionalFields_1.next(); !additionalFields_1_1.done; additionalFields_1_1 = additionalFields_1.next()) {
            var field = additionalFields_1_1.value;
            if (!excludedSet.has(field.toLowerCase())) {
                fields.add(field.toLowerCase());
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (additionalFields_1_1 && !additionalFields_1_1.done && (_b = additionalFields_1.return)) _b.call(additionalFields_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return fields;
}
/**
 * Checks if a key should be treated as sensitive.
 *
 * @param key - The key to check
 * @param sensitiveFields - Set of sensitive field names
 * @returns Whether the key is sensitive
 */
function isSensitiveKey(key, sensitiveFields) {
    var lowerKey = key.toLowerCase();
    return sensitiveFields.has(lowerKey);
}
/**
 * Recursively scrubs sensitive data from an object.
 *
 * @param obj - The object to scrub
 * @param sensitiveFields - Set of sensitive field names
 * @param currentDepth - Current recursion depth
 * @param maxDepth - Maximum recursion depth
 * @param scrubKeys - Whether to scrub keys
 * @returns Scrubbed object
 */
function scrubObject(obj, sensitiveFields, currentDepth, maxDepth, scrubKeys) {
    var e_3, _a;
    if (currentDepth > maxDepth) {
        return '[MAX_DEPTH_REACHED]';
    }
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'string') {
        return scrubString(obj);
    }
    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(function (item) {
            return scrubObject(item, sensitiveFields, currentDepth + 1, maxDepth, scrubKeys);
        });
    }
    if (typeof obj === 'object') {
        var result = {};
        try {
            for (var _b = tslib_1.__values(Object.entries(obj)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = tslib_1.__read(_c.value, 2), key = _d[0], value = _d[1];
                var shouldScrub = isSensitiveKey(key, sensitiveFields);
                var newKey = key;
                if (scrubKeys && shouldScrub) {
                    newKey = "[REDACTED_".concat(key.toUpperCase(), "]");
                }
                result[newKey] = shouldScrub
                    ? '[REDACTED]'
                    : scrubObject(value, sensitiveFields, currentDepth + 1, maxDepth, scrubKeys);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return result;
    }
    return obj;
}
/**
 * Scrubs sensitive patterns from a string.
 *
 * @param input - The string to scrub
 * @returns Scrubbed string
 */
function scrubString(input) {
    var e_4, _a;
    var result = input;
    try {
        for (var SENSITIVE_PATTERNS_1 = tslib_1.__values(SENSITIVE_PATTERNS), SENSITIVE_PATTERNS_1_1 = SENSITIVE_PATTERNS_1.next(); !SENSITIVE_PATTERNS_1_1.done; SENSITIVE_PATTERNS_1_1 = SENSITIVE_PATTERNS_1.next()) {
            var _b = SENSITIVE_PATTERNS_1_1.value, pattern = _b.pattern, replacement = _b.replacement;
            result = result.replace(pattern, replacement);
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (SENSITIVE_PATTERNS_1_1 && !SENSITIVE_PATTERNS_1_1.done && (_a = SENSITIVE_PATTERNS_1.return)) _a.call(SENSITIVE_PATTERNS_1);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return result;
}
/**
 * Log scrubber class that provides methods to scrub sensitive data from logs.
 */
var LogScrubber = /** @class */ (function () {
    /**
     * Creates a new LogScrubber instance.
     *
     * @param config - Configuration options for log scrubbing
     */
    function LogScrubber(config) {
        if (config === void 0) { config = {}; }
        this.config = tslib_1.__assign(tslib_1.__assign({}, exports.defaultLogScrubberConfig), config);
        this.sensitiveFields = buildSensitiveFieldSet(this.config.additionalSensitiveFields, this.config.excludedFields);
    }
    /**
     * Updates the scrubber configuration.
     *
     * @param config - New configuration options
     */
    LogScrubber.prototype.updateConfig = function (config) {
        this.config = tslib_1.__assign(tslib_1.__assign({}, this.config), config);
        if (config.additionalSensitiveFields || config.excludedFields) {
            this.sensitiveFields = buildSensitiveFieldSet(this.config.additionalSensitiveFields, this.config.excludedFields);
        }
    };
    /**
     * Gets the current configuration.
     *
     * @returns Current configuration
     */
    LogScrubber.prototype.getConfig = function () {
        return tslib_1.__assign({}, this.config);
    };
    /**
     * Checks if scrubbing is enabled.
     *
     * @returns Whether scrubbing is enabled
     */
    LogScrubber.prototype.isEnabled = function () {
        return this.config.enabled;
    };
    /**
     * Enables log scrubbing.
     */
    LogScrubber.prototype.enable = function () {
        this.config.enabled = true;
    };
    /**
     * Disables log scrubbing.
     */
    LogScrubber.prototype.disable = function () {
        this.config.enabled = false;
    };
    /**
     * Scrubs sensitive data from a value.
     *
     * @param value - The value to scrub (string, object, array, etc.)
     * @returns Scrubbed value
     */
    LogScrubber.prototype.scrub = function (value) {
        var _a;
        if (!this.config.enabled) {
            return value;
        }
        if (typeof value === 'string') {
            return scrubString(value);
        }
        if (typeof value === 'object' && value !== null) {
            return scrubObject(value, this.sensitiveFields, 0, (_a = this.config.maxDepth) !== null && _a !== void 0 ? _a : 10, this.config.scrubKeys);
        }
        return value;
    };
    /**
     * Scrubs sensitive data from a log message and metadata.
     *
     * @param message - The log message
     * @param meta - Additional metadata to scrub
     * @returns Object with scrubbed message and metadata
     */
    LogScrubber.prototype.scrubLog = function (message, meta) {
        var scrubbedMessage = this.config.enabled ? scrubString(message) : message;
        if (!meta) {
            return { message: scrubbedMessage };
        }
        var scrubbedMeta = this.scrub(meta);
        return {
            message: scrubbedMessage,
            meta: scrubbedMeta,
        };
    };
    /**
     * Checks if scrubbing is enabled for a specific log level.
     * If per-level configuration is not set, falls back to global enabled setting.
     *
     * @param level - The log level to check
     * @returns Whether scrubbing is enabled for the level
     */
    LogScrubber.prototype.isEnabledForLevel = function (level) {
        var _a;
        if (!this.config.enabled) {
            return false;
        }
        var levelConfig = (_a = this.config.scrubByLevel) === null || _a === void 0 ? void 0 : _a[level];
        if (levelConfig !== undefined) {
            return levelConfig.enabled;
        }
        // Default to enabled if per-level config not set
        return true;
    };
    /**
     * Checks if scrubbing should be applied for a specific output type.
     * If scrubOutputs is not configured, scrubbing is applied to all outputs.
     *
     * @param output - The output type to check (console or file)
     * @returns Whether scrubbing should be applied for the output
     */
    LogScrubber.prototype.isEnabledForOutput = function (output) {
        if (!this.config.enabled) {
            return false;
        }
        if (!this.config.scrubOutputs || this.config.scrubOutputs.length === 0) {
            // If not configured, apply to all outputs
            return true;
        }
        return this.config.scrubOutputs.includes(output);
    };
    /**
     * Scrubs sensitive data from a log message with log level context.
     * Uses per-level configuration to determine scrubbing behavior.
     *
     * @param message - The log message
     * @param level - The log level
     * @param meta - Additional metadata to scrub
     * @returns Object with scrubbed message and metadata
     */
    LogScrubber.prototype.scrubLogByLevel = function (message, level, meta) {
        if (!this.isEnabledForLevel(level)) {
            return { message: message, meta: meta };
        }
        var scrubbedMessage = scrubString(message);
        if (!meta) {
            return { message: scrubbedMessage };
        }
        var scrubbedMeta = this.scrub(meta);
        return {
            message: scrubbedMessage,
            meta: scrubbedMeta,
        };
    };
    return LogScrubber;
}());
exports.LogScrubber = LogScrubber;
/**
 * Default log scrubber instance with standard configuration.
 */
exports.logScrubber = new LogScrubber();
/**
 * Convenience function to scrub a value using the default instance.
 *
 * @param value - The value to scrub
 * @returns Scrubbed value
 */
function scrubSensitiveData(value) {
    return exports.logScrubber.scrub(value);
}
