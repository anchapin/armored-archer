/**
 * PvP Anti-Abuse Rate Limiting Module.
 * @fileoverview Implements rate limiting, cooldown systems, and abuse detection
 * for PvP endpoints to prevent spam, win trading, and ranking exploits.
 *
 * Issue #1697: module state lives in durable Nakama storage (collection
 * `pvp_rate_limits`), shared by every Nakama instance and surviving restarts.
 * The previous process-local Maps let limits reset on every deploy and
 * diverge per node, so a client could bypass them under horizontal scaling.
 * Same idiom as utils/rateLimiter.ts (SEC-004 / issue #1301): storageRead +
 * optimistic-concurrency storageWrite, fail open on storage outage, fail
 * closed on CAS contention. Redis remains unreachable from the goja runtime
 * (ADR-0008), so storage OCC is the sanctioned sync substitute.
 */

import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { toStorageValue, getStorageRawValue } from '../utils/storage-helpers';

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

/** Match actions tracked for cooldowns and concurrency. */
type MatchAction = 'create' | 'accept' | 'complete' | 'abandon';

/** Result of a per-RPC rate limit check. */
interface RateLimitCheckResult {
  allowed: boolean;
  retryAfter?: number;
  reason?: string;
}

/** Stored per-user RPC action tracker (sliding window + penalty). */
interface StoredActionsRecord {
  /** Timestamps of recent actions, shared across RPC names (see checkRateLimit) */
  timestamps: number[];
  /** Time when rate limit penalty expires */
  penaltyUntil: number;
  /** Reset epoch stamped at write time (test hook, see resetRateLimiting) */
  resetId?: number;
}

/** One active match entry, timestamped so stale entries can be pruned. */
interface StoredActiveMatch {
  id: string;
  since: number;
}

/** Stored per-user match cooldown/concurrency/abandonment state. */
interface StoredMatchRecord {
  /** Active matches with the time they were recorded */
  activeMatches: StoredActiveMatch[];
  lastCompleteTime: number;
  lastCreateTime: number;
  lastAcceptTime: number;
  lastAbandonTime: number;
  /** Count of abandonments in the current hourly window */
  abandonCount: number;
  resetId?: number;
}

/** Stored per-user turn submission dedup state. */
interface StoredTurnsRecord {
  /** Last submitted turn per match, with submission time for pruning */
  submissions: Record<string, { turn: number; ts: number }>;
  resetId?: number;
}

// Default rate limit configurations
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  create_match: { maxRequests: 5, windowMs: 60000, penaltyMs: 300000 }, // 5/min, 5min penalty
  accept_match: { maxRequests: 10, windowMs: 60000, penaltyMs: 120000 }, // 10/min, 2min penalty
  complete_match: { maxRequests: 3, windowMs: 60000, penaltyMs: 600000 }, // 3/min, 10min penalty
  list_matches: { maxRequests: 30, windowMs: 60000, penaltyMs: 30000 }, // 30/min, 30s penalty
  get_player_rank: { maxRequests: 60, windowMs: 60000, penaltyMs: 10000 }, // 60/min, 10s penalty
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

/** Storage collection holding every record this module writes. */
const RATE_LIMIT_COLLECTION = 'pvp_rate_limits';

/** Max CAS attempts before a contended check fails closed. */
const CAS_ATTEMPTS = 3;

/**
 * Stale-entry lifetimes. Nakama storage has no TTL, so time-bounded state
 * carries its own timestamps and is pruned on write. The active-match
 * lifetime also bounds how long a crashed match can hold one of the
 * MAX_ACTIVE_MATCHES concurrency slots - with in-memory state a restart
 * cleared these implicitly.
 */
const ACTIVE_MATCH_TTL_MS = 24 * 60 * 60 * 1000;
const TURN_RECORD_TTL_MS = 24 * 60 * 60 * 1000;

// Initialize config with defaults
let rateLimits = { ...DEFAULT_RATE_LIMITS };
let cooldowns = { ...DEFAULT_COOLDOWNS };

