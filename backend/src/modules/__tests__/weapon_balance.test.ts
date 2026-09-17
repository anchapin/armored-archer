/**
 * Tests for weapon_balance module
 */

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  calculatePvpDamage,
  calculateWeaponPowerRating,
  validateWeaponPower,
  applyBalanceAdjustment,
  trackWeaponUsage,
  getBalanceAdjustments,
  getWeaponStats,
  rpcApplyBalanceAdjustment,
  rpcGetBalanceMetrics,
  WeaponTier,
  WEAPON_BALANCE_CONSTANTS,
  BalanceAdjustment,
  WeaponUsageStats,
} from '../weapon_balance';
import { Runtime } from '../types/nakama';

function createMockNk(overrides: Record<string, unknown> = {}): Runtime.Nakama {
  return {
    storageRead: jest.fn().mockResolvedValue([]),
    storageWrite: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Runtime.Nakama;
}

function createMockLogger(): Runtime.Logger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Runtime.Logger;
}

function createMockCtx(userId: string): Runtime.Context {
  return { userId } as unknown as Runtime.Context;
}

function adminMetadataObject(isAdmin: boolean): { value: string } {
  return { value: JSON.stringify({ is_admin: isAdmin }) };
}

function adjustmentObject(
  weaponId: string,
  multiplier: number,
  createTime: number
): { value: string; createTime: number } {
  return {
    value: JSON.stringify({
      adjustment_id: `bal_${createTime}`,
      weapon_id: weaponId,
      multiplier,
      reason: 'test',
      created_at: createTime,
      created_by: 'admin-1',
    }),
    createTime,
  };
}

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
      // Use lower base damage to avoid hitting max damage cap
      const baseDamage = 10;
      const tier = WeaponTier.RARE;
      const stats = { attack: 20, ability_power: 10 };

      const result = calculatePvpDamage(baseDamage, tier, stats);

      // Stat bonuses should increase damage
      const baseResult = calculatePvpDamage(baseDamage, tier, {});
      expect(result).toBeGreaterThan(baseResult);
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
      // Common tier max allowed is 15 (7.5 avg * 2.0 max percentage)
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
      const tiers = [
        { tier: WeaponTier.COMMON, maxAllowed: 15 },
        { tier: WeaponTier.RARE, maxAllowed: 19.5 },
        { tier: WeaponTier.EPIC, maxAllowed: 24 },
        { tier: WeaponTier.LEGENDARY, maxAllowed: 30 },
      ];

      for (const { tier, maxAllowed } of tiers) {
        const reasonableDamage = Math.floor(maxAllowed * 0.5); // Use 50% of max as reasonable
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

  describe('calculatePvpDamage (tier and multiplier branches)', () => {
    it('should fall back to the common tier multiplier for an unknown tier', () => {
      // Unknown tier: tier multiplier falls back to COMMON (1.0), but the
      // curve factor (0.1 + tier * 0.025) grows so large the curve result
      // goes negative and is clamped to 0.
      const result = calculatePvpDamage(10, 99 as WeaponTier);
      expect(result).toBe(0);
    });

    it('should scale linearly with the balance multiplier while under the cap', () => {
      const unadjusted = calculatePvpDamage(10, WeaponTier.COMMON, {}, 1.0);
      const halved = calculatePvpDamage(10, WeaponTier.COMMON, {}, 0.5);

      expect(halved).toBeCloseTo(unadjusted * 0.5, 5);
    });

    it('should enforce the cap before applying the balance multiplier', () => {
      // Unadjusted legendary damage with a huge base exceeds the tier cap,
      // so doubling the balance multiplier cannot double the result.
      const baseline = calculatePvpDamage(500, WeaponTier.LEGENDARY, {}, 1.0);
      const doubled = calculatePvpDamage(500, WeaponTier.LEGENDARY, {}, 2.0);

      expect(baseline).toBeGreaterThan(0);
      expect(doubled).toBeCloseTo(baseline * 2.0, 5);
      // Both are capped at tier average * MAX_DAMAGE_PERCENTAGE * multiplier,
      // which is far below the uncapped 500-base scaling.
      const tierAverage =
        (WEAPON_BALANCE_CONSTANTS.BASE_DAMAGES.bow +
          WEAPON_BALANCE_CONSTANTS.BASE_DAMAGES.arrow) /
        2.0 *
        WEAPON_BALANCE_CONSTANTS.TIER_MULTIPLIERS[WeaponTier.LEGENDARY];
      expect(baseline).toBeLessThanOrEqual(tierAverage * WEAPON_BALANCE_CONSTANTS.MAX_DAMAGE_PERCENTAGE);
    });

    it('should ignore zero-valued attack and ability_power stats', () => {
      const withZeros = calculatePvpDamage(10, WeaponTier.COMMON, {
        attack: 0,
        ability_power: 0,
      });
      const withoutStats = calculatePvpDamage(10, WeaponTier.COMMON, {});

      expect(withZeros).toBe(withoutStats);
    });
  });

  describe('validateWeaponPower (tier average fallback)', () => {
    it('should use the 1.0 multiplier fallback for an unknown tier', () => {
      // Unknown tier: tier average falls back to the base bow/arrow average
      // (7.5), so 10 is within the max of 15 and validates.
      expect(validateWeaponPower(10, 99 as WeaponTier)).toBe(true);
      expect(validateWeaponPower(16, 99 as WeaponTier)).toBe(false);
    });
  });

  describe('calculateWeaponPowerRating (empty stats)', () => {
    it('should return only base power for empty stats object', () => {
      const result = calculateWeaponPowerRating({
        gear_type: 'bow',
        rarity: WeaponTier.LEGENDARY,
        stats: {},
      });

      expect(result).toBe(400);
    });
  });

  describe('applyBalanceAdjustment', () => {
    const validRequest = {
      weapon_id: 'bow_long_1',
      multiplier: 1.25,
      reason: 'win rate too low',
    };

    it('should reject a non-positive multiplier', async () => {
      const nk = createMockNk();

      for (const multiplier of [0, -1.5]) {
        const result = await applyBalanceAdjustment(nk, 'admin-1', {
          ...validRequest,
          multiplier,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Balance multiplier must be positive');
      }

      expect(nk.storageWrite).not.toHaveBeenCalled();
    });

    it('should reject a missing or whitespace-only reason', async () => {
      const nk = createMockNk();

      for (const reason of ['', '   ']) {
        const result = await applyBalanceAdjustment(nk, 'admin-1', {
          ...validRequest,
          reason,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Reason is required for balance adjustments');
      }

      expect(nk.storageRead).not.toHaveBeenCalled();
      expect(nk.storageWrite).not.toHaveBeenCalled();
    });

    it('should reject when the user has no admin metadata', async () => {
      const nk = createMockNk();

      const result = await applyBalanceAdjustment(nk, 'user-1', validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Admin access required');
      expect(nk.storageRead).toHaveBeenCalledWith([
        {
          collection: 'user_metadata',
          key: 'admin_status',
          userId: 'user-1',
        },
      ]);
      expect(nk.storageWrite).not.toHaveBeenCalled();
    });

    it('should reject when admin metadata says is_admin is false', async () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockResolvedValue([adminMetadataObject(false)]),
      });

      const result = await applyBalanceAdjustment(nk, 'user-1', validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Admin access required');
    });

    it('should reject when the admin check storage read fails', async () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockRejectedValue(new Error('storage down')),
      });

      const result = await applyBalanceAdjustment(nk, 'user-1', validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Admin access required');
    });

    it('should reject when admin metadata is not valid JSON', async () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockResolvedValue([{ value: 'not-json' }]),
      });

      const result = await applyBalanceAdjustment(nk, 'user-1', validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Admin access required');
    });

    it('should store the adjustment and log an audit trail for an admin', async () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockResolvedValue([adminMetadataObject(true)]),
      });

      const result = await applyBalanceAdjustment(nk, 'admin-1', validRequest);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.adjustment).toBeDefined();
      const adjustment = result.adjustment as BalanceAdjustment;
      expect(adjustment.weapon_id).toBe('bow_long_1');
      expect(adjustment.multiplier).toBe(1.25);
      expect(adjustment.reason).toBe('win rate too low');
      expect(adjustment.created_by).toBe('admin-1');
      expect(adjustment.adjustment_id).toMatch(/^bal_\d+_[a-z0-9]+$/);

      // First write: the adjustment record itself; second: the audit log.
      expect(nk.storageWrite).toHaveBeenCalledTimes(2);
      const adjustmentWrite = (nk.storageWrite as jest.Mock).mock.calls[0][0];
      expect(adjustmentWrite[0].collection).toBe('weapon_balance_adjustments');
      expect(adjustmentWrite[0].key).toBe(adjustment.adjustment_id);
      expect(adjustmentWrite[0].userId).toBe('admin-1');
      expect(adjustmentWrite[0].permissionRead).toBe(2);
      expect(adjustmentWrite[0].permissionWrite).toBe(0);
      expect((typeof adjustmentWrite[0].value === 'string' ? (typeof adjustmentWrite[0].value === 'string' ? (typeof adjustmentWrite[0].value === 'string' ? JSON.parse(adjustmentWrite[0].value) : adjustmentWrite[0].value) : adjustmentWrite[0].value) : adjustmentWrite[0].value)).toEqual(adjustment);

      const auditWrite = (nk.storageWrite as jest.Mock).mock.calls[1][0];
      expect(auditWrite[0].collection).toBe('audit_logs');
    });

    it('should fail gracefully when storing the adjustment fails', async () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockResolvedValue([adminMetadataObject(true)]),
        storageWrite: jest.fn().mockRejectedValue(new Error('write failed')),
      });

      const result = await applyBalanceAdjustment(nk, 'admin-1', validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to store balance adjustment');
    });
  });

  describe('trackWeaponUsage', () => {
    it('should create fresh stats on first tracked win', async () => {
      const nk = createMockNk();

      await trackWeaponUsage(nk, 'bow_short_2', 'win', 12);

      expect(nk.storageWrite).toHaveBeenCalledTimes(1);
      const write = (nk.storageWrite as jest.Mock).mock.calls[0][0][0];
      expect(write.collection).toBe('weapon_usage_stats');
      expect(write.key).toBe('weapon_stats_bow_short_2');
      expect(write.userId).toBe('00000000-0000-0000-0000-000000000000');

      const stats = (typeof write.value === 'string' ? (typeof write.value === 'string' ? (typeof write.value === 'string' ? JSON.parse(write.value) : write.value) : write.value) : write.value) as WeaponUsageStats;
      expect(stats.weapon_id).toBe('bow_short_2');
      expect(stats.matches_played).toBe(1);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(0);
      expect(stats.average_rating_diff).toBe(12);
    });

    it('should increment existing stats and keep a running rating average', async () => {
      const existing: WeaponUsageStats = {
        weapon_id: 'bow_short_2',
        matches_played: 1,
        wins: 1,
        losses: 0,
        average_rating_diff: 10,
        last_updated: 1000,
      };
      const nk = createMockNk({
        storageRead: jest.fn().mockResolvedValue([
          { value: JSON.stringify(existing) },
        ]),
      });

      await trackWeaponUsage(nk, 'bow_short_2', 'loss', 30);

      const write = (nk.storageWrite as jest.Mock).mock.calls[0][0][0];
      const stats = (typeof write.value === 'string' ? (typeof write.value === 'string' ? (typeof write.value === 'string' ? JSON.parse(write.value) : write.value) : write.value) : write.value) as WeaponUsageStats;
      expect(stats.matches_played).toBe(2);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      // (10 * (2 - 1) + 30) / 2 = 20
      expect(stats.average_rating_diff).toBe(20);
    });

    it('should swallow storage read failures without throwing', async () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockRejectedValue(new Error('read failed')),
      });

      await expect(
        trackWeaponUsage(nk, 'bow_short_2', 'win', 5)
      ).resolves.toBeUndefined();
      expect(nk.storageWrite).not.toHaveBeenCalled();
    });

    it('should swallow storage write failures without throwing', async () => {
      const nk = createMockNk({
        storageWrite: jest.fn().mockRejectedValue(new Error('write failed')),
      });

      await expect(
        trackWeaponUsage(nk, 'bow_short_2', 'loss', 5)
      ).resolves.toBeUndefined();
    });
  });

  describe('getBalanceAdjustments', () => {
    it('should return an empty map when no adjustments exist', async () => {
      const nk = createMockNk();

      const result = await getBalanceAdjustments(nk);

      expect(result).toEqual({});
      expect(nk.storageRead).toHaveBeenCalledWith([
        {
          collection: 'weapon_balance_adjustments',
          userId: '00000000-0000-0000-0000-000000000000',
          key: '*',
        },
      ]);
    });

    it('should map weapon ids to multipliers, preferring newer records', async () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockResolvedValue([
          adjustmentObject('bow_a', 1.2, 100),
          // Same weapon with createTime 0 never overrides an existing entry.
          adjustmentObject('bow_a', 0.5, 0),
          // Same weapon with a newer createTime overrides.
          adjustmentObject('bow_a', 0.9, 200),
          adjustmentObject('bow_b', 1.5, 150),
        ]),
      });

      const result = await getBalanceAdjustments(nk);

      expect(result).toEqual({ bow_a: 0.9, bow_b: 1.5 });
    });

    it('should return an empty map when the storage read fails', async () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockRejectedValue(new Error('read failed')),
      });

      const result = await getBalanceAdjustments(nk);

      expect(result).toEqual({});
    });
  });

  describe('getWeaponStats', () => {
    it('should return parsed stats when they exist', async () => {
      const existing: WeaponUsageStats = {
        weapon_id: 'bow_x',
        matches_played: 7,
        wins: 4,
        losses: 3,
        average_rating_diff: -2.5,
        last_updated: 1234,
      };
      const nk = createMockNk({
        storageRead: jest.fn().mockResolvedValue([
          { value: JSON.stringify(existing) },
        ]),
      });

      const result = await getWeaponStats(nk, 'bow_x');

      expect(result).toEqual(existing);
      expect(nk.storageRead).toHaveBeenCalledWith([
        {
          collection: 'weapon_usage_stats',
          key: 'weapon_stats_bow_x',
          userId: '00000000-0000-0000-0000-000000000000',
        },
      ]);
    });

    it('should return null when no stats exist', async () => {
      const nk = createMockNk();

      const result = await getWeaponStats(nk, 'bow_unknown');

      expect(result).toBeNull();
    });

    it('should return null when the storage read fails', async () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockRejectedValue(new Error('read failed')),
      });

      const result = await getWeaponStats(nk, 'bow_x');

      expect(result).toBeNull();
    });
  });

  describe('rpcApplyBalanceAdjustment', () => {
    const validPayload = JSON.stringify({
      weapon_id: 'bow_long_1',
      multiplier: 1.1,
      reason: 'tuning',
    });

    it('should return a validation error for invalid JSON payloads', async () => {
      const nk = createMockNk();

      const response = await rpcApplyBalanceAdjustment(
        createMockCtx('admin-1'),
        createMockLogger(),
        nk,
        'not-json'
      );

      const parsed = JSON.parse(response);
      expect(parsed).toContain('Invalid JSON in apply_balance_adjustment');
      expect(nk.storageWrite).not.toHaveBeenCalled();
    });

    it('should return a validation error when the schema rejects the payload', async () => {
      const nk = createMockNk();

      // multiplier 0.05 is below the schema minimum of 0.1
      const response = await rpcApplyBalanceAdjustment(
        createMockCtx('admin-1'),
        createMockLogger(),
        nk,
        JSON.stringify({ weapon_id: 'bow_long_1', multiplier: 0.05, reason: 'tuning' })
      );

      const parsed = JSON.parse(response);
      expect(parsed).toContain('Validation failed for apply_balance_adjustment');
      expect(nk.storageWrite).not.toHaveBeenCalled();
    });

    it('should apply the adjustment for an authorized admin', async () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockResolvedValue([adminMetadataObject(true)]),
      });

      const response = await rpcApplyBalanceAdjustment(
        createMockCtx('admin-1'),
        createMockLogger(),
        nk,
        validPayload
      );

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.adjustment.weapon_id).toBe('bow_long_1');
      expect(result.adjustment.created_by).toBe('admin-1');
    });

    it('should surface an authorization failure through the RPC', async () => {
      const nk = createMockNk();

      const response = await rpcApplyBalanceAdjustment(
        createMockCtx('user-1'),
        createMockLogger(),
        nk,
        validPayload
      );

      const result = JSON.parse(response);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Admin access required');
    });
  });

  describe('rpcGetBalanceMetrics', () => {
    it('should return an adjustment summary for an empty payload', async () => {
      const nk = createMockNk({
        storageRead: jest.fn().mockResolvedValue([
          adjustmentObject('bow_a', 1.2, 100),
          adjustmentObject('bow_b', 0.8, 200),
        ]),
      });

      const response = await rpcGetBalanceMetrics(
        createMockCtx('admin-1'),
        createMockLogger(),
        nk,
        ''
      );

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.active_adjustments).toBe(2);
      expect(result.adjustments).toEqual({ bow_a: 1.2, bow_b: 0.8 });
    });

    it('should return the same summary for an empty JSON object payload', async () => {
      const nk = createMockNk();

      const response = await rpcGetBalanceMetrics(
        createMockCtx('admin-1'),
        createMockLogger(),
        nk,
        '{}'
      );

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.active_adjustments).toBe(0);
      expect(result.adjustments).toEqual({});
    });

    it('should return weapon-specific metrics when a weapon_id is provided', async () => {
      const usageStats: WeaponUsageStats = {
        weapon_id: 'bow_a',
        matches_played: 5,
        wins: 3,
        losses: 2,
        average_rating_diff: 4,
        last_updated: 999,
      };
      const storageRead = jest.fn().mockImplementation((objects) => {
        const reads = objects as Array<{ collection: string }>;
        if (reads[0].collection === 'weapon_balance_adjustments') {
          return Promise.resolve([adjustmentObject('bow_a', 1.2, 100)]);
        }
        return Promise.resolve([{ value: JSON.stringify(usageStats) }]);
      });
      const nk = createMockNk({ storageRead });

      const response = await rpcGetBalanceMetrics(
        createMockCtx('admin-1'),
        createMockLogger(),
        nk,
        JSON.stringify({ weapon_id: 'bow_a' })
      );

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.weapon_id).toBe('bow_a');
      expect(result.balance_multiplier).toBe(1.2);
      expect(result.usage_stats).toEqual(usageStats);
    });

    it('should default the balance multiplier and report null stats for an unknown weapon', async () => {
      const storageRead = jest.fn().mockImplementation((objects) => {
        const reads = objects as Array<{ collection: string }>;
        if (reads[0].collection === 'weapon_balance_adjustments') {
          return Promise.resolve([adjustmentObject('bow_a', 1.2, 100)]);
        }
        return Promise.resolve([]);
      });
      const nk = createMockNk({ storageRead });

      const response = await rpcGetBalanceMetrics(
        createMockCtx('admin-1'),
        createMockLogger(),
        nk,
        JSON.stringify({ weapon_id: 'bow_unknown' })
      );

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.weapon_id).toBe('bow_unknown');
      expect(result.balance_multiplier).toBe(1.0);
      expect(result.usage_stats).toBeNull();
    });

    it('should fall back to the summary when the payload is not valid JSON', async () => {
      const nk = createMockNk();

      const response = await rpcGetBalanceMetrics(
        createMockCtx('admin-1'),
        createMockLogger(),
        nk,
        'not-json'
      );

      const result = JSON.parse(response);
      expect(result.success).toBe(true);
      expect(result.active_adjustments).toBe(0);
    });
  });
});
