# .planning/

Project planning workspace: scope, requirements, roadmap, state, and the
per-milestone execution record.

## Layout

- **Top level** — living core documents: `PROJECT.md`, `REQUIREMENTS.md`,
  `ROADMAP.md`, `STATE.md`, `MILESTONES.md`, `MVP-SCOPE.md`, `MVP-STORIES.md`,
  `RPC-MAP.md`, `GETTING-STARTED.md`, `ADR-001-BACKEND-RUNTIME-DECISION.md`,
  `VERTICAL_SLICE_STORIES.md`, `VERTICAL_SLICE_SMOKE_TEST.md`,
  `test-infrastructure-improvement-plan.md`, `config.json`.
- **`milestones/`** — per-version milestone records (v2.0.0 onward), retained:
  living docs and runbooks cite these paths.
- **`phases/`** — per-phase execution records, retained for the same reason;
  also cited from code comments (e.g. `autoloads/DifficultyScalingManager.gd`).
- **`research/`** — general reference research (`ARCHITECTURE.md`,
  `FEATURES.md`, `STACK.md`, `PITFALLS.md`, `SUMMARY.md`).

## Archived material

Concluded milestone proposals, audits, completion reports, and one-off plans
moved to `docs/archive/pre-v4/planning/` (2026-10 cleanup sweep). Phase-specific
research (`PHASE-18/26-RESEARCH`) moved with them; general research stays here.
History is preserved via `git mv` — use `git log --follow` on the new paths.
