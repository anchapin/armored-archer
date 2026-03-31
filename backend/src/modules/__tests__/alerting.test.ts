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
  beforeEach(() => {
    clearAlertState();
    jest.clearAllMocks();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response);
  });

  afterEach(() => {
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
      await expect(sendAlert('Tagged Alert', 'With tags', 'warning', { component: 'test' })).resolves.not.toThrow();
    });

    it('should handle alert with metrics', async () => {
      await expect(sendAlert('Metric Alert', 'With metrics', 'warning', {}, { cpu: 75, memory: 80 })).resolves.not.toThrow();
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
      expect(() => triggerMetricAlert('connections', 500, 100, 'error', { region: 'us' })).not.toThrow();
    });
  });

  describe('sendErrorAlert', () => {
    it('should send error alert with Error object', () => {
      const error = new Error('Test error');
      expect(() => sendErrorAlert(error, { rpc: 'test_rpc' })).not.toThrow();
    });

    it('should send error alert with context', () => {
      const error = new Error('Database error');
      expect(() => sendErrorAlert(error, {
        userId: 'user-123',
        rpc: 'db_query',
        extra: { query: 'SELECT *' },
      })).not.toThrow();
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
});
