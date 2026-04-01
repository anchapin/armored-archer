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
  rolloutPercentage?: number; // 0-100
}

export interface FeatureFlagConfig {
  flags: FeatureFlag[];
  defaultEnabled: boolean;
}

// Feature flag definitions
// In production, these could be loaded from a database or external service
export const FEATURE_FLAGS: FeatureFlagConfig = {
  defaultEnabled: false,
  flags: [],
};

/**
 * Simple feature flag utility class
 */
export class FeatureFlags {
  private static flags: FeatureFlagConfig = FEATURE_FLAGS;

  /**
   * Check if a feature flag is enabled
   * @param flagName - The name of the feature flag to check
   * @returns true if the feature is enabled, false otherwise
   */
  static isEnabled(flagName: string): boolean {
    const flag = this.flags.flags.find((f) => f.name === flagName);

    if (!flag) {
      return this.flags.defaultEnabled;
    }

    // Handle rollout percentage for gradual rollout
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage > 0) {
      // Use a simple hash-based approach for consistent rollout
      const hash = this.hashString(flagName);
      const percentage = hash % 100;
      return percentage < flag.rolloutPercentage;
    }

    return flag.enabled;
  }

  /**
   * Get all feature flags
   * @returns Array of all feature flags
   */
  static getAllFlags(): FeatureFlag[] {
    return [...this.flags.flags];
  }

  /**
   * Get a specific feature flag by name
   * @param flagName - The name of the feature flag
   * @returns The feature flag or undefined if not found
   */
  static getFlag(flagName: string): FeatureFlag | undefined {
    return this.flags.flags.find((f) => f.name === flagName);
  }

  /**
   * Enable a feature flag at runtime
   * @param flagName - The name of the feature flag to enable
   */
  static enable(flagName: string): void {
    const flag = this.flags.flags.find((f) => f.name === flagName);
    if (flag) {
      flag.enabled = true;
    }
  }

  /**
   * Disable a feature flag at runtime
   * @param flagName - The name of the feature flag to disable
   */
  static disable(flagName: string): void {
    const flag = this.flags.flags.find((f) => f.name === flagName);
    if (flag) {
      flag.enabled = false;
    }
  }

  /**
   * Set rollout percentage for a feature flag
   * @param flagName - The name of the feature flag
   * @param percentage - Rollout percentage (0-100)
   */
  static setRolloutPercentage(flagName: string, percentage: number): void {
    const flag = this.flags.flags.find((f) => f.name === flagName);
    if (flag) {
      flag.rolloutPercentage = Math.max(0, Math.min(100, percentage));
    }
  }

  /**
   * Simple hash function for consistent rollout
   */
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

export default FeatureFlags;
