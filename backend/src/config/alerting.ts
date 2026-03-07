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
 * Parse boolean environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Parse number from environment variable with default
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse comma-separated string array from environment variable
 */
function parseStringArray(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim());
}

/**
 * Load alerting configuration from environment variables
 */
export const alertingConfig: AlertingConfig = {
  enabled: parseBoolean(process.env.ALERTING_ENABLED, false),
  defaultProvider: (process.env.ALERTING_DEFAULT_PROVIDER || 'none') as AlertProvider,
  routing: {
    critical: (process.env.ALERTING_ROUTING_CRITICAL || 'pagerduty') as AlertProvider,
    error: (process.env.ALERTING_ROUTING_ERROR || 'slack') as AlertProvider,
    warning: (process.env.ALERTING_ROUTING_WARNING || 'slack') as AlertProvider,
    info: (process.env.ALERTING_ROUTING_INFO || 'none') as AlertProvider,
  },
  pagerduty: process.env.PAGERDUTY_API_KEY
    ? {
        apiKey: process.env.PAGERDUTY_API_KEY || '',
        serviceId: process.env.PAGERDUTY_SERVICE_ID || '',
        integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY || '',
      }
    : undefined,
  slack: process.env.SLACK_WEBHOOK_URL
    ? {
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        channel: process.env.SLACK_CHANNEL || '#alerts',
        username: process.env.SLACK_USERNAME || 'Armored Archer Alert Bot',
        iconEmoji: process.env.SLACK_ICON_EMOJI || ':warning:',
      }
    : undefined,
  webhook: process.env.ALERT_WEBHOOK_URL
    ? {
        url: process.env.ALERT_WEBHOOK_URL || '',
        method: (process.env.ALERT_WEBHOOK_METHOD || 'POST') as 'POST' | 'PUT',
        headers: process.env.ALERT_WEBHOOK_HEADERS
          ? JSON.parse(process.env.ALERT_WEBHOOK_HEADERS)
          : { 'Content-Type': 'application/json' },
        authType: (process.env.ALERT_WEBHOOK_AUTH_TYPE || 'none') as 'none' | 'basic' | 'bearer',
        username: process.env.ALERT_WEBHOOK_USERNAME,
        password: process.env.ALERT_WEBHOOK_PASSWORD,
        token: process.env.ALERT_WEBHOOK_TOKEN,
      }
    : undefined,
  email: process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST || '',
        port: parseNumber(process.env.SMTP_PORT, 587),
        secure: parseBoolean(process.env.SMTP_SECURE, false),
        username: process.env.SMTP_USERNAME || '',
        password: process.env.SMTP_PASSWORD || '',
        from: process.env.SMTP_FROM || 'alerts@armored-archer.com',
        to: parseStringArray(process.env.SMTP_TO),
      }
    : undefined,
  healthAlerts: {
    cpuWarningPercent: parseNumber(process.env.ALERT_CPU_WARNING_PERCENT, 70),
    cpuCriticalPercent: parseNumber(process.env.ALERT_CPU_CRITICAL_PERCENT, 90),
    memoryWarningPercent: parseNumber(process.env.ALERT_MEMORY_WARNING_PERCENT, 75),
    memoryCriticalPercent: parseNumber(process.env.ALERT_MEMORY_CRITICAL_PERCENT, 90),
    dbConnectionsWarningPercent: parseNumber(process.env.ALERT_DB_CONNECTIONS_WARNING_PERCENT, 70),
    dbConnectionsCriticalPercent: parseNumber(
      process.env.ALERT_DB_CONNECTIONS_CRITICAL_PERCENT,
      90
    ),
    diskWarningPercent: parseNumber(process.env.ALERT_DISK_WARNING_PERCENT, 80),
    diskCriticalPercent: parseNumber(process.env.ALERT_DISK_CRITICAL_PERCENT, 95),
    responseTimeWarningMs: parseNumber(process.env.ALERT_RESPONSE_TIME_WARNING_MS, 500),
    responseTimeCriticalMs: parseNumber(process.env.ALERT_RESPONSE_TIME_CRITICAL_MS, 2000),
    errorRateWarningPercent: parseNumber(process.env.ALERT_ERROR_RATE_WARNING_PERCENT, 5),
    errorRateCriticalPercent: parseNumber(process.env.ALERT_ERROR_RATE_CRITICAL_PERCENT, 10),
  },
  metricAlerts: {
    activeConnectionsWarning: parseNumber(process.env.ALERT_ACTIVE_CONNECTIONS_WARNING, 1000),
    activeConnectionsCritical: parseNumber(process.env.ALERT_ACTIVE_CONNECTIONS_CRITICAL, 2000),
    matchQueueWarning: parseNumber(process.env.ALERT_MATCH_QUEUE_WARNING, 50),
    matchQueueCritical: parseNumber(process.env.ALERT_MATCH_QUEUE_CRITICAL, 100),
    matchWaitTimeWarningSec: parseNumber(process.env.ALERT_MATCH_WAIT_TIME_WARNING_SEC, 60),
    matchWaitTimeCriticalSec: parseNumber(process.env.ALERT_MATCH_WAIT_TIME_CRITICAL_SEC, 180),
    dbQueryTimeWarningMs: parseNumber(process.env.ALERT_DB_QUERY_TIME_WARNING_MS, 100),
    dbQueryTimeCriticalMs: parseNumber(process.env.ALERT_DB_QUERY_TIME_CRITICAL_MS, 500),
    failedLoginsWarning: parseNumber(process.env.ALERT_FAILED_LOGINS_WARNING, 10),
    failedLoginsCritical: parseNumber(process.env.ALERT_FAILED_LOGINS_CRITICAL, 50),
    purchaseFailuresWarning: parseNumber(process.env.ALERT_PURCHASE_FAILURES_WARNING, 5),
    purchaseFailuresCritical: parseNumber(process.env.ALERT_PURCHASE_FAILURES_CRITICAL, 20),
  },
  cooldowns: {
    critical: parseNumber(process.env.ALERT_COOLDOWN_CRITICAL, 300),
    error: parseNumber(process.env.ALERT_COOLDOWN_ERROR, 600),
    warning: parseNumber(process.env.ALERT_COOLDOWN_WARNING, 900),
    info: parseNumber(process.env.ALERT_COOLDOWN_INFO, 1800),
  },
  minEnvironmentLevel: (process.env.ALERTING_MIN_ENV_LEVEL || 'staging') as
    | 'development'
    | 'staging'
    | 'production',
  tags: {
    service: 'armored-archer-backend',
    version: process.env.APP_VERSION || 'unknown',
  },
};

