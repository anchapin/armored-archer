# Armored Archer — Release Candidate Checklist & Sign-Off Package

**Version**: v3.6.0-rc.1
**Created**: 2026-04-19 (updated 2026-08-16)
**Target Release**: v3.6.0 (Soft Launch)
**Status**: Pending Verification
**Sprint**: Sprint 8 — Soft Launch Tuning and Release Candidate
**Tracking**: GitHub issue #739

---

## Overview

This document is the release candidate (RC) checklist and sign-off package for Armored Archer v3.6.0 — a Godot 4.6 mobile archery auto-shooter with a server-authoritative Nakama (TypeScript) backend, PostgreSQL database, Firebase authentication, and RevenueCat in-app purchases.

It builds on the Closed Beta Checklist (`docs/CLOSED_BETA_CHECKLIST.md`) and adds RC-specific verification gates, trust-system blockers, a staged rollout plan, and the formal sign-off record.

A release candidate is **ready for deployment** when:

1. All five RC readiness gates (below) are green
2. All hard blockers are resolved, including all combat-trust blockers (zero open)
3. All stakeholder sign-offs are collected (Sign-Off table at the end of this document)
4. The deployment/rollout plan is reviewed and approved
5. Rollback has been tested in the target environment (staging minimum)

---

## 1. RC Readiness Gates

Every gate must be **GREEN** before a build is declared RC. A single red gate = NO-GO.

### Gate A — Client Build

| # | Gate Criterion | Verification Method | Owner | Status |
|---|----------------|---------------------|-------|--------|
| A1 | Godot 4.6 project imports cleanly | `godot4 --headless --quit --import` exits without errors | Client Lead | Pending |
| A2 | Full GDScript test suite green | `./scripts/local-godot-tests.sh` (check output for `Failed: 0` — exit code is unreliable) | Client Lead | Pending |
| A3 | gdlint clean | `./scripts/local-godot-tests.sh --lint` | Client Lead | Pending |
| A4 | iOS .ipa exports with signing | Godot editor export preset, Apple Developer cert | Client Lead | Pending |
| A5 | Android .aab exports with signing | Godot editor export preset, release keystore | Client Lead | Pending |
| A6 | Exported builds install & launch on device | Manual install on at least one iOS and one Android physical device | QA Lead | Pending |

### Gate B — Backend

| # | Gate Criterion | Verification Method | Owner | Status |
|---|----------------|---------------------|-------|--------|
| B1 | Backend lint clean | `make backend-lint` (eslint, zero warnings) | Backend Lead | Done |
| B2 | Typecheck clean | `make backend-check` (tsc --noEmit) | Backend Lead | Done |
| B3 | Full bundle builds + validates | `cd backend && npm run build:full` (tsc + webpack bundle + validation) | Backend Lead | Pending |
| B4 | Backend unit tests green | `cd backend && npm test` (colocated `src/**/__tests__`) | Backend Lead | Done |
| B5 | Integration tests green (stack up) | `make services-start` then `cd backend && npm run test:integration` | Backend Lead | Pending |
| B6 | Health endpoints respond | `curl http://localhost:7350/health` and `/healthz` return 200 (`make services-health`) | Backend Lead | Done |
| B7 | Quick smoke test passes | `make smoke-test-quick` | QA Lead | Pending |

### Gate C — Database Migrations

| # | Gate Criterion | Verification Method | Owner | Status |
|---|----------------|---------------------|-------|--------|
| C1 | All migrations apply cleanly | `make backend-migrate` (stack must be running) against a prod-schema copy | Backend Lead | Pending |
| C2 | Schema tests green | `cd backend && npm run test:schema` | Backend Lead | Pending |
| C3 | Schema matches `DATABASE_SCHEMA.md` | Review `backend/data/*.sql` against `backend/DATABASE_SCHEMA.md`; human review required (schema changes always require human review per AGENTS.md) | Backend Lead | Pending |
| C4 | Pre-deployment backup procedure tested | Backup taken and restore rehearsed in staging | DevOps Lead | Pending |
| C5 | Destructive/irreversible migrations identified | Any non-additive migration flagged with a rollback story | Backend Lead | Pending |

