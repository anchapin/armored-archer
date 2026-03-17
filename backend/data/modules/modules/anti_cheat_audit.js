"use strict";
/**
 * Anti-Cheat Audit & Forensics Module.
 * @fileoverview Implements violation tracking, user risk profiling,
 * automatic account flagging/suspension, and compliance reporting.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeAuditLogging = initializeAuditLogging;
exports.recordViolation = recordViolation;
exports.getUserViolationSummary = getUserViolationSummary;
exports.getTopViolators = getTopViolators;
exports.generateAuditReport = generateAuditReport;
exports.isUserSuspended = isUserSuspended;
exports.clearUserFlag = clearUserFlag;
exports.suspendUser = suspendUser;
exports.getAuditStats = getAuditStats;
var tslib_1 = require("tslib");
var defaultConfig = {
    enablePersistence: true,
    highRiskThreshold: 50,
    suspensionThreshold: 15,
    violationRetentionDays: 30,
    replayWindowMs: 300000,
};
var config = tslib_1.__assign({}, defaultConfig);
var nk;
var logger;
// In-memory storage for user risk profiles
var userRiskProfiles = new Map();
// Violation type weights for risk scoring
var VIOLATION_WEIGHTS = {
    replay_attack: 20,
    invalid_signature: 18,
    timing_attack: 12,
    out_of_turn: 8,
    clock_skew: 3,
    invalid_progression: 15,
    stat_manipulation: 25,
    inventory_tampering: 20,
};
/**
 * Initialize the audit logging system.
 */
function initializeAuditLogging(cfg, nakama, runtimeLogger) {
    config = tslib_1.__assign(tslib_1.__assign({}, config), cfg);
    nk = nakama;
    logger = runtimeLogger;
    logger.info('Audit logging system initialized with config: %O', {
        enablePersistence: config.enablePersistence,
        highRiskThreshold: config.highRiskThreshold,
        suspensionThreshold: config.suspensionThreshold,
    });
}
/**
 * Record a violation for a user.
 */
function recordViolation(userId, type, details) {
    if (details === void 0) { details = {}; }
    var timestamp = Date.now();
    var severity = getSeverity(type);
    var violation = {
        userId: userId,
        type: type,
        timestamp: timestamp,
        details: details,
        severity: severity,
    };
    var profile = userRiskProfiles.get(userId);
    if (!profile) {
        profile = {
            userId: userId,
            violations: [],
            riskScore: 0,
            isSuspended: false,
            firstViolation: timestamp,
            lastViolation: timestamp,
            violationCount: 0,
        };
        userRiskProfiles.set(userId, profile);
    }
    profile.violations.push(violation);
    profile.riskScore += VIOLATION_WEIGHTS[type] || 5;
    profile.violationCount++;
    profile.lastViolation = timestamp;
    // Check for auto-suspension
    if (profile.riskScore >= config.suspensionThreshold && !profile.isSuspended) {
        profile.isSuspended = true;
        logger.warn('User auto-suspended due to high risk score', {
            userId: userId,
            riskScore: profile.riskScore,
            violationCount: profile.violationCount,
        });
    }
    // Log to storage if enabled
    if (config.enablePersistence && nk) {
        try {
            var storageKey = "anti_cheat:violation:".concat(userId, ":").concat(timestamp);
            nk.storageWrite([
                {
                    collection: 'anti_cheat_violations',
                    key: storageKey,
                    userId: userId,
                    value: JSON.stringify(violation),
                },
            ]);
        }
        catch (err) {
            logger.error('Failed to persist violation', { error: err, userId: userId });
        }
    }
    logger.info('Anti-cheat violation recorded', {
        userId: userId,
        type: type,
        severity: severity,
        riskScore: profile.riskScore,
    });
}
/**
 * Get the severity level for a violation type.
 */
function getSeverity(type) {
    var weights = {
        replay_attack: 20,
        invalid_signature: 18,
        timing_attack: 12,
        out_of_turn: 8,
        clock_skew: 3,
        invalid_progression: 15,
        stat_manipulation: 25,
        inventory_tampering: 20,
    };
    var weight = weights[type] || 5;
    if (weight >= 20)
        return 'critical';
    if (weight >= 15)
        return 'high';
    if (weight >= 10)
        return 'medium';
    return 'low';
}
/**
 * Get a user's violation summary.
 */
function getUserViolationSummary(userId) {
    return userRiskProfiles.get(userId) || null;
}
/**
 * Get top violators by risk score.
 */
