/**
 * Log Scrubbing Module
 *
 * Provides functionality to scrub sensitive data from log messages before they are written.
 * This prevents sensitive information such as passwords, tokens, and personal identifiable
 * information (PII) from being exposed in logs.
 */

/**
 * Default sensitive field names that should be scrubbed.
 * These field names are checked case-insensitively.
 */
const DEFAULT_SENSITIVE_FIELDS = [
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
const SENSITIVE_PATTERNS = [
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
 * Configuration for per-level scrubbing.
 */
export interface LogScrubberLevelConfig {
  /** Enable scrubbing for this log level */
  enabled: boolean;
  /** Additional sensitive fields specific to this level */
  additionalFields?: string[];
}

/**
 * Configuration options for log scrubbing.
 */
export interface LogScrubberConfig {
  /** Enable or disable log scrubbing globally */
  enabled: boolean;
  /** Additional field names to treat as sensitive (added to defaults) */
  additionalSensitiveFields?: string[];
  /** Field names to exclude from scrubbing */
  excludedFields?: string[];
  /** Custom patterns to scrub */
  customPatterns?: Array<{ pattern: RegExp; replacement: string }>;
  /** Maximum depth to scrub in nested objects */
  maxDepth?: number;
  /** Whether to scrub keys in addition to values */
  scrubKeys: boolean;
  /** Scrubbing configuration per log level */
  scrubByLevel?: {
    error?: LogScrubberLevelConfig;
    warn?: LogScrubberLevelConfig;
    info?: LogScrubberLevelConfig;
    debug?: LogScrubberLevelConfig;
  };
  /** List of output types where scrubbing is applied */
  scrubOutputs?: ('console' | 'file')[];
}

/** Log levels supported by the scrubber */
export type LogScrubberLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Default configuration for log scrubbing.
 */
export const defaultLogScrubberConfig: LogScrubberConfig = {
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
function buildSensitiveFieldSet(
  additionalFields: string[] = [],
  excludedFields: string[] = []
): Set<string> {
  const excludedSet = new Set(excludedFields.map((f) => f.toLowerCase()));
  const fields = new Set<string>();

  for (const field of DEFAULT_SENSITIVE_FIELDS) {
    if (!excludedSet.has(field.toLowerCase())) {
      fields.add(field.toLowerCase());
    }
  }

  for (const field of additionalFields) {
    if (!excludedSet.has(field.toLowerCase())) {
      fields.add(field.toLowerCase());
    }
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
function isSensitiveKey(key: string, sensitiveFields: Set<string>): boolean {
  const lowerKey = key.toLowerCase();
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
function scrubObject(
  obj: unknown,
  sensitiveFields: Set<string>,
  currentDepth: number,
  maxDepth: number,
  scrubKeys: boolean
): unknown {
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
    return obj.map((item) =>
      scrubObject(item, sensitiveFields, currentDepth + 1, maxDepth, scrubKeys)
    );
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const shouldScrub = isSensitiveKey(key, sensitiveFields);
      let newKey = key;

      if (scrubKeys && shouldScrub) {
        newKey = `[REDACTED_${key.toUpperCase()}]`;
      }

      result[newKey] = shouldScrub
        ? '[REDACTED]'
        : scrubObject(value, sensitiveFields, currentDepth + 1, maxDepth, scrubKeys);
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
function scrubString(input: string): string {
  let result = input;

  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * Log scrubber class that provides methods to scrub sensitive data from logs.
 */
export class LogScrubber {
  private config: LogScrubberConfig;
  private sensitiveFields: Set<string>;

  /**
   * Creates a new LogScrubber instance.
   *
   * @param config - Configuration options for log scrubbing
   */
  constructor(config: Partial<LogScrubberConfig> = {}) {
    this.config = {
      ...defaultLogScrubberConfig,
      ...config,
    };

    this.sensitiveFields = buildSensitiveFieldSet(
      this.config.additionalSensitiveFields,
      this.config.excludedFields
    );
  }

  /**
   * Updates the scrubber configuration.
   *
   * @param config - New configuration options
   */
  updateConfig(config: Partial<LogScrubberConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    if (config.additionalSensitiveFields || config.excludedFields) {
      this.sensitiveFields = buildSensitiveFieldSet(
        this.config.additionalSensitiveFields,
        this.config.excludedFields
      );
    }
  }

  /**
   * Gets the current configuration.
   *
   * @returns Current configuration
   */
  getConfig(): LogScrubberConfig {
    return { ...this.config };
  }

  /**
   * Checks if scrubbing is enabled.
   *
   * @returns Whether scrubbing is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enables log scrubbing.
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disables log scrubbing.
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Scrubs sensitive data from a value.
   *
   * @param value - The value to scrub (string, object, array, etc.)
   * @returns Scrubbed value
   */
  scrub(value: unknown): unknown {
    if (!this.config.enabled) {
      return value;
    }

    if (typeof value === 'string') {
      return scrubString(value);
    }

    if (typeof value === 'object' && value !== null) {
      return scrubObject(
        value,
        this.sensitiveFields,
        0,
        this.config.maxDepth ?? 10,
        this.config.scrubKeys
      );
    }

    return value;
  }

  /**
   * Scrubs sensitive data from a log message and metadata.
   *
   * @param message - The log message
   * @param meta - Additional metadata to scrub
   * @returns Object with scrubbed message and metadata
   */
  scrubLog(
    message: string,
    meta?: Record<string, unknown>
  ): { message: string; meta?: Record<string, unknown> } {
    const scrubbedMessage = this.config.enabled ? scrubString(message) : message;

    if (!meta) {
      return { message: scrubbedMessage };
    }

    const scrubbedMeta = this.scrub(meta) as Record<string, unknown>;

    return {
      message: scrubbedMessage,
      meta: scrubbedMeta,
    };
  }

  /**
   * Checks if scrubbing is enabled for a specific log level.
   * If per-level configuration is not set, falls back to global enabled setting.
   *
   * @param level - The log level to check
   * @returns Whether scrubbing is enabled for the level
   */
  isEnabledForLevel(level: LogScrubberLevel): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const levelConfig = this.config.scrubByLevel?.[level];
    if (levelConfig !== undefined) {
      return levelConfig.enabled;
    }

    // Default to enabled if per-level config not set
    return true;
  }

  /**
   * Checks if scrubbing should be applied for a specific output type.
   * If scrubOutputs is not configured, scrubbing is applied to all outputs.
   *
   * @param output - The output type to check (console or file)
   * @returns Whether scrubbing should be applied for the output
   */
  isEnabledForOutput(output: 'console' | 'file'): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (!this.config.scrubOutputs || this.config.scrubOutputs.length === 0) {
      // If not configured, apply to all outputs
      return true;
    }

    return this.config.scrubOutputs.includes(output);
  }

  /**
   * Scrubs sensitive data from a log message with log level context.
   * Uses per-level configuration to determine scrubbing behavior.
   *
   * @param message - The log message
   * @param level - The log level
   * @param meta - Additional metadata to scrub
   * @returns Object with scrubbed message and metadata
   */
  scrubLogByLevel(
    message: string,
    level: LogScrubberLevel,
    meta?: Record<string, unknown>
  ): { message: string; meta?: Record<string, unknown> } {
    if (!this.isEnabledForLevel(level)) {
      return { message, meta };
    }

    const scrubbedMessage = scrubString(message);

    if (!meta) {
      return { message: scrubbedMessage };
    }

    const scrubbedMeta = this.scrub(meta) as Record<string, unknown>;

    return {
      message: scrubbedMessage,
      meta: scrubbedMeta,
    };
  }
}

/**
 * Default log scrubber instance with standard configuration.
 */
export const logScrubber = new LogScrubber();

/**
 * Convenience function to scrub a value using the default instance.
 *
 * @param value - The value to scrub
 * @returns Scrubbed value
 */
export function scrubSensitiveData<T>(value: T): T {
  return logScrubber.scrub(value) as T;
}

export type { LogScrubberConfig as LogScrubberOptions };
