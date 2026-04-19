# Armored Archer — Release Candidate Checklist & Sign-Off Package

**Version**: v3.6.0-rc.1
**Created**: 2026-04-19
**Target Release**: v3.6.0 (Soft Launch)
**Status**: Pending Verification
**Sprint**: Sprint 8 — Soft Launch Tuning and Release Candidate

---

## Overview

This document is the release candidate (RC) checklist and sign-off package for Armored Archer v3.6.0. It builds on the Closed Beta Checklist (`docs/CLOSED_BETA_CHECKLIST.md`) and adds RC-specific verification gates.

A release candidate is **ready for deployment** when:
1. All hard blockers are resolved
2. All stakeholder sign-offs are collected
3. The deployment plan is reviewed and approved
4. Rollback has been tested in the target environment

---

## Go / No-Go Criteria

### Hard Blockers (MUST pass — any open = NO-GO)

| # | Criterion | Threshold | Owner | Status | Verified |
|---|-----------|-----------|-------|--------|----------|
| RC-H1 | Zero P0/P1 bugs open | 0 critical or high-severity bugs | QA Lead | Pending | |
| RC-H2 | Backend health checks pass | 200 OK on `/health` and `/healthz` | Backend Lead | Done | |
| RC-H3 | Error rate under load | < 0.5% across all RPC endpoints | Backend Lead | Pending | |
| RC-H4 | P95 latency under load | < 80ms under normal load | Backend Lead | Pending | |
| RC-H5 | Crash-free rate | < 1% crash rate on supported devices | QA Lead | Pending | |
| RC-H6 | Store builds export cleanly | iOS .ipa and Android .aab export without errors | Client Lead | Pending | |
| RC-H7 | All CI pipelines green | `ci.yml`, `test.yml`, `cd.yml` all passing | DevOps Lead | Done | |
| RC-H8 | Database migrations verified | All migrations apply cleanly to production schema | Backend Lead | Done | |
| RC-H9 | Rollback procedure tested | Rollback completes within 5 min in staging | DevOps Lead | Pending | |
| RC-H10 | Security scan clean | No critical/high DAST findings | Security Lead | Pending | |

### Soft Blockers (SHOULD pass — require documented risk acceptance if open)

| # | Criterion | Threshold | Owner | Status | Risk Accepted |
|---|-----------|-----------|-------|--------|---------------|
| RC-S1 | Performance targets met | 60 FPS flagship, 30+ FPS budget devices | Client Lead | Done | |
| RC-S2 | Device matrix coverage | 3+ iOS, 5+ Android device types tested | QA Lead | Pending | |
| RC-S3 | Load test passed | 100+ concurrent users sustained | Backend Lead | Pending | |
| RC-S4 | Accessibility baseline | Text scaling + screen reader on device | Design Lead | Pending | |
| RC-S5 | Onboarding flow tested | Tutorial + first-match guidance on device | Product Manager | Done | |
| RC-S6 | Monitoring dashboards live | Metrics, logs, alerts operational in prod | DevOps Lead | Done | |
| RC-S7 | Feedback system active | In-app reporting + external channel live | Community Mgr | Done | |

---

## Category 1: Code Quality & Test Verification

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 1.1 | Lint passes (GDScript) | `gdlint autoloads/ scenes/ scripts/ test/` | Pending | |
| 1.2 | Lint passes (TypeScript) | `make backend-lint` | Done | |
| 1.3 | Type checking clean | `make backend-check` | Done | |
| 1.4 | Godot test suite green | `godot --headless --script res://test/run_all_tests.gd` | Done | 80+ test files |
| 1.5 | Backend test suite green | `make backend-test` | Done | Unit + integration |
| 1.6 | Regression suite green | Sprint 7 regression runner | Done | |
| 1.7 | No flaky tests blocking CI | Flaky test detection workflow clean | Done | |
| 1.8 | Test coverage threshold met | 73.5%+ backend coverage | Done | |
| 1.9 | Tech debt within limits | `make tech-debt-check` | Pending | |
| 1.10 | Bundle size within budget | `make bundle-size-check` | Pending | |

---

## Category 2: Backend & Infrastructure

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 2.1 | Backend build succeeds | `make backend-build` | Done | TypeScript → JS |
| 2.2 | Production Docker images build | `docker-compose build` | Pending | |
| 2.3 | Database migrations apply cleanly | `make backend-migrate` against prod schema | Done | |
| 2.4 | Production env configured | `.env.production` verified, secrets in place | Pending | |
| 2.5 | Feature flags configured | Kill switches + canary flags operational | Pending | `backend/src/features/` |
| 2.6 | API rate limiting active | Per-endpoint limits configured | Pending | |
| 2.7 | Circuit breakers functional | Circuit breaker pattern active on RPCs | Done | |
| 2.8 | Structured logging operational | Loki receiving structured logs | Done | |
| 2.9 | Health endpoints responding | `/health`, `/healthz` return 200 | Done | |
| 2.10 | Prometheus metrics exporting | `/metrics` endpoint scraped by Prometheus | Done | |

