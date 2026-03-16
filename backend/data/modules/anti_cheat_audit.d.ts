/**
 * Anti-Cheat Audit & Forensics Module.
 * @fileoverview Implements violation tracking, user risk profiling,
 * automatic account flagging/suspension, and compliance reporting.
 */
import { Runtime } from '../types/nakama';
export interface AntiCheatViolation {
    userId: string;
    type: ViolationType;
    timestamp: number;
    details: Record<string, unknown>;
    severity: 'low' | 'medium' | 'high' | 'critical';
}
export type ViolationType = 'replay_attack' | 'invalid_signature' | 'timing_attack' | 'out_of_turn' | 'clock_skew' | 'invalid_progression' | 'stat_manipulation' | 'inventory_tampering';
export interface UserRiskProfile {
    userId: string;
    violations: AntiCheatViolation[];
    riskScore: number;
    isSuspended: boolean;
    firstViolation: number;
    lastViolation: number;
    violationCount: number;
}
export interface AuditConfig {
    enablePersistence: boolean;
    highRiskThreshold: number;
    suspensionThreshold: number;
    violationRetentionDays: number;
    replayWindowMs: number;
}
export interface AuditStats {
    totalViolations: number;
    uniqueUsers: number;
    suspendedUsers: number;
    highRiskUsers: number;
    violationsByType: Record<ViolationType, number>;
}
/**
 * Initialize the audit logging system.
 */
export declare function initializeAuditLogging(cfg: Partial<AuditConfig>, nakama: Runtime.Nakama, runtimeLogger: Runtime.Logger): void;
/**
 * Record a violation for a user.
 */
export declare function recordViolation(userId: string, type: ViolationType, details?: Record<string, unknown>): void;
/**
 * Get a user's violation summary.
 */
export declare function getUserViolationSummary(userId: string): UserRiskProfile | null;
/**
 * Get top violators by risk score.
 */
export declare function getTopViolators(limit?: number): UserRiskProfile[];
/**
 * Generate an audit report for a user.
 */
export declare function generateAuditReport(userId: string): {
    userId: string;
    profile: UserRiskProfile | null;
    report: {
        totalViolations: number;
        criticalViolations: number;
        highViolations: number;
        mediumViolations: number;
        lowViolations: number;
        violationsByType: Record<ViolationType, number>;
        riskLevel: string;
        recommendedAction: string;
    };
} | null;
/**
 * Check if a user is currently suspended.
 */
export declare function isUserSuspended(userId: string): boolean;
/**
 * Clear a user's flag (admin action).
 */
export declare function clearUserFlag(userId: string): boolean;
/**
 * Suspend a user (admin action).
 */
export declare function suspendUser(userId: string, reason?: string): boolean;
/**
 * Get audit statistics.
 */
export declare function getAuditStats(): AuditStats;