/**
 * Reset epoch, stamped into every record this process writes. Starts at 0
 * on boot, so records written by earlier processes (resetId 0 or absent)
 * read as current - state survives restarts. resetRateLimiting() bumps it,
 * which is how tests invalidate stored state without a storage handle.
 */
let currentResetId = 0;

/**
 * In-memory mirrors for OBSERVABILITY ONLY (getRateLimitStats). They are
 * never consulted for allow/deny decisions - the durable record is the only
 * gate, so these mirrors cannot reintroduce the per-instance bypass.
 */
const mirrorActions = new Map<string, number>();
const mirrorMatches = new Map<string, number>();
const mirrorTurns = new Map<string, number>();

/**
 * Initialize the rate limiting module with custom configuration.
 * Configuration is per-process (each node applies it at boot); the tracked
 * state it governs is shared durable storage.
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

// ---------------------------------------------------------------------------
// Storage helpers (OCC read-modify-write; see utils/rateLimiter.ts SEC-004)
// ---------------------------------------------------------------------------

type StoredRead<T> = { ok: true; record?: T; version?: string } | { ok: false };

type Mutation<R> = { result: R; store?: object };

type CasOutcome<R> = { status: 'ok'; result: R } | { status: 'error' } | { status: 'contention' };

function actionKey(userId: string): string {
  return `${userId}:actions`;
}

function matchKey(userId: string): string {
  return `${userId}:match`;
}

function turnsKey(userId: string): string {
  return `${userId}:turns`;
}

/** A stored record is current only if this process's reset epoch stamped it. */
function isCurrent<T extends { resetId?: number }>(record: T | undefined): record is T {
  return record !== undefined && (record.resetId ?? 0) === currentResetId;
}

function readStoredRecord<T>(nk: Runtime.Nakama, key: string): StoredRead<T> {
  let objects: Runtime.StorageObject[];
  try {
    objects = nk.storageRead([{ collection: RATE_LIMIT_COLLECTION, key, userId: '' }]);
  } catch (e) {
    // Storage outage: callers fail OPEN for availability (every other RPC
    // dependency on storage fails in that state anyway); log loudly so the
    // gap is observable.
    logger.error('PvP rate limit storage read failed for %s - failing open: %s', key, e);
    return { ok: false };
  }
  if (objects.length === 0) {
    return { ok: true };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(getStorageRawValue(objects[0].value) ?? '{}');
  } catch (e) {
    logger.warn('PvP rate limit record %s is corrupt - treating as fresh: %s', key, e);
    return { ok: true, version: objects[0].version };
  }
  const record = typeof parsed === 'object' && parsed !== null ? (parsed as T) : undefined;
  return { ok: true, record, version: objects[0].version };
}

function writeStoredRecord(
  nk: Runtime.Nakama,
  key: string,
  value: object,
  version: string | undefined
): 'ok' | 'retry' | 'error' {
  // 'retry' means we lost the CAS race and the caller re-reads.
  const casConflict = /version check failed|storage write rejected/i;
  try {
    nk.storageWrite([
      {
        version: version ?? '*',
        userId: '',
        permissionRead: 0,
        permissionWrite: 0,
        collection: RATE_LIMIT_COLLECTION,
        key,
        value: toStorageValue(value),
      },
    ]);
  } catch (e) {
    if (casConflict.test(String(e))) {
      return 'retry';
    }
    logger.error('PvP rate limit storage write failed for %s - failing open: %s', key, e);
    return 'error';
  }
  return 'ok';
}

/**
 * One read-modify-write OCC loop against a durable record. The mutate
 * callback returns a result plus an optional replacement record; when no
 * replacement is given the check is read-only and no write is attempted.
 * Returns 'error' on storage outage (caller fails open) and 'contention'
 * after CAS_ATTEMPTS lost races (caller fails closed or degrades, per the
 * call site's contract).
 */
function casModify<T extends { resetId?: number }, R>(
  nk: Runtime.Nakama,
  key: string,
  mutate: (record: T | undefined) => Mutation<R>
): CasOutcome<R> {
  for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt++) {
    const read = readStoredRecord<T>(nk, key);
    if (!read.ok) {
      return { status: 'error' };
    }
    const record = isCurrent(read.record) ? read.record : undefined;
    const mutation = mutate(record);
    if (mutation.store === undefined) {
      return { status: 'ok', result: mutation.result };
    }
    const outcome = writeStoredRecord(nk, key, mutation.store, read.version);
    if (outcome === 'ok') {
      return { status: 'ok', result: mutation.result };
    }
    if (outcome === 'error') {
      return { status: 'error' };
    }
    // 'retry': another writer won the race - re-read and re-evaluate.
  }
  return { status: 'contention' };
}

function touchMirror(map: Map<string, number>, userId: string): void {
  map.set(userId, Date.now());
}

// ---------------------------------------------------------------------------
// RPC rate limiting (sliding window + penalty, shared across RPC names)
// ---------------------------------------------------------------------------

function evaluateRateLimit(
  tracker: StoredActionsRecord | undefined,
  config: RateLimitConfig,
  now: number
): Mutation<RateLimitCheckResult> {
  if (tracker && tracker.penaltyUntil > now) {
    return {
      result: {
        allowed: false,
        retryAfter: tracker.penaltyUntil - now,
        reason: 'rate_limit_penalty',
      },
    };
  }
  const timestamps = (tracker?.timestamps ?? []).filter((t) => now - t < config.windowMs);
  if (timestamps.length >= config.maxRequests) {
    return {
      result: { allowed: false, retryAfter: config.penaltyMs, reason: 'rate_limit_exceeded' },
      store: { timestamps: [], penaltyUntil: now + config.penaltyMs, resetId: currentResetId },
    };
  }
  timestamps.push(now);
  return {
    result: { allowed: true },
    store: { timestamps, penaltyUntil: 0, resetId: currentResetId },
  };
}

/**
 * Check if a user is currently rate limited for a specific RPC.
 * Returns true if the action should be allowed.
 *
 * Note: the timestamp list is per-USER, shared across RPC names - an action
 * on any rate-limited RPC counts toward every RPC's window. This preserves
 * the exact pre-#1697 semantics; only the backing store changed.
 */
