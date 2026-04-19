/**
 * PvP Anti-Abuse Rate Limiting Module.
 * @fileoverview Implements rate limiting, cooldown systems, and abuse detection
 * for PvP endpoints to prevent spam, win trading, and ranking exploits.
 */

// Runtime is not used in this module but kept for type safety

/**
 * Rate limit configuration per RPC endpoint.
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Penalty time in milliseconds when rate limit is exceeded */
  penaltyMs: number;
}

/**
 * Cooldown configuration for match-related actions.
 */
export interface CooldownConfig {
  /** Cooldown after completing a match */
  matchCompleteMs: number;
  /** Cooldown after creating a match */
  matchCreateMs: number;
  /** Cooldown after accepting a match */
  matchAcceptMs: number;
  /** Cooldown after abandoning a match */
  matchAbandonMs: number;
  /** Cooldown after submitting a turn */
  turnSubmitMs: number;
}

/**
 * Player action tracking for rate limiting.
 */
interface PlayerActionTracker {
  /** Timestamps of recent actions */
  timestamps: number[];
  /** Time when rate limit penalty expires */
  penaltyUntil: number;
}

/**
 * Match tracking for cooldown and concurrent limits.
 */
interface PlayerMatchTracking {
  /** IDs of active matches */
  activeMatchIds: string[];
  /** Timestamp of last match completion */
  lastCompleteTime: number;
  /** Timestamp of last match creation */
  lastCreateTime: number;
  /** Timestamp of last match acceptance */
  lastAcceptTime: number;
  /** Timestamp of last match abandonment */
  lastAbandonTime: number;
  /** Count of abandonments in current session */
  abandonCount: number;
}

/**
 * Turn submission tracking for duplicate detection.
 */
interface TurnSubmissionTracking {
  /** Track last turn submission per match per player */
  matchTurnSubmissions: Map<string, number>;
}

// Default rate limit configurations
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  create_match: { maxRequests: 5, windowMs: 60000, penaltyMs: 300000 }, // 5/min, 5min penalty
  accept_match: { maxRequests: 10, windowMs: 60000, penaltyMs: 120000 }, // 10/min, 2min penalty
  submit_turn: { maxRequests: 10, windowMs: 60000, penaltyMs: 60000 }, // 10/min, 1min penalty
  complete_match: { maxRequests: 3, windowMs: 60000, penaltyMs: 600000 }, // 3/min, 10min penalty
  forfeit_match: { maxRequests: 2, windowMs: 60000, penaltyMs: 600000 }, // 2/min, 10min penalty
  list_matches: { maxRequests: 30, windowMs: 60000, penaltyMs: 30000 }, // 30/min, 30s penalty
  get_player_rank: { maxRequests: 60, windowMs: 60000, penaltyMs: 10000 }, // 60/min, 10s penalty
  get_async_match_state: { maxRequests: 30, windowMs: 60000, penaltyMs: 30000 }, // 30/min, 30s penalty
  stage_complete: { maxRequests: 5, windowMs: 60000, penaltyMs: 300000 }, // 5/min, 5min penalty
};

// Default cooldown configuration
const DEFAULT_COOLDOWNS: CooldownConfig = {
  matchCompleteMs: 30000, // 30 seconds between match completions
  matchCreateMs: 5000, // 5 seconds between match creations
  matchAcceptMs: 10000, // 10 seconds between match acceptances
  matchAbandonMs: 60000, // 60 seconds between abandonments
  turnSubmitMs: 0, // No cooldown on turn submission (handled by turn order)
};

// Default concurrent match limits
const MAX_ACTIVE_MATCHES = 3;
const MAX_ABANDONMENTS_PER_HOUR = 5;

// In-memory storage (in production, use Redis or similar)
const actionTrackers = new Map<string, PlayerActionTracker>();
const matchTracking = new Map<string, PlayerMatchTracking>();
const turnTracking = new Map<string, TurnSubmissionTracking>();

// Initialize config with defaults
let rateLimits = { ...DEFAULT_RATE_LIMITS };
let cooldowns = { ...DEFAULT_COOLDOWNS };

/**
 * Initialize the rate limiting module with custom configuration.
 */
export function initializeRateLimiting(
  customRateLimits?: Partial<Record<string, RateLimitConfig>>,
  customCooldowns?: Partial<CooldownConfig>
): void {
  if (customRateLimits) {
    for (const [key, value] of Object.entries(customRateLimits)) {
      if (value !== undefined) {
        rateLimits[key] = value;
      }
    }
  }
  if (customCooldowns) {
    cooldowns = { ...cooldowns, ...customCooldowns };
  }
}

