"use strict";
/**
 * Progressive Rollout Module
 *
 * This module provides progressive rollout capabilities for feature releases:
 * - Percentage-based gradual rollout
 * - Feature flags for canary deployments
 * - Rollback criteria for each phase
 * - Monitoring and metrics for rollout phases
 *
 * Phases: disabled -> canary -> gradual -> full
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFeatureFlag = getFeatureFlag;
exports.getAllFeatureFlags = getAllFeatureFlags;
exports.isFeatureEnabled = isFeatureEnabled;
exports.createFeatureFlag = createFeatureFlag;
exports.updateFeatureFlag = updateFeatureFlag;
exports.advancePhase = advancePhase;
exports.rollbackFeature = rollbackFeature;
exports.checkRollbackCriteria = checkRollbackCriteria;
exports.recordRolloutMetrics = recordRolloutMetrics;
exports.getRolloutRegistry = getRolloutRegistry;
exports.getRolloutMetrics = getRolloutMetrics;
exports.getAllRolloutMetrics = getAllRolloutMetrics;
exports.registerProgressiveRollout = registerProgressiveRollout;
exports.initializeProgressiveRollout = initializeProgressiveRollout;
var tslib_1 = require("tslib");
var prom_client_1 = require("prom-client");
var config_1 = require("../config");
var validation_1 = require("./validation");
// Create a dedicated registry for rollout metrics
var rolloutRegistry = new prom_client_1.Registry();
// In-memory storage for feature flags and metrics
var featureFlags = new Map();
var rolloutMetrics = new Map();
// ============== Metrics ==============
var rolloutPhaseGauge = new prom_client_1.Gauge({
    name: 'armored_archer_rollout_phase',
    help: 'Current rollout phase for a feature',
    labelNames: ['feature_name', 'phase'],
    registers: [rolloutRegistry],
});
var rolloutPercentageGauge = new prom_client_1.Gauge({
    name: 'armored_archer_rollout_percentage',
    help: 'Current rollout percentage for a feature',
    labelNames: ['feature_name'],
    registers: [rolloutRegistry],
});
var rolloutUsersTotal = new prom_client_1.Counter({
    name: 'armored_archer_rollout_users_total',
    help: 'Total users exposed to a feature rollout',
    labelNames: ['feature_name', 'phase'],
    registers: [rolloutRegistry],
});
var rolloutErrorsTotal = new prom_client_1.Counter({
    name: 'armored_archer_rollout_errors_total',
    help: 'Total errors during feature rollout',
    labelNames: ['feature_name', 'phase', 'error_type'],
    registers: [rolloutRegistry],
});
var rolloutLatencyHistogram = new prom_client_1.Histogram({
    name: 'armored_archer_rollout_latency_ms',
    help: 'Latency histogram for feature rollout',
    labelNames: ['feature_name', 'phase'],
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [rolloutRegistry],
});
var rolloutHealthGauge = new prom_client_1.Gauge({
    name: 'armored_archer_rollout_health',
    help: 'Health status of feature rollout (1=healthy, 0=unhealthy)',
    labelNames: ['feature_name', 'phase'],
    registers: [rolloutRegistry],
});
var featureFlagEnabledGauge = new prom_client_1.Gauge({
    name: 'armored_archer_feature_flag_enabled',
    help: 'Whether a feature flag is enabled (1=enabled, 0=disabled)',
    labelNames: ['feature_name'],
    registers: [rolloutRegistry],
});
// ============== Helper Functions ==============
/**
 * Get feature flag by name
 */
function getFeatureFlag(name) {
    return featureFlags.get(name);
}
/**
 * Get all feature flags
 */
function getAllFeatureFlags() {
    return Array.from(featureFlags.values());
}
/**
 * Check if a feature is enabled for a specific user
 */
function isFeatureEnabled(featureName, userId, gameVersion) {
    var flag = featureFlags.get(featureName);
    if (!flag || !flag.enabled) {
        return false;
    }
    // Check if rollout phase allows this user
    if (flag.rolloutPhase === 'disabled') {
        return false;
    }
    // Canary phase: only specific users or version range
    if (flag.rolloutPhase === 'canary') {
        if (flag.canaryUserIds.includes(userId)) {
            return true;
        }
        if (gameVersion) {
            var meetsVersionReq = (!flag.canaryVersionMin || gameVersion >= flag.canaryVersionMin) &&
                (!flag.canaryVersionMax || gameVersion <= flag.canaryVersionMax);
            if (meetsVersionReq && flag.canaryUserIds.length === 0) {
                return true;
            }
        }
        return false;
    }
    // Gradual/Full phase: use percentage-based rollout
    if (flag.rolloutPhase === 'gradual' || flag.rolloutPhase === 'full') {
        // For full rollout, all users get the feature
        if (flag.rolloutPhase === 'full') {
            return true;
        }
        // For gradual, use deterministic hash
        var hash = hashUserId(userId, featureName);
        return hash < flag.rolloutPercentage;
    }
    return false;
}
/**
 * Deterministic hash for user ID to ensure consistent rollout percentage
 */
