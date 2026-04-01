/**
 * Privacy Compliance Tests
 *
 * Tests for the privacy_compliance module ensuring PII detection,
 * data classification, and compliance validation work correctly.
 *
 * Usage: npm run test:privacy
 */

import {
  PIIType,
  SensitivityLevel,
  scanForPII,
  containsPII,
  isPII,
  classifyField,
  classifyData,
  checkPrivacyCompliance,
  anonymizePII,
  hashSensitiveData,
  redactBySensitivity,
  prepareForLogging,
  validateDataHandling,
  sanitizeForLogging,
  DetectedPII,
  DataClassification,
  PrivacyCheckResult,
} from '../privacy_compliance';

describe('Privacy Compliance Module', () => {
  describe('PII Detection', () => {
    describe('scanForPII', () => {
      it('should detect email addresses', () => {
        const text = 'Contact: user@example.com';
        const detections = scanForPII(text, [PIIType.EMAIL]);

        expect(detections).toHaveLength(1);
        expect(detections[0].type).toBe(PIIType.EMAIL);
        expect(detections[0].value).toBe('user@example.com');
      });

      it('should detect phone numbers', () => {
        const text = 'Call us at 555-123-4567';
        const detections = scanForPII(text, [PIIType.PHONE]);

        expect(detections.length).toBeGreaterThanOrEqual(1);
        expect(detections[0].type).toBe(PIIType.PHONE);
        expect(detections[0].value).toBe('555-123-4567');
      });

      it('should detect SSN patterns', () => {
        const text = 'SSN: 123-45-6789';
        const detections = scanForPII(text, [PIIType.SSN]);

        expect(detections).toHaveLength(1);
        expect(detections[0].type).toBe(PIIType.SSN);
        expect(detections[0].value).toBe('123-45-6789');
      });

      it('should detect credit card numbers', () => {
        const text = 'Card: 4111-1111-1111-1111';
        const detections = scanForPII(text, [PIIType.CREDIT_CARD]);

        expect(detections).toHaveLength(1);
        expect(detections[0].type).toBe(PIIType.CREDIT_CARD);
        expect(detections[0].value).toBe('4111-1111-1111-1111');
      });

      it('should detect IP addresses', () => {
        const text = 'IP: 192.168.1.1';
        const detections = scanForPII(text, [PIIType.IP_ADDRESS]);

        expect(detections).toHaveLength(1);
        expect(detections[0].type).toBe(PIIType.IP_ADDRESS);
        expect(detections[0].value).toBe('192.168.1.1');
      });

      it('should return empty array for text without PII', () => {
        const text = 'This is a normal game message with no sensitive data';
        const detections = scanForPII(text);

        expect(detections).toHaveLength(0);
      });

      it('should filter by specific PII types when provided', () => {
        const text = 'Email: user@example.com and phone (555) 123-4567';
        const detections = scanForPII(text, [PIIType.EMAIL]);

        expect(detections).toHaveLength(1);
        expect(detections[0].type).toBe(PIIType.EMAIL);
      });

      it('should return correct startIndex and endIndex positions', () => {
        const text = 'Hello user@example.com world';
        const detections = scanForPII(text);
        const emailDetection = detections.find((d) => d.type === PIIType.EMAIL);

        expect(emailDetection).toBeDefined();
        expect(emailDetection!.startIndex).toBe(6);
        expect(emailDetection!.endIndex).toBe(22);
      });

      it('should include surrounding context', () => {
        const text = 'Email user@example.com please';
        const detections = scanForPII(text);

        expect(detections[0].context).toBeDefined();
        expect(detections[0].context).toContain('user@example.com');
      });

      it('should detect multiple PII types in same text', () => {
        const text = 'User john@example.com with IP 10.0.0.1';
        const detections = scanForPII(text);

        expect(detections.length).toBeGreaterThanOrEqual(2);
      });

      it('should detect DEVICE_ID patterns', () => {
        const text = 'device_id="a1b2c3d4-e5f6-7890-abcd-ef1234567890"';
        const detections = scanForPII(text, [PIIType.DEVICE_ID]);

        expect(detections.length).toBeGreaterThanOrEqual(1);
        expect(detections[0].type).toBe(PIIType.DEVICE_ID);
      });

      it('should detect AUTH_TOKEN patterns', () => {
        const text = 'token="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123"';
        const detections = scanForPII(text, [PIIType.AUTH_TOKEN]);

        expect(detections.length).toBeGreaterThanOrEqual(1);
        expect(detections[0].type).toBe(PIIType.AUTH_TOKEN);
      });

      it('should detect SESSION_ID patterns', () => {
        const text = 'session_id="abcdef1234567890abcdef1234567890"';
        const detections = scanForPII(text, [PIIType.SESSION_ID]);

        expect(detections.length).toBeGreaterThanOrEqual(1);
        expect(detections[0].type).toBe(PIIType.SESSION_ID);
      });

      it('should detect PASSWORD patterns', () => {
        const text = 'password="mySecretP@ss123"';
        const detections = scanForPII(text, [PIIType.PASSWORD]);

        expect(detections.length).toBeGreaterThanOrEqual(1);
        expect(detections[0].type).toBe(PIIType.PASSWORD);
      });
    });

    describe('containsPII', () => {
      it('should return true for text with PII', () => {
        expect(containsPII('email: test@test.com')).toBe(true);
      });

      it('should return false for text without PII', () => {
        expect(containsPII('This is safe content')).toBe(false);
      });

      it('should filter by specific PII types', () => {
        const text = 'email: test@test.com';
        expect(containsPII(text, [PIIType.PHONE])).toBe(false);
        expect(containsPII(text, [PIIType.EMAIL])).toBe(true);
      });

      it('should return false for empty string', () => {
        expect(containsPII('')).toBe(false);
      });
    });

    describe('isPII', () => {
      it('should detect PII in strings', () => {
        expect(isPII('contact: user@email.com')).toBe(true);
      });

      it('should detect PII in objects', () => {
        const data = { email: 'user@example.com', name: 'John' };
        expect(isPII(data)).toBe(true);
      });

      it('should return false for non-PII strings', () => {
        expect(isPII('normal game data')).toBe(false);
      });

      it('should return false for numbers', () => {
        expect(isPII(12345)).toBe(false);
      });

      it('should return false for null', () => {
        expect(isPII(null)).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(isPII(undefined)).toBe(false);
      });
    });
  });

  describe('Data Classification', () => {
    describe('classifyField', () => {
      it('should classify password as RESTRICTED', () => {
        expect(classifyField('password')).toBe(SensitivityLevel.RESTRICTED);
      });

      it('should classify email as CONFIDENTIAL', () => {
        expect(classifyField('email')).toBe(SensitivityLevel.CONFIDENTIAL);
      });

      it('should classify username as INTERNAL', () => {
        expect(classifyField('username')).toBe(SensitivityLevel.INTERNAL);
      });

      it('should classify level as PUBLIC', () => {
        expect(classifyField('level')).toBe(SensitivityLevel.PUBLIC);
      });

      it('should default unknown fields to INTERNAL', () => {
        expect(classifyField('unknown_field')).toBe(SensitivityLevel.INTERNAL);
      });

      it('should be case-insensitive', () => {
        expect(classifyField('EMAIL')).toBe(SensitivityLevel.CONFIDENTIAL);
        expect(classifyField('Password')).toBe(SensitivityLevel.RESTRICTED);
      });

      it('should match partial field names', () => {
        expect(classifyField('user_password')).toBe(SensitivityLevel.RESTRICTED);
      });

      it('should handle camelCase fields', () => {
        expect(classifyField('accessToken')).toBe(SensitivityLevel.RESTRICTED);
      });

      it('should handle snake_case fields', () => {
        expect(classifyField('refresh_token')).toBe(SensitivityLevel.RESTRICTED);
      });

      it('should default empty string to INTERNAL', () => {
        expect(classifyField('')).toBe(SensitivityLevel.INTERNAL);
      });
    });

    describe('classifyData', () => {
      it('should classify data with mixed sensitivity fields', () => {
        const data = {
          password: 'secret123',
          email: 'user@example.com',
          username: 'player1',
          level: 5,
        };

        const classification = classifyData(data);

        expect(classification.level).toBe(SensitivityLevel.RESTRICTED);
        expect(classification.fields['password']).toBe(SensitivityLevel.RESTRICTED);
        expect(classification.fields['email']).toBe(SensitivityLevel.CONFIDENTIAL);
        expect(classification.fields['username']).toBe(SensitivityLevel.INTERNAL);
        expect(classification.fields['level']).toBe(SensitivityLevel.PUBLIC);
        expect(classification.restrictedFields).toContain('password');
      });

      it('should detect embedded PII in field values', () => {
        const data = { message: 'Email me at user@example.com' };
        const classification = classifyData(data);

        expect(classification.piiFields).toContain('message');
      });

      it('should return default classification for null input', () => {
        const classification = classifyData(null);

        expect(classification.level).toBe(SensitivityLevel.PUBLIC);
        expect(classification.fields).toEqual({});
        expect(classification.piiFields).toHaveLength(0);
      });

      it('should return default classification for undefined input', () => {
        const classification = classifyData(undefined);

        expect(classification.level).toBe(SensitivityLevel.PUBLIC);
      });

      it('should determine highest sensitivity level', () => {
        const restrictedData = { password: 'secret' };
        const classification = classifyData(restrictedData);

        expect(classification.level).toBe(SensitivityLevel.RESTRICTED);
      });

      it('should handle empty objects', () => {
        const classification = classifyData({});

        expect(classification.level).toBe(SensitivityLevel.PUBLIC);
        expect(classification.piiFields).toHaveLength(0);
        expect(classification.restrictedFields).toHaveLength(0);
      });

      it('should classify INTERNAL level overriding PUBLIC', () => {
        const data = { match_history: 'data' };
        const classification = classifyData(data);

        expect(classification.level).toBe(SensitivityLevel.INTERNAL);
      });
    });
  });

  describe('Compliance Validation', () => {
    describe('checkPrivacyCompliance', () => {
      it('should report compliant when no PII is present', () => {
        const data = { level: 5, xp: 100 };
        const result = checkPrivacyCompliance(data);

        expect(result.compliant).toBe(true);
        expect(result.issues).toHaveLength(0);
      });

      it('should report critical issue for restricted fields', () => {
        const data = { password: 'supersecret' };
        const result = checkPrivacyCompliance(data);

        const criticalIssues = result.issues.filter((i) => i.severity === 'critical');
        expect(criticalIssues.length).toBeGreaterThan(0);
      });

      it('should emit GDPR warning when email present without consent field', () => {
        const data = { email: 'user@example.com' };
        const result = checkPrivacyCompliance(data);

        const gdprWarning = result.warnings.find((w) => w.toLowerCase().includes('gdpr'));
        expect(gdprWarning).toBeDefined();
      });

      it('should not emit GDPR warning when consent field present', () => {
        const data = { email: 'user@example.com', gdpr_consent: true };
        const result = checkPrivacyCompliance(data);

        const gdprWarning = result.warnings.find((w) => w.toLowerCase().includes('gdpr'));
        expect(gdprWarning).toBeUndefined();
      });

      it('should emit CCPA warning for phone without opt-out field', () => {
        const data = { phone: '555-123-4567' };
        const result = checkPrivacyCompliance(data);

        const ccpaWarning = result.warnings.find((w) => w.toLowerCase().includes('ccpa'));
        expect(ccpaWarning).toBeDefined();
      });

      it('should NOT emit CCPA warning when opt-out field is present', () => {
        const data = { phone: '555-123-4567', opt_out: true };
        const result = checkPrivacyCompliance(data);

        const ccpaWarning = result.warnings.find((w) => w.toLowerCase().includes('ccpa'));
        expect(ccpaWarning).toBeUndefined();
      });

      it('should NOT emit CCPA warning when ccpa field is present', () => {
        const data = { email: 'user@example.com', ccpa_consent: true };
        const result = checkPrivacyCompliance(data);

        const ccpaWarning = result.warnings.find((w) => w.toLowerCase().includes('ccpa'));
        expect(ccpaWarning).toBeUndefined();
      });

      it('should return compliant for null input', () => {
        const result = checkPrivacyCompliance(null);

        expect(result.compliant).toBe(true);
        expect(result.issues).toHaveLength(0);
      });

      it('should return compliant for undefined input', () => {
        const result = checkPrivacyCompliance(undefined);

        expect(result.compliant).toBe(true);
      });

      it('should warn about missing encryption on restricted data', () => {
        const data = { password: 'secret' };
        const result = checkPrivacyCompliance(data);

        const encryptionWarning = result.warnings.find((w) =>
          w.toLowerCase().includes('encryption')
        );
        expect(encryptionWarning).toBeDefined();
      });

      it('should NOT warn about encryption when encrypted field is present', () => {
        const data = { password: 'secret', encrypted_data: 'aes256:...' };
        const result = checkPrivacyCompliance(data);

        const encryptionWarning = result.warnings.find((w) =>
          w.toLowerCase().includes('encryption')
        );
        expect(encryptionWarning).toBeUndefined();
      });

      it('should warn about large data volume in restricted fields', () => {
        const largeValue = 'x'.repeat(10001);
        const data = { password: { value: largeValue } };
        const result = checkPrivacyCompliance(data);

        const volumeWarning = result.warnings.find((w) =>
          w.toLowerCase().includes('large data volume')
        );
        expect(volumeWarning).toBeDefined();
      });
    });

    describe('validateDataHandling', () => {
      it('should flag critical issue when storing restricted data', () => {
        const data = { password: 'secret' };
        const result = validateDataHandling('store', data);

        expect(result.compliant).toBe(false);
        const criticalIssues = result.issues.filter((i) => i.severity === 'critical');
        expect(criticalIssues.length).toBeGreaterThan(0);
        expect(result.issues[0].type).toBe('storage_compliance');
      });

      it('should flag high severity issue when logging data with PII', () => {
        const data = { email: 'user@example.com' };
        const result = validateDataHandling('log', data);

        const highIssues = result.issues.filter((i) => i.severity === 'high');
        expect(highIssues.length).toBeGreaterThan(0);
        expect(result.issues[0].type).toBe('logging_compliance');
      });

      it('should flag critical for transmitting restricted data', () => {
        const data = { auth_token: 'abc123' };
        const result = validateDataHandling('transmit', data);

        expect(result.compliant).toBe(false);
        const criticalIssues = result.issues.filter((i) => i.severity === 'critical');
        expect(criticalIssues.length).toBeGreaterThan(0);
        expect(result.issues[0].type).toBe('transmission_compliance');
      });

      it('should flag high severity for sharing data with PII fields', () => {
        const data = { email: 'user@example.com' };
        const result = validateDataHandling('share', data);

        const highIssues = result.issues.filter((i) => i.severity === 'high');
        expect(highIssues.length).toBeGreaterThan(0);
        expect(result.issues[0].type).toBe('sharing_compliance');
      });

      it('should report compliant when no sensitive data stored', () => {
        const data = { level: 5, xp: 100 };
        const result = validateDataHandling('store', data);

        expect(result.compliant).toBe(true);
        expect(result.issues).toHaveLength(0);
      });

      it('should handle export operations with PII', () => {
        const data = { email: 'user@example.com' };
        const result = validateDataHandling('export', data);

        expect(result).toBeDefined();
        const highIssues = result.issues.filter((i) => i.severity === 'high');
        expect(highIssues.length).toBeGreaterThan(0);
      });

      it('should flag critical issue for persist operation (alias for store)', () => {
        const data = { password: 'secret' };
        const result = validateDataHandling('persist', data);

        expect(result.compliant).toBe(false);
        const criticalIssues = result.issues.filter((i) => i.severity === 'critical');
        expect(criticalIssues.length).toBeGreaterThan(0);
        expect(result.issues[0].type).toBe('storage_compliance');
      });

      it('should flag critical for send operation (alias for transmit)', () => {
        const data = { auth_token: 'abc123' };
        const result = validateDataHandling('send', data);

        expect(result.compliant).toBe(false);
        const criticalIssues = result.issues.filter((i) => i.severity === 'critical');
        expect(criticalIssues.length).toBeGreaterThan(0);
        expect(result.issues[0].type).toBe('transmission_compliance');
      });
    });
  });

  describe('Data Anonymization', () => {
    describe('anonymizePII', () => {
      it('should replace email with [EMAIL_REDACTED]', () => {
        const text = 'Contact user@example.com today';
        const result = anonymizePII(text);

        expect(result).toBe('Contact [EMAIL_REDACTED] today');
        expect(result).not.toContain('user@example.com');
      });

      it('should replace multiple PII types', () => {
        const text = 'Email: user@example.com SSN: 123-45-6789';
        const result = anonymizePII(text);

        expect(result).toContain('[EMAIL_REDACTED]');
        expect(result).toContain('[SSN_REDACTED]');
        expect(result).not.toContain('user@example.com');
        expect(result).not.toContain('123-45-6789');
      });

      it('should only anonymize specified types when filter provided', () => {
        const text = 'Email: user@example.com SSN: 123-45-6789';
        const result = anonymizePII(text, [PIIType.EMAIL]);

        expect(result).toContain('[EMAIL_REDACTED]');
        expect(result).toContain('123-45-6789');
      });

      it('should return unchanged text when no PII present', () => {
        const text = 'Nothing sensitive here';
        expect(anonymizePII(text)).toBe(text);
      });

      it('should return empty string for empty input', () => {
        expect(anonymizePII('')).toBe('');
      });
    });

    describe('hashSensitiveData', () => {
      it('should produce consistent hash for same input', () => {
        const hash1 = hashSensitiveData('test123');
        const hash2 = hashSensitiveData('test123');

        expect(hash1).toBe(hash2);
      });

      it('should produce different hash with different salt', () => {
        const hash1 = hashSensitiveData('test123', 'salt1');
        const hash2 = hashSensitiveData('test123', 'salt2');

        expect(hash1).not.toBe(hash2);
      });

      it('should include hashed_ prefix', () => {
        const hash = hashSensitiveData('test123');
        expect(hash).toMatch(/^hashed_/);
      });
    });

    describe('redactBySensitivity', () => {
      it('should redact RESTRICTED values completely', () => {
        expect(redactBySensitivity('secretvalue', SensitivityLevel.RESTRICTED)).toBe('[REDACTED]');
      });

      it('should partially mask CONFIDENTIAL values longer than 4 chars', () => {
        const result = redactBySensitivity('sensitive', SensitivityLevel.CONFIDENTIAL);

        expect(result).toBe('se***ve');
        expect(result).not.toBe('sensitive');
      });

      it('should return [MASKED] for short CONFIDENTIAL values', () => {
        expect(redactBySensitivity('ab', SensitivityLevel.CONFIDENTIAL)).toBe('[MASKED]');
      });

      it('should return INTERNAL values unchanged', () => {
        expect(redactBySensitivity('internal_data', SensitivityLevel.INTERNAL)).toBe(
          'internal_data'
        );
      });

      it('should return PUBLIC values unchanged', () => {
        expect(redactBySensitivity('public_data', SensitivityLevel.PUBLIC)).toBe('public_data');
      });

      it('should handle null values', () => {
        expect(redactBySensitivity(null, SensitivityLevel.RESTRICTED)).toBeNull();
      });

      it('should handle undefined values', () => {
        expect(redactBySensitivity(undefined, SensitivityLevel.RESTRICTED)).toBeUndefined();
      });
    });
  });

  describe('Logging Preparation', () => {
    describe('prepareForLogging', () => {
      it('should redact password field', () => {
        const data = { username: 'player1', password: 'supersecret' };
        const result = prepareForLogging(data) as Record<string, unknown>;

        expect(result['password']).toBe('[REDACTED]');
        expect(result['username']).toBe('player1');
      });

      it('should redact confidential fields with partial mask', () => {
        const data = { email: 'user@example.com' };
        const result = prepareForLogging(data) as Record<string, unknown>;

        expect(result['email']).not.toBe('user@example.com');
      });

      it('should handle nested objects', () => {
        const data = {
          user: { password: 'secret' },
          level: 5,
        };
        const result = prepareForLogging(data) as Record<string, unknown>;
        const user = result['user'] as Record<string, unknown>;

        expect(user['password']).toBe('[REDACTED]');
        expect(result['level']).toBe(5);
      });

      it('should return null unchanged', () => {
        expect(prepareForLogging(null)).toBeNull();
      });

      it('should return non-object values unchanged', () => {
        expect(prepareForLogging('plain text')).toBe('plain text');
      });

      it('should return undefined unchanged', () => {
        expect(prepareForLogging(undefined)).toBeUndefined();
      });
    });

    describe('sanitizeForLogging', () => {
      it('should anonymize PII in strings', () => {
        const result = sanitizeForLogging('Email: user@example.com');

        expect(result).toBe('Email: [EMAIL_REDACTED]');
      });

      it('should prepare objects for logging', () => {
        const data = { password: 'secret', level: 5 };
        const result = sanitizeForLogging(data) as Record<string, unknown>;

        expect(result['password']).toBe('[REDACTED]');
        expect(result['level']).toBe(5);
      });

      it('should return null for null input', () => {
        expect(sanitizeForLogging(null)).toBeNull();
      });
    });
  });
});
