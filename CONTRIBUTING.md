# Contributing to Armored Archer

Thanks for contributing. **[AGENTS.md](AGENTS.md) is the canonical reference** for build commands, code style, testing, and AI-assisted commit rules — link out, don't duplicate. This file points at the rules a first-time contributor is most likely to violate, and at the four DX rules that were missing from prior versions of this document.

## Quick start (first contribution)

```bash
# 0. One-time per clone
make setup                    # installs npm + gdlint + Godot deps + commit-msg hook

# 1. Worktree + branch (conventional branch names — see "Branch naming")
git worktree add ../wt-<slug> -b fix/issue-<number>-<slug> origin/main
cd ../wt-<slug>

# 2. Loop: code → test → lint → commit → push
./scripts/local-godot-tests.sh --all    # Godot: lint + syntax + tests
cd backend && npm run lint && npm run typecheck && npm test   # Backend
git add -p && git commit -F /tmp/msg.txt  # trailers required — see "Commits"
git push -u origin fix/issue-<number>-<slug> --force-with-lease

# 3. Open the PR (base branch is `main`, NOT `develop`)
gh pr create --base main
```

The full command list lives in [AGENTS.md §Build & Development Commands](AGENTS.md#build--development-commands).

## Branch naming

Branches off `main`. The base branch is **`main`**, never `develop` — this differs from the multi-agent orchestrator skill defaults that assume `develop`.

| Type        | Pattern                            | Example                          |
|-------------|------------------------------------|----------------------------------|
| Bug fix     | `fix/issue-<number>-<slug>`        | `fix/issue-1154-rewrite-contributing-md` |
| Feature     | `feat/<slug>`                      | `feat/party-finder`              |
| Refactor    | `refactor/<slug>`                  | `refactor/extract-validation`    |
| Docs / chore| `docs/<slug>` / `chore/<slug>`     | `docs/adr-pvp-settlement`        |

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, …). Release notes are generated from them (`make release-notes`).

The repo enforces **four commit rules** via a local `commit-msg` hook installed by `make setup` (or `make hooks-install`):

