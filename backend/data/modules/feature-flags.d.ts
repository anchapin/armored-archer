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
    rolloutPercentage?: number;
    targetUsers?: string[];
    variants?: string[];
    defaultVariant?: string;
}
export interface FeatureFlagsConfig {
    version: string;
    flags: Record<string, FeatureFlag>;
}
export declare const FEATURE_FLAGS: FeatureFlagsConfig;
/**
 * Check if a feature flag is enabled for a given user
 */
export declare function isFeatureEnabled(flagName: string, userId?: string): Promise<boolean>;
/**
 * Get the variant for A/B testing
 */
export declare function getFeatureVariant(flagName: string, userId: string): Promise<string | null>;
/**
 * Get all flags (for admin/diagnostic purposes)
 */
export declare function getAllFlags(): FeatureFlagsConfig;
