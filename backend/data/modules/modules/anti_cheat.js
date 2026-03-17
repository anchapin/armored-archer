"use strict";
/**
 * Anti-Cheat and RPC Input Validation module.
 * @fileoverview Implements replay protection, HMAC-SHA256 signing, rate limiting,
 * and malicious request detection for combat actions and sensitive RPCs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeAntiCheat = initializeAntiCheat;
exports.generateRequestIdAndNonce = generateRequestIdAndNonce;
exports.computeSignature = computeSignature;
exports.verifyRequestSignature = verifyRequestSignature;
exports.validateCombatActionParameters = validateCombatActionParameters;
exports.detectTimingAttack = detectTimingAttack;
exports.cleanupExpiredRequests = cleanupExpiredRequests;
exports.getAntiCheatStats = getAntiCheatStats;
exports.initializeLeaderboardAntiCheat = initializeLeaderboardAntiCheat;
exports.recordMatchResult = recordMatchResult;
exports.recordAbandonment = recordAbandonment;
exports.getPlayerMatchHistory = getPlayerMatchHistory;
exports.isPlayerFlagged = isPlayerFlagged;
exports.getFlagReason = getFlagReason;
exports.clearPlayerFlag = clearPlayerFlag;
exports.getLeaderboardAntiCheatStats = getLeaderboardAntiCheatStats;
exports.submitPlayerReport = submitPlayerReport;
exports.getReportsForUser = getReportsForUser;
var tslib_1 = require("tslib");
var crypto_1 = require("crypto");
var logger_1 = require("../config/logger");
// In-memory store for processed request IDs (replay protection)
var processedRequests = new Map();
var replayWindow = 300000; // 5 minutes
// In-memory store for request timing analysis
var requestTimingLog = new Map();
var timingAnalysisWindow = 3600000; // 1 hour
var config = {
    hmacSecret: process.env.HMAC_SECRET || 'default-secret-change-in-production',
    replayWindowMs: replayWindow,
    maxClockSkewMs: 5000,
    enableSignatureVerification: process.env.ENABLE_HMAC_VERIFICATION === 'true',
    enableReplayProtection: true,
};
var recordAntiCheatViolation = function () { };
/**
 * Initialize anti-cheat module with callbacks.
 */
function initializeAntiCheat(config_, violationCallback) {
    config = tslib_1.__assign(tslib_1.__assign({}, config), config_);
    recordAntiCheatViolation = violationCallback;
    logger_1.logger.info('Anti-cheat system initialized with config: %O', {
        replayWindowMs: config.replayWindowMs,
        maxClockSkewMs: config.maxClockSkewMs,
        enableSignatureVerification: config.enableSignatureVerification,
        enableReplayProtection: config.enableReplayProtection,
    });
}
/**
 * Generates a cryptographically secure request ID and nonce pair.
 */
function generateRequestIdAndNonce() {
    var requestId = (0, crypto_1.randomBytes)(16).toString('hex');
    var nonce = (0, crypto_1.randomBytes)(16).toString('hex');
    return { requestId: requestId, nonce: nonce };
}
/**
 * Computes HMAC-SHA256 signature for a payload.
 * @param payload - JSON payload to sign
 * @param timestamp - Unix timestamp in milliseconds
 * @param nonce - Cryptographic nonce
 * @returns Base64-encoded HMAC signature
 */
function computeSignature(payload, timestamp, nonce) {
    var message = "".concat(payload, ":").concat(timestamp, ":").concat(nonce);
    var hmac = (0, crypto_1.createHmac)('sha256', config.hmacSecret);
    hmac.update(message);
    return hmac.digest('hex');
}
/**
 * Verifies HMAC-SHA256 signature and checks request freshness.
 * @returns Object with verification result and any violations detected
 */
