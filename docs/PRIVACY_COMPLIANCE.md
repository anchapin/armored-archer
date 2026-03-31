# Privacy Compliance Documentation

**Version**: 1.0  
**Last Updated**: March 2025  
**Document Owner**: Armored Archer Development Team  
**Applies To**: Backend (Nakama + PostgreSQL), Godot Client (iOS/Android), Analytics Systems

---

## Table of Contents

1. [Overview](#overview)
2. [Data Collection and Processing](#data-collection-and-processing)
3. [Privacy Policy Summary](#privacy-policy-summary)
4. [Data Retention and Deletion](#data-retention-and-deletion)
5. [Regulatory Compliance](#regulatory-compliance)
6. [Implementation Details](#implementation-details)
7. [Data Handling Guidelines](#data-handling-guidelines)
8. [Third-Party Services](#third-party-services)
9. [Security Measures](#security-measures)
10. [User Rights](#user-rights)
11. [Related Documentation](#related-documentation)

---

## Overview

This document outlines the privacy compliance measures implemented in the Armored Archer game system. The implementation addresses requirements for:

- **GDPR** (General Data Protection Regulation) - European Union
- **CCPA** (California Consumer Privacy Act) - California, USA
- **COPPA** (Children's Online Privacy Protection Act) - United States

Armored Archer is committed to protecting user privacy and being transparent about data practices. This documentation serves as the authoritative reference for all privacy-related implementation details.

### Core Privacy Principles

| Principle | Description |
|-----------|-------------|
| **Data Minimization** | We collect only the data necessary to provide our services |
| **Purpose Limitation** | Data is used only for stated purposes |
| **Transparency** | Users are informed about what data is collected and how it's used |
| **Security** | Industry-standard security measures protect user data |
| **User Control** | Users have rights to access, correct, and delete their data |

---

## Data Collection and Processing

### Data Categories

#### 1. Account Data (Collected via Nakama)

| Data Type | Purpose | Sensitivity | Legal Basis |
|-----------|---------|-------------|-------------|
| Email Address | Account identification, password recovery | CONFIDENTIAL | Consent |
| Username/Display Name | Player identification in-game | INTERNAL | Consent |
| Password (hashed) | Account authentication | RESTRICTED | Consent |
| Account ID | Unique user identification | INTERNAL | Consent |
| Creation Date | Account management | INTERNAL | Consent |

#### 2. Game Data

| Data Type | Purpose | Sensitivity | Legal Basis |
|-----------|---------|-------------|-------------|
| Player Level | Game progression | PUBLIC | Consent |
| Player Statistics | Gameplay tracking | PUBLIC | Consent |
| Inventory/Gear | Game state | PUBLIC | Consent |
| Match History | Matchmaking, statistics | INTERNAL | Consent |
| Achievements | Player progression | PUBLIC | Consent |
| Season Progress | Seasonal content | PUBLIC | Consent |

#### 3. Device and Technical Data

| Data Type | Purpose | Sensitivity | Legal Basis |
|-----------|---------|-------------|-------------|
| Device ID | Analytics, fraud prevention | CONFIDENTIAL | Legitimate Interest |
| IP Address | Geo-location, security | CONFIDENTIAL | Legitimate Interest |
| OS Version | Compatibility | INTERNAL | Legitimate Interest |
| App Version | Support | INTERNAL | Legitimate Interest |
| Session Data | Authentication | RESTRICTED | Consent |

#### 4. Analytics Data (via Firebase/Analytics Manager)

| Data Type | Purpose | Sensitivity | Legal Basis |
|-----------|---------|-------------|-------------|
| Crash Reports | Bug fixes | INTERNAL | Legitimate Interest |
| Performance Metrics | Optimization | INTERNAL | Legitimate Interest |
| Feature Usage | Product improvement | INTERNAL | Consent |
| Session Duration | Analytics | INTERNAL | Consent |

#### 5. Purchase Data (via RevenueCat)

| Data Type | Purpose | Sensitivity | Legal Basis |
|-----------|---------|-------------|-------------|
| Transaction History | Purchase fulfillment | CONFIDENTIAL | Legal Obligation |
| Subscription Status | Service delivery | CONFIDENTIAL | Consent |
| Product IDs | Service delivery | INTERNAL | Consent |

### Data Processing Operations

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA PROCESSING FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐   │
│  │  User    │───▶│   Collection │───▶│  Processing Stage  │   │
│  │  Input   │    │   (Client)   │    │                    │   │
│  └──────────┘    └──────────────┘    └────────────────────┘   │
│                                              │                  │
│                                              ▼                  │
│                                      ┌────────────────────┐    │
│                                      │  Validation &      │    │
│                                      │  PII Detection     │    │
│                                      │  (Privacy Module)  │    │
│                                      └────────────────────┘    │
│                                              │                  │
│                                              ▼                  │
│                                      ┌────────────────────┐    │
│                                      │  Classification &   │    │
│                                      │  Compliance Check  │    │
│                                      └────────────────────┘    │
│                                              │                  │
│                      ┌───────────────────────┼────────────────┐ │
│                      ▼                       ▼                ▼ │
│              ┌──────────────┐        ┌──────────────┐  ┌─────┐ │
│              │   Storage    │        │   Analytics  │  │Logs │ │
│              │  (Nakama/DB) │        │  (Firebase)  │  │     │ │
│              └──────────────┘        └──────────────┘  └─────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### PII Detection

The system uses the `privacy_compliance.ts` module to automatically detect and handle personally identifiable information (PII).

**Supported PII Types:**

| Type | Pattern | Sensitivity Level |
|------|---------|-------------------|
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

---

## Privacy Policy Summary

The full Privacy Policy is available in [PRIVACY_POLICY.md](../PRIVACY_POLICY.md).

### Key Points

1. **Data Collection**: We collect only necessary data to provide game services
2. **No Sale of Data**: We do NOT sell personal information to third parties
3. **Limited Sharing**: Data is shared only with service providers who have strict data protection agreements
4. **Security**: Industry-standard encryption and security measures are implemented
5. **User Rights**: Users can access, correct, or delete their data

### Consent Management

Users can manage their consent preferences through:

- **In-Game Settings**: Privacy settings accessible from main menu
- **Account Settings**: Email preferences and marketing consent
- **Support Request**: Contact support@armoredarcher.com

---

## Data Retention and Deletion

### Retention Periods

| Data Category | Retention Period | Reason |
|----------------|------------------|--------|
| Account Data | Active + 30 days post-deletion | Recovery grace period |
| Game Progress | Active + 30 days post-deletion | Recovery grace period |
| Match History | 90 days | Analytics, dispute resolution |
| Crash Reports | 30 days | Bug fixing |
| Analytics Data | 365 days (aggregated) | Product improvement |
| Purchase Records | 7 years | Legal/tax requirements |
| Session Logs | 30 days | Security, debugging |
| Marketing Data | Until user opts out | Consent-based |

### Deletion Procedures

#### User-Initiated Deletion

```
┌─────────────────────────────────────────────────────────────────┐
│                  DATA DELETION REQUEST FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User Request                                                │
│     ├── In-Game: Settings → Account → Delete Account            │
│     ├── Email: support@armoredarcher.com                        │
│     └── API: DELETE /api/v1/account                             │
│                           │                                     │
│                           ▼                                     │
│  2. Verification                                                │
│     ├── Confirm user identity                                   │
│     ├── Verify account ownership                                │
│     └── Check for active subscriptions                          │
│                           │                                     │
│                           ▼                                     │
│  3. Immediate Actions                                           │
│     ├── Disable account access                                  │
│     ├── Revoke all sessions                                     │
│     └── Send confirmation email                                 │
│                           │                                     │
│                           ▼                                     │
│  4. Data Deletion (Within 30 days)                              │
│     ├── Delete from PostgreSQL                                   │
│     ├── Delete from Nakama                                       │
│     ├── Delete from Firebase Analytics                          │
│     └── Anonymize remaining logs                                │
│                           │                                     │
│                           ▼                                     │
│  5. Completion                                                   │
│     ├── Send deletion confirmation                              │
│     ├── Update retention records                                │
│     └── Archive deletion audit log                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Automated Deletion

The system runs automated cleanup jobs for:

1. **Inactive Account Cleanup**: Accounts inactive for 2+ years
2. **Log Rotation**: Compressed after 30 days, deleted after 90 days
3. **Analytics Data**: Aggregated after 365 days, raw data deleted
4. **Session Cleanup**: Expired sessions removed daily

### Data Retention for Legal Obligations

Certain data may be retained beyond standard deletion periods:

| Data Type | Retention Period | Legal Basis |
|-----------|------------------|-------------|
| Purchase Records | 7 years | Tax law compliance |
| Fraud Prevention Data | 5 years | Legal disputes |
| Security Logs | 2 years | Security investigations |

---

## Regulatory Compliance

### GDPR Compliance (European Union)

| Requirement | Implementation |
|-------------|----------------|
| **Lawful Basis** | Consent obtained at account creation |
| **Data Minimization** | Only essential data collected |
| **Right to Access** | Data export API available |
| **Right to Deletion** | Account deletion with 30-day completion |
| **Data Portability** | JSON export of all user data |
| **Privacy by Design** | PII detection in logging pipeline |
| **Data Protection Officer** | Contact: support@armoredarcher.com |
| **Response Time** | Within 30 days |

**GDPR-Specific Features:**

- Explicit consent for analytics
- Right to object to processing
- Right to restrict processing
- Automated decision-making transparency
- Data Protection Impact Assessments (DPIA) for high-risk processing

### CCPA Compliance (California)

| Requirement | Implementation |
|-------------|----------------|
| **Right to Know** | Disclosure in Privacy Policy |
| **Right to Delete** | Deletion request processing |
| **Right to Opt-Out** | "Do Not Sell My Personal Information" option |
| **Non-Discrimination** | Same service quality regardless of rights exercise |
| **Response Time** | Within 45 days |

**CCPA-Specific Features:**

- Do Not Sell option in settings
- Verifiable consumer request handling
- Financial incentive disclosures
- Privacy practice updates notification

### COPPA Compliance (Children's Privacy)

| Requirement | Implementation |
|-------------|----------------|
| **Age Restriction** | 13+ years old for account creation |
| **No Collection from Children** | Age verification at registration |
| **Parental Consent** | Required for users under 13 |
| **Limited Data Collection** | Minimal data from minors |
| **Data Deletion** | Expedited deletion for children |

**COPPA-Specific Features:**

- Age gate at account creation
- No targeted advertising to minors
- Parental consent verification process
- Limited gameplay data collection

### Additional Compliance

| Regulation | Region | Status |
|------------|--------|--------|
| PIPEDA | Canada | Compliant |
| LGPD | Brazil | Compliant |
| APP | Australia | Compliant |

---

## Implementation Details

### Privacy Compliance Module

The backend implements privacy compliance through `backend/src/modules/privacy_compliance.ts`:

#### Core Functions

| Function | Purpose |
|----------|---------|
| `isPII(value)` | Quick boolean check for PII |
| `containsPII(text)` | Check if text contains PII |
| `scanForPII(text, types)` | Detailed PII detection |
| `classifyField(fieldName)` | Get sensitivity level for a field |
| `classifyData(data)` | Classify entire data object |
| `checkPrivacyCompliance(data)` | Full compliance check |
| `anonymizePII(text)` | Replace PII with redacted text |
| `hashSensitiveData(value)` | Create safe hash for storage |
| `prepareForLogging(data)` | Sanitize data for logs |
| `validateDataHandling(operation, data)` | Check operation compliance |

### Sensitivity Levels

| Level | Description | Handling Requirements |
|-------|-------------|----------------------|
| **PUBLIC** | Non-sensitive game data | Can be logged freely |
| **INTERNAL** | Player identifiers | Limit external exposure |
| **CONFIDENTIAL** | Personal information | Requires consent, encrypt at rest |
| **RESTRICTED** | Authentication secrets | Never log, encrypt always |

### Validation Schemas

Privacy-related data validation uses Zod schemas:

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

### CI/CD Integration

A GitHub Actions workflow (`privacy-compliance.yml`) runs automated checks:

1. **PII Detection Scan** - Automated scanning of code and logs
2. **Privacy Checks** - Code review for privacy patterns
3. **Dependency Audit** - Check for privacy-sensitive dependencies
4. **Data Handling Review** - Analyze data storage patterns

---

## Data Handling Guidelines

### Logging Best Practices

Always sanitize data before logging:

```typescript
import { prepareForLogging, sanitizeForLogging } from './privacy_compliance';

// Good: Sanitize before logging
logger.info('User update: %s', JSON.stringify(prepareForLogging(userData)));

// Good: Anonymize strings
const safeMessage = sanitizeForLogging(userInput);
logger.info('Input: %s', safeMessage);

// Bad: Direct logging of user data
logger.info('User data: %s', JSON.stringify(userData));
```

### Data Storage Requirements

For sensitive data:

```typescript
import { validateDataHandling } from './privacy_compliance';

const compliance = validateDataHandling('store', userData);
if (!compliance.compliant) {
  // Encrypt data before storing
  // Or reject the operation
}
```

### Analytics Privacy

```typescript
import { isPII } from './privacy_compliance';

// Before sending analytics
if (isPII(event.properties)) {
  logger.warn('Refusing to send analytics with PII');
  return;
}

analytics.track(eventName, sanitizeEventData(event.properties));
```

---

## Third-Party Services

Armored Archer uses the following third-party services:

| Service | Purpose | Data Processed |
|---------|---------|----------------|
| **Nakama** | Multiplayer backend | Account data, game data |
| **Firebase Crashlytics** | Crash reporting | Device info, crash traces |
| **RevenueCat** | In-app purchases | Transaction data |
| **Apple App Store** | iOS distribution | Device identifiers |
| **Google Play Store** | Android distribution | Device identifiers |

### Third-Party Privacy Policies

| Service | Privacy Policy URL |
|---------|-------------------|
| Nakama | https://heroiclabs.com/privacy/ |
| Firebase | https://firebase.google.com/terms/analytics-policy |
| RevenueCat | https://www.revenuecat.com/privacy |
| Apple | https://www.apple.com/legal/privacy/ |
| Google | https://policies.google.com/privacy |

---

## Security Measures

### Encryption

| Data State | Protection Method |
|------------|-------------------|
| In Transit | TLS 1.3 |
| At Rest | AES-256 (database) |
| Passwords | bcrypt with salt |
| Tokens | JWT with expiration |

### Access Controls

- Role-based access control (RBAC) for backend systems
- Principle of least privilege
- Regular access reviews
- Multi-factor authentication for admin access

### Monitoring

- Real-time security event monitoring
- Anomaly detection
- Audit logging
- Incident response procedures

---

## User Rights

### How to Exercise Rights

| Right | Method |
|-------|--------|
| **Access** | In-Game Settings → Account → View Data |
| **Correction** | In-Game Settings → Account → Edit Profile |
| **Deletion** | In-Game Settings → Account → Delete Account |
| **Portability** | Contact support@armoredarcher.com |
| **Objection** | Contact support@armoredarcher.com |
| **Opt-Out** | In-Game Settings → Privacy |

### Response Times

| Request Type | Response Time |
|--------------|---------------|
| GDPR Requests | 30 days |
| CCPA Requests | 45 days |
| General Inquiries | 14 days |

### Contact Information

- **Email**: support@armoredarcher.com
- **Website**: https://armoredarcher.com
- **Mailing Address**: Armored Archer, 123 Game Street, San Francisco, CA 94102

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [PRIVACY_POLICY.md](../PRIVACY_POLICY.md) | Full privacy policy for end users |
| [SECURITY.md](../SECURITY.md) | Security practices and incident response |
| [SECRETS_MANAGEMENT.md](../SECRETS_MANAGEMENT.md) | Secrets handling procedures |
| [backend/src/modules/privacy_compliance.ts](../backend/src/modules/privacy_compliance.ts) | Privacy compliance module |
| [DATABASE_SCHEMA.md](../backend/DATABASE_SCHEMA.md) | Database schema documentation |

---

## Changelog

| Date | Changes |
|------|---------|
| March 2025 | Initial privacy compliance documentation |
| March 2025 | Added GDPR, CCPA, COPPA compliance sections |
| March 2025 | Documented retention and deletion procedures |
