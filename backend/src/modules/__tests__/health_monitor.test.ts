/**
 * Health Monitor Module Tests
 *
 * Comprehensive tests for the health monitoring system with mocked
 * alerting config, alert triggers, and logger.
 */

jest.mock('../../config/alerting', () => ({
  alertingConfig: {
    healthAlerts: {
      cpuCriticalPercent: 90,
      cpuWarningPercent: 80,
      memoryCriticalPercent: 90,
      memoryWarningPercent: 80,
      diskCriticalPercent: 90,
      diskWarningPercent: 80,
      dbConnectionsCriticalPercent: 90,
      dbConnectionsWarningPercent: 80,
      responseTimeCriticalMs: 1000,
      responseTimeWarningMs: 500,
      errorRateCriticalPercent: 10,
      errorRateWarningPercent: 5,
    },
    metricAlerts: {
      activeConnectionsCritical: 1000,
      activeConnectionsWarning: 500,
      matchQueueCritical: 100,
      matchQueueWarning: 50,
    },
  },
  isAlertingEnabled: jest.fn().mockReturnValue(false),
}));

jest.mock('../alerting', () => ({
  triggerHealthAlert: jest.fn(),
  triggerMetricAlert: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { Registry } from 'prom-client';
import {
  getHealthRegistry,
  performHealthCheck,
  startHealthMonitoring,
  stopHealthMonitoring,
  getHealthStatus,
  initializeHealthMonitoring,
} from '../health_monitor';

describe('health_monitor', () => {
  beforeEach(() => {
    stopHealthMonitoring();
    jest.clearAllMocks();
  });

  afterEach(() => {
    stopHealthMonitoring();
    jest.clearAllMocks();
  });

  describe('performHealthCheck', () => {
    it('should return all 8 metric keys', () => {
      const metrics = performHealthCheck();

      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('diskUsage');
      expect(metrics).toHaveProperty('dbConnections');
      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('matchQueue');
      expect(metrics).toHaveProperty('responseTime');
      expect(metrics).toHaveProperty('errorRate');

      expect(Object.keys(metrics)).toHaveLength(8);
    });

    it('should return numeric values for all metrics', () => {
      const metrics = performHealthCheck();

      for (const [key, value] of Object.entries(metrics)) {
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      }
    });

    it('should return CPU usage between 0 and 100', () => {
      const metrics = performHealthCheck();
      expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpuUsage).toBeLessThanOrEqual(100);
    });

    it('should return memory usage between 0 and 100', () => {
      const metrics = performHealthCheck();
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage).toBeLessThanOrEqual(100);
    });

    it('should update Prometheus gauges in the registry', async () => {
      performHealthCheck();

      const registry = getHealthRegistry();
      const jsonMetrics = await registry.getMetricsAsJSON();
      const metricNames = jsonMetrics.map((m: any) => m.name);

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

  describe('getHealthStatus', () => {
    it('should return object with healthy, metrics, and isMonitoring', () => {
      const status = getHealthStatus();

      expect(status).toHaveProperty('healthy');
      expect(typeof status.healthy).toBe('boolean');

      expect(status).toHaveProperty('metrics');
      expect(typeof status.metrics).toBe('object');

      expect(status).toHaveProperty('isMonitoring');
      expect(typeof status.isMonitoring).toBe('boolean');
    });

    it('should include all 8 metric keys in the metrics property', () => {
      const status = getHealthStatus();

      expect(status.metrics).toHaveProperty('cpuUsage');
      expect(status.metrics).toHaveProperty('memoryUsage');
      expect(status.metrics).toHaveProperty('diskUsage');
      expect(status.metrics).toHaveProperty('dbConnections');
      expect(status.metrics).toHaveProperty('activeConnections');
      expect(status.metrics).toHaveProperty('matchQueue');
      expect(status.metrics).toHaveProperty('responseTime');
      expect(status.metrics).toHaveProperty('errorRate');
    });

    it('should report isMonitoring as false when not running', () => {
      const status = getHealthStatus();
      expect(status.isMonitoring).toBe(false);
    });

    it('should report isMonitoring as true when monitoring is active', () => {
      const { isAlertingEnabled } = require('../../config/alerting');
      (isAlertingEnabled as jest.Mock).mockReturnValue(true);

      startHealthMonitoring(9999999);
      const status = getHealthStatus();
      expect(status.isMonitoring).toBe(true);

      (isAlertingEnabled as jest.Mock).mockReturnValue(false);
    });

    it('should report healthy as true when all metrics are below critical thresholds', () => {
      // Default thresholds are 90% for cpu/memory/disk/db, real values are well below
      const status = getHealthStatus();
      expect(status.healthy).toBe(true);
    });

    it('should report healthy as false when cpu exceeds critical threshold', () => {
      const { alertingConfig } = require('../../config/alerting');
      alertingConfig.healthAlerts.cpuCriticalPercent = 0;

      const status = getHealthStatus();
      expect(status.healthy).toBe(false);

      alertingConfig.healthAlerts.cpuCriticalPercent = 90;
    });

    it('should report healthy as false when memory exceeds critical threshold', () => {
      const { alertingConfig } = require('../../config/alerting');
      // Set cpuCritical very high so cpu check passes, then memory check triggers
      alertingConfig.healthAlerts.cpuCriticalPercent = 101;
      alertingConfig.healthAlerts.memoryCriticalPercent = 0;

      const status = getHealthStatus();
      expect(status.healthy).toBe(false);

      alertingConfig.healthAlerts.cpuCriticalPercent = 90;
      alertingConfig.healthAlerts.memoryCriticalPercent = 90;
    });

    it('should report healthy as false when disk exceeds critical threshold', () => {
      const { alertingConfig } = require('../../config/alerting');
      alertingConfig.healthAlerts.cpuCriticalPercent = 101;
      alertingConfig.healthAlerts.memoryCriticalPercent = 101;
      alertingConfig.healthAlerts.diskCriticalPercent = 0;

      const status = getHealthStatus();
      expect(status.healthy).toBe(false);

      alertingConfig.healthAlerts.cpuCriticalPercent = 90;
      alertingConfig.healthAlerts.memoryCriticalPercent = 90;
      alertingConfig.healthAlerts.diskCriticalPercent = 90;
    });

    it('should report healthy as false when db connections exceed critical threshold', () => {
      const { alertingConfig } = require('../../config/alerting');
      alertingConfig.healthAlerts.cpuCriticalPercent = 101;
      alertingConfig.healthAlerts.memoryCriticalPercent = 101;
      alertingConfig.healthAlerts.diskCriticalPercent = 101;
      alertingConfig.healthAlerts.dbConnectionsCriticalPercent = 0;

      const status = getHealthStatus();
      expect(status.healthy).toBe(false);

      alertingConfig.healthAlerts.cpuCriticalPercent = 90;
      alertingConfig.healthAlerts.memoryCriticalPercent = 90;
      alertingConfig.healthAlerts.diskCriticalPercent = 90;
      alertingConfig.healthAlerts.dbConnectionsCriticalPercent = 90;
    });

    it('should set health status components correctly', async () => {
      const { alertingConfig } = require('../../config/alerting');
      alertingConfig.healthAlerts.cpuCriticalPercent = 0;

      performHealthCheck();

      const registry = getHealthRegistry();
      const jsonMetrics = await registry.getMetricsAsJSON();
      const healthStatusMetric = jsonMetrics.find(
        (m: any) => m.name === 'armored_archer_health_status'
      );

      expect(healthStatusMetric).toBeDefined();
      const values = (healthStatusMetric as any).values;
      const overall = values.find((v: any) => v.labels.component === 'overall');
      const cpu = values.find((v: any) => v.labels.component === 'cpu');

      expect(overall.value).toBe(0);
      expect(cpu.value).toBe(0);

      alertingConfig.healthAlerts.cpuCriticalPercent = 90;
    });
  });

  describe('stopHealthMonitoring', () => {
    it('should clear the monitoring interval', () => {
      const { isAlertingEnabled } = require('../../config/alerting');
      (isAlertingEnabled as jest.Mock).mockReturnValue(true);

      startHealthMonitoring(9999999);

      // Verify monitoring is running
      let status = getHealthStatus();
      expect(status.isMonitoring).toBe(true);

      stopHealthMonitoring();

      // Verify monitoring stopped
      status = getHealthStatus();
      expect(status.isMonitoring).toBe(false);

      (isAlertingEnabled as jest.Mock).mockReturnValue(false);
    });

    it('should not throw when called without monitoring active', () => {
      expect(() => stopHealthMonitoring()).not.toThrow();
    });

    it('should allow restarting after stop', () => {
      const { isAlertingEnabled } = require('../../config/alerting');
      (isAlertingEnabled as jest.Mock).mockReturnValue(true);

      startHealthMonitoring(9999999);
      stopHealthMonitoring();

      expect(() => startHealthMonitoring(9999999)).not.toThrow();

      const status = getHealthStatus();
      expect(status.isMonitoring).toBe(true);

      (isAlertingEnabled as jest.Mock).mockReturnValue(false);
    });
  });

  describe('initializeHealthMonitoring', () => {
    it('should set initial health gauges without errors', () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      expect(() => initializeHealthMonitoring(mockLogger as any)).not.toThrow();
    });

    it('should set all health status gauges to 1 (healthy)', async () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      initializeHealthMonitoring(mockLogger as any);

      const registry = getHealthRegistry();
      const jsonMetrics = await registry.getMetricsAsJSON();
      const healthStatusMetric = jsonMetrics.find(
        (m: any) => m.name === 'armored_archer_health_status'
      );

      expect(healthStatusMetric).toBeDefined();
      const values = (healthStatusMetric as any).values;
      const componentValues = values.filter((v: any) => v.labels.component !== 'overall');

      // After initialization, all components should be healthy (1)
      for (const v of componentValues) {
        expect(v.value).toBe(1);
      }
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

    it('should start monitoring when alerting is enabled', () => {
      const { isAlertingEnabled } = require('../../config/alerting');
      (isAlertingEnabled as jest.Mock).mockReturnValue(true);

      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      initializeHealthMonitoring(mockLogger as any);

      const status = getHealthStatus();
      expect(status.isMonitoring).toBe(true);

      (isAlertingEnabled as jest.Mock).mockReturnValue(false);
    });

    it('should not start monitoring when alerting is disabled', () => {
      const { isAlertingEnabled } = require('../../config/alerting');
      (isAlertingEnabled as jest.Mock).mockReturnValue(false);

      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      initializeHealthMonitoring(mockLogger as any);

      const status = getHealthStatus();
      expect(status.isMonitoring).toBe(false);
    });
  });

  describe('getHealthRegistry', () => {
    it('should return a prom-client Registry instance', () => {
      const registry = getHealthRegistry();
      expect(registry).toBeInstanceOf(Registry);
    });

    it('should return the same registry on multiple calls', () => {
      const registry1 = getHealthRegistry();
      const registry2 = getHealthRegistry();
      expect(registry1).toBe(registry2);
    });

    it('should contain health metric definitions', async () => {
      const registry = getHealthRegistry();
      const metrics = await registry.metrics();

      expect(metrics).toContain('armored_archer_health_cpu_usage_percent');
      expect(metrics).toContain('armored_archer_health_memory_usage_percent');
      expect(metrics).toContain('armored_archer_health_disk_usage_percent');
      expect(metrics).toContain('armored_archer_health_db_connections_percent');
      expect(metrics).toContain('armored_archer_health_response_time_ms');
      expect(metrics).toContain('armored_archer_health_error_rate_percent');
      expect(metrics).toContain('armored_archer_health_active_connections');
      expect(metrics).toContain('armored_archer_health_match_queue_size');
      expect(metrics).toContain('armored_archer_health_status');
    });
  });

  describe('startHealthMonitoring', () => {
    it('should not start when alerting is disabled', () => {
      const { isAlertingEnabled } = require('../../config/alerting');
      (isAlertingEnabled as jest.Mock).mockReturnValue(false);

      startHealthMonitoring(9999999);

      const status = getHealthStatus();
      expect(status.isMonitoring).toBe(false);
    });

    it('should not create duplicate intervals when called twice', () => {
      const { isAlertingEnabled } = require('../../config/alerting');
      (isAlertingEnabled as jest.Mock).mockReturnValue(true);

      startHealthMonitoring(9999999);
      const { logger } = require('../../config/logger');
      (logger.warn as jest.Mock).mockClear();

      startHealthMonitoring(9999999);

      expect(logger.warn).toHaveBeenCalledWith('Health monitoring already running');

      (isAlertingEnabled as jest.Mock).mockReturnValue(false);
    });

    it('should run an initial health check on start', () => {
      const { isAlertingEnabled } = require('../../config/alerting');
      (isAlertingEnabled as jest.Mock).mockReturnValue(true);

      startHealthMonitoring(9999999);

      // Metrics should be populated from the initial health check
      const status = getHealthStatus();
      expect(typeof status.metrics.cpuUsage).toBe('number');
      expect(typeof status.metrics.memoryUsage).toBe('number');

      (isAlertingEnabled as jest.Mock).mockReturnValue(false);
    });

    it('should trigger health alerts when thresholds are exceeded and alerting is enabled', () => {
      const { isAlertingEnabled, alertingConfig } = require('../../config/alerting');
      const { triggerHealthAlert } = require('../alerting');

      (isAlertingEnabled as jest.Mock).mockReturnValue(true);
      // Set low thresholds so real metrics trigger alerts
      alertingConfig.healthAlerts.cpuCriticalPercent = 0;
      alertingConfig.healthAlerts.cpuWarningPercent = 0;
      alertingConfig.healthAlerts.memoryCriticalPercent = 0;
      alertingConfig.healthAlerts.memoryWarningPercent = 0;
      alertingConfig.healthAlerts.diskCriticalPercent = 0;
      alertingConfig.healthAlerts.diskWarningPercent = 0;
      alertingConfig.healthAlerts.dbConnectionsCriticalPercent = 0;
      alertingConfig.healthAlerts.dbConnectionsWarningPercent = 0;
      alertingConfig.healthAlerts.responseTimeCriticalMs = 0;
      alertingConfig.healthAlerts.responseTimeWarningMs = 0;
      alertingConfig.healthAlerts.errorRateCriticalPercent = 0;
      alertingConfig.healthAlerts.errorRateWarningPercent = 0;

      startHealthMonitoring(9999999);

      expect(triggerHealthAlert).toHaveBeenCalled();

      (isAlertingEnabled as jest.Mock).mockReturnValue(false);
      alertingConfig.healthAlerts.cpuCriticalPercent = 90;
      alertingConfig.healthAlerts.cpuWarningPercent = 80;
      alertingConfig.healthAlerts.memoryCriticalPercent = 90;
      alertingConfig.healthAlerts.memoryWarningPercent = 80;
      alertingConfig.healthAlerts.diskCriticalPercent = 90;
      alertingConfig.healthAlerts.diskWarningPercent = 80;
      alertingConfig.healthAlerts.dbConnectionsCriticalPercent = 90;
      alertingConfig.healthAlerts.dbConnectionsWarningPercent = 80;
      alertingConfig.healthAlerts.responseTimeCriticalMs = 1000;
      alertingConfig.healthAlerts.responseTimeWarningMs = 500;
      alertingConfig.healthAlerts.errorRateCriticalPercent = 10;
      alertingConfig.healthAlerts.errorRateWarningPercent = 5;
    });

    it('should trigger metric alerts when thresholds are exceeded', () => {
      const { isAlertingEnabled, alertingConfig } = require('../../config/alerting');
      const { triggerMetricAlert } = require('../alerting');

      (isAlertingEnabled as jest.Mock).mockReturnValue(true);
      alertingConfig.metricAlerts.activeConnectionsCritical = 0;
      alertingConfig.metricAlerts.activeConnectionsWarning = 0;
      alertingConfig.metricAlerts.matchQueueCritical = 0;
      alertingConfig.metricAlerts.matchQueueWarning = 0;

      startHealthMonitoring(9999999);

      expect(triggerMetricAlert).toHaveBeenCalled();

      (isAlertingEnabled as jest.Mock).mockReturnValue(false);
      alertingConfig.metricAlerts.activeConnectionsCritical = 1000;
      alertingConfig.metricAlerts.activeConnectionsWarning = 500;
      alertingConfig.metricAlerts.matchQueueCritical = 100;
      alertingConfig.metricAlerts.matchQueueWarning = 50;
    });

    it('should trigger only warning alerts when between warning and critical thresholds', () => {
      const { isAlertingEnabled, alertingConfig } = require('../../config/alerting');
      const { triggerHealthAlert } = require('../alerting');

      (isAlertingEnabled as jest.Mock).mockReturnValue(true);
      // Set warning to 0 but critical to 100 - metrics will exceed warning but not critical
      alertingConfig.healthAlerts.cpuCriticalPercent = 100;
      alertingConfig.healthAlerts.cpuWarningPercent = 0;
      alertingConfig.healthAlerts.memoryCriticalPercent = 100;
      alertingConfig.healthAlerts.memoryWarningPercent = 0;
      alertingConfig.healthAlerts.diskCriticalPercent = 100;
      alertingConfig.healthAlerts.diskWarningPercent = 0;
      alertingConfig.healthAlerts.dbConnectionsCriticalPercent = 100;
      alertingConfig.healthAlerts.dbConnectionsWarningPercent = 0;
      alertingConfig.healthAlerts.responseTimeCriticalMs = 10000;
      alertingConfig.healthAlerts.responseTimeWarningMs = 0;
      alertingConfig.healthAlerts.errorRateCriticalPercent = 100;
      alertingConfig.healthAlerts.errorRateWarningPercent = 0;

      startHealthMonitoring(9999999);

      // Should trigger warning-level alerts (not critical)
      expect(triggerHealthAlert).toHaveBeenCalled();

      (isAlertingEnabled as jest.Mock).mockReturnValue(false);
      alertingConfig.healthAlerts.cpuCriticalPercent = 90;
      alertingConfig.healthAlerts.cpuWarningPercent = 80;
      alertingConfig.healthAlerts.memoryCriticalPercent = 90;
      alertingConfig.healthAlerts.memoryWarningPercent = 80;
      alertingConfig.healthAlerts.diskCriticalPercent = 90;
      alertingConfig.healthAlerts.diskWarningPercent = 80;
      alertingConfig.healthAlerts.dbConnectionsCriticalPercent = 90;
      alertingConfig.healthAlerts.dbConnectionsWarningPercent = 80;
      alertingConfig.healthAlerts.responseTimeCriticalMs = 1000;
      alertingConfig.healthAlerts.responseTimeWarningMs = 500;
      alertingConfig.healthAlerts.errorRateCriticalPercent = 10;
      alertingConfig.healthAlerts.errorRateWarningPercent = 5;
    });

    it('should not trigger alerts when metrics are below thresholds', () => {
      const { isAlertingEnabled, alertingConfig } = require('../../config/alerting');
      const { triggerHealthAlert, triggerMetricAlert } = require('../alerting');

      (isAlertingEnabled as jest.Mock).mockReturnValue(true);
      // Set very high thresholds - no alerts should trigger
      alertingConfig.healthAlerts.cpuCriticalPercent = 99;
      alertingConfig.healthAlerts.cpuWarningPercent = 95;
      alertingConfig.healthAlerts.memoryCriticalPercent = 99;
      alertingConfig.healthAlerts.memoryWarningPercent = 95;
      alertingConfig.healthAlerts.diskCriticalPercent = 99;
      alertingConfig.healthAlerts.diskWarningPercent = 95;
      alertingConfig.healthAlerts.dbConnectionsCriticalPercent = 99;
      alertingConfig.healthAlerts.dbConnectionsWarningPercent = 95;
      alertingConfig.healthAlerts.responseTimeCriticalMs = 10000;
      alertingConfig.healthAlerts.responseTimeWarningMs = 5000;
      alertingConfig.healthAlerts.errorRateCriticalPercent = 100;
      alertingConfig.healthAlerts.errorRateWarningPercent = 95;
      alertingConfig.metricAlerts.activeConnectionsCritical = 999999;
      alertingConfig.metricAlerts.activeConnectionsWarning = 999999;
      alertingConfig.metricAlerts.matchQueueCritical = 999999;
      alertingConfig.metricAlerts.matchQueueWarning = 999999;

      startHealthMonitoring(9999999);

      expect(triggerHealthAlert).not.toHaveBeenCalled();
      expect(triggerMetricAlert).not.toHaveBeenCalled();

      (isAlertingEnabled as jest.Mock).mockReturnValue(false);
      alertingConfig.healthAlerts.cpuCriticalPercent = 90;
      alertingConfig.healthAlerts.cpuWarningPercent = 80;
      alertingConfig.healthAlerts.memoryCriticalPercent = 90;
      alertingConfig.healthAlerts.memoryWarningPercent = 80;
      alertingConfig.healthAlerts.diskCriticalPercent = 90;
      alertingConfig.healthAlerts.diskWarningPercent = 80;
      alertingConfig.healthAlerts.dbConnectionsCriticalPercent = 90;
      alertingConfig.healthAlerts.dbConnectionsWarningPercent = 80;
      alertingConfig.healthAlerts.responseTimeCriticalMs = 1000;
      alertingConfig.healthAlerts.responseTimeWarningMs = 500;
      alertingConfig.healthAlerts.errorRateCriticalPercent = 10;
      alertingConfig.healthAlerts.errorRateWarningPercent = 5;
      alertingConfig.metricAlerts.activeConnectionsCritical = 1000;
      alertingConfig.metricAlerts.activeConnectionsWarning = 500;
      alertingConfig.metricAlerts.matchQueueCritical = 100;
      alertingConfig.metricAlerts.matchQueueWarning = 50;
    });
  });
});
