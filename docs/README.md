# docs/

The documentation tree for Armored Archer. Holds ratified product decisions,
operational runbooks, store-submission material, milestone reports, and per-
feature deep dives that don't belong in the top-level READMEs. Use this page
as a map: the body files are the source of truth, the entries below tell you
which one to open first.

> **Stable.** This index is curated by hand. If you add a new doc, link it
> here in the same PR so newcomers can find it. If you supersede or archive
> a doc, move its entry to **Superseded / archived** rather than removing it.

## Start here

| If you are… | Open this | Why |
|---|---|---|
| A new contributor (human or AI) | [`../AGENTS.md`](../AGENTS.md) | Canonical reference for build, test, lint, and the AI-assisted commit contract. |
| Walking through your first PR | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Branch naming, commit trailers, local-CI memory rule, and quality gates. |
| Bootstrapping a local dev env | [`GETTING_STARTED.md`](GETTING_STARTED.md) | Step-by-step Godot client + Nakama backend setup. |
| Reasoning about the game as designed | [`armored-archer_prd.md`](armored-archer_prd.md) | Living product promises document (see [ADR-0001](adr/0001-prd-living-promises-governance.md)). |
| Looking up a domain term | [`GLOSSARY.md`](GLOSSARY.md) + [`../CONTEXT.md`](../CONTEXT.md) | CONTEXT.md is the ratified vocabulary; GLOSSARY.md mirrors it in player-facing terms. |
| Operating a service in production | [`RUNBOOKS.md`](RUNBOOKS.md) → `runbooks/` | Alert → runbook mapping; the `runbooks/` subdir has the per-alert procedures. |

## By topic

### Product & architecture decisions

| Doc | Status | What it is |
|---|---|---|
| [`armored-archer_prd.md`](armored-archer_prd.md) | Stable | The PRD — the source of truth for player-facing promises, amendable only through ratification. |
| [`adr/`](adr/) | Stable | Architecture Decision Records (0001–0006). Read the relevant ADR before touching duel, settlement, combat-authority, or admin-gate code (see `adr/README.md`). |
| [`ASYNC_DUEL_LIFECYCLE.md`](ASYNC_DUEL_LIFECYCLE.md) | Stable | End-to-end shape of the shipped hybrid duel model (async matchmaking → live short-session combat). |
| [`COMBAT_SYSTEM.md`](COMBAT_SYSTEM.md) | Stable | Turn-based PvP combat system — turns, timers, damage, effects. |
| [`MATCHMAKER.md`](MATCHMAKER.md) | Stable | PvP matchmaking queues, brackets, and punch-up eligibility rules. |
| [`SEASONAL_LEADERBOARD.md`](SEASONAL_LEADERBOARD.md) | Stable | Season ladder cycle, soft reset, rank decay, prestige tiers. |
| [`RPG_SYSTEM.md`](RPG_SYSTEM.md) | Stable | Character leveling and stat allocation. |
| [`CASUAL_VS_RANKED_REWARDS.md`](CASUAL_VS_RANKED_REWARDS.md) | Stable | Casual vs ranked duel reward posture (resolves the PRD ambiguity in `../CONTEXT.md`). |
| [`MODULAR_SPRITE_SYSTEM.md`](MODULAR_SPRITE_SYSTEM.md) | Stable | Modular sprite system for gear (cosmetic skin layer). |

### Operations, runbooks & incident response

