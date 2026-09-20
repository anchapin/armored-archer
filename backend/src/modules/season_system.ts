/**
 * Season System module.
 * @fileoverview Manages seasonal rewards and rankings.
 */

import { Runtime } from '../types/nakama';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import { applyCurrencyDelta, type CurrencyDelta } from './currency';
import { recordSeasonCompletion } from './season_leaderboard';
import { logRewardClaim, recordSeasonEndSnapshot } from './season_telemetry';
import { toStorageValue, getStorageRawValue } from '../utils/storage-helpers';

/**
 * Season rewards data structure.
 *
 * @property rank_tier - Tier of rewards based on rank
 * @property coins - Number of coins awarded
 * @property gems - Number of gems awarded
 * @property cosmetics - Optional cosmetic rewards
 */
export interface SeasonRewards {
  rank_tier: 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';
  coins: number;
  gems: number;
  cosmetics?: {
    title: string;
    aura?: string;
  };
}

/**
 * Leaderboard record data structure.
 *
 * @property ownerId - ID of the player
 * @property username - Display name of the player
 * @property rank - Current rank
 * @property score - Current score
 * @property metadata - Optional metadata
 * @property expiry - Optional expiry time
 * @property maxNumScore - Maximum number of scores
 * @property numScore - Number of scores
 */
export interface LeaderboardRecord {
  ownerId: string;
  username: string;
  rank: number;
  score: number;
  metadata?: string;
  expiry?: number;
  maxNumScore?: number;
  numScore?: number;
}

/**
 * Season information data structure.
 *
 * @property season_id - Unique identifier for the season
 * @property season_number - Sequential season number
 * @property start_time - Start timestamp
 * @property end_time - End timestamp
 * @property status - Current status ("active", "ended")
 * @property duration_weeks - Duration in weeks
 */
export interface SeasonInfo {
  season_id: string;
  season_number: number;
  start_time: number;
  end_time: number;
  status: string; // "active", "ended"
  duration_weeks: number;
}

/**
 * Leaderboard entry data structure.
 *
 * @property owner_id - ID of the player
 * @property username - Display name of the player
 * @property rank - Current rank
 * @property score - Current score
 * @property meta - Additional metadata
 */
export interface LeaderboardEntry {
  owner_id: string;
  username: string;
  rank: number;
  score: number;
  meta: {
    wins: number;
    losses: number;
    win_rate: number;
    punch_up_wins: number;
  };
}

/**
 * Rank change data structure.
 *
 * @property winner_id - ID of the winning player
 * @property loser_id - ID of the losing player
 * @property winner_old_rank - Previous rank of winner
 * @property loser_old_rank - Previous rank of loser
 * @property winner_new_rank - New rank of winner
 * @property loser_new_rank - New rank of loser
 * @property is_punch_up - Whether this was a punch-up match
 */
export interface RankChange {
  winner_id: string;
  loser_id: string;
  winner_old_rank: number;
  loser_old_rank: number;
  winner_new_rank: number;
  loser_new_rank: number;
  is_punch_up: boolean;
}

const SEASON_DURATION_WEEKS = 4;
const SEASON_DURATION_MS = SEASON_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000;

// --- Issue #1132: rpcEndSeason atomicity ---
// Sentinel persisted on the `seasons` collection while reward distribution is
// in flight. On retry we read it back to resume from `next_index` so a
// mid-loop failure never leaves the season half-ended (some players credited,
// others not). The token also tags per-player `season_rewards_claimed` writes
// so a re-run cannot double-credit someone already processed.
const SEASON_ENDING_STATUS = 'ending';
const SEASON_ENDED_STATUS = 'ended';
const PARTIAL_SEASON_FAILED_ERROR_CODE = 'PARTIAL_SEASON_FAILED';

/**
 * Per-player distribution progress for an in-flight season end (issue #1132).
 * Persisted on the `seasons` collection under `end_distribution`.
 *
 * @property generation_token - Identifies the current end-season run; tags
 *   per-player markers so a resumed run cannot credit a player already
 *   finished in the same run
 * @property players - Snapshot of the leaderboard owner IDs captured at the
 *   start of the run (so a resume uses the original ordering, not a fresh
 *   leaderboard read that may have changed between attempts)
 * @property next_index - 0-based index of the next player to process
 * @property started_at - Wall-clock timestamp the run began
 * @property completed_at - Set once every player has been credited; the
 *   sentinel itself transitions to status='ended' at the same point
 */
interface SeasonEndDistribution {
  generation_token: string;
  players: string[];
  next_index: number;
  started_at: number;
  completed_at?: number;
}

/**
 * Generates a generation token for a single end-season run. Mirrors the
 * existing `Math.random()`-based id pattern used by `matchmaker.ts` so we
 * avoid pulling Node-only `crypto.randomUUID` into the Nakama bundle.
 */
