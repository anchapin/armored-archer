/**
 * N+1 Query Detection Utility
 *
 * This utility provides infrastructure for detecting N+1 query patterns
 * in the database layer. It can be used during development and testing
 * to identify performance issues.
 *
 * Usage:
 *   import { N1QueryDetector } from './utils/n1-query-detector';
 *
 *   // Wrap database operations
 *   const result = await N1QueryDetector.track(async () => {
 *     const players = await getAllPlayers();
 *     for (const player of players) {
 *       // Each iteration triggers a separate query - N+1 pattern
 *       const stats = await getPlayerStats(player.id);
 *     }
 *   });
 *
 *   if (result.n1Queries.length > 0) {
 *     console.warn('N+1 queries detected:', result.n1Queries);
 *   }
 */
export interface QueryInfo {
    sql: string;
    timestamp: number;
    duration?: number;
    stackTrace?: string;
}
export interface N1QueryResult {
    totalQueries: number;
    n1Queries: string[];
    queries: QueryInfo[];
    maxQueriesPerOperation: number;
}
declare class N1QueryDetectorClass {
    private queryLog;
    private enabled;
    private threshold;
    /**
     * Enable or disable query tracking
     */
    setEnabled(enabled: boolean): void;
    /**
     * Set the threshold for N+1 detection
     * @param threshold - Number of queries that triggers warning
     */
    setThreshold(threshold: number): void;
    /**
     * Log a query execution
     */
    logQuery(sql: string, duration?: number, stackTrace?: string): void;
    /**
     * Track and analyze queries for an operation
     */
    track<T>(operation: () => Promise<T>): Promise<T>;
    /**
     * Analyze logged queries for N+1 patterns
     */
    analyze(): N1QueryResult;
    /**
     * Clear the query log
     */
    clear(): void;
    /**
     * Get recent queries
     */
    getRecentQueries(count?: number): QueryInfo[];
    /**
     * Sanitize SQL for logging (remove sensitive values)
     */
    private sanitizeSql;
}
export declare const N1QueryDetector: N1QueryDetectorClass;
export default N1QueryDetector;
