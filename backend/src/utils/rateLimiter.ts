import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { toStorageValue, getStorageRawValue } from './storage-helpers';

let recordRateLimitViolation: (endpoint: string) => void = () => {};
let updateActiveUsersCount: (count: number) => void = () => {};

export function setMetricsCallbacks(
  recordViolation: (endpoint: string) => void,
  updateUsers: (count: number) => void
): void {
  recordRateLimitViolation = recordViolation;
  updateActiveUsersCount = updateUsers;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitEndpoint {
  endpoint: string;
  config: RateLimitConfig;
}

export interface RateLimitState {
  count: number;
  resetTime: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * SEC-004 (issue #1301): the authoritative rate-limit counter is durable
 * Nakama storage, shared by every Nakama instance. The previous in-memory
 * Map let a client bypass limits under horizontal scaling - each instance
 * kept its own counter at zero.
 *
 * Redis INCR/EXPIRE (the issue's suggested backend) is unreachable from
 * the goja runtime: no microtask queue, no promise-based ioredis
 * (ADR-0008). Storage with optimistic-concurrency writes is the
 * sanctioned sync substitute - the same single-winner semantics Redis
 * INCR would give, at the cost of one storage read + one write per
 * rate-limited RPC.
 */
const RATE_LIMIT_COLLECTION = 'rate_limits';

/** Max CAS attempts before a contended check denies the request. */
const RATE_LIMIT_CAS_ATTEMPTS = 3;

/**
 * In-memory mirror for OBSERVABILITY ONLY (getRateLimitStats and the
 * active-users gauge). It is never consulted for allow/deny decisions -
 * the durable counter is the only gate, so this mirror cannot reintroduce
 * the per-instance bypass.
 */
const rateLimitStatsMirror = new Map<string, RateLimitState>();

const defaultConfig: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60000,
};

const endpointConfigs: Map<string, RateLimitConfig> = new Map();
function getKey(userId: string, endpoint: string): string {
  return `${userId}:${endpoint}`;
}

export function setEndpointRateLimit(endpoint: string, config: RateLimitConfig): void {
  endpointConfigs.set(endpoint, config);
}

export function getEndpointRateLimit(endpoint: string): RateLimitConfig {
  return endpointConfigs.get(endpoint) || defaultConfig;
}

interface StoredRateLimitRecord {
  count?: number;
  reset_time?: number;
}

function mirrorStats(key: string, state: RateLimitState): void {
  rateLimitStatsMirror.set(key, state);
  updateActiveUsersCount(rateLimitStatsMirror.size);
}

function allowOnStorageOutage(config: RateLimitConfig, now: number): RateLimitResult {
  return { allowed: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs };
}

type CounterRead = { ok: true; record?: StoredRateLimitRecord; version?: string } | { ok: false };

function readStoredCounter(nk: Runtime.Nakama, key: string): CounterRead {
  try {
    const objects = nk.storageRead([{ collection: RATE_LIMIT_COLLECTION, key, userId: '' }]);
    if (objects.length === 0) {
      return { ok: true };
    }
    const parsed = JSON.parse(
      getStorageRawValue(objects[0].value) ?? '{}'
    ) as StoredRateLimitRecord;
    const record = typeof parsed === 'object' && parsed !== null ? parsed : undefined;
    return { ok: true, record, version: objects[0].version };
  } catch (e) {
    // Storage outage: the caller fails OPEN for availability (every other
    // RPC dependency on storage fails in that state anyway); log loudly so
    // the gap is observable.
    logger.error('Rate limit storage read failed for %s - allowing request: %s', key, e);
    return { ok: false };
  }
}

function writeCounter(
  nk: Runtime.Nakama,
  key: string,
  next: RateLimitState,
  version: string | undefined
): 'ok' | 'retry' | 'error' {
  try {
    nk.storageWrite([
      {
        collection: RATE_LIMIT_COLLECTION,
        key,
        userId: '',
        value: toStorageValue({ count: next.count, reset_time: next.resetTime }),
        version: version ?? '*',
        permissionRead: 0,
        permissionWrite: 0,
      },
    ]);
    return 'ok';
  } catch (e) {
    const msg = String(e).toLowerCase();
    if (msg.includes('version check failed') || msg.includes('storage write rejected')) {
      return 'retry'; // lost the CAS race - re-read and try again
    }
    logger.error('Rate limit storage write failed for %s - allowing request: %s', key, e);
    return 'error';
  }
}

/**
 * One read + CAS-write attempt against the durable counter. Returns the
 * terminal RateLimitResult, or 'retry' when the write lost the OCC race.
 */
function attemptCasIncrement(
  nk: Runtime.Nakama,
  key: string,
  config: RateLimitConfig,
  now: number
): RateLimitResult | 'retry' {
  const read = readStoredCounter(nk, key);
  if (!read.ok) {
    return allowOnStorageOutage(config, now);
  }

  const { record, version } = read;
  const windowExpired =
    !record || typeof record.reset_time !== 'number' || now >= record.reset_time;
  const count = windowExpired || !record ? 0 : (record.count ?? 0);
  const resetTime =
    windowExpired || !record ? now + config.windowMs : (record.reset_time as number);

  if (count >= config.maxRequests) {
    mirrorStats(key, { count, resetTime });
    return {
      allowed: false,
      remaining: 0,
      resetTime,
      retryAfter: Math.ceil((resetTime - now) / 1000),
    };
  }

  const next: RateLimitState = { count: count + 1, resetTime };
  const outcome = writeCounter(nk, key, next, version);
  if (outcome === 'retry') {
    return 'retry';
  }
  if (outcome === 'error') {
    return allowOnStorageOutage(config, now);
  }
  mirrorStats(key, next);
  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - next.count),
    resetTime,
  };
}

export function checkRateLimit(
  nk: Runtime.Nakama,
  userId: string,
  endpoint: string
): RateLimitResult {
  const config = getEndpointRateLimit(endpoint);
  const key = getKey(userId, endpoint);
  const now = Date.now();

  for (let attempt = 0; attempt < RATE_LIMIT_CAS_ATTEMPTS; attempt++) {
    const result = attemptCasIncrement(nk, key, config, now);
    if (result !== 'retry') {
      return result;
    }
  }

  // CAS contention exhausted: deny (fail closed). A legitimate client
  // retrying in a moment succeeds; an attacker hammering one key keeps
  // losing.
  logger.warn('Rate limit CAS contention exhausted for %s - denying request', key);
  const retryAfter = Math.ceil(config.windowMs / 1000);
  return { allowed: false, remaining: 0, resetTime: now + config.windowMs, retryAfter };
}

export function logRateLimitViolation(endpoint: string, userId: string, retryAfter: number): void {
  logger.warn('Rate limit violation', {
    endpoint,
    userId,
    retryAfter,
    timestamp: Date.now(),
  });

  recordRateLimitViolation(endpoint);
}

export function resetUserRateLimit(
  nk: Runtime.Nakama | null,
  userId: string,
  endpoint: string
): void {
  const key = getKey(userId, endpoint);
  rateLimitStatsMirror.delete(key);
  if (nk) {
    try {
      nk.storageDelete([{ collection: RATE_LIMIT_COLLECTION, key, userId: '' }]);
    } catch {
      // Ignore delete errors (record may not exist)
    }
  }
}

export function cleanupExpiredEntries(): void {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  rateLimitStatsMirror.forEach((state, key) => {
    if (now >= state.resetTime) {
      entriesToDelete.push(key);
    }
  });

  entriesToDelete.forEach((key) => rateLimitStatsMirror.delete(key));

  updateActiveUsersCount(rateLimitStatsMirror.size);
}

// Only create cleanup interval in production, not during tests
if (process.env.NODE_ENV !== 'test') {
  setInterval(cleanupExpiredEntries, 60000);
}

export function getRateLimitStats(): {
  totalEntries: number;
  endpoints: Array<{ endpoint: string; activeUsers: number }>;
} {
  const endpointStats = new Map<string, Set<string>>();

  rateLimitStatsMirror.forEach((_, key) => {
    const [, endpoint] = key.split(':');
    const userId = key.split(':')[0];

    if (!endpointStats.has(endpoint)) {
      endpointStats.set(endpoint, new Set());
    }
    endpointStats.get(endpoint)!.add(userId);
  });

  return {
    totalEntries: rateLimitStatsMirror.size,
    endpoints: Array.from(endpointStats.entries()).map(([endpoint, users]) => ({
      endpoint,
      activeUsers: users.size,
    })),
  };
}

export function createRateLimitedRpcHandler(
  endpoint: string,
  handler: (
    ctx: Runtime.Context,
    logger: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
  ) => string | Promise<string>
): (
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => string | Promise<string> {
  // SYNC on purpose: Nakama 3.21's goja runtime has no promise-job
  // scheduler, so an async handler returns a pending Promise that Nakama
  // rejects ('Runtime function returned invalid data'). The wrap adds no
  // awaits — keep the registered handler synchronous (ADR-0008).
  return function (
    ctx: Runtime.Context,
    loggerParam: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
  ): string {
    const userId = ctx.userId || 'anonymous';

    const rateLimitResult = checkRateLimit(nk, userId, endpoint);

    if (!rateLimitResult.allowed) {
      logRateLimitViolation(endpoint, userId, rateLimitResult.retryAfter || 0);

      return JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
          resetTime: rateLimitResult.resetTime,
        },
      });
    }

    const result = handler(ctx, loggerParam, nk, payload);
    if (typeof result !== 'string') {
      throw new Error(
        `RPC ${endpoint} returned a non-string result; async handlers are ` +
          'unsupported by the Nakama JS runtime (ADR-0008)'
      );
    }
    return result;
  };
}
