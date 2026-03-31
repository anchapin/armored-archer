/**
 * Progressive Rollout Module
 *
 * This module provides progressive rollout capabilities for feature releases:
 * - Percentage-based gradual rollout
 * - Feature flags for canary deployments
 * - Rollback criteria for each phase
 * - Monitoring and metrics for rollout phases
 *
 * Phases: disabled -> canary -> gradual -> full
 */

import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import { config } from '../config';
import { Runtime } from '../types/nakama';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

// Create a dedicated registry for rollout metrics
const rolloutRegistry = new Registry();

// Rollout phase types
export type RolloutPhase = 'disabled' | 'canary' | 'gradual' | 'full';

// Rollout status
export type RolloutStatus = 'active' | 'paused' | 'rolled_back' | 'completed';

// Feature flag interface
export interface FeatureFlag {
  name: string;
  description: string;
  enabled: boolean;
  rolloutPhase: RolloutPhase;
  rolloutPercentage: number; // 0-100
  canaryUserIds: string[]; // Specific users for canary
  canaryVersionMin?: string; // Min game version for canary
  canaryVersionMax?: string; // Max game version for canary
  phases: RolloutPhaseConfig[];
  currentPhaseIndex: number;
  createdAt: number;
  updatedAt: number;
}

// Phase configuration
export interface RolloutPhaseConfig {
  phase: RolloutPhase;
  percentage: number;
  durationMinutes: number;
  minHealthPercent: number;
  maxErrorRatePercent: number;
  maxLatencyMs: number;
  sampleSize: number;
  autoPromote: boolean;
  rollbackCriteria: {
    errorRateThreshold: number;
    latencyThreshold: number;
    healthCheckFails: number;
    customMetrics?: Record<string, number>;
  };
}

// Rollback criteria for each phase
export interface RollbackCriteria {
  errorRateThreshold: number; // Max error rate % before rollback
  latencyThreshold: number; // Max latency ms before rollback
  healthCheckFails: number; // Number of health check failures before rollback
  customMetrics?: Record<string, number>; // Custom metric thresholds
}

// Rollout metrics for a specific feature
export interface RolloutMetrics {
  featureName: string;
  phase: RolloutPhase;
  totalUsers: number;
  activeUsers: number;
  errorCount: number;
  errorRate: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  healthCheckPasses: number;
  healthCheckFails: number;
  lastUpdated: number;
}

// In-memory storage for feature flags and metrics
const featureFlags: Map<string, FeatureFlag> = new Map();
const rolloutMetrics: Map<string, RolloutMetrics> = new Map();

// ============== Metrics ==============

const rolloutPhaseGauge = new Gauge({
  name: 'armored_archer_rollout_phase',
  help: 'Current rollout phase for a feature',
  labelNames: ['feature_name', 'phase'],
  registers: [rolloutRegistry],
});

const rolloutPercentageGauge = new Gauge({
  name: 'armored_archer_rollout_percentage',
  help: 'Current rollout percentage for a feature',
  labelNames: ['feature_name'],
  registers: [rolloutRegistry],
});

const rolloutUsersTotal = new Counter({
  name: 'armored_archer_rollout_users_total',
  help: 'Total users exposed to a feature rollout',
  labelNames: ['feature_name', 'phase'],
  registers: [rolloutRegistry],
});

const rolloutErrorsTotal = new Counter({
  name: 'armored_archer_rollout_errors_total',
  help: 'Total errors during feature rollout',
  labelNames: ['feature_name', 'phase', 'error_type'],
  registers: [rolloutRegistry],
});

const rolloutLatencyHistogram = new Histogram({
  name: 'armored_archer_rollout_latency_ms',
  help: 'Latency histogram for feature rollout',
  labelNames: ['feature_name', 'phase'],
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [rolloutRegistry],
});

const rolloutHealthGauge = new Gauge({
  name: 'armored_archer_rollout_health',
  help: 'Health status of feature rollout (1=healthy, 0=unhealthy)',
  labelNames: ['feature_name', 'phase'],
  registers: [rolloutRegistry],
});

const featureFlagEnabledGauge = new Gauge({
  name: 'armored_archer_feature_flag_enabled',
  help: 'Whether a feature flag is enabled (1=enabled, 0=disabled)',
  labelNames: ['feature_name'],
  registers: [rolloutRegistry],
});

