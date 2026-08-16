/**
 * Gear Balance module.
 * @fileoverview Manages gear stat validation, power calculations, and balance tracking.
 */

import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { logAudit } from './audit';
import { GearItem } from './gear_system';

/**
 * Soft cap ratio for diminishing returns.
 * Soft cap is 70% of maximum stat value.
 */
const SOFT_CAP_RATIO = 0.7;

/**
 * Diminishing factor reduces efficiency as stat approaches cap.
 */
const DIMINISHING_FACTOR = 0.5;

/**
 * Maximum stat values per gear type.
 */
const MAX_STATS: { [key: string]: { [key: string]: number } } = {
  helm: { defense: 100, health: 500 },
  armor: { defense: 150, health: 600 },
  bow: { attack: 150, crit_rate: 30 },
  arrow: { attack: 100, crit_rate: 25 },
  amulet: { dodge: 30, crit_rate: 20 },
};

/**
 * Power rating multipliers by rarity.
 */
const RARITY_MULTIPLIERS: { [key: string]: number } = {
  common: 1.0,
  rare: 1.5,
  epic: 1.8,
  legendary: 2.2,
};

/**
 * Stat weights for power rating calculation.
 */
const STAT_WEIGHTS: { [key: string]: number } = {
  attack: 1.0,
  defense: 0.8,
  health: 0.3,
  speed: 0.7,
  dodge: 1.2,
  crit_rate: 1.5,
};

/**
 * Maximum power rating thresholds per rarity.
 */
const MAX_POWER_THRESHOLDS: { [key: string]: number } = {
  common: 15.0,
  rare: 40.0,
  epic: 60.0,
  legendary: 100.0,
};

/**
 * Gear usage data stored for balance analytics.
 */
interface GearUsageData {
  count: number;
  lastAction: string;
  lastTimestamp: number;
}

/**
 * Validates gear stats to prevent overpowered items.
 *
 * @param gear - Gear item to validate
 * @returns Validation result with valid flag and reason if invalid
 */