1. **Conventional commit subject** — type + optional scope + colon + description. The hook is permissive about non-AI subjects (existing manual commits are grandfathered in the 19/30 ratio noted in issue #1154). New commits should still follow the format.
2. **[AI-assisted] prefix is mandatory** for any commit whose code, tests, or docs were produced by an AI agent. See [AGENTS.md §AI Agent-Assisted Development](AGENTS.md#ai-agent-assisted-development) — the body must end with two trailers:
   - `- AI Model: <model-id-version>` (e.g. `MiniMax-M3`, `claude-opus-4-6`)
   - `- Task: <one-sentence task>`
3. **Subject body lines ≤ 100 chars**, body wrapped at 72. The hook runs against `$1` (the message file) and blocks any push that fails. Escape hatch for emergencies: add `[skip-ai-check]` to the body.
4. **`git push --force-with-lease`** is the conventional push flag (never bare `--force`) — see step 2 of Quick start above.

If the hook blocks you unexpectedly, read its error: the script it invokes is `scripts/commit-msg-check-ai-trailer.sh` (installed via `make hooks-install`, or `make setup` which now does this automatically).

## Local CI: memory-pressure rule (issue #993)

When hosted CI is unavailable (billing outage — see [docs/ci/ci-billing-recovery.md](docs/ci/ci-billing-recovery.md)) and you're running the [`act`](https://nektosact.com/) matrix locally:

- **Run `make ci` and `./scripts/local-godot-tests.sh` sequentially, never in parallel.** Concurrent act + headless-Godot suites OOM-kill `backend-typecheck` (exitcode `137`, zero compiler output). Tune via `ACT_MIN_FREE_MB` (default 2048) and `ACT_MEM_WAIT_SECS` (default 60) — see [`scripts/ci-local.sh`](scripts/ci-local.sh).
- **All `act` invocations route through `scripts/lib/act-lock.sh`** (`ci-local.sh`, `run-ci-locally.sh`, `act-cleanup.sh`) to serialize `~/.cache/act` git-clone work. Don't invoke `act` outside the wrappers (issues #992/#1028).
- **Never disable required status checks.** Re-rerun the failing job in isolation before debugging.

## Linting & quality gates (replaces the stale "no automated linter" line)

| Layer        | Command                                          | Notes                                                        |
|--------------|--------------------------------------------------|--------------------------------------------------------------|
| GDScript     | `./scripts/local-godot-tests.sh --lint`          | gdlint against `autoloads/`, `scenes/`, `scripts/`, `test/`  |
| GDScript     | `./scripts/local-godot-tests.sh --all`           | lint + syntax check + headless test suite                    |
| TypeScript   | `cd backend && npm run lint && npm run typecheck` | eslint + `tsc --noEmit` (strict)                             |
| TypeScript   | `cd backend && npm test`                         | Jest (unit + colocated tooling tests; ~80% coverage gate)    |
| Schema       | `cd backend && npm run test:schema`              | needs PostgreSQL, not Nakama — cheapest migration check      |
| Smoke        | `make smoke-test-quick`                          | end-to-end after a full stack-up via `make services-start`   |
| Repo hygiene | `make tech-debt-check duplicate-code-check dead-code-check tracked-ignored-check` | task-grade maintenance gates |

If you only touched Markdown or config, no tool check is needed. If you touched any `.gd`/`.tscn`, you must run the corresponding lint and test command; CI gates merge on it.

## Testing

- **Godot:** tests live in `test/run_all_tests.gd` (legacy custom runner, what CI uses) and `test/suites/` (GUT). Run with `./scripts/local-godot-tests.sh --tests` or `godot4 --headless --script test/run_all_tests.gd`. The runner's exit code is **unreliable** (non-zero on resource leaks, not failures) — check for `Failed: N` in the output.
- **Backend:** unit + tooling tests under `backend/src/**/__tests__/*.test.ts` and `backend/scripts/__tests__/*.test.ts` are the default `npm test` roots. Integration tests (`npm run test:integration`) need the stack up via `make services-start`. Schema tests (`npm run test:schema`) need only PostgreSQL. Property & benchmark suites have their own configs (`jest.property.config.js`, `jest.benchmark.config.js`).

Schema changes always require human review — see [`docs/db/MIGRATIONS.md`](docs/db/MIGRATIONS.md).

## AI-assisted changes — extra rules

Beyond the commit trailers above, AGENTS.md §AI Agent-Assisted Development requires:

- **Human review is mandatory** for any AI-generated code. Hard rules: no secrets/credentials, input validation on all user data, and database-migration + security-critical code always needs a human approver.
- **`backend/.env` (and `backend/.env.*`) must never be committed** — `make tracked-ignored-check` fails CI on tracked-but-ignored files (issue #1032).
- **Document AI-assisted scope in the PR description** as well as the commit body.
- **Review checklist:** [`AI_CODE_REVIEW.md`](AI_CODE_REVIEW.md). Workflow: [`AI_INTEGRATION.md`](AI_INTEGRATION.md), [`GODOGEN_SETUP.md`](GODOGEN_SETUP.md), [`FOLEY_AI_SETUP.md`](FOLEY_AI_SETUP.md).

## Sub-agents and the agents tree

Repo-local skills: `.agents/skills/<name>/SKILL.md` (e.g. `godot-development`). Claude-specific skills (mostly tool helpers): `.claude/skills/<name>/SKILL.md`. Always cross-check a skill against `AGENTS.md` before trusting it on this repo.

`.agents/results/<name>.md` and `.agents/results/<plan-name>.json` are the **outputs of orchestration runs** (e.g. `result-pm.md`, `result-backend.md`, `plan-2026-08-16-mvp-pve-slice.json`). Treat them as **read-only artifacts**, not source of truth — they may be regenerated by another run. Naming conventions:

- `result-<role-or-persona>.md` — narrative output of a sub-agent (PM, backend, mobile).
- `result-<role>-<task-slug>-<date>.md` — task-scoped variation.
- `plan-<date>-<slug>.json` — structured plan emitted by a planning skill.

None of these belong in a code review; if you find yourself referencing one in a PR description, link to the issue instead and quote the relevant excerpt in the PR body.

## Pull requests

- PR base is `main` (never `develop`).
- The [PR template](.github/PULL_REQUEST_TEMPLATE.md) is mandatory — checklist covers behavior changes, test evidence, and doc updates.
- Backend lint + typecheck + tests must be green; Godot lint + `local-godot-tests.sh --all` must be green; docs updated when behavior changes (`RPC_MAP.md` is the per-RPC reference and must be edited if you add or change an RPC).
- `make ci` runs the full CI matrix locally. CI hosted run gates merge.

## Issue reporting

- **Bug:** reproduction steps, expected vs actual, Godot version, backend commit SHA, relevant logs (`backend/build/` and `backend/.runtime/logs/` if present).
- **Feature request:** describe the problem before proposing a solution; discuss in the issue thread before opening a PR.

## License

By contributing, you agree your work is licensed under the project's MIT License.
