/**
 * Log Scrubbing Module Tests
 *
 * Tests for sensitive data detection and redaction in log messages.
 */

import {
  scrubLogMessage,
  scrubObjectForLogging,
  scrubArgumentsForLogging,
  createScrubbedLogger,
  detectSensitiveData,
  validateLogSafety,
  DEFAULT_CI_CONFIG,
} from '../log_scrubbing';

describe('scrubLogMessage', () => {
  describe('password scrubbing', () => {
    it('should scrub passwords from log messages', () => {
      const result = scrubLogMessage('User login failed for user=test password=secret123');
      expect(result.scrubbed).toBe(true);
      expect(result.message).not.toContain('secret123');
      expect(result.scrubbedTypes).toContain('password');
    });

    it('should scrub password in various formats', () => {
      const result = scrubLogMessage('password: mysecretpassword');
      expect(result.scrubbed).toBe(true);
      expect(result.message).not.toContain('mysecretpassword');
    });

    it('should scrub passwd field', () => {
      const result = scrubLogMessage('passwd=password123');
      expect(result.scrubbed).toBe(true);
    });

    it('should scrub secret field', () => {
      const result = scrubLogMessage('secret=mysecretvalue');
      expect(result.scrubbed).toBe(true);
    });
  });

  describe('API key scrubbing', () => {
    it('should scrub API keys', () => {
      const result = scrubLogMessage('api_key=abc123def456ghi789');
      expect(result.scrubbed).toBe(true);
      expect(result.message).not.toContain('abc123def456ghi789');
      expect(result.scrubbedTypes).toContain('api_key');
    });

    it('should scrub apikey format', () => {
      const result = scrubLogMessage('apikey=xyz789abc123def456');
      expect(result.scrubbed).toBe(true);
    });
  });

  describe('token scrubbing', () => {
    it('should scrub JWT tokens', () => {
      const result = scrubLogMessage(
        'access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      );
      expect(result.scrubbed).toBe(true);
      expect(result.message).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(result.scrubbedTypes).toContain('access_token');
    });

    it('should scrub refresh tokens', () => {
      const result = scrubLogMessage('refresh_token=abc.def.ghi');
      expect(result.scrubbed).toBe(true);
      expect(result.scrubbedTypes).toContain('refresh_token');
    });

    it('should scrub auth tokens', () => {
      const result = scrubLogMessage('auth_token=xyz.abc123.efg');
      expect(result.scrubbed).toBe(true);
    });
  });

  describe('email scrubbing', () => {
    it('should scrub email addresses', () => {
      const result = scrubLogMessage('User email: john.doe@example.com');
      expect(result.scrubbed).toBe(true);
      expect(result.message).not.toContain('john.doe@example.com');
      expect(result.scrubbedTypes).toContain('email');
    });

    it('should respect scrubEmails option', () => {
      const result = scrubLogMessage('User email: test@example.com', { scrubEmails: false });
      expect(result.scrubbed).toBe(false);
    });
  });

  describe('IP address scrubbing', () => {
    it('should scrub IPv4 addresses', () => {
      const result = scrubLogMessage('Connection from 192.168.1.100');
      expect(result.scrubbed).toBe(true);
      expect(result.message).not.toContain('192.168.1.100');
      expect(result.scrubbedTypes).toContain('ip_address');
    });

    it('should scrub public IP addresses', () => {
      const result = scrubLogMessage('Server: 8.8.8.8');
      expect(result.scrubbed).toBe(true);
    });

    it('should respect scrubIps option', () => {
      const result = scrubLogMessage('IP: 10.0.0.1', { scrubIps: false });
      expect(result.scrubbed).toBe(false);
    });
  });

  describe('credit card scrubbing', () => {
    it('should scrub credit card numbers', () => {
      const result = scrubLogMessage('Card: 4532-1234-5678-9010');
      expect(result.scrubbed).toBe(true);
      expect(result.message).not.toContain('4532-1234-5678-9010');
      expect(result.scrubbedTypes).toContain('credit_card');
    });

    it('should scrub credit card without dashes', () => {
      const result = scrubLogMessage('Card: 4532123456789010');
      expect(result.scrubbed).toBe(true);
    });
  });

  describe('SSN scrubbing', () => {
    it('should scrub SSN', () => {
      const result = scrubLogMessage('SSN: 123-45-6789');
      expect(result.scrubbed).toBe(true);
      expect(result.scrubbedTypes).toContain('ssn');
    });

    it('should scrub SSN without dashes', () => {
      const result = scrubLogMessage('SSN: 123456789');
      expect(result.scrubbed).toBe(true);
    });
  });

  describe('phone number scrubbing', () => {
    it('should scrub phone numbers', () => {
      const result = scrubLogMessage('Phone: (555) 123-4567');
      expect(result.scrubbed).toBe(true);
      expect(result.scrubbedTypes).toContain('phone');
    });

    it('should scrub international phone numbers', () => {
      const result = scrubLogMessage('Phone: +1-555-123-4567');
      expect(result.scrubbed).toBe(true);
    });
  });

  describe('session ID scrubbing', () => {
    it('should scrub session IDs', () => {
      const result = scrubLogMessage('session_id=abc123def456789xyz');
      expect(result.scrubbed).toBe(true);
      expect(result.scrubbedTypes).toContain('session_id');
    });
  });

  describe('device ID scrubbing', () => {
    it('should scrub device IDs', () => {
      const result = scrubLogMessage('device_id=abc12345-def6-7890-abcd-ef1234567890');
      expect(result.scrubbed).toBe(true);
      expect(result.scrubbedTypes).toContain('device_id');
    });
  });

  describe('database connection string scrubbing', () => {
    it('should scrub PostgreSQL connection strings', () => {
      const result = scrubLogMessage('postgres://user:password@localhost:5432/db');
      expect(result.scrubbed).toBe(true);
      expect(result.message).not.toContain('password');
      expect(result.scrubbedTypes).toContain('db_connection');
    });

    it('should scrub MongoDB connection strings', () => {
      const result = scrubLogMessage('mongodb://admin:secret123@mongo-server:27017/gamedb');
      expect(result.scrubbed).toBe(true);
    });
  });

  describe('AWS key scrubbing', () => {
    it('should scrub AWS access keys', () => {
      const result = scrubLogMessage('AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE');
      expect(result.scrubbed).toBe(true);
      expect(result.scrubbedTypes).toContain('aws_access_key');
    });
  });

  describe('custom fields', () => {
    it('should scrub custom fields', () => {
      const result = scrubLogMessage('my_custom_field=supersecret', {
        customFields: ['my_custom_field'],
      });
      expect(result.scrubbed).toBe(true);
      expect(result.scrubbedTypes).toContain('custom:my_custom_field');
    });
  });

  describe('preserveFormat option', () => {
    it('should preserve format when enabled', () => {
      const result = scrubLogMessage('password=secret123', { preserveFormat: true });
      // The password should be replaced with a placeholder
      expect(result.message).not.toContain('secret123');
    });

    it('should completely redact when disabled', () => {
      const result = scrubLogMessage('password=secret123', { preserveFormat: false });
      expect(result.message).toBe('[REDACTED]');
    });
  });

  describe('scrubCount', () => {
    it('should count multiple scrubbed occurrences', () => {
      const result = scrubLogMessage('email=test@example.com and another email=user@test.org');
      expect(result.scrubCount).toBe(2);
    });
  });

  describe('safe messages', () => {
    it('should not modify safe messages', () => {
      const result = scrubLogMessage('User logged in successfully');
      expect(result.scrubbed).toBe(false);
      expect(result.message).toBe('User logged in successfully');
      expect(result.scrubCount).toBe(0);
    });
  });
});

describe('scrubObjectForLogging', () => {
  it('should scrub sensitive fields in objects', () => {
    const data = {
      username: 'testuser',
      password: 'secret123',
      email: 'test@example.com',
    };
    const result = scrubObjectForLogging(data);
    expect(result.password).toBe('[REDACTED]');
    expect(result.email).not.toContain('@');
    expect(result.username).toBe('testuser');
  });

  it('should recursively scrub nested objects', () => {
    const data = {
      user: {
        name: 'John',
        password: 'secret',
      },
    };
    const result = scrubObjectForLogging(data);
    expect((result.user as Record<string, unknown>).password).toBe('[REDACTED]');
  });

  it('should handle arrays', () => {
    const data = {
      users: [
        { name: 'Alice', password: 'pass1' },
        { name: 'Bob', password: 'pass2' },
      ],
    };
    const result = scrubObjectForLogging(data);
    expect((result.users as Record<string, unknown>[])[0].password).toBe('[REDACTED]');
  });

  it('should handle null values', () => {
    const data = {
      value: null,
      name: 'test',
    };
    const result = scrubObjectForLogging(data);
    expect(result.value).toBeNull();
  });

  it('should handle primitive values', () => {
    expect(scrubObjectForLogging('string')).toBe('string');
    expect(scrubObjectForLogging(123)).toBe(123);
    expect(scrubObjectForLogging(true)).toBe(true);
  });

  it('should scrub string values containing patterns', () => {
    const data = {
      description: 'My password is password=secret123 and email is test@example.com',
    };
    const result = scrubObjectForLogging(data);
    // The description string contains patterns with = format
    expect(result.description).not.toContain('secret123');
    expect(result.description).not.toContain('test@example.com');
  });

  it('should use custom fields', () => {
    const data = {
      my_custom_secret: 'secret_value',
    };
    const result = scrubObjectForLogging(data, { customFields: ['my_custom_secret'] });
    // Custom fields are scrubbed based on customFields option
    expect(result.my_custom_secret).not.toBe('secret_value');
  });
});

describe('scrubArgumentsForLogging', () => {
  it('should scrub array of mixed arguments', () => {
    const args = ['User login', { password: 'secret123' }, 'email: test@example.com'];
    const result = scrubArgumentsForLogging(args);
    expect(result[0]).toBe('User login');
    // The object should have password scrubbed
    expect((result[1] as Record<string, unknown>).password).not.toBe('secret123');
  });

  it('should handle empty arrays', () => {
    const result = scrubArgumentsForLogging([]);
    expect(result).toEqual([]);
  });

  it('should preserve non-sensitive values', () => {
    const args = ['username', 123, true, { name: 'test' }];
    const result = scrubArgumentsForLogging(args);
    expect(result).toEqual(args);
  });
});

describe('createScrubbedLogger', () => {
  it('should create a wrapped logger with scrubbing', () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const scrubbedLogger = createScrubbedLogger(mockLogger);

    scrubbedLogger.info('password: secret123');

    expect(mockLogger.info).toHaveBeenCalled();
    // Verify that secret123 is not in the logged message
    const loggedArg = mockLogger.info.mock.calls[0][0];
    expect(loggedArg).not.toContain('secret123');
  });

  it('should work with all log levels', () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const scrubbedLogger = createScrubbedLogger(mockLogger);

    scrubbedLogger.debug('api_key: abc123');
    scrubbedLogger.info('token: xyz.abc.123');
    scrubbedLogger.warn('email: test@test.com');
    scrubbedLogger.error('password: secret');

    expect(mockLogger.debug).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should apply custom options', () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const scrubbedLogger = createScrubbedLogger(mockLogger, { scrubEmails: false });

    scrubbedLogger.info('email: test@example.com');

    // Email should NOT be scrubbed due to option
    const loggedArg = mockLogger.info.mock.calls[0][0];
    expect(loggedArg).toContain('test@example.com');
  });
});

