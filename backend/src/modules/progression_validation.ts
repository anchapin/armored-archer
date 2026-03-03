/**
 * Progression Validation module.
 * @fileoverview Validates player progression data integrity and detects anomalies.
 * Ensures: stat mutations, gear consistency, XP monotonicity, ability point calculations, impossible stat combos.
 */

import { Runtime } from '../types/nakama';
import { PlayerStats } from './rpg_system';
import { PlayerInventory, GearItem } from './gear_system';
import { logAudit } from './audit';

/**
 * Validation result containing detected issues and severity.
 */
export interface ValidationResult {
  is_valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Individual validation issue detected.
 */
export interface ValidationIssue {
  severity: 'critical' | 'warning';
  category: string;
  message: string;
  details: Record<string, any>;
}

/**
 * Stat mutation record for tracking changes.
 */
export interface StatMutation {
  timestamp: number;
  before: Record<string, number>;
  after: Record<string, number>;
  delta: Record<string, number>;
  source: string; // 'gain_xp', 'allocate_stats', 'gear_equip', etc.
}

const STAT_NAMES = ['attack', 'defense', 'dodge', 'crit_rate'];
const GEAR_SLOTS = ['weapon', 'armor', 'accessory'];
const HELMET_TYPES = ['helmet', 'head', 'mask', 'crown'];

/**
 * Validates player stats for integrity violations.
 *
 * @param playerStats - Player stats to validate
 * @param previousStats - Previous state for comparison
 * @returns ValidationResult with any detected issues
 */
export function validatePlayerStats(
  playerStats: PlayerStats,
  previousStats?: PlayerStats
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Validate ability_points = level - 1
  const expectedAbilityPoints = playerStats.level - 1;
  if (playerStats.ability_points < 0) {
    issues.push({
      severity: 'critical',
      category: 'ability_points',
      message: 'Ability points cannot be negative',
      details: {
        ability_points: playerStats.ability_points,
        level: playerStats.level,
      },
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

  // 2. Validate XP monotonicity (only increases)
  if (previousStats && playerStats.xp < previousStats.xp) {
    issues.push({
      severity: 'critical',
      category: 'xp_mutation',
      message: 'XP decreased - monotonicity violated',
      details: {
        previous_xp: previousStats.xp,
        current_xp: playerStats.xp,
        delta: playerStats.xp - previousStats.xp,
      },
    });
  }

  // 3. Validate level progression consistency with XP
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

  // 4. Validate stat values are non-negative
  for (const statName of STAT_NAMES) {
    const statValue = playerStats.stats[statName as keyof typeof playerStats.stats];
    if (statValue < 0) {
      issues.push({
        severity: 'critical',
        category: 'stat_validity',
        message: `Stat ${statName} is negative`,
        details: {
          stat: statName,
          value: statValue,
        },
      });
    }
  }

  // 5. Detect impossible stat combinations
  const impossibleCombos = detectImpossibleStatCombos(playerStats.stats);
  if (impossibleCombos.length > 0) {
    issues.push({
      severity: 'warning',
      category: 'impossible_stats',
      message: 'Impossible stat combination detected',
      details: {
        combos: impossibleCombos,
        stats: playerStats.stats,
      },
    });
  }

  return {
    is_valid: issues.filter((i) => i.severity === 'critical').length === 0,
    issues,
  };
}

/**
 * Validates gear inventory for consistency violations.
 *
 * @param inventory - Player inventory to validate
 * @returns ValidationResult with any detected issues
 */
export function validateGearInventory(inventory: PlayerInventory): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Validate no duplicate gear IDs in equipped slots
  const equippedGearIds = Object.values(inventory.equipped_gear).filter((id) => id !== null);
  const uniqueEquippedIds = new Set(equippedGearIds);

  if (uniqueEquippedIds.size < equippedGearIds.length) {
    const duplicates = equippedGearIds.filter(
      (id) => equippedGearIds.indexOf(id) !== equippedGearIds.lastIndexOf(id)
    );
    issues.push({
      severity: 'critical',
      category: 'duplicate_equipped_gear',
      message: 'Same gear equipped in multiple slots',
      details: {
        duplicates,
        equipped: inventory.equipped_gear,
      },
    });
  }

  // 2. Validate no multiple helms/head gear
  const helmetSlots: string[] = [];
  for (const [slot, gearId] of Object.entries(inventory.equipped_gear)) {
    if (gearId) {
      const gear = inventory.gear.find((g) => g.id === gearId);
      if (gear && isHelmetType(gear)) {
        helmetSlots.push(slot);
      }
    }
  }

  if (helmetSlots.length > 1) {
    issues.push({
      severity: 'critical',
      category: 'multiple_helmets',
      message: 'Multiple helmet/head pieces equipped',
      details: {
        helmet_count: helmetSlots.length,
        slots: helmetSlots,
      },
    });
  }

  // 3. Validate all equipped gear exists in inventory
  for (const [slot, gearId] of Object.entries(inventory.equipped_gear)) {
    if (gearId && !inventory.gear.find((g) => g.id === gearId)) {
      issues.push({
        severity: 'critical',
        category: 'missing_equipped_gear',
        message: 'Equipped gear not found in inventory',
        details: {
          slot,
          gear_id: gearId,
        },
      });
    }
  }

  // 4. Validate equipped gear slots are valid
  for (const slot of Object.keys(inventory.equipped_gear)) {
    if (!GEAR_SLOTS.includes(slot)) {
      issues.push({
        severity: 'warning',
        category: 'invalid_gear_slot',
        message: 'Invalid gear slot encountered',
        details: {
          slot,
          valid_slots: GEAR_SLOTS,
        },
      });
    }
  }

  return {
    is_valid: issues.filter((i) => i.severity === 'critical').length === 0,
    issues,
  };
}

/**
 * Logs a stat mutation with before/after values and audit trail.
 *
 * @param nk - Nakama server interface
 * @param userId - User ID
 * @param ipAddress - IP address of request (optional)
 * @param before - Stats before mutation
 * @param after - Stats after mutation
 * @param source - Source of mutation (action that caused it)
 */
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

  const mutation: StatMutation = {
    timestamp: Date.now(),
    before,
    after,
    delta,
    source,
  };

  // Log to audit trail
  logAudit(
    nk,
    userId,
    ipAddress ?? null,
    'stat_mutation',
    'player_stats',
    {
      mutation,
    },
    'success'
  );

  // Store mutation record for analytics
  try {
    nk.storageWrite([
      {
        collection: 'stat_mutations',
        key: `mutation_${Date.now()}_${userId}_${Math.random().toString(36).substring(7)}`,
        userId,
        value: JSON.stringify(mutation),
      },
    ]);
  } catch (err) {
    console.error('Failed to record stat mutation:', err);
  }
}

/**
 * Validates entire player progression state for consistency.
 *
 * @param nk - Nakama server interface
 * @param userId - User ID to validate
 * @param logger - Logger instance
 * @param playerStats - Player stats data
 * @param inventory - Player inventory data
 * @param ipAddress - IP address of request (optional)
 * @returns Full validation result with audit logging
 */
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

  // Log validation result
  if (!isValid) {
    logAudit(
      nk,
      userId,
      ipAddress ?? null as any,
      'progression_validation',
      'player_progression',
      {
        stats_issues: statsValidation.issues,
        gear_issues: gearValidation.issues,
        stats_valid: statsValidation.is_valid,
        gear_valid: gearValidation.is_valid,
      },
      'success'
    );

    logger.warn(
      'Progression validation failed for user %s: %d critical issues',
      userId,
      allIssues.filter((i) => i.severity === 'critical').length
    );
  }

  return {
    is_valid: isValid,
    issues: allIssues,
  };
}

// --- Helper Functions ---

/**
 * Calculates level from XP using progression formula.
 */
function calculateLevelFromXP(xp: number): number {
  // Formula: level = floor(sqrt(xp / 100)) + 1
  // Adjust based on your actual progression curve
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

/**
 * Detects impossible stat combinations that suggest tampering.
 */
function detectImpossibleStatCombos(stats: Record<string, number>): string[] {
  const combos: string[] = [];

  // Example: Having max crit_rate AND max dodge is statistically improbable
  // if they share stat points from a limited pool
  if (stats.crit_rate > 50 && stats.dodge > 50) {
    combos.push('High crit_rate AND high dodge (resource conflict)');
  }

  // Having max attack and max defense suggests point duplication
  if (stats.attack > 100 && stats.defense > 100) {
    combos.push('Excessive attack and defense values');
  }

  return combos;
}

/**
 * Checks if a gear item is a helmet/head piece.
 */
function isHelmetType(gear: GearItem): boolean {
  const type = gear.type.toLowerCase();
  return HELMET_TYPES.some((helmet) => type.includes(helmet));
}

/**
 * Exports validation functions for use in RPC handlers.
 */
export const ProgressionValidation = {
  validatePlayerStats,
  validateGearInventory,
  validateFullProgression,
  recordStatMutation,
};
