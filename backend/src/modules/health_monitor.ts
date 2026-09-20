/**
 * Health Monitor Module
 *
 * This module provides continuous health monitoring for the Nakama backend:
 * - System health checks (CPU, memory, disk usage)
 * - Database health monitoring
 * - Custom metric monitoring (active connections, match queue, etc.)
 * - Automatic alerting when thresholds are exceeded
 * - Integration with Prometheus metrics
 */

import * as os from 'os';
import { execSync } from 'child_process';
import { Gauge, Registry } from 'prom-client';
import { alertingConfig, isAlertingEnabled } from '../config/alerting';
import { Runtime } from '../types/nakama';
import { triggerHealthAlert, triggerMetricAlert } from './alerting';
import { logger } from '../config/logger';
import { getAverageResponseTimeMs, getErrorRate as getRpcErrorRate } from './rpc_latency_tracker';
import { getStorageRawValue } from '../utils/storage-helpers';

// Create a dedicated registry for health metrics
const healthRegistry = new Registry();

/**
 * Health metrics
 */
const healthCheckCpuUsage = new Gauge({
  name: 'armored_archer_health_cpu_usage_percent',
  help: 'Current CPU usage percentage',
  registers: [healthRegistry],
});

const healthCheckMemoryUsage = new Gauge({
  name: 'armored_archer_health_memory_usage_percent',
  help: 'Current memory usage percentage',
  registers: [healthRegistry],
});

const healthCheckDiskUsage = new Gauge({
  name: 'armored_archer_health_disk_usage_percent',
  help: 'Current disk usage percentage',
  registers: [healthRegistry],
});

const healthCheckDbConnections = new Gauge({
  name: 'armored_archer_health_db_connections_percent',
  help: 'Current database connection usage percentage',
  registers: [healthRegistry],
});

const healthCheckResponseTime = new Gauge({
  name: 'armored_archer_health_response_time_ms',
  help: 'Current average response time in milliseconds',
  registers: [healthRegistry],
});

const healthCheckErrorRate = new Gauge({
  name: 'armored_archer_health_error_rate_percent',
  help: 'Current error rate percentage',
  registers: [healthRegistry],
});

const healthCheckActiveConnections = new Gauge({
  name: 'armored_archer_health_active_connections',
  help: 'Current number of active connections',
  registers: [healthRegistry],
});

const healthCheckMatchQueue = new Gauge({
  name: 'armored_archer_health_match_queue_size',
  help: 'Current match queue size',
  registers: [healthRegistry],
});

const healthStatus = new Gauge({
  name: 'armored_archer_health_status',
  help: 'Overall health status (1=healthy, 0=unhealthy)',
  labelNames: ['component'],
  registers: [healthRegistry],
});

// Health monitoring state
let healthMonitorInterval: NodeJS.Timeout | null = null;
let isMonitoring = false;
let nkInstance: Runtime.Nakama | null = null;

/**
 * Get the health metrics registry
 */
export function getHealthRegistry(): Registry {
  return healthRegistry;
}

/**
 * Get current CPU usage percentage
 */
function getCpuUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - (100 * idle) / total;

  return Math.round(usage * 100) / 100;
}

/**
 * Get current memory usage percentage
 */
function getMemoryUsage(): number {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  return Math.round((usedMemory / totalMemory) * 100 * 100) / 100;
}

/**
 * Get current disk usage percentage
 */
function getDiskUsage(): number {
  try {
    const output = execSync('df -h /', { encoding: 'utf-8', timeout: 5000 });
    const lines = output.trim().split('\n');
    if (lines.length >= 2) {
      // Parse "Use%" column - typically the 5th column in df -h output
      const parts = lines[1].trim().split(/\s+/);
      const useCol = parts.find((p) => p.endsWith('%'));
      if (useCol) {
        const pct = parseFloat(useCol.replace('%', ''));
        if (!isNaN(pct)) return Math.round(pct * 100) / 100;
      }
    }
  } catch {
    // df not available or failed
  }
  return 0;
}

/**
 * Get current database connection usage percentage
 */
function getDbConnectionUsage(): number {
  if (!nkInstance) return 0;
  try {
    const result = nkInstance.storageRead([
      { collection: 'system_health', key: 'db_connections', userId: '' },
    ]);
    if (result.length > 0) {
      const data = JSON.parse(getStorageRawValue(result[0].value) ?? "");
      if (data.active && data.max) {
        return Math.round((data.active / data.max) * 100 * 100) / 100;
      }
    }
  } catch {
    // Storage read not available or parsing failed
  }
  return 0;
}

/**
 * Get current active connections from the metrics registry
 */
function getActiveConnections(): number {
  try {
    const { getMetricsRegistry } = require('./metrics');
    const registry = getMetricsRegistry();
    const gauge = registry.getSingleMetric('armored_archer_player_active_sessions');
    if (gauge && typeof (gauge as any).get === 'function') {
      const result = (gauge as any).get() as { values: Array<{ value: number }> };
      if (result?.values?.length > 0) {
        return result.values[0].value;
      }
    }
  } catch {
    // Metrics registry not available
  }
  return 0;
}

