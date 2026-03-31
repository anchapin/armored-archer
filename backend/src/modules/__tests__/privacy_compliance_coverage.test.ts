import { PIIType, SensitivityLevel, isPII, containsPII, classifyField, anonymizePII } from '../privacy_compliance';

describe('Privacy Compliance - PII Detection', () => {
  test('isPII should detect email', () => {
    expect(isPII('user@example.com')).toBe(true);
  });

  test('isPII should detect phone number', () => {
    expect(isPII('+1-555-123-4567')).toBe(true);
  });

  test('isPII should detect credit card', () => {
    expect(isPII('4532-1234-5678-9012')).toBe(true);
  });

  test('isPII should detect IP address', () => {
    expect(isPII('192.168.1.1')).toBe(true);
  });

  test('isPII should return false for non-PII', () => {
    expect(isPII('hello world')).toBe(false);
    expect(isPII('12345')).toBe(false);
  });
});

describe('Privacy Compliance - containsPII', () => {
  test('containsPII should detect PII in text', () => {
    expect(containsPII('Contact me at user@example.com')).toBe(true);
  });

  test('containsPII should detect multiple PII types', () => {
    const result = containsPII('Call 555-1234 or email test@test.com');
    expect(result).toBe(true);
  });
});

describe('Privacy Compliance - classifyField', () => {
  test('classifyField should classify email as confidential', () => {
    expect(classifyField('email')).toBe(SensitivityLevel.CONFIDENTIAL);
  });

  test('classifyField should classify password as restricted', () => {
    expect(classifyField('password')).toBe(SensitivityLevel.RESTRICTED);
  });

  test('classifyField should classify username as internal', () => {
    expect(classifyField('username')).toBe(SensitivityLevel.INTERNAL);
  });

  test('classifyField should default to internal for unknown fields', () => {
    expect(classifyField('unknown_field')).toBe(SensitivityLevel.INTERNAL);
  });
});

describe('Privacy Compliance - anonymizePII', () => {
  test('anonymizePII should mask email', () => {
    const result = anonymizePII('Contact user@test.com please');
    expect(result).not.toContain('@test.com');
  });

  test('anonymizePII should mask phone number', () => {
    const result = anonymizePII('Call 555-123-4567');
    expect(result).not.toContain('555-123-4567');
  });

  test('anonymizePII should preserve non-PII text', () => {
    const result = anonymizePII('Hello world');
    expect(result).toBe('Hello world');
  });
});

describe('PIIType enum', () => {
  test('should have all expected PII types', () => {
    expect(PIIType.EMAIL).toBe('email');
    expect(PIIType.PHONE).toBe('phone');
    expect(PIIType.CREDIT_CARD).toBe('credit_card');
    expect(PIIType.IP_ADDRESS).toBe('ip_address');
    expect(PIIType.DEVICE_ID).toBe('device_id');
    expect(PIIType.USER_ID).toBe('user_id');
    expect(PIIType.USERNAME).toBe('username');
    expect(PIIType.PASSWORD).toBe('password');
  });
});

describe('SensitivityLevel enum', () => {
  test('should have all expected levels', () => {
    expect(SensitivityLevel.PUBLIC).toBe('public');
    expect(SensitivityLevel.INTERNAL).toBe('internal');
    expect(SensitivityLevel.CONFIDENTIAL).toBe('confidential');
    expect(SensitivityLevel.RESTRICTED).toBe('restricted');
  });
});