---

## Category 3: Client & Game Features (Final Verification)

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 3.1 | Combat system (PvE) | Manual playthrough: auto-shooter works E2E | Pending | |
| 3.2 | PvP matchmaking | Async duel lifecycle completes with punch-up mechanics | Pending | |
| 3.3 | Gear system | Equip/unequip, stat calculations, synergy system | Pending | |
| 3.4 | Progression loop | XP, leveling, ability points save/load correctly | Pending | |
| 3.5 | Campaign progression | Stage selection, completion, rewards, boss fights | Pending | |
| 3.6 | Seasonal content | Leaderboards, rewards, soft reset, prestige | Pending | |
| 3.7 | Store/IAP flow | RevenueCat sandbox purchase completes | Pending | |
| 3.8 | Gem system | Gems purchase cosmetics only — zero combat impact | Done | Enforced server-side |
| 3.9 | Theme support | Light/dark themes render on device | Pending | |
| 3.10 | Touch controls | Dual joystick, aim smoothing, safe areas on device | Done | |
| 3.11 | Memory within limits | < 512 MB flagship, < 256 MB budget | Pending | |
| 3.12 | Gameplay balance verified | Stage pacing, drop rates, risk/reward tuned | Done | Sprint 8 tuning pass |

---

## Category 4: App Store Readiness

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 4.1 | iOS .ipa exports | Godot editor export with signing | Pending | Needs Apple Developer cert |
| 4.2 | Android .aab exports | Godot editor export with signing | Pending | Needs keystore |
| 4.3 | App icons all sizes | 128-1024px for both platforms | Done | |
| 4.4 | Screenshots captured | 6-10 iOS, 2-8 Android (real device) | Pending | Replace placeholders |
| 4.5 | Store descriptions | Localized in 10 languages | Done | |
| 4.6 | Privacy policy published | Accessible at public URL | Done | GDPR, CCPA, COPPA |
| 4.7 | Export compliance filed | Documentation complete | Done | |
| 4.8 | Age rating set | 12+ iOS, Teen Android | Done | Cosmetic-only monetization |
| 4.9 | iOS TestFlight configured | Internal testing group active | Pending | |
| 4.10 | Android closed testing track | Internal/closed testing track created | Pending | |
| 4.11 | Release notes for stores | Store-specific release notes written | Pending | |
| 4.12 | Terms of service published | Accessible at public URL | Done | |

---

## Category 5: Security & Compliance

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 5.1 | DAST scan clean | `.github/workflows/dast-scanning.yml` results | Pending | |
| 5.2 | Server-authoritative design | All combat/progression calculated server-side | Done | |
| 5.3 | Input validation complete | All RPC inputs validated server-side | Done | |
| 5.4 | Authentication secure | Nakama session tokens handled correctly | Done | |
| 5.5 | TLS on external endpoints | All external traffic encrypted | Pending | |
| 5.6 | IAP compliance verified | No pay-to-win, follows store guidelines | Done | Cosmetic-only gems |
| 5.7 | Audit logging operational | Purchase and entitlement logs complete | Done | |
| 5.8 | Secrets management | All secrets in env vars, none in code | Pending | |
| 5.9 | Anti-cheat functional | Server-side validation active | Done | |

---

## Category 6: Monitoring & Operations

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 6.1 | Prometheus metrics live | Scraping from production endpoints | Pending | |
| 6.2 | Grafana dashboards loaded | API latency, error rate, player count | Done | |
| 6.3 | Alert rules configured | Error rate + latency thresholds | Done | |
| 6.4 | On-call rotation defined | Named contacts for P0 response | Pending | |
| 6.5 | Runbooks available | Incident procedures documented | In Progress | `docs/RUNBOOKS/` |
| 6.6 | Rollback tested in staging | Rollback completes within 5 min | Pending | |
| 6.7 | Progressive rollout configured | Canary deployment pipeline ready | Done | |
| 6.8 | Post-launch monitoring plan | 48-hour monitoring window defined | Done | |
| 6.9 | Analytics funnel tracking | Install→PvE→PvP→purchase conversion tracked | Done | Sprint 8 analytics |
| 6.10 | Crash alert thresholds configured | Crash rate alerts operational | Done | |

---

## Category 7: Documentation & Communication

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 7.1 | Release notes prepared | `docs/RELEASE_NOTES_v3.6.0.md` complete | Pending | This deliverable |
| 7.2 | Changelog updated | `backend/CHANGELOG.md` reflects v3.6.0 | Pending | |
| 7.3 | Deployment plan reviewed | `docs/DEPLOYMENT.md` + deployment steps below | Pending | |
| 7.4 | Support playbook ready | `docs/BETA_SUPPORT_PLAYBOOK.md` current | Done | |
| 7.5 | FAQ updated | Common questions documented for launch | Done | |
| 7.6 | Launch communication drafted | Announcement copy prepared | Pending | |
| 7.7 | Known issues documented | Any shipped-known issues listed | Pending | |

