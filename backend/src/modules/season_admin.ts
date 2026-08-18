/**
 * Season Admin Tools module.
 * @fileoverview Provides admin RPC endpoints for season state inspection,
 * validation, and manual event triggering. Used by ops/QA for troubleshooting.
 *
 * == Endpoints ==
 *
 * 1. admin_get_season_state
 *    - Inspect season timing, leaderboard health, tier distribution, decay config.
 *    - Payload: { season_id?: string }
 *    - Read-only. Safe to call anytime.
 *
 * 2. admin_get_player_season
 *    - Inspect all season data for a single player across all storage collections.
 *    - Payload: { user_id: string, season_id?: string }
 *    - Read-only. Safe to call anytime.
 *
 * 3. admin_validate_season
 *    - Run validation checks: orphaned rewards, missing prestige, decay consistency,
 *      leaderboard integrity, reward distribution.
 *    - Payload: { season_id?: string, checks?: string[], auto_fix?: boolean }
 *    - With auto_fix=true, will repair issues in-place.
 *    - Without auto_fix (default), read-only diagnostic.
 *
 * 4. admin_trigger_season_event
 *    - Manually trigger: end_season, recalculate_ratings, recalculate_decay,
 *      fix_missing_rewards, rebuild_prestige.
 *    - Payload: { action: string, season_id?: string, dry_run?: boolean,
 *                 player_ids?: string[], confirmation_token?: string }
 *    - dry_run=true (default) returns a plan without executing.
 *    - end_season requires confirmation_token matching the season_id.
 *    - All mutations are audit-logged.
 */

import { Runtime } from '../types/nakama';
import { withAdminGuard } from './admin_auth';
import { logAudit } from './audit';
import { applyCurrencyDelta, type CurrencyDelta } from './currency';
import {
  getDecayConfig,
  calculateDecayAmount,
  getSeasonArchive,
  getDaysInactive,
  RatingDecayConfig,
} from './season_leaderboard';
import {
  getCurrentSeason,
  getLeaderboardEntry,
  getPlayerPrestigeRecord,
  getPlayerCosmetics,
  calculateSoftResetElo,
  getRankDecayInfo,
  calculateRewards,
  updatePlayerPrestigeRecord,
  grantPrestigeRewards,
  addPlayerCosmetic,
  SeasonInfo,
  LeaderboardRecord,
} from './season_system';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

// --- Types ---

interface TierBucket {
  count: number;
  rank_range: string;
}

interface ValidationResult {
  check_name: string;
  status: 'pass' | 'warning' | 'fail';
  issues_found: number;
  details: Array<{
    player_id: string;
    issue: string;
    auto_fixed: boolean;
  }>;
}

interface ValidationSummary {
  total_checks: number;
  passed: number;
  warnings: number;
  failures: number;
  auto_fixed: number;
}

// --- Helpers ---

function resolveSeason(seasonId?: string): SeasonInfo {
  if (seasonId) {
    const match = seasonId.match(/^season_(\d+)$/);
    if (!match) {
      throw new Error(`Invalid season_id format: ${seasonId}. Expected format: season_N`);
    }
    const num = parseInt(match[1], 10);
    const SEASON_DURATION_MS = 28 * 24 * 60 * 60 * 1000;
    const startTime = (num - 1) * SEASON_DURATION_MS;
    const endTime = startTime + SEASON_DURATION_MS;
    return {
      season_id: seasonId,
      season_number: num,
      start_time: startTime,
      end_time: endTime,
      status: 'active',
      duration_weeks: 4,
    };
  }
  return getCurrentSeason();
}

function getAllLeaderboardRecords(nk: Runtime.Nakama, seasonId: string): LeaderboardRecord[] {
  const BATCH_SIZE = 500;
  let allRecords: LeaderboardRecord[] = [];
  let cursor = '';
  do {
    const batch = nk.leaderboardRecordList(seasonId, [], BATCH_SIZE, cursor, 0);
    allRecords = allRecords.concat(batch);
    cursor = batch.length >= BATCH_SIZE ? String(batch[batch.length - 1]?.rank || '') : '';
  } while (cursor !== '');
  return allRecords;
}

function getTierForRank(rank: number): string {
  if (rank <= 10) return 'legendary';
  if (rank <= 50) return 'epic';
  if (rank <= 100) return 'rare';
  if (rank <= 500) return 'uncommon';
  return 'common';
}

