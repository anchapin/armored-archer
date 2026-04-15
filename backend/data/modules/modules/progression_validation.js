"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressionValidation = void 0;
exports.validatePlayerStats = validatePlayerStats;
exports.validateGearInventory = validateGearInventory;
exports.recordStatMutation = recordStatMutation;
exports.validateFullProgression = validateFullProgression;
const audit_1 = require("./audit");
const STAT_NAMES = ['attack', 'defense', 'dodge', 'crit_rate'];
const HELMET_TYPES = ['helmet', 'head', 'mask', 'crown'];
function validatePlayerStats(playerStats, previousStats) {
    const issues = [];
    // 1. Validate ability_points <= level - 1
    const expectedAbilityPoints = playerStats.level - 1;
    if (playerStats.ability_points < 0) {
        issues.push({
            severity: 'critical',
            category: 'ability_points',
            message: 'Ability points cannot be negative',
            details: { ability_points: playerStats.ability_points, level: playerStats.level },
        });
    }
    if (playerStats.ability_points > expectedAbilityPoints) {
        issues.push({
            severity: 'critical',
            category: 'ability_points',
            message: 'Ability points exceed expected maximum for level',
            details: {
                ability_points: playerStats.ability_points,
                expected_max: expectedAbilityPoints,
                level: playerStats.level,
            },
        });
    }
    // 2. Validate XP monotonicity
    if (previousStats && playerStats.xp < previousStats.xp) {
        issues.push({
            severity: 'critical',
            category: 'xp_mutation',
            message: 'XP decreased - monotonicity violated',
            details: { previous_xp: previousStats.xp, current_xp: playerStats.xp },
        });
    }
    // 3. Validate level/XP correspondence
    const calculatedLevel = calculateLevelFromXP(playerStats.xp);
    if (playerStats.level !== calculatedLevel) {
        issues.push({
            severity: 'critical',
            category: 'level_xp_mismatch',
            message: 'Level does not match XP progression',
            details: {
                stored_level: playerStats.level,
                calculated_level: calculatedLevel,
                xp: playerStats.xp,
            },
        });
    }
    // 4. Validate stat values non-negative
    for (const statName of STAT_NAMES) {
        const val = playerStats.stats[statName];
        if (val < 0) {
            issues.push({
                severity: 'critical',
                category: 'stat_validity',
                message: `Stat ${statName} is negative`,
                details: { stat: statName, value: val },
            });
        }
    }
    return { is_valid: issues.filter((i) => i.severity === 'critical').length === 0, issues };
}
function validateGearInventory(inventory) {
    const issues = [];
    // 1. Check for duplicate gear
    const equippedIds = Object.values(inventory.equipped_gear).filter((id) => id !== null);
    if (new Set(equippedIds).size < equippedIds.length) {
        issues.push({
            severity: 'critical',
            category: 'duplicate_equipped_gear',
            message: 'Same gear equipped in multiple slots',
            details: { equipped: inventory.equipped_gear },
        });
    }
    // 2. Check for multiple helmets
    const helmetSlots = [];
    for (const [slot, gearId] of Object.entries(inventory.equipped_gear)) {
        if (gearId) {
            const gear = inventory.gear.find((g) => g.id === gearId);
            if (gear && HELMET_TYPES.some((h) => gear.type.toLowerCase().includes(h))) {
                helmetSlots.push(slot);
            }
        }
    }
    if (helmetSlots.length > 1) {
        issues.push({
            severity: 'critical',
            category: 'multiple_helmets',
            message: 'Multiple helmet/head pieces equipped',
            details: { helmet_count: helmetSlots.length, slots: helmetSlots },
        });
    }
    // 3. Validate all equipped gear exists
    for (const [slot, gearId] of Object.entries(inventory.equipped_gear)) {
        if (gearId && !inventory.gear.find((g) => g.id === gearId)) {
            issues.push({
                severity: 'critical',
                category: 'missing_equipped_gear',
                message: 'Equipped gear not found in inventory',
                details: { slot, gear_id: gearId },
            });
        }
    }
    return { is_valid: issues.filter((i) => i.severity === 'critical').length === 0, issues };
}
function recordStatMutation(nk, userId, ipAddress, before, after, source) {
    const delta = {};
    for (const key of Object.keys(after)) {
        delta[key] = after[key] - (before[key] || 0);
    }
    (0, audit_1.logAudit)(nk, userId, ipAddress ?? null, 'stat_mutation', 'player_stats', { before, after, delta, source }, 'success');
}
function validateFullProgression(nk, userId, logger, playerStats, inventory, ipAddress) {
    const statsValidation = validatePlayerStats(playerStats);
    const gearValidation = validateGearInventory(inventory);
    const allIssues = [...statsValidation.issues, ...gearValidation.issues];
    const isValid = statsValidation.is_valid && gearValidation.is_valid;
    if (!isValid) {
        (0, audit_1.logAudit)(nk, userId, ipAddress ?? null, 'progression_validation', 'player_progression', { stats_issues: statsValidation.issues, gear_issues: gearValidation.issues }, 'success');
        logger.warn('Progression validation failed for user %s: %d critical issues', userId, allIssues.filter((i) => i.severity === 'critical').length);
    }
    return { is_valid: isValid, issues: allIssues };
}
function calculateLevelFromXP(xp) {
    return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}
exports.ProgressionValidation = {
    validatePlayerStats,
    validateGearInventory,
    validateFullProgression,
    recordStatMutation,
};