### Gate D — Infrastructure & Observability

| # | Gate Criterion | Verification Method | Owner | Status |
|---|----------------|---------------------|-------|--------|
| D1 | Full local stack healthy | `make services-start` then `make services-health` (Nakama, PostgreSQL, Redis, Prometheus, Grafana, Loki, Alertmanager) | DevOps Lead | Pending |
| D2 | Prometheus metrics scraped | `/metrics` endpoint scraped; `armored_archer_*` series present | DevOps Lead | Done |
| D3 | Grafana dashboards loaded | API latency / error rate / player count + Progressive Rollout panel (`backend/grafana/provisioning/dashboards/`) | DevOps Lead | Done |
| D4 | Alert rules active | Error-rate + latency + infra alert rules fire to Alertmanager (`backend/alerts.yml`); client crash thresholds are monitored via the Firebase Crashlytics console only (`docs/CRASH_ALERT_THRESHOLDS.md`) | DevOps Lead | Done |
| D5 | Structured logs flowing to Loki | Loki receives winston structured logs from the server | DevOps Lead | Done |
| D6 | Runbooks in place | `docs/runbooks/` (GameServerDown, HighErrorRate, HighLatency, HighMemoryUsage, DiskSpaceLow, DatabaseConnectionPoolExhausted) reviewed by on-call | DevOps Lead | Pending |
| D7 | Rollback rehearsed | Blue/green traffic switch + DB restore completes within 5 minutes in staging (per `DEPLOYMENT.md` Rollback Procedure) | DevOps Lead | Pending |
| D8 | Production env vars verified | `.env.production` secrets present, validated by `backend/start.sh`; no secrets in repo (`docs/SECRETS_MANAGEMENT.md`) | DevOps Lead | Pending |

### Gate E — Compliance

| # | Gate Criterion | Verification Method | Owner | Status |
|---|----------------|---------------------|-------|--------|
| E1 | Privacy policy published | Public URL live; matches `docs/PRIVACY_COMPLIANCE.md` (GDPR, CCPA, COPPA) | Product Manager | Done |
| E2 | Terms of service published | Public URL live (`docs/TERMS_OF_SERVICE.md`) | Product Manager | Done |
| E3 | Export compliance filed | Documentation complete (`docs/EXPORT_COMPLIANCE.md`) | Product Manager | Done |
| E4 | Age ratings set | 12+ iOS, Teen Android; cosmetic-only monetization documented | Product Manager | Done |
| E5 | IAP policy compliant | Gems purchase cosmetics only — zero combat impact, enforced server-side; no pay-to-win (`docs/IAP_SECURITY_AUDIT.md`) | Security Lead | Done |
| E6 | TLS on all external endpoints | Firebase auth, Nakama API, RevenueCat traffic encrypted in production | Security Lead | Pending |
| E7 | DAST scan clean | `.github/workflows/dast-scanning.yml` run with no critical/high findings | Security Lead | Pending |
| E8 | Secrets audit clean | No credentials in code or bundles; `docs/SECRETS_ROTATION.md` schedule current | Security Lead | Pending |

---

## 2. Go / No-Go Criteria

### Hard Blockers (MUST pass — any open = NO-GO)

| # | Criterion | Threshold | Owner | Status | Verified By / Date |
|---|-----------|-----------|-------|--------|--------------------|
| RC-H1 | Zero P0/P1 bugs open | 0 critical or high-severity bugs in tracker | QA Lead | Pending | |
| RC-H2 | All five readiness gates green | Gates A–E all green | Release Manager | Pending | |
| RC-H3 | Combat-trust blockers resolved | 0 open items in Section 3 | Technical Lead | Pending | |
| RC-H4 | Error rate under load | < 0.5% across all RPC endpoints | Backend Lead | Pending | |
| RC-H5 | P95 latency under load | < 80ms under normal load | Backend Lead | Pending | |
| RC-H6 | Crash-free rate | < 1% crash rate on supported devices | QA Lead | Pending | |
| RC-H7 | Store builds export cleanly | Signed iOS .ipa and Android .aab export without errors | Client Lead | Pending | |
| RC-H8 | All CI workflows green | `ci.yml`, `test.yml`, `cd.yml` passing on the RC tag | DevOps Lead | Pending | |
| RC-H9 | Database migrations verified | All migrations apply cleanly to a production-schema copy | Backend Lead | Pending | |
| RC-H10 | Rollback procedure tested | Rollback completes within 5 min in staging | DevOps Lead | Pending | |
| RC-H11 | Security scan clean | No critical/high DAST findings | Security Lead | Pending | |

