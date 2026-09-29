/**
 * Jest setup file - runs after the test framework is installed.
 * Clear environment variables to ensure tests start with clean state.
 *
 * NOTE on issue #1422 (anti_cheat.ts open interval handle): no global
 * NODE_ENV reset is installed here on purpose. `alerting.test.ts` (and
 * potentially other suites) deliberately sets `process.env.NODE_ENV` at
 * file scope for its whole suite; a global afterEach forcing it back to
 * 'test' breaks those suites (verified: 13 alerting failures). The reset is
 * also unnecessary: the cleanup interval is no longer created at import
 * time (see `initAntiCheatCleanup()` in `src/modules/anti_cheat.ts` — it is
 * only invoked from `InitModule` in `src/index.ts`, which no test imports),
 * and the handle is `.unref()`-ed so it can never hold the process open.
 */

// Disable src/config/index.ts `loadEnvironment()` from reading `.env` off disk
// (issue #1427). It runs at module import and backfills any *falsy* key from
// `.env`, so a developer's local file silently supplied HMAC_SECRET /
// REVENUECAT_* and flipped tests that assert behaviour when they are absent
// (4 failures with `.env` present, 0 without). Deleting the vars below alone
// is NOT enough: `loadEnvironment()` would re-add them. CI provisions no
// `.env`, which is why the coupling was invisible from CI evidence alone.
// Test results must depend only on the committed tree, never on local files.
process.env.SKIP_ENV_LOADING = 'true';

// Clear all database-related environment variables before any modules load
const dbVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DATABASE_ADDRESS',
  'NAKAMA_DATABASE_ADDRESS',
  // Secrets a developer's shell or `.env` may export: tests must exercise the
  // "not configured" path themselves instead of inheriting a real value.
  'HMAC_SECRET',
  'REVENUECAT_SECRET_KEY',
  'REVENUECAT_WEBHOOK_SECRET',
  'REVENUECAT_API_KEY',
];

for (const varName of dbVars) {
  delete process.env[varName];
}

// Set test environment
process.env.NODE_ENV = 'test';
// Assigned after the deletion above so an inherited real key can never survive.
process.env.REVENUECAT_API_KEY = 'test_api_key';

// Global fetch mock
const originalFetch = global.fetch;
global.fetch = jest.fn((url, options) => {
  const urlString = typeof url === 'string' ? url : url.url;
  
  if (urlString.includes('revenuecat.com')) {
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        status: 'active',
        valid: true,
        subscriber: {
          subscriptions: {
            'com.armoredarcher.gems.small': {
              expires_date: '2099-01-01T00:00:00Z',
            },
          },
          entitlements: {
            gems: {
              product_id: 'com.armoredarcher.gems.small',
            },
          },
        },
      })),
      json: () => Promise.resolve({
        status: 'active',
        valid: true,
        subscriber: {
          subscriptions: {
            'com.armoredarcher.gems.small': {
              expires_date: '2099-01-01T00:00:00Z',
            },
          },
          entitlements: {
            gems: {
              product_id: 'com.armoredarcher.gems.small',
            },
          },
        },
      }),
    });
  }
  
  // Fallback to original fetch for Nakama etc.
  if (originalFetch) {
    return originalFetch(url, options);
  }
  
  return Promise.reject(new Error(`Fetch not mocked for URL: ${urlString}`));
}) ;

// Global Circuit Breaker mock - mock the opossum dependency to avoid ESM issues
jest.mock('opossum', () => {
  const MockCircuitBreaker = function(fn, options) {
    this.fn = fn;
    this.options = options;
    this.opened = false;
    this.halfOpen = false;
    this._eventHandlers = {};
  };
  MockCircuitBreaker.prototype.on = jest.fn(function(event, handler) {
    if (!this._eventHandlers[event]) this._eventHandlers[event] = [];
    this._eventHandlers[event].push(handler);
    return this;
  });
  MockCircuitBreaker.prototype.emit = jest.fn(function(event, ...args) {
    const handlers = this._eventHandlers[event] || [];
    handlers.forEach(h => h(...args));
    return handlers.length > 0;
  });
  MockCircuitBreaker.prototype.fire = jest.fn().mockImplementation(async function(fn) {
    if (this.opened) {
      this.emit('reject');
      throw new Error('Circuit is open');
    }
    try {
      const result = await fn();
      this.emit('success', result, 0);
      return result;
    } catch (err) {
      this.emit('failure', err, 0);
      throw err;
    }
  });
  MockCircuitBreaker.prototype.open = jest.fn(function() {
    this.opened = true;
    this.emit('open');
  });
  MockCircuitBreaker.prototype.close = jest.fn(function() {
    this.opened = false;
    this.halfOpen = false;
    this.emit('close');
  });
  return MockCircuitBreaker;
});
jest.mock('./src/utils/redis', () => ({
  getRedis: jest.fn(() => ({
    sismember: jest.fn().mockResolvedValue(0),
    sadd: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(0),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  })),
  getRedisClient: jest.fn(() => ({
    sismember: jest.fn().mockResolvedValue(0),
    sadd: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(0),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  })),
  closeRedis: jest.fn().mockResolvedValue(undefined),
  closeRedisConnection: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });
