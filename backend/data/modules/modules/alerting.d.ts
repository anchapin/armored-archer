/**
 * Alerting Service Module
 *
 * This module provides alerting capabilities for production incidents and system health:
 * - Health check alerts (CPU, memory, disk, database connections)
 * - Metric-based alerts (active connections, match queue, response times)
 * - Integration with multiple alert providers (PagerDuty, Slack, webhook, email)
 * - Alert cooldowns to prevent alert fatigue
 * - Integration with Sentry for error alerting
 */
import { AlertSeverity } from '../config/alerting';
import { Runtime } from '../types/nakama';
/**
 * Alert payload structure
 */
export interface AlertPayload {
    title: string;
    message: string;
    severity: AlertSeverity;
    tags: Record<string, string>;
    metrics?: Record<string, number>;
    timestamp: number;
    source: string;
}
/**
 * Initialize the alerting service
 */
export declare function initializeAlerting(logger: Runtime.Logger): void;
/**
 * Send an alert with the given parameters
 */
export declare function sendAlert(title: string, message: string, severity: AlertSeverity, tags?: Record<string, string>, metrics?: Record<string, number>): Promise<void>;
/**
 * Trigger health alert based on metric threshold
 */
export declare function triggerHealthAlert(metricName: string, value: number, currentMetrics: Record<string, number>): void;
/**
 * Trigger metric alert based on custom threshold
 */
export declare function triggerMetricAlert(metricName: string, value: number, threshold: number, severity: AlertSeverity, additionalTags?: Record<string, string>): void;
/**
 * Send error alert with context
 */
export declare function sendErrorAlert(error: Error, context?: {
    userId?: string;
    rpc?: string;
    extra?: Record<string, unknown>;
}): void;
/**
 * Get alert statistics
 */
export declare function getAlertStats(): Record<string, {
    lastAlertTime: number;
    alertCount: number;
}>;
/**
 * Clear alert state (useful for testing)
 */
export declare function clearAlertState(): void;
