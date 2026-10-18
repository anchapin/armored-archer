/**
 * Weapon Balance Module
 * @fileoverview Manages weapon balance data, validation, and admin adjustments for PvP.
 */

import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { toStorageValue, getStorageRawValue } from '../utils/storage-helpers';
import { withAdminGuard } from './admin_auth';
import { logAudit } from './audit';
import { generateWeaponStats, WeaponStats } from './matchmaking_analytics';
import { validatePayload, ZodSchemas } from './validation';

/**
 * Weapon tier definitions with power multipliers.
 * These correspond to the gear_rarity enum values.
 */
export enum WeaponTier {
  COMMON = 0,
  RARE = 1,
  EPIC = 2,
  LEGENDARY = 3,
}

/**
 * Damage multipliers for each weapon tier.
 */
const TIER_MULTIPLIERS: Record<WeaponTier, number> = {
  [WeaponTier.COMMON]: 1.0,
  [WeaponTier.RARE]: 1.3,
  [WeaponTier.EPIC]: 1.6,
  [WeaponTier.LEGENDARY]: 2.0,
};

/**
 * Base damage values for each gear type.
 */
const BASE_DAMAGES: Record<string, number> = {
  helm: 0,
  armor: 0,
  bow: 10,
  arrow: 5,
  amulet: 2,
};

/**
 * PvP damage reduction coefficient.
 */
const PVP_DAMAGE_REDUCTION = 0.85;

/**
 * Maximum damage as percentage of tier average (anti-one-shot protection).
 */
const MAX_DAMAGE_PERCENTAGE = 2.0;

/**
 * Weapon balance adjustment record.
 */
export interface BalanceAdjustment {
  adjustment_id: string;
  weapon_id: string;
  multiplier: number;
  reason: string;
  created_at: number;
  created_by: string; // Admin user ID
}

/**
 * Weapon usage statistics for balance tuning.
 */
export interface WeaponUsageStats {
  weapon_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  average_rating_diff: number;
  last_updated: number;
}

/**
 * Request to apply a balance adjustment.
 */
export interface ApplyBalanceAdjustmentRequest {
  weapon_id: string;
  multiplier: number;
  reason: string;
}

/**
 * Response for weapon power rating.
 */
export interface WeaponPowerRatingResponse {
  weapon_id: string;
  power_rating: number;
  tier: WeaponTier;
  base_damage: number;
}

/**
 * Calculates PvP-optimized damage for a weapon.
 *
 * @param base_damage - Base damage value from weapon definition
 * @param tier - Weapon tier (0=Common, 1=Rare, 2=Epic, 3=Legendary)
 * @param weapon_stats - Optional stat bonuses
 * @param balance_multiplier - Optional balance adjustment multiplier
 * @returns PvP damage value
 */
export function calculatePvpDamage(
  base_damage: number,
  tier: WeaponTier,
  weapon_stats: Record<string, number> = {},
  balance_multiplier: number = 1.0
): number {
  let pvpDamage = base_damage;

  // Apply tier multiplier
  const tierMultiplier = TIER_MULTIPLIERS[tier] || TIER_MULTIPLIERS[WeaponTier.COMMON];
  pvpDamage *= tierMultiplier;

  // Add stat-based damage BEFORE the curve (so stats aren't negated by diminishing returns)
  if (weapon_stats.attack) {
    pvpDamage += weapon_stats.attack * 0.5;
  }
  if (weapon_stats.ability_power) {
    pvpDamage += weapon_stats.ability_power * 0.3;
  }

  // Apply damage curve with diminishing returns
  pvpDamage = applyDamageCurve(pvpDamage, tier);

  // Apply PvP damage reduction
  pvpDamage *= PVP_DAMAGE_REDUCTION;

  // Enforce maximum damage cap
  const maxAllowed = getTierAverageDamage(tier) * MAX_DAMAGE_PERCENTAGE;
  if (pvpDamage > maxAllowed) {
    pvpDamage = maxAllowed;
  }

  // Apply balance adjustment
  pvpDamage *= balance_multiplier;

  return Math.max(0, pvpDamage);
}

