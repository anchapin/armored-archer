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
import { listAllLeaderboardRecords } from '../utils/leaderboard-list';
import { toStorageValue, getStorageRawValue } from '../utils/storage-helpers';
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

export function logRankChange(nk: Runtime.Nakama, event: RankChangeEvent): void {
  try {
    if (!event.event_id) {
      event.event_id = generateEventId('rc');
    }

    nk.storageWrite([
      {
        collection: COLLECTION_RANK_CHANGES,
        key: event.event_id,
        userId: SYSTEM_USER_ID,
        value: toStorageValue(event),
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

export function logRewardClaim(nk: Runtime.Nakama, event: RewardClaimEvent): void {
  try {
    if (!event.event_id) {
      event.event_id = generateEventId('rw');
    }

    nk.storageWrite([
      {
        collection: COLLECTION_REWARD_CLAIMS,
        key: event.event_id,
        userId: SYSTEM_USER_ID,
        value: toStorageValue(event),
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    // Audit trail
    logAudit(
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

export function captureRatingSnapshot(
  nk: Runtime.Nakama,
  seasonId: string,
  _seasonStartTime: number
): RatingSnapshot | null {
  try {
    const records = listAllLeaderboardRecords(nk, seasonId, 10000);
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

    nk.storageWrite([
      {
        collection: COLLECTION_RATING_SNAPSHOTS,
        key: snapshot.snapshot_id,
        userId: SYSTEM_USER_ID,
        value: toStorageValue(snapshot),
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

function readStorageCollection<T extends { timestamp: number }>(
  nk: Runtime.Nakama,
  collection: string,
  startTime: number,
  endTime: number
): T[] {
  try {
    const objects = nk.storageRead([{ collection, key: '*', userId: SYSTEM_USER_ID }]);
    return objects
      .map(
        (obj: { value: string | Record<string, unknown> }) =>
          JSON.parse(getStorageRawValue(obj.value) ?? '') as T
      )
      .filter((item: T) => item.timestamp >= startTime && item.timestamp <= endTime);
  } catch {
    return [];
  }
}

export function getRankInflation(
  nk: Runtime.Nakama,
  seasonId: string,
  startTime: number,
  endTime: number
): SeasonTelemetrySummary['rank_inflation'] {
  const snapshots = readStorageCollection<RatingSnapshot>(
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

export function getRewardConcentration(
  nk: Runtime.Nakama,
  seasonId: string,
  startTime: number,
  endTime: number
): SeasonTelemetrySummary['reward_concentration'] {
  const claims = readStorageCollection<RewardClaimEvent>(
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

export interface RankChangeAggregation {
  seasonChanges: RankChangeEvent[];
  totalDelta: number;
  punchUpCount: number;
  weekData: { totalDelta: number; matches: number }[];
}

/**
 * Aggregates rank-change events for one season: totals, punch-up count and
 * per-week buckets. Shared by the progression-velocity report and the season
 * progression snapshot writer.
 */
function aggregateSeasonRankChanges(
  rankChanges: RankChangeEvent[],
  seasonId: string
): RankChangeAggregation {
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

  return { seasonChanges, totalDelta, punchUpCount, weekData };
}

/**
 * Maps weekly buckets to the rank_velocity_by_week response shape.
 */
function rankVelocityByWeek(
  weekData: { totalDelta: number; matches: number }[]
): SeasonProgressionSnapshot['rank_velocity_by_week'] {
  const week = (i: number) => ({
    avg_elo_change:
      weekData[i].matches > 0
        ? Math.round((weekData[i].totalDelta / (weekData[i].matches * 2)) * 100) / 100
        : 0,
    matches: weekData[i].matches,
  });
  return { week_1: week(0), week_2: week(1), week_3: week(2), week_4: week(3) };
}

export function getProgressionVelocity(
  nk: Runtime.Nakama,
  seasonId: string,
  seasonStartTime: number,
  startTime: number,
  endTime: number
): SeasonTelemetrySummary['progression_velocity'] {
  const rankChanges = readStorageCollection<RankChangeEvent>(
    nk,
    COLLECTION_RANK_CHANGES,
    startTime,
    endTime
  );

  const { seasonChanges, totalDelta, punchUpCount, weekData } = aggregateSeasonRankChanges(
    rankChanges,
    seasonId
  );

  const totalMatches = seasonChanges.length;
  const avgChangePerMatch = totalMatches > 0 ? totalDelta / (totalMatches * 2) : 0;

  return {
    total_matches_tracked: totalMatches,
    avg_rank_change_per_match: Math.round(avgChangePerMatch * 100) / 100,
    punch_up_rate: totalMatches > 0 ? punchUpCount / totalMatches : 0,
    rank_velocity_by_week: rankVelocityByWeek(weekData),
  };
}

export function getSeasonTelemetrySummary(
  nk: Runtime.Nakama,
  query: SeasonTelemetryQuery
): SeasonTelemetrySummary {
  const { startTime, endTime, seasonId } = resolveQueryWindow(query);

  // Derive season start time from season ID if it follows the pattern season_N
  const seasonStartTime = startTime;

  const rankInflation = getRankInflation(nk, seasonId, startTime, endTime);
  const rewardConcentration = getRewardConcentration(nk, seasonId, startTime, endTime);
  const progressionVelocity = getProgressionVelocity(
    nk,
    seasonId,
    seasonStartTime,
    startTime,
    endTime
  );

  return {
    rank_inflation: rankInflation,
    reward_concentration: rewardConcentration,
    progression_velocity: progressionVelocity,
    period_start: startTime,
    period_end: endTime,
    season_id: seasonId,
  };
}

export function recordSeasonEndSnapshot(
  nk: Runtime.Nakama,
  seasonId: string,
  seasonStartTime: number
): void {
  try {
    // Capture a final rating snapshot
    captureRatingSnapshot(nk, seasonId, seasonStartTime);

    // Read all rank changes for the season
    const seasonStart = seasonStartTime;
    const seasonEnd = Date.now();
    const rankChanges = readStorageCollection<RankChangeEvent>(
      nk,
      COLLECTION_RANK_CHANGES,
      seasonStart,
      seasonEnd
    );
    const { seasonChanges, totalDelta, punchUpCount, weekData } = aggregateSeasonRankChanges(
      rankChanges,
      seasonId
    );

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
      rank_velocity_by_week: rankVelocityByWeek(weekData),
    };

    nk.storageWrite([
      {
        collection: COLLECTION_SEASON_SUMMARIES,
        key: `summary_${seasonId}`,
        userId: SYSTEM_USER_ID,
        value: toStorageValue(summary),
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

/**
 * Resolves the query window (start/end/season) from a telemetry query payload.
 */
function resolveQueryWindow(query: SeasonTelemetryQuery): {
  startTime: number;
  endTime: number;
  seasonId: string;
} {
  const startTime = query.start_date
    ? new Date(query.start_date).getTime()
    : Date.now() - 28 * 24 * 60 * 60 * 1000;
  const endTime = query.end_date ? new Date(query.end_date).getTime() : Date.now();
  const seasonId = query.season_id || 'current';
  return { startTime, endTime, seasonId };
}

/**
 * Validates and normalizes the shared season-telemetry RPC query payload.
 * Returns either the resolved query window or a ready-to-return error response.
 */
function parseTelemetryQuery(
  payload: string
):
  | { ok: true; startTime: number; endTime: number; seasonId: string }
  | { ok: false; response: string } {
  const validation = validatePayload<SeasonTelemetryQuery>(
    ZodSchemas.season_telemetry_query,
    payload,
    'season_telemetry_query'
  );
  if (!validation.success) {
    return {
      ok: false,
      response: createValidationErrorResponse('season_telemetry_query', validation.error),
    };
  }

  const query = validation.data;
  const { startTime, endTime, seasonId } = resolveQueryWindow(query);
  return { ok: true, startTime, endTime, seasonId };
}

function rpcGetSeasonTelemetry(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
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
    const summary = getSeasonTelemetrySummary(nk, validation.data);
    return JSON.stringify({ success: true, summary });
  } catch (error) {
    logger.error('Failed to get season telemetry summary', { error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve season telemetry' });
  }
}

type TelemetryQueryRpcSpec = [
  rpcId: string,
  metricName: string,
  debugName: string,
  errorLabel: string,
  resultKey: string,
  fetcher: TelemetryQueryFetcher,
];

const TELEMETRY_QUERY_RPCS: TelemetryQueryRpcSpec[] = [
  [
    'armored_archer/get_rank_inflation',
    'get_rank_inflation',
    'GetRankInflation',
    'rank inflation',
    'rank_inflation',
    getRankInflation,
  ],
  [
    'armored_archer/get_reward_concentration',
    'get_reward_concentration',
    'GetRewardConcentration',
    'reward concentration',
    'reward_concentration',
    getRewardConcentration,
  ],
  [
    'armored_archer/get_progression_velocity',
    'get_progression_velocity',
    'GetProgressionVelocity',
    'progression velocity',
    'progression_velocity',
    (nk2, seasonId2, startTime2, endTime2) =>
      getProgressionVelocity(nk2, seasonId2, startTime2, startTime2, endTime2),
  ],
];

type TelemetryQueryFetcher = (
  nk: Runtime.Nakama,
  seasonId: string,
  startTime: number,
  endTime: number
) => unknown;

/**
 * Shared body of the season-telemetry query RPCs: validate the payload,
 * resolve the window, run the fetcher, and shape success/error responses.
 */
function runTelemetryQueryRpc(
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string,
  debugName: string,
  errorLabel: string,
  resultKey: string,
  fetcher: TelemetryQueryFetcher
): string {
  logger.debug(debugName + ' RPC called');

  const parsed = parseTelemetryQuery(payload);
  if (!parsed.ok) {
    return parsed.response;
  }
  const { startTime, endTime, seasonId } = parsed;

  try {
    const result = fetcher(nk, seasonId, startTime, endTime);
    return JSON.stringify({ success: true, [resultKey]: result });
  } catch (error) {
    logger.error('Failed to get ' + errorLabel, { error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve ' + errorLabel + ' data' });
  }
}

function rpcCaptureRatingSnapshot(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
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
    const snapshot = captureRatingSnapshot(nk, seasonId, Date.now());
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
  for (const [
    rpcId,
    metricName,
    debugName,
    errorLabel,
    resultKey,
    fetcher,
  ] of TELEMETRY_QUERY_RPCS) {
    registerRpcWithMetrics(initializer, rpcId, metricName, (ctx, logger, nk, payload) =>
      runTelemetryQueryRpc(logger, nk, payload, debugName, errorLabel, resultKey, fetcher)
    );
  }
  registerRpcWithMetrics(
    initializer,
    'armored_archer/capture_rating_snapshot',
    'capture_rating_snapshot',
    rpcCaptureRatingSnapshot
  );
}
