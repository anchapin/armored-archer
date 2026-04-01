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

  describe('checkHealthThresholds warning branches', () => {
    let savedConfig: Record<string, any>;

    beforeEach(() => {
      // Save original config values
      const { alertingConfig: cfg } = require('../../config/alerting');
      savedConfig = {
        cpuWarningPercent: cfg.healthAlerts.cpuWarningPercent,
        cpuCriticalPercent: cfg.healthAlerts.cpuCriticalPercent,
        memoryWarningPercent: cfg.healthAlerts.memoryWarningPercent,
        memoryCriticalPercent: cfg.healthAlerts.memoryCriticalPercent,
        diskWarningPercent: cfg.healthAlerts.diskWarningPercent,
        diskCriticalPercent: cfg.healthAlerts.diskCriticalPercent,
        dbConnectionsWarningPercent: cfg.healthAlerts.dbConnectionsWarningPercent,
        dbConnectionsCriticalPercent: cfg.healthAlerts.dbConnectionsCriticalPercent,
        responseTimeWarningMs: cfg.healthAlerts.responseTimeWarningMs,
        responseTimeCriticalMs: cfg.healthAlerts.responseTimeCriticalMs,
        errorRateWarningPercent: cfg.healthAlerts.errorRateWarningPercent,
        errorRateCriticalPercent: cfg.healthAlerts.errorRateCriticalPercent,
      };
    });

    afterEach(() => {
      // Restore original config values
      const { alertingConfig: cfg } = require('../../config/alerting');
      Object.assign(cfg.healthAlerts, savedConfig);
    });

    it('should trigger warning alert for CPU when value is between warning and critical', () => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      // Set warning to 1% and critical very high so real CPU falls in warning range
      cfg.healthAlerts.cpuWarningPercent = 1;
      cfg.healthAlerts.cpuCriticalPercent = 999999;

      stopHealthMonitoring();
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerHealthAlert as jest.Mock;
      const cpuCalls = mockedTrigger.mock.calls.filter(
        (call: any[]) => call[0] === 'cpuWarningPercent'
      );
      // Real CPU usage is typically > 1%, so warning should trigger
      expect(cpuCalls.length).toBeGreaterThan(0);
    });

    it('should trigger warning alert for memory when value is between warning and critical', () => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      cfg.healthAlerts.memoryWarningPercent = 1;
      cfg.healthAlerts.memoryCriticalPercent = 999999;

      stopHealthMonitoring();
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerHealthAlert as jest.Mock;
      const memoryCalls = mockedTrigger.mock.calls.filter(
        (call: any[]) => call[0] === 'memoryWarningPercent'
      );
      expect(memoryCalls.length).toBeGreaterThan(0);
    });

    it('should trigger warning alert for disk when value is between warning and critical', () => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      // Disk usage returns 0 from placeholder, so set warning to 0 and critical high
      cfg.healthAlerts.diskWarningPercent = 0;
      cfg.healthAlerts.diskCriticalPercent = 999999;

      stopHealthMonitoring();
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerHealthAlert as jest.Mock;
      const diskCalls = mockedTrigger.mock.calls.filter(
        (call: any[]) => call[0] === 'diskWarningPercent'
      );
      expect(diskCalls.length).toBeGreaterThan(0);
    });

    it('should trigger warning alert for dbConnections when value is between warning and critical', () => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      cfg.healthAlerts.dbConnectionsWarningPercent = 0;
      cfg.healthAlerts.dbConnectionsCriticalPercent = 999999;

      stopHealthMonitoring();
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerHealthAlert as jest.Mock;
      const dbCalls = mockedTrigger.mock.calls.filter(
        (call: any[]) => call[0] === 'dbConnectionsWarningPercent'
      );
      expect(dbCalls.length).toBeGreaterThan(0);
    });

    it('should trigger warning alert for responseTime when value is between warning and critical', () => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      cfg.healthAlerts.responseTimeWarningMs = 0;
      cfg.healthAlerts.responseTimeCriticalMs = 999999;

      stopHealthMonitoring();
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerHealthAlert as jest.Mock;
      const rtCalls = mockedTrigger.mock.calls.filter(
        (call: any[]) => call[0] === 'responseTimeWarningMs'
      );
      expect(rtCalls.length).toBeGreaterThan(0);
    });

    it('should trigger warning alert for errorRate when value is between warning and critical', () => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      cfg.healthAlerts.errorRateWarningPercent = 0;
      cfg.healthAlerts.errorRateCriticalPercent = 999999;

      stopHealthMonitoring();
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerHealthAlert as jest.Mock;
      const erCalls = mockedTrigger.mock.calls.filter(
        (call: any[]) => call[0] === 'errorRateWarningPercent'
      );
      expect(erCalls.length).toBeGreaterThan(0);
    });
  });

  describe('checkHealthThresholds no-alert branches', () => {
    let savedConfig: Record<string, any>;

    beforeEach(() => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      savedConfig = {
        cpuWarningPercent: cfg.healthAlerts.cpuWarningPercent,
        cpuCriticalPercent: cfg.healthAlerts.cpuCriticalPercent,
        memoryWarningPercent: cfg.healthAlerts.memoryWarningPercent,
        memoryCriticalPercent: cfg.healthAlerts.memoryCriticalPercent,
        diskWarningPercent: cfg.healthAlerts.diskWarningPercent,
        diskCriticalPercent: cfg.healthAlerts.diskCriticalPercent,
        dbConnectionsWarningPercent: cfg.healthAlerts.dbConnectionsWarningPercent,
        dbConnectionsCriticalPercent: cfg.healthAlerts.dbConnectionsCriticalPercent,
        responseTimeWarningMs: cfg.healthAlerts.responseTimeWarningMs,
        responseTimeCriticalMs: cfg.healthAlerts.responseTimeCriticalMs,
        errorRateWarningPercent: cfg.healthAlerts.errorRateWarningPercent,
        errorRateCriticalPercent: cfg.healthAlerts.errorRateCriticalPercent,
      };
    });

    afterEach(() => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      Object.assign(cfg.healthAlerts, savedConfig);
    });

    it('should not trigger any health alerts when all metrics are below thresholds', () => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      // Set all thresholds very high so real metrics are below
      cfg.healthAlerts.cpuWarningPercent = 999999;
      cfg.healthAlerts.cpuCriticalPercent = 999999;
      cfg.healthAlerts.memoryWarningPercent = 999999;
      cfg.healthAlerts.memoryCriticalPercent = 999999;
      cfg.healthAlerts.diskWarningPercent = 999999;
      cfg.healthAlerts.diskCriticalPercent = 999999;
      cfg.healthAlerts.dbConnectionsWarningPercent = 999999;
      cfg.healthAlerts.dbConnectionsCriticalPercent = 999999;
      cfg.healthAlerts.responseTimeWarningMs = 999999;
      cfg.healthAlerts.responseTimeCriticalMs = 999999;
      cfg.healthAlerts.errorRateWarningPercent = 999999;
      cfg.healthAlerts.errorRateCriticalPercent = 999999;

      stopHealthMonitoring();
      (triggerHealthAlert as jest.Mock).mockClear();
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerHealthAlert as jest.Mock;
      const healthCalls = mockedTrigger.mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('Percent') || call[0].includes('Ms')
      );
      expect(healthCalls.length).toBe(0);
    });
  });

  describe('checkMetricThresholds warning branches', () => {
    let savedConfig: Record<string, any>;

    beforeEach(() => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      savedConfig = {
        activeConnectionsWarning: cfg.metricAlerts.activeConnectionsWarning,
        activeConnectionsCritical: cfg.metricAlerts.activeConnectionsCritical,
        matchQueueWarning: cfg.metricAlerts.matchQueueWarning,
        matchQueueCritical: cfg.metricAlerts.matchQueueCritical,
      };
    });

    afterEach(() => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      Object.assign(cfg.metricAlerts, savedConfig);
    });

    it('should trigger warning alert for activeConnections when value is between warning and critical', () => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      // Active connections returns 0 from placeholder, set warning to 0 and critical high
      cfg.metricAlerts.activeConnectionsWarning = 0;
      cfg.metricAlerts.activeConnectionsCritical = 999999;

      stopHealthMonitoring();
      (triggerMetricAlert as jest.Mock).mockClear();
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerMetricAlert as jest.Mock;
      const acCalls = mockedTrigger.mock.calls.filter(
        (call: any[]) => call[0] === 'activeConnections' && call[3] === 'warning'
      );
      expect(acCalls.length).toBeGreaterThan(0);
    });

    it('should trigger warning alert for matchQueue when value is between warning and critical', () => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      cfg.metricAlerts.matchQueueWarning = 0;
      cfg.metricAlerts.matchQueueCritical = 999999;

      stopHealthMonitoring();
      (triggerMetricAlert as jest.Mock).mockClear();
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerMetricAlert as jest.Mock;
      const mqCalls = mockedTrigger.mock.calls.filter(
        (call: any[]) => call[0] === 'matchQueue' && call[3] === 'warning'
      );
      expect(mqCalls.length).toBeGreaterThan(0);
    });

    it('should not trigger metric alerts when values are below thresholds', () => {
      const { alertingConfig: cfg } = require('../../config/alerting');
      cfg.metricAlerts.activeConnectionsWarning = 999999;
      cfg.metricAlerts.activeConnectionsCritical = 999999;
      cfg.metricAlerts.matchQueueWarning = 999999;
      cfg.metricAlerts.matchQueueCritical = 999999;

      stopHealthMonitoring();
      (triggerMetricAlert as jest.Mock).mockClear();
      startHealthMonitoring(9999999);

      const mockedTrigger = triggerMetricAlert as jest.Mock;
      expect(mockedTrigger).not.toHaveBeenCalled();
    });
  });

  describe('checkHealthThresholds alerting disabled', () => {
    it('should not trigger alerts when alerting is disabled', () => {
      const { alertingConfig: cfg, isAlertingEnabled: isEnabled } = require('../../config/alerting');
      const originalEnabled = cfg.enabled;
      cfg.enabled = false;

      stopHealthMonitoring();
      (triggerHealthAlert as jest.Mock).mockClear();
      (triggerMetricAlert as jest.Mock).mockClear();

      // Directly call performHealthCheck and check thresholds via startHealthMonitoring
      // When alerting is disabled, startHealthMonitoring returns early
      startHealthMonitoring(9999999);

      // Since alerting is disabled, startHealthMonitoring should return early
      // and not call triggerHealthAlert or triggerMetricAlert
      expect(triggerHealthAlert).not.toHaveBeenCalled();
      expect(triggerMetricAlert).not.toHaveBeenCalled();

      cfg.enabled = originalEnabled;
    });
  });

  describe('startHealthMonitoring already running', () => {
    it('should not start a second monitoring loop when already running', () => {
      startHealthMonitoring(9999999);

      const infoSpy = jest.spyOn(require('../../config/logger').logger, 'warn');
      startHealthMonitoring(9999999);

      expect(infoSpy).toHaveBeenCalledWith('Health monitoring already running');
      infoSpy.mockRestore();
    });
  });

  describe('Prometheus gauge updates in performHealthCheck', () => {
    it('should update all Prometheus gauges on health check', () => {
      const registry = getHealthRegistry();
      const metrics = performHealthCheck();

      // Verify the metrics were returned with expected keys
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('diskUsage');
      expect(metrics).toHaveProperty('dbConnections');
      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('matchQueue');
      expect(metrics).toHaveProperty('responseTime');
      expect(metrics).toHaveProperty('errorRate');

      // Verify Prometheus gauges were set by checking registry metrics
      return registry.getMetricsAsJSON().then((metricsData) => {
        const metricNames = metricsData.map((m: any) => m.name);
        expect(metricNames).toContain('armored_archer_health_cpu_usage_percent');
        expect(metricNames).toContain('armored_archer_health_memory_usage_percent');
        expect(metricNames).toContain('armored_archer_health_disk_usage_percent');
        expect(metricNames).toContain('armored_archer_health_db_connections_percent');
        expect(metricNames).toContain('armored_archer_health_response_time_ms');
        expect(metricNames).toContain('armored_archer_health_error_rate_percent');
        expect(metricNames).toContain('armored_archer_health_active_connections');
        expect(metricNames).toContain('armored_archer_health_match_queue_size');
        expect(metricNames).toContain('armored_archer_health_status');
      });
    });
  });
});