function verifyRequestSignature(ctx, payload, signature, rpcName) {
    var violations = [];
    var now = Date.now();
    // Check clock skew
    var clockSkew = Math.abs(now - signature.timestamp);
    if (clockSkew > config.maxClockSkewMs) {
        violations.push({
            violationType: 'clock_skew',
            userId: ctx.userId,
            rpcName: rpcName,
            timestamp: now,
            requestId: signature.requestId,
            details: {
                clientTimestamp: signature.timestamp,
                serverTimestamp: now,
                skewMs: clockSkew,
                maxAllowed: config.maxClockSkewMs,
            },
        });
    }
    // Check signature validity
    if (config.enableSignatureVerification) {
        var expectedSignature = computeSignature(payload, signature.timestamp, signature.nonce);
        if (expectedSignature !== signature.signature) {
            violations.push({
                violationType: 'invalid_signature',
                userId: ctx.userId,
                rpcName: rpcName,
                timestamp: now,
                requestId: signature.requestId,
                details: {
                    expectedSignature: expectedSignature,
                    providedSignature: signature.signature,
                },
            });
        }
    }
    // Check for replay attacks
    if (config.enableReplayProtection) {
        if (processedRequests.has(signature.requestId)) {
            violations.push({
                violationType: 'replay_attack',
                userId: ctx.userId,
                rpcName: rpcName,
                timestamp: now,
                requestId: signature.requestId,
                details: {
                    previousProcessTime: processedRequests.get(signature.requestId),
                },
            });
        }
        else {
            // Record this request ID as processed
            processedRequests.set(signature.requestId, now);
        }
    }
    // Record violations
    violations.forEach(function (violation) {
        recordAntiCheatViolation(violation);
        logger_1.logger.warn('Anti-cheat violation detected: %s', violation.violationType, {
            userId: ctx.userId,
            rpcName: rpcName,
            requestId: signature.requestId,
        });
    });
    return {
        valid: violations.length === 0,
        violations: violations,
    };
}
/**
 * Validates combat action parameters (angle, power, turn order).
 */
function validateCombatActionParameters(angle, power, currentTurnUserId, playerId, rpcName, requestId) {
    var violations = [];
    var now = Date.now();
    // Validate angle (0-360 degrees = 0-2π radians)
    if (angle < 0 || angle > 2 * Math.PI + 0.01) {
        violations.push({
            violationType: 'timing_attack',
            userId: playerId,
            rpcName: rpcName,
            timestamp: now,
            requestId: requestId,
            details: {
                parameterName: 'angle',
                value: angle,
                min: 0,
                max: 2 * Math.PI,
            },
        });
    }
    // Validate power (0.0-1.0)
    if (power !== undefined && (power < 0 || power > 1.0 + 0.01)) {
        violations.push({
            violationType: 'timing_attack',
            userId: playerId,
            rpcName: rpcName,
            timestamp: now,
            requestId: requestId,
            details: {
                parameterName: 'power',
                value: power,
                min: 0.0,
                max: 1.0,
            },
        });
    }
    // Check out-of-turn actions
    if (currentTurnUserId !== playerId) {
        violations.push({
            violationType: 'out_of_turn',
            userId: playerId,
            rpcName: rpcName,
            timestamp: now,
            requestId: requestId,
            details: {
                expectedUserId: currentTurnUserId,
                actualUserId: playerId,
            },
        });
    }
    violations.forEach(function (violation) {
        recordAntiCheatViolation(violation);
        logger_1.logger.warn('Combat action validation failed: %s', violation.violationType, {
            userId: playerId,
            requestId: requestId,
        });
    });
    return {
        valid: violations.length === 0,
        violations: violations,
    };
}
/**
 * Analyzes request timing patterns for timing attacks.
 * Returns true if suspicious timing pattern is detected.
 */
