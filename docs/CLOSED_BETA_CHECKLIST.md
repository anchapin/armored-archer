# Armored Archer — Closed-Beta Launch Checklist

**Version**: 1.1
**Created**: 2026-04-18
**Last Updated**: 2026-04-19
**Status**: In Progress
**Target Launch**: Closed-Beta

---

## Go / No-Go Criteria

The beta launches only when ALL hard blockers are met. Soft blockers require documented risk acceptance.

### Hard Blockers (MUST pass)

| # | Criterion | Threshold | Owner | Status |
|---|-----------|-----------|-------|--------|
| H1 | Backend health checks pass | 200 OK on all endpoints | Backend Lead | Done — `health_monitor.ts` implements `/health` and `/healthz` |
| H2 | Error rate under load | < 0.5% across all RPC endpoints | Backend Lead | In Progress — monitoring in place, load test pending |
| H3 | P95 latency under load | < 80ms under normal load | Backend Lead | In Progress — Prometheus metrics configured |
| H4 | Zero critical/high bugs | 0 open P0/P1 bugs | QA Lead | Not Started — requires full regression pass |
| H5 | Core gameplay loop complete | Combat, matchmaking, progression working | Client Lead | Done — CombatManager, ShootingManager, AutoAimManager, CampaignManager all functional |
| H6 | User registration & login | New users can sign up and play | Backend Lead | Done — Nakama auth with authentication integration tests passing |
| H7 | Crash-free rate | < 1% crash rate on supported devices | QA Lead | In Progress — Firebase Crashlytics integrated, monitoring active |
| H8 | Store builds export | iOS .ipa and Android .aab build without errors | Client Lead | In Progress — export presets exist, signing config needed |
| H9 | Rollback procedure tested | Rollback script executes within 5 min | DevOps Lead | Not Started — script exists in deployment docs |
| H10 | Monitoring dashboards live | Metrics, logs, alerts operational | DevOps Lead | Done — Prometheus + Grafana + Loki stack configured |

### Soft Blockers (SHOULD pass)

| # | Criterion | Threshold | Owner | Status |
|---|-----------|-----------|-------|--------|
| S1 | Performance targets met | 60 FPS flagship, 30+ FPS budget devices | Client Lead | Done — PerformanceProfiler with device tier system, object pooling, aim smoothing |
| S2 | Accessibility baseline | Text scaling, screen reader support | Design Lead | Done — AccessibilityManager with text scaling and screen reader support |
| S3 | Feedback system active | In-app feedback and bug reporting | Community Manager | Done — feedback collector added in sprint 6 |
| S4 | Onboarding flow complete | Tutorial and first-match guidance | Product Manager | Done — TutorialManager + beta welcome screen |
| S5 | Load test passed | 100+ concurrent users | Backend Lead | Not Started |
| S6 | Security review complete | No OWASP top-10 vulnerabilities | Security Lead | In Progress — server-authoritative design, input validation in place |

---

## Category 1: Backend & Infrastructure

**Owner**: Backend Lead

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 1.1 | Server build succeeds | `go build` produces `server.so` | `backend/BETA_DEPLOYMENT_CHECKLIST.md` | Done — TypeScript build via `make backend-build` |
| 1.2 | All backend tests pass | 0 failures in `make backend-test` | `backend/tests/` | Done — comprehensive unit + integration tests |
| 1.3 | Database migrations ready | All migrations applied to beta DB | `backend/data/` | Done — migration system in place |
| 1.4 | Beta environment configured | `.env.beta`, `docker-compose.beta.yml`, `nakama.beta.yml` verified | `backend/BETA_DEPLOYMENT_CHECKLIST.md` | In Progress — configs exist, need beta env validation |
| 1.5 | Production data backed up | Pre-deployment backup confirmed | `backend/BETA_DEPLOYMENT_CHECKLIST.md` | Not Started — pre-launch task |
| 1.6 | Deployment script tested | `deploy-beta.sh` runs end-to-end | `backend/deploy-beta.sh` | Not Started |
| 1.7 | Feature flags configured | Kill switches and canary flags operational | `backend/src/features/` | In Progress — feature flag system exists |
| 1.8 | API rate limiting active | Configured per endpoint | `backend/nakama.beta.yml` | In Progress |

---

## Category 2: Client & Game Features

