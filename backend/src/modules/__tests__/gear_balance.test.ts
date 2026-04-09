/**
 * Gear Balance module tests.
 * Tests for gear stat validation, power calculations, and synergy bonuses.
 */

import {
  validateGearStats,
  calculateGearPower,
  calculateEffectiveStat,
  trackGearUsage,
  getGearUsageStats,
  recordBalanceAdjustment,
  calculateSynergyBonus,
  isGearPowerValid,
} from '../gear_balance';
import { GearItem, GearStat } from '../gear_system';
import { Runtime } from '../../types/nakama';

describe('GearBalance', () => {
  let mockCtx: Partial<Runtime>;

  beforeEach(() => {
    mockCtx = {
      storageWrite: jest.fn().mockResolvedValue(undefined),
      storageRead: jest.fn().mockResolvedValue([]),
      storageList: jest.fn().mockResolvedValue([]),
      env: {},
    };
  });

  describe('validateGearStats', () => {
    it('should validate gear within power threshold', () => {
      const gear: GearItem = {
        id: 'test-gear-1',
        name: 'Test Helm',
        rarity: 'common',
        type: 'helm',
        stats: [
          { name: 'defense', base_value: 5, value: 5 },
          { name: 'health', base_value: 20, value: 20 },
        ],
        modifiers: [],
        level: 1,
        timestamp: Date.now(),
      };

      const result = validateGearStats(gear);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject gear exceeding power threshold for rarity', () => {
      const gear: GearItem = {
        id: 'test-gear-2',
        name: 'Overpowered Helm',
        rarity: 'common',
        type: 'helm',
        stats: [
          { name: 'defense', base_value: 50, value: 50 },
          { name: 'health', base_value: 200, value: 200 },
          { name: 'attack', base_value: 50, value: 50 },
        ],
        modifiers: [],
        level: 1,
        timestamp: Date.now(),
      };

      const result = validateGearStats(gear);

      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('exceeds threshold');
    });

    it('should reject gear with individual stat exceeding max', () => {
      const gear: GearItem = {
        id: 'test-gear-3',
        name: 'Invalid Helm',
        rarity: 'legendary',
        type: 'helm',
        stats: [
          { name: 'defense', base_value: 150, value: 150 }, // Exceeds max of 100
        ],
        modifiers: [],
        level: 1,
        timestamp: Date.now(),
      };

      const result = validateGearStats(gear);

      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('exceeds maximum');
    });
  });

  describe('calculateGearPower', () => {
    it('should calculate power for common gear', () => {
      const gear: GearItem = {
        id: 'test-gear-4',
        name: 'Common Bow',
        rarity: 'common',
        type: 'bow',
        stats: [
          { name: 'attack', base_value: 10, value: 10 },
          { name: 'crit_rate', base_value: 5, value: 5 },
        ],
        modifiers: [],
        level: 1,
        timestamp: Date.now(),
      };

      const power = calculateGearPower(gear);

      expect(power).toBeGreaterThan(0);
      expect(power).toBeLessThan(20); // Common should be below 20
    });

    it('should calculate higher power for legendary gear', () => {
      const gear: GearItem = {
        id: 'test-gear-5',
        name: 'Legendary Bow',
        rarity: 'legendary',
        type: 'bow',
        stats: [
          { name: 'attack', base_value: 50, value: 50 },
          { name: 'crit_rate', base_value: 20, value: 20 },
        ],
        modifiers: [
          {
            id: 'test-modifier',
            name: 'Test Modifier',
            description: 'Test',
            stat: 'attack',
            value_range: [10, 20],
            rarity: 'legendary',
            boss_unlock: null,
          },
        ],
        level: 1,
        timestamp: Date.now(),
      };

      const power = calculateGearPower(gear);

      expect(power).toBeGreaterThan(60);
      expect(power).toBeLessThanOrEqual(100);
    });

    it('should cap power at 100', () => {
      const gear: GearItem = {
        id: 'test-gear-6',
        name: 'Super Gear',
        rarity: 'legendary',
        type: 'helm',
        stats: [
          { name: 'defense', base_value: 200, value: 200 },
          { name: 'health', base_value: 1000, value: 1000 },
          { name: 'attack', base_value: 200, value: 200 },
        ],
        modifiers: [
          {
            id: 'test-modifier',
            name: 'Test Modifier',
            description: 'Test',
            stat: 'attack',
            value_range: [50, 100],
            rarity: 'legendary',
            boss_unlock: null,
          },
        ],
        level: 1,
        timestamp: Date.now(),
      };

      const power = calculateGearPower(gear);

      expect(power).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateEffectiveStat', () => {
    it('should return base stat when below soft cap', () => {
      const effective = calculateEffectiveStat(10, 0, 'helm', 'defense');

      expect(effective).toBeCloseTo(10, 1);
    });

    it('should apply diminishing returns near soft cap', () => {
      // 70% of 100 = 70 soft cap
      // At 60, we're at 85% of cap, so diminishing returns should apply
      const effective = calculateEffectiveStat(60, 0, 'helm', 'defense');

      expect(effective).toBeLessThan(60);
      expect(effective).toBeGreaterThan(30); // Should still have significant value
    });

    it('should apply synergy bonus', () => {
      const baseEffective = calculateEffectiveStat(60, 0, 'helm', 'defense');
      const withSynergy = calculateEffectiveStat(60, 0.1, 'helm', 'defense');

      expect(withSynergy).toBeGreaterThan(baseEffective);
    });

    it('should not return negative values', () => {
      const effective = calculateEffectiveStat(0, 0, 'helm', 'defense');

      expect(effective).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateSynergyBonus', () => {
    it('should return empty bonuses for no synergy pieces', () => {
      const equippedGear = {
        helm: 'helm_basic',
        armor: 'armor_leather',
      };

      const bonuses = calculateSynergyBonus(equippedGear);

      expect(Object.keys(bonuses).length).toBe(0);
    });

    it('should apply 2-piece bonus', () => {
      const equippedGear = {
        helm: 'helm_dragon',
        armor: 'armor_plate',
      };

      const bonuses = calculateSynergyBonus(equippedGear);

      expect(bonuses.attack).toBe(5);
    });

    it('should apply multiple bonuses for full set', () => {
      const equippedGear = {
        helm: 'helm_dragon',
        armor: 'armor_plate',
        bow: 'bow_crossbow',
        arrow: 'arrow_dragon',
        amulet: 'amulet_dragon',
      };

      const bonuses = calculateSynergyBonus(equippedGear);

      expect(bonuses.attack).toBe(5);
      expect(bonuses.crit_rate).toBe(3);
      expect(bonuses.health).toBe(50);
      expect(bonuses.all_multiplier).toBe(0.1); // 10%
    });
  });

  describe('isGearPowerValid', () => {
    it('should return true for valid gear', () => {
      const gear: GearItem = {
        id: 'test-gear-7',
        name: 'Valid Gear',
        rarity: 'rare',
        type: 'bow',
        stats: [{ name: 'attack', base_value: 20, value: 20 }],
        modifiers: [],
        level: 1,
        timestamp: Date.now(),
      };

      expect(isGearPowerValid(gear)).toBe(true);
    });

    it('should return false for invalid gear', () => {
      const gear: GearItem = {
        id: 'test-gear-8',
        name: 'Invalid Gear',
        rarity: 'common',
        type: 'helm',
        stats: [{ name: 'defense', base_value: 150, value: 150 }],
        modifiers: [],
        level: 1,
        timestamp: Date.now(),
      };

      expect(isGearPowerValid(gear)).toBe(false);
    });
  });

  describe('trackGearUsage', () => {
    it('should track equip action', async () => {
      await trackGearUsage(mockCtx as Runtime, 'user-123', 'gear-456', 'equip');

      expect(mockCtx.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: 'gear_balance',
          key: 'gear_usage:user-123:gear-456',
        }),
      ]);
    });

    it('should track generate action', async () => {
      await trackGearUsage(mockCtx as Runtime, 'user-123', 'gear-789', 'generate');

      expect(mockCtx.storageWrite).toHaveBeenCalled();
    });
  });

  describe('recordBalanceAdjustment', () => {
    it('should record balance adjustment', async () => {
      const adjustment = {
        gearId: 'gear-123',
        stat: 'attack',
        oldValue: 10,
        newValue: 12,
        reason: 'Game balance tuning',
      };

      await recordBalanceAdjustment(mockCtx as Runtime, adjustment);

      expect(mockCtx.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: 'gear_balance_history',
        }),
      ]);
    });
  });

  describe('getGearUsageStats', () => {
    it('should return empty object when no usage data', async () => {
      const stats = await getGearUsageStats(mockCtx as Runtime, 'user-123');

      expect(Object.keys(stats).length).toBe(0);
    });

    it('should return usage stats when data exists', async () => {
      const mockObjects = [
        {
          key: 'gear_usage:user-123:gear-1',
          value: JSON.stringify({ count: 5, lastAction: 'equip', lastTimestamp: 123456 }),
        },
      ];

      mockCtx.storageList = jest.fn().mockResolvedValue(mockObjects as any);

      const stats = await getGearUsageStats(mockCtx as Runtime, 'user-123');

      expect(stats['gear-1']).toBeDefined();
      expect(stats['gear-1'].count).toBe(5);
    });
  });
});