describe('detectSensitiveData', () => {
  it('should detect sensitive data in messages', () => {
    const result = detectSensitiveData('password: secret123');
    expect(result.containsSensitive).toBe(true);
    expect(result.detectedTypes).toContain('password');
  });

  it('should provide recommendations', () => {
    const result = detectSensitiveData('api_key=abc123');
    expect(result.containsSensitive).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('should return empty for safe messages', () => {
    const result = detectSensitiveData('User performed action successfully');
    expect(result.containsSensitive).toBe(false);
    expect(result.detectedTypes).toEqual([]);
  });

  it('should detect multiple types', () => {
    const result = detectSensitiveData('email: test@test.com password: secret');
    expect(result.containsSensitive).toBe(true);
    expect(result.detectedTypes).toContain('email');
    expect(result.detectedTypes).toContain('password');
  });
});

describe('validateLogSafety', () => {
  it('should mark unsafe messages as unsafe', () => {
    const result = validateLogSafety('password=secret123');
    expect(result.safe).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('should mark safe messages as safe', () => {
    const result = validateLogSafety('User logged in');
    expect(result.safe).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('should provide scrubbed version when unsafe', () => {
    const result = validateLogSafety('password=secret123', {
      customFields: ['custom'],
    });
    expect(result.scrubbedMessage).not.toContain('secret123');
  });
});

describe('DEFAULT_CI_CONFIG', () => {
  it('should have required configuration properties', () => {
    expect(DEFAULT_CI_CONFIG.failOnSensitive).toBe(true);
    expect(DEFAULT_CI_CONFIG.filePatterns).toBeDefined();
    expect(Array.isArray(DEFAULT_CI_CONFIG.filePatterns)).toBe(true);
  });
});
