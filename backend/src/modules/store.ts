/**
 * Store module.
 * @fileoverview Handles in-game purchases and currency management.
 * @description Includes refund handling, edge cases, and robust validation.
 */

import { createHash } from 'crypto';
import { Runtime } from '../types/nakama';
import { getCacheManager } from '../utils/cache';
import { safeParse } from '../utils/safeParse';
import { logAudit } from './audit';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

/**
 * Maximum gem balance allowed to prevent overflow exploits.
 */
const MAX_GEM_BALANCE = 10000000; // 10 million gems

/**
 * Maximum single purchase amount to prevent large exploits.
 */
const MAX_PURCHASE_AMOUNT = 10000; // 10k gems per transaction

/**
 * Valid platforms for IAP purchases.
 */
const VALID_PLATFORMS = ['ios', 'android'];

/**
 * Refund reason codes for audit logging.
 */
export enum RefundReason {
  CUSTOMER_SUPPORT = 'customer_support',
  CHARGEBACK = 'chargeback',
  DUPLICATE = 'duplicate',
  FRAUD = 'fraud',
  OTHER = 'other',
}

/**
 * In-memory store for validated receipts (use Redis in production for distributed systems).
 * Format: Set of receipt hashes keyed by user_id
 */
const validatedReceipts: Map<string, Set<string>> = new Map();

/**
 * Processed refunds storage for tracking.
 * Format: Map of user_id -> Set of refund transaction IDs
 */
const processedRefunds: Map<string, Set<string>> = new Map();

/**
 * Maximum age of receipts to keep in memory (24 hours in milliseconds).
 * In production with Redis, use TTL-based keys instead.
 */
// const RECEIPT_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Cleanup old entries from the receipts store.
 */
function cleanupOldReceipts(): void {
  // const now = Date.now();
  for (const receipts of validatedReceipts.values()) {
    // In a real implementation, we'd track when each receipt was added
    // For now, we just limit the total count per user
    if (receipts.size > 1000) {
      // Keep only the most recent 500
      const arr = Array.from(receipts);
      receipts.clear();
      arr.slice(-500).forEach((r) => receipts.add(r));
    }
  }
}

// Run cleanup every hour
setInterval(cleanupOldReceipts, 60 * 60 * 1000);

/**
 * Check if a receipt has already been used.
 *
 * @param userId - The user who submitted the receipt
 * @param receiptHash - Hash of the transaction receipt
 * @returns true if the receipt was already validated
 */
function isReceiptAlreadyUsed(userId: string, receiptHash: string): boolean {
  const userReceipts = validatedReceipts.get(userId);
  if (!userReceipts) {
    return false;
  }
  return userReceipts.has(receiptHash);
}

/**
 * Mark a receipt as used.
 *
 * @param userId - The user who submitted the receipt
 * @param receiptHash - Hash of the transaction receipt
 */
function markReceiptAsUsed(userId: string, receiptHash: string): void {
  let userReceipts = validatedReceipts.get(userId);
  if (!userReceipts) {
    userReceipts = new Set();
    validatedReceipts.set(userId, userReceipts);
  }
  userReceipts.add(receiptHash);
}

/**
 * Cryptographic hash function for receipts using SHA-256.
 * This prevents collision attacks and replay attack manipulation.
 */
function hashReceipt(receipt: string): string {
  return createHash('sha256').update(receipt).digest('hex');
}

/**
 * Check if a refund has already been processed.
 *
 * @param userId - The user who received the refund
 * @param refundTransactionId - Unique refund transaction identifier
 * @returns true if the refund was already processed
 */
function isRefundAlreadyProcessed(userId: string, refundTransactionId: string): boolean {
  const userRefunds = processedRefunds.get(userId);
  if (!userRefunds) {
    return false;
  }
  return userRefunds.has(refundTransactionId);
}

/**
 * Mark a refund as processed.
 *
 * @param userId - The user who received the refund
 * @param refundTransactionId - Unique refund transaction identifier
 */
function markRefundAsProcessed(userId: string, refundTransactionId: string): void {
  let userRefunds = processedRefunds.get(userId);
  if (!userRefunds) {
    userRefunds = new Set();
    processedRefunds.set(userId, userRefunds);
  }
  userRefunds.add(refundTransactionId);
}

/**
 * Validates the platform against the receipt data.
 * In production, this would parse the receipt to extract the actual platform.
 * For now, we validate the platform string is valid and log a warning for investigation.
 *
 * @param platform - Platform string from client
 * @param receipt - Transaction receipt
 * @param logger - Nakama logger instance
 * @returns true if platform appears valid
 */
function validatePlatform(platform: string, _receipt: string, logger: Runtime.Logger): boolean {
  // Check if platform is a recognized value
  if (!VALID_PLATFORMS.includes(platform)) {
    logger.warn('Invalid platform specified: %s', platform);
    return false;
  }

  // In production, you would parse the receipt and verify the platform matches
  // For RevenueCat, you would use their server-side API to validate
  // This is a placeholder for that logic

  // Log for fraud detection - unusual platforms may warrant investigation
  logger.info('Platform validation passed for: %s', platform);

  return true;
}

/**
 * Validate gem balance to prevent overflow exploits.
 *
 * @param currentBalance - Current player balance
 * @param amountToAdd - Amount being added
 * @returns true if the transaction would exceed max balance
 */
function wouldExceedMaxBalance(currentBalance: number, amountToAdd: number): boolean {
  return currentBalance + amountToAdd > MAX_GEM_BALANCE;
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
export function processRefund(
  nk: Runtime.Nakama,
  userId: string,
  refundAmount: number,
  refundTransactionId: string,
  reason: RefundReason,
  logger: Runtime.Logger
): { success: boolean; message: string; new_balance?: number } {
  // Check for duplicate refund
  if (isRefundAlreadyProcessed(userId, refundTransactionId)) {
    logger.warn(
      'Duplicate refund detected for user: %s, transaction: %s',
      userId,
      refundTransactionId
    );
    return { success: false, message: 'Refund already processed' };
  }

  // Validate refund amount
  if (refundAmount <= 0) {
    logger.error('Invalid refund amount: %d', refundAmount);
    return { success: false, message: 'Invalid refund amount' };
  }

  // Get current player currency
  const playerCurrency = getPlayerCurrencyWithCache(nk, userId, logger);

  // Calculate new balance (don't go below zero)
  const deduction = Math.min(refundAmount, playerCurrency.gems);
  playerCurrency.gems -= deduction;

  // Update storage
  nk.storageWrite([
    {
      collection: 'player_currency',
      key: userId,
      userId: userId,
      value: JSON.stringify(playerCurrency),
    },
  ]);

  // Update wallet
  nk.walletUpdate(userId, {
    gems: -deduction,
  });

  // Invalidate cache
  invalidateCurrencyCache(userId, logger);

  // Mark refund as processed
  markRefundAsProcessed(userId, refundTransactionId);

  // Log the refund for audit
  const refundDetails = {
    refund_amount: refundAmount,
    actual_deducted: deduction,
    new_balance: playerCurrency.gems,
    reason: reason,
    refund_transaction_id: refundTransactionId,
  };
  const refundError =
    deduction < refundAmount ? 'Partial refund - player had insufficient balance' : undefined;

  logAudit(
    nk,
    userId,
    null,
    'process_refund',
    'player_currency',
    refundDetails,
    'success',
    refundError
  );

  logger.info(
    'Refund processed for user %s: deducted %d gems (requested: %d), new balance: %d, reason: %s',
    userId,
    deduction,
    refundAmount,
    playerCurrency.gems,
    reason
  );

  return {
    success: true,
    message: deduction < refundAmount ? 'Partial refund applied' : 'Refund processed successfully',
    new_balance: playerCurrency.gems,
  };
}

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
 * Retrieves player currency with caching.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player to retrieve currency for
 * @param logger - Nakama logger instance
 * @returns Player currency data
 */
function getPlayerCurrencyWithCache(
  nk: Runtime.Nakama,
  userId: string,
  logger: Runtime.Logger
): PlayerCurrency {
  const cacheManager = getCacheManager(logger);
  const cachedCurrency = cacheManager.get<PlayerCurrency>('player_currency', userId);

  if (cachedCurrency !== undefined) {
    return cachedCurrency;
  }

  const objects = nk.storageRead([
    {
      collection: 'player_currency',
      key: userId,
      userId: userId,
    },
  ]);

  let currency: PlayerCurrency;
  if (objects.length === 0 || !objects[0].value) {
    currency = {
      user_id: userId,
      gems: 0,
      gold: 0,
    };
  } else {
    const parseResult = safeParse<PlayerCurrency>(
      objects[0].value,
      null,
      logger,
      'player_currency'
    );
    currency =
      parseResult.success && parseResult.data
        ? parseResult.data
        : {
            user_id: userId,
            gems: 0,
            gold: 0,
          };
  }

  cacheManager.set('player_currency', userId, currency);
  return currency;
}

/**
 * Invalidates player currency cache.
 *
 * @param userId - ID of the player to invalidate cache for
 * @param logger - Nakama logger instance
 */
function invalidateCurrencyCache(userId: string, logger: Runtime.Logger): void {
  const cacheManager = getCacheManager(logger);
  cacheManager.delete('player_currency', userId);
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
  platform: string; // "ios" or "android"
  transaction_receipt: string; // Base64 encoded receipt from RevenueCat
}

/**
 * Gem bundle catalog with available purchases.
 */
export const GEM_BUNDLES: Record<string, GemBundle> = {
  'com.armoredarcher.gems.small': {
    product_id: 'com.armoredarcher.gems.small',
    gem_amount: 100,
    price_usd: 0.99,
  },
  'com.armoredarcher.gems.medium': {
    product_id: 'com.armoredarcher.gems.medium',
    gem_amount: 550,
    price_usd: 4.99,
  },
  'com.armoredarcher.gems.large': {
    product_id: 'com.armoredarcher.gems.large',
    gem_amount: 1200,
    price_usd: 9.99,
  },
};

/**
 * Registers the validate purchase RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcValidatePurchase(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/validate_purchase', rpcValidatePurchase);
}

/**
 * Registers the get currency RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcGetCurrency(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_currency', rpcGetCurrency);
}

/**
 * Registers the spend gems RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
export function registerRpcSpendGems(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/spend_gems', rpcSpendGems);
}

/**
 * Retrieves store catalog with caching.
 *
 * @param logger - Nakama logger instance
 * @returns Store catalog with gem bundles
 */
function getStoreCatalog(logger: Runtime.Logger): Record<string, GemBundle> {
  const cacheManager = getCacheManager(logger);
  const cachedCatalog = cacheManager.get<Record<string, GemBundle>>('store_catalog', 'gem_bundles');

  if (cachedCatalog !== undefined) {
    return cachedCatalog;
  }

  cacheManager.set('store_catalog', 'gem_bundles', GEM_BUNDLES);
  return GEM_BUNDLES;
}

/**
 * Validates in-app purchases and awards gems.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string containing purchase data
 * @returns JSON string with purchase validation result
 *
 * @example
 * // Request payload
 * { "product_id": "com.armoredarcher.gems.small", "platform": "ios", "transaction_receipt": "base64encoded" }
 *
 * // Response
 * {
 *   "success": true,
 *   "gems_awarded": 100,
 *   "new_balance": 100,
 *   "product_id": "com.armoredarcher.gems.small"
 * }
 */
export async function rpcValidatePurchase(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Validating purchase for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.validate_purchase, payload, 'validate_purchase');
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'validate_purchase',
      'player_currency',
      { product_id: 'unknown', platform: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('validate_purchase', validation.error);
  }

  const request = validation.data;

  // Check for duplicate receipt to prevent replay attacks
  const receiptHash = hashReceipt(request.transaction_receipt);
  if (isReceiptAlreadyUsed(ctx.userId, receiptHash)) {
    logger.warn('Duplicate receipt detected for user: %s', ctx.userId);
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'validate_purchase',
      'player_currency',
      { product_id: request.product_id, platform: request.platform },
      'failure',
      'Duplicate receipt detected'
    );
    return JSON.stringify({
      error: 'Duplicate receipt - this purchase has already been processed',
      error_code: 'DUPLICATE_RECEIPT',
    });
  }

  // Validate platform to ensure it's from a recognized source
  if (!validatePlatform(request.platform, request.transaction_receipt, logger)) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'validate_purchase',
      'player_currency',
      { product_id: request.product_id, platform: request.platform },
      'failure',
      'Invalid platform'
    );
    return JSON.stringify({
      error: 'Invalid or unsupported platform',
      error_code: 'INVALID_PLATFORM',
    });
  }

  // Validate receipt with RevenueCat server-side API for fraud protection
  // This verifies receipts against Apple's App Store and Google Play servers
  // See: https://docs.revenuecat.com/docs/server-side-api
  // Required: REVENUECAT_API_KEY environment variable
  const rcValidation = await validateWithRevenueCat(
    logger,
    request.transaction_receipt,
    request.product_id,
    request.platform
  );

  if (!rcValidation.valid) {
    logger.warn('RevenueCat validation failed for user %s: %s', ctx.userId, rcValidation.error);
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'validate_purchase',
      'player_currency',
      { product_id: request.product_id, platform: request.platform },
      'failure',
      rcValidation.error
    );
    return JSON.stringify({
      error: 'Purchase validation failed',
      error_code: 'VALIDATION_FAILED',
    });
  }

  const catalog = getStoreCatalog(logger);

  if (!catalog[request.product_id]) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'validate_purchase',
      'player_currency',
      { product_id: request.product_id, platform: request.platform },
      'failure',
      'Invalid product ID'
    );
    return JSON.stringify({
      error: 'Invalid product ID',
    });
  }

  const gemBundle = catalog[request.product_id];

  // Check for suspiciously large purchase amounts to prevent exploits
  if (gemBundle.gem_amount > MAX_PURCHASE_AMOUNT) {
    logger.error(
      'Suspicious purchase amount detected: %d gems (max: %d)',
      gemBundle.gem_amount,
      MAX_PURCHASE_AMOUNT
    );
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'validate_purchase',
      'player_currency',
      { product_id: request.product_id, platform: request.platform, amount: gemBundle.gem_amount },
      'failure',
      'Excessive purchase amount'
    );
    return JSON.stringify({
      error: 'Purchase amount exceeds maximum allowed',
      error_code: 'EXCESSIVE_AMOUNT',
    });
  }

  // Mark receipt as used BEFORE awarding gems to prevent replay attacks
  markReceiptAsUsed(ctx.userId, receiptHash);

  const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);

  // Check if adding gems would exceed maximum balance (overflow protection)
  if (wouldExceedMaxBalance(playerCurrency.gems, gemBundle.gem_amount)) {
    logger.error(
      'Purchase would exceed max balance for user %s: current %d + add %d > max %d',
      ctx.userId,
      playerCurrency.gems,
      gemBundle.gem_amount,
      MAX_GEM_BALANCE
    );
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'validate_purchase',
      'player_currency',
      { product_id: request.product_id, platform: request.platform, amount: gemBundle.gem_amount },
      'failure',
      'Would exceed max balance'
    );
    return JSON.stringify({
      error: 'Purchase would exceed maximum gem balance',
      error_code: 'EXCEEDS_MAX_BALANCE',
    });
  }

  playerCurrency.gems += gemBundle.gem_amount;

  nk.storageWrite([
    {
      collection: 'player_currency',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(playerCurrency),
    },
  ]);

  nk.walletUpdate(ctx.userId, {
    gems: gemBundle.gem_amount,
  });

  invalidateCurrencyCache(ctx.userId, logger);

  logger.info('Purchase validated. User %s received %d gems', ctx.userId, gemBundle.gem_amount);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'validate_purchase',
    'player_currency',
    {
      product_id: request.product_id,
      platform: request.platform,
      gems_awarded: gemBundle.gem_amount,
      new_balance: playerCurrency.gems,
    },
    'success'
  );

  return JSON.stringify({
    success: true,
    gems_awarded: gemBundle.gem_amount,
    new_balance: playerCurrency.gems,
    product_id: request.product_id,
  });
}

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
export function rpcGetCurrency(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Getting currency for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_currency, payload, 'get_currency');
  if (!validation.success) {
    return createValidationErrorResponse('get_currency', validation.error);
  }

  const currency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);

  return JSON.stringify(currency);
}

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
export function rpcSpendGems(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Spending gems for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.spend_gems, payload, 'spend_gems');
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'spend_gems',
      'player_currency',
      { amount: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('spend_gems', validation.error);
  }

  const request = validation.data;

  const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);

  if (playerCurrency.gems < request.amount) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'spend_gems',
      'player_currency',
      { amount: request.amount, current_balance: playerCurrency.gems },
      'failure',
      'Insufficient gems'
    );
    return JSON.stringify({
      error: 'Insufficient gems',
    });
  }

  playerCurrency.gems -= request.amount;

  nk.storageWrite([
    {
      collection: 'player_currency',
      key: ctx.userId,
      userId: ctx.userId,
      value: JSON.stringify(playerCurrency),
    },
  ]);

  invalidateCurrencyCache(ctx.userId, logger);

  logger.info(
    'User %s spent %d gems. New balance: %d',
    ctx.userId,
    request.amount,
    playerCurrency.gems
  );

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'spend_gems',
    'player_currency',
    { amount: request.amount, new_balance: playerCurrency.gems },
    'success'
  );

  return JSON.stringify({
    success: true,
    new_balance: playerCurrency.gems,
    amount_spent: request.amount,
  });
}

