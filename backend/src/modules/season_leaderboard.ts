/**
 * Season Leaderboard module.
 * @fileoverview Manages seasonal rankings with rating decay and historical records.
 */

import { PlayerStats } from '../types/game';
import { Runtime } from '../types/nakama';
import { readAndParseStorage, toStorageValue, getStorageRawValue } from '../utils/storage-helpers';
import { calculateRank } from './rank';
import { SeasonInfo } from './season_system';
import { validatePayload, createValidationErrorResponse, ZodSchemas } from './validation';

// --- Types ---

/**
 * Season ranking entry with decay information
 */
export interface SeasonRanking {
  season_id: string;
  player_id: string;
  rating: number;
  mode: '1v1' | '2v2';
  matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  punch_up_wins: number;
  last_active: number;
  decayed_rating: number;
  days_inactive: number;
  rank: number;
}

/**
 * Season archive entry for historical seasons
 */
export interface SeasonArchive {
  season_id: string;
  season_number: number;
  start_time: number;
  end_time: number;
  winner_id: string;
  winner_name: string;
  winner_rating: number;
  total_players: number;
  rewards_distributed: boolean;
}

/**
 * Rating decay configuration
 */
export interface RatingDecayConfig {
  inactive_days_threshold: number;
  decay_rate_percent: number;
  high_decay_threshold_days: number;
  high_decay_rate_percent: number;
  minimum_rating: number;
  max_decay_loss: number;
}

// --- Constants ---

const DEFAULT_DECAY_CONFIG: RatingDecayConfig = {
  inactive_days_threshold: 7, // 1% decay starts after 7 days
  decay_rate_percent: 1, // 1% per decay period
  high_decay_threshold_days: 30, // 2% decay after 30 days
  high_decay_rate_percent: 2, // 2% per decay period
  minimum_rating: 1000, // Rating floor
  max_decay_loss: 200, // Maximum points that can be lost per decay check
};

const SEASON_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Storage keys
const STORAGE_KEY_DECAY_CONFIG = 'rating_decay_config';
const STORAGE_KEY_SEASON_ARCHIVE = 'season_archive';
const STORAGE_KEY_PLAYER_LAST_ACTIVE = 'player_last_active';

/**
 * Apply rating decay to inactive players
 *
 * @param nk - Nakama server interface
 * @param seasonId - Season ID to apply decay for
 * @returns Number of players affected
 */
export async function applyDailyDecay(
  nk: Runtime.Nakama,
  seasonId: string,
  logger?: Runtime.Logger
): Promise<{ affected: number; total_loss: number }> {
  const decayConfig = getDecayConfig(nk);
  const leaderboardRecords = nk.leaderboardRecordList(seasonId, [], 1000, '', 0);

  // Batch last-active lookups for every record up-front so the decay sweep
  // costs ONE storageRead regardless of leaderboard size (issue #1089).
  const lastActiveMap = await getPlayersLastActiveBatch(
    nk,
    leaderboardRecords.map((r) => r.ownerId)
  );

  let affectedCount = 0;
  let totalLoss = 0;

  for (const record of leaderboardRecords) {
    const lastActiveData = lastActiveMap.get(record.ownerId) ?? 0;
    const daysInactive = getDaysInactive(lastActiveData);

    if (daysInactive < decayConfig.inactive_days_threshold) {
      continue;
    }

    const decayAmount = calculateDecayAmount(record.score, daysInactive, decayConfig);

    if (decayAmount > 0) {
      const newRating = Math.max(record.score - decayAmount, decayConfig.minimum_rating);
      const actualLoss = record.score - newRating;

      // Update leaderboard with decayed rating
      const metadata = record.metadata ? JSON.parse(record.metadata) : {};
      nk.leaderboardRecordWrite(seasonId, record.ownerId, record.username, newRating, 0, {
        ...metadata,
        original_rating: String(record.score),
        decayed: 'true',
        days_inactive: String(daysInactive),
        decay_amount: String(actualLoss),
      });

      affectedCount++;
      totalLoss += actualLoss;

      logger?.info('Rating decay applied', {
        player_id: record.ownerId,
        original_rating: record.score,
        new_rating: newRating,
        decay_amount: actualLoss,
        days_inactive: daysInactive,
      });
    }
  }

  return { affected: affectedCount, total_loss: totalLoss };
}

