import {
  setEndpointRateLimit,
  checkRateLimit,
  resetUserRateLimit,
  getRateLimitStats,
  getEndpointRateLimit,
  logRateLimitViolation,
  cleanupExpiredEntries,
  setMetricsCallbacks,
  createRateLimitedRpcHandler,
} from '../rateLimiter';

jest.mock('../../config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

describe('RateLimiter', () => {
  beforeEach(() => {
    resetUserRateLimit('test-user', 'test-endpoint');
    resetUserRateLimit('another-user', 'test-endpoint');
    resetUserRateLimit('test-user', 'other-endpoint');
  });

  test('should allow requests within limit', () => {
    setEndpointRateLimit('test-endpoint', {
      maxRequests: 5,
      windowMs: 60000,
    });

    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit('test-user', 'test-endpoint');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  test('should block requests exceeding limit', () => {
    setEndpointRateLimit('test-endpoint', {
      maxRequests: 3,
      windowMs: 60000,
    });

    for (let i = 0; i < 3; i++) {
      checkRateLimit('test-user', 'test-endpoint');
    }

    const blockedResult = checkRateLimit('test-user', 'test-endpoint');
    expect(blockedResult.allowed).toBe(false);
    expect(blockedResult.remaining).toBe(0);
    expect(blockedResult.retryAfter).toBeDefined();
    expect(blockedResult.retryAfter).toBeGreaterThan(0);
  });

  test('should track stats correctly', () => {
    setEndpointRateLimit('test-endpoint', {
      maxRequests: 10,
      windowMs: 60000,
    });

    checkRateLimit('test-user', 'test-endpoint');
    checkRateLimit('another-user', 'test-endpoint');

    const stats = getRateLimitStats();
    expect(stats.totalEntries).toBe(2);
    expect(stats.endpoints).toHaveLength(1);
    expect(stats.endpoints[0].endpoint).toBe('test-endpoint');
    expect(stats.endpoints[0].activeUsers).toBe(2);
  });

  test('should reset limits', () => {
    setEndpointRateLimit('test-endpoint', {
      maxRequests: 2,
      windowMs: 60000,
    });

    checkRateLimit('test-user', 'test-endpoint');
    checkRateLimit('test-user', 'test-endpoint');

    let result = checkRateLimit('test-user', 'test-endpoint');
    expect(result.allowed).toBe(false);

    resetUserRateLimit('test-user', 'test-endpoint');
    result = checkRateLimit('test-user', 'test-endpoint');
    expect(result.allowed).toBe(true);
  });

  test('getEndpointRateLimit should return default when not configured', () => {
    const config = getEndpointRateLimit('unknown-endpoint');
    expect(config.maxRequests).toBe(100);
    expect(config.windowMs).toBe(60000);
  });

  test('getEndpointRateLimit should return configured value', () => {
    setEndpointRateLimit('custom-endpoint', { maxRequests: 10, windowMs: 30000 });
    const config = getEndpointRateLimit('custom-endpoint');
    expect(config.maxRequests).toBe(10);
    expect(config.windowMs).toBe(30000);
  });

  test('should track different endpoints independently', () => {
    setEndpointRateLimit('endpoint-a', { maxRequests: 2, windowMs: 60000 });
    setEndpointRateLimit('endpoint-b', { maxRequests: 3, windowMs: 60000 });

    checkRateLimit('user', 'endpoint-a');
    checkRateLimit('user', 'endpoint-a');
    const blockedA = checkRateLimit('user', 'endpoint-a');
    expect(blockedA.allowed).toBe(false);

    const allowedB = checkRateLimit('user', 'endpoint-b');
    expect(allowedB.allowed).toBe(true);
  });

  test('should track different users independently', () => {
    setEndpointRateLimit('shared-endpoint', { maxRequests: 1, windowMs: 60000 });

    const user1Result = checkRateLimit('user1', 'shared-endpoint');
    expect(user1Result.allowed).toBe(true);

    const user2Result = checkRateLimit('user2', 'shared-endpoint');
    expect(user2Result.allowed).toBe(true);

    const user1Blocked = checkRateLimit('user1', 'shared-endpoint');
    expect(user1Blocked.allowed).toBe(false);
  });

  test('logRateLimitViolation should not throw', () => {
    expect(() => logRateLimitViolation('test-endpoint', 'user-123', 30)).not.toThrow();
  });

  test('cleanupExpiredEntries should not throw', () => {
    expect(() => cleanupExpiredEntries()).not.toThrow();
  });

  test('setMetricsCallbacks should not throw', () => {
    expect(() =>
      setMetricsCallbacks(
        () => {},
        () => {}
      )
    ).not.toThrow();
  });

  test('should handle zero maxRequests', () => {
    setEndpointRateLimit('zero-limit', { maxRequests: 0, windowMs: 60000 });
    const result = checkRateLimit('any-user', 'zero-limit');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('should handle large maxRequests', () => {
    setEndpointRateLimit('high-limit', { maxRequests: 10000, windowMs: 60000 });
    for (let i = 0; i < 100; i++) {
      const result = checkRateLimit('user', 'high-limit');
      expect(result.allowed).toBe(true);
    }
  });

  test('resetTime should be in the future', () => {
    setEndpointRateLimit('future-endpoint', { maxRequests: 5, windowMs: 60000 });
    const result = checkRateLimit('user', 'future-endpoint');
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });
});

describe('createRateLimitedRpcHandler', () => {
  beforeEach(() => {
    resetUserRateLimit('rpc-user', 'rate-limited-rpc');
  });

  test('should allow handler execution within limit', async () => {
    setEndpointRateLimit('rate-limited-rpc', { maxRequests: 5, windowMs: 60000 });

    const handler = jest.fn().mockReturnValue('{"result":"ok"}');
    const wrapped = createRateLimitedRpcHandler('rate-limited-rpc', handler);

    const mockCtx = { userId: 'rpc-user' } as any;
    const mockLogger = {} as any;
    const mockNk = {} as any;

    const result = await wrapped(mockCtx, mockLogger, mockNk, '{}');
    expect(result).toBe('{"result":"ok"}');
    expect(handler).toHaveBeenCalled();
  });

  test('should block handler execution when rate limited', async () => {
    setEndpointRateLimit('rate-limited-rpc', { maxRequests: 1, windowMs: 60000 });

    const handler = jest.fn().mockReturnValue('{"result":"ok"}');
    const wrapped = createRateLimitedRpcHandler('rate-limited-rpc', handler);

    const mockCtx = { userId: 'rpc-user' } as any;
    const mockLogger = {} as any;
    const mockNk = {} as any;

    await wrapped(mockCtx, mockLogger, mockNk, '{}');
    const blockedResult = await wrapped(mockCtx, mockLogger, mockNk, '{}');

    const parsed = JSON.parse(blockedResult);
    expect(parsed.success).toBe(false);
    expect(parsed.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('should handle anonymous user when userId is missing', async () => {
    setEndpointRateLimit('anon-rpc', { maxRequests: 5, windowMs: 60000 });

    const handler = jest.fn().mockReturnValue('{"ok":true}');
    const wrapped = createRateLimitedRpcHandler('anon-rpc', handler);

    const mockCtx = { userId: '' } as any;
    const mockLogger = {} as any;
    const mockNk = {} as any;

    const result = await wrapped(mockCtx, mockLogger, mockNk, '{}');
    expect(result).toBe('{"ok":true}');
  });

  test('should reject async handlers with a clear error (issue #1135)', () => {
    // Nakama 3.21's goja runtime has no promise-job scheduler: a handler
    // returning a Promise surfaces to clients as an opaque 500
    // ('Runtime function returned invalid data'). The wrapper now fails
    // fast with an actionable error instead (issue #1135).
    setEndpointRateLimit('async-rpc', { maxRequests: 5, windowMs: 60000 });

    const handler = async () => {
      await new Promise((r) => setTimeout(r, 1));
      return '{"async":true}';
    };
    const wrapped = createRateLimitedRpcHandler('async-rpc', handler);

    const mockCtx = { userId: 'async-user' } as any;
    const mockLogger = {} as any;
    const mockNk = {} as any;

    expect(() => wrapped(mockCtx, mockLogger, mockNk, '{}')).toThrow(
      /async handlers are unsupported by the Nakama JS runtime/
    );
  });
});
