"use strict";
/**
 * Store module.
 * @fileoverview Handles in-game purchases and currency management.
 * @description Includes refund handling, edge cases, and robust validation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEM_BUNDLES = exports.validatedReceipts = exports.RefundReason = void 0;
exports.processRefund = processRefund;
exports.registerRpcValidatePurchase = registerRpcValidatePurchase;
exports.registerRpcGetCurrency = registerRpcGetCurrency;
exports.registerRpcSpendGems = registerRpcSpendGems;
exports.rpcValidatePurchase = rpcValidatePurchase;
exports.rpcGetCurrency = rpcGetCurrency;
exports.rpcSpendGems = rpcSpendGems;
exports.rpcProcessPendingPurchases = rpcProcessPendingPurchases;
exports.registerRpcProcessPendingPurchases = registerRpcProcessPendingPurchases;
exports.rpcCheckRefunds = rpcCheckRefunds;
exports.registerRpcCheckRefunds = registerRpcCheckRefunds;
exports.rpcCheckSubscriptions = rpcCheckSubscriptions;
exports.registerRpcCheckSubscriptions = registerRpcCheckSubscriptions;
exports.rpcAppLaunchCheck = rpcAppLaunchCheck;
exports.registerRpcAppLaunchCheck = registerRpcAppLaunchCheck;
exports.rpcRevenueCatWebhook = rpcRevenueCatWebhook;
exports.registerRpcRevenueCatWebhook = registerRpcRevenueCatWebhook;
var tslib_1 = require("tslib");
var crypto_1 = require("crypto");
var redis_1 = require("../utils/redis");
var cache_1 = require("../utils/cache");
var circuitBreaker_1 = require("../utils/circuitBreaker");
var safeParse_1 = require("../utils/safeParse");
var config_1 = require("../config");
var audit_1 = require("./audit");
var privacy_compliance_1 = require("./privacy_compliance");
var validation_1 = require("./validation");
/**
 * Maximum gem balance allowed to prevent overflow exploits.
 */
var MAX_GEM_BALANCE = 10000000; // 10 million gems
/**
 * Maximum single purchase amount to prevent large exploits.
 */
var MAX_PURCHASE_AMOUNT = 10000; // 10k gems per transaction
/**
 * Valid platforms for IAP purchases.
 */
var VALID_PLATFORMS = ['ios', 'android'];
/**
 * Refund reason codes for audit logging.
 */
var RefundReason;
(function (RefundReason) {
    RefundReason["CUSTOMER_SUPPORT"] = "customer_support";
    RefundReason["CHARGEBACK"] = "chargeback";
    RefundReason["DUPLICATE"] = "duplicate";
    RefundReason["FRAUD"] = "fraud";
    RefundReason["OTHER"] = "other";
})(RefundReason || (exports.RefundReason = RefundReason = {}));
/**
 * Maps webhook reason string to valid RefundReason enum.
 */
function mapWebhookReasonToRefundReason(reason) {
    if (!reason)
        return RefundReason.OTHER;
    var normalizedReason = reason.toLowerCase().replace(/\s+/g, '_');
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
exports.validatedReceipts = new Map();
/**
 * Cleanup job for in-memory receipt cache.
 * Removes entries older than 24 hours to prevent memory leaks.
 */
function cleanupOldReceipts() {
    // Simple cleanup strategy: clear all after a certain period if memory becomes an issue
    // In production, you would use a more sophisticated TTL-based cache like Redis
    if (exports.validatedReceipts.size > 10000) {
        exports.validatedReceipts.clear();
    }
}
// Run cleanup every hour
setInterval(cleanupOldReceipts, 60 * 60 * 1000);
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
function isReceiptAlreadyUsed(nk, userId, receiptHash, logger) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var redis, exists, e_1, userReceipts, storageId, objects;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redis = (0, redis_1.getRedisClient)(logger);
                    if (!redis) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, redis.exists("receipt:".concat(userId, ":").concat(receiptHash))];
                case 2:
                    exists = _a.sent();
                    if (exists)
                        return [2 /*return*/, true];
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    logger.error('Redis error in isReceiptAlreadyUsed: %s', e_1);
                    return [3 /*break*/, 4];
                case 4:
                    userReceipts = exports.validatedReceipts.get(userId);
                    if (userReceipts && userReceipts.has(receiptHash)) {
                        return [2 /*return*/, true];
                    }
                    // 3. Fallback to Nakama storage (persistent, distributed)
                    try {
                        storageId = "receipt_".concat(receiptHash);
                        objects = nk.storageRead([
                            {
                                collection: 'validated_receipts',
                                key: storageId,
                                userId: userId,
                            },
                        ]);
                        return [2 /*return*/, objects.length > 0];
                    }
                    catch (e) {
                        logger.error('Storage read error in isReceiptAlreadyUsed: %s', e);
                        return [2 /*return*/, false];
                    }
                    return [2 /*return*/];
            }
        });
    });
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
function markReceiptAsUsed(nk, userId, receiptHash, logger) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var redis, e_2, userReceipts;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redis = (0, redis_1.getRedisClient)(logger);
                    if (!redis) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, redis.setex("receipt:".concat(userId, ":").concat(receiptHash), 86400, '1')];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_2 = _a.sent();
                    logger.error('Redis error in markReceiptAsUsed: %s', e_2);
                    return [3 /*break*/, 4];
                case 4:
                    userReceipts = exports.validatedReceipts.get(userId);
                    if (!userReceipts) {
                        userReceipts = new Set();
                        exports.validatedReceipts.set(userId, userReceipts);
                    }
                    userReceipts.add(receiptHash);
                    // 3. Persist in Nakama storage
                    try {
                        nk.storageWrite([
                            {
                                collection: 'validated_receipts',
                                key: "receipt_".concat(receiptHash),
                                userId: userId,
                                value: JSON.stringify({ validated_at: Date.now(), receipt_hash: receiptHash }),
                                permissionRead: 0, // No public read
                                permissionWrite: 0, // No public write
                            },
                        ]);
                    }
                    catch (e) {
                        logger.error('Storage write error in markReceiptAsUsed: %s', e);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Cryptographic hash function for receipts using SHA-256 with salt.
 * This prevents collision attacks and replay attack manipulation.
 */
function hashReceipt(receipt) {
    var salt = process.env.RECEIPT_HASH_SALT || 'armored_archer_secure_iap_salt_2024';
    return (0, crypto_1.createHash)('sha256').update(receipt + salt).digest('hex');
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
function isRefundAlreadyProcessed(userId, refundTransactionId, logger) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var redis, exists, e_3;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redis = (0, redis_1.getRedisClient)(logger);
                    if (!redis) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, redis.exists("refund:".concat(userId, ":").concat(refundTransactionId))];
                case 2:
                    exists = _a.sent();
                    if (exists)
                        return [2 /*return*/, true];
                    return [3 /*break*/, 4];
                case 3:
                    e_3 = _a.sent();
                    if (logger)
                        logger.error('Redis error in isRefundAlreadyProcessed: %s', e_3);
                    return [3 /*break*/, 4];
                case 4: 
                // For now we primarily use Redis for this, or you could add a Nakama storage check
                return [2 /*return*/, false];
            }
        });
    });
}
/**
 * Mark a refund as processed.
 * Uses Redis for persistence and distributed systems support.
 *
 * @param userId - The user who received the refund
 * @param refundTransactionId - Unique refund transaction identifier
 * @param logger - Optional Nakama logger
 */
