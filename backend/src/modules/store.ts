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
import { safeParse, safeParsePayload } from '../utils/safeParse';
import { config } from '../config';
import { logAudit } from './audit';
import { isPII } from './privacy_compliance';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';
import { logger } from '../config/logger';
import {
  getCurrency,
  invalidateCurrencyCache as invalidateLedgerCache,
  readNormalizedCurrencyRecord,
  applyCurrencyDelta,
  MAX_GEM_BALANCE,
  PlayerCurrency,
} from './currency';
import {
  recordWebhookEvent,
  recordWebhookProcessingTime,
  setWebhookPendingAwards,
  incrementWebhookRedisError,
  setWebhookConfigured,
  recordPurchase,
  recordRevenue,
} from './metrics';
import { toStorageValue, getStorageRawValue } from '../utils/storage-helpers';

// The player_currency storage record is the single currency ledger
// (issue #860). The Nakama wallet is no longer written by this module; all
// balances — earned and purchased — live in the storage record that
// get_currency/spend_gems read. Re-exported for existing importers.
export type { PlayerCurrency } from './currency';

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
const _receiptCleanupInterval =
  process.env.NODE_ENV !== 'test'
    ? setInterval(cleanupOldReceipts, 60 * 60 * 1000)
    : (null as unknown as NodeJS.Timeout);

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
        value: toStorageValue({ validated_at: Date.now(), receipt_hash: receiptHash }),
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
 * Storage collection holding durable refund dedup markers (issue #1067).
 * Redis markers are only a cache; these records are the authority that
 * keeps refunds at-most-once across Redis outages.
 */
const REFUND_MARKER_COLLECTION = 'refund_markers';

/** Redis TTL for refund dedup cache markers (30 days — no unbounded keys). */
const REFUND_MARKER_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Outcome of a refund dedup check.
 * - 'processed'   — a durable (or cached) marker exists; do not re-apply
 * - 'unprocessed' — no marker found; safe to proceed
 * - 'unavailable' — the authoritative storage check itself failed; the
 *   caller must fail safe (reject so RevenueCat retries later)
 */
type RefundDedupStatus = 'processed' | 'unprocessed' | 'unavailable';

/**
 * Check if a refund has already been processed.
 *
 * Redis is a fast-path cache only; the durable Nakama storage marker is
 * the authority. Redis errors fall through to storage instead of failing
 * open (issue #1067), and a storage error surfaces as 'unavailable' so
 * callers can reject rather than risk a double deduction.
 *
 * @param nk - Nakama server interface
 * @param userId - The user who received the refund
 * @param refundTransactionId - Unique refund transaction identifier
 * @param logger - Optional Nakama logger
 * @returns The dedup status for this refund transaction
 */
async function checkRefundProcessed(
  nk: Runtime.Nakama,
  userId: string,
  refundTransactionId: string,
  logger?: Runtime.Logger
): Promise<RefundDedupStatus> {
  // 1. Redis fast path (cache only — errors fall through to storage)
  const redis = getRedisClient(logger);
  if (redis) {
    try {
      const exists = await redis.exists(`refund:${userId}:${refundTransactionId}`);
      if (exists) return 'processed';
    } catch (e) {
      if (logger) {
        logger.error(
          'Redis error in refund dedup check, falling back to durable storage: %s',
          e
        );
      }
    }
  }

  // 2. Durable Nakama storage marker (authoritative)
  try {
    const objects = nk.storageRead([
      {
        collection: REFUND_MARKER_COLLECTION,
        key: `refund_${refundTransactionId}`,
        userId: userId,
      },
    ]);
    return objects.length > 0 ? 'processed' : 'unprocessed';
  } catch (e) {
    if (logger) logger.error('Storage read error in refund dedup check: %s', e);
    return 'unavailable';
  }
}

/**
 * Mark a refund as processed.
 *
 * Writes the durable Nakama storage marker first (a versioned,
 * optimistic-concurrency write), then the Redis cache marker with a TTL.
 * Redis is best-effort: losing the cache entry only costs a storage read.
 *
 * @param nk - Nakama server interface
 * @param userId - The user who received the refund
 * @param refundTransactionId - Unique refund transaction identifier
 * @param outcome - Recorded refund outcome (deducted amount, balances)
 * @param logger - Optional Nakama logger
 * @returns true if the durable marker was written successfully
 */
async function markRefundAsProcessed(
  nk: Runtime.Nakama,
  userId: string,
  refundTransactionId: string,
  outcome: Record<string, unknown>,
  logger?: Runtime.Logger
): Promise<boolean> {
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      let version: string | undefined;
      const existing = nk.storageRead([
        {
          collection: REFUND_MARKER_COLLECTION,
          key: `refund_${refundTransactionId}`,
          userId: userId,
        },
      ]);
      if (existing.length > 0) {
        version = existing[0].version;
      }

      nk.storageWrite([
        {
          collection: REFUND_MARKER_COLLECTION,
          key: `refund_${refundTransactionId}`,
          userId: userId,
          value: toStorageValue({
            refund_transaction_id: refundTransactionId,
            user_id: userId,
            processed_at: Date.now(),
            outcome: outcome,
          }),
          version: version,
          permissionRead: 0,
          permissionWrite: 0,
        },
      ]);

      const redis = getRedisClient(logger);
      if (redis) {
        try {
          await redis.setex(
            `refund:${userId}:${refundTransactionId}`,
            REFUND_MARKER_TTL_SECONDS,
            '1'
          );
        } catch (e) {
          if (logger) logger.error('Redis error in markRefundAsProcessed: %s', e);
        }
      }
      return true;
    } catch (e) {
      if (attempt < MAX_ATTEMPTS) {
        if (logger) {
          logger.warn(
            'Refund marker write conflict for %s/%s on attempt %d, retrying: %s',
            userId,
            refundTransactionId,
            attempt,
            e
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
        continue;
      }
      if (logger) logger.error('Storage write error in markRefundAsProcessed: %s', e);
      return false;
    }
  }
  return false;
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
): Promise<{ success: boolean; message: string; new_balance?: number; error_code?: string }> {
  // A refund without an identifier cannot be deduplicated — refuse it
  // rather than allow a repeatable deduction (issue #1067).
  if (!refundTransactionId) {
    logger.error('Refund rejected: missing refund transaction id for user %s', userId);
    return { success: false, message: 'Missing refund transaction id' };
  }

  // Check for duplicate refund. The durable storage marker is the
  // authority; Redis is only a cache. When the authoritative check itself
  // is unavailable we fail safe — reject so RevenueCat retries later
  // instead of risking a double deduction (issue #1067).
  const dedupStatus = await checkRefundProcessed(nk, userId, refundTransactionId, logger);
  if (dedupStatus === 'processed') {
    logger.warn(
      'Duplicate refund detected for user: %s, transaction: %s',
      userId,
      refundTransactionId
    );
    return { success: false, message: 'Refund already processed' };
  }
  if (dedupStatus === 'unavailable') {
    logger.error(
      'Refund dedup check unavailable for user: %s, transaction: %s — failing safe',
      userId,
      refundTransactionId
    );
    return { success: false, message: 'Refund dedup check unavailable' };
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

  // Apply the deduction through the authoritative currency ledger (atomic,
  // version-guarded OCC write — issue #1067: webhook-driven currency
  // mutations never use plain storageWrite).
  let newBalance = playerCurrency.gems;
  if (deduction > 0) {
    const updated = applyCurrencyDelta(nk, userId, { gems: -deduction }, 'refund', logger);
    newBalance = updated.gems;
  }

  // Durable dedup marker first, Redis cache second (best-effort).
  //
  // Issue #1131: a previous revision swallowed the marker's `false` return
  // and reported success:true. That left the webhook caller (RevenueCat)
  // thinking the refund was durable while the marker was missing — the
  // next webhook for the same event_id passed the dedup check and the user
  // was deducted a second time. The compensating flow below keeps the
  // idempotency contract atomic from the webhook caller's perspective:
  // either BOTH the currency delta and the marker land, or NEITHER does.
  let marked: boolean;
  try {
    marked = await markRefundAsProcessed(
      nk,
      userId,
      refundTransactionId,
      {
        refund_amount: refundAmount,
        actual_deducted: deduction,
        new_balance: newBalance,
        reason: reason,
      },
      logger
    );
  } catch (e) {
    // markRefundAsProcessed is engineered to swallow storage errors and
    // return false, but anything that escapes (e.g. an unexpected throw
    // from a downstream helper) is treated as the same failure mode.
    logger.error(
      'markRefundAsProcessed threw for user %s, transaction %s: %s',
      userId,
      refundTransactionId,
      e
    );
    marked = false;
  }

  if (!marked) {
    // Compensate the deduction so the user's balance reflects "nothing
    // happened yet". Going through the authoritative ledger keeps the
    // rollback itself OCC-safe and audit-trailed — applyCurrencyDelta
    // emits its own currency_delta audit record with source
    // 'refund_rollback' (issue #1067).
    //
    // If the rollback itself fails, we still surface PERSISTENCE_FAILED —
    // there is no safe way to "undo an undo" from inside this function,
    // and silently claiming success would re-introduce the original bug.
    // Operators reconcile the inconsistency from the audit trail.
    if (deduction > 0) {
      try {
        applyCurrencyDelta(
          nk,
          userId,
          { gems: deduction },
          'refund_rollback',
          logger
        );
      } catch (rollbackErr) {
        logger.error(
          'CRITICAL: refund rollback failed for user %s, transaction %s after marker-write failure — manual reconciliation required: %s',
          userId,
          refundTransactionId,
          rollbackErr
        );
      }
    }

    logAudit(
      nk,
      userId,
      null,
      'process_refund_persistence_failed',
      'refund_markers',
      {
        refund_transaction_id: refundTransactionId,
        refund_amount: refundAmount,
        actual_deducted: deduction,
        reason: reason,
      },
      'failure',
      'Durable dedup marker write failed after retry; deduction rolled back'
    );

    logger.error(
      'Refund deduction rolled back for user %s, transaction %s — durable marker write failed, returning PERSISTENCE_FAILED',
      userId,
      refundTransactionId
    );

    return {
      success: false,
      message: 'Refund persistence failed; safe to retry',
      error_code: 'PERSISTENCE_FAILED',
    };
  }

  // Log the refund for audit
  const refundDetails = {
    refund_amount: refundAmount,
    actual_deducted: deduction,
    new_balance: newBalance,
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
    newBalance,
    reason
  );

  return {
    success: true,
    message: deduction < refundAmount ? 'Partial refund applied' : 'Refund processed successfully',
    new_balance: newBalance,
  };
}

/**
 * Player currency data structure lives in modules/currency.ts (issue #860):
 * the `player_currency` storage record is the single ledger. `coins` holds
 * the canonical "Coins" soft currency (renamed from `gold` in issue #866;
 * legacy records are folded lazily on read — zero balance loss).
 */

/**
 * Retrieves player currency with caching.
 *
 * Delegates to the authoritative currency ledger (modules/currency.ts),
 * which also runs the one-time legacy wallet bridge (issue #860).
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
  return getCurrency(nk, userId, logger);
}

/**
 * Invalidates player currency cache.
 *
 * Delegates to the authoritative currency ledger (modules/currency.ts).
 *
 * @param userId - ID of the player to invalidate cache for
 * @param logger - Nakama logger instance
 */
function invalidateCurrencyCache(userId: string, logger: Runtime.Logger): void {
  invalidateLedgerCache(userId, logger);
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
  is_launch_exclusive?: boolean;
}

/**
 * Cosmetic catalog — the ONLY items purchasable with gems.
 * Every item is a visual skin with zero combat impact.
 * Combat stats come exclusively from base gear earned through gameplay.
 */
export const COSMETIC_CATALOG: Record<string, CosmeticItem> = {
  skin_helm_golden: {
    item_id: 'skin_helm_golden',
    name: 'Golden Helm',
    slot: 'helm',
    base_gear_required: 'helm_basic',
    price: 500,
    is_premium: true,
  },
  skin_helm_crimson: {
    item_id: 'skin_helm_crimson',
    name: 'Crimson Helm',
    slot: 'helm',
    base_gear_required: 'helm_iron',
    price: 300,
    is_premium: false,
  },
  skin_helm_shadow: {
    item_id: 'skin_helm_shadow',
    name: 'Shadow Helm',
    slot: 'helm',
    base_gear_required: 'helm_dragon',
    price: 1000,
    is_premium: true,
  },
  skin_armor_knight: {
    item_id: 'skin_armor_knight',
    name: 'Knight Armor',
    slot: 'armor',
    base_gear_required: 'armor_leather',
    price: 600,
    is_premium: false,
  },
  skin_armor_royal: {
    item_id: 'skin_armor_royal',
    name: 'Royal Armor',
    slot: 'armor',
    base_gear_required: 'armor_plate',
    price: 1200,
    is_premium: true,
  },
  skin_armor_shadow: {
    item_id: 'skin_armor_shadow',
    name: 'Shadow Armor',
    slot: 'armor',
    base_gear_required: 'armor_chain',
    price: 800,
    is_premium: false,
  },
  skin_bow_fire: {
    item_id: 'skin_bow_fire',
    name: 'Fire Bow',
    slot: 'bow',
    base_gear_required: 'bow_wooden',
    price: 400,
    is_premium: false,
  },
  skin_bow_ice: {
    item_id: 'skin_bow_ice',
    name: 'Ice Bow',
    slot: 'bow',
    base_gear_required: 'bow_composite',
    price: 700,
    is_premium: false,
  },
  skin_bow_lightning: {
    item_id: 'skin_bow_lightning',
    name: 'Lightning Bow',
    slot: 'bow',
    base_gear_required: 'bow_crossbow',
    price: 1500,
    is_premium: true,
  },
  skin_arrow_fire: {
    item_id: 'skin_arrow_fire',
    name: 'Fire Arrows',
    slot: 'arrow',
    base_gear_required: 'arrow_wooden',
    price: 200,
    is_premium: false,
  },
  skin_arrow_ice: {
    item_id: 'skin_arrow_ice',
    name: 'Ice Arrows',
    slot: 'arrow',
    base_gear_required: 'arrow_iron',
    price: 350,
    is_premium: false,
  },
  skin_arrow_lightning: {
    item_id: 'skin_arrow_lightning',
    name: 'Lightning Arrows',
    slot: 'arrow',
    base_gear_required: 'arrow_dragon',
    price: 900,
    is_premium: true,
  },
  skin_amulet_golden: {
    item_id: 'skin_amulet_golden',
    name: 'Golden Amulet',
    slot: 'amulet',
    base_gear_required: 'amulet_protection',
    price: 400,
    is_premium: false,
  },
  skin_amulet_crystal: {
    item_id: 'skin_amulet_crystal',
    name: 'Crystal Amulet',
    slot: 'amulet',
    base_gear_required: 'amulet_power',
    price: 600,
    is_premium: false,
  },
  skin_amulet_legendary: {
    item_id: 'skin_amulet_legendary',
    name: 'Legendary Amulet',
    slot: 'amulet',
    base_gear_required: 'amulet_dragon',
    price: 1200,
    is_premium: true,
  },
  // Founder's Arsenal — launch exclusive cosmetic set (zero combat stats)
  skin_helm_founders: {
    item_id: 'skin_helm_founders',
    name: "Founder's Helm",
    slot: 'helm',
    base_gear_required: 'helm_basic',
    price: 400,
    is_premium: false,
    is_launch_exclusive: true,
  },
  skin_armor_founders: {
    item_id: 'skin_armor_founders',
    name: "Founder's Armor",
    slot: 'armor',
    base_gear_required: 'armor_leather',
    price: 500,
    is_premium: false,
    is_launch_exclusive: true,
  },
  skin_bow_founders: {
    item_id: 'skin_bow_founders',
    name: "Founder's Bow",
    slot: 'bow',
    base_gear_required: 'bow_wooden',
    price: 450,
    is_premium: false,
    is_launch_exclusive: true,
  },
  skin_arrow_founders: {
    item_id: 'skin_arrow_founders',
    name: "Founder's Arrows",
    slot: 'arrow',
    base_gear_required: 'arrow_wooden',
    price: 250,
    is_premium: false,
    is_launch_exclusive: true,
  },
  skin_amulet_founders: {
    item_id: 'skin_amulet_founders',
    name: "Founder's Amulet",
    slot: 'amulet',
    base_gear_required: 'amulet_protection',
    price: 350,
    is_premium: false,
    is_launch_exclusive: true,
  },
};

/**
 * Cosmetic bundle definition.
 * Bundles package multiple cosmetic items at a discounted price.
 *
 * @property bundle_id - Unique bundle identifier
 * @property name - Display name
 * @property description - Short description
 * @property item_ids - Cosmetic item IDs included in the bundle
 * @property price - Discounted bundle price in gems
 * @property original_total - Sum of individual item prices
 * @property is_one_time - Whether the bundle can only be purchased once
 * @property is_launch_exclusive - Whether this is a launch-time offer
 */
export interface BundleDefinition {
  bundle_id: string;
  name: string;
  description: string;
  item_ids: string[];
  price: number;
  original_total: number;
  is_one_time: boolean;
  is_launch_exclusive: boolean;
}

/**
 * Bundle catalog — discounted cosmetic bundles.
 * All items in bundles are from COSMETIC_CATALOG (zero combat stats).
 */
export const BUNDLE_DEFINITIONS: Record<string, BundleDefinition> = {
  bundle_starter_founders: {
    bundle_id: 'bundle_starter_founders',
    name: "Founder's Starter Bundle",
    description: "The complete Founder's collection at a special launch price.",
    item_ids: [
      'skin_helm_founders',
      'skin_armor_founders',
      'skin_bow_founders',
      'skin_arrow_founders',
      'skin_amulet_founders',
    ],
    price: 1200,
    original_total: 1950,
    is_one_time: true,
    is_launch_exclusive: true,
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

  // Read currency with version for optimistic concurrency. The normalized
  // reader folds any pre-#866 `gold` field into `coins` so the write-back
  // below can never drop a legacy coins balance (zero balance loss).
  const { currency: parsedCurrency, version: readVersion } = readNormalizedCurrencyRecord(
    nk,
    ctx.userId,
    logger
  );
  const playerCurrency: PlayerCurrency = parsedCurrency;
  const currencyVersion: string | undefined = readVersion;

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

  // Single-ledger write (issue #860): the storage record is authoritative.
  nk.storageWrite([
    {
      collection: 'player_currency',
      key: ctx.userId,
      userId: ctx.userId,
      value: toStorageValue(playerCurrency),
      version: currencyVersion,
    },
  ]);

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
    // Issue #1093: record the failed purchase so the failure label is
    // populated (and dashboards show real fraud/duplicate activity).
    recordPurchase(request.product_id, false);
    return JSON.stringify({
      error: securityError,
      error_code: securityError.includes('Duplicate') ? 'DUPLICATE_RECEIPT' : 'INVALID_PLATFORM',
    });
  }

  // Step 3: Validate with RevenueCat
  const rcValidation = await validatePurchaseWithRevenueCat(ctx, logger, nk, request);
  if (!rcValidation.valid) {
    recordPurchase(request.product_id, false);
    return JSON.stringify({ error: rcValidation.error, error_code: rcValidation.errorCode });
  }
  const gemBundle = rcValidation.gemBundle;

  // Step 4: Check purchase limits
  const limitsError = validatePurchaseLimits(ctx, logger, nk, request, gemBundle);
  if (limitsError) {
    recordPurchase(request.product_id, false);
    return JSON.stringify({ error: limitsError, error_code: 'EXCESSIVE_AMOUNT' });
  }

  // Step 5: Award gems
  try {
    const result = await awardGems(ctx, logger, nk, request, gemBundle);
    // Issue #1093: count the successful purchase + record its revenue in
    // cents so the existing economy dashboards (issue #1092) reflect real IAP
    // traffic instead of staying at zero.
    recordPurchase(request.product_id, true);
    const bundleDef = GEM_BUNDLES[request.product_id];
    if (bundleDef) {
      recordRevenue(Math.round(bundleDef.price_usd * 100), 'USD', request.product_id);
    }
    return JSON.stringify({
      gems_awarded: result.gems_awarded,
      new_balance: result.new_balance,
      product_id: request.product_id,
      success: true,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'EXCEEDS_MAX_BALANCE') {
      // Issue #1093: distinguish a validation-flow failure from a thrown bug
      // by recording it as a failed purchase (no revenue recorded).
      recordPurchase(request.product_id, false);
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
 *   "coins": 1000
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
      value: toStorageValue(playerCurrency),
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
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'purchase_cosmetic',
      'player_currency',
      { item_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('purchase_cosmetic', validation.error);
  }

  const { item_id } = validation.data;

  // Validate item exists in cosmetic catalog (rejects any non-cosmetic item)
  const cosmeticItem = COSMETIC_CATALOG[item_id];
  if (!cosmeticItem) {
    logger.warn('Cosmetic purchase rejected — item not in cosmetic catalog: %s', item_id);
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'purchase_cosmetic',
      'player_currency',
      { item_id },
      'failure',
      'Item not in cosmetic catalog'
    );
    return JSON.stringify({
      success: false,
      error: 'Invalid cosmetic item',
      error_code: 'INVALID_ITEM',
    });
  }

  // Check if player already owns this cosmetic
  const ownedResult = nk.storageRead([
    { collection: 'player_cosmetics_owned', key: ctx.userId, userId: ctx.userId },
  ]);
  let ownedItems: string[] = [];
  if (ownedResult.length > 0 && ownedResult[0].value) {
    const parsed = safeParse<{ items: string[] }>(
    getStorageRawValue(ownedResult[0].value) ?? '',
      null,
      logger,
      'player_cosmetics_owned'
    );
    if (parsed.success && parsed.data) {
      ownedItems = parsed.data.items ?? [];
    }
  }

  if (ownedItems.includes(item_id)) {
    logger.warn('Cosmetic purchase rejected — already owned: %s', item_id);
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'purchase_cosmetic',
      'player_currency',
      { item_id },
      'failure',
      'Already owned'
    );
    return JSON.stringify({
      success: false,
      error: 'Item already owned',
      error_code: 'ALREADY_OWNED',
    });
  }

  // Check gem balance
  const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
  if (playerCurrency.gems < cosmeticItem.price) {
    logger.warn(
      'Cosmetic purchase rejected — insufficient gems: need %d, have %d',
      cosmeticItem.price,
      playerCurrency.gems
    );
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'purchase_cosmetic',
      'player_currency',
      { item_id, price: cosmeticItem.price, balance: playerCurrency.gems },
      'failure',
      'Insufficient gems'
    );
    return JSON.stringify({
      success: false,
      error: 'Insufficient gems',
      error_code: 'INSUFFICIENT_GEMS',
    });
  }

  // Deduct gems (single-ledger write, issue #860)
  playerCurrency.gems -= cosmeticItem.price;
  nk.storageWrite([
    {
      collection: 'player_currency',
      key: ctx.userId,
      userId: ctx.userId,
      value: toStorageValue(playerCurrency),
    },
  ]);
  invalidateCurrencyCache(ctx.userId, logger);

  // Record ownership
  ownedItems.push(item_id);
  nk.storageWrite([
    {
      collection: 'player_cosmetics_owned',
      key: ctx.userId,
      userId: ctx.userId,
      value: toStorageValue({ items: ownedItems }),
    },
  ]);

  logger.info(
    'Cosmetic purchased: user %s bought %s for %d gems (new balance: %d)',
    ctx.userId,
    item_id,
    cosmeticItem.price,
    playerCurrency.gems
  );
  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'purchase_cosmetic',
    'player_currency',
    { item_id, price: cosmeticItem.price, new_balance: playerCurrency.gems },
    'success'
  );

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
  const validation = validatePayload(
    ZodSchemas.get_cosmetic_catalog,
    payload,
    'get_cosmetic_catalog'
  );
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

  const validation = validatePayload(
    ZodSchemas.get_owned_cosmetics,
    payload,
    'get_owned_cosmetics'
  );
  if (!validation.success) {
    return createValidationErrorResponse('get_owned_cosmetics', validation.error);
  }

  const ownedResult = nk.storageRead([
    { collection: 'player_cosmetics_owned', key: ctx.userId, userId: ctx.userId },
  ]);

  let items: string[] = [];
  if (ownedResult.length > 0 && ownedResult[0].value) {
    const parsed = safeParse<{ items: string[] }>(
    getStorageRawValue(ownedResult[0].value) ?? '',
      null,
      logger,
      'player_cosmetics_owned'
    );
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

  const validation = validatePayload(
    ZodSchemas.get_equipped_cosmetics,
    payload,
    'get_equipped_cosmetics'
  );
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
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'equip_cosmetic',
      'player_cosmetics_equipped',
      { slot: 'unknown', skin_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('equip_cosmetic', validation.error);
  }

  const { slot, skin_id } = validation.data;

  // Validate skin exists in catalog
  const cosmeticItem = COSMETIC_CATALOG[skin_id];
  if (!cosmeticItem) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'equip_cosmetic',
      'player_cosmetics_equipped',
      { slot, skin_id },
      'failure',
      'Invalid cosmetic item'
    );
    return JSON.stringify({ success: false, error: 'Invalid cosmetic item' });
  }

  // Validate slot matches
  if (cosmeticItem.slot !== slot) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'equip_cosmetic',
      'player_cosmetics_equipped',
      { slot, skin_id, expected_slot: cosmeticItem.slot },
      'failure',
      'Slot mismatch'
    );
    return JSON.stringify({
      success: false,
      error: `Skin belongs to slot ${cosmeticItem.slot}, not ${slot}`,
    });
  }

  // Validate ownership
  const ownedResult = nk.storageRead([
    { collection: 'player_cosmetics_owned', key: ctx.userId, userId: ctx.userId },
  ]);
  let ownedItems: string[] = [];
  if (ownedResult.length > 0 && ownedResult[0].value) {
    const parsed = safeParse<{ items: string[] }>(
    getStorageRawValue(ownedResult[0].value) ?? '',
      null,
      logger,
      'player_cosmetics_owned'
    );
    if (parsed.success && parsed.data) {
      ownedItems = parsed.data.items ?? [];
    }
  }

  if (!ownedItems.includes(skin_id)) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'equip_cosmetic',
      'player_cosmetics_equipped',
      { slot, skin_id },
      'failure',
      'Not owned'
    );
    return JSON.stringify({ success: false, error: 'You do not own this cosmetic item' });
  }

  // Update equipped state
  const equipped = _readEquippedCosmetics(nk, ctx.userId, logger);
  equipped[slot] = skin_id;
  _writeEquippedCosmetics(nk, ctx.userId, equipped, logger);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'equip_cosmetic',
    'player_cosmetics_equipped',
    { slot, skin_id },
    'success'
  );
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

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'unequip_cosmetic',
    'player_cosmetics_equipped',
    { slot },
    'success'
  );
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

  const validation = validatePayload(
    ZodSchemas.save_cosmetic_loadout,
    payload,
    'save_cosmetic_loadout'
  );
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'save_cosmetic_loadout',
      'player_cosmetics_equipped',
      {},
      'failure',
      validation.error
    );
    return createValidationErrorResponse('save_cosmetic_loadout', validation.error);
  }

  const { equipped } = validation.data;

  // Read current ownership for validation
  const ownedResult = nk.storageRead([
    { collection: 'player_cosmetics_owned', key: ctx.userId, userId: ctx.userId },
  ]);
  let ownedItems: string[] = [];
  if (ownedResult.length > 0 && ownedResult[0].value) {
    const parsed = safeParse<{ items: string[] }>(
    getStorageRawValue(ownedResult[0].value) ?? '',
      null,
      logger,
      'player_cosmetics_owned'
    );
    if (parsed.success && parsed.data) {
      ownedItems = parsed.data.items ?? [];
    }
  }

  // Validate each non-empty slot
  for (const [slot, skinId] of Object.entries(equipped)) {
    if (!skinId || (skinId as string).trim() === '') continue;

    const cosmeticItem = COSMETIC_CATALOG[skinId as string];
    if (!cosmeticItem) {
      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'save_cosmetic_loadout',
        'player_cosmetics_equipped',
        { slot, skin_id: skinId },
        'failure',
        'Invalid cosmetic item'
      );
      return JSON.stringify({ success: false, error: `Invalid cosmetic item: ${skinId}` });
    }

    if (cosmeticItem.slot !== slot) {
      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'save_cosmetic_loadout',
        'player_cosmetics_equipped',
        { slot, skin_id: skinId },
        'failure',
        'Slot mismatch'
      );
      return JSON.stringify({
        success: false,
        error: `Skin ${skinId} belongs to slot ${cosmeticItem.slot}, not ${slot}`,
      });
    }

    if (!ownedItems.includes(skinId as string)) {
      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'save_cosmetic_loadout',
        'player_cosmetics_equipped',
        { slot, skin_id: skinId },
        'failure',
        'Not owned'
      );
      return JSON.stringify({ success: false, error: `You do not own ${skinId}` });
    }
  }

  // All validated — persist
  _writeEquippedCosmetics(nk, ctx.userId, equipped as Record<string, string>, logger);

  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'save_cosmetic_loadout',
    'player_cosmetics_equipped',
    equipped,
    'success'
  );
  logger.info('User %s saved cosmetic loadout', ctx.userId);

  return JSON.stringify({ success: true, equipped });
}

