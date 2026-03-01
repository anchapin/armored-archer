import { 
  setEndpointRateLimit, 
  checkRateLimit, 
  resetUserRateLimit,
  getRateLimitStats 
} from '../rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    resetUserRateLimit('test-user', 'test-endpoint');
  });

  test('should allow requests within limit', () => {
    setEndpointRateLimit('test-endpoint', {
      maxRequests: 5,
      windowMs: 60000
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
      windowMs: 60000
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
      windowMs: 60000
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
      windowMs: 60000
    });

    checkRateLimit('test-user', 'test-endpoint');
    checkRateLimit('test-user', 'test-endpoint');

    let result = checkRateLimit('test-user', 'test-endpoint');
    expect(result.allowed).toBe(false);

    resetUserRateLimit('test-user', 'test-endpoint');
    result = checkRateLimit('test-user', 'test-endpoint');
    expect(result.allowed).toBe(true);
  });
});
