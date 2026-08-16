/**
 * Season Telemetry Module.
 * @fileoverview Tracks rank inflation, reward concentration, and season progression velocity
 * to give the team visibility into season economy health.
 *
 * Storage collections:
 * - season_telemetry_rank_changes: Individual rank change events per match
 * - season_telemetry_reward_claims: Reward claim events per season
 * - season_telemetry_rating_snapshots: Periodic snapshots of ELO distribution
 * - season_telemetry_season_summaries: Per-season aggregated summaries
 */

import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { logAudit } from './audit';
import {
  registerRpcWithMetrics,
  setSeasonAvgElo,
  incrementSeasonRewardClaims,
  recordSeasonCurrencyInjected,
  setSeasonActivePlayers,
} from './metrics';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

// --- Storage Collections ---
const COLLECTION_RANK_CHANGES = 'season_telemetry_rank_changes';
const COLLECTION_REWARD_CLAIMS = 'season_telemetry_reward_claims';
const COLLECTION_RATING_SNAPSHOTS = 'season_telemetry_rating_snapshots';
const COLLECTION_SEASON_SUMMARIES = 'season_telemetry_season_summaries';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// --- Interfaces ---

export interface RankChangeEvent {
  event_id: string;
  match_id: string;
  season_id: string;
  timestamp: number;
  winner_id: string;
  loser_id: string;
  winner_old_elo: number;
  winner_new_elo: number;
  winner_rank_delta: number;
  loser_old_elo: number;
  loser_new_elo: number;
  loser_rank_delta: number;
  is_punch_up: boolean;
  k_factor: number;
  /** K-factor used for the winner's Elo gain (issue #864 per-side K). */
  winner_k_factor?: number;
  /** Whether the loser's deduction was amplified (2x K punch-up underdog loss). */
  loser_k_factor_amplified?: boolean;
  days_into_season: number;
}

export interface RewardClaimEvent {
  event_id: string;
  season_id: string;
  user_id: string;
  timestamp: number;
  rank: number;
  rank_tier: 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';
  coins_awarded: number;
  gems_awarded: number;
  had_cosmetics: boolean;
}

export interface RatingSnapshot {
  snapshot_id: string;
  season_id: string;
  timestamp: number;
  total_players: number;
  avg_elo: number;
  median_elo: number;
  elo_std_dev: number;
  percentile_buckets: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p99: number;
  };
  base_elo_drift: number;
}

export interface SeasonProgressionSnapshot {
  season_id: string;
  season_number: number;
  updated_at: number;
  total_matches: number;
  avg_rank_change_per_match: number;
  punch_up_rate: number;
  punch_up_win_rate: number;
  rank_velocity_by_week: {
    week_1: { avg_elo_change: number; matches: number };
    week_2: { avg_elo_change: number; matches: number };
    week_3: { avg_elo_change: number; matches: number };
    week_4: { avg_elo_change: number; matches: number };
  };
}

export interface SeasonTelemetrySummary {
  rank_inflation: {
    current_avg_elo: number;
    base_elo_drift: number;
    drift_direction: 'inflating' | 'deflating' | 'stable';
    snapshots_analyzed: number;
    historical_avg_trend: number[];
  };
  reward_concentration: {
    total_claims: number;
    total_coins_injected: number;
    total_gems_injected: number;
    claims_by_tier: Record<string, number>;
    gini_coefficient: number;
    top_10_percent_share: number;
  };
  progression_velocity: {
    total_matches_tracked: number;
    avg_rank_change_per_match: number;
    punch_up_rate: number;
    rank_velocity_by_week: SeasonProgressionSnapshot['rank_velocity_by_week'];
  };
  period_start: number;
  period_end: number;
  season_id: string;
}

