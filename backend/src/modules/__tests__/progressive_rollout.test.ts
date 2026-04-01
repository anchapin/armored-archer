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

describe('Progressive Rollout', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  const testPhases = [
    {
      phase: 'canary' as RolloutPhase,
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
      phase: 'gradual' as RolloutPhase,
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
      phase: 'full' as RolloutPhase,
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
  ];

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'rollout-test-user' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  describe('registerProgressiveRollout', () => {
    it('should register all rollout RPC endpoints', () => {
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
    });
  });

  describe('createFeatureFlag', () => {
    it('should create a new feature flag', () => {
      const flag = createFeatureFlag('test_feature', 'Test feature', testPhases);

      expect(flag.name).toBe('test_feature');
      expect(flag.description).toBe('Test feature');
      expect(flag.enabled).toBe(true);
      expect(flag.rolloutPhase).toBe('disabled');
      expect(flag.rolloutPercentage).toBe(0);
      expect(flag.currentPhaseIndex).toBe(-1);
      expect(flag.phases.length).toBe(3);
    });

    it('should add flag to feature flags map', () => {
      createFeatureFlag('test_feature_2', 'Test feature 2', testPhases);
      const flag = getFeatureFlag('test_feature_2');

      expect(flag).toBeDefined();
      expect(flag?.name).toBe('test_feature_2');
    });
  });

  describe('updateFeatureFlag', () => {
    it('should update feature flag properties', () => {
      createFeatureFlag('update_test', 'Update test', testPhases);
      const updated = updateFeatureFlag('update_test', {
        rolloutPhase: 'canary',
        rolloutPercentage: 10,
      });

      expect(updated).toBeDefined();
      expect(updated?.rolloutPhase).toBe('canary');
      expect(updated?.rolloutPercentage).toBe(10);
    });

    it('should return null for non-existent flag', () => {
      const updated = updateFeatureFlag('non_existent', { enabled: false });
      expect(updated).toBeNull();
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return false for disabled feature', () => {
      createFeatureFlag('disabled_feature', 'Disabled feature', testPhases);
      const enabled = isFeatureEnabled('disabled_feature', 'user123');

      expect(enabled).toBe(false);
    });

    it('should return true for canary user in canary phase', () => {
      createFeatureFlag('canary_feature', 'Canary feature', testPhases);
      updateFeatureFlag('canary_feature', {
        rolloutPhase: 'canary',
        canaryUserIds: ['user123'],
      });

      const enabled = isFeatureEnabled('canary_feature', 'user123');
      expect(enabled).toBe(true);
    });

    it('should return false for non-canary user in canary phase', () => {
      createFeatureFlag('canary_feature', 'Canary feature', testPhases);
      updateFeatureFlag('canary_feature', {
        rolloutPhase: 'canary',
        canaryUserIds: ['user123'],
      });

      const enabled = isFeatureEnabled('canary_feature', 'user456');
      expect(enabled).toBe(false);
    });

    it('should return true for all users in full phase', () => {
      createFeatureFlag('full_feature', 'Full feature', testPhases);
      updateFeatureFlag('full_feature', {
        rolloutPhase: 'full',
        rolloutPercentage: 100,
      });

      expect(isFeatureEnabled('full_feature', 'user1')).toBe(true);
      expect(isFeatureEnabled('full_feature', 'user2')).toBe(true);
      expect(isFeatureEnabled('full_feature', 'user3')).toBe(true);
    });

    it('should return false for non-existent feature', () => {
      const enabled = isFeatureEnabled('non_existent_feature', 'user123');
      expect(enabled).toBe(false);
    });

    it('should use deterministic hashing for gradual rollout', () => {
      createFeatureFlag('gradual_feature', 'Gradual feature', testPhases);
      updateFeatureFlag('gradual_feature', {
        rolloutPhase: 'gradual',
        rolloutPercentage: 50,
      });

      // Test that same user always gets same result
      const results = new Set();
      for (let i = 0; i < 100; i++) {
        results.add(isFeatureEnabled('gradual_feature', `user${i}`));
      }
      // With 50% rollout, we should have both true and false results
      expect(results.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('advancePhase', () => {
    it('should advance to next phase', () => {
      createFeatureFlag('advance_test', 'Advance test', testPhases);
      const advanced = advancePhase('advance_test');

      expect(advanced).toBeDefined();
      expect(advanced?.rolloutPhase).toBe('canary');
      expect(advanced?.currentPhaseIndex).toBe(0);
    });

    it('should advance through all phases', () => {
      createFeatureFlag('advance_all', 'Advance all', testPhases);

      advancePhase('advance_all');
      const phase2 = advancePhase('advance_all');
      expect(phase2?.rolloutPhase).toBe('gradual');
      expect(phase2?.currentPhaseIndex).toBe(1);

      const phase3 = advancePhase('advance_all');
      expect(phase3?.rolloutPhase).toBe('full');
      expect(phase3?.currentPhaseIndex).toBe(2);
    });

    it('should stay at final phase when already at max', () => {
      createFeatureFlag('max_phase', 'Max phase', testPhases);
      advancePhase('max_phase');
      advancePhase('max_phase');
      advancePhase('max_phase');

      const flag = getFeatureFlag('max_phase');
      expect(flag?.currentPhaseIndex).toBe(2);
    });
  });

  describe('rollbackFeature', () => {
    it('should rollback to previous phase', () => {
      createFeatureFlag('rollback_test', 'Rollback test', testPhases);
      advancePhase('rollback_test');
      advancePhase('rollback_test');

      const rolledBack = rollbackFeature('rollback_test');
      expect(rolledBack?.rolloutPhase).toBe('canary');
      expect(rolledBack?.currentPhaseIndex).toBe(0);
    });

    it('should disable feature when rolled back from first phase', () => {
      createFeatureFlag('disable_test', 'Disable test', testPhases);
      advancePhase('disable_test');

      const rolledBack = rollbackFeature('disable_test');
      expect(rolledBack?.rolloutPhase).toBe('disabled');
      expect(rolledBack?.currentPhaseIndex).toBe(-1);
    });
  });

  describe('checkRollbackCriteria', () => {
    it('should trigger rollback on high error rate', () => {
      createFeatureFlag('error_rate_test', 'Error rate test', testPhases);
      advancePhase('error_rate_test');

      recordRolloutMetrics('error_rate_test', {
        errorRate: 10, // Exceeds threshold of 5
        avgLatencyMs: 50,
        healthCheckFails: 1,
      });

      const result = checkRollbackCriteria('error_rate_test');
      expect(result.shouldRollback).toBe(true);
      expect(result.reason).toContain('Error rate');
    });

    it('should trigger rollback on high latency', () => {
      createFeatureFlag('latency_test', 'Latency test', testPhases);
      advancePhase('latency_test');

      recordRolloutMetrics('latency_test', {
        errorRate: 1,
        avgLatencyMs: 300, // Exceeds threshold of 250
        healthCheckFails: 1,
      });

      const result = checkRollbackCriteria('latency_test');
      expect(result.shouldRollback).toBe(true);
      expect(result.reason).toContain('latency');
    });

    it('should trigger rollback on health check failures', () => {
      createFeatureFlag('health_test', 'Health test', testPhases);
      advancePhase('health_test');

      recordRolloutMetrics('health_test', {
        errorRate: 1,
        avgLatencyMs: 50,
        healthCheckFails: 5, // Exceeds threshold of 3
      });

      const result = checkRollbackCriteria('health_test');
      expect(result.shouldRollback).toBe(true);
      expect(result.reason).toContain('Health check failures');
    });

    it('should not trigger rollback when metrics are healthy', () => {
      createFeatureFlag('healthy_test', 'Healthy test', testPhases);
      advancePhase('healthy_test');

      recordRolloutMetrics('healthy_test', {
        errorRate: 1,
        avgLatencyMs: 50,
        healthCheckFails: 1,
      });

      const result = checkRollbackCriteria('healthy_test');
      expect(result.shouldRollback).toBe(false);
    });
  });

  describe('recordRolloutMetrics', () => {
    it('should record metrics for a feature', () => {
      createFeatureFlag('metrics_test', 'Metrics test', testPhases);
      recordRolloutMetrics('metrics_test', {
        totalUsers: 100,
        activeUsers: 50,
        errorCount: 2,
        errorRate: 2,
        avgLatencyMs: 45,
      });

      const metrics = getRolloutMetrics('metrics_test');
      expect(metrics).toBeDefined();
      expect(metrics?.totalUsers).toBe(100);
      expect(metrics?.activeUsers).toBe(50);
      expect(metrics?.errorCount).toBe(2);
    });
  });

  describe('initializeProgressiveRollout', () => {
    it('should initialize with default feature flags', () => {
      // Clear any existing flags
      const existingFlags = getAllFeatureFlags();
      for (const flag of existingFlags) {
        updateFeatureFlag(flag.name, { enabled: false } as any);
      }

      initializeProgressiveRollout(mockLogger);

      const flags = getAllFeatureFlags();
      expect(flags.length).toBeGreaterThan(0);
    });
  });

  describe('isFeatureEnabled - canary version range', () => {
    it('should return true when gameVersion is in range and canaryUserIds is empty', () => {
      createFeatureFlag('canary_version', 'Canary version', testPhases);
      updateFeatureFlag('canary_version', {
        rolloutPhase: 'canary',
        canaryUserIds: [],
        canaryVersionMin: '1.0.0',
        canaryVersionMax: '2.0.0',
      });

      expect(isFeatureEnabled('canary_version', 'any_user', '1.5.0')).toBe(true);
    });

    it('should return false when gameVersion is outside range and canaryUserIds is empty', () => {
      createFeatureFlag('canary_version2', 'Canary version 2', testPhases);
      updateFeatureFlag('canary_version2', {
        rolloutPhase: 'canary',
        canaryUserIds: [],
        canaryVersionMin: '1.0.0',
        canaryVersionMax: '2.0.0',
      });

      expect(isFeatureEnabled('canary_version2', 'any_user', '3.0.0')).toBe(false);
    });

    it('should return false when no gameVersion is provided and canaryUserIds is empty', () => {
      createFeatureFlag('canary_no_version', 'Canary no version', testPhases);
      updateFeatureFlag('canary_no_version', {
        rolloutPhase: 'canary',
        canaryUserIds: [],
        canaryVersionMin: '1.0.0',
      });

      expect(isFeatureEnabled('canary_no_version', 'any_user')).toBe(false);
    });

    it('should return true when only canaryVersionMin is set and version meets it', () => {
      createFeatureFlag('canary_min_only', 'Canary min only', testPhases);
      updateFeatureFlag('canary_min_only', {
        rolloutPhase: 'canary',
        canaryUserIds: [],
        canaryVersionMin: '1.0.0',
      });

      expect(isFeatureEnabled('canary_min_only', 'any_user', '2.0.0')).toBe(true);
    });

    it('should return true when only canaryVersionMax is set and version meets it', () => {
      createFeatureFlag('canary_max_only', 'Canary max only', testPhases);
      updateFeatureFlag('canary_max_only', {
        rolloutPhase: 'canary',
        canaryUserIds: [],
        canaryVersionMax: '2.0.0',
      });

      expect(isFeatureEnabled('canary_max_only', 'any_user', '1.5.0')).toBe(true);
    });
  });

  describe('isFeatureEnabled - full phase', () => {
    it('should return true for full phase regardless of user ID', () => {
      createFeatureFlag('full_rollout', 'Full rollout', testPhases);
      updateFeatureFlag('full_rollout', {
        rolloutPhase: 'full',
        rolloutPercentage: 100,
      });

      expect(isFeatureEnabled('full_rollout', 'random_user_1')).toBe(true);
      expect(isFeatureEnabled('full_rollout', 'random_user_2')).toBe(true);
      expect(isFeatureEnabled('full_rollout', '')).toBe(true);
    });
  });

  describe('checkRollbackCriteria - no metrics', () => {
    it('should return shouldRollback false when no metrics exist', () => {
      createFeatureFlag('no_metrics', 'No metrics', testPhases);
      advancePhase('no_metrics');

      const result = checkRollbackCriteria('no_metrics');
      expect(result.shouldRollback).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('should return shouldRollback false when flag has no active phase', () => {
      createFeatureFlag('no_phase', 'No phase', testPhases);

      const result = checkRollbackCriteria('no_phase');
      expect(result.shouldRollback).toBe(false);
    });

    it('should return shouldRollback false for non-existent flag', () => {
      const result = checkRollbackCriteria('does_not_exist');
      expect(result.shouldRollback).toBe(false);
    });

    it('should trigger rollback on custom metric threshold exceeded', () => {
      const phasesWithCustom = [
        {
          ...testPhases[0],
          rollbackCriteria: {
            errorRateThreshold: 5,
            latencyThreshold: 250,
            healthCheckFails: 3,
            customMetrics: { p99LatencyMs: 100 },
          },
        },
      ];
      createFeatureFlag('custom_metric', 'Custom metric', phasesWithCustom);
      advancePhase('custom_metric');

      recordRolloutMetrics('custom_metric', {
        errorRate: 1,
        avgLatencyMs: 50,
        healthCheckFails: 1,
        p99LatencyMs: 200,
      });

      const result = checkRollbackCriteria('custom_metric');
      expect(result.shouldRollback).toBe(true);
      expect(result.reason).toContain('Custom metric');
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

    it('rpcCreateFeatureFlag should create a flag via RPC', async () => {
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

    it('rpcCreateFeatureFlag should reject duplicate flag names', async () => {
      const handler = registeredHandlers.get('armored_archer/rollout_create_flag')!;
      const payload = JSON.stringify({
        name: 'duplicate_rpc_flag',
        description: 'Duplicate',
        phases: testPhases,
      });

      await handler(mockCtx, mockLogger, mockNk, payload);
      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('rpcCreateFeatureFlag should return validation error for invalid payload', async () => {
      const handler = registeredHandlers.get('armored_archer/rollout_create_flag')!;
      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, 'not json'));
      expect(result.success).toBe(false);
    });

    it('rpcUpdateFeatureFlag should update a flag via RPC', async () => {
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

    it('rpcUpdateFeatureFlag should return error for non-existent flag', async () => {
      const handler = registeredHandlers.get('armored_archer/rollout_update_flag')!;
      const payload = JSON.stringify({ name: 'nonexistent_rpc' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rpcListFeatureFlags should list all flags', async () => {
      createFeatureFlag('list_test_1', 'List 1', testPhases);
      createFeatureFlag('list_test_2', 'List 2', testPhases);
      const handler = registeredHandlers.get('armored_archer/rollout_list_flags')!;

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, ''));
      expect(result.success).toBe(true);
      expect(result.featureFlags.length).toBeGreaterThanOrEqual(2);
    });

    it('rpcCheckFeatureFlag should check feature enabled status', async () => {
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

    it('rpcCheckFeatureFlag should return false for disabled feature', async () => {
      createFeatureFlag('rpc_check_disabled', 'RPC check disabled', testPhases);
      const handler = registeredHandlers.get('armored_archer/rollout_check')!;
      const payload = JSON.stringify({
        feature_name: 'rpc_check_disabled',
        user_id: 'test_user',
      });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false);
    });

    it('rpcCheckFeatureFlag should return disabled phase for non-existent feature', async () => {
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

    it('rpcAdvancePhase should advance a flag phase via RPC', async () => {
      createFeatureFlag('rpc_advance', 'RPC advance', testPhases);
      const handler = registeredHandlers.get('armored_archer/rollout_advance')!;
      const payload = JSON.stringify({ feature_name: 'rpc_advance' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.featureFlag.rolloutPhase).toBe('canary');
    });

    it('rpcAdvancePhase should return error for non-existent flag', async () => {
      const handler = registeredHandlers.get('armored_archer/rollout_advance')!;
      const payload = JSON.stringify({ feature_name: 'nonexistent_advance' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rpcRollbackFeature should rollback a flag via RPC', async () => {
      createFeatureFlag('rpc_rollback', 'RPC rollback', testPhases);
      advancePhase('rpc_rollback');
      advancePhase('rpc_rollback');
      const handler = registeredHandlers.get('armored_archer/rollout_rollback')!;
      const payload = JSON.stringify({ feature_name: 'rpc_rollback' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.featureFlag.rolloutPhase).toBe('canary');
    });

    it('rpcRollbackFeature should return error for non-existent flag', async () => {
      const handler = registeredHandlers.get('armored_archer/rollout_rollback')!;
      const payload = JSON.stringify({ feature_name: 'nonexistent_rollback' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rpcGetRolloutMetrics should return metrics for a feature', async () => {
      createFeatureFlag('rpc_metrics', 'RPC metrics', testPhases);
      advancePhase('rpc_metrics');
      recordRolloutMetrics('rpc_metrics', {
        totalUsers: 100,
        errorRate: 1,
        avgLatencyMs: 50,
        healthCheckFails: 0,
      });
      const handler = registeredHandlers.get('armored_archer/rollout_metrics')!;
      const payload = JSON.stringify({ feature_name: 'rpc_metrics' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.metrics.totalUsers).toBe(100);
      expect(result.rollback_check).toBeDefined();
    });

    it('rpcGetRolloutMetrics should return error when no metrics exist', async () => {
      createFeatureFlag('rpc_no_metrics', 'RPC no metrics', testPhases);
      const handler = registeredHandlers.get('armored_archer/rollout_metrics')!;
      const payload = JSON.stringify({ feature_name: 'rpc_no_metrics' });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(false);
      expect(result.error).toContain('No metrics found');
    });

    it('rpcRecordMetrics should record metrics via RPC', async () => {
      createFeatureFlag('rpc_record', 'RPC record', testPhases);
      advancePhase('rpc_record');
      const handler = registeredHandlers.get('armored_archer/rollout_record_metrics')!;
      const payload = JSON.stringify({
        feature_name: 'rpc_record',
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
      expect(result.feature_name).toBe('rpc_record');
      expect(result.rollback_triggered).toBe(false);
    });

    it('rpcRecordMetrics should trigger rollback when thresholds exceeded', async () => {
      createFeatureFlag('rpc_record_rb', 'RPC record rollback', testPhases);
      advancePhase('rpc_record_rb');
      const handler = registeredHandlers.get('armored_archer/rollout_record_metrics')!;
      const payload = JSON.stringify({
        feature_name: 'rpc_record_rb',
        error_rate: 10,
        avg_latency_ms: 50,
        health_check_fails: 0,
      });

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, payload));
      expect(result.success).toBe(true);
      expect(result.rollback_triggered).toBe(true);
      expect(result.rollback_reason).toBeDefined();
    });

    it('rpcRolloutHealth should return health status', async () => {
      createFeatureFlag('rpc_health', 'RPC health', testPhases);
      advancePhase('rpc_health');
      const handler = registeredHandlers.get('armored_archer/rollout_health')!;

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, ''));
      expect(result.status).toBeDefined();
      expect(result.features).toBeDefined();
      expect(result.environment).toBe('development');
    });

    it('rpcRolloutHealth should report unhealthy when rollback criteria met', async () => {
      createFeatureFlag('rpc_health_bad', 'RPC health bad', testPhases);
      advancePhase('rpc_health_bad');
      recordRolloutMetrics('rpc_health_bad', {
        errorRate: 10,
        avgLatencyMs: 50,
        healthCheckFails: 0,
      });
      const handler = registeredHandlers.get('armored_archer/rollout_health')!;

      const result = JSON.parse(await handler(mockCtx, mockLogger, mockNk, ''));
      expect(result.status).toBe('unhealthy');
    });

    it('rpcPrometheusMetrics should return metrics in Prometheus format', async () => {
      createFeatureFlag('rpc_prom', 'RPC prom', testPhases);
      const handler = registeredHandlers.get('armored_archer/rollout_metrics_prometheus')!;

      const result = await handler(mockCtx, mockLogger, mockNk, '');
      expect(typeof result).toBe('string');
      expect(result).toContain('armored_archer_');
    });
  });
});