// ============================================================
// PENDING PURCHASE QUEUE HANDLING
// ============================================================

/**
 * Pending purchase queue for handling purchases that failed due to network issues.
 * Format: Map of user_id -> Array of pending purchases
 */
interface PendingPurchase {
  product_id: string;
  platform: string;
  transaction_receipt: string;
  timestamp: number;
  retry_count: number;
}
const pendingPurchases: Map<string, PendingPurchase[]> = new Map();

/**
 * Maximum number of retries for pending purchases.
 */
const MAX_PENDING_RETRIES = 3;

/**
 * Pending purchase age limit (24 hours in milliseconds).
 * After this time, pending purchases are considered expired.
 */
const PENDING_PURCHASE_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * RevenueCat API configuration.
 */
const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';

/**
 * Gets the RevenueCat API key from environment.
 * Returns undefined if not configured.
 */
function getRevenueCatApiKey(): string | undefined {
  return process.env.REVENUECAT_API_KEY || process.env.REVENUECAT_SECRET_KEY;
}

/**
 * Result from RevenueCat validation.
 */
interface RevenueCatValidationResult {
  valid: boolean;
  error?: string;
  subscriber?: Record<string, unknown>;
  product_id?: string;
}

/**
 * Validate a purchase receipt with RevenueCat server-side API.
 * This provides additional fraud protection by verifying receipts against
 * Apple's App Store and Google Play servers.
 *
 * @param logger - Nakama logger instance
 * @param receipt - Base64 encoded receipt from the client
 * @param productId - Product ID claimed by the client
 * @param platform - Platform (ios or android)
 * @returns Validation result with validity status and product ID from receipt
 */
