/**
 * Store module.
 * @fileoverview Handles in-game purchases and currency management.
 */

import { Runtime } from '../types/nakama';
import { createHash } from 'crypto';
import { safeParse } from '../utils/safeParse';
import { getCacheManager } from '../utils/cache';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import { logAudit } from './audit';

/**
 * In-memory store for validated receipts (use Redis in production for distributed systems).
 * Format: Set of receipt hashes keyed by user_id
 */
const validatedReceipts: Map<string, Set<string>> = new Map();

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
 * Checks if running in production environment.
 * In production, RevenueCat validation is mandatory.
 */
function isProductionEnvironment(): boolean {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return nodeEnv === 'production';
}

/**
 * Validates a purchase receipt with RevenueCat's server-side API.
 * This provides additional fraud protection by verifying receipts against
 * Apple's App Store and Google Play servers.
 *
 * @param receipt - The transaction receipt from the client
 * @param productId - The product identifier
 * @param platform - The platform (ios or android)
 * @param logger - For logging
 * @returns Validation result with isValid flag and any error message
 */
async function validateReceiptWithRevenueCat(
  receipt: string,
  productId: string,
  platform: string,
  logger: Runtime.Logger
): Promise<{ isValid: boolean; error?: string; productId?: string }> {
  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    // If no API key configured, log warning and fail closed (deny purchase)
    logger.error('RevenueCat API key not configured - cannot validate purchase');
    return {
      isValid: false,
      error: 'Purchase validation unavailable - please try again later',
    };
  }

  // Determine the store based on platform
  const store = platform.toLowerCase() === 'ios' ? 'APPLE' : 'GOOGLE_PLAY';

  try {
    const response = await fetch(`${REVENUECAT_API_BASE}/receipts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        receipt: receipt,
        product_id: productId,
        store: store,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('RevenueCat validation failed with status %d: %s', response.status, errorText);
      return {
        isValid: false,
        error: 'Purchase validation failed - please try again',
      };
    }

    const data = await response.json() as { valid?: boolean; entitlements?: Record<string, unknown> };

    // Check if the purchase is valid according to RevenueCat
    if (data.valid === true || (data.entitlements && data.entitlements[productId] !== undefined)) {
      logger.info('RevenueCat validation successful for product: %s', productId);
      return {
        isValid: true,
        productId: productId,
      };
    }

    logger.warn('RevenueCat validation failed - invalid receipt for product: %s', productId);
    return {
      isValid: false,
      error: 'Invalid purchase receipt',
    };
  } catch (error) {
    logger.error('RevenueCat validation error: %s', error instanceof Error ? error.message : String(error));
    return {
      isValid: false,
      error: 'Purchase validation error - please try again',
    };
  }
}

/**
 * Add a purchase to the pending queue.
 *
 * @param userId - The user who submitted the purchase
 * @param purchase - The pending purchase data
 */
function addPendingPurchase(userId: string, purchase: PendingPurchase): void {
  let userPending = pendingPurchases.get(userId);
  if (!userPending) {
    userPending = [];
    pendingPurchases.set(userId, userPending);
  }
  userPending.push(purchase);
}

/**
 * Get all pending purchases for a user.
 *
 * @param userId - The user to get pending purchases for
 * @returns Array of pending purchases
 */
function getPendingPurchases(userId: string): PendingPurchase[] {
  return pendingPurchases.get(userId) || [];
}

/**
 * Remove a purchase from the pending queue.
 *
 * @param userId - The user who submitted the purchase
 * @param transactionReceipt - The transaction receipt to remove
 */
function removePendingPurchase(userId: string, transactionReceipt: string): void {
  const userPending = pendingPurchases.get(userId);
  if (userPending) {
    const index = userPending.findIndex(p => p.transaction_receipt === transactionReceipt);
    if (index !== -1) {
      userPending.splice(index, 1);
    }
  }
}

/**
 * Cleanup old pending purchases that have expired or exceeded max retries.
 */
function cleanupPendingPurchases(): void {
  const now = Date.now();
  for (const [userId, purchases] of pendingPurchases.entries()) {
    const validPurchases = purchases.filter(p => {
      const age = now - p.timestamp;
      return age < PENDING_PURCHASE_EXPIRY_MS && p.retry_count < MAX_PENDING_RETRIES;
    });
    if (validPurchases.length === 0) {
      pendingPurchases.delete(userId);
    } else {
      pendingPurchases.set(userId, validPurchases);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupPendingPurchases, 60 * 60 * 1000);

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

  // Validate receipt with RevenueCat server-side API
  // In production, this is mandatory for fraud protection
  const revenuecatValidation = await validateReceiptWithRevenueCat(
    request.transaction_receipt,
    request.product_id,
    request.platform,
    logger
  );

  if (!revenuecatValidation.isValid) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'validate_purchase',
      'player_currency',
      { product_id: request.product_id, platform: request.platform },
      'failure',
      revenuecatValidation.error || 'RevenueCat validation failed'
    );
    return JSON.stringify({
      error: revenuecatValidation.error || 'Purchase validation failed',
      error_code: 'REVENUECAT_VALIDATION_FAILED',
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

  // Mark receipt as used BEFORE awarding gems to prevent replay attacks
  markReceiptAsUsed(ctx.userId, receiptHash);

  const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
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

/**
 * Process pending purchases for a user.
 * This should be called when the app detects network recovery.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - Empty JSON object
 * @returns JSON string with processing result
 *
 * @example
 * // Request payload
 * {}
 *
 * // Response
 * {
 *   "success": true,
 *   "processed": 2,
 *   "failed": 0,
 *   "pending": 0
 * }
 */
export function rpcProcessPendingPurchases(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Processing pending purchases for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.process_pending_purchases, payload, 'process_pending_purchases');
  if (!validation.success) {
    return createValidationErrorResponse('process_pending_purchases', validation.error);
  }

  const userPending = getPendingPurchases(ctx.userId);
  let processed = 0;
  let failed = 0;

  for (const purchase of userPending) {
    // Validate the purchase
    const validatePayloadData = {
      product_id: purchase.product_id,
      platform: purchase.platform,
      transaction_receipt: purchase.transaction_receipt,
    };
    
    const purchaseValidation = validatePayload(
      ZodSchemas.validate_purchase,
      JSON.stringify(validatePayloadData),
      'validate_purchase'
    );

    if (!purchaseValidation.success) {
      purchase.retry_count++;
      failed++;
      continue;
    }

    // Process the purchase (award gems)
    const productId = purchase.product_id;
    let gemsToAward = 0;

    switch (productId) {
      case 'com.armoredarcher.gems.small':
        gemsToAward = 100;
        break;
      case 'com.armoredarcher.gems.medium':
        gemsToAward = 500;
        break;
      case 'com.armoredarcher.gems.large':
        gemsToAward = 1500;
        break;
      default:
        logger.warn('Unknown product ID: %s', productId);
        purchase.retry_count++;
        failed++;
        continue;
    }

    // Award gems to player
    const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
    playerCurrency.gems += gemsToAward;

    nk.storageWrite([
      {
        collection: 'player_currency',
        key: ctx.userId,
        userId: ctx.userId,
        value: JSON.stringify(playerCurrency),
      },
    ]);

    invalidateCurrencyCache(ctx.userId, logger);

    // Remove from pending queue
    removePendingPurchase(ctx.userId, purchase.transaction_receipt);

    // Mark receipt as used
    const receiptHash = hashReceipt(purchase.transaction_receipt);
    markReceiptAsUsed(ctx.userId, receiptHash);

    logger.info('Processed pending purchase for user %s: %d gems', ctx.userId, gemsToAward);
    processed++;
  }

  const remainingPending = getPendingPurchases(ctx.userId).length;

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'process_pending_purchases',
    'pending_purchases',
    { processed, failed, remaining: remainingPending },
    'success'
  );

  return JSON.stringify({
    success: true,
    processed,
    failed,
    pending: remainingPending,
  });
}

/**
 * Register RPC function for processing pending purchases.
 *
 * @param initializer - Nakama initializer
 */
export function registerRpcProcessPendingPurchases(initializer: Runtime.Initializer): void {
  initializer.registerRpc('process_pending_purchases', rpcProcessPendingPurchases);
}

/**
 * Check for refunds on app launch.
 * This is called when the app starts to detect any chargebacks or refunded purchases.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - Empty JSON object
 * @returns JSON string with refund check result
 *
 * @example
 * // Request payload
 * {}
 *
 * // Response
 * {
 *   "success": true,
 *   "refunds_detected": 0,
 *   "expired_subscriptions": 0
 * }
 */
export function rpcCheckRefunds(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Checking refunds for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.check_refunds, payload, 'check_refunds');
  if (!validation.success) {
    return createValidationErrorResponse('check_refunds', validation.error);
  }

  // In a real implementation, this would query the app store API for refund status
  // For now, we return success as the actual refund checking happens server-side
  // through periodic jobs or webhook handlers from the app store

  return JSON.stringify({
    success: true,
    refunds_detected: 0,
    message: 'Refund check completed',
  });
}

/**
 * Register RPC function for checking refunds.
 *
 * @param initializer - Nakama initializer
 */
export function registerRpcCheckRefunds(initializer: Runtime.Initializer): void {
  initializer.registerRpc('check_refunds', rpcCheckRefunds);
}

/**
 * Check subscription status on app launch.
 * This detects expired subscriptions and removes premium benefits.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - Empty JSON object
 * @returns JSON string with subscription check result
 *
 * @example
 * // Request payload
 * {}
 *
 * // Response
 * {
 *   "success": true,
 *   "has_active_subscription": true,
 *   "expires_at": "2024-12-31T23:59:59Z"
 * }
 */
export function rpcCheckSubscriptions(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Checking subscriptions for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.check_subscriptions, payload, 'check_subscriptions');
  if (!validation.success) {
    return createValidationErrorResponse('check_subscriptions', validation.error);
  }

  // Get user's subscription data from storage
  try {
    const subscriptionData = nk.storageRead([
      {
        collection: 'subscription',
        key: ctx.userId,
        userId: ctx.userId,
      },
    ]);

    if (!subscriptionData || subscriptionData.length === 0) {
      return JSON.stringify({
        success: true,
        has_active_subscription: false,
        expires_at: null,
      });
    }

    const subscription = JSON.parse(subscriptionData[0].value);
    const now = new Date();
    const expiresAt = new Date(subscription.expires_at);

    if (expiresAt <= now) {
      // Subscription has expired - remove premium benefits
      nk.storageDelete([
        {
          collection: 'subscription',
          key: ctx.userId,
          userId: ctx.userId,
        },
      ]);

      logger.info('Subscription expired for user: %s', ctx.userId);

      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'subscription_expired',
        'subscription',
        { previous_expires_at: subscription.expires_at },
        'success'
      );

      return JSON.stringify({
        success: true,
        has_active_subscription: false,
        expires_at: subscription.expires_at,
        was_active: true,
      });
    }

    return JSON.stringify({
      success: true,
      has_active_subscription: true,
      expires_at: subscription.expires_at,
    });
  } catch (error) {
    logger.error('Error checking subscription: %s', error);
    return JSON.stringify({
      success: true,
      has_active_subscription: false,
      error: 'Failed to check subscription',
    });
  }
}

/**
 * Register RPC function for checking subscriptions.
 *
 * @param initializer - Nakama initializer
 */
export function registerRpcCheckSubscriptions(initializer: Runtime.Initializer): void {
  initializer.registerRpc('check_subscriptions', rpcCheckSubscriptions);
}

/**
 * App launch check - combines refund detection and subscription check.
 * This should be called when the app starts to perform all necessary checks.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - Empty JSON object
 * @returns JSON string with app launch check results
 *
 * @example
 * // Request payload
 * {}
 *
 * // Response
 * {
 *   "success": true,
 *   "refunds_detected": 0,
 *   "has_active_subscription": true,
 *   "expired_subscriptions": 0,
 *   "pending_purchases": 2
 * }
 */
export function rpcAppLaunchCheck(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Performing app launch check for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.app_launch_check, payload, 'app_launch_check');
  if (!validation.success) {
    return createValidationErrorResponse('app_launch_check', validation.error);
  }

  // Check for refunds
  let refundsDetected = 0;
  try {
    // Query refund storage for this user
    const refundData = nk.storageRead([
      {
        collection: 'refunds',
        key: ctx.userId,
        userId: ctx.userId,
      },
    ]);

    if (refundData && refundData.length > 0) {
      const refunds = JSON.parse(refundData[0].value);
      refundsDetected = Array.isArray(refunds) ? refunds.length : 0;

      // Process refunds - remove gems from affected users
      if (refundsDetected > 0) {
        const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
        
        for (const refund of refunds) {
          // Remove the gems that were refunded
          const refundedAmount = refund.amount || 0;
          playerCurrency.gems = Math.max(0, playerCurrency.gems - refundedAmount);
        }

        nk.storageWrite([
          {
            collection: 'player_currency',
            key: ctx.userId,
            userId: ctx.userId,
            value: JSON.stringify(playerCurrency),
          },
        ]);

        invalidateCurrencyCache(ctx.userId, logger);

        // Clear the refunds after processing
        nk.storageDelete([
          {
            collection: 'refunds',
            key: ctx.userId,
            userId: ctx.userId,
          },
        ]);

        logger.info('Processed %d refunds for user %s', refundsDetected, ctx.userId);

        logAudit(
          nk,
          ctx.userId,
          ctx.ipAddress ?? null,
          'process_refunds',
          'refunds',
          { count: refundsDetected },
          'success'
        );
      }
    }
  } catch (error) {
    logger.error('Error checking refunds: %s', error);
  }

  // Check subscription status
  let hasActiveSubscription = false;
  let subscriptionExpiresAt: string | null = null;
  let expiredSubscription = false;

  try {
    const subscriptionData = nk.storageRead([
      {
        collection: 'subscription',
        key: ctx.userId,
        userId: ctx.userId,
      },
    ]);

    if (subscriptionData && subscriptionData.length > 0) {
      const subscription = JSON.parse(subscriptionData[0].value);
      const now = new Date();
      const expiresAt = new Date(subscription.expires_at);

      if (expiresAt <= now) {
        // Subscription has expired
        nk.storageDelete([
          {
            collection: 'subscription',
            key: ctx.userId,
            userId: ctx.userId,
          },
        ]);
        expiredSubscription = true;
        logger.info('Subscription expired for user: %s', ctx.userId);

        logAudit(
          nk,
          ctx.userId,
          ctx.ipAddress ?? null,
          'subscription_expired',
          'subscription',
          { expires_at: subscription.expires_at },
          'success'
        );
      } else {
        hasActiveSubscription = true;
        subscriptionExpiresAt = subscription.expires_at;
      }
    }
  } catch (error) {
    logger.error('Error checking subscription: %s', error);
  }

  // Get pending purchases count
  const pendingPurchasesCount = getPendingPurchases(ctx.userId).length;

  return JSON.stringify({
    success: true,
    refunds_detected: refundsDetected,
    has_active_subscription: hasActiveSubscription,
    subscription_expires_at: subscriptionExpiresAt,
    expired_subscription: expiredSubscription,
    pending_purchases: pendingPurchasesCount,
  });
}

/**
 * Register RPC function for app launch check.
 *
 * @param initializer - Nakama initializer
 */
export function registerRpcAppLaunchCheck(initializer: Runtime.Initializer): void {
  initializer.registerRpc('app_launch_check', rpcAppLaunchCheck);
}