function markRefundAsProcessed(userId, refundTransactionId, logger) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var redis, e_4;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redis = (0, redis_1.getRedisClient)(logger);
                    if (!redis) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, redis.set("refund:".concat(userId, ":").concat(refundTransactionId), '1')];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_4 = _a.sent();
                    if (logger)
                        logger.error('Redis error in markRefundAsProcessed: %s', e_4);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
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
function validatePlatform(platform, _receipt, logger) {
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
function wouldExceedMaxBalance(currentBalance, amountToAdd) {
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
function processRefund(nk, userId, refundAmount, refundTransactionId, reason, logger) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var playerCurrency, deduction, refundDetails, refundError;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, isRefundAlreadyProcessed(userId, refundTransactionId, logger)];
                case 1:
                    // Check for duplicate refund
                    if (_a.sent()) {
                        logger.warn('Duplicate refund detected for user: %s, transaction: %s', userId, refundTransactionId);
                        return [2 /*return*/, { success: false, message: 'Refund already processed' }];
                    }
                    // Validate refund amount
                    if (refundAmount <= 0) {
                        logger.error('Invalid refund amount: %d', refundAmount);
                        return [2 /*return*/, { success: false, message: 'Invalid refund amount' }];
                    }
                    playerCurrency = getPlayerCurrencyWithCache(nk, userId, logger);
                    deduction = Math.min(refundAmount, playerCurrency.gems);
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
                    return [4 /*yield*/, markRefundAsProcessed(userId, refundTransactionId, logger)];
                case 2:
                    // Mark refund as processed
                    _a.sent();
                    refundDetails = {
                        refund_amount: refundAmount,
                        actual_deducted: deduction,
                        new_balance: playerCurrency.gems,
                        reason: reason,
                        refund_transaction_id: refundTransactionId,
                    };
                    refundError = deduction < refundAmount ? 'Partial refund - player had insufficient balance' : undefined;
                    (0, audit_1.logAudit)(nk, userId, null, 'process_refund', 'player_currency', refundDetails, 'success', refundError);
                    logger.info('Refund processed for user %s: deducted %d gems (requested: %d), new balance: %d, reason: %s', userId, deduction, refundAmount, playerCurrency.gems, reason);
                    return [2 /*return*/, {
                            success: true,
                            message: deduction < refundAmount ? 'Partial refund applied' : 'Refund processed successfully',
                            new_balance: playerCurrency.gems,
                        }];
            }
        });
    });
}
/**
 * Retrieves player currency with caching.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player to retrieve currency for
 * @param logger - Nakama logger instance
 * @returns Player currency data
 */
function getPlayerCurrencyWithCache(nk, userId, logger) {
    var cacheManager = (0, cache_1.getCacheManager)(logger);
    var cachedCurrency = cacheManager.get('player_currency', userId);
    if (cachedCurrency !== undefined) {
        return cachedCurrency;
    }
    var objects = nk.storageRead([
        {
            collection: 'player_currency',
            key: userId,
            userId: userId,
        },
    ]);
    var currency;
    if (objects.length === 0 || !objects[0].value) {
        currency = {
            user_id: userId,
            gems: 0,
            gold: 0,
        };
    }
    else {
        var parseResult = (0, safeParse_1.safeParse)(objects[0].value, null, logger, 'player_currency');
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
function invalidateCurrencyCache(userId, logger) {
    var cacheManager = (0, cache_1.getCacheManager)(logger);
    cacheManager.delete('player_currency', userId);
}
/**
 * Gem bundle catalog with available purchases.
 */
exports.GEM_BUNDLES = {
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
function registerRpcValidatePurchase(initializer) {
    initializer.registerRpc('armored_archer/validate_purchase', rpcValidatePurchase);
}
/**
 * Registers the get currency RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcGetCurrency(initializer) {
    initializer.registerRpc('armored_archer/get_currency', rpcGetCurrency);
}
/**
 * Registers the spend gems RPC endpoint.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerRpcSpendGems(initializer) {
    initializer.registerRpc('armored_archer/spend_gems', rpcSpendGems);
}
/**
 * Retrieves store catalog with caching.
 *
 * @param logger - Nakama logger instance
 * @returns Store catalog with gem bundles
 */
function getStoreCatalog(logger) {
    var cacheManager = (0, cache_1.getCacheManager)(logger);
    var cachedCatalog = cacheManager.get('store_catalog', 'gem_bundles');
    if (cachedCatalog !== undefined) {
        return cachedCatalog;
    }
    cacheManager.set('store_catalog', 'gem_bundles', exports.GEM_BUNDLES);
    return exports.GEM_BUNDLES;
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
function validatePurchaseRequest(ctx, logger, nk, payload) {
    var _a;
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.validate_purchase, payload, 'validate_purchase');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'validate_purchase', 'player_currency', { product_id: 'unknown', platform: 'unknown' }, 'failure', validation.error);
        return { valid: false, error: validation.error, errorCode: 'VALIDATION_ERROR' };
    }
    var request = validation.data;
    // Check for PII in receipt data (privacy compliance)
    if ((0, privacy_compliance_1.isPII)(request.transaction_receipt)) {
        logger.warn('Potential PII detected in transaction receipt');
    }
    return { valid: true, request: request };
}
/**
 * Checks for duplicate receipts and validates platform
 */
function validatePurchaseSecurity(ctx, logger, nk, request) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var receiptHash;
        var _a, _b;
        return tslib_1.__generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    receiptHash = hashReceipt(request.transaction_receipt);
                    return [4 /*yield*/, isReceiptAlreadyUsed(nk, ctx.userId, receiptHash, logger)];
                case 1:
                    if (_c.sent()) {
                        logger.warn('Duplicate receipt detected');
                        (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'validate_purchase', 'player_currency', { product_id: request.product_id, platform: request.platform }, 'failure', 'Duplicate receipt detected');
                        return [2 /*return*/, 'Duplicate receipt - this purchase has already been processed'];
                    }
                    // Validate platform to ensure it's from a recognized source
                    if (!validatePlatform(request.platform, request.transaction_receipt, logger)) {
                        (0, audit_1.logAudit)(nk, ctx.userId, (_b = ctx.ipAddress) !== null && _b !== void 0 ? _b : null, 'validate_purchase', 'player_currency', { product_id: request.product_id, platform: request.platform }, 'failure', 'Invalid platform');
                        return [2 /*return*/, 'Invalid or unsupported platform'];
                    }
                    return [2 /*return*/, null];
            }
        });
    });
}
/**
 * Validates the purchase with RevenueCat and checks product availability
 */
