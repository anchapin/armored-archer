"use strict";
/**
 * Simple feature flag system for the backend.
 *
 * This provides a basic feature flag infrastructure that can be extended
 * to integrate with services like LaunchDarkly, Statsig, or Unleash.
 *
 * Usage:
 *   import { FeatureFlags } from './utils/feature-flags';
 *
 *   if (FeatureFlags.isEnabled('new_combat_system')) {
 *     // New combat logic
 *   } else {
 *     // Legacy combat logic
 *   }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlags = void 0;
var tslib_1 = require("tslib");
// Feature flag definitions
// In production, these could be loaded from a database or external service
var FEATURE_FLAGS = {
    defaultEnabled: false,
    flags: [],
};
/**
 * Simple feature flag utility class
 */
var FeatureFlags = /** @class */ (function () {
    function FeatureFlags() {
    }
    /**
     * Check if a feature flag is enabled
     * @param flagName - The name of the feature flag to check
     * @returns true if the feature is enabled, false otherwise
     */
    FeatureFlags.isEnabled = function (flagName) {
        var flag = this.flags.flags.find(function (f) { return f.name === flagName; });
        if (!flag) {
            return this.flags.defaultEnabled;
        }
        // Handle rollout percentage for gradual rollout
        if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage > 0) {
            // Use a simple hash-based approach for consistent rollout
            var hash = this.hashString(flagName);
            var percentage = hash % 100;
            return percentage < flag.rolloutPercentage;
        }
        return flag.enabled;
    };
    /**
     * Get all feature flags
     * @returns Array of all feature flags
     */
    FeatureFlags.getAllFlags = function () {
        return tslib_1.__spreadArray([], tslib_1.__read(this.flags.flags), false);
    };
    /**
     * Get a specific feature flag by name
     * @param flagName - The name of the feature flag
     * @returns The feature flag or undefined if not found
     */
    FeatureFlags.getFlag = function (flagName) {
        return this.flags.flags.find(function (f) { return f.name === flagName; });
    };
    /**
     * Enable a feature flag at runtime
     * @param flagName - The name of the feature flag to enable
     */
    FeatureFlags.enable = function (flagName) {
        var flag = this.flags.flags.find(function (f) { return f.name === flagName; });
        if (flag) {
            flag.enabled = true;
        }
    };
    /**
     * Disable a feature flag at runtime
     * @param flagName - The name of the feature flag to disable
     */
    FeatureFlags.disable = function (flagName) {
        var flag = this.flags.flags.find(function (f) { return f.name === flagName; });
        if (flag) {
            flag.enabled = false;
        }
    };
    /**
     * Set rollout percentage for a feature flag
     * @param flagName - The name of the feature flag
     * @param percentage - Rollout percentage (0-100)
     */
    FeatureFlags.setRolloutPercentage = function (flagName, percentage) {
        var flag = this.flags.flags.find(function (f) { return f.name === flagName; });
        if (flag) {
            flag.rolloutPercentage = Math.max(0, Math.min(100, percentage));
        }
    };
    /**
     * Simple hash function for consistent rollout
     */
    FeatureFlags.hashString = function (str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            var char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    };
    FeatureFlags.flags = FEATURE_FLAGS;
    return FeatureFlags;
}());
exports.FeatureFlags = FeatureFlags;
exports.default = FeatureFlags;