### Soft Blockers (SHOULD pass — require documented risk acceptance if open)

| # | Criterion | Threshold | Owner | Status | Risk Accepted By |
|---|-----------|-----------|-------|--------|------------------|
| RC-S1 | Performance targets met | 60 FPS flagship, 30+ FPS budget devices | Client Lead | Done | |
| RC-S2 | Device matrix coverage | 3+ iOS, 5+ Android device types tested | QA Lead | Pending | |
| RC-S3 | Load test passed | 100+ concurrent users sustained | Backend Lead | Pending | |
| RC-S4 | Accessibility baseline | Text scaling + screen reader verified on device (`docs/ACCESSIBILITY.md`) | Design Lead | Pending | |
| RC-S5 | Onboarding flow tested | Tutorial + first-match guidance on device | Product Manager | Done | |
| RC-S6 | Monitoring dashboards live | Metrics, logs, alerts operational in prod | DevOps Lead | Done | |
| RC-S7 | Feedback system active | In-app reporting + external channel live | Community Mgr | Done | |
| RC-S8 | Tech debt within limits | `make tech-debt-check` — no new critical items | Technical Lead | Pending | |
| RC-S9 | Bundle size within budget | `make bundle-size-check` passes (`backend/bundle-size-limits.json`) | Backend Lead | Pending | |

---

## 3. Server-Authoritative / Combat-Trust Blockers

Sprint 8 goal: **no unresolved trust-system blockers at RC**. The game is server-authoritative — the client sends actions, Nakama validates and computes results (PRD §6). Any open item below is an automatic NO-GO. These are verified against the trust modules in `backend/src/modules/` (`combat_system.ts`, `anti_cheat.ts`, `anti_cheat_audit.ts`, `fairness_telemetry.ts`, `match_replay.ts`).

### 3.1 Combat Authority

All damage/hit outcomes are computed on the server from server-stored stats; the client is never trusted with combat results.

| # | Blocker Check | Verification Method | Status | Evidence |
|---|---------------|---------------------|--------|----------|
| T-C1 | No client-computed damage in any code path | Review of RPC handlers: combat results derive only from server-stored Attack/Defense/Dodge stats (`backend/src/modules/combat_system.ts`) | Done | Code review + unit tests |
| T-C2 | Client-submitted combat results rejected | RPC input validation (zod) refuses any client-claimed hit/damage/loot payload | Done | Anti-cheat unit tests |
| T-C3 | Anti-cheat validation active in production config | `backend/src/modules/anti_cheat.ts` enabled; server-side validation on all combat RPCs | Done | Config review |
| T-C4 | Anti-cheat audit trail writable | `backend/src/modules/anti_cheat_audit.ts` logs detections for review | Done | Audit log inspection |
| T-C5 | No unresolved combat-authority issues in tracker | Zero open issues labeled combat/authority/trust | Pending | Tracker sweep at RC |

### 3.2 Ranked Fairness

Async PvP (duel lifecycle, punch-up mechanics) must be fair and exploit-resistant.