function validatePurchaseWithRevenueCat(ctx, logger, nk, request) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var rcValidation, catalog;
        var _a, _b;
        return tslib_1.__generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, validateWithRevenueCat(logger, request.transaction_receipt, request.product_id, request.platform)];
                case 1:
                    rcValidation = _c.sent();
                    if (!rcValidation.valid) {
                        logger.warn('RevenueCat validation failed for user %s: %s', ctx.userId, rcValidation.error);
                        (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'validate_purchase', 'player_currency', { product_id: request.product_id, platform: request.platform }, 'failure', rcValidation.error);
                        return [2 /*return*/, { valid: false, error: 'Purchase validation failed', errorCode: 'VALIDATION_FAILED' }];
                    }
                    catalog = getStoreCatalog(logger);
                    if (!catalog[request.product_id]) {
                        (0, audit_1.logAudit)(nk, ctx.userId, (_b = ctx.ipAddress) !== null && _b !== void 0 ? _b : null, 'validate_purchase', 'player_currency', { product_id: request.product_id, platform: request.platform }, 'failure', 'Invalid product ID');
                        return [2 /*return*/, { valid: false, error: 'Invalid product ID' }];
                    }
                    return [2 /*return*/, { valid: true, gemBundle: catalog[request.product_id] }];
            }
        });
    });
}
/**
 * Checks purchase amount and balance limits
 */
function validatePurchaseLimits(ctx, logger, nk, request, gemBundle) {
    var _a;
    // Check for suspiciously large purchase amounts to prevent exploits
    if (gemBundle.gem_amount > MAX_PURCHASE_AMOUNT) {
        logger.error('Suspicious purchase amount detected: %d gems (max: %d)', gemBundle.gem_amount, MAX_PURCHASE_AMOUNT);
        (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'validate_purchase', 'player_currency', { product_id: request.product_id, platform: request.platform, amount: gemBundle.gem_amount }, 'failure', 'Excessive purchase amount');
        return 'Purchase amount exceeds maximum allowed';
    }
    return null;
}
/**
 * Awards gems to player after all validations pass
 */
function awardGems(ctx, logger, nk, request, gemBundle) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var receiptHash, playerCurrency;
        var _a, _b;
        return tslib_1.__generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    receiptHash = hashReceipt(request.transaction_receipt);
                    // Mark receipt as used BEFORE awarding gems to prevent replay attacks
                    return [4 /*yield*/, markReceiptAsUsed(nk, ctx.userId, receiptHash, logger)];
                case 1:
                    // Mark receipt as used BEFORE awarding gems to prevent replay attacks
                    _c.sent();
                    playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
                    // Check if adding gems would exceed maximum balance (overflow protection)
                    if (wouldExceedMaxBalance(playerCurrency.gems, gemBundle.gem_amount)) {
                        logger.error('Purchase would exceed max balance for user %s: current %d + add %d > max %d', ctx.userId, playerCurrency.gems, gemBundle.gem_amount, MAX_GEM_BALANCE);
                        (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'validate_purchase', 'player_currency', { product_id: request.product_id, platform: request.platform, amount: gemBundle.gem_amount }, 'failure', 'Would exceed max balance');
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
                    (0, audit_1.logAudit)(nk, ctx.userId, (_b = ctx.ipAddress) !== null && _b !== void 0 ? _b : null, 'validate_purchase', 'player_currency', {
                        product_id: request.product_id,
                        platform: request.platform,
                        gems_awarded: gemBundle.gem_amount,
                        new_balance: playerCurrency.gems,
                    }, 'success');
                    return [2 /*return*/, {
                            success: true,
                            gems_awarded: gemBundle.gem_amount,
                            new_balance: playerCurrency.gems,
                        }];
            }
        });
    });
}
function rpcValidatePurchase(ctx, logger, nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var requestValidation, request, securityError, rcValidation, gemBundle, limitsError, result, e_5;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger.info('Validating purchase');
                    requestValidation = validatePurchaseRequest(ctx, logger, nk, payload);
                    if (!requestValidation.valid) {
                        return [2 /*return*/, JSON.stringify({
                                error: requestValidation.error,
                                error_code: requestValidation.errorCode,
                            })];
                    }
                    request = requestValidation.request;
                    return [4 /*yield*/, validatePurchaseSecurity(ctx, logger, nk, request)];
                case 1:
                    securityError = _a.sent();
                    if (securityError) {
                        return [2 /*return*/, JSON.stringify({
                                error: securityError,
                                error_code: securityError.includes('Duplicate') ? 'DUPLICATE_RECEIPT' : 'INVALID_PLATFORM',
                            })];
                    }
                    return [4 /*yield*/, validatePurchaseWithRevenueCat(ctx, logger, nk, request)];
                case 2:
                    rcValidation = _a.sent();
                    if (!rcValidation.valid) {
                        return [2 /*return*/, JSON.stringify({ error: rcValidation.error, error_code: rcValidation.errorCode })];
                    }
                    gemBundle = rcValidation.gemBundle;
                    limitsError = validatePurchaseLimits(ctx, logger, nk, request, gemBundle);
                    if (limitsError) {
                        return [2 /*return*/, JSON.stringify({ error: limitsError, error_code: 'EXCESSIVE_AMOUNT' })];
                    }
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, awardGems(ctx, logger, nk, request, gemBundle)];
                case 4:
                    result = _a.sent();
                    return [2 /*return*/, JSON.stringify({
                            gems_awarded: result.gems_awarded,
                            new_balance: result.new_balance,
                            product_id: request.product_id,
                            success: true,
                        })];
                case 5:
                    e_5 = _a.sent();
                    if (e_5 instanceof Error && e_5.message === 'EXCEEDS_MAX_BALANCE') {
                        return [2 /*return*/, JSON.stringify({
                                error: 'Purchase would exceed maximum gem balance',
                                error_code: 'EXCEEDS_MAX_BALANCE',
                            })];
                    }
                    throw e_5;
                case 6: return [2 /*return*/];
            }
        });
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
function rpcGetCurrency(ctx, logger, nk, payload) {
    logger.info('Getting currency for user: %s', ctx.userId);
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_currency, payload, 'get_currency');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('get_currency', validation.error);
    }
    var currency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
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
function rpcSpendGems(ctx, logger, nk, payload) {
    var _a, _b, _c;
    logger.info('Spending gems for user: %s', ctx.userId);
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.spend_gems, payload, 'spend_gems');
    if (!validation.success) {
        (0, audit_1.logAudit)(nk, ctx.userId, (_a = ctx.ipAddress) !== null && _a !== void 0 ? _a : null, 'spend_gems', 'player_currency', { amount: 'unknown' }, 'failure', validation.error);
        return (0, validation_1.createValidationErrorResponse)('spend_gems', validation.error);
    }
    var request = validation.data;
    var playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
    if (playerCurrency.gems < request.amount) {
        (0, audit_1.logAudit)(nk, ctx.userId, (_b = ctx.ipAddress) !== null && _b !== void 0 ? _b : null, 'spend_gems', 'player_currency', { amount: request.amount, current_balance: playerCurrency.gems }, 'failure', 'Insufficient gems');
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
    logger.info('User %s spent %d gems. New balance: %d', ctx.userId, request.amount, playerCurrency.gems);
    (0, audit_1.logAudit)(nk, ctx.userId, (_c = ctx.ipAddress) !== null && _c !== void 0 ? _c : null, 'spend_gems', 'player_currency', { amount: request.amount, new_balance: playerCurrency.gems }, 'success');
    return JSON.stringify({
        success: true,
        new_balance: playerCurrency.gems,
        amount_spent: request.amount,
    });
}
var pendingPurchases = new Map();
/**
 * Maximum number of retries for pending purchases.
 */