function generateSeasonEndToken(): string {
  return `seend_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Reads the persisted season sentinel from the `seasons` collection. Returns
 * the parsed `end_distribution` and the surrounding season info if both are
 * present, otherwise null (the season has never been through `rpcEndSeason`).
 */
function readSeasonEndSentinel(
  nk: Runtime.Nakama,
  seasonId: string
): { season: SeasonInfo; distribution: SeasonEndDistribution } | null {
  try {
    const stored = nk.storageRead([
      {
        collection: 'seasons',
        key: seasonId,
        userId: '',
      },
    ]);
    if (stored.length === 0 || !stored[0].value) {
      return null;
    }
    const parsed = JSON.parse(stored[0].value) as SeasonInfo & {
      end_distribution?: SeasonEndDistribution;
    };
    if (!parsed.end_distribution) {
      return null;
    }
    return { season: parsed, distribution: parsed.end_distribution };
  } catch {
    return null;
  }
}

/**
 * Persists a `seasons` storage record with the given distribution state. The
 * sentinel is written BEFORE the first per-player credit so an observer can
 * always tell that a season-end run is in flight (status='ending') and only
 * ever flips to status='ended' after every player has been credited.
 */
function writeSeasonEndSentinel(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  season: SeasonInfo,
  distribution: SeasonEndDistribution
): void {
  nk.storageWrite([
    {
      collection: 'seasons',
      key: season.season_id,
      userId: ctx.userId,
      value: JSON.stringify({
        ...season,
        status: SEASON_ENDING_STATUS,
        end_distribution: distribution,
      }),
    },
  ]);
}

/**
 * Reads the per-player completion marker for the current generation. When the
 * marker carries a matching generation_token the player has already been
 * credited in this run and must be skipped on resume.
 */
function readPlayerCompletionMarker(
  nk: Runtime.Nakama,
  seasonId: string,
  ownerId: string
): { token?: string; completed: boolean } {
  try {
    const stored = nk.storageRead([
      {
        collection: 'season_rewards_claimed',
        key: `${seasonId}_${ownerId}`,
        userId: ownerId,
      },
    ]);
    if (stored.length === 0 || !stored[0].value) {
      return { completed: false };
    }
    const parsed = JSON.parse(stored[0].value) as {
      generation_token?: string;
    };
    return { token: parsed.generation_token, completed: !!parsed.generation_token };
  } catch {
    return { completed: false };
  }
}

// --- Prestige Tier Definitions ---
export type PrestigeTierName = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface PrestigeTierConfig {
  tier: PrestigeTierName;
  required_rank_threshold: number;
  required_seasons: number;
  title: string;
  aura: string;
}

export const PRESTIGE_TIERS: PrestigeTierConfig[] = [
  {
    tier: 'bronze',
    required_rank_threshold: 100,
    required_seasons: 2,
    title: 'Steadfast Archer',
    aura: 'bronze_aura',
  },
  {
    tier: 'silver',
    required_rank_threshold: 50,
    required_seasons: 3,
    title: 'Elite Marksman',
    aura: 'silver_aura',
  },
  {
    tier: 'gold',
    required_rank_threshold: 10,
    required_seasons: 3,
    title: 'Legendary Sharpshooter',
    aura: 'gold_aura',
  },
  {
    tier: 'diamond',
    required_rank_threshold: 10,
    required_seasons: 5,
    title: 'Eternal Champion',
    aura: 'diamond_aura',
  },
];

export interface PlayerPrestigeRecord {
  player_id: string;
  season_finishes: { season_id: string; rank: number }[];
  prestige_tiers_earned: PrestigeTierName[];
  last_updated: number;
}

// --- Soft Reset ELO Mapping ---
const SOFT_RESET_TIERS: { max_rank: number; starting_elo: number }[] = [
  { max_rank: 10, starting_elo: 1300 },
  { max_rank: 50, starting_elo: 1200 },
  { max_rank: 100, starting_elo: 1150 },
  { max_rank: 500, starting_elo: 1100 },
  { max_rank: Infinity, starting_elo: 1000 },
];

// Rank decay configuration
const RANK_DECAY_DAYS = 7; // Days of inactivity before decay starts
const RANK_DECAY_AMOUNT = 20; // Points lost per decay period
const RANK_DECAY_MAX_LOSS = 120; // Maximum points that can be lost per decay
const RANK_DECAY_MIN_SCORE = 800; // Minimum score after decay
const RANK_DECAY_CHECK_MS = 24 * 60 * 60 * 1000; // Check every 24 hours

/**
 * Calculates the starting ELO for a player after a season soft reset.
 *
 * @param rank - Player's final rank in the ending season
 * @returns Starting ELO for the new season
 */
export function calculateSoftResetElo(rank: number): number {
  for (const tier of SOFT_RESET_TIERS) {
    if (rank <= tier.max_rank) {
      return tier.starting_elo;
    }
  }
  return 1000;
}

/**
 * Evaluates which prestige tiers a player qualifies for based on season finishes.
 *
 * @param seasonFinishes - Array of qualifying season finishes (rank <= 100)
 * @returns Array of earned prestige tier names
 */
export function evaluatePrestigeTiers(
  seasonFinishes: { season_id: string; rank: number }[]
): PrestigeTierName[] {
  const earned: PrestigeTierName[] = [];

  for (const tierConfig of PRESTIGE_TIERS) {
    const qualifyingSeasons = new Set(
      seasonFinishes
        .filter((f) => f.rank <= tierConfig.required_rank_threshold)
        .map((f) => f.season_id)
    );
    if (qualifyingSeasons.size >= tierConfig.required_seasons) {
      earned.push(tierConfig.tier);
    }
  }

  return earned;
}

/**
 * Gets a player's prestige record from storage.
 *
 * @param nk - Nakama server interface
 * @param playerId - Player ID
 * @returns Player prestige record or default empty record
 */
export function getPlayerPrestigeRecord(
  nk: Runtime.Nakama,
  playerId: string
): PlayerPrestigeRecord {
  try {
    const storage = nk.storageRead([
      {
        collection: 'player_prestige',
        key: playerId,
        userId: playerId,
      },
    ]);
    if (storage.length > 0 && storage[0].value) {
      return JSON.parse(getStorageRawValue(storage[0].value) ?? "") as PlayerPrestigeRecord;
    }
  } catch {
    // Return default if storage read fails
  }

  return {
    player_id: playerId,
    season_finishes: [],
    prestige_tiers_earned: [],
    last_updated: 0,
  };
}

/**
 * Updates a player's prestige record with a new season finish.
 *
 * @param nk - Nakama server interface
 * @param playerId - Player ID
 * @param seasonId - Season ID that just ended
 * @param finalRank - Player's final rank in the season
 * @returns Updated prestige record with newly earned tiers
 */
export function updatePlayerPrestigeRecord(
  nk: Runtime.Nakama,
  playerId: string,
  seasonId: string,
  finalRank: number
): { record: PlayerPrestigeRecord; new_tiers: PrestigeTierName[] } {
  const record = getPlayerPrestigeRecord(nk, playerId);
  const previouslyEarned = new Set(record.prestige_tiers_earned);

  // Only record finishes within top 100 (max threshold for any prestige tier)
  if (finalRank <= 100) {
    const existingIdx = record.season_finishes.findIndex((f) => f.season_id === seasonId);
    if (existingIdx >= 0) {
      record.season_finishes[existingIdx].rank = Math.min(
        record.season_finishes[existingIdx].rank,
        finalRank
      );
    } else {
      record.season_finishes.push({ season_id: seasonId, rank: finalRank });
    }
  }

  const allEarned = evaluatePrestigeTiers(record.season_finishes);
  const newTiers = allEarned.filter((t) => !previouslyEarned.has(t));

  record.prestige_tiers_earned = allEarned;
  record.last_updated = Date.now();

  nk.storageWrite([
    {
      collection: 'player_prestige',
      key: playerId,
      userId: playerId,
      value: toStorageValue(record),
    },
  ]);

  return { record, new_tiers: newTiers };
}

/**
 * Grants cosmetic rewards for newly earned prestige tiers.
 *
 * @param nk - Nakama server interface
 * @param playerId - Player ID
 * @param newTiers - Newly earned prestige tiers
 */
export function grantPrestigeRewards(
  nk: Runtime.Nakama,
  playerId: string,
  newTiers: PrestigeTierName[]
): void {
  for (const tierName of newTiers) {
    const tierConfig = PRESTIGE_TIERS.find((t) => t.tier === tierName);
    if (tierConfig) {
      addPlayerCosmetic(nk, playerId, tierConfig.title, tierConfig.aura);
    }
  }
}

/**
 * Calculates progress toward each prestige tier for a player.
 *
 * @param seasonFinishes - Player's qualifying season finishes
 * @returns Progress info for each tier
 */
export function calculatePrestigeProgress(seasonFinishes: { season_id: string; rank: number }[]): {
  tier: PrestigeTierName;
  earned: boolean;
  qualifying_seasons: number;
  required_seasons: number;
  title: string;
}[] {
  return PRESTIGE_TIERS.map((tierConfig) => {
    const qualifyingSeasons = new Set(
      seasonFinishes
        .filter((f) => f.rank <= tierConfig.required_rank_threshold)
        .map((f) => f.season_id)
    );
    return {
      tier: tierConfig.tier,
      earned: qualifyingSeasons.size >= tierConfig.required_seasons,
      qualifying_seasons: qualifyingSeasons.size,
      required_seasons: tierConfig.required_seasons,
      title: tierConfig.title,
    };
  });
}

/**
 * Registers the get season info RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetSeasonInfo(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_season_info', rpcGetSeasonInfo);
}

/**
 * Retrieves current season information and player stats.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with season info and player stats
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "season": { ... },
 *   "player_rank": 15,
 *   "player_score": 1200,
 *   "time_remaining": 123456
 * }
 */
export function rpcGetSeasonInfo(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get season info called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_season_info, payload, 'get_season_info');
  if (!validation.success) {
    return createValidationErrorResponse('get_season_info', validation.error);
  }

  const currentSeason = getCurrentSeason();

  const playerEntry = getLeaderboardEntry(nk, ctx.userId, currentSeason.season_id);

  return JSON.stringify({
    success: true,
    season: currentSeason,
    player_rank: playerEntry ? playerEntry.rank : null,
    player_score: playerEntry ? playerEntry.score : 0,
    time_remaining: Math.max(0, currentSeason.end_time - Date.now()),
  });
}

/**
 * Registers the get leaderboard RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetLeaderboard(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_leaderboard', rpcGetLeaderboard);
}

/**
 * Retrieves the current season leaderboard.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing limit parameter
 * @returns JSON string with leaderboard data
 *
 * @example
 * // Request payload
 * { "limit": 20 }
 *
 * // Response
 * {
 *   "success": true,
 *   "season": { ... },
 *   "leaderboard": [ ... ],
 *   "total": 100
 * }
 */
export function rpcGetLeaderboard(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get leaderboard called for user: %s', ctx.userId);

  const currentSeason = getCurrentSeason();
  const validation = validatePayload(ZodSchemas.get_leaderboard, payload, 'get_leaderboard');
  if (!validation.success) {
    return createValidationErrorResponse('get_leaderboard', validation.error);
  }

  const request = validation.data || {};
  const limit = request.limit || 50;

  const records = nk.leaderboardRecordList(currentSeason.season_id, [], limit, '', 0);

  const entries: LeaderboardEntry[] = records.map((record: LeaderboardRecord) => ({
    owner_id: record.ownerId,
    username: record.username,
    rank: record.rank,
    score: record.score,
    meta: JSON.parse(record.metadata || '{}'),
  }));

  return JSON.stringify({
    success: true,
    season: currentSeason,
    leaderboard: entries,
    total: records.length,
  });
}

/**
 * Issue #1076 / ADR-0002: the client-facing `armored_archer/update_rank` RPC
 * (`rpcUpdateRank` + `registerRpcUpdateRank`) was removed. It applied Elo
 * updates from client-supplied winner/loser IDs without verifying the caller
 * was a participant of a server-recorded terminal match, bypassing the
 * server-declared settlement that `matchmaker.ts`'s `rpcCompleteMatch`
 * implements via `resolveServerTerminalState`. Seasonal Elo now mutates ONLY
 * through `complete_match`'s server-declared path, which settles via the
 * exported `applyEloUpdates` below.
 */

/**
 * Base Elo K-factor applied to both sides of a normal ranked match.
 */
export const BASE_K_FACTOR = 32;

/**
 * Elevated K-factor applied to both sides of a punch-up match (server-recorded).
 */
export const PUNCH_UP_K_FACTOR = 50;

/**
 * Multiplier applied to the K-factor of an underdog's punch-up LOSS deduction
 * (issue #864): losing the punch-up wager costs 2x the punch-up K-factor in
 * Ladder Rating so the wager has real teeth.
 */
export const PUNCH_UP_LOSS_K_MULTIPLIER = 2;

/**
 * Per-side K-factors for a settled ranked match.
 *
 * @property winnerK - K-factor for the winner's Elo gain
 * @property loserK - K-factor governing the loser's Elo deduction
 */
export interface EloKFactors {
  winnerK: number;
  loserK: number;
}

/**
 * Resolves the per-side Elo K-factors for a match.
 *
 * - Normal matches: base K (32) for both sides.
 * - Punch-up matches: elevated K (50) for both sides (unchanged behavior).
 * - Punch-up underdog loss (issue #864): the underdog's deduction is amplified
 *   to 2x the punch-up K-factor. The winner side is never amplified, and a
 *   favorite losing a punch-up (upset) still deducts at the plain punch-up K.
 *
 * @param isPunchUp - Whether the server match record marks this a punch-up
 * @param loserIsUnderdog - Whether the loser is the punch-up underdog
 * @returns Per-side K-factors
 */
export function getEloKFactors(isPunchUp: boolean, loserIsUnderdog: boolean): EloKFactors {
  const winnerK = isPunchUp ? PUNCH_UP_K_FACTOR : BASE_K_FACTOR;
  const amplifiedLoserK = PUNCH_UP_K_FACTOR * PUNCH_UP_LOSS_K_MULTIPLIER;
  const loserK =
    isPunchUp && loserIsUnderdog ? amplifiedLoserK : isPunchUp ? PUNCH_UP_K_FACTOR : BASE_K_FACTOR;
  return { winnerK, loserK };
}

/**
 * Applies Elo rating updates to both players.
 *
 * The loser's deduction uses 2x the punch-up K-factor when (and only when)
 * the loser is the punch-up underdog — the amplified punch-up loss ratified
 * in issue #864. The underdog flag must be derived from server-side data
 * (match record ranks / leaderboard Elo), never from client payloads.
 *
 * @param nk - Nakama server interface
 * @param ctx - Nakama runtime context
 * @param currentSeason - Current season scope for the leaderboard writes
 * @param winnerId - Server-declared winner user ID
 * @param loserId - Server-declared loser user ID
 * @param winnerOldElo - Winner's Elo before the match
 * @param loserOldElo - Loser's Elo before the match
 * @param isPunchUp - Whether the server match record marks this a punch-up
 * @param winnerEntry - Winner's prior leaderboard entry (or null)
 * @param loserEntry - Loser's prior leaderboard entry (or null)
 * @param loserIsUnderdog - Whether the loser is the punch-up underdog
 * @returns New Elo ratings for winner and loser
 */
export function applyEloUpdates(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  currentSeason: { season_id: string },
  winnerId: string,
  loserId: string,
  winnerOldElo: number,
  loserOldElo: number,
  isPunchUp: boolean,
  winnerEntry: LeaderboardEntry | null,
  loserEntry: LeaderboardEntry | null,
  loserIsUnderdog: boolean
): { winnerNewElo: number; loserNewElo: number } {
  const { winnerK, loserK } = getEloKFactors(isPunchUp, loserIsUnderdog);
  const expectedWinner = 1 / (1 + Math.pow(10, (loserOldElo - winnerOldElo) / 400));
  const expectedLoser = 1 - expectedWinner;

  const winnerNewElo = Math.round(winnerOldElo + winnerK * (1 - expectedWinner));
  const loserNewElo = Math.round(loserOldElo + loserK * (0 - expectedLoser));

  // Update winner
  const winnerMeta = winnerEntry
    ? winnerEntry.meta
    : { wins: 0, losses: 0, win_rate: 0, punch_up_wins: 0 };
  winnerMeta.wins++;
  winnerMeta.punch_up_wins += isPunchUp ? 1 : 0;
  winnerMeta.win_rate = winnerMeta.wins / (winnerMeta.wins + winnerMeta.losses);

  nk.leaderboardRecordWrite(
    currentSeason.season_id,
    winnerId,
    ctx.username || 'Player',
    winnerNewElo,
    0,
    {
      wins: String(winnerMeta.wins),
      losses: String(winnerMeta.losses),
      win_rate: String(winnerMeta.win_rate),
      punch_up_wins: String(winnerMeta.punch_up_wins),
    }
  );

  // Update loser
  const loserMeta = loserEntry
    ? loserEntry.meta
    : { wins: 0, losses: 0, win_rate: 0, punch_up_wins: 0 };
  loserMeta.losses++;
  loserMeta.win_rate = loserMeta.wins / (loserMeta.wins + loserMeta.losses);

  nk.leaderboardRecordWrite(currentSeason.season_id, loserId, 'Opponent', loserNewElo, 0, {
    wins: String(loserMeta.wins),
    losses: String(loserMeta.losses),
    win_rate: String(loserMeta.win_rate),
    punch_up_wins: String(loserMeta.punch_up_wins),
  });

  return { winnerNewElo, loserNewElo };
}

/**
 * Registers the get season rewards RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetSeasonRewards(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_season_rewards', rpcGetSeasonRewards);
}

/**
 * Retrieves season rewards for a player.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with season rewards
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "rank": 15,
 *   "rewards": { ... }
 * }
 */
export function rpcGetSeasonRewards(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get season rewards called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_season_rewards, payload, 'get_season_rewards');
  if (!validation.success) {
    return createValidationErrorResponse('get_season_rewards', validation.error);
  }

  const currentSeason = getCurrentSeason();
  const playerEntry = getLeaderboardEntry(nk, ctx.userId, currentSeason.season_id);

  if (!playerEntry) {
    return JSON.stringify({
      success: true,
      rewards: null,
    });
  }

  const rewards = calculateRewards(playerEntry.rank, currentSeason.season_number);

  return JSON.stringify({
    success: true,
    rank: playerEntry.rank,
    rewards: rewards,
  });
}

/**
 * Registers the claim season rewards RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcClaimSeasonRewards(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/claim_season_rewards', rpcClaimSeasonRewards);
}

/**
 * Gets player's claimed cosmetics from storage.
 *
 * @param nk - Nakama server interface
 * @param userId - Player ID
 * @returns Player's claimed cosmetics object
 */
export function getPlayerCosmetics(
  nk: Runtime.Nakama,
  userId: string
): { titles: string[]; auras: string[] } {
  try {
    const storage = nk.storageRead([
      {
        collection: 'player_cosmetics',
        key: userId,
        userId: userId,
      },
    ]);

    if (storage.length > 0 && storage[0].value) {
      const data = JSON.parse(getStorageRawValue(storage[0].value) ?? "") as {
        titles?: string[];
        auras?: string[];
      };
      return {
        titles: data.titles || [],
        auras: data.auras || [],
      };
    }
  } catch {
    // Silently return empty if storage read fails
  }

  return { titles: [], auras: [] };
}

/**
 * Adds cosmetics to player's collection.
 *
 * @param nk - Nakama server interface
 * @param userId - Player ID
 * @param title - Title to add (optional)
 * @param aura - Aura to add (optional)
 */
export function addPlayerCosmetic(
  nk: Runtime.Nakama,
  userId: string,
  title?: string,
  aura?: string
): void {
  const currentCosmetics = getPlayerCosmetics(nk, userId);
  const updatedCosmetics = {
    titles: [...currentCosmetics.titles],
    auras: [...currentCosmetics.auras],
  };

  if (title && !updatedCosmetics.titles.includes(title)) {
    updatedCosmetics.titles.push(title);
  }

  if (aura && !updatedCosmetics.auras.includes(aura)) {
    updatedCosmetics.auras.push(aura);
  }

  nk.storageWrite([
    {
      collection: 'player_cosmetics',
      key: userId,
      userId: userId,
      value: toStorageValue(updatedCosmetics),
    },
  ]);
}

/**
 * Claims season rewards for a player.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with claim result
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "rewards": { ... },
 *   "claimed": true
 * }
 */
export function rpcClaimSeasonRewards(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Claim season rewards called for user: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.claim_season_rewards,
    payload,
    'claim_season_rewards'
  );
  if (!validation.success) {
    return createValidationErrorResponse('claim_season_rewards', validation.error);
  }

  const currentSeason = getCurrentSeason();

  // Allow claiming during active season (preview mode) OR after season ends
  // This lets players preview their rewards before season ends
  const isSeasonActive = Date.now() < currentSeason.end_time;
  if (isSeasonActive) {
    logger.info('Claiming rewards in preview mode for active season');
  }

  const objects = nk.storageRead([
    {
      collection: 'season_rewards_claimed',
      key: `${currentSeason.season_id}_${ctx.userId}`,
      userId: ctx.userId,
    },
  ]);

  if (objects.length > 0) {
    return JSON.stringify({
      success: false,
      error: 'Rewards already claimed for this season',
    });
  }

  const playerEntry = getLeaderboardEntry(nk, ctx.userId, currentSeason.season_id);

  if (!playerEntry) {
    return JSON.stringify({
      success: false,
      error: 'No leaderboard entry found',
    });
  }

  const rewards = calculateRewards(playerEntry.rank, currentSeason.season_number);

  // Mark rewards as claimed
  nk.storageWrite([
    {
      collection: 'season_rewards_claimed',
      key: `${currentSeason.season_id}_${ctx.userId}`,
      userId: ctx.userId,
      value: toStorageValue({
        season_id: currentSeason.season_id,
        user_id: ctx.userId,
        claimed_at: Date.now(),
        rank: playerEntry.rank,
        rewards: rewards,
      }),
    },
  ]);

  // Give rewards (coins, gems) via the unified currency ledger (issue #860)
  // so season earnings are visible in get_currency and spendable via
  // spend_gems. Reward `coins` map to the ledger `coins` field (#866).
  const rewardDelta: CurrencyDelta = {};

  if (rewards.coins) {
    rewardDelta.coins = rewards.coins;
  }

  if (rewards.gems) {
    rewardDelta.gems = rewards.gems;
  }

  applyCurrencyDelta(nk, ctx.userId, rewardDelta, 'season_rewards_claim', logger);

  // Store cosmetic rewards (titles, auras)
  if (rewards.cosmetics) {
    addPlayerCosmetic(nk, ctx.userId, rewards.cosmetics.title, rewards.cosmetics.aura);
  }

  // Season telemetry: log reward claim
  logRewardClaim(nk, {
    event_id: '',
    season_id: currentSeason.season_id,
    user_id: ctx.userId,
    timestamp: Date.now(),
    rank: playerEntry.rank,
    rank_tier: rewards.rank_tier,
    coins_awarded: rewards.coins,
    gems_awarded: rewards.gems,
    had_cosmetics: !!rewards.cosmetics,
  });

  return JSON.stringify({
    success: true,
    rewards: rewards,
    claimed: true,
  });
}

/**
 * Registers the end season RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcEndSeason(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/end_season', rpcEndSeason);
}

/**
 * Ends the current season and starts a new one.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with season transition result
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "old_season": { ... },
 *   "new_season": { ... }
 * }
 */
export function rpcEndSeason(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('End season called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.end_season, payload, 'end_season');
  if (!validation.success) {
    return createValidationErrorResponse('end_season', validation.error);
  }

  const currentSeason = getCurrentSeason();

  // Fetch all players from ending season leaderboard (paginated)
  const BATCH_SIZE = 500;
  let allRecords: LeaderboardRecord[] = [];
  let cursor = '';
  do {
    const batch = nk.leaderboardRecordList(currentSeason.season_id, [], BATCH_SIZE, cursor, 0);
    allRecords = allRecords.concat(batch);
    cursor = batch.length >= BATCH_SIZE ? String(batch[batch.length - 1]?.rank || '') : '';
  } while (cursor !== '');

  // Issue #1132: atomicity via sentinel + per-player completion marker.
  //
  // Pre-flight: if the previous run crashed mid-loop the seasons storage
  // already carries status='ending' + end_distribution. Reuse the original
  // generation token, the captured player list, and the resume index so we
  // never double-credit a player the previous run already finished. If no
  // sentinel exists we are starting a fresh run.
  let generationToken: string;
  let playerOwnerIds: string[];
  let resumeFromIndex: number;

  const existingSentinel = readSeasonEndSentinel(nk, currentSeason.season_id);

  if (existingSentinel) {
    generationToken = existingSentinel.distribution.generation_token;
    playerOwnerIds = existingSentinel.distribution.players;
    resumeFromIndex = existingSentinel.distribution.next_index;
    logger.info(
      'rpcEndSeason resuming in-flight distribution: token=%s, next_index=%d, total=%d',
      generationToken,
      resumeFromIndex,
      playerOwnerIds.length
    );
  } else {
    generationToken = generateSeasonEndToken();
    playerOwnerIds = allRecords.map((r) => r.ownerId);
    resumeFromIndex = 0;

    // Persist the sentinel BEFORE the first per-player credit so an observer
    // can always tell the run is in flight and so a retry resumes the same
    // generation token. status='ending' until every player has been credited
    // and the season has flipped to 'ended' at the very end.
    try {
      writeSeasonEndSentinel(nk, ctx, currentSeason, {
        generation_token: generationToken,
        players: playerOwnerIds,
        next_index: 0,
        started_at: Date.now(),
      });
    } catch (error) {
      logger.warn('rpcEndSeason: failed to persist opening sentinel, continuing in memory: %s', error);
    }
  }

  // Auto-distribute rewards and seed players into new season
  for (let i = resumeFromIndex; i < allRecords.length; i++) {
    const record = allRecords[i];
    const playerRank = record.rank;

    // Skip players the previous run already finished. The per-player marker
    // is the existing season_rewards_claimed storage write tagged with the
    // current generation token — a matched token means "I am already done in
    // THIS run, do not credit me again".
    const marker = readPlayerCompletionMarker(nk, currentSeason.season_id, record.ownerId);
    if (marker.completed && marker.token === generationToken) {
      continue;
    }

    const rewards = calculateRewards(playerRank, currentSeason.season_number);
    // Mark rewards as auto-distributed
    nk.storageWrite([
      {
        collection: 'season_rewards_claimed',
        key: `${currentSeason.season_id}_${record.ownerId}`,
        userId: record.ownerId,
        value: toStorageValue({
          season_id: currentSeason.season_id,
          user_id: record.ownerId,
          claimed_at: Date.now(),
          rank: playerRank,
          rewards: rewards,
          auto_distributed: true,
        }),
      },
    ]);

    try {
      // Auto-grant currency rewards via the unified currency ledger (#860)
      const rewardDelta: CurrencyDelta = {};
      if (rewards.coins) rewardDelta.coins = rewards.coins;
      if (rewards.gems) rewardDelta.gems = rewards.gems;
      applyCurrencyDelta(nk, record.ownerId, rewardDelta, 'season_end_distribution', logger);

      // Auto-grant cosmetic rewards (titles, auras)
      if (rewards.cosmetics) {
        addPlayerCosmetic(nk, record.ownerId, rewards.cosmetics.title, rewards.cosmetics.aura);
      }

      // Per-player completion marker (issue #1132). Tagging the existing
      // season_rewards_claimed write with the current generation token turns
      // it into the resume key the pre-flight check looks at above. A
      // crash between credit and this write is at-least-once: a retry
      // re-credits the same player. There is no portable way to dedupe
      // applyCurrencyDelta without touching currency.ts, which is out of
      // scope for this fix.
      nk.storageWrite([
        {
          collection: 'season_rewards_claimed',
          key: `${currentSeason.season_id}_${record.ownerId}`,
          userId: record.ownerId,
          value: JSON.stringify({
            season_id: currentSeason.season_id,
            user_id: record.ownerId,
            claimed_at: Date.now(),
            rank: playerRank,
            rewards: rewards,
            auto_distributed: true,
            generation_token: generationToken,
          }),
        },
      ]);

      // Update prestige record and grant prestige cosmetics
      const { new_tiers } = updatePlayerPrestigeRecord(
        nk,
        record.ownerId,
        currentSeason.season_id,
        playerRank
      );
      if (new_tiers.length > 0) {
        grantPrestigeRewards(nk, record.ownerId, new_tiers);
      }
    } catch (error) {
      // Mid-loop failure (issue #1132): persist the checkpoint so the next
      // call resumes from this index, then return a partial-failure
      // envelope. We intentionally do NOT swallow the error here — the
      // caller (admin tooling / matchmaker scheduler) sees the failure
      // and decides whether to retry. The sentinel's status stays at
      // 'ending' so a fresh process / RPC re-entry picks up exactly here.
      logger.error(
        'rpcEndSeason: mid-loop failure at player index %d (owner=%s): %s',
        i,
        record.ownerId,
        error
      );
      try {
        writeSeasonEndSentinel(nk, ctx, currentSeason, {
          generation_token: generationToken,
          players: playerOwnerIds,
          next_index: i,
          started_at: Date.now(),
        });
      } catch (sentinelError) {
        logger.error(
          'rpcEndSeason: failed to persist checkpoint after mid-loop failure: %s',
          sentinelError
        );
      }
      return JSON.stringify({
        success: false,
        error_code: PARTIAL_SEASON_FAILED_ERROR_CODE,
        error: error instanceof Error ? error.message : String(error),
        generation_token: generationToken,
        resumed: resumeFromIndex > 0,
        processed: i,
        total: allRecords.length,
        season_id: currentSeason.season_id,
      });
    }

    // Best-effort per-iteration checkpoint. A failure here is non-fatal:
    // the resume path still has the in-flight sentinel + the per-player
    // completion marker to fall back on, so worst case we re-process a
    // handful of finished players (at-least-once, never data loss).
    try {
      writeSeasonEndSentinel(nk, ctx, currentSeason, {
        generation_token: generationToken,
        players: playerOwnerIds,
        next_index: i + 1,
        started_at: Date.now(),
      });
    } catch (checkpointError) {
      logger.warn(
        'rpcEndSeason: failed to persist per-player checkpoint at index %d: %s',
        i,
        checkpointError
      );
    }
  }

  // Create new season
  const nextSeasonNumber = currentSeason.season_number + 1;
  const nextSeasonStartTime = Date.now();
  const nextSeasonEndTime = nextSeasonStartTime + SEASON_DURATION_MS;

  const nextSeason: SeasonInfo = {
    season_id: `season_${nextSeasonNumber}`,
    season_number: nextSeasonNumber,
    start_time: nextSeasonStartTime,
    end_time: nextSeasonEndTime,
    status: 'active',
    duration_weeks: SEASON_DURATION_WEEKS,
  };

  // Store new season info
  nk.storageWrite([
    {
      collection: 'seasons',
      key: nextSeason.season_id,
      userId: ctx.userId,
      value: toStorageValue(nextSeason),
    },
  ]);

  // Update current season status to ended. The sentinel's end_distribution
  // is cleared here so the next rpcEndSeason call (next season rollover)
  // starts a fresh generation token rather than re-using the just-completed
  // one.
  const oldSeason = currentSeason;
  oldSeason.status = SEASON_ENDED_STATUS;

  nk.storageWrite([
    {
      collection: 'seasons',
      key: oldSeason.season_id,
      userId: ctx.userId,
      value: toStorageValue(oldSeason),
    },
  ]);

  // Create new leaderboard for next season
  nk.leaderboardCreate(nextSeason.season_id, true, 'desc', 'best', '', {
    season_number: String(nextSeasonNumber),
  });

  // Seed all players into new season with soft-reset ELO
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

  // Season telemetry: capture final season snapshot
  recordSeasonEndSnapshot(nk, oldSeason.season_id, oldSeason.start_time);

  logger.info('Season ended: %s, players processed: %d', oldSeason.season_id, allRecords.length);

  return JSON.stringify({
    success: true,
    old_season: oldSeason,
    new_season: nextSeason,
    players_processed: allRecords.length,
    generation_token: generationToken,
    resumed: resumeFromIndex > 0,
  });
}

/**
 * Gets the current season information.
 *
 * @returns Current season data
 */
export function getCurrentSeason(): SeasonInfo {
  const now = Date.now();
  const seasonNumber = Math.floor(now / SEASON_DURATION_MS) + 1;
  const seasonStartTime = (seasonNumber - 1) * SEASON_DURATION_MS;
  const seasonEndTime = seasonStartTime + SEASON_DURATION_MS;

  return {
    season_id: `season_${seasonNumber}`,
    season_number: seasonNumber,
    start_time: seasonStartTime,
    end_time: seasonEndTime,
    status: 'active',
    duration_weeks: SEASON_DURATION_WEEKS,
  };
}

/**
 * Gets a player's leaderboard entry.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player to retrieve
 * @param leaderboardId - ID of the leaderboard
 * @returns Leaderboard entry or null if not found
 */
export function getLeaderboardEntry(
  nk: Runtime.Nakama,
  userId: string,
  leaderboardId: string
): LeaderboardEntry | null {
  const records = nk.leaderboardRecordList(leaderboardId, [userId], 1, '', 0);

  if (records.length === 0) {
    return null;
  }

  const record = records[0];
  return {
    owner_id: record.ownerId,
    username: record.username,
    rank: record.rank,
    score: record.score,
    meta: JSON.parse(record.metadata || '{}'),
  };
}

/**
 * Calculates season rewards based on player rank.
 *
 * @param rank - Player's final rank
 * @param seasonNumber - Current season number
 * @returns Calculated season rewards
 */
export function calculateRewards(rank: number, seasonNumber: number): SeasonRewards {
  if (rank <= 10) {
    return {
      rank_tier: 'legendary',
      coins: 8500,
      gems: 600,
      cosmetics: {
        title: `Season ${seasonNumber} Champion`,
        aura: 'legendary_aura',
      },
    };
  } else if (rank <= 50) {
    return {
      rank_tier: 'epic',
      coins: 4500,
      gems: 250,
      cosmetics: {
        title: `Season ${seasonNumber} Elite`,
        aura: 'epic_aura',
      },
    };
  } else if (rank <= 100) {
    return {
      rank_tier: 'rare',
      coins: 2200,
      gems: 125,
      cosmetics: {
        title: `Season ${seasonNumber} Veteran`,
        aura: 'rare_aura',
      },
    };
  } else if (rank <= 500) {
    return {
      rank_tier: 'uncommon',
      coins: 750,
      gems: 25,
    };
  } else {
    return {
      rank_tier: 'common',
      coins: 250,
      gems: 10,
    };
  }
}

/**
 * Records player match activity for rank decay tracking.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 */
export function recordPlayerActivity(nk: Runtime.Nakama, userId: string): void {
  const now = Date.now();
  nk.storageWrite([
    {
      collection: 'player_activity',
      key: userId,
      userId: userId,
      value: toStorageValue({ last_match_time: now }),
    },
  ]);
}

/**
 * Gets the timestamp of the player's last match.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @returns Last match timestamp or 0 if never played
 */
function getLastMatchTime(nk: Runtime.Nakama, userId: string): number {
  try {
    const records = nk.storageRead([
      {
        collection: 'player_activity',
        key: userId,
        userId: userId,
      },
    ]);

    if (records.length > 0 && records[0].value) {
      const data = JSON.parse(getStorageRawValue(records[0].value) ?? "");
      return data.last_match_time || 0;
    }
  } catch (e) {
    // Ignore errors, return 0
  }
  return 0;
}

/**
 * Calculates and applies rank decay for a player based on inactivity.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param currentScore - Player's current rank score
 * @returns New score after decay (or original if no decay applies)
 */
export function applyRankDecay(nk: Runtime.Nakama, userId: string, currentScore: number): number {
  // Don't decay players below minimum score
  if (currentScore < RANK_DECAY_MIN_SCORE) {
    return currentScore;
  }

  const lastMatchTime = getLastMatchTime(nk, userId);
  const now = Date.now();
  const inactiveMs = now - lastMatchTime;
  const inactiveDays = Math.floor(inactiveMs / (24 * 60 * 60 * 1000));

  // No decay if player has been active within the decay period
  if (inactiveDays < RANK_DECAY_DAYS) {
    return currentScore;
  }

  // Calculate decay periods
  const decayPeriods = Math.floor((inactiveDays - RANK_DECAY_DAYS) / RANK_DECAY_DAYS);
  const decayLoss = Math.min(decayPeriods * RANK_DECAY_AMOUNT, RANK_DECAY_MAX_LOSS);
  const newScore = Math.max(currentScore - decayLoss, RANK_DECAY_MIN_SCORE);

  return newScore;
}

/**
 * Gets the rank decay info for a player.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param currentScore - Player's current rank score
 * @returns Decay information including days inactive and points at risk
 */
export function getRankDecayInfo(
  nk: Runtime.Nakama,
  userId: string,
  currentScore: number
): { days_inactive: number; points_at_risk: number; can_decay: boolean } {
  const lastMatchTime = getLastMatchTime(nk, userId);
  const now = Date.now();
  const inactiveMs = now - lastMatchTime;
  const daysInactive = Math.floor(inactiveMs / (24 * 60 * 60 * 1000));

  // Calculate points at risk
  let pointsAtRisk = 0;
  if (currentScore >= RANK_DECAY_MIN_SCORE && daysInactive >= RANK_DECAY_DAYS) {
    const decayPeriods = Math.floor((daysInactive - RANK_DECAY_DAYS) / RANK_DECAY_DAYS);
    pointsAtRisk = Math.min(decayPeriods * RANK_DECAY_AMOUNT, RANK_DECAY_MAX_LOSS);
  }

  return {
    days_inactive: daysInactive,
    points_at_risk: pointsAtRisk,
    can_decay: pointsAtRisk > 0,
  };
}

/**
 * Registers the get player cosmetics RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetPlayerCosmetics(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_player_cosmetics', rpcGetPlayerCosmetics);
}

/**
 * Gets a player's claimed cosmetics (titles, auras).
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with player's cosmetics
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "cosmetics": {
 *     "titles": ["Season 5 Champion", "Season 4 Elite"],
 *     "auras": ["legendary_aura"]
 *   }
 * }
 */
export function rpcGetPlayerCosmetics(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get player cosmetics called for user: %s', ctx.userId);

  const cosmetics = getPlayerCosmetics(nk, ctx.userId);

  return JSON.stringify({
    success: true,
    cosmetics: cosmetics,
  });
}

/**
 * Registers the get prestige progress RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetPrestigeProgress(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_prestige_progress', rpcGetPrestigeProgress);
}

/**
 * Gets a player's prestige progress across seasons.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused)
 * @returns JSON string with prestige progress
 */
export function rpcGetPrestigeProgress(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get prestige progress called for user: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.get_prestige_progress,
    payload,
    'get_prestige_progress'
  );
  if (!validation.success) {
    return createValidationErrorResponse('get_prestige_progress', validation.error);
  }

  const record = getPlayerPrestigeRecord(nk, ctx.userId);
  const progress = calculatePrestigeProgress(record.season_finishes);

  return JSON.stringify({
    success: true,
    prestige: {
      tiers_earned: record.prestige_tiers_earned,
      season_finishes: record.season_finishes,
      tier_progress: progress,
    },
  });
}

/**
 * Registers the get projected next season ELO RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetProjectedNextSeasonElo(initializer: Runtime.Initializer): void {
  initializer.registerRpc(
    'armored_archer/get_projected_next_season_elo',
    rpcGetProjectedNextSeasonElo
  );
}

/**
 * Gets the player's projected starting ELO for the next season.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused)
 * @returns JSON string with projected ELO
 */
export function rpcGetProjectedNextSeasonElo(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get projected next season ELO called for user: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.get_projected_next_season_elo,
    payload,
    'get_projected_next_season_elo'
  );
  if (!validation.success) {
    return createValidationErrorResponse('get_projected_next_season_elo', validation.error);
  }

  const currentSeason = getCurrentSeason();
  const playerEntry = getLeaderboardEntry(nk, ctx.userId, currentSeason.season_id);

  if (!playerEntry) {
    return JSON.stringify({
      success: true,
      current_rank: 0,
      projected_elo: 1000,
      tier_name: 'Unranked',
    });
  }

  const projectedElo = calculateSoftResetElo(playerEntry.rank);
  const tierName =
    playerEntry.rank <= 10
      ? 'Legendary'
      : playerEntry.rank <= 50
        ? 'Epic'
        : playerEntry.rank <= 100
          ? 'Rare'
          : playerEntry.rank <= 500
            ? 'Uncommon'
            : 'Common';

  return JSON.stringify({
    success: true,
    current_rank: playerEntry.rank,
    current_rating: playerEntry.score,
    projected_elo: projectedElo,
    tier_name: tierName,
    time_remaining: Math.max(0, currentSeason.end_time - Date.now()),
  });
}
