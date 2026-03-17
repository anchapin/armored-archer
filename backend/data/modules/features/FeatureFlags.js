"use strict";
/**
 * Feature Flag System for Armored Archer Backend
 *
 * Provides a centralized feature flag infrastructure for:
 * - Gradual rollouts
 * - A/B testing
 * - Kill switches
 * - Percentage-based rollouts
 *
 * Usage:
 *   import { FeatureFlags, isFeatureEnabled, getFeatureVariant } from './features/FeatureFlags';
 *
 *   // Check if feature is enabled
 *   if (await isFeatureEnabled('new_combat_system')) { ... }
 *
 *   // Get A/B test variant
 *   const variant = await getFeatureVariant('battle_pass', 'control');
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlags = void 0;
exports.initializeFeatureFlags = initializeFeatureFlags;
exports.getFeatureFlag = getFeatureFlag;
exports.isFeatureEnabled = isFeatureEnabled;
exports.getFeatureVariant = getFeatureVariant;
exports.evaluateFeatures = evaluateFeatures;
exports.updateFeatureFlag = updateFeatureFlag;
exports.createFeatureFlag = createFeatureFlag;
exports.deleteFeatureFlag = deleteFeatureFlag;
exports.getAllFeatureFlags = getAllFeatureFlags;
exports.getFeatureFlagsByEnvironment = getFeatureFlagsByEnvironment;
exports.checkDependencies = checkDependencies;
exports.toggleFeatureFlag = toggleFeatureFlag;
exports.clearFeatureFlagCache = clearFeatureFlagCache;
var tslib_1 = require("tslib");
var lru_cache_1 = require("lru-cache");
var logger_1 = require("../config/logger");
// Cache for feature flags (in-memory for performance)
var flagCache = new lru_cache_1.LRUCache({
    max: 1000,
    ttl: 1000 * 60 * 5, // 5 minutes
});
var rolloutCache = new lru_cache_1.LRUCache({
    max: 10000,
    ttl: 1000 * 60, // 1 minute
});
// In-memory flag storage for development
var inMemoryFlags = new Map();
// Default feature flags
var DEFAULT_FLAGS = [];
/**
 * Initialize the feature flag system
 */
function initializeFeatureFlags() {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var DEFAULT_FLAGS_1, DEFAULT_FLAGS_1_1, flag;
        var e_1, _a;
        return tslib_1.__generator(this, function (_b) {
            logger_1.logger.info('Initializing feature flag system');
            try {
                // Load default flags into memory
                for (DEFAULT_FLAGS_1 = tslib_1.__values(DEFAULT_FLAGS), DEFAULT_FLAGS_1_1 = DEFAULT_FLAGS_1.next(); !DEFAULT_FLAGS_1_1.done; DEFAULT_FLAGS_1_1 = DEFAULT_FLAGS_1.next()) {
                    flag = DEFAULT_FLAGS_1_1.value;
                    inMemoryFlags.set(flag.name, flag);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (DEFAULT_FLAGS_1_1 && !DEFAULT_FLAGS_1_1.done && (_a = DEFAULT_FLAGS_1.return)) _a.call(DEFAULT_FLAGS_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            // Database integration can be added later if needed
            // For now, using in-memory storage
            logger_1.logger.info('Feature flag system initialized', {
                flagCount: inMemoryFlags.size,
            });
            return [2 /*return*/];
        });
    });
}
/**
 * Get a feature flag by name
 */
function getFeatureFlag(name) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var cached, config, flag;
        return tslib_1.__generator(this, function (_a) {
            cached = flagCache.get(name);
            if (cached) {
                return [2 /*return*/, cached];
            }
            config = inMemoryFlags.get(name);
            if (!config) {
                return [2 /*return*/, null];
            }
            flag = {
                id: name,
                name: config.name,
                description: config.description,
                enabled: config.enabled,
                rollout_percentage: config.rolloutPercentage || 0,
                variants: config.variants || {},
                default_variant: config.defaultVariant || 'control',
                environment: config.environment || 'all',
                created_at: new Date(),
                updated_at: new Date(),
                expires_at: config.expiresAt || null,
            };
            flagCache.set(name, flag);
            return [2 /*return*/, flag];
        });
    });
}
/**
 * Check if a feature flag is enabled
 *
 * @param flagName - Name of the feature flag
 * @param userId - Optional user ID for user-specific evaluation
 * @param userSegment - Optional user segment for segment-based rollout
 * @param environment - Current environment (defaults to 'production')
 */
