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

// Global Circuit Breaker mock
jest.mock('./src/utils/circuitBreaker', () => ({
  withCircuitBreaker: jest.fn((serviceName, fn, fallback) => {
    if (serviceName === 'revenuecat') {
      // For RevenueCat validation in tests, we want it to succeed by default
      // but we need to return the expected structure
      return fn().catch(err => {
        if (fallback) return fallback();
        throw err;
      });
    }
    return fn();
  }),
}), { virtual: true });
jest.mock('./src/utils/redis', () => ({
  getRedis: jest.fn(() => ({
    sismember: jest.fn().mockResolvedValue(0),
    sadd: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue(undefined),
  })),
  closeRedis: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });
