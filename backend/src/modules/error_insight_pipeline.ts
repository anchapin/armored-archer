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

import { randomUUID } from 'crypto';
import { Runtime } from '../types/nakama';
import { config } from '../config';
import { logger } from '../config/logger';
import {
  RawErrorData,
  ErrorPattern,
  ErrorInsight,
  ErrorSummary,
  ErrorDashboardData,
  PipelineStats,
  ErrorSeverity,
  ErrorSource,
  InsightPriority,
  InsightImpact,
  TimeRange,
  TrendData,
  ErrorInsightConfig,
} from '../types/errorInsights';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

/**
 * In-memory error data store
 */
class ErrorInsightStore {
  private errors: RawErrorData[] = [];
  private patterns: Map<string, ErrorPattern> = new Map();
  private insights: ErrorInsight[] = [];
  private startTime: Date = new Date();
  private lastErrorProcessed?: Date;

  /**
   * Add an error to the store
   */
  addError(error: RawErrorData): void {
    this.errors.push(error);
    this.lastErrorProcessed = new Date();

    // Trim old errors if needed (keep last 10000)
    if (this.errors.length > 10000) {
      this.errors = this.errors.slice(-10000);
    }
  }

  /**
   * Get all errors within a time range
   */
  getErrorsInRange(startTime: Date, endTime: Date): RawErrorData[] {
    return this.errors.filter(
      (e) => new Date(e.timestamp) >= startTime && new Date(e.timestamp) <= endTime
    );
  }

  /**
   * Get all patterns
   */
  getPatterns(): ErrorPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Add or update a pattern
   */
  upsertPattern(pattern: ErrorPattern): void {
    this.patterns.set(pattern.patternId, pattern);
  }

  /**
   * Get all insights
   */
  getInsights(): ErrorInsight[] {
    return this.insights;
  }

  /**
   * Add an insight
   */
  addInsight(insight: ErrorInsight): void {
    this.insights.unshift(insight);

    // Keep only maxInsights
    const maxInsights = config.errorInsights.maxInsights;
    if (this.insights.length > maxInsights) {
      this.insights = this.insights.slice(0, maxInsights);
    }
  }

  /**
   * Get pipeline statistics
   */
  getStats(): PipelineStats {
    const now = new Date();
    const uptimeMs = now.getTime() - this.startTime.getTime();
    const uptimeSec = Math.floor(uptimeMs / 1000);

    // Calculate errors per minute
    const recentErrors = this.getErrorsInRange(
      new Date(now.getTime() - 5 * 60 * 1000),
      now
    );
    const errorsPerMinute = recentErrors.length / 5;

    return {
      totalErrorsProcessed: this.errors.length,
      totalPatternsIdentified: this.patterns.size,
      totalInsightsGenerated: this.insights.length,
      uptime: this.formatUptime(uptimeSec),
      lastErrorProcessed: this.lastErrorProcessed?.toISOString(),
      errorsPerMinute: Math.round(errorsPerMinute * 10) / 10,
    };
  }

  /**
   * Format uptime string
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Clear old patterns that have expired TTL
   */
  cleanupExpiredPatterns(): void {
    const ttlMs = config.errorInsights.patternTtlDays * 24 * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - ttlMs);

    for (const [patternId, pattern] of this.patterns) {
      if (new Date(pattern.lastSeen) < cutoffTime) {
        this.patterns.delete(patternId);
      }
    }
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.errors = [];
    this.patterns.clear();
    this.insights = [];
  }
}

// Global store instance
const errorStore = new ErrorInsightStore();

/**
 * Generate a signature for an error to identify patterns
 */
