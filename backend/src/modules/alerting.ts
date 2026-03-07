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

import { config } from '../config';
import {
  AlertingConfig,
  AlertSeverity,
  AlertProvider,
  alertingConfig,
  isAlertingEnabled,
  getAlertProvider,
  getAlertCooldown,
  shouldTriggerHealthAlert,
} from '../config/alerting';
import { captureMessage, captureException } from '../config/errorTracking';
import { Runtime } from '../types/nakama';

// Track last alert times for cooldown management
interface AlertState {
  lastAlertTime: number;
  alertCount: number;
}

const alertState: Map<string, AlertState> = new Map();

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
export function initializeAlerting(logger: Runtime.Logger): void {
  if (!isAlertingEnabled()) {
    logger.info('[Alerting] Alerting is disabled for current environment');
    return;
  }

  logger.info(
    `[Alerting] Initialized - provider: ${config.alerting.defaultProvider}, min_env: ${config.alerting.minEnvironmentLevel}`
  );
}

/**
 * Check if an alert should be sent based on cooldown period
 */
function shouldSendAlert(alertKey: string, severity: AlertSeverity): boolean {
  const state = alertState.get(alertKey);
  const cooldown = getAlertCooldown(severity) * 1000; // Convert to milliseconds
  const now = Date.now();

  if (!state) {
    return true;
  }

  return now - state.lastAlertTime >= cooldown;
}

/**
 * Update alert state after sending an alert
 */
function updateAlertState(alertKey: string, severity: AlertSeverity): void {
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
async function routeAlert(payload: AlertPayload, provider: AlertProvider): Promise<void> {
  if (provider === 'none') {
    return;
  }

  const alertingCfg = alertingConfig;

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
      console.warn(`[Alerting] Unknown provider: ${provider}`);
  }
}

/**
 * Send alert to Slack
 */
async function sendSlackAlert(
  payload: AlertPayload,
  slackConfig: AlertingConfig['slack']
): Promise<void> {
  if (!slackConfig?.webhookUrl) {
    console.warn('[Alerting] Slack webhook URL not configured');
    return;
  }

  const severityEmoji: Record<AlertSeverity, string> = {
    critical: ':rotating_light:',
    error: ':x:',
    warning: ':warning:',
    info: ':information_source:',
  };

  const color: Record<AlertSeverity, string> = {
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

  try {
    const response = await fetch(slackConfig.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      console.error(`[Alerting] Failed to send Slack alert: ${response.statusText}`);
    }
  } catch (error) {
    console.error('[Alerting] Error sending Slack alert:', error);
  }
}

/**
 * Send alert to generic webhook
 */
async function sendWebhookAlert(
  payload: AlertPayload,
  webhookConfig: AlertingConfig['webhook']
): Promise<void> {
  if (!webhookConfig?.url) {
    console.warn('[Alerting] Webhook URL not configured');
    return;
  }

  const headers: Record<string, string> = { ...webhookConfig.headers };

  if (webhookConfig.authType === 'bearer' && webhookConfig.token) {
    headers['Authorization'] = `Bearer ${webhookConfig.token}`;
  } else if (webhookConfig.authType === 'basic' && webhookConfig.username && webhookConfig.password) {
    const credentials = Buffer.from(`${webhookConfig.username}:${webhookConfig.password}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  try {
    const response = await fetch(webhookConfig.url, {
      method: webhookConfig.method,
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Alerting] Failed to send webhook alert: ${response.statusText}`);
    }
  } catch (error) {
    console.error('[Alerting] Error sending webhook alert:', error);
  }
}

/**
 * Send alert via email (SMTP)
 */
async function sendEmailAlert(
  payload: AlertPayload,
  emailConfig: AlertingConfig['email']
): Promise<void> {
  // Note: This is a placeholder implementation
  // In production, you would use a library like 'nodemailer'
  if (!emailConfig?.host) {
    console.warn('[Alerting] Email not configured');
    return;
  }

  console.log(`[Alerting] Email alert: ${payload.title} to ${emailConfig.to.join(', ')}`);
  // Implementation would use nodemailer or similar
}

