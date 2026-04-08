"use strict";
/**
 * Privacy Compliance Module
 *
 * Provides PII detection, data handling compliance checks, and privacy-preserving
 * utilities for the Armored Archer backend.
 *
 * This module helps ensure compliance with:
 * - GDPR (General Data Protection Regulation)
 * - CCPA (California Consumer Privacy Act)
 * - COPPA (Children's Online Privacy Protection Act)
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyDataSchema = exports.piiScanSchema = exports.privacyCheckSchema = exports.SensitivityLevel = exports.PIIType = void 0;
exports.scanForPII = scanForPII;
exports.containsPII = containsPII;
exports.classifyField = classifyField;
exports.classifyData = classifyData;
exports.checkPrivacyCompliance = checkPrivacyCompliance;
exports.anonymizePII = anonymizePII;
exports.hashSensitiveData = hashSensitiveData;
exports.redactBySensitivity = redactBySensitivity;
exports.prepareForLogging = prepareForLogging;
exports.validateDataHandling = validateDataHandling;
exports.isPII = isPII;
exports.sanitizeForLogging = sanitizeForLogging;
var tslib_1 = require("tslib");
var valibot_1 = require("valibot");
/**
 * Types of Personally Identifiable Information (PII)
 */
var PIIType;
(function (PIIType) {
    PIIType["EMAIL"] = "email";
    PIIType["PHONE"] = "phone";
    PIIType["SSN"] = "ssn";
    PIIType["CREDIT_CARD"] = "credit_card";
    PIIType["IP_ADDRESS"] = "ip_address";
    PIIType["DEVICE_ID"] = "device_id";
    PIIType["USER_ID"] = "user_id";
    PIIType["USERNAME"] = "username";
    PIIType["FULL_NAME"] = "full_name";
    PIIType["ADDRESS"] = "address";
    PIIType["DATE_OF_BIRTH"] = "date_of_birth";
    PIIType["GEOLOCATION"] = "geolocation";
    PIIType["PASSWORD"] = "password";
    PIIType["AUTH_TOKEN"] = "auth_token";
    PIIType["SESSION_ID"] = "session_id";
})(PIIType || (exports.PIIType = PIIType = {}));
/**
 * Sensitivity levels for data classification
 */
var SensitivityLevel;
(function (SensitivityLevel) {
    SensitivityLevel["PUBLIC"] = "public";
    SensitivityLevel["INTERNAL"] = "internal";
    SensitivityLevel["CONFIDENTIAL"] = "confidential";
    SensitivityLevel["RESTRICTED"] = "restricted";
})(SensitivityLevel || (exports.SensitivityLevel = SensitivityLevel = {}));
/**
 * Regular expressions for PII detection
 * These patterns match actual values, not type annotations or variable declarations
 */
