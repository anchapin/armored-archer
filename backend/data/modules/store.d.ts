/**
 * Store module.
 * @fileoverview Handles in-game purchases and currency management.
 * @description Includes refund handling, edge cases, and robust validation.
 */
import { Runtime } from '../types/nakama';
/**
 * Refund reason codes for audit logging.
 */
export declare enum RefundReason {
    CUSTOMER_SUPPORT = "customer_support",
    CHARGEBACK = "chargeback",
    DUPLICATE = "duplicate",
    FRAUD = "fraud",
    OTHER = "other"
}
/**
 * Process a refund and deduct gems from player balance.
 * Called from RevenueCat webhook or admin API.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player to refund
 * @param refundAmount - Number of gems to deduct
 * @param refundTransactionId - Unique refund identifier
 * @param reason - Reason for the refund
 * @param logger - Nakama logger instance
 * @returns Result object with success status and message
 */
export declare function processRefund(nk: Runtime.Nakama, userId: string, refundAmount: number, refundTransactionId: string, reason: RefundReason, logger: Runtime.Logger): Promise<{
    success: boolean;
    message: string;
    new_balance?: number;
}>;
/**
 * Player currency data structure.
 *
 * @property user_id - Unique identifier for the player
 * @property gems - Number of gems the player owns
 * @property gold - Number of gold the player owns
 */
export interface PlayerCurrency {
    user_id: string;
    gems: number;
    gold: number;
}
/**
 * Gem bundle data structure.
 *
 * @property product_id - Product identifier for IAP
 * @property gem_amount - Number of gems in the bundle
 * @property price_usd - Price in USD
 */
export interface GemBundle {
    product_id: string;
    gem_amount: number;
    price_usd: number;
}
/**
 * Request payload for validating purchases.
 *
 * @property product_id - ID of the product to validate
 * @property platform - Platform where purchase was made
 * @property transaction_receipt - Base64 encoded receipt from RevenueCat
 */
export interface PurchaseRequest {
    product_id: string;
    platform: string;
    transaction_receipt: string;
}
/**
 * Gem bundle catalog with available purchases.
 */
export declare const GEM_BUNDLES: Record<string, GemBundle>;
/**
 * Registers the validate purchase RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcValidatePurchase(initializer: Runtime.Initializer): void;
/**
 * Registers the get currency RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcGetCurrency(initializer: Runtime.Initializer): void;
/**
 * Registers the spend gems RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export declare function registerRpcSpendGems(initializer: Runtime.Initializer): void;
export declare function rpcValidatePurchase(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): Promise<string>;
/**
 * Retrieves player currency balance.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string (unused, required for RPC format)
 * @returns JSON string with player currency
 *
 * @example
 * // Request payload
 * { }
 *
 * // Response
 * {
 *   "user_id": "user_123",
 *   "gems": 500,
 *   "gold": 1000
 * }
 */
export declare function rpcGetCurrency(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Handles gem spending requests.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing gem amount
 * @returns JSON string with spending result
 *
 * @example
 * // Request payload
 * { "amount": 50 }
 *
 * // Response
 * {
 *   "success": true,
 *   "new_balance": 450,
 *   "amount_spent": 50
 * }
 */
export declare function rpcSpendGems(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string;
/**
 * Process pending purchases for a user.
 * Called when network recovers or on app launch.
 */
export declare function rpcProcessPendingPurchases(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): Promise<string>;
export declare function registerRpcProcessPendingPurchases(initializer: Runtime.Initializer): void;
/**
 * Check for refunds via RevenueCat API.
 * Should be called on app launch to detect chargebacks.
 */
export declare function rpcCheckRefunds(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): Promise<string>;
export declare function registerRpcCheckRefunds(initializer: Runtime.Initializer): void;
/**
 * Check subscription status via RevenueCat API.
 * Should be called on app launch to detect expired subscriptions.
 */
export declare function rpcCheckSubscriptions(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): Promise<string>;
export declare function registerRpcCheckSubscriptions(initializer: Runtime.Initializer): void;
/**
 * Comprehensive app launch check that runs:
 * - Pending purchase processing
 * - Refund detection
 * - Subscription status check
 */
export declare function rpcAppLaunchCheck(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): Promise<string>;
export declare function registerRpcAppLaunchCheck(initializer: Runtime.Initializer): void;
/**
 * RevenueCat webhook handler.
 * Processes incoming webhooks from RevenueCat.
 */
export declare function rpcRevenueCatWebhook(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): Promise<string>;
export declare function registerRpcRevenueCatWebhook(initializer: Runtime.Initializer): void;