var MAX_PENDING_RETRIES = 3;
/**
 * Pending purchase age limit (24 hours in milliseconds).
 * After this time, pending purchases are considered expired.
 */
var PENDING_PURCHASE_EXPIRY_MS = 24 * 60 * 60 * 1000;
/**
 * RevenueCat API configuration.
 */
var REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';
/**
 * Gets the RevenueCat API key from environment.
 * Returns undefined if not configured.
 */
function getRevenueCatApiKey() {
    return process.env.REVENUECAT_API_KEY || process.env.REVENUECAT_SECRET_KEY;
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
function validateWithRevenueCat(logger, receipt, productId, platform) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var apiKey, rcPlatform, validationResult;
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    apiKey = getRevenueCatApiKey();
                    if (!apiKey) {
                        logger.error('RevenueCat API key not configured - strictly enforcing validation');
                        return [2 /*return*/, { valid: false, error: 'RevenueCat API key not configured' }];
                    }
                    rcPlatform = platform === 'ios' ? 'apple' : 'google';
                    return [4 /*yield*/, (0, circuitBreaker_1.withCircuitBreaker)('revenuecat', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var response, errorText, data, isValid, subscriber, isVerified, entitlements, _a, _b, ent, nonSubscriptions, subscriptions;
                            var e_6, _c;
                            return tslib_1.__generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0: return [4 /*yield*/, fetch("".concat(REVENUECAT_API_BASE, "/receipts/validate"), {
                                            method: 'POST',
                                            headers: {
                                                Authorization: "Bearer ".concat(apiKey),
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({
                                                receipt: receipt,
                                                platform: rcPlatform,
                                                // Optional: include product ID to verify
                                                product_id: productId,
                                            }),
                                        })];
                                    case 1:
                                        response = _d.sent();
                                        if (!!response.ok) return [3 /*break*/, 3];
                                        return [4 /*yield*/, response.text()];
                                    case 2:
                                        errorText = _d.sent();
                                        logger.error('RevenueCat validation failed: %s - %s', response.status, errorText);
                                        return [2 /*return*/, {
                                                valid: false,
                                                error: "RevenueCat validation failed: ".concat(response.status),
                                            }];
                                    case 3: return [4 /*yield*/, response.json()];
                                    case 4:
                                        data = (_d.sent());
                                        isValid = data.status === 'active' || data.status === 0 || data.valid === true;
                                        if (!isValid) {
                                            logger.warn('RevenueCat rejected receipt: status=%s', data.status);
                                            return [2 /*return*/, {
                                                    valid: false,
                                                    error: "Invalid receipt: ".concat(data.status),
                                                }];
                                        }
                                        subscriber = data.subscriber;
                                        isVerified = false;
                                        if (subscriber) {
                                            // 1. Check entitlements (for subscriptions/features)
                                            if (subscriber.entitlements) {
                                                entitlements = subscriber.entitlements;
                                                if (entitlements[productId]) {
                                                    isVerified = true;
                                                }
                                                else {
                                                    try {
                                                        for (_a = tslib_1.__values(Object.values(entitlements)), _b = _a.next(); !_b.done; _b = _a.next()) {
                                                            ent = _b.value;
                                                            if (ent.product_id === productId) {
                                                                isVerified = true;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                    catch (e_6_1) { e_6 = { error: e_6_1 }; }
                                                    finally {
                                                        try {
                                                            if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                                                        }
                                                        finally { if (e_6) throw e_6.error; }
                                                    }
                                                }
                                            }
                                            // 2. Check non_subscriptions (for consumables like gems)
                                            if (!isVerified && subscriber.non_subscriptions) {
                                                nonSubscriptions = subscriber.non_subscriptions;
                                                if (nonSubscriptions[productId] && nonSubscriptions[productId].length > 0) {
                                                    isVerified = true;
                                                }
                                            }
                                            // 3. Check active subscriptions
                                            if (!isVerified && subscriber.subscriptions) {
                                                subscriptions = subscriber.subscriptions;
                                                if (subscriptions[productId]) {
                                                    isVerified = true;
                                                }
                                            }
                                        }
                                        if (!isVerified) {
                                            logger.warn('Product ID mismatch or not found: claimed=%s', productId);
                                            return [2 /*return*/, {
                                                    valid: false,
                                                    error: "Product ID verification failed: ".concat(productId, " not found in receipt"),
                                                }];
                                        }
                                        logger.info('RevenueCat validation successful for user product: %s', productId);
                                        return [2 /*return*/, {
                                                valid: true,
                                                subscriber: subscriber,
                                                product_id: productId,
                                            }];
                                }
                            });
                        }); }, 
                        // Fallback: fail closed if RevenueCat is unavailable (strict enforcement)
                        function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            return tslib_1.__generator(this, function (_a) {
                                logger.error('RevenueCat circuit open - failing closed for purchase validation');
                                return [2 /*return*/, { valid: false, error: 'Validation service temporarily unavailable' }];
                            });
                        }); })];
                case 1:
                    validationResult = _a.sent();
                    return [2 /*return*/, validationResult];
            }
        });
    });
}
/**
 * Add a purchase to the pending queue.
 * Called when network validation fails but receipt was received.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function addToPendingQueue(userId, productId, platform, transactionReceipt) {
    var userPending = pendingPurchases.get(userId);
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
function cleanupPendingPurchases(userId) {
    var userPending = pendingPurchases.get(userId);
    if (!userPending)
        return;
    var now = Date.now();
    var valid = userPending.filter(function (p) { return now - p.timestamp < PENDING_PURCHASE_EXPIRY_MS && p.retry_count < MAX_PENDING_RETRIES; });
    if (valid.length === 0) {
        pendingPurchases.delete(userId);
    }
    else {
        pendingPurchases.set(userId, valid);
    }
}
/**
 * Process pending purchases for a user.
 * Called when network recovers or on app launch.
 */
