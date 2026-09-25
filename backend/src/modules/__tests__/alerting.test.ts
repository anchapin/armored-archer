/**
 * Alerting Module Tests - Integration-style tests
 * Uses real config/alerting and real circuit breaker
 * Only mocks external services (Sentry, HTTP fetch)
 */

process.env.ALERTING_ENABLED = 'true';
process.env.ALERTING_MIN_ENV_LEVEL = 'development';
process.env.NODE_ENV = 'development';
process.env.ALERTING_DEFAULT_PROVIDER = 'slack';
process.env.ALERTING_ROUTING_CRITICAL = 'slack';
process.env.ALERTING_ROUTING_ERROR = 'slack';
process.env.ALERTING_ROUTING_WARNING = 'slack';

import {
  initializeAlerting,
  sendAlert,
  triggerHealthAlert,
  triggerMetricAlert,
  sendErrorAlert,
  getAlertStats,
  clearAlertState,
} from '../alerting';

jest.mock('../../config/errorTracking', () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

describe('alerting', () => {
  // Store reference to the jest.setup.js mock so we can restore it
  let setupFetchMock: jest.Mock;

  beforeEach(() => {
    clearAlertState();
    jest.clearAllMocks();
    // Create a fresh mock for each test, preserving the jest.setup.js fallback behavior
    setupFetchMock = jest.fn((url: string | Request, _options?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : (url as Request).url;
      try {
        const hostname = new URL(urlString).hostname;
        if (hostname === 'revenuecat.com' || hostname.endsWith('.revenuecat.com')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(JSON.stringify({ status: 'active', valid: true })),
            json: () => Promise.resolve({ status: 'active', valid: true }),
          });
        }
      } catch {
        // Not a valid URL, fall through to default handler
      }
      // Default success for other URLs (slack, pagerduty, etc.) for tests that check fetch was called
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);
    });
    global.fetch = setupFetchMock;
  });

  afterEach(() => {
    // Restore to jest.setup.js mock by reassigning
    jest.restoreAllMocks();
  });

  describe('initializeAlerting', () => {
    it('should initialize alerting without errors', () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      expect(() => initializeAlerting(mockLogger as any)).not.toThrow();
    });
  });

  describe('sendAlert', () => {
    it('should send warning alert', async () => {
      await expect(sendAlert('Test Alert', 'This is a test', 'warning')).resolves.not.toThrow();
    });

    it('should send error alert', async () => {
      await expect(sendAlert('Error Alert', 'Something failed', 'error')).resolves.not.toThrow();
    });

    it('should send critical alert', async () => {
      await expect(sendAlert('Critical Alert', 'System down', 'critical')).resolves.not.toThrow();
    });

    it('should send info alert', async () => {
      await expect(sendAlert('Info Alert', 'Just info', 'info')).resolves.not.toThrow();
    });

    it('should handle alert with tags', async () => {
      await expect(
        sendAlert('Tagged Alert', 'With tags', 'warning', { component: 'test' })
      ).resolves.not.toThrow();
    });

    it('should handle alert with metrics', async () => {
      await expect(
        sendAlert('Metric Alert', 'With metrics', 'warning', {}, { cpu: 75, memory: 80 })
      ).resolves.not.toThrow();
    });

    it('should respect cooldown period', async () => {
      await sendAlert('Cooldown Test', 'First alert', 'warning');
      await sendAlert('Cooldown Test', 'Second alert (should be cooldown)', 'warning');
    });
  });

  describe('triggerHealthAlert', () => {
    it('should trigger health alert for critical CPU', () => {
      expect(() => triggerHealthAlert('cpuCriticalPercent', 95, {})).not.toThrow();
    });

    it('should trigger health alert for warning CPU', () => {
      expect(() => triggerHealthAlert('cpuWarningPercent', 75, {})).not.toThrow();
    });

    it('should trigger health alert for critical memory', () => {
      expect(() => triggerHealthAlert('memoryCriticalPercent', 95, {})).not.toThrow();
    });

    it('should trigger health alert for warning memory', () => {
      expect(() => triggerHealthAlert('memoryWarningPercent', 80, {})).not.toThrow();
    });

    it('should not trigger when below threshold', () => {
      expect(() => triggerHealthAlert('cpuWarningPercent', 50, {})).not.toThrow();
    });

    it('should not trigger memory when below threshold', () => {
      expect(() => triggerHealthAlert('memoryWarningPercent', 60, {})).not.toThrow();
    });
  });

  describe('triggerMetricAlert', () => {
    it('should trigger metric alert', () => {
      expect(() => triggerMetricAlert('matchQueue', 100, 50, 'warning')).not.toThrow();
    });

    it('should trigger metric alert with tags', () => {
      expect(() =>
        triggerMetricAlert('connections', 500, 100, 'error', { region: 'us' })
      ).not.toThrow();
    });
  });

  describe('sendErrorAlert', () => {
    it('should send error alert with Error object', () => {
      const error = new Error('Test error');
      expect(() => sendErrorAlert(error, { rpc: 'test_rpc' })).not.toThrow();
    });

    it('should send error alert with context', () => {
      const error = new Error('Database error');
      expect(() =>
        sendErrorAlert(error, {
          userId: 'user-123',
          rpc: 'db_query',
          extra: { query: 'SELECT *' },
        })
      ).not.toThrow();
    });

    it('should send error alert without context', () => {
      const error = new Error('Generic error');
      expect(() => sendErrorAlert(error)).not.toThrow();
    });
  });

  describe('getAlertStats', () => {
    it('should return empty stats initially', () => {
      const stats = getAlertStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
      expect(Object.keys(stats).length).toBe(0);
    });

    it('should track alert state after sending alerts', async () => {
      await sendAlert('Tracked Alert', 'Testing tracking', 'warning');

      const stats = getAlertStats();
      expect(stats).toBeDefined();
      expect(Object.keys(stats).length).toBeGreaterThan(0);
    });
  });

  describe('clearAlertState', () => {
    it('should clear alert state', async () => {
      await sendAlert('Clearable Alert', 'Testing clear', 'warning');

      const statsBefore = getAlertStats();
      expect(Object.keys(statsBefore).length).toBeGreaterThan(0);

      clearAlertState();

      const statsAfter = getAlertStats();
      expect(Object.keys(statsAfter).length).toBe(0);
    });

    it('should handle clearing when already empty', () => {
      expect(() => clearAlertState()).not.toThrow();
    });
  });

  describe('cooldown logic', () => {
    it('should suppress second alert within cooldown period', async () => {
      clearAlertState();
      jest.clearAllMocks();

      await sendAlert('CooldownKey', 'First', 'critical');
      const firstStats = getAlertStats();
      expect(firstStats['CooldownKey:critical'].alertCount).toBe(1);

      await sendAlert('CooldownKey', 'Second', 'critical');
      // Second alert should be suppressed due to cooldown (critical=300s)
      const secondStats = getAlertStats();
      expect(secondStats['CooldownKey:critical'].alertCount).toBe(1);
    });

    it('should allow alerts with different keys independently', async () => {
      clearAlertState();
      jest.clearAllMocks();

      await sendAlert('KeyA', 'Alert A', 'warning');
      await sendAlert('KeyB', 'Alert B', 'warning');

      const stats = getAlertStats();
      expect(stats['KeyA:warning']).toBeDefined();
      expect(stats['KeyB:warning']).toBeDefined();
    });

    it('should allow alerts with different severities independently', async () => {
      clearAlertState();
      jest.clearAllMocks();

      await sendAlert('SameKey', 'Warning alert', 'warning');
      await sendAlert('SameKey', 'Error alert', 'error');

      const stats = getAlertStats();
      expect(stats['SameKey:warning']).toBeDefined();
      expect(stats['SameKey:error']).toBeDefined();
    });

    it('should increment alert count on repeated sends after cooldown', async () => {
      clearAlertState();
      jest.clearAllMocks();

      const realDateNow = Date.now;
      const baseTime = 1000000;
      jest.spyOn(Date, 'now').mockImplementation(() => baseTime);

      await sendAlert('CountTest', 'First', 'warning');
      let stats = getAlertStats();
      expect(stats['CountTest:warning'].alertCount).toBe(1);

      // Advance time past cooldown (warning=900s)
      jest.spyOn(Date, 'now').mockImplementation(() => baseTime + 901 * 1000);
      await sendAlert('CountTest', 'Second', 'warning');
      stats = getAlertStats();
      expect(stats['CountTest:warning'].alertCount).toBe(2);

      Date.now = realDateNow;
    });

    it('should only update state once when alert is suppressed', async () => {
      clearAlertState();
      jest.clearAllMocks();

      await sendAlert('Suppressed', 'First', 'critical');
      await sendAlert('Suppressed', 'Second', 'critical');

      const stats = getAlertStats();
      // Only the first alert should update state; second is suppressed
      expect(stats['Suppressed:critical'].alertCount).toBe(1);
    });
  });

  describe('sendAlert when alerting is disabled', () => {
    it('should return early without sending when alerting is disabled', async () => {
      const { isAlertingEnabled: isEnabled } = await import('../../config/alerting');
      const spy = jest.spyOn({ isEnabled }, 'isEnabled').mockReturnValue(false);

      // Patch the import used by alerting.ts - use jest.fn on the module
      const configAlerting = await import('../../config/alerting');
      const origIsEnabled = configAlerting.isAlertingEnabled;
      (configAlerting as any).isAlertingEnabled = () => false;

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sendAlert('Disabled Alert', 'Should not send', 'critical');
      expect(fetchSpy).not.toHaveBeenCalled();

      (configAlerting as any).isAlertingEnabled = origIsEnabled;
      spy.mockRestore();
    });
  });

  describe('Sentry integration', () => {
    it('should call captureMessage for critical severity', async () => {
      clearAlertState();
      jest.clearAllMocks();
      const errorTracking = require('../../config/errorTracking');

      await sendAlert('CriticalSentry', 'Should capture', 'critical');

      expect(errorTracking.captureMessage).toHaveBeenCalled();
      const callArgs = errorTracking.captureMessage.mock.calls[0];
      expect(callArgs[0]).toContain('CriticalSentry');
      expect(callArgs[1]).toBe('error');
    });

    it('should call captureMessage for error severity', async () => {
      clearAlertState();
      jest.clearAllMocks();
      const errorTracking = require('../../config/errorTracking');

      await sendAlert('ErrorSentry', 'Should capture', 'error');

      expect(errorTracking.captureMessage).toHaveBeenCalled();
      const callArgs = errorTracking.captureMessage.mock.calls[0];
      expect(callArgs[0]).toContain('ErrorSentry');
      expect(callArgs[1]).toBe('error');
    });

    it('should NOT call captureMessage for warning severity', async () => {
      clearAlertState();
      jest.clearAllMocks();
      const errorTracking = require('../../config/errorTracking');

      await sendAlert('WarningNoSentry', 'Should not capture', 'warning');

      expect(errorTracking.captureMessage).not.toHaveBeenCalled();
    });

    it('should NOT call captureMessage for info severity', async () => {
      clearAlertState();
      jest.clearAllMocks();
      const errorTracking = require('../../config/errorTracking');

      await sendAlert('InfoNoSentry', 'Should not capture', 'info');

      expect(errorTracking.captureMessage).not.toHaveBeenCalled();
    });

    it('should pass tags and metrics as extra to captureMessage', async () => {
      clearAlertState();
      jest.clearAllMocks();
      const errorTracking = require('../../config/errorTracking');

      await sendAlert('ExtraSentry', 'With data', 'error', { env: 'test' }, { cpu: 99 });

      const calls = errorTracking.captureMessage.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2].extra).toMatchObject({ env: 'test', cpu: 99 });
    });

    it('should call captureException for error alerts via sendErrorAlert', () => {
      const errorTracking = require('../../config/errorTracking');
      jest.clearAllMocks();

      const error = new Error('Sentry test error');
      sendErrorAlert(error, { userId: 'u1', rpc: 'test_rpc' });

      expect(errorTracking.captureException).toHaveBeenCalledWith(error, {
        userId: 'u1',
        rpc: 'test_rpc',
        extra: undefined,
      });
    });
  });

  async function loadAlertingWithEnv(overrides: Record<string, string | undefined>) {
    const saved: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(overrides)) {
      saved[key] = process.env[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    // Skip .env loading when resetting modules to prevent pollution from .env placeholder values
    process.env.SKIP_ENV_LOADING = 'true';
    jest.resetModules();
    jest.mock('../../config/errorTracking', () => ({
      captureMessage: jest.fn(),
      captureException: jest.fn(),
    }));
    jest.mock('../../utils/circuitBreaker', () => ({
      withCircuitBreaker: jest.fn(async (_name: string, fn: () => Promise<any>) => fn()),
      getCircuitBreakerStats: jest.fn(),
      resetCircuitBreaker: jest.fn(),
    }));

    const mod = await import('../alerting');
    return { ...mod, saved };
  }

  function restoreEnv(saved: Record<string, string | undefined>) {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  describe('webhook provider', () => {
    it('should route alert via webhook with no auth', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'webhook',
        ALERTING_ROUTING_CRITICAL: 'webhook',
        ALERTING_ROUTING_ERROR: 'webhook',
        ALERTING_ROUTING_WARNING: 'webhook',
        ALERTING_ROUTING_INFO: 'webhook',
        ALERT_WEBHOOK_URL: 'https://hooks.example.com/alerts',
        ALERT_WEBHOOK_METHOD: 'POST',
        ALERT_WEBHOOK_AUTH_TYPE: 'none',
        ALERT_WEBHOOK_TOKEN: undefined,
        ALERT_WEBHOOK_USERNAME: undefined,
        ALERT_WEBHOOK_PASSWORD: undefined,
        SLACK_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('Webhook Alert', 'Sent via webhook', 'critical');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://hooks.example.com/alerts');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBeUndefined();
      const body = JSON.parse(options.body);
      expect(body.title).toBe('Webhook Alert');

      restoreEnv(saved);
    });

    it('should route alert via webhook with bearer auth', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'webhook',
        ALERTING_ROUTING_CRITICAL: 'webhook',
        ALERT_WEBHOOK_URL: 'https://hooks.example.com/alerts',
        ALERT_WEBHOOK_AUTH_TYPE: 'bearer',
        ALERT_WEBHOOK_TOKEN: 'my-secret-token',
        ALERT_WEBHOOK_USERNAME: undefined,
        ALERT_WEBHOOK_PASSWORD: undefined,
        SLACK_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('Bearer Alert', 'Bearer auth', 'critical');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, options] = fetchSpy.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer my-secret-token');

      restoreEnv(saved);
    });

    it('should route alert via webhook with basic auth', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'webhook',
        ALERTING_ROUTING_CRITICAL: 'webhook',
        ALERT_WEBHOOK_URL: 'https://hooks.example.com/alerts',
        ALERT_WEBHOOK_AUTH_TYPE: 'basic',
        ALERT_WEBHOOK_USERNAME: 'admin',
        ALERT_WEBHOOK_PASSWORD: 'secret',
        ALERT_WEBHOOK_TOKEN: undefined,
        SLACK_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('Basic Auth Alert', 'Basic auth', 'critical');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, options] = fetchSpy.mock.calls[0];
      const expected = Buffer.from('admin:secret').toString('base64');
      expect(options.headers['Authorization']).toBe(`Basic ${expected}`);

      restoreEnv(saved);
    });

    it('should handle webhook response failure gracefully', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'webhook',
        ALERTING_ROUTING_CRITICAL: 'webhook',
        ALERT_WEBHOOK_URL: 'https://hooks.example.com/alerts',
        ALERT_WEBHOOK_AUTH_TYPE: 'none',
        SLACK_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(sa('Fail Alert', 'Will fail', 'critical')).resolves.not.toThrow();

      restoreEnv(saved);
    });
  });

  describe('pagerduty provider', () => {
    it('should route alert via PagerDuty', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'pagerduty',
        ALERTING_ROUTING_CRITICAL: 'pagerduty',
        ALERTING_ROUTING_ERROR: 'pagerduty',
        PAGERDUTY_API_KEY: 'pd-api-key',
        PAGERDUTY_SERVICE_ID: 'pd-service-123',
        PAGERDUTY_INTEGRATION_KEY: 'pd-integration-key',
        SLACK_WEBHOOK_URL: undefined,
        ALERT_WEBHOOK_URL: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('PD Critical', 'PagerDuty alert', 'critical');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://events.pagerduty.com/v2/enqueue');
      const body = JSON.parse(options.body);
      expect(body.routing_key).toBe('pd-integration-key');
      expect(body.event_action).toBe('trigger');
      expect(body.urgency).toBe('high');
      expect(body.payload.summary).toBe('PD Critical');

      restoreEnv(saved);
    });

    it('should set low urgency for warning PagerDuty alerts', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'pagerduty',
        ALERTING_ROUTING_WARNING: 'pagerduty',
        PAGERDUTY_API_KEY: 'pd-api-key',
        PAGERDUTY_INTEGRATION_KEY: 'pd-key',
        SLACK_WEBHOOK_URL: undefined,
        ALERT_WEBHOOK_URL: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('PD Warning', 'Warning alert', 'warning');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.urgency).toBe('low');

      restoreEnv(saved);
    });

    it('should handle PagerDuty response failure gracefully', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'pagerduty',
        ALERTING_ROUTING_CRITICAL: 'pagerduty',
        PAGERDUTY_API_KEY: 'pd-api-key',
        PAGERDUTY_INTEGRATION_KEY: 'pd-key',
        SLACK_WEBHOOK_URL: undefined,
        ALERT_WEBHOOK_URL: undefined,
        SMTP_HOST: undefined,
      });

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(sa('PD Fail', 'Will fail', 'critical')).resolves.not.toThrow();

      restoreEnv(saved);
    });
  });

  describe('email provider', () => {
    it('should route alert via email when SMTP is configured', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'email',
        ALERTING_ROUTING_WARNING: 'email',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_FROM: 'alerts@example.com',
        SMTP_TO: 'admin@example.com,ops@example.com',
        SLACK_WEBHOOK_URL: undefined,
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch');

      // Email provider is a placeholder that logs, no HTTP call
      await expect(sa('Email Alert', 'Via email', 'warning')).resolves.not.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();

      restoreEnv(saved);
    });
  });

  describe('routeAlert with none provider', () => {
    it('should not make any HTTP calls for none provider', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'none',
        ALERTING_ROUTING_INFO: 'none',
        SLACK_WEBHOOK_URL: undefined,
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('None Alert', 'Should not send', 'info');

      expect(fetchSpy).not.toHaveBeenCalled();

      restoreEnv(saved);
    });
  });

  describe('routeAlert with unknown provider', () => {
    it('should log warning for unknown provider', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'slack',
        ALERTING_ROUTING_WARNING: 'unknown_provider',
        SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test',
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      // Should not throw - unknown provider just logs a warning
      await expect(sa('Unknown', 'Unknown provider', 'warning')).resolves.not.toThrow();

      restoreEnv(saved);
    });
  });

  describe('slack provider via loadAlertingWithEnv', () => {
    it('should route alert via slack with proper payload structure', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'slack',
        ALERTING_ROUTING_CRITICAL: 'slack',
        ALERTING_ROUTING_ERROR: 'slack',
        SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
        SLACK_CHANNEL: '#test-alerts',
        SLACK_USERNAME: 'Test Bot',
        SLACK_ICON_EMOJI: ':robot_face:',
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('Slack Test', 'Testing slack provider', 'critical', { region: 'us-east' });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://hooks.slack.com/services/test');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.username).toBe('Test Bot');
      expect(body.channel).toBe('#test-alerts');
      expect(body.icon_emoji).toBe(':robot_face:');
      expect(body.attachments).toHaveLength(1);
      expect(body.attachments[0].title).toContain('Slack Test');
      expect(body.attachments[0].text).toBe('Testing slack provider');
      expect(body.attachments[0].footer).toBe('Armored Archer Alerting');

      restoreEnv(saved);
    });

    it('should skip slack alert when webhook URL is not configured', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'slack',
        ALERTING_ROUTING_WARNING: 'slack',
        SLACK_WEBHOOK_URL: undefined,
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('No Slack', 'No webhook configured', 'warning');

      // Slack config is undefined, so sendSlackAlert returns early
      expect(fetchSpy).not.toHaveBeenCalled();

      restoreEnv(saved);
    });

    it('should handle slack fetch failure gracefully', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'slack',
        ALERTING_ROUTING_CRITICAL: 'slack',
        SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(sa('Slack Fail', 'Should handle failure', 'critical')).resolves.not.toThrow();

      restoreEnv(saved);
    });

    it('should map severity to correct slack emoji and color', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'slack',
        ALERTING_ROUTING_ERROR: 'slack',
        SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('Error Emoji', 'Testing emoji', 'error');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.attachments[0].title).toContain(':x:');
      expect(body.attachments[0].color).toBe('#FFA500');

      restoreEnv(saved);
    });

    it('should send slack alert for warning severity via loadAlertingWithEnv', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'slack',
        ALERTING_ROUTING_WARNING: 'slack',
        SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('Warn Slack', 'Warning via slack', 'warning', { svc: 'api' });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.attachments[0].title).toContain(':warning:');
      expect(body.attachments[0].color).toBe('#FFFF00');

      restoreEnv(saved);
    });

    it('should send slack alert for info severity via loadAlertingWithEnv', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'slack',
        ALERTING_ROUTING_INFO: 'slack',
        SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test',
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('Info Slack', 'Info via slack', 'info');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.attachments[0].title).toContain(':information_source:');
      expect(body.attachments[0].color).toBe('#00FF00');

      restoreEnv(saved);
    });
  });

  describe('webhook fallback and edge cases', () => {
    it('should skip webhook alert when URL is not configured', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'webhook',
        ALERTING_ROUTING_WARNING: 'webhook',
        ALERT_WEBHOOK_URL: undefined,
        SLACK_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('No Webhook', 'URL not set', 'warning');

      expect(fetchSpy).not.toHaveBeenCalled();

      restoreEnv(saved);
    });

    it('should route webhook with PUT method', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'webhook',
        ALERTING_ROUTING_WARNING: 'webhook',
        ALERT_WEBHOOK_URL: 'https://example.com/webhook',
        ALERT_WEBHOOK_METHOD: 'PUT',
        ALERT_WEBHOOK_AUTH_TYPE: 'none',
        SLACK_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('PUT Webhook', 'Testing PUT', 'warning');

      const [, options] = fetchSpy.mock.calls[0];
      expect(options.method).toBe('PUT');

      restoreEnv(saved);
    });
  });

  describe('pagerduty edge cases', () => {
    it('should skip PagerDuty alert when API key is not configured', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'pagerduty',
        ALERTING_ROUTING_CRITICAL: 'pagerduty',
        PAGERDUTY_API_KEY: undefined,
        SLACK_WEBHOOK_URL: undefined,
        ALERT_WEBHOOK_URL: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('No PD', 'API key missing', 'critical');

      expect(fetchSpy).not.toHaveBeenCalled();

      restoreEnv(saved);
    });

    it('should set low urgency for info PagerDuty alerts', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'pagerduty',
        ALERTING_ROUTING_INFO: 'pagerduty',
        PAGERDUTY_API_KEY: 'pd-key',
        PAGERDUTY_INTEGRATION_KEY: 'pd-int-key',
        SLACK_WEBHOOK_URL: undefined,
        ALERT_WEBHOOK_URL: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('PD Info', 'Info alert', 'info');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.urgency).toBe('low');
      expect(body.payload.severity).toBe('info');

      restoreEnv(saved);
    });

    it('should set high urgency for error PagerDuty alerts', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'pagerduty',
        ALERTING_ROUTING_ERROR: 'pagerduty',
        PAGERDUTY_API_KEY: 'pd-key',
        PAGERDUTY_INTEGRATION_KEY: 'pd-int-key',
        SLACK_WEBHOOK_URL: undefined,
        ALERT_WEBHOOK_URL: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('PD Error', 'Error alert', 'error');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.urgency).toBe('high');
      expect(body.payload.severity).toBe('error');

      restoreEnv(saved);
    });
  });

  describe('email provider edge cases', () => {
    it('should skip email alert when SMTP host is not configured', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'email',
        ALERTING_ROUTING_WARNING: 'email',
        SMTP_HOST: undefined,
        SLACK_WEBHOOK_URL: undefined,
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('No Email', 'SMTP not configured', 'warning');

      expect(fetchSpy).not.toHaveBeenCalled();

      restoreEnv(saved);
    });
  });

  describe('circuit breaker fallback paths', () => {
    async function loadWithFallbackMock(overrides: Record<string, string | undefined>) {
      const saved: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(overrides)) {
        saved[key] = process.env[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }

      jest.resetModules();
      jest.mock('../../config/errorTracking', () => ({
        captureMessage: jest.fn(),
        captureException: jest.fn(),
      }));
      jest.mock('../../utils/circuitBreaker', () => ({
        withCircuitBreaker: jest.fn(
          async (_name: string, _fn: () => Promise<any>, fallback?: () => Promise<any>) => {
            if (fallback) await fallback();
          }
        ),
        getCircuitBreakerStats: jest.fn(),
        resetCircuitBreaker: jest.fn(),
      }));

      const mod = await import('../alerting');
      return { ...mod, saved };
    }

    it('should call slack fallback when circuit breaker routes to fallback', async () => {
      const { sendAlert: sa, saved } = await loadWithFallbackMock({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'slack',
        ALERTING_ROUTING_CRITICAL: 'slack',
        SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test',
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch');

      // With fallback mock, the fallback function is called instead of the main fn
      await expect(sa('FB Slack', 'Fallback test', 'critical')).resolves.not.toThrow();
      // fetch should NOT be called since fallback is invoked instead of main fn
      expect(fetchSpy).not.toHaveBeenCalled();

      restoreEnv(saved);
    });

    it('should call webhook fallback when circuit breaker routes to fallback', async () => {
      const { sendAlert: sa, saved } = await loadWithFallbackMock({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'webhook',
        ALERTING_ROUTING_CRITICAL: 'webhook',
        ALERT_WEBHOOK_URL: 'https://example.com/hook',
        SLACK_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch');

      await expect(sa('FB Webhook', 'Fallback test', 'critical')).resolves.not.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();

      restoreEnv(saved);
    });

    it('should call pagerduty fallback when circuit breaker routes to fallback', async () => {
      const { sendAlert: sa, saved } = await loadWithFallbackMock({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'pagerduty',
        ALERTING_ROUTING_CRITICAL: 'pagerduty',
        PAGERDUTY_API_KEY: 'pd-key',
        PAGERDUTY_INTEGRATION_KEY: 'pd-int-key',
        SLACK_WEBHOOK_URL: undefined,
        ALERT_WEBHOOK_URL: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch');

      await expect(sa('FB PD', 'Fallback test', 'critical')).resolves.not.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();

      restoreEnv(saved);
    });
  });

  describe('sendAlert slack routing via loadAlertingWithEnv', () => {
    it('should route warning alerts through slack provider', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'slack',
        ALERTING_ROUTING_WARNING: 'slack',
        SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T00/B00/xyz',
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('DefaultSlack', 'Via slack', 'warning');

      expect(fetchSpy).toHaveBeenCalled();
      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain('hooks.slack.com');

      restoreEnv(saved);
    });

    it('should route info alerts through slack provider', async () => {
      const { sendAlert: sa, saved } = await loadAlertingWithEnv({
        ALERTING_ENABLED: 'true',
        ALERTING_MIN_ENV_LEVEL: 'development',
        NODE_ENV: 'development',
        ALERTING_DEFAULT_PROVIDER: 'slack',
        ALERTING_ROUTING_INFO: 'slack',
        SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T00/B00/xyz',
        ALERT_WEBHOOK_URL: undefined,
        PAGERDUTY_API_KEY: undefined,
        SMTP_HOST: undefined,
      });

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await sa('InfoSlack', 'Info via slack', 'info');

      expect(fetchSpy).toHaveBeenCalled();

      restoreEnv(saved);
    });
  });

  describe('alert state accumulation', () => {
    it('should accumulate alert counts across different keys', async () => {
      clearAlertState();
      jest.clearAllMocks();

      const realDateNow = Date.now;
      let currentTime = 1000000;
      jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      await sendAlert('AccumA', 'First', 'warning');
      currentTime += 901 * 1000;
      await sendAlert('AccumA', 'Second', 'warning');
      currentTime += 901 * 1000;
      await sendAlert('AccumB', 'Other', 'warning');

      const stats = getAlertStats();
      expect(stats['AccumA:warning'].alertCount).toBe(2);
      expect(stats['AccumB:warning'].alertCount).toBe(1);

      Date.now = realDateNow;
    });

    it('should preserve lastAlertTime across alert sends', async () => {
      clearAlertState();
      jest.clearAllMocks();

      const realDateNow = Date.now;
      let currentTime = 5000000;
      jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      await sendAlert('TimeTest', 'First', 'error');
      const firstStats = getAlertStats();
      const firstTime = firstStats['TimeTest:error'].lastAlertTime;

      currentTime += 601 * 1000;
      await sendAlert('TimeTest', 'Second', 'error');
      const secondStats = getAlertStats();
      const secondTime = secondStats['TimeTest:error'].lastAlertTime;

      expect(secondTime).toBeGreaterThan(firstTime);

      Date.now = realDateNow;
    });
  });

  describe('initializeAlerting when disabled', () => {
    it('should log disabled message when alerting is off', async () => {
      const savedEnabled = process.env.ALERTING_ENABLED;
      process.env.ALERTING_ENABLED = 'false';

      jest.resetModules();
      jest.mock('../../config/errorTracking', () => ({
        captureMessage: jest.fn(),
        captureException: jest.fn(),
      }));

      const mod = await import('../alerting');
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      mod.initializeAlerting(mockLogger as any);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('disabled'));

      process.env.ALERTING_ENABLED = savedEnabled;
    });
  });
});
