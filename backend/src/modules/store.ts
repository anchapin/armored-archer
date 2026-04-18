/**
 * Store module.
 * @fileoverview Handles in-game purchases and currency management.
 * @description Includes refund handling, edge cases, and robust validation.
 */

import { createHash } from 'crypto';
import { Runtime } from '../types/nakama';
import { getRedisClient } from '../utils/redis';
import { getCacheManager } from '../utils/cache';
import { withCircuitBreaker } from '../utils/circuitBreaker';
import { safeParse } from '../utils/safeParse';
import { config } from '../config';
import { logAudit } from './audit';
import { isPII } from './privacy_compliance';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import { logger } from '../config/logger';

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
 * Maps webhook reason string to valid RefundReason enum.
 */
function mapWebhookReasonToRefundReason(reason: string | undefined): RefundReason {
  if (!reason) return RefundReason.OTHER;

  const normalizedReason = reason.toLowerCase().replace(/\s+/g, '_');

  switch (normalizedReason) {
    case 'customer_support':
      return RefundReason.CUSTOMER_SUPPORT;
    case 'chargeback':
      return RefundReason.CHARGEBACK;
    case 'duplicate':
      return RefundReason.DUPLICATE;
    case 'fraud':
      return RefundReason.FRAUD;
    default:
      return RefundReason.OTHER;
  }
}

/**
 * In-memory cache for validated receipts to reduce storage lookups.
 * Format: user_id -> Set of receipt hashes
 * Exported for testing purposes to allow clearing between tests.
 */
export const validatedReceipts: Map<string, Set<string>> = new Map();

/**
 * Cleanup job for in-memory receipt cache.
 * Removes entries older than 24 hours to prevent memory leaks.
 */
function cleanupOldReceipts(): void {
  // Simple cleanup strategy: clear all after a certain period if memory becomes an issue
  // In production, you would use a more sophisticated TTL-based cache like Redis
  if (validatedReceipts.size > 10000) {
    validatedReceipts.clear();
  }
}

// Run cleanup every hour (only in production, not during tests)
const _receiptCleanupInterval = process.env.NODE_ENV !== 'test'
  ? setInterval(cleanupOldReceipts, 60 * 60 * 1000)
  : null as unknown as NodeJS.Timeout;

/** Clear the receipt cleanup interval (for test teardown). */
export function stopReceiptCleanup(): void {
  if (_receiptCleanupInterval) {
    clearInterval(_receiptCleanupInterval);
  }
}

/**
 * Check if a receipt has already been used.
 * Uses Redis for persistence and distributed systems support.
 *
 * @param nk - Nakama server interface
 * @param userId - The user who submitted the receipt
 * @param receiptHash - Hash of the transaction receipt
 * @param logger - Nakama logger
 * @returns true if the receipt was already validated
 */
async function isReceiptAlreadyUsed(
  nk: Runtime.Nakama,
  userId: string,
  receiptHash: string,
  logger: Runtime.Logger
): Promise<boolean> {
  // 1. Try Redis first (distributed, high performance)
  const redis = getRedisClient(logger);
  if (redis) {
    try {
      const exists = await redis.exists(`receipt:${userId}:${receiptHash}`);
      if (exists) return true;
    } catch (e) {
      logger.error('Redis error in isReceiptAlreadyUsed: %s', e);
    }
  }

  // 2. Try in-memory cache
  const userReceipts = validatedReceipts.get(userId);
  if (userReceipts && userReceipts.has(receiptHash)) {
    return true;
  }

  // 3. Fallback to Nakama storage (persistent, distributed)
  try {
    const storageId = `receipt_${receiptHash}`;
    const objects = nk.storageRead([
      {
        collection: 'validated_receipts',
        key: storageId,
        userId: userId,
      },
    ]);
    return objects.length > 0;
  } catch (e) {
    logger.error('Storage read error in isReceiptAlreadyUsed: %s', e);
    return false;
  }
}

/**
 * Mark a receipt as used.
 * Uses Redis for persistence and distributed systems support.
 *
 * @param nk - Nakama server interface
 * @param userId - The user who submitted the receipt
 * @param receiptHash - Hash of the transaction receipt
 * @param logger - Nakama logger
 */
async function markReceiptAsUsed(
  nk: Runtime.Nakama,
  userId: string,
  receiptHash: string,
  logger: Runtime.Logger
): Promise<void> {
  // 1. Mark in Redis with 24h TTL
  const redis = getRedisClient(logger);
  if (redis) {
    try {
      await redis.setex(`receipt:${userId}:${receiptHash}`, 86400, '1');
    } catch (e) {
      logger.error('Redis error in markReceiptAsUsed: %s', e);
    }
  }

  // 2. Mark in-memory
  let userReceipts = validatedReceipts.get(userId);
  if (!userReceipts) {
    userReceipts = new Set();
    validatedReceipts.set(userId, userReceipts);
  }
  userReceipts.add(receiptHash);

  // 3. Persist in Nakama storage
  try {
    nk.storageWrite([
      {
        collection: 'validated_receipts',
        key: `receipt_${receiptHash}`,
        userId: userId,
        value: JSON.stringify({ validated_at: Date.now(), receipt_hash: receiptHash }),
        permissionRead: 0, // No public read
        permissionWrite: 0, // No public write
      },
    ]);
  } catch (e) {
    logger.error('Storage write error in markReceiptAsUsed: %s', e);
  }
}

/**
 * Cryptographic hash function for receipts using SHA-256 with salt.
 * This prevents collision attacks and replay attack manipulation.
 */
if (!process.env.RECEIPT_HASH_SALT) {
  logger.warn(
    '[SECURITY] RECEIPT_HASH_SALT not set - using fallback. Set this env var in production.'
  );
}

function hashReceipt(receipt: string): string {
  const salt = process.env.RECEIPT_HASH_SALT || 'armored_archer_secure_iap_salt_2024';
  return createHash('sha256')
    .update(receipt + salt)
    .digest('hex');
}

/**
 * Check if a refund has already been processed.
 * Uses Redis for persistence and distributed systems support.
 *
 * @param userId - The user who received the refund
 * @param refundTransactionId - Unique refund transaction identifier
 * @param logger - Optional Nakama logger
 * @returns true if the refund was already processed
 */
async function isRefundAlreadyProcessed(
  userId: string,
  refundTransactionId: string,
  logger?: Runtime.Logger
): Promise<boolean> {
  const redis = getRedisClient(logger);
  if (redis) {
    try {
      const exists = await redis.exists(`refund:${userId}:${refundTransactionId}`);
      if (exists) return true;
    } catch (e) {
      if (logger) logger.error('Redis error in isRefundAlreadyProcessed: %s', e);
    }
  }

  // For now we primarily use Redis for this, or you could add a Nakama storage check
  return false;
}

