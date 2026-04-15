"use strict";
/**
 * Deployment Observability Module
 *
 * This module provides deployment tracking and observability features:
 * - Deployment event recording
 * - Deployment metrics (count, status, duration)
 * - Health check integration
 * - Deployment history tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeploymentRegistry = getDeploymentRegistry;
exports.recordDeployment = recordDeployment;
exports.recordDeploymentDuration = recordDeploymentDuration;
exports.updateDeploymentHealth = updateDeploymentHealth;
exports.registerDeploymentObservability = registerDeploymentObservability;
exports.initializeDeploymentObservability = initializeDeploymentObservability;
exports.getDeploymentState = getDeploymentState;
const prom_client_1 = require("prom-client");
const config_1 = require("../config");
const logger_1 = require("../config/logger");
const validation_1 = require("./validation");
// Create a dedicated registry for deployment metrics
const deploymentRegistry = new prom_client_1.Registry();
// Deployment metrics
const deploymentTotal = new prom_client_1.Counter({
    name: 'armored_archer_deployments_total',
    help: 'Total number of deployments',
    labelNames: ['environment', 'status', 'version'],
    registers: [deploymentRegistry],
});
const deploymentDurationSeconds = new prom_client_1.Histogram({
    name: 'armored_archer_deployment_duration_seconds',
    help: 'Deployment duration in seconds',
    labelNames: ['environment', 'status'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600],
    registers: [deploymentRegistry],
});
const activeDeployments = new prom_client_1.Gauge({
    name: 'armored_archer_active_deployments',
    help: 'Number of currently active deployments',
    labelNames: ['environment'],
    registers: [deploymentRegistry],
});
// In-memory state tracking for current deployment
let currentDeploymentState = {
    environment: 'development',
    version: '0.0.0',
    activeCount: 0,
};
const deploymentHealthStatus = new prom_client_1.Gauge({
    name: 'armored_archer_deployment_health_status',
    help: 'Deployment health status (1=healthy, 0=unhealthy)',
    labelNames: ['environment', 'component'],
    registers: [deploymentRegistry],
});
const deploymentLastSuccessTimestamp = new prom_client_1.Gauge({
    name: 'armored_archer_deployment_last_success_timestamp',
    help: 'Unix timestamp of last successful deployment',
    labelNames: ['environment'],
    registers: [deploymentRegistry],
});
const deploymentHistory = new Map();
// Environment configuration
const currentEnvironment = config_1.config.environment;
const serviceVersion = config_1.config.tracing.serviceVersion;
/**
 * Get deployment registry for metrics collection
 */
function getDeploymentRegistry() {
    return deploymentRegistry;
}
/**
 * Record a deployment event
 */
function recordDeployment(environment, version, status, _metadata) {
    const now = Date.now();
    // Update counter
    deploymentTotal.inc({ environment, status, version });
    // Update state and gauge based on status
    if (status === 'started') {
        activeDeployments.inc({ environment });
        currentDeploymentState = {
            environment,
            version,
            activeCount: currentDeploymentState.activeCount + 1,
        };
    }
    else if (status === 'success' || status === 'failed' || status === 'rollback') {
        activeDeployments.dec({ environment });
        currentDeploymentState = {
            ...currentDeploymentState,
            activeCount: Math.max(0, currentDeploymentState.activeCount - 1),
        };
        // Record last successful deployment
        if (status === 'success') {
            deploymentLastSuccessTimestamp.set({ environment }, now / 1000);
        }
    }
    // Log the deployment event
    logger_1.logger.info(`Deployment ${status.toUpperCase()} - environment: ${environment}, version: ${version}`);
}
/**
 * Record deployment duration
 */
function recordDeploymentDuration(environment, status, durationSeconds) {
    deploymentDurationSeconds.observe({ environment, status }, durationSeconds);
}
/**
 * Update deployment health status
 */
function updateDeploymentHealth(environment, component, isHealthy) {
    deploymentHealthStatus.set({ environment, component }, isHealthy ? 1 : 0);
}
/**
 * Register RPC handlers for deployment observability
 */