function detectTimingAttack(userId, rpcName, requestId) {
    var now = Date.now();
    var key = "".concat(userId, ":").concat(rpcName);
    if (!requestTimingLog.has(key)) {
        requestTimingLog.set(key, [now]);
        return false;
    }
    var timings = requestTimingLog.get(key) || [];
    // Keep only recent requests within the analysis window
    var recentTimings = timings.filter(function (t) { return now - t < timingAnalysisWindow; });
    requestTimingLog.set(key, recentTimings);
    if (recentTimings.length < 3) {
        recentTimings.push(now);
        return false;
    }
    // Calculate inter-request intervals
    var intervals = [];
    for (var i = 1; i < recentTimings.length; i++) {
        intervals.push(recentTimings[i] - recentTimings[i - 1]);
    }
    // Detect suspiciously fast or perfectly timed requests
    // Flag if average interval is < 100ms (humans can't do this consistently)
    var avgInterval = intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length;
    var isTimingAttack = avgInterval < 100;
    if (isTimingAttack) {
        recordAntiCheatViolation({
            violationType: 'timing_attack',
            userId: userId,
            rpcName: rpcName,
            timestamp: now,
            requestId: requestId,
            details: {
                averageIntervalMs: avgInterval,
                requestCount: recentTimings.length,
                suspiciousPattern: 'consistently_fast_requests',
            },
        });
        logger_1.logger.warn('Timing attack pattern detected for user %s on %s', userId, rpcName, {
            averageIntervalMs: avgInterval,
            requestCount: recentTimings.length,
        });
    }
    recentTimings.push(now);
    return isTimingAttack;
}
/**
 * Cleanup expired request records to prevent memory leaks.
 */
function cleanupExpiredRequests() {
    var now = Date.now();
    var keysToDelete = [];
    // Cleanup processed requests
    processedRequests.forEach(function (timestamp, requestId) {
        if (now - timestamp > config.replayWindowMs) {
            keysToDelete.push(requestId);
        }
    });
    keysToDelete.forEach(function (key) { return processedRequests.delete(key); });
    // Cleanup timing logs older than analysis window
    var timingKeysToDelete = [];
    requestTimingLog.forEach(function (timings, key) {
        var recentTimings = timings.filter(function (t) { return now - t < timingAnalysisWindow; });
        if (recentTimings.length === 0) {
            timingKeysToDelete.push(key);
        }
        else {
            requestTimingLog.set(key, recentTimings);
        }
    });
    timingKeysToDelete.forEach(function (key) { return requestTimingLog.delete(key); });
    logger_1.logger.debug('Anti-cheat cleanup: removed %d processed requests, %d timing logs', keysToDelete.length, timingKeysToDelete.length);
}
/**
 * Get current anti-cheat statistics for monitoring.
 */
function getAntiCheatStats() {
    return {
        processedRequestsCount: processedRequests.size,
        timingLogsCount: requestTimingLog.size,
        config: config,
    };
}
var leaderboardConfig = {
    suspiciousWinRateThreshold: 0.95,
    minMatchesForWinRateCheck: 100,
    maxSameOpponentMatches: 50,
    abandonmentPenalty: 50,
    escalationMultiplier: 2.0,
    gracePeriodMs: 30000, // 30 seconds to take an action
};
// In-memory storage for match history (in production, use database)
var playerMatchHistories = new Map();
/**
 * Initialize leaderboard anti-cheat configuration.
 */
function initializeLeaderboardAntiCheat(config) {
    leaderboardConfig = tslib_1.__assign(tslib_1.__assign({}, leaderboardConfig), config);
    logger_1.logger.info('Leaderboard anti-cheat initialized with config: %O', leaderboardConfig);
}
/**
 * Record a completed match result for anti-cheat analysis.
 */
function recordMatchResult(userId, matchId, opponentId, result, wasRanked, rankBefore, rankAfter) {
    var history = getOrCreatePlayerHistory(userId);
    history.matches.push({
        matchId: matchId,
        opponentId: opponentId,
        result: result,
        timestamp: Date.now(),
        wasRanked: wasRanked,
        rankBefore: rankBefore,
        rankAfter: rankAfter,
    });
    // Keep only recent matches (last 200)
    if (history.matches.length > 200) {
        history.matches = history.matches.slice(-200);
    }
    return analyzePlayerForCheating(history);
}
/**
 * Record an abandonment (disconnect).
 */
