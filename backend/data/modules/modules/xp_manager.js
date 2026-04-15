"use strict";
/**
 * XP Manager Module
 * @fileoverview Manages XP curve calculations and level progression.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelCurveType = exports.XpResponseSchema = void 0;
exports.getXpForLevel = getXpForLevel;
exports.getLevelCurveType = getLevelCurveType;
exports.calculateXpGain = calculateXpGain;
exports.getProgressPercentage = getProgressPercentage;
exports.validateXpGain = validateXpGain;
exports.validateXpGainSimple = validateXpGainSimple;
const zod_1 = require("zod");
/**
 * XP request schema
 */
const XpGainSchema = zod_1.z.object({
    xp_amount: zod_1.z.number().min(1),
    source: zod_1.z.enum(['pve', 'pvp']),
    level: zod_1.z.number().min(1).max(50),
});
/**
 * XP response schema
 */
exports.XpResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    xp_gained: zod_1.z.number(),
    total_xp: zod_1.z.number(),
    current_level: zod_1.z.number(),
    levels_gained: zod_1.z.number(),
});
/**
 * Level curve type
 */
var LevelCurveType;
(function (LevelCurveType) {
    LevelCurveType["EARLY"] = "early";
    LevelCurveType["MID"] = "mid";
    LevelCurveType["LATE"] = "late";
})(LevelCurveType || (exports.LevelCurveType = LevelCurveType = {}));
/**
 * XP curve configuration
 */
const XP_CURVE = {
    1: 0,
    2: 100,
    3: 300,
    4: 600,
    5: 1000,
    6: 1500,
    7: 2100,
    8: 2800,
    9: 3600,
    10: 4500,
    11: 5500,
    12: 6600,
    13: 7800,
    14: 9100,
    15: 10500,
    16: 12000,
    17: 13600,
    18: 15300,
    19: 17100,
    20: 19000,
    21: 21000,
    22: 23100,
    23: 25300,
    24: 27600,
    25: 30000,
    26: 32500,
    27: 35100,
    28: 37800,
    29: 40600,
    30: 43500,
    31: 46500,
    32: 49600,
    33: 52800,
    34: 56100,
    35: 59500,
    36: 63000,
    37: 66600,
    38: 70300,
    39: 74100,
    40: 78000,
    41: 82000,
    42: 86100,
    43: 90300,
    44: 94600,
    45: 99000,
    46: 103500,
    47: 108100,
    48: 112800,
    49: 117600,
    50: 122500,
};
/**
 * Gets total XP required for a given level.
 *
 * @param level - Level to calculate XP for
 * @returns Total XP required for the level
 */
function getXpForLevel(level) {
    if (level < 1)
        return 0;
    if (level > 50)
        level = 50;
    return XP_CURVE[level] ?? 100 * level * level;
}
/**
 * Gets the level curve type for a given level.
 *
 * @param level - Level to classify
 * @returns Level curve type (early/mid/late)
 */
function getLevelCurveType(level) {
    if (level <= 10)
        return LevelCurveType.EARLY;
    if (level <= 30)
        return LevelCurveType.MID;
    return LevelCurveType.LATE;
}
/**
 * Calculates XP gain with level-based modifiers.
 *
 * @param baseXp - Base XP amount
 * @param level - Current player level
 * @returns Adjusted XP gain
 */
function calculateXpGain(baseXp, level) {
    const curveType = getLevelCurveType(level);
    let multiplier = 1.0;
    switch (curveType) {
        case LevelCurveType.EARLY:
            multiplier = 1.0;
            break;
        case LevelCurveType.MID:
            multiplier = 1.1;
            break;
        case LevelCurveType.LATE:
            multiplier = 1.2;
            break;
    }
    return Math.floor(baseXp * multiplier);
}
/**
 * Calculates progress percentage for current level.
 *
 * @param currentXp - Current XP
 * @param levelXp - XP required for current level
 * @param nextLevelXp - XP required for next level
 * @returns Progress percentage (0-100)
 */
function getProgressPercentage(currentXp, levelXp, nextLevelXp) {
    if (nextLevelXp <= levelXp)
        return 100;
    if (currentXp < levelXp)
        return 0;
    const xpIntoLevel = currentXp - levelXp;
    const xpToNextLevel = nextLevelXp - levelXp;
    // Clamp to 0-100 range
    return Math.min(100, Math.floor((xpIntoLevel / xpToNextLevel) * 100));
}
/**
 * Validates XP gain request.
 *
 * @param request - XP gain request to validate
 * @returns Validation result
 */
function validateXpGain(request) {
    const result = XpGainSchema.safeParse(request);
    if (!result.success) {
        return {
            valid: false,
            error: result.error.message,
        };
    }
    return { valid: true };
}
/**
 * Validates XP gain (simplified version for tests).
 *
 * @param xpAmount - XP amount to validate
 * @param level - Player level
 * @returns Validation result with reason
 */
function validateXpGainSimple(xpAmount, level) {
    if (xpAmount < 0) {
        return {
            valid: false,
            reason: 'negative XP values are not allowed',
        };
    }
    if (xpAmount === 0) {
        return {
            valid: false,
            reason: 'zero XP values are not allowed',
        };
    }
    if (level < 1 || level > 50) {
        return {
            valid: false,
            reason: 'level must be between 1 and 50',
        };
    }
    return { valid: true };
}
