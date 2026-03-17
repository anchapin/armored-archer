/**
 * Anti-Cheat and RPC Input Validation module.
 * @fileoverview Implements replay protection, HMAC-SHA256 signing, rate limiting,
 * and malicious request detection for combat actions and sensitive RPCs.
 */
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
    violationType: 'replay_attack' | 'invalid_signature' | 'clock_skew' | 'out_of_turn' | 'timing_attack';
    userId: string;
    rpcName: string;
    matchId?: string;
    timestamp: number;
    requestId: string;
    details: Record<string, unknown>;
}
/**
 * Initialize anti-cheat module with callbacks.
 */
export declare function initializeAntiCheat(config_: Partial<AntiCheatConfig>, violationCallback: (violation: AntiCheatViolation) => void): void;
/**
 * Generates a cryptographically secure request ID and nonce pair.
 */
export declare function generateRequestIdAndNonce(): {
    requestId: string;
    nonce: string;
};
/**
 * Computes HMAC-SHA256 signature for a payload.
 * @param payload - JSON payload to sign
 * @param timestamp - Unix timestamp in milliseconds
 * @param nonce - Cryptographic nonce
 * @returns Base64-encoded HMAC signature
 */
export declare function computeSignature(payload: string, timestamp: number, nonce: string): string;
/**
 * Verifies HMAC-SHA256 signature and checks request freshness.
 * @returns Object with verification result and any violations detected
 */
export declare function verifyRequestSignature(ctx: Runtime.Context, payload: string, signature: RequestSignature, rpcName: string): {
    valid: boolean;
    violations: AntiCheatViolation[];
};
/**
 * Validates combat action parameters (angle, power, turn order).
 */
export declare function validateCombatActionParameters(angle: number, power: number | undefined, currentTurnUserId: string, playerId: string, rpcName: string, requestId: string): {
    valid: boolean;
    violations: AntiCheatViolation[];
};
/**
 * Analyzes request timing patterns for timing attacks.
 * Returns true if suspicious timing pattern is detected.
 */
export declare function detectTimingAttack(userId: string, rpcName: string, requestId: string): boolean;
/**
 * Cleanup expired request records to prevent memory leaks.
 */
export declare function cleanupExpiredRequests(): void;
/**
 * Get current anti-cheat statistics for monitoring.
 */
export declare function getAntiCheatStats(): {
    processedRequestsCount: number;
    timingLogsCount: number;
    config: AntiCheatConfig;
};
/**
 * Configuration for leaderboard anti-cheat detection.
 */
export interface LeaderboardAntiCheatConfig {
    suspiciousWinRateThreshold: number;
    minMatchesForWinRateCheck: number;
    maxSameOpponentMatches: number;
    abandonmentPenalty: number;
    escalationMultiplier: number;
    gracePeriodMs: number;
}
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
/**
 * Initialize leaderboard anti-cheat configuration.
 */
export declare function initializeLeaderboardAntiCheat(config: Partial<LeaderboardAntiCheatConfig>): void;
/**
 * Record a completed match result for anti-cheat analysis.
 */
export declare function recordMatchResult(userId: string, matchId: string, opponentId: string, result: 'win' | 'loss' | 'draw', wasRanked: boolean, rankBefore: number, rankAfter: number): {
    flagged: boolean;
    reason?: string;
};
/**
 * Record an abandonment (disconnect).
 */
export declare function recordAbandonment(userId: string, matchId: string, opponentId: string, wasRanked: boolean, rankBefore: number): {
    penalty: number;
    escalationFactor: number;
};
/**
 * Get player match history.
 */
export declare function getPlayerMatchHistory(userId: string): PlayerMatchHistory | null;
/**
 * Check if player is flagged for suspicious activity.
 */
export declare function isPlayerFlagged(userId: string): boolean;
/**
 * Get flag reason for a player.
 */
export declare function getFlagReason(userId: string): string | undefined;
/**
 * Clear player flag (admin action).
 */
export declare function clearPlayerFlag(userId: string): void;
/**
 * Get leaderboard anti-cheat statistics.
 */
export declare function getLeaderboardAntiCheatStats(): {
    trackedPlayers: number;
    flaggedPlayers: number;
    config: LeaderboardAntiCheatConfig;
};
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
type ReportReason = 'win_trading' | 'match_manipulation' | 'suspicious_win_rate' | 'harassment' | 'exploiting_bugs' | 'other';
/**
 * Submit a player report.
 */
export declare function submitPlayerReport(reporterId: string, reportedUserId: string, reason: ReportReason, matchId?: string, additionalInfo?: string): {
    success: boolean;
    reportId?: string;
    error?: string;
};
/**
 * Get reports for a user (either filed by them or against them).
 */
export declare function getReportsForUser(userId: string): PlayerReport[];
export {};