**Owner**: Client Lead

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 2.1 | Combat system functional | Auto-shooter PvE works end-to-end | `scenes/combat/` | Done |
| 2.2 | PvP matchmaking | Asynchronous turn-based flow completes | `autoloads/MatchmakerManager.gd` | Done — async duel lifecycle with punch-up mechanics |
| 2.3 | Gear system operational | Equip/unequip, stat calculations correct | `autoloads/GearManager.gd` | Done — gear registry, loadout, synergy system |
| 2.4 | Progression loop | XP, leveling, ability points save and load | `autoloads/PlayerStatsManager.gd` | Done |
| 2.5 | Campaign playable | Stage selection, completion, rewards | `autoloads/CampaignManager.gd` | Done — stage progression, boss fights |
| 2.6 | Seasonal content | Leaderboards and seasonal rewards display | `autoloads/SeasonManager.gd` | Done — rank tiers, soft reset, prestige |
| 2.7 | Store/IAP flow | RevenueCat sandbox purchases complete | `autoloads/StoreManager.gd` | Done — 3 gem packs, pending purchase queue, health checks |
| 2.8 | Theme support | Light/dark themes render correctly | `autoloads/ThemeManager.gd` | Done |
| 2.9 | Touch controls responsive | All interactions work on mobile touch | Manual testing | Done — dual joystick, aim smoothing, safe area handling, haptic feedback |
| 2.10 | Memory usage within limits | < 512 MB on flagship, < 256 MB on budget | `project.godot` thresholds | Done — memory monitoring re-enabled, leak detection active |

---

## Category 3: App Store Readiness

**Owner**: Product Manager

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 3.1 | iOS build exports | .ipa exports from Godot editor | `docs/APP_SUBMISSION_CHECKLIST.md` | In Progress — export presets exist, signing needed |
| 3.2 | Android build exports | .aab exports from Godot editor | `docs/APP_SUBMISSION_CHECKLIST.md` | In Progress — export presets exist, signing needed |
| 3.3 | App icons ready | All sizes for iOS and Android | `assets/icons/` | Done — 128-1024px icons for both platforms |
| 3.4 | Screenshots captured | 6-10 iOS, 2-8 Android (replace placeholders) | `app_store_assets/` | In Progress — generation scripts exist, need real device captures |
| 3.5 | Store descriptions written | Localized descriptions complete | `app_store_assets/localized_descriptions.md` | Done — 10 language localizations |
| 3.6 | Privacy policy published | Accessible at public URL | `PRIVACY_POLICY.md` | Done — GDPR, CCPA, COPPA compliant |
| 3.7 | Export compliance filed | Documentation complete | `app_store_assets/EXPORT_COMPLIANCE.md` | Done |
| 3.8 | Age rating determined | 12+ iOS, Teen Android | Content review | Done — cosmetic-only monetization |
| 3.9 | iOS TestFlight configured | Internal testing group created | `docs/APP_SUBMISSION_CHECKLIST.md` | Not Started |
| 3.10 | Android closed testing | Internal/closed testing track created | `docs/APP_SUBMISSION_CHECKLIST.md` | Not Started |

---

## Category 4: Testing & QA

**Owner**: QA Lead

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 4.1 | Smoke tests pass | `make smoke-test` completes green | `backend/BETA_TEST_PLAN.md` | Done |
| 4.2 | Godot test suite passes | `test/run_all_tests.gd` green | `test/` | Done — 80+ test files |
| 4.3 | Regression suite passes | All regression tests pass | `test/test_*.gd` | Done — Sprint 7 regression runner added |
| 4.4 | Device matrix tested | 3+ iOS devices, 5+ Android devices | `backend/BETA_TEST_PLAN.md` | Not Started — needs physical devices |
| 4.5 | Critical user journeys verified | Registration, gameplay, progression, IAP | `backend/BETA_TEST_PLAN.md` Sec. 2 | Done — E2E test suite covers core journeys |
| 4.6 | Performance benchmarks recorded | FPS, load times, memory documented | `docs/PERFORMANCE.md` | In Progress — profiler functional, needs device benchmarks |
| 4.7 | Accessibility tested | Text scaling, screen reader on device | `autoloads/AccessibilityManager.gd` | In Progress — code exists, needs device testing |
| 4.8 | No flaky tests blocking CI | Flaky test detection clean | `.github/workflows/flaky-tests.yml` | Done |

---

## Category 5: Monitoring & Observability

**Owner**: DevOps Lead

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 5.1 | Prometheus metrics live | Scraping from beta endpoints | `backend/alerts.beta.yml` | Done — health_monitor.ts exports Prometheus metrics |
| 5.2 | Grafana dashboards loaded | API latency, error rate, player count | `docs/DEPLOYMENT.md` | Done |
| 5.3 | Alert rules configured | 0.5% error rate threshold, latency alerts | `backend/alerts.beta.yml` | Done |
| 5.4 | Log aggregation working | Loki receiving structured logs | `backend/BETA_ERROR_MONITORING.md` | Done |
| 5.5 | On-call rotation defined | Named contacts for P0 response | Launch Operations section below | Not Started |
| 5.6 | Runbooks available | Documented procedures for common incidents | `docs/RUNBOOKS/` | In Progress |
| 5.7 | Health check endpoints | `/health` and `/healthz` returning 200 | `backend/BETA_DEPLOYMENT_CHECKLIST.md` | Done |