function getTopViolators(limit) {
    if (limit === void 0) { limit = 10; }
    var profiles = Array.from(userRiskProfiles.values());
    return profiles.sort(function (a, b) { return b.riskScore - a.riskScore; }).slice(0, limit);
}
/**
 * Generate an audit report for a user.
 */
function generateAuditReport(userId) {
    var e_1, _a;
    var profile = userRiskProfiles.get(userId);
    if (!profile) {
        return null;
    }
    var violationsByType = {
        replay_attack: 0,
        invalid_signature: 0,
        timing_attack: 0,
        out_of_turn: 0,
        clock_skew: 0,
        invalid_progression: 0,
        stat_manipulation: 0,
        inventory_tampering: 0,
    };
    var critical = 0;
    var high = 0;
    var medium = 0;
    var low = 0;
    try {
        for (var _b = tslib_1.__values(profile.violations), _c = _b.next(); !_c.done; _c = _b.next()) {
            var v = _c.value;
            violationsByType[v.type]++;
            switch (v.severity) {
                case 'critical':
                    critical++;
                    break;
                case 'high':
                    high++;
                    break;
                case 'medium':
                    medium++;
                    break;
                case 'low':
                    low++;
                    break;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var riskLevel = 'low';
    var recommendedAction = 'none';
    if (profile.riskScore >= config.suspensionThreshold) {
        riskLevel = 'critical';
        recommendedAction = 'suspend';
    }
    else if (profile.riskScore >= config.highRiskThreshold) {
        riskLevel = 'high';
        recommendedAction = 'flag';
    }
    else if (profile.riskScore >= 25) {
        riskLevel = 'medium';
        recommendedAction = 'monitor';
    }
    return {
        userId: userId,
        profile: profile,
        report: {
            totalViolations: profile.violationCount,
            criticalViolations: critical,
            highViolations: high,
            mediumViolations: medium,
            lowViolations: low,
            violationsByType: violationsByType,
            riskLevel: riskLevel,
            recommendedAction: recommendedAction,
        },
    };
}
/**
 * Check if a user is currently suspended.
 */
function isUserSuspended(userId) {
    var profile = userRiskProfiles.get(userId);
    return (profile === null || profile === void 0 ? void 0 : profile.isSuspended) || false;
}
/**
 * Clear a user's flag (admin action).
 */
function clearUserFlag(userId) {
    var profile = userRiskProfiles.get(userId);
    if (!profile) {
        return false;
    }
    profile.isSuspended = false;
    profile.riskScore = 0;
    profile.violations = [];
    logger.info('User flag cleared', { userId: userId });
    return true;
}
/**
 * Suspend a user (admin action).
 */
function suspendUser(userId, reason) {
    if (reason === void 0) { reason = 'admin_action'; }
    var profile = userRiskProfiles.get(userId);
    if (!profile) {
        userRiskProfiles.set(userId, {
            userId: userId,
            violations: [],
            riskScore: config.suspensionThreshold,
            isSuspended: true,
            firstViolation: Date.now(),
            lastViolation: Date.now(),
            violationCount: 0,
        });
    }
    else {
        profile.isSuspended = true;
        profile.riskScore = Math.max(profile.riskScore, config.suspensionThreshold);
    }
    logger.warn('User suspended manually', { userId: userId, reason: reason });
    return true;
}
/**
 * Get audit statistics.
 */
function getAuditStats() {
    var e_2, _a, e_3, _b;
    var profiles = Array.from(userRiskProfiles.values());
    var violationsByType = {
        replay_attack: 0,
        invalid_signature: 0,
        timing_attack: 0,
        out_of_turn: 0,
        clock_skew: 0,
        invalid_progression: 0,
        stat_manipulation: 0,
        inventory_tampering: 0,
    };
    var totalViolations = 0;
    try {
        for (var profiles_1 = tslib_1.__values(profiles), profiles_1_1 = profiles_1.next(); !profiles_1_1.done; profiles_1_1 = profiles_1.next()) {
            var profile = profiles_1_1.value;
            totalViolations += profile.violations.length;
            try {
                for (var _c = (e_3 = void 0, tslib_1.__values(profile.violations)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var v = _d.value;
                    violationsByType[v.type]++;
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_3) throw e_3.error; }
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (profiles_1_1 && !profiles_1_1.done && (_a = profiles_1.return)) _a.call(profiles_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return {
        totalViolations: totalViolations,
        uniqueUsers: profiles.length,
        suspendedUsers: profiles.filter(function (p) { return p.isSuspended; }).length,
        highRiskUsers: profiles.filter(function (p) { return p.riskScore >= config.highRiskThreshold; }).length,
        violationsByType: violationsByType,
    };
}