function computeTierDistribution(records: LeaderboardRecord[]): Record<string, TierBucket> {
  const tiers: Record<string, TierBucket> = {
    legendary: { count: 0, rank_range: '1-10' },
    epic: { count: 0, rank_range: '11-50' },
    rare: { count: 0, rank_range: '51-100' },
    uncommon: { count: 0, rank_range: '101-500' },
    common: { count: 0, rank_range: '501+' },
  };
  for (const r of records) {
    const tier = getTierForRank(r.rank);
    tiers[tier].count++;
  }
  return tiers;
}

// --- Validation Checks ---

export function validateOrphanedRewards(
  nk: Runtime.Nakama,
  seasonId: string,
  leaderboardOwnerIds: Set<string>,
  _autoFix: boolean
): ValidationResult {
  const result: ValidationResult = {
    check_name: 'orphaned_rewards',
    status: 'pass',
    issues_found: 0,
    details: [],
  };

  try {
    const rewards = nk.storageList(
      '00000000-0000-0000-0000-000000000000',
      'season_rewards_claimed',
      100,
      '',
      ''
    );

    for (const obj of rewards) {
      if (!obj.key.startsWith(seasonId)) continue;
      const data = JSON.parse(obj.value);
      const playerId = data.user_id;
      if (!leaderboardOwnerIds.has(playerId)) {
        result.issues_found++;
        result.details.push({
          player_id: playerId,
          issue: 'Reward record exists but player not in leaderboard',
          auto_fixed: false,
        });
      }
    }

    if (result.issues_found > 0) {
      result.status = 'warning';
    }
  } catch {
    result.status = 'warning';
    result.details.push({
      player_id: '',
      issue: 'Could not read reward records',
      auto_fixed: false,
    });
  }

  return result;
}

export function validateMissingPrestige(
  nk: Runtime.Nakama,
  seasonId: string,
  topRecords: Array<{ ownerId: string; rank: number }>,
  autoFix: boolean
): ValidationResult {
  const result: ValidationResult = {
    check_name: 'missing_prestige',
    status: 'pass',
    issues_found: 0,
    details: [],
  };

  for (const rec of topRecords) {
    const prestige = getPlayerPrestigeRecord(nk, rec.ownerId);
    const hasFinish = prestige.season_finishes.some((f) => f.season_id === seasonId);
    if (!hasFinish) {
      result.issues_found++;
      const fixed = autoFix;
      if (autoFix) {
        updatePlayerPrestigeRecord(nk, rec.ownerId, seasonId, rec.rank);
      }
      result.details.push({
        player_id: rec.ownerId,
        issue: `Top-${rec.rank} player missing prestige finish for ${seasonId}`,
        auto_fixed: fixed,
      });
    }
  }

  if (result.issues_found > 0) {
    result.status = autoFix ? 'warning' : 'fail';
  }

  return result;
}

export function validateDecayConsistency(
  nk: Runtime.Nakama,
  records: LeaderboardRecord[],
  decayConfig: RatingDecayConfig
): ValidationResult {
  const result: ValidationResult = {
    check_name: 'decay_consistency',
    status: 'pass',
    issues_found: 0,
    details: [],
  };

  for (const record of records) {
    try {
      const meta = record.metadata ? JSON.parse(record.metadata) : {};
      if (meta.decayed !== 'true') continue;

      const lastActive = meta.last_active ? parseInt(meta.last_active, 10) : 0;
      if (!lastActive) continue;

      const daysInactive = getDaysInactive(lastActive);
      const expectedDecay = calculateDecayAmount(record.score, daysInactive, decayConfig);
      const storedDecay = parseInt(meta.decay_amount || '0', 10);

      if (Math.abs(expectedDecay - storedDecay) > 5) {
        result.issues_found++;
        result.details.push({
          player_id: record.ownerId,
          issue: `Decay mismatch: stored=${storedDecay}, expected=${expectedDecay}`,
          auto_fixed: false,
        });
      }
    } catch {
      // Skip records with unparseable metadata
    }
  }

  if (result.issues_found > 0) {
    result.status = 'warning';
  }

  return result;
}