function rpcProcessPendingPurchases(ctx, logger, nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, userPending, results, catalog, now, userPending_1, userPending_1_1, purchase, receiptHash, gemBundle, playerCurrency, e_7_1, successful;
        var e_7, _a;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    logger.info('Processing pending purchases for user: %s', ctx.userId);
                    validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.process_pending_purchases, payload, 'process_pending_purchases');
                    if (!validation.success) {
                        return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('process_pending_purchases', validation.error)];
                    }
                    userPending = pendingPurchases.get(ctx.userId);
                    if (!userPending || userPending.length === 0) {
                        return [2 /*return*/, JSON.stringify({
                                success: true,
                                processed: 0,
                                message: 'No pending purchases',
                            })];
                    }
                    results = [];
                    catalog = getStoreCatalog(logger);
                    now = Date.now();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 7, 8, 9]);
                    userPending_1 = tslib_1.__values(userPending), userPending_1_1 = userPending_1.next();
                    _b.label = 2;
                case 2:
                    if (!!userPending_1_1.done) return [3 /*break*/, 6];
                    purchase = userPending_1_1.value;
                    // Skip expired
                    if (now - purchase.timestamp >= PENDING_PURCHASE_EXPIRY_MS) {
                        results.push({ product_id: purchase.product_id, success: false, error: 'Expired' });
                        return [3 /*break*/, 5];
                    }
                    // Skip if max retries exceeded
                    if (purchase.retry_count >= MAX_PENDING_RETRIES) {
                        results.push({
                            product_id: purchase.product_id,
                            success: false,
                            error: 'Max retries exceeded',
                        });
                        return [3 /*break*/, 5];
                    }
                    // Validate product ID
                    if (!catalog[purchase.product_id]) {
                        purchase.retry_count++;
                        results.push({
                            product_id: purchase.product_id,
                            success: false,
                            error: 'Invalid product ID',
                        });
                        return [3 /*break*/, 5];
                    }
                    receiptHash = hashReceipt(purchase.transaction_receipt);
                    return [4 /*yield*/, isReceiptAlreadyUsed(nk, ctx.userId, receiptHash, logger)];
                case 3:
                    // Check for duplicate receipt
                    if (_b.sent()) {
                        results.push({ product_id: purchase.product_id, success: true, error: 'Already processed' });
                        return [3 /*break*/, 5];
                    }
                    gemBundle = catalog[purchase.product_id];
                    playerCurrency = getPlayerCurrencyWithCache(nk, ctx.userId, logger);
                    if (wouldExceedMaxBalance(playerCurrency.gems, gemBundle.gem_amount)) {
                        purchase.retry_count++;
                        results.push({
                            product_id: purchase.product_id,
                            success: false,
                            error: 'Would exceed max balance',
                        });
                        return [3 /*break*/, 5];
                    }
                    // Mark receipt and add gems
                    return [4 /*yield*/, markReceiptAsUsed(nk, ctx.userId, receiptHash, logger)];
                case 4:
                    // Mark receipt and add gems
                    _b.sent();
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
                    logger.info('Processed pending purchase for user %s: %s (%d gems)', ctx.userId, purchase.product_id, gemBundle.gem_amount);
                    _b.label = 5;
                case 5:
                    userPending_1_1 = userPending_1.next();
                    return [3 /*break*/, 2];
                case 6: return [3 /*break*/, 9];
                case 7:
                    e_7_1 = _b.sent();
                    e_7 = { error: e_7_1 };
                    return [3 /*break*/, 9];
                case 8:
                    try {
                        if (userPending_1_1 && !userPending_1_1.done && (_a = userPending_1.return)) _a.call(userPending_1);
                    }
                    finally { if (e_7) throw e_7.error; }
                    return [7 /*endfinally*/];
                case 9:
                    // Clean up processed purchases
                    cleanupPendingPurchases(ctx.userId);
                    successful = results.filter(function (r) { return r.success; }).length;
                    return [2 /*return*/, JSON.stringify({
                            success: true,
                            processed: results.length,
                            successful: successful,
                            results: results,
                        })];
            }
        });
    });
}
function registerRpcProcessPendingPurchases(initializer) {
    initializer.registerRpc('armored_archer/process_pending_purchases', rpcProcessPendingPurchases);
}
// ============================================================
// REFUND DETECTION HANDLING
// ============================================================
/**
 * Check for refunds via RevenueCat API.
 * Should be called on app launch to detect chargebacks.
 */
