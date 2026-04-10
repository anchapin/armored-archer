/**
 * Tests for weapon_balance module
 */

import {
  calculatePvpDamage,
  calculateWeaponPowerRating,
  validateWeaponPower,
  WeaponTier,
  WEAPON_BALANCE_CONSTANTS,
} from '../weapon_balance';
import { Runtime } from '../types/nakama';

describe('weapon_balance', () => {
  describe('calculatePvpDamage', () => {
    it('should calculate PvP damage with tier multiplier', () => {
      const baseDamage = 100;
      const tier = WeaponTier.LEGENDARY;
      const result = calculatePvpDamage(baseDamage, tier);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(baseDamage * WEAPON_BALANCE_CONSTANTS.MAX_DAMAGE_PERCENTAGE);
    });

    it('should apply PvP damage reduction', () => {
      const baseDamage = 100;
      const tier = WeaponTier.COMMON;
      const pvpDamage = calculatePvpDamage(baseDamage, tier, {});

      // PvP damage should be reduced
      const expectedReduction = baseDamage * WEAPON_BALANCE_CONSTANTS.PVP_DAMAGE_REDUCTION;
      expect(pvpDamage).toBeLessThan(expectedReduction + 50); // Allow for curve
    });

    it('should apply stat bonuses correctly', () => {
      // Use a base damage below the cap so stat bonuses have room to take effect
      // For RARE tier, the cap is 19.5, so we need base damage < 13
      const baseDamage = 10;
      const tier = WeaponTier.RARE;
      const stats = { attack: 10, ability_power: 5 };

      const result = calculatePvpDamage(baseDamage, tier, stats);
      const baseResult = calculatePvpDamage(baseDamage, tier, {});

      // Stat bonuses should increase damage
      // attack adds 10 * 0.5 = 5
      // ability_power adds 5 * 0.3 = 1.5
      // After PvP reduction (0.85): ~5.525 bonus
      expect(result).toBeGreaterThan(baseResult);

      // Verify the difference accounts for stat contributions
      const difference = result - baseResult;
      expect(difference).toBeGreaterThan(0);
      expect(difference).toBeCloseTo(5.5, 1); // Should be around 5.5 after reduction
    });

    it('should enforce maximum damage cap', () => {
      const baseDamage = 500;
      const tier = WeaponTier.COMMON;
      const result = calculatePvpDamage(baseDamage, tier);

      // Should not exceed 200% of tier average
      expect(result).toBeLessThan(500);
    });

    it('should handle negative base damage', () => {
      const baseDamage = -10;
      const tier = WeaponTier.COMMON;
      const result = calculatePvpDamage(baseDamage, tier);

      expect(result).toBe(0);
    });

    it('should apply damage curve with diminishing returns', () => {
      const tier = WeaponTier.LEGENDARY;

      // Test low damage - linear scaling
      const lowDamage = calculatePvpDamage(20, tier);
      const mediumDamage = calculatePvpDamage(100, tier);
      const highDamage = calculatePvpDamage(200, tier);

      // High damage should not scale linearly
      const lowToMediumRatio = mediumDamage / lowDamage;
      const mediumToHighRatio = highDamage / mediumDamage;

      expect(mediumToHighRatio).toBeLessThan(lowToMediumRatio);
    });

    it('should calculate different damage for each tier', () => {
      const baseDamage = 50;

      const commonDamage = calculatePvpDamage(baseDamage, WeaponTier.COMMON);
      const rareDamage = calculatePvpDamage(baseDamage, WeaponTier.RARE);
      const epicDamage = calculatePvpDamage(baseDamage, WeaponTier.EPIC);
      const legendaryDamage = calculatePvpDamage(baseDamage, WeaponTier.LEGENDARY);

      expect(commonDamage).toBeLessThan(rareDamage);
      expect(rareDamage).toBeLessThan(epicDamage);
      expect(epicDamage).toBeLessThan(legendaryDamage);
    });
  });

  describe('calculateWeaponPowerRating', () => {
    it('should calculate base power from tier', () => {
      const weaponData = {
        gear_type: 'bow',
        rarity: WeaponTier.COMMON,
      };

      const result = calculateWeaponPowerRating(weaponData);

      // Common tier (0) = 100 * (0 + 1) = 100 base power
      expect(result).toBe(100);
    });

    it('should scale power with tier', () => {
      const commonWeapon = { gear_type: 'bow', rarity: WeaponTier.COMMON };
      const rareWeapon = { gear_type: 'bow', rarity: WeaponTier.RARE };
      const epicWeapon = { gear_type: 'bow', rarity: WeaponTier.EPIC };
      const legendaryWeapon = { gear_type: 'bow', rarity: WeaponTier.LEGENDARY };

      const commonPower = calculateWeaponPowerRating(commonWeapon);
      const rarePower = calculateWeaponPowerRating(rareWeapon);
      const epicPower = calculateWeaponPowerRating(epicWeapon);
      const legendaryPower = calculateWeaponPowerRating(legendaryWeapon);

      // Base power = 100 * (tier + 1)
      expect(commonPower).toBe(100 * (0 + 1)); // 100
      expect(rarePower).toBe(100 * (1 + 1)); // 200
      expect(epicPower).toBe(100 * (2 + 1)); // 300
      expect(legendaryPower).toBe(100 * (3 + 1)); // 400
    });

    it('should add power from attack stat', () => {
      const weaponData = {
        gear_type: 'bow',
        rarity: WeaponTier.COMMON,
        stats: { attack: 20 },
      };

      const result = calculateWeaponPowerRating(weaponData);

      // 100 base + (20 attack * 2) = 140
      expect(result).toBe(140);
    });

    it('should add power from ability_power stat', () => {
      const weaponData = {
        gear_type: 'bow',
        rarity: WeaponTier.COMMON,
        stats: { ability_power: 15 },
      };

      const result = calculateWeaponPowerRating(weaponData);

      // 100 base + (15 ability_power * 2) = 130
      expect(result).toBe(130);
    });

    it('should add power from critical_chance stat', () => {
      const weaponData = {
        gear_type: 'bow',
        rarity: WeaponTier.COMMON,
        stats: { critical_chance: 10 },
      };

      const result = calculateWeaponPowerRating(weaponData);

      // 100 base + (10 critical_chance * 5) = 150
      expect(result).toBe(150);
    });

    it('should add power from critical_damage stat', () => {
      const weaponData = {
        gear_type: 'bow',
        rarity: WeaponTier.COMMON,
        stats: { critical_damage: 25 },
      };

      const result = calculateWeaponPowerRating(weaponData);

      // 100 base + (25 critical_damage * 2) = 150
      expect(result).toBe(150);
    });

    it('should add less power from defense stat', () => {
      const weaponData = {
        gear_type: 'armor',
        rarity: WeaponTier.COMMON,
        stats: { defense: 20 },
      };

      const result = calculateWeaponPowerRating(weaponData);

      // 100 base + (20 defense * 1) = 120
      expect(result).toBe(120);
    });

    it('should combine multiple stats correctly', () => {
      const weaponData = {
        gear_type: 'bow',
        rarity: WeaponTier.RARE,
        stats: {
          attack: 10,
          ability_power: 5,
          critical_chance: 5,
          critical_damage: 10,
        },
      };

      const result = calculateWeaponPowerRating(weaponData);

      // 200 base + (10*2) + (5*2) + (5*5) + (10*2) = 200 + 20 + 10 + 25 + 20 = 275
      expect(result).toBe(275);
    });

    it('should handle missing stats', () => {
      const weaponData = {
        gear_type: 'bow',
        rarity: WeaponTier.EPIC,
      };

      const result = calculateWeaponPowerRating(weaponData);

      // Should only have base power
      expect(result).toBe(300);
    });
  });

  describe('validateWeaponPower', () => {
    it('should validate reasonable weapon damage', () => {
      // For common tier: base damage = (bow: 10 + arrow: 5) / 2 = 7.5
      // Max allowed = 7.5 * 2.0 = 15
      // Use a reasonable damage value within this range
      const result = validateWeaponPower(10, WeaponTier.COMMON);
      expect(result).toBe(true);
    });

    it('should reject overpowered weapon damage', () => {
      const tier = WeaponTier.COMMON;
      // Tier average for common = (10 + 5) / 2 * 1.0 = 7.5
      // Max allowed = 7.5 * 2.0 = 15
      const tierAverage = (10 + 5) / 2.0;
      const maxAllowed = tierAverage * WEAPON_BALANCE_CONSTANTS.MAX_DAMAGE_PERCENTAGE;

      const result = validateWeaponPower(maxAllowed + 1, tier);
      expect(result).toBe(false);
    });

    it('should validate for each tier', () => {
      const tiers = [WeaponTier.COMMON, WeaponTier.RARE, WeaponTier.EPIC, WeaponTier.LEGENDARY];

      for (const tier of tiers) {
        // Calculate appropriate damage for each tier
        // Tier multiplier: Common=1.0, Rare=1.3, Epic=1.6, Legendary=2.0
        // Base average = (bow: 10 + arrow: 5) / 2 = 7.5
        const tierMultiplier = {
          [WeaponTier.COMMON]: 1.0,
          [WeaponTier.RARE]: 1.3,
          [WeaponTier.EPIC]: 1.6,
          [WeaponTier.LEGENDARY]: 2.0,
        }[tier];

        const reasonableDamage = 7.5 * tierMultiplier; // Damage within tier range
        const result = validateWeaponPower(reasonableDamage, tier);
        expect(result).toBe(true);
      }
    });

    it('should calculate tier average correctly', () => {
      // Common tier: bow(10) + arrow(5) = 15 average
      const tierAverage = (10 + 5) / 2.0;
      const maxAllowed = tierAverage * WEAPON_BALANCE_CONSTANTS.MAX_DAMAGE_PERCENTAGE;

      const reasonableDamage = maxAllowed - 1; // Just under max
      const result = validateWeaponPower(reasonableDamage, WeaponTier.COMMON);
      expect(result).toBe(true);
    });
  });

  describe('Constants', () => {
    it('should have correct tier multipliers', () => {
      expect(WEAPON_BALANCE_CONSTANTS.TIER_MULTIPLIERS[WeaponTier.COMMON]).toBe(1.0);
      expect(WEAPON_BALANCE_CONSTANTS.TIER_MULTIPLIERS[WeaponTier.RARE]).toBe(1.3);
      expect(WEAPON_BALANCE_CONSTANTS.TIER_MULTIPLIERS[WeaponTier.EPIC]).toBe(1.6);
      expect(WEAPON_BALANCE_CONSTANTS.TIER_MULTIPLIERS[WeaponTier.LEGENDARY]).toBe(2.0);
    });

    it('should have correct base damages', () => {
      expect(WEAPON_BALANCE_CONSTANTS.BASE_DAMAGES.bow).toBe(10);
      expect(WEAPON_BALANCE_CONSTANTS.BASE_DAMAGES.arrow).toBe(5);
      expect(WEAPON_BALANCE_CONSTANTS.BASE_DAMAGES.helm).toBe(0);
      expect(WEAPON_BALANCE_CONSTANTS.BASE_DAMAGES.armor).toBe(0);
      expect(WEAPON_BALANCE_CONSTANTS.BASE_DAMAGES.amulet).toBe(2);
    });

    it('should have correct PvP damage reduction', () => {
      expect(WEAPON_BALANCE_CONSTANTS.PVP_DAMAGE_REDUCTION).toBe(0.85);
    });

    it('should have correct max damage percentage', () => {
      expect(WEAPON_BALANCE_CONSTANTS.MAX_DAMAGE_PERCENTAGE).toBe(2.0);
    });
  });
});