/**
 * Send alert to PagerDuty
 */
async function sendPagerDutyAlert(
  payload: AlertPayload,
  pagerdutyConfig: AlertingConfig['pagerduty']
): Promise<void> {
  if (!pagerdutyConfig?.apiKey) {
    console.warn('[Alerting] PagerDuty not configured');
    return;
  }

  const urgency: Record<AlertSeverity, 'high' | 'low'> = {
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

  try {
    const response = await fetch(
      `https://events.pagerduty.com/v2/enqueue`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadPD),
      }
    );

    if (!response.ok) {
      console.error(`[Alerting] Failed to send PagerDuty alert: ${response.statusText}`);
    }
  } catch (error) {
    console.error('[Alerting] Error sending PagerDuty alert:', error);
  }
}

/**
 * Send an alert with the given parameters
 */
export async function sendAlert(
  title: string,
  message: string,
  severity: AlertSeverity,
  tags: Record<string, string> = {},
  metrics: Record<string, number> = {}
): Promise<void> {
  if (!isAlertingEnabled()) {
    return;
  }

  const provider = getAlertProvider(severity);
  const alertKey = `${title}:${severity}`;

  if (!shouldSendAlert(alertKey, severity)) {
    console.log(`[Alerting] Alert suppressed due to cooldown: ${title}`);
    return;
  }

  const alertPayload: AlertPayload = {
    title,
    message,
    severity,
    tags: {
      ...config.alerting.tags,
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
    captureMessage(`${title}: ${message}`, sentrySeverity, {
      extra: { ...tags, ...metrics },
    });
  }
}

/**
 * Trigger health alert based on metric threshold
 */
export function triggerHealthAlert(
  metricName: string,
  value: number,
  currentMetrics: Record<string, number>
): void {
  const severity = shouldTriggerHealthAlert(
    metricName as keyof typeof alertingConfig.healthAlerts,
    value
  );

  if (!severity) {
    return;
  }

  const metricLabel = metricName.replace(/([A-Z])/g, ' $1').trim(); // Convert camelCase to spaces
  const title = `Health Alert: ${metricLabel}`;
  const message = `Current value: ${value}% (threshold: ${severity})`;

  sendAlert(title, message, severity, { metric: metricName }, currentMetrics).catch((err) => {
    console.error('[Alerting] Failed to send health alert:', err);
  });
}

/**
 * Trigger metric alert based on custom threshold
 */
export function triggerMetricAlert(
  metricName: string,
  value: number,
  threshold: number,
  severity: AlertSeverity,
  additionalTags: Record<string, string> = {}
): void {
  const title = `Metric Alert: ${metricName}`;
  const message = `Current value: ${value} (threshold: ${threshold})`;

  sendAlert(title, message, severity, { metric: metricName, ...additionalTags }).catch((err) => {
    console.error('[Alerting] Failed to send metric alert:', err);
  });
}

/**
 * Send error alert with context
 */
export function sendErrorAlert(
  error: Error,
  context: {
    userId?: string;
    rpc?: string;
    extra?: Record<string, unknown>;
  } = {}
): void {
  if (!isAlertingEnabled()) {
    return;
  }

  captureException(error, { userId: context.userId, rpc: context.rpc, extra: context.extra });

  const title = `Error: ${error.message}`;
  const message = `An error occurred in ${context.rpc || 'unknown RPC'}`;

  sendAlert(title, message, 'error', {
    errorType: error.constructor.name,
    userId: context.userId || 'unknown',
    rpc: context.rpc || 'unknown',
  }).catch((err) => {
    console.error('[Alerting] Failed to send error alert:', err);
  });
}

/**
 * Get alert statistics
 */
export function getAlertStats(): Record<string, { lastAlertTime: number; alertCount: number }> {
  const stats: Record<string, { lastAlertTime: number; alertCount: number }> = {};
  
  for (const [key, state] of alertState.entries()) {
    stats[key] = { lastAlertTime: state.lastAlertTime, alertCount: state.alertCount };
  }
  
  return stats;
}

/**
 * Clear alert state (useful for testing)
 */
export function clearAlertState(): void {
  alertState.clear();
}