export function registerRpcSaveCosmeticLoadout(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/save_cosmetic_loadout', rpcSaveCosmeticLoadout);
}

// ============================================================
// COSMETIC BUNDLE PURCHASE
// ============================================================

/**
 * Purchases a cosmetic bundle — awards all items at a discounted price.
 * Validates bundle existence, one-time purchase restrictions, ownership,
 * and gem balance before granting items.
 */
export function rpcPurchaseBundle(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Bundle purchase request from user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.purchase_bundle, payload, 'purchase_bundle');
  if (!validation.success) {
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'purchase_bundle',
      'player_currency',
      { bundle_id: 'unknown' },
      'failure',
      validation.error
    );
    return createValidationErrorResponse('purchase_bundle', validation.error);
  }

  const { bundle_id } = validation.data;

  // Validate bundle exists
  const bundle = BUNDLE_DEFINITIONS[bundle_id];
  if (!bundle) {
    logger.warn('Bundle purchase rejected — bundle not found: %s', bundle_id);
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'purchase_bundle',
      'player_currency',
      { bundle_id },
      'failure',
      'Bundle not found'
    );
    return JSON.stringify({
      success: false,
      error: 'Invalid bundle',
      error_code: 'INVALID_BUNDLE',
    });
  }

  // Check one-time purchase restriction
  if (bundle.is_one_time) {
    const bundleOwnedResult = nk.storageRead([
      { collection: 'player_bundles_owned', key: ctx.userId, userId: ctx.userId },
    ]);
    let ownedBundles: string[] = [];
    if (bundleOwnedResult.length > 0 && bundleOwnedResult[0].value) {
      const parsed = safeParse<{ bundles: string[] }>(
    getStorageRawValue(bundleOwnedResult[0].value) ?? '',
        null,
        logger,
        'player_bundles_owned'
      );
      if (parsed.success && parsed.data) {
        ownedBundles = parsed.data.bundles ?? [];
      }
    }

    if (ownedBundles.includes(bundle_id)) {
      logger.warn('Bundle purchase rejected — already purchased: %s', bundle_id);
      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'purchase_bundle',
        'player_currency',
        { bundle_id },
        'failure',
        'Bundle already purchased'
      );
      return JSON.stringify({
        success: false,
        error: 'Bundle already purchased',
        error_code: 'ALREADY_OWNED',
      });
    }
  }

  // Validate all items exist in cosmetic catalog
  for (const itemId of bundle.item_ids) {
    if (!COSMETIC_CATALOG[itemId]) {
      logger.error('Bundle %s contains invalid item: %s', bundle_id, itemId);
      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'purchase_bundle',
        'player_currency',
        { bundle_id, invalid_item: itemId },
        'failure',
        'Invalid item in bundle'
      );
      return JSON.stringify({
        success: false,
        error: 'Bundle contains invalid item',
        error_code: 'INVALID_BUNDLE_ITEM',
      });
    }
  }

  // Check if player already owns any item in the bundle
  const ownedResult = nk.storageRead([
    { collection: 'player_cosmetics_owned', key: ctx.userId, userId: ctx.userId },
  ]);
  let ownedItems: string[] = [];
  if (ownedResult.length > 0 && ownedResult[0].value) {
    const parsed = safeParse<{ items: string[] }>(
    getStorageRawValue(ownedResult[0].value) ?? '',
      null,
      logger,
      'player_cosmetics_owned'
    );
    if (parsed.success && parsed.data) {
      ownedItems = parsed.data.items ?? [];
    }
  }

  for (const itemId of bundle.item_ids) {
    if (ownedItems.includes(itemId)) {
      logger.warn('Bundle purchase rejected — player already owns item %s in bundle', itemId);
      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'purchase_bundle',
        'player_currency',
        { bundle_id, owned_item: itemId },
        'failure',
        'Player already owns bundle item'
      );
      return JSON.stringify({
        success: false,
        error: 'You already own an item in this bundle',
        error_code: 'ITEM_ALREADY_OWNED',
      });
    }
  }

  // Check gem balance
  const playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
  if (playerCurrency.gems < bundle.price) {
    logger.warn(
      'Bundle purchase rejected — insufficient gems: need %d, have %d',
      bundle.price,
      playerCurrency.gems
    );
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'purchase_bundle',
      'player_currency',
      { bundle_id, price: bundle.price, balance: playerCurrency.gems },
      'failure',
      'Insufficient gems'
    );
    return JSON.stringify({
      success: false,
      error: 'Insufficient gems',
      error_code: 'INSUFFICIENT_GEMS',
    });
  }

  // Deduct gems (single-ledger write, issue #860)
  playerCurrency.gems -= bundle.price;
  nk.storageWrite([
    {
      collection: 'player_currency',
      key: ctx.userId,
      userId: ctx.userId,
      value: toStorageValue(playerCurrency),
    },
  ]);
  invalidateCurrencyCache(ctx.userId, logger);

  // Grant all bundle items
  for (const itemId of bundle.item_ids) {
    ownedItems.push(itemId);
  }
  nk.storageWrite([
    {
      collection: 'player_cosmetics_owned',
      key: ctx.userId,
      userId: ctx.userId,
      value: toStorageValue({ items: ownedItems }),
    },
  ]);

  // Record bundle ownership (for one-time enforcement)
  if (bundle.is_one_time) {
    const bundleOwnedResult = nk.storageRead([
      { collection: 'player_bundles_owned', key: ctx.userId, userId: ctx.userId },
    ]);
    let ownedBundles: string[] = [];
    if (bundleOwnedResult.length > 0 && bundleOwnedResult[0].value) {
      const parsed = safeParse<{ bundles: string[] }>(
    getStorageRawValue(bundleOwnedResult[0].value) ?? '',
        null,
        logger,
        'player_bundles_owned'
      );
      if (parsed.success && parsed.data) {
        ownedBundles = parsed.data.bundles ?? [];
      }
    }
    ownedBundles.push(bundle_id);
    nk.storageWrite([
      {
        collection: 'player_bundles_owned',
        key: ctx.userId,
        userId: ctx.userId,
        value: toStorageValue({ bundles: ownedBundles }),
      },
    ]);
  }

  logger.info(
    'Bundle purchased: user %s bought %s for %d gems (new balance: %d)',
    ctx.userId,
    bundle_id,
    bundle.price,
    playerCurrency.gems
  );
  logAudit(
    nk,
    ctx.userId,
    ctx.ipAddress ?? null,
    'purchase_bundle',
    'player_currency',
    {
      bundle_id,
      price: bundle.price,
      items_granted: bundle.item_ids,
      new_balance: playerCurrency.gems,
    },
    'success'
  );

  return JSON.stringify({
    success: true,
    bundle_id,
    price: bundle.price,
    items_granted: bundle.item_ids,
    new_balance: playerCurrency.gems,
  });
}