var PII_PATTERNS = (_a = {},
    _a[PIIType.EMAIL] = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    _a[PIIType.PHONE] = /\b(\+?1[-.\s]?)?(\([0-9]{3}\)|[0-9]{3})[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    _a[PIIType.SSN] = /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    _a[PIIType.CREDIT_CARD] = /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
    _a[PIIType.IP_ADDRESS] = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    _a[PIIType.DEVICE_ID] = /\b(?:device[_-]?id|uuid|udid)[=:\s]*["']([a-f0-9-]{16,})["']/gi,
    _a[PIIType.USER_ID] = /\b(?:user[_-]?id|player[_-]?id|account[_-]?id)[=:\s]*["']([a-zA-Z0-9_-]{8,})["']/gi,
    _a[PIIType.USERNAME] = /\b(?:username|user[_-]?name|display[_-]?name)[=:\s]*["']([a-zA-Z0-9_-]{2,20})["']/gi,
    _a[PIIType.FULL_NAME] = /\b(?:full[_-]?name|real[_-]?name|legal[_-]?name)[=:\s]*["']([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)["']/gi,
    _a[PIIType.ADDRESS] = /\b(?:address|street|city|postal[_-]?code)[=:\s]*["']([^"'\n]{10,100})["']/gi,
    _a[PIIType.DATE_OF_BIRTH] = /\b(?:dob|date[_-]?of[_-]?birth|birth[_-]?date)[=:\s]*["'](\d{4}[-/]\d{2}[-/]\d{2})["']/gi,
    _a[PIIType.GEOLOCATION] = /\b(?:lat[itude]|lon[gitude]?|location|geo)[=:\s]*["'](-?\d+\.?\d+)[,\s]+["']?(-?\d+\.?\d+)["']/gi,
    _a[PIIType.PASSWORD] = /\b(?:password|passwd|pwd|secret)[=:\s]*["']([^\s"']{4,})["']/gi,
    _a[PIIType.AUTH_TOKEN] = /\b(?:token|access[_-]?token|refresh[_-]?token|auth[_-]?token)[=:\s]*["']([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]*)["']/gi,
    _a[PIIType.SESSION_ID] = /\b(?:session[_-]?id|session[_-]?token)[=:\s]*["']([a-zA-Z0-9_-]{16,})["']/gi,
    _a);
/**
 * Data field sensitivity classifications
 */
var FIELD_SENSITIVITY = {
    // Authentication - RESTRICTED
    password: SensitivityLevel.RESTRICTED,
    passwd: SensitivityLevel.RESTRICTED,
    secret: SensitivityLevel.RESTRICTED,
    token: SensitivityLevel.RESTRICTED,
    access_token: SensitivityLevel.RESTRICTED,
    refresh_token: SensitivityLevel.RESTRICTED,
    auth_token: SensitivityLevel.RESTRICTED,
    session_id: SensitivityLevel.RESTRICTED,
    private_key: SensitivityLevel.RESTRICTED,
    // Personal Data - CONFIDENTIAL
    email: SensitivityLevel.CONFIDENTIAL,
    phone: SensitivityLevel.CONFIDENTIAL,
    first_name: SensitivityLevel.CONFIDENTIAL,
    last_name: SensitivityLevel.CONFIDENTIAL,
    full_name: SensitivityLevel.CONFIDENTIAL,
    date_of_birth: SensitivityLevel.CONFIDENTIAL,
    dob: SensitivityLevel.CONFIDENTIAL,
    address: SensitivityLevel.CONFIDENTIAL,
    ip_address: SensitivityLevel.CONFIDENTIAL,
    device_id: SensitivityLevel.CONFIDENTIAL,
    ssn: SensitivityLevel.RESTRICTED,
    credit_card: SensitivityLevel.RESTRICTED,
    payment_info: SensitivityLevel.RESTRICTED,
    // Account Data - INTERNAL
    user_id: SensitivityLevel.INTERNAL,
    player_id: SensitivityLevel.INTERNAL,
    account_id: SensitivityLevel.INTERNAL,
    username: SensitivityLevel.INTERNAL,
    display_name: SensitivityLevel.INTERNAL,
    created_at: SensitivityLevel.INTERNAL,
    updated_at: SensitivityLevel.INTERNAL,
    last_login: SensitivityLevel.INTERNAL,
    // Game Data - PUBLIC/INTERNAL
    level: SensitivityLevel.PUBLIC,
    xp: SensitivityLevel.PUBLIC,
    rank: SensitivityLevel.PUBLIC,
    gear: SensitivityLevel.PUBLIC,
    stats: SensitivityLevel.PUBLIC,
    achievements: SensitivityLevel.PUBLIC,
    match_history: SensitivityLevel.INTERNAL,
    gameplay_data: SensitivityLevel.INTERNAL,
};
/**
 * Scan text for PII and return detected instances
 *
 * @param text - The text to scan
 * @param types - Optional array of PII types to scan for (defaults to all)
 * @returns Array of detected PII instances
 */
function scanForPII(text, types) {
    var e_1, _a;
    var detections = [];
    var piiTypes = types || Object.values(PIIType);
    try {
        for (var piiTypes_1 = tslib_1.__values(piiTypes), piiTypes_1_1 = piiTypes_1.next(); !piiTypes_1_1.done; piiTypes_1_1 = piiTypes_1.next()) {
            var piiType = piiTypes_1_1.value;
            var pattern = PII_PATTERNS[piiType];
            if (!pattern)
                continue;
            // Reset lastIndex for global regex
            var regex = new RegExp(pattern.source, pattern.flags);
            var match = void 0;
            while ((match = regex.exec(text)) !== null) {
                detections.push({
                    type: piiType,
                    value: match[0],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    context: text.substring(Math.max(0, match.index - 20), Math.min(text.length, match.index + match[0].length + 20)),
                });
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (piiTypes_1_1 && !piiTypes_1_1.done && (_a = piiTypes_1.return)) _a.call(piiTypes_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return detections;
}
/**
 * Check if text contains any PII
 *
 * @param text - The text to check
 * @param types - Optional array of PII types to check for
 * @returns True if PII is detected
 */
function containsPII(text, types) {
    return scanForPII(text, types).length > 0;
}
/**
 * Classify the sensitivity level of a data field
 *
 * @param fieldName - The name of the field
 * @returns The sensitivity level
 */
function classifyField(fieldName) {
    var e_2, _a;
    var lowerFieldName = fieldName.toLowerCase();
    // Direct match
    if (FIELD_SENSITIVITY[lowerFieldName]) {
        return FIELD_SENSITIVITY[lowerFieldName];
    }
    try {
        // Check for partial matches
        for (var _b = tslib_1.__values(Object.entries(FIELD_SENSITIVITY)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = tslib_1.__read(_c.value, 2), key = _d[0], level = _d[1];
            if (lowerFieldName.includes(key)) {
                return level;
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
    // Default to INTERNAL for unknown fields
    return SensitivityLevel.INTERNAL;
}
/**
 * Classify an entire data object
 *
 * @param data - The data object to classify
 * @returns Classification result
 */
function classifyData(data) {
    var e_3, _a;
    var result = {
        level: SensitivityLevel.PUBLIC,
        fields: {},
        piiFields: [],
        restrictedFields: [],
    };
    if (typeof data !== 'object' || data === null) {
        return result;
    }
    var entries = Object.entries(data);
    try {
        for (var entries_1 = tslib_1.__values(entries), entries_1_1 = entries_1.next(); !entries_1_1.done; entries_1_1 = entries_1.next()) {
            var _b = tslib_1.__read(entries_1_1.value, 2), key = _b[0], value = _b[1];
            var level = classifyField(key);
            result.fields[key] = level;
            // Track overall classification
            if (level === SensitivityLevel.RESTRICTED) {
                result.level = SensitivityLevel.RESTRICTED;
                result.restrictedFields.push(key);
            }
            else if (level === SensitivityLevel.CONFIDENTIAL &&
                result.level !== SensitivityLevel.RESTRICTED) {
                result.level = SensitivityLevel.CONFIDENTIAL;
                result.piiFields.push(key);
            }
            else if (level === SensitivityLevel.INTERNAL && result.level === SensitivityLevel.PUBLIC) {
                result.level = SensitivityLevel.INTERNAL;
            }
            // Check value for embedded PII
            if (typeof value === 'string' && containsPII(value)) {
                if (!result.piiFields.includes(key)) {
                    result.piiFields.push(key);
                }
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (entries_1_1 && !entries_1_1.done && (_a = entries_1.return)) _a.call(entries_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return result;
}
/**
 * Check privacy compliance for data
 *
 * @param data - The data to check
 * @param _context - Optional context for the check (unused, reserved for future use)
 * @returns Privacy check result
 */
function checkPrivacyCompliance(data, _context) {
    var e_4, _a;
    var issues = [];
    var warnings = [];
    var detectedTypes = new Set();
    var detectedLevels = new Set();
    if (typeof data !== 'object' || data === null) {
        return {
            compliant: true,
            issues: issues,
            warnings: warnings,
            metadata: {
                checkedAt: Date.now(),
                dataTypes: [],
                sensitivityLevels: [],
            },
        };
    }
    var entries = Object.entries(data);
    try {
        for (var entries_2 = tslib_1.__values(entries), entries_2_1 = entries_2.next(); !entries_2_1.done; entries_2_1 = entries_2.next()) {
            var _b = tslib_1.__read(entries_2_1.value, 2), key = _b[0], value = _b[1];
            processField({ key: key, value: value, detectedTypes: detectedTypes, detectedLevels: detectedLevels, issues: issues, warnings: warnings });
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (entries_2_1 && !entries_2_1.done && (_a = entries_2.return)) _a.call(entries_2);
        }
        finally { if (e_4) throw e_4.error; }
    }
    // GDPR-specific checks
    if (detectedTypes.has(PIIType.EMAIL) || detectedTypes.has(PIIType.USER_ID)) {
        var hasConsentField = entries.some(function (_a) {
            var _b = tslib_1.__read(_a, 1), key = _b[0];
            return key.toLowerCase().includes('consent') || key.toLowerCase().includes('gdpr');
        });
        if (!hasConsentField) {
            warnings.push('Data contains personal identifiers but no consent field found - ensure GDPR compliance');
        }
    }
    // CCPA-specific checks
    if (detectedTypes.has(PIIType.EMAIL) || detectedTypes.has(PIIType.PHONE)) {
        var hasOptOutField = entries.some(function (_a) {
            var _b = tslib_1.__read(_a, 1), key = _b[0];
            return key.toLowerCase().includes('opt') || key.toLowerCase().includes('ccpa');
        });
        if (!hasOptOutField) {
            warnings.push('Data may be subject to CCPA - consider adding opt-out field');
        }
    }
    // Check for missing encryption on sensitive fields
    var hasEncryptedField = entries.some(function (_a) {
        var _b = tslib_1.__read(_a, 1), key = _b[0];
        return key.toLowerCase().includes('encrypted');
    });
    if (detectedLevels.has(SensitivityLevel.RESTRICTED) && !hasEncryptedField) {
        warnings.push('Restricted data detected but no encryption indicator found');
    }
    var compliant = issues.filter(function (i) { return i.severity === 'critical'; }).length === 0;
    return {
        compliant: compliant,
        issues: issues,
        warnings: warnings,
        metadata: {
            checkedAt: Date.now(),
            dataTypes: Array.from(detectedTypes),
            sensitivityLevels: Array.from(detectedLevels),
        },
    };
}
/**
 * Process a single field for privacy compliance
 */
function processField(_a) {
    var e_5, _b;
    var key = _a.key, value = _a.value, detectedTypes = _a.detectedTypes, detectedLevels = _a.detectedLevels, issues = _a.issues, warnings = _a.warnings;
    var level = classifyField(key);
    detectedLevels.add(level);
    // Check for PII in value
    if (typeof value === 'string') {
        var detections = scanForPII(value);
        try {
            for (var detections_1 = tslib_1.__values(detections), detections_1_1 = detections_1.next(); !detections_1_1.done; detections_1_1 = detections_1.next()) {
                var detection = detections_1_1.value;
                detectedTypes.add(detection.type);
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (detections_1_1 && !detections_1_1.done && (_b = detections_1.return)) _b.call(detections_1);
            }
            finally { if (e_5) throw e_5.error; }
        }
    }
    // Check for high-risk combinations
    if (level === SensitivityLevel.RESTRICTED) {
        issues.push({
            severity: 'critical',
            type: 'restricted_data',
            description: "Restricted data field \"".concat(key, "\" requires special handling"),
            fieldName: key,
            suggestion: 'Ensure data is encrypted and access is controlled',
        });
    }
    // Check for large data volumes
    if (typeof value === 'object' && value !== null) {
        var size = JSON.stringify(value).length;
        if (size > 10000 && level === SensitivityLevel.RESTRICTED) {
            warnings.push("Large data volume in restricted field \"".concat(key, "\" - ensure logging is appropriate"));
        }
    }
}
/**
 * Anonymize PII in a string
 *
 * @param text - The text to anonymize
 * @param types - Optional array of PII types to anonymize
 * @returns Anonymized text
 */
function anonymizePII(text, types) {
    var e_6, _a;
    var result = text;
    var piiTypes = types || Object.values(PIIType);
    try {
        for (var piiTypes_2 = tslib_1.__values(piiTypes), piiTypes_2_1 = piiTypes_2.next(); !piiTypes_2_1.done; piiTypes_2_1 = piiTypes_2.next()) {
            var piiType = piiTypes_2_1.value;
            var pattern = PII_PATTERNS[piiType];
            if (!pattern)
                continue;
            var replacement = "[".concat(piiType.toUpperCase(), "_REDACTED]");
            result = result.replace(new RegExp(pattern.source, pattern.flags), replacement);
        }
    }
    catch (e_6_1) { e_6 = { error: e_6_1 }; }
    finally {
        try {
            if (piiTypes_2_1 && !piiTypes_2_1.done && (_a = piiTypes_2.return)) _a.call(piiTypes_2);
        }
        finally { if (e_6) throw e_6.error; }
    }
    return result;
}
/**
 * Hash sensitive data for safe logging/storage
 *
 * @param value - The value to hash
 * @param salt - Optional salt
 * @returns Hashed value
 */
function hashSensitiveData(value, salt) {
    if (salt === void 0) { salt = ''; }
    var hash = 0;
    var combined = value + salt;
    for (var i = 0; i < combined.length; i++) {
        var char = combined.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return "hashed_".concat(Math.abs(hash).toString(16), "_").concat(value.substring(0, 2));
}
/**
 * Redact a value based on its sensitivity
 *
 * @param value - The value to redact
 * @param level - The sensitivity level
 * @returns Redacted value
 */
function redactBySensitivity(value, level) {
    if (value === null || value === undefined) {
        return value;
    }
    switch (level) {
        case SensitivityLevel.RESTRICTED:
            return '[REDACTED]';
        case SensitivityLevel.CONFIDENTIAL:
            if (typeof value === 'string' && value.length > 4) {
                return value.substring(0, 2) + '***' + value.substring(value.length - 2);
            }
            return '[MASKED]';
        case SensitivityLevel.INTERNAL:
            return value;
        case SensitivityLevel.PUBLIC:
        default:
            return value;
    }
}
/**
 * Prepare data for logging by redacting sensitive fields
 *
 * @param data - The data to prepare for logging
 * @param customFields - Optional custom sensitive fields to redact
 * @returns Logging-safe data
 */
function prepareForLogging(data, customFields) {
    var e_7, _a;
    if (customFields === void 0) { customFields = []; }
    if (typeof data !== 'object' || data === null) {
        return data;
    }
    var sensitiveFields = new Set(tslib_1.__spreadArray(tslib_1.__spreadArray([], tslib_1.__read(Object.keys(FIELD_SENSITIVITY).filter(function (k) {
        return FIELD_SENSITIVITY[k] === SensitivityLevel.RESTRICTED ||
            FIELD_SENSITIVITY[k] === SensitivityLevel.CONFIDENTIAL;
    })), false), tslib_1.__read(customFields.map(function (f) { return f.toLowerCase(); })), false));
    var result = {};
    try {
        for (var _b = tslib_1.__values(Object.entries(data)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = tslib_1.__read(_c.value, 2), key = _d[0], value = _d[1];
            var level = classifyField(key);
            var lowerKey = key.toLowerCase();
            if (sensitiveFields.has(lowerKey)) {
                result[key] = redactBySensitivity(value, level);
            }
            else if (typeof value === 'object') {
                result[key] = prepareForLogging(value, customFields);
            }
            else {
                result[key] = value;
            }
        }
    }
    catch (e_7_1) { e_7 = { error: e_7_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_7) throw e_7.error; }
    }
    return result;
}
/**
 * Validate data handling compliance for a specific operation
 *
 * @param operation - The operation being performed (e.g., 'store', 'log', 'transmit')
 * @param data - The data involved
 * @returns Compliance result
 */
function validateDataHandling(operation, data) {
    var issues = [];
    var classification = classifyData(data);
    switch (operation.toLowerCase()) {
        case 'store':
        case 'persist':
            if (classification.restrictedFields.length > 0) {
                issues.push({
                    severity: 'critical',
                    type: 'storage_compliance',
                    description: 'Restricted data must be encrypted at rest',
                    suggestion: 'Use encryption before storing restricted data',
                });
            }
            break;
        case 'log':
            if (classification.restrictedFields.length > 0 || classification.piiFields.length > 0) {
                issues.push({
                    severity: 'high',
                    type: 'logging_compliance',
                    description: 'Sensitive data should not be logged directly',
                    suggestion: 'Use prepareForLogging() or hashSensitiveData() before logging',
                });
            }
            break;
        case 'transmit':
        case 'send':
            if (classification.restrictedFields.length > 0) {
                issues.push({
                    severity: 'critical',
                    type: 'transmission_compliance',
                    description: 'Restricted data must be encrypted in transit',
                    suggestion: 'Use TLS/HTTPS for transmitting restricted data',
                });
            }
            break;
        case 'share':
        case 'export':
            if (classification.piiFields.length > 0) {
                issues.push({
                    severity: 'high',
                    type: 'sharing_compliance',
                    description: 'PII data sharing requires user consent and proper handling',
                    suggestion: 'Ensure GDPR/CCPA compliance before sharing PII',
                });
            }
            break;
    }
    return {
        compliant: issues.filter(function (i) { return i.severity === 'critical'; }).length === 0,
        issues: issues,
        warnings: classification.piiFields.length > 0
            ? ["Data contains ".concat(classification.piiFields.length, " potentially sensitive field(s)")]
            : [],
        metadata: {
            checkedAt: Date.now(),
            dataTypes: [],
            sensitivityLevels: [classification.level],
        },
    };
}
/**
 * Valibot schema for privacy compliance check request
 */
var operationEnum = ['store', 'persist', 'log', 'transmit', 'send', 'share', 'export'];
exports.privacyCheckSchema = (0, valibot_1.object)({
    data: (0, valibot_1.record)((0, valibot_1.string)(), (0, valibot_1.unknown)()),
    operation: (0, valibot_1.enum)(operationEnum),
    context: (0, valibot_1.optional)((0, valibot_1.string)()),
});
/**
 * Valibot schema for PII scan request
 */
exports.piiScanSchema = (0, valibot_1.object)({
    text: (0, valibot_1.pipe)((0, valibot_1.string)(), (0, valibot_1.minLength)(1), (0, valibot_1.maxLength)(100000)),
    types: (0, valibot_1.optional)((0, valibot_1.array)((0, valibot_1.enum)(PIIType))),
});
/**
 * Valibot schema for data classification request
 */
exports.classifyDataSchema = (0, valibot_1.object)({
    data: (0, valibot_1.record)((0, valibot_1.string)(), (0, valibot_1.unknown)()),
});
/**
 * Check if a value contains PII (simple boolean check for any value)
 *
 * @param value - The value to check
 * @returns True if the value appears to contain PII
 */
function isPII(value) {
    if (typeof value === 'string') {
        return containsPII(value);
    }
    if (typeof value === 'object' && value !== null) {
        var str = JSON.stringify(value);
        return containsPII(str);
    }
    return false;
}
/**
 * Sanitize data for logging by removing PII
 *
 * @param data - The data to sanitize
 * @returns Sanitized data safe for logging
 */
function sanitizeForLogging(data) {
    if (typeof data === 'string') {
        return anonymizePII(data);
    }
    return prepareForLogging(data);
}