/**
 * Mark a refund as processed.
 * Uses Redis for persistence and distributed systems support.
 *
 * @param userId - The user who received the refund
 * @param refundTransactionId - Unique refund transaction identifier
 * @param logger - Optional Nakama logger
 */
async function markRefundAsProcessed(
  userId: string,
  refundTransactionId: string,
  logger?: Runtime.Logger
): Promise<void> {
  const redis = getRedisClient(logger);
  if (redis) {
    try {
      await redis.set(`refund:${userId}:${refundTransactionId}`, '1');
    } catch (e) {
      if (logger) logger.error('Redis error in markRefundAsProcessed: %s', e);
    }
  }
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
export async function processRefund(
  nk: Runtime.Nakama,
  userId: string,
  refundAmount: number,
  refundTransactionId: string,
  reason: RefundReason,
  logger: Runtime.Logger
): Promise<{ success: boolean; message: string; new_balance?: number }> {
  // Check for duplicate refund
  if (await isRefundAlreadyProcessed(userId, refundTransactionId, logger)) {
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
  await markRefundAsProcessed(userId, refundTransactionId, logger);

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
 * Cosmetic item data structure.
 * All cosmetic items are purely visual — they have zero combat stats.
 *
 * @property item_id - Unique skin identifier
 * @property name - Display name
 * @property slot - Equipment slot (helm, armor, bow, arrow, amulet)
 * @property base_gear_required - Base gear ID required to equip this skin
 * @property price - Gem cost
 * @property is_premium - Whether this is a premium (paid-only) skin
 */
export interface CosmeticItem {
  item_id: string;
  name: string;
  slot: string;
  base_gear_required: string;
  price: number;
  is_premium: boolean;
}

/**
 * Cosmetic catalog — the ONLY items purchasable with gems.
 * Every item is a visual skin with zero combat impact.
 * Combat stats come exclusively from base gear earned through gameplay.
 */
export const COSMETIC_CATALOG: Record<string, CosmeticItem> = {
  skin_helm_golden: { item_id: 'skin_helm_golden', name: 'Golden Helm', slot: 'helm', base_gear_required: 'helm_basic', price: 500, is_premium: true },
  skin_helm_crimson: { item_id: 'skin_helm_crimson', name: 'Crimson Helm', slot: 'helm', base_gear_required: 'helm_iron', price: 300, is_premium: false },
  skin_helm_shadow: { item_id: 'skin_helm_shadow', name: 'Shadow Helm', slot: 'helm', base_gear_required: 'helm_dragon', price: 1000, is_premium: true },
  skin_armor_knight: { item_id: 'skin_armor_knight', name: 'Knight Armor', slot: 'armor', base_gear_required: 'armor_leather', price: 600, is_premium: false },
  skin_armor_royal: { item_id: 'skin_armor_royal', name: 'Royal Armor', slot: 'armor', base_gear_required: 'armor_plate', price: 1200, is_premium: true },
  skin_armor_shadow: { item_id: 'skin_armor_shadow', name: 'Shadow Armor', slot: 'armor', base_gear_required: 'armor_chain', price: 800, is_premium: false },
  skin_bow_fire: { item_id: 'skin_bow_fire', name: 'Fire Bow', slot: 'bow', base_gear_required: 'bow_wooden', price: 400, is_premium: false },
  skin_bow_ice: { item_id: 'skin_bow_ice', name: 'Ice Bow', slot: 'bow', base_gear_required: 'bow_composite', price: 700, is_premium: false },
  skin_bow_lightning: { item_id: 'skin_bow_lightning', name: 'Lightning Bow', slot: 'bow', base_gear_required: 'bow_crossbow', price: 1500, is_premium: true },
  skin_arrow_fire: { item_id: 'skin_arrow_fire', name: 'Fire Arrows', slot: 'arrow', base_gear_required: 'arrow_wooden', price: 200, is_premium: false },
  skin_arrow_ice: { item_id: 'skin_arrow_ice', name: 'Ice Arrows', slot: 'arrow', base_gear_required: 'arrow_iron', price: 350, is_premium: false },
  skin_arrow_lightning: { item_id: 'skin_arrow_lightning', name: 'Lightning Arrows', slot: 'arrow', base_gear_required: 'arrow_dragon', price: 900, is_premium: true },
  skin_amulet_golden: { item_id: 'skin_amulet_golden', name: 'Golden Amulet', slot: 'amulet', base_gear_required: 'amulet_protection', price: 400, is_premium: false },
  skin_amulet_crystal: { item_id: 'skin_amulet_crystal', name: 'Crystal Amulet', slot: 'amulet', base_gear_required: 'amulet_power', price: 600, is_premium: false },
  skin_amulet_legendary: { item_id: 'skin_amulet_legendary', name: 'Legendary Amulet', slot: 'amulet', base_gear_required: 'amulet_dragon', price: 1200, is_premium: true },
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

/**
 * Validates purchase request and performs initial security checks
 */
function validatePurchaseRequest(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
):
  | { valid: true; request: { product_id: string; platform: string; transaction_receipt: string } }
  | { valid: false; error: string; errorCode?: string } {
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
    return { valid: false, error: validation.error, errorCode: 'VALIDATION_ERROR' };
  }

  const request = validation.data;

  // Check for PII in receipt data (privacy compliance)
  if (isPII(request.transaction_receipt)) {
    logger.warn('Potential PII detected in transaction receipt');
  }

  return { valid: true, request };
}

/**
 * Checks for duplicate receipts and validates platform
 */
async function validatePurchaseSecurity(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  request: { product_id: string; platform: string; transaction_receipt: string }
): Promise<string | null> {
  // Check for duplicate receipt to prevent replay attacks
  const receiptHash = hashReceipt(request.transaction_receipt);
  if (await isReceiptAlreadyUsed(nk, ctx.userId, receiptHash, logger)) {
    logger.warn('Duplicate receipt detected');
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
    return 'Duplicate receipt - this purchase has already been processed';
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
    return 'Invalid or unsupported platform';
  }

  return null;
}

/**
 * Validates the purchase with RevenueCat and checks product availability
 */
async function validatePurchaseWithRevenueCat(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  request: { product_id: string; platform: string; transaction_receipt: string }
): Promise<
  | { valid: true; gemBundle: { gem_amount: number } }
  | { valid: false; error: string; errorCode?: string }
> {
  // Validate receipt with RevenueCat server-side API for fraud protection
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
    return { valid: false, error: 'Purchase validation failed', errorCode: 'VALIDATION_FAILED' };
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
    return { valid: false, error: 'Invalid product ID' };
  }

  return { valid: true, gemBundle: catalog[request.product_id] };
}

/**
 * Checks purchase amount and balance limits
 */
function validatePurchaseLimits(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  request: { product_id: string; platform: string },
  gemBundle: { gem_amount: number }
): string | null {
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
    return 'Purchase amount exceeds maximum allowed';
  }

  return null;
}

/**
 * Awards gems to player after all validations pass
 */
async function awardGems(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  request: { product_id: string; platform: string; transaction_receipt: string },
  gemBundle: { gem_amount: number }
): Promise<{ success: true; gems_awarded: number; new_balance: number }> {
  const receiptHash = hashReceipt(request.transaction_receipt);

  // Mark receipt as used BEFORE awarding gems to prevent replay attacks
  await markReceiptAsUsed(nk, ctx.userId, receiptHash, logger);

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
    throw new Error('EXCEEDS_MAX_BALANCE');
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

  return {
    success: true,
    gems_awarded: gemBundle.gem_amount,
    new_balance: playerCurrency.gems,
  };
}

export async function rpcValidatePurchase(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Validating purchase');

  // Step 1: Validate payload
  const requestValidation = validatePurchaseRequest(ctx, logger, nk, payload);
  if (!requestValidation.valid) {
    return JSON.stringify({
      error: requestValidation.error,
      error_code: requestValidation.errorCode,
    });
  }
  const request = requestValidation.request;

  // Step 2: Check for duplicates and platform
  const securityError = await validatePurchaseSecurity(ctx, logger, nk, request);
  if (securityError) {
    return JSON.stringify({
      error: securityError,
      error_code: securityError.includes('Duplicate') ? 'DUPLICATE_RECEIPT' : 'INVALID_PLATFORM',
    });
  }

  // Step 3: Validate with RevenueCat
  const rcValidation = await validatePurchaseWithRevenueCat(ctx, logger, nk, request);
  if (!rcValidation.valid) {
    return JSON.stringify({ error: rcValidation.error, error_code: rcValidation.errorCode });
  }
  const gemBundle = rcValidation.gemBundle;

  // Step 4: Check purchase limits
  const limitsError = validatePurchaseLimits(ctx, logger, nk, request, gemBundle);
  if (limitsError) {
    return JSON.stringify({ error: limitsError, error_code: 'EXCESSIVE_AMOUNT' });
  }

  // Step 5: Award gems
  try {
    const result = await awardGems(ctx, logger, nk, request, gemBundle);
    return JSON.stringify({
      gems_awarded: result.gems_awarded,
      new_balance: result.new_balance,
      product_id: request.product_id,
      success: true,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'EXCEEDS_MAX_BALANCE') {
      return JSON.stringify({
        error: 'Purchase would exceed maximum gem balance',
        error_code: 'EXCEEDS_MAX_BALANCE',
      });
    }
    throw e;
  }
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
// COSMETIC-ONLY PURCHASE (gems → cosmetic skins)
// ============================================================

/**
 * Server-authoritative cosmetic purchase.
 * Gems can ONLY buy items from COSMETIC_CATALOG — all of which are
 * purely visual skins with zero combat stats. This is the sole gem
 * spending path for items and is enforced server-side.
 *
 * @param ctx - Nakama runtime context
 * @param logger - Nakama logger instance
 * @param nk - Nakama server interface
 * @param payload - JSON string with { item_id: string }
 * @returns JSON string with purchase result
 */
export function rpcPurchaseCosmetic(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Cosmetic purchase request from user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.purchase_cosmetic, payload, 'purchase_cosmetic');
  if (!validation.success) {
    logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'purchase_cosmetic', 'player_currency', { item_id: 'unknown' }, 'failure', validation.error);
    return createValidationErrorResponse('purchase_cosmetic', validation.error);
  }

  const { item_id } = validation.data;

  // Validate item exists in cosmetic catalog (rejects any non-cosmetic item)
  const cosmeticItem = COSMETIC_CATALOG[item_id];
  if (!cosmeticItem) {
    logger.warn('Cosmetic purchase rejected — item not in cosmetic catalog: %s', item_id);
    logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'purchase_cosmetic', 'player_currency', { item_id }, 'failure', 'Item not in cosmetic catalog');
    return JSON.stringify({ success: false, error: 'Invalid cosmetic item', error_code: 'INVALID_ITEM' });
  }

  // Check if player already owns this cosmetic
  const ownedResult = nk.storageRead([
    { collection: 'player_cosmetics_owned', key: ctx.userId, userId: ctx.userId },
  ]);
  let ownedItems: string[] = [];
  if (ownedResult.length > 0 && ownedResult[0].value) {
    const parsed = safeParse<{ items: string[] }>(ownedResult[0].value, null, logger, 'player_cosmetics_owned');
    if (parsed.success && parsed.data) {
      ownedItems = parsed.data.items ?? [];
    }
  }

  if (ownedItems.includes(item_id)) {
    logger.warn('Cosmetic purchase rejected — already owned: %s', item_id);
    logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'purchase_cosmetic', 'player_currency', { item_id }, 'failure', 'Already owned');
    return JSON.stringify({ success: false, error: 'Item already owned', error_code: 'ALREADY_OWNED' });
  }

  // Check gem balance
  const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
  if (playerCurrency.gems < cosmeticItem.price) {
    logger.warn('Cosmetic purchase rejected — insufficient gems: need %d, have %d', cosmeticItem.price, playerCurrency.gems);
    logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'purchase_cosmetic', 'player_currency', { item_id, price: cosmeticItem.price, balance: playerCurrency.gems }, 'failure', 'Insufficient gems');
    return JSON.stringify({ success: false, error: 'Insufficient gems', error_code: 'INSUFFICIENT_GEMS' });
  }

  // Deduct gems
  playerCurrency.gems -= cosmeticItem.price;
  nk.storageWrite([
    { collection: 'player_currency', key: ctx.userId, userId: ctx.userId, value: JSON.stringify(playerCurrency) },
  ]);
  nk.walletUpdate(ctx.userId, { gems: -cosmeticItem.price });
  invalidateCurrencyCache(ctx.userId, logger);

  // Record ownership
  ownedItems.push(item_id);
  nk.storageWrite([
    { collection: 'player_cosmetics_owned', key: ctx.userId, userId: ctx.userId, value: JSON.stringify({ items: ownedItems }) },
  ]);

  logger.info('Cosmetic purchased: user %s bought %s for %d gems (new balance: %d)', ctx.userId, item_id, cosmeticItem.price, playerCurrency.gems);
  logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'purchase_cosmetic', 'player_currency', { item_id, price: cosmeticItem.price, new_balance: playerCurrency.gems }, 'success');

  return JSON.stringify({
    success: true,
    item_id,
    price: cosmeticItem.price,
    new_balance: playerCurrency.gems,
  });
}