---

## Deployment Plan

### Pre-Deployment (T-24h)

| Step | Action | Owner | Done |
|------|--------|-------|------|
| 1 | Confirm all hard blockers resolved | QA Lead | |
| 2 | Create production backup | Backend Lead | |
| 3 | Verify `.env.production` secrets | DevOps Lead | |
| 4 | Tag release candidate: `v3.6.0-rc.1` | DevOps Lead | |
| 5 | Build production Docker images | DevOps Lead | |
| 6 | Run smoke tests against staging | QA Lead | |
| 7 | Notify on-call rotation of launch window | DevOps Lead | |

### Deployment (T-0)

| Step | Action | Owner | Done |
|------|--------|-------|------|
| 1 | Apply database migrations to production | Backend Lead | |
| 2 | Deploy backend containers (canary: 10%) | DevOps Lead | |
| 3 | Verify canary health for 15 minutes | DevOps Lead | |
| 4 | Scale to 50% traffic | DevOps Lead | |
| 5 | Verify 50% health for 15 minutes | DevOps Lead | |
| 6 | Scale to 100% traffic | DevOps Lead | |
| 7 | Submit app to iOS App Store review | Client Lead | |
| 8 | Submit app to Google Play review | Client Lead | |
| 9 | Verify monitoring dashboards | DevOps Lead | |

### Post-Deployment (T+1h to T+48h)

| Step | Action | Owner | Done |
|------|--------|-------|------|
| 1 | Monitor error rates for 1 hour | On-call | |
| 2 | Monitor crash rates for 1 hour | On-call | |
| 3 | Verify core user journeys E2E | QA Lead | |
| 4 | Monitor conversion funnel | Product Manager | |
| 5 | T+24h: Review all metrics, confirm stable | DevOps Lead | |
| 6 | T+48h: Close monitoring window, stand down | DevOps Lead | |

### Rollback Procedure

If a critical issue is discovered:

1. **Backend**: `docker-compose down && docker-compose up -d --build <previous-tag>`
2. **Database**: Restore from pre-deployment backup (documented in `docs/DEPLOYMENT.md` Rollback section)
3. **Client**: Phased rollback via store (Google Play: halt rollout, iOS: expedited review for revert)
4. **Communication**: Post incident notice within 15 minutes

Target rollback time: **< 5 minutes** (backend), **< 1 hour** (client, store-dependent)

---

## Known Issues (Shipped With)

| # | Issue | Severity | Mitigation | Tracked In |
|---|-------|----------|------------|------------|
| 1 | _(To be populated during RC verification)_ | | | |

---

## Stakeholder Sign-Off

Each stakeholder must review their category, verify readiness, and sign below.

| Role | Name | Category Reviewed | Approval | Date | Notes |
|------|------|-------------------|----------|------|-------|
| Technical Lead | | All categories | PENDING | | |
| Backend Lead | | Cat 1, 2, 5 | PENDING | | |
| Client Lead | | Cat 3, 4 | PENDING | | |
| QA Lead | | Cat 1, 4 | PENDING | | |
| DevOps Lead | | Cat 2, 6 | PENDING | | |
| Security Lead | | Cat 5 | PENDING | | |
| Product Manager | | Cat 4, 7 | PENDING | | |
| Design Lead | | Cat 3 (UX) | PENDING | | |
| Community Manager | | Cat 7 | PENDING | | |

### Decision

**RELEASE DECISION**: GO / NO-GO / CONDITIONAL GO

**Conditions (if CONDITIONAL GO)**:
-

**Rationale**:

**Sign-off Date**: _______________

**Release Manager Signature**: _______________

---

## Appendix: References

| Document | Location |
|----------|----------|
| Closed Beta Checklist | `docs/CLOSED_BETA_CHECKLIST.md` |
| Release Notes v3.6.0 | `docs/RELEASE_NOTES_v3.6.0.md` |
| Deployment Guide | `docs/DEPLOYMENT.md` |
| App Submission Checklist | `docs/APP_SUBMISSION_CHECKLIST.md` |
| Performance Guide | `docs/PERFORMANCE.md` |
| Security Documentation | `docs/SECURITY.md` |
| Runbooks | `docs/RUNBOOKS/` |
| Beta Support Playbook | `docs/BETA_SUPPORT_PLAYBOOK.md` |
| Backend Changelog | `backend/CHANGELOG.md` |
| Mobile Beta Test Plan | `docs/MOBILE_BETA_TEST_PLAN.md` |
| CI Workflows | `.github/workflows/` |