// ============== Helper Functions ==============

/**
 * Get feature flag by name
 */
export function getFeatureFlag(name: string): FeatureFlag | undefined {
  return featureFlags.get(name);
}

/**
 * Get all feature flags
 */
export function getAllFeatureFlags(): FeatureFlag[] {
  return Array.from(featureFlags.values());
}

/**
 * Check if a feature is enabled for a specific user
 */
export function isFeatureEnabled(
  featureName: string,
  userId: string,
  gameVersion?: string
): boolean {
  const flag = featureFlags.get(featureName);
  if (!flag || !flag.enabled) {
    return false;
  }

  // Check if rollout phase allows this user
  if (flag.rolloutPhase === 'disabled') {
    return false;
  }

  // Canary phase: only specific users or version range
  if (flag.rolloutPhase === 'canary') {
    if (flag.canaryUserIds.includes(userId)) {
      return true;
    }
    if (gameVersion) {
      const meetsVersionReq =
        (!flag.canaryVersionMin || gameVersion >= flag.canaryVersionMin) &&
        (!flag.canaryVersionMax || gameVersion <= flag.canaryVersionMax);
      if (meetsVersionReq && flag.canaryUserIds.length === 0) {
        return true;
      }
    }
    return false;
  }

  // Gradual/Full phase: use percentage-based rollout
  if (flag.rolloutPhase === 'gradual' || flag.rolloutPhase === 'full') {
    // For full rollout, all users get the feature
    if (flag.rolloutPhase === 'full') {
      return true;
    }
    // For gradual, use deterministic hash
    const hash = hashUserId(userId, featureName);
    return hash < flag.rolloutPercentage;
  }

  return false;
}

/**
 * Deterministic hash for user ID to ensure consistent rollout percentage
 */