/**
 * Get top players leaderboard for a season
 *
 * @param nk - Nakama server interface
 * @param seasonId - Season ID
 * @param mode - PvP mode filter (optional)
 * @param limit - Maximum number of entries
 * @returns Array of season rankings
 */
export async function getTopPlayers(
  nk: Runtime.Nakama,
  seasonId: string,
  mode: '1v1' | '2v2' | null = null,
  limit: number = 100
): Promise<SeasonRanking[]> {
  const records = nk.leaderboardRecordList(seasonId, [], limit, '', 0);
  const decayConfig = getDecayConfig(nk);

  // Batch last-active lookups for every record up-front; one storageRead
  // for the page instead of one per row (issue #1089).
  const lastActiveMap = await getPlayersLastActiveBatch(
    nk,
    records.map((r) => r.ownerId)
  );

  const rankings: SeasonRanking[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const metadata = record.metadata ? JSON.parse(record.metadata) : {};

    const lastActiveData = lastActiveMap.get(record.ownerId) ?? 0;
    const daysInactive = getDaysInactive(lastActiveData);

    const decayAmount = calculateDecayAmount(record.score, daysInactive, decayConfig);
    const decayedRating = Math.max(record.score - decayAmount, decayConfig.minimum_rating);

    // Filter by mode if specified
    if (mode && metadata.mode !== mode) {
      continue;
    }

    rankings.push({
      season_id: seasonId,
      player_id: record.ownerId,
      rating: record.score,
      mode: metadata.mode || '1v1',
      matches: parseInt(metadata.matches || '0', 10),
      wins: parseInt(metadata.wins || '0', 10),
      losses: parseInt(metadata.losses || '0', 10),
      win_rate: parseFloat(metadata.win_rate || '0'),
      punch_up_wins: parseInt(metadata.punch_up_wins || '0', 10),
      last_active: lastActiveData,
      decayed_rating: decayedRating,
      days_inactive: daysInactive,
      rank: record.rank,
    });
  }

  // Sort by decayed rating for display
  rankings.sort((a, b) => b.decayed_rating - a.decayed_rating);

  // Update ranks after sorting
  for (let i = 0; i < rankings.length; i++) {
    rankings[i].rank = i + 1;
  }

  return rankings;
}

/**
 * Get player's rank in a season
 *
 * @param nk - Nakama server interface
 * @param seasonId - Season ID
 * @param playerId - Player ID
 * @returns Player's rank or null if not found
 */
