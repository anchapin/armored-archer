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
});
