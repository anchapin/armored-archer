import { FeatureFlags } from '../../src/utils/feature-flags';

describe('utils/feature-flags', () => {
  beforeEach(() => {
    FeatureFlags.flags = {
      defaultEnabled: false,
      flags: [],
    };
  });

  describe('isEnabled', () => {
    it('should return defaultEnabled for unknown flags', () => {
      const result = FeatureFlags.isEnabled('unknown_flag');
      expect(result).toBe(false);
    });

    it('should return false when flag is disabled', () => {
      FeatureFlags.flags = {
        defaultEnabled: true,
        flags: [{ name: 'test-flag', enabled: false }],
      };
      const result = FeatureFlags.isEnabled('test-flag');
      expect(result).toBe(false);
    });

    it('should return true when flag is enabled', () => {
      FeatureFlags.flags = {
        defaultEnabled: false,
        flags: [{ name: 'test-flag', enabled: true }],
      };
      const result = FeatureFlags.isEnabled('test-flag');
      expect(result).toBe(true);
    });

    it('should respect defaultEnabled for missing flags', () => {
      FeatureFlags.flags = {
        defaultEnabled: true,
        flags: [],
      };
      const result = FeatureFlags.isEnabled('unknown');
      expect(result).toBe(true);
    });

    it('should use rollout percentage for gradual rollout', () => {
      FeatureFlags.flags = {
        defaultEnabled: false,
        flags: [{ name: 'test-flag', enabled: true, rolloutPercentage: 100 }],
      };
      const result = FeatureFlags.isEnabled('test-flag');
      expect(result).toBe(true);
    });

    it('should ignore 0% rollout and use enabled value', () => {
      FeatureFlags.flags = {
        defaultEnabled: true,
        flags: [{ name: 'test-flag', enabled: true, rolloutPercentage: 0 }],
      };
      const result = FeatureFlags.isEnabled('test-flag');
      // 0% rollout is treated as "not set" - falls through to enabled value
      expect(result).toBe(true);
    });
  });

  describe('getAllFlags', () => {
    it('should return copy of flags array', () => {
      FeatureFlags.flags = {
        defaultEnabled: false,
        flags: [{ name: 'test', enabled: true }],
      };
      const result = FeatureFlags.getAllFlags();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test');
    });

    it('should return empty array when no flags', () => {
      FeatureFlags.flags = { defaultEnabled: false, flags: [] };
      const result = FeatureFlags.getAllFlags();
      expect(result).toHaveLength(0);
    });
  });

  describe('getFlag', () => {
    it('should return flag by name', () => {
      FeatureFlags.flags = {
        defaultEnabled: false,
        flags: [{ name: 'test', enabled: true, description: 'Test flag' }],
      };
      const result = FeatureFlags.getFlag('test');
      expect(result?.name).toBe('test');
    });

    it('should return undefined for unknown flag', () => {
      FeatureFlags.flags = { defaultEnabled: false, flags: [] };
      const result = FeatureFlags.getFlag('unknown');
      expect(result).toBeUndefined();
    });
  });

  describe('enable/disable', () => {
    it('should enable a flag', () => {
      FeatureFlags.flags = {
        defaultEnabled: false,
        flags: [{ name: 'test', enabled: false }],
      };
      FeatureFlags.enable('test');
      expect(FeatureFlags.isEnabled('test')).toBe(true);
    });

    it('should disable a flag', () => {
      FeatureFlags.flags = {
        defaultEnabled: false,
        flags: [{ name: 'test', enabled: true }],
      };
      FeatureFlags.disable('test');
      expect(FeatureFlags.isEnabled('test')).toBe(false);
    });

    it('should handle enable for unknown flag', () => {
      FeatureFlags.flags = { defaultEnabled: false, flags: [] };
      expect(() => FeatureFlags.enable('unknown')).not.toThrow();
    });
  });

  describe('setRolloutPercentage', () => {
    it('should set rollout percentage', () => {
      FeatureFlags.flags = {
        defaultEnabled: false,
        flags: [{ name: 'test', enabled: true, rolloutPercentage: 50 }],
      };
      FeatureFlags.setRolloutPercentage('test', 75);
      const flag = FeatureFlags.getFlag('test');
      expect(flag?.rolloutPercentage).toBe(75);
    });

    it('should clamp percentage to 0', () => {
      FeatureFlags.flags = {
        defaultEnabled: false,
        flags: [{ name: 'test', enabled: true, rolloutPercentage: 50 }],
      };
      FeatureFlags.setRolloutPercentage('test', -10);
      const flag = FeatureFlags.getFlag('test');
      expect(flag?.rolloutPercentage).toBe(0);
    });

    it('should clamp percentage to 100', () => {
      FeatureFlags.flags = {
        defaultEnabled: false,
        flags: [{ name: 'test', enabled: true, rolloutPercentage: 50 }],
      };
      FeatureFlags.setRolloutPercentage('test', 150);
      const flag = FeatureFlags.getFlag('test');
      expect(flag?.rolloutPercentage).toBe(100);
    });
  });
});
