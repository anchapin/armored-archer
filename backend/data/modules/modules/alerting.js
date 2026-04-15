"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeAlerting = initializeAlerting;
exports.sendAlert = sendAlert;
exports.triggerHealthAlert = triggerHealthAlert;
exports.triggerMetricAlert = triggerMetricAlert;
exports.sendErrorAlert = sendErrorAlert;
exports.getAlertStats = getAlertStats;
exports.clearAlertState = clearAlertState;
const config_1 = require("../config");
const alerting_1 = require("../config/alerting");
const errorTracking_1 = require("../config/errorTracking");
const logger_1 = require("../config/logger");
const circuitBreaker_1 = require("../utils/circuitBreaker");
const alertState = new Map();
/**
 * Initialize the alerting service
 */
function initializeAlerting(logger) {
    if (!(0, alerting_1.isAlertingEnabled)()) {
        logger.info('[Alerting] Alerting is disabled for current environment');
        return;
    }
    logger.info(`[Alerting] Initialized - provider: ${config_1.config.alerting.defaultProvider}, min_env: ${config_1.config.alerting.minEnvironmentLevel}`);
}
/**
 * Check if an alert should be sent based on cooldown period
 */
function shouldSendAlert(alertKey, severity) {
    const state = alertState.get(alertKey);
    const cooldown = (0, alerting_1.getAlertCooldown)(severity) * 1000; // Convert to milliseconds
    const now = Date.now();
    if (!state) {
        return true;
    }
    return now - state.lastAlertTime >= cooldown;
}
/**
 * Update alert state after sending an alert
 */
function updateAlertState(alertKey, _severity) {
    const now = Date.now();
    const state = alertState.get(alertKey) || { lastAlertTime: 0, alertCount: 0 };
    alertState.set(alertKey, {
        lastAlertTime: now,
        alertCount: state.alertCount + 1,
    });
}
/**
 * Route alert to the appropriate provider
 */
async function routeAlert(payload, provider) {
    if (provider === 'none') {
        return;
    }
    const alertingCfg = alerting_1.alertingConfig;
    switch (provider) {
        case 'slack':
            await sendSlackAlert(payload, alertingCfg.slack);
            break;
        case 'webhook':
            await sendWebhookAlert(payload, alertingCfg.webhook);
            break;
        case 'email':
            await sendEmailAlert(payload, alertingCfg.email);
            break;
        case 'pagerduty':
            await sendPagerDutyAlert(payload, alertingCfg.pagerduty);
            break;
        default:
            logger_1.logger.warn(`Unknown provider: ${provider}`);
    }
}
/**
 * Send alert to Slack
 */
async function sendSlackAlert(payload, slackConfig) {
    if (!slackConfig?.webhookUrl) {
        logger_1.logger.warn('Slack webhook URL not configured');
        return;
    }
    const severityEmoji = {
        critical: ':rotating_light:',
        error: ':x:',
        warning: ':warning:',
        info: ':information_source:',
    };
    const color = {
        critical: '#FF0000',
        error: '#FFA500',
        warning: '#FFFF00',
        info: '#00FF00',
    };
    const slackPayload = {
        username: slackConfig.username,
        icon_emoji: slackConfig.iconEmoji,
        channel: slackConfig.channel,
        attachments: [
            {
                color: color[payload.severity],
                title: `${severityEmoji[payload.severity]} ${payload.title}`,
                text: payload.message,
                fields: [
                    { title: 'Severity', value: payload.severity, short: true },
                    { title: 'Source', value: payload.source, short: true },
                    ...Object.entries(payload.tags).map(([key, value]) => ({
                        title: key,
                        value,
                        short: true,
                    })),
                ],
                footer: 'Armored Archer Alerting',
                ts: Math.floor(payload.timestamp / 1000),
            },
        ],
    };
    // Wrap external API call with circuit breaker for resilience
    await (0, circuitBreaker_1.withCircuitBreaker)('slack', async () => {
        const response = await fetch(slackConfig.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slackPayload),
        });
        if (!response.ok) {
            logger_1.logger.error(`Failed to send Slack alert: ${response.statusText}`);
        }
    }, 
    // Fallback: log error but don't throw - alerting failures shouldn't break the app
    async () => {
        logger_1.logger.error('Slack circuit open - alert not sent:', payload.title);
    });
}
/**
 * Send alert to generic webhook
 */
