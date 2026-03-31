/**
 * Tests for feature-flags utility
 */

import { FeatureFlags } from '../feature-flags';

describe('FeatureFlags', () => {
  describe('isEnabled', () => {
    it('should return defaultEnabled (false) when flag does not exist', () => {
      expect(FeatureFlags.isEnabled('nonexistent_flag')).toBe(false);
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
  });

  describe('getFlag', () => {
    it('should return undefined for unknown flag', () => {
      expect(FeatureFlags.getFlag('unknown')).toBeUndefined();
    });
  });

  describe('enable/disable', () => {
    it('should not throw for unknown flag', () => {
      expect(() => FeatureFlags.enable('nonexistent')).not.toThrow();
      expect(() => FeatureFlags.disable('nonexistent')).not.toThrow();
    });
  });

  describe('setRolloutPercentage', () => {
    it('should not throw for unknown flag', () => {
      expect(() => FeatureFlags.setRolloutPercentage('unknown', 50)).not.toThrow();
    });
  });

  describe('hashString', () => {
    it('should return consistent result for same input', () => {
      const result1 = FeatureFlags.isEnabled('consistent_hash');
      const result2 = FeatureFlags.isEnabled('consistent_hash');
      expect(result1).toBe(result2);
    });
  });
});