function isFeatureEnabled(flagName_1, userId_1, userSegment_1) {
    return tslib_1.__awaiter(this, arguments, void 0, function (flagName, userId, userSegment, environment) {
        var cacheKey, cached, config, enabled;
        if (environment === void 0) { environment = 'production'; }
        return tslib_1.__generator(this, function (_a) {
            cacheKey = "".concat(flagName, ":").concat(userId || 'anonymous', ":").concat(environment);
            cached = rolloutCache.get(cacheKey);
            if (cached !== undefined) {
                return [2 /*return*/, cached];
            }
            config = inMemoryFlags.get(flagName);
            if (!config) {
                logger_1.logger.warn('Feature flag not found', { flagName: flagName });
                rolloutCache.set(cacheKey, false);
                return [2 /*return*/, false];
            }
            enabled = evaluateFeatureFlag(config, flagName, userId, userSegment, environment);
            rolloutCache.set(cacheKey, enabled);
            return [2 /*return*/, enabled];
        });
    });
}
/**
 * Evaluate feature flag configuration
 *
 * @param config - Feature flag configuration
 * @param flagName - Name of the feature flag (for hashing)
 * @param userId - Optional user ID
 * @param userSegment - Optional user segment
 * @param environment - Current environment
 * @returns Whether feature is enabled
 */
function evaluateFeatureFlag(config, flagName, userId, userSegment, environment) {
    var _a;
    if (environment === void 0) { environment = 'production'; }
    // Check environment
    if (config.environment !== 'all' && config.environment !== environment) {
        return false;
    }
    // Check if feature is globally enabled
    if (!config.enabled) {
        return false;
    }
    // Check if feature has expired
    if (config.expiresAt && config.expiresAt < new Date()) {
        return false;
    }
    // Check rollout percentage
    var rolloutPercentage = config.rolloutPercentage || 100;
    if (rolloutPercentage >= 100) {
        return true;
    }
    if (rolloutPercentage <= 0) {
        return false;
    }
    // Check user segment
    if (userSegment && ((_a = config.userSegments) === null || _a === void 0 ? void 0 : _a.includes(userSegment))) {
        return true;
    }
    // Check user ID for deterministic rollout
    if (userId) {
        var hash = hashUserToFeature(userId, flagName);
        var threshold = rolloutPercentage / 100;
        return hash < threshold;
    }
    // No user ID, use random for anonymous users
    var randomValue = Math.random();
    return randomValue < rolloutPercentage / 100;
}
/**
 * Get A/B test variant for a feature flag
 *
 * @param flagName - Name of the feature flag
 * @param userId - User ID for deterministic assignment
 * @param defaultVariant - Fallback variant if none is assigned
 */
function getFeatureVariant(flagName, userId, defaultVariant) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var config, enabled, hash, variants, entries, cumulative, entries_1, entries_1_1, _a, variant, weight;
        var e_2, _b;
        return tslib_1.__generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    config = inMemoryFlags.get(flagName);
                    if (!config || !config.variants) {
                        return [2 /*return*/, defaultVariant || 'control'];
                    }
                    return [4 /*yield*/, isFeatureEnabled(flagName, userId)];
                case 1:
                    enabled = _c.sent();
                    if (!enabled) {
                        return [2 /*return*/, defaultVariant || config.defaultVariant || 'control'];
                    }
                    hash = hashUserToFeature(userId, flagName);
                    variants = config.variants;
                    entries = Object.entries(variants);
                    cumulative = 0;
                    try {
                        for (entries_1 = tslib_1.__values(entries), entries_1_1 = entries_1.next(); !entries_1_1.done; entries_1_1 = entries_1.next()) {
                            _a = tslib_1.__read(entries_1_1.value, 2), variant = _a[0], weight = _a[1];
                            cumulative += weight;
                            if (hash < cumulative / 100) {
                                return [2 /*return*/, variant];
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (entries_1_1 && !entries_1_1.done && (_b = entries_1.return)) _b.call(entries_1);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    return [2 /*return*/, defaultVariant || config.defaultVariant || 'control'];
            }
        });
    });
}
/**
 * Hash user ID and feature name to a value between 0 and 1
 */
function hashUserToFeature(userId, featureName) {
    var str = "".concat(userId, ":").concat(featureName);
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Normalize to 0-1
    return Math.abs(hash) / 2147483647;
}
/**
 * Evaluate multiple feature flags at once
 */
function evaluateFeatures(flagNames, userId, userSegment, environment) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var results, flagNames_1, flagNames_1_1, name, enabled, variant, config, e_3_1;
        var e_3, _a;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    results = [];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 8, 9, 10]);
                    flagNames_1 = tslib_1.__values(flagNames), flagNames_1_1 = flagNames_1.next();
                    _b.label = 2;
                case 2:
                    if (!!flagNames_1_1.done) return [3 /*break*/, 7];
                    name = flagNames_1_1.value;
                    return [4 /*yield*/, isFeatureEnabled(name, userId, userSegment, environment)];
                case 3:
                    enabled = _b.sent();
                    variant = void 0;
                    config = inMemoryFlags.get(name);
                    if (!((config === null || config === void 0 ? void 0 : config.variants) && userId)) return [3 /*break*/, 5];
                    return [4 /*yield*/, getFeatureVariant(name, userId)];
                case 4:
                    variant = _b.sent();
                    _b.label = 5;
                case 5:
                    results.push({
                        flagName: name,
                        enabled: enabled,
                        variant: variant,
                        reason: enabled ? 'flag_enabled' : 'flag_disabled',
                        evaluatedAt: new Date(),
                    });
                    _b.label = 6;
                case 6:
                    flagNames_1_1 = flagNames_1.next();
                    return [3 /*break*/, 2];
                case 7: return [3 /*break*/, 10];
                case 8:
                    e_3_1 = _b.sent();
                    e_3 = { error: e_3_1 };
                    return [3 /*break*/, 10];
                case 9:
                    try {
                        if (flagNames_1_1 && !flagNames_1_1.done && (_a = flagNames_1.return)) _a.call(flagNames_1);
                    }
                    finally { if (e_3) throw e_3.error; }
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/, results];
            }
        });
    });
}
/**
 * Update a feature flag configuration
 */