function hashUserId(userId: string, featureName: string): number {
  const str = `${featureName}:${userId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash % 100);
}

/**
 * Create a new feature flag
 */
export function createFeatureFlag(
  name: string,
  description: string,
  phases: RolloutPhaseConfig[]
): FeatureFlag {
  const now = Date.now();
  const flag: FeatureFlag = {
    name,
    description,
    enabled: true,
    rolloutPhase: 'disabled',
    rolloutPercentage: 0,
    canaryUserIds: [],
    phases,
    currentPhaseIndex: -1,
    createdAt: now,
    updatedAt: now,
  };

  featureFlags.set(name, flag);
  updateMetrics(flag);

  return flag;
}

/**
 * Update feature flag settings
 */
export function updateFeatureFlag(
  name: string,
  updates: Partial<Omit<FeatureFlag, 'name' | 'createdAt'>>
): FeatureFlag | null {
  const flag = featureFlags.get(name);
  if (!flag) {
    return null;
  }

  const updatedFlag: FeatureFlag = {
    ...flag,
    ...updates,
    updatedAt: Date.now(),
  };

  featureFlags.set(name, updatedFlag);
  updateMetrics(updatedFlag);

  return updatedFlag;
}

/**
 * Advance to next rollout phase
 */
export function advancePhase(featureName: string): FeatureFlag | null {
  const flag = featureFlags.get(featureName);
  if (!flag) {
    return null;
  }

  const nextIndex = flag.currentPhaseIndex + 1;
  if (nextIndex >= flag.phases.length) {
    // Already at final phase
    return flag;
  }

  const nextPhase = flag.phases[nextIndex];
  flag.rolloutPhase = nextPhase.phase;
  flag.rolloutPercentage = nextPhase.percentage;
  flag.currentPhaseIndex = nextIndex;
  flag.updatedAt = Date.now();

  featureFlags.set(featureName, flag);
  updateMetrics(flag);

  return flag;
}

/**
 * Rollback to previous phase or disable
 */
export function rollbackFeature(featureName: string): FeatureFlag | null {
  const flag = featureFlags.get(featureName);
  if (!flag) {
    return null;
  }

  if (flag.currentPhaseIndex > 0) {
    // Rollback to previous phase
    const prevPhase = flag.phases[flag.currentPhaseIndex - 1];
    flag.rolloutPhase = prevPhase.phase;
    flag.rolloutPercentage = prevPhase.percentage;
    flag.currentPhaseIndex--;
  } else {
    // Disable entirely
    flag.rolloutPhase = 'disabled';
    flag.rolloutPercentage = 0;
    flag.currentPhaseIndex = -1;
  }

  flag.updatedAt = Date.now();
  featureFlags.set(featureName, flag);
  updateMetrics(flag);

  return flag;
}

/**
 * Check rollback criteria and auto-rollback if needed
 */
export function checkRollbackCriteria(featureName: string): {
  shouldRollback: boolean;
  reason?: string;
} {
  const flag = featureFlags.get(featureName);
  if (!flag || flag.currentPhaseIndex < 0) {
    return { shouldRollback: false };
  }

  const currentPhase = flag.phases[flag.currentPhaseIndex];
  const metrics = rolloutMetrics.get(featureName);

  if (!metrics) {
    return { shouldRollback: false };
  }

  // Check error rate
  if (metrics.errorRate > currentPhase.rollbackCriteria.errorRateThreshold) {
    return {
      shouldRollback: true,
      reason: `Error rate ${metrics.errorRate.toFixed(2)}% exceeds threshold ${currentPhase.rollbackCriteria.errorRateThreshold}%`,
    };
  }

  // Check latency
  if (metrics.avgLatencyMs > currentPhase.rollbackCriteria.latencyThreshold) {
    return {
      shouldRollback: true,
      reason: `Avg latency ${metrics.avgLatencyMs.toFixed(2)}ms exceeds threshold ${currentPhase.rollbackCriteria.latencyThreshold}ms`,
    };
  }

  // Check health check failures
  if (metrics.healthCheckFails >= currentPhase.rollbackCriteria.healthCheckFails) {
    return {
      shouldRollback: true,
      reason: `Health check failures ${metrics.healthCheckFails} exceeds threshold ${currentPhase.rollbackCriteria.healthCheckFails}`,
    };
  }

  // Check custom metrics
  const customMetrics = currentPhase.rollbackCriteria.customMetrics;
  if (customMetrics) {
    for (const [metricName, threshold] of Object.entries(customMetrics)) {
      const metricValue = metrics[metricName as keyof RolloutMetrics] as number;
      if (metricValue !== undefined && metricValue > threshold) {
        return {
          shouldRollback: true,
          reason: `Custom metric ${metricName} (${metricValue}) exceeds threshold ${threshold}`,
        };
      }
    }
  }

  return { shouldRollback: false };
}

/**
 * Record rollout metrics for a feature
 */
export function recordRolloutMetrics(featureName: string, metrics: Partial<RolloutMetrics>): void {
  const existing = rolloutMetrics.get(featureName) || {
    featureName,
    phase: 'disabled' as RolloutPhase,
    totalUsers: 0,
    activeUsers: 0,
    errorCount: 0,
    errorRate: 0,
    avgLatencyMs: 0,
    p99LatencyMs: 0,
    healthCheckPasses: 0,
    healthCheckFails: 0,
    lastUpdated: Date.now(),
  };

  const flag = featureFlags.get(featureName);

  const updated: RolloutMetrics = {
    ...existing,
    ...metrics,
    phase: flag?.rolloutPhase || 'disabled',
    lastUpdated: Date.now(),
  };

  rolloutMetrics.set(featureName, updated);
}

/**
 * Update Prometheus metrics for a feature flag
 */
function updateMetrics(flag: FeatureFlag): void {
  // Update phase gauge
  const phaseValues: Record<RolloutPhase, number> = {
    disabled: 0,
    canary: 1,
    gradual: 2,
    full: 3,
  };

  rolloutPhaseGauge.set(
    { feature_name: flag.name, phase: flag.rolloutPhase },
    phaseValues[flag.rolloutPhase]
  );

  // Update percentage gauge
  rolloutPercentageGauge.set({ feature_name: flag.name }, flag.rolloutPercentage);

  // Update enabled gauge
  featureFlagEnabledGauge.set({ feature_name: flag.name }, flag.enabled ? 1 : 0);

  // Update health gauge based on current phase
  const metrics = rolloutMetrics.get(flag.name);
  if (metrics && flag.currentPhaseIndex >= 0) {
    const phase = flag.phases[flag.currentPhaseIndex];
    const isHealthy =
      metrics.errorRate <= phase.maxErrorRatePercent &&
      metrics.avgLatencyMs <= phase.maxLatencyMs &&
      metrics.healthCheckFails < phase.rollbackCriteria.healthCheckFails;
    rolloutHealthGauge.set(
      { feature_name: flag.name, phase: flag.rolloutPhase },
      isHealthy ? 1 : 0
    );
  } else {
    rolloutHealthGauge.set({ feature_name: flag.name, phase: flag.rolloutPhase }, 1);
  }
}

/**
 * Get rollout registry for metrics collection
 */
export function getRolloutRegistry(): Registry {
  return rolloutRegistry;
}

/**
 * Get rollout metrics for a feature
 */
export function getRolloutMetrics(featureName: string): RolloutMetrics | undefined {
  return rolloutMetrics.get(featureName);
}

/**
 * Get all rollout metrics
 */
export function getAllRolloutMetrics(): RolloutMetrics[] {
  return Array.from(rolloutMetrics.values());
}

// ============== RPC Handlers ==============

/**
 * Register RPC handlers for progressive rollout
 */
export function registerProgressiveRollout(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/rollout_create_flag', rpcCreateFeatureFlag);
  initializer.registerRpc('armored_archer/rollout_update_flag', rpcUpdateFeatureFlag);
  initializer.registerRpc('armored_archer/rollout_list_flags', rpcListFeatureFlags);
  initializer.registerRpc('armored_archer/rollout_check', rpcCheckFeatureFlag);
  initializer.registerRpc('armored_archer/rollout_advance', rpcAdvancePhase);
  initializer.registerRpc('armored_archer/rollout_rollback', rpcRollbackFeature);
  initializer.registerRpc('armored_archer/rollout_metrics', rpcGetRolloutMetrics);
  initializer.registerRpc('armored_archer/rollout_record_metrics', rpcRecordMetrics);
  initializer.registerRpc('armored_archer/rollout_health', rpcRolloutHealth);
  initializer.registerRpc('armored_archer/rollout_metrics_prometheus', rpcPrometheusMetrics);
}

/**
 * RPC: Create a new feature flag
 */
async function rpcCreateFeatureFlag(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Creating feature flag');

  const validation = validatePayload(
    ZodSchemas.rollout_create_flag,
    payload,
    'rollout_create_flag'
  );
  if (!validation.success) {
    return createValidationErrorResponse('rollout_create_flag', validation.error);
  }

  const { name, description, phases } = validation.data;

  // Check if flag already exists
  if (featureFlags.has(name)) {
    return JSON.stringify({
      success: false,
      error: `Feature flag '${name}' already exists`,
    });
  }

  const flag = createFeatureFlag(name, description, phases);

  logger.info(`Feature flag created: ${name}`);

  return JSON.stringify({
    success: true,
    featureFlag: flag,
  });
}

/**
 * RPC: Update feature flag
 */
async function rpcUpdateFeatureFlag(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Updating feature flag');

  const validation = validatePayload(
    ZodSchemas.rollout_update_flag,
    payload,
    'rollout_update_flag'
  );
  if (!validation.success) {
    return createValidationErrorResponse('rollout_update_flag', validation.error);
  }

  const { name, ...updates } = validation.data;

  const flag = updateFeatureFlag(name, updates);
  if (!flag) {
    return JSON.stringify({
      success: false,
      error: `Feature flag '${name}' not found`,
    });
  }

  logger.info(`Feature flag updated: ${name}`);

  return JSON.stringify({
    success: true,
    featureFlag: flag,
  });
}

/**
 * RPC: List all feature flags
 */
async function rpcListFeatureFlags(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  _payload: string
): Promise<string> {
  logger.info('Listing feature flags');

  const flags = getAllFeatureFlags();
  const metrics = getAllRolloutMetrics();

  return JSON.stringify({
    success: true,
    featureFlags: flags,
    metrics,
  });
}

/**
 * RPC: Check if feature is enabled for user
 */
async function rpcCheckFeatureFlag(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  const validation = validatePayload(ZodSchemas.rollout_check, payload, 'rollout_check');
  if (!validation.success) {
    return createValidationErrorResponse('rollout_check', validation.error);
  }

  const { feature_name, user_id, game_version } = validation.data;

  const enabled = isFeatureEnabled(feature_name, user_id, game_version);
  const flag = featureFlags.get(feature_name);

  return JSON.stringify({
    success: true,
    feature_name,
    enabled,
    rollout_phase: flag?.rolloutPhase || 'disabled',
    rollout_percentage: flag?.rolloutPercentage || 0,
  });
}

/**
 * RPC: Advance to next rollout phase
 */
async function rpcAdvancePhase(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Advancing rollout phase');

  const validation = validatePayload(ZodSchemas.rollout_advance, payload, 'rollout_advance');
  if (!validation.success) {
    return createValidationErrorResponse('rollout_advance', validation.error);
  }

  const { feature_name } = validation.data;

  const flag = advancePhase(feature_name);
  if (!flag) {
    return JSON.stringify({
      success: false,
      error: `Feature flag '${feature_name}' not found`,
    });
  }

  logger.info(`Rollout phase advanced for ${feature_name}: ${flag.rolloutPhase}`);

  return JSON.stringify({
    success: true,
    featureFlag: flag,
  });
}

/**
 * RPC: Rollback feature to previous phase
 */
async function rpcRollbackFeature(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Rolling back feature');

  const validation = validatePayload(ZodSchemas.rollout_rollback, payload, 'rollout_rollback');
  if (!validation.success) {
    return createValidationErrorResponse('rollout_rollback', validation.error);
  }

  const { feature_name } = validation.data;

  const flag = rollbackFeature(feature_name);
  if (!flag) {
    return JSON.stringify({
      success: false,
      error: `Feature flag '${feature_name}' not found`,
    });
  }

  logger.info(`Rollback executed for ${feature_name}: ${flag.rolloutPhase}`);

  return JSON.stringify({
    success: true,
    featureFlag: flag,
  });
}

/**
 * RPC: Get rollout metrics for a feature
 */
async function rpcGetRolloutMetrics(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Getting rollout metrics');

  const validation = validatePayload(
    ZodSchemas.rollout_get_metrics,
    payload,
    'rollout_get_metrics'
  );
  if (!validation.success) {
    return createValidationErrorResponse('rollout_get_metrics', validation.error);
  }

  const { feature_name } = validation.data;

  const metrics = getRolloutMetrics(feature_name);
  if (!metrics) {
    return JSON.stringify({
      success: false,
      error: `No metrics found for '${feature_name}'`,
    });
  }

  // Also check rollback criteria
  const rollbackCheck = checkRollbackCriteria(feature_name);

  return JSON.stringify({
    success: true,
    metrics,
    rollback_check: rollbackCheck,
  });
}

/**
 * RPC: Record rollout metrics
 */
async function rpcRecordMetrics(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  const validation = validatePayload(
    ZodSchemas.rollout_record_metrics,
    payload,
    'rollout_record_metrics'
  );
  if (!validation.success) {
    return createValidationErrorResponse('rollout_record_metrics', validation.error);
  }

  const {
    feature_name,
    total_users,
    active_users,
    error_count,
    error_rate,
    avg_latency_ms,
    p99_latency_ms,
    health_check_passes,
    health_check_fails,
  } = validation.data;

  recordRolloutMetrics(feature_name, {
    totalUsers: total_users,
    activeUsers: active_users,
    errorCount: error_count,
    errorRate: error_rate,
    avgLatencyMs: avg_latency_ms,
    p99LatencyMs: p99_latency_ms,
    healthCheckPasses: health_check_passes,
    healthCheckFails: health_check_fails,
  });

  // Update Prometheus counters
  if (total_users) {
    rolloutUsersTotal.inc(
      { feature_name, phase: rolloutMetrics.get(feature_name)?.phase || 'disabled' },
      total_users
    );
  }
  if (error_count) {
    rolloutErrorsTotal.inc(
      {
        feature_name,
        phase: rolloutMetrics.get(feature_name)?.phase || 'disabled',
        error_type: 'total',
      },
      error_count
    );
  }
  if (avg_latency_ms) {
    rolloutLatencyHistogram.observe(
      { feature_name, phase: rolloutMetrics.get(feature_name)?.phase || 'disabled' },
      avg_latency_ms
    );
  }

  // Check rollback criteria after recording metrics
  const rollbackCheck = checkRollbackCriteria(feature_name);

  return JSON.stringify({
    success: true,
    feature_name,
    rollback_triggered: rollbackCheck.shouldRollback,
    rollback_reason: rollbackCheck.reason,
  });
}

/**
 * RPC: Get overall rollout health
 */
async function rpcRolloutHealth(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  _payload: string
): Promise<string> {
  logger.info('Rollout health check');

  const flags = getAllFeatureFlags();
  const metrics = getAllRolloutMetrics();

  // Calculate overall health
  let allHealthy = true;
  const featureHealth: Record<string, boolean> = {};

  for (const flag of flags) {
    if (flag.enabled && flag.currentPhaseIndex >= 0) {
      // Find metrics for this flag (used for potential future health checks)
      metrics.find((m) => m.featureName === flag.name);
      const rollbackCheck = checkRollbackCriteria(flag.name);
      featureHealth[flag.name] = !rollbackCheck.shouldRollback;
      if (rollbackCheck.shouldRollback) {
        allHealthy = false;
      }
    } else {
      featureHealth[flag.name] = true;
    }
  }

  return JSON.stringify({
    status: allHealthy ? 'healthy' : 'unhealthy',
    environment: config.environment,
    timestamp: Date.now(),
    features: featureHealth,
  });
}

/**
 * RPC: Get rollout metrics in Prometheus format
 */
async function rpcPrometheusMetrics(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  _payload: string
): Promise<string> {
  logger.info('Prometheus metrics requested');

  const metrics = await rolloutRegistry.metrics();

  return metrics;
}

// ============== Initialization ==============

/**
 * Initialize progressive rollout with default feature flags
 */
export function initializeProgressiveRollout(logger: Runtime.Logger): void {
  // Create default feature flags for common game features
  const defaultFlags: Array<{ name: string; description: string; phases: RolloutPhaseConfig[] }> = [
    {
      name: 'new_combat_system',
      description: 'Updated combat mechanics and damage calculations',
      phases: [
        {
          phase: 'canary',
          percentage: 5,
          durationMinutes: 60,
          minHealthPercent: 95,
          maxErrorRatePercent: 2,
          maxLatencyMs: 100,
          sampleSize: 100,
          autoPromote: false,
          rollbackCriteria: {
            errorRateThreshold: 5,
            latencyThreshold: 250,
            healthCheckFails: 3,
            customMetrics: {},
          },
        },
        {
          phase: 'gradual',
          percentage: 25,
          durationMinutes: 120,
          minHealthPercent: 95,
          maxErrorRatePercent: 1,
          maxLatencyMs: 100,
          sampleSize: 500,
          autoPromote: false,
          rollbackCriteria: {
            errorRateThreshold: 3,
            latencyThreshold: 200,
            healthCheckFails: 2,
            customMetrics: {},
          },
        },
        {
          phase: 'gradual',
          percentage: 50,
          durationMinutes: 240,
          minHealthPercent: 98,
          maxErrorRatePercent: 1,
          maxLatencyMs: 100,
          sampleSize: 1000,
          autoPromote: false,
          rollbackCriteria: {
            errorRateThreshold: 2,
            latencyThreshold: 150,
            healthCheckFails: 2,
            customMetrics: {},
          },
        },
        {
          phase: 'full',
          percentage: 100,
          durationMinutes: 0,
          minHealthPercent: 99,
          maxErrorRatePercent: 0.5,
          maxLatencyMs: 100,
          sampleSize: 0,
          autoPromote: false,
          rollbackCriteria: {
            errorRateThreshold: 1,
            latencyThreshold: 100,
            healthCheckFails: 1,
            customMetrics: {},
          },
        },
      ],
    },
  ];

  for (const flagDef of defaultFlags) {
    if (!featureFlags.has(flagDef.name)) {
      createFeatureFlag(flagDef.name, flagDef.description, flagDef.phases);
    }
  }

  logger.info(
    `[ProgressiveRollout] Initialized ${featureFlags.size} feature flags for environment: ${config.environment}`
  );
}
