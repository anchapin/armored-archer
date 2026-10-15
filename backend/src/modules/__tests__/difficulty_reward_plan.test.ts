import { DynamicRewardTier, planDifficultyRewards } from '../difficulty_reward_plan';

describe('Pure dynamic reward plan (no settlement callers)', () => {
  it.each<[DynamicRewardTier, number, number]>([
    ['easy', 1, 125],
    ['normal', 1, 125],
    ['hard', 1.2, 150],
    ['extreme', 1.5, 188],
  ])('uses the floor/cap and one XP rounding step for %s', (tier, multiplier, total) => {
    expect(planDifficultyRewards(tier, 125, 1, 0, 0)).toEqual({
      multiplier,
      xp: { base: 125, bonus: total - 125, total },
      gearCount: multiplier === 1 ? 1 : 2,
    });
  });

  it('never rescues a failed base roll, even at Extreme', () => {
    expect(planDifficultyRewards('extreme', 60, 0.45, 0.45, 0).gearCount).toBe(0);
    expect(planDifficultyRewards('extreme', 60, 0, 0, 0).gearCount).toBe(0);
  });

  it('uses a fractional extra-item roll rather than saturating drop probability', () => {
    expect(planDifficultyRewards('extreme', 60, 1, 0.999, 0.499).gearCount).toBe(2);
    expect(planDifficultyRewards('extreme', 60, 1, 0.999, 0.5).gearCount).toBe(1);
    expect(planDifficultyRewards('hard', 60, 1, 0, 0.199).gearCount).toBe(2);
    expect(planDifficultyRewards('hard', 60, 1, 0, 0.2).gearCount).toBe(1);
    expect(planDifficultyRewards('normal', 60, 1, 0, 0).gearCount).toBe(1);
    expect(planDifficultyRewards('easy', 60, 1, 0, 0).gearCount).toBe(1);
  });

  it.each([0, 0.45, 0.99, 1])(
    'preserves the expected quantity bonus at base chance %s',
    (chance) => {
      // Midpoint grids give exact coverage for the chosen base/extra probabilities.
      for (const tier of ['easy', 'normal', 'hard', 'extreme'] as DynamicRewardTier[]) {
        let count = 0;
        for (let base = 0; base < 100; base++) {
          for (let extra = 0; extra < 100; extra++) {
            count += planDifficultyRewards(
              tier,
              60,
              chance,
              (base + 0.5) / 100,
              (extra + 0.5) / 100
            ).gearCount;
          }
        }
        const multiplier = planDifficultyRewards(tier, 0, 0, 0, 0).multiplier;
        expect(count / 10000).toBeCloseTo(chance * multiplier, 10);
      }
    }
  );

  it('is monotonic in XP with a bounded multiplier and no penalty below Normal', () => {
    for (const base of [0, 1, 2, 59, 60, 125, 188, 1000000]) {
      const plans = (['easy', 'normal', 'hard', 'extreme'] as DynamicRewardTier[]).map((tier) =>
        planDifficultyRewards(tier, base, 1, 0, 0.3)
      );
      expect(plans[0].xp.total).toBe(base);
      for (let i = 1; i < plans.length; i++) {
        expect(plans[i].xp.total).toBeGreaterThanOrEqual(plans[i - 1].xp.total);
        expect(plans[i].xp.total).toBeLessThanOrEqual(Math.round(base * 1.5));
      }
    }
  });

  it.each([NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid XP %s', (xp) => {
    expect(() => planDifficultyRewards('normal', xp, 0.5, 0, 0)).toThrow('Invalid base XP');
  });

  it('rejects overflow after applying the bonus', () => {
    expect(() => planDifficultyRewards('extreme', Number.MAX_SAFE_INTEGER, 1, 0, 0)).toThrow(
      'Reward XP overflow'
    );
  });

  it.each([NaN, Infinity, -0.1, 1.1])('rejects invalid probability %s', (chance) => {
    expect(() => planDifficultyRewards('normal', 60, chance, 0, 0)).toThrow(
      'Invalid base drop probability'
    );
  });

  it.each([NaN, Infinity, -0.1, 1])('rejects either invalid random draw %s', (roll) => {
    expect(() => planDifficultyRewards('normal', 60, 1, roll, 0)).toThrow(
      'Invalid reward random draw'
    );
    expect(() => planDifficultyRewards('normal', 60, 1, 0, roll)).toThrow(
      'Invalid reward random draw'
    );
  });

  it.each(['nightmare', 'invalid', '__proto__', 'toString', null, undefined])(
    'rejects unsupported tiers including inherited keys: %s',
    (tier) => {
      expect(() => planDifficultyRewards(tier as DynamicRewardTier, 60, 1, 0, 0)).toThrow(
        'Invalid dynamic reward tier'
      );
    }
  );
});
