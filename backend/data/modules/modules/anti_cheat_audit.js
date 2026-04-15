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
exports.resetAuditState = resetAuditState;
const defaultConfig = {
    enablePersistence: true,
    highRiskThreshold: 50,
    suspensionThreshold: 15,
    violationRetentionDays: 30,
    replayWindowMs: 300000,
};
let config = { ...defaultConfig };
let nk;
let logger;
// In-memory storage for user risk profiles
const userRiskProfiles = new Map();
// Violation type weights for risk scoring
const VIOLATION_WEIGHTS = {
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
    config = { ...config, ...cfg };
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
function recordViolation(userId, type, details = {}) {
    const timestamp = Date.now();
    const severity = getSeverity(type);
    const violation = {
        userId,
        type,
        timestamp,
        details,
        severity,
    };
    let profile = userRiskProfiles.get(userId);
    if (!profile) {
        profile = {
            userId,
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
            userId,
            riskScore: profile.riskScore,
            violationCount: profile.violationCount,
        });
    }
    // Log to storage if enabled
    if (config.enablePersistence && nk) {
        try {
            const storageKey = `anti_cheat:violation:${userId}:${timestamp}`;
            nk.storageWrite([
                {
                    collection: 'anti_cheat_violations',
                    key: storageKey,
                    userId,
                    value: JSON.stringify(violation),
                },
            ]);
        }
        catch (err) {
            logger.error('Failed to persist violation', { error: err, userId });
        }
    }
    logger.info('Anti-cheat violation recorded', {
        userId,
        type,
        severity,
        riskScore: profile.riskScore,
    });
}
/**
 * Get the severity level for a violation type.
 */
function getSeverity(type) {
    const weights = {
        replay_attack: 20,
        invalid_signature: 18,
        timing_attack: 12,
        out_of_turn: 8,
        clock_skew: 3,
        invalid_progression: 15,
        stat_manipulation: 25,
        inventory_tampering: 20,
    };
    const weight = weights[type] || 5;
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
function getTopViolators(limit = 10) {
    const profiles = Array.from(userRiskProfiles.values());
    return profiles.sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
}
/**
 * Generate an audit report for a user.
 */
function generateAuditReport(userId) {
    const profile = userRiskProfiles.get(userId);
    if (!profile) {
        return null;
    }
    const violationsByType = {
        replay_attack: 0,
        invalid_signature: 0,
        timing_attack: 0,
        out_of_turn: 0,
        clock_skew: 0,
        invalid_progression: 0,
        stat_manipulation: 0,
        inventory_tampering: 0,
    };
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const v of profile.violations) {
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
    let riskLevel = 'low';
    let recommendedAction = 'none';
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
        userId,
        profile,
        report: {
            totalViolations: profile.violationCount,
            criticalViolations: critical,
            highViolations: high,
            mediumViolations: medium,
            lowViolations: low,
            violationsByType,
            riskLevel,
            recommendedAction,
        },
    };
}
/**
 * Check if a user is currently suspended.
 */
function isUserSuspended(userId) {
    const profile = userRiskProfiles.get(userId);
    return profile?.isSuspended || false;
}
/**
 * Clear a user's flag (admin action).
 */
function clearUserFlag(userId) {
    const profile = userRiskProfiles.get(userId);
    if (!profile) {
        return false;
    }
    profile.isSuspended = false;
    profile.riskScore = 0;
    profile.violations = [];
    logger.info('User flag cleared', { userId });
    return true;
}
/**
 * Suspend a user (admin action).
 */
function suspendUser(userId, reason = 'admin_action') {
    const profile = userRiskProfiles.get(userId);
    if (!profile) {
        userRiskProfiles.set(userId, {
            userId,
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
    logger.warn('User suspended manually', { userId, reason });
    return true;
}
/**
 * Get audit statistics.
 */
function getAuditStats() {
    const profiles = Array.from(userRiskProfiles.values());
    const violationsByType = {
        replay_attack: 0,
        invalid_signature: 0,
        timing_attack: 0,
        out_of_turn: 0,
        clock_skew: 0,
        invalid_progression: 0,
        stat_manipulation: 0,
        inventory_tampering: 0,
    };
    let totalViolations = 0;
    for (const profile of profiles) {
        totalViolations += profile.violations.length;
        for (const v of profile.violations) {
            violationsByType[v.type]++;
        }
    }
    return {
        totalViolations,
        uniqueUsers: profiles.length,
        suspendedUsers: profiles.filter((p) => p.isSuspended).length,
        highRiskUsers: profiles.filter((p) => p.riskScore >= config.highRiskThreshold).length,
        violationsByType,
    };
}
/**
 * Reset module state (for testing)
 */
function resetAuditState() {
    userRiskProfiles.clear();
    config = { ...defaultConfig };
    nk = undefined;
    logger = undefined;
}
