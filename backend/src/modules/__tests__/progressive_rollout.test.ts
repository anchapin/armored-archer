/**
 * Progressive Rollout Tests
 *
 * These tests verify that the progressive rollout module works correctly.
 */

import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import { Runtime } from '../../types/nakama';
import {
  registerProgressiveRollout,
  createFeatureFlag,
  updateFeatureFlag,
  getFeatureFlag,
  getAllFeatureFlags,
  isFeatureEnabled,
  advancePhase,
  rollbackFeature,
  checkRollbackCriteria,
  recordRolloutMetrics,
  getRolloutMetrics,
  getAllRolloutMetrics,
  initializeProgressiveRollout,
  RolloutPhase,
} from '../progressive_rollout';

// Mock config
jest.mock('../../config', () => ({
  config: {
    environment: 'development',
  },
}));

// Mock validation module - parse JSON payload and return as data
jest.mock('../validation', () => ({
  validatePayload: jest.fn((_schema: unknown, payload: string) => {
    try {
      const data = payload === '' ? {} : JSON.parse(payload);
      return { success: true, data };
    } catch {
      return { success: false, error: 'Invalid JSON' };
    }
  }),
  ZodSchemas: {},
  createValidationErrorResponse: jest.fn(
    (rpcName: string, error: string) =>
      JSON.stringify({ success: false, error })
  ),
}));

const createPhaseConfig = (overrides = {}) => ({
  phase: 'canary' as const,
  percentage: 5,
  durationMinutes: 60,
  minHealthPercent: 95,
  maxErrorRatePercent: 2,
  maxLatencyMs: 100,
  sampleSize: 100,
  autoPromote: false,
  rollbackCriteria: { errorRateThreshold: 5, latencyThreshold: 250, healthCheckFails: 3 },
  ...overrides,
});

