/**
 * Product Analytics Module
 * @fileoverview Handles analytics event collection, storage, and forwarding for the game.
 */
import { Runtime } from '../types/nakama';
export declare enum AnalyticsEventType {
    SESSION_START = "session_start",
    SESSION_END = "session_end",
    TUTORIAL_STARTED = "tutorial_started",
    TUTORIAL_COMPLETED = "tutorial_completed",
    TUTORIAL_FAILED = "tutorial_failed",
    PVE_STAGE_STARTED = "pve_stage_started",
    PVE_STAGE_COMPLETED = "pve_stage_completed",
    PVE_STAGE_FAILED = "pve_stage_failed",
    PVE_BOSS_DEFEATED = "pve_boss_defeated",
    PVP_MATCH_STARTED = "pvp_match_started",
    PVP_MATCH_COMPLETED = "pvp_match_completed",
    PVP_MATCH_ABANDONED = "pvp_match_abandoned",
    PVP_DISCONNECT = "pvp_disconnect",
    STORE_OPENED = "store_opened",
    PURCHASE_INITIATED = "purchase_initiated",
    PURCHASE_COMPLETED = "purchase_completed",
    PURCHASE_FAILED = "purchase_failed",
    GEM_PURCHASED = "gem_purchased",
    COSMETIC_PURCHASED = "cosmetic_purchased",
    SUBSCRIPTION_STARTED = "subscription_started",
    GEAR_OBTAINED = "gear_obtained",
    GEAR_EQUIPPED = "gear_equipped",
    GEAR_UNEQUIPPED = "gear_unequipped",
    LOADOUT_VIEWED = "loadout_viewed",
    TRANSMOG_APPLIED = "transmog_applied",
    LEVEL_UP = "level_up",
    ABILITY_UNLOCKED = "ability_unlocked",
    SEASON_START = "season_start",
    SEASON_END = "season_end",
    FIRST_SESSION = "first_session",
    DAILY_LOGIN = "daily_login",
    RETURNING_PLAYER = "returning_player",
    NETWORK_ERROR = "network_error",
    RPC_ERROR = "rpc_error",
    RPC_LATENCY = "rpc_latency",
    CUSTOM = "custom"
}
interface AnalyticsEvent {
    id: string;
    userId: string;
    eventName: string;
    timestamp: number;
    properties: Record<string, unknown>;
    platform: string;
    sessionId: string;
}
interface DailyMetric {
    date: string;
    eventName: string;
    count: number;
    uniqueUsers: Set<string>;
}
/**
 * Registers the analytics RPC endpoints.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerAnalyticsEndpoints(initializer: Runtime.Initializer): void;
/**
 * RPC: Track a game analytics event.
 *
 * @example
 * // Request payload
 * {
 *   "event_name": "pve_stage_completed",
 *   "properties": {
 *     "stage_id": "campaign_1",
 *     "stars": 3,
 *     "duration_seconds": 120
 *   },
 *   "platform": "android",
 *   "session_id": "sess_123456"
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "event_id": "evt_1234567890_abc123"
 * }
 */
export declare function rpcTrackEvent(ctx: Runtime.Context, logger: Runtime.Logger, _nk: Runtime.Nakama, payload: string): string;
/**
 * RPC: Get analytics summary.
 *
 * @example
 * // Request payload
 * {
 *   "start_date": "2024-01-01",
 *   "end_date": "2024-01-31",
 *   "event_names": ["pve_stage_completed", "purchase_completed"]
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "summary": {
 *     "total_events": 1500,
 *     "unique_users": 450,
 *     "events": {
 *       "pve_stage_completed": {
 *         "count": 1200,
 *         "unique_users": 400
 *       },
 *       "purchase_completed": {
 *         "count": 300,
 *         "unique_users": 50
 *       }
 *     }
 *   }
 * }
 */
export declare function rpcGetAnalyticsSummary(ctx: Runtime.Context, logger: Runtime.Logger, _nk: Runtime.Nakama, payload: string): string;
/**
 * RPC: Track revenue event.
 *
 * @example
 * // Request payload
 * {
 *   "amount": 99,
 *   "currency": "USD",
 *   "product_id": "com.armoredarcher.gems.small",
 *   "transaction_id": "tx_123456",
 *   "platform": "ios"
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "revenue_id": "rev_1234567890"
 * }
 */
export declare function rpcTrackRevenue(ctx: Runtime.Context, logger: Runtime.Logger, _nk: Runtime.Nakama, payload: string): string;
/**
 * Get daily metrics for a specific date range.
 */
export declare function getDailyMetrics(startDate: string, endDate: string): DailyMetric[];
/**
 * RPC: Get circuit breaker states for all monitored services.
 *
 * This RPC provides visibility into the health of external service connections
 * protected by circuit breakers.
 *
 * // Response
 * {
 *   "success": true,
 *   "circuits": [
 *     {
 *       "serviceName": "mixpanel",
 *       "state": "CLOSED",
 *       "stats": {
 *         "failures": 0,
 *         "successes": 10,
 *         "rejects": 0,
 *         "lastFailure": null
 *       },
 *       "options": {
 *         "timeout": 5000,
 *         "errorThresholdPercentage": 50,
 *         "volumeThreshold": 3,
 *         "resetTimeout": 30000
 *       }
 *     }
 *   ]
 * }
 */
export declare function rpcGetCircuitBreakerStates(_ctx: Runtime.Context, logger: Runtime.Logger, _nk: Runtime.Nakama, _payload: string): string;
/**
 * Get recent analytics events.
 */
export declare function getRecentEvents(limit?: number): AnalyticsEvent[];
/**
 * Get all analytics events (for admin/debug purposes).
 */
export declare function getAllEvents(): AnalyticsEvent[];
export {};
