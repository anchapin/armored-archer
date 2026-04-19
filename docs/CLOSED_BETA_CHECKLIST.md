# Armored Archer — Closed-Beta Launch Checklist

**Version**: 1.0
**Created**: 2026-04-18
**Status**: In Progress
**Target Launch**: Closed-Beta

---

## Go / No-Go Criteria

The beta launches only when ALL hard blockers are met. Soft blockers require documented risk acceptance.

### Hard Blockers (MUST pass)

| # | Criterion | Threshold | Owner | Status |
|---|-----------|-----------|-------|--------|
| H1 | Backend health checks pass | 200 OK on all endpoints | Backend Lead | |
| H2 | Error rate under load | < 0.5% across all RPC endpoints | Backend Lead | |
| H3 | P95 latency under load | < 80ms under normal load | Backend Lead | |
| H4 | Zero critical/high bugs | 0 open P0/P1 bugs | QA Lead | |
| H5 | Core gameplay loop complete | Combat, matchmaking, progression working | Client Lead | |
| H6 | User registration & login | New users can sign up and play | Backend Lead | |
| H7 | Crash-free rate | < 1% crash rate on supported devices | QA Lead | |
| H8 | Store builds export | iOS .ipa and Android .aab build without errors | Client Lead | |
| H9 | Rollback procedure tested | Rollback script executes within 5 min | DevOps Lead | |
| H10 | Monitoring dashboards live | Metrics, logs, alerts operational | DevOps Lead | |

### Soft Blockers (SHOULD pass)

| # | Criterion | Threshold | Owner | Status |
|---|-----------|-----------|-------|--------|
| S1 | Performance targets met | 60 FPS flagship, 30+ FPS budget devices | Client Lead | |
| S2 | Accessibility baseline | Text scaling, screen reader support | Design Lead | |
| S3 | Feedback system active | In-app feedback and bug reporting | Community Manager | |
| S4 | Onboarding flow complete | Tutorial and first-match guidance | Product Manager | |
| S5 | Load test passed | 100+ concurrent users | Backend Lead | |
| S6 | Security review complete | No OWASP top-10 vulnerabilities | Security Lead | |

---

## Category 1: Backend & Infrastructure

**Owner**: Backend Lead

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 1.1 | Server build succeeds | `go build` produces `server.so` | `backend/BETA_DEPLOYMENT_CHECKLIST.md` | |
| 1.2 | All backend tests pass | 0 failures in `make backend-test` | `backend/tests/` | |
| 1.3 | Database migrations ready | All migrations applied to beta DB | `backend/data/` | |
| 1.4 | Beta environment configured | `.env.beta`, `docker-compose.beta.yml`, `nakama.beta.yml` verified | `backend/BETA_DEPLOYMENT_CHECKLIST.md` | |
| 1.5 | Production data backed up | Pre-deployment backup confirmed | `backend/BETA_DEPLOYMENT_CHECKLIST.md` | |
| 1.6 | Deployment script tested | `deploy-beta.sh` runs end-to-end | `backend/deploy-beta.sh` | |
| 1.7 | Feature flags configured | Kill switches and canary flags operational | `backend/src/features/` | |
| 1.8 | API rate limiting active | Configured per endpoint | `backend/nakama.beta.yml` | |

---

## Category 2: Client & Game Features

**Owner**: Client Lead

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 2.1 | Combat system functional | Auto-shooter PvE works end-to-end | `scenes/combat/` | |
| 2.2 | PvP matchmaking | Asynchronous turn-based flow completes | `autoloads/matchmaker_manager.gd` | |
| 2.3 | Gear system operational | Equip/unequip, stat calculations correct | `autoloads/gear_manager.gd` | |
| 2.4 | Progression loop | XP, leveling, ability points save and load | `autoloads/player_stats_manager.gd` | |
| 2.5 | Campaign playable | Stage selection, completion, rewards | `autoloads/campaign_manager.gd` | |
| 2.6 | Seasonal content | Leaderboards and seasonal rewards display | `autoloads/season_manager.gd` | |
| 2.7 | Store/IAP flow | RevenueCat sandbox purchases complete | `autoloads/store_manager.gd` | |
| 2.8 | Theme support | Light/dark themes render correctly | `autoloads/theme_manager.gd` | |
| 2.9 | Touch controls responsive | All interactions work on mobile touch | Manual testing | |
| 2.10 | Memory usage within limits | < 512 MB on flagship, < 256 MB on budget | `project.godot` thresholds | |

---

## Category 3: App Store Readiness

**Owner**: Product Manager

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 3.1 | iOS build exports | .ipa exports from Godot editor | `docs/APP_SUBMISSION_CHECKLIST.md` | |
| 3.2 | Android build exports | .aab exports from Godot editor | `docs/APP_SUBMISSION_CHECKLIST.md` | |
| 3.3 | App icons ready | All sizes for iOS and Android | `assets/icons/` | |
| 3.4 | Screenshots captured | 6-10 iOS, 2-8 Android (replace placeholders) | `app_store_assets/` | |
| 3.5 | Store descriptions written | Localized descriptions complete | `app_store_assets/localized_descriptions.md` | |
| 3.6 | Privacy policy published | Accessible at public URL | `PRIVACY_POLICY.md` | |
| 3.7 | Export compliance filed | Documentation complete | `app_store_assets/EXPORT_COMPLIANCE.md` | |
| 3.8 | Age rating determined | 12+ iOS, Teen Android | Content review | |
| 3.9 | iOS TestFlight configured | Internal testing group created | `docs/APP_SUBMISSION_CHECKLIST.md` | |
| 3.10 | Android closed testing | Internal/closed testing track created | `docs/APP_SUBMISSION_CHECKLIST.md` | |

