/**
 * Season System module.
 * @fileoverview Manages seasonal rewards and rankings.
 */

import { Runtime } from '../types/nakama';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import {
  verifyRequestSignature,
  detectTimingAttack,
  recordMatchResult,
  isPlayerFlagged,
  getFlagReason,
  RequestSignature,
} from './anti_cheat';

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
 * Registers the update rank RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcUpdateRank(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/update_rank', rpcUpdateRank);
}

/**
 * Updates player ranks after a match using Elo rating system.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match results
 * @returns JSON string with rank changes
 *
 * @example
 * // Request payload
 * { "winner_id": "user_1", "loser_id": "user_2", "is_punch_up": false }
 *
 * // Response
 * {
 *   "success": true,
 *   "winner": { ... },
 *   "loser": { ... },
 *   "is_punch_up": false
 * }
 */
export function rpcUpdateRank(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Update rank called for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.update_rank, payload, 'update_rank');
  if (!validation.success) {
    return createValidationErrorResponse('update_rank', validation.error);
  }

  const request = validation.data;

  // Anti-cheat: Check if players are flagged
  if (isPlayerFlagged(request.winner_id)) {
    logger.warn(
      'Update rank blocked - winner flagged: %s reason: %s',
      request.winner_id,
      getFlagReason(request.winner_id)
    );
    return JSON.stringify({
      success: false,
      error_code: 'PLAYER_FLAGGED',
      error: 'Player is flagged for review: ' + getFlagReason(request.winner_id),
    });
  }

  if (isPlayerFlagged(request.loser_id)) {
    logger.warn(
      'Update rank blocked - loser flagged: %s reason: %s',
      request.loser_id,
      getFlagReason(request.loser_id)
    );
    return JSON.stringify({
      success: false,
      error_code: 'PLAYER_FLAGGED',
      error: 'Opponent is flagged for review: ' + getFlagReason(request.loser_id),
    });
  }

  // Anti-cheat: Verify request signature if all anti-cheat fields provided
  if (request.requestId && request.timestamp && request.signature && request.nonce) {
    const signatureData: RequestSignature = {
      requestId: request.requestId,
      timestamp: request.timestamp,
      signature: request.signature,
      nonce: request.nonce,
    };

    // Create payload for signature verification (without anti-cheat fields)
    const payloadForSig = JSON.stringify({
      match_id: request.match_id,
      winner_id: request.winner_id,
      loser_id: request.loser_id,
      winner_old_rank: request.winner_old_rank,
      loser_old_rank: request.loser_old_rank,
      winner_new_rank: request.winner_new_rank,
      loser_new_rank: request.loser_new_rank,
      is_punch_up: request.is_punch_up,
    });

    const sigResult = verifyRequestSignature(ctx, payloadForSig, signatureData, 'update_rank');
    if (!sigResult.valid) {
      logger.warn('Invalid signature for update_rank: %s', sigResult.violations.join(', '));
      return JSON.stringify({
        success: false,
        error_code: 'ANTI_CHEAT_VIOLATION',
        error: 'Invalid request signature',
        violations: sigResult.violations,
      });
    }
  }

  // Anti-cheat: Detect timing attacks
  if (detectTimingAttack(ctx.userId, 'update_rank', request.requestId || '')) {
    logger.warn('Timing attack detected for user: %s', ctx.userId);
    return JSON.stringify({
      success: false,
      error_code: 'TIMING_ANOMALY',
      error: 'Suspicious request pattern detected',
    });
  }

  const currentSeason = getCurrentSeason();

  const winnerEntry = getLeaderboardEntry(nk, request.winner_id, currentSeason.season_id);
  const loserEntry = getLeaderboardEntry(nk, request.loser_id, currentSeason.season_id);

  const winnerOldElo = winnerEntry ? winnerEntry.score : 1000;
  const loserOldElo = loserEntry ? loserEntry.score : 1000;

  const K = request.is_punch_up ? 60 : 32; // Punch Up has higher K-factor
  const expectedWinner = 1 / (1 + Math.pow(10, (loserOldElo - winnerOldElo) / 400));
  const expectedLoser = 1 - expectedWinner;

  const winnerNewElo = Math.round(winnerOldElo + K * (1 - expectedWinner));
  const loserNewElo = Math.round(loserOldElo + K * (0 - expectedLoser));

  // Update winner
  const winnerMeta = winnerEntry
    ? winnerEntry.meta
    : { wins: 0, losses: 0, win_rate: 0, punch_up_wins: 0 };
  winnerMeta.wins++;
  winnerMeta.punch_up_wins += request.is_punch_up ? 1 : 0;
  winnerMeta.win_rate = winnerMeta.wins / (winnerMeta.wins + winnerMeta.losses);

  nk.leaderboardRecordWrite(
    currentSeason.season_id,
    request.winner_id,
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

  nk.leaderboardRecordWrite(
    currentSeason.season_id,
    request.loser_id,
    'Opponent', // Will be updated with actual username
    loserNewElo,
    0,
    {
      wins: String(loserMeta.wins),
      losses: String(loserMeta.losses),
      win_rate: String(loserMeta.win_rate),
      punch_up_wins: String(loserMeta.punch_up_wins),
    }
  );

  // Anti-cheat: Record match result for analysis
  // Winner record: win, Loser record: loss
  recordMatchResult(
    request.winner_id,
    request.match_id,
    request.loser_id,
    'win',
    true,
    winnerOldElo,
    winnerNewElo
  );
  recordMatchResult(
    request.loser_id,
    request.match_id,
    request.winner_id,
    'loss',
    true,
    loserOldElo,
    loserNewElo
  );

  return JSON.stringify({
    success: true,
    winner: {
      user_id: request.winner_id,
      old_rank: winnerOldElo,
      new_rank: winnerNewElo,
      rank_change: winnerNewElo - winnerOldElo,
    },
    loser: {
      user_id: request.loser_id,
      old_rank: loserOldElo,
      new_rank: loserNewElo,
      rank_change: loserNewElo - loserOldElo,
    },
    is_punch_up: request.is_punch_up,
  });
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

  const objects = nk.storageRead([
    {
      collection: 'season_rewards_claimed',
      key: `${currentSeason.season_id}_${ctx.userId}`,
      userId: ctx.userId,
    },
  ]);

  if (objects.length > 0) {
    return JSON.stringify({
      error: 'Rewards already claimed for this season',
    });
  }

  const playerEntry = getLeaderboardEntry(nk, ctx.userId, currentSeason.season_id);

  if (!playerEntry) {
    return JSON.stringify({
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
      value: JSON.stringify({
        season_id: currentSeason.season_id,
        user_id: ctx.userId,
        claimed_at: Date.now(),
        rank: playerEntry.rank,
        rewards: rewards,
      }),
    },
  ]);

  // Give rewards (coins, cosmetics)
  const rewardChanges: { [key: string]: number } = {};

  if (rewards.coins) {
    rewardChanges['coins'] = rewards.coins;
  }

  if (rewards.gems) {
    rewardChanges['gems'] = rewards.gems;
  }

  if (Object.keys(rewardChanges).length > 0) {
    nk.walletUpdate(ctx.userId, rewardChanges);
  }

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
      value: JSON.stringify(nextSeason),
    },
  ]);

  // Update current season status
  const oldSeason = currentSeason;
  oldSeason.status = 'ended';

  nk.storageWrite([
    {
      collection: 'seasons',
      key: oldSeason.season_id,
      userId: ctx.userId,
      value: JSON.stringify(oldSeason),
    },
  ]);

  // Create new leaderboard for next season
  nk.leaderboardCreate(nextSeason.season_id, true, 'desc', 'best', '', {
    season_number: String(nextSeasonNumber),
  });

  return JSON.stringify({
    success: true,
    old_season: oldSeason,
    new_season: nextSeason,
  });
}

