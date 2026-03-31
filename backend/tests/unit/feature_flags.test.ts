import {
  isFeatureEnabled,
  getFeatureVariant,
  getAllFlags,
  FEATURE_FLAGS,
  type FeatureFlag,
  type FeatureFlagsConfig,
} from '../../src/feature-flags';

describe('feature-flags', () => {
  beforeEach(() => {
    (FEATURE_FLAGS as any).flags = {};
  });

  describe('isFeatureEnabled', () => {
    it('should return false for unknown flags', async () => {
      const result = await isFeatureEnabled('unknown_flag');
      expect(result).toBe(false);
    });

    it('should return false when flag exists but is disabled', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': { name: 'test-flag', enabled: false },
      };
      const result = await isFeatureEnabled('test-flag');
      expect(result).toBe(false);
    });

    it('should return true when flag is enabled', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': { name: 'test-flag', enabled: true },
      };
      const result = await isFeatureEnabled('test-flag');
      expect(result).toBe(true);
    });

    it('should respect user targeting - return true for targeted user', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': {
          name: 'test-flag',
          enabled: true,
          targetUsers: ['user1', 'user2'],
        },
      };
      const result = await isFeatureEnabled('test-flag', 'user1');
      expect(result).toBe(true);
    });

    it('should respect user targeting - return false for non-targeted user', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': {
          name: 'test-flag',
          enabled: true,
          targetUsers: ['user1', 'user2'],
        },
      };
      const result = await isFeatureEnabled('test-flag', 'user3');
      expect(result).toBe(false);
    });

    it('should handle empty targetUsers array as no targeting', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': { name: 'test-flag', enabled: true, targetUsers: [] },
      };
      const result = await isFeatureEnabled('test-flag', 'user1');
      expect(result).toBe(true);
    });

    it('should use 50% threshold when no userId provided with partial rollout', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': {
          name: 'test-flag',
          enabled: true,
          rolloutPercentage: 50,
        },
      };
      const result = await isFeatureEnabled('test-flag');
      expect(result).toBe(true);
    });

    it('should use hash-based rollout when userId provided with rolloutPercentage', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': {
          name: 'test-flag',
          enabled: true,
          rolloutPercentage: 100,
        },
      };
      const result = await isFeatureEnabled('test-flag', 'user1');
      expect(result).toBe(true);
    });

    it('should return false for 0% rollout', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': {
          name: 'test-flag',
          enabled: true,
          rolloutPercentage: 0,
        },
      };
      const result = await isFeatureEnabled('test-flag', 'user1');
      expect(result).toBe(false);
    });

    it('should return true for 100% rollout', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': {
          name: 'test-flag',
          enabled: true,
          rolloutPercentage: 100,
        },
      };
      const result = await isFeatureEnabled('test-flag', 'user1');
      expect(result).toBe(true);
    });
  });

  describe('getFeatureVariant', () => {
    it('should return null for unknown flag', async () => {
      const result = await getFeatureVariant('unknown', 'user1');
      expect(result).toBeNull();
    });

    it('should return null when flag is disabled', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': { name: 'test-flag', enabled: false, variants: ['A', 'B'] },
      };
      const result = await getFeatureVariant('test-flag', 'user1');
      expect(result).toBeNull();
    });

    it('should return null when no variants defined', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': { name: 'test-flag', enabled: true },
      };
      const result = await getFeatureVariant('test-flag', 'user1');
      expect(result).toBeNull();
    });

    it('should return null when variants array is empty', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': { name: 'test-flag', enabled: true, variants: [] },
      };
      const result = await getFeatureVariant('test-flag', 'user1');
      expect(result).toBeNull();
    });

    it('should return deterministic variant based on userId', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': {
          name: 'test-flag',
          enabled: true,
          variants: ['A', 'B'],
        },
      };
      const result = await getFeatureVariant('test-flag', 'user1');
      expect(['A', 'B']).toContain(result);
    });

    it('should return same variant for same userId', async () => {
      (FEATURE_FLAGS as any).flags = {
        'test-flag': {
          name: 'test-flag',
          enabled: true,
          variants: ['A', 'B', 'C'],
        },
      };
      const result1 = await getFeatureVariant('test-flag', 'user1');
      const result2 = await getFeatureVariant('test-flag', 'user1');
      expect(result1).toBe(result2);
    });
  });

  describe('getAllFlags', () => {
    it('should return current flags config', () => {
      const result = getAllFlags();
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('flags');
    });

    it('should return empty flags object when no flags set', () => {
      const result = getAllFlags();
      expect(result.flags).toEqual({});
    });
  });
});