export function registerRpcPurchaseBundle(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/purchase_bundle', rpcPurchaseBundle);
}

/**
 * Returns the bundle catalog with ownership status for the current player.
 */
export function rpcGetBundleCatalog(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  logger.info('Get bundle catalog request from user: %s', ctx.userId);

  const validation = validatePayload(ZodSchemas.get_bundle_catalog, payload, 'get_bundle_catalog');
  if (!validation.success) {
    return createValidationErrorResponse('get_bundle_catalog', validation.error);
  }

  // Read owned bundles
  const bundleOwnedResult = nk.storageRead([
    { collection: 'player_bundles_owned', key: ctx.userId, userId: ctx.userId },
  ]);
  let ownedBundles: string[] = [];
  if (bundleOwnedResult.length > 0 && bundleOwnedResult[0].value) {
    const parsed = safeParse<{ bundles: string[] }>(
    getStorageRawValue(bundleOwnedResult[0].value) ?? '',
      null,
      logger,
      'player_bundles_owned'
    );
    if (parsed.success && parsed.data) {
      ownedBundles = parsed.data.bundles ?? [];
    }
  }

  const bundlesWithOwnership = Object.values(BUNDLE_DEFINITIONS).map((bundle) => ({
    ...bundle,
    is_owned: ownedBundles.includes(bundle.bundle_id),
  }));

  return JSON.stringify({ success: true, bundles: bundlesWithOwnership });
}