function hashUserId(userId, featureName) {
    var str = "".concat(featureName, ":").concat(userId);
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash % 100);
}
/**
 * Create a new feature flag
 */
function createFeatureFlag(name, description, phases) {
    var now = Date.now();
    var flag = {
        name: name,
        description: description,
        enabled: true,
        rolloutPhase: 'disabled',
        rolloutPercentage: 0,
        canaryUserIds: [],
        phases: phases,
        currentPhaseIndex: -1,
        createdAt: now,
        updatedAt: now,
    };
    featureFlags.set(name, flag);
    updateMetrics(flag);
    return flag;
}
/**
 * Update feature flag settings
 */
function updateFeatureFlag(name, updates) {
    var flag = featureFlags.get(name);
    if (!flag) {
        return null;
    }
    var updatedFlag = tslib_1.__assign(tslib_1.__assign(tslib_1.__assign({}, flag), updates), { updatedAt: Date.now() });
    featureFlags.set(name, updatedFlag);
    updateMetrics(updatedFlag);
    return updatedFlag;
}
/**
 * Advance to next rollout phase
 */
function advancePhase(featureName) {
    var flag = featureFlags.get(featureName);
    if (!flag) {
        return null;
    }
    var nextIndex = flag.currentPhaseIndex + 1;
    if (nextIndex >= flag.phases.length) {
        // Already at final phase
        return flag;
    }
    var nextPhase = flag.phases[nextIndex];
    flag.rolloutPhase = nextPhase.phase;
    flag.rolloutPercentage = nextPhase.percentage;
    flag.currentPhaseIndex = nextIndex;
    flag.updatedAt = Date.now();
    featureFlags.set(featureName, flag);
    updateMetrics(flag);
    return flag;
}
/**
 * Rollback to previous phase or disable
 */
function rollbackFeature(featureName) {
    var flag = featureFlags.get(featureName);
    if (!flag) {
        return null;
    }
    if (flag.currentPhaseIndex > 0) {
        // Rollback to previous phase
        var prevPhase = flag.phases[flag.currentPhaseIndex - 1];
        flag.rolloutPhase = prevPhase.phase;
        flag.rolloutPercentage = prevPhase.percentage;
        flag.currentPhaseIndex--;
    }
    else {
        // Disable entirely
        flag.rolloutPhase = 'disabled';
        flag.rolloutPercentage = 0;
        flag.currentPhaseIndex = -1;
    }
    flag.updatedAt = Date.now();
    featureFlags.set(featureName, flag);
    updateMetrics(flag);
    return flag;
}
/**
 * Check rollback criteria and auto-rollback if needed
 */
