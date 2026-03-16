/**
 * RPG System module.
 * @fileoverview Handles XP gains and stat allocation.
 */
import { Runtime } from '../types/nakama';
/**
 * Player statistics data structure.
 *
 * @property user_id - Unique identifier for the player
 * @property level - Current player level
 * @property xp - Current experience points
 * @property ability_points - Points available for stat allocation
 * @property stats - Player combat statistics
 */
export interface PlayerStats {
    user_id: string;
    level: number;
    xp: number;
    ability_points: number;
    stats: {
        attack: number;
        defense: number;
        dodge: number;
        crit_rate: number;
    };
}
/**
 * Request payload for gaining XP.
 *
 * @property xp_amount - Amount of XP to gain
 * @property source - Source of XP gain ("pve" or "pvp")
 */
export interface XPGainRequest {
    xp_amount: number;
    source: string;
}
/**
 * Request payload for stat allocation.
 *
 * @property stat_name - Name of stat to increase
 * @property points - Number of points to allocate
 */
export interface StatAllocationRequest {
    stat_name: string;
    points: number;
}
/**
 * Registers the gain XP RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGainXP(initializer: Runtime.Initializer): void;
/**
 * Handles XP gain requests and level progression.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing xp_amount and source
 * @returns JSON string with success status and updated player stats
 *
 * @example
 * // Request payload
 * { "xp_amount": 100, "source": "pve" }
 *
 * // Response
 * {
 *   "success": true,
 *   "player_stats": { ... },
 *   "xp_gained": 100,
 *   "levels_gained": 1
 * }
 */
export declare function rpcGainXP(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the stat allocation RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcAllocateStats(initializer: Runtime.Initializer): void;
/**
 * Handles stat allocation requests for ability points.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing stat_name and points
 * @returns JSON string with success status and updated player stats
 *
 * @example
 * // Request payload
 * { "stat_name": "attack", "points": 5 }
 *
 * // Response
 * {
 *   "success": true,
 *   "player_stats": { ... }
 * }
 */
export declare function rpcAllocateStats(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the get player stats RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGetPlayerStats(initializer: Runtime.Initializer): void;
/**
 * Retrieves player statistics with caching.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with player stats or error
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "level": 5,
 *   "xp": 450,
 *   "stats": { ... }
 * }
 */
export declare function rpcGetPlayerStats(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Calculates player level based on experience points.
 *
 * @param xp - Experience points to calculate level for
 * @returns Calculated player level
 *
 * @example
 * calculateLevel(450); // returns 5
 */
export declare function calculateLevel(xp: number): number;
