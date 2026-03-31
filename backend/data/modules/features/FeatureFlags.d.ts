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
export interface FeatureFlagConfig {
    name: string;
    description: string;
    enabled: boolean;
    rolloutPercentage?: number;
    variants?: Record<string, number>;
    defaultVariant?: string;
    userSegments?: string[];
    environment?: 'development' | 'staging' | 'production' | 'all';
    dependencies?: string[];
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
}
export interface FeatureFlag {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    rollout_percentage: number;
    variants: Record<string, number>;
    default_variant: string;
    environment: string;
    created_at: Date;
    updated_at: Date;
    expires_at: Date | null;
}
export interface FeatureFlagEvaluation {
    flagName: string;
    enabled: boolean;
    variant?: string;
    reason: string;
    evaluatedAt: Date;
}
/**
 * Initialize the feature flag system
 */
export declare function initializeFeatureFlags(): Promise<void>;
/**
 * Get a feature flag by name
 */
export declare function getFeatureFlag(name: string): Promise<FeatureFlag | null>;
/**
 * Check if a feature flag is enabled
 *
 * @param flagName - Name of the feature flag
 * @param userId - Optional user ID for user-specific evaluation
 * @param userSegment - Optional user segment for segment-based rollout
 * @param environment - Current environment (defaults to 'production')
 */
export declare function isFeatureEnabled(flagName: string, userId?: string, userSegment?: string, environment?: string): Promise<boolean>;
/**
 * Get A/B test variant for a feature flag
 *
 * @param flagName - Name of the feature flag
 * @param userId - User ID for deterministic assignment
 * @param defaultVariant - Fallback variant if none is assigned
 */
export declare function getFeatureVariant(flagName: string, userId: string, defaultVariant?: string): Promise<string>;
/**
 * Evaluate multiple feature flags at once
 */
export declare function evaluateFeatures(flagNames: string[], userId?: string, userSegment?: string, environment?: string): Promise<FeatureFlagEvaluation[]>;
/**
 * Update a feature flag configuration
 */
export declare function updateFeatureFlag(name: string, updates: Partial<FeatureFlagConfig>): Promise<boolean>;
/**
 * Create a new feature flag
 */
export declare function createFeatureFlag(config: FeatureFlagConfig): Promise<boolean>;
/**
 * Delete a feature flag
 */
export declare function deleteFeatureFlag(name: string): Promise<boolean>;
/**
 * Get all feature flags
 */
export declare function getAllFeatureFlags(): FeatureFlagConfig[];
/**
 * Get feature flags for a specific environment
 */
export declare function getFeatureFlagsByEnvironment(environment: string): FeatureFlagConfig[];
/**
 * Check if a feature has dependencies that are all enabled
 */
export declare function checkDependencies(flagName: string, userId?: string, environment?: string): Promise<{
    satisfied: boolean;
    missing: string[];
}>;
/**
 * Toggle a feature flag (useful for kill switches)
 */
export declare function toggleFeatureFlag(name: string): Promise<boolean>;
/**
 * Clear all feature flag caches
 */
export declare function clearFeatureFlagCache(): void;
export declare const FeatureFlags: {
    isEnabled: typeof isFeatureEnabled;
    getVariant: typeof getFeatureVariant;
    evaluate: typeof evaluateFeatures;
    update: typeof updateFeatureFlag;
    create: typeof createFeatureFlag;
    delete: typeof deleteFeatureFlag;
    getAll: typeof getAllFeatureFlags;
    getByEnvironment: typeof getFeatureFlagsByEnvironment;
    checkDependencies: typeof checkDependencies;
    toggle: typeof toggleFeatureFlag;
    clearCache: typeof clearFeatureFlagCache;
};
export default FeatureFlags;