export function validateLeaderboardIntegrity(records: LeaderboardRecord[]): ValidationResult {
  const result: ValidationResult = {
    check_name: 'leaderboard_integrity',
    status: 'pass',
    issues_found: 0,
    details: [],
  };

  const seenRanks = new Set<number>();
  let prevScore = Infinity;

  for (const record of records) {
    // Check for duplicate ranks
    if (seenRanks.has(record.rank)) {
      result.issues_found++;
      result.details.push({
        player_id: record.ownerId,
        issue: `Duplicate rank: ${record.rank}`,
        auto_fixed: false,
      });
    }
    seenRanks.add(record.rank);

    // Check scores are descending
    if (record.score > prevScore) {
      result.issues_found++;
      result.details.push({
        player_id: record.ownerId,
        issue: `Score ${record.score} > previous ${prevScore} at rank ${record.rank}`,
        auto_fixed: false,
      });
    }
    prevScore = record.score;

    // Check for unparseable metadata
    if (record.metadata) {
      try {
        JSON.parse(record.metadata);
      } catch {
        result.issues_found++;
        result.details.push({
          player_id: record.ownerId,
          issue: 'Unparseable metadata',
          auto_fixed: false,
        });
      }
    }
  }

  if (result.issues_found > 0) {
    result.status = result.issues_found >= 3 ? 'fail' : 'warning';
  }

  return result;
}

export function validateRewardDistribution(
  nk: Runtime.Nakama,
  seasonId: string,
  seasonNumber: number,
  records: LeaderboardRecord[],
  seasonStatus: string,
  autoFix: boolean
): ValidationResult {
  const result: ValidationResult = {
    check_name: 'reward_distribution',
    status: 'pass',
    issues_found: 0,
    details: [],
  };

  // Only relevant for ended seasons
  if (seasonStatus !== 'ended') {
    return result;
  }

  for (const record of records) {
    try {
      const storage = nk.storageRead([
        {
          collection: 'season_rewards_claimed',
          key: `${seasonId}_${record.ownerId}`,
          userId: record.ownerId,
        },
      ]);

      if (storage.length === 0 || !storage[0].value) {
        result.issues_found++;
        if (autoFix) {
          const rewards = calculateRewards(record.rank, seasonNumber);
          // Repair path writes to the unified currency ledger (issue #860)
          const rewardDelta: CurrencyDelta = {};
          if (rewards.coins) rewardDelta.coins = rewards.coins;
          if (rewards.gems) rewardDelta.gems = rewards.gems;
          applyCurrencyDelta(nk, record.ownerId, rewardDelta, 'season_admin_reward_fix');
          if (rewards.cosmetics) {
            addPlayerCosmetic(nk, record.ownerId, rewards.cosmetics.title, rewards.cosmetics.aura);
          }
          nk.storageWrite([
            {
              collection: 'season_rewards_claimed',
              key: `${seasonId}_${record.ownerId}`,
              userId: record.ownerId,
              value: JSON.stringify({
                season_id: seasonId,
                user_id: record.ownerId,
                claimed_at: Date.now(),
                rank: record.rank,
                rewards,
                auto_distributed: true,
              }),
            },
          ]);
        }
        result.details.push({
          player_id: record.ownerId,
          issue: `Missing reward record for rank ${record.rank}`,
          auto_fixed: autoFix,
        });
      }
    } catch {
      // Skip on read error
    }
  }

  if (result.issues_found > 0) {
    result.status = autoFix ? 'warning' : 'fail';
  }

  return result;
}

// --- Trigger Helpers ---

