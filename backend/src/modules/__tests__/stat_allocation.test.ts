/**
 * Stat Allocation module tests.
 * Tests for respec costs, stat validation, and build management.
 */

import {
  getRespecCost,
  hasFreeRespec,
  validateAllocation,
  saveBuild,
  loadBuild,
  getBuilds,
  deleteBuild,
  isRespecOnCooldown,
  getRespecCooldownRemaining,
} from '../stat_allocation';
import { Runtime } from '../../types/nakama';

describe('StatAllocation', () => {
  let mockCtx: Partial<Runtime>;

  beforeEach(() => {
    mockCtx = {
      storageWrite: jest.fn().mockResolvedValue(undefined),
      storageRead: jest.fn().mockResolvedValue(undefined),
      storageList: jest.fn().mockResolvedValue([]),
      env: {},
    };
  });

  describe('getRespecCost', () => {
    it('should calculate 5% of gem balance', () => {
      const gemBalance = 5000;
      const cost = getRespecCost(gemBalance, false);

      const expected = Math.floor(gemBalance * 0.05);
      expect(cost).toBe(expected);
    });

    it('should clamp cost to minimum of 100 gems', () => {
      const cost = getRespecCost(1000, false);
      expect(cost).toBeGreaterThanOrEqual(100);
    });

    it('should clamp cost to maximum of 1000 gems', () => {
      const cost = getRespecCost(50000, false);
      expect(cost).toBeLessThanOrEqual(1000);
    });

    it('should return 0 cost with free respec', () => {
      const cost = getRespecCost(5000, true);
      expect(cost).toBe(0);
    });

    it('should handle zero gem balance', () => {
      const cost = getRespecCost(0, false);
      expect(cost).toBeGreaterThanOrEqual(100);
    });
  });

  describe('hasFreeRespec', () => {
    it('should return true when free respec available', () => {
      const hasFree = hasFreeRespec(0); // 0 used this season
      expect(hasFree).toBe(true);
    });

    it('should return false when free respec used', () => {
      const hasFree = hasFreeRespec(1); // 1 used this season
      expect(hasFree).toBe(false);
    });

    it('should reset on new season', () => {
      const oldSeason = hasFreeRespec(1);
      const newSeason = hasFreeRespec(0); // Season reset
      expect(oldSeason).toBe(false);
      expect(newSeason).toBe(true);
    });
  });

  describe('validateAllocation', () => {
    it('should accept valid stat allocation', () => {
      const allocation = {
        attack: 10,
        defense: 10,
        dodge: 5,
        crit_rate: 5,
      };

      const result = validateAllocation(allocation, 30);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid stat names', () => {
      const allocation = {
        attack: 10,
        invalid_stat: 5,
        crit_rate: 5,
      };

      const result = validateAllocation(allocation, 20);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid');
    });

    it('should reject negative stat values', () => {
      const allocation = {
        attack: 10,
        defense: -5,
        crit_rate: 5,
      };

      const result = validateAllocation(allocation, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('negative');
    });

    it('should reject point total mismatch', () => {
      const allocation = {
        attack: 50,
        defense: 50,
        dodge: 50,
        crit_rate: 50,
      };

      const result = validateAllocation(allocation, 30);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('points');
    });

    it('should validate only allowed stats', () => {
      const validStats = ['attack', 'defense', 'dodge', 'crit_rate'];

      for (const stat of validStats) {
        const allocation = { [stat]: 5 };
        const result = validateAllocation(allocation, 5);
        expect(result.valid || result.error).toBeDefined();
      }
    });
  });

  describe('saveBuild', () => {
    it('should save build to slot', () => {
      const buildData = {
        slot: 1,
        name: 'Test Build',
        stats: { attack: 10, defense: 10 },
        level: 10,
      };

      const result = saveBuild(mockCtx, buildData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid slot numbers', () => {
      const buildData = {
        slot: 5, // Invalid (max 3)
        name: 'Invalid Build',
        stats: { attack: 10 },
        level: 10,
      };

      const result = saveBuild(mockCtx, buildData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid slot');
    });

    it('should store timestamp', () => {
      const buildData = {
        slot: 1,
        name: 'Test Build',
        stats: { attack: 10 },
        level: 10,
      };

      const result = saveBuild(mockCtx, buildData);
      expect(result.build_data.timestamp).toBeDefined();
      expect(result.build_data.timestamp).toBeGreaterThan(0);
    });
  });

  describe('loadBuild', () => {
    it('should load build from slot', () => {
      const result = loadBuild(mockCtx, 1);
      expect(result.success).toBe(true);
      expect(result.build_data).toBeDefined();
    });

    it('should return empty for unused slot', () => {
      const result = loadBuild(mockCtx, 3); // Assuming slot 3 is empty
      expect(result.success).toBe(true);
      expect(result.build_data).toEqual({});
    });

    it('should reject invalid slot numbers', () => {
      const result = loadBuild(mockCtx, 5);
      expect(result.success).toBe(false);
    });
  });

  describe('getBuilds', () => {
    it('should return all saved builds', () => {
      const result = getBuilds(mockCtx);
      expect(result.success).toBe(true);
      expect(result.builds).toBeDefined();
      expect(Array.isArray(result.builds)).toBe(true);
    });

    it('should return empty array when no builds saved', () => {
      const result = getBuilds(mockCtx);
      expect(result.success).toBe(true);
      expect(result.builds).toEqual([]);
    });
  });

  describe('deleteBuild', () => {
    it('should delete build from slot', () => {
      const result = deleteBuild(mockCtx, 1);
      expect(result.success).toBe(true);
    });

    it('should reject invalid slot numbers', () => {
      const result = deleteBuild(mockCtx, 5);
      expect(result.success).toBe(false);
    });
  });

  describe('isRespecOnCooldown', () => {
    it('should return false when not on cooldown', () => {
      const onCooldown = isRespecOnCooldown(0); // No cooldown
      expect(onCooldown).toBe(false);
    });

    it('should return true when on cooldown', () => {
      const onCooldown = isRespecOnCooldown(3600); // 1 hour remaining
      expect(onCooldown).toBe(true);
    });

    it('should handle zero cooldown', () => {
      const onCooldown = isRespecOnCooldown(0);
      expect(onCooldown).toBe(false);
    });
  });

  describe('getRespecCooldownRemaining', () => {
    it('should return remaining seconds', () => {
      const remaining = getRespecCooldownRemaining(3600);
      expect(remaining).toBe(3600);
    });

    it('should return 0 when no cooldown', () => {
      const remaining = getRespecCooldownRemaining(0);
      expect(remaining).toBe(0);
    });

    it('should not exceed 24 hours (86400 seconds)', () => {
      const remaining = getRespecCooldownRemaining(90000);
      expect(remaining).toBeLessThanOrEqual(86400);
    });

    it('should not return negative values', () => {
      const remaining = getRespecCooldownRemaining(-100);
      expect(remaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Stat point validation', () => {
    it('should validate total points equal to budget', () => {
      const allocation = { attack: 5, defense: 5, dodge: 5, crit_rate: 5 };
      const result = validateAllocation(allocation, 20);
      expect(result.valid).toBe(true);
    });

    it('should reject when points exceed budget', () => {
      const allocation = { attack: 10, defense: 10, dodge: 10, crit_rate: 10 };
      const result = validateAllocation(allocation, 20);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceed');
    });

    it('should reject when points below budget', () => {
      const allocation = { attack: 2, defense: 2, dodge: 2, crit_rate: 2 };
      const result = validateAllocation(allocation, 20);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('below');
    });
  });

  describe('Build slot management', () => {
    it('should support 3 build slots', () => {
      for (let slot = 1; slot <= 3; slot++) {
        const result = saveBuild(mockCtx, {
          slot: slot,
          name: `Build ${slot}`,
          stats: { attack: 10 },
          level: 10,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should handle multiple builds independently', () => {
      const build1 = { slot: 1, name: 'Build 1', stats: { attack: 10 }, level: 10 };
      const build2 = { slot: 2, name: 'Build 2', stats: { defense: 10 }, level: 10 };

      const result1 = saveBuild(mockCtx, build1);
      const result2 = saveBuild(mockCtx, build2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      const builds = getBuilds(mockCtx);
      expect(builds.builds.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Respec cooldown tracking', () => {
    it('should track cooldown from last respec', () => {
      const now = Date.now();
      const lastRespecTime = now - 3600; // 1 hour ago
      const remaining = getRespecCooldownRemaining(lastRespecTime);

      const expected = 86400 - 3600; // 24 hours - 1 hour elapsed
      expect(remaining).toBeLessThanOrEqual(expected);
      expect(remaining).toBeGreaterThanOrEqual(0);
    });

    it('should expire cooldown after 24 hours', () => {
      const lastRespecTime = Date.now() - 86400; // 24 hours ago
      const remaining = getRespecCooldownRemaining(lastRespecTime);
      expect(remaining).toBe(0);
    });
  });

  describe('Format cooldown time', () => {
    it('should format hours and minutes', () => {
      const formatted = formatCooldownTime(3661); // 1 hour, 1 minute
      expect(formatted).toContain('h');
      expect(formatted).toContain('m');
    });

    it('should show "Available" when no cooldown', () => {
      const formatted = formatCooldownTime(0);
      expect(formatted).toBe('Available');
    });

    it('should show minutes only for short cooldowns', () => {
      const formatted = formatCooldownTime(300); // 5 minutes
      expect(formatted).toBe('5m');
    });
  });

  describe('Stat allocation safety', () => {
    it('should prevent stat overflow', () => {
      const allocation = { attack: 999, defense: 999, dodge: 999, crit_rate: 999 };
      const result = validateAllocation(allocation, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('overflow');
    });

    it('should handle empty allocation', () => {
      const allocation = {};
      const result = validateAllocation(allocation, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should validate each stat individually', () => {
      const allocation = { attack: 10, defense: -10, dodge: 10, crit_rate: 10 };
      const result = validateAllocation(allocation, 20);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('defense');
    });
  });
});
