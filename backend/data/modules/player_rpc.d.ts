/**
 * Player RPC module.
 * @fileoverview Exposes RPC endpoints for player stats and health checks.
 */
import { Runtime } from '../types/nakama';
/**
 * Registers the health check RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcHealthCheck(initializer: Runtime.Initializer): void;
/**
 * Handles health check requests for monitoring.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param _nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with health status
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "status": "ok",
 *   "timestamp": 1234567890,
 *   "version": "0.1.0"
 * }
 */
export declare function rpcHealthCheck(ctx: Runtime.Context, logger: Runtime.Logger, _nk: Runtime.Nakama, payload: string): string;
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
 * Registers the report player RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcReportPlayer(initializer: Runtime.Initializer): void;
/**
 * Handles player reports for suspicious activity.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param _nk - Nakama server interface
 * @param payload - JSON string with report details
 * @returns JSON string with report result
 */
export declare function rpcReportPlayer(ctx: Runtime.Context, logger: Runtime.Logger, _nk: Runtime.Nakama, payload: string): string;
/**
 * Registers the get player reports RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGetPlayerReports(initializer: Runtime.Initializer): void;
/**
 * Retrieves reports for a player (admin/reporter view).
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param _nk - Nakama server interface
 * @param payload - JSON string with optional user_id filter
 * @returns JSON string with reports
 */
export declare function rpcGetPlayerReports(ctx: Runtime.Context, logger: Runtime.Logger, _nk: Runtime.Nakama, payload: string): string;
