import { Runtime } from '../types/nakama';
import { logAudit } from './audit';
import { PlayerInventory } from './gear_system';
import { PlayerStats } from './rpg_system';
import { getLevelForXp } from './xp_manager';

export interface ValidationResult {
  is_valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  severity: 'critical' | 'warning';
  category: string;
  message: string;
  details: Record<string, any>;
}

const STAT_NAMES = ['attack', 'defense', 'dodge', 'crit_rate'];
const HELMET_TYPES = ['helmet', 'head', 'mask', 'crown'];

export function validatePlayerStats(
  playerStats: PlayerStats,
  previousStats?: PlayerStats
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Validate ability_points <= level - 1
  const expectedAbilityPoints = playerStats.level - 1;
  if (playerStats.ability_points < 0) {
    issues.push({
      severity: 'critical',
      category: 'ability_points',
      message: 'Ability points cannot be negative',
      details: { ability_points: playerStats.ability_points, level: playerStats.level },
    });
  }

  if (playerStats.ability_points > expectedAbilityPoints) {
    issues.push({
      severity: 'critical',
      category: 'ability_points',
      message: 'Ability points exceed expected maximum for level',
      details: {
        ability_points: playerStats.ability_points,
        expected_max: expectedAbilityPoints,
        level: playerStats.level,
      },
    });
  }

  // 2. Validate XP monotonicity
  if (previousStats && playerStats.xp < previousStats.xp) {
    issues.push({
      severity: 'critical',
      category: 'xp_mutation',
      message: 'XP decreased - monotonicity violated',
      details: { previous_xp: previousStats.xp, current_xp: playerStats.xp },
    });
  }

  // 3. Validate level/XP correspondence
  const calculatedLevel = calculateLevelFromXP(playerStats.xp);
  if (playerStats.level !== calculatedLevel) {
    issues.push({
      severity: 'critical',
      category: 'level_xp_mismatch',
      message: 'Level does not match XP progression',
      details: {
        stored_level: playerStats.level,
        calculated_level: calculatedLevel,
        xp: playerStats.xp,
      },
    });
  }

  // 4. Validate stat values non-negative
  for (const statName of STAT_NAMES) {
    const val = playerStats.stats[statName as keyof typeof playerStats.stats];
    if (val < 0) {
      issues.push({
        severity: 'critical',
        category: 'stat_validity',
        message: `Stat ${statName} is negative`,
        details: { stat: statName, value: val },
      });
    }
  }

  return { is_valid: issues.filter((i) => i.severity === 'critical').length === 0, issues };
}

export function validateGearInventory(inventory: PlayerInventory): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Check for duplicate gear
  const equippedIds = Object.values(inventory.equipped_gear).filter((id) => id !== null);
  if (new Set(equippedIds).size < equippedIds.length) {
    issues.push({
      severity: 'critical',
      category: 'duplicate_equipped_gear',
      message: 'Same gear equipped in multiple slots',
      details: { equipped: inventory.equipped_gear },
    });
  }

  // 2. Check for multiple helmets
  const helmetSlots: string[] = [];
  for (const [slot, gearId] of Object.entries(inventory.equipped_gear)) {
    if (gearId) {
      const gear = inventory.gear.find((g) => g.id === gearId);
      if (gear && HELMET_TYPES.some((h) => gear.type.toLowerCase().includes(h))) {
        helmetSlots.push(slot);
      }
    }
  }
  if (helmetSlots.length > 1) {
    issues.push({
      severity: 'critical',
      category: 'multiple_helmets',
      message: 'Multiple helmet/head pieces equipped',
      details: { helmet_count: helmetSlots.length, slots: helmetSlots },
    });
  }

  // 3. Validate all equipped gear exists
  for (const [slot, gearId] of Object.entries(inventory.equipped_gear)) {
    if (gearId && !inventory.gear.find((g) => g.id === gearId)) {
      issues.push({
        severity: 'critical',
        category: 'missing_equipped_gear',
        message: 'Equipped gear not found in inventory',
        details: { slot, gear_id: gearId },
      });
    }
  }

  return { is_valid: issues.filter((i) => i.severity === 'critical').length === 0, issues };
}

export function recordStatMutation(
  nk: Runtime.Nakama,
  userId: string,
  ipAddress: string | undefined | null,
  before: Record<string, number>,
  after: Record<string, number>,
  source: string
): void {
  const delta: Record<string, number> = {};
  for (const key of Object.keys(after)) {
    delta[key] = after[key] - (before[key] || 0);
  }

  logAudit(
    nk,
    userId,
    ipAddress ?? null,
    'stat_mutation',
    'player_stats',
    { before, after, delta, source },
    'success'
  );
}

export function validateFullProgression(
  nk: Runtime.Nakama,
  userId: string,
  logger: Runtime.Logger,
  playerStats: PlayerStats,
  inventory: PlayerInventory,
  ipAddress?: string
): ValidationResult {
  const statsValidation = validatePlayerStats(playerStats);
  const gearValidation = validateGearInventory(inventory);

  const allIssues = [...statsValidation.issues, ...gearValidation.issues];
  const isValid = statsValidation.is_valid && gearValidation.is_valid;

  if (!isValid) {
    logAudit(
      nk,
      userId,
      ipAddress ?? (null as any),
      'progression_validation',
      'player_progression',
      { stats_issues: statsValidation.issues, gear_issues: gearValidation.issues },
      'success'
    );
    logger.warn(
      'Progression validation failed for user %s: %d critical issues',
      userId,
      allIssues.filter((i) => i.severity === 'critical').length
    );
  }

  return { is_valid: isValid, issues: allIssues };
}

function calculateLevelFromXP(xp: number): number {
  return getLevelForXp(xp);
}

export const ProgressionValidation = {
  validatePlayerStats,
  validateGearInventory,
  validateFullProgression,
  recordStatMutation,
};