export function triggerEndSeason(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  seasonId: string,
  dryRun: boolean
): { players_processed: number; old_season_id: string; new_season_id: string } {
  const SEASON_DURATION_MS = 28 * 24 * 60 * 60 * 1000;
  const SEASON_DURATION_WEEKS = 4;
  const currentSeason = resolveSeason(seasonId);
  const allRecords = getAllLeaderboardRecords(nk, currentSeason.season_id);

  if (dryRun) {
    return {
      players_processed: allRecords.length,
      old_season_id: currentSeason.season_id,
      new_season_id: `season_${currentSeason.season_number + 1}`,
    };
  }

  // Distribute rewards and update prestige (same flow as rpcEndSeason)
  for (const record of allRecords) {
    const rewards = calculateRewards(record.rank, currentSeason.season_number);
    // Currency rewards go through the unified currency ledger (issue #860)
    const rewardDelta: CurrencyDelta = {};
    if (rewards.coins) rewardDelta.coins = rewards.coins;
    if (rewards.gems) rewardDelta.gems = rewards.gems;
    applyCurrencyDelta(nk, record.ownerId, rewardDelta, 'season_admin_end_season', logger);
    if (rewards.cosmetics) {
      addPlayerCosmetic(nk, record.ownerId, rewards.cosmetics.title, rewards.cosmetics.aura);
    }
    nk.storageWrite([
      {
        collection: 'season_rewards_claimed',
        key: `${currentSeason.season_id}_${record.ownerId}`,
        userId: record.ownerId,
        value: JSON.stringify({
          season_id: currentSeason.season_id,
          user_id: record.ownerId,
          claimed_at: Date.now(),
          rank: record.rank,
          rewards,
          auto_distributed: true,
        }),
      },
    ]);
    const { new_tiers } = updatePlayerPrestigeRecord(
      nk,
      record.ownerId,
      currentSeason.season_id,
      record.rank
    );
    if (new_tiers.length > 0) {
      grantPrestigeRewards(nk, record.ownerId, new_tiers);
    }
  }

  // Create next season
  const nextNum = currentSeason.season_number + 1;
  const nextSeason: SeasonInfo = {
    season_id: `season_${nextNum}`,
    season_number: nextNum,
    start_time: Date.now(),
    end_time: Date.now() + SEASON_DURATION_MS,
    status: 'active',
    duration_weeks: SEASON_DURATION_WEEKS,
  };

  nk.storageWrite([
    {
      collection: 'seasons',
      key: nextSeason.season_id,
      userId: ctx.userId,
      value: JSON.stringify(nextSeason),
    },
  ]);

  // Mark old season ended
  const oldSeason = { ...currentSeason, status: 'ended' };
  nk.storageWrite([
    {
      collection: 'seasons',
      key: oldSeason.season_id,
      userId: ctx.userId,
      value: JSON.stringify(oldSeason),
    },
  ]);

  // Create new leaderboard and seed players
  nk.leaderboardCreate(nextSeason.season_id, true, 'desc', 'best', '', {
    season_number: String(nextNum),
  });
  for (const record of allRecords) {
    const softResetElo = calculateSoftResetElo(record.rank);
    const metadata = record.metadata ? JSON.parse(record.metadata) : {};
    nk.leaderboardRecordWrite(
      nextSeason.season_id,
      record.ownerId,
      record.username,
      softResetElo,
      0,
      {
        wins: '0',
        losses: '0',
        win_rate: '0',
        punch_up_wins: '0',
        previous_season_rank: String(record.rank),
        soft_reset_elo: String(softResetElo),
        ...{ mode: metadata.mode || '1v1' },
      }
    );
  }

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'admin_end_season',
    'season',
    {
      old_season_id: currentSeason.season_id,
      new_season_id: nextSeason.season_id,
      players_processed: allRecords.length,
    },
    'success'
  );

  return {
    players_processed: allRecords.length,
    old_season_id: currentSeason.season_id,
    new_season_id: nextSeason.season_id,
  };
}

export function triggerRecalculateDecay(
  nk: Runtime.Nakama,
  seasonId: string,
  dryRun: boolean
): { affected: number; total_loss: number } {
  const decayConfig = getDecayConfig(nk);
  const records = getAllLeaderboardRecords(nk, seasonId);
  let affected = 0;
  let totalLoss = 0;

  for (const record of records) {
    try {
      const meta = record.metadata ? JSON.parse(record.metadata) : {};
      const lastActive = meta.last_active ? parseInt(meta.last_active, 10) : 0;
      if (!lastActive) continue;

      const daysInactive = getDaysInactive(lastActive);
      const decayAmount = calculateDecayAmount(record.score, daysInactive, decayConfig);
      if (decayAmount > 0) {
        affected++;
        totalLoss += decayAmount;

        if (!dryRun) {
          const newScore = Math.max(record.score - decayAmount, decayConfig.minimum_rating);
          const updatedMeta = { ...meta, decayed: 'true', decay_amount: String(decayAmount) };
          nk.leaderboardRecordWrite(
            seasonId,
            record.ownerId,
            record.username,
            newScore,
            0,
            updatedMeta
          );
        }
      }
    } catch {
      // Skip on error
    }
  }

  return { affected, total_loss: totalLoss };
}

