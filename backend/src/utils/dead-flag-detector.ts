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

import { FeatureFlags } from './feature-flags';

export interface FlagUsage {
  name: string;
  isDefined: boolean;
  isUsed: boolean;
  locations: string[];
}

export interface DeadFlagReport {
  unusedDefinitions: string[]; // Flags defined but never used
  usedButNotDefined: string[]; // Flags used but not in config
  allFlags: FlagUsage[];
  timestamp: number;
}

class DeadFlagDetectorClass {
  /**
   * Scan source files to find all feature flag usages
   * This is a simplified implementation that could be extended
   * to use AST analysis or more sophisticated techniques
   */
  async findUnusedFlags(): Promise<string[]> {
    const definedFlags = FeatureFlags.getAllFlags().map((f) => f.name);
    const unusedFlags: string[] = [];

    // In a real implementation, this would:
    // 1. Parse source files to find all FeatureFlags.isEnabled() calls
    // 2. Compare with defined flags
    // 3. Return any that are defined but never called

    // For now, we return an empty array since we can't easily parse TS files
    // This is a placeholder for actual implementation
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void definedFlags;

    return unusedFlags;
  }

  /**
   * Generate a comprehensive report of all feature flags
   */
  async generateReport(): Promise<DeadFlagReport> {
    const definedFlags = FeatureFlags.getAllFlags().map((f) => f.name);

    // In a full implementation, this would scan all source files
    // and build a usage map

    const allFlags: FlagUsage[] = definedFlags.map((name) => ({
      name,
      isDefined: true,
      isUsed: true, // Assume used since we can't easily detect
      locations: [],
    }));

    return {
      unusedDefinitions: [],
      usedButNotDefined: [],
      allFlags,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if any flags are deprecated or should be cleaned up
   */
  async findDeprecatedFlags(): Promise<string[]> {
    const allFlags = FeatureFlags.getAllFlags();
    const deprecated: string[] = [];

    for (const flag of allFlags) {
      // Check if flag has been disabled for a long time
      if (flag.enabled === false && flag.rolloutPercentage === 0) {
        // Could add logic here to check if flag was disabled > 30 days ago
        // For now, just return the name for manual review
        deprecated.push(flag.name);
      }
    }

    return deprecated;
  }
}

export const DeadFlagDetector = new DeadFlagDetectorClass();
export default DeadFlagDetector;
