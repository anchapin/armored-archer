/**
 * Anti-Cheat Audit & Forensics Module.
 * @fileoverview Implements violation tracking, user risk profiling,
 * automatic account flagging/suspension, and compliance reporting.
 */

export interface AntiCheatViolation {
  userId: string;
  type: ViolationType;
  timestamp: number;
  details: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export type ViolationType =
  | 'replay_attack'
  | 'invalid_signature'
  | 'timing_attack'
  | 'out_of_turn'
  | 'clock_skew'
  | 'invalid_progression'
  | 'stat_manipulation'
  | 'inventory_tampering';

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

const defaultConfig: AuditConfig = {
  enablePersistence: true,
  highRiskThreshold: 50,
  suspensionThreshold: 15,
  violationRetentionDays: 30,
  replayWindowMs: 300000,
};

let config: AuditConfig = { ...defaultConfig };
let nk: any;
let logger: any;

// In-memory storage for user risk profiles
const userRiskProfiles = new Map<string, UserRiskProfile>();

// Violation type weights for risk scoring
const VIOLATION_WEIGHTS: Record<ViolationType, number> = {
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
export function initializeAuditLogging(cfg: Partial<AuditConfig>, nakama: any, runtimeLogger: any): void {
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
export function recordViolation(
  userId: string,
  type: ViolationType,
  details: Record<string, unknown> = {}
): void {
  const timestamp = Date.now();
  const severity = getSeverity(type);
  
  const violation: AntiCheatViolation = {
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
      nk.storageWrite([{
        collection: 'anti_cheat_violations',
        key: storageKey,
        value: violation,
      }]);
    } catch (err) {
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
function getSeverity(type: ViolationType): 'low' | 'medium' | 'high' | 'critical' {
  const weights: Record<ViolationType, number> = {
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
  if (weight >= 20) return 'critical';
  if (weight >= 15) return 'high';
  if (weight >= 10) return 'medium';
  return 'low';
}

/**
 * Get a user's violation summary.
 */
export function getUserViolationSummary(userId: string): UserRiskProfile | null {
  return userRiskProfiles.get(userId) || null;
}

/**
 * Get top violators by risk score.
 */
export function getTopViolators(limit: number = 10): UserRiskProfile[] {
  const profiles = Array.from(userRiskProfiles.values());
  return profiles
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit);
}

/**
 * Generate an audit report for a user.
 */
export function generateAuditReport(userId: string): {
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
} | null {
  const profile = userRiskProfiles.get(userId);
  if (!profile) {
    return null;
  }

  const violationsByType: Record<ViolationType, number> = {
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
      case 'critical': critical++; break;
      case 'high': high++; break;
      case 'medium': medium++; break;
      case 'low': low++; break;
    }
  }

  let riskLevel = 'low';
  let recommendedAction = 'none';

  if (profile.riskScore >= config.suspensionThreshold) {
    riskLevel = 'critical';
    recommendedAction = 'suspend';
  } else if (profile.riskScore >= config.highRiskThreshold) {
    riskLevel = 'high';
    recommendedAction = 'flag';
  } else if (profile.riskScore >= 25) {
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
export function isUserSuspended(userId: string): boolean {
  const profile = userRiskProfiles.get(userId);
  return profile?.isSuspended || false;
}

/**
 * Clear a user's flag (admin action).
 */
export function clearUserFlag(userId: string): boolean {
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
export function suspendUser(userId: string, reason: string = 'admin_action'): boolean {
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
  } else {
    profile.isSuspended = true;
    profile.riskScore = Math.max(profile.riskScore, config.suspensionThreshold);
  }

  logger.warn('User suspended manually', { userId, reason });
  return true;
}

/**
 * Get audit statistics.
 */
export function getAuditStats(): AuditStats {
  const profiles = Array.from(userRiskProfiles.values());
  const violationsByType: Record<ViolationType, number> = {
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
    suspendedUsers: profiles.filter(p => p.isSuspended).length,
    highRiskUsers: profiles.filter(p => p.riskScore >= config.highRiskThreshold).length,
    violationsByType,
  };
}