export function checkRateLimit(
  nk: Runtime.Nakama,
  userId: string,
  rpcName: string
): { allowed: boolean; retryAfter?: number; reason?: string } {
  const config = rateLimits[rpcName];
  if (!config) {
    return { allowed: true }; // No rate limit configured
  }
  const now = Date.now();
  const outcome = casModify<StoredActionsRecord, RateLimitCheckResult>(
    nk,
    actionKey(userId),
    (tracker) => evaluateRateLimit(tracker, config, now)
  );
  if (outcome.status === 'ok') {
    touchMirror(mirrorActions, userId);
    return outcome.result;
  }
  if (outcome.status === 'contention') {
    // Fail closed (utils/rateLimiter.ts precedent): a legitimate client
    // retrying in a moment succeeds; an attacker hammering one key keeps
    // losing.
    logger.warn('PvP rate limit CAS contention exhausted for %s - denying', userId);
    return { allowed: false, retryAfter: config.windowMs, reason: 'rate_limit_contention' };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Match cooldowns, concurrency, and abandonment tracking
// ---------------------------------------------------------------------------

function emptyMatchRecord(): StoredMatchRecord {
  return {
    activeMatches: [],
    lastCompleteTime: 0,
    lastCreateTime: 0,
    lastAcceptTime: 0,
    lastAbandonTime: 0,
    abandonCount: 0,
    resetId: currentResetId,
  };
}

function pruneActiveMatches(activeMatches: StoredActiveMatch[], now: number): StoredActiveMatch[] {
  return activeMatches.filter((m) => now - m.since < ACTIVE_MATCH_TTL_MS);
}

function cooldownFor(
  tracking: StoredMatchRecord,
  action: MatchAction
): { lastActionTime: number; cooldownMs: number } {
  switch (action) {
    case 'create':
      return { lastActionTime: tracking.lastCreateTime, cooldownMs: cooldowns.matchCreateMs };
    case 'accept':
      return { lastActionTime: tracking.lastAcceptTime, cooldownMs: cooldowns.matchAcceptMs };
    case 'complete':
      return { lastActionTime: tracking.lastCompleteTime, cooldownMs: cooldowns.matchCompleteMs };
    case 'abandon':
      return { lastActionTime: tracking.lastAbandonTime, cooldownMs: cooldowns.matchAbandonMs };
  }
}

/**
 * Check if a player is on cooldown for a specific match action. Read-only;
 * fails open on storage outage.
 */
export function checkMatchCooldown(
  nk: Runtime.Nakama,
  userId: string,
  action: MatchAction
): { allowed: boolean; retryAfter?: number } {
  const read = readStoredRecord<StoredMatchRecord>(nk, matchKey(userId));
  if (!read.ok || !isCurrent(read.record)) {
    return { allowed: true };
  }
  const tracking = read.record;
  const { lastActionTime, cooldownMs } = cooldownFor(tracking, action);
  const remainingCooldown = Math.max(0, cooldownMs - (Date.now() - lastActionTime));
  if (remainingCooldown > 0) {
    return { allowed: false, retryAfter: remainingCooldown };
  }
  return { allowed: true };
}

function applyMatchAction(
  tracking: StoredMatchRecord | undefined,
  action: MatchAction,
  matchId: string | undefined,
  now: number
): StoredMatchRecord {
  const record = tracking ?? emptyMatchRecord();
  record.activeMatches = pruneActiveMatches(record.activeMatches, now);
  if ((action === 'create' || action === 'accept') && matchId) {
    if (!record.activeMatches.some((m) => m.id === matchId)) {
      record.activeMatches.push({ id: matchId, since: now });
    }
  }
  switch (action) {
    case 'create':
      record.lastCreateTime = now;
      break;
    case 'accept':
      record.lastAcceptTime = now;
      break;
    case 'complete':
      record.lastCompleteTime = now;
      record.activeMatches = record.activeMatches.filter((m) => m.id !== matchId);
      record.abandonCount = 0; // Reset abandonment count on successful completion
      break;
    case 'abandon':
      record.lastAbandonTime = now;
      record.activeMatches = record.activeMatches.filter((m) => m.id !== matchId);
      record.abandonCount++;
      break;
  }
  record.resetId = currentResetId;
  return record;
}

/**
 * Record a match action for cooldown tracking. Bookkeeping only: storage
 * failure or CAS contention is logged and dropped, never blocks the match.
 */
export function recordMatchAction(
  nk: Runtime.Nakama,
  userId: string,
  action: MatchAction,
  matchId?: string
): void {
  const now = Date.now();
  const outcome = casModify<StoredMatchRecord, void>(nk, matchKey(userId), (tracking) => ({
    result: undefined,
    store: applyMatchAction(tracking, action, matchId, now),
  }));
  if (outcome.status === 'ok') {
    touchMirror(mirrorMatches, userId);
    return;
  }
  logger.warn(
    'PvP rate limit: dropped recordMatchAction(%s, %s) after %s',
    userId,
    action,
    outcome.status === 'contention' ? 'CAS contention' : 'storage error'
  );
}

/**
 * Check if a player can create a new match (concurrent limit). Entries
 * older than ACTIVE_MATCH_TTL_MS no longer count (see module docstring).
 */
export function checkConcurrentMatchLimit(
  nk: Runtime.Nakama,
  userId: string
): { allowed: boolean; activeCount: number; limit: number } {
  const now = Date.now();
  const outcome = casModify<
    StoredMatchRecord,
    { allowed: boolean; activeCount: number; limit: number }
  >(nk, matchKey(userId), (tracking) => {
    const active = pruneActiveMatches(tracking?.activeMatches ?? [], now);
    const result = {
      allowed: active.length < MAX_ACTIVE_MATCHES,
      activeCount: active.length,
      limit: MAX_ACTIVE_MATCHES,
    };
    const prunedAway = tracking ? tracking.activeMatches.length - active.length : 0;
    if (prunedAway > 0 && tracking) {
      const store = { ...tracking, activeMatches: active, resetId: currentResetId };
      return { result, store };
    }
    return { result };
  });
  if (outcome.status !== 'ok') {
    if (outcome.status === 'contention') {
      logger.warn('PvP concurrent-match check CAS contention for %s - failing open', userId);
    }
    return { allowed: true, activeCount: 0, limit: MAX_ACTIVE_MATCHES };
  }
  return outcome.result;
}

/**
 * Check for excessive abandonments. The hourly window is anchored to the
 * last abandonment, preserving the pre-#1697 semantics.
 */
export function checkAbandonmentLimit(
  nk: Runtime.Nakama,
  userId: string
): { allowed: boolean; abandonCount: number; limit: number; reason?: string } {
  const oneHourAgo = Date.now() - 3600000;
  const outcome = casModify<
    StoredMatchRecord,
    { allowed: boolean; abandonCount: number; limit: number; reason?: string }
  >(nk, matchKey(userId), (tracking) => {
    let abandonCount = tracking?.abandonCount ?? 0;
    let store: Record<string, unknown> | undefined;
    if (tracking && tracking.lastAbandonTime < oneHourAgo && abandonCount !== 0) {
      abandonCount = 0;
      store = { ...tracking, abandonCount: 0, resetId: currentResetId };
    }
    const blocked = abandonCount >= MAX_ABANDONMENTS_PER_HOUR;
    const result = {
      allowed: !blocked,
      abandonCount,
      limit: MAX_ABANDONMENTS_PER_HOUR,
      ...(blocked ? { reason: 'too_many_abandonments' } : {}),
    };
    return store ? { result, store } : { result };
  });
  if (outcome.status === 'ok') {
    return outcome.result;
  }
  if (outcome.status === 'contention') {
    logger.warn('PvP abandonment check CAS contention for %s - failing open', userId);
  }
  return { allowed: true, abandonCount: 0, limit: MAX_ABANDONMENTS_PER_HOUR };
}

// ---------------------------------------------------------------------------
// Turn submission dedup
// ---------------------------------------------------------------------------

function pruneTurnSubmissions(
  submissions: StoredTurnsRecord['submissions'],
  now: number
): StoredTurnsRecord['submissions'] {
  const pruned: StoredTurnsRecord['submissions'] = {};
  for (const [matchId, entry] of Object.entries(submissions)) {
    if (now - entry.ts < TURN_RECORD_TTL_MS) {
      pruned[matchId] = entry;
    }
  }
  return pruned;
}

/**
 * Check for duplicate turn submission.
 * Returns true if this turn has already been submitted.
 *
 * Defense in depth only: the live duel engine in combat_system.ts owns
 * authoritative turn bookkeeping (issue #903). Storage failure or CAS
 * contention therefore fails OPEN (logged), never blocks a turn.
 */
export function checkDuplicateTurn(
  nk: Runtime.Nakama,
  userId: string,
  matchId: string,
  turnNumber: number
): { isDuplicate: boolean; lastTurnNumber?: number } {
  const now = Date.now();
  const outcome = casModify<StoredTurnsRecord, { isDuplicate: boolean; lastTurnNumber?: number }>(
    nk,
    turnsKey(userId),
    (tracking) => {
      const submissions = pruneTurnSubmissions(tracking?.submissions ?? {}, now);
      const last = submissions[matchId]?.turn;
      if (last === turnNumber) {
        return { result: { isDuplicate: true, lastTurnNumber: last } };
      }
      submissions[matchId] = { turn: turnNumber, ts: now };
      return {
        result: { isDuplicate: false },
        store: { submissions, resetId: currentResetId },
      };
    }
  );
  if (outcome.status === 'ok') {
    touchMirror(mirrorTurns, userId);
    return outcome.result;
  }
  logger.warn(
    'PvP turn dedup bypassed for %s after %s',
    userId,
    outcome.status === 'contention' ? 'CAS contention' : 'storage error'
  );
  return { isDuplicate: false };
}

/**
 * Clean up turn submission tracking when match is completed.
 */
export function cleanupTurnTracking(nk: Runtime.Nakama, userId: string, matchId: string): void {
  const outcome = casModify<StoredTurnsRecord, void>(nk, turnsKey(userId), (tracking) => {
    if (!tracking || !(matchId in tracking.submissions)) {
      return { result: undefined };
    }
    const submissions = { ...tracking.submissions };
    delete submissions[matchId];
    return { result: undefined, store: { submissions, resetId: currentResetId } };
  });
  if (outcome.status !== 'ok') {
    logger.warn('PvP turn cleanup failed for %s match %s', userId, matchId);
  }
}

// ---------------------------------------------------------------------------
// Win trading detection (pure analysis, no state)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Observability
// ---------------------------------------------------------------------------

/**
 * Get rate limit statistics for monitoring. Mirror-based and approximate:
 * counts users this process has seen, not the full durable state.
 */
export function getRateLimitStats(): {
  trackedUsers: number;
  trackedMatches: number;
  trackedTurns: number;
} {
  return {
    trackedUsers: mirrorActions.size,
    trackedMatches: mirrorMatches.size,
    trackedTurns: mirrorTurns.size,
  };
}

/**
 * Get player's current rate limit status. Read-only; returns zeros on
 * storage outage.
 */
export function getPlayerRateLimitStatus(
  nk: Runtime.Nakama,
  userId: string
): {
  activeMatches: number;
  abandonCount: number;
  lastMatchAction?: string;
} {
  const read = readStoredRecord<StoredMatchRecord>(nk, matchKey(userId));
  if (!read.ok || !isCurrent(read.record)) {
    return { activeMatches: 0, abandonCount: 0 };
  }
  const tracking = read.record;
  const activeMatches = pruneActiveMatches(tracking.activeMatches, Date.now()).length;

  let lastMatchAction: string | undefined;
  const latest = Math.max(
    tracking.lastCompleteTime,
    tracking.lastCreateTime,
    tracking.lastAcceptTime,
    tracking.lastAbandonTime
  );

  if (latest > 0) {
    if (latest === tracking.lastCompleteTime) lastMatchAction = 'complete';
    else if (latest === tracking.lastCreateTime) lastMatchAction = 'create';
    else if (latest === tracking.lastAcceptTime) lastMatchAction = 'accept';
    else if (latest === tracking.lastAbandonTime) lastMatchAction = 'abandon';
  }

  return {
    activeMatches,
    abandonCount: tracking.abandonCount,
    lastMatchAction,
  };
}

/**
 * Prune stale observability-mirror entries. Durable state needs no cleanup
 * pass: time-bounded records carry timestamps and are pruned on write.
 */
export function cleanupOldEntries(): void {
  const cutoff = Date.now() - 3600000;
  for (const mirror of [mirrorActions, mirrorMatches, mirrorTurns]) {
    for (const [userId, lastSeen] of mirror) {
      if (lastSeen < cutoff) {
        mirror.delete(userId);
      }
    }
  }
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

/**
 * Reset all tracking (test hook). Bumps the reset epoch so records stored
 * under earlier epochs no longer read as current (they remain in storage
 * but are ignored), and clears the observability mirrors. Never called in
 * production, which is what lets state survive restarts.
 */
export function resetRateLimiting(): void {
  currentResetId++;
  mirrorActions.clear();
  mirrorMatches.clear();
  mirrorTurns.clear();
}
