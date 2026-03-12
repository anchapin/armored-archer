# Firebase Crashlytics Alert Thresholds

This document defines alert thresholds for Firebase Crashlytics crash reporting to ensure production stability monitoring.

## Overview

Crash alerts are integrated with the existing Prometheus/Alertmanager infrastructure to provide:
- Real-time crash monitoring
- Proactive stability notifications
- Crash trend analysis
- On-call escalation for critical issues

## Crash Alert Thresholds

### Critical Alerts (Immediate Action Required)

| Alert | Metric | Threshold | For | Description |
|-------|--------|-----------|-----|-------------|
| HighCrashRate | crashlytics_crash_rate | > 1% | 5m | Crash rate exceeds 1% of sessions |
| FatalCrashes | crashlytics_fatal_crashes | > 0 | 1m | Any fatal crashes detected |
| CrashSpike | crashlytics_crash_count | > 10/min | 2m | Sudden spike in crash volume |

### Warning Alerts (Attention Required)

| Alert | Metric | Threshold | For | Description |
|-------|--------|-----------|-----|-------------|
| ElevatedCrashRate | crashlytics_crash_rate | > 0.5% | 10m | Elevated crash rate detected |
| ANRCrashes | crashlytics_anr_count | > 5/min | 5m | App Not Responding crashes |
| NativeCrashes | crashlytics_native_crashes | > 2/min | 5m | Native code crashes |
| CrashAffectedUsers | crashlytics_affected_users | > 100 | 10m | Crashes affecting many users |

### Info Alerts (Awareness)

| Alert | Metric | Threshold | For | Description |
|-------|--------|-----------|-----|-------------|
| NewCrashSignature | crashlytics_new_issues | > 0 | 30m | New crash signature detected |
| RegressionDetected | crashlytics_regression | > 0 | 1h | Crash regression from previous version |

## Firebase Console Configuration

### 1. Enable Crashlytics in Firebase Console

1. Go to Firebase Console → Project → Crashlytics
2. Click "Enable Crashlytics"
3. Wait for first crash report to appear

### 2. Configure Alert Thresholds

In Firebase Console:
1. Navigate to Crashlytics → Settings
2. Configure velocity alerts:
   - **Critical**: Alert when crash rate > 1% in 5 minutes
   - **Warning**: Alert when crash rate > 0.5% in 10 minutes

### 3. Set Up Notifications

1. **In-App Notifications**: Enable in Firebase Console
2. **Email Alerts**: Configure in Project Settings → Notifications
3. **Slack Integration**: Use Firebase Cloud Functions (see below)

## Cloud Functions Integration (Optional)

For advanced alerting, deploy Firebase Cloud Functions:

```typescript
// functions/src/crashlytics.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Alert on new fatal crash
export const onFatalCrash = functions.crashlytics
  .issue()
  .onNewIssuePublished((issue) => {
    // Send notification
    console.log('New fatal crash:', issue.getTitle());
    
    // Integrate with existing alerting
    // This could trigger PagerDuty, Slack, etc.
  });
```

## Client-Side Breadcrumb Configuration

The AnalyticsManager captures breadcrumbs for debugging. Configure breadcrumb retention:

```gdscript
# In AnalyticsManager
const MAX_BREADCRUMBS := 100  # Maximum breadcrumbs to retain
const BREADCRUMB_TYPES := [
    "session_start",
    "session_end", 
    "tutorial_started",
    "tutorial_completed",
    "tutorial_failed",
    "pve_stage_started",
    "pve_stage_completed",
    "pve_stage_failed",
    "pvp_match_started",
    "pvp_match_completed",
    "pvp_match_abandoned",
    "store_opened",
    "purchase_completed",
    "level_up",
    "network_error",
    "crashlytics_initialized"
]
```

## Integration with Backend Alerting

The crash data flows to the backend via:

1. **Direct Firebase Integration**: Crashes reported directly to Firebase
2. **Analytics Events**: AnalyticsManager sends events to backend via RPC
3. **Prometheus Metrics**: Backend scrapes Firebase for crash metrics (via Firebase APIs)

### Prometheus Metrics

```yaml
# prometheus.yml - Add Firebase scrape config
- job_name: firebase-crashlytics
  firebase_params:
    project_id: armored-archer
  metrics_path: /v1/projects/{project}/metrics
  scrape_interval: 5m
```

## Alert Response Workflow

```
1. Crash Detected (Firebase)
       │
       ▼
2. Velocity Alert Triggered
       │
       ▼
3. Firebase Console Notification
       │
       ▼
4. Backend Alert (Prometheus)
       │
       ▼
5. PagerDuty/Slack Alert
       │
       ▼
6. On-Call Engineer Acknowledges
       │
       ▼
7. Investigate in Firebase Console
       │
       ▼
8. Create Issue / Fix
       │
       ▼
9. Verify Fix Deployed
       │
       ▼
10. Mark Alert Resolved
```

## Key Crash Metrics to Monitor

| Metric | Description | Target |
|--------|-------------|--------|
| Crash-free users | Percentage of users without crashes | > 99% |
| Crash-free sessions | Percentage of sessions without crashes | > 99% |
| Fatal crash rate | Percentage of crashes that are fatal | < 0.1% |
| ANR rate | App Not Responding frequency | < 0.5% |
| Time to resolve | Average time from crash to fix | < 24h |

## Testing Crash Reporting

Use the AnalyticsManager test crash function:

```gdscript
# Trigger test crash (for testing only!)
AnalyticsManager.test_crash()
```

Verify the crash appears in:
1. Firebase Console → Crashlytics
2. Backend analytics events (if wired)
3. Any configured alerts

## Related Documentation

- [FIREBASE_SETUP.md](../FIREBASE_SETUP.md) - Firebase setup guide
- [ALERTING.md](./ALERTING.md) - Backend alerting infrastructure
- [ANALYTICS_DASHBOARD.md](../docs/ANALYTICS_DASHBOARD.md) - Analytics visualization
- [Firebase Crashlytics Docs](https://firebase.google.com/docs/crashlytics)
