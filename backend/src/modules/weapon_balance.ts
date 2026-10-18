/**
 * Weapon Balance Module
 * @fileoverview Manages weapon balance data, validation, and admin adjustments for PvP.
 */

import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { getStorageRawValue } from '../utils/storage-helpers';
import { withAdminGuard } from './admin_auth';
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
