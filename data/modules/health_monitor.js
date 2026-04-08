"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealthRegistry = getHealthRegistry;
exports.performHealthCheck = performHealthCheck;
exports.startHealthMonitoring = startHealthMonitoring;
exports.stopHealthMonitoring = stopHealthMonitoring;
exports.getHealthStatus = getHealthStatus;
exports.initializeHealthMonitoring = initializeHealthMonitoring;
var tslib_1 = require("tslib");
var os = tslib_1.__importStar(require("os"));
var prom_client_1 = require("prom-client");
var alerting_1 = require("../config/alerting");
var alerting_2 = require("./alerting");
var logger_1 = require("../config/logger");
// Create a dedicated registry for health metrics
var healthRegistry = new prom_client_1.Registry();
/**
 * Health metrics
 */
var healthCheckCpuUsage = new prom_client_1.Gauge({
    name: 'armored_archer_health_cpu_usage_percent',
    help: 'Current CPU usage percentage',
    registers: [healthRegistry],
});
var healthCheckMemoryUsage = new prom_client_1.Gauge({
    name: 'armored_archer_health_memory_usage_percent',
    help: 'Current memory usage percentage',
    registers: [healthRegistry],
});
var healthCheckDiskUsage = new prom_client_1.Gauge({
    name: 'armored_archer_health_disk_usage_percent',
    help: 'Current disk usage percentage',
    registers: [healthRegistry],
});
var healthCheckDbConnections = new prom_client_1.Gauge({
    name: 'armored_archer_health_db_connections_percent',
    help: 'Current database connection usage percentage',
    registers: [healthRegistry],
});
var healthCheckResponseTime = new prom_client_1.Gauge({
    name: 'armored_archer_health_response_time_ms',
    help: 'Current average response time in milliseconds',
    registers: [healthRegistry],
});
var healthCheckErrorRate = new prom_client_1.Gauge({
    name: 'armored_archer_health_error_rate_percent',
    help: 'Current error rate percentage',
    registers: [healthRegistry],
});
var healthCheckActiveConnections = new prom_client_1.Gauge({
    name: 'armored_archer_health_active_connections',
    help: 'Current number of active connections',
    registers: [healthRegistry],
});
var healthCheckMatchQueue = new prom_client_1.Gauge({
    name: 'armored_archer_health_match_queue_size',
    help: 'Current match queue size',
    registers: [healthRegistry],
});
var healthStatus = new prom_client_1.Gauge({
    name: 'armored_archer_health_status',
    help: 'Overall health status (1=healthy, 0=unhealthy)',
    labelNames: ['component'],
    registers: [healthRegistry],
});
// Health monitoring state
var healthMonitorInterval = null;
var isMonitoring = false;
/**
 * Get the health metrics registry
 */
function getHealthRegistry() {
    return healthRegistry;
}
/**
 * Get current CPU usage percentage
 */
