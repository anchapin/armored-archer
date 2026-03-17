import type { AppConfig } from './index';
/**
 * Alert severity levels
 */
export type AlertSeverity = 'critical' | 'error' | 'warning' | 'info';
/**
 * Alert provider types
 */
export type AlertProvider = 'pagerduty' | 'slack' | 'webhook' | 'email' | 'none';
/**
 * PagerDuty configuration
 */
export interface PagerDutyConfig {
    apiKey: string;
    serviceId: string;
    integrationKey: string;
}
export type { AppConfig };
/**
 * Slack configuration
 */
export interface SlackConfig {
    webhookUrl: string;
    channel: string;
    username: string;
    iconEmoji: string;
}
/**
 * Generic webhook configuration
 */
export interface WebhookConfig {
    url: string;
    method: 'POST' | 'PUT';
    headers: Record<string, string>;
    authType: 'none' | 'basic' | 'bearer';
    username?: string;
    password?: string;
    token?: string;
}
/**
 * Email notification configuration
 */
export interface EmailConfig {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    from: string;
    to: string[];
}
/**
 * Alert routing configuration
 * Maps specific alert types to providers
 */
export interface AlertRouting {
    /** Provider to use for critical alerts */
    critical: AlertProvider;
    /** Provider to use for error alerts */
    error: AlertProvider;
    /** Provider to use for warning alerts */
    warning: AlertProvider;
    /** Provider to use for info alerts */
    info: AlertProvider;
}
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
/**
 * Alert cooldown periods (in seconds)
 * Prevents alert fatigue by limiting how often the same alert can be sent
 */
export interface AlertCooldowns {
    /** Cooldown for critical alerts (default: 300s = 5 minutes) */
    critical: number;
    /** Cooldown for error alerts (default: 600s = 10 minutes) */
    error: number;
    /** Cooldown for warning alerts (default: 900s = 15 minutes) */
    warning: number;
    /** Cooldown for info alerts (default: 1800s = 30 minutes) */
    info: number;
}
/**
 * Complete alerting configuration
 */
export interface AlertingConfig {
    /** Enable or disable alerting system */
    enabled: boolean;
    /** Default provider to use when not specified in routing */
    defaultProvider: AlertProvider;
    /** Alert routing configuration */
    routing: AlertRouting;
    /** PagerDuty configuration */
    pagerduty?: PagerDutyConfig;
    /** Slack configuration */
    slack?: SlackConfig;
    /** Generic webhook configuration */
    webhook?: WebhookConfig;
    /** Email configuration */
    email?: EmailConfig;
    /** Health check alert thresholds */
    healthAlerts: HealthAlertThresholds;
    /** Metric-based alert thresholds */
    metricAlerts: MetricAlertThresholds;
    /** Alert cooldown periods */
    cooldowns: AlertCooldowns;
    /** Minimum environment level to send alerts (development, staging, production) */
    minEnvironmentLevel: 'development' | 'staging' | 'production';
    /** Custom tags to include in all alerts */
    tags: Record<string, string>;
}
/**
 * Load alerting configuration from environment variables
 */
export declare const alertingConfig: AlertingConfig;
/**
 * Check if alerting is enabled for the current environment
 */
export declare function isAlertingEnabled(): boolean;
/**
 * Get the provider for a specific severity level
 */
export declare function getAlertProvider(severity: AlertSeverity): AlertProvider;
/**
 * Get cooldown period for a specific severity level
 */
export declare function getAlertCooldown(severity: AlertSeverity): number;
/**
 * Check if health alerts are enabled and should trigger
 */
export declare function shouldTriggerHealthAlert(metric: keyof AlertingConfig['healthAlerts'], value: number): AlertSeverity | null;
export default alertingConfig;