function rpcCheckRefunds(ctx, logger, nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, apiKey, refundResult, refunds, processedCount, refunds_1, refunds_1_1, refund, catalog, productInfo, e_8_1;
        var e_8, _a;
        var _this = this;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    logger.info('Checking for refunds for user: %s', ctx.userId);
                    validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.check_refunds, payload, 'check_refunds');
                    if (!validation.success) {
                        return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('check_refunds', validation.error)];
                    }
                    apiKey = getRevenueCatApiKey();
                    if (!apiKey) {
                        logger.warn('RevenueCat API key not configured - skipping refund check');
                        return [2 /*return*/, JSON.stringify({
                                success: true,
                                refunds_found: 0,
                                message: 'Refund check not configured',
                            })];
                    }
                    return [4 /*yield*/, (0, circuitBreaker_1.withCircuitBreaker)('revenuecat', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var response, errorText, data, subscriber, entitlementHistory, refunds, _a, _b, _c, productId, details, ent;
                            var e_9, _d;
                            return tslib_1.__generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0: return [4 /*yield*/, fetch("".concat(REVENUECAT_API_BASE, "/subscribers/").concat(encodeURIComponent(validation.data.app_user_id)), {
                                            method: 'GET',
                                            headers: {
                                                Authorization: "Bearer ".concat(apiKey),
                                                'Content-Type': 'application/json',
                                            },
                                        })];
                                    case 1:
                                        response = _e.sent();
                                        if (!!response.ok) return [3 /*break*/, 3];
                                        return [4 /*yield*/, response.text()];
                                    case 2:
                                        errorText = _e.sent();
                                        logger.error('RevenueCat API error: %s - %s', response.status, errorText);
                                        return [2 /*return*/, {
                                                success: true,
                                                refunds_found: 0,
                                                message: 'Unable to check refunds',
                                                apiError: true,
                                            }];
                                    case 3: return [4 /*yield*/, response.json()];
                                    case 4:
                                        data = (_e.sent());
                                        subscriber = data.subscriber;
                                        if (!subscriber) {
                                            return [2 /*return*/, {
                                                    success: true,
                                                    refunds_found: 0,
                                                    message: 'No subscriber found',
                                                }];
                                        }
                                        entitlementHistory = subscriber.entitlement_details;
                                        refunds = [];
                                        // RevenueCat provides refund information in various fields
                                        // Check for refund_date or cancellation fields
                                        if (entitlementHistory) {
                                            try {
                                                for (_a = tslib_1.__values(Object.entries(entitlementHistory)), _b = _a.next(); !_b.done; _b = _a.next()) {
                                                    _c = tslib_1.__read(_b.value, 2), productId = _c[0], details = _c[1];
                                                    ent = details;
                                                    if (ent.refund_date || ent.refunded_at) {
                                                        refunds.push({
                                                            product_id: productId,
                                                            refunded_at: (ent.refund_date || ent.refunded_at),
                                                        });
                                                    }
                                                }
                                            }
                                            catch (e_9_1) { e_9 = { error: e_9_1 }; }
                                            finally {
                                                try {
                                                    if (_b && !_b.done && (_d = _a.return)) _d.call(_a);
                                                }
                                                finally { if (e_9) throw e_9.error; }
                                            }
                                        }
                                        return [2 /*return*/, { success: true, refunds: refunds, message: '' }];
                                }
                            });
                        }); }, 
                        // Fallback: fail safe - return no refunds if circuit is open
                        function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            return tslib_1.__generator(this, function (_a) {
                                logger.warn('RevenueCat circuit open - skipping refund check');
                                return [2 /*return*/, {
                                        success: true,
                                        refunds_found: 0,
                                        message: 'Refund check unavailable',
                                        circuitOpen: true,
                                    }];
                            });
                        }); })];
                case 1:
                    refundResult = _b.sent();
                    // Handle circuit breaker fallback result
                    if ('apiError' in refundResult || 'circuitOpen' in refundResult) {
                        return [2 /*return*/, JSON.stringify(refundResult)];
                    }
                    refunds = refundResult.refunds;
                    if (!refunds) {
                        logger.error('Refund result missing refunds array');
                        return [2 /*return*/, JSON.stringify({
                                success: true,
                                refunds_found: 0,
                                message: 'Error processing refunds',
                            })];
                    }
                    processedCount = 0;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 8, 9, 10]);
                    refunds_1 = tslib_1.__values(refunds), refunds_1_1 = refunds_1.next();
                    _b.label = 3;
                case 3:
                    if (!!refunds_1_1.done) return [3 /*break*/, 7];
                    refund = refunds_1_1.value;
                    return [4 /*yield*/, isRefundAlreadyProcessed(validation.data.app_user_id, refund.refunded_at, logger)];
                case 4:
                    if (!!(_b.sent())) return [3 /*break*/, 6];
                    catalog = getStoreCatalog(logger);
                    productInfo = catalog[refund.product_id];
                    if (!productInfo) return [3 /*break*/, 6];
                    return [4 /*yield*/, processRefund(nk, validation.data.app_user_id, productInfo.gem_amount, refund.refunded_at, RefundReason.CHARGEBACK, logger)];
                case 5:
                    _b.sent();
                    processedCount++;
                    _b.label = 6;
                case 6:
                    refunds_1_1 = refunds_1.next();
                    return [3 /*break*/, 3];
                case 7: return [3 /*break*/, 10];
                case 8:
                    e_8_1 = _b.sent();
                    e_8 = { error: e_8_1 };
                    return [3 /*break*/, 10];
                case 9:
                    try {
                        if (refunds_1_1 && !refunds_1_1.done && (_a = refunds_1.return)) _a.call(refunds_1);
                    }
                    finally { if (e_8) throw e_8.error; }
                    return [7 /*endfinally*/];
                case 10:
                    logger.info('Refund check complete for user %s: found %d refunds', validation.data.app_user_id, refunds.length);
                    return [2 /*return*/, JSON.stringify({
                            success: true,
                            refunds_found: refunds.length,
                            processed: processedCount,
                            message: refunds.length > 0 ? "Found ".concat(refunds.length, " refunds") : 'No refunds detected',
                        })];
            }
        });
    });
}
function registerRpcCheckRefunds(initializer) {
    initializer.registerRpc('armored_archer/check_refunds', rpcCheckRefunds);
}
// ============================================================
// SUBSCRIPTION EXPIRATION HANDLING
// ============================================================
/**
 * Check subscription status via RevenueCat API.
 * Should be called on app launch to detect expired subscriptions.
 */
function rpcCheckSubscriptions(ctx, logger, nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, apiKey, subscriptionResult;
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger.info('Checking subscriptions for user: %s', ctx.userId);
                    validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.check_subscriptions, payload, 'check_subscriptions');
                    if (!validation.success) {
                        return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('check_subscriptions', validation.error)];
                    }
                    apiKey = getRevenueCatApiKey();
                    if (!apiKey) {
                        logger.warn('RevenueCat API key not configured - skipping subscription check');
                        return [2 /*return*/, JSON.stringify({
                                success: true,
                                active_subscriptions: [],
                                message: 'Subscription check not configured',
                            })];
                    }
                    return [4 /*yield*/, (0, circuitBreaker_1.withCircuitBreaker)('revenuecat', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var response, errorText, data, subscriber, entitlements, activeSubscriptions, _a, _b, _c, entitlementId, entitlement, ent, isActive, isSubscribed;
                            var e_10, _d;
                            return tslib_1.__generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0: return [4 /*yield*/, fetch("".concat(REVENUECAT_API_BASE, "/subscribers/").concat(encodeURIComponent(validation.data.app_user_id)), {
                                            method: 'GET',
                                            headers: {
                                                Authorization: "Bearer ".concat(apiKey),
                                                'Content-Type': 'application/json',
                                            },
                                        })];
                                    case 1:
                                        response = _e.sent();
                                        if (!!response.ok) return [3 /*break*/, 3];
                                        return [4 /*yield*/, response.text()];
                                    case 2:
                                        errorText = _e.sent();
                                        logger.error('RevenueCat API error: %s - %s', response.status, errorText);
                                        return [2 /*return*/, {
                                                success: true,
                                                active_subscriptions: [],
                                                message: 'Unable to check subscriptions',
                                                apiError: true,
                                            }];
                                    case 3: return [4 /*yield*/, response.json()];
                                    case 4:
                                        data = (_e.sent());
                                        subscriber = data.subscriber;
                                        if (!subscriber) {
                                            return [2 /*return*/, {
                                                    success: true,
                                                    active_subscriptions: [],
                                                    message: 'No subscriber found',
                                                }];
                                        }
                                        entitlements = subscriber.entitlements;
                                        activeSubscriptions = [];
                                        if (entitlements) {
                                            try {
                                                for (_a = tslib_1.__values(Object.entries(entitlements)), _b = _a.next(); !_b.done; _b = _a.next()) {
                                                    _c = tslib_1.__read(_b.value, 2), entitlementId = _c[0], entitlement = _c[1];
                                                    ent = entitlement;
                                                    isActive = ent.expires_date && new Date(ent.expires_date) > new Date();
                                                    isSubscribed = ent.is_subscribed === true || (ent.product_plan_interval && !ent.cancellation_date);
                                                    if (isActive || isSubscribed) {
                                                        activeSubscriptions.push({
                                                            product_id: ent.product_id || entitlementId,
                                                            expires_date: ent.expires_date,
                                                            is_subscribed: true,
                                                        });
                                                    }
                                                }
                                            }
                                            catch (e_10_1) { e_10 = { error: e_10_1 }; }
                                            finally {
                                                try {
                                                    if (_b && !_b.done && (_d = _a.return)) _d.call(_a);
                                                }
                                                finally { if (e_10) throw e_10.error; }
                                            }
                                        }
                                        return [2 /*return*/, {
                                                success: true,
                                                active_subscriptions: activeSubscriptions,
                                                message: activeSubscriptions.length > 0
                                                    ? "Found ".concat(activeSubscriptions.length, " active subscriptions")
                                                    : 'No active subscriptions',
                                            }];
                                }
                            });
                        }); }, 
                        // Fallback: fail safe - return no subscriptions if circuit is open
                        function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            return tslib_1.__generator(this, function (_a) {
                                logger.warn('RevenueCat circuit open - skipping subscription check');
                                return [2 /*return*/, {
                                        success: true,
                                        active_subscriptions: [],
                                        message: 'Subscription check unavailable',
                                        circuitOpen: true,
                                    }];
                            });
                        }); })];
                case 1:
                    subscriptionResult = _a.sent();
                    // Handle circuit breaker fallback result
                    if ('apiError' in subscriptionResult || 'circuitOpen' in subscriptionResult) {
                        return [2 /*return*/, JSON.stringify(subscriptionResult)];
                    }
                    logger.info('Subscription check complete for user %s: %d active', validation.data.app_user_id, subscriptionResult.active_subscriptions.length);
                    return [2 /*return*/, JSON.stringify(subscriptionResult)];
            }
        });
    });
}
function registerRpcCheckSubscriptions(initializer) {
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
function rpcAppLaunchCheck(ctx, logger, nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, pendingResult, _a, _b, refundResult, _c, _d, subscriptionResult, _e, _f;
        return tslib_1.__generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    logger.info('Running app launch check for user: %s', ctx.userId);
                    validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.app_launch_check, payload, 'app_launch_check');
                    if (!validation.success) {
                        return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('app_launch_check', validation.error)];
                    }
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, rpcProcessPendingPurchases(ctx, logger, nk, '{}')];
                case 1:
                    pendingResult = _b.apply(_a, [_g.sent()]);
                    _d = (_c = JSON).parse;
                    return [4 /*yield*/, rpcCheckRefunds(ctx, logger, nk, '{}')];
                case 2:
                    refundResult = _d.apply(_c, [_g.sent()]);
                    _f = (_e = JSON).parse;
                    return [4 /*yield*/, rpcCheckSubscriptions(ctx, logger, nk, '{}')];
                case 3:
                    subscriptionResult = _f.apply(_e, [_g.sent()]);
                    return [2 /*return*/, JSON.stringify({
                            success: true,
                            pending_purchases: pendingResult,
                            refunds: refundResult,
                            subscriptions: subscriptionResult,
                        })];
            }
        });
    });
}
function registerRpcAppLaunchCheck(initializer) {
    initializer.registerRpc('armored_archer/app_launch_check', rpcAppLaunchCheck);
}
// ============================================================
// REVENUECAT WEBHOOK HANDLER
// ============================================================
/**
 * RevenueCat webhook secret for signature verification.
 * Configure via REVENUECAT_WEBHOOK_SECRET environment variable.
 */
