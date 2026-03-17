"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressionValidation = void 0;
exports.validatePlayerStats = validatePlayerStats;
exports.validateGearInventory = validateGearInventory;
exports.recordStatMutation = recordStatMutation;
exports.validateFullProgression = validateFullProgression;
var tslib_1 = require("tslib");
var audit_1 = require("./audit");
var STAT_NAMES = ['attack', 'defense', 'dodge', 'crit_rate'];
var HELMET_TYPES = ['helmet', 'head', 'mask', 'crown'];
function validatePlayerStats(playerStats, previousStats) {
    var e_1, _a;
    var issues = [];
    // 1. Validate ability_points <= level - 1
    var expectedAbilityPoints = playerStats.level - 1;
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
    var calculatedLevel = calculateLevelFromXP(playerStats.xp);
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
    try {
        // 4. Validate stat values non-negative
        for (var STAT_NAMES_1 = tslib_1.__values(STAT_NAMES), STAT_NAMES_1_1 = STAT_NAMES_1.next(); !STAT_NAMES_1_1.done; STAT_NAMES_1_1 = STAT_NAMES_1.next()) {
            var statName = STAT_NAMES_1_1.value;
            var val = playerStats.stats[statName];
            if (val < 0) {
                issues.push({
                    severity: 'critical',
                    category: 'stat_validity',
                    message: "Stat ".concat(statName, " is negative"),
                    details: { stat: statName, value: val },
                });
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (STAT_NAMES_1_1 && !STAT_NAMES_1_1.done && (_a = STAT_NAMES_1.return)) _a.call(STAT_NAMES_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return { is_valid: issues.filter(function (i) { return i.severity === 'critical'; }).length === 0, issues: issues };
}
function validateGearInventory(inventory) {
    var e_2, _a, e_3, _b;
    var issues = [];
    // 1. Check for duplicate gear
    var equippedIds = Object.values(inventory.equipped_gear).filter(function (id) { return id !== null; });
    if (new Set(equippedIds).size < equippedIds.length) {
        issues.push({
            severity: 'critical',
            category: 'duplicate_equipped_gear',
            message: 'Same gear equipped in multiple slots',
            details: { equipped: inventory.equipped_gear },
        });
    }
    // 2. Check for multiple helmets
    var helmetSlots = [];
    var _loop_1 = function (slot, gearId) {
        if (gearId) {
            var gear_1 = inventory.gear.find(function (g) { return g.id === gearId; });
            if (gear_1 && HELMET_TYPES.some(function (h) { return gear_1.type.toLowerCase().includes(h); })) {
                helmetSlots.push(slot);
            }
        }
    };
    try {
        for (var _c = tslib_1.__values(Object.entries(inventory.equipped_gear)), _d = _c.next(); !_d.done; _d = _c.next()) {
            var _e = tslib_1.__read(_d.value, 2), slot = _e[0], gearId = _e[1];
            _loop_1(slot, gearId);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_2) throw e_2.error; }
    }
    if (helmetSlots.length > 1) {
        issues.push({
            severity: 'critical',
            category: 'multiple_helmets',
            message: 'Multiple helmet/head pieces equipped',
            details: { helmet_count: helmetSlots.length, slots: helmetSlots },
        });
    }
    var _loop_2 = function (slot, gearId) {
        if (gearId && !inventory.gear.find(function (g) { return g.id === gearId; })) {
            issues.push({
                severity: 'critical',
                category: 'missing_equipped_gear',
                message: 'Equipped gear not found in inventory',
                details: { slot: slot, gear_id: gearId },
            });
        }
    };
    try {
        // 3. Validate all equipped gear exists
        for (var _f = tslib_1.__values(Object.entries(inventory.equipped_gear)), _g = _f.next(); !_g.done; _g = _f.next()) {
            var _h = tslib_1.__read(_g.value, 2), slot = _h[0], gearId = _h[1];
            _loop_2(slot, gearId);
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return { is_valid: issues.filter(function (i) { return i.severity === 'critical'; }).length === 0, issues: issues };
}
function recordStatMutation(nk, userId, ipAddress, before, after, source) {
    var e_4, _a;
    var delta = {};
    try {
        for (var _b = tslib_1.__values(Object.keys(after)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var key = _c.value;
            delta[key] = after[key] - (before[key] || 0);
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_4) throw e_4.error; }
    }
    (0, audit_1.logAudit)(nk, userId, ipAddress !== null && ipAddress !== void 0 ? ipAddress : null, 'stat_mutation', 'player_stats', { before: before, after: after, delta: delta, source: source }, 'success');
}
function validateFullProgression(nk, userId, logger, playerStats, inventory, ipAddress) {
    var statsValidation = validatePlayerStats(playerStats);
    var gearValidation = validateGearInventory(inventory);
    var allIssues = tslib_1.__spreadArray(tslib_1.__spreadArray([], tslib_1.__read(statsValidation.issues), false), tslib_1.__read(gearValidation.issues), false);
    var isValid = statsValidation.is_valid && gearValidation.is_valid;
    if (!isValid) {
        (0, audit_1.logAudit)(nk, userId, ipAddress !== null && ipAddress !== void 0 ? ipAddress : null, 'progression_validation', 'player_progression', { stats_issues: statsValidation.issues, gear_issues: gearValidation.issues }, 'success');
        logger.warn('Progression validation failed for user %s: %d critical issues', userId, allIssues.filter(function (i) { return i.severity === 'critical'; }).length);
    }
    return { is_valid: isValid, issues: allIssues };
}
function calculateLevelFromXP(xp) {
    return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}
exports.ProgressionValidation = {
    validatePlayerStats: validatePlayerStats,
    validateGearInventory: validateGearInventory,
    validateFullProgression: validateFullProgression,
    recordStatMutation: recordStatMutation,
};