export function triggerFixMissingRewards(
  nk: Runtime.Nakama,
  seasonId: string,
  seasonNumber: number,
  dryRun: boolean
): { fixed_count: number; players_fixed: string[] } {
  const records = getAllLeaderboardRecords(nk, seasonId);
  const fixed: string[] = [];

  for (const record of records) {
    try {
      const storage = nk.storageRead([
        {
          collection: 'season_rewards_claimed',
          key: `${seasonId}_${record.ownerId}`,
          userId: record.ownerId,
        },
      ]);

      if (storage.length === 0 || !storage[0].value) {
        fixed.push(record.ownerId);
        if (!dryRun) {
          const rewards = calculateRewards(record.rank, seasonNumber);
          // Missing-reward repair credits the unified ledger (issue #860)
          const rewardDelta: CurrencyDelta = {};
          if (rewards.coins) rewardDelta.coins = rewards.coins;
          if (rewards.gems) rewardDelta.gems = rewards.gems;
          applyCurrencyDelta(nk, record.ownerId, rewardDelta, 'season_admin_fix_missing_rewards');
          if (rewards.cosmetics) {
            addPlayerCosmetic(nk, record.ownerId, rewards.cosmetics.title, rewards.cosmetics.aura);
          }
          nk.storageWrite([
            {
              collection: 'season_rewards_claimed',
              key: `${seasonId}_${record.ownerId}`,
              userId: record.ownerId,
              value: JSON.stringify({
                season_id: seasonId,
                user_id: record.ownerId,
                claimed_at: Date.now(),
                rank: record.rank,
                rewards,
                auto_distributed: true,
              }),
            },
          ]);
        }
      }
    } catch {
      // Skip on error
    }
  }

  return { fixed_count: fixed.length, players_fixed: fixed };
}

export function triggerRebuildPrestige(
  nk: Runtime.Nakama,
  seasonId: string,
  playerIds: string[] | null,
  dryRun: boolean
): { rebuilt_count: number; players_rebuilt: string[] } {
  let targetIds = playerIds;
  if (!targetIds) {
    const records = getAllLeaderboardRecords(nk, seasonId);
    targetIds = records.map((r) => r.ownerId);
  }

  const rebuilt: string[] = [];

  for (const playerId of targetIds) {
    const entry = getLeaderboardEntry(nk, playerId, seasonId);
    if (!entry) continue;

    const prestige = getPlayerPrestigeRecord(nk, playerId);
    const hasFinish = prestige.season_finishes.some((f) => f.season_id === seasonId);

    if (!hasFinish && entry.rank <= 100) {
      rebuilt.push(playerId);
      if (!dryRun) {
        updatePlayerPrestigeRecord(nk, playerId, seasonId, entry.rank);
      }
    }
  }

  return { rebuilt_count: rebuilt.length, players_rebuilt: rebuilt };
}

// --- RPC Handlers ---

export function rpcAdminGetSeasonState(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Admin get season state called by: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.admin_get_season_state,
    payload,
    'admin_get_season_state'
  );
  if (!validation.success) {
    return createValidationErrorResponse('admin_get_season_state', validation.error);
  }

  const request = validation.data || {};
  const season = resolveSeason(request.season_id as string | undefined);
  const now = Date.now();
  const elapsedMs = now - season.start_time;
  const remainingMs = Math.max(0, season.end_time - now);

  const records = getAllLeaderboardRecords(nk, season.season_id);
  const tierDistribution = computeTierDistribution(records);

  let avgScore = 0;
  let minScore = 0;
  let maxScore = 0;
  let playersWithDecay = 0;

  if (records.length > 0) {
    const scores = records.map((r) => r.score);
    avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    minScore = Math.min(...scores);
    maxScore = Math.max(...scores);

    for (const r of records) {
      try {
        const meta = r.metadata ? JSON.parse(r.metadata) : {};
        if (meta.decayed === 'true') playersWithDecay++;
      } catch {
        // skip
      }
    }
  }

  const decayConfig = getDecayConfig(nk);

  let archiveStatus: { archived: boolean; rewards_distributed: boolean } | null = null;
  try {
    const archive = getSeasonArchive(nk);
    const entry = archive[season.season_id];
    if (entry) {
      archiveStatus = {
        archived: true,
        rewards_distributed: entry.rewards_distributed,
      };
    }
  } catch {
    // Archive may not exist
  }

  return JSON.stringify({
    success: true,
    season: {
      id: season.season_id,
      number: season.season_number,
      start: season.start_time,
      end: season.end_time,
      status: season.status,
      duration_weeks: season.duration_weeks,
    },
    timing: {
      now,
      elapsed_ms: elapsedMs,
      remaining_ms: remainingMs,
      elapsed_percent:
        season.end_time > season.start_time
          ? Math.round((elapsedMs / (season.end_time - season.start_time)) * 10000) / 100
          : 100,
    },
    leaderboard_health: {
      total_players: records.length,
      avg_score: avgScore,
      min_score: minScore,
      max_score: maxScore,
      players_with_decay: playersWithDecay,
    },
    tier_distribution: tierDistribution,
    decay_config: decayConfig,
    archive_status: archiveStatus,
  });
}

