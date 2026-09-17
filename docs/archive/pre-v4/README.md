# Archived pre-v4.0.0 Docs

Historical snapshots of milestones concluded before the current v4.0.0
("Gameplay Refinement") effort. Retained for traceability and to preserve
`git blame` / history (`git log --follow` resolves across the move). These
files are not maintained; see their in-tree successors for current state.

## Archived files

| Original path | Archived path | One-line context |
| --- | --- | --- |
| `docs/v2.6.0-VERIFICATION.md` | `docs/archive/pre-v4/v2.6.0-VERIFICATION.md` | Milestone v2.6.0 (Integration & Handler Coverage) verification — wrap-up doc, status COMPLETE, dated 2026-03-22 |
| `docs/MVP_BURNDOWN_DASHBOARD_README.md` | `docs/archive/pre-v4/MVP_BURNDOWN_DASHBOARD_README.md` | Lightweight MVP burndown dashboard for Sprint 0–8; pre-dates the v4.0.0 work and the project has since shipped all four MVP pillars |
| `docs/PERFORMANCE_REPORT.md` | `docs/archive/pre-v4/PERFORMANCE_REPORT.md` | "Performance Report: Milestone v3.0.0 Alpha Readiness" — 2026-03-23 load-test report for the v3.0.0 ship; superseded by [`docs/PERFORMANCE.md`](../PERFORMANCE.md) |

## What is NOT here

- `docs/PERFORMANCE.md` — current performance targets & budget-device spec; references issue #1073 and the canonical `backend/tests/fixtures/performance/performance-targets.json`. **Not archived.**
- `docs/RELEASE_NOTES_v3.6.0.md` — v3.6.0 (Soft Launch RC) release notes. Content explicitly names the prior milestone but **not moved** because the still-active `docs/RELEASE_CANDIDATE_CHECKLIST.md` (Status: Pending Verification, last touched 2026-08-18) references the old path in three places; updating those references would require content edits, which is out of scope for this archival pass.
- `docs/RELEASE_CANDIDATE_CHECKLIST.md` — still-active v3.6.0-rc.1 checklist (last touched 2026-08-18); pending stakeholder sign-off. **Not archived** while the v3.6.0 RC process is open.
- `docs/SPRINT_8_SUMMARY.md` — Sprint 8 / v3.6.0 RC closure retrospective, last touched 2026-08-16. Recent and cross-referenced by the active RC checklist. **Not archived.**
- `docs/mvp/MVP-SCOPE.md` — already self-labeled "Archived" in its title; `README.md` still links to its live path. **Not moved** (would require `README.md` content edits to follow the link, which is out of scope for issue #1102).
- `docs/mvp/MVP-2_PREREQUISITES.md` — live MVP-2 unblocking checklist, last touched 2026-08-17. **Not archived.**
- `docs/adr/0001…0006` — all status `Accepted`; no `Proposed` / `Superseded` drafts. **Not archived.**

## Why the git-mv pattern

Every entry above was moved with `git mv` (not deleted + recreated). This
preserves the file's blob hash and rename edge in git history, so:

- `git log --follow -- docs/archive/pre-v4/<file>` resolves back to the
  original commit and author chain.
- `git blame docs/archive/pre-v4/<file>` keeps the line-level provenance.
- Any external link that landed during the pre-v4 era continues to work
  via the rename edge.