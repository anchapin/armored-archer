/**
 * Property-based tests for server-authoritative game math.
 *
 * Issue #1031: the previous version of this file targeted the abandoned
 * in-memory class API (`new CombatSystem()` / `new RPGSystem()`), which no
 * longer exists — the backend is now a set of Nakama RPC handlers. These
 * tests exercise the current exported pure functions with randomized inputs
 * and assert gameplay invariants (bounds, monotonicity, caps).
 *
 * The suite is intentionally dependency-free (no fast-check): a small seeded
 * PRNG keeps runs reproducible. Override the seed with PROPERTY_TEST_SEED.
 *
 * This file is executed by `npm run test:property` and the
 * "Property-Based Tests" GitHub workflow via jest.property.config.js.
 */

import { calculateLevel } from '../../src/modules/rpg_system';
import {
  calculatePvpDamage,
  calculateWeaponPowerRating,
  validateWeaponPower,
  WeaponTier,
  WEAPON_BALANCE_CONSTANTS,
} from '../../src/modules/weapon_balance';
import { calculateDropRate } from '../../src/modules/gear_system';
import { getEnemyDamageMult } from '../../src/modules/difficulty_scaling';

const ITERATIONS = 300;
const DEFAULT_SEED = 1031;

/** Deterministic PRNG (mulberry32) so failures are reproducible. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seed = Number(process.env.PROPERTY_TEST_SEED) || DEFAULT_SEED;
const rng = makeRng(seed);
const randomInt = (min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

const ALL_TIERS: WeaponTier[] = [
  WeaponTier.COMMON,
  WeaponTier.RARE,
  WeaponTier.EPIC,
  WeaponTier.LEGENDARY,
];

/** Mirrors the unexported getTierAverageDamage used for the damage cap. */
function tierDamageCap(tier: WeaponTier): number {
  const { TIER_MULTIPLIERS, BASE_DAMAGES, MAX_DAMAGE_PERCENTAGE } =
    WEAPON_BALANCE_CONSTANTS;
  const tierMultiplier = TIER_MULTIPLIERS[tier] || TIER_MULTIPLIERS[WeaponTier.COMMON];
  const avgDamage =
    ((BASE_DAMAGES.bow * tierMultiplier) + (BASE_DAMAGES.arrow * tierMultiplier)) / 2.0;
  return avgDamage * MAX_DAMAGE_PERCENTAGE;
}

describe('Property-Based Testing - XP Curve (calculateLevel)', () => {
  it('level is always within [1, 50] for any XP value', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const xp = randomInt(-1000, 10_000_000);
      const level = calculateLevel(xp);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(50);
    }
  });

  it('non-positive XP always yields level 1', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const xp = -randomInt(0, 1_000_000);
      expect(calculateLevel(xp)).toBe(1);
      expect(calculateLevel(0)).toBe(1);
    }
  });

  it('level is monotonic non-decreasing in XP', () => {
    let xp = 0;
    let level = calculateLevel(xp);
    for (let i = 0; i < ITERATIONS; i++) {
      xp += randomInt(1, 5000);
      const nextLevel = calculateLevel(xp);
      expect(nextLevel).toBeGreaterThanOrEqual(level);
      level = nextLevel;
    }
  });
});

describe('Property-Based Testing - PvP Damage (calculatePvpDamage)', () => {
  it('damage is always finite and non-negative', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const base = randomInt(1, 300);
      const tier = ALL_TIERS[randomInt(0, ALL_TIERS.length - 1)];
      const stats = { attack: randomInt(0, 200), ability_power: randomInt(0, 200) };
      const damage = calculatePvpDamage(base, tier, stats, 1.0);
      expect(Number.isFinite(damage)).toBe(true);
      expect(damage).toBeGreaterThanOrEqual(0);
    }
  });

  it('zero base damage with no stats yields zero', () => {
    for (const tier of ALL_TIERS) {
      expect(calculatePvpDamage(0, tier, {}, 1.0)).toBe(0);
    }
  });

  it('damage never exceeds the tier cap (anti-one-shot protection)', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const base = randomInt(1, 100_000); // absurd bases must still be capped
      const tier = ALL_TIERS[randomInt(0, ALL_TIERS.length - 1)];
      const damage = calculatePvpDamage(base, tier, {}, 1.0);
      expect(damage).toBeLessThanOrEqual(tierDamageCap(tier));
    }
  });

  it('damage is monotonic non-decreasing in base damage (realistic range)', () => {
    for (const tier of ALL_TIERS) {
      let base = 1;
      let damage = calculatePvpDamage(base, tier, {}, 1.0);
      for (let i = 0; i < 100; i++) {
        base += randomInt(1, 5);
        const nextDamage = calculatePvpDamage(base, tier, {}, 1.0);
        expect(nextDamage).toBeGreaterThanOrEqual(damage);
        damage = nextDamage;
      }
    }
  });

  it('positive attack stats never decrease damage', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const base = randomInt(1, 300);
      const tier = ALL_TIERS[randomInt(0, ALL_TIERS.length - 1)];
      const attack = randomInt(0, 200);
      const without = calculatePvpDamage(base, tier, {}, 1.0);
      const withStat = calculatePvpDamage(base, tier, { attack }, 1.0);
      expect(withStat).toBeGreaterThanOrEqual(without);
    }
  });

  it('balance multiplier of zero nullifies damage', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const base = randomInt(1, 300);
      const tier = ALL_TIERS[randomInt(0, ALL_TIERS.length - 1)];
      expect(calculatePvpDamage(base, tier, {}, 0.0)).toBe(0);
    }
  });
});

