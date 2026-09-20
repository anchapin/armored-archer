/**
 * XP Manager Module
 * @fileoverview Manages XP curve calculations and level progression.
 */

import {
  object,
  number,
  boolean,
  pipe,
  integer,
  minValue,
  maxValue,
  enum as enumType,
  safeParse,
} from 'valibot';

/**
 * XP request schema
 */
const XpGainSchema = object({
  xp_amount: pipe(number(), integer(), minValue(1)),
  source: enumType(['pve', 'pvp'] as any),
  level: pipe(number(), integer(), minValue(1), maxValue(50)),
});

export type XpGainRequest = { xp_amount: number; source: 'pve' | 'pvp'; level: number };

/**
 * XP response schema
 */
export const XpResponseSchema = object({
  success: boolean(),
  xp_gained: number(),
  total_xp: number(),
  current_level: number(),
  levels_gained: number(),
});

export type XpResponse = {
  success: boolean;
  xp_gained: number;
  total_xp: number;
  current_level: number;
  levels_gained: number;
};

/**
 * Level curve type
 */
export enum LevelCurveType {
  EARLY = 'early',
  MID = 'mid',
  LATE = 'late',
}

/**
 * XP curve configuration
 */
const XP_CURVE: Record<number, number> = {
  1: 0,
  2: 100,
  3: 300,
  4: 600,
  5: 1000,
  6: 1500,
  7: 2100,
  8: 2800,
  9: 3600,
  10: 4500,
  11: 5500,
  12: 6600,
  13: 7800,
  14: 9100,
  15: 10500,
  16: 12000,
  17: 13600,
  18: 15300,
  19: 17100,
  20: 19000,
  21: 21000,
  22: 23100,
  23: 25300,
  24: 27600,
  25: 30000,
  26: 32500,
  27: 35100,
  28: 37800,
  29: 40600,
  30: 43500,
  31: 46500,
  32: 49600,
  33: 52800,
  34: 56100,
  35: 59500,
  36: 63000,
  37: 66600,
  38: 70300,
  39: 74100,
  40: 78000,
  41: 82000,
  42: 86100,
  43: 90300,
  44: 94600,
  45: 99000,
  46: 103500,
  47: 108100,
  48: 112800,
  49: 117600,
  50: 122500,
};

/**
 * Gets total XP required for a given level.
 *
 * @param level - Level to calculate XP for
 * @returns Total XP required for the level
 */
export function getXpForLevel(level: number): number {
  if (level < 1) return 0;
  if (level > 50) level = 50;
  return XP_CURVE[level] ?? 100 * level * level;
}

/**
 * Derives the player level from total accumulated XP using the lookup table.
 * This is the single source of truth for level-from-XP conversion.
 *
 * @param totalXp - Total accumulated XP
 * @returns Current level (1-50)
 */
export function getLevelForXp(totalXp: number): number {
  if (totalXp <= 0) return 1;
  for (let level = 50; level >= 2; level--) {
    if (XP_CURVE[level] <= totalXp) return level;
  }
  return 1;
}

/**
 * Gets full level progress info from total XP.
 *
 * @param totalXp - Total accumulated XP
 * @returns Level, XP thresholds, and progress percentage
 */
export function getLevelProgress(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
} {
  const level = getLevelForXp(totalXp);
  const currentLevelXp = getXpForLevel(level);
  const nextLevelXp = getXpForLevel(level + 1);
  return {
    level,
    currentLevelXp,
    nextLevelXp,
    progress: getProgressPercentage(totalXp, currentLevelXp, nextLevelXp),
  };
}

/**
 * Gets the level curve type for a given level.
 *
 * @param level - Level to classify
 * @returns Level curve type (early/mid/late)
 */
export function getLevelCurveType(level: number): LevelCurveType {
  if (level <= 10) return LevelCurveType.EARLY;
  if (level <= 30) return LevelCurveType.MID;
  return LevelCurveType.LATE;
}

/**
 * Calculates XP gain with level-based modifiers.
 * Tuned for more balanced progression curve.
 *
 * @param baseXp - Base XP amount
 * @param level - Current player level
 * @returns Adjusted XP gain
 */
export function calculateXpGain(baseXp: number, level: number): number {
  const curveType = getLevelCurveType(level);
  let multiplier = 1.0;

  switch (curveType) {
    case LevelCurveType.EARLY:
      multiplier = 1.0;
      break;
    case LevelCurveType.MID:
      multiplier = 1.05;
      break;
    case LevelCurveType.LATE:
      multiplier = 1.1;
      break;
  }

  return Math.floor(baseXp * multiplier);
}

/**
 * Calculates progress percentage for current level.
 *
 * @param currentXp - Current XP
 * @param levelXp - XP required for current level
 * @param nextLevelXp - XP required for next level
 * @returns Progress percentage (0-100)
 */
export function getProgressPercentage(
  currentXp: number,
  levelXp: number,
  nextLevelXp: number
): number {
  if (nextLevelXp <= levelXp) return 100;
  if (currentXp < levelXp) return 0;

  const xpIntoLevel = currentXp - levelXp;
  const xpToNextLevel = nextLevelXp - levelXp;

  // Clamp to 0-100 range
  return Math.min(100, Math.floor((xpIntoLevel / xpToNextLevel) * 100));
}

/**
 * Validates XP gain request.
 *
 * @param request - XP gain request to validate
 * @returns Validation result
 */
export function validateXpGain(request: unknown): {
  valid: boolean;
  error?: string;
} {
  const result = safeParse(XpGainSchema, request);

  if (!result.success) {
    const errorMessages = result.issues
      .map((issue) => `${issue.path?.map((p) => p.key).join('.') || 'root'}: ${issue.message}`)
      .join(', ');
    return {
      valid: false,
      error: errorMessages,
    };
  }

  return { valid: true };
}

/**
 * Validates XP gain (simplified version for tests).
 *
 * @param xpAmount - XP amount to validate
 * @param level - Player level
 * @returns Validation result with reason
 */
export function validateXpGainSimple(
  xpAmount: number,
  level: number
): {
  valid: boolean;
  reason?: string;
} {
  if (xpAmount < 0) {
    return {
      valid: false,
      reason: 'negative XP values are not allowed',
    };
  }

  if (xpAmount === 0) {
    return {
      valid: false,
      reason: 'zero XP values are not allowed',
    };
  }

  if (level < 1 || level > 50) {
    return {
      valid: false,
      reason: 'level must be between 1 and 50',
    };
  }

  return { valid: true };
}