function readPlayerRewards(
  nk: Runtime.Nakama,
  seasonId: string,
  userId: string
): {
  claimed: boolean;
  claimed_at: number | null;
  auto_distributed: boolean | null;
  rank_tier: string | null;
} {
  try {
    const storage = nk.storageRead([
      {
        collection: 'season_rewards_claimed',
        key: `${seasonId}_${userId}`,
        userId,
      },
    ]);
    if (storage.length > 0 && storage[0].value) {
      const data = JSON.parse(storage[0].value);
      return {
        claimed: true,
        claimed_at: data.claimed_at || null,
        auto_distributed: data.auto_distributed ?? null,
        rank_tier: data.rewards?.rank_tier || null,
      };
    }
  } catch {
    // No rewards data
  }
  return { claimed: false, claimed_at: null, auto_distributed: null, rank_tier: null };
}

function readPlayerActivity(
  nk: Runtime.Nakama,
  userId: string
): { last_match_time: number; days_inactive: number } {
  try {
    const storage = nk.storageRead([{ collection: 'player_activity', key: userId, userId }]);
    if (storage.length > 0 && storage[0].value) {
      const data = JSON.parse(storage[0].value);
      const lastMatchTime = data.last_match_time || 0;
      const daysInactive = lastMatchTime
        ? Math.floor((Date.now() - lastMatchTime) / (24 * 60 * 60 * 1000))
        : 0;
      return { last_match_time: lastMatchTime, days_inactive: daysInactive };
    }
  } catch {
    // No activity data
  }
  return { last_match_time: 0, days_inactive: 0 };
}

function executeRecalculateDecay(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  seasonId: string,
  dryRun: boolean
): { result: Record<string, unknown>; auditLogged: boolean } {
  const res = triggerRecalculateDecay(nk, seasonId, dryRun);
  if (!dryRun) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'admin_recalculate_decay',
      'season',
      { season_id: seasonId, affected: res.affected },
      'success'
    );
  }
  return { result: res, auditLogged: !dryRun };
}

function executeFixMissingRewards(
  nk: Runtime.Nakama,
  seasonId: string,
  seasonNumber: number,
  dryRun: boolean
): { result: Record<string, unknown>; auditLogged: boolean } {
  const res = triggerFixMissingRewards(nk, seasonId, seasonNumber, dryRun);
  if (!dryRun) {
    logAudit(
      nk,
      'admin-user',
      null,
      'admin_fix_missing_rewards',
      'season',
      { season_id: seasonId, fixed_count: res.fixed_count },
      'success'
    );
  }
  return { result: res, auditLogged: !dryRun };
}

function executeRebuildPrestige(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  seasonId: string,
  playerIds: string[] | null,
  dryRun: boolean
): { result: Record<string, unknown>; auditLogged: boolean } {
  const res = triggerRebuildPrestige(nk, seasonId, playerIds, dryRun);
  if (!dryRun) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'admin_rebuild_prestige',
      'season',
      { season_id: seasonId, rebuilt_count: res.rebuilt_count },
      'success'
    );
  }
  return { result: res, auditLogged: !dryRun };
}

function executeRecalculateRatings(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  seasonId: string,
  dryRun: boolean
): { result: Record<string, unknown>; auditLogged: boolean } {
  const records = getAllLeaderboardRecords(nk, seasonId);
  const decayConfig = getDecayConfig(nk);
  let corrected = 0;
  for (const record of records) {
    if (record.score < decayConfig.minimum_rating) {
      corrected++;
      if (!dryRun) {
        const meta = record.metadata ? JSON.parse(record.metadata) : {};
        nk.leaderboardRecordWrite(
          seasonId,
          record.ownerId,
          record.username,
          decayConfig.minimum_rating,
          0,
          meta
        );
      }
    }
  }
  if (!dryRun && corrected > 0) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'admin_recalculate_ratings',
      'season',
      { season_id: seasonId, corrected },
      'success'
    );
  }
  return {
    result: { players_checked: records.length, players_corrected: corrected },
    auditLogged: !dryRun && corrected > 0,
  };
}

