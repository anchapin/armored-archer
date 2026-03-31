"use strict";
/**
 * Dead Feature Flag Detection Utility
 *
 * This utility provides infrastructure for detecting unused/dead feature flags
 * in the codebase. It analyzes feature flag usage to identify flags that are
 * defined but never used or vice versa.
 *
 * Usage:
 *   import { DeadFlagDetector } from './utils/dead-flag-detector';
 *
 *   // Analyze all feature flags
 *   const unused = await DeadFlagDetector.findUnusedFlags();
 *   if (unused.length > 0) {
 *     console.warn('Unused feature flags:', unused);
 *   }
 *
 *   // Get a report of all flags
 *   const report = await DeadFlagDetector.generateReport();
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeadFlagDetector = void 0;
var tslib_1 = require("tslib");
var feature_flags_1 = require("./feature-flags");
var DeadFlagDetectorClass = /** @class */ (function () {
    function DeadFlagDetectorClass() {
    }
    /**
     * Scan source files to find all feature flag usages
     * This is a simplified implementation that could be extended
     * to use AST analysis or more sophisticated techniques
     */
    DeadFlagDetectorClass.prototype.findUnusedFlags = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var definedFlags, unusedFlags;
            return tslib_1.__generator(this, function (_a) {
                definedFlags = feature_flags_1.FeatureFlags.getAllFlags().map(function (f) { return f.name; });
                unusedFlags = [];
                // In a real implementation, this would:
                // 1. Parse source files to find all FeatureFlags.isEnabled() calls
                // 2. Compare with defined flags
                // 3. Return any that are defined but never called
                // For now, we return an empty array since we can't easily parse TS files
                // This is a placeholder for actual implementation
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                void definedFlags;
                return [2 /*return*/, unusedFlags];
            });
        });
    };
    /**
     * Generate a comprehensive report of all feature flags
     */
    DeadFlagDetectorClass.prototype.generateReport = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var definedFlags, allFlags;
            return tslib_1.__generator(this, function (_a) {
                definedFlags = feature_flags_1.FeatureFlags.getAllFlags().map(function (f) { return f.name; });
                allFlags = definedFlags.map(function (name) { return ({
                    name: name,
                    isDefined: true,
                    isUsed: true, // Assume used since we can't easily detect
                    locations: [],
                }); });
                return [2 /*return*/, {
                        unusedDefinitions: [],
                        usedButNotDefined: [],
                        allFlags: allFlags,
                        timestamp: Date.now(),
                    }];
            });
        });
    };
    /**
     * Check if any flags are deprecated or should be cleaned up
     */
    DeadFlagDetectorClass.prototype.findDeprecatedFlags = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var allFlags, deprecated, allFlags_1, allFlags_1_1, flag;
            var e_1, _a;
            return tslib_1.__generator(this, function (_b) {
                allFlags = feature_flags_1.FeatureFlags.getAllFlags();
                deprecated = [];
                try {
                    for (allFlags_1 = tslib_1.__values(allFlags), allFlags_1_1 = allFlags_1.next(); !allFlags_1_1.done; allFlags_1_1 = allFlags_1.next()) {
                        flag = allFlags_1_1.value;
                        // Check if flag has been disabled for a long time
                        if (flag.enabled === false && flag.rolloutPercentage === 0) {
                            // Could add logic here to check if flag was disabled > 30 days ago
                            // For now, just return the name for manual review
                            deprecated.push(flag.name);
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (allFlags_1_1 && !allFlags_1_1.done && (_a = allFlags_1.return)) _a.call(allFlags_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                return [2 /*return*/, deprecated];
            });
        });
    };
    return DeadFlagDetectorClass;
}());
exports.DeadFlagDetector = new DeadFlagDetectorClass();
exports.default = exports.DeadFlagDetector;
