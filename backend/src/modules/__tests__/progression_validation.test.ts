/**
 * Tests for progression validation module.
 * Validates stat integrity, XP monotonicity, ability point calculations, and gear consistency.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validatePlayerStats,
  validateGearInventory,
  recordStatMutation,
  validateFullProgression,
} from '../progression_validation';
import { PlayerStats } from '../rpg_system';
import { PlayerInventory, GearItem } from '../gear_system';

describe('Progression Validation', () => {
  describe('validatePlayerStats', () => {
    let validStats: PlayerStats;

    beforeEach(() => {
      validStats = {
        user_id: 'test_user',
        level: 5,
        xp: 1600, // (5-1)^2 * 100 = 1600 for level 5
        ability_points: 4,
        stats: {
          attack: 15,
          defense: 15,
          dodge: 12,
          crit_rate: 8,
        },
      };
    });

    it('should accept valid player stats', () => {
      const result = validatePlayerStats(validStats);
      expect(result.is_valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect negative ability points', () => {
      validStats.ability_points = -1;
      const result = validatePlayerStats(validStats);
      expect(result.is_valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          category: 'ability_points',
        })
      );
    });

    it('should detect ability points exceeding level - 1', () => {
      validStats.ability_points = 10; // exceeds level - 1
      const result = validatePlayerStats(validStats);
      expect(result.is_valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          category: 'ability_points',
          message: expect.stringContaining('exceed'),
        })
      );
    });

    it('should detect XP decrease (monotonicity violation)', () => {
      const prevStats = { ...validStats, xp: 3000 };
      const result = validatePlayerStats(validStats, prevStats);
      expect(result.is_valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          category: 'xp_mutation',
          message: expect.stringContaining('decreased'),
        })
      );
    });

    it('should detect negative stat values', () => {
      validStats.stats.attack = -5;
      const result = validatePlayerStats(validStats);
      expect(result.is_valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          category: 'stat_validity',
        })
      );
    });

    it('should detect level/XP mismatch', () => {
      validStats.level = 10; // mismatch with xp=1600
      validStats.ability_points = 9; // adjust for level
      const result = validatePlayerStats(validStats);
      expect(result.is_valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          category: 'level_xp_mismatch',
        })
      );
    });

    it('should warn on impossible stat combinations', () => {
      validStats.stats = {
        attack: 150,
        defense: 150,
        dodge: 50,
        crit_rate: 50,
      };
      const result = validatePlayerStats(validStats);
      // Still valid from critical perspective, but has warnings
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'warning',
          category: 'impossible_stats',
        })
      );
    });
  });

  describe('validateGearInventory', () => {
    let validInventory: PlayerInventory;

    beforeEach(() => {
      const gear1: GearItem = {
        id: 'sword_1',
        name: 'Iron Sword',
        type: 'weapon',
        rarity: 'common',
        level: 1,
        timestamp: Date.now(),
        stats: [],
        modifiers: [],
      };

      const gear2: GearItem = {
        id: 'armor_1',
        name: 'Leather Armor',
        type: 'armor',
        rarity: 'common',
        level: 1,
        timestamp: Date.now(),
        stats: [],
        modifiers: [],
      };

      validInventory = {
        user_id: 'test_user',
        gear: [gear1, gear2],
        equipped_gear: {
          weapon: 'sword_1',
          armor: 'armor_1',
          accessory: null,
        },
        unlocked_modifier_pools: [],
      };
    });

    it('should accept valid gear inventory', () => {
      const result = validateGearInventory(validInventory);
      expect(result.is_valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing equipped gear', () => {
      validInventory.equipped_gear.weapon = 'nonexistent_gear';
      const result = validateGearInventory(validInventory);
      expect(result.is_valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          category: 'missing_equipped_gear',
        })
      );
    });

    it('should detect duplicate equipped gear', () => {
      validInventory.equipped_gear.weapon = 'armor_1';
      validInventory.equipped_gear.armor = 'armor_1';
      const result = validateGearInventory(validInventory);
      expect(result.is_valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          category: 'duplicate_equipped_gear',
        })
      );
    });

    it('should detect multiple helmets', () => {
      const helmet1: GearItem = {
        id: 'helmet_1',
        name: 'Iron Helmet',
        type: 'helmet',
        rarity: 'common',
        level: 1,
        timestamp: Date.now(),
        stats: [],
        modifiers: [],
      };

      const helmet2: GearItem = {
        id: 'helmet_2',
        name: 'Steel Helmet',
        type: 'helmet',
        rarity: 'rare',
        level: 2,
        timestamp: Date.now(),
        stats: [],
        modifiers: [],
      };

      validInventory.gear.push(helmet1, helmet2);
      validInventory.equipped_gear.armor = 'helmet_1';
      validInventory.equipped_gear.accessory = 'helmet_2';

      const result = validateGearInventory(validInventory);
      expect(result.is_valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          category: 'multiple_helmets',
        })
      );
    });

    it('should warn on invalid gear slot', () => {
      validInventory.equipped_gear['invalid_slot'] = 'sword_1';
      const result = validateGearInventory(validInventory);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'warning',
          category: 'invalid_gear_slot',
        })
      );
    });
  });

  describe('XP Monotonicity', () => {
    it('should enforce XP only increases', () => {
      const stats1: PlayerStats = {
        user_id: 'test',
        level: 2,
        xp: 100, // (2-1)^2 * 100 = 100
        ability_points: 1,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
      };

      const stats2: PlayerStats = {
        ...stats1,
        xp: 50, // decreased
      };

      const result = validatePlayerStats(stats2, stats1);
      expect(result.is_valid).toBe(false);
      expect(result.issues[0].category).toBe('xp_mutation');
    });
  });

  describe('Ability Points Calculation', () => {
    it('should validate ability_points = level - 1', () => {
      const stats: PlayerStats = {
        user_id: 'test',
        level: 5,
        xp: 1600, // (5-1)^2 * 100 = 1600
        ability_points: 3, // < 4, player may have spent points
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
      };

      const result = validatePlayerStats(stats);
      // Still valid if ability_points < level - 1 (player may have spent points)
      // But should fail if > level - 1
      expect(result.is_valid).toBe(true);

      // Now test with too many ability points
      stats.ability_points = 10;
      const result2 = validatePlayerStats(stats);
      expect(result2.is_valid).toBe(false);
    });
  });

  describe('Full Progression Validation', () => {
    it('should validate both player stats and gear inventory together', () => {
      const stats: PlayerStats = {
        user_id: 'test',
        level: 2,
        xp: 100,
        ability_points: 1,
        stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
      };

      const gear: GearItem = {
        id: 'sword_1',
        name: 'Sword',
        type: 'weapon',
        rarity: 'common',
        level: 1,
        timestamp: Date.now(),
        stats: [],
        modifiers: [],
      };

      const inventory: PlayerInventory = {
        user_id: 'test',
        gear: [gear],
        equipped_gear: { weapon: 'sword_1', armor: null, accessory: null },
        unlocked_modifier_pools: [],
      };

      // Mock Nakama interface (simplified for testing)
      const mockNk = {
        storageWrite: jest.fn(),
      } as any;

      const mockLogger = {
        warn: jest.fn(),
      } as any;

      const result = validateFullProgression(mockNk, 'test', mockLogger, stats, inventory);

      expect(result.is_valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
});