| Doc | Status | What it is |
|---|---|---|
| [`RUNBOOKS.md`](RUNBOOKS.md) | Stable | Index of operational procedures; pointer to the alert-specific runbooks. |
| [`runbooks/`](runbooks/) | Stable | One file per alert (`HighErrorRate`, `DatabaseDown`, `MatchmakingQueueBuilding`, `SettlementDegraded`, …). Open `runbooks/README.md` for the full catalog. |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Stable | End-to-end deployment guide. |
| [`DEPLOYMENT_OBSERVABILITY.md`](DEPLOYMENT_OBSERVABILITY.md) | Stable | Metrics, logs, traces, dashboards — what we ship vs hope for. |
| [`CRASH_ALERT_THRESHOLDS.md`](CRASH_ALERT_THRESHOLDS.md) | Stable | Crashlytics alert thresholds. |
| [`ci/ci-billing-recovery.md`](ci/ci-billing-recovery.md) | Stable | Recovery when hosted GitHub Actions is dark (issue #855). |

### Release, store submission & launch

| Doc | Status | What it is |
|---|---|---|
| [`RELEASE_CANDIDATE_CHECKLIST.md`](RELEASE_CANDIDATE_CHECKLIST.md) | Stable | Per-release sign-off package (latest version pinned in the doc). |
| [`APP_SUBMISSION_CHECKLIST.md`](APP_SUBMISSION_CHECKLIST.md) | Stable | Master checklist for App Store / Play Store submission. |
| [`CLOSED_BETA_CHECKLIST.md`](CLOSED_BETA_CHECKLIST.md) | Stable | Pre-closed-beta readiness checklist. |
| [`APP_STORE_IOS.md`](APP_STORE_IOS.md), [`APP_STORE_ANDROID.md`](APP_STORE_ANDROID.md) | Stable | Store listing copy and metadata. |
| [`MOBILE_BETA_TEST_PLAN.md`](MOBILE_BETA_TEST_PLAN.md) | Stable | Mobile beta test plan. |
| [`BETA_SUPPORT_PLAYBOOK.md`](BETA_SUPPORT_PLAYBOOK.md) | Stable | Beta support triage playbook. |
| [`LIVE_OPS_CALENDAR.md`](LIVE_OPS_CALENDAR.md) | WIP — Draft | Season-1 live-ops calendar, pending team sign-off. |
| [`LAUNCH_PATH_DECISION.md`](LAUNCH_PATH_DECISION.md) | Stable | Launch-path decision (issue #740). |
| [`EXPORT_GUIDE.md`](EXPORT_GUIDE.md), [`EXPORT_COMPLIANCE.md`](EXPORT_COMPLIANCE.md) | Stable | Godot export walkthrough and export-compliance (encryption, ratings). |

### Security, privacy & legal

| Doc | Status | What it is |
|---|---|---|
| [`SECURITY.md`](SECURITY.md) | Stable | Input sanitization and security posture. |
| [`ANTI_CHEAT_IMPLEMENTATION.md`](ANTI_CHEAT_IMPLEMENTATION.md) | Stable | RPC input validation + anti-cheat detection (issue #141). |
| [`IAP_SECURITY_AUDIT.md`](IAP_SECURITY_AUDIT.md) | Stable | IAP receipt-verification security audit (issue #144). |
| [`SECRETS_MANAGEMENT.md`](SECRETS_MANAGEMENT.md) | Stable | Secrets strategy across environments. |
| [`SECRETS_ROTATION.md`](SECRETS_ROTATION.md) | Stable | Secrets rotation procedure (consolidated — issue #1085). |
| [`PRIVACY_COMPLIANCE.md`](PRIVACY_COMPLIANCE.md) | Stable | Privacy posture, GDPR/CCPA, data inventory. |
| [`TERMS_OF_SERVICE.md`](TERMS_OF_SERVICE.md) | Stable | Player-facing ToS. |

### Testing & quality

| Doc | Status | What it is |
|---|---|---|
| [`testing/`](testing/) | Stable | Testing infrastructure overview (`testing/README.md`), GUT audit/triage, mobile-device + network-resilience testing, tutorial review. |
| [`GUT_INSTALLATION.md`](GUT_INSTALLATION.md) | Stable | GUT addon installation fixes (legacy phase-10 report). |
| [`LOCAL_TESTING_GUIDE.md`](LOCAL_TESTING_GUIDE.md) | Stable | Local testing setup, ready-for-use checklist. |
| [`PROFILING.md`](PROFILING.md), [`PERFORMANCE.md`](PERFORMANCE.md) | Stable | Profiling instrumentation + perf budgets. |
| [`CYCLOMATIC_COMPLEXITY.md`](CYCLOMATIC_COMPLEXITY.md), [`DEAD_CODE_DETECTION.md`](DEAD_CODE_DETECTION.md) | Stable | Repo-hygiene tooling. |
| [`USABILITY_FINDINGS.md`](USABILITY_FINDINGS.md), [`USABILITY_SESSION_PLAN.md`](USABILITY_SESSION_PLAN.md) | Stable | Heuristic eval findings + first-15-min session plan. |

### CI, dev workflow & branch hygiene

| Doc | Status | What it is |
|---|---|---|
| [`ACT_CI_SUMMARY.md`](ACT_CI_SUMMARY.md), [`ACT_CI_ISSUES.md`](ACT_CI_ISSUES.md) | Stable | Local CI via `act` — summary and known-issue catalog. |
| [`CI_OPTIMIZATION.md`](CI_OPTIMIZATION.md), [`CI_ISSUES_AND_PLAN.md`](CI_ISSUES_AND_PLAN.md) | Stable | CI speed-ups and issue-tracking plan. |
| [`BRANCH_PROTECTION.md`](BRANCH_PROTECTION.md) | Stable | Branch-protection rules (issue #313). |
| [`branch-protection-setup.md`](branch-protection-setup.md) | WIP — stale | Visual-regression branch protection (note: protection currently off; issue #1035). |
| [`AUTOMATED_FIXES.md`](AUTOMATED_FIXES.md) | Stable | Automated Godot project fixes. |
| [`CONTRIBUTING_AI.md`](CONTRIBUTING_AI.md) | Stable | How to write commits that contain AI-generated changes (companion to `../CONTRIBUTING.md`). |

### Database, auth, IAP & integrations

| Doc | Status | What it is |
|---|---|---|
| [`db/MIGRATIONS.md`](db/MIGRATIONS.md) | Stable | Migration runbook — pre-flight, two-engineer review, verification queries (schema changes always need human review). |
| [`AUTHENTICATION.md`](AUTHENTICATION.md) | Stable | User authentication via Nakama. |
| [`FIREBASE_SETUP.md`](FIREBASE_SETUP.md) | Stable | Firebase Crashlytics + Analytics setup. |
| [`REVENUECAT_SETUP.md`](REVENUECAT_SETUP.md), [`REVENUECAT_PLUGIN.md`](REVENUECAT_PLUGIN.md), [`STORE_README.md`](STORE_README.md) | Stable | RevenueCat IAP — setup, native-plugin guide, implementation summary. |
| [`auth/AUTH_LOGIN_2026.md`](auth/AUTH_LOGIN_2026.md) | Stable | Root-cause report on the 75% login blocker (issue #908). |

### Troubleshooting & developer ergonomics

| Doc | Status | What it is |
|---|---|---|
| [`CONNECTION_TROUBLESHOOTING.md`](CONNECTION_TROUBLESHOOTING.md) | Stable | Diagnose connection issues when running in the Godot editor (F5). |
| [`LOCAL_SERVICES_SETUP.md`](LOCAL_SERVICES_SETUP.md) | Stable | Local Nakama + Postgres services setup. |
| [`DEPENDENCY_MANAGEMENT.md`](DEPENDENCY_MANAGEMENT.md) | Stable | Pinned-dependency strategy for reproducible builds. |
| [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md) | Stable | UI design tokens catalog (use these instead of hardcoded values). |
| [`GDSCRIPT_NULL_SAFETY.md`](GDSCRIPT_NULL_SAFETY.md) | Stable | Null-safety patterns enforced in the codebase. |
| [`TEMPLATES.md`](TEMPLATES.md) | Stable | VSCode snippet and template guide. |
| [`ACCESSIBILITY.md`](ACCESSIBILITY.md) | Stable | UI accessibility guidelines. |
| [`ANALYTICS_DASHBOARD.md`](ANALYTICS_DASHBOARD.md) | Stable | Analytics instrumentation + dashboard guidance. |

### Domain-specific decisions and reports (dated artifacts)

These are point-in-time artifacts — read the date in the title before
treating their findings as current.

| Doc | Status | What it is |
|---|---|---|
| [`decisions/`](decisions/) | Stable | Domain decisions: [`CC0_HYBRID_POLICY.md`](decisions/CC0_HYBRID_POLICY.md) (CC0 asset policy), [`GearRegistry_RARITY_2026.md`](decisions/GearRegistry_RARITY_2026.md), [`RESPEC_DEBIT_2026.md`](decisions/RESPEC_DEBIT_2026.md). |
| [`balance/CH1_BALANCE_2026.md`](balance/CH1_BALANCE_2026.md) | Stable | Chapter-1 balance calibration (issue #915). |
| [`assets/`](assets/) | Stable | Asset procurement: [`ASSET_PROSING_PLAN_2026.md`](assets/ASSET_PROSING_PLAN_2026.md), [`ELEVENLABS_FOLEY_PROMPTS_2026.md`](assets/ELEVENLABS_FOLEY_PROMPTS_2026.md), [`PROCUREMENT_STATUS_2026-08-17.md`](assets/PROCUREMENT_STATUS_2026-08-17.md). |
| [`dod/MVP_PVE_SLICE_DOD_REPORT_2026.md`](dod/MVP_PVE_SLICE_DOD_REPORT_2026.md) | Stable | MVP PvE slice Definition-of-Done verification (issue #917). |
| [`mvp/`](mvp/) | Mixed | [`MVP-SCOPE.md`](mvp/MVP-SCOPE.md) is the frozen/archived MVP scope; [`MVP-2_PREREQUISITES.md`](mvp/MVP-2_PREREQUISITES.md) is the blocking checklist for re-enabling deferred modes. |
| [`testing/GUT_REAL_BUG_AUDIT_2026-08-17.md`](testing/GUT_REAL_BUG_AUDIT_2026-08-17.md), [`testing/GUT_TRIAGE_2026-08-17.md`](testing/GUT_TRIAGE_2026-08-17.md), [`testing/TUTORIAL_REVIEW_2026.md`](testing/TUTORIAL_REVIEW_2026.md) | Stable | Dated testing reports — bind to the issues cited in each header. |
| [`RELEASE_NOTES_v3.6.0.md`](RELEASE_NOTES_v3.6.0.md), [`RELEASE_NOTES_CURRENCY_REWRITE.md`](RELEASE_NOTES_CURRENCY_REWRITE.md) | Stable | Historical release notes for v3.6.0 and the gold→coins currency rename. |
| [`SPRINT_8_SUMMARY.md`](SPRINT_8_SUMMARY.md) | Stable | Sprint-8 summary (issue #735). |
| [`PERFORMANCE_REPORT.md`](PERFORMANCE_REPORT.md), [`PERFORMANCE_TEST_PLAN.md`](PERFORMANCE_TEST_PLAN.md) | Stable | v3.0.0 alpha-readiness perf report + low-end device test plan. |
| [`v2.6.0-VERIFICATION.md`](v2.6.0-VERIFICATION.md) | Stable | v2.6.0 integration and handler-coverage verification. |
| [`MVP_BURNDOWN_DASHBOARD_README.md`](MVP_BURNDOWN_DASHBOARD_README.md) | Stable | MVP burndown dashboard — blocker tracking across sprints/phases. |

## Superseded / archived

Read these only as historical context — the canonical doc is listed in
each header.

| Doc | Superseded by |
|---|---|
| [`SECRET_ROTATION.md`](SECRET_ROTATION.md) | [`SECRETS_ROTATION.md`](SECRETS_ROTATION.md) (issue #1085). |
| [`mvp/MVP-SCOPE.md`](mvp/MVP-SCOPE.md) | Frozen 2026-04-15; every listed feature has shipped — see `../README.md` for current status. |

## Related, outside `docs/`

- [`../RPC_MAP.md`](../RPC_MAP.md) — authoritative per-RPC reference
  (client caller, server handler, storage ownership). Edit when RPCs change.
- [`../TECH_DEBT.md`](../TECH_DEBT.md) — central registry for technical-debt
  items.
- [`../backend/DATABASE_SCHEMA.md`](../backend/DATABASE_SCHEMA.md) —
  authoritative DB schema reference; pair with [`db/MIGRATIONS.md`](db/MIGRATIONS.md).
- [`../.planning/ROADMAP.md`](../.planning/ROADMAP.md) — current milestone
  roadmap (v4.0.0 Gameplay Refinement); the docs/ tree is historical /
  reference, the roadmap is active.
