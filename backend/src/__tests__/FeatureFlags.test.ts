/**
 * Tests for FeatureFlags module (features/)
 */

jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  const { __resetForTesting } = require('../features/FeatureFlags');
  __resetForTesting();
});

afterEach(() => {
  jest.resetModules();
});

afterAll(() => {
  process.env = originalEnv;
});

describe('FeatureFlags (features/)', () => {
  describe('initializeFeatureFlags', () => {
    it('initializes without error', async () => {
      const { initializeFeatureFlags } = require('../features/FeatureFlags');
      await expect(initializeFeatureFlags()).resolves.not.toThrow();
    });
  });

  describe('getFeatureFlag', () => {
    it('returns null for non-existent flag', async () => {
      const { getFeatureFlag } = require('../features/FeatureFlags');
      const result = await getFeatureFlag('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('isFeatureEnabled', () => {
    it('returns false for non-existent flag', async () => {
      const { isFeatureEnabled } = require('../features/FeatureFlags');
      const result = await isFeatureEnabled('nonexistent');
      expect(result).toBe(false);
    });

    it('returns false when flag is disabled', async () => {
      const { isFeatureEnabled, createFeatureFlag } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'disabled_feature',
        description: 'A disabled feature',
        enabled: false,
      });
      const result = await isFeatureEnabled('disabled_feature');
      expect(result).toBe(false);
    });

    it('returns true when flag is enabled with 100% rollout', async () => {
      const { isFeatureEnabled, createFeatureFlag } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'full_rollout',
        description: 'Full rollout feature',
        enabled: true,
        environment: 'all',
        rolloutPercentage: 100,
        environment: 'all',
      });
      const result = await isFeatureEnabled('full_rollout', 'user-1');
      expect(result).toBe(true);
    });

    it('respects environment restriction', async () => {
      const { isFeatureEnabled, createFeatureFlag } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'prod_only',
        description: 'Production only',
        enabled: true,
        environment: 'all',
        environment: 'production',
      });
      const result = await isFeatureEnabled('prod_only', 'user-1', undefined, 'development');
      expect(result).toBe(false);
    });

    it('allows all environments when set to all', async () => {
      const { isFeatureEnabled, createFeatureFlag } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'all_env',
        description: 'All environments',
        enabled: true,
        environment: 'all',
      });
      const result = await isFeatureEnabled('all_env', 'user-1', undefined, 'staging');
      expect(result).toBe(true);
    });

    it('returns false when feature has expired', async () => {
      const { isFeatureEnabled, createFeatureFlag } = require('../features/FeatureFlags');
      const pastDate = new Date(Date.now() - 86400000);
      await createFeatureFlag({
        name: 'expired_feature',
        description: 'An expired feature',
        enabled: true,
        environment: 'all',
        expiresAt: pastDate,
      });
      const result = await isFeatureEnabled('expired_feature', 'user-1');
      expect(result).toBe(false);
    });

    it('respects user segment targeting', async () => {
      const { isFeatureEnabled, createFeatureFlag } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'segment_feature',
        description: 'Segment targeted',
        enabled: true,
        environment: 'all',
        rolloutPercentage: 10,
        userSegments: ['beta_testers'],
      });
      const result = await isFeatureEnabled('segment_feature', 'user-1', 'beta_testers');
      expect(result).toBe(true);
    });

    it('uses user hash for deterministic rollout', async () => {
      const { isFeatureEnabled, createFeatureFlag } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'partial_rollout',
        description: 'Partial rollout',
        enabled: true,
        environment: 'all',
        rolloutPercentage: 50,
      });
      const result1 = await isFeatureEnabled('partial_rollout', 'user-123');
      const result2 = await isFeatureEnabled('partial_rollout', 'user-123');
      expect(result1).toBe(result2);
    });

    it('uses random for anonymous users', async () => {
      const { isFeatureEnabled, createFeatureFlag } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'anon_rollout',
        description: 'Anonymous rollout',
        enabled: true,
        environment: 'all',
        rolloutPercentage: 50,
      });
      const result = await isFeatureEnabled('anon_rollout');
      expect(typeof result).toBe('boolean');
    });

    it('returns false when rollout percentage is 0', async () => {
      const { isFeatureEnabled, createFeatureFlag } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'zero_rollout',
        description: 'Zero rollout',
        enabled: true,
        environment: 'all',
        rolloutPercentage: 0,
      });
      const result = await isFeatureEnabled('zero_rollout', 'user-1');
      expect(result).toBe(false);
    });
  });

  describe('getFeatureVariant', () => {
    it('returns default variant when flag does not exist', async () => {
      const { getFeatureVariant } = require('../features/FeatureFlags');
      const result = await getFeatureVariant('nonexistent', 'user-1');
      expect(result).toBe('control');
    });

    it('returns custom default variant when flag does not exist', async () => {
      const { getFeatureVariant } = require('../features/FeatureFlags');
      const result = await getFeatureVariant('nonexistent', 'user-1', 'fallback');
      expect(result).toBe('fallback');
    });

    it('returns variant based on user hash', async () => {
      const { getFeatureVariant, createFeatureFlag } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'ab_test',
        description: 'A/B test',
        enabled: true,
        environment: 'all',
        rolloutPercentage: 100,
        environment: 'all',
        variants: { control: 50, treatment: 50 },
      });
      const result = await getFeatureVariant('ab_test', 'user-123');
      expect(['control', 'treatment']).toContain(result);
    });

    it('is deterministic for same user', async () => {
      const { getFeatureVariant, createFeatureFlag } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'deterministic_ab',
        description: 'Deterministic A/B',
        enabled: true,
        environment: 'all',
        rolloutPercentage: 100,
        environment: 'all',
        variants: { a: 50, b: 50 },
      });
      const result1 = await getFeatureVariant('deterministic_ab', 'user-456');
      const result2 = await getFeatureVariant('deterministic_ab', 'user-456');
      expect(result1).toBe(result2);
    });
  });

  describe('createFeatureFlag', () => {
    it('creates a new feature flag', async () => {
      const { createFeatureFlag, getFeatureFlag } = require('../features/FeatureFlags');
      const result = await createFeatureFlag({
        name: 'new_feature',
        description: 'A new feature',
        enabled: true,
        environment: 'all',
      });
      expect(result).toBe(true);
      const flag = await getFeatureFlag('new_feature');
      expect(flag).toBeDefined();
      expect(flag?.name).toBe('new_feature');
    });

    it('returns false when flag already exists', async () => {
      const { createFeatureFlag } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'duplicate_feature',
        description: 'First creation',
        enabled: true,
        environment: 'all',
      });
      const result = await createFeatureFlag({
        name: 'duplicate_feature',
        description: 'Second creation',
        enabled: true,
        environment: 'all',
      });
      expect(result).toBe(false);
    });
  });

  describe('updateFeatureFlag', () => {
    it('updates an existing flag', async () => {
      const {
        createFeatureFlag,
        updateFeatureFlag,
        getFeatureFlag,
      } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'updatable',
        description: 'Updatable feature',
        enabled: true,
        environment: 'all',
      });
      const result = await updateFeatureFlag('updatable', { enabled: false });
      expect(result).toBe(true);
      const flag = await getFeatureFlag('updatable');
      expect(flag?.enabled).toBe(false);
    });

    it('returns false for non-existent flag', async () => {
      const { updateFeatureFlag } = require('../features/FeatureFlags');
      const result = await updateFeatureFlag('nonexistent', { enabled: true });
      expect(result).toBe(false);
    });
  });

  describe('deleteFeatureFlag', () => {
    it('deletes an existing flag', async () => {
      const {
        createFeatureFlag,
        deleteFeatureFlag,
        getFeatureFlag,
      } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'deletable',
        description: 'Deletable feature',
        enabled: true,
        environment: 'all',
      });
      const result = await deleteFeatureFlag('deletable');
      expect(result).toBe(true);
      const flag = await getFeatureFlag('deletable');
      expect(flag).toBeNull();
    });

    it('returns false for non-existent flag', async () => {
      const { deleteFeatureFlag } = require('../features/FeatureFlags');
      const result = await deleteFeatureFlag('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('toggleFeatureFlag', () => {
    it('toggles enabled state', async () => {
      const {
        createFeatureFlag,
        toggleFeatureFlag,
        getFeatureFlag,
      } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'toggleable',
        description: 'Toggleable feature',
        enabled: true,
        environment: 'all',
      });
      await toggleFeatureFlag('toggleable');
      const flag = await getFeatureFlag('toggleable');
      expect(flag?.enabled).toBe(false);

      await toggleFeatureFlag('toggleable');
      const flag2 = await getFeatureFlag('toggleable');
      expect(flag2?.enabled).toBe(true);
    });

    it('returns false for non-existent flag', async () => {
      const { toggleFeatureFlag } = require('../features/FeatureFlags');
      const result = await toggleFeatureFlag('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getAllFeatureFlags', () => {
    it('returns all created flags', async () => {
      const { createFeatureFlag, getAllFeatureFlags } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'flag1',
        description: 'Flag 1',
        enabled: true,
        environment: 'all',
      });
      await createFeatureFlag({
        name: 'flag2',
        description: 'Flag 2',
        enabled: false,
      });
      const flags = getAllFeatureFlags();
      const names = flags.map((f: { name: string }) => f.name);
      expect(names).toContain('flag1');
      expect(names).toContain('flag2');
    });
  });

  describe('getFeatureFlagsByEnvironment', () => {
    it('returns flags for specific environment', async () => {
      const {
        createFeatureFlag,
        getFeatureFlagsByEnvironment,
      } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'prod_flag',
        description: 'Production only',
        enabled: true,
        environment: 'all',
        environment: 'production',
      });
      await createFeatureFlag({
        name: 'all_flag',
        description: 'All environments',
        enabled: true,
        environment: 'all',
      });
      const prodFlags = getFeatureFlagsByEnvironment('production');
      expect(prodFlags.length).toBeGreaterThanOrEqual(2);
    });

    it('excludes flags for different environments', async () => {
      const {
        createFeatureFlag,
        getFeatureFlagsByEnvironment,
      } = require('../features/FeatureFlags');
      await createFeatureFlag({
        name: 'dev_only',
        description: 'Development only',
        enabled: true,
        environment: 'all',
        environment: 'development',
      });
      const prodFlags = getFeatureFlagsByEnvironment('production');
      const names = prodFlags.map((f: { name: string }) => f.name);
      expect(names).not.toContain('dev_only');
    });
  });

  describe('evaluateFeatures', () => {
    it('evaluates multiple flags at once', async () => {
      const {
        createFeatureFlag,
        evaluateFeatures,
        clearFeatureFlagCache,
      } = require('../features/FeatureFlags');
      clearFeatureFlagCache();
      await createFeatureFlag({
        name: 'eval_flag1',
        description: 'Eval flag 1',
        enabled: true,
        environment: 'all',
        rolloutPercentage: 100,
        environment: 'all',
      });
      await createFeatureFlag({
        name: 'eval_flag2',
        description: 'Eval flag 2',
        enabled: false,
      });
      const results = await evaluateFeatures(['eval_flag1', 'eval_flag2', 'nonexistent'], 'user-1');
      expect(results).toHaveLength(3);
      expect(results[0].flagName).toBe('eval_flag1');
      expect(results[0].enabled).toBe(true);
      expect(results[1].flagName).toBe('eval_flag2');
      expect(results[1].enabled).toBe(false);
      expect(results[2].flagName).toBe('nonexistent');
      expect(results[2].enabled).toBe(false);
    });
  });

  describe('checkDependencies', () => {
    it('returns satisfied when no dependencies', async () => {
      const {
        createFeatureFlag,
        checkDependencies,
        clearFeatureFlagCache,
      } = require('../features/FeatureFlags');
      clearFeatureFlagCache();
      await createFeatureFlag({
        name: 'no_deps',
        description: 'No dependencies',
        enabled: true,
        environment: 'all',
        rolloutPercentage: 100,
        environment: 'all',
      });
      const result = await checkDependencies('no_deps', 'user-1');
      expect(result.satisfied).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('returns satisfied when all dependencies are enabled', async () => {
      const {
        createFeatureFlag,
        checkDependencies,
        clearFeatureFlagCache,
      } = require('../features/FeatureFlags');
      clearFeatureFlagCache();
      await createFeatureFlag({
        name: 'dep_base',
        description: 'Base dependency',
        enabled: true,
        environment: 'all',
        rolloutPercentage: 100,
        environment: 'all',
      });
      await createFeatureFlag({
        name: 'dep_child',
        description: 'Child with dependency',
        enabled: true,
        environment: 'all',
        dependencies: ['dep_base'],
        rolloutPercentage: 100,
        environment: 'all',
      });
      const result = await checkDependencies('dep_child', 'user-1');
      expect(result.satisfied).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('returns missing when dependency is disabled', async () => {
      const {
        createFeatureFlag,
        checkDependencies,
        clearFeatureFlagCache,
      } = require('../features/FeatureFlags');
      clearFeatureFlagCache();
      await createFeatureFlag({
        name: 'disabled_dep',
        description: 'Disabled dependency',
        enabled: false,
      });
      await createFeatureFlag({
        name: 'blocked_feature',
        description: 'Blocked by dependency',
        enabled: true,
        environment: 'all',
        dependencies: ['disabled_dep'],
        rolloutPercentage: 100,
        environment: 'all',
      });
      const result = await checkDependencies('blocked_feature', 'user-1');
      expect(result.satisfied).toBe(false);
      expect(result.missing).toContain('disabled_dep');
    });
  });

  describe('clearFeatureFlagCache', () => {
    it('clears caches without error', () => {
      const { clearFeatureFlagCache } = require('../features/FeatureFlags');
      expect(() => clearFeatureFlagCache()).not.toThrow();
    });
  });

  describe('FeatureFlags convenience object', () => {
    it('exposes all methods', () => {
      const { FeatureFlags } = require('../features/FeatureFlags');
      expect(FeatureFlags.isEnabled).toBeDefined();
      expect(FeatureFlags.getVariant).toBeDefined();
      expect(FeatureFlags.evaluate).toBeDefined();
      expect(FeatureFlags.update).toBeDefined();
      expect(FeatureFlags.create).toBeDefined();
      expect(FeatureFlags.delete).toBeDefined();
      expect(FeatureFlags.getAll).toBeDefined();
      expect(FeatureFlags.getByEnvironment).toBeDefined();
      expect(FeatureFlags.checkDependencies).toBeDefined();
      expect(FeatureFlags.toggle).toBeDefined();
      expect(FeatureFlags.clearCache).toBeDefined();
    });
  });
});
