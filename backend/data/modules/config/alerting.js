"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertingConfig = void 0;
exports.isAlertingEnabled = isAlertingEnabled;
exports.getAlertProvider = getAlertProvider;
exports.getAlertCooldown = getAlertCooldown;
exports.shouldTriggerHealthAlert = shouldTriggerHealthAlert;
/**
 * Parse boolean environment variable
 */
function parseBoolean(value, defaultValue) {
    if (value === undefined)
        return defaultValue;
    return value.toLowerCase() === 'true';
}
/**
 * Parse number from environment variable with default
 */
function parseNumber(value, defaultValue) {
    if (value === undefined)
        return defaultValue;
    var parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}
/**
 * Parse comma-separated string array from environment variable
 */
function parseStringArray(value) {
    if (!value)
        return [];
    return value.split(',').map(function (s) { return s.trim(); });
}
/**
 * Load alerting configuration from environment variables
 */
exports.alertingConfig = {
    enabled: parseBoolean(process.env.ALERTING_ENABLED, false),
    defaultProvider: (process.env.ALERTING_DEFAULT_PROVIDER || 'none'),
    routing: {
        critical: (process.env.ALERTING_ROUTING_CRITICAL || 'pagerduty'),
        error: (process.env.ALERTING_ROUTING_ERROR || 'slack'),
        warning: (process.env.ALERTING_ROUTING_WARNING || 'slack'),
        info: (process.env.ALERTING_ROUTING_INFO || 'none'),
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
            method: (process.env.ALERT_WEBHOOK_METHOD || 'POST'),
            headers: process.env.ALERT_WEBHOOK_HEADERS
                ? JSON.parse(process.env.ALERT_WEBHOOK_HEADERS)
                : { 'Content-Type': 'application/json' },
            authType: (process.env.ALERT_WEBHOOK_AUTH_TYPE || 'none'),
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
        dbConnectionsCriticalPercent: parseNumber(process.env.ALERT_DB_CONNECTIONS_CRITICAL_PERCENT, 90),
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
    minEnvironmentLevel: (process.env.ALERTING_MIN_ENV_LEVEL || 'staging'),
    tags: {
        service: 'armored-archer-backend',
        version: process.env.APP_VERSION || 'unknown',
    },
};
/**
 * Check if alerting is enabled for the current environment
 */
function isAlertingEnabled() {
    var environmentLevels = {
        development: 0,
        staging: 1,
        production: 2,
    };
    var currentLevel = environmentLevels[process.env.NODE_ENV || 'development'];
    var minLevel = environmentLevels[exports.alertingConfig.minEnvironmentLevel];
    return exports.alertingConfig.enabled && currentLevel >= minLevel;
}
/**
 * Get the provider for a specific severity level
 */
function getAlertProvider(severity) {
    return exports.alertingConfig.routing[severity] || exports.alertingConfig.defaultProvider;
}
/**
 * Get cooldown period for a specific severity level
 */
function getAlertCooldown(severity) {
    return exports.alertingConfig.cooldowns[severity] || exports.alertingConfig.cooldowns.info;
}
/**
 * Check if health alerts are enabled and should trigger
 */
function shouldTriggerHealthAlert(metric, value) {
    var thresholds = exports.alertingConfig.healthAlerts;
    var metricKey = metric;
    if (metricKey.includes('Critical') && typeof thresholds[metricKey] === 'number') {
        if (value >= thresholds[metricKey]) {
            return 'critical';
        }
    }
    if (metricKey.includes('Warning') && typeof thresholds[metricKey] === 'number') {
        if (value >= thresholds[metricKey]) {
            return 'warning';
        }
    }
    return null;
}
exports.default = exports.alertingConfig;
