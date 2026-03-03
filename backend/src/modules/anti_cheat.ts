/**
 * Anti-Cheat and RPC Input Validation module.
 * @fileoverview Implements replay protection, HMAC-SHA256 signing, rate limiting,
 * and malicious request detection for combat actions and sensitive RPCs.
 */

import { Runtime } from '../types/nakama';
import { createHash, createHmac, randomBytes } from 'crypto';
import { logger } from '../config/logger';

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
  violationType: 'replay_attack' | 'invalid_signature' | 'clock_skew' | 'out_of_turn' | 'timing_attack';
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

  logger.debug('Anti-cheat cleanup: removed %d processed requests, %d timing logs', keysToDelete.length, timingKeysToDelete.length);
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

// Cleanup job to prevent memory leaks
setInterval(cleanupExpiredRequests, 60000); // Every minute
