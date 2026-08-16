# Sprint 8 Summary — Soft Launch Tuning and Release Candidate

**Issue**: [#735 — Sprint 8 — Soft Launch Tuning and Release Candidate](https://github.com/anchapin/armored-archer/issues/735)
**Sprint length**: 2 weeks
**Report date**: 2026-08-16
**Exit state**: Documentation and decision artifacts delivered; RC designation and launch-path decision **remain gated on stakeholder sign-off** (see [Sprint Exit State](#sprint-exit-state))

---

## Sprint Goal and Definition of Done

**Primary goal** (from #735): Use real usage data to fix the last retention, fairness, and economy issues before MVP release.

**Definition of Done**: One release candidate exists with no unresolved trust-system blockers.

**Dependencies**: Sprint 7 beta readiness and live cohort access.

**Honest reading of the DoD at sprint close**: the deliverable-side scaffolding for the DoD now exists — a complete RC checklist with an explicit trust-blocker section (`docs/RELEASE_CANDIDATE_CHECKLIST.md` §3, hard blocker RC-H3) and a launch-path decision framework that hard-gates any launch on trust and stability criteria. However, the DoD is not met in the literal sense: the RC checklist's verification gates and stakeholder sign-offs are not yet green, and several trust checks remain `Pending` verification against live data (see the status table below). This sprint closed with the RC **process** in place, not with a signed-off RC **build**.

---

## Item-by-Item Status

Legend: **Delivered** = artifact merged to `main` with a closed tracking issue. **In progress / pending** = dependent on live soft-launch data or human stakeholders — completion is **not** claimed without evidence.

### Must-Have Items

| # | Item (from #735) | Status | Evidence / Notes |
|---|------------------|--------|------------------|
| 1 | Monitor funnel drop-off from install to first PvE completion to first PvP match to first purchase | **Partially delivered — instrumentation done, live monitoring ongoing** | Funnel tracking instrumentation is marked Done in the RC checklist (item 6.9, "Sprint 8 analytics"), and the funnel is defined as launch criteria LC-F1–F5 in `docs/LAUNCH_PATH_DECISION.md` §3.4. Actual drop-off measurement requires live soft-launch cohorts; every LC-F* cell is **pending live data**. No tracking issue ever existed for this item. |
| 2 | Tune stage pacing, drop rates, punch-up risk/reward, and season rewards using live telemetry | **Partially delivered — tuning pass executed, efficacy unvalidated** | RC checklist item 3.12 (gameplay balance) is marked Done for the Sprint 8 tuning pass. `docs/LIVE_OPS_CALENDAR.md` §5 defines telemetry-driven cadence-adjustment triggers for exactly these systems. However, per `docs/LAUNCH_PATH_DECISION.md` §2, efficacy against live telemetry "is exactly what this decision reviews" — validation is pending (LC-E5, LC-F2/F3). |
| 3 | Fix all P0 and P1 issues that affect trust: combat authority, ranked fairness, progression loss, or purchase entitlement | **Not complete — code-level checks largely green, verification sweeps pending** | RC checklist §3 records the trust audit: 14 of 21 checks Done (combat authority T-C1–C4, ranked fairness T-R1–R4, core progression T-P1–P2, entitlement T-E1/T-E3–E4). Still `Pending`: the four tracker sweeps (T-C5, T-R5, T-P5, T-E6 — RC-H1/H3 hard blockers), device tests T-P3/T-P4, and sandbox entitlement tests T-E2/T-E5. These require live data and/or manual verification and are formal NO-GO blockers until resolved. No tracking issue ever existed for this item. |
| 4 | Produce a release candidate checklist and sign-off package | **Delivered** | [`docs/RELEASE_CANDIDATE_CHECKLIST.md`](RELEASE_CANDIDATE_CHECKLIST.md) (v3.6.0-rc.1) — five readiness gates, 11 hard + 9 soft blockers, trust-blocker audit (§3), rollout/rollback plan, sign-off record. Issue [#739](https://github.com/anchapin/armored-archer/issues/739) closed via PR [#851](https://github.com/anchapin/armored-archer/pull/851). |
| 5 | Decide whether to proceed to broader launch, extend soft launch, or loop one more balancing sprint | **Framework delivered — decision itself pending** | [`docs/LAUNCH_PATH_DECISION.md`](LAUNCH_PATH_DECISION.md) defines launch criteria (5 categories, 26 criteria), a data-review plan, option analysis for Paths A/B/C, and a conditional rule-based recommendation. The final decision requires the T-0 launch review with real metrics and stakeholder sign-off; the document's status is DRAFT and no path is recommended unconditionally. Issue [#740](https://github.com/anchapin/armored-archer/issues/740) closed via PR [#852](https://github.com/anchapin/armored-archer/pull/852). |

### Stretch Items

| # | Item (from #735) | Status | Evidence / Notes |
|---|------------------|--------|------------------|
| 6 | Add post-match and post-purchase surveys for qualitative feedback | **Not started** | No artifact, issue, or PR exists for this item. Qualitative feedback during soft launch continues through the existing support channels (`docs/BETA_SUPPORT_PLAYBOOK.md`) and the in-app feedback system (RC checklist RC-S7). Recommend re-scoping into a post-launch live-ops backlog item. |
| 7 | Prepare a lightweight live-ops calendar for the first post-launch season | **Delivered** | [`docs/LIVE_OPS_CALENDAR.md`](LIVE_OPS_CALENDAR.md) — Season 1 ("First Blood") week-by-week calendar, event types mapped to existing server-authoritative systems, content release schedule (C1–C10), telemetry-driven adjustment triggers, RACI. Draft pending team sign-off (by design — signature fields are human-only). Issue [#742](https://github.com/anchapin/armored-archer/issues/742) closed via PR [#853](https://github.com/anchapin/armored-archer/pull/853). |

### Scorecard

| Category | Count |
|----------|-------|
| Must-have items delivered as documentation artifacts | 2 of 5 (#4, #5) |
| Must-have items partially done, gated on live data / verification | 3 of 5 (#1, #2, #3) |
| Stretch items delivered | 1 of 2 (#7) |
| Stretch items not started | 1 of 2 (#6) |

---

## Sprint Exit State

**What was delivered** (all merged to `main`):

1. `docs/RELEASE_CANDIDATE_CHECKLIST.md` — the RC checklist and sign-off package (PR #851, issue #739).
2. `docs/LAUNCH_PATH_DECISION.md` — the launch-path decision framework with conditional recommendation (PR #852, issue #740).
3. `docs/LIVE_OPS_CALENDAR.md` — the Season 1 live-ops calendar, stretch goal (PR #853, issue #742).

**What is explicitly NOT done** (no completion is claimed):

- **RC designation for v3.6.0**: the RC checklist's readiness gates, hard blockers, and stakeholder sign-off table (§8) are not yet green. The document's own status is "Pending Verification."
- **The launch-path decision (Path A/B/C)**: `docs/LAUNCH_PATH_DECISION.md` is a DRAFT decision framework. The decision requires the T-0 launch review populated with live data (its §7 decision record is blank by design).
- **Live-data tuning validation, funnel measurement, and the trust P0/P1 verification sweeps**: these are operational activities that require live soft-launch telemetry and manual/stakeholder verification, which cannot be completed from the repository alone.

**Gating statement**: the sprint's Definition of Done ("one release candidate exists with no unresolved trust-system blockers") remains **open**, gated on the verification and sign-off process defined in `docs/RELEASE_CANDIDATE_CHECKLIST.md` ( Gates A–E, RC-H1–H11, trust section §3) and the data review defined in `docs/LAUNCH_PATH_DECISION.md` §4. This summary closes the umbrella issue's deliverable scope, not the RC process itself.

---

## Follow-Ups (Open Stakeholder Actions)

Owners are intentionally blank — to be assigned by the release manager. Sources: RC checklist §8, launch-path decision §7 next steps, live-ops calendar §4/§6.

| # | Follow-up action | Source | Owner | Due |
|---|------------------|--------|-------|-----|
| 1 | Execute the RC verification plan: complete Gates A–E, hard blockers RC-H1–H11, and checklist categories 1–7 in `docs/RELEASE_CANDIDATE_CHECKLIST.md` | RC checklist | | Per release train (T-7d → T-2d) |
| 2 | Run the four trust tracker sweeps (T-C5, T-R5, T-P5, T-E6) and the pending device/sandbox trust tests (T-P3, T-P4, T-E2, T-E5) | RC checklist §3 | | Before RC sign-off |
| 3 | Ratify proposed launch thresholds (LC-R*, LC-E1/E4/E5, LC-F*, minimum sample sizes) | Launch decision §7.1 | | T-3 |
| 4 | Pull live datasets (retention, funnel, economy, stability, trust signals) and populate the launch criteria matrix with real numbers | Launch decision §4/§7.2 | | T-5 (data freeze) |
| 5 | Hold the T-0 launch review; apply the Section 6 rule set; record the Path A/B/C decision and collect sign-offs | Launch decision §7.5 | | T-0 |
| 6 | Collect the nine stakeholder sign-offs and the Release Manager GO/NO-GO decision in the RC checklist §8 | RC checklist §8 | | Before store submission |
| 7 | Run the live-ops calendar kickoff; fill RACI names and obtain calendar sign-off | Live-ops calendar §6 | | T-14 relative to launch |
| 8 | Decide whether to re-scope the not-started surveys stretch item (post-match/post-purchase qualitative surveys) into a post-launch live-ops backlog | This summary | | Next sprint planning |
| 9 | Post the launch-path decision summary to the team and update the tracking issues | Launch decision §7.7 | | T+2 |

---

## References

- Umbrella issue: [#735](https://github.com/anchapin/armored-archer/issues/735)
- Sub-issues: [#739](https://github.com/anchapin/armored-archer/issues/739) (closed, PR [#851](https://github.com/anchapin/armored-archer/pull/851)) · [#740](https://github.com/anchapin/armored-archer/issues/740) (closed, PR [#852](https://github.com/anchapin/armored-archer/pull/852)) · [#742](https://github.com/anchapin/armored-archer/issues/742) (closed, PR [#853](https://github.com/anchapin/armored-archer/pull/853))
- Delivered artifacts: `docs/RELEASE_CANDIDATE_CHECKLIST.md`, `docs/LAUNCH_PATH_DECISION.md`, `docs/LIVE_OPS_CALENDAR.md`
- Supporting: `docs/ANALYTICS_DASHBOARD.md`, `docs/BETA_SUPPORT_PLAYBOOK.md`, `DEPLOYMENT.md`, `MVP_GAP_ANALYSIS.md`