| # | Blocker Check | Verification Method | Status | Evidence |
|---|---------------|---------------------|--------|----------|
| T-R1 | Match outcomes computed server-side | Async duel resolution runs entirely on the server (`docs/ASYNC_DUEL_LIFECYCLE.md`) | Done | Integration tests |
| T-R2 | Punch-up mechanics verified | Weaker-player buff math validated server-side (`backend/src/modules/PUNCH_UP_MECHANICS_SUMMARY.md`) | Done | Balance unit tests |
| T-R3 | Fairness telemetry operational | `fairness_telemetry.ts` endpoints registered in `backend/src/index.ts`; win-rate drift monitorable | Done | Endpoint smoke check |
| T-R4 | Match replay integrity | `match_replay.ts` supports post-hoc dispute review (`QA_DISPUTE_RESOLUTION_GUIDE.md`) | Done | Dispute drill |
| T-R5 | No unresolved ranked-fairness issues in tracker | Zero open issues labeled pvp/fairness/ranked | Pending | Tracker sweep at RC |

### 3.3 Progression Loss (Persistence Trust)

Player progression must never be lost, duplicated, or client-forged.

| # | Blocker Check | Verification Method | Status | Evidence |
|---|---------------|---------------------|--------|----------|
| T-P1 | XP/level/gear writes are transactional | Progression RPCs use try/catch + DB transactions; no partial-write paths | Done | Unit + integration tests |
| T-P2 | Client cannot forge progression payloads | All progression deltas recomputed server-side from stored state | Done | Input validation tests |
| T-P3 | Save/load round-trip verified | Device playthrough: XP, levels, gear, gems survive app restart and re-login (Firebase auth session loss handled) | Pending | Manual device test |
| T-P4 | Seasonal soft-reset correct | Leaderboard soft reset + prestige preserves what it must, resets what it should (`docs/SEASONAL_LEADERBOARD.md`) | Pending | Staging seasonal drill |
| T-P5 | No unresolved progression-loss issues in tracker | Zero open issues labeled progression/data-loss | Pending | Tracker sweep at RC |

### 3.4 Purchase Entitlement (IAP Trust)

RevenueCat purchases must grant entitlements reliably and only server-verified.

| # | Blocker Check | Verification Method | Status | Evidence |
|---|---------------|---------------------|--------|----------|
| T-E1 | Entitlements granted only after server verification | RevenueCat webhooks/receipts validated server-side before granting gems/skins (`docs/REVENUECAT_SETUP.md`, `docs/IAP_SECURITY_AUDIT.md`) | Done | IAP audit |
| T-E2 | Entitlement restore works | Reinstall + "restore purchases" restores all owned cosmetics | Pending | Sandbox device test |
| T-E3 | Transmog separation enforced | Base gear carries all stats (gameplay-earned); skins are visual-only (IAP) — no stat path from purchases | Done | Code review |
| T-E4 | Purchase audit log complete | Every purchase + entitlement event logged server-side | Done | Audit log inspection |
| T-E5 | Sandbox purchase E2E | RevenueCat sandbox purchase completes and grants entitlement on device | Pending | Manual sandbox test |
| T-E6 | No unresolved entitlement issues in tracker | Zero open issues labeled iap/entitlement/purchase | Pending | Tracker sweep at RC |

> **RC trust gate**: Sections 3.1–3.4 must show zero `Pending` items (or each must carry a written risk acceptance signed by the Technical Lead) before sign-off.

---

## 4. Verification Checklist

Repo-specific commands are shown where they exist. Godot suite note: the runner's exit code is unreliable — treat `Failed: 0` in output as the pass signal.