export function registerRpcPurchaseCosmetic(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/purchase_cosmetic', rpcPurchaseCosmetic);
}

/**
 * Returns the cosmetic catalog — all items purchasable with gems.
 * Every item is cosmetic-only with zero combat stats.
 */
export function rpcGetCosmeticCatalog(
  _ctx: Runtime.Context,
  logger: Runtime.Logger,
  _nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get cosmetic catalog request');
  const validation = validatePayload(ZodSchemas.get_cosmetic_catalog, payload, 'get_cosmetic_catalog');
  if (!validation.success) {
    return createValidationErrorResponse('get_cosmetic_catalog', validation.error);
  }
  return JSON.stringify({ success: true, catalog: COSMETIC_CATALOG });
}

export function registerRpcGetCosmeticCatalog(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_cosmetic_catalog', rpcGetCosmeticCatalog);
}

// ============================================================
// CROSS-DEVICE COSMETIC SYNC
// ============================================================

/**
 * Returns the player's owned cosmetic skin items.
 * Used for cross-device sync — a new device fetches this to restore purchases.
 */
export function rpcGetOwnedCosmetics(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Getting owned cosmetics for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_owned_cosmetics, payload, 'get_owned_cosmetics');
  if (!validation.success) {
    return createValidationErrorResponse('get_owned_cosmetics', validation.error);
  }

  const ownedResult = nk.storageRead([
    { collection: 'player_cosmetics_owned', key: ctx.userId, userId: ctx.userId },
  ]);

  let items: string[] = [];
  if (ownedResult.length > 0 && ownedResult[0].value) {
    const parsed = safeParse<{ items: string[] }>(ownedResult[0].value, null, logger, 'player_cosmetics_owned');
    if (parsed.success && parsed.data) {
      items = parsed.data.items ?? [];
    }
  }

  return JSON.stringify({ success: true, items });
}