describe('Progressive Rollout', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  const testPhases: RolloutPhase[] = [
    createPhaseConfig(),
    createPhaseConfig({
      phase: 'gradual',
      percentage: 25,
      durationMinutes: 120,
      maxErrorRatePercent: 1,
      rollbackCriteria: { errorRateThreshold: 3, latencyThreshold: 200, healthCheckFails: 2 },
    }),
    createPhaseConfig({
      phase: 'full',
      percentage: 100,
      durationMinutes: 0,
      minHealthPercent: 99,
      maxErrorRatePercent: 0.5,
      rollbackCriteria: { errorRateThreshold: 1, latencyThreshold: 100, healthCheckFails: 1 },
    }),
  ];

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'rollout-test-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  describe('createFeatureFlag', () => {
    it('creates flag with correct defaults (disabled, 0%, currentPhaseIndex=-1)', () => {
      const flag = createFeatureFlag('test_feature', 'Test feature', testPhases);

      expect(flag.name).toBe('test_feature');
      expect(flag.description).toBe('Test feature');
      expect(flag.enabled).toBe(true);
      expect(flag.rolloutPhase).toBe('disabled');
      expect(flag.rolloutPercentage).toBe(0);
      expect(flag.currentPhaseIndex).toBe(-1);
      expect(flag.phases.length).toBe(3);
      expect(flag.canaryUserIds).toEqual([]);
      expect(flag.createdAt).toBeGreaterThan(0);
      expect(flag.updatedAt).toBeGreaterThan(0);
    });
  });

  describe('getFeatureFlag', () => {
    it('returns created flag', () => {
      createFeatureFlag('lookup_test', 'Lookup test', testPhases);
      const flag = getFeatureFlag('lookup_test');

      expect(flag).toBeDefined();
      expect(flag?.name).toBe('lookup_test');
    });

    it('returns undefined for unknown name', () => {
      const flag = getFeatureFlag('does_not_exist');
      expect(flag).toBeUndefined();
    });
  });

  describe('getAllFeatureFlags', () => {
    it('returns all created flags', () => {
      createFeatureFlag('flag_a', 'Flag A', testPhases);
      createFeatureFlag('flag_b', 'Flag B', testPhases);

      const all = getAllFeatureFlags();
      const names = all.map((f) => f.name);
      expect(names).toContain('flag_a');
      expect(names).toContain('flag_b');
    });
  });

  describe('isFeatureEnabled', () => {
    it('returns false for disabled phase', () => {
      createFeatureFlag('disabled_phase', 'Disabled phase', testPhases);
      // flag starts in 'disabled' rolloutPhase
      expect(isFeatureEnabled('disabled_phase', 'user123')).toBe(false);
    });

    it('returns false for disabled flag even if rolloutPhase is set', () => {
      createFeatureFlag('disabled_flag', 'Disabled flag', testPhases);
      updateFeatureFlag('disabled_flag', {
        enabled: false,
        rolloutPhase: 'full',
        rolloutPercentage: 100,
      });
      expect(isFeatureEnabled('disabled_flag', 'user123')).toBe(false);
    });

    it('returns true for canary user in canary phase', () => {
      createFeatureFlag('canary_user', 'Canary user', testPhases);
      updateFeatureFlag('canary_user', {
        rolloutPhase: 'canary',
        canaryUserIds: ['user123'],
      });
      expect(isFeatureEnabled('canary_user', 'user123')).toBe(true);
    });

    it('returns false for non-canary user in canary phase', () => {
      createFeatureFlag('canary_reject', 'Canary reject', testPhases);
      updateFeatureFlag('canary_reject', {
        rolloutPhase: 'canary',
        canaryUserIds: ['user123'],
      });
      expect(isFeatureEnabled('canary_reject', 'user456')).toBe(false);
    });

    it('returns true when gameVersion is in canary version range', () => {
      createFeatureFlag('canary_ver', 'Canary ver', testPhases);
      updateFeatureFlag('canary_ver', {
        rolloutPhase: 'canary',
        canaryUserIds: [],
        canaryVersionMin: '1.0.0',
        canaryVersionMax: '2.0.0',
      });
      expect(isFeatureEnabled('canary_ver', 'any_user', '1.5.0')).toBe(true);
    });

    it('returns true for full phase', () => {
      createFeatureFlag('full_roll', 'Full roll', testPhases);
      updateFeatureFlag('full_roll', {
        rolloutPhase: 'full',
        rolloutPercentage: 100,
      });
      expect(isFeatureEnabled('full_roll', 'user1')).toBe(true);
      expect(isFeatureEnabled('full_roll', 'user2')).toBe(true);
    });

    it('gradual phase provides hash-based consistency (same user always same result)', () => {
      createFeatureFlag('gradual_consist', 'Gradual consist', testPhases);
      updateFeatureFlag('gradual_consist', {
        rolloutPhase: 'gradual',
        rolloutPercentage: 50,
      });

      // Same user should always get same result
      const firstResult = isFeatureEnabled('gradual_consist', 'consistent_user');
      for (let i = 0; i < 20; i++) {
        expect(isFeatureEnabled('gradual_consist', 'consistent_user')).toBe(firstResult);
      }
    });

    it('returns false for unknown feature name', () => {
      expect(isFeatureEnabled('unknown_feature', 'user123')).toBe(false);
    });
  });

  describe('updateFeatureFlag', () => {
    it('returns null for unknown name', () => {
      const result = updateFeatureFlag('non_existent', { enabled: false });
      expect(result).toBeNull();
    });

    it('updates fields correctly', () => {
      createFeatureFlag('update_me', 'Update me', testPhases);
      const updated = updateFeatureFlag('update_me', {
        rolloutPhase: 'canary',
        rolloutPercentage: 10,
        canaryUserIds: ['user1'],
      });

      expect(updated).toBeDefined();
      expect(updated?.rolloutPhase).toBe('canary');
      expect(updated?.rolloutPercentage).toBe(10);
      expect(updated?.canaryUserIds).toEqual(['user1']);
    });
  });

  describe('advancePhase', () => {
    it('advances through phases correctly', () => {
      createFeatureFlag('advance_me', 'Advance me', testPhases);

      const phase1 = advancePhase('advance_me');
      expect(phase1?.rolloutPhase).toBe('canary');
      expect(phase1?.currentPhaseIndex).toBe(0);
      expect(phase1?.rolloutPercentage).toBe(5);

      const phase2 = advancePhase('advance_me');
      expect(phase2?.rolloutPhase).toBe('gradual');
      expect(phase2?.currentPhaseIndex).toBe(1);
      expect(phase2?.rolloutPercentage).toBe(25);

      const phase3 = advancePhase('advance_me');
      expect(phase3?.rolloutPhase).toBe('full');
      expect(phase3?.currentPhaseIndex).toBe(2);
      expect(phase3?.rolloutPercentage).toBe(100);
    });

    it('returns current flag unchanged at final phase', () => {
      createFeatureFlag('at_max', 'At max', testPhases);
      advancePhase('at_max');
      advancePhase('at_max');
      advancePhase('at_max');

      const result = advancePhase('at_max');
      expect(result).toBeDefined();
      expect(result?.currentPhaseIndex).toBe(2);
      expect(result?.rolloutPhase).toBe('full');
    });

    it('returns null for unknown name', () => {
      const result = advancePhase('nonexistent_flag');
      expect(result).toBeNull();
    });
  });

  describe('rollbackFeature', () => {
    it('disables when rolling back from first phase', () => {
      createFeatureFlag('rb_first', 'RB first', testPhases);
      advancePhase('rb_first'); // canary (index 0)

      const rolledBack = rollbackFeature('rb_first');
      expect(rolledBack?.rolloutPhase).toBe('disabled');
      expect(rolledBack?.currentPhaseIndex).toBe(-1);
      expect(rolledBack?.rolloutPercentage).toBe(0);
    });

    it('goes to previous phase when rolling back from later phase', () => {
      createFeatureFlag('rb_later', 'RB later', testPhases);
      advancePhase('rb_later');
      advancePhase('rb_later'); // gradual (index 1)

      const rolledBack = rollbackFeature('rb_later');
      expect(rolledBack?.rolloutPhase).toBe('canary');
      expect(rolledBack?.currentPhaseIndex).toBe(0);
      expect(rolledBack?.rolloutPercentage).toBe(5);
    });

    it('returns null for unknown name', () => {
      const result = rollbackFeature('nonexistent_rb');
      expect(result).toBeNull();
    });
  });

  describe('checkRollbackCriteria', () => {
    it('returns shouldRollback false when flag does not exist', () => {
      const result = checkRollbackCriteria('no_such_flag');
      expect(result.shouldRollback).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('returns shouldRollback true when error rate exceeds threshold', () => {
      createFeatureFlag('err_rate', 'Err rate', testPhases);
      advancePhase('err_rate'); // canary, errorRateThreshold: 5

      recordRolloutMetrics('err_rate', {
        errorRate: 10,
        avgLatencyMs: 50,
        healthCheckFails: 1,
      });

      const result = checkRollbackCriteria('err_rate');
      expect(result.shouldRollback).toBe(true);
      expect(result.reason).toContain('Error rate');
    });

    it('returns shouldRollback true when latency exceeds threshold', () => {
      createFeatureFlag('lat_check', 'Lat check', testPhases);
      advancePhase('lat_check'); // canary, latencyThreshold: 250

      recordRolloutMetrics('lat_check', {
        errorRate: 1,
        avgLatencyMs: 300,
        healthCheckFails: 1,
      });

      const result = checkRollbackCriteria('lat_check');
      expect(result.shouldRollback).toBe(true);
      expect(result.reason).toContain('latency');
    });

    it('returns shouldRollback true when health check fails exceed threshold', () => {
      createFeatureFlag('health_fail', 'Health fail', testPhases);
      advancePhase('health_fail'); // canary, healthCheckFails: 3

      recordRolloutMetrics('health_fail', {
        errorRate: 1,
        avgLatencyMs: 50,
        healthCheckFails: 5,
      });

      const result = checkRollbackCriteria('health_fail');
      expect(result.shouldRollback).toBe(true);
      expect(result.reason).toContain('Health check failures');
    });
  });

  describe('recordRolloutMetrics and getRolloutMetrics', () => {
    it('records and retrieves metrics for a feature', () => {
      createFeatureFlag('metrics_feat', 'Metrics feat', testPhases);
      advancePhase('metrics_feat');

      recordRolloutMetrics('metrics_feat', {
        totalUsers: 200,
        activeUsers: 150,
        errorCount: 3,
        errorRate: 1.5,
        avgLatencyMs: 42,
        p99LatencyMs: 200,
        healthCheckPasses: 147,
        healthCheckFails: 1,
      });

      const metrics = getRolloutMetrics('metrics_feat');
      expect(metrics).toBeDefined();
      expect(metrics?.totalUsers).toBe(200);
      expect(metrics?.activeUsers).toBe(150);
      expect(metrics?.errorCount).toBe(3);
      expect(metrics?.errorRate).toBe(1.5);
      expect(metrics?.avgLatencyMs).toBe(42);
      expect(metrics?.p99LatencyMs).toBe(200);
      expect(metrics?.healthCheckPasses).toBe(147);
      expect(metrics?.healthCheckFails).toBe(1);
      expect(metrics?.phase).toBe('canary');
    });

    it('returns undefined for unknown feature metrics', () => {
      const metrics = getRolloutMetrics('unknown_feature_metrics');
      expect(metrics).toBeUndefined();
    });

    it('getAllRolloutMetrics returns all recorded metrics', () => {
      createFeatureFlag('gm_1', 'GM 1', testPhases);
      createFeatureFlag('gm_2', 'GM 2', testPhases);

      recordRolloutMetrics('gm_1', { totalUsers: 100 });
      recordRolloutMetrics('gm_2', { totalUsers: 200 });

      const all = getAllRolloutMetrics();
      const names = all.map((m) => m.featureName);
      expect(names).toContain('gm_1');
      expect(names).toContain('gm_2');
    });
  });

  describe('registerProgressiveRollout', () => {
    it('registers all rollout RPC endpoints', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      } as unknown as Runtime.Initializer;

      registerProgressiveRollout(mockInitializer);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/rollout_create_flag',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/rollout_update_flag',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/rollout_list_flags',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/rollout_check',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/rollout_advance',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/rollout_rollback',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/rollout_metrics',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/rollout_record_metrics',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/rollout_health',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/rollout_metrics_prometheus',
        expect.any(Function)
      );
    });
  });

  describe('initializeProgressiveRollout', () => {
    it('initializes with default feature flags', () => {
      initializeProgressiveRollout(mockLogger);

      const flags = getAllFeatureFlags();
      expect(flags.length).toBeGreaterThan(0);
      expect(flags.some((f) => f.name === 'new_combat_system')).toBe(true);
    });
  });

  describe('RPC Handlers', () => {
    let registeredHandlers: Map<string, Function>;

    beforeEach(() => {
      registeredHandlers = new Map();
      const mockInitializer = {
        registerRpc: jest.fn((name: string, handler: Function) => {
          registeredHandlers.set(name, handler);
        }),
      } as unknown as Runtime.Initializer;

      registerProgressiveRollout(mockInitializer);
    });

    it('rpcCreateFeatureFlag creates a flag via RPC', async () => {
      const handler = registeredHandlers.get('armored_archer/rollout_create_flag')!;
      const payload = JSON.stringify({
        name: 'rpc_test_flag',
        description: 'RPC test',
        phases: testPhases,
      });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.featureFlag.name).toBe('rpc_test_flag');
    });

    it('rpcCreateFeatureFlag rejects duplicate flag names', async () => {
      const handler = registeredHandlers.get('armored_archer/rollout_create_flag')!;
      const payload = JSON.stringify({
        name: 'dup_rpc_flag',
        description: 'Duplicate',
        phases: testPhases,
      });

      await handler(mockCtx, mockLogger, mockNk, payload);
      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('rpcCreateFeatureFlag returns validation error for invalid payload', async () => {
      const handler = registeredHandlers.get('armored_archer/rollout_create_flag')!;
      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, 'not json'));
      expect(result.success).toBe(false);
    });

    it('rpcUpdateFeatureFlag updates a flag via RPC', async () => {
      createFeatureFlag('rpc_update', 'RPC update', testPhases);
      const handler = registeredHandlers.get('armored_archer/rollout_update_flag')!;
      const payload = JSON.stringify({
        name: 'rpc_update',
        enabled: false,
      });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.featureFlag.enabled).toBe(false);
    });

    it('rpcUpdateFeatureFlag returns error for non-existent flag', async () => {
      const handler = registeredHandlers.get('armored_archer/rollout_update_flag')!;
      const payload = JSON.stringify({ name: 'nonexistent_rpc' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rpcListFeatureFlags lists all flags', async () => {
      createFeatureFlag('list_t1', 'List T1', testPhases);
      createFeatureFlag('list_t2', 'List T2', testPhases);
      const handler = registeredHandlers.get('armored_archer/rollout_list_flags')!;

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, ''));
      expect(result.success).toBe(true);
      expect(result.featureFlags.length).toBeGreaterThanOrEqual(2);
    });

    it('rpcCheckFeatureFlag checks feature enabled status', async () => {
      createFeatureFlag('rpc_check', 'RPC check', testPhases);
      updateFeatureFlag('rpc_check', { rolloutPhase: 'full', rolloutPercentage: 100 });
      const handler = registeredHandlers.get('armored_archer/rollout_check')!;
      const payload = JSON.stringify({
        feature_name: 'rpc_check',
        user_id: 'test_user',
      });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(result.rollout_phase).toBe('full');
    });

    it('rpcCheckFeatureFlag returns false for disabled feature', async () => {
      createFeatureFlag('rpc_chk_dis', 'RPC chk dis', testPhases);
      const handler = registeredHandlers.get('armored_archer/rollout_check')!;
      const payload = JSON.stringify({
        feature_name: 'rpc_chk_dis',
        user_id: 'test_user',
      });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false);
    });

    it('rpcCheckFeatureFlag returns disabled phase for non-existent feature', async () => {
      const handler = registeredHandlers.get('armored_archer/rollout_check')!;
      const payload = JSON.stringify({
        feature_name: 'does_not_exist_rpc',
        user_id: 'test_user',
      });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false);
      expect(result.rollout_phase).toBe('disabled');
    });

    it('rpcAdvancePhase advances a flag phase via RPC', async () => {
      createFeatureFlag('rpc_adv', 'RPC adv', testPhases);
      const handler = registeredHandlers.get('armored_archer/rollout_advance')!;
      const payload = JSON.stringify({ feature_name: 'rpc_adv' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.featureFlag.rolloutPhase).toBe('canary');
    });

    it('rpcAdvancePhase returns error for non-existent flag', async () => {
      const handler = registeredHandlers.get('armored_archer/rollout_advance')!;
      const payload = JSON.stringify({ feature_name: 'nonexistent_advance' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rpcRollbackFeature rolls back a flag via RPC', async () => {
      createFeatureFlag('rpc_rb', 'RPC rb', testPhases);
      advancePhase('rpc_rb');
      advancePhase('rpc_rb');
      const handler = registeredHandlers.get('armored_archer/rollout_rollback')!;
      const payload = JSON.stringify({ feature_name: 'rpc_rb' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.featureFlag.rolloutPhase).toBe('canary');
    });

    it('rpcRollbackFeature returns error for non-existent flag', async () => {
      const handler = registeredHandlers.get('armored_archer/rollout_rollback')!;
      const payload = JSON.stringify({ feature_name: 'nonexistent_rb' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rpcGetRolloutMetrics returns metrics for a feature', async () => {
      createFeatureFlag('rpc_met', 'RPC met', testPhases);
      advancePhase('rpc_met');
      recordRolloutMetrics('rpc_met', {
        totalUsers: 100,
        errorRate: 1,
        avgLatencyMs: 50,
        healthCheckFails: 0,
      });
      const handler = registeredHandlers.get('armored_archer/rollout_metrics')!;
      const payload = JSON.stringify({ feature_name: 'rpc_met' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.metrics.totalUsers).toBe(100);
      expect(result.rollback_check).toBeDefined();
    });

    it('rpcGetRolloutMetrics returns error when no metrics exist', async () => {
      createFeatureFlag('rpc_no_met', 'RPC no met', testPhases);
      const handler = registeredHandlers.get('armored_archer/rollout_metrics')!;
      const payload = JSON.stringify({ feature_name: 'rpc_no_met' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(false);
      expect(result.error).toContain('No metrics found');
    });

    it('rpcRecordMetrics records metrics via RPC', async () => {
      createFeatureFlag('rpc_rec', 'RPC rec', testPhases);
      advancePhase('rpc_rec');
      const handler = registeredHandlers.get('armored_archer/rollout_record_metrics')!;
      const payload = JSON.stringify({
        feature_name: 'rpc_rec',
        total_users: 500,
        active_users: 200,
        error_count: 5,
        error_rate: 1.0,
        avg_latency_ms: 45,
        p99_latency_ms: 200,
        health_check_passes: 195,
        health_check_fails: 0,
      });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.feature_name).toBe('rpc_rec');
      expect(result.rollback_triggered).toBe(false);
    });

    it('rpcRecordMetrics triggers rollback when thresholds exceeded', async () => {
      createFeatureFlag('rpc_rec_rb', 'RPC rec rb', testPhases);
      advancePhase('rpc_rec_rb');
      const handler = registeredHandlers.get('armored_archer/rollout_record_metrics')!;
      const payload = JSON.stringify({
        feature_name: 'rpc_rec_rb',
        error_rate: 10,
        avg_latency_ms: 50,
        health_check_fails: 0,
      });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.rollback_triggered).toBe(true);
      expect(result.rollback_reason).toBeDefined();
    });

    it('rpcRolloutHealth returns health status', async () => {
      createFeatureFlag('rpc_hlth', 'RPC hlth', testPhases);
      advancePhase('rpc_hlth');
      const handler = registeredHandlers.get('armored_archer/rollout_health')!;

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, ''));
      expect(result.status).toBeDefined();
      expect(result.features).toBeDefined();
      expect(result.environment).toBe('development');
    });

    it('rpcRolloutHealth reports unhealthy when rollback criteria met', async () => {
      createFeatureFlag('rpc_hlth_bad', 'RPC hlth bad', testPhases);
      advancePhase('rpc_hlth_bad');
      recordRolloutMetrics('rpc_hlth_bad', {
        errorRate: 10,
        avgLatencyMs: 50,
        healthCheckFails: 0,
      });
      const handler = registeredHandlers.get('armored_archer/rollout_health')!;

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, ''));
      expect(result.status).toBe('unhealthy');
    });

    it('rpcPrometheusMetrics returns metrics in Prometheus format', async () => {
      createFeatureFlag('rpc_prom', 'RPC prom', testPhases);
      const handler = registeredHandlers.get('armored_archer/rollout_metrics_prometheus')!;

      const result = await handler(mockCtx, mockLogger, mockNk, '');
      expect(typeof result).toBe('string');
      expect(result).toContain('armored_archer_');
    });
  });

  describe('isFeatureEnabled - canary version range', () => {
    it('returns true when gameVersion is in range and canaryUserIds is empty', () => {
      createFeatureFlag('canary_ver_range', 'Canary ver range', testPhases);
      updateFeatureFlag('canary_ver_range', {
        rolloutPhase: 'canary',
        canaryUserIds: [],
        canaryVersionMin: '1.0.0',
        canaryVersionMax: '2.0.0',
      });

      expect(isFeatureEnabled('canary_ver_range', 'any_user', '1.5.0')).toBe(true);
    });

    it('returns false when gameVersion is outside range and canaryUserIds is empty', () => {
      createFeatureFlag('canary_ver_oob', 'Canary ver oob', testPhases);
      updateFeatureFlag('canary_ver_oob', {
        rolloutPhase: 'canary',
        canaryUserIds: [],
        canaryVersionMin: '1.0.0',
        canaryVersionMax: '2.0.0',
      });

      expect(isFeatureEnabled('canary_ver_oob', 'any_user', '3.0.0')).toBe(false);
    });

    it('returns false when no gameVersion is provided and canaryUserIds is empty', () => {
      createFeatureFlag('canary_no_ver', 'Canary no ver', testPhases);
      updateFeatureFlag('canary_no_ver', {
        rolloutPhase: 'canary',
        canaryUserIds: [],
        canaryVersionMin: '1.0.0',
      });

      expect(isFeatureEnabled('canary_no_ver', 'any_user')).toBe(false);
    });

    it('returns true when only canaryVersionMin is set and version meets it', () => {
      createFeatureFlag('canary_min', 'Canary min', testPhases);
      updateFeatureFlag('canary_min', {
        rolloutPhase: 'canary',
        canaryUserIds: [],
        canaryVersionMin: '1.0.0',
      });

      expect(isFeatureEnabled('canary_min', 'any_user', '2.0.0')).toBe(true);
    });

    it('returns true when only canaryVersionMax is set and version meets it', () => {
      createFeatureFlag('canary_max', 'Canary max', testPhases);
      updateFeatureFlag('canary_max', {
        rolloutPhase: 'canary',
        canaryUserIds: [],
        canaryVersionMax: '2.0.0',
      });

      expect(isFeatureEnabled('canary_max', 'any_user', '1.5.0')).toBe(true);
    });
  });

  describe('checkRollbackCriteria - edge cases', () => {
    it('returns shouldRollback false when no metrics exist', () => {
      createFeatureFlag('no_met_rb', 'No met rb', testPhases);
      advancePhase('no_met_rb');

      const result = checkRollbackCriteria('no_met_rb');
      expect(result.shouldRollback).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('returns shouldRollback false when flag has no active phase', () => {
      createFeatureFlag('no_phase_rb', 'No phase rb', testPhases);

      const result = checkRollbackCriteria('no_phase_rb');
      expect(result.shouldRollback).toBe(false);
    });

    it('triggers rollback on custom metric threshold exceeded', () => {
      const phasesWithCustom = [
        createPhaseConfig({
          rollbackCriteria: {
            errorRateThreshold: 5,
            latencyThreshold: 250,
            healthCheckFails: 3,
            customMetrics: { p99LatencyMs: 100 },
          },
        }),
      ];
      createFeatureFlag('custom_met_rb', 'Custom met rb', phasesWithCustom);
      advancePhase('custom_met_rb');

      recordRolloutMetrics('custom_met_rb', {
        errorRate: 1,
        avgLatencyMs: 50,
        healthCheckFails: 1,
        p99LatencyMs: 200,
      });

      const result = checkRollbackCriteria('custom_met_rb');
      expect(result.shouldRollback).toBe(true);
      expect(result.reason).toContain('Custom metric');
    });
  });
});
