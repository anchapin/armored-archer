/**
 * Anti-Cheat and RPC Input Validation module.
 * @fileoverview Implements replay protection, HMAC-SHA256 signing, rate limiting,
 * and malicious request detection for combat actions and sensitive RPCs.
 */

import { createHmac, randomBytes } from 'crypto';
import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';

/**
 * Configuration for anti-cheat detection.
 */
export interface AntiCheatConfig {
  hmacSecret: string;
  replayWindowMs: number;
  maxClockSkewMs: number;
  enableSignatureVerification: boolean;
  enableReplayProtection: boolean;
}

/**
 * Request signature metadata for HMAC verification.
 */
export interface RequestSignature {
  requestId: string;
  timestamp: number;
  signature: string;
  nonce: string;
}

/**
 * Anti-cheat violation data for auditing.
 */
export interface AntiCheatViolation {
  violationType:
    | 'replay_attack'
    | 'invalid_signature'
    | 'clock_skew'
    | 'out_of_turn'
    | 'timing_attack';
  userId: string;
  rpcName: string;
  matchId?: string;
  timestamp: number;
  requestId: string;
  details: Record<string, unknown>;
}

// In-memory store for processed request IDs (replay protection)
const processedRequests = new Map<string, number>();
const replayWindow = 300000; // 5 minutes

// In-memory store for request timing analysis
const requestTimingLog = new Map<string, number[]>();
const timingAnalysisWindow = 3600000; // 1 hour

if (!process.env.HMAC_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[SECURITY] HMAC_SECRET environment variable is required in production. ' +
        'Refusing to start with insecure default secret.'
    );
  }
  logger.warn(
    '[SECURITY] HMAC_SECRET not set - using insecure fallback. ' +
      'This MUST be set via environment variable before deploying to production.'
  );
}

let config: AntiCheatConfig = {
  hmacSecret: process.env.HMAC_SECRET || 'default-secret-change-in-production',
  replayWindowMs: replayWindow,
  maxClockSkewMs: 5000,
  enableSignatureVerification: process.env.ENABLE_HMAC_VERIFICATION === 'true',
  enableReplayProtection: true,
};

let recordAntiCheatViolation: (violation: AntiCheatViolation) => void = () => {};

/**
 * Initialize anti-cheat module with callbacks.
 */
export function initializeAntiCheat(
  config_: Partial<AntiCheatConfig>,
  violationCallback: (violation: AntiCheatViolation) => void
): void {
  config = { ...config, ...config_ };
  recordAntiCheatViolation = violationCallback;
  logger.info('Anti-cheat system initialized with config: %O', {
    replayWindowMs: config.replayWindowMs,
    maxClockSkewMs: config.maxClockSkewMs,
    enableSignatureVerification: config.enableSignatureVerification,
    enableReplayProtection: config.enableReplayProtection,
  });
}

/**
 * Generates a cryptographically secure request ID and nonce pair.
 */
export function generateRequestIdAndNonce(): { requestId: string; nonce: string } {
  const requestId = randomBytes(16).toString('hex');
  const nonce = randomBytes(16).toString('hex');
  return { requestId, nonce };
}

/**
 * Computes HMAC-SHA256 signature for a payload.
 * @param payload - JSON payload to sign
 * @param timestamp - Unix timestamp in milliseconds
 * @param nonce - Cryptographic nonce
 * @returns Base64-encoded HMAC signature
 */
export function computeSignature(payload: string, timestamp: number, nonce: string): string {
  const message = `${payload}:${timestamp}:${nonce}`;
  const hmac = createHmac('sha256', config.hmacSecret);
  hmac.update(message);
  return hmac.digest('hex');
}

/**
 * Verifies HMAC-SHA256 signature and checks request freshness.
 * @returns Object with verification result and any violations detected
 */
