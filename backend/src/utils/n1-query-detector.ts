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

class N1QueryDetectorClass {
  private queryLog: QueryInfo[] = [];
  private enabled: boolean = process.env.NODE_ENV !== 'production';
  private threshold: number = 5; // Warn if more than 5 queries per operation

  /**
   * Enable or disable query tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set the threshold for N+1 detection
   * @param threshold - Number of queries that triggers warning
   */
  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  /**
   * Log a query execution
   */
  logQuery(sql: string, duration?: number, stackTrace?: string): void {
    if (!this.enabled) return;

    this.queryLog.push({
      sql: this.sanitizeSql(sql),
      timestamp: Date.now(),
      duration,
      stackTrace,
    });
  }

  /**
   * Track and analyze queries for an operation
   */
  async track<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return operation();
    }

    const previousLogLength = this.queryLog.length;
    const startTime = Date.now();

    try {
      const result = await operation();
      return result;
    } finally {
      const queries = this.queryLog.slice(previousLogLength);
      // Track operation duration for analysis
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const operationDuration = Date.now() - startTime;

      // Mark queries with duration for analysis
      queries.forEach((q, i) => {
        if (i > 0 && queries[i - 1].duration) {
          q.duration = q.timestamp - queries[i - 1].timestamp;
        }
      });
    }
  }

  /**
   * Analyze logged queries for N+1 patterns
   */
  analyze(): N1QueryResult {
    // Simple heuristic: detect repeated similar SELECT queries
    const selectQueries = this.queryLog.filter((q) =>
      q.sql.trim().toUpperCase().startsWith('SELECT')
    );

    const queryPatterns = new Map<string, number>();
    const n1Queries: string[] = [];

    for (const query of selectQueries) {
      // Extract table name from query
      const tableMatch = query.sql.match(/FROM\s+(\w+)/i);
      if (tableMatch) {
        const table = tableMatch[1].toLowerCase();
        const count = queryPatterns.get(table) || 0;
        queryPatterns.set(table, count + 1);

        // If same table is queried more than threshold times, flag as N+1
        if (count + 1 > this.threshold && !n1Queries.includes(table)) {
          n1Queries.push(table);
        }
      }
    }

    return {
      totalQueries: this.queryLog.length,
      n1Queries,
      queries: [...this.queryLog],
      maxQueriesPerOperation: Math.max(...queryPatterns.values(), 0),
    };
  }

  /**
   * Clear the query log
   */
  clear(): void {
    this.queryLog = [];
  }

  /**
   * Get recent queries
   */
  getRecentQueries(count: number = 10): QueryInfo[] {
    return this.queryLog.slice(-count);
  }

  /**
   * Sanitize SQL for logging (remove sensitive values)
   */
  private sanitizeSql(sql: string): string {
    // Remove string literals to avoid logging sensitive data
    return sql.replace(/'[^']*'/g, '?');
  }
}

export const N1QueryDetector = new N1QueryDetectorClass();
export default N1QueryDetector;