/**
 * Check if alerting is enabled for the current environment
 */
export function isAlertingEnabled(): boolean {
  const environmentLevels: Record<string, number> = {
    development: 0,
    staging: 1,
    production: 2,
  };

  const currentLevel = environmentLevels[process.env.NODE_ENV || 'development'];
  const minLevel = environmentLevels[alertingConfig.minEnvironmentLevel];

  return alertingConfig.enabled && currentLevel >= minLevel;
}

/**
 * Get the provider for a specific severity level
 */
export function getAlertProvider(severity: AlertSeverity): AlertProvider {
  return alertingConfig.routing[severity] || alertingConfig.defaultProvider;
}

/**
 * Get cooldown period for a specific severity level
 */
export function getAlertCooldown(severity: AlertSeverity): number {
  return alertingConfig.cooldowns[severity] || alertingConfig.cooldowns.info;
}

/**
 * Check if health alerts are enabled and should trigger
 */
export function shouldTriggerHealthAlert(
  metric: keyof AlertingConfig['healthAlerts'],
  value: number
): AlertSeverity | null {
  const thresholds = alertingConfig.healthAlerts;
  const metricKey = metric as keyof typeof thresholds;

  if (metricKey.includes('Critical') && typeof thresholds[metricKey] === 'number') {
    if (value >= (thresholds[metricKey as keyof typeof thresholds] as number)) {
      return 'critical';
    }
  }
  if (metricKey.includes('Warning') && typeof thresholds[metricKey] === 'number') {
    if (value >= (thresholds[metricKey as keyof typeof thresholds] as number)) {
      return 'warning';
    }
  }

  return null;
}

export default alertingConfig;