/**
 * Applies diminishing returns to high damage values.
 *
 * Uses a logarithmic curve to prevent exponential scaling.
 *
 * @param damage - Input damage value
 * @param tier - Weapon tier for curve tuning
 * @returns Curve-adjusted damage value
 */
function applyDamageCurve(damage: number, tier: WeaponTier): number {
  if (damage <= 0) return 0;

  const curveFactor = 0.1 + tier * 0.025;
  return damage * (1.0 - curveFactor * Math.log(1.0 + damage / 20.0));
}

/**
 * Calculates the average expected damage for a weapon tier.
 *
 * @param tier - Weapon tier
 * @returns Average damage value for the tier
 */
function getTierAverageDamage(tier: WeaponTier): number {
  const tierMultiplier = TIER_MULTIPLIERS[tier] || 1.0;
  const avgBowDamage = BASE_DAMAGES.bow * tierMultiplier;
  const avgArrowDamage = BASE_DAMAGES.arrow * tierMultiplier;
  return (avgBowDamage + avgArrowDamage) / 2.0;
}

/**
 * Calculates weapon power rating for matchmaking.
 *
 * @param weaponData - Weapon information
 * @returns Power rating (higher = more powerful)
 */
export function calculateWeaponPowerRating(weaponData: {
  gear_type: string;
  rarity: WeaponTier;
  stats?: Record<string, number>;
}): number {
  let powerRating = 0;

  // Base power from tier
  const basePower = 100 * (weaponData.rarity + 1);
  powerRating += basePower;

  // Add power from stats
  if (weaponData.stats) {
    const stats = weaponData.stats;
    if (stats.attack) powerRating += stats.attack * 2;
    if (stats.ability_power) powerRating += stats.ability_power * 2;
    if (stats.critical_chance) powerRating += stats.critical_chance * 5;
    if (stats.critical_damage) powerRating += stats.critical_damage * 2;
    if (stats.defense) powerRating += stats.defense;
  }

  return Math.max(0, powerRating);
}

/**
 * Validates that a weapon's damage falls within acceptable range.
 *
 * @param baseDamage - Weapon's base damage
 * @param tier - Weapon tier
 * @returns True if damage is valid, false otherwise
 */
export function validateWeaponPower(baseDamage: number, tier: WeaponTier): boolean {
  const maxAllowed = getTierAverageDamage(tier) * MAX_DAMAGE_PERCENTAGE;

  if (baseDamage > maxAllowed) {
    logger.warn('Weapon damage exceeds maximum allowed', { baseDamage, maxAllowed, tier });
    return false;
  }

  return true;
}

/**
 * Applies a balance adjustment to a weapon.
 *
 * This is an admin function that allows hotfixes without code deployment.
 *
 * @param nk - Nakama runtime module
 * @param userId - Admin user ID
 * @param request - Balance adjustment request
 * @returns Success response or error
 */
