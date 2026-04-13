/**
 * Season System module.
 * @fileoverview Manages seasonal rewards and rankings.
 */
import { Runtime } from '../types/nakama';
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
    status: string;
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
/**
 * Registers the get season info RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGetSeasonInfo(initializer: Runtime.Initializer): void;
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
export declare function rpcGetSeasonInfo(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the get leaderboard RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGetLeaderboard(initializer: Runtime.Initializer): void;
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
export declare function rpcGetLeaderboard(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the update rank RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcUpdateRank(initializer: Runtime.Initializer): void;
/**
 * Applies Elo rating updates to both players
 */
export declare function applyEloUpdates(nk: Runtime.Nakama, ctx: Runtime.Context, currentSeason: {
    season_id: string;
}, winnerId: string, loserId: string, winnerOldElo: number, loserOldElo: number, isPunchUp: boolean, winnerEntry: LeaderboardEntry | null, loserEntry: LeaderboardEntry | null): {
    winnerNewElo: number;
    loserNewElo: number;
};
export declare function rpcUpdateRank(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the get season rewards RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGetSeasonRewards(initializer: Runtime.Initializer): void;
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
export declare function rpcGetSeasonRewards(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the claim season rewards RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcClaimSeasonRewards(initializer: Runtime.Initializer): void;
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
export declare function rpcClaimSeasonRewards(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the end season RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcEndSeason(initializer: Runtime.Initializer): void;
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
export declare function rpcEndSeason(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Gets the current season information.
 *
 * @returns Current season data
 */
export declare function getCurrentSeason(): SeasonInfo;
/**
 * Gets a player's leaderboard entry.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player to retrieve
 * @param leaderboardId - ID of the leaderboard
 * @returns Leaderboard entry or null if not found
 */
export declare function getLeaderboardEntry(nk: Runtime.Nakama, userId: string, leaderboardId: string): LeaderboardEntry | null;
/**
 * Calculates season rewards based on player rank.
 *
 * @param rank - Player's final rank
 * @param seasonNumber - Current season number
 * @returns Calculated season rewards
 */
export declare function calculateRewards(rank: number, seasonNumber: number): SeasonRewards;
/**
 * Records player match activity for rank decay tracking.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 */
export declare function recordPlayerActivity(nk: Runtime.Nakama, userId: string): void;
/**
 * Calculates and applies rank decay for a player based on inactivity.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param currentScore - Player's current rank score
 * @returns New score after decay (or original if no decay applies)
 */
export declare function applyRankDecay(nk: Runtime.Nakama, userId: string, currentScore: number): number;
/**
 * Gets the rank decay info for a player.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param currentScore - Player's current rank score
 * @returns Decay information including days inactive and points at risk
 */
export declare function getRankDecayInfo(nk: Runtime.Nakama, userId: string, currentScore: number): {
    days_inactive: number;
    points_at_risk: number;
    can_decay: boolean;
};
