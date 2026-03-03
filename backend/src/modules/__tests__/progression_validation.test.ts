/**
 * Tests for progression validation module.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validatePlayerStats,
  validateGearInventory,
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

      validInventory = {
        user_id: 'test_user',
        gear: [gear1],
        equipped_gear: {
          weapon: 'sword_1',
          armor: null,
          accessory: null,
        },
        unlocked_modifier_pools: [],
      };
    });

    it('should accept valid gear inventory', () => {
      const result = validateGearInventory(validInventory);
      expect(result.is_valid).toBe(true);
    });

    it('should detect missing equipped gear', () => {
      validInventory.equipped_gear.weapon = 'nonexistent';
      const result = validateGearInventory(validInventory);
      expect(result.is_valid).toBe(false);
    });
  });
});
