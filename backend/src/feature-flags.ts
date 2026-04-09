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

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage?: number; // 0-100
  targetUsers?: string[]; // Specific user IDs
  variants?: string[]; // For A/B testing
  defaultVariant?: string;
}

export interface FeatureFlagsConfig {
  version: string;
  flags: Record<string, FeatureFlag>;
}

// Current feature flags in production
export const FEATURE_FLAGS: FeatureFlagsConfig = {
  version: '1.0.0',
  flags: {},
};

/**
 * Check if a feature flag is enabled for a given user
 */
export async function isFeatureEnabled(flagName: string, userId?: string): Promise<boolean> {
  const flag = FEATURE_FLAGS.flags[flagName];

  if (!flag) {
    // Unknown flags are disabled by default for safety
    return false;
  }

  if (!flag.enabled) {
    return false;
  }

  // Check user targeting
  if (userId && flag.targetUsers && flag.targetUsers.length > 0) {
    return flag.targetUsers.includes(userId);
  }

  // Check rollout percentage
  if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
    if (!userId) {
      // No user ID means we can't do percentage rollout
      return flag.rolloutPercentage >= 50;
    }

    // Simple hash-based deterministic rollout
    const hash = hashUserId(userId, flagName);
    return hash < flag.rolloutPercentage;
  }

  return true;
}

/**
 * Get the variant for A/B testing
 */
export async function getFeatureVariant(flagName: string, userId: string): Promise<string | null> {
  const flag = FEATURE_FLAGS.flags[flagName];

  if (!flag || !flag.enabled || !flag.variants || flag.variants.length === 0) {
    return null;
  }

  // Deterministic variant assignment based on user ID
  const hash = hashUserId(userId, flagName);
  const variantIndex = hash % flag.variants.length;

  return flag.variants[variantIndex];
}

/**
 * Simple hash function for deterministic feature flag assignment
 */
function hashUserId(userId: string, flagName: string): number {
  const combined = `${userId}:${flagName}`;
  let hash = 0;

  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash) % 100;
}

/**
 * Get all flags (for admin/diagnostic purposes)
 */
export function getAllFlags(): FeatureFlagsConfig {
  return FEATURE_FLAGS;
}
