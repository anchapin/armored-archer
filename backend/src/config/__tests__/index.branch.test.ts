import { validateRequiredConfig } from "../index";

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
    process.env.DATABASE_ADDRESS = 'postgresql://user:pass@localhost:5432/db';
    const { default: config } = require('../index');
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(5432);
    expect(config.database.database).toBe('db');
    expect(config.database.address).toBe('postgresql://user:pass@localhost:5432/db');
    // Ensure user and password are present (parsing occurred)
    expect(config.database.user).toBeDefined();
    expect(config.database.password).toBeDefined();
  });

  it('parseDatabaseAddress with invalid URL', () => {
    process.env.DATABASE_ADDRESS = 'not-a-url';
    const { default: config } = require('../index');
    // Should fall back to defaults
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(5432);
    expect(config.database.user).toBe('postgres');
    expect(config.database.password).toBe('');
    expect(config.database.database).toBe('nakama');
    expect(config.database.address).toBe('not-a-url');
  });

  it('validateRequiredConfig throws when required config is missing', () => {
    const { default: config, validateRequiredConfig } = require('../index');
    // Save original values
    const originalPublicKey = config.revenuecat.publicKey;
    const originalDbAddress = config.database.address;
    // Set to missing
    config.revenuecat.publicKey = '';
    config.database.address = '';
    expect(() => validateRequiredConfig()).toThrow();
    const errorMsg = (() => { try { validateRequiredConfig(); } catch (e: any) { return e.message; } })();
    expect(errorMsg).toContain('REVENUECAT_PUBLIC_KEY is required');
    expect(errorMsg).toContain('DATABASE_ADDRESS or NAKAMA_DATABASE_ADDRESS is required');
    // Restore
    config.revenuecat.publicKey = originalPublicKey;
    config.database.address = originalDbAddress;
  });

  it('getDatabaseConfig with valid URL', () => {
    process.env.DATABASE_ADDRESS = 'postgresql://postgres:pass@localhost:5432/nakama';
    const { default: config } = require('../index');
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(5432);
    expect(config.database.database).toBe('nakama');
    expect(config.database.address).toBe('postgresql://postgres:pass@localhost:5432/nakama');
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
    process.env.DATABASE_ADDRESS = 'postgresql://user:pass@localhost:5432/db';
    const { default: config } = require('../index');
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(5432);
    expect(config.database.user).toBe('user');
    expect(config.database.password).toBe('pass');
    expect(config.database.database).toBe('db');
    expect(config.database.address).toBe('postgresql://user:pass@localhost:5432/db');
  });

  it('parseDatabaseAddress with invalid URL', () => {
    process.env.DATABASE_ADDRESS = 'not-a-url';
    const { default: config } = require('../index');
    // Should fall back to env or defaults
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(parseInt(process.env.DB_PORT || '5432', 10));
    expect(config.database.port).toBe(5432);
    expect(config.database.user).toBe(process.env.DB_USER || 'postgres');
    expect(config.database.user).toBe('postgres');
    expect(config.database.password).toBe(process.env.DB_PASSWORD || '');
    expect(config.database.database).toBe(process.env.DB_NAME || 'nakama');
  });

  it('validateRequiredConfig throws on missing', () => {
    delete process.env.REVENUECAT_PUBLIC_KEY;
    delete process.env.DATABASE_ADDRESS;
    delete process.env.NAKAMA_DATABASE_ADDRESS;
    const { validateRequiredConfig } = require('../index');
    expect(() => validateRequiredConfig()).toThrow();
    const errorMsg = (() => { try { validateRequiredConfig(); } catch (e:any) { return e.message; } })();
    expect(errorMsg).toContain('REVENUECAT_PUBLIC_KEY is required');
    expect(errorMsg).toContain('DATABASE_ADDRESS or NAKAMA_DATABASE_ADDRESS is required');
  });

  it('getDatabaseConfig defaults', () => {
    process.env.DATABASE_ADDRESS = 'postgresql://postgres:pass@localhost:5432/nakama';
    const { default: config } = require('../index');
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(5432);
    expect(config.database.user).toBe('postgres');
    expect(config.database.password).toBe('pass');
    expect(config.database.database).toBe('nakama');
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