function registerDeploymentObservability(initializer) {
    initializer.registerRpc('armored_archer/deployment_record', rpcRecordDeployment);
    initializer.registerRpc('armored_archer/deployment_health', rpcDeploymentHealth);
    initializer.registerRpc('armored_archer/deployment_history', rpcDeploymentHistory);
    initializer.registerRpc('armored_archer/deployment_metrics', rpcDeploymentMetrics);
}
/**
 * RPC: Record a deployment event
 */
async function rpcRecordDeployment(ctx, logger, _nk, payload) {
    logger.info('Deployment recording requested');
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.deployment_record, payload, 'deployment_record');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('deployment_record', validation.error);
    }
    const { environment, version, status, metadata } = validation.data;
    // Record the deployment
    recordDeployment(environment, version, status, metadata);
    // If deployment completed, record duration if start time provided
    if (metadata?.startedAt &&
        (status === 'success' || status === 'failed' || status === 'rollback')) {
        const startedAt = parseInt(metadata.startedAt, 10);
        const durationSeconds = (Date.now() - startedAt) / 1000;
        recordDeploymentDuration(environment, status, durationSeconds);
    }
    // Update health status based on deployment
    if (status === 'success') {
        updateDeploymentHealth(environment, 'deployment', true);
    }
    else if (status === 'failed') {
        updateDeploymentHealth(environment, 'deployment', false);
    }
    logger.info(`Deployment recorded: environment=${environment}, version=${version}, status=${status}`);
    return JSON.stringify({
        success: true,
        message: `Deployment ${status}`,
        environment,
        version,
        status,
    });
}
/**
 * RPC: Get deployment health status
 */
async function rpcDeploymentHealth(ctx, logger, _nk, payload) {
    logger.info('Deployment health check requested');
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.health_check, payload, 'deployment_health');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('deployment_health', validation.error);
    }
    // Get health status for current environment using get() method (async)
    const healthMetric = await deploymentHealthStatus.get();
    // Handle empty metric case (prom-client returns empty object when no values set)
    const healthMetricValues = healthMetric.values;
    const healthStatus = {};
    if (healthMetricValues && Array.isArray(healthMetricValues)) {
        for (const value of healthMetricValues) {
            if (value.labels.environment === currentEnvironment) {
                healthStatus[value.labels.component] = value.value === 1;
            }
        }
    }
    // Determine overall health
    const components = Object.keys(healthStatus);
    const allHealthy = components.length === 0 || components.every((c) => healthStatus[c]);
    return JSON.stringify({
        status: allHealthy ? 'healthy' : 'unhealthy',
        environment: currentEnvironment,
        version: serviceVersion,
        timestamp: Date.now(),
        components: healthStatus,
    });
}
/**
 * RPC: Get deployment history
 */
async function rpcDeploymentHistory(ctx, logger, _nk, payload) {
    logger.info('Deployment history requested');
    // Parse optional limit from payload
    let limit = 10; // default
    if (payload) {
        try {
            const data = JSON.parse(payload);
            limit = data.limit || 10;
        }
        catch {
            // Ignore parse errors, use default
        }
    }
    // Get deployments from history (most recent first)
    const deployments = Array.from(deploymentHistory.values())
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, limit);
    return JSON.stringify({
        environment: currentEnvironment,
        version: serviceVersion,
        deployments,
        count: deployments.length,
    });
}
/**
 * RPC: Get deployment metrics in Prometheus format
 */
async function rpcDeploymentMetrics(ctx, logger, _nk, payload) {
    logger.info('Deployment metrics requested');
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.health_check, payload, 'deployment_metrics');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('deployment_metrics', validation.error);
    }
    // Get metrics in Prometheus text format
    const metrics = await deploymentRegistry.metrics();
    return metrics;
}
/**
 * Initialize deployment observability
 * Called during server startup to set initial state
 */
function initializeDeploymentObservability(logger) {
    // Set initial health status
    updateDeploymentHealth(currentEnvironment, 'deployment', true);
    updateDeploymentHealth(currentEnvironment, 'system', true);
    logger.info(`[DeploymentObservability] Initialized for environment: ${currentEnvironment}, version: ${serviceVersion}`);
}
/**
 * Get current deployment state
 */
function getDeploymentState() {
    return {
        environment: currentDeploymentState.environment,
        version: currentDeploymentState.version,
        activeDeployments: currentDeploymentState.activeCount,
    };
}
