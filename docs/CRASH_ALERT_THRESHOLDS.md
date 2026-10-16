# Client Crash Alert Thresholds

This document defines the crash thresholds for client stability monitoring and describes how crash reporting actually works in this repo.

**Status (updated after the Firebase removal):** there is no crash console. Client crash reporting is local-only — fatal crashes are captured as local `print()` output, and non-fatal errors reach the self-hosted backend as `client_error` analytics events. The thresholds below are policy thresholds with **no live enforcement** until a client→backend crash pipeline exists (see Future Work).

## How Client Crashes Actually Flow Today

1. **Hard crash** — Godot emits `NOTIFICATION_CRASH`; `AnalyticsManager._capture_crash_dump()` builds a crash context (session id, breadcrumbs, memory, platform, versions) and `print()`s it locally. There is no off-device telemetry for fatal crashes.

2. **Non-fatal errors** — `AnalyticsManager.record_custom_error()` (which also emits the `crash_reported` signal) is picked up by `MonitoringManager` (autoloads/MonitoringManager.gd), which forwards a `client_error` analytics event to the backend via `track_event_to_backend`. These land as analytics events, **not** as Prometheus crash metrics, and they do not fire any alert rules.

3. **Backend/self-hosted stack** — the Prometheus/Grafana/Loki stack (see `docs/DEPLOYMENT_OBSERVABILITY.md`) monitors **server-side** health only (`backend/alerts.yml` contains error-rate, latency, and infrastructure alerts — no crash rules).

## Crash Thresholds (Policy Only)

These are the repo's stability policy thresholds (they back RC-H6 in `docs/RELEASE_CANDIDATE_CHECKLIST.md` and the LC-S1/LC-S2 launch criteria in `docs/LAUNCH_PATH_DECISION.md`). With no crash console, **none of them have a live data source today** — those release gates cannot be evaluated until the Future Work pipeline lands.

| Threshold | Policy | Enforcement today |
|-----------|--------|-------------------|
| Crash rate | > 1% of sessions = critical | None — manual review of platform crash logs (logcat / Xcode Organizer) during release testing |
| Fatal crashes | Any fatal crash = critical | None — manual triage of platform crash logs |
| Crash-free users/sessions | ≥ 99% | None |
| ANR rate (Android) | < 0.5% | Android vitals in the Play Console |

## Alert Response Workflow (Today)

```
1. Crash observed in platform crash logs (logcat / Xcode Organizer) or
   non-fatal client_error analytics events on the backend
       │
       ▼
2. Engineer triages manually
       │
       ▼
3. Create GitHub issue / hotfix
       │
       ▼
4. Verify fix in the next release's platform logs
```

## Client-Side Breadcrumb Context

`AnalyticsManager.add_breadcrumb(label, metadata)` records breadcrumbs that `_capture_crash_dump()` attaches to crash reports, and `record_custom_error()` includes the last 10 breadcrumbs (`_get_breadcrumb_summary()`) in non-fatal error reports. Breadcrumb labels in use include `session_start`, `pve_stage_started/completed/failed`, `pvp_match_started/completed/abandoned`, `store_opened`, `purchase_completed`, and `network_error`.

## Testing Crash Reporting

```gdscript
# Trigger a test crash report (does not hard-crash the app)
AnalyticsManager.test_crash()
```

Verify:
1. Local console output (`Analytics: Recorded custom error: Test crash from AnalyticsManager`).
2. The non-fatal path also reaches the backend as a `client_error` analytics event (via `MonitoringManager.report_error`).

## Future Work: Backend Crash Metrics

The recommended end-state (follow-up to issue #1105, not yet implemented — and now the only path to live crash alerting) is a real client→backend crash pipeline:

- A client crash/health RPC so clients report crash reports and near-crash context to the Nakama server,
- server-side `armored_archer_client_crash_*` Prometheus metrics (crash rate, fatal count, affected users) exported by `backend/src`,
- alert rules in `backend/alerts.yml` matching the thresholds above (> 1% crash rate, any fatal), firing through the existing Alertmanager setup.

That would make the thresholds machine-enforced and visible in Grafana alongside server-side health. It is a cross-cutting client+backend+observability feature and needs its own issue.

## Related Documentation

- [DEPLOYMENT_OBSERVABILITY.md](./DEPLOYMENT_OBSERVABILITY.md) — the self-hosted Prometheus/Grafana/Loki stack (server-side only)
- [ANALYTICS_DASHBOARD.md](./ANALYTICS_DASHBOARD.md) — analytics events and dashboards
- [RELEASE_CANDIDATE_CHECKLIST.md](./RELEASE_CANDIDATE_CHECKLIST.md) — RC-H6 crash-free rate gate