function executeTriggerAction(
  action: string,
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  seasonId: string,
  dryRun: boolean,
  playerIds: string[] | undefined
): { result: Record<string, unknown>; auditLogged: boolean } {
  switch (action) {
    case 'recalculate_decay':
      return executeRecalculateDecay(nk, ctx, seasonId, dryRun);
    case 'fix_missing_rewards':
      return executeFixMissingRewards(nk, seasonId, resolveSeason(seasonId).season_number, dryRun);
    case 'rebuild_prestige':
      return executeRebuildPrestige(nk, ctx, seasonId, playerIds ?? null, dryRun);
    case 'recalculate_ratings':
      return executeRecalculateRatings(nk, ctx, seasonId, dryRun);
    default:
      return { result: { error: `Unknown action: ${action}` }, auditLogged: false };
  }
}

function buildLeaderboardData(entry: { rank: number; score: number; meta: any } | null) {
  if (!entry) {
    return { rank: null, score: null, wins: 0, losses: 0, win_rate: 0, punch_up_wins: 0 };
  }
  const meta = entry.meta || {};
  return {
    rank: entry.rank ?? null,
    score: entry.score ?? null,
    wins: meta.wins ?? 0,
    losses: meta.losses ?? 0,
    win_rate: meta.win_rate ?? 0,
    punch_up_wins: meta.punch_up_wins ?? 0,
  };
}

function buildPrestigeData(prestige: { prestige_tiers_earned: string[]; season_finishes: any[] }) {
  return {
    tiers_earned: prestige.prestige_tiers_earned,
    season_finishes: prestige.season_finishes,
  };
}

function buildPlayerSeasonResponse(
  userId: string,
  seasonId: string,
  entry: { rank: number; score: number; meta: any } | null,
  prestige: { prestige_tiers_earned: string[]; season_finishes: any[] },
  cosmetics: { titles: string[]; auras: string[] },
  rewards: {
    claimed: boolean;
    claimed_at: number | null;
    auto_distributed: boolean | null;
    rank_tier: string | null;
  },
  activity: { last_match_time: number; days_inactive: number },
  decay: { days_inactive: number; points_at_risk: number; can_decay: boolean },
  projectedElo: number | null
): string {
  const leaderboard = buildLeaderboardData(entry);
  const prestigeData = buildPrestigeData(prestige);
  const projectedSeason = { soft_reset_elo: projectedElo };

  return JSON.stringify({
    success: true,
    user_id: userId,
    season_id: seasonId,
    leaderboard,
    prestige: prestigeData,
    cosmetics,
    rewards,
    activity,
    decay,
    projected_next_season: projectedSeason,
  });
}

export function rpcAdminGetPlayerSeason(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Admin get player season called by: %s for payload: %s', ctx.userId, payload);

  const validation = validatePayload(
    ZodSchemas.admin_get_player_season,
    payload,
    'admin_get_player_season'
  );
  if (!validation.success) {
    return createValidationErrorResponse('admin_get_player_season', validation.error);
  }

  const request = validation.data;
  const userId = request.user_id as string;
  const season = resolveSeason(request.season_id as string | undefined);
  const entry = getLeaderboardEntry(nk, userId, season.season_id);
  const prestige = getPlayerPrestigeRecord(nk, userId);
  const cosmetics = getPlayerCosmetics(nk, userId);
  const rewards = readPlayerRewards(nk, season.season_id, userId);
  const activity = readPlayerActivity(nk, userId);
  const decay = getRankDecayInfo(nk, userId, entry?.score ?? 0);
  const projectedElo = entry ? calculateSoftResetElo(entry.rank) : null;

  return buildPlayerSeasonResponse(
    userId,
    season.season_id,
    entry,
    prestige,
    cosmetics,
    rewards,
    activity,
    decay,
    projectedElo
  );
}

