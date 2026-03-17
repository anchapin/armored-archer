"use strict";
/**
 * Log Scrubbing Module
 *
 * Provides utilities for scrubbing sensitive data from logs to prevent
 * accidental exposure of PII, credentials, and other sensitive information.
 *
 * This module is designed to work with Nakama's Runtime.Logger interface and
 * can be integrated into existing logging calls.
 *
 * Compliance: GDPR, CCPA, COPPA
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CI_CONFIG = void 0;
exports.scrubLogMessage = scrubLogMessage;
exports.scrubObjectForLogging = scrubObjectForLogging;
exports.scrubArgumentsForLogging = scrubArgumentsForLogging;
exports.createScrubbedLogger = createScrubbedLogger;
exports.detectSensitiveData = detectSensitiveData;
exports.validateLogSafety = validateLogSafety;
var tslib_1 = require("tslib");
var privacy_compliance_1 = require("../modules/privacy_compliance");
/**
 * Patterns for sensitive data that should be scrubbed from logs
 */
var SCRUB_PATTERNS = {
    // Authentication credentials - more specific patterns first
    password: /(?:password|passwd|pwd)[=:\s]*["']?([^\s"']{4,})["']?/gi,
    api_key: /(?:api[_-]?key|apikey)[=:\s]*["']?([a-zA-Z0-9_-]{16,})["']?/gi,
    access_token: /(?:access[_-]?token|bearer[_-]?token)[=:\s]*["']?([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]*)["']?/gi,
    refresh_token: /(?:refresh[_-]?token)[=:\s]*["']?([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]*)["']?/gi,
    auth_token: /(?:auth[_-]?token)[=:\s]*["']?([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]*)["']?/gi,
    private_key: /(?:private[_-]?key|rsa[_-]?key)[=:\s]*["']?([a-zA-Z0-9_-]{64,})["']?/gi,
    // Personal identification
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    credit_card: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
    // Network identifiers
    ip_address: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    session_id: /(?:session[_-]?id)[=:\s]*["']?([a-zA-Z0-9_-]{16,})["']?/gi,
    // Device identifiers - more permissive for shorter IDs
    device_id: /(?:device[_-]?id|uuid|udid)[=:\s]*["']?([a-f0-9-]{8,})["']?/gi,
    // Database connection strings
    db_connection: /(?:postgres|mysql|mongodb|redis):\/\/[^\s]+/gi,
    // AWS keys
    aws_access_key: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g,
    aws_secret_key: /(?:aws[_-]?secret)[=:\s]*["']?([a-zA-Z0-9/+]{40})["']?/gi,
    // Generic secret patterns - should come after specific patterns
    secret: /(?:secret)[=:\s]*["']?([a-zA-Z0-9_-]{4,})["']?/gi,
};
/**
 * Fields that should always be scrubbed based on sensitivity
 */
var SCRUB_FIELDS = new Set([
    'password',
    'passwd',
    'pwd',
    'secret',
    'api_key',
    'api_key',
    'apikey',
    'access_token',
    'refresh_token',
    'auth_token',
    'session_token',
    'private_key',
    'public_key',
    'secret_key',
    'encryption_key',
    'encryption_key',
    'credit_card',
    'creditcard',
    'cvv',
    'ssn',
    'social_security',
    'date_of_birth',
    'dob',
    'full_name',
    'first_name',
    'last_name',
    'email',
    'phone',
    'mobile',
    'address',
    'ip_address',
    'device_id',
    'device_id',
    'udid',
    'uuid',
    'token',
]);
/**
 * Default scrubbing options
 */
var DEFAULT_OPTIONS = {
    customFields: [],
    scrubEmails: true,
    scrubIps: true,
    preserveFormat: true,
    maxValueLength: 50,
};
/**
 * Scrub sensitive data from a log message
 *
 * @param message - The log message to scrub
 * @param options - Scrubbing options
 * @returns ScrubResult with the scrubbed message and metadata
 */
function scrubLogMessage(message, options) {
    var e_1, _a, e_2, _b;
    var opts = tslib_1.__assign(tslib_1.__assign({}, DEFAULT_OPTIONS), options);
    var result = message;
    var scrubbedTypes = [];
    var scrubCount = 0;
    try {
        // Apply pattern-based scrubbing
        for (var _c = tslib_1.__values(Object.entries(SCRUB_PATTERNS)), _d = _c.next(); !_d.done; _d = _c.next()) {
            var _e = tslib_1.__read(_d.value, 2), type = _e[0], pattern = _e[1];
            // Skip types based on options
            if (type === 'email' && !opts.scrubEmails)
                continue;
            if (type === 'ip_address' && !opts.scrubIps)
                continue;
            var regex = new RegExp(pattern.source, pattern.flags);
            var matches = result.match(regex);
            if (matches && matches.length > 0) {
                scrubbedTypes.push(type);
                scrubCount += matches.length;
                if (opts.preserveFormat) {
                    // Replace with format-preserving placeholder
                    result = result.replace(regex, "[".concat(type.toUpperCase(), "_REDACTED]"));
                }
                else {
                    // Complete redaction
                    result = result.replace(regex, '[REDACTED]');
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    try {
        // Apply custom field scrubbing
        for (var _f = tslib_1.__values(opts.customFields), _g = _f.next(); !_g.done; _g = _f.next()) {
            var field = _g.value;
            var fieldPattern = new RegExp("(?:".concat(field, "[=:\\s]*[\"']?)([^\"']{1,").concat(opts.maxValueLength, "})[\"']?"), 'gi');
            var matches = result.match(fieldPattern);
            if (matches && matches.length > 0) {
                scrubbedTypes.push("custom:".concat(field));
                scrubCount += matches.length;
                result = result.replace(fieldPattern, "[".concat(field.toUpperCase(), "_REDACTED]"));
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return {
        scrubbed: scrubCount > 0,
        message: result,
        scrubbedTypes: tslib_1.__spreadArray([], tslib_1.__read(new Set(scrubbedTypes)), false),
        scrubCount: scrubCount,
    };
}
/**
 * Scrub sensitive data from an object for logging
 *
 * @param data - The data object to scrub
 * @param options - Scrubbing options
 * @returns Scrubbed object safe for logging
 */
function scrubObjectForLogging(data, options) {
    var e_3, _a;
    if (typeof data !== 'object' || data === null) {
        return data;
    }
    var opts = tslib_1.__assign(tslib_1.__assign({}, DEFAULT_OPTIONS), options);
    var customFieldsLower = opts.customFields.map(function (f) { return f.toLowerCase(); });
    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(function (item) {
            if (typeof item === 'object' && item !== null) {
                return scrubObjectForLogging(item, options);
            }
            else if (typeof item === 'string') {
                return scrubLogMessage(item, opts).message;
            }
            return item;
        });
    }
    var result = {};
    try {
        for (var _b = tslib_1.__values(Object.entries(data)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = tslib_1.__read(_c.value, 2), key = _d[0], value = _d[1];
            var lowerKey = key.toLowerCase();
            var fieldSensitivity = (0, privacy_compliance_1.classifyField)(lowerKey);
            // Check if this field should be scrubbed
            if (SCRUB_FIELDS.has(lowerKey) ||
                customFieldsLower.includes(lowerKey) ||
                fieldSensitivity === privacy_compliance_1.SensitivityLevel.RESTRICTED ||
                fieldSensitivity === privacy_compliance_1.SensitivityLevel.CONFIDENTIAL) {
                result[key] = (0, privacy_compliance_1.redactBySensitivity)(value, fieldSensitivity);
            }
            else if (typeof value === 'object' && value !== null) {
                // Recursively scrub nested objects and arrays
                result[key] = scrubObjectForLogging(value, options);
            }
            else if (typeof value === 'string') {
                // Scrub strings that might contain patterns
                var scrubResult = scrubLogMessage(value, opts);
                result[key] = scrubResult.scrubbed ? scrubResult.message : value;
            }
            else {
                result[key] = value;
            }
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
/**
 * Create a scrubbed version of function arguments for logging
 *
 * @param args - Arguments to scrub
 * @param options - Scrubbing options
 * @returns Scrubbed arguments
 */
function scrubArgumentsForLogging(args, options) {
    return args.map(function (arg) {
        if (typeof arg === 'string') {
            return scrubLogMessage(arg, options).message;
        }
        if (typeof arg === 'object' && arg !== null) {
            return scrubObjectForLogging(arg, options);
        }
        return arg;
    });
}
/**
 * Create a wrapper around Nakama's logger that automatically scrubs sensitive data
 *
 * @param logger - The Nakama logger to wrap
 * @param options - Scrubbing options
 * @returns Wrapped logger with automatic scrubbing
 */
function createScrubbedLogger(logger, options) {
    var createScrubbedMethod = function (method) {
        return function (format) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            var scrubbedFormat = scrubLogMessage(format, options).message;
            var scrubbedArgs = scrubArgumentsForLogging(args, options);
            logger[method].apply(logger, tslib_1.__spreadArray([scrubbedFormat], tslib_1.__read(scrubbedArgs), false));
        };
    };
    return {
        debug: createScrubbedMethod('debug'),
        info: createScrubbedMethod('info'),
        warn: createScrubbedMethod('warn'),
        error: createScrubbedMethod('error'),
    };
}
/**
 * Check if a log message contains sensitive data without modifying it
 *
 * @param message - The log message to check
 * @returns Object with detection results
 */
function detectSensitiveData(message) {
    var e_4, _a, e_5, _b;
    var detectedTypes = [];
    var recommendations = [];
    try {
        // Check for pattern matches
        for (var _c = tslib_1.__values(Object.entries(SCRUB_PATTERNS)), _d = _c.next(); !_d.done; _d = _c.next()) {
            var _e = tslib_1.__read(_d.value, 2), type = _e[0], pattern = _e[1];
            if (pattern.test(message)) {
                detectedTypes.push(type);
                recommendations.push("Enable scrubbing for ".concat(type, " patterns"));
            }
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_4) throw e_4.error; }
    }
    try {
        // Check for field matches
        for (var SCRUB_FIELDS_1 = tslib_1.__values(SCRUB_FIELDS), SCRUB_FIELDS_1_1 = SCRUB_FIELDS_1.next(); !SCRUB_FIELDS_1_1.done; SCRUB_FIELDS_1_1 = SCRUB_FIELDS_1.next()) {
            var field = SCRUB_FIELDS_1_1.value;
            var fieldPattern = new RegExp("(?:".concat(field, "[=:\\s]*[\"']?)([^\"']{1,})[\"']?"), 'gi');
            if (fieldPattern.test(message)) {
                detectedTypes.push("field:".concat(field));
                recommendations.push("Scrub field: ".concat(field));
            }
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (SCRUB_FIELDS_1_1 && !SCRUB_FIELDS_1_1.done && (_b = SCRUB_FIELDS_1.return)) _b.call(SCRUB_FIELDS_1);
        }
        finally { if (e_5) throw e_5.error; }
    }
    return {
        containsSensitive: detectedTypes.length > 0,
        detectedTypes: tslib_1.__spreadArray([], tslib_1.__read(new Set(detectedTypes)), false),
        recommendations: recommendations,
    };
}
/**
 * Validate that a log message is safe (contains no sensitive data)
 *
 * @param message - The log message to validate
 * @param options - Validation options
 * @returns Validation result
 */
function validateLogSafety(message, options) {
    var issues = [];
    var detection = detectSensitiveData(message);
    if (detection.containsSensitive) {
        issues.push("Log message contains sensitive data: ".concat(detection.detectedTypes.join(', ')));
    }
    // If issues found, provide scrubbed version
    if (issues.length > 0 && (options === null || options === void 0 ? void 0 : options.customFields)) {
        var scrubbed = scrubLogMessage(message, options);
        return {
            safe: false,
            issues: issues,
            scrubbedMessage: scrubbed.message,
        };
    }
    return {
        safe: !detection.containsSensitive,
        issues: issues,
    };
}
/**
 * Default CI configuration
 */
exports.DEFAULT_CI_CONFIG = {
    failOnSensitive: true,
    filePatterns: ['**/*.ts', '**/*.js', '**/*.json'],
    customFields: [],
    scrubEmails: true,
    scrubIps: true,
};