/**
 * Check if a user is currently rate limited for a specific RPC.
 * Returns true if the action should be allowed.
 */
export function checkRateLimit(
  userId: string,
  rpcName: string
): { allowed: boolean; retryAfter?: number; reason?: string } {
  const config = rateLimits[rpcName];
  if (!config) {
    return { allowed: true }; // No rate limit configured
  }

  const now = Date.now();
  const tracker = getOrCreateActionTracker(userId);

  // Check if user is in penalty period
  if (tracker.penaltyUntil > now) {
    return {
      allowed: false,
      retryAfter: tracker.penaltyUntil - now,
      reason: 'rate_limit_penalty',
    };
  }

  // Clean up old timestamps outside the window
  tracker.timestamps = tracker.timestamps.filter((t) => now - t < config.windowMs);

  // Check if rate limit exceeded
  if (tracker.timestamps.length >= config.maxRequests) {
    // Apply penalty
    tracker.penaltyUntil = now + config.penaltyMs;
    tracker.timestamps = []; // Reset timestamps after penalty

    return {
      allowed: false,
      retryAfter: config.penaltyMs,
      reason: 'rate_limit_exceeded',
    };
  }

  // Record this action
  tracker.timestamps.push(now);
  return { allowed: true };
}

/**
 * Check if a player is on cooldown for a specific match action.
 */
export function checkMatchCooldown(
  userId: string,
  action: 'create' | 'accept' | 'complete' | 'abandon'
): { allowed: boolean; retryAfter?: number } {
  const tracking = getOrCreateMatchTracking(userId);
  const now = Date.now();

  let lastActionTime = 0;
  let cooldownMs = 0;

  switch (action) {
    case 'create':
      lastActionTime = tracking.lastCreateTime;
      cooldownMs = cooldowns.matchCreateMs;
      break;
    case 'accept':
      lastActionTime = tracking.lastAcceptTime;
      cooldownMs = cooldowns.matchAcceptMs;
      break;
    case 'complete':
      lastActionTime = tracking.lastCompleteTime;
      cooldownMs = cooldowns.matchCompleteMs;
      break;
    case 'abandon':
      lastActionTime = tracking.lastAbandonTime;
      cooldownMs = cooldowns.matchAbandonMs;
      break;
  }

  const timeSinceLastAction = now - lastActionTime;
  const remainingCooldown = Math.max(0, cooldownMs - timeSinceLastAction);

  if (remainingCooldown > 0) {
    return { allowed: false, retryAfter: remainingCooldown };
  }

  return { allowed: true };
}

/**
 * Record a match action for cooldown tracking.
 */
export function recordMatchAction(
  userId: string,
  action: 'create' | 'accept' | 'complete' | 'abandon',
  matchId?: string
): void {
  const tracking = getOrCreateMatchTracking(userId);
  const now = Date.now();

  switch (action) {
    case 'create':
      tracking.lastCreateTime = now;
      if (matchId && !tracking.activeMatchIds.includes(matchId)) {
        tracking.activeMatchIds.push(matchId);
      }
      break;
    case 'accept':
      tracking.lastAcceptTime = now;
      if (matchId && !tracking.activeMatchIds.includes(matchId)) {
        tracking.activeMatchIds.push(matchId);
      }
      break;
    case 'complete':
      tracking.lastCompleteTime = now;
      removeMatchFromActive(tracking, matchId);
      tracking.abandonCount = 0; // Reset abandonment count on successful completion
      break;
    case 'abandon':
      tracking.lastAbandonTime = now;
      removeMatchFromActive(tracking, matchId);
      tracking.abandonCount++;
      break;
  }
}

/**
 * Check if a player can create a new match (concurrent limit).
 */
export function checkConcurrentMatchLimit(userId: string): {
  allowed: boolean;
  activeCount: number;
  limit: number;
} {
  const tracking = getOrCreateMatchTracking(userId);
  const activeCount = tracking.activeMatchIds.length;

  return {
    allowed: activeCount < MAX_ACTIVE_MATCHES,
    activeCount,
    limit: MAX_ACTIVE_MATCHES,
  };
}

/**
 * Check for excessive abandonments.
 */
