/**
 * Health Monitor Module Tests
 */

import {
  getHealthRegistry,
  performHealthCheck,
  startHealthMonitoring,
  stopHealthMonitoring,
  getHealthStatus,
  initializeHealthMonitoring,
} from '../health_monitor';

// Mock dependencies
jest.mock('../../config', () => ({
  config: {
    alerting: {
      enabled: true,
      defaultProvider: 'slack',
      cooldownMinutes: 5,
    },
  },
}));

jest.mock('../../config/alerting', () => ({
  alertingConfig: {
    enabled: true,
    healthAlerts: {
      cpuWarningPercent: 70,
      cpuCriticalPercent: 90,
      memoryWarningPercent: 75,
      memoryCriticalPercent: 90,
      diskWarningPercent: 80,
      diskCriticalPercent: 95,
      dbConnectionsWarningPercent: 70,
      dbConnectionsCriticalPercent: 90,
    },
    metricAlerts: {
      activeConnectionsWarning: 1000,
      activeConnectionsCritical: 2000,
      matchQueueWarning: 50,
      matchQueueCritical: 100,
      matchWaitTimeWarning: 30,
      matchWaitTimeCritical: 60,
      dbQueryTimeWarning: 1000,
      dbQueryTimeCritical: 5000,
      failedLoginsWarning: 10,
      failedLoginsCritical: 50,
      purchaseFailuresWarning: 5,
      purchaseFailuresCritical: 20,
    },
  },
  isAlertingEnabled: jest.fn().mockReturnValue(true),
  triggerHealthAlert: jest.fn(),
  triggerMetricAlert: jest.fn(),
}));

jest.mock('prom-client', () => ({
  Registry: jest.fn().mockImplementation(() => ({
    metrics: jest.fn().mockResolvedValue('mock metrics'),
    contentType: 'text/plain',
    register: jest.fn(),
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    inc: jest.fn(),
    dec: jest.fn(),
  })),
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn(),
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    startTimer: jest.fn().mockReturnValue(jest.fn()),
  })),
}));

describe('health_monitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stopHealthMonitoring();
  });

  describe('getHealthRegistry', () => {
    it('should return health registry', () => {
      const registry = getHealthRegistry();
      expect(registry).toBeDefined();
    });
  });

  describe('performHealthCheck', () => {
    it('should perform health check and return metrics', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics).toBeDefined();
      expect(typeof healthMetrics).toBe('object');
    });

    it('should include CPU usage in health metrics', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics).toHaveProperty('cpuUsage');
    });

    it('should include memory usage in health metrics', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics).toHaveProperty('memoryUsage');
    });

    it('should include disk usage in health metrics', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics).toHaveProperty('diskUsage');
    });
  });

  describe('startHealthMonitoring', () => {
    it('should start health monitoring without errors', () => {
      expect(() => startHealthMonitoring(1000)).not.toThrow();
    });

    it('should start with custom interval', () => {
      expect(() => startHealthMonitoring(5000)).not.toThrow();
    });
  });

  describe('stopHealthMonitoring', () => {
    it('should stop health monitoring without errors', () => {
      startHealthMonitoring(1000);
      expect(() => stopHealthMonitoring()).not.toThrow();
    });

    it('should handle stop when not running', () => {
      expect(() => stopHealthMonitoring()).not.toThrow();
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status object', () => {
      const status = getHealthStatus();
      
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });

    it('should include healthy field', () => {
      const status = getHealthStatus();
      
      expect(status).toHaveProperty('healthy');
    });
  });

  describe('initializeHealthMonitoring', () => {
    it('should initialize health monitoring without errors', () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      expect(() => initializeHealthMonitoring(mockLogger as any)).not.toThrow();
    });
  });
});
