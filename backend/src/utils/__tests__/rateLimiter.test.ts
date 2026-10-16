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

/**
 * Stateful in-memory storage backing so the durable rate-limit counter
 * behaves like Nakama storage across instances (SEC-004). Two mocks built
 * on the SAME `records` map simulate two Nakama pods sharing a backend.
 */
const createStorageNk = (sharedRecords?: Map<string, { value: string; version: string }>) => {
  const records = sharedRecords ?? new Map<string, { value: string; version: string }>();
  const storageRead = jest.fn((objects: { collection: string; key: string }[]) =>
    objects
      .map((obj) => {
        const record = records.get(`${obj.collection}:${obj.key}`);
        if (!record) return null;
        return {
          collection: obj.collection,
          key: obj.key,
          userId: '',
          value: record.value,
          version: record.version,
          permissionRead: 0,
          permissionWrite: 0,
          createTime: 0,
          updateTime: 0,
        };
      })
      .filter(Boolean)
  );
  const storageWrite = jest.fn(
    (objects: { collection: string; key: string; value: unknown; version?: string }[]) => {
      objects.forEach((obj) => {
        const mapKey = `${obj.collection}:${obj.key}`;
        // Nakama OCC: '*' is create-only-if-absent; a specific version must
        // match the stored one.
        if (obj.version === '*' && records.has(mapKey)) {
          throw new Error('Storage write rejected - version check failed');
        }
        if (obj.version && obj.version !== '*') {
          const current = records.get(mapKey);
          if (!current || current.version !== obj.version) {
            throw new Error('Storage write rejected - version check failed');
          }
        }
        const normalized = typeof obj.value === 'string' ? obj.value : JSON.stringify(obj.value);
        records.set(mapKey, { value: normalized, version: String(Date.now()) });
      });
      return [];
    }
  );
  const storageDelete = jest.fn((objects: { collection: string; key: string }[]) => {
    objects.forEach((obj) => records.delete(`${obj.collection}:${obj.key}`));
  });
  return { records, nk: { storageRead, storageWrite, storageDelete } as any, storageWrite };
};