function getRevenueCatWebhookSecret() {
    return config_1.config.revenuecat.webhookSecret || process.env.REVENUECAT_WEBHOOK_SECRET;
}
/**
 * Verify RevenueCat webhook signature (HMAC-SHA256).
 * This ensures the webhook request actually came from RevenueCat.
 */
function verifyWebhookSignature(payload, signature, secret) {
    if (!signature) {
        return false;
    }
    var crypto = require('crypto');
    var expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    // Use timing-safe comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
        return false;
    }
    var result = 0;
    for (var i = 0; i < signature.length; i++) {
        result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
}
/**
 * Map RevenueCat product ID to gem amount.
 */
function getGemAmountForProduct(productId, logger) {
    var catalog = getStoreCatalog(logger);
    var bundle = catalog[productId];
    return bundle ? bundle.gem_amount : null;
}
/**
 * Handle initial purchase event - award gems to player.
 */
function handleInitialPurchase(nk_1, userId_1, productId_1, logger_1) {
    return tslib_1.__awaiter(this, arguments, void 0, function (nk, userId, productId, logger, eventType) {
        var gemAmount, playerCurrency;
        if (eventType === void 0) { eventType = 'initial_purchase'; }
        return tslib_1.__generator(this, function (_a) {
            gemAmount = getGemAmountForProduct(productId, logger);
            if (!gemAmount) {
                logger.error('Unknown product ID in webhook: %s', productId);
                return [2 /*return*/, { success: false, message: 'Unknown product ID', event_type: eventType }];
            }
            playerCurrency = getPlayerCurrencyWithCache(nk, userId, logger);
            // Check for max balance
            if (wouldExceedMaxBalance(playerCurrency.gems, gemAmount)) {
                logger.warn('Purchase would exceed max balance for user %s', userId);
                return [2 /*return*/, {
                        success: false,
                        message: 'Gem balance would exceed maximum',
                        gems_awarded: 0,
                        new_balance: playerCurrency.gems,
                        event_type: eventType,
                    }];
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
            return [2 /*return*/, { success: true, message: 'Gems awarded', gems_awarded: gemAmount, new_balance: playerCurrency.gems, event_type: eventType }];
        });
    });
}
/**
 * Handle non-renewal/cancellation event.
 */
function handleSubscriptionCancelled(nk, userId, productId, reason, logger, eventType) {
    if (eventType === void 0) { eventType = 'cancellation'; }
    logger.info('Webhook: Subscription cancelled for user %s, product %s, reason: %s', userId, productId, reason || 'not specified');
    // Mark subscription as cancelled in storage
    var subscriptionKey = userId;
    var existingData = nk.storageRead([{
            collection: 'player_subscription',
            key: subscriptionKey,
            userId: userId,
        }]);
    if (existingData && existingData.length > 0) {
        var value = existingData[0].value;
        // Handle empty or non-JSON values
        if (!value || typeof value !== 'string') {
            logger.warn('No valid subscription data found for user %s', userId);
            return { success: true, message: 'Cancellation noted (no subscription found)', event_type: eventType };
        }
        var subscription = JSON.parse(value);
        subscription.active = false;
        subscription.cancelled = true;
        subscription.cancelled_at = new Date().toISOString();
        subscription.cancel_reason = reason || 'user_cancelled';
        nk.storageWrite([{
                collection: 'player_subscription',
                key: subscriptionKey,
                value: JSON.stringify(subscription),
                userId: userId,
            }]);
    }
    return { success: true, message: 'Cancellation noted', event_type: eventType };
}
/**
 * Handle billing issue event (e.g., payment failed, card expired).
 */
function handleBillingIssue(nk, userId, productId, logger, eventType) {
    if (eventType === void 0) { eventType = 'billing_issue'; }
    logger.info('Webhook: Billing issue for user %s, product %s', userId, productId);
    // Mark subscription as having billing issues
    var subscriptionKey = userId;
    var existingData = nk.storageRead([{
            collection: 'player_subscription',
            key: subscriptionKey,
            userId: userId,
        }]);
    if (existingData && existingData.length > 0) {
        var value = existingData[0].value;
        // Handle empty or non-JSON values
        if (!value || typeof value !== 'string') {
            logger.warn('No valid subscription data found for user %s', userId);
            return { success: true, message: 'Billing issue recorded (no subscription found)', event_type: eventType };
        }
        var subscription = JSON.parse(value);
        subscription.billing_issue = true;
        subscription.billing_issue_at = new Date().toISOString();
        nk.storageWrite([{
                collection: 'player_subscription',
                key: subscriptionKey,
                value: JSON.stringify(subscription),
                userId: userId,
            }]);
    }
    return { success: true, message: 'Billing issue recorded', event_type: eventType };
}
/**
 * Handle subscription expiration.
 */
function handleSubscriptionExpired(_nk, userId, productId, reason, logger, eventType) {
    if (eventType === void 0) { eventType = 'expiration'; }
    logger.info('Webhook: Subscription expired for user %s, product %s, reason: %s', userId, productId, reason || 'not specified');
    return { success: true, message: 'Expiration noted', event_type: eventType };
}
/**
 * Handle product transfer (account migration).
 */
function handleProductChange(nk, userId, transferredFrom, productId, logger) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            logger.info('Webhook: Product transferred from %s to %s for product %s', transferredFrom, userId, productId);
            // For subscription product changes, just record the change without awarding gems
            // (premium subscriptions don't award gems, only consumable gem packs do)
            return [2 /*return*/, { success: true, message: 'Product change noted', event_type: 'product_change' }];
        });
    });
}
/**
 * RevenueCat webhook handler.
 * Processes incoming webhooks from RevenueCat.
 */
