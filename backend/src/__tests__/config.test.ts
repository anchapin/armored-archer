/**
 * Tests for config re-exports
 */

describe('config re-exports', () => {
  it('re-exports config as named export', () => {
    const { config } = require('../config');
    expect(config).toBeDefined();
    expect(config.environment).toBeDefined();
  });

  it('re-exports validateRequiredConfig', () => {
    const { validateRequiredConfig } = require('../config');
    expect(validateRequiredConfig).toBeDefined();
    expect(typeof validateRequiredConfig).toBe('function');
  });

  it('re-exports maskSecret', () => {
    const { maskSecret } = require('../config');
    expect(maskSecret).toBeDefined();
    expect(typeof maskSecret).toBe('function');
  });

  it('re-exports logConfiguration', () => {
    const { logConfiguration } = require('../config');
    expect(logConfiguration).toBeDefined();
    expect(typeof logConfiguration).toBe('function');
  });

  it('exports type definitions', () => {
    const configModule = require('../config');
    expect(configModule).toBeDefined();
  });
});

describe('config module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('maskSecret', () => {
    it('returns empty string for empty input', () => {
      const { maskSecret } = require('../config');
      expect(maskSecret('')).toBe('');
    });

    it('returns *** for short values (<=8 chars)', () => {
      const { maskSecret } = require('../config');
      expect(maskSecret('short')).toBe('***');
      expect(maskSecret('12345678')).toBe('***');
    });

    it('masks long values showing first 4 and last 4 chars', () => {
      const { maskSecret } = require('../config');
      expect(maskSecret('abcdefghijklmnop')).toBe('abcd...mnop');
    });

    it('masks API keys appropriately', () => {
      const { maskSecret } = require('../config');
      expect(maskSecret('sk-1234567890abcdef')).toBe('sk-1...cdef');
    });
  });

  describe('logConfiguration', () => {
    it('logs configuration without throwing', () => {
      const { logConfiguration } = require('../config');
      const mockLogger = {
        info: jest.fn(),
      };
      expect(() => logConfiguration(mockLogger)).not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('=== Configuration ===');
    });

    it('logs server configuration', () => {
      const { logConfiguration } = require('../config');
      const mockLogger = { info: jest.fn() };
      logConfiguration(mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Server:'),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('logs database configuration', () => {
      const { logConfiguration } = require('../config');
      const mockLogger = { info: jest.fn() };
      logConfiguration(mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Database:'),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('logs RevenueCat configuration with masked secret', () => {
      const { logConfiguration } = require('../config');
      const mockLogger = { info: jest.fn() };
      logConfiguration(mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('RevenueCat:'),
        expect.anything(),
        expect.anything()
      );
    });

    it('logs alerting configuration', () => {
      const { logConfiguration } = require('../config');
      const mockLogger = { info: jest.fn() };
      logConfiguration(mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Alerting:'),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('validateRequiredConfig', () => {
    it('throws when RevenueCat public key is missing', () => {
      delete process.env.REVENUECAT_PUBLIC_KEY;
      delete process.env.DATABASE_ADDRESS;
      delete process.env.NAKAMA_DATABASE_ADDRESS;
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow('REVENUECAT_PUBLIC_KEY is required');
    });

    it('throws when database address is missing', () => {
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      delete process.env.DATABASE_ADDRESS;
      delete process.env.NAKAMA_DATABASE_ADDRESS;
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow('DATABASE_ADDRESS or NAKAMA_DATABASE_ADDRESS is required');
    });

    it('throws when server key is missing in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.NAKAMA_SERVER_KEY;
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      process.env.DATABASE_ADDRESS = 'postgres://user:pass@localhost:5432/nakama';
      process.env.SESSION_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.REFRESH_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.TOKEN_ENCRYPTION_KEY = 'test-key-12345678';
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow('NAKAMA_SERVER_KEY must be set in production');
    });

    it('throws when session encryption keys are missing in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.NAKAMA_SERVER_KEY = 'server-key-12345';
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      process.env.DATABASE_ADDRESS = 'postgres://user:pass@localhost:5432/nakama';
      delete process.env.SESSION_ENCRYPTION_KEY;
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow('Configuration validation failed');
    });

    it('throws when server port is invalid', () => {
      process.env.NAKAMA_PORT = '99999';
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      process.env.DATABASE_ADDRESS = 'postgres://user:pass@localhost:5432/nakama';
      process.env.SESSION_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.REFRESH_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.TOKEN_ENCRYPTION_KEY = 'test-key-12345678';
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow('Invalid server port');
    });

    it('throws when console port is invalid', () => {
      process.env.NAKAMA_CONSOLE_PORT = '99999';
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      process.env.DATABASE_ADDRESS = 'postgres://user:pass@localhost:5432/nakama';
      process.env.SESSION_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.REFRESH_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.TOKEN_ENCRYPTION_KEY = 'test-key-12345678';
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).toThrow('Invalid console port');
    });

    it('passes with valid configuration', () => {
      process.env.REVENUECAT_PUBLIC_KEY = 'pk_test_123';
      process.env.DATABASE_ADDRESS = 'postgres://user:pass@localhost:5432/nakama';
      process.env.SESSION_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.REFRESH_ENCRYPTION_KEY = 'test-key-12345678';
      process.env.TOKEN_ENCRYPTION_KEY = 'test-key-12345678';
      const { validateRequiredConfig } = require('../config');
      expect(() => validateRequiredConfig()).not.toThrow();
    });
  });
});