export async function applyBalanceAdjustment(
  nk: Runtime.Nakama,
  userId: string,
  request: ApplyBalanceAdjustmentRequest
): Promise<{ success: boolean; error?: string; adjustment?: BalanceAdjustment }> {
  // Validate multiplier
  if (request.multiplier <= 0) {
    return {
      success: false,
      error: 'Balance multiplier must be positive',
    };
  }

  // Validate reason
  if (!request.reason || request.reason.trim().length === 0) {
    return {
      success: false,
      error: 'Reason is required for balance adjustments',
    };
  }

  // Check if user is admin (simplified - in production, check admin roles)
  const isAuthorized = await checkAdminAuthorization(nk, userId);
  if (!isAuthorized) {
    return {
      success: false,
      error: 'Unauthorized: Admin access required',
    };
  }

  // Create adjustment record
  const adjustment: BalanceAdjustment = {
    adjustment_id: `bal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    weapon_id: request.weapon_id,
    multiplier: request.multiplier,
    reason: request.reason,
    created_at: Date.now(),
    created_by: userId,
  };

  // Store adjustment in Nakama storage
  try {
    await nk.storageWrite([
      {
        collection: 'weapon_balance_adjustments',
        key: adjustment.adjustment_id,
        userId: userId,
        value: toStorageValue(adjustment),
        permissionRead: 2, // Public read (for clients to fetch)
        permissionWrite: 0, // No public write
      },
    ]);

    // Log audit trail
    await logAudit(
      nk,
      userId,
      null, // ipAddress - not available in this context
      'balance_adjustment_applied',
      'weapon_balance_adjustment',
      {
        weapon_id: request.weapon_id,
        multiplier: request.multiplier,
        reason: request.reason,
        adjustment_id: adjustment.adjustment_id,
      },
      'success'
    );

    return {
      success: true,
      adjustment,
    };
  } catch (error) {
    logger.error('Failed to apply balance adjustment', { error, userId, request });
    return {
      success: false,
      error: 'Failed to store balance adjustment',
    };
  }
}

/**
 * Checks if a user has admin authorization.
 *
 * @param nk - Nakama runtime module
 * @param userId - User ID to check
 * @returns True if user is authorized
 */
async function checkAdminAuthorization(nk: Runtime.Nakama, userId: string): Promise<boolean> {
  try {
    // In production, this would check user groups or roles
    // For now, we'll check for an admin flag in user storage
    const objects = await nk.storageRead([
      {
        collection: 'user_metadata',
        key: 'admin_status',
        userId: userId,
      },
    ]);

    if (objects.length > 0) {
      const data = objects[0].value;
      const metadata = (typeof data === 'string' ? JSON.parse(data) : data) as Record<
        string,
        unknown
      >;
      return metadata.is_admin === true;
    }

    return false;
  } catch (error) {
    logger.error('Failed to check admin authorization', { error, userId });
    return false;
  }
}

/**
 * Tracks weapon usage statistics for balance tuning.
 *
 * @param nk - Nakama runtime module
 * @param weaponId - Weapon identifier
 * @param matchResult - Match outcome (win/loss)
 * @param ratingDiff - Rating difference between players
 */
export async function trackWeaponUsage(
  nk: Runtime.Nakama,
  weaponId: string,
  matchResult: 'win' | 'loss',
  ratingDiff: number
): Promise<void> {
  try {
    const statsKey = `weapon_stats_${weaponId}`;
    const objects = await nk.storageRead([
      {
        collection: 'weapon_usage_stats',
        key: statsKey,
        userId: '00000000-0000-0000-0000-000000000000', // System user
      },
    ]);

    let stats: WeaponUsageStats = {
      weapon_id: weaponId,
      matches_played: 0,
      wins: 0,
      losses: 0,
      average_rating_diff: 0,
      last_updated: Date.now(),
    };

    if (objects.length > 0) {
      stats = JSON.parse(getStorageRawValue(objects[0].value) ?? '') as WeaponUsageStats;
    }

    // Update statistics
    stats.matches_played += 1;
    if (matchResult === 'win') {
      stats.wins += 1;
    } else {
      stats.losses += 1;
    }

    // Update average rating difference (running average)
    stats.average_rating_diff =
      (stats.average_rating_diff * (stats.matches_played - 1) + ratingDiff) / stats.matches_played;
    stats.last_updated = Date.now();

    // Store updated stats
    await nk.storageWrite([
      {
        collection: 'weapon_usage_stats',
        key: statsKey,
        userId: '00000000-0000-0000-0000-000000000000',
        value: toStorageValue(stats),
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);
  } catch (error) {
    logger.error('Failed to track weapon usage', { error, weaponId, matchResult });
  }
}

/**
 * Retrieves current balance adjustments for all weapons.
 *
 * @param nk - Nakama runtime module
 * @returns Map of weapon_id to multiplier
 */
export async function getBalanceAdjustments(nk: Runtime.Nakama): Promise<Record<string, number>> {
  try {
    // Read all balance adjustments
    const objects = await nk.storageRead([
      {
        collection: 'weapon_balance_adjustments',
        userId: '00000000-0000-0000-0000-000000000000', // System user
        key: '*',
      },
    ]);

    const adjustments: Record<string, number> = {};

    for (const obj of objects) {
      const adjustment = JSON.parse(getStorageRawValue(obj.value) ?? '') as BalanceAdjustment;
      // Use the most recent adjustment for each weapon
      if (!adjustments[adjustment.weapon_id] || obj.createTime > 0) {
        adjustments[adjustment.weapon_id] = adjustment.multiplier;
      }
    }

    return adjustments;
  } catch (error) {
    logger.error('Failed to get balance adjustments', { error });
    return {};
  }
}

/**
 * Admin RPC handler for applying balance adjustments.
 *
 * @param ctx - Runtime context
 * @param logger - Runtime logger
 * @param nk - Nakama runtime module
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
export async function rpcApplyBalanceAdjustment(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.debug('ApplyBalanceAdjustment RPC called');

  // Validate payload
  const validation = validatePayload(
    ZodSchemas.apply_balance_adjustment,
    payload,
    'apply_balance_adjustment'
  );
  if (!validation.success) {
    return JSON.stringify(validation.error);
  }

  // Apply adjustment
  const result = await applyBalanceAdjustment(nk, ctx.userId, validation.data);

  return JSON.stringify(result);
}

/**
 * Retrieves weapon usage statistics for a specific weapon.
 *
 * @param nk - Nakama runtime module
 * @param weaponId - Weapon identifier
 * @returns Weapon usage statistics
 */
export async function getWeaponStats(
  nk: Runtime.Nakama,
  weaponId: string
): Promise<WeaponUsageStats | null> {
  try {
    const statsKey = `weapon_stats_${weaponId}`;
    const objects = await nk.storageRead([
      {
        collection: 'weapon_usage_stats',
        key: statsKey,
        userId: '00000000-0000-0000-0000-000000000000',
      },
    ]);

    if (objects.length > 0) {
      return JSON.parse(getStorageRawValue(objects[0].value) ?? '') as WeaponUsageStats;
    }

    return null;
  } catch (error) {
    logger.error('Failed to get weapon stats', { error, weaponId });
    return null;
  }
}

/**
 * Minimum matches before a weapon's win rate is treated as signal in the
 * admin balance report.
 */
const MIN_MATCHES_FOR_BALANCE_FLAG = 20;

/** Win-rate band (fraction) outside which a weapon is flagged for review. */
const WIN_RATE_FLAG_LOW = 0.45;
const WIN_RATE_FLAG_HIGH = 0.55;

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Synchronously read the current balance adjustment multipliers.
 *
 * @param nk - Nakama runtime module
 * @returns Map of weapon_id to multiplier
 */
function getBalanceAdjustmentsSync(nk: Runtime.Nakama): Record<string, number> {
  const adjustments: Record<string, number> = {};
  try {
    const rows = nk.storageList(
      SYSTEM_USER_ID,
      'weapon_balance_adjustments',
      100,
      ''
    ) as unknown as { objects?: Runtime.StorageObject[] };
    for (const obj of normalizeList(rows)) {
      const adjustment = JSON.parse(getStorageRawValue(obj.value) ?? '') as BalanceAdjustment;
      const existing = adjustments[adjustment.weapon_id];
      if (existing === undefined) {
        adjustments[adjustment.weapon_id] = adjustment.multiplier;
      }
    }
  } catch (error) {
    logger.error('Failed to list balance adjustments', { error });
  }
  return adjustments;
}

/** Normalize a storageList result across runtime/mock shapes. */
function normalizeList(rows: unknown): Runtime.StorageObject[] {
  if (!rows) return [];
  if (Array.isArray(rows)) return rows as Runtime.StorageObject[];
  const objects = (rows as { objects?: Runtime.StorageObject[] }).objects;
  return Array.isArray(objects) ? objects : [];
}

/**
 * Per-weapon row in the admin balance report.
 */
interface WeaponBalanceReportRow {
  weapon_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_rating_diff: number;
  balance_multiplier: number;
  flagged: boolean;
  flag_reason?: string;
}

function buildReportRow(
  stats: WeaponStats,
  adjustments: Record<string, number>
): WeaponBalanceReportRow {
  const winRate = stats.matches_played > 0 ? stats.wins / stats.matches_played : 0;
  const row: WeaponBalanceReportRow = {
    weapon_id: stats.weapon_id,
    matches_played: stats.matches_played,
    wins: stats.wins,
    losses: stats.losses,
    win_rate: winRate,
    avg_rating_diff: stats.avg_rating_diff,
    balance_multiplier: adjustments[stats.weapon_id] ?? 1.0,
    flagged: false,
  };
  if (stats.matches_played >= MIN_MATCHES_FOR_BALANCE_FLAG) {
    if (winRate > WIN_RATE_FLAG_HIGH) {
      row.flagged = true;
      row.flag_reason = 'overperforming';
    } else if (winRate < WIN_RATE_FLAG_LOW) {
      row.flagged = true;
      row.flag_reason = 'underperforming';
    }
  }
  return row;
}

/**
 * Admin RPC handler for the weapon balance report.
 *
 * ADR-0008: synchronous - a Promise returned to Nakama never resolves, and
 * withAdminGuard throws at call time if one slips through (issue #1683).
 *
 * @param ctx - Runtime context
 * @param logger - Runtime logger
 * @param nk - Nakama runtime module
 * @param payload - Request payload (optional weapon_id)
 * @returns Weapon balance report JSON
 */
export function rpcGetBalanceMetrics(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.debug('GetBalanceMetrics RPC called');

  const validation = validatePayload(
    ZodSchemas.get_balance_metrics,
    payload,
    'get_balance_metrics'
  );
  if (!validation.success) {
    return JSON.stringify({ success: false, error: validation.error });
  }

  try {
    const adjustments = getBalanceAdjustmentsSync(nk);
    // Live telemetry lives in matchmaking_weapon_stats (written by the
    // registered log_weapon_result RPC); the older weapon_usage_stats
    // collection has no writer and is ignored.
    const allStats = generateWeaponStats(nk);
    const weaponId = validation.data?.weapon_id;

    if (weaponId) {
      // Report for a single weapon
      const stats = allStats[weaponId] ?? null;
      return JSON.stringify({
        success: true,
        weapon_id: weaponId,
        balance_multiplier: adjustments[weaponId] || 1.0,
        usage_stats: stats,
      });
    }

    // Full report: every tracked weapon plus the adjustment summary
    const weapons = Object.values(allStats).map((stats) => buildReportRow(stats, adjustments));
    return JSON.stringify({
      success: true,
      active_adjustments: Object.keys(adjustments).length,
      adjustments,
      weapons,
      flagged_weapons: weapons.filter((row) => row.flagged).map((row) => row.weapon_id),
    });
  } catch (error) {
    logger.error('Failed to get balance metrics: %s', error);
    return JSON.stringify({
      success: false,
      error: 'Failed to retrieve balance metrics',
    });
  }
}

/**
 * Register the admin-gated weapon balance report RPC.
 *
 * The report exposes aggregate win/loss telemetry for every weapon, so it is
 * wrapped in the shared admin gate (ADMIN_USER_IDS allowlist) exactly like
 * the error-insight endpoints (issue #1075).
 */
export function registerRpcGetBalanceMetrics(initializer: Runtime.Initializer): void {
  initializer.registerRpc(
    'armored_archer/get_balance_metrics',
    withAdminGuard('armored_archer/get_balance_metrics', rpcGetBalanceMetrics)
  );
}

// Export constants for use in other modules
export const WEAPON_BALANCE_CONSTANTS = {
  TIER_MULTIPLIERS,
  BASE_DAMAGES,
  PVP_DAMAGE_REDUCTION,
  MAX_DAMAGE_PERCENTAGE,
};