async function validateWithRevenueCat(
  logger: Runtime.Logger,
  receipt: string,
  productId: string,
  platform: string
): Promise<RevenueCatValidationResult> {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    logger.warn('RevenueCat API key not configured - skipping server-side validation');
    // Return valid for development without API key
    return { valid: true };
  }

  try {
    // RevenueCat endpoint for validating subscriptions
    const rcPlatform = platform === 'ios' ? 'apple' : 'google';

    // RevenueCat /receipts/validate endpoint
    const response = await fetch(`${REVENUECAT_API_BASE}/receipts/validate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receipt: receipt,
        platform: rcPlatform,
        // Optional: include product ID to verify
        product_id: productId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('RevenueCat validation failed: %s - %s', response.status, errorText);
      return {
        valid: false,
        error: `RevenueCat validation failed: ${response.status}`,
      };
    }

    const data = (await response.json()) as Record<string, unknown>;

    // Check if the receipt is valid according to RevenueCat
    const isValid = data.status === 'active' || data.status === 0 || data.valid === true;

    if (!isValid) {
      logger.warn('RevenueCat rejected receipt: status=%s', data.status);
      return {
        valid: false,
        error: `Invalid receipt: ${data.status}`,
      };
    }

    // Extract product ID from RevenueCat response if available
    const subscriber = data.subscriber as Record<string, unknown> | undefined;
    let verifiedProductId: string | undefined;

    if (subscriber?.entitlements) {
      const entitlements = subscriber.entitlements as Record<string, unknown>;
      for (const entitlement of Object.values(entitlements)) {
        const ent = entitlement as Record<string, unknown>;
        if (ent.product_id) {
          verifiedProductId = ent.product_id as string;
          break;
        }
      }
    }

    // Verify product ID matches if we have one from the receipt
    if (verifiedProductId && verifiedProductId !== productId) {
      logger.warn('Product ID mismatch: claimed=%s, actual=%s', productId, verifiedProductId);
      return {
        valid: false,
        error: `Product ID mismatch: claimed ${productId}, receipt contains ${verifiedProductId}`,
        product_id: verifiedProductId,
      };
    }

    logger.info('RevenueCat validation successful for user product: %s', productId);
    return {
      valid: true,
      subscriber,
      product_id: verifiedProductId,
    };
  } catch (error) {
    logger.error('RevenueCat validation error: %s', error);
    return {
      valid: false,
      error: `RevenueCat validation error: ${error}`,
    };
  }
}

/**
 * Add a purchase to the pending queue.
 * Called when network validation fails but receipt was received.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function addToPendingQueue(
  userId: string,
  productId: string,
  platform: string,
  transactionReceipt: string
): void {
  let userPending = pendingPurchases.get(userId);
  if (!userPending) {
    userPending = [];
    pendingPurchases.set(userId, userPending);
  }

  userPending.push({
    product_id: productId,
    platform: platform,
    transaction_receipt: transactionReceipt,
    timestamp: Date.now(),
    retry_count: 0,
  });

  // Clean up old entries
  cleanupPendingPurchases(userId);
}

/**
 * Remove expired and successfully processed purchases from queue.
 */
function cleanupPendingPurchases(userId: string): void {
  const userPending = pendingPurchases.get(userId);
  if (!userPending) return;

  const now = Date.now();
  const valid = userPending.filter(
    (p) => now - p.timestamp < PENDING_PURCHASE_EXPIRY_MS && p.retry_count < MAX_PENDING_RETRIES
  );

  if (valid.length === 0) {
    pendingPurchases.delete(userId);
  } else {
    pendingPurchases.set(userId, valid);
  }
}

/**
 * Process pending purchases for a user.
 * Called when network recovers or on app launch.
 */
export async function rpcProcessPendingPurchases(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Processing pending purchases for user: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.process_pending_purchases,
    payload,
    'process_pending_purchases'
  );
  if (!validation.success) {
    return createValidationErrorResponse('process_pending_purchases', validation.error);
  }

  const userPending = pendingPurchases.get(ctx.userId);
  if (!userPending || userPending.length === 0) {
    return JSON.stringify({
      success: true,
      processed: 0,
      message: 'No pending purchases',
    });
  }

  const results: { product_id: string; success: boolean; error?: string }[] = [];
  const catalog = getStoreCatalog(logger);
  const now = Date.now();

  for (const purchase of userPending) {
    // Skip expired
    if (now - purchase.timestamp >= PENDING_PURCHASE_EXPIRY_MS) {
      results.push({ product_id: purchase.product_id, success: false, error: 'Expired' });
      continue;
    }

    // Skip if max retries exceeded
    if (purchase.retry_count >= MAX_PENDING_RETRIES) {
      results.push({
        product_id: purchase.product_id,
        success: false,
        error: 'Max retries exceeded',
      });
      continue;
    }

    // Validate product ID
    if (!catalog[purchase.product_id]) {
      purchase.retry_count++;
      results.push({
        product_id: purchase.product_id,
        success: false,
        error: 'Invalid product ID',
      });
      continue;
    }

    // Try to process the purchase
    const receiptHash = hashReceipt(purchase.transaction_receipt);

    // Check for duplicate receipt
    if (isReceiptAlreadyUsed(ctx.userId, receiptHash)) {
      results.push({ product_id: purchase.product_id, success: true, error: 'Already processed' });
      continue;
    }

    // Award gems
    const gemBundle = catalog[purchase.product_id];
    const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);

    if (wouldExceedMaxBalance(playerCurrency.gems, gemBundle.gem_amount)) {
      purchase.retry_count++;
      results.push({
        product_id: purchase.product_id,
        success: false,
        error: 'Would exceed max balance',
      });
      continue;
    }

    // Mark receipt and add gems
    markReceiptAsUsed(ctx.userId, receiptHash);
    playerCurrency.gems += gemBundle.gem_amount;

    nk.storageWrite([
      {
        collection: 'player_currency',
        key: ctx.userId,
        userId: ctx.userId,
        value: JSON.stringify(playerCurrency),
      },
    ]);

    nk.walletUpdate(ctx.userId, { gems: gemBundle.gem_amount });
    invalidateCurrencyCache(ctx.userId, logger);

    results.push({ product_id: purchase.product_id, success: true });
    logger.info(
      'Processed pending purchase for user %s: %s (%d gems)',
      ctx.userId,
      purchase.product_id,
      gemBundle.gem_amount
    );
  }

  // Clean up processed purchases
  cleanupPendingPurchases(ctx.userId);

  const successful = results.filter((r) => r.success).length;
  return JSON.stringify({
    success: true,
    processed: results.length,
    successful: successful,
    results: results,
  });
}

export function registerRpcProcessPendingPurchases(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/process_pending_purchases', rpcProcessPendingPurchases);
}

// ============================================================
// REFUND DETECTION HANDLING
// ============================================================

/**
 * Check for refunds via RevenueCat API.
 * Should be called on app launch to detect chargebacks.
 */
export async function rpcCheckRefunds(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Checking for refunds for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.check_refunds, payload, 'check_refunds');
  if (!validation.success) {
    return createValidationErrorResponse('check_refunds', validation.error);
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    logger.warn('RevenueCat API key not configured - skipping refund check');
    return JSON.stringify({
      success: true,
      refunds_found: 0,
      message: 'Refund check not configured',
    });
  }

  // Call RevenueCat API to get refund history
  // RevenueCat API endpoint: GET /subscribers/{app_user_id}
  try {
    const response = await fetch(
      `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(validation.data.app_user_id)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('RevenueCat API error: %s - %s', response.status, errorText);
      return JSON.stringify({
        success: true,
        refunds_found: 0,
        message: 'Unable to check refunds',
      });
    }

    const data = (await response.json()) as Record<string, unknown>;
    const subscriber = data.subscriber as Record<string, unknown> | undefined;

    if (!subscriber) {
      return JSON.stringify({
        success: true,
        refunds_found: 0,
        message: 'No subscriber found',
      });
    }

    // Check for refunds in the subscriber data
    const entitlementHistory = subscriber.entitlement_details as
      | Record<string, unknown>
      | undefined;
    const refunds: { product_id: string; refunded_at: string }[] = [];

    // RevenueCat provides refund information in various fields
    // Check for refund_date or cancellation fields
    if (entitlementHistory) {
      for (const [productId, details] of Object.entries(entitlementHistory)) {
        const ent = details as Record<string, unknown>;
        if (ent.refund_date || ent.refunded_at) {
          refunds.push({
            product_id: productId,
            refunded_at: (ent.refund_date || ent.refunded_at) as string,
          });
        }
      }
    }

    // Process any detected refunds
    let processedCount = 0;
    for (const refund of refunds) {
      if (!isRefundAlreadyProcessed(validation.data.app_user_id, refund.refunded_at)) {
        // Get product info to determine gem amount
        const catalog = getStoreCatalog(logger);
        const productInfo = catalog[refund.product_id];

        if (productInfo) {
          processRefund(
            nk,
            validation.data.app_user_id,
            productInfo.gem_amount,
            refund.refunded_at,
            RefundReason.CHARGEBACK,
            logger
          );
          processedCount++;
        }
      }
    }

    logger.info(
      'Refund check complete for user %s: found %d refunds',
      validation.data.app_user_id,
      refunds.length
    );

    return JSON.stringify({
      success: true,
      refunds_found: refunds.length,
      processed: processedCount,
      message: refunds.length > 0 ? `Found ${refunds.length} refunds` : 'No refunds detected',
    });
  } catch (error) {
    logger.error('Error checking refunds: %s', error);
    return JSON.stringify({
      success: true,
      refunds_found: 0,
      message: 'Error checking refunds',
    });
  }
}