function rpcRevenueCatWebhook(ctx, logger, nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var webhookSecret, signature, webhookData, eventObj, eventType, normalizedEventType, appUserId, productId, result, _a, refundAmount, refundReason, refundResult;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    logger.info('Processing RevenueCat webhook');
                    webhookSecret = getRevenueCatWebhookSecret();
                    // Verify webhook signature if secret is configured
                    if (webhookSecret) {
                        signature = ctx.variables['x-revenuecat-signature'] || '';
                        if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
                            logger.error('Invalid webhook signature');
                            return [2 /*return*/, JSON.stringify({
                                    success: false,
                                    error: 'Invalid signature',
                                })];
                        }
                    }
                    else {
                        logger.warn('RevenueCat webhook secret not configured - skipping signature verification');
                    }
                    try {
                        webhookData = JSON.parse(payload);
                    }
                    catch (e) {
                        logger.error('Failed to parse webhook payload: %s', e);
                        return [2 /*return*/, JSON.stringify({
                                success: false,
                                error: 'Invalid payload',
                            })];
                    }
                    // Validate payload is not empty
                    if (!payload || payload.trim() === '') {
                        logger.error('Empty webhook payload received');
                        return [2 /*return*/, JSON.stringify({
                                success: false,
                                error: 'Invalid payload',
                            })];
                    }
                    eventObj = webhookData.event;
                    eventType = webhookData.event_type ||
                        webhookData.eventType ||
                        (eventObj === null || eventObj === void 0 ? void 0 : eventObj.event_type) ||
                        (eventObj === null || eventObj === void 0 ? void 0 : eventObj.type) ||
                        webhookData.type ||
                        '';
                    normalizedEventType = eventType.toLowerCase();
                    appUserId = webhookData.app_user_id || // Check top-level first (test payloads)
                        webhookData.appUserId ||
                        webhookData.user_id ||
                        webhookData.userId ||
                        (eventObj === null || eventObj === void 0 ? void 0 : eventObj.app_user_id) ||
                        (eventObj === null || eventObj === void 0 ? void 0 : eventObj.appUserId) ||
                        '';
                    productId = webhookData.product_id || // Check top-level first (test payloads)
                        webhookData.productId ||
                        (eventObj === null || eventObj === void 0 ? void 0 : eventObj.product_id) ||
                        (eventObj === null || eventObj === void 0 ? void 0 : eventObj.productId) ||
                        '';
                    if (!appUserId) {
                        logger.error('Missing app_user_id in webhook payload');
                        return [2 /*return*/, JSON.stringify({ success: false, error: 'Missing app_user_id' })];
                    }
                    _a = normalizedEventType;
                    switch (_a) {
                        case 'initial_purchase': return [3 /*break*/, 1];
                        case 'renewal': return [3 /*break*/, 1];
                        case 'cancellation': return [3 /*break*/, 3];
                        case 'uncancellation': return [3 /*break*/, 3];
                        case 'non_renewing_purchase_cancelled': return [3 /*break*/, 3];
                        case 'billing_issue': return [3 /*break*/, 4];
                        case 'expiration': return [3 /*break*/, 5];
                        case 'transfer': return [3 /*break*/, 6];
                        case 'product_change': return [3 /*break*/, 6];
                        case 'refund': return [3 /*break*/, 8];
                    }
                    return [3 /*break*/, 10];
                case 1: return [4 /*yield*/, handleInitialPurchase(nk, appUserId, productId, logger, normalizedEventType)];
                case 2:
                    result = _b.sent();
                    return [3 /*break*/, 11];
                case 3:
                    result = handleSubscriptionCancelled(nk, appUserId, productId, webhookData.reason, logger, normalizedEventType);
                    return [3 /*break*/, 11];
                case 4:
                    result = handleBillingIssue(nk, appUserId, productId, logger, normalizedEventType);
                    return [3 /*break*/, 11];
                case 5:
                    result = handleSubscriptionExpired(nk, appUserId, productId, webhookData.reason, logger, normalizedEventType);
                    return [3 /*break*/, 11];
                case 6: return [4 /*yield*/, handleProductChange(nk, appUserId, webhookData.transferred_from, productId, logger)];
                case 7:
                    result = _b.sent();
                    return [3 /*break*/, 11];
                case 8:
                    refundAmount = getGemAmountForProduct(productId, logger) || 0;
                    refundReason = mapWebhookReasonToRefundReason(webhookData.reason);
                    return [4 /*yield*/, processRefund(nk, appUserId, refundAmount, webhookData.transaction_id || webhookData.refund_transaction_id || '', refundReason, logger)];
                case 9:
                    refundResult = _b.sent();
                    result = refundResult;
                    return [3 /*break*/, 11];
                case 10:
                    logger.info('Webhook: Received unhandled event type: %s', eventType);
                    result = { success: true, message: "Event ".concat(eventType, " noted but not processed"), event_type: normalizedEventType };
                    _b.label = 11;
                case 11: return [2 /*return*/, JSON.stringify(result)];
            }
        });
    });
}
function registerRpcRevenueCatWebhook(initializer) {
    initializer.registerRpc('armored_archer/revenuecat_webhook', rpcRevenueCatWebhook);
}