export function registerRpcGetOwnedCosmetics(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_owned_cosmetics', rpcGetOwnedCosmetics);
}

/**
 * Returns the player's currently equipped cosmetic skins per slot.
 * Used for cross-device sync — a new device fetches this to restore loadout.
 */
export function rpcGetEquippedCosmetics(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Getting equipped cosmetics for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_equipped_cosmetics, payload, 'get_equipped_cosmetics');
  if (!validation.success) {
    return createValidationErrorResponse('get_equipped_cosmetics', validation.error);
  }

  const equipped = _readEquippedCosmetics(nk, ctx.userId, logger);

  return JSON.stringify({ success: true, equipped });
}

export function registerRpcGetEquippedCosmetics(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_equipped_cosmetics', rpcGetEquippedCosmetics);
}

/**
 * Equips a cosmetic skin to a specific slot.
 * Validates ownership and slot compatibility before persisting.
 */
export function rpcEquipCosmetic(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Equip cosmetic request from user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.equip_cosmetic, payload, 'equip_cosmetic');
  if (!validation.success) {
    logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'equip_cosmetic', 'player_cosmetics_equipped', { slot: 'unknown', skin_id: 'unknown' }, 'failure', validation.error);
    return createValidationErrorResponse('equip_cosmetic', validation.error);
  }

  const { slot, skin_id } = validation.data;

  // Validate skin exists in catalog
  const cosmeticItem = COSMETIC_CATALOG[skin_id];
  if (!cosmeticItem) {
    logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'equip_cosmetic', 'player_cosmetics_equipped', { slot, skin_id }, 'failure', 'Invalid cosmetic item');
    return JSON.stringify({ success: false, error: 'Invalid cosmetic item' });
  }

  // Validate slot matches
  if (cosmeticItem.slot !== slot) {
    logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'equip_cosmetic', 'player_cosmetics_equipped', { slot, skin_id, expected_slot: cosmeticItem.slot }, 'failure', 'Slot mismatch');
    return JSON.stringify({ success: false, error: `Skin belongs to slot ${cosmeticItem.slot}, not ${slot}` });
  }

  // Validate ownership
  const ownedResult = nk.storageRead([
    { collection: 'player_cosmetics_owned', key: ctx.userId, userId: ctx.userId },
  ]);
  let ownedItems: string[] = [];
  if (ownedResult.length > 0 && ownedResult[0].value) {
    const parsed = safeParse<{ items: string[] }>(ownedResult[0].value, null, logger, 'player_cosmetics_owned');
    if (parsed.success && parsed.data) {
      ownedItems = parsed.data.items ?? [];
    }
  }

  if (!ownedItems.includes(skin_id)) {
    logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'equip_cosmetic', 'player_cosmetics_equipped', { slot, skin_id }, 'failure', 'Not owned');
    return JSON.stringify({ success: false, error: 'You do not own this cosmetic item' });
  }

  // Update equipped state
  const equipped = _readEquippedCosmetics(nk, ctx.userId, logger);
  equipped[slot] = skin_id;
  _writeEquippedCosmetics(nk, ctx.userId, equipped, logger);

  logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'equip_cosmetic', 'player_cosmetics_equipped', { slot, skin_id }, 'success');
  logger.info('User %s equipped %s in slot %s', ctx.userId, skin_id, slot);

  return JSON.stringify({ success: true, slot, skin_id });
}

export function registerRpcEquipCosmetic(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/equip_cosmetic', rpcEquipCosmetic);
}

/**
 * Removes a cosmetic skin from a specific slot.
 */
export function rpcUnequipCosmetic(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Unequip cosmetic request from user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.unequip_cosmetic, payload, 'unequip_cosmetic');
  if (!validation.success) {
    return createValidationErrorResponse('unequip_cosmetic', validation.error);
  }

  const { slot } = validation.data;

  const equipped = _readEquippedCosmetics(nk, ctx.userId, logger);
  equipped[slot] = '';
  _writeEquippedCosmetics(nk, ctx.userId, equipped, logger);

  logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'unequip_cosmetic', 'player_cosmetics_equipped', { slot }, 'success');
  logger.info('User %s unequipped slot %s', ctx.userId, slot);

  return JSON.stringify({ success: true, slot });
}

export function registerRpcUnequipCosmetic(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/unequip_cosmetic', rpcUnequipCosmetic);
}

/**
 * Saves the full cosmetic loadout in one batch operation.
 * Validates all non-empty slots against ownership and catalog.
 * Used for cross-device sync when restoring loadout from another device.
 */