export function verifyRequestSignature(
  ctx: Runtime.Context,
  payload: string,
  signature: RequestSignature,
  rpcName: string
): {
  valid: boolean;
  violations: AntiCheatViolation[];
} {
  const violations: AntiCheatViolation[] = [];
  const now = Date.now();

  // Check clock skew
  const clockSkew = Math.abs(now - signature.timestamp);
  if (clockSkew > config.maxClockSkewMs) {
    violations.push({
      violationType: 'clock_skew',
      userId: ctx.userId,
      rpcName,
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
    const expectedSignature = computeSignature(payload, signature.timestamp, signature.nonce);
    if (expectedSignature !== signature.signature) {
      violations.push({
        violationType: 'invalid_signature',
        userId: ctx.userId,
        rpcName,
        timestamp: now,
        requestId: signature.requestId,
        details: {
          expectedSignature,
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
        rpcName,
        timestamp: now,
        requestId: signature.requestId,
        details: {
          previousProcessTime: processedRequests.get(signature.requestId),
        },
      });
    } else {
      // Record this request ID as processed
      processedRequests.set(signature.requestId, now);
    }
  }

  // Record violations
  violations.forEach((violation) => {
    recordAntiCheatViolation(violation);
    logger.warn('Anti-cheat violation detected: %s', violation.violationType, {
      userId: ctx.userId,
      rpcName,
      requestId: signature.requestId,
    });
  });

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Validates combat action parameters (angle, power, turn order).
 */
export function validateCombatActionParameters(
  angle: number,
  power: number | undefined,
  currentTurnUserId: string,
  playerId: string,
  rpcName: string,
  requestId: string
): { valid: boolean; violations: AntiCheatViolation[] } {
  const violations: AntiCheatViolation[] = [];
  const now = Date.now();

  // Validate angle (0-360 degrees = 0-2π radians)
  if (angle < 0 || angle > 2 * Math.PI + 0.01) {
    violations.push({
      violationType: 'timing_attack',
      userId: playerId,
      rpcName,
      timestamp: now,
      requestId,
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
      rpcName,
      timestamp: now,
      requestId,
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
      rpcName,
      timestamp: now,
      requestId,
      details: {
        expectedUserId: currentTurnUserId,
        actualUserId: playerId,
      },
    });
  }

  violations.forEach((violation) => {
    recordAntiCheatViolation(violation);
    logger.warn('Combat action validation failed: %s', violation.violationType, {
      userId: playerId,
      requestId,
    });
  });

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Analyzes request timing patterns for timing attacks.
 * Returns true if suspicious timing pattern is detected.
 */
export function detectTimingAttack(userId: string, rpcName: string, requestId: string): boolean {
  const now = Date.now();
  const key = `${userId}:${rpcName}`;

  if (!requestTimingLog.has(key)) {
    requestTimingLog.set(key, [now]);
    return false;
  }

  const timings = requestTimingLog.get(key) || [];

  // Keep only recent requests within the analysis window
  const recentTimings = timings.filter((t) => now - t < timingAnalysisWindow);
  requestTimingLog.set(key, recentTimings);

  if (recentTimings.length < 3) {
    recentTimings.push(now);
    return false;
  }

  // Calculate inter-request intervals
  const intervals: number[] = [];
  for (let i = 1; i < recentTimings.length; i++) {
    intervals.push(recentTimings[i] - recentTimings[i - 1]);
  }

  // Detect suspiciously fast or perfectly timed requests
  // Flag if average interval is < 100ms (humans can't do this consistently)
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const isTimingAttack = avgInterval < 100;

  if (isTimingAttack) {
    recordAntiCheatViolation({
      violationType: 'timing_attack',
      userId,
      rpcName,
      timestamp: now,
      requestId,
      details: {
        averageIntervalMs: avgInterval,
        requestCount: recentTimings.length,
        suspiciousPattern: 'consistently_fast_requests',
      },
    });

    logger.warn('Timing attack pattern detected for user %s on %s', userId, rpcName, {
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
export function cleanupExpiredRequests(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  // Cleanup processed requests
  processedRequests.forEach((timestamp, requestId) => {
    if (now - timestamp > config.replayWindowMs) {
      keysToDelete.push(requestId);
    }
  });

  keysToDelete.forEach((key) => processedRequests.delete(key));

  // Cleanup timing logs older than analysis window
  const timingKeysToDelete: string[] = [];
  requestTimingLog.forEach((timings, key) => {
    const recentTimings = timings.filter((t) => now - t < timingAnalysisWindow);
    if (recentTimings.length === 0) {
      timingKeysToDelete.push(key);
    } else {
      requestTimingLog.set(key, recentTimings);
    }
  });

  timingKeysToDelete.forEach((key) => requestTimingLog.delete(key));

  logger.debug(
    'Anti-cheat cleanup: removed %d processed requests, %d timing logs',
    keysToDelete.length,
    timingKeysToDelete.length
  );
}

/**
 * Get current anti-cheat statistics for monitoring.
 */
export function getAntiCheatStats(): {
  processedRequestsCount: number;
  timingLogsCount: number;
  config: AntiCheatConfig;
} {
  return {
    processedRequestsCount: processedRequests.size,
    timingLogsCount: requestTimingLog.size,
    config,
  };
}

// ============================================================
// LEADERBOARD & PvP ANTI-CHEAT
// ============================================================

/**
 * Configuration for leaderboard anti-cheat detection.
 */
export interface LeaderboardAntiCheatConfig {
  suspiciousWinRateThreshold: number; // 0.95 = 95%
  minMatchesForWinRateCheck: number; // 100
  maxSameOpponentMatches: number; // 50
  abandonmentPenalty: number; // -50 rank
  escalationMultiplier: number; // 2x for repeat offenses
  gracePeriodMs: number; // Time before penalty kicks in
}

let leaderboardConfig: LeaderboardAntiCheatConfig = {
  suspiciousWinRateThreshold: 0.95,
  minMatchesForWinRateCheck: 100,
  maxSameOpponentMatches: 50,
  abandonmentPenalty: 50,
  escalationMultiplier: 2.0,
  gracePeriodMs: 30000, // 30 seconds to take an action
};

/**
 * Player match history for anti-cheat analysis.
 */
interface PlayerMatchHistory {
  userId: string;
  matches: MatchResult[];
  abandonmentCount: number;
  lastAbandonmentTime: number;
  flagged: boolean;
  flagReason?: string;
}

/**
 * Individual match result.
 */
interface MatchResult {
  matchId: string;
  opponentId: string;
  result: 'win' | 'loss' | 'draw' | 'abandon';
  timestamp: number;
  wasRanked: boolean;
  rankBefore: number;
  rankAfter: number;
}

// In-memory storage for match history (in production, use database)
const playerMatchHistories = new Map<string, PlayerMatchHistory>();

/**
 * Initialize leaderboard anti-cheat configuration.
 */
export function initializeLeaderboardAntiCheat(config: Partial<LeaderboardAntiCheatConfig>): void {
  leaderboardConfig = { ...leaderboardConfig, ...config };
  logger.info('Leaderboard anti-cheat initialized with config: %O', leaderboardConfig);
}

/**
 * Record a completed match result for anti-cheat analysis.
 */
export function recordMatchResult(
  userId: string,
  matchId: string,
  opponentId: string,
  result: 'win' | 'loss' | 'draw',
  wasRanked: boolean,
  rankBefore: number,
  rankAfter: number
): { flagged: boolean; reason?: string } {
  const history = getOrCreatePlayerHistory(userId);

  history.matches.push({
    matchId,
    opponentId,
    result,
    timestamp: Date.now(),
    wasRanked,
    rankBefore,
    rankAfter,
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
export function recordAbandonment(
  userId: string,
  matchId: string,
  opponentId: string,
  wasRanked: boolean,
  rankBefore: number
): { penalty: number; escalationFactor: number } {
  const history = getOrCreatePlayerHistory(userId);
  const now = Date.now();

  // Check if within grace period (not counted as abandonment)
  if (history.matches.length > 0) {
    const lastMatch = history.matches[history.matches.length - 1];
    if (now - lastMatch.timestamp < leaderboardConfig.gracePeriodMs) {
      return { penalty: 0, escalationFactor: 1 };
    }
  }

  history.matches.push({
    matchId,
    opponentId,
    result: 'abandon',
    timestamp: now,
    wasRanked,
    rankBefore,
    rankAfter: rankBefore - leaderboardConfig.abandonmentPenalty,
  });

  // Track abandonment count for escalation
  if (now - history.lastAbandonmentTime < 3600000) {
    // Within 1 hour
    history.abandonmentCount += 1;
  } else {
    history.abandonmentCount = 1;
  }
  history.lastAbandonmentTime = now;

  // Calculate escalation penalty
  const escalationFactor = Math.min(
    Math.pow(leaderboardConfig.escalationMultiplier, history.abandonmentCount - 1),
    10 // Cap at 10x
  );
  const penalty = Math.floor(leaderboardConfig.abandonmentPenalty * escalationFactor);

  // Flag if too many abandonments
  if (history.abandonmentCount >= 5) {
    history.flagged = true;
    history.flagReason = `Excessive abandonments: ${history.abandonmentCount} in last hour`;
  }

  logger.warn(
    'Player abandonment recorded: %s (count: %d, penalty: %d)',
    userId,
    history.abandonmentCount,
    penalty
  );

  return { penalty, escalationFactor };
}

/**
 * Get player match history.
 */
export function getPlayerMatchHistory(userId: string): PlayerMatchHistory | null {
  return playerMatchHistories.get(userId) || null;
}

/**
 * Check if player is flagged for suspicious activity.
 */
export function isPlayerFlagged(userId: string): boolean {
  const history = playerMatchHistories.get(userId);
  return history?.flagged || false;
}

/**
 * Get flag reason for a player.
 */
export function getFlagReason(userId: string): string | undefined {
  const history = playerMatchHistories.get(userId);
  return history?.flagReason;
}

/**
 * Clear player flag (admin action).
 */
export function clearPlayerFlag(userId: string): void {
  const history = playerMatchHistories.get(userId);
  if (history) {
    history.flagged = false;
    history.flagReason = undefined;
    history.abandonmentCount = 0;
    logger.info('Player flag cleared: %s', userId);
  }
}

function getOrCreatePlayerHistory(userId: string): PlayerMatchHistory {
  if (!playerMatchHistories.has(userId)) {
    playerMatchHistories.set(userId, {
      userId,
      matches: [],
      abandonmentCount: 0,
      lastAbandonmentTime: 0,
      flagged: false,
    });
  }
  return playerMatchHistories.get(userId)!;
}

function analyzePlayerForCheating(history: PlayerMatchHistory): {
  flagged: boolean;
  reason?: string;
} {
  const rankedMatches = history.matches.filter((m) => m.wasRanked);

  if (rankedMatches.length < leaderboardConfig.minMatchesForWinRateCheck) {
    return { flagged: false };
  }

  // Check recent matches for win rate analysis
  const recentMatches = rankedMatches.slice(-leaderboardConfig.minMatchesForWinRateCheck);
  const wins = recentMatches.filter((m) => m.result === 'win').length;
  const winRate = wins / recentMatches.length;

  // Flag suspicious win rate
  if (winRate >= leaderboardConfig.suspiciousWinRateThreshold) {
    history.flagged = true;
    history.flagReason = `Suspicious win rate: ${(winRate * 100).toFixed(1)}% over ${recentMatches.length} matches`;
    logger.warn(
      'Player flagged for suspicious win rate: %s (%.1f%%)',
      history.userId,
      winRate * 100
    );
    return { flagged: true, reason: history.flagReason };
  }

  // Check for same opponent played too many times
  const opponentCounts = new Map<string, number>();
  for (const match of recentMatches) {
    if (match.opponentId) {
      opponentCounts.set(match.opponentId, (opponentCounts.get(match.opponentId) || 0) + 1);
    }
  }

  for (const [opponentId, count] of opponentCounts) {
    if (count >= leaderboardConfig.maxSameOpponentMatches) {
      history.flagged = true;
      history.flagReason = `Played same opponent ${count} times (max: ${leaderboardConfig.maxSameOpponentMatches})`;
      logger.warn(
        'Player flagged for same opponent: %s vs %s (%d times)',
        history.userId,
        opponentId,
        count
      );
      return { flagged: true, reason: history.flagReason };
    }
  }

  return { flagged: false };
}

/**
 * Get leaderboard anti-cheat statistics.
 */
export function getLeaderboardAntiCheatStats(): {
  trackedPlayers: number;
  flaggedPlayers: number;
  config: LeaderboardAntiCheatConfig;
} {
  let flaggedCount = 0;
  playerMatchHistories.forEach((h) => {
    if (h.flagged) flaggedCount++;
  });

  return {
    trackedPlayers: playerMatchHistories.size,
    flaggedPlayers: flaggedCount,
    config: leaderboardConfig,
  };
}

// Cleanup job to prevent memory leaks (only in production, not during tests)
const _antiCheatCleanupInterval = process.env.NODE_ENV !== 'test'
  ? setInterval(cleanupExpiredRequests, 60000) // Every minute
  : null as unknown as NodeJS.Timeout;

/** Clear the anti-cheat cleanup interval (for test teardown). */
export function stopAntiCheatCleanup(): void {
  if (_antiCheatCleanupInterval) {
    clearInterval(_antiCheatCleanupInterval);
  }
}

// ============================================================
// PLAYER REPORTING SYSTEM
// ============================================================

export interface PlayerReport {
  reportId: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  matchId?: string;
  additionalInfo?: string;
  timestamp: number;
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
}

type ReportReason =
  | 'win_trading'
  | 'match_manipulation'
  | 'suspicious_win_rate'
  | 'harassment'
  | 'exploiting_bugs'
  | 'other';

// In-memory storage for player reports (in production, use database)
const playerReports = new Map<string, PlayerReport>();
const reporterCooldowns = new Map<string, number>();
const REPORT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Submit a player report.
 */
export function submitPlayerReport(
  reporterId: string,
  reportedUserId: string,
  reason: ReportReason,
  matchId?: string,
  additionalInfo?: string
): { success: boolean; reportId?: string; error?: string } {
  // Prevent self-reporting
  if (reporterId === reportedUserId) {
    return { success: false, error: 'Cannot report yourself' };
  }

  // Check rate limiting
  const lastReportTime = reporterCooldowns.get(reporterId);
  if (lastReportTime && Date.now() - lastReportTime < REPORT_COOLDOWN_MS) {
    return { success: false, error: 'Rate limit: please wait before submitting another report' };
  }

  const reportId = `report_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const report: PlayerReport = {
    reportId,
    reporterId,
    reportedUserId,
    reason,
    matchId,
    additionalInfo,
    timestamp: Date.now(),
    status: 'pending',
  };

  playerReports.set(reportId, report);
  reporterCooldowns.set(reporterId, Date.now());

  logger.info('Player report submitted: %s by %s against %s', reportId, reporterId, reportedUserId);

  return { success: true, reportId };
}

/**
 * Get reports for a user (either filed by them or against them).
 */
export function getReportsForUser(userId: string): PlayerReport[] {
  const reports: PlayerReport[] = [];

  playerReports.forEach((report) => {
    if (report.reporterId === userId || report.reportedUserId === userId) {
      reports.push(report);
    }
  });

  // Sort by timestamp descending
  return reports.sort((a, b) => b.timestamp - a.timestamp);
}
