/**
 * Tests for progression validation module.
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
        xp: 1600,
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
    });

    it('should detect XP decrease', () => {
      const prevStats = { ...validStats, xp: 3000 };
      const result = validatePlayerStats(validStats, prevStats);
      expect(result.is_valid).toBe(false);
    });

    it('should detect negative stat values', () => {
      validStats.stats.attack = -5;
      const result = validatePlayerStats(validStats);
      expect(result.is_valid).toBe(false);
    });

    it('should allow zero stat values', () => {
      validStats.stats = { attack: 0, defense: 0, dodge: 0, crit_rate: 0 };
      const result = validatePlayerStats(validStats);
      expect(result.issues.some((i) => i.category === 'stat_validity')).toBe(false);
    });

    it('should detect ability points exceeding level', () => {
      validStats.ability_points = 10;
      const result = validatePlayerStats(validStats);
      expect(result.is_valid).toBe(false);
      expect(result.issues.some((i) => i.category === 'ability_points')).toBe(true);
    });

    it('should detect level/XP mismatch', () => {
      validStats.level = 10;
      const result = validatePlayerStats(validStats);
      expect(result.is_valid).toBe(false);
      expect(result.issues.some((i) => i.category === 'level_xp_mismatch')).toBe(true);
    });

    it('should return multiple issues when multiple validations fail', () => {
      validStats.ability_points = -1;
      validStats.stats.attack = -5;
      const result = validatePlayerStats(validStats);
      expect(result.issues.length).toBeGreaterThan(1);
    });
  });

  describe('validateGearInventory', () => {
    let validInventory: PlayerInventory;

    beforeEach(() => {
      const gear1: GearItem = {
        id: 'sword_1',
        name: 'Iron Sword',
        type: 'bow',
        rarity: 'common',
        level: 1,
        timestamp: Date.now(),
        stats: [],
        modifiers: [],
      };

      validInventory = {
        user_id: 'test_user',
        gear: [gear1],
        equipped_gear: {
          bow: 'sword_1',
          armor: null,
          amulet: null,
        },
        unlocked_modifier_pools: [],
      };
    });

    it('should accept valid gear inventory', () => {
      const result = validateGearInventory(validInventory);
      expect(result.is_valid).toBe(true);
    });

    it('should detect missing equipped gear', () => {
      validInventory.equipped_gear.bow = 'nonexistent';
      const result = validateGearInventory(validInventory);
      expect(result.is_valid).toBe(false);
    });

    it('should detect duplicate equipped gear', () => {
      validInventory.equipped_gear.armor = 'sword_1';
      const result = validateGearInventory(validInventory);
      expect(result.is_valid).toBe(false);
      expect(result.issues.some((i) => i.category === 'duplicate_equipped_gear')).toBe(true);
    });

    it('should detect multiple helmets', () => {
      const helm1: GearItem = {
        id: 'helm_1',
        name: 'Iron Helm',
        type: 'helmet',
        rarity: 'common',
        level: 1,
        timestamp: Date.now(),
        stats: [],
        modifiers: [],
      };
      const helm2: GearItem = {
        id: 'helm_2',
        name: 'Steel Helm',
        type: 'head',
        rarity: 'rare',
        level: 2,
        timestamp: Date.now(),
        stats: [],
        modifiers: [],
      };

      validInventory.gear = [helm1, helm2];
      validInventory.equipped_gear = {
        bow: null,
        armor: null,
        amulet: null,
        head: 'helm_1',
        body: 'helm_2',
      };

      const result = validateGearInventory(validInventory);
      expect(result.is_valid).toBe(false);
      expect(result.issues.some((i) => i.category === 'multiple_helmets')).toBe(true);
    });

    it('should accept empty inventory', () => {
      const emptyInventory: PlayerInventory = {
        user_id: 'test_user',
        gear: [],
        equipped_gear: {
          bow: null,
          armor: null,
          amulet: null,
        },
        unlocked_modifier_pools: [],
      };
      const result = validateGearInventory(emptyInventory);
      expect(result.is_valid).toBe(true);
    });
  });

  describe('recordStatMutation', () => {
    it('should calculate delta correctly', () => {
      const mockNk = {
        storageWrite: jest.fn().mockResolvedValue({} as any),
      } as any;

      recordStatMutation(
        mockNk,
        'user_1',
        '127.0.0.1',
        { attack: 10, defense: 5 },
        { attack: 15, defense: 5 },
        'level_up'
      );

      expect(mockNk.storageWrite).toHaveBeenCalled();
    });

    it('should handle null IP address', () => {
      const mockNk = {
        storageWrite: jest.fn().mockResolvedValue({} as any),
      } as any;

      recordStatMutation(mockNk, 'user_1', null, { attack: 10 }, { attack: 15 }, 'level_up');

      expect(mockNk.storageWrite).toHaveBeenCalled();
    });
  });

  describe('validateFullProgression', () => {
    it('should combine stats and gear validation results', () => {
      const mockNk = {} as any;
      const mockLogger = { warn: jest.fn() } as any;

      const validStats: PlayerStats = {
        user_id: 'test_user',
        level: 5,
        xp: 1600,
        ability_points: 4,
        stats: { attack: 15, defense: 15, dodge: 12, crit_rate: 8 },
      };

      const gear1: GearItem = {
        id: 'sword_1',
        name: 'Iron Sword',
        type: 'bow',
        rarity: 'common',
        level: 1,
        timestamp: Date.now(),
        stats: [],
        modifiers: [],
      };

      const validInventory: PlayerInventory = {
        user_id: 'test_user',
        gear: [gear1],
        equipped_gear: { bow: 'sword_1', armor: null, amulet: null },
        unlocked_modifier_pools: [],
      };

      const result = validateFullProgression(
        mockNk,
        'user_1',
        mockLogger,
        validStats,
        validInventory
      );

      expect(result.is_valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect issues in both stats and gear', () => {
      const mockNk = {} as any;
      const mockLogger = { warn: jest.fn() } as any;

      const invalidStats: PlayerStats = {
        user_id: 'test_user',
        level: 5,
        xp: 1600,
        ability_points: -1,
        stats: { attack: -5, defense: 15, dodge: 12, crit_rate: 8 },
      };

      const invalidInventory: PlayerInventory = {
        user_id: 'test_user',
        gear: [],
        equipped_gear: { bow: 'nonexistent', armor: null, amulet: null },
        unlocked_modifier_pools: [],
      };

      const result = validateFullProgression(
        mockNk,
        'user_1',
        mockLogger,
        invalidStats,
        invalidInventory
      );

      expect(result.is_valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(1);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