export function rpcSaveCosmeticLoadout(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Save cosmetic loadout request from user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.save_cosmetic_loadout, payload, 'save_cosmetic_loadout');
  if (!validation.success) {
    logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'save_cosmetic_loadout', 'player_cosmetics_equipped', {}, 'failure', validation.error);
    return createValidationErrorResponse('save_cosmetic_loadout', validation.error);
  }

  const { equipped } = validation.data;

  // Read current ownership for validation
  const ownedResult = nk.storageRead([
    { collection: 'player_cosmetics_owned', key: ctx.userId, userId: ctx.userId },
  ]);
  let ownedItems: string[] = [];
  if (ownedResult.length > 0 && ownedResult[0].value) {
    const parsed = safeParse<{ items: string[] }>(ownedResult[0].value, null, logger, 'player_cosmetics_owned');
    if (parsed.success && parsed.data) {
      ownedItems = parsed.data.items ?? [];
    }
  }

  // Validate each non-empty slot
  for (const [slot, skinId] of Object.entries(equipped)) {
    if (!skinId || (skinId as string).trim() === '') continue;

    const cosmeticItem = COSMETIC_CATALOG[skinId as string];
    if (!cosmeticItem) {
      logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'save_cosmetic_loadout', 'player_cosmetics_equipped', { slot, skin_id: skinId }, 'failure', 'Invalid cosmetic item');
      return JSON.stringify({ success: false, error: `Invalid cosmetic item: ${skinId}` });
    }

    if (cosmeticItem.slot !== slot) {
      logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'save_cosmetic_loadout', 'player_cosmetics_equipped', { slot, skin_id: skinId }, 'failure', 'Slot mismatch');
      return JSON.stringify({ success: false, error: `Skin ${skinId} belongs to slot ${cosmeticItem.slot}, not ${slot}` });
    }

    if (!ownedItems.includes(skinId as string)) {
      logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'save_cosmetic_loadout', 'player_cosmetics_equipped', { slot, skin_id: skinId }, 'failure', 'Not owned');
      return JSON.stringify({ success: false, error: `You do not own ${skinId}` });
    }
  }

  // All validated — persist
  _writeEquippedCosmetics(nk, ctx.userId, equipped as Record<string, string>, logger);

  logAudit(nk, ctx.userId, ctx.ipAddress ?? null, 'save_cosmetic_loadout', 'player_cosmetics_equipped', equipped, 'success');
  logger.info('User %s saved cosmetic loadout', ctx.userId);

  return JSON.stringify({ success: true, equipped });
}

export function registerRpcSaveCosmeticLoadout(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/save_cosmetic_loadout', rpcSaveCosmeticLoadout);
}

// --- Helper functions for equipped cosmetics storage ---

function _readEquippedCosmetics(
  nk: Runtime.Nakama,
  userId: string,
  logger: Runtime.Logger
): Record<string, string> {
  const defaults: Record<string, string> = { helm: '', armor: '', bow: '', arrow: '', amulet: '' };

  const result = nk.storageRead([
    { collection: 'player_cosmetics_equipped', key: userId, userId: userId },
  ]);

  if (result.length === 0 || !result[0].value) return defaults;

  const parsed = safeParse<Record<string, string>>(result[0].value, null, logger, 'player_cosmetics_equipped');
  if (!parsed.success || !parsed.data) return defaults;

  return { ...defaults, ...parsed.data };
}

