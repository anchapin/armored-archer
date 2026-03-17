/**
 * Log Scrubbing Module
 *
 * Provides functionality to scrub sensitive data from log messages before they are written.
 * This prevents sensitive information such as passwords, tokens, and personal identifiable
 * information (PII) from being exposed in logs.
 */
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
    customPatterns?: Array<{
        pattern: RegExp;
        replacement: string;
    }>;
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
export declare const defaultLogScrubberConfig: LogScrubberConfig;
/**
 * Log scrubber class that provides methods to scrub sensitive data from logs.
 */
export declare class LogScrubber {
    private config;
    private sensitiveFields;
    /**
     * Creates a new LogScrubber instance.
     *
     * @param config - Configuration options for log scrubbing
     */
    constructor(config?: Partial<LogScrubberConfig>);
    /**
     * Updates the scrubber configuration.
     *
     * @param config - New configuration options
     */
    updateConfig(config: Partial<LogScrubberConfig>): void;
    /**
     * Gets the current configuration.
     *
     * @returns Current configuration
     */
    getConfig(): LogScrubberConfig;
    /**
     * Checks if scrubbing is enabled.
     *
     * @returns Whether scrubbing is enabled
     */
    isEnabled(): boolean;
    /**
     * Enables log scrubbing.
     */
    enable(): void;
    /**
     * Disables log scrubbing.
     */
    disable(): void;
    /**
     * Scrubs sensitive data from a value.
     *
     * @param value - The value to scrub (string, object, array, etc.)
     * @returns Scrubbed value
     */
    scrub(value: unknown): unknown;
    /**
     * Scrubs sensitive data from a log message and metadata.
     *
     * @param message - The log message
     * @param meta - Additional metadata to scrub
     * @returns Object with scrubbed message and metadata
     */
    scrubLog(message: string, meta?: Record<string, unknown>): {
        message: string;
        meta?: Record<string, unknown>;
    };
    /**
     * Checks if scrubbing is enabled for a specific log level.
     * If per-level configuration is not set, falls back to global enabled setting.
     *
     * @param level - The log level to check
     * @returns Whether scrubbing is enabled for the level
     */
    isEnabledForLevel(level: LogScrubberLevel): boolean;
    /**
     * Checks if scrubbing should be applied for a specific output type.
     * If scrubOutputs is not configured, scrubbing is applied to all outputs.
     *
     * @param output - The output type to check (console or file)
     * @returns Whether scrubbing should be applied for the output
     */
    isEnabledForOutput(output: 'console' | 'file'): boolean;
    /**
     * Scrubs sensitive data from a log message with log level context.
     * Uses per-level configuration to determine scrubbing behavior.
     *
     * @param message - The log message
     * @param level - The log level
     * @param meta - Additional metadata to scrub
     * @returns Object with scrubbed message and metadata
     */
    scrubLogByLevel(message: string, level: LogScrubberLevel, meta?: Record<string, unknown>): {
        message: string;
        meta?: Record<string, unknown>;
    };
}
/**
 * Default log scrubber instance with standard configuration.
 */
export declare const logScrubber: LogScrubber;
/**
 * Convenience function to scrub a value using the default instance.
 *
 * @param value - The value to scrub
 * @returns Scrubbed value
 */
export declare function scrubSensitiveData<T>(value: T): T;
export type { LogScrubberConfig as LogScrubberOptions };
