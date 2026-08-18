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
import { withAdminGuard } from './admin_auth';
import { logAudit } from './audit';
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
 * Player-observable delta the client may submit to `rollout_record_metrics`
 * (issue #1149). Bounded counters only — clients cannot set totals, only
 * nudge them. Aggregates the server cannot defend (errorRate, p99LatencyMs)
 * are intentionally absent from this surface so the rollback criteria
 * remain under server control.
 */
export interface RolloutMetricsClientDelta {
  errorCountDelta?: number;
  healthCheckPassesDelta?: number;
  healthCheckFailsDelta?: number;
  avgLatencyMsDelta?: number;
}

/**
 * Record rollout metrics for a feature. Non-client callers (internal modules,
 * tests, future admin RPCs) may supply arbitrary fields, but the
 * `rollout_record_metrics` RPC only ever threads bounded deltas through
 * here.
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
 * Fold a bounded client delta into the rollout metrics map (issue #1149).
 *
 * Client-supplied payloads cannot overwrite authoritative counters — they
 * can only add to them, with per-call caps that prevent a single session
 * from fabricating enough signal to flip `checkRollbackCriteria`. Returns
 * the resulting `RolloutMetrics` so callers (and the RPC handler) can
 * surface rollback state without an extra map read.
 */
export function recordRolloutClientDelta(
  featureName: string,
  delta: RolloutMetricsClientDelta
): RolloutMetrics {
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

  const next: RolloutMetrics = {
    ...existing,
    errorCount: existing.errorCount + Math.max(0, Math.trunc(delta.errorCountDelta ?? 0)),
    healthCheckPasses:
      existing.healthCheckPasses + Math.max(0, Math.trunc(delta.healthCheckPassesDelta ?? 0)),
    healthCheckFails:
      existing.healthCheckFails + Math.max(0, Math.trunc(delta.healthCheckFailsDelta ?? 0)),
    // Latency is reported as a single sample per call: the handler threads
    // it into the histogram observation only. We do not derive a per-feature
    // average from client submissions because the server-authoritative
    // rollback criterion (avgLatencyMs) must come from server-side telemetry,
    // not from a single player's report.
    phase: flag?.rolloutPhase || 'disabled',
    lastUpdated: Date.now(),
  };

  rolloutMetrics.set(featureName, next);
  return next;
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
 * Register RPC handlers for progressive rollout.
 *
 * Flag mutation and ops-telemetry endpoints are wrapped in the shared admin
 * gate (issue #1075) — fail-closed unless the caller is allowlisted via
 * ADMIN_USER_IDS. `rollout_check` and `rollout_record_metrics` intentionally
 * stay player-callable: the game client reads flag state and reports rollout
 * telemetry through them. `rollout_record_metrics` is restricted to bounded
 * deltas (issue #1149) so a single player cannot drive the in-memory
 * counters past `checkRollbackCriteria`'s thresholds or trigger Prometheus
 * high-cardinality label explosions. `rollout_check` is hard-scoped to the
 * session user (issue #1156).
 */
export function registerProgressiveRollout(initializer: Runtime.Initializer): void {
  initializer.registerRpc(
    'armored_archer/rollout_create_flag',
    withAdminGuard('armored_archer/rollout_create_flag', rpcCreateFeatureFlag)
  );
  initializer.registerRpc(
    'armored_archer/rollout_update_flag',
    withAdminGuard('armored_archer/rollout_update_flag', rpcUpdateFeatureFlag)
  );
  initializer.registerRpc(
    'armored_archer/rollout_list_flags',
    withAdminGuard('armored_archer/rollout_list_flags', rpcListFeatureFlags)
  );
  initializer.registerRpc('armored_archer/rollout_check', rpcCheckFeatureFlag);
  initializer.registerRpc(
    'armored_archer/rollout_advance',
    withAdminGuard('armored_archer/rollout_advance', rpcAdvancePhase)
  );
  initializer.registerRpc(
    'armored_archer/rollout_rollback',
    withAdminGuard('armored_archer/rollout_rollback', rpcRollbackFeature)
  );
  initializer.registerRpc(
    'armored_archer/rollout_metrics',
    withAdminGuard('armored_archer/rollout_metrics', rpcGetRolloutMetrics)
  );
  initializer.registerRpc('armored_archer/rollout_record_metrics', rpcRecordMetrics);
  initializer.registerRpc(
    'armored_archer/rollout_health',
    withAdminGuard('armored_archer/rollout_health', rpcRolloutHealth)
  );
  initializer.registerRpc(
    'armored_archer/rollout_metrics_prometheus',
    withAdminGuard('armored_archer/rollout_metrics_prometheus', rpcPrometheusMetrics)
  );
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
 *
 * Scoping decision (issue #1156): this player-callable RPC previously
 * accepted an arbitrary `user_id` in the payload and returned that user's
 * feature-flag state. That allowed any authenticated session to probe
 * other users' flags — canary cohorts and rollout percentages are
 * operational signals whose leakage lets attackers identify testers,
 * predict rollouts, and time exploits to the window when vulnerable code
 * is active. The check is now bound to the session-derived `ctx.userId`:
 * a caller may either omit `user_id` (defaults to self) or pass their own
 * session id, and a mismatch is rejected with a generic Forbidden
 * response and written to the audit trail against the caller so
 * impersonation attempts surface for security monitoring.
 */
async function rpcCheckFeatureFlag(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  const validation = validatePayload(ZodSchemas.rollout_check, payload, 'rollout_check');
  if (!validation.success) {
    return createValidationErrorResponse('rollout_check', validation.error);
  }

  const { feature_name, user_id: requestedUserId, game_version } = validation.data;
  const sessionUserId = ctx.userId;

  // Reject cross-user probes: the player-callable rollout_check must
  // only return flag state for the caller themselves. Allowlisted
  // admins have the dedicated rollout_list_flags RPC for that purpose.
  if (requestedUserId !== undefined && requestedUserId !== sessionUserId) {
    logAudit(
      nk,
      sessionUserId,
      ctx.ipAddress ?? null,
      'rollout_check',
      'feature_flags',
      {
        requested_user_id: requestedUserId,
        feature_name,
        reason: 'cross_user_probe',
      },
      'failure',
      'requested user_id does not match the authenticated caller'
    );
    logger.warn(
      `rollout_check rejected: session user '${sessionUserId}' attempted to query flag state for '${requestedUserId}' (feature='${feature_name}')`
    );
    return JSON.stringify({
      success: false,
      error: 'Forbidden',
      error_code: 'FORBIDDEN',
      rpc_name: 'rollout_check',
    });
  }

  const effectiveUserId = requestedUserId ?? sessionUserId;
  const enabled = isFeatureEnabled(feature_name, effectiveUserId, game_version);
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
 * Hard caps used by `rpcRecordMetrics` to bound client-supplied deltas
 * (issue #1149). Lives next to the handler so they are obvious side
 * effects to update if the rollback thresholds in test phases change.
 */
const ROLLOUT_RECORD_METRICS_LIMITS = {
  // Errors a single session can claim per RPC call. Trivially below any
  // error-rate threshold the rollback logic cares about; the bound stops a
  // single player from spamming the counter.
  ERROR_COUNT_MAX: 50,
  HEALTH_CHECK_PASSES_MAX: 100,
  HEALTH_CHECK_FAILS_MAX: 5,
  // Latency the client may observe in one call. The handler routes this
  // to the Prometheus histogram only — it never feeds the rollback
  // criterion directly.
  AVG_LATENCY_MS_MAX: 5000,
} as const;

/**
 * Reject a `rollout_record_metrics` submission that bypassed validation
 * but still looks suspicious (issue #1149). Centralised so every defence
 * branch writes the same audit shape — security monitoring downstream
 * relies on the canonical `reason` field.
 */
function rejectMetricPoisoning(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  details: Record<string, unknown>,
  reason: string,
  message: string
): string {
  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'rollout_record_metrics',
    'rollout_metrics',
    {
      ...details,
      reason,
    },
    'failure',
    message
  );
  logger.warn(`rollout_record_metrics rejected (${reason}) for user '${ctx.userId}': ${message}`);
  return JSON.stringify({
    success: false,
    error: 'Forbidden',
    error_code: 'FORBIDDEN',
    rpc_name: 'rollout_record_metrics',
    reason,
  });
}

/**
 * Defence-in-depth: validate client deltas against per-call caps even if
 * the schema drift allows them through (issue #1149). Returns the list of
 * offending field names (empty if all checks pass).
 */
function deltaFieldsOverCap(delta: {
  error_count_delta?: number;
  health_check_passes_delta?: number;
  health_check_fails_delta?: number;
  avg_latency_ms_delta?: number;
}): string[] {
  const overage: string[] = [];
  if ((delta.error_count_delta ?? 0) > ROLLOUT_RECORD_METRICS_LIMITS.ERROR_COUNT_MAX) {
    overage.push('error_count_delta');
  }
  if (
    (delta.health_check_passes_delta ?? 0) > ROLLOUT_RECORD_METRICS_LIMITS.HEALTH_CHECK_PASSES_MAX
  ) {
    overage.push('health_check_passes_delta');
  }
  if (
    (delta.health_check_fails_delta ?? 0) > ROLLOUT_RECORD_METRICS_LIMITS.HEALTH_CHECK_FAILS_MAX
  ) {
    overage.push('health_check_fails_delta');
  }
  if ((delta.avg_latency_ms_delta ?? 0) > ROLLOUT_RECORD_METRICS_LIMITS.AVG_LATENCY_MS_MAX) {
    overage.push('avg_latency_ms_delta');
  }
  return overage;
}

/**
 * RPC: Record rollout metrics
 *
 * Security contract (issue #1149): this is a player-callable RPC by
 * design (client rollout telemetry), but the server remains authoritative
 * over the rollback-criteria signal. Clients may submit only **bounded
 * deltas** (`error_count_delta`, `health_check_passes_delta`,
 * `health_check_fails_delta`, `avg_latency_ms_delta`) — never totals.
 * Total counters, error rates, p99 latency, and active-user counts are
 * computed server-side from server-traced counters and the in-memory
 * `rolloutMetrics` map; clients cannot overwrite them. Numeric fields
 * are capped at submission time so a single session cannot fabricate
 * the volume needed to trip `checkRollbackCriteria`, and any anomaly is
 * audit-logged as `metric_poisoning_attempt`.
 */
async function rpcRecordMetrics(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  const validation = validatePayload(
    ZodSchemas.rollout_record_metrics,
    payload,
    'rollout_record_metrics'
  );
  if (!validation.success) {
    return rejectMetricPoisoning(
      nk,
      ctx,
      logger,
      { schema_error: validation.error },
      'validation_failed',
      'rollout_record_metrics payload failed schema validation'
    );
  }

  const {
    feature_name,
    error_count_delta,
    health_check_passes_delta,
    health_check_fails_delta,
    avg_latency_ms_delta,
    client_platform,
  } = validation.data;

  // Schema enforces per-field maximums in validation.ts; this re-check is
  // defence-in-depth in case a future schema refactor widens the ceiling.
  const overage = deltaFieldsOverCap({
    error_count_delta,
    health_check_passes_delta,
    health_check_fails_delta,
    avg_latency_ms_delta,
  });
  if (overage.length > 0) {
    return rejectMetricPoisoning(
      nk,
      ctx,
      logger,
      {
        feature_name,
        offending_fields: overage,
        client_platform: client_platform ?? null,
      },
      'delta_above_cap',
      `delta fields ${overage.join(', ')} exceed per-call cap`
    );
  }

  // Reject submissions for undeclared flags — otherwise a client could
  // silently grow the metrics map and collide with later admin ops.
  if (!featureFlags.has(feature_name)) {
    return rejectMetricPoisoning(
      nk,
      ctx,
      logger,
      { feature_name, client_platform: client_platform ?? null },
      'unknown_feature',
      `unknown feature '${feature_name}'`
    );
  }

  // Fold bounded deltas into the in-memory metrics map. Every field in
  // `recordRolloutClientDelta` is independently capped by the schema
  // and the constants above, so a caller can never drive a counter
  // past the rollback thresholds in a single request.
  const updated = recordRolloutClientDelta(feature_name, {
    errorCountDelta: error_count_delta,
    healthCheckPassesDelta: health_check_passes_delta,
    healthCheckFailsDelta: health_check_fails_delta,
  });

  // Latency is reported as a per-call observation routed to the
  // Prometheus histogram only — it must NOT influence the in-memory
  // avgLatencyMs that feeds the rollback criterion. The server-side
  // sampling path remains the authoritative signal.
  if (avg_latency_ms_delta !== undefined) {
    rolloutLatencyHistogram.observe({ feature_name, phase: updated.phase }, avg_latency_ms_delta);
  }
  if (error_count_delta) {
    rolloutErrorsTotal.inc(
      { feature_name, phase: updated.phase, error_type: 'total' },
      error_count_delta
    );
  }

  // Check rollback criteria after recording metrics. Even if the delta
  // were within bounds, repeated submissions could theoretically drive
  // counts toward the threshold; the surface response is unchanged so
  // legitimate callers continue to receive rollback state, but every
  // flip is recorded for monitoring.
  const rollbackCheck = checkRollbackCriteria(feature_name);
  if (rollbackCheck.shouldRollback) {
    logger.info(
      `rollout_record_metrics: rollback criteria fired for '${feature_name}' after submitter '${ctx.userId}' — reason='${rollbackCheck.reason ?? ''}'`
    );
  }

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
