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
/**
 * Types of Personally Identifiable Information (PII)
 */
export declare enum PIIType {
    EMAIL = "email",
    PHONE = "phone",
    SSN = "ssn",
    CREDIT_CARD = "credit_card",
    IP_ADDRESS = "ip_address",
    DEVICE_ID = "device_id",
    USER_ID = "user_id",
    USERNAME = "username",
    FULL_NAME = "full_name",
    ADDRESS = "address",
    DATE_OF_BIRTH = "date_of_birth",
    GEOLOCATION = "geolocation",
    PASSWORD = "password",
    AUTH_TOKEN = "auth_token",
    SESSION_ID = "session_id"
}
/**
 * Sensitivity levels for data classification
 */
export declare enum SensitivityLevel {
    PUBLIC = "public",
    INTERNAL = "internal",
    CONFIDENTIAL = "confidential",
    RESTRICTED = "restricted"
}
/**
 * Detected PII information
 */
export interface DetectedPII {
    type: PIIType;
    value: string;
    startIndex: number;
    endIndex: number;
    fieldName?: string;
    context?: string;
}
/**
 * Privacy check result
 */
export interface PrivacyCheckResult {
    compliant: boolean;
    issues: PrivacyIssue[];
    warnings: string[];
    metadata: {
        checkedAt: number;
        dataTypes: PIIType[];
        sensitivityLevels: SensitivityLevel[];
    };
}
/**
 * Privacy issue details
 */
export interface PrivacyIssue {
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    description: string;
    fieldName?: string;
    suggestion?: string;
}
/**
 * Data classification result
 */
export interface DataClassification {
    level: SensitivityLevel;
    fields: Record<string, SensitivityLevel>;
    piiFields: string[];
    restrictedFields: string[];
}
/**
 * Anonymization options
 */
export interface AnonymizationOptions {
    preserveFormat?: boolean;
    salt?: string;
    hashAlgorithm?: 'sha256' | 'sha512';
}
/**
 * Scan text for PII and return detected instances
 *
 * @param text - The text to scan
 * @param types - Optional array of PII types to scan for (defaults to all)
 * @returns Array of detected PII instances
 */
export declare function scanForPII(text: string, types?: PIIType[]): DetectedPII[];
/**
 * Check if text contains any PII
 *
 * @param text - The text to check
 * @param types - Optional array of PII types to check for
 * @returns True if PII is detected
 */
export declare function containsPII(text: string, types?: PIIType[]): boolean;
/**
 * Classify the sensitivity level of a data field
 *
 * @param fieldName - The name of the field
 * @returns The sensitivity level
 */
export declare function classifyField(fieldName: string): SensitivityLevel;
/**
 * Classify an entire data object
 *
 * @param data - The data object to classify
 * @returns Classification result
 */
export declare function classifyData(data: unknown): DataClassification;
/**
 * Check privacy compliance for data
 *
 * @param data - The data to check
 * @param _context - Optional context for the check (unused, reserved for future use)
 * @returns Privacy check result
 */
export declare function checkPrivacyCompliance(data: unknown, _context?: string): PrivacyCheckResult;
/**
 * Anonymize PII in a string
 *
 * @param text - The text to anonymize
 * @param types - Optional array of PII types to anonymize
 * @returns Anonymized text
 */
export declare function anonymizePII(text: string, types?: PIIType[]): string;
/**
 * Hash sensitive data for safe logging/storage
 *
 * @param value - The value to hash
 * @param salt - Optional salt
 * @returns Hashed value
 */
export declare function hashSensitiveData(value: string, salt?: string): string;
/**
 * Redact a value based on its sensitivity
 *
 * @param value - The value to redact
 * @param level - The sensitivity level
 * @returns Redacted value
 */
export declare function redactBySensitivity(value: unknown, level: SensitivityLevel): unknown;
/**
 * Prepare data for logging by redacting sensitive fields
 *
 * @param data - The data to prepare for logging
 * @param customFields - Optional custom sensitive fields to redact
 * @returns Logging-safe data
 */
export declare function prepareForLogging(data: unknown, customFields?: string[]): unknown;
/**
 * Validate data handling compliance for a specific operation
 *
 * @param operation - The operation being performed (e.g., 'store', 'log', 'transmit')
 * @param data - The data involved
 * @returns Compliance result
 */
export declare function validateDataHandling(operation: string, data: unknown): PrivacyCheckResult;
export declare const privacyCheckSchema: import("valibot").ObjectSchema<{
    readonly data: import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").UnknownSchema, undefined>;
    readonly operation: import("valibot").EnumSchema<any, undefined>;
    readonly context: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
}, undefined>;
/**
 * Valibot schema for PII scan request
 */
export declare const piiScanSchema: import("valibot").ObjectSchema<{
    readonly text: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").MinLengthAction<string, 1, undefined>, import("valibot").MaxLengthAction<string, 100000, undefined>]>;
    readonly types: import("valibot").OptionalSchema<import("valibot").ArraySchema<import("valibot").EnumSchema<any, undefined>, undefined>, undefined>;
}, undefined>;
/**
 * Valibot schema for data classification request
 */
export declare const classifyDataSchema: import("valibot").ObjectSchema<{
    readonly data: import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").UnknownSchema, undefined>;
}, undefined>;
/**
 * Type for privacy check request
 */
export type PrivacyCheckRequest = {
    data: Record<string, unknown>;
    operation: 'store' | 'persist' | 'log' | 'transmit' | 'send' | 'share' | 'export';
    context?: string;
};
/**
 * Type for PII scan request
 */
export type PIIScanRequest = {
    text: string;
    types?: PIIType[];
};
/**
 * Type for data classification request
 */
export type ClassifyDataRequest = {
    data: Record<string, unknown>;
};
/**
 * Check if a value contains PII (simple boolean check for any value)
 *
 * @param value - The value to check
 * @returns True if the value appears to contain PII
 */
export declare function isPII(value: unknown): boolean;
/**
 * Sanitize data for logging by removing PII
 *
 * @param data - The data to sanitize
 * @returns Sanitized data safe for logging
 */
export declare function sanitizeForLogging(data: unknown): unknown;
