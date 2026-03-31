/**
 * Combat System module.
 * @fileoverview Manages PvP combat actions and turn processing.
 */
import { PlayerStats } from '../types/game';
import { Runtime } from '../types/nakama';
/**
 * Combat action request data.
 *
 * @property match_id - Unique identifier for the match
 * @property action_type - Type of combat action ("shoot")
 * @property angle - Angle of attack in radians (0 to 2π)
 * @property power - Optional power level for the attack (0.0-1.0)
 * @property requestId - Anti-cheat: unique request identifier
 * @property timestamp - Anti-cheat: client timestamp
 * @property signature - Anti-cheat: HMAC signature
 * @property nonce - Anti-cheat: cryptographic nonce
 */
export interface CombatAction {
    match_id: string;
    action_type: string;
    angle: number;
    power?: number;
    requestId?: string;
    timestamp?: number;
    signature?: string;
    nonce?: string;
}
/**
 * Result of a combat action.
 *
 * @property success - Whether the action was processed successfully
 * @property hit - Whether the attack hit the target
 * @property damage - Amount of damage dealt
 * @property is_crit - Whether the attack was a critical hit
 * @property attacker_stats - Stats of the attacking player
 * @property defender_stats - Stats of the defending player
 * @property match_status - Current status of the match
 * @property winner - Optional winner if match completed
 */
export interface CombatResult {
    success: boolean;
    hit: boolean;
    damage: number;
    is_crit: boolean;
    attacker_stats: PlayerStats;
    defender_stats: PlayerStats;
    match_status: string;
    winner?: string;
}
/**
 * Current state of a PvP match.
 *
 * @property match_id - Unique identifier for the match
 * @property turn - Current turn number
 * @property current_turn_user_id - Player whose turn it is
 * @property creator_id - ID of the match creator
 * @property opponent_id - ID of the opponent
 * @property creator_health - Current health of the creator
 * @property opponent_health - Current health of the opponent
 * @property creator_stats - Stats of the creator
 * @property opponent_stats - Stats of the opponent
 * @property status - Current match status
 * @property winner - Optional winner if match completed
 * @property log - Combat log entries
 * @property last_turn_timestamp - Timestamp of the last turn action
 * @property turn_timeout_ms - Milliseconds before a turn is considered abandoned
 * @property consecutive_timeouts - Number of consecutive turn timeouts for current player
 * @property forfeit_reason - Reason for match ending (timeout, disconnect, etc.)
 */
export interface MatchState {
    match_id: string;
    turn: number;
    current_turn_user_id: string;
    creator_id: string;
    opponent_id: string;
    creator_health: number;
    opponent_health: number;
    creator_stats: PlayerStats;
    opponent_stats: PlayerStats;
    status: string;
    winner?: string;
    log: CombatLogEntry[];
    last_turn_timestamp: number;
    turn_timeout_ms: number;
    consecutive_timeouts: number;
    forfeit_reason?: string;
}
/**
 * Combat log entry for tracking match history.
 *
 * @property turn - Turn number when this action occurred
 * @property attacker_id - ID of the attacking player
 * @property action - Type of action performed
 * @property hit - Whether the attack hit
 * @property damage - Amount of damage dealt
 * @property is_crit - Whether the attack was critical
 * @property timestamp - Timestamp when the action occurred
 */
export interface CombatLogEntry {
    turn: number;
    attacker_id: string;
    action: string;
    hit: boolean;
    damage: number;
    is_crit: boolean;
    timestamp: number;
}
/**
 * Registers the submit combat action RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcSubmitCombatAction(initializer: Runtime.Initializer): void;
export declare function rpcSubmitCombatAction(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): Promise<string>;
/**
 * Registers the get match state RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGetMatchState(initializer: Runtime.Initializer): void;
/**
 * Retrieves the current state of a PvP match.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing match_id
 * @returns JSON string with match state
 *
 * @example
 * // Request payload
 * { "match_id": "match_123" }
 *
 * // Response
 * {
 *   "match_id": "match_123",
 *   "turn": 3,
 *   "current_turn_user_id": "user_456",
 *   "creator_health": 75,
 *   "opponent_health": 50,
 *   ...
 * }
 */
export declare function rpcGetMatchState(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): Promise<string>;
/**
 * Handles a player disconnect/leave match request.
 * This allows graceful handling of disconnections.
 */
export declare function rpcPlayerDisconnect(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): Promise<string>;
/**
 * Registers the player disconnect RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcPlayerDisconnect(initializer: Runtime.Initializer): void;