### Category 1: Code Quality & Test Verification

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 1.1 | Lint passes (GDScript) | `./scripts/local-godot-tests.sh --lint` (or `gdlint autoloads/*.gd scenes/**/*.gd scripts/*.gd test/*.gd`) | Pending | |
| 1.2 | Lint passes (TypeScript) | `make backend-lint` | Done | Zero warnings |
| 1.3 | Type checking clean | `make backend-check` | Done | tsc --noEmit |
| 1.4 | Godot test suite green | `godot4 --headless --script test/run_all_tests.gd` (or `./scripts/local-godot-tests.sh --tests`); look for `Failed: 0` | Pending | 158 GDScript test files |
| 1.5 | Backend unit tests green | `make backend-test` | Done | 232 test files, 3324 passed at last audit |
| 1.6 | Integration tests green | `make services-start` then `cd backend && npm run test:integration` | Pending | Requires local stack |
| 1.7 | Smoke tests pass | `make smoke-test-quick` | Pending | |
| 1.8 | No flaky tests blocking CI | `make test-flaky-report` clean | Done | |
| 1.9 | Schema tests green | `cd backend && npm run test:schema` | Pending | |
| 1.10 | Bundle size within budget | `make bundle-size-check` | Pending | `backend/bundle-size-limits.json` |
| 1.11 | Tech debt within limits | `make tech-debt-check` | Pending | `TECH_DEBT.md` |
| 1.12 | Local CI pipeline green | `make ci` (Godot jobs skip under act; use `./scripts/local-godot-tests.sh` for those) | Pending | |

### Category 2: Backend & Infrastructure

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 2.1 | Backend bundle builds | `cd backend && npm run build:full` | Pending | tsc + webpack + validation |
| 2.2 | Production Docker images build | `docker compose build` from `backend/` | Pending | Blue/green tags |
| 2.3 | Database migrations apply cleanly | `make backend-migrate` against prod-schema copy | Pending | Human review required for schema changes |
| 2.4 | Production env configured | `.env.production` verified; `backend/start.sh` validation passes | Pending | |
| 2.5 | Feature flags / kill switches configured | Rollout RPCs operational: `armored_archer/rollout_create_flag`, `rollout_rollback`, etc. (see `DEPLOYMENT.md` Progressive Rollout) | Done | |
| 2.6 | API rate limiting active | Per-endpoint limits configured | Pending | |
| 2.7 | Circuit breakers functional | Circuit breaker pattern active on RPCs | Done | |
| 2.8 | Structured logging operational | Loki receiving winston structured logs | Done | |
| 2.9 | Health endpoints responding | `make services-health`; `/health` and `/healthz` return 200 | Done | |
| 2.10 | Prometheus metrics exporting | `/metrics` scraped by Prometheus | Done | |

### Category 3: Client & Game Features (Final Verification)

Requires a device (or emulator) connected to a running backend stack.

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 3.1 | Combat system (PvE) | Manual playthrough: auto-shooter works E2E on device | Pending | |
| 3.2 | PvP matchmaking | Async duel lifecycle completes with punch-up mechanics | Pending | |
| 3.3 | Gear system | Equip/unequip, stat calculations, synergy system | Pending | |
| 3.4 | Progression loop | XP, leveling, ability points save/load correctly across restarts | Pending | Feeds T-P3 |
| 3.5 | Campaign progression | Stage selection, completion, rewards, boss fights | Pending | |
| 3.6 | Seasonal content | Leaderboards, rewards, soft reset, prestige | Pending | Feeds T-P4 |
| 3.7 | Store/IAP flow | RevenueCat sandbox purchase completes on device | Pending | Feeds T-E5 |
| 3.8 | Gem system | Gems purchase cosmetics only — zero combat impact | Done | Enforced server-side (T-E3) |
| 3.9 | Theme support | Light/dark themes render on device | Pending | |
| 3.10 | Touch controls | Dual joystick, aim smoothing, safe areas on device | Done | |
| 3.11 | Memory within limits | < 512 MB flagship, < 256 MB budget | Pending | |
| 3.12 | Gameplay balance verified | Stage pacing, drop rates, risk/reward tuned | Done | Sprint 8 tuning pass |
| 3.13 | Firebase auth flows | Login, session refresh, logout, account recovery on device | Pending | |

### Category 4: App Store Readiness

