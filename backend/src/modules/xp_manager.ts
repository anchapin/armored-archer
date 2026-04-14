/**
 * XP Manager Module
 * @fileoverview Manages XP curve calculations and level progression.
 */

import { z } from 'zod';

/**
 * XP request schema
 */
const XpGainSchema = z.object({
  xp_amount: z.number().min(1),
  source: z.enum(['pve', 'pvp']),
  level: z.number().min(1).max(50),
});

export type XpGainRequest = z.infer<typeof XpGainSchema>;

/**
 * XP response schema
 */
export const XpResponseSchema = z.object({
  success: z.boolean(),
  xp_gained: z.number(),
  total_xp: z.number(),
  current_level: z.number(),
  levels_gained: z.number(),
});

export type XpResponse = z.infer<typeof XpResponseSchema>;

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
      multiplier = 1.1;
      break;
    case LevelCurveType.LATE:
      multiplier = 1.2;
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
  const result = XpGainSchema.safeParse(request);

  if (!result.success) {
    return {
      valid: false,
      error: result.error.message,
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
