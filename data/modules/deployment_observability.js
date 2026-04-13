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
var tslib_1 = require("tslib");
var prom_client_1 = require("prom-client");
var config_1 = require("../config");
var logger_1 = require("../config/logger");
var validation_1 = require("./validation");
// Create a dedicated registry for deployment metrics
var deploymentRegistry = new prom_client_1.Registry();
// Deployment metrics
var deploymentTotal = new prom_client_1.Counter({
    name: 'armored_archer_deployments_total',
    help: 'Total number of deployments',
    labelNames: ['environment', 'status', 'version'],
    registers: [deploymentRegistry],
});
var deploymentDurationSeconds = new prom_client_1.Histogram({
    name: 'armored_archer_deployment_duration_seconds',
    help: 'Deployment duration in seconds',
    labelNames: ['environment', 'status'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600],
    registers: [deploymentRegistry],
});
var activeDeployments = new prom_client_1.Gauge({
    name: 'armored_archer_active_deployments',
    help: 'Number of currently active deployments',
    labelNames: ['environment'],
    registers: [deploymentRegistry],
});
// In-memory state tracking for current deployment
var currentDeploymentState = {
    environment: 'development',
    version: '0.0.0',
    activeCount: 0,
};
var deploymentHealthStatus = new prom_client_1.Gauge({
    name: 'armored_archer_deployment_health_status',
    help: 'Deployment health status (1=healthy, 0=unhealthy)',
    labelNames: ['environment', 'component'],
    registers: [deploymentRegistry],
});
var deploymentLastSuccessTimestamp = new prom_client_1.Gauge({
    name: 'armored_archer_deployment_last_success_timestamp',
    help: 'Unix timestamp of last successful deployment',
    labelNames: ['environment'],
    registers: [deploymentRegistry],
});
var deploymentHistory = new Map();
// Environment configuration
var currentEnvironment = config_1.config.environment;
var serviceVersion = config_1.config.tracing.serviceVersion;
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
    var now = Date.now();
    // Update counter
    deploymentTotal.inc({ environment: environment, status: status, version: version });
    // Update state and gauge based on status
    if (status === 'started') {
        activeDeployments.inc({ environment: environment });
        currentDeploymentState = {
            environment: environment,
            version: version,
            activeCount: currentDeploymentState.activeCount + 1,
        };
    }
    else if (status === 'success' || status === 'failed' || status === 'rollback') {
        activeDeployments.dec({ environment: environment });
        currentDeploymentState = tslib_1.__assign(tslib_1.__assign({}, currentDeploymentState), { activeCount: Math.max(0, currentDeploymentState.activeCount - 1) });
        // Record last successful deployment
        if (status === 'success') {
            deploymentLastSuccessTimestamp.set({ environment: environment }, now / 1000);
        }
    }
    // Log the deployment event
    logger_1.logger.info("Deployment ".concat(status.toUpperCase(), " - environment: ").concat(environment, ", version: ").concat(version));
}
/**
 * Record deployment duration
 */
function recordDeploymentDuration(environment, status, durationSeconds) {
    deploymentDurationSeconds.observe({ environment: environment, status: status }, durationSeconds);
}
/**
 * Update deployment health status
 */
function updateDeploymentHealth(environment, component, isHealthy) {
    deploymentHealthStatus.set({ environment: environment, component: component }, isHealthy ? 1 : 0);
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
function rpcRecordDeployment(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, _a, environment, version, status, metadata, startedAt, durationSeconds;
        return tslib_1.__generator(this, function (_b) {
            logger.info('Deployment recording requested');
            validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.deployment_record, payload, 'deployment_record');
            if (!validation.success) {
                return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('deployment_record', validation.error)];
            }
            _a = validation.data, environment = _a.environment, version = _a.version, status = _a.status, metadata = _a.metadata;
            // Record the deployment
            recordDeployment(environment, version, status, metadata);
            // If deployment completed, record duration if start time provided
            if ((metadata === null || metadata === void 0 ? void 0 : metadata.startedAt) &&
                (status === 'success' || status === 'failed' || status === 'rollback')) {
                startedAt = parseInt(metadata.startedAt, 10);
                durationSeconds = (Date.now() - startedAt) / 1000;
                recordDeploymentDuration(environment, status, durationSeconds);
            }
            // Update health status based on deployment
            if (status === 'success') {
                updateDeploymentHealth(environment, 'deployment', true);
            }
            else if (status === 'failed') {
                updateDeploymentHealth(environment, 'deployment', false);
            }
            logger.info("Deployment recorded: environment=".concat(environment, ", version=").concat(version, ", status=").concat(status));
            return [2 /*return*/, JSON.stringify({
                    success: true,
                    message: "Deployment ".concat(status),
                    environment: environment,
                    version: version,
                    status: status,
                })];
        });
    });
}
/**
 * RPC: Get deployment health status
 */