function generateErrorSignature(error: RawErrorData): string {
  // Create a signature based on error type, RPC, and normalized message
  const parts = [
    error.errorType,
    error.rpcName || 'unknown',
    error.source,
  ];

  // Normalize message by removing specific values
  let normalizedMessage = error.message;
  // Remove UUIDs
  normalizedMessage = normalizedMessage.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '<UUID>'
  );
  // Remove numbers
  normalizedMessage = normalizedMessage.replace(/\d+/g, '<N>');
  // Remove file paths
  normalizedMessage = normalizedMessage.replace(/\/[\w/.-]+/g, '<PATH>');

  parts.push(normalizedMessage.substring(0, 100));

  // Simple hash
  let hash = 0;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Detect error source from error characteristics
 */
function detectErrorSource(error: RawErrorData): ErrorSource {
  if (error.source !== 'unknown') {
    return error.source;
  }

  const message = error.message.toLowerCase();
  const stack = error.stack?.toLowerCase() || '';

  if (message.includes('database') || message.includes('postgres') || stack.includes('db_')) {
    return 'database';
  }
  if (message.includes('cache') || message.includes('redis')) {
    return 'cache';
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return 'validation';
  }
  if (message.includes('nakama') || message.includes('rpc')) {
    return 'nakama';
  }
  if (message.includes('external') || message.includes('api')) {
    return 'external';
  }

  return 'unknown';
}

/**
 * Determine error severity
 */
function determineSeverity(error: RawErrorData): ErrorSeverity {
  if (error.severity !== 'info') {
    return error.severity;
  }

  const message = error.message.toLowerCase();
  const stack = error.stack || '';

  // Critical patterns
  if (
    message.includes('fatal') ||
    message.includes('crash') ||
    message.includes('out of memory') ||
    stack.includes('segmentation')
  ) {
    return 'critical';
  }

  // Error patterns
  if (
    message.includes('error') ||
    message.includes('exception') ||
    message.includes('failed')
  ) {
    return 'error';
  }

  // Warning patterns
  if (message.includes('warning') || message.includes('deprecated')) {
    return 'warning';
  }

  return 'info';
}

/**
 * Analyze errors and identify patterns
 */
function analyzePatterns(errors: RawErrorData[]): ErrorPattern[] {
  const patternMap = new Map<string, ErrorPattern>();

  for (const error of errors) {
    const signature = generateErrorSignature(error);
    const existingPattern = patternMap.get(signature);

    if (existingPattern) {
      // Update existing pattern
      existingPattern.count++;
      existingPattern.lastSeen = error.timestamp;

      if (error.rpcName && !existingPattern.affectedRpcs.includes(error.rpcName)) {
        existingPattern.affectedRpcs.push(error.rpcName);
      }
      if (error.userId && !existingPattern.affectedUsers.includes(error.userId)) {
        existingPattern.affectedUsers.push(error.userId);
      }
    } else {
      // Create new pattern
      const pattern: ErrorPattern = {
        patternId: randomUUID(),
        signature,
        count: 1,
        firstSeen: error.timestamp,
        lastSeen: error.timestamp,
        errorType: error.errorType,
        messageTemplate: error.message.substring(0, 200),
        affectedRpcs: error.rpcName ? [error.rpcName] : [],
        affectedUsers: error.userId ? [error.userId] : [],
        occurrencesPerHour: 0,
        severity: determineSeverity(error),
        source: detectErrorSource(error),
      };

      patternMap.set(signature, pattern);
    }
  }

  // Calculate occurrences per hour
  const now = new Date();
  for (const pattern of patternMap.values()) {
    const firstSeen = new Date(pattern.firstSeen);
    const hoursDiff = Math.max(1, (now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60));
    pattern.occurrencesPerHour = Math.round((pattern.count / hoursDiff) * 10) / 10;
  }

  return Array.from(patternMap.values());
}

/**
 * Generate insights from patterns
 */
function generateInsights(patterns: ErrorPattern[]): ErrorInsight[] {
  const insights: ErrorInsight[] = [];
  const minOccurrences = config.errorInsights.minOccurrencesForInsight;

  for (const pattern of patterns) {
    if (pattern.count < minOccurrences) {
      continue;
    }

    const insight = createInsightFromPattern(pattern);
    if (insight) {
      insights.push(insight);
    }
  }

  return insights;
}

