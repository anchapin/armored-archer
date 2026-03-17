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
export interface FlagUsage {
    name: string;
    isDefined: boolean;
    isUsed: boolean;
    locations: string[];
}
export interface DeadFlagReport {
    unusedDefinitions: string[];
    usedButNotDefined: string[];
    allFlags: FlagUsage[];
    timestamp: number;
}
declare class DeadFlagDetectorClass {
    /**
     * Scan source files to find all feature flag usages
     * This is a simplified implementation that could be extended
     * to use AST analysis or more sophisticated techniques
     */
    findUnusedFlags(): Promise<string[]>;
    /**
     * Generate a comprehensive report of all feature flags
     */
    generateReport(): Promise<DeadFlagReport>;
    /**
     * Check if any flags are deprecated or should be cleaned up
     */
    findDeprecatedFlags(): Promise<string[]>;
}
export declare const DeadFlagDetector: DeadFlagDetectorClass;
export default DeadFlagDetector;
