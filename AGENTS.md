# Armored Archer — Agent Development Guidelines

Godot 4.6 mobile archery auto-shooter with a Nakama (TypeScript) backend and PostgreSQL. The repo root **is** the Godot project (`res://`); the server lives in `backend/`. The game is server-authoritative: clients send actions, Nakama RPCs validate and compute results.

## CI outage recovery

When every hosted Actions job fails with *"recent account payments have failed or your spending limit needs to be increased"*, it is **account-billing**, not a code problem — see [`docs/ci/ci-billing-recovery.md`](docs/ci/ci-billing-recovery.md) (issue #855). Detection: `gh api orgs/anchapin/settings/billing/actions` and the annotation on check run `95179007068`. **Fix must be performed by a repo/org owner in Settings → Billing & plans** — no code change unblocks the gate. While hosted CI is dark, use `./scripts/local-godot-tests.sh`, `cd backend && npm run lint && npm test`, and the `act` matrix on `.github/workflows/ci.yml` (PR #889; if `act` fails on git clone, run `make ci-clear-cache`); never disable required status checks as a workaround.

**Host-memory rule while hosted CI is dark (issue #993):** run `make ci` (act) and `./scripts/local-godot-tests.sh` **sequentially, never concurrently** — Node/tsc jobs inside act containers plus concurrent headless Godot suites exhausted host RAM and OOM-killed `backend-typecheck`. Failure signature: act reports `exitcode '137'` (SIGKILL) with **zero** error/compiler output → suspect host OOM and re-run the job in isolation before debugging. `scripts/ci-local.sh` warns and waits before each act job when available memory is low (tune via `ACT_MIN_FREE_MB`, default 2048, and `ACT_MEM_WAIT_SECS`, default 120 — service-container act jobs like backend-integration-test wait `ACT_SERVICE_MEM_WAIT_SECS`, default 300, and are refused while only the lean ci-fast compose is up). Act invocations are themselves serialized through a shared lock (`scripts/lib/act-lock.sh`, issues #992/#1028): `ci-local.sh`, `run-ci-locally.sh`, and `act-cleanup.sh` all acquire it to prevent `~/.cache/act` git-clone races — don't invoke `act` outside these wrappers.

## Project Structure

```text
/                          # Godot 4.6 client project (res://)
├── autoloads/             # 55 singletons registered in project.godot [autoload] (52 here + 3 elsewhere: EnemySpawner→scenes/, GutCoverageTracker→addons/gut/, AnalyticsManager→addons/analytics_manager/); `const.gd` lives here but is NOT an autoload
│   └── const.gd           # Shared constants (use for anything needed in 3+ files)
├── scenes/                # .tscn organized by feature (player/, enemies/, ui/, pvp/, effects/)
├── scripts/               # 80+ root-level files: shared GDScript + dev tooling (shell/python/ts)
├── assets/                # Sprites, sounds, music
├── addons/                # gut (testing), analytics_manager, genesis_bridge, godot_mcp
├── test/                  # test/*.gd = legacy custom runner (used by CI)
│   └── suites/            # GUT suites (config: .gutconfig.json; see suites/MIGRATION_GUIDE.md)
├── themes/                # UI themes
├── data/                  # Tooling state (flaky-test history, coverage history) — NOT SQL migrations
├── docs/                  # Deep dives: PRD, ADRs (docs/adr/), runbooks, per-feature docs
├── script_templates/      # Custom Godot script templates
├── pyproject.toml         # Python tooling deps (ruff, pyinstrument); root requirements.txt has gdlint/gdtoolkit
├── .actrc                 # act config (pin slim runner image, headless Godot env)
└── project.godot          # Main scene: scenes/ui/login_screen.tscn; features: 4.6, Mobile

/backend/                  # Nakama 3.21 server (strict TypeScript)
├── src/index.ts           # Entry point; domain modules under src/modules/
│   └── **/__tests__/      # Unit tests (colocated with source)
├── tests/integration/     # Integration tests (the only dir the integration jest config matches)
├── scripts/               # Build/validation tooling (bundle, flaky, tech-debt, agents-md)
├── data/                  # SQL migrations (source of truth) + nakama config ymls
├── build/                 # Compiled output (do not edit)
├── .env.example           # Copy to .env before starting services
├── start.sh               # Validates env, then starts services
└── docker-compose.yml     # Full local stack
```

- `*.uid` files next to `.gd`/`.tscn` are Godot-generated — never hand-edit.
- Two Godot test systems coexist and both run in CI: the custom runner (`test/run_all_tests.gd`) and GUT (`test/suites/`, run via `addons/gut/gut_cmdln.gd` with `.gutconfig.json` in `coverage.yml` and `./scripts/local-godot-tests.sh --gut`). New suites go in `test/suites/`. The GUT suite carries a pre-existing failure baseline (issue #894); CI gates on *no new failures* vs `data/gut-baseline.json` (`scripts/gut_baseline_gate.py`) — ratchet the baseline down as suites are fixed, never raise it.
- `RPC_MAP.md` is the authoritative per-RPC reference (client caller, server handler, storage ownership) — update it whenever RPCs change.
- `CONTEXT.md` holds the ratified domain vocabulary; use its terms verbatim and respect the `_Avoid_` anti-terms (e.g. Dynamic Difficulty ≠ `difficulty_scaling.ts`).
- SQL migrations live only in `backend/data/` — the former root `migrations/` partial copy was deleted in issue #1034; never recreate it.
- `backend/data/modules/` is compiled Nakama bundle output regenerated by `npm run build:full` — gitignored since issue #996; never commit it even though it sits inside the migrations dir.

## Build & Development Commands

### Godot Client (GDScript)

Requires Godot **4.6** in PATH as `godot4` (or set `GODOT_BINARY`).

```bash
# Fresh clone / after new assets: import once before direct headless runs
# (local-godot-tests.sh runs this automatically on fresh checkouts — issue #991)
godot4 --headless --quit --import

# Full GDScript test suite (what CI runs)
godot4 --headless --script test/run_all_tests.gd

# Lint directly (pip install gdtoolkit) — CI lints the whole repo (issue #990)
gdlint .

# Wrapper (use when GitHub Actions / act is unavailable)
./scripts/local-godot-tests.sh            # lint + syntax + tests + GUT (default = --all)
./scripts/local-godot-tests.sh --all      # explicit: run everything
./scripts/local-godot-tests.sh --quick    # no Godot binary required
./scripts/local-godot-tests.sh --lint     # gdlint only
./scripts/local-godot-tests.sh --syntax
./scripts/local-godot-tests.sh --tests
./scripts/local-godot-tests.sh --gut      # GUT suite only (test/suites)
./scripts/local-godot-tests.sh --help     # full flag list
```

Gotchas:
- The test runner's **exit code is unreliable** (non-zero on resource leaks, not failures). Check output for `Failed: N`.
- No single-test filter for the legacy runner: `run_all_tests.gd` hardcodes its file list and ignores CLI args — trim it temporarily to run a subset. For scoping, use GUT instead (`-gdir=... -gselect=<filename substring>`; see `test/suites/MIGRATION_GUIDE.md`).
- `act` (local GitHub Actions) **skips** Godot tests — they OOM in containers. Use `local-godot-tests.sh` instead.

### Backend (TypeScript / Nakama)

Requires Node 20 (CI pin) and Docker. Bootstrap from repo root: `make setup` (backend npm deps + git hooks).

```bash
cd backend
npm install                 # package-lock.json is tracked — keep it in sync
cp .env.example .env        # required; start.sh refuses to run without it

npm run dev                 # ts-node-dev auto-reload on src/index.ts
npm run build               # tsc only (output → backend/build/)
npm run build:full          # build + bundle:nakama (webpack + transpile-bundle.js) + bundle:validate — emits backend/data/modules/ (gitignored)
npm run lint                # eslint (src/)
npm run typecheck           # tsc --noEmit
```

From repo root: `make backend-check` = lint + typecheck; `make help` lists all targets.

### Services (Docker Compose)

```bash
make services-start     # = backend-start; robust cold-start with health-check waits (issue #907)
make services-stop | services-status | services-health | services-logs | services-clean
make services-restart-destructive   # drop postgres volume + re-run cold-start (self-heal test, #907)
make services-assert-cold-start      # assert all-green (suitable for CI / act)
```

Stack: `armored_archer_server` (Nakama 3.21 — API :7350, console http://localhost:7351, credentials from `backend/.env`), `armored_archer_db` (PostgreSQL 14), plus redis and a full observability stack (prometheus, grafana, loki, tempo, otel-collector, promtail, alertmanager, node-exporter).
Local Postgres is published on host port **5433** (compose maps `5433:5432` — 5432 on the host is *not* this stack); the DSN is built from `POSTGRES_*` in `backend/.env` (defaults: user `postgres`, db `nakama`, compose fallback password `changeme`).
Compose source of truth: `backend/docker-compose.yml` — there is intentionally **no root `docker-compose.yml`** (removed in issue #1033; a root copy made `./data/modules` resolve to a stale/unbuilt path). Run compose from `backend/` or via the `make services-*` targets; `act` services use `.github/docker-compose.yml` via `make ci-services-*`.

### Database (PostgreSQL)

```bash
make services-health                 # confirm stack is healthy before touching schema
make check-game-schema               # pure-read verification that game tables exist (issue #891)
make backend-migrate                 # nakama migrate up (reads backend/.env; HUMAN-SUPERVISED — see docs/db/MIGRATIONS.md)
make backend-migrate-new             # scaffold a new migration
cd backend && npm run test:schema    # schema tests
```

Key tables: `player_stats`, `catalog`, `inventory`, `loadout`. Enums: `gear_type` (helm/armor/bow/arrow/amulet), `gear_rarity` (common/rare/epic/legendary). Reference: `backend/DATABASE_SCHEMA.md`; migrations live in `backend/data/*.sql`. **Schema changes always require human review** — see [`docs/db/MIGRATIONS.md`](docs/db/MIGRATIONS.md) for the local-stack runbook (pre-flight, two-engineer review, verification queries, forward-only warning).

## GDScript Code Style

- `snake_case` functions/variables, `PascalCase` files/scenes/classes, `UPPER_SNAKE_CASE` constants, `_` prefix for privates, past-tense signal names.
- Organize with `# --- Section Name ---` dividers; comment a method's purpose above it.
- Explicit type hints everywhere in production code (`var speed: float = 300.0`, `func get_damage() -> int:`).
- `@export` for Inspector-tunable values, `@onready` to cache node refs, `const X = preload(...)` for scene preloads.
- Prefer signals over direct node calls for cross-module communication.
- Safety: `get_node_or_null()`, `has_method()` before calling unknown nodes, `push_error()`/`push_warning()`, `queue_free()` for cleanup.
- Pool frequently spawned objects (arrows, popups) via the `ObjectPool` autoload; add cleanup timers to projectiles.
- Constants shared by 3+ files go in `autoloads/const.gd`. Start new scripts from `script_templates/`.

## TypeScript Code Style (Nakama Backend)

- `"strict": true`; interfaces for data structures, enums for fixed sets; validate input with **`valibot`** (canonical — see `backend/src/modules/validation.ts`). `zod` is a legacy holdover in `xp_manager.ts`; don't introduce new `zod` imports.
- ESM `import` syntax. Tests must match `*.test.ts`.
- Server-authoritative: never trust client input; combat results and loot are computed server-side from stored stats.
- `async/await` with try/catch around DB ops; log via winston; never leak internals in client-facing errors.

## Testing Guidelines

### Godot
- Run headlessly as shown above; treat `Failed: N` in output as the pass/fail signal.
- Flaky detection: `python3 scripts/detect_godot_flaky_tests.py` (history in repo-root `data/godot-flaky-test-history.json`).

### Backend (Jest)
- **Unit tests** are colocated at `src/**/__tests__/*.test.ts` and `scripts/__tests__/*.test.ts`; the default `jest.config.js` roots are `src/` + `scripts/`, so tooling tests also run under `npm test` (issues #994, #1029). Single file: `npm test -- <path-or-pattern>` (e.g. `npm test -- login`).
- **Integration tests** only match `backend/tests/integration/**` (`jest.integration.config.js`). Run `npm run test:integration` with the stack up (`make services-start`).
- **Schema tests** (`npm run test:schema`) match only `tests/integration/schema.test.ts` and need PostgreSQL but not a running Nakama server (issue #893) — the cheapest post-migration verification.
- **Property-based tests** (`npm run test:property`) use `jest.property.config.js` with roots = `tests/unit/` — outside the default roots (issue #1031).
- **Benchmark gate** (`npm run test:benchmark`) uses `jest.benchmark.config.js` and matches only `tests/integration/low_end_device_performance.test.ts`; it needs no services (issue #1031) but **requires a real-measurement snapshot** from a headless Godot run (issue #1073): `./scripts/run-headless-performance-benchmark.sh` first (the workflow generates it automatically; without it the gate fails by design). Thresholds live in `backend/tests/fixtures/performance/performance-targets.json` (canonical; `docs/PERFORMANCE.md` mirrors it).
- CI enforces ~80% coverage thresholds (`jest.config.js` + coverage gates in `test.yml`).
- Git hooks (husky, `backend/.husky/`): pre-commit runs lint-staged on staged TS; pre-push runs the full backend suite. Skip deliberately with `git commit --no-verify`.
- Flaky detection: `npm run test:flaky`. Smoke: `make smoke-test-quick`.

## Architecture Notes

- Auth: Firebase. IAP: RevenueCat. Client talks to Nakama via `@heroiclabs/nakama-js`; the `NetworkManager` autoload owns the session/RPC calls.
- Transmog: base gear carries all stats (gameplay-earned); cosmetic skins are visual-only (IAP). The client combines base + skin for rendering.
- Ratified decisions are ADRs in `docs/adr/`: PRD governance (0001), server-declared match settlement (0002), hybrid duel model (0003), legacy duel-RPC decommission (0004), combat authority boundary (0005), admin-gate allowlist policy (0006) — read the relevant one before touching duel, settlement, combat-authority, or admin-gate code.
- The Nakama bundle has a size budget enforced by `make bundle-size-check` (config: `backend/bundle-size-limits.json`).

## Commit & PR Guidelines

- Commit message format: conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, ...) — release notes are generated from them (`make release-notes`).
- A local `commit-msg` hook (installed by `make setup`; issue #1157) enforces: conventional subject, `[AI-assisted]` prefix + `AI Model:`/`Task:` trailers on AI-made commits, subject ≤ 100 chars, body wrapped at 72. Pre-check a message file with `make commit-check MSG=<file>`; emergency escape hatch: `[skip-ai-check]` in the body. CI re-enforces the trailer contract on every PR via the `ai-trailer-check` workflow (`scripts/ci-check-ai-trailers.sh` walks `origin/base..HEAD` through the same validator; issue #1173).
- Branches: `fix/issue-<number>`, `feat/<description>`, `refactor/<description>`; PRs target `main` (never `develop`); push with `--force-with-lease`, never bare `--force`.
- PR gate: backend lint + typecheck + tests green; docs updated when behavior changes. First-contribution walkthrough: `CONTRIBUTING.md` (defers to this file).

## AI Agent-Assisted Development

- Commits containing AI-generated changes need the `[AI-assisted]` prefix plus `AI Model:` and `Task:` trailers in the body, e.g. `[AI-assisted] feat: ...` / `- AI Model: ...` / `- Task: ...` — enforced by the commit-msg hook. Document AI-assisted scope in the PR description.
- Never commit cross-repo work-handoff files (`.continue-*`, `*-handoff.md`, `pause-work*`, `wip-*.md` — e.g. a `.continue-here.md` pause-work note written for a *different* repository landed on main once, issue #1186). They are session residue, not project content: `.gitignore` blocks them, the `pre-commit` hook (`scripts/pre-commit-check-handoff-files.sh`) rejects staged additions, and CI's `make tracked-ignored-check` re-checks the landed tree. Keep pause-work handoffs outside the repo entirely.
- Human review is mandatory for AI-assisted changes. Hard rules: no secrets/credentials in code, input validation on all user data, and **database migrations plus security-critical code always require human supervision**.
- `backend/.env` (and any `backend/.env.*`) must never be committed — `make tracked-ignored-check` (issue #1032) fails CI on tracked-but-ignored files.
- Review checklist: `AI_CODE_REVIEW.md`. Workflow and tooling: `AI_INTEGRATION.md`, `GODOGEN_SETUP.md`, `FOLEY_AI_SETUP.md`. Companion guide: `CLAUDE.md` (autoload map, design system, tooling notes). Repo skills: `.agents/skills/godot-development` (plus `godot-task`/`godogen` in `.claude/skills/`).

## Maintenance Automation

All available via `make help`. Most used:

| Target | Purpose |
|-------|---------|
| `make agents-md-check` | Validate this file (see below) |
| `make release-notes` | Generate release notes from conventional commits |
| `make tech-debt-check` | Technical debt detection (`TECH_DEBT.md` tracks items) |
| `make bundle-size-check` | Enforce Nakama bundle size budget |
| `make duplicate-code-check` | jscpd duplicate detection (TS/GDScript/Python) |
| `make dead-code-check` | Dead code detection |
| `make tracked-ignored-check` | Fail on tracked-but-ignored files (e.g. `backend/.env`) |
| `make test-flaky-report` | Flaky test report (backend + Godot) |
| `make smoke-test-quick` | Quick end-to-end smoke |
| `make ci` | Run the CI pipeline locally (Godot jobs skip under act) |

## AGENTS.md Validation

This file is validated by `backend/scripts/validate-agents-md.ts` — run `make agents-md-check` after any edit (CI enforces it via `agents-md-check-ci`). Keep the required sections (Project Structure, Build & Development Commands, GDScript/TypeScript Code Style, Testing Guidelines, AI agent guidelines) and always tag code fences with a language.
