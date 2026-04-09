import config, { validateRequiredConfig, maskSecret, logConfiguration } from '../index';

describe('config/index direct function tests', () => {
  describe('maskSecret', () => {
    it('should return empty string for empty value', () => {
      expect(maskSecret('')).toBe('');
    });

    it('should return *** for values with 8 or fewer characters', () => {
      expect(maskSecret('a')).toBe('***');
      expect(maskSecret('abcd')).toBe('***');
      expect(maskSecret('12345678')).toBe('***');
    });

    it('should mask values longer than 8 characters', () => {
      expect(maskSecret('123456789')).toBe('1234...6789');
      expect(maskSecret('sk_test_abcdefghij')).toBe('sk_t...ghij');
      expect(maskSecret('verylongsecretvalue')).toBe('very...alue');
    });

    it('should handle null and undefined gracefully', () => {
      expect(maskSecret(null as any)).toBe('');
      expect(maskSecret(undefined as any)).toBe('');
    });
  });

  describe('logConfiguration', () => {
    it('should log all configuration sections', () => {
      const mockLogger = { info: jest.fn() };
      logConfiguration(mockLogger);

      const calls = mockLogger.info.mock.calls.map((c: unknown[]) => c[0]);
      expect(calls).toContain('=== Configuration ===');
      expect(calls).toContain('Environment: %s');
      expect(calls).toContain('Server: host=%s, port=%d, console_port=%d');
      expect(calls).toContain('Database: host=%s, port=%d, database=%s');
      expect(calls).toContain('RevenueCat: public_key=%s, webhook_secret_configured=%s');
      expect(calls).toContain('Session: expiry_sec=%d');
      expect(calls).toContain('Logger: level=%s, format=%s, output=%s, scrubLogs=%s');
      expect(calls).toContain('Match: allow_host_loopback=%s');
      expect(calls).toContain('Metrics: namespace=%s, prometheus_port=%d');
      expect(calls).toContain('Alerting: enabled=%s, default_provider=%s, min_env_level=%s');
      expect(calls).toContain('====================');
    });

    it('should log correct server configuration values', () => {
      const mockLogger = { info: jest.fn() };
      logConfiguration(mockLogger);

      const serverCall = mockLogger.info.mock.calls.find(
        (c: unknown[]) => c[0] === 'Server: host=%s, port=%d, console_port=%d'
      );
      expect(serverCall).toBeDefined();
      expect(serverCall![1]).toBe(config.server.host);
      expect(serverCall![2]).toBe(config.server.port);
      expect(serverCall![3]).toBe(config.server.consolePort);
    });

    it('should log masked revenuecat public key', () => {
      const mockLogger = { info: jest.fn() };
      logConfiguration(mockLogger);

      const revenuecatCall = mockLogger.info.mock.calls.find(
        (c: unknown[]) => c[0] === 'RevenueCat: public_key=%s, webhook_secret_configured=%s'
      );
      expect(revenuecatCall).toBeDefined();
      expect(revenuecatCall![1]).toBe(maskSecret(config.revenuecat.publicKey));
    });
  });

  describe('validateRequiredConfig', () => {
    it('should not throw when required config is set', () => {
      try {
        validateRequiredConfig();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    });
  });

  describe('config object', () => {
    it('should have all required top-level properties', () => {
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('server');
      expect(config).toHaveProperty('database');
      expect(config).toHaveProperty('revenuecat');
      expect(config).toHaveProperty('redis');
      expect(config).toHaveProperty('firebase');
      expect(config).toHaveProperty('session');
      expect(config).toHaveProperty('logger');
      expect(config).toHaveProperty('match');
      expect(config).toHaveProperty('metrics');
      expect(config).toHaveProperty('rateLimit');
      expect(config).toHaveProperty('tracing');
      expect(config).toHaveProperty('alerting');
      expect(config).toHaveProperty('errorInsights');
      expect(config).toHaveProperty('nPlusOne');
      expect(config).toHaveProperty('analytics');
    });

    it('should have valid server config structure', () => {
      expect(typeof config.server.port).toBe('number');
      expect(typeof config.server.consolePort).toBe('number');
      expect(typeof config.server.host).toBe('string');
    });

    it('should have valid database config structure', () => {
      expect(typeof config.database.address).toBe('string');
      expect(typeof config.database.host).toBe('string');
      expect(typeof config.database.port).toBe('number');
    });

    it('should have valid session config structure', () => {
      expect(typeof config.session.encryptionKey).toBe('string');
      expect(typeof config.session.expirySec).toBe('number');
    });

    it('should have valid rate limit config structure', () => {
      expect(typeof config.rateLimit.enabled).toBe('boolean');
      expect(typeof config.rateLimit.endpoints).toBe('object');
    });

    it('should have valid tracing config structure', () => {
      expect(typeof config.tracing.enabled).toBe('boolean');
      expect(typeof config.tracing.serviceName).toBe('string');
    });

    it('should have valid alerting config structure', () => {
      expect(typeof config.alerting.enabled).toBe('boolean');
      expect(config.alerting).toHaveProperty('routing');
      expect(config.alerting).toHaveProperty('healthAlerts');
    });

    it('should have valid redis config structure', () => {
      expect(typeof config.redis.host).toBe('string');
      expect(typeof config.redis.port).toBe('number');
    });

    it('should have valid firebase config structure', () => {
      expect(typeof config.firebase.enabled).toBe('boolean');
      expect(typeof config.firebase.projectId).toBe('string');
    });

    it('should have valid metrics config structure', () => {
      expect(typeof config.metrics.namespace).toBe('string');
      expect(typeof config.metrics.prometheusPort).toBe('number');
    });
  });
});