/**
 * Create an insight from a pattern
 */
function createInsightFromPattern(pattern: ErrorPattern): ErrorInsight | null {
  const recommendations = generateRecommendations(pattern);
  const impact = assessImpact(pattern);

  // Determine priority based on severity and count
  let priority: InsightPriority;
  if (pattern.severity === 'critical' || pattern.count > 100) {
    priority = 'critical';
  } else if (pattern.severity === 'error' || pattern.count > 50) {
    priority = 'high';
  } else if (pattern.severity === 'warning' || pattern.count > 10) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  const insight: ErrorInsight = {
    id: randomUUID(),
    generatedAt: new Date().toISOString(),
    patternId: pattern.patternId,
    title: generateInsightTitle(pattern),
    description: generateInsightDescription(pattern),
    priority,
    recommendations,
    impact,
    actionable: recommendations.length > 0,
    errorCount: pattern.count,
    affectedUserCount: pattern.affectedUsers.length,
  };

  return insight;
}

/**
 * Generate insight title
 */
function generateInsightTitle(pattern: ErrorPattern): string {
  const sourceLabel = pattern.source.charAt(0).toUpperCase() + pattern.source.slice(1);

  switch (pattern.source) {
    case 'database':
      return `Database Errors in ${pattern.affectedRpcs.join(', ') || 'operations'}`;
    case 'cache':
      return `Cache Issues Affecting ${pattern.affectedRpcs.join(', ') || 'operations'}`;
    case 'validation':
      return `Validation Errors in ${pattern.affectedRpcs.join(', ') || 'input processing'}`;
    case 'nakama':
      return `Server Errors in ${pattern.affectedRpcs.join(', ') || 'RPC calls'}`;
    case 'external':
      return `External Service Errors (${sourceLabel})`;
    default:
      return `Recurring Error: ${pattern.errorType}`;
  }
}

/**
 * Generate insight description
 */
function generateInsightDescription(pattern: ErrorPattern): string {
  const timeSpan = getTimeSpanDescription(pattern.firstSeen, pattern.lastSeen);
  const userCount = pattern.affectedUsers.length;

  let description = `This error pattern has occurred ${pattern.count} times over ${timeSpan}.`;

  if (userCount > 0) {
    description += ` Affecting approximately ${userCount} unique user(s).`;
  }

  if (pattern.affectedRpcs.length > 0) {
    description += ` Primarily affecting: ${pattern.affectedRpcs.join(', ')}.`;
  }

  description += `\n\nError type: ${pattern.errorType}`;
  description += `\nSource: ${pattern.source}`;

  return description;
}

/**
 * Get time span description
 */
function getTimeSpanDescription(firstSeen: string, lastSeen: string): string {
  const start = new Date(firstSeen);
  const end = new Date(lastSeen);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins} minute(s)`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour(s)`;
  }
  return `${diffDays} day(s)`;
}

/**
 * Assess impact of a pattern
 */
function assessImpact(pattern: ErrorPattern): InsightImpact {
  const userPercentage = Math.min(100, Math.round((pattern.affectedUsers.length / 1000) * 100));

  let userImpact = 'Minimal user impact';
  let systemImpact = 'Low system impact';

  if (pattern.severity === 'critical') {
    userImpact = 'Users experiencing service disruption or crashes';
    systemImpact = 'Potential service degradation or outage';
  } else if (pattern.severity === 'error') {
    userImpact = 'Users experiencing failed operations';
    systemImpact = 'Increased error rates affecting service reliability';
  } else if (pattern.severity === 'warning') {
    userImpact = 'Some users experiencing issues';
    systemImpact = 'Minor performance degradation';
  }

  return {
    userImpact,
    systemImpact,
    affectedPercentage: pattern.affectedUsers.length > 0 ? userPercentage : undefined,
  };
}

/**
 * Generate recommendations based on pattern
 */