function updateFeatureFlag(name, updates) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var existing, updated;
        return tslib_1.__generator(this, function (_a) {
            existing = inMemoryFlags.get(name);
            if (!existing) {
                logger_1.logger.warn('Cannot update non-existent feature flag', { name: name });
                return [2 /*return*/, false];
            }
            updated = tslib_1.__assign(tslib_1.__assign({}, existing), updates);
            inMemoryFlags.set(name, updated);
            // Invalidate cache
            flagCache.delete(name);
            rolloutCache.clear();
            logger_1.logger.info('Feature flag updated', { name: name, updates: updates });
            return [2 /*return*/, true];
        });
    });
}
/**
 * Create a new feature flag
 */
function createFeatureFlag(config) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            if (inMemoryFlags.has(config.name)) {
                logger_1.logger.warn('Feature flag already exists', { name: config.name });
                return [2 /*return*/, false];
            }
            inMemoryFlags.set(config.name, config);
            logger_1.logger.info('Feature flag created', { name: config.name });
            return [2 /*return*/, true];
        });
    });
}
/**
 * Delete a feature flag
 */
function deleteFeatureFlag(name) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            if (!inMemoryFlags.has(name)) {
                logger_1.logger.warn('Feature flag not found', { name: name });
                return [2 /*return*/, false];
            }
            inMemoryFlags.delete(name);
            // Invalidate cache
            flagCache.delete(name);
            rolloutCache.clear();
            logger_1.logger.info('Feature flag deleted', { name: name });
            return [2 /*return*/, true];
        });
    });
}
/**
 * Get all feature flags
 */
function getAllFeatureFlags() {
    return Array.from(inMemoryFlags.values());
}
/**
 * Get feature flags for a specific environment
 */
function getFeatureFlagsByEnvironment(environment) {
    return Array.from(inMemoryFlags.values()).filter(function (flag) { return flag.environment === environment || flag.environment === 'all'; });
}
/**
 * Check if a feature has dependencies that are all enabled
 */
function checkDependencies(flagName, userId, environment) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var config, missing, _a, _b, dep, enabled, e_4_1;
        var e_4, _c;
        return tslib_1.__generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    config = inMemoryFlags.get(flagName);
                    if (!config || !config.dependencies || config.dependencies.length === 0) {
                        return [2 /*return*/, { satisfied: true, missing: [] }];
                    }
                    missing = [];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 6, 7, 8]);
                    _a = tslib_1.__values(config.dependencies), _b = _a.next();
                    _d.label = 2;
                case 2:
                    if (!!_b.done) return [3 /*break*/, 5];
                    dep = _b.value;
                    return [4 /*yield*/, isFeatureEnabled(dep, userId, undefined, environment)];
                case 3:
                    enabled = _d.sent();
                    if (!enabled) {
                        missing.push(dep);
                    }
                    _d.label = 4;
                case 4:
                    _b = _a.next();
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 8];
                case 6:
                    e_4_1 = _d.sent();
                    e_4 = { error: e_4_1 };
                    return [3 /*break*/, 8];
                case 7:
                    try {
                        if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                    }
                    finally { if (e_4) throw e_4.error; }
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/, {
                        satisfied: missing.length === 0,
                        missing: missing,
                    }];
            }
        });
    });
}
/**
 * Toggle a feature flag (useful for kill switches)
 */
function toggleFeatureFlag(name) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var config;
        return tslib_1.__generator(this, function (_a) {
            config = inMemoryFlags.get(name);
            if (!config) {
                return [2 /*return*/, false];
            }
            return [2 /*return*/, updateFeatureFlag(name, { enabled: !config.enabled })];
        });
    });
}
/**
 * Clear all feature flag caches
 */
function clearFeatureFlagCache() {
    flagCache.clear();
    rolloutCache.clear();
    logger_1.logger.info('Feature flag caches cleared');
}
// Export FeatureFlags class for convenience
exports.FeatureFlags = {
    isEnabled: isFeatureEnabled,
    getVariant: getFeatureVariant,
    evaluate: evaluateFeatures,
    update: updateFeatureFlag,
    create: createFeatureFlag,
    delete: deleteFeatureFlag,
    getAll: getAllFeatureFlags,
    getByEnvironment: getFeatureFlagsByEnvironment,
    checkDependencies: checkDependencies,
    toggle: toggleFeatureFlag,
    clearCache: clearFeatureFlagCache,
};
exports.default = exports.FeatureFlags;
