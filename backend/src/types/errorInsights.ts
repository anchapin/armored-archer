/**
 * Types for the Error to Insight Pipeline
 *
 * This module provides type definitions for collecting, analyzing,
 * and generating insights from error data in the Armored Archer backend.
 */

/**
 * Raw error data collected from logs
 */
export interface RawErrorData {
  /** Unique identifier for the error occurrence */
  id: string;
  /** Timestamp when the error occurred */
  timestamp: string;
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Error type/class */
  errorType: string;
  /** RPC name where error occurred */
  rpcName?: string;
  /** User ID that triggered the error */
  userId?: string;
  /** Request ID for tracking */
  requestId?: string;
  /** Additional context metadata */
  metadata?: Record<string, unknown>;
  /** Error severity level */
  severity: ErrorSeverity;
  /** Source of the error (e.g., 'nakama', 'database', 'cache') */
  source: ErrorSource;
}

/**
 * Error severity levels
 */
export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

/**
 * Error source categories
 */
export type ErrorSource = 'nakama' | 'database' | 'cache' | 'external' | 'validation' | 'unknown';

/**
 * Aggregated error pattern
 */
export interface ErrorPattern {
  /** Unique pattern identifier */
  patternId: string;
  /** Pattern signature (hash of error characteristics) */
  signature: string;
  /** Number of occurrences */
  count: number;
  /** First occurrence timestamp */
  firstSeen: string;
  /** Last occurrence timestamp */
  lastSeen: string;
  /** Error type for this pattern */
  errorType: string;
  /** Common error message template */
  messageTemplate: string;
  /** List of affected RPCs */
  affectedRpcs: string[];
  /** List of affected users */
  affectedUsers: string[];
  /** Average occurrences per hour */
  occurrencesPerHour: number;
  /** Severity of this pattern */
  severity: ErrorSeverity;
  /** Source of errors in this pattern */
  source: ErrorSource;
}

/**
 * Analyzed insight about error patterns
 */
export interface ErrorInsight {
  /** Unique insight identifier */
  id: string;
  /** Timestamp when insight was generated */
  generatedAt: string;
  /** Associated pattern ID */
  patternId: string;
  /** Insight title */
  title: string;
  /** Detailed description */
  description: string;
  /** Priority level */
  priority: InsightPriority;
  /** Recommended actions */
  recommendations: string[];
  /** Impact assessment */
  impact: InsightImpact;
  /** Whether the insight is actionable */
  actionable: boolean;
  /** Related error count */
  errorCount: number;
  /** Affected user count */
  affectedUserCount: number;
}

/**
 * Insight priority levels
 */
export type InsightPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Impact assessment for insights
 */
export interface InsightImpact {
  /** User impact description */
  userImpact: string;
  /** System impact description */
  systemImpact: string;
  /** Estimated affected percentage */
  affectedPercentage?: number;
  /** Estimated downtime if any */
  estimatedDowntime?: string;
}

/**
 * Error summary for dashboard
 */
export interface ErrorSummary {
  /** Total error count */
  totalErrors: number;
  /** Errors by severity */
  errorsBySeverity: Record<ErrorSeverity, number>;
  /** Errors by source */
  errorsBySource: Record<ErrorSource, number>;
  /** Top error patterns */
  topPatterns: ErrorPattern[];
  /** Recent insights */
  recentInsights: ErrorInsight[];
  /** Error trend data */
  errorTrend: TrendData[];
  /** Time range of the summary */
  timeRange: TimeRange;
}

/**
 * Time range for data queries
 */
export interface TimeRange {
  /** Start timestamp */
  startTime: string;
  /** End timestamp */
  endTime: string;
}

/**
 * Trend data point
 */
export interface TrendData {
  /** Timestamp */
  timestamp: string;
  /** Error count */
  count: number;
  /** Error type */
  type?: string;
}

/**
 * Pipeline configuration
 */
export interface ErrorInsightConfig {
  /** Whether the pipeline is enabled */
  enabled: boolean;
  /** Time window for error aggregation (in minutes) */
  aggregationWindowMinutes: number;
  /** Minimum occurrences to generate insight */
  minOccurrencesForInsight: number;
  /** Time window for insights (in hours) */
  insightWindowHours: number;
  /** Maximum patterns to track */
  maxPatterns: number;
  /** Maximum insights to retain */
  maxInsights: number;
  /** Whether to auto-resolve resolved patterns */
  autoResolvePatterns: boolean;
  /** Pattern TTL (in days) */
  patternTtlDays: number;
}

/**
 * Dashboard view model
 */
export interface ErrorDashboardData {
  /** Current error summary */
  summary: ErrorSummary;
  /** All tracked patterns */
  patterns: ErrorPattern[];
  /** All insights */
  insights: ErrorInsight[];
  /** Last update timestamp */
  lastUpdated: string;
  /** Configuration used */
  config: ErrorInsightConfig;
}

/**
 * Pipeline statistics
 */
export interface PipelineStats {
  /** Total errors processed */
  totalErrorsProcessed: number;
  /** Total patterns identified */
  totalPatternsIdentified: number;
  /** Total insights generated */
  totalInsightsGenerated: number;
  /** Pipeline uptime */
  uptime: string;
  /** Last error processed timestamp */
  lastErrorProcessed?: string;
  /** Errors per minute */
  errorsPerMinute: number;
}