export async function getPlayerRank(
  nk: Runtime.Nakama,
  seasonId: string,
  playerId: string
): Promise<{ rank: number; entry: SeasonRanking } | null> {
  const records = nk.leaderboardRecordList(seasonId, [playerId], 1, '', 0);

  if (records.length === 0) {
    return null;
  }

  const record = records[0];
  const metadata = record.metadata ? JSON.parse(record.metadata) : {};
  const decayConfig = getDecayConfig(nk);

  // Need to recalculate rank based on decayed ratings
  const allRecords = nk.leaderboardRecordList(seasonId, [], 1000, '', 0);

  // Collect every ownerId we need a last-active timestamp for (target + the
  // other players we'll compare against) and batch the lookup — one
  // storageRead instead of one per record (issue #1089).
  const lastActiveMap = await getPlayersLastActiveBatch(
    nk,
    collectOwnerIdsForRank(record.ownerId, playerId, allRecords)
  );

  const lastActiveData = lastActiveMap.get(record.ownerId) ?? 0;
  const daysInactive = getDaysInactive(lastActiveData);

  const decayAmount = calculateDecayAmount(record.score, daysInactive, decayConfig);
  const decayedRating = Math.max(record.score - decayAmount, decayConfig.minimum_rating);

  const ranking: SeasonRanking = {
    season_id: seasonId,
    player_id: record.ownerId,
    rating: record.score,
    mode: metadata.mode || '1v1',
    matches: parseInt(metadata.matches || '0', 10),
    wins: parseInt(metadata.wins || '0', 10),
    losses: parseInt(metadata.losses || '0', 10),
    win_rate: parseFloat(metadata.win_rate || '0'),
    punch_up_wins: parseInt(metadata.punch_up_wins || '0', 10),
    last_active: lastActiveData,
    decayed_rating: decayedRating,
    days_inactive: daysInactive,
    rank: record.rank,
  };

  let playersAbove = 0;

  for (const otherRecord of allRecords) {
    if (otherRecord.ownerId === playerId) {
      continue;
    }

    const otherLastActive = lastActiveMap.get(otherRecord.ownerId) ?? 0;
    const otherDaysInactive = getDaysInactive(otherLastActive);
    const otherDecayAmount = calculateDecayAmount(
      otherRecord.score,
      otherDaysInactive,
      decayConfig
    );
    const otherDecayedRating = Math.max(
      otherRecord.score - otherDecayAmount,
      decayConfig.minimum_rating
    );

    if (otherDecayedRating > decayedRating) {
      playersAbove++;
    }
  }

  ranking.rank = playersAbove + 1;

  return { rank: ranking.rank, entry: ranking };
}

/**
 * Record season completion and archive data
 *
 * @param nk - Nakama server interface
 * @param seasonId - Season ID to complete
 * @returns Season archive entry
 */
export async function recordSeasonCompletion(
  nk: Runtime.Nakama,
  seasonId: string,
  logger?: Runtime.Logger
): Promise<SeasonArchive> {
  // Get current season info
  const currentSeason = getCurrentSeasonInfo(nk);

  // Get top player (season winner)
  const topPlayers = await getTopPlayers(nk, seasonId, null, 1);
  const winner = topPlayers.length > 0 ? topPlayers[0] : null;

  // Get total players in season
  const leaderboardRecords = nk.leaderboardRecordList(seasonId, [], 10000, '', 0);

  const archive: SeasonArchive = {
    season_id: seasonId,
    season_number: parseInt(seasonId.replace('season_', ''), 10),
    start_time: currentSeason.start_time,
    end_time: currentSeason.end_time,
    winner_id: winner?.player_id || '',
    winner_name: winner ? await getPlayerUsername(nk, winner.player_id) : '',
    winner_rating: winner?.rating || 0,
    total_players: leaderboardRecords.length,
    rewards_distributed: false,
  };

  // Archive season data using system user
  const archiveData = await getSeasonArchive(nk);
  archiveData[seasonId] = archive;

  nk.storageWrite([
    {
      collection: STORAGE_KEY_SEASON_ARCHIVE,
      key: STORAGE_KEY_SEASON_ARCHIVE,
      userId: '00000000-0000-0000-0000-000000000000',
      value: toStorageValue(archiveData),
    },
  ]);

  logger?.info('Season archived', {
    season_id: seasonId,
    season_number: archive.season_number,
    winner_id: archive.winner_id,
    total_players: archive.total_players,
  });

  return archive;
}

/**
 * Get season history (archived seasons)
 *
 * @param nk - Nakama server interface
 * @param limit - Maximum seasons to return
 * @returns Array of season archives
 */
export async function getSeasonHistory(
  nk: Runtime.Nakama,
  limit: number = 10
): Promise<SeasonArchive[]> {
  const archiveData = await getSeasonArchive(nk);
  const seasons = Object.values(archiveData);

  // Sort by season number descending
  seasons.sort((a, b) => b.season_number - a.season_number);

  return seasons.slice(0, limit);
}