function recordAbandonment(userId, matchId, opponentId, wasRanked, rankBefore) {
    var history = getOrCreatePlayerHistory(userId);
    var now = Date.now();
    // Check if within grace period (not counted as abandonment)
    if (history.matches.length > 0) {
        var lastMatch = history.matches[history.matches.length - 1];
        if (now - lastMatch.timestamp < leaderboardConfig.gracePeriodMs) {
            return { penalty: 0, escalationFactor: 1 };
        }
    }
    history.matches.push({
        matchId: matchId,
        opponentId: opponentId,
        result: 'abandon',
        timestamp: now,
        wasRanked: wasRanked,
        rankBefore: rankBefore,
        rankAfter: rankBefore - leaderboardConfig.abandonmentPenalty,
    });
    // Track abandonment count for escalation
    if (now - history.lastAbandonmentTime < 3600000) {
        // Within 1 hour
        history.abandonmentCount += 1;
    }
    else {
        history.abandonmentCount = 1;
    }
    history.lastAbandonmentTime = now;
    // Calculate escalation penalty
    var escalationFactor = Math.min(Math.pow(leaderboardConfig.escalationMultiplier, history.abandonmentCount - 1), 10 // Cap at 10x
    );
    var penalty = Math.floor(leaderboardConfig.abandonmentPenalty * escalationFactor);
    // Flag if too many abandonments
    if (history.abandonmentCount >= 5) {
        history.flagged = true;
        history.flagReason = "Excessive abandonments: ".concat(history.abandonmentCount, " in last hour");
    }
    logger_1.logger.warn('Player abandonment recorded: %s (count: %d, penalty: %d)', userId, history.abandonmentCount, penalty);
    return { penalty: penalty, escalationFactor: escalationFactor };
}
/**
 * Get player match history.
 */
function getPlayerMatchHistory(userId) {
    return playerMatchHistories.get(userId) || null;
}
/**
 * Check if player is flagged for suspicious activity.
 */
function isPlayerFlagged(userId) {
    var history = playerMatchHistories.get(userId);
    return (history === null || history === void 0 ? void 0 : history.flagged) || false;
}
/**
 * Get flag reason for a player.
 */
function getFlagReason(userId) {
    var history = playerMatchHistories.get(userId);
    return history === null || history === void 0 ? void 0 : history.flagReason;
}
/**
 * Clear player flag (admin action).
 */