function generateRecommendations(pattern: ErrorPattern): string[] {
  const recommendations: string[] = [];

  switch (pattern.source) {
    case 'database':
      recommendations.push('Review database query performance and add indexes where needed');
      recommendations.push('Check for connection pool exhaustion');
      if (pattern.messageTemplate.toLowerCase().includes('timeout')) {
        recommendations.push('Increase database query timeout settings');
      }
      break;

    case 'cache':
      recommendations.push('Review cache eviction policies');
      recommendations.push('Check cache availability and memory limits');
      if (pattern.occurrencesPerHour > 10) {
        recommendations.push('Consider implementing circuit breaker pattern');
      }
      break;

    case 'validation':
      recommendations.push('Review client-side validation logic');
      recommendations.push('Add more descriptive error messages for users');
      recommendations.push('Consider implementing input sanitization');
      break;

    case 'nakama':
      recommendations.push('Review RPC handler implementation');
      recommendations.push('Check for race conditions in state management');
      if (pattern.affectedRpcs.length > 0) {
        recommendations.push(`Focus on fixing: ${pattern.affectedRpcs.join(', ')}`);
      }
      break;

    case 'external':
      recommendations.push('Monitor external service health');
      recommendations.push('Implement retry logic with exponential backoff');
      recommendations.push('Consider adding fallback mechanisms');
      break;

    default:
      recommendations.push('Investigate error root cause');
      recommendations.push('Add detailed logging around this operation');
  }

  // High frequency recommendation
  if (pattern.occurrencesPerHour > 50) {
    recommendations.unshift('URGENT: This error is occurring frequently - investigate immediately');
  }

  return recommendations;
}

/**
 * Calculate error trend data
 */
function calculateTrendData(errors: RawErrorData[], hours: number): TrendData[] {
  const now = new Date();
  const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const trendMap = new Map<string, number>();

  // Initialize all hours with 0
  for (let i = 0; i < hours; i++) {
    const hourTime = new Date(startTime.getTime() + i * 60 * 60 * 1000);
    const key = hourTime.toISOString().substring(0, 13); // YYYY-MM-DDTHH
    trendMap.set(key, 0);
  }

  // Count errors per hour
  for (const error of errors) {
    const errorTime = new Date(error.timestamp);
    if (errorTime >= startTime && errorTime <= now) {
      const key = errorTime.toISOString().substring(0, 13);
      trendMap.set(key, (trendMap.get(key) || 0) + 1);
    }
  }

  // Convert to array
  const trends: TrendData[] = [];
  for (const [timestamp, count] of trendMap) {
    trends.push({
      timestamp: timestamp + ':00:00Z',
      count,
    });
  }

  return trends.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Get error summary
 */
function getErrorSummary(timeRange: TimeRange): ErrorSummary {
  const startTime = new Date(timeRange.startTime);
  const endTime = new Date(timeRange.endTime);

  const errors = errorStore.getErrorsInRange(startTime, endTime);
  const patterns = errorStore.getPatterns();
  const insights = errorStore.getInsights();

  // Calculate errors by severity
  const errorsBySeverity: Record<ErrorSeverity, number> = {
    critical: 0,
    error: 0,
    warning: 0,
    info: 0,
  };

  // Calculate errors by source
  const errorsBySource: Record<ErrorSource, number> = {
    nakama: 0,
    database: 0,
    cache: 0,
    external: 0,
    validation: 0,
    unknown: 0,
  };

  for (const error of errors) {
    errorsBySeverity[error.severity]++;
    errorsBySource[error.source]++;
  }

  // Sort patterns by count
  const topPatterns = [...patterns].sort((a, b) => b.count - a.count).slice(0, 10);

  // Recent insights
  const recentInsights = insights.slice(0, 5);

  // Calculate trend (last 24 hours)
  const hours = Math.min(
    24,
    Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60))
  );
  const errorTrend = calculateTrendData(errors, hours);

  return {
    totalErrors: errors.length,
    errorsBySeverity,
    errorsBySource,
    topPatterns,
    recentInsights,
    errorTrend,
    timeRange,
  };
}