/**
 * Get current match queue size from matchmaking storage
 */
function getMatchQueueSize(): number {
  if (!nkInstance) return 0;
  try {
    const objects = nkInstance.storageRead([
      { collection: 'matchmaking', key: 'matchmaking_pool_1v1', userId: '' },
      { collection: 'matchmaking', key: 'matchmaking_pool_2v2', userId: '' },
    ]);
    let total = 0;
    for (const obj of objects) {
      try {
        const data = JSON.parse(getStorageRawValue(obj.value) ?? "");
        if (Array.isArray(data.players)) {
          total += data.players.length;
        }
      } catch {
        // Skip unparseable entries
      }
    }
    return total;
  } catch {
    // Storage read not available
  }
  return 0;
}

/**
 * Get current average response time from the RPC latency tracker
 */
function getResponseTime(): number {
  return getAverageResponseTimeMs();
}

/**
 * Get current error rate from the RPC latency tracker
 */
function getErrorRate(): number {
  return getRpcErrorRate();
}

/**
 * Perform health check and update metrics
 */
export function performHealthCheck(): Record<string, number> {
  const cpuUsage = getCpuUsage();
  const memoryUsage = getMemoryUsage();
  const diskUsage = getDiskUsage();
  const dbConnections = getDbConnectionUsage();
  const activeConnections = getActiveConnections();
  const matchQueue = getMatchQueueSize();
  const responseTime = getResponseTime();
  const errorRate = getErrorRate();

  // Update Prometheus metrics
  healthCheckCpuUsage.set(cpuUsage);
  healthCheckMemoryUsage.set(memoryUsage);
  healthCheckDiskUsage.set(diskUsage);
  healthCheckDbConnections.set(dbConnections);
  healthCheckResponseTime.set(responseTime);
  healthCheckErrorRate.set(errorRate);
  healthCheckActiveConnections.set(activeConnections);
  healthCheckMatchQueue.set(matchQueue);

  // Determine overall health
  const healthAlerts = alertingConfig.healthAlerts;
  let overallHealthy = true;

  if (cpuUsage >= healthAlerts.cpuCriticalPercent) {
    overallHealthy = false;
  } else if (memoryUsage >= healthAlerts.memoryCriticalPercent) {
    overallHealthy = false;
  } else if (diskUsage >= healthAlerts.diskCriticalPercent) {
    overallHealthy = false;
  } else if (dbConnections >= healthAlerts.dbConnectionsCriticalPercent) {
    overallHealthy = false;
  }

  healthStatus.set({ component: 'overall' }, overallHealthy ? 1 : 0);
  healthStatus.set({ component: 'cpu' }, cpuUsage < healthAlerts.cpuCriticalPercent ? 1 : 0);
  healthStatus.set(
    { component: 'memory' },
    memoryUsage < healthAlerts.memoryCriticalPercent ? 1 : 0
  );
  healthStatus.set({ component: 'disk' }, diskUsage < healthAlerts.diskCriticalPercent ? 1 : 0);
  healthStatus.set(
    { component: 'database' },
    dbConnections < healthAlerts.dbConnectionsCriticalPercent ? 1 : 0
  );

  return {
    cpuUsage,
    memoryUsage,
    diskUsage,
    dbConnections,
    activeConnections,
    matchQueue,
    responseTime,
    errorRate,
  };
}

/**
 * Check health metrics against thresholds and trigger alerts
 */
function checkHealthThresholds(metrics: Record<string, number>): void {
  if (!isAlertingEnabled()) {
    return;
  }

  const healthAlerts = alertingConfig.healthAlerts;
  const currentMetrics = metrics;

  // Check CPU
  if (metrics.cpuUsage >= healthAlerts.cpuCriticalPercent) {
    triggerHealthAlert('cpuCriticalPercent', metrics.cpuUsage, currentMetrics);
  } else if (metrics.cpuUsage >= healthAlerts.cpuWarningPercent) {
    triggerHealthAlert('cpuWarningPercent', metrics.cpuUsage, currentMetrics);
  }

  // Check Memory
  if (metrics.memoryUsage >= healthAlerts.memoryCriticalPercent) {
    triggerHealthAlert('memoryCriticalPercent', metrics.memoryUsage, currentMetrics);
  } else if (metrics.memoryUsage >= healthAlerts.memoryWarningPercent) {
    triggerHealthAlert('memoryWarningPercent', metrics.memoryUsage, currentMetrics);
  }

  // Check Disk
  if (metrics.diskUsage >= healthAlerts.diskCriticalPercent) {
    triggerHealthAlert('diskCriticalPercent', metrics.diskUsage, currentMetrics);
  } else if (metrics.diskUsage >= healthAlerts.diskWarningPercent) {
    triggerHealthAlert('diskWarningPercent', metrics.diskUsage, currentMetrics);
  }

  // Check DB Connections
  if (metrics.dbConnections >= healthAlerts.dbConnectionsCriticalPercent) {
    triggerHealthAlert('dbConnectionsCriticalPercent', metrics.dbConnections, currentMetrics);
  } else if (metrics.dbConnections >= healthAlerts.dbConnectionsWarningPercent) {
    triggerHealthAlert('dbConnectionsWarningPercent', metrics.dbConnections, currentMetrics);
  }

  // Check Response Time
  if (metrics.responseTime >= healthAlerts.responseTimeCriticalMs) {
    triggerHealthAlert('responseTimeCriticalMs', metrics.responseTime, currentMetrics);
  } else if (metrics.responseTime >= healthAlerts.responseTimeWarningMs) {
    triggerHealthAlert('responseTimeWarningMs', metrics.responseTime, currentMetrics);
  }

  // Check Error Rate
  if (metrics.errorRate >= healthAlerts.errorRateCriticalPercent) {
    triggerHealthAlert('errorRateCriticalPercent', metrics.errorRate, currentMetrics);
  } else if (metrics.errorRate >= healthAlerts.errorRateWarningPercent) {
    triggerHealthAlert('errorRateWarningPercent', metrics.errorRate, currentMetrics);
  }
}

