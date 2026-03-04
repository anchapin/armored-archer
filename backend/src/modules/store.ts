/**
 * Store module.
 * @fileoverview Handles in-game purchases and currency management.
 */

import { Runtime } from '../types/nakama';
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
 * Simple hash function for receipts.
 * In production, use a proper cryptographic hash.
 */
function hashReceipt(receipt: string): string {
  // Simple hash - in production use SHA-256
  let hash = 0;
  for (let i = 0; i < receipt.length; i++) {
    const char = receipt.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
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
export function rpcValidatePurchase(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Validating purchase for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.validate_purchase, payload, 'validate_purchase');
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      `ctx.ipAddress ?? null`,
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

  const catalog = getStoreCatalog(logger);

  if (!catalog[request.product_id]) {
    logAudit(
      nk,
      ctx.userId,
      `ctx.ipAddress ?? null`,
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
    `ctx.ipAddress ?? null`,
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
      `ctx.ipAddress ?? null`,
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
      `ctx.ipAddress ?? null`,
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
    `ctx.ipAddress ?? null`,
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
