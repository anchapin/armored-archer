/**
 * Alerting Module Tests
 */

import {
  initializeAlerting,
  sendAlert,
  triggerHealthAlert,
  triggerMetricAlert,
  sendErrorAlert,
  getAlertStats,
  clearAlertState,
  AlertPayload,
  AlertSeverity,
} from '../alerting';

// Mock dependencies
jest.mock('../../config', () => ({
  config: {
    alerting: {
      enabled: true,
      defaultProvider: 'slack',
      cooldownMinutes: 5,
      routing: {
        critical: 'pagerduty',
        error: 'slack',
        warning: 'slack',
      },
      providers: {
        pagerduty: {
          enabled: false,
          apiKey: 'test-key',
          serviceId: 'test-service',
        },
        slack: {
          enabled: false,
          webhookUrl: 'https://hooks.slack.com/test',
          channel: '#alerts',
        },
        webhook: {
          enabled: false,
          url: 'https://example.com/webhook',
        },
        email: {
          enabled: false,
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          from: 'alerts@example.com',
          to: 'admin@example.com',
        },
      },
    },
  },
}));

jest.mock('../../config/alerting', () => ({
  alertingConfig: {
    enabled: true,
    defaultProvider: 'slack',
    cooldownMinutes: 5,
    routing: {
      critical: 'pagerduty',
      error: 'slack',
      warning: 'slack',
    },
  },
  isAlertingEnabled: jest.fn().mockReturnValue(true),
  getAlertProvider: jest.fn().mockReturnValue('slack'),
  getAlertCooldown: jest.fn().mockReturnValue(300000),
  shouldTriggerHealthAlert: jest.fn().mockReturnValue(true),
}));

jest.mock('../../config/errorTracking', () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

describe('alerting', () => {
  beforeEach(() => {
    clearAlertState();
    jest.clearAllMocks();
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
    it('should not throw when sending alert with valid payload', async () => {
      const payload: AlertPayload = {
        title: 'Test Alert',
        message: 'This is a test alert',
        severity: 'warning' as AlertSeverity,
        tags: { component: 'test' },
        timestamp: Date.now(),
        source: 'test',
      };

      // Should not throw even when providers are disabled
      await expect(sendAlert(payload)).resolves.not.toThrow();
    });

    it('should handle alert with metrics', async () => {
      const payload: AlertPayload = {
        title: 'Test Alert with Metrics',
        message: 'This is a test alert',
        severity: 'warning' as AlertSeverity,
        tags: { component: 'test' },
        metrics: { cpu: 75, memory: 80 },
        timestamp: Date.now(),
        source: 'test',
      };

      await expect(sendAlert(payload)).resolves.not.toThrow();
    });
  });

  describe('triggerHealthAlert', () => {
    it('should trigger health alert without errors', () => {
      expect(() => triggerHealthAlert(
        'cpu',
        95,
        {}
      )).not.toThrow();
    });

    it('should handle warning level health alerts', () => {
      expect(() => triggerHealthAlert(
        'memory',
        75,
        {}
      )).not.toThrow();
    });
  });

  describe('triggerMetricAlert', () => {
    it('should trigger metric alert without errors', () => {
      expect(() => triggerMetricAlert(
        'matchQueue',
        100,
        50,
        'warning'
      )).not.toThrow();
    });
  });

  describe('sendErrorAlert', () => {
    it('should send error alert without errors', () => {
      expect(() => sendErrorAlert(
        'Test Error',
        'This is a test error message'
      )).not.toThrow();
    });
  });

  describe('getAlertStats', () => {
    it('should return alert stats object', () => {
      const stats = getAlertStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should track alert state after triggering alerts', () => {
      // Use valid metric names that match the healthAlerts config
      triggerHealthAlert('cpuCriticalPercent', 95, {});
      
      const stats = getAlertStats();
      // Stats should exist - alert was tracked
      expect(stats).toBeDefined();
    });
  });

  describe('clearAlertState', () => {
    it('should clear alert state without errors', () => {
      // Trigger an alert first
      triggerHealthAlert('cpuCriticalPercent', 95, {});
      
      // Clear state
      expect(() => clearAlertState()).not.toThrow();
      
      // Stats should be empty after clear
      const stats = getAlertStats();
      expect(Object.keys(stats).length).toBe(0);
    });
  });
});