export function rpcAdminValidateSeason(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Admin validate season called by: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.admin_validate_season,
    payload,
    'admin_validate_season'
  );
  if (!validation.success) {
    return createValidationErrorResponse('admin_validate_season', validation.error);
  }

  const request = validation.data || {};
  const season = resolveSeason(request.season_id as string | undefined);
  const autoFix = (request.auto_fix as boolean) || false;
  const requestedChecks = request.checks as string[] | undefined;

  const allChecks = [
    'orphaned_rewards',
    'missing_prestige',
    'decay_consistency',
    'leaderboard_integrity',
    'reward_distribution',
  ];
  const checksToRun = requestedChecks
    ? allChecks.filter((c) => requestedChecks.includes(c))
    : allChecks;

  const records = getAllLeaderboardRecords(nk, season.season_id);
  const leaderboardOwnerIds = new Set(records.map((r) => r.ownerId));
  const topRecords = records.filter((r) => r.rank <= 100);
  const decayConfig = getDecayConfig(nk);

  const results: ValidationResult[] = [];

  for (const check of checksToRun) {
    switch (check) {
      case 'orphaned_rewards':
        results.push(validateOrphanedRewards(nk, season.season_id, leaderboardOwnerIds, autoFix));
        break;
      case 'missing_prestige':
        results.push(validateMissingPrestige(nk, season.season_id, topRecords, autoFix));
        break;
      case 'decay_consistency':
        results.push(validateDecayConsistency(nk, records, decayConfig));
        break;
      case 'leaderboard_integrity':
        results.push(validateLeaderboardIntegrity(records));
        break;
      case 'reward_distribution':
        results.push(
          validateRewardDistribution(
            nk,
            season.season_id,
            season.season_number,
            records,
            season.status,
            autoFix
          )
        );
        break;
    }
  }

  const summary: ValidationSummary = {
    total_checks: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    warnings: results.filter((r) => r.status === 'warning').length,
    failures: results.filter((r) => r.status === 'fail').length,
    auto_fixed: results.reduce((sum, r) => sum + r.details.filter((d) => d.auto_fixed).length, 0),
  };

  return JSON.stringify({
    success: true,
    season_id: season.season_id,
    auto_fix_enabled: autoFix,
    checks: results,
    summary,
  });
}

export function rpcAdminTriggerSeasonEvent(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Admin trigger season event called by: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.admin_trigger_season_event,
    payload,
    'admin_trigger_season_event'
  );
  if (!validation.success) {
    return createValidationErrorResponse('admin_trigger_season_event', validation.error);
  }

  const request = validation.data;
  const action = request.action as string;
  const seasonId = request.season_id as string | undefined;
  const dryRun = request.dry_run !== false;
  const playerIds = request.player_ids as string[] | undefined;
  const confirmationToken = request.confirmation_token as string | undefined;

  const season = resolveSeason(seasonId);

  // Special handling for end_season due to confirmation token requirement
  if (action === 'end_season') {
    if (!confirmationToken || confirmationToken !== season.season_id) {
      return JSON.stringify({
        success: false,
        error: 'confirmation_token must match the season_id being ended',
        season_id: season.season_id,
      });
    }
    const result = triggerEndSeason(nk, ctx, logger, season.season_id, dryRun);
    return JSON.stringify({
      success: true,
      action,
      season_id: season.season_id,
      dry_run: dryRun,
      result,
      audit_logged: !dryRun,
    });
  }

  const { result, auditLogged } = executeTriggerAction(
    action,
    nk,
    ctx,
    season.season_id,
    dryRun,
    playerIds
  );

  if ((result as { error?: string }).error) {
    return JSON.stringify({
      success: false,
      error: (result as { error: string }).error,
    });
  }

  return JSON.stringify({
    success: true,
    action,
    season_id: season.season_id,
    dry_run: dryRun,
    result,
    audit_logged: auditLogged,
  });
}

// --- Registration ---

// All season admin RPCs are wrapped in the shared admin gate (issue #1075):
// fail-closed unless the caller is allowlisted via ADMIN_USER_IDS. This
// includes admin_trigger_season_event's end_season action — its
// confirmation_token only has to equal the guessable season_id, so the
// token alone must not be treated as authorization.
export function registerRpcAdminGetSeasonState(initializer: Runtime.Initializer): void {
  initializer.registerRpc(
    'armored_archer/admin_get_season_state',
    withAdminGuard('armored_archer/admin_get_season_state', rpcAdminGetSeasonState)
  );
}

export function registerRpcAdminGetPlayerSeason(initializer: Runtime.Initializer): void {
  initializer.registerRpc(
    'armored_archer/admin_get_player_season',
    withAdminGuard('armored_archer/admin_get_player_season', rpcAdminGetPlayerSeason)
  );
}

export function registerRpcAdminValidateSeason(initializer: Runtime.Initializer): void {
  initializer.registerRpc(
    'armored_archer/admin_validate_season',
    withAdminGuard('armored_archer/admin_validate_season', rpcAdminValidateSeason)
  );
}

export function registerRpcAdminTriggerSeasonEvent(initializer: Runtime.Initializer): void {
  initializer.registerRpc(
    'armored_archer/admin_trigger_season_event',
    withAdminGuard('armored_archer/admin_trigger_season_event', rpcAdminTriggerSeasonEvent)
  );
}