/**
 * Calculate rating decay amount
 *
 * @param currentRating - Player's current rating
 * @param daysInactive - Number of days inactive
 * @param config - Decay configuration
 * @returns Rating points to lose
 */
export function calculateDecayAmount(
  currentRating: number,
  daysInactive: number,
  config: RatingDecayConfig = DEFAULT_DECAY_CONFIG
): number {
  // No decay if below minimum or active
  if (currentRating <= config.minimum_rating) {
    return 0;
  }

  if (daysInactive < config.inactive_days_threshold) {
    return 0;
  }

  // Determine decay rate based on inactivity level
  let decayRate: number;
  if (daysInactive >= config.high_decay_threshold_days) {
    decayRate = config.high_decay_rate_percent;
  } else {
    decayRate = config.decay_rate_percent;
  }

  // Calculate decay periods
  const inactiveDays = daysInactive - config.inactive_days_threshold;
  const decayPeriods = Math.floor(inactiveDays / config.inactive_days_threshold);

  // Calculate loss
  let decayLoss = currentRating * (decayRate / 100) * decayPeriods;

  // Cap at maximum loss
  decayLoss = Math.min(decayLoss, config.max_decay_loss);

  return Math.round(decayLoss);
}

/**
 * Get days inactive for a player
 *
 * @param lastActiveTimestamp - Last activity timestamp (ms)
 * @returns Days inactive
 */
export function getDaysInactive(lastActiveTimestamp: number): number {
  const now = Date.now();
  const inactiveMs = now - lastActiveTimestamp;
  return Math.floor(inactiveMs / (24 * 60 * 60 * 1000));
}

/**
 * Get current season info
 *
 * @param nk - Nakama server interface
 * @returns Current season info
 */
export function getCurrentSeasonInfo(_nk: Runtime.Nakama): SeasonInfo {
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
    duration_weeks: 4,
  };
}

/**
 * Get rating decay configuration
 *
 * @param nk - Nakama server interface
 * @returns Decay configuration
 */
export function getDecayConfig(nk: Runtime.Nakama): RatingDecayConfig {
  try {
    const storage = nk.storageRead([
      {
        collection: STORAGE_KEY_DECAY_CONFIG,
        key: STORAGE_KEY_DECAY_CONFIG,
        userId: '00000000-0000-0000-0000-000000000000',
      },
    ]);
    if (storage.length > 0 && storage[0].value) {
      return JSON.parse(getStorageRawValue(storage[0].value) ?? '');
    }
  } catch {
    // Silently return defaults if storage read fails
  }

  return DEFAULT_DECAY_CONFIG;
}

/**
 * Set rating decay configuration
 *
 * @param nk - Nakama server interface
 * @param config - New decay configuration
 */
export function setDecayConfig(
  nk: Runtime.Nakama,
  config: RatingDecayConfig,
  logger?: Runtime.Logger
): void {
  nk.storageWrite([
    {
      collection: STORAGE_KEY_DECAY_CONFIG,
      key: STORAGE_KEY_DECAY_CONFIG,
      userId: '00000000-0000-0000-0000-000000000000',
      value: toStorageValue(config),
    },
  ]);

  logger?.info('Rating decay config updated', config);
}

/**
 * Build the list of ownerIds whose `player_last_active` timestamp is needed
 * to compute a player's rank via decayed-rating comparison.
 *
 * Always includes the target player plus every other competitor (deduped,
 * preserving first-seen order). Extracted from `getPlayerRank` so the rank
 * function stays under the complexity ceiling after the issue #1089 batch
 * refactor turned the per-record lookup into a single batched call.
 *
 * @param targetOwnerId - The player whose rank we're computing
 * @param targetPlayerId - The same player identified by `playerId` (used to exclude self-comparisons)
 * @param allRecords - Every leaderboard record (including the target's)
 * @returns Ordered, deduplicated owner IDs to pass to `getPlayersLastActiveBatch`
 */
