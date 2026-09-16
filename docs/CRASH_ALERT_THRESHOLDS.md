# Client Crash Alert Thresholds

This document defines the crash thresholds for client stability monitoring and describes how crash alerting actually works in this repo.

**Status (truthed per issue #1105):** client crash alerting is **Firebase-Crashlytics-console-only**. Nothing in this repo exports client crash metrics to the self-hosted Prometheus/Grafana/Loki stack, and no `crashlytics_*` Prometheus alerts exist. The thresholds below are policy thresholds to enforce **in the Firebase console**, not Prometheus alert rules.

## How Client Crashes Actually Flow Today

The client crash path is best-effort and depends on the platform and Firebase availability (`addons/analytics_manager/analytics_manager.gd`):

1. **Hard crash** — Godot emits `NOTIFICATION_CRASH`; `AnalyticsManager._capture_crash_dump()` builds a crash context (session id, breadcrumbs, memory, platform, versions) and `print()`s it locally. It is forwarded to Firebase Crashlytics **only when all of the following hold**:
   - the platform is Android or iOS,
   - `is_crashlytics_enabled` is `true`, and
   - the `GodotFirebase` engine singleton is present (i.e. a Firebase configuration is built into the app; see `AnalyticsManager._log_android_crashlytics_error`).

   On desktop/web builds, or in mobile builds without a Firebase config, the crash dump is **local `print()` output only** — there is no crash telemetry at all.

2. **Non-fatal errors** — `AnalyticsManager.record_custom_error()` (which also emits the `crash_reported` signal) is picked up by `MonitoringManager` (autoloads/MonitoringManager.gd), which forwards a `client_error` analytics event to the backend via `track_event_to_backend`. These land as analytics events, **not** as Prometheus crash metrics, and they do not fire any alert rules.

3. **Backend/self-hosted stack** — the Prometheus/Grafana/Loki stack (see `docs/DEPLOYMENT_OBSERVABILITY.md`) monitors **server-side** health only (`backend/alerts.yml` contains error-rate, latency, and infrastructure alerts — no crash rules). Prometheus does not scrape Firebase, and no such scrape job exists in `backend/prometheus.yml`.

## Crash Thresholds (Enforce in the Firebase Console)

These are the repo's stability policy thresholds (they back RC-H6 in `docs/RELEASE_CANDIDATE_CHECKLIST.md` and the LC-S1/LC-S2 launch criteria in `docs/LAUNCH_PATH_DECISION.md`). Enforce them via Firebase Crashlytics console alerting and periodic console review — they are **not** wired to Alertmanager.

| Threshold | Policy | How to enforce |
|-----------|--------|----------------|
| Crash rate | > 1% of sessions = critical | Crashlytics trend/velocity alerts + console review of the crash-free sessions widget |
| Fatal crashes | Any fatal crash = critical | Crashlytics new-issue/velocity email alerts; triage every fatal in the console |
| Crash-free users/sessions | ≥ 99% | Crashlytics dashboard (Firebase Console → Crashlytics) |
| ANR rate (Android) | < 0.5% | Android vitals in the Crashlytics / Play consoles |

### Console setup steps

1. **Enable Crashlytics** — Firebase Console → Project → Crashlytics → "Enable Crashlytics" (requires a Firebase config in the build; see `docs/FIREBASE_SETUP.md`).
2. **Enable alert notifications** — Crashlytics → Alerts: turn on email notifications for new issues, velocity alerts, and trend alerts. Configure recipients under Project Settings → Notifications.
3. **No Prometheus configuration is needed or possible** — there is no `crashlytics_*` exporter; any doc claiming one was fabricated and has been removed.

Note: Firebase velocity/trend alerts are managed by Firebase and are not user-configurable PromQL rules. If a threshold must gate a release (RC-H6), verify the crash-free rate in the console during the review window rather than relying on an alert push.

## Alert Response Workflow (Console-Based)

```
1. Crash reported to Crashlytics (mobile builds with Firebase config only)
       │
       ▼
2. Velocity / trend alert email from Firebase (if enabled in console)
       │
       ▼
3. Engineer triages in Firebase Console → Crashlytics
       │
       ▼
4. Create GitHub issue / hotfix
       │
       ▼
5. Verify fix in next release's Crashlytics dashboard
```

If no Firebase config is present in a build, step 1 never happens — crashes are only visible in local `print()` output, so release testing on such builds must rely on manual reproduction and platform crash logs (e.g. logcat / Xcode organizer).

## Client-Side Breadcrumb Context

`AnalyticsManager.add_breadcrumb(label, metadata)` records breadcrumbs that `_capture_crash_dump()` attaches to crash reports, and `record_custom_error()` includes the last 10 breadcrumbs (`_get_breadcrumb_summary()`) in non-fatal error reports. Breadcrumb labels in use include `session_start`, `pve_stage_started/completed/failed`, `pvp_match_started/completed/abandoned`, `store_opened`, `purchase_completed`, `network_error`, and `crashlytics_initialized`.

## Optional: Cloud Functions Push Integration (Not Deployed)

The only way to route Crashlytics alerts into Slack/PagerDuty today would be a Firebase Cloud Function on `crashlytics.issue().onNewIssuePublished` (see [Firebase docs](https://firebase.google.com/docs/crashlytics)). **No Cloud Functions are deployed for this project** — this is a potential future enhancement, not an existing integration.

## Testing Crash Reporting

```gdscript
# Trigger a test crash report (does not hard-crash the app)
AnalyticsManager.test_crash()
```

Verify:
1. On mobile builds with a Firebase config: the report appears in Firebase Console → Crashlytics.
2. Everywhere: local console output (`Analytics: Recorded custom error: Test crash from AnalyticsManager`).
3. The non-fatal path also reaches the backend as a `client_error` analytics event (via `MonitoringManager.report_error`).

## Future Work: Backend Crash Metrics

The recommended end-state (tracked as a follow-up to issue #1105, not yet implemented) is a real client→backend crash pipeline:

- A client crash/health RPC so clients report crash reports and near-crash context to the Nakama server,
- server-side `armored_archer_client_crash_*` Prometheus metrics (crash rate, fatal count, affected users) exported by `backend/src`,
- alert rules in `backend/alerts.yml` matching the thresholds above (> 1% crash rate, any fatal), firing through the existing Alertmanager setup.

That would make the thresholds machine-enforced and visible in Grafana alongside server-side health, instead of depending on the Firebase console. It is a cross-cutting client+backend+observability feature and needs its own issue — deliberately out of scope for the documentation fix that produced this document's current wording.

## Related Documentation

- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) — Firebase/Crashlytics client setup guide
- [DEPLOYMENT_OBSERVABILITY.md](./DEPLOYMENT_OBSERVABILITY.md) — the self-hosted Prometheus/Grafana/Loki stack (server-side only)
- [ANALYTICS_DASHBOARD.md](./ANALYTICS_DASHBOARD.md) — analytics events and dashboards
- [RELEASE_CANDIDATE_CHECKLIST.md](./RELEASE_CANDIDATE_CHECKLIST.md) — RC-H6 crash-free rate gate
- [Firebase Crashlytics Docs](https://firebase.google.com/docs/crashlytics)
