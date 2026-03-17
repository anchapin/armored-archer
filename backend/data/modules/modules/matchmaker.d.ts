/**
 * Matchmaker module.
 * @fileoverview Implements matchmaking and ranking for PvP matches.
 */
import { TurnData, PlayerStats } from '../types/game';
import { Runtime } from '../types/nakama';
/**
 * PvP match data structure.
 *
 * @property match_id - Unique identifier for the match
 * @property creator_id - ID of the match creator
 * @property opponent_id - ID of the opponent
 * @property creator_rank - Rank of the creator
 * @property opponent_rank - Rank of the opponent
 * @property match_type - Type of match ("ranked" or "casual")
 * @property is_punch_up - Whether this is a punch-up match
 * @property status - Current match status
 * @property created_at - Timestamp when match was created
 * @property updated_at - Timestamp when match was last updated
 * @property creator_turn_data - Optional turn data for creator
 * @property opponent_turn_data - Optional turn data for opponent
 * @property winner - Optional winner if match completed
 * @property expires_at - Timestamp when match will be considered abandoned/expired
 * @property last_turn_timestamp - Timestamp of the last turn action
 */
export interface PvPMatch {
    match_id: string;
    creator_id: string;
    opponent_id: string;
    creator_rank: number;
    opponent_rank: number;
    match_type: 'ranked' | 'casual';
    is_punch_up: boolean;
    status: 'pending' | 'active' | 'completed' | 'expired';
    created_at: number;
    updated_at: number;
    creator_turn_data?: TurnData;
    opponent_turn_data?: TurnData;
    winner?: string;
    expires_at: number;
    last_turn_timestamp: number;
}
/**
 * Request payload for creating a match.
 *
 * @property match_type - Type of match to create
 * @property is_punch_up - Whether to allow punch-up matches
 * @property target_opponent_id - Optional specific opponent to challenge
 */
export interface CreateMatchRequest {
    match_type: 'ranked' | 'casual';
    is_punch_up?: boolean;
    target_opponent_id?: string;
}
/**
 * Request payload for accepting a match.
 *
 * @property match_id - ID of the match to accept
 */
export interface AcceptMatchRequest {
    match_id: string;
}
/**
 * Request payload for listing matches.
 *
 * @property match_type - Optional filter by match type
 * @property min_rank - Optional minimum rank filter
 * @property max_rank - Optional maximum rank filter
 * @property limit - Maximum number of matches to return
 */
export interface ListMatchesRequest {
    match_type?: 'ranked' | 'casual';
    min_rank?: number;
    max_rank?: number;
    limit?: number;
}
/**
 * Request payload for completing a match.
 *
 * @property match_id - ID of the match to complete
 * @property winner_id - ID of the match winner
 * @property loser_id - ID of the match loser
 * @property is_punch_up - Whether this was a punch-up match
 */
export interface CompleteMatchRequest {
    match_id: string;
    winner_id: string;
    loser_id: string;
    is_punch_up?: boolean;
}
/**
 * Registers the list matches RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcListMatches(initializer: Runtime.Initializer): void;
/**
 * Lists available PvP matches with filtering options.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing filter parameters
 * @returns JSON string with list of matches and player rank
 *
 * @example
 * // Request payload
 * { "match_type": "ranked", "limit": 10 }
 *
 * // Response
 * {
 *   "success": true,
 *   "matches": [ ... ],
 *   "player_rank": 15,
 *   "total": 8
 * }
 */
export declare function rpcListMatches(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the create match RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcCreateMatch(initializer: Runtime.Initializer): void;
/**
 * Creates a new PvP match with optional direct challenge.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match creation parameters
 * @returns JSON string with created match data
 *
 * @example
 * // Request payload
 * { "match_type": "ranked", "target_opponent_id": "user_456" }
 *
 * // Response
 * {
 *   "success": true,
 *   "match": { ... }
 * }
 */
export declare function rpcCreateMatch(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the accept match RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcAcceptMatch(initializer: Runtime.Initializer): void;
/**
 * Accepts a pending PvP match and starts the game.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match_id
 * @returns JSON string with accepted match data
 *
 * @example
 * // Request payload
 * { "match_id": "match_123" }
 *
 * // Response
 * {
 *   "success": true,
 *   "match": { ... }
 * }
 */
export declare function rpcAcceptMatch(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the get player rank RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGetPlayerRank(initializer: Runtime.Initializer): void;
/**
 * Retrieves a player's current rank and stats.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with player rank and stats
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "success": true,
 *   "rank": 15,
 *   "level": 5,
 *   "xp": 450
 * }
 */
export declare function rpcGetPlayerRank(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Calculates a player's rank based on level and stats.
 *
 * @param playerStats - Player statistics data
 * @returns Calculated player rank
 */
export declare function calculateRank(playerStats: PlayerStats): number;
/**
 * Generates a unique match ID.
 *
 * @returns Unique match identifier string
 */
export declare function generateMatchId(): string;
/**
 * Registers the complete match RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcCompleteMatch(initializer: Runtime.Initializer): void;
/**
 * Completes a PvP match and updates player ranks using Elo rating system.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match completion data
 * @returns JSON string with match result and rank changes
 *
 * @example
 * // Request payload
 * { "match_id": "match_123", "winner_id": "user_1", "loser_id": "user_2", "is_punch_up": false }
 *
 * // Response
 * {
 *   "success": true,
 *   "match": { ... },
 *   "winner": { "user_id": "user_1", "old_rank": 1200, "new_rank": 1220, "rank_change": 20 },
 *   "loser": { "user_id": "user_2", "old_rank": 1200, "new_rank": 1180, "rank_change": -20 }
 * }
 */
export declare function rpcCompleteMatch(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
