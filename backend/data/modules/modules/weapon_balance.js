"use strict";
/**
 * Weapon Balance Module
 * @fileoverview Manages weapon balance data, validation, and admin adjustments for PvP.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEAPON_BALANCE_CONSTANTS = exports.WeaponTier = void 0;
exports.calculatePvpDamage = calculatePvpDamage;
exports.calculateWeaponPowerRating = calculateWeaponPowerRating;
exports.validateWeaponPower = validateWeaponPower;
exports.applyBalanceAdjustment = applyBalanceAdjustment;
exports.trackWeaponUsage = trackWeaponUsage;
exports.getBalanceAdjustments = getBalanceAdjustments;
exports.rpcApplyBalanceAdjustment = rpcApplyBalanceAdjustment;
exports.getWeaponStats = getWeaponStats;
exports.rpcGetBalanceMetrics = rpcGetBalanceMetrics;
const audit_1 = require("./audit");
const validation_1 = require("./validation");
/**
 * Weapon tier definitions with power multipliers.
 * These correspond to the gear_rarity enum values.
 */
var WeaponTier;
(function (WeaponTier) {
    WeaponTier[WeaponTier["COMMON"] = 0] = "COMMON";
    WeaponTier[WeaponTier["RARE"] = 1] = "RARE";
    WeaponTier[WeaponTier["EPIC"] = 2] = "EPIC";
    WeaponTier[WeaponTier["LEGENDARY"] = 3] = "LEGENDARY";
})(WeaponTier || (exports.WeaponTier = WeaponTier = {}));
/**
 * Damage multipliers for each weapon tier.
 */
const TIER_MULTIPLIERS = {
    [WeaponTier.COMMON]: 1.0,
    [WeaponTier.RARE]: 1.3,
    [WeaponTier.EPIC]: 1.6,
    [WeaponTier.LEGENDARY]: 2.0,
};
/**
 * Base damage values for each gear type.
 */
const BASE_DAMAGES = {
    helm: 0,
    armor: 0,
    bow: 10,
    arrow: 5,
    amulet: 2,
};
/**
 * PvP damage reduction coefficient.
 */
const PVP_DAMAGE_REDUCTION = 0.85;
/**
 * Maximum damage as percentage of tier average (anti-one-shot protection).
 */
const MAX_DAMAGE_PERCENTAGE = 2.0;
/**
 * Calculates PvP-optimized damage for a weapon.
 *
 * @param base_damage - Base damage value from weapon definition
 * @param tier - Weapon tier (0=Common, 1=Rare, 2=Epic, 3=Legendary)
 * @param weapon_stats - Optional stat bonuses
 * @param balance_multiplier - Optional balance adjustment multiplier
 * @returns PvP damage value
 */
function calculatePvpDamage(base_damage, tier, weapon_stats = {}, balance_multiplier = 1.0) {
    let pvpDamage = base_damage;
    // Apply tier multiplier
    const tierMultiplier = TIER_MULTIPLIERS[tier] || TIER_MULTIPLIERS[WeaponTier.COMMON];
    pvpDamage *= tierMultiplier;
    // Add stat-based damage BEFORE the curve (so stats aren't negated by diminishing returns)
    if (weapon_stats.attack) {
        pvpDamage += weapon_stats.attack * 0.5;
    }
    if (weapon_stats.ability_power) {
        pvpDamage += weapon_stats.ability_power * 0.3;
    }
    // Apply damage curve with diminishing returns
    pvpDamage = applyDamageCurve(pvpDamage, tier);
    // Apply PvP damage reduction
    pvpDamage *= PVP_DAMAGE_REDUCTION;
    // Enforce maximum damage cap
    const maxAllowed = getTierAverageDamage(tier) * MAX_DAMAGE_PERCENTAGE;
    if (pvpDamage > maxAllowed) {
        pvpDamage = maxAllowed;
    }
    // Apply balance adjustment
    pvpDamage *= balance_multiplier;
    return Math.max(0, pvpDamage);
}
/**
 * Applies diminishing returns to high damage values.
 *
 * Uses a logarithmic curve to prevent exponential scaling.
 *
 * @param damage - Input damage value
 * @param tier - Weapon tier for curve tuning
 * @returns Curve-adjusted damage value
 */
function applyDamageCurve(damage, tier) {
    if (damage <= 0)
        return 0;
    const curveFactor = 0.1 + tier * 0.025;
    return damage * (1.0 - curveFactor * Math.log(1.0 + damage / 20.0));
}
/**
 * Calculates the average expected damage for a weapon tier.
 *
 * @param tier - Weapon tier
 * @returns Average damage value for the tier
 */
function getTierAverageDamage(tier) {
    const tierMultiplier = TIER_MULTIPLIERS[tier] || 1.0;
    const avgBowDamage = BASE_DAMAGES.bow * tierMultiplier;
    const avgArrowDamage = BASE_DAMAGES.arrow * tierMultiplier;
    return (avgBowDamage + avgArrowDamage) / 2.0;
}
/**
 * Calculates weapon power rating for matchmaking.
 *
 * @param weaponData - Weapon information
 * @returns Power rating (higher = more powerful)
 */
