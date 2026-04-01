/**
 * Jest setup file - runs before test environment is set up
 * Clear environment variables to ensure tests start with clean state
 */

// Clear all database-related environment variables before any modules load
const dbVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DATABASE_ADDRESS',
  'NAKAMA_DATABASE_ADDRESS',
];

for (const varName of dbVars) {
  delete process.env[varName];
}

// Set test environment
process.env.NODE_ENV = 'test';
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