function collectOwnerIdsForRank(
  targetOwnerId: string,
  targetPlayerId: string,
  allRecords: { ownerId: string }[]
): string[] {
  const lastActiveIds: string[] = [targetOwnerId];
  const seen = new Set<string>([targetOwnerId]);
  for (const other of allRecords) {
    if (other.ownerId !== targetPlayerId && !seen.has(other.ownerId)) {
      seen.add(other.ownerId);
      lastActiveIds.push(other.ownerId);
    }
  }
  return lastActiveIds;
}

/**
 * Get player's last activity timestamp
 *
 * @param nk - Nakama server interface
 * @param playerId - Player ID
 * @returns Last activity timestamp (ms)
 */
export async function getPlayerLastActive(nk: Runtime.Nakama, playerId: string): Promise<number> {
  try {
    const storage = nk.storageRead([
      {
        collection: STORAGE_KEY_PLAYER_LAST_ACTIVE,
        key: playerId,
        userId: playerId,
      },
    ]);

    if (storage.length > 0 && storage[0].value) {
      const data = JSON.parse(getStorageRawValue(storage[0].value) ?? '') as Record<
        string,
        unknown
      >;
      return (data.last_active as number) || (data.last_match_time as number) || 0;
    }
  } catch {
    // Silently return 0 if storage read fails
  }

  return 0;
}

/**
 * Batch-read last-activity timestamps for many players in a single
 * `nk.storageRead` call.
 *
 * Replaces the per-player `getPlayerLastActive` fan-out that the leaderboard
 * page, daily decay sweep, and per-player rank lookup were previously doing
 * (issue #1089). With this helper, rendering a 100-row leaderboard costs one
 * round-trip to the `player_last_active` collection instead of 100.
 *
 * The returned map always contains every requested ID (missing entries and
 * parse failures default to `0`), so callers can read without null checks.
 *
 * @param nk - Nakama server interface
 * @param playerIds - Player IDs to fetch (duplicates are collapsed; order is preserved)
 * @returns Map of player ID -> last-active timestamp in ms (0 if unknown)
 */
export async function getPlayersLastActiveBatch(
  nk: Runtime.Nakama,
  playerIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (playerIds.length === 0) {
    return result;
  }

  // Dedupe while preserving first-seen order so callers that index by
  // position still get a stable, predictable shape.
  const uniqueIds: string[] = [];
  const seen = new Set<string>();
  for (const id of playerIds) {
    if (!seen.has(id)) {
      seen.add(id);
      uniqueIds.push(id);
    }
  }

  try {
    const storage = nk.storageRead(
      uniqueIds.map((id) => ({
        collection: STORAGE_KEY_PLAYER_LAST_ACTIVE,
        key: id,
        userId: id,
      }))
    );

    for (const entry of storage) {
      if (!entry.value) {
        result.set(entry.key, 0);
        continue;
      }
      let ts = 0;
      try {
        const data =
          typeof entry.value === 'string'
            ? (JSON.parse(entry.value) as Record<string, unknown>)
            : (entry.value as Record<string, unknown>);
        const lastActive = data.last_active;
        const lastMatchTime = data.last_match_time;
        if (typeof lastActive === 'number') {
          ts = lastActive;
        } else if (typeof lastMatchTime === 'number') {
          ts = lastMatchTime;
        }
      } catch {
        // Leave ts at 0 for malformed entries.
      }
      result.set(entry.key, ts);
    }
  } catch {
    // Silently fall through; missing/unparseable entries default to 0.
  }

  // Guarantee every requested id has a key in the map so callers can index
  // without branching on presence.
  for (const id of uniqueIds) {
    if (!result.has(id)) {
      result.set(id, 0);
    }
  }

  return result;
}

/**
 * Update player's last activity timestamp
 *
 * @param nk - Nakama server interface
 * @param playerId - Player ID
 */