function checkRollbackCriteria(featureName) {
    var e_1, _a;
    var flag = featureFlags.get(featureName);
    if (!flag || flag.currentPhaseIndex < 0) {
        return { shouldRollback: false };
    }
    var currentPhase = flag.phases[flag.currentPhaseIndex];
    var metrics = rolloutMetrics.get(featureName);
    if (!metrics) {
        return { shouldRollback: false };
    }
    // Check error rate
    if (metrics.errorRate > currentPhase.rollbackCriteria.errorRateThreshold) {
        return {
            shouldRollback: true,
            reason: "Error rate ".concat(metrics.errorRate.toFixed(2), "% exceeds threshold ").concat(currentPhase.rollbackCriteria.errorRateThreshold, "%"),
        };
    }
    // Check latency
    if (metrics.avgLatencyMs > currentPhase.rollbackCriteria.latencyThreshold) {
        return {
            shouldRollback: true,
            reason: "Avg latency ".concat(metrics.avgLatencyMs.toFixed(2), "ms exceeds threshold ").concat(currentPhase.rollbackCriteria.latencyThreshold, "ms"),
        };
    }
    // Check health check failures
    if (metrics.healthCheckFails >= currentPhase.rollbackCriteria.healthCheckFails) {
        return {
            shouldRollback: true,
            reason: "Health check failures ".concat(metrics.healthCheckFails, " exceeds threshold ").concat(currentPhase.rollbackCriteria.healthCheckFails),
        };
    }
    // Check custom metrics
    var customMetrics = currentPhase.rollbackCriteria.customMetrics;
    if (customMetrics) {
        try {
            for (var _b = tslib_1.__values(Object.entries(customMetrics)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = tslib_1.__read(_c.value, 2), metricName = _d[0], threshold = _d[1];
                var metricValue = metrics[metricName];
                if (metricValue !== undefined && metricValue > threshold) {
                    return {
                        shouldRollback: true,
                        reason: "Custom metric ".concat(metricName, " (").concat(metricValue, ") exceeds threshold ").concat(threshold),
                    };
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    return { shouldRollback: false };
}
/**
 * Record rollout metrics for a feature
 */
function recordRolloutMetrics(featureName, metrics) {
    var existing = rolloutMetrics.get(featureName) || {
        featureName: featureName,
        phase: 'disabled',
        totalUsers: 0,
        activeUsers: 0,
        errorCount: 0,
        errorRate: 0,
        avgLatencyMs: 0,
        p99LatencyMs: 0,
        healthCheckPasses: 0,
        healthCheckFails: 0,
        lastUpdated: Date.now(),
    };
    var flag = featureFlags.get(featureName);
    var updated = tslib_1.__assign(tslib_1.__assign(tslib_1.__assign({}, existing), metrics), { phase: (flag === null || flag === void 0 ? void 0 : flag.rolloutPhase) || 'disabled', lastUpdated: Date.now() });
    rolloutMetrics.set(featureName, updated);
}
/**
 * Update Prometheus metrics for a feature flag
 */
function updateMetrics(flag) {
    // Update phase gauge
    var phaseValues = {
        disabled: 0,
        canary: 1,
        gradual: 2,
        full: 3,
    };
    rolloutPhaseGauge.set({ feature_name: flag.name, phase: flag.rolloutPhase }, phaseValues[flag.rolloutPhase]);
    // Update percentage gauge
    rolloutPercentageGauge.set({ feature_name: flag.name }, flag.rolloutPercentage);
    // Update enabled gauge
    featureFlagEnabledGauge.set({ feature_name: flag.name }, flag.enabled ? 1 : 0);
    // Update health gauge based on current phase
    var metrics = rolloutMetrics.get(flag.name);
    if (metrics && flag.currentPhaseIndex >= 0) {
        var phase = flag.phases[flag.currentPhaseIndex];
        var isHealthy = metrics.errorRate <= phase.maxErrorRatePercent &&
            metrics.avgLatencyMs <= phase.maxLatencyMs &&
            metrics.healthCheckFails < phase.rollbackCriteria.healthCheckFails;
        rolloutHealthGauge.set({ feature_name: flag.name, phase: flag.rolloutPhase }, isHealthy ? 1 : 0);
    }
    else {
        rolloutHealthGauge.set({ feature_name: flag.name, phase: flag.rolloutPhase }, 1);
    }
}
/**
 * Get rollout registry for metrics collection
 */
function getRolloutRegistry() {
    return rolloutRegistry;
}
/**
 * Get rollout metrics for a feature
 */
function getRolloutMetrics(featureName) {
    return rolloutMetrics.get(featureName);
}
/**
 * Get all rollout metrics
 */
function getAllRolloutMetrics() {
    return Array.from(rolloutMetrics.values());
}
// ============== RPC Handlers ==============
/**
 * Register RPC handlers for progressive rollout
 */
function registerProgressiveRollout(initializer) {
    initializer.registerRpc('armored_archer/rollout_create_flag', rpcCreateFeatureFlag);
    initializer.registerRpc('armored_archer/rollout_update_flag', rpcUpdateFeatureFlag);
    initializer.registerRpc('armored_archer/rollout_list_flags', rpcListFeatureFlags);
    initializer.registerRpc('armored_archer/rollout_check', rpcCheckFeatureFlag);
    initializer.registerRpc('armored_archer/rollout_advance', rpcAdvancePhase);
    initializer.registerRpc('armored_archer/rollout_rollback', rpcRollbackFeature);
    initializer.registerRpc('armored_archer/rollout_metrics', rpcGetRolloutMetrics);
    initializer.registerRpc('armored_archer/rollout_record_metrics', rpcRecordMetrics);
    initializer.registerRpc('armored_archer/rollout_health', rpcRolloutHealth);
    initializer.registerRpc('armored_archer/rollout_metrics_prometheus', rpcPrometheusMetrics);
}
/**
 * RPC: Create a new feature flag
 */
function rpcCreateFeatureFlag(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, _a, name, description, phases, flag;
        return tslib_1.__generator(this, function (_b) {
            logger.info('Creating feature flag');
            validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.rollout_create_flag, payload, 'rollout_create_flag');
            if (!validation.success) {
                return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('rollout_create_flag', validation.error)];
            }
            _a = validation.data, name = _a.name, description = _a.description, phases = _a.phases;
            // Check if flag already exists
            if (featureFlags.has(name)) {
                return [2 /*return*/, JSON.stringify({
                        success: false,
                        error: "Feature flag '".concat(name, "' already exists"),
                    })];
            }
            flag = createFeatureFlag(name, description, phases);
            logger.info("Feature flag created: ".concat(name));
            return [2 /*return*/, JSON.stringify({
                    success: true,
                    featureFlag: flag,
                })];
        });
    });
}
/**
 * RPC: Update feature flag
 */
function rpcUpdateFeatureFlag(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, _a, name, updates, flag;
        return tslib_1.__generator(this, function (_b) {
            logger.info('Updating feature flag');
            validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.rollout_update_flag, payload, 'rollout_update_flag');
            if (!validation.success) {
                return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('rollout_update_flag', validation.error)];
            }
            _a = validation.data, name = _a.name, updates = tslib_1.__rest(_a, ["name"]);
            flag = updateFeatureFlag(name, updates);
            if (!flag) {
                return [2 /*return*/, JSON.stringify({
                        success: false,
                        error: "Feature flag '".concat(name, "' not found"),
                    })];
            }
            logger.info("Feature flag updated: ".concat(name));
            return [2 /*return*/, JSON.stringify({
                    success: true,
                    featureFlag: flag,
                })];
        });
    });
}
/**
 * RPC: List all feature flags
 */
