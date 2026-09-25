import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { getRedisClient } from './redis';

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

const rateLimitStore = new Map<string, RateLimitState>();

const defaultConfig: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60000,
};

const endpointConfigs: Map<string, RateLimitConfig> = new Map();
function getKey(userId: string, endpoint: string): string {
  return `${userId}:${endpoint}`;
}

function getRedisKey(userId: string, endpoint: string): string {
  return `ratelimit:${endpoint}:${userId}`;
}

function getCurrentWindowResetTime(windowMs: number): number {
  return Date.now() + windowMs;
}

export function setEndpointRateLimit(endpoint: string, config: RateLimitConfig): void {
  endpointConfigs.set(endpoint, config);
}

export function getEndpointRateLimit(endpoint: string): RateLimitConfig {
  return endpointConfigs.get(endpoint) || defaultConfig;
}

export async function checkRateLimit(userId: string, endpoint: string): Promise<RateLimitResult> {
  const config = getEndpointRateLimit(endpoint);
  const key = getKey(userId, endpoint);
  const redisKey = getRedisKey(userId, endpoint);
  const now = Date.now();

  const redis = getRedisClient();
  if (redis) {
    try {
      const windowSecs = Math.ceil(config.windowMs / 1000);
      const multi = redis.multi();
      multi.incr(redisKey);
      multi.expire(redisKey, windowSecs);
      const results = await multi.exec();
      const count = results?.[0]?.[1] as number;
      const ttl = await redis.ttl(redisKey);
      const resetTime = ttl > 0 ? Date.now() + ttl * 1000 : now + config.windowMs;

      if (count !== null && count !== undefined) {
        const remaining = Math.max(0, config.maxRequests - count);
        if (count > config.maxRequests) {
          const retryAfter = Math.ceil((resetTime - now) / 1000);
          return { allowed: false, remaining: 0, resetTime, retryAfter };
        }
        return { allowed: true, remaining: remaining - 1, resetTime };
      }
    } catch (err) {
      logger.warn('Redis rate limit check failed, falling back to in-memory: %s', String(err));
    }
  }

  let state = rateLimitStore.get(key);
  if (!state || now >= state.resetTime) {
    state = {
      count: 0,
      resetTime: getCurrentWindowResetTime(config.windowMs),
    };
    rateLimitStore.set(key, state);
  }

  const remaining = Math.max(0, config.maxRequests - state.count);
  if (state.count >= config.maxRequests) {
    const retryAfter = Math.ceil((state.resetTime - now) / 1000);
    return { allowed: false, remaining: 0, resetTime: state.resetTime, retryAfter };
  }

  state.count++;
  return { allowed: true, remaining: remaining - 1, resetTime: state.resetTime };
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

export function resetUserRateLimit(userId: string, endpoint: string): void {
  const key = getKey(userId, endpoint);
  rateLimitStore.delete(key);
  const redisKey = getRedisKey(userId, endpoint);
  const redis = getRedisClient();
  if (redis) {
    redis.del(redisKey).catch(() => {});
  }
}

export function cleanupExpiredEntries(): void {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  rateLimitStore.forEach((state, key) => {
    if (now >= state.resetTime) {
      entriesToDelete.push(key);
    }
  });

  entriesToDelete.forEach((key) => rateLimitStore.delete(key));
  updateActiveUsersCount(rateLimitStore.size);
}

if (process.env.NODE_ENV !== 'test') {
  setInterval(cleanupExpiredEntries, 60000);
}

export function getRateLimitStats(): {
  totalEntries: number;
  endpoints: Array<{ endpoint: string; activeUsers: number }>;
} {
  const endpointStats = new Map<string, Set<string>>();

  rateLimitStore.forEach((_, key) => {
    const parts = key.split(':');
    const userId = parts[0];
    const endpoint = parts.slice(1).join(':');

    if (!endpointStats.has(endpoint)) {
      endpointStats.set(endpoint, new Set());
    }
    endpointStats.get(endpoint)!.add(userId);
  });

  return {
    totalEntries: rateLimitStore.size,
    endpoints: Array.from(endpointStats.entries()).map(([endpoint, users]) => ({
      endpoint,
      activeUsers: users.size,
    })),
  };
}

export async function createRateLimitedRpcHandler(
  endpoint: string,
  handler: (
    ctx: Runtime.Context,
    logger: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
  ) => string | Promise<string>
): Promise<(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => Promise<string>> {
  return async function (
    ctx: Runtime.Context,
    loggerParam: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
  ): Promise<string> {
    const userId = ctx.userId || 'anonymous';

    const rateLimitResult = await checkRateLimit(userId, endpoint);

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

    const result = await handler(ctx, loggerParam, nk, payload);
    if (typeof result !== 'string') {
      throw new Error(
        `RPC ${endpoint} returned a non-string result`
      );
    }
    return result;
  };
}
