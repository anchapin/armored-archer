# Privacy Compliance Documentation

## Overview

This document outlines the privacy compliance measures implemented in the Armored Archer backend system. The implementation addresses requirements for GDPR, CCPA, and COPPA compliance.

## Table of Contents

1. [PII Detection](#pii-detection)
2. [Data Handling Compliance](#data-handling-compliance)
3. [Privacy Requirements](#privacy-requirements)
4. [Implementation Details](#implementation-details)
5. [Usage Guidelines](#usage-guidelines)

---

## PII Detection

### Overview

The privacy compliance module (`backend/src/modules/privacy_compliance.ts`) provides automated PII (Personally Identifiable Information) detection capabilities.

### Supported PII Types

| Type | Pattern | Sensitivity |
|------|---------|-------------|
| EMAIL | Email addresses | CONFIDENTIAL |
| PHONE | Phone numbers | CONFIDENTIAL |
| SSN | Social Security Numbers | RESTRICTED |
| CREDIT_CARD | Credit card numbers | RESTRICTED |
| IP_ADDRESS | IP addresses | CONFIDENTIAL |
| DEVICE_ID | Device identifiers | CONFIDENTIAL |
| USER_ID | User identifiers | INTERNAL |
| USERNAME | Display names | INTERNAL |
| FULL_NAME | Full legal names | CONFIDENTIAL |
| ADDRESS | Physical addresses | CONFIDENTIAL |
| DATE_OF_BIRTH | Birth dates | CONFIDENTIAL |
| GEOLOCATION | GPS coordinates | CONFIDENTIAL |
| PASSWORD | Passwords | RESTRICTED |
| AUTH_TOKEN | Authentication tokens | RESTRICTED |
| SESSION_ID | Session identifiers | RESTRICTED |

### Usage

```typescript
import { isPII, containsPII, scanForPII, PIIType } from './privacy_compliance';

// Check if a single value contains PII
if (isPII(userInput)) {
  logger.warn('Potential PII detected in input');
}

// Scan text for specific PII types
const detections = scanForPII(text, [PIIType.EMAIL, PIIType.PHONE]);

// Check if text contains any PII
if (containsPII(logMessage)) {
  // Sanitize before logging
}
```

---

## Data Handling Compliance

### Sensitivity Levels

| Level | Description | Handling Requirements |
|-------|-------------|----------------------|
| PUBLIC | Non-sensitive game data | Can be logged freely |
| INTERNAL | Player identifiers | Limit external exposure |
| CONFIDENTIAL | Personal information | Requires consent, encrypt at rest |
| RESTRICTED | Authentication secrets | Never log, encrypt always |

### Compliance Checks

The module provides automated compliance checking:

```typescript
import { checkPrivacyCompliance, validateDataHandling } from './privacy_compliance';

// Check overall compliance
const result = checkPrivacyCompliance(userData);
if (!result.compliant) {
  // Handle critical issues
  result.issues.forEach(issue => {
    if (issue.severity === 'critical') {
      // Block operation or remediate
    }
  });
}

// Validate specific operations
const logCheck = validateDataHandling('log', sensitiveData);
if (!logCheck.compliant) {
  // Use prepareForLogging() to sanitize
}
```

---

## Privacy Requirements

### GDPR Compliance

- [x] Lawful basis for processing (consent)
- [x] Data minimization principle
- [x] Right to access (data export)
- [x] Right to deletion (data removal)
- [x] Data portability
- [x] Privacy by design

### CCPA Compliance

- [x] Right to know what data is collected
- [x] Right to delete personal information
- [x] Right to opt-out of sale
- [x] Non-discrimination for exercising rights

### COPPA Compliance

- [x] No collection of personal info from children under 13
- [x] Verifiable parental consent
- [x] Limited data collection

---

## Implementation Details

### Privacy Module Functions

| Function | Purpose |
|----------|---------|
| `isPII(value)` | Quick boolean check for PII |
| `containsPII(text)` | Check if text contains PII |
| `scanForPII(text, types)` | Detailed PII detection |
| `classifyField(fieldName)` | Get sensitivity level |
| `classifyData(data)` | Classify entire data object |
| `checkPrivacyCompliance(data)` | Full compliance check |
| `anonymizePII(text)` | Replace PII with redacted text |
| `hashSensitiveData(value)` | Create safe hash for storage |
| `prepareForLogging(data)` | Sanitize for logs |
| `validateDataHandling(operation, data)` | Check operation compliance |

### Validation Schemas

Privacy-related validation schemas are defined in `validation.ts`:

```typescript
// Consent schema
consent: {
  analytics_consent: boolean,
  marketing_consent?: boolean,
  timestamp: number,
  version?: string
}

// Data deletion request
data_deletion: {
  user_id: string,
  reason?: string
}

// Data export request
data_export: {
  user_id: string,
  include_game_data?: boolean,
  include_purchase_history?: boolean
}

// Privacy settings update
privacy_settings_update: {
  analytics_enabled?: boolean,
  marketing_enabled?: boolean,
  data_retention_days?: number
}
```

---

## Usage Guidelines

### Logging Best Practices

Always sanitize data before logging:

```typescript
import { prepareForLogging, sanitizeForLogging } from './privacy_compliance';

// Good: Sanitize before logging
logger.info('User update: %s', JSON.stringify(prepareForLogging(userData)));

// Good: Anonymize strings
const safeMessage = sanitizeForLogging(userInput);
logger.info('Input: %s', safeMessage);
```

### Data Storage Requirements

For restricted data:

```typescript
import { validateDataHandling } from './privacy_compliance';

const compliance = validateDataHandling('store', userData);
if (!compliance.compliant) {
  // Encrypt data before storing
  // Or reject the operation
}
```

### Privacy-Preserving Analytics

```typescript
import { isPII } from './privacy_compliance';

// Before sending analytics
if (isPII(event.properties)) {
  logger.warn('Refusing to send analytics with PII');
  return;
}
```

---

## CI/CD Integration

A GitHub Actions workflow (`privacy-compliance.yml`) runs:

1. **PII Detection Scan** - Automated scanning of code
2. **Privacy Checks** - Code review for privacy patterns
3. **Dependency Audit** - Check for privacy-sensitive dependencies
4. **Data Handling Review** - Analyze data storage patterns

---

## Related Documentation

- [PRIVACY_POLICY.md](../PRIVACY_POLICY.md)
- [SECURITY.md](../SECURITY.md)
- [SECRETS_MANAGEMENT.md](../SECRETS_MANAGEMENT.md)

---

## Changelog

- 2024-01: Initial privacy compliance implementation
  - PII detection module
  - Data classification system
  - Compliance validation functions
  - GitHub Actions workflow
