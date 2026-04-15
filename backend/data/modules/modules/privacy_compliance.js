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
const valibot_1 = require("valibot");
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
const PII_PATTERNS = {
    [PIIType.EMAIL]: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    [PIIType.PHONE]: /\b(\+?1[-.\s]?)?(\([0-9]{3}\)|[0-9]{3})[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    [PIIType.SSN]: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    [PIIType.CREDIT_CARD]: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
    [PIIType.IP_ADDRESS]: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    [PIIType.DEVICE_ID]: /\b(?:device[_-]?id|uuid|udid)[=:\s]*["']([a-f0-9-]{16,})["']/gi,
    [PIIType.USER_ID]: /\b(?:user[_-]?id|player[_-]?id|account[_-]?id)[=:\s]*["']([a-zA-Z0-9_-]{8,})["']/gi,
    [PIIType.USERNAME]: /\b(?:username|user[_-]?name|display[_-]?name)[=:\s]*["']([a-zA-Z0-9_-]{2,20})["']/gi,
    [PIIType.FULL_NAME]: /\b(?:full[_-]?name|real[_-]?name|legal[_-]?name)[=:\s]*["']([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)["']/gi,
    [PIIType.ADDRESS]: /\b(?:address|street|city|postal[_-]?code)[=:\s]*["']([^"'\n]{10,100})["']/gi,
    [PIIType.DATE_OF_BIRTH]: /\b(?:dob|date[_-]?of[_-]?birth|birth[_-]?date)[=:\s]*["'](\d{4}[-/]\d{2}[-/]\d{2})["']/gi,
    [PIIType.GEOLOCATION]: /\b(?:lat[itude]|lon[gitude]?|location|geo)[=:\s]*["'](-?\d+\.?\d+)[,\s]+["']?(-?\d+\.?\d+)["']/gi,
    [PIIType.PASSWORD]: /\b(?:password|passwd|pwd|secret)[=:\s]*["']([^\s"']{4,})["']/gi,
    [PIIType.AUTH_TOKEN]: /\b(?:token|access[_-]?token|refresh[_-]?token|auth[_-]?token)[=:\s]*["']([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]*)["']/gi,
    [PIIType.SESSION_ID]: /\b(?:session[_-]?id|session[_-]?token)[=:\s]*["']([a-zA-Z0-9_-]{16,})["']/gi,
};
/**
 * Data field sensitivity classifications
 */
const FIELD_SENSITIVITY = {
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
    const detections = [];
    const piiTypes = types || Object.values(PIIType);
    for (const piiType of piiTypes) {
        const pattern = PII_PATTERNS[piiType];
        if (!pattern)
            continue;
        // Reset lastIndex for global regex
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
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
    const lowerFieldName = fieldName.toLowerCase();
    // Direct match
    if (FIELD_SENSITIVITY[lowerFieldName]) {
        return FIELD_SENSITIVITY[lowerFieldName];
    }
    // Check for partial matches
    for (const [key, level] of Object.entries(FIELD_SENSITIVITY)) {
        if (lowerFieldName.includes(key)) {
            return level;
        }
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
    const result = {
        level: SensitivityLevel.PUBLIC,
        fields: {},
        piiFields: [],
        restrictedFields: [],
    };
    if (typeof data !== 'object' || data === null) {
        return result;
    }
    const entries = Object.entries(data);
    for (const [key, value] of entries) {
        const level = classifyField(key);
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
    const issues = [];
    const warnings = [];
    const detectedTypes = new Set();
    const detectedLevels = new Set();
    if (typeof data !== 'object' || data === null) {
        return {
            compliant: true,
            issues,
            warnings,
            metadata: {
                checkedAt: Date.now(),
                dataTypes: [],
                sensitivityLevels: [],
            },
        };
    }
    const entries = Object.entries(data);
    for (const [key, value] of entries) {
        processField({ key, value, detectedTypes, detectedLevels, issues, warnings });
    }
    // GDPR-specific checks
    if (detectedTypes.has(PIIType.EMAIL) || detectedTypes.has(PIIType.USER_ID)) {
        const hasConsentField = entries.some(([key]) => key.toLowerCase().includes('consent') || key.toLowerCase().includes('gdpr'));
        if (!hasConsentField) {
            warnings.push('Data contains personal identifiers but no consent field found - ensure GDPR compliance');
        }
    }
    // CCPA-specific checks
    if (detectedTypes.has(PIIType.EMAIL) || detectedTypes.has(PIIType.PHONE)) {
        const hasOptOutField = entries.some(([key]) => key.toLowerCase().includes('opt') || key.toLowerCase().includes('ccpa'));
        if (!hasOptOutField) {
            warnings.push('Data may be subject to CCPA - consider adding opt-out field');
        }
    }
    // Check for missing encryption on sensitive fields
    const hasEncryptedField = entries.some(([key]) => key.toLowerCase().includes('encrypted'));
    if (detectedLevels.has(SensitivityLevel.RESTRICTED) && !hasEncryptedField) {
        warnings.push('Restricted data detected but no encryption indicator found');
    }
    const compliant = issues.filter((i) => i.severity === 'critical').length === 0;
    return {
        compliant,
        issues,
        warnings,
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
function processField({ key, value, detectedTypes, detectedLevels, issues, warnings, }) {
    const level = classifyField(key);
    detectedLevels.add(level);
    // Check for PII in value
    if (typeof value === 'string') {
        const detections = scanForPII(value);
        for (const detection of detections) {
            detectedTypes.add(detection.type);
        }
    }
    // Check for high-risk combinations
    if (level === SensitivityLevel.RESTRICTED) {
        issues.push({
            severity: 'critical',
            type: 'restricted_data',
            description: `Restricted data field "${key}" requires special handling`,
            fieldName: key,
            suggestion: 'Ensure data is encrypted and access is controlled',
        });
    }
    // Check for large data volumes
    if (typeof value === 'object' && value !== null) {
        const size = JSON.stringify(value).length;
        if (size > 10000 && level === SensitivityLevel.RESTRICTED) {
            warnings.push(`Large data volume in restricted field "${key}" - ensure logging is appropriate`);
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
    let result = text;
    const piiTypes = types || Object.values(PIIType);
    for (const piiType of piiTypes) {
        const pattern = PII_PATTERNS[piiType];
        if (!pattern)
            continue;
        const replacement = `[${piiType.toUpperCase()}_REDACTED]`;
        result = result.replace(new RegExp(pattern.source, pattern.flags), replacement);
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
function hashSensitiveData(value, salt = '') {
    let hash = 0;
    const combined = value + salt;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return `hashed_${Math.abs(hash).toString(16)}_${value.substring(0, 2)}`;
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
function prepareForLogging(data, customFields = []) {
    if (typeof data !== 'object' || data === null) {
        return data;
    }
    const sensitiveFields = new Set([
        ...Object.keys(FIELD_SENSITIVITY).filter((k) => FIELD_SENSITIVITY[k] === SensitivityLevel.RESTRICTED ||
            FIELD_SENSITIVITY[k] === SensitivityLevel.CONFIDENTIAL),
        ...customFields.map((f) => f.toLowerCase()),
    ]);
    const result = {};
    for (const [key, value] of Object.entries(data)) {
        const level = classifyField(key);
        const lowerKey = key.toLowerCase();
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
    const issues = [];
    const classification = classifyData(data);
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
        compliant: issues.filter((i) => i.severity === 'critical').length === 0,
        issues,
        warnings: classification.piiFields.length > 0
            ? [`Data contains ${classification.piiFields.length} potentially sensitive field(s)`]
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
const operationEnum = ['store', 'persist', 'log', 'transmit', 'send', 'share', 'export'];
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
        const str = JSON.stringify(value);
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