export function registerRpcGetBundleCatalog(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/get_bundle_catalog', rpcGetBundleCatalog);
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

  const parsed = safeParse<Record<string, string>>(
    getStorageRawValue(result[0].value) ?? '',
    null,
    logger,
    'player_cosmetics_equipped'
  );
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
      value: toStorageValue(equipped),
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
      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'process_pending_purchase',
        'player_currency',
        { product_id: purchase.product_id },
        'failure',
        'Expired'
      );
      continue;
    }

    // Skip if max retries exceeded
    if (purchase.retry_count >= MAX_PENDING_RETRIES) {
      results.push({
        product_id: purchase.product_id,
        success: false,
        error: 'Max retries exceeded',
      });
      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'process_pending_purchase',
        'player_currency',
        { product_id: purchase.product_id, retry_count: purchase.retry_count },
        'failure',
        'Max retries exceeded'
      );
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
      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'process_pending_purchase',
        'player_currency',
        { product_id: purchase.product_id },
        'failure',
        'Invalid product ID'
      );
      continue;
    }

    // Try to process the purchase
    const receiptHash = hashReceipt(purchase.transaction_receipt);

    // Check for duplicate receipt
    if (await isReceiptAlreadyUsed(nk, ctx.userId, receiptHash, logger)) {
      results.push({ product_id: purchase.product_id, success: true, error: 'Already processed' });
      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'process_pending_purchase',
        'player_currency',
        { product_id: purchase.product_id },
        'success',
        'Already processed'
      );
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
      logAudit(
        nk,
        ctx.userId,
        ctx.ipAddress ?? null,
        'process_pending_purchase',
        'player_currency',
        { product_id: purchase.product_id, gem_amount: gemBundle.gem_amount },
        'failure',
        'Would exceed max balance'
      );
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
        value: toStorageValue(playerCurrency),
      },
    ]);

    invalidateCurrencyCache(ctx.userId, logger);

    results.push({ product_id: purchase.product_id, success: true });
    logAudit(
      nk,
      ctx.userId,
      ctx.ipAddress ?? null,
      'process_pending_purchase',
      'player_currency',
      { product_id: purchase.product_id, gems_awarded: gemBundle.gem_amount },
      'success'
    );
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
    // processRefund performs its own durable dedup check (issue #1067) —
    // already-processed transactions return success:false here.
    // Get product info to determine gem amount
    const catalog = getStoreCatalog(logger);
    const productInfo = catalog[refund.product_id];

    if (productInfo) {
      const refundOutcome = await processRefund(
        nk,
        appUserId,
        productInfo.gem_amount,
        refund.refunded_at,
        RefundReason.CHARGEBACK,
        logger
      );
      if (refundOutcome.success) {
        processedCount++;
      }
    }
  }

  logger.info('Refund check complete for user %s: found %d refunds', appUserId, refunds.length);

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
                  value: toStorageValue(playerCurrency),
                },
              ]);

              invalidateCurrencyCache(ctx.userId, logger);

              logAudit(
                nk,
                ctx.userId,
                ctx.ipAddress ?? null,
                'restore_purchase_grant',
                'player_currency',
                {
                  product_id: productId,
                  gems_awarded: bundle.gem_amount,
                  new_balance: playerCurrency.gems,
                  source: 'non_subscription',
                },
                'success'
              );

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
                value: toStorageValue(playerCurrency),
              },
            ]);

            invalidateCurrencyCache(ctx.userId, logger);

            logAudit(
              nk,
              ctx.userId,
              ctx.ipAddress ?? null,
              'restore_purchase_grant',
              'player_currency',
              {
                product_id: productId,
                gems_awarded: bundle.gem_amount,
                new_balance: playerCurrency.gems,
                source: 'entitlement',
              },
              'success'
            );

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
 * Storage collection for the durable RevenueCat webhook event ledger
 * (issue #1067). Mirrors the validated_receipts receipt-hash ledger
 * pattern: Redis is a fast-path cache, Nakama storage is the durable
 * record that makes event handling idempotent.
 */
const WEBHOOK_EVENT_COLLECTION = 'revenuecat_webhook_events';

/** Redis key prefix for webhook event fast-path markers. */
const WEBHOOK_EVENT_REDIS_PREFIX = 'rc_webhook_event';

/** Redis TTL for webhook event fast-path markers (30 days). */
const WEBHOOK_EVENT_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Storage collection for paid awards queued at the MAX_GEM_BALANCE cap
 * (issue #1067): the remainder of a purchase that could not be applied
 * immediately is recorded durably and drained once balance allows.
 */
const WEBHOOK_PENDING_COLLECTION = 'revenuecat_pending_awards';

/** A queued (not yet applied) portion of a paid webhook award. */
interface PendingWebhookAward {
  event_id: string;
  product_id: string;
  gems_remaining: number;
  queued_at: number;
}

/**
 * In-memory fast-path cache of processed webhook event outcomes
 * (event id -> recorded outcome JSON). Exported for test teardown, like
 * validatedReceipts.
 */
export const processedWebhookEvents: Map<string, string> = new Map();

/** Clear in-memory webhook dedup caches (for test teardown). */
export function clearWebhookEventLedgersForTests(): void {
  processedWebhookEvents.clear();
}

/**
 * Fetch the recorded outcome of a previously processed webhook event.
 *
 * Mirrors the receipt-hash ledger lookup order: Redis fast path, then the
 * in-memory cache, then the durable Nakama storage record (authoritative).
 *
 * @param nk - Nakama server interface
 * @param eventId - RevenueCat event id (or transaction id fallback)
 * @param logger - Nakama logger instance
 * @returns The recorded outcome JSON, or undefined when the event was
 *   never processed
 */
async function getRecordedWebhookOutcome(
  nk: Runtime.Nakama,
  eventId: string,
  logger: Runtime.Logger
): Promise<string | undefined> {
  // 1. Redis fast path
  const redis = getRedisClient(logger);
  if (redis) {
    try {
      const cached = await redis.get(`${WEBHOOK_EVENT_REDIS_PREFIX}:${eventId}`);
      if (cached) return cached;
    } catch (e) {
      logger.error('Redis error in webhook event dedup lookup: %s', e);
      incrementWebhookRedisError('dedup_lookup');
    }
  }

  // 2. In-memory cache
  const memoryCached = processedWebhookEvents.get(eventId);
  if (memoryCached !== undefined) {
    return memoryCached;
  }

  // 3. Durable storage record (authoritative)
  try {
    const objects = nk.storageRead([
      {
        collection: WEBHOOK_EVENT_COLLECTION,
        key: `event_${eventId}`,
        userId: '',
      },
    ]);
    if (objects.length > 0) {
      const record = safeParsePayload<{ outcome?: string }>(
        getStorageRawValue(objects[0].value) ?? '',
        logger,
        'webhook_event_ledger'
      );
      if (record && record.outcome !== undefined) {
        return record.outcome;
      }
    }
  } catch (e) {
    logger.error('Storage read error in webhook event dedup lookup: %s', e);
  }
  return undefined;
}

/**
 * Durably record the outcome of a processed webhook event so replays
 * return the recorded outcome without re-applying (issue #1067).
 *
 * @param nk - Nakama server interface
 * @param eventId - RevenueCat event id (or transaction id fallback)
 * @param userId - The app user the event applied to
 * @param outcome - The handler result to record
 * @param logger - Nakama logger instance
 */
async function recordWebhookOutcome(
  nk: Runtime.Nakama,
  eventId: string,
  userId: string,
  outcome: Record<string, unknown>,
  logger: Runtime.Logger
): Promise<void> {
  const outcomeJson = JSON.stringify(outcome);
  const record = JSON.stringify({
    event_id: eventId,
    app_user_id: userId,
    recorded_at: Date.now(),
    outcome: outcomeJson,
  });

  // 1. Durable Nakama storage record (authoritative)
  try {
    nk.storageWrite([
      {
        collection: WEBHOOK_EVENT_COLLECTION,
        key: `event_${eventId}`,
        userId: '',
        value: record,
        permissionRead: 0, // No public read
        permissionWrite: 0, // No public write
      },
    ]);
  } catch (e) {
    logger.error('Storage write error recording webhook event outcome: %s', e);
  }

  // 2. Redis fast path with TTL
  const redis = getRedisClient(logger);
  if (redis) {
    try {
      await redis.setex(
        `${WEBHOOK_EVENT_REDIS_PREFIX}:${eventId}`,
        WEBHOOK_EVENT_TTL_SECONDS,
        outcomeJson
      );
    } catch (e) {
      logger.error('Redis error recording webhook event outcome: %s', e);
      incrementWebhookRedisError('outcome_record');
    }
  }

  // 3. In-memory cache
  processedWebhookEvents.set(eventId, outcomeJson);
}

/**
 * Read the pending webhook award queue for a player.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param logger - Nakama logger instance
 * @returns The queued awards and the storage version observed on read
 */
function readPendingWebhookAwards(
  nk: Runtime.Nakama,
  userId: string,
  logger: Runtime.Logger
): { awards: PendingWebhookAward[]; version: string | undefined } {
  try {
    const objects = nk.storageRead([
      {
        collection: WEBHOOK_PENDING_COLLECTION,
        key: userId,
        userId: userId,
      },
    ]);
    if (objects.length === 0) {
      return { awards: [], version: undefined };
    }
    const parsed = safeParsePayload<{ awards?: PendingWebhookAward[] }>(
      getStorageRawValue(objects[0].value) ?? '',
      logger,
      'webhook_pending_awards'
    );
    const awards = parsed && Array.isArray(parsed.awards) ? parsed.awards : [];
    return { awards, version: objects[0].version };
  } catch (e) {
    logger.error('Storage read error reading pending webhook awards: %s', e);
    return { awards: [], version: undefined };
  }
}

/**
 * Persist the pending webhook award queue (versioned OCC write).
 *
 * @returns true when the queue was persisted successfully
 */
function writePendingWebhookAwards(
  nk: Runtime.Nakama,
  userId: string,
  awards: PendingWebhookAward[],
  version: string | undefined,
  logger: Runtime.Logger
): boolean {
  try {
    nk.storageWrite([
      {
        collection: WEBHOOK_PENDING_COLLECTION,
        key: userId,
        userId: userId,
        value: toStorageValue({ awards: awards }),
        version: version,
        permissionRead: 0, // No public read
        permissionWrite: 0, // No public write
      },
    ]);
    // Queue-depth gauge (issue #1140): set only on a successful write so
    // the gauge never claims a persistence that failed; 0 once drained.
    setWebhookPendingAwards(userId, awards.length);
    return true;
  } catch (e) {
    logger.error('Storage write error persisting pending webhook awards: %s', e);
    return false;
  }
}

/**
 * Queue the un-appliable remainder of a paid award (balance saturated at
 * MAX_GEM_BALANCE). The queue is durable; drainPendingWebhookAwards
 * applies it once the balance has headroom again (issue #1067).
 */
function queuePendingWebhookAward(
  nk: Runtime.Nakama,
  userId: string,
  award: PendingWebhookAward,
  logger: Runtime.Logger
): void {
  const { awards, version } = readPendingWebhookAwards(nk, userId, logger);
  awards.push(award);
  writePendingWebhookAwards(nk, userId, awards, version, logger);
}

/**
 * Apply queued awards while balance headroom exists (FIFO).
 *
 * Called from the webhook award path so a player whose balance dropped
 * below the cap receives queued gems on their next webhook-driven event.
 *
 * Issue #1137: the ledger is read exactly once and every queued award is
 * folded into a single aggregated delta — the FIFO cap progression is
 * recomputed in memory against that one read, which preserves the exact
 * serial semantics of the former per-iteration loop (partial boundary
 * award, malformed-entry dropping, saturation stop) while cutting the
 * cost from ~2K + 1 storage RTTs for K queued awards to a constant two
 * (one ledger read + one conditional ledger write). The aggregated delta
 * still flows through the authoritative applyCurrencyDelta ledger write,
 * seeded with the read so no second read happens; its OCC retry and
 * MAX_GEM_BALANCE clamp keep the write safe under concurrency.
 *
 * Exported for direct unit testing of the RTT bound (issue #1137).
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param logger - Nakama logger instance
 * @returns Total queued gems applied during this drain
 */
export function drainPendingWebhookAwards(
  nk: Runtime.Nakama,
  userId: string,
  logger: Runtime.Logger
): number {
  const { awards, version } = readPendingWebhookAwards(nk, userId, logger);
  if (awards.length === 0) {
    return 0;
  }

  // Read the ledger once (issue #1137): the normalized record plus its
  // storage version seeds the single conditional write below.
  const ledgerRead = readNormalizedCurrencyRecord(nk, userId, logger);

  // Fold the FIFO cap progression in memory against that single read:
  // each award consumes headroom exactly as the former per-iteration
  // applyCurrencyDelta loop did, minus the per-award storage RMWs.
  const remaining = [...awards];
  let headroom = MAX_GEM_BALANCE - ledgerRead.currency.gems;
  let totalApplied = 0;
  while (remaining.length > 0 && headroom > 0) {
    const next = remaining[0];
    if (next.gems_remaining <= 0) {
      // Defensive: drop malformed empty entries.
      remaining.shift();
      continue;
    }
    const apply = Math.min(next.gems_remaining, headroom);
    totalApplied += apply;
    headroom -= apply;
    next.gems_remaining -= apply;
    if (next.gems_remaining <= 0) {
      remaining.shift();
    } else {
      // Balance saturated again; the rest stays queued.
      break;
    }
  }

  if (totalApplied > 0) {
    applyCurrencyDelta(
      nk,
      userId,
      { gems: totalApplied },
      'revenuecat_webhook_queued',
      logger,
      ledgerRead
    );
  }

  if (totalApplied > 0 || remaining.length !== awards.length) {
    writePendingWebhookAwards(nk, userId, remaining, version, logger);
  }
  if (totalApplied > 0) {
    logger.info('Webhook: drained %d queued gems to user %s', totalApplied, userId);
  }
  return totalApplied;
}

/**
 * Handle initial purchase event - award gems to player.
 *
 * Idempotency (issue #1067): the caller deduplicates by RevenueCat event
 * id before invoking this. Currency mutations go exclusively through the
 * authoritative applyCurrencyDelta ledger (versioned OCC write); when the
 * award would exceed MAX_GEM_BALANCE the un-appliable remainder of the
 * paid award is queued durably instead of failing the purchase.
 */
async function handleInitialPurchase(
  nk: Runtime.Nakama,
  userId: string,
  productId: string,
  logger: Runtime.Logger,
  eventType: string = 'initial_purchase',
  eventId: string = ''
): Promise<{
  success: boolean;
  message: string;
  gems_awarded?: number;
  gems_queued?: number;
  new_balance?: number;
  event_type?: string;
}> {
  const gemAmount = getGemAmountForProduct(productId, logger);

  if (!gemAmount) {
    logger.error('Unknown product ID in webhook: %s', productId);
    logAudit(
      nk,
      userId,
      null,
      'webhook_purchase',
      'player_currency',
      { product_id: productId, event_type: eventType },
      'failure',
      'Unknown product ID'
    );
    return { success: false, message: 'Unknown product ID', event_type: eventType };
  }

  // Apply any previously queued (cap-overflow) awards while there is
  // balance headroom (issue #1067).
  drainPendingWebhookAwards(nk, userId, logger);

  // The player has already paid — award what fits under the cap and queue
  // the remainder instead of failing (issue #1067).
  const current = getPlayerCurrencyWithCache(nk, userId, logger);
  const headroom = Math.max(0, MAX_GEM_BALANCE - current.gems);
  const appliedNow = Math.min(gemAmount, headroom);
  const queued = gemAmount - appliedNow;

  let newBalance = current.gems;
  if (appliedNow > 0) {
    const updated = applyCurrencyDelta(
      nk,
      userId,
      { gems: appliedNow },
      'revenuecat_webhook',
      logger
    );
    newBalance = updated.gems;
  }

  if (queued > 0) {
    logger.warn(
      'Webhook: award of %d gems for user %s capped at MAX_GEM_BALANCE — applied %d, queued %d',
      gemAmount,
      userId,
      appliedNow,
      queued
    );
    queuePendingWebhookAward(
      nk,
      userId,
      {
        event_id: eventId,
        product_id: productId,
        gems_remaining: queued,
        queued_at: Date.now(),
      },
      logger
    );
  }

  logger.info('Webhook: Awarded %d gems to user %s for product %s', appliedNow, userId, productId);

  logAudit(
    nk,
    userId,
    null,
    'webhook_purchase',
    'player_currency',
    {
      product_id: productId,
      gems_awarded: appliedNow,
      gems_queued: queued,
      new_balance: newBalance,
      event_type: eventType,
    },
    'success'
  );

  return {
    success: true,
    message: queued > 0 ? 'Gems awarded (remainder queued at max balance)' : 'Gems awarded',
    gems_awarded: appliedNow,
    gems_queued: queued,
    new_balance: newBalance,
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
      logAudit(
        nk,
        userId,
        null,
        'subscription_cancelled',
        'player_subscription',
        { product_id: productId, reason: reason || 'not specified', event_type: eventType },
        'failure',
        'No valid subscription data found'
      );
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
      logAudit(
        nk,
        userId,
        null,
        'subscription_cancelled',
        'player_subscription',
        { product_id: productId, event_type: eventType },
        'failure',
        'Invalid subscription data'
      );
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
        value: toStorageValue(subscription),
        userId: userId,
      },
    ]);
  }

  logAudit(
    nk,
    userId,
    null,
    'subscription_cancelled',
    'player_subscription',
    { product_id: productId, reason: reason || 'not specified', event_type: eventType },
    'success'
  );
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
      logAudit(
        nk,
        userId,
        null,
        'billing_issue',
        'player_subscription',
        { product_id: productId, event_type: eventType },
        'failure',
        'No valid subscription data found'
      );
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
      logAudit(
        nk,
        userId,
        null,
        'billing_issue',
        'player_subscription',
        { product_id: productId, event_type: eventType },
        'failure',
        'Invalid subscription data'
      );
      return { success: false, error: 'Invalid subscription data' };
    }
    subscription.billing_issue = true;
    subscription.billing_issue_at = new Date().toISOString();

    nk.storageWrite([
      {
        collection: 'player_subscription',
        key: subscriptionKey,
        value: toStorageValue(subscription),
        userId: userId,
      },
    ]);
  }

  logAudit(
    nk,
    userId,
    null,
    'billing_issue',
    'player_subscription',
    { product_id: productId, event_type: eventType },
    'success'
  );
  return { success: true, message: 'Billing issue recorded', event_type: eventType };
}

