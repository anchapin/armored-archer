/**
 * Difficulty Scaling Module
 * @fileoverview Manages enemy damage scaling and AI difficulty tiers.
 */

/**
 * Difficulty level label
 */
export enum DifficultyLevel {
  EASY = 'Easy',
  NORMAL = 'Normal',
  HARD = 'Hard',
  EXTREME = 'Extreme',
}

/**
 * AI difficulty tier data
 */
export interface AiDifficultyTier {
  name: string;
  aggression: number;
  pattern_complexity: number;
  reaction_time: number;
}

/**
 * Boss phase progression data
 */
export interface BossPhaseProgression {
  phases: number;
  abilities: string[];
  phase_transitions: number[];
}

/**
 * Encounter difficulty calculation result
 */
export interface EncounterDifficulty {
  difficulty: number;
  label: DifficultyLevel;
}

/**
 * Scaling validation result
 */
export interface ScalingValidation {
  valid: boolean;
  reason?: string;
  multiplier?: number;
}

/**
 * AI difficulty tiers by level range
 */
const AI_TIERS: Record<string, AiDifficultyTier> = {
  '1-10': {
    name: 'Simple',
    aggression: 0.3,
    pattern_complexity: 1,
    reaction_time: 2.0,
  },
  '11-20': {
    name: 'Aggressive',
    aggression: 0.6,
    pattern_complexity: 3,
    reaction_time: 1.5,
  },
  '21-50': {
    name: 'Sophisticated',
    aggression: 0.8,
    pattern_complexity: 7,
    reaction_time: 1.0,
  },
};

/**
 * Boss phases by level range
 */
const BOSS_PHASES: Record<string, BossPhaseProgression> = {
  '1-10': {
    phases: 1,
    abilities: ['basic_attack', 'teleport'],
    phase_transitions: [],
  },
  '11-20': {
    phases: 2,
    abilities: ['basic_attack', 'teleport', 'summon_minions'],
    phase_transitions: [50], // 50% HP
  },
  '21-50': {
    phases: 3,
    abilities: ['basic_attack', 'teleport', 'summon_minions', 'enrage', 'area_attack'],
    phase_transitions: [75, 50], // 75% and 50% HP
  },
};

/**
 * Gets enemy damage multiplier based on player level.
 *
 * @param level - Player level
 * @returns Damage multiplier (0.8x to 2.0x)
 */
export function getEnemyDamageMult(level: number): number {
  if (level < 1) return 0.8;
  if (level > 50) level = 50;

  if (level <= 10) {
    // Early levels: 0.8x-1.0x
    return 0.8 + (level / 10) * 0.2; // 0.8 to 1.0
  } else if (level <= 20) {
    // Mid levels: 1.0x-1.2x
    return 1.0 + ((level - 10) / 10) * 0.2; // 1.0 to 1.2
  } else if (level <= 30) {
    // Upper mid levels: 1.2x-1.5x
    return 1.2 + ((level - 20) / 10) * 0.3; // 1.2 to 1.5
  } else {
    // Late levels: 1.5x-2.0x
    return 1.5 + ((level - 30) / 20) * 0.5; // 1.5 to 2.0
  }
}

/**
 * Gets AI difficulty tier based on player level.
 *
 * @param level - Player level
 * @returns AI difficulty tier data
 */
export function getAiDifficultyTier(level: number): AiDifficultyTier {
  if (level < 1) return AI_TIERS['1-10'];
  if (level > 50) level = 50;

  if (level <= 10) return AI_TIERS['1-10'];
  if (level <= 20) return AI_TIERS['11-20'];
  return AI_TIERS['21-50'];
}

/**
 * Gets boss phase progression based on player level.
 *
 * @param level - Player level
 * @returns Boss phase progression data
 */
export function getBossPhaseProgression(level: number): BossPhaseProgression {
  if (level < 1) return BOSS_PHASES['1-10'];
  if (level > 50) level = 50;

  if (level <= 10) return BOSS_PHASES['1-10'];
  if (level <= 20) return BOSS_PHASES['11-20'];
  return BOSS_PHASES['21-50'];
}

/**
 * Gets difficulty label based on damage multiplier.
 *
 * @param multiplier - Damage multiplier
 * @returns Difficulty level label
 */
export function getDifficultyLabel(multiplier: number): DifficultyLevel {
  if (multiplier <= 0.8) return DifficultyLevel.EASY;
  if (multiplier <= 1.0) return DifficultyLevel.NORMAL;
  if (multiplier <= 1.5) return DifficultyLevel.HARD;
  return DifficultyLevel.EXTREME;
}

/**
 * Calculates encounter difficulty based on player and enemy levels.
 *
 * @param playerLevel - Player level
 * @param enemyLevel - Enemy level
 * @returns Encounter difficulty (0.5 to 1.5)
 */
export function calculateEncounterDifficulty(playerLevel: number, enemyLevel: number): number {
  if (playerLevel <= 0) return clamp(enemyLevel / 10.0, 0.5, 1.5);
  if (enemyLevel <= 0) return 1.0;

  const levelDiff = enemyLevel - playerLevel;
  const difficulty = 1.0 + levelDiff / 20.0;

  return clamp(difficulty, 0.5, 1.5);
}

/**
 * Validates scaling formula parameters.
 *
 * @param level - Player level to validate
 * @returns Validation result
 */
export function validateScalingFormula(level: number): ScalingValidation {
  if (level < 1 || level > 50) {
    return {
      valid: false,
      reason: 'Level must be between 1 and 50',
    };
  }

  const multiplier = getEnemyDamageMult(level);

  if (multiplier < 0.5 || multiplier > 2.0) {
    return {
      valid: false,
      reason: 'Damage multiplier out of valid range (0.5-2.0)',
    };
  }

  return {
    valid: true,
    multiplier,
  };
}

/**
 * Clamps value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
