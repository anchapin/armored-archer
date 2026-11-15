---
description: Test rules — naming, GUT vs legacy runner placement, backend Jest layout
paths:
  - "test/**"
  - "backend/src/**/__tests__/**"
  - "backend/scripts/__tests__/**"
  - "backend/tests/**"
---

# Test rules

> **Extraction, not new policy.** Every rule below quotes or summarises a
> statement that already exists in [`AGENTS.md`](../../AGENTS.md) (source of
> truth) or in the suite documentation `AGENTS.md` links to. Nothing here adds a
> new coding standard. If this file and `AGENTS.md` disagree, `AGENTS.md` wins.

## 1. Two Godot test systems — know which one you are adding to

> **AGENTS.md:44** — "Two Godot test systems coexist and both run in CI: the
> custom runner (`test/run_all_tests.gd`) and GUT (`test/suites/`, run via
> `addons/gut/gut_cmdln.gd` with `.gutconfig.json` in `coverage.yml` and
> `./scripts/local-godot-tests.sh --gut`). **New suites go in `test/suites/`.**"

- **New Godot test suites go in `test/suites/`** (GUT), not in the legacy
  runner directory.
- The legacy custom runner (`test/run_all_tests.gd`, files `test/test_*.gd`)
  stays as it is; do not add new suites to it.

> [`test/suites/README.md`](../../test/suites/README.md) — "Test files should be
> named `test_<component_name>.gd` and placed in the appropriate suite
> directory."

> **AGENTS.md:147** — "Run headlessly as shown above; treat `Failed: N` in
> output as the pass/fail signal." (The runner's **exit code is unreliable** —
> AGENTS.md §Build & Development Commands; read the output, not `$?`.)

## 2. GUT conventions

- GUT config: `.gutconfig.json` — `dirs: ["res://test/suites"]`,
  `include_subdirs: true`, file `prefix: "test_"`, `suffix: ".gd"`.
- Every suite extends `GutTest` (`test/suites/README.md` §GUT Test Structure).
- Suite directories are organised by subsystem (`player/`, `combat/`, `gear/`,
  `network/`, `campaign/`, `season/`, `store/`, `transmog/`, `gem/`,
  `safe_area/`, `auto_aim/`, `ui/`, `object_pool/`, `performance/`,
  `analytics/`) — put a new suite in the matching directory.
- **AGENTS.md:44** — "The GUT suite carries a pre-existing failure baseline
  (issue #894); CI gates on *no new failures* vs `data/gut-baseline.json`
  (`scripts/gut_baseline_gate.py`) — ratchet the baseline down as suites are
  fixed, **never raise it**."
- Flaky detection: `python3 scripts/detect_godot_flaky_tests.py` (history in
  repo-root `data/godot-flaky-test-history.json`) — **AGENTS.md:148**.

## 3. Backend (Jest) placement

> **AGENTS.md:140** — "ESM `import` syntax. **Tests must match `*.test.ts`.**"

> **AGENTS.md:151** — "**Unit tests** are colocated at `src/**/__tests__/*.test.ts`
> and `scripts/__tests__/*.test.ts`; the default `jest.config.js` roots are
> `src/` + `scripts/`, so tooling tests also run under `npm test`."

> **AGENTS.md:152** — "**Integration tests** only match
> `backend/tests/integration/**` (`jest.integration.config.js`)."

> **AGENTS.md:153-155** — "**Schema tests** (`npm run test:schema`) match only
> `tests/integration/schema.test.ts`"; "**Property-based tests**
> (`npm run test:property`) use `jest.property.config.js` with roots =
> `tests/unit/` — outside the default roots"; "**Benchmark gate**
> (`npm run test:benchmark`) … matches only
> `tests/integration/low_end_device_performance.test.ts`".

- Unit test → colocated `__tests__/*.test.ts`; integration test →
  `backend/tests/integration/**`; property test → `backend/tests/unit/`.
- Single file: `npm test -- <path-or-pattern>` — **AGENTS.md:151**.
- CI enforces ~80% coverage thresholds — **AGENTS.md:156**.

## 4. Shell / tooling tests

- Python tooling tests live in `scripts/tests/` and run with
  `python3 -m unittest discover -s scripts/tests -p '<pattern>'` (the pattern
  CI uses, e.g. `test_download_godot.py`, `test_compose_ports.py` — see
  `.github/workflows/ci.yml`).
- Keep a tooling test next to the tool it covers (`scripts/tests/…` for
  `scripts/…`), and keep it runnable without the full stack.
