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
/**
 * Log scrubbing options
 */
export interface ScrubOptions {
    /** Custom fields to scrub in addition to defaults */
    customFields?: string[];
    /** Whether to scrub email addresses */
    scrubEmails?: boolean;
    /** Whether to scrub IP addresses */
    scrubIps?: boolean;
    /** Whether to preserve format for certain types (e.g., email can show domain) */
    preserveFormat?: boolean;
    /** Maximum length of preserved values */
    maxValueLength?: number;
}
/**
 * Scrubbed log entry result
 */
export interface ScrubResult {
    /** Whether any sensitive data was found and scrubbed */
    scrubbed: boolean;
    /** The scrubbed message */
    message: string;
    /** List of types of sensitive data that were scrubbed */
    scrubbedTypes: string[];
    /** Count of scrubbed occurrences */
    scrubCount: number;
}
/**
 * Scrub sensitive data from a log message
 *
 * @param message - The log message to scrub
 * @param options - Scrubbing options
 * @returns ScrubResult with the scrubbed message and metadata
 */
export declare function scrubLogMessage(message: string, options?: ScrubOptions): ScrubResult;
/**
 * Scrub sensitive data from an object for logging
 *
 * @param data - The data object to scrub
 * @param options - Scrubbing options
 * @returns Scrubbed object safe for logging
 */
export declare function scrubObjectForLogging<T extends Record<string, unknown>>(data: T, options?: ScrubOptions): T;
/**
 * Create a scrubbed version of function arguments for logging
 *
 * @param args - Arguments to scrub
 * @param options - Scrubbing options
 * @returns Scrubbed arguments
 */
export declare function scrubArgumentsForLogging(args: unknown[], options?: ScrubOptions): unknown[];
/**
 * Create a wrapper around Nakama's logger that automatically scrubs sensitive data
 *
 * @param logger - The Nakama logger to wrap
 * @param options - Scrubbing options
 * @returns Wrapped logger with automatic scrubbing
 */
export declare function createScrubbedLogger(logger: {
    debug: (format: string, ...args: unknown[]) => void;
    info: (format: string, ...args: unknown[]) => void;
    warn: (format: string, ...args: unknown[]) => void;
    error: (format: string, ...args: unknown[]) => void;
}, options?: ScrubOptions): {
    debug: (format: string, ...args: unknown[]) => void;
    info: (format: string, ...args: unknown[]) => void;
    warn: (format: string, ...args: unknown[]) => void;
    error: (format: string, ...args: unknown[]) => void;
};
/**
 * Check if a log message contains sensitive data without modifying it
 *
 * @param message - The log message to check
 * @returns Object with detection results
 */
export declare function detectSensitiveData(message: string): {
    containsSensitive: boolean;
    detectedTypes: string[];
    recommendations: string[];
};
/**
 * Validate that a log message is safe (contains no sensitive data)
 *
 * @param message - The log message to validate
 * @param options - Validation options
 * @returns Validation result
 */
export declare function validateLogSafety(message: string, options?: ScrubOptions): {
    safe: boolean;
    issues: string[];
    scrubbedMessage?: string;
};
/**
 * Configuration for log scrubbing in CI
 */
export interface LogScrubbingConfig {
    /** Whether to fail CI on detected sensitive data */
    failOnSensitive: boolean;
    /** File patterns to scan */
    filePatterns: string[];
    /** Custom fields to detect */
    customFields: string[];
    /** Whether to enable email scrubbing */
    scrubEmails: boolean;
    /** Whether to enable IP address scrubbing */
    scrubIps: boolean;
}
/**
 * Default CI configuration
 */
export declare const DEFAULT_CI_CONFIG: LogScrubbingConfig;
