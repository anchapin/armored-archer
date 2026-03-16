/**
 * Error to Insight Pipeline
 *
 * This module provides an automated pipeline that transforms raw error data
 * into meaningful patterns and recommendations for the Armored Archer backend.
 *
 * Features:
 * - Collect error data from logs
 * - Aggregate and analyze error patterns
 * - Generate insights and recommendations
 * - Provide RPC endpoints for error analysis dashboard
 */
import { RawErrorData, ErrorPattern, ErrorInsight, PipelineStats, ErrorSeverity, ErrorSource } from '../types/errorInsights';
import { Runtime } from '../types/nakama';
/**
 * In-memory error data store
 */
declare class ErrorInsightStore {
    private errors;
    private patterns;
    private insights;
    private startTime;
    private lastErrorProcessed?;
    /**
     * Add an error to the store
     */
    addError(error: RawErrorData): void;
    /**
     * Get all errors within a time range
     */
    getErrorsInRange(startTime: Date, endTime: Date): RawErrorData[];
    /**
     * Get all patterns
     */
    getPatterns(): ErrorPattern[];
    /**
     * Add or update a pattern
     */
    upsertPattern(pattern: ErrorPattern): void;
    /**
     * Get all insights
     */
    getInsights(): ErrorInsight[];
    /**
     * Add an insight
     */
    addInsight(insight: ErrorInsight): void;
    /**
     * Get pipeline statistics
     */
    getStats(): PipelineStats;
    /**
     * Format uptime string
     */
    private formatUptime;
    /**
     * Clear old patterns that have expired TTL
     */
    cleanupExpiredPatterns(): void;
    /**
     * Clear all data (for testing)
     */
    clear(): void;
}
/**
 * Collect an error from log data
 */
export declare function collectError(error: Error, context: {
    rpcName?: string;
    userId?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
    source?: ErrorSource;
    severity?: ErrorSeverity;
}): void;
/**
 * Register RPC handlers for error insights
 */
export declare function registerErrorInsightRpcs(initializer: Runtime.Initializer): void;
/**
 * Initialize the error insight pipeline
 */
export declare function initializeErrorInsightsPipeline(_logger: Runtime.Logger): void;
/**
 * Get the error store for testing
 */
export declare function getErrorStore(): ErrorInsightStore;
export {};
