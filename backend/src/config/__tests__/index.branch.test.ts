import { validateRequiredConfig } from '../index';

describe('config/index branch coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    // Set test environment to avoid loading .env.development
    process.env.NODE_ENV = 'test';
    // Clear other env vars
    delete process.env.DATABASE_ADDRESS;
    delete process.env.NAKAMA_DATABASE_ADDRESS;
    delete process.env.REVENUECAT_PUBLIC_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.NAKAMA_HOST;
    delete process.env.NAKAMA_PORT;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.REVENUECAT_SECRET_KEY;
    delete process.env.SESSION_ENCRYPTION_KEY;
    delete process.env.REFRESH_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.SESSION_EXPIRY_SEC;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FORMAT;
    delete process.env.LOG_OUTPUT;
    delete process.env.ALLOW_HOST_LOOPBACK;
    delete process.env.METRICS_NAMESPACE;
    delete process.env.METRICS_PREFIX;
    delete process.env.PROMETHEUS_PORT;
    delete process.env.RATE_LIMIT_ENABLED;
  });

  it('getEnvironment returns test when NODE_ENV=test', () => {
    process.env.NODE_ENV = 'test';
    const { default: config } = require('../index');
    expect(config.environment).toBe('test');
  });

  it('isProduction returns false in test', () => {
    process.env.NODE_ENV = 'test';
    const { default: config } = require('../index');
    expect(config.environment).toBe('test');
    expect(config.environment === 'production').toBe(false);
  });

  it('parseDatabaseAddress with postgres://', () => {
    // Fixed: The regex now properly handles postgres:// prefix
    process.env.DATABASE_ADDRESS = 'postgres://user:pass@localhost:5432/db';
    const { default: config } = require('../index');
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(5432);
    expect(config.database.database).toBe('db');
    expect(config.database.address).toBe('postgres://user:pass@localhost:5432/db');
    // Fixed: Now correctly parses user and password
    expect(config.database.user).toBe('user');
    expect(config.database.password).toBe('pass');
  });

  it('parseDatabaseAddress with invalid URL falls back to defaults', () => {
    // Note: The .env file is loaded at module initialization time, before tests run.
    // When DATABASE_ADDRESS is invalid, the regex parse fails and it falls back
    // to using the DB_* environment variables or their defaults.
    // Since .env has DB_HOST=postgres, that's what we'll get.
    process.env.DATABASE_ADDRESS = 'not-a-url';
    const { default: config } = require('../index');
    // The fallback uses DB_HOST from .env (postgres) or defaults
    // In test environment without .env, it would be 'localhost'
    expect(config.database.address).toBe('not-a-url');
    // Host falls back to DB_HOST env var or default
    expect(['localhost', 'postgres']).toContain(config.database.host);
  });

  it('validateRequiredConfig throws when required config is missing in production', () => {
    // Set production environment
    process.env.NODE_ENV = 'production';
    process.env.REVENUECAT_PUBLIC_KEY = '';
    process.env.DATABASE_ADDRESS = '';
    jest.resetModules();

    const { validateRequiredConfig } = require('../index');
    expect(() => validateRequiredConfig()).toThrow();
  });

  it('getDatabaseConfig with valid URL', () => {
    process.env.DATABASE_ADDRESS = 'postgres://postgres:pass@localhost:5432/nakama';
    const { default: config } = require('../index');
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(5432);
    expect(config.database.database).toBe('nakama');
    expect(config.database.address).toBe('postgres://postgres:pass@localhost:5432/nakama');
    // Ensure user and password are present
    expect(config.database.user).toBeDefined();
    expect(config.database.password).toBeDefined();
  });

  it('getRevenueCatConfig', () => {
    process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
    const { default: config } = require('../index');
    expect(config.revenuecat.publicKey).toBe('pk_test_123');
  });

  it('getServerConfig default', () => {
    const { default: config } = require('../index');
    expect(config.server.host).toBe('127.0.0.1');
    expect(config.server.port).toBeGreaterThan(0);
  });

  it('getConfig returns config object', () => {
    const { default: config } = require('../index');
    expect(config).toHaveProperty('server');
    expect(config).toHaveProperty('database');
    expect(config).toHaveProperty('revenuecat');
    expect(config).toHaveProperty('session');
    expect(config).toHaveProperty('logger');
    expect(config).toHaveProperty('match');
    expect(config).toHaveProperty('metrics');
    expect(config).toHaveProperty('rateLimit');
  });
});
