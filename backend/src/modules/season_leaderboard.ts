/**
 * Season Leaderboard module.
 * @fileoverview Manages seasonal rankings with rating decay and historical records.
 */

import { Runtime } from '../types/nakama';
import { SeasonInfo, LeaderboardEntry, SeasonRewards } from './season_system';

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
  seasonId: string
): Promise<{ affected: number; total_loss: number }> {
  const currentSeason = getCurrentSeasonInfo(nk);
  const decayConfig = getDecayConfig(nk);
  const leaderboardRecords = nk.leaderboardRecordList(seasonId, [], 1000, '', 0);

  let affectedCount = 0;
  let totalLoss = 0;

  for (const record of leaderboardRecords) {
    const lastActiveData = await getPlayerLastActive(nk, record.ownerId);
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

      nk.logger.info('Rating decay applied', {
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

  const rankings: SeasonRanking[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const metadata = record.metadata ? JSON.parse(record.metadata) : {};

    const lastActiveData = await getPlayerLastActive(nk, record.ownerId);
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

  const lastActiveData = await getPlayerLastActive(nk, record.ownerId);
  const daysInactive = getDaysInactive(lastActiveData);
  const decayConfig = getDecayConfig(nk);

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

  // Need to recalculate rank based on decayed ratings
  const allRecords = nk.leaderboardRecordList(seasonId, [], 1000, '', 0);
  let playersAbove = 0;

  for (const otherRecord of allRecords) {
    if (otherRecord.ownerId === playerId) {
      continue;
    }

    const otherMetadata = otherRecord.metadata ? JSON.parse(otherRecord.metadata) : {};
    const otherLastActive = await getPlayerLastActive(nk, otherRecord.ownerId);
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
  seasonId: string
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
    winner_name: winner ? getPlayerUsername(nk, winner.player_id) : '',
    winner_rating: winner?.rating || 0,
    total_players: leaderboardRecords.length,
    rewards_distributed: false,
  };

  // Archive season data
  const archiveData = await getSeasonArchive(nk);
  archiveData[seasonId] = archive;

  nk.storageWrite({
    [STORAGE_KEY_SEASON_ARCHIVE]: JSON.stringify(archiveData),
  });

  nk.logger.info('Season archived', {
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
export function getCurrentSeasonInfo(nk: Runtime.Nakama): SeasonInfo {
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
    const storage = nk.storageRead([STORAGE_KEY_DECAY_CONFIG]);
    if (storage[STORAGE_KEY_DECAY_CONFIG]) {
      return JSON.parse(storage[STORAGE_KEY_DECAY_CONFIG] as string);
    }
  } catch (e) {
    nk.logger.warn('Failed to load decay config, using defaults', { error: String(e) });
  }

  return DEFAULT_DECAY_CONFIG;
}

/**
 * Set rating decay configuration
 *
 * @param nk - Nakama server interface
 * @param config - New decay configuration
 */
export function setDecayConfig(nk: Runtime.Nakama, config: RatingDecayConfig): void {
  nk.storageWrite({
    [STORAGE_KEY_DECAY_CONFIG]: JSON.stringify(config),
  });

  nk.logger.info('Rating decay config updated', config);
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
      const data = JSON.parse(storage[0].value);
      return data.last_active || data.last_match_time || 0;
    }
  } catch (e) {
    nk.logger.warn('Failed to load player last active', { player_id: playerId, error: String(e) });
  }

  return 0;
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
      value: JSON.stringify({ last_active: Date.now() }),
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
    const storage = nk.storageRead([STORAGE_KEY_SEASON_ARCHIVE]);
    if (storage[STORAGE_KEY_SEASON_ARCHIVE]) {
      return JSON.parse(storage[STORAGE_KEY_SEASON_ARCHIVE] as string);
    }
  } catch (e) {
    nk.logger.warn('Failed to load season archive', { error: String(e) });
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
function getPlayerUsername(nk: Runtime.Nakama, playerId: string): string {
  try {
    const users = nk.getUsers([playerId]);
    if (users.length > 0) {
      return users[0].username || users[0].displayName || 'Unknown';
    }
  } catch (e) {
    nk.logger.warn('Failed to get username', { player_id: playerId, error: String(e) });
  }

  return 'Unknown';
}
