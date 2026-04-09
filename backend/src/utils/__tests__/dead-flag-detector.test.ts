/**
 * Tests for dead-flag-detector utility
 */

import { DeadFlagDetector } from '../dead-flag-detector';

// Mock feature-flags
jest.mock('../feature-flags', () => ({
  FeatureFlags: {
    getAllFlags: jest.fn().mockReturnValue([
      { name: 'active_flag', enabled: true, description: 'An active flag' },
      {
        name: 'disabled_flag',
        enabled: false,
        rolloutPercentage: 0,
        description: 'A disabled flag',
      },
      { name: 'rollout_flag', enabled: true, rolloutPercentage: 50, description: 'A rollout flag' },
    ]),
  },
}));

describe('dead-flag-detector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findUnusedFlags', () => {
    it('should return empty array (placeholder implementation)', async () => {
      const unused = await DeadFlagDetector.findUnusedFlags();
      expect(Array.isArray(unused)).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should return a report with all flags', async () => {
      const report = await DeadFlagDetector.generateReport();

      expect(report).toHaveProperty('unusedDefinitions');
      expect(report).toHaveProperty('usedButNotDefined');
      expect(report).toHaveProperty('allFlags');
      expect(report).toHaveProperty('timestamp');

      expect(Array.isArray(report.allFlags)).toBe(true);
      expect(report.allFlags.length).toBeGreaterThan(0);

      const firstFlag = report.allFlags[0];
      expect(firstFlag).toHaveProperty('name');
      expect(firstFlag).toHaveProperty('isDefined');
      expect(firstFlag).toHaveProperty('isUsed');
      expect(firstFlag).toHaveProperty('locations');
    });

    it('should have current timestamp', async () => {
      const report = await DeadFlagDetector.generateReport();
      const now = Date.now();
      expect(report.timestamp).toBeLessThanOrEqual(now);
      expect(report.timestamp).toBeGreaterThan(now - 1000);
    });
  });

  describe('findDeprecatedFlags', () => {
    it('should find flags that are disabled with 0 rollout', async () => {
      const deprecated = await DeadFlagDetector.findDeprecatedFlags();
      expect(Array.isArray(deprecated)).toBe(true);
      // disabled_flag has enabled=false and rolloutPercentage=0
      expect(deprecated).toContain('disabled_flag');
    });

    it('should not include enabled flags', async () => {
      const deprecated = await DeadFlagDetector.findDeprecatedFlags();
      expect(deprecated).not.toContain('active_flag');
      expect(deprecated).not.toContain('rollout_flag');
    });
  });
});
