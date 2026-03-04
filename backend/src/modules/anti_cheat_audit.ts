/**
 * Anti-Cheat Audit & Forensics Module.
 * @fileoverview Implements violation tracking, user risk profiling,
 * automatic account flagging/suspension, and compliance reporting.
 */

import { Runtime } from '../types/nakama';
import { AntiCheatViolation } from './anti_cheat';

/**
 * Configuration for audit logging system.
 */
export interface AuditConfig {
  enablePersistence: boolean;
  highRiskThreshold: number; // Risk score >= this triggers manual review
  suspensionThreshold: number; // Violations >= this triggers auto-suspension
  violationRetentionDays: number; // How long to keep violation records
  replayWindowMs: number; // Time window for replay attack detection
}

/**
 * User risk profile for tracking violations and risk scoring.
 */
export interface UserRiskProfile {
  userId: string;
  violations: UserViolation[];
  riskScore: number;
  isHighRisk: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
  suspensionExpiresAt?: number;
  lastViolationTime: number;
  violationCount: number;
}

/**
 * Individual user violation record.
 */
export interface UserViolation {
  id: string;
  violationType: string;
  timestamp: number;
  rpcName: string;
  details: Record<string, unknown>;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

/**
 * Audit log summary for a user.
 */
export interface UserViolationSummary {
  userId: string;
  totalViolations: number;
  violationsByType: Record<string, number>;
  riskScore: number;
  isHighRisk: boolean;
  isSuspended: boolean;
  lastViolationTime: number;
}

/**
 * Compliance report for a time period.
 */
export interface AuditReport {
  startTime: number;
  endTime: number;
  totalViolations: number;
  uniqueUsers: number;
  violationsByType: Record<string, number>;
  violationsBySeverity: Record<string, number>;
  highRiskUsers: number;
  autoSuspensions: number;
}

const defaultConfig: AuditConfig = {
  enablePersistence: true,
  highRiskThreshold: 50,
  suspensionThreshold: 15,
  violationRetentionDays: 30,
  replayWindowMs: 300000,
};

let config: AuditConfig = { ...defaultConfig };
let nk: Runtime.Nakama;
let logger: Runtime.Logger;

// In-memory storage for user risk profiles
const userRiskProfiles = new Map<string, UserRiskProfile>();

// Violation type weights for risk scoring
const VIOLATION_WEIGHTS: Record<string, number> = {
  replay_attack: 20,
  invalid_signature: 18,
  timing_attack: 12,
  out_of_turn: 8,
  clock_skew: 3,
};

/**
 * Initialize the audit logging system.
 */
export function initializeAuditLogging(
  cfg: Partial<AuditConfig>,
  nakama: Runtime.Nakama,
  runtimeLogger: Runtime.Logger
): void {
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
 * Record an anti-cheat violation and update user risk profile.
 */
export function recordViolation(violation: AntiCheatViolation): void {
  const userId = violation.userId;
  const profile = getOrCreateUserProfile(userId);

  // Determine severity based on violation type
  const severity = getViolationSeverity(violation.violationType);

  // Create violation record
  const userViolation: UserViolation = {
    id: `${violation.requestId}:${Date.now()}`,
    violationType: violation.violationType,
    timestamp: violation.timestamp,
    rpcName: violation.rpcName,
    details: violation.details,
    severity,
  };

  profile.violations.push(userViolation);
  profile.lastViolationTime = violation.timestamp;
  profile.violationCount++;

  // Clean up old violations
  cleanupOldViolations(profile);

  // Update risk score
  updateRiskScore(profile);

  // Check for auto-suspension
  checkAutoSuspension(profile);

  // Persist to storage if enabled
  if (config.enablePersistence && nk) {
    persistViolation(userId, userViolation);
  }

  // Log warning for critical violations
  if (severity === 'CRITICAL') {
    logger?.warn('CRITICAL anti-cheat violation for user %s: %s', userId, violation.violationType, {
      rpcName: violation.rpcName,
      requestId: violation.requestId,
    });
  }
}

/**
 * Get user violation summary.
 */
export function getUserViolationSummary(userId: string): UserViolationSummary | null {
  const profile = userRiskProfiles.get(userId);
  if (!profile) {
    return null;
  }

  const violationsByType: Record<string, number> = {};
  for (const v of profile.violations) {
    violationsByType[v.violationType] = (violationsByType[v.violationType] || 0) + 1;
  }

  return {
    userId: profile.userId,
    totalViolations: profile.violationCount,
    violationsByType,
    riskScore: profile.riskScore,
    isHighRisk: profile.isHighRisk,
    isSuspended: profile.isSuspended,
    lastViolationTime: profile.lastViolationTime,
  };
}

/**
 * Get top violators by risk score.
 */
export function getTopViolators(limit: number): UserViolationSummary[] {
  const profiles = Array.from(userRiskProfiles.values());

  // Sort by risk score descending
  profiles.sort((a, b) => b.riskScore - a.riskScore);

  return profiles.slice(0, limit).map((profile) => ({
    userId: profile.userId,
    totalViolations: profile.violationCount,
    violationsByType: profile.violations.reduce(
      (acc, v) => {
        acc[v.violationType] = (acc[v.violationType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
    riskScore: profile.riskScore,
    isHighRisk: profile.isHighRisk,
    isSuspended: profile.isSuspended,
    lastViolationTime: profile.lastViolationTime,
  }));
}

/**
 * Generate audit report for a time period.
 */
export function generateAuditReport(startTime: number, endTime: number): AuditReport {
  const profiles = Array.from(userRiskProfiles.values());

  const violationsByType: Record<string, number> = {};
  const violationsBySeverity: Record<string, number> = {};
  const uniqueUsers = new Set<string>();
  let totalViolations = 0;
  let highRiskUsers = 0;
  let autoSuspensions = 0;

  for (const profile of profiles) {
    if (profile.isHighRisk) highRiskUsers++;
    if (profile.isSuspended) autoSuspensions++;

    for (const v of profile.violations) {
      if (v.timestamp >= startTime && v.timestamp <= endTime) {
        uniqueUsers.add(profile.userId);
        totalViolations++;

        violationsByType[v.violationType] = (violationsByType[v.violationType] || 0) + 1;
        violationsBySeverity[v.severity] = (violationsBySeverity[v.severity] || 0) + 1;
      }
    }
  }

  return {
    startTime,
    endTime,
    totalViolations,
    uniqueUsers: uniqueUsers.size,
    violationsByType,
    violationsBySeverity,
    highRiskUsers,
    autoSuspensions,
  };
}

/**
 * Check if user is suspended.
 */
export function isUserSuspended(userId: string): boolean {
  const profile = userRiskProfiles.get(userId);
  if (!profile) {
    return false;
  }

  // Check if suspension has expired
  if (profile.isSuspended && profile.suspensionExpiresAt) {
    if (Date.now() > profile.suspensionExpiresAt) {
      profile.isSuspended = false;
      profile.suspensionReason = undefined;
      profile.suspensionExpiresAt = undefined;
      logger?.info('Suspension expired for user %s', userId);
      return false;
    }
  }

  return profile.isSuspended;
}

/**
 * Clear user flag (admin action).
 */
export function clearUserFlag(userId: string): void {
  const profile = userRiskProfiles.get(userId);
  if (profile) {
    profile.isHighRisk = false;
    profile.riskScore = 0;
    logger?.info('User flag cleared: %s', userId);
  }
}

/**
 * Manually suspend a user (admin action).
 */
export function suspendUser(userId: string, reason: string, durationDays: number): void {
  const profile = getOrCreateUserProfile(userId);
  profile.isSuspended = true;
  profile.suspensionReason = reason;
  profile.suspensionExpiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;
  profile.isHighRisk = true;

  // Persist suspension to storage
  if (config.enablePersistence && nk) {
    persistSuspension(userId, profile);
  }

  logger?.warn(
    'User suspended: %s (reason: %s, expires: %s)',
    userId,
    reason,
    new Date(profile.suspensionExpiresAt).toISOString()
  );
}

/**
 * Get audit statistics.
 */
export function getAuditStats(): {
  trackedUsers: number;
  highRiskUsers: number;
  suspendedUsers: number;
  config: AuditConfig;
} {
  let highRiskCount = 0;
  let suspendedCount = 0;

  userRiskProfiles.forEach((profile) => {
    if (profile.isHighRisk) highRiskCount++;
    if (profile.isSuspended) suspendedCount++;
  });

  return {
    trackedUsers: userRiskProfiles.size,
    highRiskUsers: highRiskCount,
    suspendedUsers: suspendedCount,
    config,
  };
}

// ============================================================
// Private Helper Functions
// ============================================================

function getOrCreateUserProfile(userId: string): UserRiskProfile {
  if (!userRiskProfiles.has(userId)) {
    userRiskProfiles.set(userId, {
      userId,
      violations: [],
      riskScore: 0,
      isHighRisk: false,
      isSuspended: false,
      lastViolationTime: 0,
      violationCount: 0,
    });
  }
  return userRiskProfiles.get(userId)!;
}

function getViolationSeverity(violationType: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' {
  switch (violationType) {
    case 'replay_attack':
    case 'invalid_signature':
      return 'CRITICAL';
    case 'timing_attack':
    case 'out_of_turn':
      return 'HIGH';
    case 'clock_skew':
    default:
      return 'MEDIUM';
  }
}

function updateRiskScore(profile: UserRiskProfile): void {
  let score = 0;

  // Sum weights for each violation type
  for (const v of profile.violations) {
    const weight = VIOLATION_WEIGHTS[v.violationType] || 1;
    score += weight;
  }

  // Add penalty for recent violations
  const oneHourAgo = Date.now() - 3600000;
  const recentViolations = profile.violations.filter((v) => v.timestamp > oneHourAgo);
  if (recentViolations.length > 0) {
    score += 10;
  }

  profile.riskScore = Math.min(score, 100); // Cap at 100
  profile.isHighRisk = score >= config.highRiskThreshold;

  // Persist high risk status
  if (profile.isHighRisk && config.enablePersistence && nk) {
    persistHighRiskUser(profile.userId);
  }
}

function checkAutoSuspension(profile: UserRiskProfile): void {
  const oneDayAgo = Date.now() - 86400000;
  const recentViolations = profile.violations.filter((v) => v.timestamp > oneDayAgo);

  if (recentViolations.length >= config.suspensionThreshold) {
    profile.isSuspended = true;
    profile.suspensionReason = `Auto-suspended: ${recentViolations.length} violations in 24 hours`;
    profile.suspensionExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    profile.isHighRisk = true;

    logger?.error(
      'User auto-suspended: %s (%d violations in 24 hours)',
      profile.userId,
      recentViolations.length
    );

    // Persist suspension
    if (config.enablePersistence && nk) {
      persistSuspension(profile.userId, profile);
    }
  }
}

function cleanupOldViolations(profile: UserRiskProfile): void {
  const cutoffTime = Date.now() - config.violationRetentionDays * 24 * 60 * 60 * 1000;
  profile.violations = profile.violations.filter((v) => v.timestamp > cutoffTime);
}

function persistViolation(userId: string, violation: UserViolation): void {
  try {
    nk.storageWrite([
      {
        collection: 'anti_cheat_violations',
        key: `${userId}:${violation.timestamp}:${violation.id}`,
        userId,
        value: JSON.stringify(violation),
      },
    ]);
  } catch (err) {
    logger?.error('Failed to persist violation: %s', err);
  }
}

function persistHighRiskUser(userId: string): void {
  try {
    nk.storageWrite([
      {
        collection: 'high_risk_users',
        key: userId,
        userId: 'system', // System-owned
        value: JSON.stringify({
          userId,
          flaggedAt: Date.now(),
          reason: 'Risk score exceeded threshold',
        }),
      },
    ]);
  } catch (err) {
    logger?.error('Failed to persist high risk user: %s', err);
  }
}

function persistSuspension(userId: string, profile: UserRiskProfile): void {
  try {
    nk.storageWrite([
      {
        collection: 'player_suspensions',
        key: userId,
        userId: 'system',
        value: JSON.stringify({
          userId,
          reason: profile.suspensionReason,
          suspendedAt: profile.lastViolationTime,
          expiresAt: profile.suspensionExpiresAt,
        }),
      },
    ]);
  } catch (err) {
    logger?.error('Failed to persist suspension: %s', err);
  }
}

// Cleanup old data periodically
setInterval(() => {
  const cutoffTime = Date.now() - config.violationRetentionDays * 24 * 60 * 60 * 1000;

  userRiskProfiles.forEach((profile, userId) => {
    cleanupOldViolations(profile);

    // Remove profiles with no recent violations
    if (profile.lastViolationTime > 0 && profile.lastViolationTime < cutoffTime) {
      userRiskProfiles.delete(userId);
    }
  });
}, 3600000); // Every hour