function getCpuUsage() {
    var e_1, _a;
    var cpus = os.cpus();
    var totalIdle = 0;
    var totalTick = 0;
    try {
        for (var cpus_1 = tslib_1.__values(cpus), cpus_1_1 = cpus_1.next(); !cpus_1_1.done; cpus_1_1 = cpus_1.next()) {
            var cpu = cpus_1_1.value;
            for (var type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (cpus_1_1 && !cpus_1_1.done && (_a = cpus_1.return)) _a.call(cpus_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var idle = totalIdle / cpus.length;
    var total = totalTick / cpus.length;
    var usage = 100 - (100 * idle) / total;
    return Math.round(usage * 100) / 100;
}
/**
 * Get current memory usage percentage
 */
function getMemoryUsage() {
    var totalMemory = os.totalmem();
    var freeMemory = os.freemem();
    var usedMemory = totalMemory - freeMemory;
    return Math.round((usedMemory / totalMemory) * 100 * 100) / 100;
}
/**
 * Get current disk usage percentage (placeholder - would need fs.statfs in real implementation)
 */
function getDiskUsage() {
    // In a real implementation, you would use fs.statfs() or similar
    // For now, return a placeholder value
    return 0;
}
/**
 * Get current database connection usage (placeholder - would need actual DB metrics)
 */
function getDbConnectionUsage() {
    // In a real implementation, you would query the database for connection count
    // For now, return a placeholder value
    return 0;
}
/**
 * Get current active connections (placeholder - would need actual connection tracking)
 */
function getActiveConnections() {
    // In a real implementation, you would get this from Nakama or a connection tracker
    return 0;
}
/**
 * Get current match queue size (placeholder - would need actual matchmaker metrics)
 */
function getMatchQueueSize() {
    // In a real implementation, you would get this from the matchmaker
    return 0;
}
/**
 * Get current response time (placeholder - would need actual latency tracking)
 */
function getResponseTime() {
    // In a real implementation, you would calculate this from actual request metrics
    return 0;
}
/**
 * Get current error rate (placeholder - would need actual error tracking)
 */
function getErrorRate() {
    // In a real implementation, you would calculate this from actual error counts
    return 0;
}
/**
 * Perform health check and update metrics
 */
function performHealthCheck() {
    var cpuUsage = getCpuUsage();
    var memoryUsage = getMemoryUsage();
    var diskUsage = getDiskUsage();
    var dbConnections = getDbConnectionUsage();
    var activeConnections = getActiveConnections();
    var matchQueue = getMatchQueueSize();
    var responseTime = getResponseTime();
    var errorRate = getErrorRate();
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
    var healthAlerts = alerting_1.alertingConfig.healthAlerts;
    var overallHealthy = true;
    if (cpuUsage >= healthAlerts.cpuCriticalPercent) {
        overallHealthy = false;
    }
    else if (memoryUsage >= healthAlerts.memoryCriticalPercent) {
        overallHealthy = false;
    }
    else if (diskUsage >= healthAlerts.diskCriticalPercent) {
        overallHealthy = false;
    }
    else if (dbConnections >= healthAlerts.dbConnectionsCriticalPercent) {
        overallHealthy = false;
    }
    healthStatus.set({ component: 'overall' }, overallHealthy ? 1 : 0);
    healthStatus.set({ component: 'cpu' }, cpuUsage < healthAlerts.cpuCriticalPercent ? 1 : 0);
    healthStatus.set({ component: 'memory' }, memoryUsage < healthAlerts.memoryCriticalPercent ? 1 : 0);
    healthStatus.set({ component: 'disk' }, diskUsage < healthAlerts.diskCriticalPercent ? 1 : 0);
    healthStatus.set({ component: 'database' }, dbConnections < healthAlerts.dbConnectionsCriticalPercent ? 1 : 0);
    return {
        cpuUsage: cpuUsage,
        memoryUsage: memoryUsage,
        diskUsage: diskUsage,
        dbConnections: dbConnections,
        activeConnections: activeConnections,
        matchQueue: matchQueue,
        responseTime: responseTime,
        errorRate: errorRate,
    };
}
/**
 * Check health metrics against thresholds and trigger alerts
 */
function checkHealthThresholds(metrics) {
    if (!(0, alerting_1.isAlertingEnabled)()) {
        return;
    }
    var healthAlerts = alerting_1.alertingConfig.healthAlerts;
    var currentMetrics = metrics;
    // Check CPU
    if (metrics.cpuUsage >= healthAlerts.cpuCriticalPercent) {
        (0, alerting_2.triggerHealthAlert)('cpuCriticalPercent', metrics.cpuUsage, currentMetrics);
    }
    else if (metrics.cpuUsage >= healthAlerts.cpuWarningPercent) {
        (0, alerting_2.triggerHealthAlert)('cpuWarningPercent', metrics.cpuUsage, currentMetrics);
    }
    // Check Memory
    if (metrics.memoryUsage >= healthAlerts.memoryCriticalPercent) {
        (0, alerting_2.triggerHealthAlert)('memoryCriticalPercent', metrics.memoryUsage, currentMetrics);
    }
    else if (metrics.memoryUsage >= healthAlerts.memoryWarningPercent) {
        (0, alerting_2.triggerHealthAlert)('memoryWarningPercent', metrics.memoryUsage, currentMetrics);
    }
    // Check Disk
    if (metrics.diskUsage >= healthAlerts.diskCriticalPercent) {
        (0, alerting_2.triggerHealthAlert)('diskCriticalPercent', metrics.diskUsage, currentMetrics);
    }
    else if (metrics.diskUsage >= healthAlerts.diskWarningPercent) {
        (0, alerting_2.triggerHealthAlert)('diskWarningPercent', metrics.diskUsage, currentMetrics);
    }
    // Check DB Connections
    if (metrics.dbConnections >= healthAlerts.dbConnectionsCriticalPercent) {
        (0, alerting_2.triggerHealthAlert)('dbConnectionsCriticalPercent', metrics.dbConnections, currentMetrics);
    }
    else if (metrics.dbConnections >= healthAlerts.dbConnectionsWarningPercent) {
        (0, alerting_2.triggerHealthAlert)('dbConnectionsWarningPercent', metrics.dbConnections, currentMetrics);
    }
    // Check Response Time
    if (metrics.responseTime >= healthAlerts.responseTimeCriticalMs) {
        (0, alerting_2.triggerHealthAlert)('responseTimeCriticalMs', metrics.responseTime, currentMetrics);
    }
    else if (metrics.responseTime >= healthAlerts.responseTimeWarningMs) {
        (0, alerting_2.triggerHealthAlert)('responseTimeWarningMs', metrics.responseTime, currentMetrics);
    }
    // Check Error Rate
    if (metrics.errorRate >= healthAlerts.errorRateCriticalPercent) {
        (0, alerting_2.triggerHealthAlert)('errorRateCriticalPercent', metrics.errorRate, currentMetrics);
    }
    else if (metrics.errorRate >= healthAlerts.errorRateWarningPercent) {
        (0, alerting_2.triggerHealthAlert)('errorRateWarningPercent', metrics.errorRate, currentMetrics);
    }
}
/**
 * Check custom metric thresholds and trigger alerts
 */
function checkMetricThresholds(metrics) {
    if (!(0, alerting_1.isAlertingEnabled)()) {
        return;
    }
    var metricAlerts = alerting_1.alertingConfig.metricAlerts;
    // Check Active Connections
    if (metrics.activeConnections >= metricAlerts.activeConnectionsCritical) {
        (0, alerting_2.triggerMetricAlert)('activeConnections', metrics.activeConnections, metricAlerts.activeConnectionsCritical, 'critical');
    }
    else if (metrics.activeConnections >= metricAlerts.activeConnectionsWarning) {
        (0, alerting_2.triggerMetricAlert)('activeConnections', metrics.activeConnections, metricAlerts.activeConnectionsWarning, 'warning');
    }
    // Check Match Queue
    if (metrics.matchQueue >= metricAlerts.matchQueueCritical) {
        (0, alerting_2.triggerMetricAlert)('matchQueue', metrics.matchQueue, metricAlerts.matchQueueCritical, 'critical');
    }
    else if (metrics.matchQueue >= metricAlerts.matchQueueWarning) {
        (0, alerting_2.triggerMetricAlert)('matchQueue', metrics.matchQueue, metricAlerts.matchQueueWarning, 'warning');
    }
}
/**
 * Run health monitoring cycle
 */
function runHealthCheck() {
    try {
        var metrics = performHealthCheck();
        checkHealthThresholds(metrics);
        checkMetricThresholds(metrics);
    }
    catch (error) {
        logger_1.logger.error('Error during health check:', error);
    }
}
/**
 * Start the health monitoring loop
 */
function startHealthMonitoring(intervalMs) {
    if (intervalMs === void 0) { intervalMs = 60000; }
    if (isMonitoring) {
        logger_1.logger.warn('Health monitoring already running');
        return;
    }
    if (!(0, alerting_1.isAlertingEnabled)()) {
        logger_1.logger.info('Health monitoring disabled - alerting not enabled');
        return;
    }
    isMonitoring = true;
    healthMonitorInterval = setInterval(runHealthCheck, intervalMs);
    logger_1.logger.info("Started health monitoring (interval: ".concat(intervalMs, "ms)"));
    // Run initial health check
    runHealthCheck();
}
/**
 * Stop the health monitoring loop
 */
function stopHealthMonitoring() {
    if (healthMonitorInterval) {
        clearInterval(healthMonitorInterval);
        healthMonitorInterval = null;
    }
    isMonitoring = false;
    logger_1.logger.info('Stopped health monitoring');
}
/**
 * Get current health status
 */
function getHealthStatus() {
    var metrics = performHealthCheck();
    var healthAlerts = alerting_1.alertingConfig.healthAlerts;
    var healthy = metrics.cpuUsage < healthAlerts.cpuCriticalPercent &&
        metrics.memoryUsage < healthAlerts.memoryCriticalPercent &&
        metrics.diskUsage < healthAlerts.diskCriticalPercent &&
        metrics.dbConnections < healthAlerts.dbConnectionsCriticalPercent;
    return {
        healthy: healthy,
        metrics: metrics,
        isMonitoring: isMonitoring,
    };
}
/**
 * Initialize health monitoring
 */
function initializeHealthMonitoring(logger) {
    // Set initial health status
    healthStatus.set({ component: 'overall' }, 1);
    healthStatus.set({ component: 'cpu' }, 1);
    healthStatus.set({ component: 'memory' }, 1);
    healthStatus.set({ component: 'disk' }, 1);
    healthStatus.set({ component: 'database' }, 1);
    logger.info('[HealthMonitor] Initialized health monitoring');
    // Start monitoring if enabled
    if ((0, alerting_1.isAlertingEnabled)()) {
        // Default to 60 second intervals
        startHealthMonitoring(60000);
    }
}
