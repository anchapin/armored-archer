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

import { LRUCache } from 'lru-cache';
import { logger } from '../config/logger';

// Note: Database integration deferred - feature flags currently use in-memory storage

// Feature flag configuration types
export interface FeatureFlagConfig {
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number; // 0-100
  variants?: Record<string, number>; // A/B test weights
  defaultVariant?: string;
  userSegments?: string[]; // Specific user segments that get this feature
  environment?: 'development' | 'staging' | 'production' | 'all';
  dependencies?: string[]; // Other features that must be enabled
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

// Cache for feature flags (in-memory for performance)
const flagCache = new LRUCache<string, FeatureFlag>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
});

const rolloutCache = new LRUCache<string, boolean>({
  max: 10000,
  ttl: 1000 * 60, // 1 minute
});

// In-memory flag storage for development
const inMemoryFlags: Map<string, FeatureFlagConfig> = new Map();

// Default feature flags
const DEFAULT_FLAGS: FeatureFlagConfig[] = [];

/**
 * Initialize the feature flag system
 */
export async function initializeFeatureFlags(): Promise<void> {
  logger.info('Initializing feature flag system');

  // Load default flags into memory
  for (const flag of DEFAULT_FLAGS) {
    inMemoryFlags.set(flag.name, flag);
  }

  // Database integration can be added later if needed
  // For now, using in-memory storage

  logger.info('Feature flag system initialized', {
    flagCount: inMemoryFlags.size,
  });
}

/**
 * Get a feature flag by name
 */
export async function getFeatureFlag(name: string): Promise<FeatureFlag | null> {
  // Check cache first
  const cached = flagCache.get(name);
  if (cached) {
    return cached;
  }

  // Check in-memory flags
  const config = inMemoryFlags.get(name);
  if (!config) {
    return null;
  }

  const flag: FeatureFlag = {
    id: name,
    name: config.name,
    description: config.description,
    enabled: config.enabled,
    rollout_percentage: config.rolloutPercentage || 0,
    variants: config.variants || {},
    default_variant: config.defaultVariant || 'control',
    environment: config.environment || 'all',
    created_at: new Date(),
    updated_at: new Date(),
    expires_at: config.expiresAt || null,
  };

  flagCache.set(name, flag);
  return flag;
}

/**
 * Check if a feature flag is enabled
 *
 * @param flagName - Name of the feature flag
 * @param userId - Optional user ID for user-specific evaluation
 * @param userSegment - Optional user segment for segment-based rollout
 * @param environment - Current environment (defaults to 'production')
 */
export async function isFeatureEnabled(
  flagName: string,
  userId?: string,
  userSegment?: string,
  environment: string = 'production'
): Promise<boolean> {
  const cacheKey = `${flagName}:${userId || 'anonymous'}:${environment}`;

  // Check cache
  const cached = rolloutCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Get the flag configuration
  const config = inMemoryFlags.get(flagName);

  if (!config) {
    logger.warn('Feature flag not found', { flagName });
    rolloutCache.set(cacheKey, false);
    return false;
  }

  // Evaluate flag and cache result
  const enabled = evaluateFeatureFlag(config, flagName, userId, userSegment, environment);
  rolloutCache.set(cacheKey, enabled);
  return enabled;
}

/**
 * Evaluate feature flag configuration
 *
 * @param config - Feature flag configuration
 * @param flagName - Name of the feature flag (for hashing)
 * @param userId - Optional user ID
 * @param userSegment - Optional user segment
 * @param environment - Current environment
 * @returns Whether feature is enabled
 */
function evaluateFeatureFlag(
  config: FeatureFlagConfig,
  flagName: string,
  userId?: string,
  userSegment?: string,
  environment: string = 'production'
): boolean {
  // Check environment
  if (config.environment !== 'all' && config.environment !== environment) {
    return false;
  }

  // Check if feature is globally enabled
  if (!config.enabled) {
    return false;
  }

  // Check if feature has expired
  if (config.expiresAt && config.expiresAt < new Date()) {
    return false;
  }

  // Check rollout percentage
  const rolloutPercentage = config.rolloutPercentage !== undefined ? config.rolloutPercentage : 100;

  if (rolloutPercentage >= 100) {
    return true;
  }

  if (rolloutPercentage <= 0) {
    return false;
  }

  // Check user segment
  if (userSegment && config.userSegments?.includes(userSegment)) {
    return true;
  }

  // Check user ID for deterministic rollout
  if (userId) {
    const hash = hashUserToFeature(userId, flagName);
    const threshold = rolloutPercentage / 100;
    return hash < threshold;
  }

  // No user ID, use random for anonymous users
  const randomValue = Math.random();
  return randomValue < rolloutPercentage / 100;
}

/**
 * Get A/B test variant for a feature flag
 *
 * @param flagName - Name of the feature flag
 * @param userId - User ID for deterministic assignment
 * @param defaultVariant - Fallback variant if none is assigned
 */