function rpcListFeatureFlags(ctx, logger, _nk, _payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var flags, metrics;
        return tslib_1.__generator(this, function (_a) {
            logger.info('Listing feature flags');
            flags = getAllFeatureFlags();
            metrics = getAllRolloutMetrics();
            return [2 /*return*/, JSON.stringify({
                    success: true,
                    featureFlags: flags,
                    metrics: metrics,
                })];
        });
    });
}
/**
 * RPC: Check if feature is enabled for user
 */
function rpcCheckFeatureFlag(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, _a, feature_name, user_id, game_version, enabled, flag;
        return tslib_1.__generator(this, function (_b) {
            validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.rollout_check, payload, 'rollout_check');
            if (!validation.success) {
                return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('rollout_check', validation.error)];
            }
            _a = validation.data, feature_name = _a.feature_name, user_id = _a.user_id, game_version = _a.game_version;
            enabled = isFeatureEnabled(feature_name, user_id, game_version);
            flag = featureFlags.get(feature_name);
            return [2 /*return*/, JSON.stringify({
                    success: true,
                    feature_name: feature_name,
                    enabled: enabled,
                    rollout_phase: (flag === null || flag === void 0 ? void 0 : flag.rolloutPhase) || 'disabled',
                    rollout_percentage: (flag === null || flag === void 0 ? void 0 : flag.rolloutPercentage) || 0,
                })];
        });
    });
}
/**
 * RPC: Advance to next rollout phase
 */
function rpcAdvancePhase(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, feature_name, flag;
        return tslib_1.__generator(this, function (_a) {
            logger.info('Advancing rollout phase');
            validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.rollout_advance, payload, 'rollout_advance');
            if (!validation.success) {
                return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('rollout_advance', validation.error)];
            }
            feature_name = validation.data.feature_name;
            flag = advancePhase(feature_name);
            if (!flag) {
                return [2 /*return*/, JSON.stringify({
                        success: false,
                        error: "Feature flag '".concat(feature_name, "' not found"),
                    })];
            }
            logger.info("Rollout phase advanced for ".concat(feature_name, ": ").concat(flag.rolloutPhase));
            return [2 /*return*/, JSON.stringify({
                    success: true,
                    featureFlag: flag,
                })];
        });
    });
}
/**
 * RPC: Rollback feature to previous phase
 */
