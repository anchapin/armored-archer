# Getting Started

Local development setup for Armored Archer — Godot 4.6 client + Nakama backend. The repo root **is** the Godot project (`res://`); the server lives in `backend/`. For build flags, code style, and AI-assisted commit rules, see [AGENTS.md](../AGENTS.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

> Looking for the wider workflow (CI, release, AGENTS.md validation)? Jump to [Common tasks](#common-tasks). First time here? Start with [Prerequisites](#prerequisites).

## Table of contents

- [Prerequisites](#prerequisites)
- [Common tasks](#common-tasks)
- [First-time setup](#first-time-setup)
- [Backend (Nakama)](#backend-nakama)
- [Godot client](#godot-client)
- [Running the application](#running-the-application)
- [Troubleshooting](#troubleshooting)
- [Next steps](#next-steps)

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Godot** | 4.6+ | Game engine (editor + headless tests). Binary must be on `PATH` as **`godot4`**, or pointed at via `GODOT_BINARY`. |
| **Node.js** | 20.x | Backend runtime — matches the CI pin ([AGENTS.md](../AGENTS.md#backend-typescript--nakama)). |
| **npm** | 10.x (bundled) | Node package manager. |
| **Docker** + **Compose** | Latest stable | Local Nakama + PostgreSQL. |
| **Make** | Any GNU make | The project orchestrates everything through `make` targets. |
| **Git** | Latest | Version control. |

### Verifying installations

```bash
node --version        # v20.x
npm --version
docker --version
docker compose version
make --version
godot4 --version      # 4.6.x.stable
```

### Godot install notes

- **Recommended**: install Godot **4.6** as a binary named `godot4` and put it on `PATH`. Linux users can symlink the downloaded binary, e.g. `ln -s /opt/Godot/godot /usr/local/bin/godot4`.
- **Different binary name / path**: the test wrapper and most CI entry points honor `GODOT_BINARY`. Set it when your Godot binary isn't named `godot4` or isn't on `PATH`:

  ```bash
  export GODOT_BINARY=/path/to/godot        # any name, any location, e.g. /opt/Godot/godot
  ./scripts/local-godot-tests.sh --tests    # wrapper uses $GODOT_BINARY internally
  GODOT_BINARY=/opt/Godot/godot godot --headless --script test/run_all_tests.gd   # direct invocation
  ```

- **Editor vs headless**: the standard editor binary runs both the GUI and headless mode; the dedicated headless build is only needed if your platform lacks a display server. CI uses the standard build via the official [Barichello/godot-ci](https://github.com/barichello/godot-ci) image.

### Platform notes

- **Windows**: use WSL2 for Docker, or Docker Desktop with the WSL2 backend. WSL2 is also the easiest place to install `godot4` on the Linux side of Windows.
- **macOS**: Docker Desktop works natively; on Apple Silicon the Godot container images and the editor both run unaltered.
- **Linux**: install Docker Engine + Compose via your package manager. `make`, `node`, and `godot4` are usually already available or one `apt`/`dnf` away.

## Common tasks

Every workflow below has a single `make` entry point. Run `make help` for the full list.

| Task | Command | What it does |
|------|---------|--------------|
| Install deps + git hooks | `make setup` | `npm install` for `backend/`, then installs the commit-msg hook. The first `make setup` of a clone. |
| Lint + typecheck backend | `make backend-check` | `npm run lint && npm run typecheck`. No services needed. |
| Start backend services | `make backend-start` | `docker compose up -d` for Nakama + Postgres from `backend/`. |
| Start full stack (cold-start safe) | `make services-start` | Runs `scripts/cold-start.sh`; reaches all-green from zero (issue #907). |
| Verify stack health | `make services-health` | Curls Nakama + `pg_isready` against Postgres. |
| Stop services | `make services-stop` | `docker compose down`. |
| Reset services (drop volume) | `make services-restart-destructive` | Self-heal test — wipes Postgres volume and re-runs cold-start. |
| Apply DB migrations | `make backend-migrate` | `nakama migrate up`. Reads `backend/.env`. **Human-supervised** — see [docs/db/MIGRATIONS.md](db/MIGRATIONS.md). |
| Verify schema only | `make check-game-schema` | Pure-read check that the game tables exist (issue #891). |
| Run backend tests | `cd backend && npm test` | Jest (unit + colocated tooling tests). |
| Run GDScript validation | `./scripts/local-godot-tests.sh --quick` | Counts tests + light syntax check; **no Godot binary required**. |
| Run GDScript lint | `./scripts/local-godot-tests.sh --lint` | `gdlint autoloads/**/*.gd scenes/**/*.gd scripts/*.gd test/**/*.gd`. |
| Run all Godot checks | `./scripts/local-godot-tests.sh --all` | lint + syntax + legacy runner + GUT. Auto-imports the project on first run. |
| Full local CI | `make ci` | Runs the CI matrix locally. Skips Godot jobs under `act` (they OOM in containers — use `local-godot-tests.sh` instead). |
| End-to-end smoke | `make smoke-test-quick` | After `make services-start`. Vertical slice: login → PvE → boss → loot → equip. |

## First-time setup

One command, then verify:

```bash
# 0. Clone
git clone https://github.com/anchapin/armored-archer.git
cd armored-archer

# 1. Install backend deps + the commit-msg hook
make setup

# 2. Sanity-check the repo without Godot
./scripts/local-godot-tests.sh --quick
```

`make setup` is the same as `make backend-install hooks-install` ([Makefile:130](../Makefile)). It installs the git hooks from `.githooks/`, including the `[AI-assisted]` commit-trailer enforcer ([AGENTS.md §Commit & PR Guidelines](../AGENTS.md#commit--pr-guidelines), issue #1157). Skip with `--no-verify` only if you know what you're doing.

The Godot import cache (`.godot/`) is per-worktree and gitignored. `local-godot-tests.sh` runs `godot4 --headless --quit --import` automatically on the first invocation that needs it (issue #991). To pre-import without running tests:

```bash
godot4 --headless --quit --import        # or: GODOT_BINARY=/path/to/godot ...
```

## Backend (Nakama)

### Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`. The defaults in `.env.example` work for local development; change `POSTGRES_PASSWORD` and `NAKAMA_SERVER_KEY` before sharing a stack. **`backend/.env` must never be committed** — `make tracked-ignored-check` will fail CI on a tracked `.env` (issue #1032).

### Start the stack

```bash
make services-start            # robust cold-start, #907
make services-health           # confirm all-green
```

After a successful cold-start you have:

| Endpoint | URL |
|----------|-----|
| Nakama API | http://localhost:7350 |
| Nakama Console | http://localhost:7351 (default `admin` / `password`) |
| PostgreSQL (host) | `localhost:5433` — compose maps `5433:5432`. **5432 on the host is *not* this stack.** |
| PostgreSQL (inside `armored_archer_db`) | `postgres:5432` |

The full observability stack (Prometheus, Grafana, Loki, Tempo, OTel collector, etc.) is also part of the compose file — see [CONTRIBUTING.md §Local CI](../CONTRIBUTING.md) and [docs/DEPLOYMENT_OBSERVABILITY.md](DEPLOYMENT_OBSERVABILITY.md).

### Build the TypeScript module (Nakama bundle)

Needed before Nakama can load your game code locally:

```bash
cd backend && npm run build:full
```

`npm run build:full` runs `tsc` → webpack → `bundle:validate` and emits `backend/data/modules/` (gitignored; never commit — issue #996). For auto-reload during development, `make backend-dev` starts `ts-node-dev` against `backend/src/index.ts`.

### Database migrations

```bash
make services-health            # always confirm green first
make backend-migrate            # nakama migrate up; reads backend/.env
make check-game-schema          # pure-read verification (issue #891)
```

Schema changes always require human review — see [docs/db/MIGRATIONS.md](db/MIGRATIONS.md) for the pre-flight + two-engineer review process and the forward-only warning.

## Godot client

### Open the project

```bash
godot4 .                        # from the repo root; opens project.godot
```

The first editor launch creates the `.godot/` import cache. Press **F5** to run; the main scene is `res://scenes/ui/login_screen.tscn` and the renderer is `Mobile` (`config/features=PackedStringArray("4.6", "Mobile")` in [project.godot](../project.godot)).

### Verify the Godot workflow

```bash
./scripts/local-godot-tests.sh --quick    # no Godot binary required
./scripts/local-godot-tests.sh --all      # lint + syntax + tests + GUT
```

`--all` runs the legacy runner (`test/run_all_tests.gd`) **and** the GUT suite (`test/suites/`). The runner's exit code is unreliable (non-zero on resource leaks, not failures) — check for `Failed: N` in the output ([AGENTS.md §Gotchas](../AGENTS.md#gotchas)).

### Run a single Godot check by hand

When you need the raw invocation (CI debugging, editor session), the wrapper's defaults are:

```bash
GODOT_BINARY="${GODOT_BINARY:-godot4}"   # what the wrapper uses internally
godot4 --headless --script test/run_all_tests.gd
```

Override `GODOT_BINARY` if your binary isn't on `PATH` as `godot4`:

```bash
GODOT_BINARY=/opt/Godot/godot godot --headless --script test/run_all_tests.gd
```

## Running the application

1. **Start the backend**: `make services-start`, wait for `make services-health` to print all-green.
2. **Open the Godot project**: `godot4 .` and press **F5**.
3. **Stop the stack**: `make services-stop`.

If the client cannot connect to Nakama, see [Troubleshooting](#troubleshooting) below or [docs/CONNECTION_TROUBLESHOOTING.md](CONNECTION_TROUBLESHOOTING.md).

## Troubleshooting

### Godot / GDScript

- **`godot4: command not found`** — install Godot 4.6 and name the binary `godot4`, or set `GODOT_BINARY=/full/path/to/godot` for the current shell.
- **Phantom test failures on a fresh clone** (`Missing global class: BaseEnemy`, `GearData`) — `.godot/` is gitignored and per-worktree. Re-run any `local-godot-tests.sh` flag that needs Godot, or `godot4 --headless --quit --import` once (issue #991).
- **`local-godot-tests.sh` exit code is non-zero but `Failed: 0`** — that's a resource-leak warning from Godot, not a test failure. Read the body for `Failed: N`.
- **Slow / OOM under `act`** — the CI matrix runs Godot jobs in containers and OOM-kills `backend-typecheck` (exit code `137`). Use `./scripts/local-godot-tests.sh` directly instead ([AGENTS.md §Host-memory rule](../AGENTS.md#host-memory-rule-while-hosted-ci-is-dark-issue-993)).

### Backend / Nakama / Postgres

- **`Cannot connect to Docker daemon`** — `sudo systemctl start docker` (Linux) or launch Docker Desktop.
- **Port conflict on 7350 / 7351 / 5432 / 5433** — another service is bound; stop it or change the host port mapping in `backend/docker-compose.yml`. The compose file publishes Postgres on **5433** (host) → **5432** (container); do not move it to host `5432`, that's reserved.
- **`Migration failed`** — re-run after `make services-health` is green; if persistent, `make services-restart-destructive` drops the volume and replays migrations from scratch.
- **Module not found / `npm install` errors** — `cd backend && rm -rf node_modules && npm install`.

### Client ↔ server

- **`Cannot connect to Nakama server`** — confirm `curl http://localhost:7350/` returns 200 and the server key in `NetworkManager.gd` matches `NAKAMA_SERVER_KEY` in `backend/.env` (default `defaultkey`).

For the deeper debugging guide (logging, network captures, headless flags), see [docs/DEBUGGING.md](DEBUGGING.md).

## Next steps

- **Contribute**: [CONTRIBUTING.md](../CONTRIBUTING.md) — branch naming, commit trailers, PR checklist.
- **Build / test / style reference**: [AGENTS.md](../AGENTS.md) — the canonical command list.
- **Backend deep dive**: [backend/README.md](../backend/README.md) and [docs/API](../api/).
- **Architecture / domain vocab**: [CONTEXT.md](../CONTEXT.md) and [docs/adr/](../adr/).
- **AI-assisted workflow** (skill list, review checklist): [AI_INTEGRATION.md](../AI_INTEGRATION.md), [AI_CODE_REVIEW.md](../AI_CODE_REVIEW.md), [CLAUDE.md](../CLAUDE.md).
- **Local services reference**: [docs/LOCAL_SERVICES_SETUP.md](LOCAL_SERVICES_SETUP.md) — every `make services-*` target explained.
- **Debugging**: [docs/DEBUGGING.md](DEBUGGING.md).