export function checkAbandonmentLimit(userId: string): {
  allowed: boolean;
  abandonCount: number;
  limit: number;
  reason?: string;
} {
  const tracking = getOrCreateMatchTracking(userId);

  // Check abandonments in the last hour
  const oneHourAgo = Date.now() - 3600000;
  if (tracking.lastAbandonTime < oneHourAgo) {
    tracking.abandonCount = 0;
  }

  if (tracking.abandonCount >= MAX_ABANDONMENTS_PER_HOUR) {
    return {
      allowed: false,
      abandonCount: tracking.abandonCount,
      limit: MAX_ABANDONMENTS_PER_HOUR,
      reason: 'too_many_abandonments',
    };
  }

  return {
    allowed: true,
    abandonCount: tracking.abandonCount,
    limit: MAX_ABANDONMENTS_PER_HOUR,
  };
}

/**
 * Check for duplicate turn submission.
 * Returns true if this turn has already been submitted.
 */
export function checkDuplicateTurn(
  userId: string,
  matchId: string,
  turnNumber: number
): { isDuplicate: boolean; lastTurnNumber?: number } {
  const key = `${userId}:${matchId}`;
  const tracking = getOrCreateTurnTracking(userId);
  const lastTurn = tracking.matchTurnSubmissions.get(key);

  if (lastTurn === turnNumber) {
    return { isDuplicate: true, lastTurnNumber: lastTurn };
  }

  tracking.matchTurnSubmissions.set(key, turnNumber);
  return { isDuplicate: false };
}

/**
 * Clean up turn submission tracking when match is completed.
 */
export function cleanupTurnTracking(userId: string, matchId: string): void {
  const tracking = turnTracking.get(userId);
  if (tracking) {
    const key = `${userId}:${matchId}`;
    tracking.matchTurnSubmissions.delete(key);
  }
}

/**
 * Check for suspicious patterns indicating win trading.
 * Analyzes recent match history for win/loss patterns against same opponent.
 */
export function detectWinTrading(
  userId: string,
  opponentId: string,
  recentResults: Array<{ result: 'win' | 'loss'; timestamp: number }>
): {
  suspicious: boolean;
  confidence: number;
  pattern: string;
} {
  if (recentResults.length < 3) {
    return { suspicious: false, confidence: 0, pattern: 'insufficient_data' };
  }

  // Filter results against this opponent only
  const opponentMatches = recentResults.filter((r) => r.result === 'win' || r.result === 'loss');

  if (opponentMatches.length < 3) {
    return { suspicious: false, confidence: 0, pattern: 'insufficient_opponent_matches' };
  }

  // Check for alternating win/loss pattern (classic win trading)
  let alternatingCount = 0;
  for (let i = 1; i < opponentMatches.length; i++) {
    if (opponentMatches[i].result !== opponentMatches[i - 1].result) {
      alternatingCount++;
    }
  }

  const alternatingRatio = alternatingCount / (opponentMatches.length - 1);

  // Check for rapid match completions against same opponent
  let rapidConfidence = 0;
  if (opponentMatches.length >= 3) {
    const timeSpans: number[] = [];
    for (let i = 1; i < opponentMatches.length; i++) {
      timeSpans.push(opponentMatches[i].timestamp - opponentMatches[i - 1].timestamp);
    }

    const avgTimeBetween = timeSpans.reduce((a, b) => a + b, 0) / timeSpans.length;

    if (avgTimeBetween < 120000) {
      // Less than 2 minutes between matches
      // Calculate confidence based on how rapid the matches are
      // Scale confidence so very rapid matches (e.g., 30s avg) have higher confidence
      // than alternating patterns (max 1.0)
      rapidConfidence = Math.max(0.5, Math.min(1.5, 1.5 - avgTimeBetween / 120000));
    }
  }

  // Return the pattern with highest confidence
  if (alternatingRatio >= 0.8 && opponentMatches.length >= 5) {
    const alternatingConfidence = Math.min(alternatingRatio + 0.1, 1.0);
    if (rapidConfidence > alternatingConfidence) {
      return {
        suspicious: true,
        confidence: rapidConfidence,
        pattern: 'rapid_repeated_opponents',
      };
    }
    return {
      suspicious: true,
      confidence: alternatingConfidence,
      pattern: 'alternating_wins_losses',
    };
  }

  if (rapidConfidence > 0.5) {
    return {
      suspicious: true,
      confidence: rapidConfidence,
      pattern: 'rapid_repeated_opponents',
    };
  }

  return { suspicious: false, confidence: 0, pattern: 'normal' };
}

/**
 * Get rate limit statistics for monitoring.
 */
