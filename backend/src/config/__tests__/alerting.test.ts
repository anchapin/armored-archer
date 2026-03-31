/**
 * Tests for alerting configuration module
 */

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('alerting config', () => {
  describe('parseBoolean', () => {
    it('returns default when value is undefined', () => {
      delete process.env.ALERTING_ENABLED;
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.enabled).toBe(false);
    });

    it('returns true when value is "true"', () => {
      process.env.ALERTING_ENABLED = 'true';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.enabled).toBe(true);
    });

    it('returns false when value is "false"', () => {
      process.env.ALERTING_ENABLED = 'false';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.enabled).toBe(false);
    });

    it('handles case-insensitive boolean values', () => {
      process.env.ALERTING_ENABLED = 'TRUE';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.enabled).toBe(true);
    });
  });

  describe('parseNumber', () => {
    it('returns default when value is undefined', () => {
      delete process.env.ALERT_CPU_WARNING_PERCENT;
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.healthAlerts.cpuWarningPercent).toBe(70);
    });

    it('parses valid number', () => {
      process.env.ALERT_CPU_WARNING_PERCENT = '85';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.healthAlerts.cpuWarningPercent).toBe(85);
    });

    it('returns default for invalid number', () => {
      process.env.ALERT_CPU_WARNING_PERCENT = 'not-a-number';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.healthAlerts.cpuWarningPercent).toBe(70);
    });
  });

  describe('parseStringArray', () => {
    it('returns empty array when value is undefined', () => {
      delete process.env.SMTP_TO;
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.email).toBeUndefined();
    });

    it('parses comma-separated values', () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_TO = 'admin@test.com,ops@test.com';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.email?.to).toEqual(['admin@test.com', 'ops@test.com']);
    });
  });

  describe('alertingConfig defaults', () => {
    it('has correct default routing', () => {
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.routing).toEqual({
        critical: 'pagerduty',
        error: 'slack',
        warning: 'slack',
        info: 'none',
      });
    });

    it('has correct default cooldowns', () => {
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.cooldowns).toEqual({
        critical: 300,
        error: 600,
        warning: 900,
        info: 1800,
      });
    });

    it('has correct default min environment level', () => {
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.minEnvironmentLevel).toBe('staging');
    });

    it('has correct default tags', () => {
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.tags).toEqual({
        service: 'armored-archer-backend',
        version: 'unknown',
      });
    });

    it('includes PagerDuty config when API key is set', () => {
      process.env.PAGERDUTY_API_KEY = 'pd-key-123';
      process.env.PAGERDUTY_SERVICE_ID = 'svc-1';
      process.env.PAGERDUTY_INTEGRATION_KEY = 'int-key-1';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.pagerduty).toEqual({
        apiKey: 'pd-key-123',
        serviceId: 'svc-1',
        integrationKey: 'int-key-1',
      });
    });

    it('excludes PagerDuty config when API key is missing', () => {
      delete process.env.PAGERDUTY_API_KEY;
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.pagerduty).toBeUndefined();
    });

    it('includes Slack config when webhook URL is set', () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      process.env.SLACK_CHANNEL = '#game-alerts';
      process.env.SLACK_USERNAME = 'GameBot';
      process.env.SLACK_ICON_EMOJI = ':bow_and_arrow:';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.slack).toEqual({
        webhookUrl: 'https://hooks.slack.com/test',
        channel: '#game-alerts',
        username: 'GameBot',
        iconEmoji: ':bow_and_arrow:',
      });
    });

    it('uses Slack defaults when only webhook URL is set', () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.slack?.channel).toBe('#alerts');
      expect(alertingConfig.slack?.username).toBe('Armored Archer Alert Bot');
      expect(alertingConfig.slack?.iconEmoji).toBe(':warning:');
    });

    it('excludes Slack config when webhook URL is missing', () => {
      delete process.env.SLACK_WEBHOOK_URL;
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.slack).toBeUndefined();
    });

    it('includes webhook config when URL is set', () => {
      process.env.ALERT_WEBHOOK_URL = 'https://example.com/webhook';
      process.env.ALERT_WEBHOOK_METHOD = 'PUT';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.webhook?.url).toBe('https://example.com/webhook');
      expect(alertingConfig.webhook?.method).toBe('PUT');
    });

    it('parses webhook headers from JSON', () => {
      process.env.ALERT_WEBHOOK_URL = 'https://example.com/webhook';
      process.env.ALERT_WEBHOOK_HEADERS = '{"Authorization": "Bearer token123"}';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.webhook?.headers).toEqual({
        Authorization: 'Bearer token123',
      });
    });

    it('includes email config when SMTP host is set', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_SECURE = 'true';
      process.env.SMTP_USERNAME = 'user';
      process.env.SMTP_PASSWORD = 'pass';
      process.env.SMTP_FROM = 'noreply@example.com';
      process.env.SMTP_TO = 'admin@example.com';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.email).toBeDefined();
      expect(alertingConfig.email?.host).toBe('smtp.example.com');
      expect(alertingConfig.email?.port).toBe(465);
      expect(alertingConfig.email?.secure).toBe(true);
    });

    it('excludes email config when SMTP host is missing', () => {
      delete process.env.SMTP_HOST;
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.email).toBeUndefined();
    });
  });

  describe('health alert thresholds', () => {
    it('has correct default CPU thresholds', () => {
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.healthAlerts.cpuWarningPercent).toBe(70);
      expect(alertingConfig.healthAlerts.cpuCriticalPercent).toBe(90);
    });

    it('has correct default memory thresholds', () => {
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.healthAlerts.memoryWarningPercent).toBe(75);
      expect(alertingConfig.healthAlerts.memoryCriticalPercent).toBe(90);
    });

    it('has correct default response time thresholds', () => {
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.healthAlerts.responseTimeWarningMs).toBe(500);
      expect(alertingConfig.healthAlerts.responseTimeCriticalMs).toBe(2000);
    });

    it('has correct default error rate thresholds', () => {
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.healthAlerts.errorRateWarningPercent).toBe(5);
      expect(alertingConfig.healthAlerts.errorRateCriticalPercent).toBe(10);
    });
  });

  describe('metric alert thresholds', () => {
    it('has correct default connection thresholds', () => {
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.metricAlerts.activeConnectionsWarning).toBe(1000);
      expect(alertingConfig.metricAlerts.activeConnectionsCritical).toBe(2000);
    });

    it('has correct default match queue thresholds', () => {
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.metricAlerts.matchQueueWarning).toBe(50);
      expect(alertingConfig.metricAlerts.matchQueueCritical).toBe(100);
    });

    it('has correct default failed login thresholds', () => {
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.metricAlerts.failedLoginsWarning).toBe(10);
      expect(alertingConfig.metricAlerts.failedLoginsCritical).toBe(50);
    });
  });

  describe('isAlertingEnabled', () => {
    it('returns false when alerting is disabled', () => {
      delete process.env.ALERTING_ENABLED;
      const { isAlertingEnabled } = require('../alerting');
      expect(isAlertingEnabled()).toBe(false);
    });

    it('returns true when enabled and environment meets minimum level', () => {
      process.env.ALERTING_ENABLED = 'true';
      process.env.ALERTING_MIN_ENV_LEVEL = 'development';
      process.env.NODE_ENV = 'staging';
      const { isAlertingEnabled } = require('../alerting');
      expect(isAlertingEnabled()).toBe(true);
    });

    it('returns false when environment is below minimum level', () => {
      process.env.ALERTING_ENABLED = 'true';
      process.env.ALERTING_MIN_ENV_LEVEL = 'production';
      process.env.NODE_ENV = 'staging';
      const { isAlertingEnabled } = require('../alerting');
      expect(isAlertingEnabled()).toBe(false);
    });

    it('returns true when environment equals minimum level', () => {
      process.env.ALERTING_ENABLED = 'true';
      process.env.ALERTING_MIN_ENV_LEVEL = 'staging';
      process.env.NODE_ENV = 'staging';
      const { isAlertingEnabled } = require('../alerting');
      expect(isAlertingEnabled()).toBe(true);
    });
  });

  describe('getAlertProvider', () => {
    it('returns routing provider for severity', () => {
      const { getAlertProvider } = require('../alerting');
      expect(getAlertProvider('critical')).toBe('pagerduty');
      expect(getAlertProvider('error')).toBe('slack');
      expect(getAlertProvider('warning')).toBe('slack');
      expect(getAlertProvider('info')).toBe('none');
    });

    it('returns default provider for unknown severity', () => {
      process.env.ALERTING_DEFAULT_PROVIDER = 'webhook';
      const { getAlertProvider, alertingConfig } = require('../alerting');
      expect(alertingConfig.defaultProvider).toBe('webhook');
    });
  });

  describe('getAlertCooldown', () => {
    it('returns cooldown for severity level', () => {
      const { getAlertCooldown } = require('../alerting');
      expect(getAlertCooldown('critical')).toBe(300);
      expect(getAlertCooldown('error')).toBe(600);
      expect(getAlertCooldown('warning')).toBe(900);
      expect(getAlertCooldown('info')).toBe(1800);
    });
  });

  describe('shouldTriggerHealthAlert', () => {
    it('returns critical when value exceeds critical threshold', () => {
      const { shouldTriggerHealthAlert } = require('../alerting');
      const result = shouldTriggerHealthAlert('cpuCriticalPercent', 95);
      expect(result).toBe('critical');
    });

    it('returns warning when value exceeds warning threshold', () => {
      const { shouldTriggerHealthAlert } = require('../alerting');
      const result = shouldTriggerHealthAlert('cpuWarningPercent', 75);
      expect(result).toBe('warning');
    });

    it('returns null when value is below all thresholds', () => {
      const { shouldTriggerHealthAlert } = require('../alerting');
      const result = shouldTriggerHealthAlert('cpuWarningPercent', 50);
      expect(result).toBeNull();
    });

    it('returns critical over warning when both thresholds exceeded', () => {
      const { shouldTriggerHealthAlert } = require('../alerting');
      const result = shouldTriggerHealthAlert('cpuCriticalPercent', 95);
      expect(result).toBe('critical');
    });

    it('handles memory thresholds', () => {
      const { shouldTriggerHealthAlert } = require('../alerting');
      expect(shouldTriggerHealthAlert('memoryCriticalPercent', 95)).toBe('critical');
      expect(shouldTriggerHealthAlert('memoryWarningPercent', 80)).toBe('warning');
    });

    it('handles disk thresholds', () => {
      const { shouldTriggerHealthAlert } = require('../alerting');
      expect(shouldTriggerHealthAlert('diskCriticalPercent', 96)).toBe('critical');
      expect(shouldTriggerHealthAlert('diskWarningPercent', 85)).toBe('warning');
    });

    it('handles response time thresholds', () => {
      const { shouldTriggerHealthAlert } = require('../alerting');
      expect(shouldTriggerHealthAlert('responseTimeCriticalMs', 2500)).toBe('critical');
      expect(shouldTriggerHealthAlert('responseTimeWarningMs', 600)).toBe('warning');
    });
  });

  describe('app version tag', () => {
    it('uses APP_VERSION when set', () => {
      process.env.APP_VERSION = '1.2.3';
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.tags.version).toBe('1.2.3');
    });

    it('defaults to unknown when APP_VERSION is not set', () => {
      delete process.env.APP_VERSION;
      const { alertingConfig } = require('../alerting');
      expect(alertingConfig.tags.version).toBe('unknown');
    });
  });
});