/**
 * Check custom metric thresholds and trigger alerts
 */
function checkMetricThresholds(metrics: Record<string, number>): void {
  if (!isAlertingEnabled()) {
    return;
  }

  const metricAlerts = alertingConfig.metricAlerts;

  // Check Active Connections
  if (metrics.activeConnections >= metricAlerts.activeConnectionsCritical) {
    triggerMetricAlert(
      'activeConnections',
      metrics.activeConnections,
      metricAlerts.activeConnectionsCritical,
      'critical'
    );
  } else if (metrics.activeConnections >= metricAlerts.activeConnectionsWarning) {
    triggerMetricAlert(
      'activeConnections',
      metrics.activeConnections,
      metricAlerts.activeConnectionsWarning,
      'warning'
    );
  }

  // Check Match Queue
  if (metrics.matchQueue >= metricAlerts.matchQueueCritical) {
    triggerMetricAlert(
      'matchQueue',
      metrics.matchQueue,
      metricAlerts.matchQueueCritical,
      'critical'
    );
  } else if (metrics.matchQueue >= metricAlerts.matchQueueWarning) {
    triggerMetricAlert('matchQueue', metrics.matchQueue, metricAlerts.matchQueueWarning, 'warning');
  }
}

/**
 * Run health monitoring cycle
 */
function runHealthCheck(): void {
  try {
    const metrics = performHealthCheck();
    checkHealthThresholds(metrics);
    checkMetricThresholds(metrics);
  } catch (error) {
    logger.error('Error during health check:', error);
  }
}

/**
 * Start the health monitoring loop
 */
export function startHealthMonitoring(intervalMs: number = 60000): void {
  if (process.env.NODE_ENV === 'test') {
    logger.info('Skipping health monitoring in test mode');
    return;
  }

  if (isMonitoring) {
    logger.warn('Health monitoring already running');
    return;
  }

  if (!isAlertingEnabled()) {
    logger.info('Health monitoring disabled - alerting not enabled');
    return;
  }

  isMonitoring = true;
  healthMonitorInterval = setInterval(runHealthCheck, intervalMs);

  logger.info(`Started health monitoring (interval: ${intervalMs}ms)`);

  // Run initial health check
  runHealthCheck();
}

/**
 * Stop the health monitoring loop
 */
export function stopHealthMonitoring(): void {
  if (healthMonitorInterval) {
    clearInterval(healthMonitorInterval);
    healthMonitorInterval = null;
  }
  isMonitoring = false;
  logger.info('Stopped health monitoring');
}

/**
 * Get current health status
 */
export function getHealthStatus(): {
  healthy: boolean;
  metrics: Record<string, number>;
  isMonitoring: boolean;
} {
  const metrics = performHealthCheck();
  const healthAlerts = alertingConfig.healthAlerts;

  const healthy =
    metrics.cpuUsage < healthAlerts.cpuCriticalPercent &&
    metrics.memoryUsage < healthAlerts.memoryCriticalPercent &&
    metrics.diskUsage < healthAlerts.diskCriticalPercent &&
    metrics.dbConnections < healthAlerts.dbConnectionsCriticalPercent;

  return {
    healthy,
    metrics,
    isMonitoring,
  };
}

/**
 * Initialize health monitoring
 */
export function initializeHealthMonitoring(logger: Runtime.Logger, nk?: Runtime.Nakama): void {
  if (nk) {
    nkInstance = nk;
  }

  // Set initial health status
  healthStatus.set({ component: 'overall' }, 1);
  healthStatus.set({ component: 'cpu' }, 1);
  healthStatus.set({ component: 'memory' }, 1);
  healthStatus.set({ component: 'disk' }, 1);
  healthStatus.set({ component: 'database' }, 1);

  logger.info('[HealthMonitor] Initialized health monitoring');

  // Start monitoring if enabled
  if (isAlertingEnabled()) {
    // Default to 60 second intervals
    startHealthMonitoring(60000);
  }
}
