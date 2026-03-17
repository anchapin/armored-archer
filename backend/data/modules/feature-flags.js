"use strict";
/**
 * Feature Flag Configuration
 *
 * This module provides feature flag infrastructure for the Armored Archer backend.
 * Used for gradual rollouts, A/B testing, and kill switches.
 *
 * Supported Flag Types:
 * - boolean: Simple on/off flags
 * - percentage: Gradual rollout by percentage
 * - user_id: Specific user targeting
 *
 * Usage:
 *   import { isFeatureEnabled, getFeatureVariant } from './feature-flags';
 *
 *   if (await isFeatureEnabled('new-combat-system')) {
 *     // New code path
 *   }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURE_FLAGS = void 0;
exports.isFeatureEnabled = isFeatureEnabled;
exports.getFeatureVariant = getFeatureVariant;
exports.getAllFlags = getAllFlags;
var tslib_1 = require("tslib");
// Current feature flags in production
exports.FEATURE_FLAGS = {
    version: "1.0.0",
    flags: {}
};
/**
 * Check if a feature flag is enabled for a given user
 */
function isFeatureEnabled(flagName, userId) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var flag, hash;
        return tslib_1.__generator(this, function (_a) {
            flag = exports.FEATURE_FLAGS.flags[flagName];
            if (!flag) {
                // Unknown flags are disabled by default for safety
                return [2 /*return*/, false];
            }
            if (!flag.enabled) {
                return [2 /*return*/, false];
            }
            // Check user targeting
            if (userId && flag.targetUsers && flag.targetUsers.length > 0) {
                return [2 /*return*/, flag.targetUsers.includes(userId)];
            }
            // Check rollout percentage
            if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
                if (!userId) {
                    // No user ID means we can't do percentage rollout
                    return [2 /*return*/, flag.rolloutPercentage >= 50];
                }
                hash = hashUserId(userId, flagName);
                return [2 /*return*/, hash < flag.rolloutPercentage];
            }
            return [2 /*return*/, true];
        });
    });
}
/**
 * Get the variant for A/B testing
 */
function getFeatureVariant(flagName, userId) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var flag, hash, variantIndex;
        return tslib_1.__generator(this, function (_a) {
            flag = exports.FEATURE_FLAGS.flags[flagName];
            if (!flag || !flag.enabled || !flag.variants || flag.variants.length === 0) {
                return [2 /*return*/, null];
            }
            hash = hashUserId(userId, flagName);
            variantIndex = hash % flag.variants.length;
            return [2 /*return*/, flag.variants[variantIndex]];
        });
    });
}
/**
 * Simple hash function for deterministic feature flag assignment
 */
function hashUserId(userId, flagName) {
    var combined = "".concat(userId, ":").concat(flagName);
    var hash = 0;
    for (var i = 0; i < combined.length; i++) {
        var char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
}
/**
 * Get all flags (for admin/diagnostic purposes)
 */
function getAllFlags() {
    return exports.FEATURE_FLAGS;
}