Full store procedures: `docs/APP_SUBMISSION_CHECKLIST.md`, `docs/APP_STORE_IOS.md`, `docs/APP_STORE_ANDROID.md`.

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 4.1 | iOS .ipa exports | Godot editor export with Apple Developer cert | Pending | Needs signing cert |
| 4.2 | Android .aab exports | Godot editor export with release keystore | Pending | Needs keystore |
| 4.3 | App icons all sizes | 128–1024px for both platforms | Done | |
| 4.4 | Screenshots captured | 6–10 iOS, 2–8 Android (real device) | Pending | Replace placeholders |
| 4.5 | Store descriptions | Localized in 10 languages | Done | |
| 4.6 | Privacy policy published | Accessible at public URL | Done | Gate E1 |
| 4.7 | Export compliance filed | Documentation complete | Done | Gate E3 |
| 4.8 | Age rating set | 12+ iOS, Teen Android | Done | Cosmetic-only monetization |
| 4.9 | iOS TestFlight configured | Internal testing group active | Pending | |
| 4.10 | Android closed testing track | Internal/closed testing track created | Pending | |
| 4.11 | Release notes for stores | Store-specific release notes written (see Section 6) | Pending | |
| 4.12 | Terms of service published | Accessible at public URL | Done | Gate E2 |

### Category 5: Security & Compliance

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 5.1 | DAST scan clean | `.github/workflows/dast-scanning.yml` results | Pending | Gate E7 |
| 5.2 | Server-authoritative design | All combat/progression calculated server-side | Done | Section 3 |
| 5.3 | Input validation complete | All RPC inputs validated server-side (zod) | Done | |
| 5.4 | Authentication secure | Nakama session tokens handled correctly; Firebase auth flow reviewed | Done | |
| 5.5 | TLS on external endpoints | All external traffic encrypted in production | Pending | Gate E6 |
| 5.6 | IAP compliance verified | No pay-to-win; follows store guidelines | Done | Cosmetic-only gems |
| 5.7 | Audit logging operational | Purchase and entitlement logs complete | Done | T-E4 |
| 5.8 | Secrets management | All secrets in env vars, none in code | Pending | Gate E8 |
| 5.9 | Anti-cheat functional | Server-side validation active | Done | T-C3 |

### Category 6: Monitoring & Operations

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 6.1 | Prometheus metrics live in prod | Scraping from production endpoints | Pending | |
| 6.2 | Grafana dashboards loaded | API latency, error rate, player count | Done | |
| 6.3 | Alert rules configured | Error rate + latency thresholds | Done | |
| 6.4 | On-call rotation defined | Named contacts for P0 response | Pending | |
| 6.5 | Runbooks available | `docs/runbooks/` reviewed by on-call | Pending | 6 runbooks in place |
| 6.6 | Rollback tested in staging | Blue/green switch + DB restore within 5 min | Pending | Gate D7 |
| 6.7 | Progressive rollout configured | Rollout phases + rollback criteria defined per feature flag | Done | Section 5 |
| 6.8 | Post-launch monitoring plan | 48-hour monitoring window defined | Done | |
| 6.9 | Analytics funnel tracking | Install→PvE→PvP→purchase conversion tracked | Done | Sprint 8 analytics |
| 6.10 | Crash alert thresholds configured | Crash thresholds documented and enforced via Firebase Crashlytics console alerting (Firebase-console-only; see `docs/CRASH_ALERT_THRESHOLDS.md`) | Done | `docs/CRASH_ALERT_THRESHOLDS.md` |

### Category 7: Documentation & Communication

| # | Item | Verification Method | Status | Notes |
|---|------|---------------------|--------|-------|
| 7.1 | Release notes prepared | `docs/RELEASE_NOTES_v3.6.0.md` complete + reviewed (see Section 6) | Pending | |
| 7.2 | Changelog updated | `backend/CHANGELOG.md` reflects v3.6.0 | Pending | |
| 7.3 | Deployment plan reviewed | `DEPLOYMENT.md` + Section 5 rollout plan reviewed and approved | Pending | |
| 7.4 | Support playbook ready | `docs/BETA_SUPPORT_PLAYBOOK.md` current (FAQ covers launch features) | Done | |
| 7.5 | AGENTS.md validation green | `make agents-md-check` | Pending | Docs changed in this package |
| 7.6 | Launch communication drafted | Announcement copy prepared | Pending | |
| 7.7 | Known issues documented | Any shipped-known issues listed (below) | Pending | |