export async function getFeatureVariant(
  flagName: string,
  userId: string,
  defaultVariant?: string
): Promise<string> {
  const config = inMemoryFlags.get(flagName);

  if (!config || !config.variants) {
    return defaultVariant || 'control';
  }

  // Check if user is in the rollout
  const enabled = await isFeatureEnabled(flagName, userId);
  if (!enabled) {
    return defaultVariant || config.defaultVariant || 'control';
  }

  // Get deterministic variant based on user ID
  const hash = hashUserToFeature(userId, flagName);
  const variants = config.variants;

  // Calculate cumulative weights
  const entries = Object.entries(variants);
  let cumulative = 0;

  for (const [variant, weight] of entries) {
    cumulative += weight;
    if (hash < cumulative / 100) {
      return variant;
    }
  }

  return defaultVariant || config.defaultVariant || 'control';
}

/**
 * Hash user ID and feature name to a value between 0 and 1
 */
function hashUserToFeature(userId: string, featureName: string): number {
  const str = `${userId}:${featureName}`;
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Normalize to 0-1
  return Math.abs(hash) / 2147483647;
}

/**
 * Evaluate multiple feature flags at once
 */
export async function evaluateFeatures(
  flagNames: string[],
  userId?: string,
  userSegment?: string,
  environment?: string
): Promise<FeatureFlagEvaluation[]> {
  const results: FeatureFlagEvaluation[] = [];

  for (const name of flagNames) {
    const enabled = await isFeatureEnabled(name, userId, userSegment, environment);
    let variant: string | undefined;

    const config = inMemoryFlags.get(name);
    if (config?.variants && userId) {
      variant = await getFeatureVariant(name, userId);
    }

    results.push({
      flagName: name,
      enabled,
      variant,
      reason: enabled ? 'flag_enabled' : 'flag_disabled',
      evaluatedAt: new Date(),
    });
  }

  return results;
}

/**
 * Update a feature flag configuration
 */
export async function updateFeatureFlag(
  name: string,
  updates: Partial<FeatureFlagConfig>
): Promise<boolean> {
  const existing = inMemoryFlags.get(name);

  if (!existing) {
    logger.warn('Cannot update non-existent feature flag', { name });
    return false;
  }

  const updated: FeatureFlagConfig = {
    ...existing,
    ...updates,
  };

  inMemoryFlags.set(name, updated);

  // Invalidate cache
  flagCache.delete(name);
  rolloutCache.clear();

  logger.info('Feature flag updated', { name, updates });
  return true;
}

/**
 * Create a new feature flag
 */
export async function createFeatureFlag(config: FeatureFlagConfig): Promise<boolean> {
  if (inMemoryFlags.has(config.name)) {
    logger.warn('Feature flag already exists', { name: config.name });
    return false;
  }

  inMemoryFlags.set(config.name, config);

  logger.info('Feature flag created', { name: config.name });
  return true;
}

/**
 * Delete a feature flag
 */
export async function deleteFeatureFlag(name: string): Promise<boolean> {
  if (!inMemoryFlags.has(name)) {
    logger.warn('Feature flag not found', { name });
    return false;
  }

  inMemoryFlags.delete(name);

  // Invalidate cache
  flagCache.delete(name);
  rolloutCache.clear();

  logger.info('Feature flag deleted', { name });
  return true;
}

/**
 * Get all feature flags
 */
export function getAllFeatureFlags(): FeatureFlagConfig[] {
  return Array.from(inMemoryFlags.values());
}

/**
 * Get feature flags for a specific environment
 */
export function getFeatureFlagsByEnvironment(environment: string): FeatureFlagConfig[] {
  return Array.from(inMemoryFlags.values()).filter(
    (flag) => flag.environment === environment || flag.environment === 'all'
  );
}

/**
 * Check if a feature has dependencies that are all enabled
 */
export async function checkDependencies(
  flagName: string,
  userId?: string,
  environment?: string
): Promise<{ satisfied: boolean; missing: string[] }> {
  const config = inMemoryFlags.get(flagName);

  if (!config || !config.dependencies || config.dependencies.length === 0) {
    return { satisfied: true, missing: [] };
  }

  const missing: string[] = [];

  for (const dep of config.dependencies) {
    const enabled = await isFeatureEnabled(dep, userId, undefined, environment);
    if (!enabled) {
      missing.push(dep);
    }
  }

  return {
    satisfied: missing.length === 0,
    missing,
  };
}

/**
 * Toggle a feature flag (useful for kill switches)
 */
export async function toggleFeatureFlag(name: string): Promise<boolean> {
  const config = inMemoryFlags.get(name);

  if (!config) {
    return false;
  }

  return updateFeatureFlag(name, { enabled: !config.enabled });
}

/**
 * Clear all feature flag caches
 */
export function clearFeatureFlagCache(): void {
  flagCache.clear();
  rolloutCache.clear();
  logger.info('Feature flag caches cleared');
}

/**
 * Reset all feature flags (for testing)
 */
export function __resetForTesting(): void {
  inMemoryFlags.clear();
  flagCache.clear();
  rolloutCache.clear();
}

// Export FeatureFlags class for convenience
export const FeatureFlags = {
  isEnabled: isFeatureEnabled,
  getVariant: getFeatureVariant,
  evaluate: evaluateFeatures,
  update: updateFeatureFlag,
  create: createFeatureFlag,
  delete: deleteFeatureFlag,
  getAll: getAllFeatureFlags,
  getByEnvironment: getFeatureFlagsByEnvironment,
  checkDependencies,
  toggle: toggleFeatureFlag,
  clearCache: clearFeatureFlagCache,
};

export default FeatureFlags;