async function sendWebhookAlert(payload, webhookConfig) {
    if (!webhookConfig?.url) {
        logger_1.logger.warn('Webhook URL not configured');
        return;
    }
    const headers = { ...webhookConfig.headers };
    if (webhookConfig.authType === 'bearer' && webhookConfig.token) {
        headers['Authorization'] = `Bearer ${webhookConfig.token}`;
    }
    else if (webhookConfig.authType === 'basic' &&
        webhookConfig.username &&
        webhookConfig.password) {
        const credentials = Buffer.from(`${webhookConfig.username}:${webhookConfig.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
    }
    // Wrap external API call with circuit breaker for resilience
    await (0, circuitBreaker_1.withCircuitBreaker)('alerting_webhook', async () => {
        const response = await fetch(webhookConfig.url, {
            method: webhookConfig.method,
            headers,
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            logger_1.logger.error(`Failed to send webhook alert: ${response.statusText}`);
        }
    }, 
    // Fallback: log error but don't throw - alerting failures shouldn't break the app
    async () => {
        logger_1.logger.error('Webhook circuit open - alert not sent:', payload.title);
    });
}
/**
 * Send alert via email (SMTP)
 */
async function sendEmailAlert(payload, emailConfig) {
    // Note: This is a placeholder implementation
    // In production, you would use a library like 'nodemailer'
    if (!emailConfig?.host) {
        logger_1.logger.warn('Email not configured');
        return;
    }
    logger_1.logger.info(`Email alert: ${payload.title} to ${emailConfig.to.join(', ')}`);
    // Implementation would use nodemailer or similar
}
/**
 * Send alert to PagerDuty
 */
async function sendPagerDutyAlert(payload, pagerdutyConfig) {
    if (!pagerdutyConfig?.apiKey) {
        logger_1.logger.warn('PagerDuty not configured');
        return;
    }
    const urgency = {
        critical: 'high',
        error: 'high',
        warning: 'low',
        info: 'low',
    };
    const payloadPD = {
        routing_key: pagerdutyConfig.integrationKey,
        event_action: 'trigger',
        payload: {
            summary: payload.title,
            severity: payload.severity,
            source: payload.source,
            custom_details: {
                message: payload.message,
                tags: payload.tags,
                metrics: payload.metrics,
            },
        },
        urgency: urgency[payload.severity],
    };
    // Wrap external API call with circuit breaker for resilience
    await (0, circuitBreaker_1.withCircuitBreaker)('pagerduty', async () => {
        const response = await fetch(`https://events.pagerduty.com/v2/enqueue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadPD),
        });
        if (!response.ok) {
            logger_1.logger.error(`Failed to send PagerDuty alert: ${response.statusText}`);
        }
    }, 
    // Fallback: log error but don't throw - alerting failures shouldn't break the app
    async () => {
        logger_1.logger.error('PagerDuty circuit open - alert not sent:', payload.title);
    });
}
/**
 * Send an alert with the given parameters
 */
async function sendAlert(title, message, severity, tags = {}, metrics = {}) {
    if (!(0, alerting_1.isAlertingEnabled)()) {
        return;
    }
    const provider = (0, alerting_1.getAlertProvider)(severity);
    const alertKey = `${title}:${severity}`;
    if (!shouldSendAlert(alertKey, severity)) {
        logger_1.logger.info(`Alert suppressed due to cooldown: ${title}`);
        return;
    }
    const alertPayload = {
        title,
        message,
        severity,
        tags: {
            ...config_1.config.alerting.tags,
            ...tags,
        },
        metrics,
        timestamp: Date.now(),
        source: 'armored-archer-backend',
    };
    await routeAlert(alertPayload, provider);
    updateAlertState(alertKey, severity);
    // Also send to Sentry for error-level alerts
    if (severity === 'critical' || severity === 'error') {
        // Map critical to error for Sentry compatibility
        const sentrySeverity = severity === 'critical' ? 'error' : severity;
        (0, errorTracking_1.captureMessage)(`${title}: ${message}`, sentrySeverity, {
            extra: { ...tags, ...metrics },
        });
    }
}
/**
 * Trigger health alert based on metric threshold
 */
function triggerHealthAlert(metricName, value, currentMetrics) {
    const severity = (0, alerting_1.shouldTriggerHealthAlert)(metricName, value);
    if (!severity) {
        return;
    }
    const metricLabel = metricName.replace(/([A-Z])/g, ' $1').trim(); // Convert camelCase to spaces
    const title = `Health Alert: ${metricLabel}`;
    const message = `Current value: ${value}% (threshold: ${severity})`;
    sendAlert(title, message, severity, { metric: metricName }, currentMetrics).catch((err) => {
        logger_1.logger.error('Failed to send health alert:', err);
    });
}
/**
 * Trigger metric alert based on custom threshold
 */
function triggerMetricAlert(metricName, value, threshold, severity, additionalTags = {}) {
    const title = `Metric Alert: ${metricName}`;
    const message = `Current value: ${value} (threshold: ${threshold})`;
    sendAlert(title, message, severity, { metric: metricName, ...additionalTags }).catch((err) => {
        logger_1.logger.error('Failed to send metric alert:', err);
    });
}
/**
 * Send error alert with context
 */
function sendErrorAlert(error, context = {}) {
    if (!(0, alerting_1.isAlertingEnabled)()) {
        return;
    }
    (0, errorTracking_1.captureException)(error, { userId: context.userId, rpc: context.rpc, extra: context.extra });
    const title = `Error: ${error.message}`;
    const message = `An error occurred in ${context.rpc || 'unknown RPC'}`;
    sendAlert(title, message, 'error', {
        errorType: error.constructor.name,
        userId: context.userId || 'unknown',
        rpc: context.rpc || 'unknown',
    }).catch((err) => {
        logger_1.logger.error('Failed to send error alert:', err);
    });
}
/**
 * Get alert statistics
 */
function getAlertStats() {
    const stats = {};
    for (const [key, state] of alertState.entries()) {
        stats[key] = { lastAlertTime: state.lastAlertTime, alertCount: state.alertCount };
    }
    return stats;
}
/**
 * Clear alert state (useful for testing)
 */
function clearAlertState() {
    alertState.clear();
}