---

## 5. Rollout Plan

### 5.1 Release Train

| Stage | When | Action |
|-------|------|--------|
| RC cut | T-7d | Tag `v3.6.0-rc.1`; freeze feature merges to `main`; bugfix-only policy |
| RC verification | T-7d → T-2d | Complete Sections 1–4 of this checklist; collect sign-offs |
| Store submission | T-2d | Submit to TestFlight + Play closed track; then production review |
| Backend deploy | T-0 (after store approval) | Migrations → canary → gradual → full (below) |
| Soft launch | T-0+ | Staged store rollout (below); 48h enhanced monitoring |

### 5.2 Backend Rollout (Blue/Green + Progressive Rollout)

Follows `DEPLOYMENT.md` (Blue/Green deployment, progressive rollout phases). Rollout phases, thresholds, and kill switches are managed through the rollout RPC endpoints (`armored_archer/rollout_create_flag`, `rollout_advance`, `rollout_rollback`, `rollout_health`, `rollout_prometheus_metrics`).

| Phase | Traffic | Duration | Promote When | Abort When |
|-------|---------|----------|--------------|------------|
| Deploy new color (no traffic) | 0% | — | Health checks green on new color | Startup crash / health fail |
| Canary | 5–10% | 60 min | error rate < 2%, P95 < 100ms, health ≥ 95% | error rate > 5%, P95 > 250ms, 3 health fails |
| Gradual | 25–50% | 120 min | error rate < 1%, P95 < 100ms, health ≥ 95% | error rate > 3%, P95 > 200ms, 2 health fails |
| Full | 100% | — | — | Rollback path below |

Store-side rollout runs in parallel: iOS phased release (7-day) + Play staged rollout at the percentages in 5.3.

### 5.3 Client Staged Rollout (Store Controls)

| Stage | iOS (Phased Release) | Android (Staged Rollout) | Hold If |
|-------|----------------------|--------------------------|---------|
| 1 | Day 1 (1%) | 5% | Crash rate ≥ 1% or ANR spike |
| 2 | Day 2–3 (~5%) | 20% | Crash-free < 99% |
| 3 | Day 4–5 (~20%) | 50% | P1 store review spike / rating drop |
| 4 | Day 6–7 (50% → 100%) | 100% | Any unresolved P0 |

### 5.4 Kill Switches

| Switch | Scope | How to Trigger | Effect |
|--------|-------|----------------|--------|
| Feature flag rollback | Any flagged feature (e.g. new game mode, seasonal event) | `armored_archer/rollout_rollback` RPC (per `DEPLOYMENT.md`) | Feature disabled or dropped to previous phase for all users |
| Traffic rollback | Whole backend version | Blue/green switch: point load balancer back to previous color (`DEPLOYMENT.md` Manual Rollback) | Previous server version serves 100% within minutes |
| Store rollout halt | Client version | Play Console: halt staged rollout; App Store Connect: pause phased release | Stops new-user exposure; already-updated users keep the build |
| Client emergency | Breaking client/server mismatch | Advance/rollback server feature flags so server tolerates old clients | Bridges until store revert ships |

Kill-switch drill (required before GO): each switch above exercised once in staging and timed.

### 5.5 Rollback Procedure

Full procedure: `DEPLOYMENT.md` → Rollback Procedure. Summary:

1. **Backend (target < 5 min)** — automatic rollback fires on health-check failure, startup crash, or smoke-test failure; manually, switch the load balancer back to the previous blue/green color:

   ```bash
   # Identify active color
   docker ps --filter "name=armored-archer-" --format "{{.Names}}"
   # Switch traffic to previous color (load balancer), then:
   docker-compose stop armored-archer-<new-color>
   ```

   `make rollback` prints the GitHub Actions `Rollback Automation` workflow_dispatch instructions.

2. **Database (target < 1 h)** — restore from the pre-deployment backup (Gate C4). Migrations that are additive-only may be left in place; any destructive migration must have its documented reversal applied first.

