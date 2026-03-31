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
export interface FeatureFlag {
    name: string;
    enabled: boolean;
    description?: string;
    rolloutPercentage?: number;
}
export interface FeatureFlagConfig {
    flags: FeatureFlag[];
    defaultEnabled: boolean;
}
/**
 * Simple feature flag utility class
 */
export declare class FeatureFlags {
    private static flags;
    /**
     * Check if a feature flag is enabled
     * @param flagName - The name of the feature flag to check
     * @returns true if the feature is enabled, false otherwise
     */
    static isEnabled(flagName: string): boolean;
    /**
     * Get all feature flags
     * @returns Array of all feature flags
     */
    static getAllFlags(): FeatureFlag[];
    /**
     * Get a specific feature flag by name
     * @param flagName - The name of the feature flag
     * @returns The feature flag or undefined if not found
     */
    static getFlag(flagName: string): FeatureFlag | undefined;
    /**
     * Enable a feature flag at runtime
     * @param flagName - The name of the feature flag to enable
     */
    static enable(flagName: string): void;
    /**
     * Disable a feature flag at runtime
     * @param flagName - The name of the feature flag to disable
     */
    static disable(flagName: string): void;
    /**
     * Set rollout percentage for a feature flag
     * @param flagName - The name of the feature flag
     * @param percentage - Rollout percentage (0-100)
     */
    static setRolloutPercentage(flagName: string, percentage: number): void;
    /**
     * Simple hash function for consistent rollout
     */
    private static hashString;
}
export default FeatureFlags;