export function updatePlayerLastActive(nk: Runtime.Nakama, playerId: string): void {
  nk.storageWrite([
    {
      collection: STORAGE_KEY_PLAYER_LAST_ACTIVE,
      key: playerId,
      userId: playerId,
      value: toStorageValue({ last_active: Date.now() }),
    },
  ]);
}

/**
 * Get season archive data
 *
 * @param nk - Nakama server interface
 * @returns Archive data object
 */
export async function getSeasonArchive(nk: Runtime.Nakama): Promise<Record<string, SeasonArchive>> {
  try {
    const storage = nk.storageRead([
      {
        collection: STORAGE_KEY_SEASON_ARCHIVE,
        key: STORAGE_KEY_SEASON_ARCHIVE,
        userId: '00000000-0000-0000-0000-000000000000',
      },
    ]);
    if (storage.length > 0 && storage[0].value) {
      return JSON.parse(getStorageRawValue(storage[0].value) ?? '');
    }
  } catch {
    // Silently return empty object if storage read fails
  }

  return {};
}

/**
 * Get player username from storage or default
 *
 * @param nk - Nakama server interface
 * @param playerId - Player ID
 * @returns Player username
 */
async function getPlayerUsername(nk: Runtime.Nakama, playerId: string): Promise<string> {
  try {
    // Try to get username from storage (store it when player activity is recorded)
    const storage = nk.storageRead([
      {
        collection: 'user_metadata',
        key: playerId,
        userId: playerId,
      },
    ]);

    if (storage.length > 0 && storage[0].value) {
      const data = JSON.parse(getStorageRawValue(storage[0].value) ?? '') as Record<
        string,
        unknown
      >;
      return (data.username as string) || (data.display_name as string) || 'Unknown';
    }
  } catch {
    // Return default if storage read fails
  }

  return 'Unknown';
}

// --- RPC Registration Functions ---

/**
 * Registers the get season history RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetSeasonHistory(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_season_history', rpcGetSeasonHistory);
}

/**
 * Registers the get player rank RPC endpoint.
 *
 * This is the SOLE registration for the `armored_archer/get_player_rank`
 * RPC ID (issue #871). Historically matchmaker.ts also registered a
 * handler under the same ID with a different response shape
 * (`{rank, level, xp}` = derived Power Rating); because Nakama's JS
 * runtime resolves duplicate registerRpc calls last-wins and index.ts
 * registered this module second, the season shape was already the live
 * contract. The duplicate registration was removed and this handler now
 * returns a documented superset: explicit `power_rating` / `ladder_rating`
 * / `standing` fields plus the legacy `rank` / `rating` aliases.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetPlayerRank(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_player_rank', rpcGetPlayerRank);
}

// --- RPC Handlers ---

/**
 * RPC handler for getting season history.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing limit parameter
 * @returns JSON string with season history
 *
 * @example
 * // Request payload
 * { "limit": 10 }
 *
 * // Response
 * {
 *   "success": true,
 *   "history": [ ... ],
 *   "total": 5
 * }
 */
export async function rpcGetSeasonHistory(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Get season history called for user: %s', ctx.userId);

  // Validate payload
  const validation = validatePayload(ZodSchemas.get_season_history, payload, 'get_season_history');
  if (!validation.success) {
    return createValidationErrorResponse('get_season_history', validation.error);
  }

  try {
    const parsed = validation.data || { limit: 10 };
    const limit = parsed.limit || 10;

    const history = await getSeasonHistory(nk, limit);

    return JSON.stringify({
      success: true,
      history: history,
      total: history.length,
    });
  } catch (error) {
    logger.error('Error in get_season_history: %s', error);
    return JSON.stringify({
      success: false,
      error: 'Failed to retrieve season history',
    });
  }
}