describe('RateLimiter', () => {
  let nk: any;
  let records: Map<string, { value: string; version: string }>;
  beforeEach(() => {
    ({ nk, records } = createStorageNk());
    resetUserRateLimit(nk, 'test-user', 'test-endpoint');
    resetUserRateLimit(nk, 'another-user', 'test-endpoint');
    resetUserRateLimit(nk, 'test-user', 'other-endpoint');
  });

  test('should allow requests within limit', () => {
    setEndpointRateLimit('test-endpoint', {
      maxRequests: 5,
      windowMs: 60000,
    });

    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(nk, 'test-user', 'test-endpoint');
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
      checkRateLimit(nk, 'test-user', 'test-endpoint');
    }

    const blockedResult = checkRateLimit(nk, 'test-user', 'test-endpoint');
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

    checkRateLimit(nk, 'test-user', 'test-endpoint');
    checkRateLimit(nk, 'another-user', 'test-endpoint');

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

    checkRateLimit(nk, 'test-user', 'test-endpoint');
    checkRateLimit(nk, 'test-user', 'test-endpoint');

    let result = checkRateLimit(nk, 'test-user', 'test-endpoint');
    expect(result.allowed).toBe(false);

    resetUserRateLimit(nk, 'test-user', 'test-endpoint');
    result = checkRateLimit(nk, 'test-user', 'test-endpoint');
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

    checkRateLimit(nk, 'user', 'endpoint-a');
    checkRateLimit(nk, 'user', 'endpoint-a');
    const blockedA = checkRateLimit(nk, 'user', 'endpoint-a');
    expect(blockedA.allowed).toBe(false);

    const allowedB = checkRateLimit(nk, 'user', 'endpoint-b');
    expect(allowedB.allowed).toBe(true);
  });

  test('should track different users independently', () => {
    setEndpointRateLimit('shared-endpoint', { maxRequests: 1, windowMs: 60000 });

    const user1Result = checkRateLimit(nk, 'user1', 'shared-endpoint');
    expect(user1Result.allowed).toBe(true);

    const user2Result = checkRateLimit(nk, 'user2', 'shared-endpoint');
    expect(user2Result.allowed).toBe(true);

    const user1Blocked = checkRateLimit(nk, 'user1', 'shared-endpoint');
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
    const result = checkRateLimit(nk, 'any-user', 'zero-limit');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('should handle large maxRequests', () => {
    setEndpointRateLimit('high-limit', { maxRequests: 10000, windowMs: 60000 });
    for (let i = 0; i < 100; i++) {
      const result = checkRateLimit(nk, 'user', 'high-limit');
      expect(result.allowed).toBe(true);
    }
  });

  test('resetTime should be in the future', () => {
    setEndpointRateLimit('future-endpoint', { maxRequests: 5, windowMs: 60000 });
    const result = checkRateLimit(nk, 'user', 'future-endpoint');
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });
});

describe('createRateLimitedRpcHandler', () => {
  let nk: any;
  beforeEach(() => {
    ({ nk } = createStorageNk());
    resetUserRateLimit(nk, 'rpc-user', 'rate-limited-rpc');
  });

  test('should allow handler execution within limit', async () => {
    setEndpointRateLimit('rate-limited-rpc', { maxRequests: 5, windowMs: 60000 });

    const handler = jest.fn().mockReturnValue('{"result":"ok"}');
    const wrapped = createRateLimitedRpcHandler('rate-limited-rpc', handler);

    const mockCtx = { userId: 'rpc-user' } as any;
    const mockLogger = {} as any;
    const mockNk = nk;

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
    const mockNk = nk;

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
    const mockNk = nk;

    const result = await wrapped(mockCtx, mockLogger, mockNk, '{}');
    expect(result).toBe('{"ok":true}');
  });

  test('should reject async handlers with a clear error (ADR-0008)', () => {
    // Nakama 3.21's goja runtime has no promise-job scheduler: a handler
    // returning a Promise surfaces to clients as an opaque 500
    // ('Runtime function returned invalid data'). The wrapper now fails
    // fast with an actionable error instead (ADR-0008).
    setEndpointRateLimit('async-rpc', { maxRequests: 5, windowMs: 60000 });

    const handler = async () => {
      await new Promise((r) => setTimeout(r, 1));
      return '{"async":true}';
    };
    const wrapped = createRateLimitedRpcHandler('async-rpc', handler);

    const mockCtx = { userId: 'async-user' } as any;
    const mockLogger = {} as any;
    const mockNk = nk;

    expect(() => wrapped(mockCtx, mockLogger, mockNk, '{}')).toThrow(
      /async handlers are unsupported by the Nakama JS runtime/
    );
  });
});

describe('SEC-004: distributed rate limiting (issue #1301)', () => {
  test('counter is shared across instances (two pods, one backend)', () => {
    const shared = createStorageNk();
    const podA = shared.nk;
    const podB = createStorageNk(shared.records).nk;

    setEndpointRateLimit('shared-pod-endpoint', { maxRequests: 3, windowMs: 60000 });

    expect(checkRateLimit(podA, 'attacker', 'shared-pod-endpoint').allowed).toBe(true);
    expect(checkRateLimit(podB, 'attacker', 'shared-pod-endpoint').allowed).toBe(true);
    expect(checkRateLimit(podA, 'attacker', 'shared-pod-endpoint').allowed).toBe(true);
    // The fourth request exceeds maxRequests=3 across BOTH pods - the old
    // in-memory Map would have allowed 3 per pod (6 total).
    const blocked = checkRateLimit(podB, 'attacker', 'shared-pod-endpoint');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  test('retries a CAS conflict and still converges on a single shared count', () => {
    const { nk, records, storageWrite } = createStorageNk();
    setEndpointRateLimit('cas-endpoint', { maxRequests: 10, windowMs: 60000 });

    // First check establishes the record.
    expect(checkRateLimit(nk, 'cas-user', 'cas-endpoint').allowed).toBe(true);

    // Force exactly one version conflict on the next write.
    let sabotaged = false;
    storageWrite.mockImplementation((objects: any[]) => {
      if (!sabotaged && objects[0]?.version && objects[0].version !== '*') {
        sabotaged = true;
        throw new Error('Storage write rejected - version check failed');
      }
      objects.forEach((obj: any) => {
        records.set(`${obj.collection}:${obj.key}`, {
          value: typeof obj.value === 'string' ? obj.value : JSON.stringify(obj.value),
          version: String(Date.now()) + 'x',
        });
      });
      return [];
    });

    const result = checkRateLimit(nk, 'cas-user', 'cas-endpoint');
    expect(result.allowed).toBe(true);
    expect(sabotaged).toBe(true); // the conflict path really ran
  });

  test('fails open with a loud log when storage errors (availability during outage)', () => {
    const { nk, storageWrite } = createStorageNk();
    setEndpointRateLimit('outage-endpoint', { maxRequests: 1, windowMs: 60000 });
    storageWrite.mockImplementation(() => {
      throw new Error('connection refused');
    });

    const result = checkRateLimit(nk, 'outage-user', 'outage-endpoint');
    expect(result.allowed).toBe(true);
    const { logger } = require('../../config/logger');
    expect(logger.error).toHaveBeenCalled();
  });
});
