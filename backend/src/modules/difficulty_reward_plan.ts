/**
 * Pure PvE dynamic-bonus planning. This module grants nothing and has no callers.
 * A future settlement caller must obtain the tier from an approved authoritative
 * challenge snapshot, never client input or current-at-completion state.
 * Campaign tier math supplies the base reward before this bonus is applied.
 */
export type DynamicRewardTier = 'easy' | 'normal' | 'hard' | 'extreme';

const MULTIPLIERS: Record<DynamicRewardTier, number> = {
  easy: 1,
  normal: 1,
  hard: 1.2,
  extreme: 1.5,
};

export interface DifficultyRewardPlan {
  multiplier: number;
  xp: { base: number; bonus: number; total: number };
  gearCount: number;
}

/**
 * Plan integer XP and gear quantity without changing base drop probability,
 * rarity, stats, unlocks, currencies, or persistence. Both independent random
 * draws must be in [0,1). Inputs fail closed, including unrecognized tiers.
 */
export function planDifficultyRewards(
  tier: DynamicRewardTier,
  baseXP: number,
  baseDropProbability: number,
  baseDropRoll: number,
  extraItemRoll: number
): DifficultyRewardPlan {
  const multiplier = Object.prototype.hasOwnProperty.call(MULTIPLIERS, tier)
    ? MULTIPLIERS[tier]
    : undefined;
  if (multiplier === undefined) throw new Error('Invalid dynamic reward tier');
  if (!Number.isSafeInteger(baseXP) || baseXP < 0) throw new Error('Invalid base XP');
  if (!Number.isFinite(baseDropProbability) || baseDropProbability < 0 || baseDropProbability > 1) {
    throw new Error('Invalid base drop probability');
  }
  if (
    ![baseDropRoll, extraItemRoll].every((roll) => Number.isFinite(roll) && roll >= 0 && roll < 1)
  ) {
    throw new Error('Invalid reward random draw');
  }
  const total = Math.round(baseXP * multiplier);
  if (!Number.isSafeInteger(total)) throw new Error('Reward XP overflow');
  const gearCount =
    baseDropRoll < baseDropProbability ? 1 + Number(extraItemRoll < multiplier - 1) : 0;
  return { multiplier, xp: { base: baseXP, bonus: total - baseXP, total }, gearCount };
}