/**
 * RPC handler for the consolidated player rank snapshot (issue #871).
 *
 * Resolves the "rank" triple-collision using the CONTEXT.md vocabulary:
 * - `power_rating`: build strength (level*10 + stat average), derived
 *   from player_stats via calculateRank — what matchmaking and punch-up
 *   eligibility key on.
 * - `ladder_rating`: the Elo score (seeded 1000) wagered in ranked
 *   duels. `decayed_rating` is the inactivity-adjusted value used for
 *   ladder reads.
 * - `standing`: the player's leaderboard position in the current season.
 *
 * Backward compatibility: the legacy `rank` and `rating` fields are kept
 * as deprecated aliases with the meanings they had in the live
 * (season_leaderboard) shape — `rank` = standing, `rating` = ladder
 * rating. The old matchmaker-only fields `level`/`xp` are also included
 * so the response is a superset of both historical shapes.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (can be empty object)
 * @returns JSON string with player rank info
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "power_rating": 87,
 *   "level": 5,
 *   "xp": 450,
 *   "ladder_rating": 1450,
 *   "decayed_rating": 1425,
 *   "standing": 15,
 *   "days_inactive": 3,
 *   "time_remaining": 1234567,
 *   "wins": 10,
 *   "losses": 2,
 *   "win_rate": 0.83,
 *   "rank": 15,        // deprecated alias of standing
 *   "rating": 1450     // deprecated alias of ladder_rating
 * }
 */
export async function rpcGetPlayerRank(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Get player rank called for user: %s', ctx.userId);

  // Validate payload (using schema from validation module)
  // Note: This uses get_player_season_rank schema to avoid conflict with matchmaker's get_player_rank
  const validation = validatePayload(
    ZodSchemas.get_player_season_rank,
    payload,
    'get_player_season_rank'
  );
  if (!validation.success) {
    return createValidationErrorResponse('get_player_season_rank', validation.error);
  }

  try {
    // Power Rating is a pure derivation from stored stats and exists even
    // when the player has no season entry yet (former matchmaker shape).
    let powerRating = 0;
    let level = 0;
    let xp = 0;
    const statsResult = readAndParseStorage<PlayerStats>(
      nk,
      'player_stats',
      ctx.userId,
      ctx.userId,
      logger,
      'rpcGetPlayerRank'
    );
    if (statsResult.error) {
      logger.warn('No player_stats for user %s; power_rating defaults to 0', ctx.userId);
    } else {
      const playerStats = statsResult.data!;
      powerRating = calculateRank(playerStats);
      level = playerStats.level;
      xp = playerStats.xp;
    }

    const currentSeason = getCurrentSeasonInfo(nk);
    const rankResult = await getPlayerRank(nk, currentSeason.season_id, ctx.userId);

    if (!rankResult) {
      return JSON.stringify({
        success: true,
        power_rating: powerRating,
        level,
        xp,
        ladder_rating: 0,
        decayed_rating: 0,
        standing: 0,
        days_inactive: 0,
        time_remaining: Math.max(0, currentSeason.end_time - Date.now()),
        // Deprecated legacy aliases (live season shape since #865)
        rank: 0,
        rating: 0,
      });
    }

    return JSON.stringify({
      success: true,
      power_rating: powerRating,
      level,
      xp,
      ladder_rating: rankResult.entry.rating,
      decayed_rating: rankResult.entry.decayed_rating,
      standing: rankResult.rank,
      days_inactive: rankResult.entry.days_inactive,
      time_remaining: Math.max(0, currentSeason.end_time - Date.now()),
      wins: rankResult.entry.wins,
      losses: rankResult.entry.losses,
      win_rate: rankResult.entry.win_rate,
      // Deprecated legacy aliases (live season shape since #865)
      rank: rankResult.rank,
      rating: rankResult.entry.rating,
    });
  } catch (error) {
    logger.error('Error in get_player_rank: %s', error);
    return JSON.stringify({
      success: false,
      error: 'Failed to retrieve player rank',
    });
  }
}