function calculateWeaponPowerRating(weaponData) {
    let powerRating = 0;
    // Base power from tier
    const basePower = 100 * (weaponData.rarity + 1);
    powerRating += basePower;
    // Add power from stats
    if (weaponData.stats) {
        const stats = weaponData.stats;
        if (stats.attack)
            powerRating += stats.attack * 2;
        if (stats.ability_power)
            powerRating += stats.ability_power * 2;
        if (stats.critical_chance)
            powerRating += stats.critical_chance * 5;
        if (stats.critical_damage)
            powerRating += stats.critical_damage * 2;
        if (stats.defense)
            powerRating += stats.defense;
    }
    return Math.max(0, powerRating);
}
/**
 * Validates that a weapon's damage falls within acceptable range.
 *
 * @param baseDamage - Weapon's base damage
 * @param tier - Weapon tier
 * @returns True if damage is valid, false otherwise
 */
function validateWeaponPower(baseDamage, tier) {
    const maxAllowed = getTierAverageDamage(tier) * MAX_DAMAGE_PERCENTAGE;
    if (baseDamage > maxAllowed) {
        console.error(`Weapon damage ${baseDamage} exceeds maximum allowed ${maxAllowed} for tier ${tier}`);
        return false;
    }
    return true;
}
/**
 * Applies a balance adjustment to a weapon.
 *
 * This is an admin function that allows hotfixes without code deployment.
 *
 * @param nk - Nakama runtime module
 * @param userId - Admin user ID
 * @param request - Balance adjustment request
 * @returns Success response or error
 */
