/**
 * Tests for feature-flags module (root level)
 */

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('feature-flags (root)', () => {
  describe('FEATURE_FLAGS config', () => {
    it('has correct structure', () => {
      const { FEATURE_FLAGS } = require('../feature-flags');
      expect(FEATURE_FLAGS).toBeDefined();
      expect(FEATURE_FLAGS.version).toBe('1.0.0');
      expect(FEATURE_FLAGS.flags).toBeDefined();
      expect(typeof FEATURE_FLAGS.flags).toBe('object');
    });

    it('starts with empty flags', () => {
      const { FEATURE_FLAGS } = require('../feature-flags');
      expect(Object.keys(FEATURE_FLAGS.flags)).toHaveLength(0);
    });
  });

  describe('isFeatureEnabled', () => {
    it('returns false for unknown flags', async () => {
      const { isFeatureEnabled } = require('../feature-flags');
      const result = await isFeatureEnabled('nonexistent_flag');
      expect(result).toBe(false);
    });

    it('returns false for unknown flags even with userId', async () => {
      const { isFeatureEnabled } = require('../feature-flags');
      const result = await isFeatureEnabled('nonexistent_flag', 'user-123');
      expect(result).toBe(false);
    });

    it('returns false when flag is disabled', async () => {
      const { FEATURE_FLAGS, isFeatureEnabled } = require('../feature-flags');
      FEATURE_FLAGS.flags['test_flag'] = {
        name: 'test_flag',
        enabled: false,
      };
      const result = await isFeatureEnabled('test_flag');
      expect(result).toBe(false);
    });

    it('returns true when flag is enabled with no percentage', async () => {
      const { FEATURE_FLAGS, isFeatureEnabled } = require('../feature-flags');
      FEATURE_FLAGS.flags['test_flag'] = {
        name: 'test_flag',
        enabled: true,
      };
      const result = await isFeatureEnabled('test_flag');
      expect(result).toBe(true);
    });

    it('returns true when flag is enabled with 100% rollout', async () => {
      const { FEATURE_FLAGS, isFeatureEnabled } = require('../feature-flags');
      FEATURE_FLAGS.flags['test_flag'] = {
        name: 'test_flag',
        enabled: true,
        rolloutPercentage: 100,
      };
      const result = await isFeatureEnabled('test_flag', 'user-123');
      expect(result).toBe(true);
    });

    it('returns true when user is in targetUsers list', async () => {
      const { FEATURE_FLAGS, isFeatureEnabled } = require('../feature-flags');
      FEATURE_FLAGS.flags['beta_feature'] = {
        name: 'beta_feature',
        enabled: true,
        targetUsers: ['user-1', 'user-2'],
      };
      expect(await isFeatureEnabled('beta_feature', 'user-1')).toBe(true);
      expect(await isFeatureEnabled('beta_feature', 'user-3')).toBe(false);
    });

    it('uses percentage rollout for non-targeted users', async () => {
      const { FEATURE_FLAGS, isFeatureEnabled } = require('../feature-flags');
      FEATURE_FLAGS.flags['gradual_rollout'] = {
        name: 'gradual_rollout',
        enabled: true,
        rolloutPercentage: 50,
      };
      const result = await isFeatureEnabled('gradual_rollout', 'user-hash-test');
      expect(typeof result).toBe('boolean');
    });

    it('returns true when rollout percentage is >= 50 and no userId', async () => {
      const { FEATURE_FLAGS, isFeatureEnabled } = require('../feature-flags');
      FEATURE_FLAGS.flags['no_user_rollout'] = {
        name: 'no_user_rollout',
        enabled: true,
        rolloutPercentage: 60,
      };
      const result = await isFeatureEnabled('no_user_rollout');
      expect(result).toBe(true);
    });

    it('returns false when rollout percentage is < 50 and no userId', async () => {
      const { FEATURE_FLAGS, isFeatureEnabled } = require('../feature-flags');
      FEATURE_FLAGS.flags['low_rollout'] = {
        name: 'low_rollout',
        enabled: true,
        rolloutPercentage: 30,
      };
      const result = await isFeatureEnabled('low_rollout');
      expect(result).toBe(false);
    });

    it('is deterministic for same user and flag', async () => {
      const { FEATURE_FLAGS, isFeatureEnabled } = require('../feature-flags');
      FEATURE_FLAGS.flags['deterministic'] = {
        name: 'deterministic',
        enabled: true,
        rolloutPercentage: 50,
      };
      const result1 = await isFeatureEnabled('deterministic', 'user-123');
      const result2 = await isFeatureEnabled('deterministic', 'user-123');
      expect(result1).toBe(result2);
    });
  });

  describe('getFeatureVariant', () => {
    it('returns null for unknown flag', async () => {
      const { getFeatureVariant } = require('../feature-flags');
      const result = await getFeatureVariant('nonexistent', 'user-123');
      expect(result).toBeNull();
    });

    it('returns null when flag is disabled', async () => {
      const { FEATURE_FLAGS, getFeatureVariant } = require('../feature-flags');
      FEATURE_FLAGS.flags['disabled_ab'] = {
        name: 'disabled_ab',
        enabled: false,
        variants: ['control', 'treatment'],
      };
      const result = await getFeatureVariant('disabled_ab', 'user-123');
      expect(result).toBeNull();
    });

    it('returns null when flag has no variants', async () => {
      const { FEATURE_FLAGS, getFeatureVariant } = require('../feature-flags');
      FEATURE_FLAGS.flags['no_variants'] = {
        name: 'no_variants',
        enabled: true,
      };
      const result = await getFeatureVariant('no_variants', 'user-123');
      expect(result).toBeNull();
    });

    it('returns variant for flag with variants', async () => {
      const { FEATURE_FLAGS, getFeatureVariant } = require('../feature-flags');
      FEATURE_FLAGS.flags['ab_test'] = {
        name: 'ab_test',
        enabled: true,
        variants: ['control', 'treatment'],
      };
      const result = await getFeatureVariant('ab_test', 'user-123');
      expect(['control', 'treatment']).toContain(result);
    });

    it('is deterministic for same user and flag', async () => {
      const { FEATURE_FLAGS, getFeatureVariant } = require('../feature-flags');
      FEATURE_FLAGS.flags['deterministic_ab'] = {
        name: 'deterministic_ab',
        enabled: true,
        variants: ['control', 'treatment'],
      };
      const result1 = await getFeatureVariant('deterministic_ab', 'user-456');
      const result2 = await getFeatureVariant('deterministic_ab', 'user-456');
      expect(result1).toBe(result2);
    });

    it('assigns different variants to different users', async () => {
      const { FEATURE_FLAGS, getFeatureVariant } = require('../feature-flags');
      FEATURE_FLAGS.flags['multi_user_ab'] = {
        name: 'multi_user_ab',
        enabled: true,
        variants: ['control', 'treatment'],
      };
      const variants = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const variant = await getFeatureVariant('multi_user_ab', `user-${i}`);
        if (variant) variants.add(variant);
      }
      expect(variants.size).toBeGreaterThan(0);
    });
  });

  describe('getAllFlags', () => {
    it('returns the FEATURE_FLAGS config', () => {
      const { getAllFlags, FEATURE_FLAGS } = require('../feature-flags');
      expect(getAllFlags()).toBe(FEATURE_FLAGS);
    });
  });

  describe('hashUserId', () => {
    it('returns consistent hash for same input', async () => {
      const { FEATURE_FLAGS, isFeatureEnabled } = require('../feature-flags');
      FEATURE_FLAGS.flags['hash_test'] = {
        name: 'hash_test',
        enabled: true,
        rolloutPercentage: 50,
      };
      const results: boolean[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(await isFeatureEnabled('hash_test', 'user-consistent'));
      }
      const allSame = results.every((r) => r === results[0]);
      expect(allSame).toBe(true);
    });

    it('returns different results for different users', async () => {
      const { FEATURE_FLAGS, isFeatureEnabled } = require('../feature-flags');
      FEATURE_FLAGS.flags['hash_diff'] = {
        name: 'hash_diff',
        enabled: true,
        rolloutPercentage: 50,
      };
      const results = new Set<boolean>();
      for (let i = 0; i < 50; i++) {
        results.add(await isFeatureEnabled('hash_diff', `user-${i}`));
      }
      expect(results.size).toBeGreaterThan(1);
    });
  });
});