export function validateGearStats(gear: GearItem): { valid: boolean; reason?: string } {
  const power = calculateGearPower(gear);
  const threshold = MAX_POWER_THRESHOLDS[gear.rarity] || 15.0;

  if (power > threshold) {
    return {
      valid: false,
      reason: `Power rating ${power.toFixed(2)} exceeds threshold ${threshold} for ${gear.rarity} rarity`,
    };
  }

  // Check individual stats against caps
  for (const stat of gear.stats) {
    const maxAllowed = MAX_STATS[gear.type]?.[stat.name] ?? 100.0;
    if (stat.value > maxAllowed) {
      return {
        valid: false,
        reason: `Stat ${stat.name} value ${stat.value} exceeds maximum ${maxAllowed}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Calculates gear power rating.
 *
 * @param gear - Gear item to calculate power for
 * @returns Power rating (0.0 to 100.0 scale)
 */
export function calculateGearPower(gear: GearItem): number {
  let power = 0.0;

  const rarityMult = RARITY_MULTIPLIERS[gear.rarity] || 1.0;

  // Add weighted stat contributions
  for (const stat of gear.stats) {
    const weight = STAT_WEIGHTS[stat.name] || 1.0;
    power += stat.value * weight;
  }

  // Add modifier contributions
  for (const modifier of gear.modifiers) {
    const avgValue = (modifier.value_range[0] + modifier.value_range[1]) / 2.0;
    power += avgValue * 2.0; // Modifiers are more impactful
  }

  // Apply rarity multiplier
  power *= rarityMult;

  // Normalize to 0-100 scale
  return Math.min(power, 100.0);
}

/**
 * Calculates effective stat with diminishing returns.
 *
 * @param baseStat - Base stat value before diminishing returns
 * @param synergyBonus - Bonus from gear set synergies (0.0 to 1.0)
 * @param gearType - Type of gear to determine soft cap
 * @param statName - Name of the stat for max value lookup
 * @returns Effective stat value after diminishing returns
 */
export function calculateEffectiveStat(
  baseStat: number,
  synergyBonus: number,
  gearType: string,
  statName: string
): number {
  const maxStat = MAX_STATS[gearType]?.[statName] ?? 100.0;
  const softCap = maxStat * SOFT_CAP_RATIO;

  // Apply diminishing returns only when approaching or exceeding soft cap
  // Diminishing returns start at 50% of soft cap
  const diminishingStart = softCap * 0.5;

  if (baseStat < diminishingStart) {
    // Below diminishing start, apply synergy bonus only
    return baseStat * (1.0 + synergyBonus);
  }

  // Apply diminishing returns: Effective = Base × (1 - (Stat / SoftCap) × 0.5)
  // Calculate ratio from diminishing start to soft cap
  const ratio = Math.min((baseStat - diminishingStart) / (softCap - diminishingStart), 1.0);
  const diminishingFactor = 1.0 - ratio * DIMINISHING_FACTOR;

  // Apply diminishing returns first, then synergy bonus
  const effective = baseStat * diminishingFactor * (1.0 + synergyBonus);

  return Math.max(0.0, effective);
}

/**
 * Tracks gear usage for balance tuning.
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID
 * @param gearId - Gear ID being used
 * @param action - Action type (equip, unequip, generate)
 * @returns Promise resolving when tracking is complete
 */
export async function trackGearUsage(
  nk: Runtime.Nakama,
  userId: string,
  gearId: string,
  action: 'equip' | 'unequip' | 'generate'
): Promise<void> {
  try {
    const storageKey = `gear_usage:${userId}:${gearId}`;
    const timestamp = Date.now();

    // Get existing usage data
    const objects = await nk.storageRead([
      {
        collection: 'gear_balance',
        key: storageKey,
        userId,
      },
    ]);

    let usageData = { count: 0, lastAction: '', lastTimestamp: 0 };

    if (objects.length > 0) {
      try {
        usageData = JSON.parse(objects[0].value);
      } catch {
        // Invalid data, start fresh
      }
    }

    // Update usage data
    if (action === 'equip') {
      usageData.count += 1;
    }

    usageData.lastAction = action;
    usageData.lastTimestamp = timestamp;

    // Store updated usage data
    await nk.storageWrite([
      {
        collection: 'gear_balance',
        key: storageKey,
        value: JSON.stringify(usageData),
        userId,
      },
    ]);

    // Log audit event
    logAudit(
      nk,
      userId,
      null,
      `gear_${action}`,
      `gear_${gearId}`,
      { gearId, timestamp },
      'success'
    );
  } catch (error) {
    // Log error but don't fail the operation
    logger.error('Failed to track gear usage', { error, userId, gearId, action });
  }
}

/**
 * Gets gear usage statistics for balance analysis.
 *
 * @param ctx - Nakama runtime context
 * @param userId - User ID to get stats for
 * @returns Promise resolving to usage statistics
 */
export async function getGearUsageStats(
  nk: Runtime.Nakama,
  userId: string
): Promise<{ [key: string]: GearUsageData }> {
  const stats: { [key: string]: GearUsageData } = {};

  try {
    // Read all gear balance objects for this user
    const objects = await nk.storageList(userId, 'gear_balance', 100, '', '');

    for (const obj of objects) {
      const gearId = obj.key.split(':')[2];
      try {
        const usageData = JSON.parse(obj.value);
        stats[gearId] = usageData;
      } catch {
        // Skip invalid entries
      }
    }
  } catch (error) {
    logger.error('Failed to get gear usage stats', { error, userId });
  }

  return stats;
}

/**
 * Records balance adjustment history.
 *
 * @param ctx - Nakama runtime context
 * @param adjustment - Adjustment details
 * @returns Promise resolving when adjustment is recorded
 */
export async function recordBalanceAdjustment(
  nk: Runtime.Nakama,
  adjustment: {
    gearId: string;
    stat: string;
    oldValue: number;
    newValue: number;
    reason: string;
  }
): Promise<void> {
  try {
    const storageKey = `balance_adjustments:${Date.now()}`;
    const timestamp = Date.now();

    const adjustmentData = {
      ...adjustment,
      timestamp,
    };

    await nk.storageWrite([
      {
        collection: 'gear_balance_history',
        key: storageKey,
        value: JSON.stringify(adjustmentData),
        userId: '00000000-0000-0000-0000-000000000000',
      },
    ]);

    // Log audit event
    logAudit(
      nk,
      '00000000-0000-0000-0000-000000000000',
      null,
      'balance_adjustment',
      'gear_balance',
      adjustmentData,
      'success'
    );
  } catch (error) {
    logger.error('Failed to record balance adjustment', { error, adjustment });
  }
}

/**
 * Calculates synergy bonus from gear set.
 *
 * @param equippedGear - Map of slot types to gear IDs
 * @returns Synergy bonuses object
 */
export function calculateSynergyBonus(equippedGear: { [key: string]: string }): {
  [key: string]: number;
} {
  const bonuses: { [key: string]: number } = {};

  // Define synergy groups
  const synergyGroups = {
    dragon_set: {
      pieces: ['helm_dragon', 'armor_plate', 'bow_crossbow', 'arrow_dragon', 'amulet_dragon'],
      bonuses: {
        2: { stat: 'attack', value: 5 },
        3: { stat: 'crit_rate', value: 3 },
        4: { stat: 'health', value: 50 },
        5: { stat: 'all', value: 10 },
      },
    },
    iron_set: {
      pieces: ['helm_iron', 'armor_chain', 'bow_composite', 'arrow_iron', 'amulet_power'],
      bonuses: {
        2: { stat: 'defense', value: 5 },
        3: { stat: 'health', value: 30 },
        4: { stat: 'dodge', value: 2 },
        5: { stat: 'defense', value: 15 },
      },
    },
  };

  for (const synergyName in synergyGroups) {
    const synergy = synergyGroups[synergyName as keyof typeof synergyGroups];
    const pieces = synergy.pieces;
    const bonusTiers = synergy.bonuses;

    // Count equipped pieces from this set
    let equippedCount = 0;
    for (const gearId of Object.values(equippedGear)) {
      if (gearId && pieces.includes(gearId)) {
        equippedCount++;
      }
    }

    // Apply bonuses based on count
    for (const tierCount of Object.keys(bonusTiers)) {
      const tier = parseInt(tierCount, 10);
      if (equippedCount >= tier) {
        const bonus = bonusTiers[tier as keyof typeof bonusTiers];
        const stat = bonus.stat;
        const value = bonus.value;

        if (stat === 'all') {
          bonuses['all_multiplier'] = Math.max(bonuses['all_multiplier'] || 0, value / 100);
        } else {
          bonuses[stat] = (bonuses[stat] || 0) + value;
        }
      }
    }
  }

  return bonuses;
}

/**
 * Validates that gear power is within safe limits.
 *
 * @param gear - Gear item to validate
 * @returns true if gear is valid, false otherwise
 */
export function isGearPowerValid(gear: GearItem): boolean {
  return validateGearStats(gear).valid;
}