---

## Category 4: Testing & QA

**Owner**: QA Lead

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 4.1 | Smoke tests pass | `make smoke-test` completes green | `backend/BETA_TEST_PLAN.md` | |
| 4.2 | Godot test suite passes | `test/run_all_tests.gd` green | `test/` | |
| 4.3 | Regression suite passes | All regression tests pass | `test/test_*.gd` | |
| 4.4 | Device matrix tested | 3+ iOS devices, 5+ Android devices | `backend/BETA_TEST_PLAN.md` | |
| 4.5 | Critical user journeys verified | Registration, gameplay, progression, IAP | `backend/BETA_TEST_PLAN.md` Sec. 2 | |
| 4.6 | Performance benchmarks recorded | FPS, load times, memory documented | `docs/PERFORMANCE.md` | |
| 4.7 | Accessibility tested | Text scaling, screen reader on device | `autoloads/accessibility_manager.gd` | |
| 4.8 | No flaky tests blocking CI | Flaky test detection clean | `.github/workflows/flaky-tests.yml` | |

---

## Category 5: Monitoring & Observability

**Owner**: DevOps Lead

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 5.1 | Prometheus metrics live | Scraping from beta endpoints | `backend/alerts.beta.yml` | |
| 5.2 | Grafana dashboards loaded | API latency, error rate, player count | `docs/DEPLOYMENT.md` | |
| 5.3 | Alert rules configured | 0.5% error rate threshold, latency alerts | `backend/alerts.beta.yml` | |
| 5.4 | Log aggregation working | Loki receiving structured logs | `backend/BETA_ERROR_MONITORING.md` | |
| 5.5 | On-call rotation defined | Named contacts for P0 response | Launch Operations section below | |
| 5.6 | Runbooks available | Documented procedures for common incidents | `docs/RUNBOOKS/` | |
| 5.7 | Health check endpoints | `/health` and `/healthz` returning 200 | `backend/BETA_DEPLOYMENT_CHECKLIST.md` | |

---

## Category 6: Security & Compliance

**Owner**: Security Lead

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 6.1 | DAST scan clean | No critical/high findings | `.github/workflows/dast-scanning.yml` | |
| 6.2 | Input validation | All RPC inputs validated server-side | Server-authoritative design | |
| 6.3 | Authentication secure | Session tokens handled per compliance | `backend/BETA_STAKEHOLDER_APPROVAL.md` | |
| 6.4 | Data encryption | TLS on all external endpoints | `docs/DEPLOYMENT.md` | |
| 6.5 | Privacy policy accurate | Reflects actual data collection | `PRIVACY_POLICY.md` | |
| 6.6 | IAP compliance | No pay-to-win, follows store guidelines | Store review guidelines | |

---

## Category 7: User Onboarding & Support

**Owner**: Community Manager

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 7.1 | Onboarding guide published | Steps for new beta testers | `backend/BETA_USER_ONBOARDING.md` | |
| 7.2 | Access key system ready | `generate-beta-access-keys.sh` tested | `backend/generate-beta-access-keys.sh` | |
| 7.3 | Feedback system active | In-app reporting and external channel | `backend/BETA_FEEDBACK_SYSTEM.md` | |
| 7.4 | Bug tracking workflow | Triage process documented and followed | `backend/BETA_BUG_TRACKING.md` | |
| 7.5 | Support email configured | Support address active and monitored | Post-launch ops | |
| 7.6 | FAQ prepared | Common questions documented | `docs/APP_SUBMISSION_CHECKLIST.md` | |
| 7.7 | Community channel ready | Discord or equivalent for beta testers | Support plan | |

---

## Category 8: Launch Operations

**Owner**: DevOps Lead

| # | Item | Go Criterion | Reference | Status |
|---|------|-------------|-----------|--------|
| 8.1 | Deployment runbook tested | Step-by-step deployment verified | `docs/DEPLOYMENT.md` | |
| 8.2 | Rollback tested | Rollback completes within 5 minutes | `docs/DEPLOYMENT.md` Rollback section | |
| 8.3 | Progressive rollout configured | Canary deployment pipeline ready | `.github/workflows/aaa-progressive-rollout.yml` | |
| 8.4 | Launch communication ready | Announcement copy and channels prepared | Product Manager | |
| 8.5 | Post-launch monitoring plan | 48-hour monitoring window defined | `backend/BETA_STAKEHOLDER_APPROVAL.md` | |
| 8.6 | Incident response plan | Escalation paths documented | `docs/RUNBOOKS/` | |

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
| Beta Stakeholder Approval | `backend/BETA_STAKEHOLDER_APPROVAL.md` |
| Beta Error Monitoring | `backend/BETA_ERROR_MONITORING.md` |
| Beta Performance Results | `backend/BETA_PERFORMANCE_RESULTS.md` |
| Beta Bug Tracking | `backend/BETA_BUG_TRACKING.md` |
| Beta Feedback System | `backend/BETA_FEEDBACK_SYSTEM.md` |
| Beta User Onboarding | `backend/BETA_USER_ONBOARDING.md` |
| App Submission Checklist | `docs/APP_SUBMISSION_CHECKLIST.md` |
| Deployment Guide | `docs/DEPLOYMENT.md` |
| Performance Guide | `docs/PERFORMANCE.md` |
| Runbooks | `docs/RUNBOOKS/` |
