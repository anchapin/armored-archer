# Google Play Data Safety Section

Reference for filling out the Data Safety form in Google Play Console.

## Overview Questions

| Question | Answer |
|----------|--------|
| Does your app collect or share user data? | Yes |
| Is all user data collected encrypted in transit? | Yes (TLS 1.3) |
| Can users request data deletion? | Yes (via support@armoredarcher.com) |

## Data Collected

### Personal Info
| Data Type | Collected | Shared | Processed Ephemerally | Purpose |
|-----------|-----------|--------|-----------------------|---------|
| Email | Yes | No | No | Account creation, authentication |
| User ID | Yes | No | No | Game state management |

### App Activity
| Data Type | Collected | Shared | Processed Ephemerally | Purpose |
|-----------|-----------|--------|-----------------------|---------|
| Game stats | Yes | No | No | Game progression, matchmaking |

### App Info and Performance
| Data Type | Collected | Shared | Processed Ephemerally | Purpose |
|-----------|-----------|--------|-----------------------|---------|
| Crash logs | Yes | No | No | Bug fixing (Firebase Crashlytics) |
| Performance data | Yes | No | No | App optimization |

### Financial Info
| Data Type | Collected | Shared | Processed Ephemerally | Purpose |
|-----------|-----------|--------|-----------------------|---------|
| Purchase history | Yes | No | No | IAP management |

## Data Shared

**None.** Data is not shared with third parties except service providers (Nakama, Firebase Crashlytics, RevenueCat) under data processing agreements.

## Data Handling

| Practice | Status |
|----------|--------|
| Data encrypted in transit | Yes |
| Data encrypted at rest | Yes |
| Data deletion request available | Yes |
| Data independent of app use | No |
| Data collected automatically | Yes (crash/performance data) |
| Data collected only with consent | Yes (account data provided at registration) |

## Third-Party Libraries

| Library | Purpose | Data Accessed |
|---------|---------|---------------|
| Nakama | Backend services | Email, User ID, Game stats |
| Firebase Crashlytics | Crash reporting | Device info, crash logs |
| RevenueCat | IAP processing | Purchase history |

## Compliance

- **GDPR**: Supported (EU users can exercise data rights)
- **CCPA**: Supported (California users can opt out of data sale — we don't sell data)
- **COPPA**: App is not directed at children under 13

## Submission Instructions

1. Open Google Play Console
2. Go to **App Content** > **Data Safety**
3. Click **Start** or **Manage**
4. Answer the overview questions as listed above
5. For each data type, select the matching options from the tables
6. Review and submit
