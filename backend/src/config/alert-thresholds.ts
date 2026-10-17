/**
 * Alert threshold type definitions shared by the alerting system
 * (alerting.ts) and the app config shape (index.ts).
 * Extracted to remove duplicated interface field lists
 * (jscpd clone cleanup, issue #1640).
 */

/**
 * Health check alert thresholds
 */
export interface HealthAlertThresholds {
  /** CPU usage percentage that triggers warning */
  cpuWarningPercent: number;
  /** CPU usage percentage that triggers critical */
  cpuCriticalPercent: number;
  /** Memory usage percentage that triggers warning */
  memoryWarningPercent: number;
  /** Memory usage percentage that triggers critical */
  memoryCriticalPercent: number;
  /** Database connection usage percentage that triggers warning */
  dbConnectionsWarningPercent: number;
  /** Database connection usage percentage that triggers critical */
  dbConnectionsCriticalPercent: number;
  /** Disk usage percentage that triggers warning */
  diskWarningPercent: number;
  /** Disk usage percentage that triggers critical */
  diskCriticalPercent: number;
  /** Response time in ms that triggers warning */
  responseTimeWarningMs: number;
  /** Response time in ms that triggers critical */
  responseTimeCriticalMs: number;
  /** Error rate percentage that triggers warning */
  errorRateWarningPercent: number;
  /** Error rate percentage that triggers critical */
  errorRateCriticalPercent: number;
}

/**
 * Metric-based alert thresholds
 */
export interface MetricAlertThresholds {
  /** Active connections warning threshold */
  activeConnectionsWarning: number;
  /** Active connections critical threshold */
  activeConnectionsCritical: number;
  /** Match queue size warning threshold */
  matchQueueWarning: number;
  /** Match queue size critical threshold */
  matchQueueCritical: number;
  /** Match wait time warning in seconds */
  matchWaitTimeWarningSec: number;
  /** Match wait time critical in seconds */
  matchWaitTimeCriticalSec: number;
  /** Database query time warning in ms */
  dbQueryTimeWarningMs: number;
  /** Database query time critical in ms */
  dbQueryTimeCriticalMs: number;
  /** Failed logins warning threshold per minute */
  failedLoginsWarning: number;
  /** Failed logins critical threshold per minute */
  failedLoginsCritical: number;
  /** Purchase failures warning threshold per minute */
  purchaseFailuresWarning: number;
  /** Purchase failures critical threshold per minute */
  purchaseFailuresCritical: number;
}