/**
 * Get dashboard data
 */
function getDashboardData(): ErrorDashboardData {
  const now = new Date();
  const hours = config.errorInsights.insightWindowHours;
  const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const timeRange: TimeRange = {
    startTime: startTime.toISOString(),
    endTime: now.toISOString(),
  };

  return {
    summary: getErrorSummary(timeRange),
    patterns: errorStore.getPatterns(),
    insights: errorStore.getInsights(),
    lastUpdated: now.toISOString(),
    config: config.errorInsights,
  };
}

/**
 * Process errors and update patterns/insights
 */
function processErrors(): void {
  if (!config.errorInsights.enabled) {
    return;
  }

  const now = new Date();
  const windowMs = config.errorInsights.aggregationWindowMinutes * 60 * 1000;
  const startTime = new Date(now.getTime() - windowMs);

  // Get errors in current window
  const recentErrors = errorStore.getErrorsInRange(startTime, now);

  if (recentErrors.length === 0) {
    return;
  }

  // Analyze patterns
  const patterns = analyzePatterns(recentErrors);

  // Update patterns in store
  for (const pattern of patterns) {
    const existingPatterns = errorStore.getPatterns();
    const existing = existingPatterns.find((p) => p.signature === pattern.signature);

    if (existing) {
      // Merge with existing
      existing.count += pattern.count;
      existing.lastSeen = pattern.lastSeen;
      for (const rpc of pattern.affectedRpcs) {
        if (!existing.affectedRpcs.includes(rpc)) {
          existing.affectedRpcs.push(rpc);
        }
      }
      for (const user of pattern.affectedUsers) {
        if (!existing.affectedUsers.includes(user)) {
          existing.affectedUsers.push(user);
        }
      }
      errorStore.upsertPattern(existing);
    } else {
      errorStore.upsertPattern(pattern);
    }
  }

  // Generate insights
  const newInsights = generateInsights(patterns);

  for (const insight of newInsights) {
    // Check if similar insight already exists
    const existingInsights = errorStore.getInsights();
    const exists = existingInsights.some(
      (i) => i.patternId === insight.patternId
    );

    if (!exists) {
      errorStore.addInsight(insight);

      // Log new insight
      logger.warn('New error insight generated', {
        insightId: insight.id,
        title: insight.title,
        priority: insight.priority,
        errorCount: insight.errorCount,
        operation: 'error_insight_generated',
      });
    }
  }

  // Cleanup expired patterns
  errorStore.cleanupExpiredPatterns();
}

/**
 * Collect an error from log data
 */
export function collectError(
  error: Error,
  context: {
    rpcName?: string;
    userId?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
    source?: ErrorSource;
    severity?: ErrorSeverity;
  }
): void {
  if (!config.errorInsights.enabled) {
    return;
  }

  const rawError: RawErrorData = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    errorType: error.constructor.name,
    rpcName: context.rpcName,
    userId: context.userId,
    requestId: context.requestId,
    metadata: context.metadata,
    severity: context.severity || determineSeverityFromError(error),
    source: context.source || 'unknown',
  };

  // Update source based on error characteristics
  rawError.source = detectErrorSource(rawError);
  rawError.severity = determineSeverity(rawError);

  errorStore.addError(rawError);

  // Process errors periodically
  processErrors();
}

/**
 * Determine severity from error
 */
function determineSeverityFromError(error: Error): ErrorSeverity {
  const message = error.message.toLowerCase();

  if (message.includes('fatal') || message.includes('crash')) {
    return 'critical';
  }
  if (message.includes('error') || message.includes('exception')) {
    return 'error';
  }
  if (message.includes('warning')) {
    return 'warning';
  }
  return 'info';
}

/**
 * Register RPC handlers for error insights
 */