function _writeEquippedCosmetics(
  nk: Runtime.Nakama,
  userId: string,
  equipped: Record<string, string>,
  _logger: Runtime.Logger
): void {
  nk.storageWrite([
    {
      collection: 'player_cosmetics_equipped',
      key: userId,
      userId: userId,
      value: JSON.stringify(equipped),
      permissionRead: 0,
      permissionWrite: 0,
    },
  ]);
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
 * Gets the RevenueCat API key from environment/config.
 * Checks process.env directly for runtime reactivity (test compatibility).
 * Returns undefined if not configured.
 */
function getRevenueCatApiKey(): string | undefined {
  return process.env.REVENUECAT_SECRET_KEY || config.revenuecat.secretKey || undefined;
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
    logger.error('RevenueCat API key not configured - strictly enforcing validation');
    return { valid: false, error: 'RevenueCat API key not configured' };
  }

  // RevenueCat endpoint for validating subscriptions
  const rcPlatform = platform === 'ios' ? 'apple' : 'google';

  // Wrap external API call with circuit breaker for resilience
  const validationResult = await withCircuitBreaker(
    'revenuecat',
    async () => {
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

      // Extract and verify product ID from RevenueCat response
      const subscriber = data.subscriber as Record<string, unknown> | undefined;
      let isVerified = false;

      if (subscriber) {
        // 1. Check entitlements (for subscriptions/features)
        if (subscriber.entitlements) {
          const entitlements = subscriber.entitlements as Record<string, any>;
          if (entitlements[productId]) {
            isVerified = true;
          } else {
            for (const ent of Object.values(entitlements)) {
              if (ent.product_id === productId) {
                isVerified = true;
                break;
              }
            }
          }
        }

        // 2. Check non_subscriptions (for consumables like gems)
        if (!isVerified && subscriber.non_subscriptions) {
          const nonSubscriptions = subscriber.non_subscriptions as Record<string, any[]>;
          if (nonSubscriptions[productId] && nonSubscriptions[productId].length > 0) {
            isVerified = true;
          }
        }

        // 3. Check active subscriptions
        if (!isVerified && subscriber.subscriptions) {
          const subscriptions = subscriber.subscriptions as Record<string, any>;
          if (subscriptions[productId]) {
            isVerified = true;
          }
        }
      }

      if (!isVerified) {
        logger.warn('Product ID mismatch or not found: claimed=%s', productId);
        return {
          valid: false,
          error: `Product ID verification failed: ${productId} not found in receipt`,
        };
      }

      logger.info('RevenueCat validation successful for user product: %s', productId);
      return {
        valid: true,
        subscriber,
        product_id: productId,
      };
    },
    // Fallback: fail closed if RevenueCat is unavailable (strict enforcement)
    async () => {
      logger.error('RevenueCat circuit open - failing closed for purchase validation');
      return { valid: false, error: 'Validation service temporarily unavailable' };
    }
  );

  return validationResult;
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
    if (await isReceiptAlreadyUsed(nk, ctx.userId, receiptHash, logger)) {
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
    await markReceiptAsUsed(nk, ctx.userId, receiptHash, logger);
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

  const appUserId = validation.data.app_user_id || ctx.userId;

  // Call RevenueCat API to get refund history
  // RevenueCat API endpoint: GET /subscribers/{app_user_id}
  // Wrap external API call with circuit breaker for resilience
  const refundResult = await withCircuitBreaker(
    'revenuecat',
    async () => {
      const response = await fetch(
        `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`,
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
        return {
          success: true,
          refunds_found: 0,
          message: 'Unable to check refunds',
          apiError: true,
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      const subscriber = data.subscriber as Record<string, unknown> | undefined;

      if (!subscriber) {
        return {
          success: true,
          refunds_found: 0,
          message: 'No subscriber found',
        };
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

      return { success: true, refunds, message: '' };
    },
    // Fallback: fail safe - return no refunds if circuit is open
    async () => {
      logger.warn('RevenueCat circuit open - skipping refund check');
      return {
        success: true,
        refunds_found: 0,
        message: 'Refund check unavailable',
        circuitOpen: true,
      };
    }
  );

  // Handle circuit breaker fallback result
  if ('apiError' in refundResult || 'circuitOpen' in refundResult) {
    return JSON.stringify(refundResult);
  }

  // Process any detected refunds
  const refunds = refundResult.refunds;
  if (!refunds) {
    logger.error('Refund result missing refunds array');
    return JSON.stringify({
      success: true,
      refunds_found: 0,
      message: 'Error processing refunds',
    });
  }

  let processedCount = 0;
  for (const refund of refunds) {
    if (
      !(await isRefundAlreadyProcessed(appUserId, refund.refunded_at, logger))
    ) {
      // Get product info to determine gem amount
      const catalog = getStoreCatalog(logger);
      const productInfo = catalog[refund.product_id];

      if (productInfo) {
        await processRefund(
          nk,
          appUserId,
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
    appUserId,
    refunds.length
  );

  return JSON.stringify({
    success: true,
    refunds_found: refunds.length,
    processed: processedCount,
    message: refunds.length > 0 ? `Found ${refunds.length} refunds` : 'No refunds detected',
  });
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

  const appUserId = validation.data.app_user_id || ctx.userId;

  // Call RevenueCat API to get subscription status
  // RevenueCat API endpoint: GET /subscribers/{app_user_id}
  // Wrap external API call with circuit breaker for resilience
  const subscriptionResult = await withCircuitBreaker(
    'revenuecat',
    async () => {
      const response = await fetch(
        `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`,
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
        return {
          success: true,
          active_subscriptions: [],
          message: 'Unable to check subscriptions',
          apiError: true,
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      const subscriber = data.subscriber as Record<string, unknown> | undefined;

      if (!subscriber) {
        return {
          success: true,
          active_subscriptions: [],
          message: 'No subscriber found',
        };
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

      return {
        success: true,
        active_subscriptions: activeSubscriptions,
        message:
          activeSubscriptions.length > 0
            ? `Found ${activeSubscriptions.length} active subscriptions`
            : 'No active subscriptions',
      };
    },
    // Fallback: fail safe - return no subscriptions if circuit is open
    async () => {
      logger.warn('RevenueCat circuit open - skipping subscription check');
      return {
        success: true,
        active_subscriptions: [],
        message: 'Subscription check unavailable',
        circuitOpen: true,
      };
    }
  );

  // Handle circuit breaker fallback result
  if ('apiError' in subscriptionResult || 'circuitOpen' in subscriptionResult) {
    return JSON.stringify(subscriptionResult);
  }

  logger.info(
    'Subscription check complete for user %s: %d active',
    appUserId,
    subscriptionResult.active_subscriptions.length
  );

  return JSON.stringify(subscriptionResult);
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
  const pendingResultRaw = await rpcProcessPendingPurchases(ctx, logger, nk, '{}');
  const pendingResult = safeParse<Record<string, unknown>>(
    pendingResultRaw,
    null,
    logger,
    'app_launch_check:pendingPurchases'
  );

  // Check for refunds
  const refundResultRaw = await rpcCheckRefunds(ctx, logger, nk, '{}');
  const refundResult = safeParse<Record<string, unknown>>(
    refundResultRaw,
    null,
    logger,
    'app_launch_check:refunds'
  );

  // Check subscriptions
  const subscriptionResultRaw = await rpcCheckSubscriptions(ctx, logger, nk, '{}');
  const subscriptionResult = safeParse<Record<string, unknown>>(
    subscriptionResultRaw,
    null,
    logger,
    'app_launch_check:subscriptions'
  );

  return JSON.stringify({
    success: true,
    pending_purchases: pendingResult.success ? pendingResult.data : { error: 'Parse failed' },
    refunds: refundResult.success ? refundResult.data : { error: 'Parse failed' },
    subscriptions: subscriptionResult.success ? subscriptionResult.data : { error: 'Parse failed' },
  });
}

export function registerRpcAppLaunchCheck(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/app_launch_check', rpcAppLaunchCheck);
}

// ============================================================
// RESTORE PURCHASES
// ============================================================

/**
 * Restore purchases for a user by querying RevenueCat for their purchase history
 * and awarding any gems that were purchased but not credited.
 */
export async function rpcRestorePurchases(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Restoring purchases for user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.restore_purchases, payload, 'restore_purchases');
  if (!validation.success) {
    return createValidationErrorResponse('restore_purchases', validation.error);
  }

  const request = validation.data;
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    logger.warn('RevenueCat API key not configured - cannot restore purchases');
    return JSON.stringify({
      success: false,
      error: 'Purchase restore not configured',
      restored: 0,
    });
  }

  // Query RevenueCat for subscriber/purchase history
  const restoreResult = await withCircuitBreaker(
    'revenuecat',
    async () => {
      const response = await fetch(
        `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(ctx.userId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-Platform': request.platform === 'ios' ? 'apple' : 'google',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('RevenueCat restore API error: %s - %s', response.status, errorText);
        return {
          success: false,
          error: 'Unable to query purchase history',
          restored: 0,
          apiError: true,
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      const subscriber = data.subscriber as Record<string, unknown> | undefined;

      if (!subscriber) {
        return { success: true, restored: 0, purchases: [] };
      }

      const catalog = getStoreCatalog(logger);
      const restoredPurchases: { product_id: string; gems_awarded: number }[] = [];

      // Check non_subscription purchases (consumables like gem packs)
      const nonSubscriptions = subscriber.non_subscriptions as
        | Record<string, unknown[]>
        | undefined;
      if (nonSubscriptions) {
        for (const [productId, purchases] of Object.entries(nonSubscriptions)) {
          const bundle = catalog[productId];
          if (!bundle) continue;

          for (const purchase of purchases) {
            const p = purchase as Record<string, unknown>;
            const transactionId = (p.id as string) || (p.transaction_id as string) || '';
            if (!transactionId) continue;

            // Check if we already processed this transaction
            const receiptHash = hashReceipt(transactionId);
            if (await isReceiptAlreadyUsed(nk, ctx.userId, receiptHash, logger)) {
              continue;
            }

            // Award gems and mark receipt
            const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
            if (!wouldExceedMaxBalance(playerCurrency.gems, bundle.gem_amount)) {
              await markReceiptAsUsed(nk, ctx.userId, receiptHash, logger);
              playerCurrency.gems += bundle.gem_amount;

              nk.storageWrite([
                {
                  collection: 'player_currency',
                  key: ctx.userId,
                  userId: ctx.userId,
                  value: JSON.stringify(playerCurrency),
                },
              ]);

              nk.walletUpdate(ctx.userId, { gems: bundle.gem_amount });
              invalidateCurrencyCache(ctx.userId, logger);

              restoredPurchases.push({
                product_id: productId,
                gems_awarded: bundle.gem_amount,
              });

              logger.info(
                'Restored purchase for user %s: %s (%d gems)',
                ctx.userId,
                productId,
                bundle.gem_amount
              );
            }
          }
        }
      }

      // Also check subscription entitlements
      const entitlements = subscriber.entitlements as Record<string, unknown> | undefined;
      if (entitlements) {
        for (const [_entitlementId, entitlement] of Object.entries(entitlements)) {
          const ent = entitlement as Record<string, unknown>;
          const productId = (ent.product_id as string) || '';
          const bundle = catalog[productId];
          if (!bundle) continue;

          const transactionId =
            (ent.transaction_id as string) || (ent.original_transaction_id as string) || '';
          if (!transactionId) continue;

          const receiptHash = hashReceipt(transactionId);
          if (await isReceiptAlreadyUsed(nk, ctx.userId, receiptHash, logger)) {
            continue;
          }

          const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
          if (!wouldExceedMaxBalance(playerCurrency.gems, bundle.gem_amount)) {
            await markReceiptAsUsed(nk, ctx.userId, receiptHash, logger);
            playerCurrency.gems += bundle.gem_amount;

            nk.storageWrite([
              {
                collection: 'player_currency',
                key: ctx.userId,
                userId: ctx.userId,
                value: JSON.stringify(playerCurrency),
              },
            ]);

            nk.walletUpdate(ctx.userId, { gems: bundle.gem_amount });
            invalidateCurrencyCache(ctx.userId, logger);

            restoredPurchases.push({
              product_id: productId,
              gems_awarded: bundle.gem_amount,
            });
          }
        }
      }

      return { success: true, restored: restoredPurchases.length, purchases: restoredPurchases };
    },
    async () => {
      logger.error('RevenueCat circuit open - cannot restore purchases');
      return {
        success: false,
        error: 'Restore service temporarily unavailable',
        restored: 0,
        apiError: true,
      } as const;
    }
  );

  if ('apiError' in restoreResult || 'circuitOpen' in restoreResult) {
    return JSON.stringify(restoreResult);
  }

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'restore_purchases',
    'player_currency',
    { platform: request.platform, restored: restoreResult.restored },
    'success'
  );

  return JSON.stringify(restoreResult);
}

export function registerRpcRestorePurchases(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/restore_purchases', rpcRestorePurchases);
}

// ============================================================
// REVENUECAT WEBHOOK HANDLER
// ============================================================

/**
 * RevenueCat webhook secret for signature verification.
 * Configure via REVENUECAT_WEBHOOK_SECRET environment variable.
 */
function getRevenueCatWebhookSecret(): string | undefined {
  return config.revenuecat.webhookSecret || process.env.REVENUECAT_WEBHOOK_SECRET;
}

/**
 * Verify RevenueCat webhook signature (HMAC-SHA256).
 * This ensures the webhook request actually came from RevenueCat.
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  const crypto = require('crypto');
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Map RevenueCat product ID to gem amount.
 */
function getGemAmountForProduct(productId: string, logger: Runtime.Logger): number | null {
  const catalog = getStoreCatalog(logger);
  const bundle = catalog[productId];
  return bundle ? bundle.gem_amount : null;
}

/**
 * Handle initial purchase event - award gems to player.
 */
async function handleInitialPurchase(
  nk: Runtime.Nakama,
  userId: string,
  productId: string,
  logger: Runtime.Logger,
  eventType: string = 'initial_purchase'
): Promise<{
  success: boolean;
  message: string;
  gems_awarded?: number;
  new_balance?: number;
  event_type?: string;
}> {
  const gemAmount = getGemAmountForProduct(productId, logger);

  if (!gemAmount) {
    logger.error('Unknown product ID in webhook: %s', productId);
    return { success: false, message: 'Unknown product ID', event_type: eventType };
  }

  // Get current player currency
  const playerCurrency = getPlayerCurrencyWithCache(nk, userId, logger);

  // Check for max balance
  if (wouldExceedMaxBalance(playerCurrency.gems, gemAmount)) {
    logger.warn('Purchase would exceed max balance for user %s', userId);
    return {
      success: false,
      message: 'Gem balance would exceed maximum',
      gems_awarded: 0,
      new_balance: playerCurrency.gems,
      event_type: eventType,
    };
  }

  // Award gems
  playerCurrency.gems += gemAmount;

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
    gems: gemAmount,
  });

  // Invalidate cache
  invalidateCurrencyCache(userId, logger);

  logger.info('Webhook: Awarded %d gems to user %s for product %s', gemAmount, userId, productId);

  return {
    success: true,
    message: 'Gems awarded',
    gems_awarded: gemAmount,
    new_balance: playerCurrency.gems,
    event_type: eventType,
  };
}

/**
 * Handle non-renewal/cancellation event.
 */
function handleSubscriptionCancelled(
  nk: Runtime.Nakama,
  userId: string,
  productId: string,
  reason: string | undefined,
  logger: Runtime.Logger,
  eventType: string = 'cancellation'
): { success: boolean; message?: string; event_type?: string; error?: string } {
  logger.info(
    'Webhook: Subscription cancelled for user %s, product %s, reason: %s',
    userId,
    productId,
    reason || 'not specified'
  );

  // Mark subscription as cancelled in storage
  const subscriptionKey = userId;
  const existingData = nk.storageRead([
    {
      collection: 'player_subscription',
      key: subscriptionKey,
      userId: userId,
    },
  ]);

  if (existingData && existingData.length > 0) {
    const value = existingData[0].value;
    // Handle empty or non-JSON values
    if (!value || typeof value !== 'string') {
      logger.warn('No valid subscription data found for user %s', userId);
      return {
        success: true,
        message: 'Cancellation noted (no subscription found)',
        event_type: eventType,
      };
    }
    let subscription: Record<string, unknown>;
    try {
      subscription = JSON.parse(value);
    } catch (e) {
      logger.error('Failed to parse subscription data for user %s: %s', userId, e);
      return { success: false, error: 'Invalid subscription data' };
    }
    subscription.active = false;
    subscription.cancelled = true;
    subscription.cancelled_at = new Date().toISOString();
    subscription.cancel_reason = reason || 'user_cancelled';

    nk.storageWrite([
      {
        collection: 'player_subscription',
        key: subscriptionKey,
        value: JSON.stringify(subscription),
        userId: userId,
      },
    ]);
  }

  return { success: true, message: 'Cancellation noted', event_type: eventType };
}

/**
 * Handle billing issue event (e.g., payment failed, card expired).
 */
function handleBillingIssue(
  nk: Runtime.Nakama,
  userId: string,
  productId: string,
  logger: Runtime.Logger,
  eventType: string = 'billing_issue'
): { success: boolean; message?: string; event_type?: string; error?: string } {
  logger.info('Webhook: Billing issue for user %s, product %s', userId, productId);

  // Mark subscription as having billing issues
  const subscriptionKey = userId;
  const existingData = nk.storageRead([
    {
      collection: 'player_subscription',
      key: subscriptionKey,
      userId: userId,
    },
  ]);

  if (existingData && existingData.length > 0) {
    const value = existingData[0].value;
    // Handle empty or non-JSON values
    if (!value || typeof value !== 'string') {
      logger.warn('No valid subscription data found for user %s', userId);
      return {
        success: true,
        message: 'Billing issue recorded (no subscription found)',
        event_type: eventType,
      };
    }
    let subscription: Record<string, unknown>;
    try {
      subscription = JSON.parse(value);
    } catch (e) {
      logger.error('Failed to parse subscription data for user %s: %s', userId, e);
      return { success: false, error: 'Invalid subscription data' };
    }
    subscription.billing_issue = true;
    subscription.billing_issue_at = new Date().toISOString();

    nk.storageWrite([
      {
        collection: 'player_subscription',
        key: subscriptionKey,
        value: JSON.stringify(subscription),
        userId: userId,
      },
    ]);
  }

  return { success: true, message: 'Billing issue recorded', event_type: eventType };
}

/**
 * Handle subscription expiration.
 */
function handleSubscriptionExpired(
  _nk: Runtime.Nakama,
  userId: string,
  productId: string,
  reason: string | undefined,
  logger: Runtime.Logger,
  eventType: string = 'expiration'
): { success: boolean; message: string; event_type?: string } {
  logger.info(
    'Webhook: Subscription expired for user %s, product %s, reason: %s',
    userId,
    productId,
    reason || 'not specified'
  );

  return { success: true, message: 'Expiration noted', event_type: eventType };
}

/**
 * Handle product transfer (account migration).
 */
async function handleProductChange(
  nk: Runtime.Nakama,
  userId: string,
  transferredFrom: string,
  productId: string,
  logger: Runtime.Logger
): Promise<{ success: boolean; message: string; event_type?: string }> {
  logger.info(
    'Webhook: Product transferred from %s to %s for product %s',
    transferredFrom,
    userId,
    productId
  );

  // For subscription product changes, just record the change without awarding gems
  // (premium subscriptions don't award gems, only consumable gem packs do)
  return { success: true, message: 'Product change noted', event_type: 'product_change' };
}

/**
 * RevenueCat webhook handler.
 * Processes incoming webhooks from RevenueCat.
 */
export async function rpcRevenueCatWebhook(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Processing RevenueCat webhook');

  // Get webhook secret for signature verification
  const webhookSecret = getRevenueCatWebhookSecret();

  // Verify webhook signature if secret is configured
  if (webhookSecret) {
    const signature = ctx.variables['x-revenuecat-signature'] || '';

    if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
      logger.error('Invalid webhook signature');
      return JSON.stringify({
        success: false,
        error: 'Invalid signature',
      });
    }
  } else {
    logger.warn('RevenueCat webhook secret not configured - skipping signature verification');
  }

  // Parse webhook payload
  let webhookData: Record<string, unknown>;
  try {
    webhookData = JSON.parse(payload) as Record<string, unknown>;
  } catch (e) {
    logger.error('Failed to parse webhook payload: %s', e);
    return JSON.stringify({
      success: false,
      error: 'Invalid payload',
    });
  }

  // Validate payload is not empty
  if (!payload || payload.trim() === '') {
    logger.error('Empty webhook payload received');
    return JSON.stringify({
      success: false,
      error: 'Invalid payload',
    });
  }

  // Extract event type (check top-level first for test payloads, then nested under "event")
  const eventObj = webhookData.event as Record<string, unknown> | undefined;
  const eventType =
    (webhookData.event_type as string) ||
    (webhookData.eventType as string) ||
    (eventObj?.event_type as string) ||
    (eventObj?.type as string) ||
    (webhookData.type as string) ||
    '';

  // Normalize event type to lowercase for case-insensitive matching
  const normalizedEventType = eventType.toLowerCase();

  // Extract common fields (check top-level first for test payloads, then nested under "event")
  const appUserId =
    (webhookData.app_user_id as string) || // Check top-level first (test payloads)
    (webhookData.appUserId as string) ||
    (webhookData.user_id as string) ||
    (webhookData.userId as string) ||
    (eventObj?.app_user_id as string) ||
    (eventObj?.appUserId as string) ||
    '';
  const productId =
    (webhookData.product_id as string) || // Check top-level first (test payloads)
    (webhookData.productId as string) ||
    (eventObj?.product_id as string) ||
    (eventObj?.productId as string) ||
    '';

  if (!appUserId) {
    logger.error('Missing app_user_id in webhook payload');
    return JSON.stringify({ success: false, error: 'Missing app_user_id' });
  }

  let result: {
    success: boolean;
    message?: string;
    event_type?: string;
    error?: string;
    gems_awarded?: number;
    new_balance?: number;
  };

  switch (normalizedEventType) {
    case 'initial_purchase':
    case 'renewal':
      result = await handleInitialPurchase(nk, appUserId, productId, logger, normalizedEventType);
      break;
    case 'cancellation':
    case 'uncancellation':
    case 'non_renewing_purchase_cancelled':
      result = handleSubscriptionCancelled(
        nk,
        appUserId,
        productId,
        webhookData.reason as string,
        logger,
        normalizedEventType
      );
      break;
    case 'billing_issue':
      result = handleBillingIssue(nk, appUserId, productId, logger, normalizedEventType);
      break;
    case 'expiration':
      result = handleSubscriptionExpired(
        nk,
        appUserId,
        productId,
        webhookData.reason as string,
        logger,
        normalizedEventType
      );
      break;
    case 'transfer':
    case 'product_change':
      result = await handleProductChange(
        nk,
        appUserId,
        webhookData.transferred_from as string,
        productId,
        logger
      );
      break;
    case 'refund':
      const refundAmount = getGemAmountForProduct(productId, logger) || 0;
      // Map webhook reason to valid RefundReason enum
      const refundReason = mapWebhookReasonToRefundReason(webhookData.reason as string | undefined);
      const refundResult = await processRefund(
        nk,
        appUserId,
        refundAmount,
        (webhookData.transaction_id as string) ||
          (webhookData.refund_transaction_id as string) ||
          '',
        refundReason,
        logger
      );
      result = refundResult;
      break;
    default:
      logger.info('Webhook: Received unhandled event type: %s', eventType);
      result = {
        success: true,
        message: `Event ${eventType} noted but not processed`,
        event_type: normalizedEventType,
      };
  }

  return JSON.stringify(result);
}

export function registerRpcRevenueCatWebhook(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/revenuecat_webhook', rpcRevenueCatWebhook);
}