export interface SeasonTelemetryQuery {
  season_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

// --- Helper Functions ---

function generateEventId(prefix: string = 'stelm'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// --- Core Logging Functions ---

export async function logRankChange(nk: Runtime.Nakama, event: RankChangeEvent): Promise<void> {
  try {
    if (!event.event_id) {
      event.event_id = generateEventId('rc');
    }

    await nk.storageWrite([
      {
        collection: COLLECTION_RANK_CHANGES,
        key: event.event_id,
        userId: SYSTEM_USER_ID,
        value: JSON.stringify(event),
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    logger.debug(
      'Rank change logged: match=%s winner_delta=%d loser_delta=%d',
      event.match_id,
      event.winner_rank_delta,
      event.loser_rank_delta
    );
  } catch (error) {
    logger.error('Failed to log rank change', { error, matchId: event.match_id });
  }
}

export async function logRewardClaim(nk: Runtime.Nakama, event: RewardClaimEvent): Promise<void> {
  try {
    if (!event.event_id) {
      event.event_id = generateEventId('rw');
    }

    await nk.storageWrite([
      {
        collection: COLLECTION_REWARD_CLAIMS,
        key: event.event_id,
        userId: SYSTEM_USER_ID,
        value: JSON.stringify(event),
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    // Audit trail
    await logAudit(
      nk,
      SYSTEM_USER_ID,
      null,
      'reward_claim_logged',
      'season_telemetry',
      {
        event_id: event.event_id,
        season_id: event.season_id,
        user_id: event.user_id,
        tier: event.rank_tier,
      },
      'success'
    );

    // Prometheus metrics
    incrementSeasonRewardClaims(event.season_id, event.rank_tier);
    if (event.coins_awarded > 0) {
      recordSeasonCurrencyInjected(event.season_id, 'coins', event.coins_awarded);
    }
    if (event.gems_awarded > 0) {
      recordSeasonCurrencyInjected(event.season_id, 'gems', event.gems_awarded);
    }

    logger.debug(
      'Reward claim logged: season=%s user=%s tier=%s',
      event.season_id,
      event.user_id,
      event.rank_tier
    );
  } catch (error) {
    logger.error('Failed to log reward claim', { error, seasonId: event.season_id });
  }
}

export async function captureRatingSnapshot(
  nk: Runtime.Nakama,
  seasonId: string,
  _seasonStartTime: number
): Promise<RatingSnapshot | null> {
  try {
    const records = nk.leaderboardRecordList(seasonId, [], 10000, '', 0);
    if (records.length === 0) {
      logger.info('No leaderboard entries for snapshot: season=%s', seasonId);
      return null;
    }

    const scores: number[] = records
      .map((r: { score: number }) => r.score)
      .sort((a: number, b: number) => a - b);

    const totalPlayers = scores.length;
    const avgElo = scores.reduce((sum: number, s: number) => sum + s, 0) / totalPlayers;
    const medianElo = scores[Math.floor(totalPlayers / 2)];

    const variance =
      scores.reduce((sum: number, s: number) => sum + Math.pow(s - avgElo, 2), 0) / totalPlayers;
    const stdDev = Math.sqrt(variance);

    const percentile = (p: number): number => {
      const idx = Math.ceil((p / 100) * totalPlayers) - 1;
      return scores[Math.max(0, idx)];
    };

    const snapshot: RatingSnapshot = {
      snapshot_id: generateEventId('snap'),
      season_id: seasonId,
      timestamp: Date.now(),
      total_players: totalPlayers,
      avg_elo: Math.round(avgElo),
      median_elo: medianElo,
      elo_std_dev: Math.round(stdDev),
      percentile_buckets: {
        p10: percentile(10),
        p25: percentile(25),
        p50: percentile(50),
        p75: percentile(75),
        p90: percentile(90),
        p99: percentile(99),
      },
      base_elo_drift: Math.round(avgElo - 1000),
    };

    await nk.storageWrite([
      {
        collection: COLLECTION_RATING_SNAPSHOTS,
        key: snapshot.snapshot_id,
        userId: SYSTEM_USER_ID,
        value: JSON.stringify(snapshot),
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    // Update Prometheus gauges
    setSeasonAvgElo(seasonId, Math.round(avgElo));
    setSeasonActivePlayers(seasonId, totalPlayers);

    logger.info(
      'Rating snapshot captured: season=%s avg_elo=%d drift=%d players=%d',
      seasonId,
      Math.round(avgElo),
      snapshot.base_elo_drift,
      totalPlayers
    );

    return snapshot;
  } catch (error) {
    logger.error('Failed to capture rating snapshot', { error, seasonId });
    return null;
  }
}

// --- Query Functions ---

async function readStorageCollection<T extends { timestamp: number }>(
  nk: Runtime.Nakama,
  collection: string,
  startTime: number,
  endTime: number
): Promise<T[]> {
  try {
    const objects = await nk.storageRead([{ collection, key: '*', userId: SYSTEM_USER_ID }]);
    return objects
      .map((obj: { value: string }) => JSON.parse(obj.value) as T)
      .filter((item: T) => item.timestamp >= startTime && item.timestamp <= endTime);
  } catch {
    return [];
  }
}

export async function getRankInflation(
  nk: Runtime.Nakama,
  seasonId: string,
  startTime: number,
  endTime: number
): Promise<SeasonTelemetrySummary['rank_inflation']> {
  const snapshots = await readStorageCollection<RatingSnapshot>(
    nk,
    COLLECTION_RATING_SNAPSHOTS,
    startTime,
    endTime
  );

  const seasonSnapshots = snapshots.filter((s) => s.season_id === seasonId);
  const historicalAvg = seasonSnapshots.map((s) => s.avg_elo);

  const currentAvg = historicalAvg.length > 0 ? historicalAvg[historicalAvg.length - 1] : 1000;
  const drift = currentAvg - 1000;

  let driftDirection: 'inflating' | 'deflating' | 'stable' = 'stable';
  if (drift > 10) driftDirection = 'inflating';
  else if (drift < -10) driftDirection = 'deflating';

  return {
    current_avg_elo: currentAvg,
    base_elo_drift: drift,
    drift_direction: driftDirection,
    snapshots_analyzed: seasonSnapshots.length,
    historical_avg_trend: historicalAvg,
  };
}

export async function getRewardConcentration(
  nk: Runtime.Nakama,
  seasonId: string,
  startTime: number,
  endTime: number
): Promise<SeasonTelemetrySummary['reward_concentration']> {
  const claims = await readStorageCollection<RewardClaimEvent>(
    nk,
    COLLECTION_REWARD_CLAIMS,
    startTime,
    endTime
  );

  const seasonClaims = claims.filter((c) => c.season_id === seasonId);

  const claimsByTier: Record<string, number> = {};
  let totalCoins = 0;
  let totalGems = 0;

  for (const claim of seasonClaims) {
    claimsByTier[claim.rank_tier] = (claimsByTier[claim.rank_tier] || 0) + 1;
    totalCoins += claim.coins_awarded;
    totalGems += claim.gems_awarded;
  }

  const gini = calculateGiniCoefficient(seasonClaims);
  const top10Share = calculateTopPercentShare(seasonClaims, 0.1);

  return {
    total_claims: seasonClaims.length,
    total_coins_injected: totalCoins,
    total_gems_injected: totalGems,
    claims_by_tier: claimsByTier,
    gini_coefficient: gini,
    top_10_percent_share: top10Share,
  };
}

export async function getProgressionVelocity(
  nk: Runtime.Nakama,
  seasonId: string,
  seasonStartTime: number,
  startTime: number,
  endTime: number
): Promise<SeasonTelemetrySummary['progression_velocity']> {
  const rankChanges = await readStorageCollection<RankChangeEvent>(
    nk,
    COLLECTION_RANK_CHANGES,
    startTime,
    endTime
  );

  const seasonChanges = rankChanges.filter((rc) => rc.season_id === seasonId);

  let totalDelta = 0;
  let punchUpCount = 0;
  const weekData = [
    { totalDelta: 0, matches: 0 },
    { totalDelta: 0, matches: 0 },
    { totalDelta: 0, matches: 0 },
    { totalDelta: 0, matches: 0 },
  ];

  for (const rc of seasonChanges) {
    totalDelta += Math.abs(rc.winner_rank_delta) + Math.abs(rc.loser_rank_delta);
    if (rc.is_punch_up) punchUpCount++;

    const weekIndex = Math.min(Math.floor(rc.days_into_season / 7), 3);
    weekData[weekIndex].totalDelta +=
      Math.abs(rc.winner_rank_delta) + Math.abs(rc.loser_rank_delta);
    weekData[weekIndex].matches++;
  }

  const totalMatches = seasonChanges.length;
  const avgChangePerMatch = totalMatches > 0 ? totalDelta / (totalMatches * 2) : 0;

  return {
    total_matches_tracked: totalMatches,
    avg_rank_change_per_match: Math.round(avgChangePerMatch * 100) / 100,
    punch_up_rate: totalMatches > 0 ? punchUpCount / totalMatches : 0,
    rank_velocity_by_week: {
      week_1: {
        avg_elo_change:
          weekData[0].matches > 0
            ? Math.round((weekData[0].totalDelta / (weekData[0].matches * 2)) * 100) / 100
            : 0,
        matches: weekData[0].matches,
      },
      week_2: {
        avg_elo_change:
          weekData[1].matches > 0
            ? Math.round((weekData[1].totalDelta / (weekData[1].matches * 2)) * 100) / 100
            : 0,
        matches: weekData[1].matches,
      },
      week_3: {
        avg_elo_change:
          weekData[2].matches > 0
            ? Math.round((weekData[2].totalDelta / (weekData[2].matches * 2)) * 100) / 100
            : 0,
        matches: weekData[2].matches,
      },
      week_4: {
        avg_elo_change:
          weekData[3].matches > 0
            ? Math.round((weekData[3].totalDelta / (weekData[3].matches * 2)) * 100) / 100
            : 0,
        matches: weekData[3].matches,
      },
    },
  };
}

export async function getSeasonTelemetrySummary(
  nk: Runtime.Nakama,
  query: SeasonTelemetryQuery
): Promise<SeasonTelemetrySummary> {
  const startTime = query.start_date
    ? new Date(query.start_date).getTime()
    : Date.now() - 28 * 24 * 60 * 60 * 1000;
  const endTime = query.end_date ? new Date(query.end_date).getTime() : Date.now();
  const seasonId = query.season_id || 'current';

  // Derive season start time from season ID if it follows the pattern season_N
  const seasonStartTime = startTime;

  const [rankInflation, rewardConcentration, progressionVelocity] = await Promise.all([
    getRankInflation(nk, seasonId, startTime, endTime),
    getRewardConcentration(nk, seasonId, startTime, endTime),
    getProgressionVelocity(nk, seasonId, seasonStartTime, startTime, endTime),
  ]);

  return {
    rank_inflation: rankInflation,
    reward_concentration: rewardConcentration,
    progression_velocity: progressionVelocity,
    period_start: startTime,
    period_end: endTime,
    season_id: seasonId,
  };
}

export async function recordSeasonEndSnapshot(
  nk: Runtime.Nakama,
  seasonId: string,
  seasonStartTime: number
): Promise<void> {
  try {
    // Capture a final rating snapshot
    await captureRatingSnapshot(nk, seasonId, seasonStartTime);

    // Read all rank changes for the season
    const seasonStart = seasonStartTime;
    const seasonEnd = Date.now();
    const rankChanges = await readStorageCollection<RankChangeEvent>(
      nk,
      COLLECTION_RANK_CHANGES,
      seasonStart,
      seasonEnd
    );
    const seasonChanges = rankChanges.filter((rc) => rc.season_id === seasonId);

    let totalDelta = 0;
    let punchUpCount = 0;
    const weekData = [
      { totalDelta: 0, matches: 0 },
      { totalDelta: 0, matches: 0 },
      { totalDelta: 0, matches: 0 },
      { totalDelta: 0, matches: 0 },
    ];

    for (const rc of seasonChanges) {
      totalDelta += Math.abs(rc.winner_rank_delta) + Math.abs(rc.loser_rank_delta);
      if (rc.is_punch_up) punchUpCount++;

      const weekIndex = Math.min(Math.floor(rc.days_into_season / 7), 3);
      weekData[weekIndex].totalDelta +=
        Math.abs(rc.winner_rank_delta) + Math.abs(rc.loser_rank_delta);
      weekData[weekIndex].matches++;
    }

    const totalMatches = seasonChanges.length;

    // Derive season number from ID (season_N format)
    const seasonMatch = seasonId.match(/season_(\d+)/);
    const seasonNumber = seasonMatch ? parseInt(seasonMatch[1], 10) : 0;

    const summary: SeasonProgressionSnapshot = {
      season_id: seasonId,
      season_number: seasonNumber,
      updated_at: Date.now(),
      total_matches: totalMatches,
      avg_rank_change_per_match:
        totalMatches > 0 ? Math.round((totalDelta / (totalMatches * 2)) * 100) / 100 : 0,
      punch_up_rate: totalMatches > 0 ? punchUpCount / totalMatches : 0,
      punch_up_win_rate: 0,
      rank_velocity_by_week: {
        week_1: {
          avg_elo_change:
            weekData[0].matches > 0
              ? Math.round((weekData[0].totalDelta / (weekData[0].matches * 2)) * 100) / 100
              : 0,
          matches: weekData[0].matches,
        },
        week_2: {
          avg_elo_change:
            weekData[1].matches > 0
              ? Math.round((weekData[1].totalDelta / (weekData[1].matches * 2)) * 100) / 100
              : 0,
          matches: weekData[1].matches,
        },
        week_3: {
          avg_elo_change:
            weekData[2].matches > 0
              ? Math.round((weekData[2].totalDelta / (weekData[2].matches * 2)) * 100) / 100
              : 0,
          matches: weekData[2].matches,
        },
        week_4: {
          avg_elo_change:
            weekData[3].matches > 0
              ? Math.round((weekData[3].totalDelta / (weekData[3].matches * 2)) * 100) / 100
              : 0,
          matches: weekData[3].matches,
        },
      },
    };

    await nk.storageWrite([
      {
        collection: COLLECTION_SEASON_SUMMARIES,
        key: `summary_${seasonId}`,
        userId: SYSTEM_USER_ID,
        value: JSON.stringify(summary),
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    logger.info(
      'Season end snapshot recorded: season=%s matches=%d avg_change=%.2f',
      seasonId,
      totalMatches,
      summary.avg_rank_change_per_match
    );
  } catch (error) {
    logger.error('Failed to record season end snapshot', { error, seasonId });
  }
}

// --- Statistical Helpers ---

function calculateGiniCoefficient(claims: RewardClaimEvent[]): number {
  if (claims.length <= 1) return 0;

  const values = claims.map((c) => c.coins_awarded + c.gems_awarded * 100);
  if (values.every((v) => v === 0)) return 0;

  values.sort((a, b) => a - b);
  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  if (mean === 0) return 0;

  let sumOfDifferences = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumOfDifferences += Math.abs(values[i] - values[j]);
    }
  }

  return sumOfDifferences / (2 * n * n * mean);
}

function calculateTopPercentShare(claims: RewardClaimEvent[], percentile: number): number {
  if (claims.length === 0) return 0;

  const values = claims.map((c) => c.coins_awarded + c.gems_awarded * 100);
  const totalReward = values.reduce((sum, v) => sum + v, 0);

  if (totalReward === 0) return 0;

  values.sort((a, b) => b - a);
  const topCount = Math.max(1, Math.ceil(values.length * percentile));
  const topTotal = values.slice(0, topCount).reduce((sum, v) => sum + v, 0);

  return topTotal / totalReward;
}

// --- RPC Handlers ---

async function rpcGetSeasonTelemetry(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.debug('GetSeasonTelemetry RPC called');

  const validation = validatePayload<SeasonTelemetryQuery>(
    ZodSchemas.season_telemetry_query,
    payload,
    'season_telemetry_query'
  );
  if (!validation.success) {
    return createValidationErrorResponse('season_telemetry_query', validation.error);
  }

  try {
    const summary = await getSeasonTelemetrySummary(nk, validation.data);
    return JSON.stringify({ success: true, summary });
  } catch (error) {
    logger.error('Failed to get season telemetry summary', { error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve season telemetry' });
  }
}

async function rpcGetRankInflation(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.debug('GetRankInflation RPC called');

  const validation = validatePayload<SeasonTelemetryQuery>(
    ZodSchemas.season_telemetry_query,
    payload,
    'season_telemetry_query'
  );
  if (!validation.success) {
    return createValidationErrorResponse('season_telemetry_query', validation.error);
  }

  const query = validation.data;
  const startTime = query.start_date
    ? new Date(query.start_date).getTime()
    : Date.now() - 28 * 24 * 60 * 60 * 1000;
  const endTime = query.end_date ? new Date(query.end_date).getTime() : Date.now();
  const seasonId = query.season_id || 'current';

  try {
    const rankInflation = await getRankInflation(nk, seasonId, startTime, endTime);
    return JSON.stringify({ success: true, rank_inflation: rankInflation });
  } catch (error) {
    logger.error('Failed to get rank inflation', { error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve rank inflation data' });
  }
}

async function rpcGetRewardConcentration(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.debug('GetRewardConcentration RPC called');

  const validation = validatePayload<SeasonTelemetryQuery>(
    ZodSchemas.season_telemetry_query,
    payload,
    'season_telemetry_query'
  );
  if (!validation.success) {
    return createValidationErrorResponse('season_telemetry_query', validation.error);
  }

  const query = validation.data;
  const startTime = query.start_date
    ? new Date(query.start_date).getTime()
    : Date.now() - 28 * 24 * 60 * 60 * 1000;
  const endTime = query.end_date ? new Date(query.end_date).getTime() : Date.now();
  const seasonId = query.season_id || 'current';

  try {
    const rewardConcentration = await getRewardConcentration(nk, seasonId, startTime, endTime);
    return JSON.stringify({ success: true, reward_concentration: rewardConcentration });
  } catch (error) {
    logger.error('Failed to get reward concentration', { error });
    return JSON.stringify({
      success: false,
      error: 'Failed to retrieve reward concentration data',
    });
  }
}

async function rpcGetProgressionVelocity(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.debug('GetProgressionVelocity RPC called');

  const validation = validatePayload<SeasonTelemetryQuery>(
    ZodSchemas.season_telemetry_query,
    payload,
    'season_telemetry_query'
  );
  if (!validation.success) {
    return createValidationErrorResponse('season_telemetry_query', validation.error);
  }

  const query = validation.data;
  const startTime = query.start_date
    ? new Date(query.start_date).getTime()
    : Date.now() - 28 * 24 * 60 * 60 * 1000;
  const endTime = query.end_date ? new Date(query.end_date).getTime() : Date.now();
  const seasonId = query.season_id || 'current';

  try {
    const progressionVelocity = await getProgressionVelocity(
      nk,
      seasonId,
      startTime,
      startTime,
      endTime
    );
    return JSON.stringify({ success: true, progression_velocity: progressionVelocity });
  } catch (error) {
    logger.error('Failed to get progression velocity', { error });
    return JSON.stringify({
      success: false,
      error: 'Failed to retrieve progression velocity data',
    });
  }
}

async function rpcCaptureRatingSnapshot(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.debug('CaptureRatingSnapshot RPC called');

  const validation = validatePayload<{ season_id?: string }>(
    ZodSchemas.capture_rating_snapshot,
    payload,
    'capture_rating_snapshot'
  );
  if (!validation.success) {
    return createValidationErrorResponse('capture_rating_snapshot', validation.error);
  }

  const seasonId = validation.data.season_id || 'current';

  try {
    const snapshot = await captureRatingSnapshot(nk, seasonId, Date.now());
    if (!snapshot) {
      return JSON.stringify({ success: false, error: 'No leaderboard entries found' });
    }
    return JSON.stringify({ success: true, snapshot });
  } catch (error) {
    logger.error('Failed to capture rating snapshot', { error });
    return JSON.stringify({ success: false, error: 'Failed to capture rating snapshot' });
  }
}

// --- Registration ---

export function registerSeasonTelemetryEndpoints(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_season_telemetry',
    'get_season_telemetry',
    rpcGetSeasonTelemetry
  );
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_rank_inflation',
    'get_rank_inflation',
    rpcGetRankInflation
  );
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_reward_concentration',
    'get_reward_concentration',
    rpcGetRewardConcentration
  );
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_progression_velocity',
    'get_progression_velocity',
    rpcGetProgressionVelocity
  );
  registerRpcWithMetrics(
    initializer,
    'armored_archer/capture_rating_snapshot',
    'capture_rating_snapshot',
    rpcCaptureRatingSnapshot
  );
}