function rpcRollbackFeature(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, feature_name, flag;
        return tslib_1.__generator(this, function (_a) {
            logger.info('Rolling back feature');
            validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.rollout_rollback, payload, 'rollout_rollback');
            if (!validation.success) {
                return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('rollout_rollback', validation.error)];
            }
            feature_name = validation.data.feature_name;
            flag = rollbackFeature(feature_name);
            if (!flag) {
                return [2 /*return*/, JSON.stringify({
                        success: false,
                        error: "Feature flag '".concat(feature_name, "' not found"),
                    })];
            }
            logger.info("Rollback executed for ".concat(feature_name, ": ").concat(flag.rolloutPhase));
            return [2 /*return*/, JSON.stringify({
                    success: true,
                    featureFlag: flag,
                })];
        });
    });
}
/**
 * RPC: Get rollout metrics for a feature
 */
function rpcGetRolloutMetrics(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, feature_name, metrics, rollbackCheck;
        return tslib_1.__generator(this, function (_a) {
            logger.info('Getting rollout metrics');
            validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.rollout_get_metrics, payload, 'rollout_get_metrics');
            if (!validation.success) {
                return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('rollout_get_metrics', validation.error)];
            }
            feature_name = validation.data.feature_name;
            metrics = getRolloutMetrics(feature_name);
            if (!metrics) {
                return [2 /*return*/, JSON.stringify({
                        success: false,
                        error: "No metrics found for '".concat(feature_name, "'"),
                    })];
            }
            rollbackCheck = checkRollbackCriteria(feature_name);
            return [2 /*return*/, JSON.stringify({
                    success: true,
                    metrics: metrics,
                    rollback_check: rollbackCheck,
                })];
        });
    });
}
/**
 * RPC: Record rollout metrics
 */
function rpcRecordMetrics(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, _a, feature_name, total_users, active_users, error_count, error_rate, avg_latency_ms, p99_latency_ms, health_check_passes, health_check_fails, rollbackCheck;
        var _b, _c, _d;
        return tslib_1.__generator(this, function (_e) {
            validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.rollout_record_metrics, payload, 'rollout_record_metrics');
            if (!validation.success) {
                return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('rollout_record_metrics', validation.error)];
            }
            _a = validation.data, feature_name = _a.feature_name, total_users = _a.total_users, active_users = _a.active_users, error_count = _a.error_count, error_rate = _a.error_rate, avg_latency_ms = _a.avg_latency_ms, p99_latency_ms = _a.p99_latency_ms, health_check_passes = _a.health_check_passes, health_check_fails = _a.health_check_fails;
            recordRolloutMetrics(feature_name, {
                totalUsers: total_users,
                activeUsers: active_users,
                errorCount: error_count,
                errorRate: error_rate,
                avgLatencyMs: avg_latency_ms,
                p99LatencyMs: p99_latency_ms,
                healthCheckPasses: health_check_passes,
                healthCheckFails: health_check_fails,
            });
            // Update Prometheus counters
            if (total_users) {
                rolloutUsersTotal.inc({ feature_name: feature_name, phase: ((_b = rolloutMetrics.get(feature_name)) === null || _b === void 0 ? void 0 : _b.phase) || 'disabled' }, total_users);
            }
            if (error_count) {
                rolloutErrorsTotal.inc({
                    feature_name: feature_name,
                    phase: ((_c = rolloutMetrics.get(feature_name)) === null || _c === void 0 ? void 0 : _c.phase) || 'disabled',
                    error_type: 'total',
                }, error_count);
            }
            if (avg_latency_ms) {
                rolloutLatencyHistogram.observe({ feature_name: feature_name, phase: ((_d = rolloutMetrics.get(feature_name)) === null || _d === void 0 ? void 0 : _d.phase) || 'disabled' }, avg_latency_ms);
            }
            rollbackCheck = checkRollbackCriteria(feature_name);
            return [2 /*return*/, JSON.stringify({
                    success: true,
                    feature_name: feature_name,
                    rollback_triggered: rollbackCheck.shouldRollback,
                    rollback_reason: rollbackCheck.reason,
                })];
        });
    });
}
/**
 * RPC: Get overall rollout health
 */