---

## Category 6: Security & Compliance

**Owner**: Security Lead

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 6.1 | DAST scan clean | No critical/high findings | `.github/workflows/dast-scanning.yml` | In Progress |
| 6.2 | Input validation | All RPC inputs validated server-side | Server-authoritative design | Done — all combat/progression calculated server-side |
| 6.3 | Authentication secure | Session tokens handled per compliance | `backend/BETA_STAKEHOLDER_APPROVAL.md` | Done — Nakama session management |
| 6.4 | Data encryption | TLS on all external endpoints | `docs/DEPLOYMENT.md` | In Progress |
| 6.5 | Privacy policy accurate | Reflects actual data collection | `PRIVACY_POLICY.md` | Done — no tracking, no ads SDK, cosmetic-only monetization |
| 6.6 | IAP compliance | No pay-to-win, follows store guidelines | Store review guidelines | Done — gem packs are cosmetic-only with zero combat stats |

---

## Category 7: User Onboarding & Support

**Owner**: Community Manager

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 7.1 | Onboarding guide published | Steps for new beta testers | `backend/BETA_USER_ONBOARDING.md` | Done |
| 7.2 | Access key system ready | `generate-beta-access-keys.sh` tested | `backend/generate-beta-access-keys.sh` | Done |
| 7.3 | Feedback system active | In-app reporting and external channel | `backend/BETA_FEEDBACK_SYSTEM.md` | Done — feedback collector added in sprint 6 |
| 7.4 | Bug tracking workflow | Triage process documented and followed | `backend/BETA_BUG_TRACKING.md` | Done |
| 7.5 | Support email configured | Support address active and monitored | Post-launch ops | Not Started |
| 7.6 | FAQ prepared | Common questions documented | `docs/BETA_SUPPORT_PLAYBOOK.md` | Done — support/FAQ playbook added in sprint 7 |
| 7.7 | Community channel ready | Discord or equivalent for beta testers | Support plan | Not Started |

---

## Category 8: Launch Operations

**Owner**: DevOps Lead

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 8.1 | Deployment runbook tested | Step-by-step deployment verified | `docs/DEPLOYMENT.md` | Done |
| 8.2 | Rollback tested | Rollback completes within 5 minutes | `docs/DEPLOYMENT.md` Rollback section | Not Started |
| 8.3 | Progressive rollout configured | Canary deployment pipeline ready | `.github/workflows/aaa-progressive-rollout.yml` | Done |
| 8.4 | Launch communication ready | Announcement copy and channels prepared | Product Manager | Not Started |
| 8.5 | Post-launch monitoring plan | 48-hour monitoring window defined | `backend/BETA_STAKEHOLDER_APPROVAL.md` | Done — MonitoringManager with lifecycle hooks |
| 8.6 | Incident response plan | Escalation paths documented | `docs/RUNBOOKS/` | In Progress |

---

## Stakeholder Sign-Off

| Role | Name | Approval | Date |
|------|------|----------|------|
| Technical Lead | | | |
| Product Manager | | | |
| QA Lead | | | |
| DevOps Lead | | | |
| Design Lead | | | |
| Security Lead | | | |

**Decision**: GO / NO-GO (circle one)

**Rationale**:

**Sign-off Date**: _______________

---

## References

| Document | Location |
|----------|----------|
| Beta Deployment Checklist | `backend/BETA_DEPLOYMENT_CHECKLIST.md` |
| Beta Test Plan | `backend/BETA_TEST_PLAN.md` |
| Mobile Beta Test Plan | `docs/MOBILE_BETA_TEST_PLAN.md` |
| Beta Stakeholder Approval | `backend/BETA_STAKEHOLDER_APPROVAL.md` |
| Beta Error Monitoring | `backend/BETA_ERROR_MONITORING.md` |
| Beta Performance Results | `backend/BETA_PERFORMANCE_RESULTS.md` |
| Beta Bug Tracking | `backend/BETA_BUG_TRACKING.md` |
| Beta Feedback System | `backend/BETA_FEEDBACK_SYSTEM.md` |
| Beta User Onboarding | `backend/BETA_USER_ONBOARDING.md` |
| Beta Support Playbook | `docs/BETA_SUPPORT_PLAYBOOK.md` |
| App Submission Checklist | `docs/APP_SUBMISSION_CHECKLIST.md` |
| Deployment Guide | `docs/DEPLOYMENT.md` |
| Performance Guide | `docs/PERFORMANCE.md` |
| Runbooks | `docs/RUNBOOKS/` |
| Sprint 7 Regression Runner | `test/regression_sprint7.gd` |