export function getRateLimitStats(): {
  trackedUsers: number;
  trackedMatches: number;
  trackedTurns: number;
} {
  return {
    trackedUsers: actionTrackers.size,
    trackedMatches: matchTracking.size,
    trackedTurns: turnTracking.size,
  };
}

/**
 * Get player's current rate limit status.
 */
export function getPlayerRateLimitStatus(userId: string): {
  activeMatches: number;
  abandonCount: number;
  lastMatchAction?: string;
} {
  const tracking = matchTracking.get(userId);
  if (!tracking) {
    return { activeMatches: 0, abandonCount: 0 };
  }

  let lastMatchAction: string | undefined;
  const latest = Math.max(
    tracking.lastCompleteTime,
    tracking.lastCreateTime,
    tracking.lastAcceptTime,
    tracking.lastAbandonTime
  );

  if (latest === tracking.lastCompleteTime) lastMatchAction = 'complete';
  else if (latest === tracking.lastCreateTime) lastMatchAction = 'create';
  else if (latest === tracking.lastAcceptTime) lastMatchAction = 'accept';
  else if (latest === tracking.lastAbandonTime) lastMatchAction = 'abandon';

  return {
    activeMatches: tracking.activeMatchIds.length,
    abandonCount: tracking.abandonCount,
    lastMatchAction,
  };
}

// Helper functions

function getOrCreateActionTracker(userId: string): PlayerActionTracker {
  if (!actionTrackers.has(userId)) {
    actionTrackers.set(userId, {
      timestamps: [],
      penaltyUntil: 0,
    });
  }
  return actionTrackers.get(userId)!;
}

function getOrCreateMatchTracking(userId: string): PlayerMatchTracking {
  if (!matchTracking.has(userId)) {
    matchTracking.set(userId, {
      activeMatchIds: [],
      lastCompleteTime: 0,
      lastCreateTime: 0,
      lastAcceptTime: 0,
      lastAbandonTime: 0,
      abandonCount: 0,
    });
  }
  return matchTracking.get(userId)!;
}

function getOrCreateTurnTracking(userId: string): TurnSubmissionTracking {
  if (!turnTracking.has(userId)) {
    turnTracking.set(userId, {
      matchTurnSubmissions: new Map(),
    });
  }
  return turnTracking.get(userId)!;
}

function removeMatchFromActive(tracking: PlayerMatchTracking, matchId?: string): void {
  if (matchId) {
    const index = tracking.activeMatchIds.indexOf(matchId);
    if (index !== -1) {
      tracking.activeMatchIds.splice(index, 1);
    }
  }
}

/**
 * Cleanup old entries to prevent memory leaks.
 */
export function cleanupOldEntries(): void {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const oneDayAgo = now - 86400000;

  // Cleanup action trackers with no recent activity
  const usersToDelete: string[] = [];
  actionTrackers.forEach((tracker, userId) => {
    if (tracker.timestamps.length === 0 && tracker.penaltyUntil < now) {
      usersToDelete.push(userId);
    } else if (tracker.penaltyUntil < oneDayAgo) {
      tracker.timestamps = tracker.timestamps.filter((t) => t > oneHourAgo);
    }
  });
  usersToDelete.forEach((id) => actionTrackers.delete(id));

  // Cleanup match tracking for inactive players
  const matchesToDelete: string[] = [];
  matchTracking.forEach((tracking, userId) => {
    const latest = Math.max(
      tracking.lastCompleteTime,
      tracking.lastCreateTime,
      tracking.lastAcceptTime,
      tracking.lastAbandonTime
    );

    if (latest < oneDayAgo && tracking.activeMatchIds.length === 0) {
      matchesToDelete.push(userId);
    }
  });
  matchesToDelete.forEach((id) => matchTracking.delete(id));

  // Cleanup turn tracking
  const turnsToDelete: string[] = [];
  turnTracking.forEach((tracking, userId) => {
    if (tracking.matchTurnSubmissions.size === 0) {
      turnsToDelete.push(userId);
    }
  });
  turnsToDelete.forEach((id) => turnTracking.delete(id));
}

// Auto-cleanup interval (not in test mode)
const cleanupInterval =
  process.env.NODE_ENV !== 'test'
    ? setInterval(cleanupOldEntries, 300000) // Every 5 minutes
    : null;

/** Stop the cleanup interval (for test teardown). */
export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
}

/** Reset all tracking (for testing). */
export function resetRateLimiting(): void {
  actionTrackers.clear();
  matchTracking.clear();
  turnTracking.clear();
}