/**
 * Handle subscription expiration.
 */
function handleSubscriptionExpired(
  nk: Runtime.Nakama,
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

  logAudit(
    nk,
    userId,
    null,
    'subscription_expired',
    'player_subscription',
    { product_id: productId, reason: reason || 'not specified', event_type: eventType },
    'success'
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
  logAudit(
    nk,
    userId,
    null,
    'product_change',
    'player_subscription',
    { product_id: productId, transferred_from: transferredFrom, event_type: 'product_change' },
    'success'
  );
  return { success: true, message: 'Product change noted', event_type: 'product_change' };
}

/**
 * RevenueCat webhook handler.
 * Processes incoming webhooks from RevenueCat.
 *
 * Security & idempotency (issue #1067):
 * - FAIL-CLOSED: when REVENUECAT_WEBHOOK_SECRET is not configured the
 *   webhook is rejected outright — nothing is granted or deducted.
 * - Event dedup: initial_purchase/renewal/refund events are deduplicated
 *   by RevenueCat event id (transaction id fallback) via the durable
 *   webhook event ledger; replays return the recorded outcome without
 *   re-applying.
 *
 * Observability (issue #1140): every terminal path increments
 * `armored_archer_webhook_events_total{event_type,outcome}`, fully-applied
 * events observe `armored_archer_webhook_processing_seconds`, and Redis
 * failures on the dedup fast path increment
 * `armored_archer_webhook_redis_errors_total` (in the ledger helpers).
 */
export async function rpcRevenueCatWebhook(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): Promise<string> {
  logger.info('Processing RevenueCat webhook');

  // FAIL-CLOSED (issue #1067): without a configured secret we cannot
  // verify the sender, so the event is rejected — nothing is granted or
  // deducted. An unverifiable webhook must never be processed.
  const webhookSecret = getRevenueCatWebhookSecret();
  setWebhookConfigured(Boolean(webhookSecret));
  if (!webhookSecret) {
    logger.error(
      '[SECURITY] REVENUECAT_WEBHOOK_SECRET is not configured — rejecting RevenueCat webhook (fail-closed)'
    );
    logAudit(
      nk,
      '',
      null,
      'webhook_missing_secret',
      'revenuecat_webhook',
      {},
      'failure',
      'Webhook secret not configured'
    );
    recordWebhookEvent('unknown', 'rejected_not_configured');
    return JSON.stringify({
      success: false,
      error: 'Webhook not configured',
    });
  }

  // Verify webhook signature (HMAC-SHA256 over the raw payload)
  const signature = ctx.variables['x-revenuecat-signature'] || '';
  if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
    logger.error('Invalid webhook signature');
    logAudit(
      nk,
      '',
      null,
      'webhook_invalid_signature',
      'revenuecat_webhook',
      {},
      'failure',
      'Invalid webhook signature'
    );
    recordWebhookEvent('unknown', 'rejected_invalid_signature');
    return JSON.stringify({
      success: false,
      error: 'Invalid signature',
    });
  }

  // Parse webhook payload
  let webhookData: Record<string, unknown>;
  try {
    webhookData = JSON.parse(payload) as Record<string, unknown>;
  } catch (e) {
    logger.error('Failed to parse webhook payload: %s', e);
    recordWebhookEvent('unknown', 'rejected_invalid_payload');
    return JSON.stringify({
      success: false,
      error: 'Invalid payload',
    });
  }

  // Validate payload is not empty
  if (!payload || payload.trim() === '') {
    logger.error('Empty webhook payload received');
    recordWebhookEvent('unknown', 'rejected_invalid_payload');
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
    logAudit(
      nk,
      '',
      null,
      'webhook_missing_user',
      'revenuecat_webhook',
      { event_type: normalizedEventType },
      'failure',
      'Missing app_user_id'
    );
    recordWebhookEvent(normalizedEventType || 'unknown', 'rejected_missing_user');
    return JSON.stringify({ success: false, error: 'Missing app_user_id' });
  }

  // Extract the transaction id and event id for dedup (issue #1067).
  // RevenueCat sends a unique event.id; legacy/test payloads may only
  // carry event_id or transaction_id.
  const transactionId =
    (webhookData.transaction_id as string) ||
    (eventObj?.transaction_id as string) ||
    (webhookData.refund_transaction_id as string) ||
    (eventObj?.refund_transaction_id as string) ||
    '';
  const rawEventId = eventObj?.id ?? webhookData.event_id ?? eventObj?.event_id;
  const eventId = rawEventId !== undefined && rawEventId !== null && String(rawEventId) !== ''
    ? String(rawEventId)
    : transactionId;

  // Event types whose application must be idempotent (issue #1067).
  const requiresEventDedup =
    normalizedEventType === 'initial_purchase' ||
    normalizedEventType === 'renewal' ||
    normalizedEventType === 'refund';

  if (requiresEventDedup && !eventId) {
    logger.error(
      'Missing event/transaction identifier in %s webhook payload — refusing to process',
      normalizedEventType
    );
    logAudit(
      nk,
      appUserId,
      null,
      'webhook_missing_event_id',
      'revenuecat_webhook',
      { event_type: normalizedEventType },
      'failure',
      'Missing event identifier'
    );
    recordWebhookEvent(normalizedEventType, 'rejected_missing_event_id');
    return JSON.stringify({ success: false, error: 'Missing event identifier' });
  }

  if (requiresEventDedup) {
    const recorded = await getRecordedWebhookOutcome(nk, eventId, logger);
    if (recorded !== undefined) {
      logger.warn(
        'Duplicate RevenueCat webhook event %s (%s) — returning recorded outcome without re-applying',
        eventId,
        normalizedEventType
      );
      recordWebhookEvent(normalizedEventType, 'duplicate');
      return recorded;
    }
  }

  let result: {
    success: boolean;
    message?: string;
    event_type?: string;
    error?: string;
    gems_awarded?: number;
    gems_queued?: number;
    new_balance?: number;
  };

  const webhookProcessingStartMs = Date.now();
  let unhandledEventType = false;

  switch (normalizedEventType) {
    case 'initial_purchase':
    case 'renewal':
      result = await handleInitialPurchase(
        nk,
        appUserId,
        productId,
        logger,
        normalizedEventType,
        eventId
      );
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
    case 'refund': {
      const refundAmount = getGemAmountForProduct(productId, logger) || 0;
      // Map webhook reason to valid RefundReason enum
      const refundReason = mapWebhookReasonToRefundReason(webhookData.reason as string | undefined);
      const refundResult = await processRefund(
        nk,
        appUserId,
        refundAmount,
        transactionId,
        refundReason,
        logger
      );
      result = refundResult;
      break;
    }
    default:
      logger.info('Webhook: Received unhandled event type: %s', eventType);
      unhandledEventType = true;
      result = {
        success: true,
        message: `Event ${eventType} noted but not processed`,
        event_type: normalizedEventType,
      };
  }

  // Record the outcome for dedup'd event types so RevenueCat retries and
  // replays return this exact outcome without re-applying (issue #1067).
  // Failures are intentionally not recorded — a retry of a failed event
  // re-attempts (nothing was applied).
  if (requiresEventDedup && result.success) {
    await recordWebhookOutcome(nk, eventId, appUserId, result, logger);
  }

  // Ledger observability (issue #1140): one event_type × outcome sample
  // per fully-processed event plus the processing-time observation
  // (duplicate replays returned early above and are not timed).
  recordWebhookEvent(
    normalizedEventType || 'unknown',
    result.success ? (unhandledEventType ? 'unhandled' : 'processed') : 'failed'
  );
  recordWebhookProcessingTime(
    normalizedEventType || 'unknown',
    (Date.now() - webhookProcessingStartMs) / 1000
  );

  return JSON.stringify(result);
}

export function registerRpcRevenueCatWebhook(initializer: Runtime.Initializer): void {
  // Startup liveness probe (issue #1140): publish whether the webhook RPC
  // is configured so the WebhookNotConfigured alert can fire from boot,
  // without waiting for the first (rejected) event to arrive.
  setWebhookConfigured(Boolean(getRevenueCatWebhookSecret()));

  // Startup validation (issue #1067): a missing webhook secret puts the
  // RPC in fail-closed mode — surface it loudly at boot so operators fix
  // the configuration instead of silently dropping RevenueCat events.
  if (!getRevenueCatWebhookSecret()) {
    logger.error(
      '[SECURITY] REVENUECAT_WEBHOOK_SECRET is not set — the RevenueCat webhook RPC ' +
        '(armored_archer/revenuecat_webhook) will REJECT all events until it is configured ' +
        '(fail-closed, issue #1067). Add it to the environment / .env to enable webhook processing.'
    );
  }
  initializer.registerRpc('armored_archer/revenuecat_webhook', rpcRevenueCatWebhook);
}