3. **Client (store-dependent)** — halt the staged rollout (5.4); if the build itself is broken, submit a revert build via iOS expedited review / Play emergency track.

4. **Communication** — incident notice posted within 15 minutes (in-game banner + community channels); follow `docs/BETA_SUPPORT_PLAYBOOK.md` and the incident runbooks in `docs/runbooks/`.

---

## 6. Release Notes Preparation

| # | Item | Source / Method | Status |
|---|------|-----------------|--------|
| 6.1 | Generate draft from conventional commits | `make release-notes` (`scripts/generate_release_notes.py`) | Pending |
| 6.2 | Curate player-facing notes | Edit draft into `docs/RELEASE_NOTES_v3.6.0.md` — features, fixes, known issues; player language, no internals | Pending |
| 6.3 | Store notes (iOS) | What's New text for App Store Connect, within character limits, per `docs/APP_STORE_IOS.md` | Pending |
| 6.4 | Store notes (Android) | Release notes for Play Console, per `docs/APP_STORE_ANDROID.md` | Pending |
| 6.5 | Backend changelog | Update `backend/CHANGELOG.md` for v3.6.0 server changes | Pending |
| 6.6 | Known issues section | Populate the Known Issues table below from the tracker | Pending |
| 6.7 | Review | Product Manager + Community Manager review all player-facing copy | Pending |

---

## 7. Known Issues (Shipped With)

| # | Issue | Severity | Mitigation | Tracked In |
|---|-------|----------|------------|------------|
| 1 | _(To be populated during RC verification)_ | | | |

---

## 8. Stakeholder Sign-Off

Each stakeholder reviews their categories, verifies readiness, and signs. **Signature fields are completed by hand by the named human — leave blank until signed.** An entry is not valid without name, date, and signature.

| Role | Categories Reviewed | Name | Approval | Date | Signature |
|------|---------------------|------|----------|------|-----------|
| Technical Lead | All categories + Section 3 (trust) | | PENDING | | |
| Backend Lead | Gates B–C; Cat 1, 2, 5 | | PENDING | | |
| Client Lead | Gate A; Cat 3, 4 | | PENDING | | |
| QA Lead | Cat 1, 3, 4; RC-H1/H6 | | PENDING | | |
| DevOps Lead | Gates C–D; Cat 2, 6 | | PENDING | | |
| Security Lead | Gate E; Cat 5; Section 3 | | PENDING | | |
| Product Manager | Gate E; Cat 4, 7 | | PENDING | | |
| Design Lead | Cat 3 (UX), RC-S4 | | PENDING | | |
| Community Manager | Cat 7; RC-S7 | | PENDING | | |

### Release Decision

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
| Deployment Guide (rollout + rollback) | `DEPLOYMENT.md` |
| App Submission Checklist | `docs/APP_SUBMISSION_CHECKLIST.md` |
| iOS / Android store guides | `docs/APP_STORE_IOS.md`, `docs/APP_STORE_ANDROID.md` |
| Performance Guide | `docs/PERFORMANCE.md` |
| Security Documentation | `docs/SECURITY.md` |
| IAP Security Audit | `docs/IAP_SECURITY_AUDIT.md` |
| Anti-Cheat / fairness modules | `backend/src/modules/anti_cheat.ts`, `fairness_telemetry.ts`, `combat_system.ts`, `match_replay.ts` |
| Runbooks | `docs/runbooks/` |
| Beta Support Playbook | `docs/BETA_SUPPORT_PLAYBOOK.md` |
| Privacy Compliance | `docs/PRIVACY_COMPLIANCE.md` |
| Crash Alert Thresholds | `docs/CRASH_ALERT_THRESHOLDS.md` |
| Secrets Management | `docs/SECRETS_MANAGEMENT.md` |
| Backend Changelog | `backend/CHANGELOG.md` |
| Mobile Beta Test Plan | `docs/MOBILE_BETA_TEST_PLAN.md` |
| Database Schema | `backend/DATABASE_SCHEMA.md` |
| CI Workflows | `.github/workflows/` |