function rpcRolloutHealth(ctx, logger, _nk, _payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var flags, metrics, allHealthy, featureHealth, _loop_1, flags_1, flags_1_1, flag;
        var e_2, _a;
        return tslib_1.__generator(this, function (_b) {
            logger.info('Rollout health check');
            flags = getAllFeatureFlags();
            metrics = getAllRolloutMetrics();
            allHealthy = true;
            featureHealth = {};
            _loop_1 = function (flag) {
                if (flag.enabled && flag.currentPhaseIndex >= 0) {
                    // Find metrics for this flag (used for potential future health checks)
                    metrics.find(function (m) { return m.featureName === flag.name; });
                    var rollbackCheck = checkRollbackCriteria(flag.name);
                    featureHealth[flag.name] = !rollbackCheck.shouldRollback;
                    if (rollbackCheck.shouldRollback) {
                        allHealthy = false;
                    }
                }
                else {
                    featureHealth[flag.name] = true;
                }
            };
            try {
                for (flags_1 = tslib_1.__values(flags), flags_1_1 = flags_1.next(); !flags_1_1.done; flags_1_1 = flags_1.next()) {
                    flag = flags_1_1.value;
                    _loop_1(flag);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (flags_1_1 && !flags_1_1.done && (_a = flags_1.return)) _a.call(flags_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return [2 /*return*/, JSON.stringify({
                    status: allHealthy ? 'healthy' : 'unhealthy',
                    environment: config_1.config.environment,
                    timestamp: Date.now(),
                    features: featureHealth,
                })];
        });
    });
}
/**
 * RPC: Get rollout metrics in Prometheus format
 */
function rpcPrometheusMetrics(ctx, logger, _nk, _payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var metrics;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger.info('Prometheus metrics requested');
                    return [4 /*yield*/, rolloutRegistry.metrics()];
                case 1:
                    metrics = _a.sent();
                    return [2 /*return*/, metrics];
            }
        });
    });
}
// ============== Initialization ==============
/**
 * Initialize progressive rollout with default feature flags
 */
function initializeProgressiveRollout(logger) {
    var e_3, _a;
    // Create default feature flags for common game features
    var defaultFlags = [
        {
            name: 'new_combat_system',
            description: 'Updated combat mechanics and damage calculations',
            phases: [
                {
                    phase: 'canary',
                    percentage: 5,
                    durationMinutes: 60,
                    minHealthPercent: 95,
                    maxErrorRatePercent: 2,
                    maxLatencyMs: 100,
                    sampleSize: 100,
                    autoPromote: false,
                    rollbackCriteria: {
                        errorRateThreshold: 5,
                        latencyThreshold: 250,
                        healthCheckFails: 3,
                        customMetrics: {},
                    },
                },
                {
                    phase: 'gradual',
                    percentage: 25,
                    durationMinutes: 120,
                    minHealthPercent: 95,
                    maxErrorRatePercent: 1,
                    maxLatencyMs: 100,
                    sampleSize: 500,
                    autoPromote: false,
                    rollbackCriteria: {
                        errorRateThreshold: 3,
                        latencyThreshold: 200,
                        healthCheckFails: 2,
                        customMetrics: {},
                    },
                },
                {
                    phase: 'gradual',
                    percentage: 50,
                    durationMinutes: 240,
                    minHealthPercent: 98,
                    maxErrorRatePercent: 1,
                    maxLatencyMs: 100,
                    sampleSize: 1000,
                    autoPromote: false,
                    rollbackCriteria: {
                        errorRateThreshold: 2,
                        latencyThreshold: 150,
                        healthCheckFails: 2,
                        customMetrics: {},
                    },
                },
                {
                    phase: 'full',
                    percentage: 100,
                    durationMinutes: 0,
                    minHealthPercent: 99,
                    maxErrorRatePercent: 0.5,
                    maxLatencyMs: 100,
                    sampleSize: 0,
                    autoPromote: false,
                    rollbackCriteria: {
                        errorRateThreshold: 1,
                        latencyThreshold: 100,
                        healthCheckFails: 1,
                        customMetrics: {},
                    },
                },
            ],
        },
    ];
    try {
        for (var defaultFlags_1 = tslib_1.__values(defaultFlags), defaultFlags_1_1 = defaultFlags_1.next(); !defaultFlags_1_1.done; defaultFlags_1_1 = defaultFlags_1.next()) {
            var flagDef = defaultFlags_1_1.value;
            if (!featureFlags.has(flagDef.name)) {
                createFeatureFlag(flagDef.name, flagDef.description, flagDef.phases);
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (defaultFlags_1_1 && !defaultFlags_1_1.done && (_a = defaultFlags_1.return)) _a.call(defaultFlags_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    logger.info("[ProgressiveRollout] Initialized ".concat(featureFlags.size, " feature flags for environment: ").concat(config_1.config.environment));
}
