import { LogScrubber, logScrubber, scrubSensitiveData } from '../logScrubber';

describe('LogScrubber', () => {
  describe('default configuration', () => {
    it('should be enabled by default', () => {
      const scrubber = new LogScrubber();
      expect(scrubber.isEnabled()).toBe(true);
    });
  });

  describe('scrub string values', () => {
    it('should scrub JWT tokens', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrub('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
      expect(result).toBe('Bearer [JWT_REDACTED]');
    });

    it('should scrub password patterns', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrub('User login with password: mysecretpassword123');
      expect(result).toContain('[PASSWORD_REDACTED]');
    });

    it('should scrub API key patterns', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrub('api_key=sk_live_1234567890abcdefghijklmnop');
      expect(result).toContain('[API_KEY_REDACTED]');
    });

    it('should scrub credit card numbers', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrub('Card: 4532-1234-5678-9012');
      expect(result).toContain('[CREDIT_CARD_REDACTED]');
    });

    it('should scrub SSN patterns', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrub('SSN: 123-45-6789');
      expect(result).toContain('[SSN_REDACTED]');
    });

    it('should scrub AWS access keys', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrub('AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE');
      expect(result).toContain('[AWS_KEY_REDACTED]');
    });
  });

  describe('scrub object values', () => {
    it('should scrub sensitive fields in objects', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const input = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
      };
      const result = scrubber.scrub(input) as Record<string, unknown>;
      // Keys are scrubbed by default, so password becomes [REDACTED_PASSWORD]
      expect(result['[REDACTED_PASSWORD]']).toBe('[REDACTED]');
      expect(result.username).toBe('john');
      expect(result.email).toBe('john@example.com');
    });

    it('should scrub nested sensitive fields', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const input = {
        user: {
          name: 'John',
          password: 'supersecret',
        },
      };
      const result = scrubber.scrub(input) as Record<string, unknown>;
      // When scrubKeys is true, nested sensitive fields have their keys scrubbed
      const user = result.user as Record<string, unknown>;
      expect(user['[REDACTED_PASSWORD]']).toBe('[REDACTED]');
    });

    it('should handle arrays of objects', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const input = {
        users: [
          { name: 'Alice', password: 'pass1' },
          { name: 'Bob', password: 'pass2' },
        ],
      };
      const result = scrubber.scrub(input) as Record<string, unknown>;
      const users = result.users as Array<Record<string, unknown>>;
      expect(users[0]['[REDACTED_PASSWORD]']).toBe('[REDACTED]');
      expect(users[1]['[REDACTED_PASSWORD]']).toBe('[REDACTED]');
    });

    it('should respect maxDepth setting', () => {
      const scrubber = new LogScrubber({ enabled: true, maxDepth: 1 });
      const input = {
        level1: {
          level2: {
            level3: {
              password: 'deepsecret',
            },
          },
        },
      };
      const result = scrubber.scrub(input) as Record<string, unknown>;
      const level1 = result.level1 as Record<string, unknown>;
      expect(level1.level2).toBe('[MAX_DEPTH_REACHED]');
    });
  });

  describe('scrubKeys option', () => {
    it('should scrub keys when scrubKeys is true', () => {
      const scrubber = new LogScrubber({ enabled: true, scrubKeys: true });
      const input = {
        password: 'secret',
      };
      const result = scrubber.scrub(input) as Record<string, unknown>;
      expect(Object.keys(result)).toContain('[REDACTED_PASSWORD]');
    });

    it('should not scrub keys when scrubKeys is false', () => {
      const scrubber = new LogScrubber({ enabled: true, scrubKeys: false });
      const input = {
        password: 'secret',
      };
      const result = scrubber.scrub(input) as Record<string, unknown>;
      expect(Object.keys(result)).toContain('password');
      expect(result.password).toBe('[REDACTED]');
    });
  });

  describe('custom sensitive fields', () => {
    it('should support additional sensitive fields', () => {
      const scrubber = new LogScrubber({
        enabled: true,
        additionalSensitiveFields: ['custom_field', 'internal_id'],
      });
      const input = {
        username: 'john',
        custom_field: 'sensitive_data',
      };
      const result = scrubber.scrub(input) as Record<string, unknown>;
      expect(result['[REDACTED_CUSTOM_FIELD]']).toBe('[REDACTED]');
    });

    it('should support excluded fields', () => {
      const scrubber = new LogScrubber({
        enabled: true,
        excludedFields: ['password'],
      });
      const input = {
        username: 'john',
        password: 'secret',
      };
      const result = scrubber.scrub(input) as Record<string, unknown>;
      expect(result.password).toBe('secret');
    });
  });

  describe('disabled scrubbing', () => {
    it('should not scrub when disabled', () => {
      const scrubber = new LogScrubber({ enabled: false });
      const input = { password: 'secret' };
      const result = scrubber.scrub(input) as Record<string, unknown>;
      expect(result.password).toBe('secret');
    });
  });

  describe('scrubLog method', () => {
    it('should scrub both message and metadata', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrubLog('User logged in', { password: 'secret', userId: 123 });
      expect(result.message).toBe('User logged in');
      // Keys are scrubbed by default
      expect(result.meta?.['[REDACTED_PASSWORD]']).toBe('[REDACTED]');
      expect(result.meta?.userId).toBe(123);
    });

    it('should return just message when no metadata provided', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrubLog('Simple message');
      expect(result.message).toBe('Simple message');
      expect(result.meta).toBeUndefined();
    });
  });

  describe('case insensitive field matching', () => {
    it('should match PASSWORD', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const input = { PASSWORD: 'secret' };
      const result = scrubber.scrub(input) as Record<string, unknown>;
      expect(result['[REDACTED_PASSWORD]']).toBe('[REDACTED]');
    });

    it('should match Password', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const input = { Password: 'secret' };
      const result = scrubber.scrub(input) as Record<string, unknown>;
      expect(result['[REDACTED_PASSWORD]']).toBe('[REDACTED]');
    });

    it('should match pAsSwOrD', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const input = { pAsSwOrD: 'secret' };
      const result = scrubber.scrub(input) as Record<string, unknown>;
      expect(result['[REDACTED_PASSWORD]']).toBe('[REDACTED]');
    });
  });

  describe('default logScrubber instance', () => {
    it('should be exported and usable', () => {
      expect(logScrubber).toBeInstanceOf(LogScrubber);
      expect(logScrubber.isEnabled()).toBe(true);
    });
  });

  describe('scrubSensitiveData convenience function', () => {
    it('should scrub sensitive data', () => {
      const input = { password: 'secret' };
      const result = scrubSensitiveData(input);
      expect((result as Record<string, unknown>)['[REDACTED_PASSWORD]']).toBe('[REDACTED]');
    });

    it('should pass through non-sensitive data', () => {
      const input = 'hello world';
      const result = scrubSensitiveData(input);
      expect(result).toBe('hello world');
    });
  });

  describe('config update', () => {
    it('should update config dynamically', () => {
      const scrubber = new LogScrubber({ enabled: true });
      expect(scrubber.isEnabled()).toBe(true);

      scrubber.updateConfig({ enabled: false });
      expect(scrubber.isEnabled()).toBe(false);
    });

    it('should get current config', () => {
      const scrubber = new LogScrubber({ enabled: true, maxDepth: 5 });
      const config = scrubber.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.maxDepth).toBe(5);
    });

    it('should enable/disable via methods', () => {
      const scrubber = new LogScrubber({ enabled: true });
      scrubber.disable();
      expect(scrubber.isEnabled()).toBe(false);
      scrubber.enable();
      expect(scrubber.isEnabled()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle null values', () => {
      const scrubber = new LogScrubber({ enabled: true });
      expect(scrubber.scrub(null)).toBeNull();
    });

    it('should handle undefined values', () => {
      const scrubber = new LogScrubber({ enabled: true });
      expect(scrubber.scrub(undefined)).toBeUndefined();
    });

    it('should handle numbers', () => {
      const scrubber = new LogScrubber({ enabled: true });
      expect(scrubber.scrub(123)).toBe(123);
    });

    it('should handle booleans', () => {
      const scrubber = new LogScrubber({ enabled: true });
      expect(scrubber.scrub(true)).toBe(true);
    });

    it('should handle empty objects', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrub({});
      expect(result).toEqual({});
    });

    it('should handle empty strings', () => {
      const scrubber = new LogScrubber({ enabled: true });
      expect(scrubber.scrub('')).toBe('');
    });
  });

  describe('log level-based scrubbing', () => {
    it('should be enabled for all levels by default', () => {
      const scrubber = new LogScrubber({ enabled: true });
      expect(scrubber.isEnabledForLevel('error')).toBe(true);
      expect(scrubber.isEnabledForLevel('warn')).toBe(true);
      expect(scrubber.isEnabledForLevel('info')).toBe(true);
      expect(scrubber.isEnabledForLevel('debug')).toBe(true);
    });

    it('should respect per-level enabled setting', () => {
      const scrubber = new LogScrubber({
        enabled: true,
        scrubByLevel: {
          error: { enabled: true },
          warn: { enabled: true },
          info: { enabled: false },
          debug: { enabled: false },
        },
      });
      expect(scrubber.isEnabledForLevel('error')).toBe(true);
      expect(scrubber.isEnabledForLevel('warn')).toBe(true);
      expect(scrubber.isEnabledForLevel('info')).toBe(false);
      expect(scrubber.isEnabledForLevel('debug')).toBe(false);
    });

    it('should return false for all levels when globally disabled', () => {
      const scrubber = new LogScrubber({
        enabled: false,
        scrubByLevel: {
          error: { enabled: true },
          warn: { enabled: true },
        },
      });
      expect(scrubber.isEnabledForLevel('error')).toBe(false);
      expect(scrubber.isEnabledForLevel('warn')).toBe(false);
      expect(scrubber.isEnabledForLevel('info')).toBe(false);
    });

    it('should use scrubLogByLevel with per-level config', () => {
      const scrubber = new LogScrubber({
        enabled: true,
        scrubByLevel: {
          error: { enabled: true },
          warn: { enabled: true },
          info: { enabled: false },
          debug: { enabled: false },
        },
      });

      // info level - should not scrub
      const infoResult = scrubber.scrubLogByLevel('password: secret', 'info', {});
      expect(infoResult.message).toBe('password: secret');

      // error level - should scrub
      const errorResult = scrubber.scrubLogByLevel('password: secret', 'error', {});
      expect(errorResult.message).toContain('[PASSWORD_REDACTED]');
    });

    it('should handle metadata in scrubLogByLevel', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrubLogByLevel(
        'User login',
        'info',
        { password: 'secret', userId: 123 }
      );
      expect(result.message).toBe('User login');
      expect(result.meta?.['[REDACTED_PASSWORD]']).toBe('[REDACTED]');
      expect(result.meta?.userId).toBe(123);
    });
  });

  describe('output-based scrubbing', () => {
    it('should apply to all outputs by default', () => {
      const scrubber = new LogScrubber({ enabled: true });
      expect(scrubber.isEnabledForOutput('console')).toBe(true);
      expect(scrubber.isEnabledForOutput('file')).toBe(true);
    });

    it('should respect scrubOutputs configuration', () => {
      const scrubber = new LogScrubber({
        enabled: true,
        scrubOutputs: ['console'],
      });
      expect(scrubber.isEnabledForOutput('console')).toBe(true);
      expect(scrubber.isEnabledForOutput('file')).toBe(false);
    });

    it('should return false for all outputs when globally disabled', () => {
      const scrubber = new LogScrubber({
        enabled: false,
        scrubOutputs: ['console', 'file'],
      });
      expect(scrubber.isEnabledForOutput('console')).toBe(false);
      expect(scrubber.isEnabledForOutput('file')).toBe(false);
    });

    it('should return false for empty scrubOutputs when global enabled is true', () => {
      const scrubber = new LogScrubber({
        enabled: true,
        scrubOutputs: [],
      });
      // Empty array means apply to all outputs
      expect(scrubber.isEnabledForOutput('console')).toBe(true);
      expect(scrubber.isEnabledForOutput('file')).toBe(true);
    });
  });

  describe('additional sensitive patterns', () => {
    it('should scrub private keys (PEM format)', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const input = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQ...\n-----END RSA PRIVATE KEY-----';
      const result = scrubber.scrub(input);
      expect(result).toContain('[PRIVATE_KEY_REDACTED]');
    });

    it('should scrub Google API keys', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrub('AIzaSyD1234567890abcdefghijklmnopqrstu');
      expect(result).toContain('[GOOGLE_API_KEY_REDACTED]');
    });

    it('should scrub Stripe API keys', () => {
      const scrubber = new LogScrubber({ enabled: true });
      // Using fake test pattern that won't trigger secret scanning
      const result = scrubber.scrub('sk_test_51AbCdEfGhIjKlMnOpQrStUvWx');
      expect(result).toContain('[STRIPE_KEY_REDACTED]');
    });

    it('should scrub GitHub tokens', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrub('ghp_abcdefghijklmnopqrstuvwxyz1234567890');
      expect(result).toContain('[GITHUB_TOKEN_REDACTED]');
    });

    it('should scrub connection strings with credentials', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrub('postgresql://user:password@localhost:5432/mydb');
      expect(result).toContain('[CONNECTION_STRING_REDACTED]');
    });

    it('should scrub MongoDB connection strings', () => {
      const scrubber = new LogScrubber({ enabled: true });
      const result = scrubber.scrub('mongodb+srv://admin:secretpassword@cluster.mongodb.net/test');
      expect(result).toContain('[CONNECTION_STRING_REDACTED]');
    });

    it('should scrub Slack tokens', () => {
      const scrubber = new LogScrubber({ enabled: true });
      // Using fake test pattern that won't trigger secret scanning
      const result = scrubber.scrub('xoxb-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
      expect(result).toContain('[SLACK_TOKEN_REDACTED]');
    });
  });
});