export function registerErrorInsightRpcs(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/error_insights_dashboard', rpcGetErrorDashboard);
  initializer.registerRpc('armored_archer/error_insights_summary', rpcGetErrorSummary);
  initializer.registerRpc('armored_archer/error_insights_patterns', rpcGetErrorPatterns);
  initializer.registerRpc('armored_archer/error_insights_stats', rpcGetErrorStats);
  initializer.registerRpc('armored_archer/error_insights_dismiss', rpcDismissInsight);
}

/**
 * RPC: Get error dashboard data
 */
async function rpcGetErrorDashboard(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Error insights dashboard requested by user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.health_check, payload, 'error_insights_dashboard');
  if (!validation.success && payload) {
    return createValidationErrorResponse('error_insights_dashboard', validation.error);
  }

  const dashboardData = getDashboardData();
  return JSON.stringify(dashboardData);
}

/**
 * RPC: Get error summary
 */
async function rpcGetErrorSummary(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Error insights summary requested by user: %s', ctx.userId);

  // Parse time range from payload if provided
  let timeRange: TimeRange;
  try {
    if (payload) {
      const parsed = JSON.parse(payload);
      timeRange = {
        startTime: parsed.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endTime: parsed.endTime || new Date().toISOString(),
      };
    } else {
      const hours = config.errorInsights.insightWindowHours;
      timeRange = {
        startTime: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString(),
      };
    }
  } catch {
    const hours = config.errorInsights.insightWindowHours;
    timeRange = {
      startTime: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
      endTime: new Date().toISOString(),
    };
  }

  const summary = getErrorSummary(timeRange);
  return JSON.stringify(summary);
}

/**
 * RPC: Get error patterns
 */
async function rpcGetErrorPatterns(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Error insights patterns requested by user: %s', ctx.userId);

  const patterns = errorStore.getPatterns();

  // Sort by count descending
  const sorted = [...patterns].sort((a, b) => b.count - a.count);

  // Limit results
  const limit = config.errorInsights.maxPatterns;
  return JSON.stringify(sorted.slice(0, limit));
}

/**
 * RPC: Get pipeline statistics
 */
async function rpcGetErrorStats(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Error insights stats requested by user: %s', ctx.userId);

  const stats = errorStore.getStats();
  return JSON.stringify(stats);
}

/**
 * RPC: Dismiss an insight
 */
async function rpcDismissInsight(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Error insight dismiss requested by user: %s', ctx.userId);

  if (!payload) {
    return JSON.stringify({ success: false, error: 'Missing insight ID' });
  }

  try {
    const { insightId } = JSON.parse(payload);

    if (!insightId) {
      return JSON.stringify({ success: false, error: 'Missing insight ID' });
    }

    const insights = errorStore.getInsights();
    const index = insights.findIndex((i) => i.id === insightId);

    if (index === -1) {
      return JSON.stringify({ success: false, error: 'Insight not found' });
    }

    // Remove the insight
    insights.splice(index, 1);

    return JSON.stringify({ success: true });
  } catch {
    return JSON.stringify({ success: false, error: 'Invalid payload' });
  }
}

/**
 * Initialize the error insight pipeline
 */
export function initializeErrorInsightsPipeline(_logger: Runtime.Logger): void {
  if (!config.errorInsights.enabled) {
    logger.info('Error Insights Pipeline is disabled');
    return;
  }

  logger.info('Initializing Error Insights Pipeline', {
    aggregationWindowMinutes: config.errorInsights.aggregationWindowMinutes,
    minOccurrencesForInsight: config.errorInsights.minOccurrencesForInsight,
    insightWindowHours: config.errorInsights.insightWindowHours,
    maxPatterns: config.errorInsights.maxPatterns,
    maxInsights: config.errorInsights.maxInsights,
  });

  // Log initialization
  logger.info('Error Insights Pipeline initialized successfully', {
    operation: 'error_insights_init',
  });
}

/**
 * Get the error store for testing
 */
export function getErrorStore(): ErrorInsightStore {
  return errorStore;
}
