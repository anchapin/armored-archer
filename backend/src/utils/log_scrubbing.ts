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

import { PIIType, SensitivityLevel, classifyField, redactBySensitivity } from '../modules/privacy_compliance';

/**
 * Patterns for sensitive data that should be scrubbed from logs
 */
const SCRUB_PATTERNS: Record<string, RegExp> = {
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
  aws_secret_key: /(?:aws[_-]?secret)[=:\s]*["']?([a-zA-Z0-9\/+]{40})["']?/gi,
  
  // Generic secret patterns - should come after specific patterns
  secret: /(?:secret)[=:\s]*["']?([a-zA-Z0-9_-]{4,})["']?/gi,
};

/**
 * Fields that should always be scrubbed based on sensitivity
 */
const SCRUB_FIELDS = new Set([
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
 * Default scrubbing options
 */
const DEFAULT_OPTIONS: Required<ScrubOptions> = {
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
export function scrubLogMessage(message: string, options?: ScrubOptions): ScrubResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let result = message;
  const scrubbedTypes: string[] = [];
  let scrubCount = 0;

  // Apply pattern-based scrubbing
  for (const [type, pattern] of Object.entries(SCRUB_PATTERNS)) {
    // Skip types based on options
    if (type === 'email' && !opts.scrubEmails) continue;
    if (type === 'ip_address' && !opts.scrubIps) continue;

    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = result.match(regex);
    
    if (matches && matches.length > 0) {
      scrubbedTypes.push(type);
      scrubCount += matches.length;
      
      if (opts.preserveFormat) {
        // Replace with format-preserving placeholder
        result = result.replace(regex, `[${type.toUpperCase()}_REDACTED]`);
      } else {
        // Complete redaction
        result = result.replace(regex, '[REDACTED]');
      }
    }
  }

  // Apply custom field scrubbing
  for (const field of opts.customFields) {
    const fieldPattern = new RegExp(
      `(?:${field}[=:\\s]*["']?)([^"']{1,${opts.maxValueLength}})["']?`,
      'gi'
    );
    const matches = result.match(fieldPattern);
    
    if (matches && matches.length > 0) {
      scrubbedTypes.push(`custom:${field}`);
      scrubCount += matches.length;
      result = result.replace(fieldPattern, `[${field.toUpperCase()}_REDACTED]`);
    }
  }

  return {
    scrubbed: scrubCount > 0,
    message: result,
    scrubbedTypes: [...new Set(scrubbedTypes)],
    scrubCount,
  };
}

/**
 * Scrub sensitive data from an object for logging
 *
 * @param data - The data object to scrub
 * @param options - Scrubbing options
 * @returns Scrubbed object safe for logging
 */
export function scrubObjectForLogging<T extends Record<string, unknown>>(
  data: T,
  options?: ScrubOptions
): T {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const customFieldsLower = opts.customFields.map(f => f.toLowerCase());
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === 'object' && item !== null) {
        return scrubObjectForLogging(item as Record<string, unknown>, options);
      } else if (typeof item === 'string') {
        return scrubLogMessage(item, opts).message;
      }
      return item;
    }) as T;
  }
  
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const fieldSensitivity = classifyField(lowerKey);

    // Check if this field should be scrubbed
    if (
      SCRUB_FIELDS.has(lowerKey) ||
      customFieldsLower.includes(lowerKey) ||
      fieldSensitivity === SensitivityLevel.RESTRICTED ||
      fieldSensitivity === SensitivityLevel.CONFIDENTIAL
    ) {
      result[key] = redactBySensitivity(value, fieldSensitivity);
    } else if (typeof value === 'object' && value !== null) {
      // Recursively scrub nested objects and arrays
      result[key] = scrubObjectForLogging(value as Record<string, unknown>, options);
    } else if (typeof value === 'string') {
      // Scrub strings that might contain patterns
      const scrubResult = scrubLogMessage(value, opts);
      result[key] = scrubResult.scrubbed ? scrubResult.message : value;
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Create a scrubbed version of function arguments for logging
 *
 * @param args - Arguments to scrub
 * @param options - Scrubbing options
 * @returns Scrubbed arguments
 */
export function scrubArgumentsForLogging(
  args: unknown[],
  options?: ScrubOptions
): unknown[] {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      return scrubLogMessage(arg, options).message;
    }
    if (typeof arg === 'object' && arg !== null) {
      return scrubObjectForLogging(arg as Record<string, unknown>, options);
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
export function createScrubbedLogger(
  logger: {
    debug: (format: string, ...args: unknown[]) => void;
    info: (format: string, ...args: unknown[]) => void;
    warn: (format: string, ...args: unknown[]) => void;
    error: (format: string, ...args: unknown[]) => void;
  },
  options?: ScrubOptions
): {
  debug: (format: string, ...args: unknown[]) => void;
  info: (format: string, ...args: unknown[]) => void;
  warn: (format: string, ...args: unknown[]) => void;
  error: (format: string, ...args: unknown[]) => void;
} {
  const createScrubbedMethod = (
    method: 'debug' | 'info' | 'warn' | 'error'
  ): ((format: string, ...args: unknown[]) => void) => {
    return (format: string, ...args: unknown[]) => {
      const scrubbedFormat = scrubLogMessage(format, options).message;
      const scrubbedArgs = scrubArgumentsForLogging(args, options);
      logger[method](scrubbedFormat, ...scrubbedArgs);
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
export function detectSensitiveData(message: string): {
  containsSensitive: boolean;
  detectedTypes: string[];
  recommendations: string[];
} {
  const detectedTypes: string[] = [];
  const recommendations: string[] = [];

  // Check for pattern matches
  for (const [type, pattern] of Object.entries(SCRUB_PATTERNS)) {
    if (pattern.test(message)) {
      detectedTypes.push(type);
      recommendations.push(`Enable scrubbing for ${type} patterns`);
    }
  }

  // Check for field matches
  for (const field of SCRUB_FIELDS) {
    const fieldPattern = new RegExp(
      `(?:${field}[=:\\s]*["']?)([^"']{1,})["']?`,
      'gi'
    );
    if (fieldPattern.test(message)) {
      detectedTypes.push(`field:${field}`);
      recommendations.push(`Scrub field: ${field}`);
    }
  }

  return {
    containsSensitive: detectedTypes.length > 0,
    detectedTypes: [...new Set(detectedTypes)],
    recommendations,
  };
}

/**
 * Validate that a log message is safe (contains no sensitive data)
 *
 * @param message - The log message to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateLogSafety(
  message: string,
  options?: ScrubOptions
): {
  safe: boolean;
  issues: string[];
  scrubbedMessage?: string;
} {
  const issues: string[] = [];
  const detection = detectSensitiveData(message);

  if (detection.containsSensitive) {
    issues.push(
      `Log message contains sensitive data: ${detection.detectedTypes.join(', ')}`
    );
  }

  // If issues found, provide scrubbed version
  if (issues.length > 0 && options?.customFields) {
    const scrubbed = scrubLogMessage(message, options);
    return {
      safe: false,
      issues,
      scrubbedMessage: scrubbed.message,
    };
  }

  return {
    safe: !detection.containsSensitive,
    issues,
  };
}

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
export const DEFAULT_CI_CONFIG: LogScrubbingConfig = {
  failOnSensitive: true,
  filePatterns: ['**/*.ts', '**/*.js', '**/*.json'],
  customFields: [],
  scrubEmails: true,
  scrubIps: true,
};