function clearPlayerFlag(userId) {
    var history = playerMatchHistories.get(userId);
    if (history) {
        history.flagged = false;
        history.flagReason = undefined;
        history.abandonmentCount = 0;
        logger_1.logger.info('Player flag cleared: %s', userId);
    }
}
function getOrCreatePlayerHistory(userId) {
    if (!playerMatchHistories.has(userId)) {
        playerMatchHistories.set(userId, {
            userId: userId,
            matches: [],
            abandonmentCount: 0,
            lastAbandonmentTime: 0,
            flagged: false,
        });
    }
    return playerMatchHistories.get(userId);
}
function analyzePlayerForCheating(history) {
    var e_1, _a, e_2, _b;
    var rankedMatches = history.matches.filter(function (m) { return m.wasRanked; });
    if (rankedMatches.length < leaderboardConfig.minMatchesForWinRateCheck) {
        return { flagged: false };
    }
    // Check recent matches for win rate analysis
    var recentMatches = rankedMatches.slice(-leaderboardConfig.minMatchesForWinRateCheck);
    var wins = recentMatches.filter(function (m) { return m.result === 'win'; }).length;
    var winRate = wins / recentMatches.length;
    // Flag suspicious win rate
    if (winRate >= leaderboardConfig.suspiciousWinRateThreshold) {
        history.flagged = true;
        history.flagReason = "Suspicious win rate: ".concat((winRate * 100).toFixed(1), "% over ").concat(recentMatches.length, " matches");
        logger_1.logger.warn('Player flagged for suspicious win rate: %s (%.1f%%)', history.userId, winRate * 100);
        return { flagged: true, reason: history.flagReason };
    }
    // Check for same opponent played too many times
    var opponentCounts = new Map();
    try {
        for (var recentMatches_1 = tslib_1.__values(recentMatches), recentMatches_1_1 = recentMatches_1.next(); !recentMatches_1_1.done; recentMatches_1_1 = recentMatches_1.next()) {
            var match = recentMatches_1_1.value;
            if (match.opponentId) {
                opponentCounts.set(match.opponentId, (opponentCounts.get(match.opponentId) || 0) + 1);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (recentMatches_1_1 && !recentMatches_1_1.done && (_a = recentMatches_1.return)) _a.call(recentMatches_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    try {
        for (var opponentCounts_1 = tslib_1.__values(opponentCounts), opponentCounts_1_1 = opponentCounts_1.next(); !opponentCounts_1_1.done; opponentCounts_1_1 = opponentCounts_1.next()) {
            var _c = tslib_1.__read(opponentCounts_1_1.value, 2), opponentId = _c[0], count = _c[1];
            if (count >= leaderboardConfig.maxSameOpponentMatches) {
                history.flagged = true;
                history.flagReason = "Played same opponent ".concat(count, " times (max: ").concat(leaderboardConfig.maxSameOpponentMatches, ")");
                logger_1.logger.warn('Player flagged for same opponent: %s vs %s (%d times)', history.userId, opponentId, count);
                return { flagged: true, reason: history.flagReason };
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (opponentCounts_1_1 && !opponentCounts_1_1.done && (_b = opponentCounts_1.return)) _b.call(opponentCounts_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return { flagged: false };
}
/**
 * Get leaderboard anti-cheat statistics.
 */
function getLeaderboardAntiCheatStats() {
    var flaggedCount = 0;
    playerMatchHistories.forEach(function (h) {
        if (h.flagged)
            flaggedCount++;
    });
    return {
        trackedPlayers: playerMatchHistories.size,
        flaggedPlayers: flaggedCount,
        config: leaderboardConfig,
    };
}
// Cleanup job to prevent memory leaks
setInterval(cleanupExpiredRequests, 60000); // Every minute
// In-memory storage for player reports (in production, use database)
var playerReports = new Map();
var reporterCooldowns = new Map();
var REPORT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
/**
 * Submit a player report.
 */
function submitPlayerReport(reporterId, reportedUserId, reason, matchId, additionalInfo) {
    // Prevent self-reporting
    if (reporterId === reportedUserId) {
        return { success: false, error: 'Cannot report yourself' };
    }
    // Check rate limiting
    var lastReportTime = reporterCooldowns.get(reporterId);
    if (lastReportTime && Date.now() - lastReportTime < REPORT_COOLDOWN_MS) {
        return { success: false, error: 'Rate limit: please wait before submitting another report' };
    }
    var reportId = "report_".concat(Date.now(), "_").concat(Math.random().toString(36).substring(2, 8));
    var report = {
        reportId: reportId,
        reporterId: reporterId,
        reportedUserId: reportedUserId,
        reason: reason,
        matchId: matchId,
        additionalInfo: additionalInfo,
        timestamp: Date.now(),
        status: 'pending',
    };
    playerReports.set(reportId, report);
    reporterCooldowns.set(reporterId, Date.now());
    logger_1.logger.info('Player report submitted: %s by %s against %s', reportId, reporterId, reportedUserId);
    return { success: true, reportId: reportId };
}
/**
 * Get reports for a user (either filed by them or against them).
 */
function getReportsForUser(userId) {
    var reports = [];
    playerReports.forEach(function (report) {
        if (report.reporterId === userId || report.reportedUserId === userId) {
            reports.push(report);
        }
    });
    // Sort by timestamp descending
    return reports.sort(function (a, b) { return b.timestamp - a.timestamp; });
}
