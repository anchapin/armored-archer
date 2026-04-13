/**
 * Tests for feature-flags utility
 */

import { FeatureFlags, FEATURE_FLAGS, FeatureFlag } from '../feature-flags';

describe('FeatureFlags', () => {
  beforeEach(() => {
    FEATURE_FLAGS.flags = [];
    FEATURE_FLAGS.defaultEnabled = false;
  });

  describe('isEnabled', () => {
    it('should return defaultEnabled (false) when flag does not exist', () => {
      expect(FeatureFlags.isEnabled('nonexistent_flag')).toBe(false);
    });

    it('should return defaultEnabled (true) when flag does not exist and defaultEnabled is true', () => {
      FEATURE_FLAGS.defaultEnabled = true;
      expect(FeatureFlags.isEnabled('nonexistent_flag')).toBe(true);
    });

    it('should return true when flag exists and is enabled', () => {
      FEATURE_FLAGS.flags.push({
        name: 'test_flag',
        enabled: true,
      });
      expect(FeatureFlags.isEnabled('test_flag')).toBe(true);
    });

    it('should return false when flag exists and is disabled', () => {
      FEATURE_FLAGS.flags.push({
        name: 'test_flag',
        enabled: false,
      });
      expect(FeatureFlags.isEnabled('test_flag')).toBe(false);
    });

    it('should use hash-based rollout when rolloutPercentage is 100', () => {
      FEATURE_FLAGS.flags.push({
        name: 'rollout_flag',
        enabled: true,
        rolloutPercentage: 100,
      });
      expect(FeatureFlags.isEnabled('rollout_flag')).toBe(true);
    });

    it('should use hash-based rollout with 0% rollout', () => {
      FEATURE_FLAGS.flags.push({
        name: 'zero_rollout',
        enabled: true,
        rolloutPercentage: 0,
      });
      // rolloutPercentage is 0, so the condition `flag.rolloutPercentage > 0` is false
      // Falls through to return flag.enabled which is true
      expect(FeatureFlags.isEnabled('zero_rollout')).toBe(true);
    });

    it('should use hash-based rollout with partial rollout percentage', () => {
      FEATURE_FLAGS.flags.push({
        name: 'half_rollout',
        enabled: true,
        rolloutPercentage: 50,
      });
      const result = FeatureFlags.isEnabled('half_rollout');
      expect(typeof result).toBe('boolean');
    });

    it('should be deterministic for same flag name with rollout', () => {
      FEATURE_FLAGS.flags.push({
        name: 'deterministic',
        enabled: true,
        rolloutPercentage: 50,
      });
      const result1 = FeatureFlags.isEnabled('deterministic');
      const result2 = FeatureFlags.isEnabled('deterministic');
      expect(result1).toBe(result2);
    });

    it('should return true for enabled flag with undefined rolloutPercentage', () => {
      FEATURE_FLAGS.flags.push({
        name: 'no_rollout',
        enabled: true,
      });
      expect(FeatureFlags.isEnabled('no_rollout')).toBe(true);
    });
  });

  describe('getAllFlags', () => {
    it('should return empty array when no flags defined', () => {
      const flags = FeatureFlags.getAllFlags();
      expect(flags).toEqual([]);
    });

    it('should return copy of flags array', () => {
      const flags1 = FeatureFlags.getAllFlags();
      const flags2 = FeatureFlags.getAllFlags();
      expect(flags1).not.toBe(flags2);
    });

    it('should return all defined flags', () => {
      FEATURE_FLAGS.flags.push({ name: 'flag1', enabled: true }, { name: 'flag2', enabled: false });
      const flags = FeatureFlags.getAllFlags();
      expect(flags).toHaveLength(2);
      expect(flags[0].name).toBe('flag1');
      expect(flags[1].name).toBe('flag2');
    });
  });

  describe('getFlag', () => {
    it('should return undefined for unknown flag', () => {
      expect(FeatureFlags.getFlag('unknown')).toBeUndefined();
    });

    it('should return the flag when it exists', () => {
      FEATURE_FLAGS.flags.push({
        name: 'my_flag',
        enabled: true,
        description: 'A test flag',
      });
      const result = FeatureFlags.getFlag('my_flag');
      expect(result).toBeDefined();
      expect(result?.name).toBe('my_flag');
      expect(result?.enabled).toBe(true);
      expect(result?.description).toBe('A test flag');
    });
  });

  describe('enable', () => {
    it('should not throw for unknown flag', () => {
      expect(() => FeatureFlags.enable('nonexistent')).not.toThrow();
    });

    it('should enable a disabled flag', () => {
      FEATURE_FLAGS.flags.push({
        name: 'toggle_flag',
        enabled: false,
      });
      FeatureFlags.enable('toggle_flag');
      const flag = FeatureFlags.getFlag('toggle_flag');
      expect(flag?.enabled).toBe(true);
    });
  });

  describe('disable', () => {
    it('should not throw for unknown flag', () => {
      expect(() => FeatureFlags.disable('nonexistent')).not.toThrow();
    });

    it('should disable an enabled flag', () => {
      FEATURE_FLAGS.flags.push({
        name: 'toggle_flag',
        enabled: true,
      });
      FeatureFlags.disable('toggle_flag');
      const flag = FeatureFlags.getFlag('toggle_flag');
      expect(flag?.enabled).toBe(false);
    });
  });

  describe('setRolloutPercentage', () => {
    it('should not throw for unknown flag', () => {
      expect(() => FeatureFlags.setRolloutPercentage('unknown', 50)).not.toThrow();
    });

    it('should set rollout percentage for existing flag', () => {
      FEATURE_FLAGS.flags.push({
        name: 'rollout_test',
        enabled: true,
      });
      FeatureFlags.setRolloutPercentage('rollout_test', 75);
      const flag = FeatureFlags.getFlag('rollout_test');
      expect(flag?.rolloutPercentage).toBe(75);
    });

    it('should clamp percentage to 0 minimum', () => {
      FEATURE_FLAGS.flags.push({
        name: 'clamp_test',
        enabled: true,
      });
      FeatureFlags.setRolloutPercentage('clamp_test', -10);
      const flag = FeatureFlags.getFlag('clamp_test');
      expect(flag?.rolloutPercentage).toBe(0);
    });

    it('should clamp percentage to 100 maximum', () => {
      FEATURE_FLAGS.flags.push({
        name: 'clamp_test',
        enabled: true,
      });
      FeatureFlags.setRolloutPercentage('clamp_test', 200);
      const flag = FeatureFlags.getFlag('clamp_test');
      expect(flag?.rolloutPercentage).toBe(100);
    });
  });

  describe('hashString (via isEnabled with rollout)', () => {
    it('should produce consistent results for the same flag name', () => {
      FEATURE_FLAGS.flags.push({
        name: 'hash_consistency',
        enabled: true,
        rolloutPercentage: 50,
      });
      const results = new Set<boolean>();
      for (let i = 0; i < 20; i++) {
        results.add(FeatureFlags.isEnabled('hash_consistency'));
      }
      expect(results.size).toBe(1);
    });

    it('should produce different results for different flag names', () => {
      const results = new Set<boolean>();
      for (let i = 0; i < 50; i++) {
        FEATURE_FLAGS.flags.push({
          name: `hash_diff_${i}`,
          enabled: true,
          rolloutPercentage: 50,
        });
        results.add(FeatureFlags.isEnabled(`hash_diff_${i}`));
      }
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('default export', () => {
    it('should export FeatureFlags as default', () => {
      const defaultExport = require('../feature-flags').default;
      expect(defaultExport).toBe(FeatureFlags);
    });
  });
});