describe('Property-Based Testing - Weapon Power Rating', () => {
  it('rating is always non-negative', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const tier = ALL_TIERS[randomInt(0, ALL_TIERS.length - 1)];
      const stats = {
        attack: randomInt(0, 100),
        critical_chance: randomInt(0, 50),
        defense: randomInt(0, 100),
      };
      const rating = calculateWeaponPowerRating({
        gear_type: 'bow',
        rarity: tier,
        stats,
      });
      expect(rating).toBeGreaterThanOrEqual(0);
    }
  });

  it('higher rarity always yields a strictly higher base rating', () => {
    const stats = { attack: 10 };
    let previous = -1;
    for (const tier of ALL_TIERS) {
      const rating = calculateWeaponPowerRating({ gear_type: 'bow', rarity: tier, stats });
      expect(rating).toBeGreaterThan(previous);
      previous = rating;
    }
  });

  it('adding positive stats never decreases the rating', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const tier = ALL_TIERS[randomInt(0, ALL_TIERS.length - 1)];
      const attack = randomInt(0, 100);
      const base = calculateWeaponPowerRating({ gear_type: 'bow', rarity: tier });
      const boosted = calculateWeaponPowerRating({
        gear_type: 'bow',
        rarity: tier,
        stats: { attack },
      });
      expect(boosted).toBeGreaterThanOrEqual(base);
    }
  });
});

describe('Property-Based Testing - Weapon Power Validation', () => {
  it('validates false for absurd base damage at every tier', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const tier = ALL_TIERS[randomInt(0, ALL_TIERS.length - 1)];
      const absurd = randomInt(100_001, 1_000_000);
      expect(validateWeaponPower(absurd, tier)).toBe(false);
    }
  });

  it('validates true for damage within the tier cap', () => {
    for (const tier of ALL_TIERS) {
      const cap = tierDamageCap(tier);
      const sane = Math.floor(cap / 2);
      expect(validateWeaponPower(sane, tier)).toBe(true);
    }
  });
});

describe('Property-Based Testing - Loot Drop Rate (calculateDropRate)', () => {
  const DIFFICULTIES = ['easy', 'medium', 'hard', 'nightmare'];

  it('drop rate is always within [0, 1]', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const difficulty = DIFFICULTIES[randomInt(0, DIFFICULTIES.length - 1)];
      const bossDefeated = rng() > 0.5;
      const rate = calculateDropRate(difficulty, bossDefeated);
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });

  it('defeating the boss never decreases the drop rate', () => {
    for (const difficulty of DIFFICULTIES) {
      const withoutBoss = calculateDropRate(difficulty, false);
      const withBoss = calculateDropRate(difficulty, true);
      expect(withBoss).toBeGreaterThanOrEqual(withoutBoss);
    }
  });

  it('unknown difficulty falls back to the medium multiplier', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const unknown = `difficulty_${randomInt(0, 999999)}`;
      const bossDefeated = rng() > 0.5;
      expect(calculateDropRate(unknown, bossDefeated)).toBe(
        calculateDropRate('medium', bossDefeated)
      );
    }
  });
});

describe('Property-Based Testing - Enemy Damage Scaling (getEnemyDamageMult)', () => {
  it('multiplier is always within [0.8, 2.0]', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const level = randomInt(-10, 200);
      const mult = getEnemyDamageMult(level);
      expect(mult).toBeGreaterThanOrEqual(0.8);
      expect(mult).toBeLessThanOrEqual(2.0);
    }
  });

  it('multiplier is monotonic non-decreasing for levels 1..50', () => {
    let mult = getEnemyDamageMult(1);
    for (let level = 2; level <= 50; level++) {
      const next = getEnemyDamageMult(level);
      expect(next).toBeGreaterThanOrEqual(mult);
      mult = next;
    }
  });

  it('levels above 50 are clamped to the level-50 multiplier', () => {
    const cap = getEnemyDamageMult(50);
    for (let i = 0; i < ITERATIONS; i++) {
      expect(getEnemyDamageMult(randomInt(51, 10_000))).toBe(cap);
    }
  });
});
