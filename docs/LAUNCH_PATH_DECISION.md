# Armored Archer — Launch Path Decision

**Issue**: [#740 — Decide on launch path: broader launch, extend, or re-balance](https://github.com/anchapin/armored-archer/issues/740)
**Sprint**: Sprint 8 — Soft Launch Tuning and Release Candidate (#735)
**Status**: DRAFT — pending live-data review and stakeholder sign-off
**Decision Forum**: Sprint 8 launch review (roles per `docs/RELEASE_CANDIDATE_CHECKLIST.md` sign-off table)

---

## 1. Purpose and Scope

This document evaluates the three candidate paths at the end of the soft-launch tuning sprint:

- **Path A** — Proceed to broader launch
- **Path B** — Extend the soft launch
- **Path C** — Loop one more balancing sprint

It defines the launch criteria, specifies the data review that must happen before the decision, analyzes each option, and records a **conditional recommendation**. Because the repository contains no live telemetry numbers, every "current status" cell in this document is marked **pending live data** — no metrics below are fabricated. Real numbers must be pulled from the analytics stack (see Section 4) and ratified by the stakeholders in Section 8.

**Out of scope**: changing game balance values, store strategy, or any code/config. This is a decision document only.

## 2. Background

- The product is F2P with **cosmetic-only IAP** (zero pay-to-win), server-authoritative combat and loot on Nakama, Firebase auth, and RevenueCat IAP (`docs/armored-archer_prd.md`).
- Sprint 8's primary goal is to "use real usage data to fix the last retention, fairness, and economy issues before MVP release" (#735), monitoring the funnel: **install → first PvE completion → first PvP match → first purchase**.
- Sprint 8's trust mandate: zero unresolved P0/P1 issues affecting **combat authority, ranked fairness, progression loss, or purchase entitlement**.
- The Release Candidate checklist (`docs/RELEASE_CANDIDATE_CHECKLIST.md`, v3.6.0-rc.1) defines hard blockers RC-H1…H10 and soft blockers RC-S1…S7; several remain `Pending` verification as of this draft (RC-H1, H3–H6, H9, H10; RC-S2–S4). Gameplay-balance tuning (item 3.12: stage pacing, drop rates, risk/reward) is marked `Done` for the Sprint 8 tuning pass, but efficacy against live telemetry is exactly what this decision reviews.
- `MVP_GAP_ANALYSIS.md` documents historical verification gaps (async PvP end-to-end flow, real-IAP loop vs. sandbox fallbacks, persistence verification, early-game enemy variety) that inform the risk columns below.

## 3. Launch Criteria Evaluation Matrix

Thresholds come from repo-documented values where they exist (cited); otherwise **proposed defaults** are supplied for stakeholder ratification at the data review. Current status is **pending live data** until filled in from the analytics stack.

### 3.1 Retention & Engagement

| ID | Criterion | Threshold | Current Status | Data Source |
|----|-----------|-----------|----------------|-------------|
| LC-R1 | Day-1 retention | ≥ 35% *(proposed — ratify at data review)* | **Pending live data** | Firebase Analytics / Mixpanel retention-by-cohort (`docs/ANALYTICS_DASHBOARD.md`) |
| LC-R2 | Day-7 retention | ≥ 12% *(proposed — ratify at data review)* | **Pending live data** | Same as LC-R1 |
| LC-R3 | Stickiness (DAU/MAU) | ≥ 20% *(proposed)* | **Pending live data** | Mixpanel DAU/MAU chart |
| LC-R4 | Avg sessions per user/day | ≥ 2 *(proposed)* | **Pending live data** | Session events (`session_start`/`session_end`) |
| LC-R5 | Stage-1 completion (tutorial → first clear) | ≥ 70% *(proposed)* | **Pending live data** | `tutorial_started` → `tutorial_completed` → `pve_stage_completed` funnels |

### 3.2 Fairness & Trust

| ID | Criterion | Threshold | Current Status | Data Source |
|----|-----------|-----------|----------------|-------------|
| LC-T1 | Open P0/P1 trust issues (combat authority, ranked fairness, progression loss, purchase entitlement) | 0 open — mirrors hard blocker RC-H1 (#735 mandate) | **Pending live data** (query GitHub Issues `severity:critical/high`) | GitHub issue tracker |
| LC-T2 | Server-authority violations (client-computed combat/loft results accepted) | 0 confirmed incidents | **Pending live data** | Nakama RPC audit logs; `docs/ANTI_CHEAT_IMPLEMENTATION.md` |
| LC-T3 | Punch-up wager abuse (rank-manipulation exploits in async PvP) | No statistically anomalous win/XP patterns | **Pending live data** | `pvp_match_completed` events grouped by rank delta; matchmaker telemetry |
| LC-T4 | Progression-loss support tickets (lost XP/gear) | No reproducible data-loss reports | **Pending live data** | Discord `#beta-support` escalations (`docs/BETA_SUPPORT_PLAYBOOK.md` L1–L4 log) |
| LC-T5 | Purchase-entitlement failures (paid gems/cosmetics not delivered) | 0 unresolved | **Pending live data** | RevenueCat webhook logs; `purchase_completed` vs. entitlement records |

### 3.3 Economy & Monetization

| ID | Criterion | Threshold | Current Status | Data Source |
|----|-----------|-----------|----------------|-------------|
| LC-E1 | Install → first purchase conversion | ≥ 1.5% *(proposed — genre-typical F2P cosmetic baseline)* | **Pending live data** | `app_opened` → `store_viewed` → `purchase_completed` funnel |
| LC-E2 | ARPPU trend | Non-decreasing week-over-week through soft launch | **Pending live data** | Mixpanel revenue reports |
| LC-E3 | Cosmetic gem pricing sanity (units sold > 0 across ≥ 3 price tiers) | No dead SKUs | **Pending live data** | RevenueCat product events |
| LC-E4 | Gem economy sink/faucet balance (gems granted vs. spent) | Spent/granted ratio ≥ 40% *(proposed)* | **Pending live data** | `store_opened`, `purchase_completed`, gem ledger RPCs |
| LC-E5 | Stage pacing & drop-rate health post-tuning | No stage with > 40% abandon rate; no required-grind spike > 2× median *(proposed)* | **Pending live data** | `pve_stage_started` vs. `pve_stage_completed`/`pve_stage_failed` per stage |

### 3.4 Funnel Conversion (Sprint 8 funnel, from #735)

| ID | Funnel step | Threshold | Current Status | Data Source |
|----|-------------|-----------|----------------|-------------|
| LC-F1 | Install → first PvE stage start | ≥ 80% *(proposed)* | **Pending live data** | `app_opened` → `campaign_started` |
| LC-F2 | First PvE stage start → first completion | ≥ 65% *(proposed)* | **Pending live data** | `campaign_started` → `pve_stage_completed` |
| LC-F3 | First PvE completion → first PvP match | ≥ 30% *(proposed)* | **Pending live data** | `pve_stage_completed` → `pvp_match_started` |
| LC-F4 | First PvP match → first purchase | ≥ 5% *(proposed)* | **Pending live data** | `pvp_match_started` → `purchase_completed` |
| LC-F5 | Tutorial skip rate | ≤ 30% *(proposed)* | **Pending live data** | `tutorial_skipped` / `tutorial_started` |

### 3.5 Technical Stability

Thresholds below are repo-documented (RC checklist hard blockers and `docs/CRASH_ALERT_THRESHOLDS.md`).

| ID | Criterion | Threshold (source) | Current Status | Data Source |
|----|-----------|--------------------|----------------|-------------|
| LC-S1 | Crash rate | < 1% of sessions (RC-H5; Crashlytics `HighCrashRate` > 1% alert) | **Pending live data** | Firebase Crashlytics → Prometheus `crashlytics_crash_rate` |
| LC-S2 | Fatal crashes | 0 (Crashlytics `FatalCrashes > 0` alert) | **Pending live data** | Crashlytics |
| LC-S3 | RPC error rate under load | < 0.5% across all endpoints (RC-H3) | **Pending live data** | Prometheus/Grafana RPC metrics |
| LC-S4 | P95 RPC latency | < 80 ms under normal load (RC-H4) | **Pending live data** | Prometheus/Grafana |
| LC-S5 | Login success rate | ≥ 99% (addresses the historical login blocker in `MVP_GAP_ANALYSIS.md`) | **Pending live data** | `network_error` events vs. `session_start` |
| LC-S6 | Rollback drill | Verified ≤ 5 min in staging (RC-H9); progressive-rollout rollback criteria configured (`DEPLOYMENT.md`) | **Pending live data** | Staging drill record |

**Matrix gate rule**: a category passes only when every criterion in it is met. Any **Fairness & Trust (3.2)** or **Technical Stability (3.5)** failure is a hard gate — it blocks Path A regardless of how strong retention or revenue looks.

## 4. Data Review Plan

**What to pull** (all available per `docs/ANALYTICS_DASHBOARD.md`):

1. Retention cohorts (D1/D7, DAU/MAU, stickiness) — Firebase Analytics + Mixpanel.
2. The Sprint 8 funnel (install → first PvE completion → first PvP match → first purchase) — built from `app_opened`, `campaign_started`, `pve_stage_completed`, `pvp_lobby_entered`, `pvp_match_started`, `store_viewed`, `purchase_completed`.
3. Economy reports — revenue over time, ARPPU, purchase conversion funnel, gem ledger balance.
4. Pacing/drop-rate per stage — `pve_stage_started` vs. `pve_stage_completed`/`pve_stage_failed` by chapter/stage.
5. Stability — Crashlytics dashboards (crash rate, fatal count, top crashes) cross-referenced with Prometheus `crashlytics_*` metrics.
6. Trust signals — GitHub Issues filtered to `severity:critical`/`severity:high` trust labels; RevenueCat webhook failure log; support escalation log (Discord `#beta-escalations`).
7. PvP health — win/loss distribution by rank delta, punch-up win rate, match-abandon rate (`pvp_match_abandoned`).

**Who reviews**: Product Manager (funnel, retention, economy), QA Lead (LC-T1, stability evidence), Backend Lead (LC-S3–S4, LC-T2), Client Lead (crash dashboards), Security Lead (LC-T5 entitlement, LC-T2), Community Manager (support/qualitative signal), Technical Lead (overall gate rule). Roles mirror the RC sign-off table.

**When**:
- **T-5 business days (data freeze)**: owners pull Section 4 datasets and populate the Section 3 matrix; every `Pending live data` cell gets a real number or an explicit "not measurable — reason".
- **T-3**: async comments on this doc; disagreements on proposed thresholds resolved or recorded.
- **T-0 (launch review meeting)**: walk the matrix, apply Section 6 conditional logic, select the path, fill Section 7 decision record and sign-offs.
- Cadence until then: weekly soft-launch health review (DAU, crash rate, funnel steps) as already practiced per the analytics dashboard's daily health metrics.

## 5. Option Analysis

### Path A — Proceed to Broader Launch

Escalate user acquisition beyond the soft-launch cohort using the progressive rollout machinery (`DEPLOYMENT.md`: disabled → canary → gradual → full), gated by RC hard blockers.

- **Benefits**: starts the revenue/learning clock at scale; validates matchmaking pool density and seasonal leaderboards (both flagged unproven in `MVP_GAP_ANALYSIS.md`); cosmetic-only model limits monetization backlash risk; marketing momentum from tuning wins.
- **Risks**: any latent trust bug (entitlement, ranked fairness) hits orders of magnitude more players; support load (L1–L4 playbook) scales with DAU and may overwhelm a small beta-support bench; store reviews crystallize early — first impressions are near-permanent; an emergency rollback under broad traffic is the most stressful way to first-test RC-H9.
- **Exit criteria / preconditions**: ALL Section 3 categories pass; RC-H1–H10 all `Done`; rollback drill verified; live-ops monitoring (Sprint 8 stretch) at least partially in place.
- **Indicative trigger**: matrix fully green AND at least one full week of stable weekly cohorts.

### Path B — Extend Soft Launch

Keep the current cohort size and continue weekly telemetry-driven fixes outside a dedicated tuning sprint.

- **Benefits**: cheapest option (no new sprint overhead); accumulates statistical power on the existing tuning changes (item 3.12 was marked `Done` only recently — efficacy needs seasoning time); preserves option to go A or C at any weekly review; de-risks the still-`Pending` RC verifications (load test RC-S3, device matrix RC-S2) without deadline pressure.
- **Risks**: cohort too small for stable conversion/ARPPU estimates — decision keeps sliding; soft-launch fatigue (beta level cap, leaderboard resets per the support playbook) erodes the very retention numbers being measured; competitor/season-timing windows pass; "extend" can become indefinite without a hard deadline.
- **Exit criteria / preconditions**: a **time-boxed extension of ≤ 2 weeks with explicit go/no-go re-review date**; dataset judged sufficient (minimum cohort size ratified at review); no open hard-gate failures.
- **Indicative trigger**: gates ambiguous or sample sizes too small, but trend lines healthy and flat-to-improving.

### Path C — Loop One More Balancing Sprint

Run a focused Sprint-9 tuning pass (stage pacing, drop rates, punch-up risk/reward, season rewards — the #735 tuning scope) before deciding again.

- **Benefits**: direct response if LC-E5/LC-F2/LC-F3 fail while trust and stability pass — the classic "fun game, leaky funnel" profile; a full sprint yields shippable deltas rather than drips; historical precedent ("too hard" balance was a prior release driver per `MVP_GAP_ANALYSIS.md`) says pacing changes move retention materially.
- **Risks**: costs a full sprint of calendar; every balance change **resets the telemetry baseline** — funnel and economy numbers before/after the change aren't comparable, adding ~1–2 weeks of new observation before a decision is possible; scope creep from a "tuning" sprint into feature work; diminishing returns if the funnel problem is acquisition-side, not balance-side.
- **Exit criteria / preconditions**: identified, specific, tunable culprits (e.g., named stages with abandon-rate spikes, punch-up reward curve anomalies); trust (3.2) and stability (3.5) gates must already pass — balancing on top of trust bugs wastes the sprint.
- **Indicative trigger**: hard gates green AND economy/funnel gates red with diagnosable, parameter-level causes.

## 6. Recommendation (Conditional)

**No path is recommended unconditionally today** — the repo holds no live metrics, and issue #740's own acceptance criteria require that data be reviewed with stakeholders first. The recommended path is selected by the first matching rule below, evaluated at the T-0 launch review:

```text
RULE 1 (hard gate):  Any LC-T* (fairness/trust) or LC-S* (stability) criterion FAILS
       ->           Path B (extend) if fixes are small/known, else Path C scoped to
                    the trust/stability failures — NEVER Path A with an open hard gate.
                    (Mirrors RC "any open hard blocker = NO-GO".)

RULE 2 (all green):  All five categories pass AND all RC hard blockers Done
       ->           Path A, entering progressive rollout at "canary", with rollback
                    criteria (errorRateThreshold / latencyThreshold / healthCheckFails)
                    configured per DEPLOYMENT.md.

RULE 3 (economy/funnel red, trust+stability green):
       ->           Path C (one more balancing sprint) targeting the specific failing
                    LC-E*/LC-F* criteria; re-decide after a fresh telemetry window.

RULE 4 (retention red, everything else green or near-miss):
       ->           Path B extended ≤ 2 weeks with a named re-review date, while the
                    team investigates whether the retention miss is onboarding-side
                    (LC-F1/LC-F5) or content-side before spending a sprint.

RULE 5 (insufficient data):  Sample sizes too small to evaluate any category
       ->           Path B with an explicit cohort-growth or minimum-sample plan;
                    escalate cohort acquisition; re-review at the deadline.
```

**Provisional expectation (not a decision)**: given that several RC hard blockers were still `Pending` at the time of this draft and the Sprint 8 tuning pass has had limited live exposure, the most likely outcome of an honest early review is **Rule 5 → Path B, time-boxed**, graduating to A or C as data matures. This expectation must be overridden by actual data, not by schedule pressure.

## 7. Decision Record and Next Steps

### Decision record (to be completed at T-0)

| Field | Value |
|-------|-------|
| Selected path | A / B / C *(circle one)* |
| Date of data freeze | |
| Date of decision meeting | |
| Matrix result summary (pass/fail per category) | Retention: / Trust: / Economy: / Funnel: / Stability: |
| Rule applied (Section 6) | |
| Conditions (if any) | |
| Re-review date (required if Path B) | |

### Next steps

| # | Action | Owner | Due |
|---|--------|-------|-----|
| 1 | Ratify proposed thresholds (LC-R*, LC-E1, LC-E4, LC-E5, LC-F*, minimum sample sizes) | Product Manager + Technical Lead | T-3 |
| 2 | Pull datasets (Section 4) and populate matrix with real numbers | Category owners per Section 4 | T-5 → freeze |
| 3 | Verify RC-H1/H3–H6/H9/H10 and RC-S2–S4 statuses; update `docs/RELEASE_CANDIDATE_CHECKLIST.md` | QA / Backend / DevOps / Client / Security Leads | T-3 |
| 4 | Close or down-scope any open trust P0/P1s (LC-T1) | Technical Lead | T-0 |
| 5 | Hold launch review; apply Section 6 rules; record decision above | All signatories | T-0 |
| 6 | Execute selected path; if A, configure progressive rollout + rollback criteria; if B, set re-review deadline; if C, open Sprint 9 tuning backlog from failing LC-E*/LC-F* items | Technical Lead / Product Manager | T+2 |
| 7 | Post decision summary to the team and update #740 / #735 | Product Manager | T+2 |

### Sign-off (intentionally left blank — human stakeholders only)

| Role | Name | Approve | Date | Notes |
|------|------|---------|------|-------|
| Technical Lead | | | | |
| Product Manager | | | | |
| QA Lead | | | | |
| Backend Lead | | | | |
| Client Lead | | | | |
| DevOps Lead | | | | |
| Security Lead | | | | |
| Community Manager | | | | |

## 8. References

- Issue #740 (this decision), Issue #735 (Sprint 8 umbrella — funnel and trust mandate)
- `docs/armored-archer_prd.md` — product goals, cosmetic-only monetization, server authority
- `docs/RELEASE_CANDIDATE_CHECKLIST.md` — RC hard/soft blockers, GO/NO-GO format
- `docs/ANALYTICS_DASHBOARD.md` — event taxonomy, funnels, Mixpanel/Amplitude/Firebase setup
- `docs/CRASH_ALERT_THRESHOLDS.md` — crash alert thresholds
- `DEPLOYMENT.md` — progressive rollout phases and rollback criteria
- `docs/BETA_SUPPORT_PLAYBOOK.md` — escalation levels and beta-known-issue context
- `MVP_GAP_ANALYSIS.md` — pillar status and historical P0 gaps