/**
 * Gets the current season information.
 *
 * @returns Current season data
 */
function getCurrentSeason(): SeasonInfo {
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
function getLeaderboardEntry(
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
      coins: 10000,
      gems: 500,
      cosmetics: {
        title: `Season ${seasonNumber} Champion`,
        aura: 'legendary_aura',
      },
    };
  } else if (rank <= 50) {
    return {
      rank_tier: 'epic',
      coins: 5000,
      gems: 200,
      cosmetics: {
        title: `Season ${seasonNumber} Elite`,
        aura: 'epic_aura',
      },
    };
  } else if (rank <= 100) {
    return {
      rank_tier: 'rare',
      coins: 2000,
      gems: 100,
      cosmetics: {
        title: `Season ${seasonNumber} Veteran`,
        aura: 'rare_aura',
      },
    };
  } else if (rank <= 500) {
    return {
      rank_tier: 'uncommon',
      coins: 500,
      gems: 0,
    };
  } else {
    return {
      rank_tier: 'common',
      coins: 100,
      gems: 0,
    };
  }
}

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

export interface SeasonInfo {
  season_id: string;
  season_number: number;
  start_time: number;
  end_time: number;
  status: string; // "active", "ended"
  duration_weeks: number;
}

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

export interface RankChange {
  winner_id: string;
  loser_id: string;
  winner_old_rank: number;
  loser_old_rank: number;
  winner_new_rank: number;
  loser_new_rank: number;
  is_punch_up: boolean;
}
