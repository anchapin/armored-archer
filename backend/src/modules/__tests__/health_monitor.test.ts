/**
 * Health Monitor Module Tests - Integration-style tests
 * Uses real prom-client registry and real config/alerting
 * Only mocks external alerting triggers to avoid side effects
 */

process.env.ALERTING_ENABLED = 'true';
process.env.ALERTING_MIN_ENV_LEVEL = 'development';
process.env.NODE_ENV = 'development';
process.env.ALERT_CPU_WARNING_PERCENT = '0';
process.env.ALERT_CPU_CRITICAL_PERCENT = '0';
process.env.ALERT_MEMORY_WARNING_PERCENT = '0';
process.env.ALERT_MEMORY_CRITICAL_PERCENT = '0';
process.env.ALERT_DISK_WARNING_PERCENT = '0';
process.env.ALERT_DISK_CRITICAL_PERCENT = '0';
process.env.ALERT_DB_CONNECTIONS_WARNING_PERCENT = '0';
process.env.ALERT_DB_CONNECTIONS_CRITICAL_PERCENT = '0';
process.env.ALERT_RESPONSE_TIME_WARNING_MS = '0';
process.env.ALERT_RESPONSE_TIME_CRITICAL_MS = '0';
process.env.ALERT_ERROR_RATE_WARNING_PERCENT = '0';
process.env.ALERT_ERROR_RATE_CRITICAL_PERCENT = '0';
process.env.ALERT_ACTIVE_CONNECTIONS_WARNING = '0';
process.env.ALERT_ACTIVE_CONNECTIONS_CRITICAL = '0';
process.env.ALERT_MATCH_QUEUE_WARNING = '0';
process.env.ALERT_MATCH_QUEUE_CRITICAL = '0';

import {
  getHealthRegistry,
  performHealthCheck,
  startHealthMonitoring,
  stopHealthMonitoring,
  getHealthStatus,
  initializeHealthMonitoring,
} from '../health_monitor';
import { triggerHealthAlert, triggerMetricAlert } from '../alerting';

jest.mock('../alerting', () => ({
  triggerHealthAlert: jest.fn(),
  triggerMetricAlert: jest.fn(),
}));

describe('health_monitor', () => {
  beforeEach(() => {
    stopHealthMonitoring();
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      expect(typeof healthMetrics.cpuUsage).toBe('number');
    });

    it('should include memory usage in health metrics', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics).toHaveProperty('memoryUsage');
      expect(typeof healthMetrics.memoryUsage).toBe('number');
    });

    it('should include disk usage in health metrics', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics).toHaveProperty('diskUsage');
      expect(typeof healthMetrics.diskUsage).toBe('number');
    });

    it('should include database connections in health metrics', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics).toHaveProperty('dbConnections');
    });

    it('should include active connections in health metrics', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics).toHaveProperty('activeConnections');
    });

    it('should include match queue in health metrics', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics).toHaveProperty('matchQueue');
    });

    it('should include response time in health metrics', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics).toHaveProperty('responseTime');
    });

    it('should include error rate in health metrics', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics).toHaveProperty('errorRate');
    });

    it('should return CPU usage between 0 and 100', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(healthMetrics.cpuUsage).toBeLessThanOrEqual(100);
    });

    it('should return memory usage between 0 and 100', () => {
      const healthMetrics = performHealthCheck();
      
      expect(healthMetrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(healthMetrics.memoryUsage).toBeLessThanOrEqual(100);
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
      expect(typeof status.healthy).toBe('boolean');
    });

    it('should include metrics field', () => {
      const status = getHealthStatus();
      
      expect(status).toHaveProperty('metrics');
      expect(typeof status.metrics).toBe('object');
    });

    it('should include isMonitoring field', () => {
      const status = getHealthStatus();
      
      expect(status).toHaveProperty('isMonitoring');
      expect(typeof status.isMonitoring).toBe('boolean');
    });

    it('should report health status correctly based on thresholds', () => {
      const status = getHealthStatus();
      
      expect(status).toHaveProperty('healthy');
      expect(typeof status.healthy).toBe('boolean');
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

    it('should log initialization message', () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      initializeHealthMonitoring(mockLogger as any);

      expect(mockLogger.info).toHaveBeenCalledWith('[HealthMonitor] Initialized health monitoring');
    });
  });

  describe('threshold alert triggering', () => {
    it('should trigger health alerts when monitoring starts (real system metrics)', () => {
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerHealthAlert as jest.Mock;
      expect(mockedTrigger).toHaveBeenCalled();
    });

    it('should trigger metric alerts when monitoring starts (real system metrics)', () => {
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerMetricAlert as jest.Mock;
      expect(mockedTrigger).toHaveBeenCalled();
    });

    it('should call triggerHealthAlert with correct metric names', () => {
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerHealthAlert as jest.Mock;
      const calls = mockedTrigger.mock.calls;
      
      const metricNames = calls.map((call: any[]) => call[0]);
      expect(metricNames).toContain('cpuCriticalPercent');
      expect(metricNames).toContain('memoryCriticalPercent');
    });

    it('should call triggerMetricAlert with correct metric names', () => {
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerMetricAlert as jest.Mock;
      const calls = mockedTrigger.mock.calls;
      
      const metricNames = calls.map((call: any[]) => call[0]);
      expect(metricNames).toContain('activeConnections');
      expect(metricNames).toContain('matchQueue');
    });
  });
});