export function registerRpcCheckRefunds(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/check_refunds', rpcCheckRefunds);
}

// ============================================================
// SUBSCRIPTION EXPIRATION HANDLING
// ============================================================

/**
 * Check subscription status via RevenueCat API.
 * Should be called on app launch to detect expired subscriptions.
 */
export async function rpcCheckSubscriptions(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Checking subscriptions for user: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.check_subscriptions,
    payload,
    'check_subscriptions'
  );
  if (!validation.success) {
    return createValidationErrorResponse('check_subscriptions', validation.error);
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    logger.warn('RevenueCat API key not configured - skipping subscription check');
    return JSON.stringify({
      success: true,
      active_subscriptions: [],
      message: 'Subscription check not configured',
    });
  }

  // Call RevenueCat API to get subscription status
  // RevenueCat API endpoint: GET /subscribers/{app_user_id}
  try {
    const response = await fetch(
      `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(validation.data.app_user_id)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('RevenueCat API error: %s - %s', response.status, errorText);
      return JSON.stringify({
        success: true,
        active_subscriptions: [],
        message: 'Unable to check subscriptions',
      });
    }

    const data = (await response.json()) as Record<string, unknown>;
    const subscriber = data.subscriber as Record<string, unknown> | undefined;

    if (!subscriber) {
      return JSON.stringify({
        success: true,
        active_subscriptions: [],
        message: 'No subscriber found',
      });
    }

    // Extract active subscriptions from entitlements
    const entitlements = subscriber.entitlements as Record<string, unknown> | undefined;
    const activeSubscriptions: {
      product_id: string;
      expires_date?: string;
      is_subscribed: boolean;
    }[] = [];

    if (entitlements) {
      for (const [entitlementId, entitlement] of Object.entries(entitlements)) {
        const ent = entitlement as Record<string, unknown>;

        // Check if the entitlement is active
        const isActive = ent.expires_date && new Date(ent.expires_date as string) > new Date();
        const isSubscribed =
          ent.is_subscribed === true || (ent.product_plan_interval && !ent.cancellation_date);

        if (isActive || isSubscribed) {
          activeSubscriptions.push({
            product_id: (ent.product_id as string) || entitlementId,
            expires_date: ent.expires_date as string | undefined,
            is_subscribed: true,
          });
        }
      }
    }

    logger.info(
      'Subscription check complete for user %s: %d active',
      validation.data.app_user_id,
      activeSubscriptions.length
    );

    return JSON.stringify({
      success: true,
      active_subscriptions: activeSubscriptions,
      message:
        activeSubscriptions.length > 0
          ? `Found ${activeSubscriptions.length} active subscriptions`
          : 'No active subscriptions',
    });
  } catch (error) {
    logger.error('Error checking subscriptions: %s', error);
    return JSON.stringify({
      success: true,
      active_subscriptions: [],
      message: 'Error checking subscriptions',
    });
  }
}

export function registerRpcCheckSubscriptions(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/check_subscriptions', rpcCheckSubscriptions);
}

// ============================================================
// APP LAUNCH CHECK
// ============================================================

/**
 * Comprehensive app launch check that runs:
 * - Pending purchase processing
 * - Refund detection
 * - Subscription status check
 */
export async function rpcAppLaunchCheck(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Running app launch check for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.app_launch_check, payload, 'app_launch_check');
  if (!validation.success) {
    return createValidationErrorResponse('app_launch_check', validation.error);
  }

  // Process pending purchases
  const pendingResult = JSON.parse(await rpcProcessPendingPurchases(ctx, logger, nk, '{}'));

  // Check for refunds
  const refundResult = JSON.parse(await rpcCheckRefunds(ctx, logger, nk, '{}'));

  // Check subscriptions
  const subscriptionResult = JSON.parse(await rpcCheckSubscriptions(ctx, logger, nk, '{}'));

  return JSON.stringify({
    success: true,
    pending_purchases: pendingResult,
    refunds: refundResult,
    subscriptions: subscriptionResult,
  });
}

export function registerRpcAppLaunchCheck(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/app_launch_check', rpcAppLaunchCheck);
}