async function applyBalanceAdjustment(nk, userId, request) {
    // Validate multiplier
    if (request.multiplier <= 0) {
        return {
            success: false,
            error: 'Balance multiplier must be positive',
        };
    }
    // Validate reason
    if (!request.reason || request.reason.trim().length === 0) {
        return {
            success: false,
            error: 'Reason is required for balance adjustments',
        };
    }
    // Check if user is admin (simplified - in production, check admin roles)
    const isAuthorized = await checkAdminAuthorization(nk, userId);
    if (!isAuthorized) {
        return {
            success: false,
            error: 'Unauthorized: Admin access required',
        };
    }
    // Create adjustment record
    const adjustment = {
        adjustment_id: `bal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        weapon_id: request.weapon_id,
        multiplier: request.multiplier,
        reason: request.reason,
        created_at: Date.now(),
        created_by: userId,
    };
    // Store adjustment in Nakama storage
    try {
        await nk.storageWrite([
            {
                collection: 'weapon_balance_adjustments',
                key: adjustment.adjustment_id,
                userId: userId,
                value: JSON.stringify(adjustment),
                permissionRead: 2, // Public read (for clients to fetch)
                permissionWrite: 0, // No public write
            },
        ]);
        // Log audit trail
        await (0, audit_1.logAudit)(nk, userId, null, // ipAddress - not available in this context
        'balance_adjustment_applied', 'weapon_balance_adjustment', {
            weapon_id: request.weapon_id,
            multiplier: request.multiplier,
            reason: request.reason,
            adjustment_id: adjustment.adjustment_id,
        }, 'success');
        return {
            success: true,
            adjustment,
        };
    }
    catch (error) {
        console.error('Failed to apply balance adjustment:', error);
        return {
            success: false,
            error: 'Failed to store balance adjustment',
        };
    }
}
/**
 * Checks if a user has admin authorization.
 *
 * @param nk - Nakama runtime module
 * @param userId - User ID to check
 * @returns True if user is authorized
 */
async function checkAdminAuthorization(nk, userId) {
    try {
        // In production, this would check user groups or roles
        // For now, we'll check for an admin flag in user storage
        const objects = await nk.storageRead([
            {
                collection: 'user_metadata',
                key: 'admin_status',
                userId: userId,
            },
        ]);
        if (objects.length > 0) {
            const data = objects[0].value;
            const metadata = JSON.parse(data);
            return metadata.is_admin === true;
        }
        return false;
    }
    catch (error) {
        console.error('Failed to check admin authorization:', error);
        return false;
    }
}
/**
 * Tracks weapon usage statistics for balance tuning.
 *
 * @param nk - Nakama runtime module
 * @param weaponId - Weapon identifier
 * @param matchResult - Match outcome (win/loss)
 * @param ratingDiff - Rating difference between players
 */
async function trackWeaponUsage(nk, weaponId, matchResult, ratingDiff) {
    try {
        const statsKey = `weapon_stats_${weaponId}`;
        const objects = await nk.storageRead([
            {
                collection: 'weapon_usage_stats',
                key: statsKey,
                userId: '00000000-0000-0000-0000-000000000000', // System user
            },
        ]);
        let stats = {
            weapon_id: weaponId,
            matches_played: 0,
            wins: 0,
            losses: 0,
            average_rating_diff: 0,
            last_updated: Date.now(),
        };
        if (objects.length > 0) {
            stats = JSON.parse(objects[0].value);
        }
        // Update statistics
        stats.matches_played += 1;
        if (matchResult === 'win') {
            stats.wins += 1;
        }
        else {
            stats.losses += 1;
        }
        // Update average rating difference (running average)
        stats.average_rating_diff =
            (stats.average_rating_diff * (stats.matches_played - 1) + ratingDiff) / stats.matches_played;
        stats.last_updated = Date.now();
        // Store updated stats
        await nk.storageWrite([
            {
                collection: 'weapon_usage_stats',
                key: statsKey,
                userId: '00000000-0000-0000-0000-000000000000',
                value: JSON.stringify(stats),
                permissionRead: 2,
                permissionWrite: 0,
            },
        ]);
    }
    catch (error) {
        console.error('Failed to track weapon usage:', error);
    }
}
/**
 * Retrieves current balance adjustments for all weapons.
 *
 * @param nk - Nakama runtime module
 * @returns Map of weapon_id to multiplier
 */
async function getBalanceAdjustments(nk) {
    try {
        // Read all balance adjustments
        const objects = await nk.storageRead([
            {
                collection: 'weapon_balance_adjustments',
                userId: '00000000-0000-0000-0000-000000000000', // System user
                key: '*',
            },
        ]);
        const adjustments = {};
        for (const obj of objects) {
            const adjustment = JSON.parse(obj.value);
            // Use the most recent adjustment for each weapon
            if (!adjustments[adjustment.weapon_id] || obj.createTime > 0) {
                adjustments[adjustment.weapon_id] = adjustment.multiplier;
            }
        }
        return adjustments;
    }
    catch (error) {
        console.error('Failed to get balance adjustments:', error);
        return {};
    }
}
/**
 * Admin RPC handler for applying balance adjustments.
 *
 * @param ctx - Runtime context
 * @param logger - Runtime logger
 * @param nk - Nakama runtime module
 * @param payload - Request payload (JSON string)
 * @returns Response (JSON string)
 */
async function rpcApplyBalanceAdjustment(ctx, logger, nk, payload) {
    logger.debug('ApplyBalanceAdjustment RPC called');
    // Validate payload
    const validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.apply_balance_adjustment, payload, 'apply_balance_adjustment');
    if (!validation.success) {
        return JSON.stringify(validation.error);
    }
    // Apply adjustment
    const result = await applyBalanceAdjustment(nk, ctx.userId, validation.data);
    return JSON.stringify(result);
}
/**
 * Retrieves weapon usage statistics for a specific weapon.
 *
 * @param nk - Nakama runtime module
 * @param weaponId - Weapon identifier
 * @returns Weapon usage statistics
 */
async function getWeaponStats(nk, weaponId) {
    try {
        const statsKey = `weapon_stats_${weaponId}`;
        const objects = await nk.storageRead([
            {
                collection: 'weapon_usage_stats',
                key: statsKey,
                userId: '00000000-0000-0000-0000-000000000000',
            },
        ]);
        if (objects.length > 0) {
            return JSON.parse(objects[0].value);
        }
        return null;
    }
    catch (error) {
        console.error('Failed to get weapon stats:', error);
        return null;
    }
}
/**
 * Admin RPC handler for retrieving weapon balance metrics.
 *
 * @param ctx - Runtime context
 * @param logger - Runtime logger
 * @param nk - Nakama runtime module
 * @param payload - Request payload (optional weapon_id)
 * @returns Weapon balance statistics
 */
async function rpcGetBalanceMetrics(ctx, logger, nk, payload) {
    logger.debug('GetBalanceMetrics RPC called');
    try {
        const adjustments = await getBalanceAdjustments(nk);
        // Parse optional weapon_id from payload
        let weaponId;
        if (payload && payload.trim() !== '{}') {
            try {
                const parsed = JSON.parse(payload);
                weaponId = parsed.weapon_id;
            }
            catch {
                // Invalid JSON, ignore
            }
        }
        if (weaponId) {
            // Return stats for specific weapon
            const stats = await getWeaponStats(nk, weaponId);
            return JSON.stringify({
                success: true,
                weapon_id: weaponId,
                balance_multiplier: adjustments[weaponId] || 1.0,
                usage_stats: stats,
            });
        }
        // Return summary of all adjustments
        return JSON.stringify({
            success: true,
            active_adjustments: Object.keys(adjustments).length,
            adjustments,
        });
    }
    catch (error) {
        logger.error('Failed to get balance metrics: %s', error);
        return JSON.stringify({
            success: false,
            error: 'Failed to retrieve balance metrics',
        });
    }
}
// Export constants for use in other modules
exports.WEAPON_BALANCE_CONSTANTS = {
    TIER_MULTIPLIERS,
    BASE_DAMAGES,
    PVP_DAMAGE_REDUCTION,
    MAX_DAMAGE_PERCENTAGE,
};