function rpcDeploymentHealth(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, healthMetric, healthMetricValues, healthStatus, healthMetricValues_1, healthMetricValues_1_1, value, components, allHealthy;
        var e_1, _a;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    logger.info('Deployment health check requested');
                    validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.health_check, payload, 'deployment_health');
                    if (!validation.success) {
                        return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('deployment_health', validation.error)];
                    }
                    return [4 /*yield*/, deploymentHealthStatus.get()];
                case 1:
                    healthMetric = _b.sent();
                    healthMetricValues = healthMetric.values;
                    healthStatus = {};
                    if (healthMetricValues && Array.isArray(healthMetricValues)) {
                        try {
                            for (healthMetricValues_1 = tslib_1.__values(healthMetricValues), healthMetricValues_1_1 = healthMetricValues_1.next(); !healthMetricValues_1_1.done; healthMetricValues_1_1 = healthMetricValues_1.next()) {
                                value = healthMetricValues_1_1.value;
                                if (value.labels.environment === currentEnvironment) {
                                    healthStatus[value.labels.component] = value.value === 1;
                                }
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (healthMetricValues_1_1 && !healthMetricValues_1_1.done && (_a = healthMetricValues_1.return)) _a.call(healthMetricValues_1);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                    }
                    components = Object.keys(healthStatus);
                    allHealthy = components.length === 0 || components.every(function (c) { return healthStatus[c]; });
                    return [2 /*return*/, JSON.stringify({
                            status: allHealthy ? 'healthy' : 'unhealthy',
                            environment: currentEnvironment,
                            version: serviceVersion,
                            timestamp: Date.now(),
                            components: healthStatus,
                        })];
            }
        });
    });
}
/**
 * RPC: Get deployment history
 */
function rpcDeploymentHistory(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var limit, data, deployments;
        return tslib_1.__generator(this, function (_a) {
            logger.info('Deployment history requested');
            limit = 10;
            if (payload) {
                try {
                    data = JSON.parse(payload);
                    limit = data.limit || 10;
                }
                catch (_b) {
                    // Ignore parse errors, use default
                }
            }
            deployments = Array.from(deploymentHistory.values())
                .sort(function (a, b) { return b.startedAt - a.startedAt; })
                .slice(0, limit);
            return [2 /*return*/, JSON.stringify({
                    environment: currentEnvironment,
                    version: serviceVersion,
                    deployments: deployments,
                    count: deployments.length,
                })];
        });
    });
}
/**
 * RPC: Get deployment metrics in Prometheus format
 */
function rpcDeploymentMetrics(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, metrics;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger.info('Deployment metrics requested');
                    validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.health_check, payload, 'deployment_metrics');
                    if (!validation.success) {
                        return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('deployment_metrics', validation.error)];
                    }
                    return [4 /*yield*/, deploymentRegistry.metrics()];
                case 1:
                    metrics = _a.sent();
                    return [2 /*return*/, metrics];
            }
        });
    });
}
/**
 * Initialize deployment observability
 * Called during server startup to set initial state
 */
function initializeDeploymentObservability(logger) {
    // Set initial health status
    updateDeploymentHealth(currentEnvironment, 'deployment', true);
    updateDeploymentHealth(currentEnvironment, 'system', true);
    logger.info("[DeploymentObservability] Initialized for environment: ".concat(currentEnvironment, ", version: ").concat(serviceVersion));
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
