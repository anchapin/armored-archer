# Armored Archer 🏹

A 2D top-down mobile archery game built with Godot 4 and Nakama. Features a highly replayable PvE auto-shooter mode and asynchronous turn-based PvP duels.

Strictly Free-to-Play. Zero Pay-to-Win. Cosmetics only.

## ✨ Key Features

- **PvE Auto-Shooter** - Auto-aim archery combat with wave-based enemy spawning
- **Asynchronous PvP** - Turn-based duels against other players' defenses
- **Gear System** - Equipment customization with stats and modifiers
- **Cosmetic Skins** - Transmog system for visual customization (IAP)
- **Seasonal Content** - Leaderboards and limited-time events
- **Cross-Platform** - Mobile (iOS/Android) with desktop support

## 🛠 Tech Stack

| Component | Technology |
|-----------|------------|
| Game Engine | [Godot 4](https://godotengine.org/) |
| Client Language | GDScript |
| Backend Server | [Nakama](https://heroiclabs.com/) (TypeScript) |
| Database | PostgreSQL |
| IAP Infrastructure | RevenueCat |
| Authentication | Firebase |

## 📋 Prerequisites

- **Godot 4.x** - Download from [godotengine.org](https://godotengine.org/)
- **Docker & Docker Compose** - Required for local Nakama backend
- **Node.js 18+** - Required for backend development
- **npm** - Package manager (comes with Node.js)
- **Git** - Version control

## ⚡ Quick Reference

| Command | Description |
|---------|-------------|
| `make setup` | Install all dependencies |
| `make backend-start` | Start Nakama backend (Docker) |
| `make backend-test` | Run backend tests |
| `make backend-lint` | Lint backend code |
| `make backend-build` | Build TypeScript backend |
| `make dev` | Start development with auto-reload |
| `make clean` | Clean build artifacts |

## ⚡ Single Command Setup

```bash
# Install all dependencies and set up development environment
make setup
```

This will install:
- Backend npm dependencies

**Then start developing:**

```bash
# Start Nakama backend (Docker)
make backend-start

# Run Godot game (press F5 in Godot Editor)
# OR for backend development with auto-reload
make dev
```

**Other useful commands:**

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make backend-test` | Run backend tests |
| `make backend-lint` | Lint backend code |
| `make backend-stop` | Stop backend services |
| `make clean` | Clean build artifacts |

### Smoke Tests (End-to-End)

The project includes comprehensive smoke tests that validate the complete vertical slice flow: **login → PvE stage → boss → loot → equip**.

**Issue:** [#684](https://github.com/anchapin/armored-archer/issues/684) - [Sprint 1] Create end-to-end smoke test script

| Command | Description |
|---------|-------------|
| `make smoke-test` | Run all smoke tests (backend + client) |
| `make smoke-test-backend` | Run backend smoke tests only |
| `make smoke-test-client` | Run Godot client E2E tests only |
| `make smoke-test-quick` | Run quick smoke tests (skip performance) |
| `make smoke-test-verbose` | Run smoke tests with verbose output |
| `make smoke-test-ci` | Run smoke tests in CI mode (exit on failure) |
| `make smoke-test-report` | View latest smoke test report |

**Test Coverage:**
- Backend RPC validation (authentication, stats, loot, inventory, equipment)
- Client E2E flow (account bootstrap, stage configuration, combat, boss encounters)
- Automated reporting with HTML summary
- Clear pass/fail indicators with detailed logs

**Reports Location:** `reports/smoke-tests/`

For detailed documentation, see [`.planning/VERTICAL_SLICE_SMOKE_TEST.md`](.planning/VERTICAL_SLICE_SMOKE_TEST.md).

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/anchapin/armored-archer.git
cd armored-archer
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment template and configure
cp .env.example .env

# Start Nakama and PostgreSQL
./start.sh
# OR for a robust cold-start with pass/fail assertion (issue #907):
./scripts/cold-start.sh && ./scripts/assert-cold-start.sh
```

The backend will be available at:
- **API:** http://localhost:7350
- **Admin Console:** http://localhost:7351 (admin:password)

### 3. Godot Client

1. Open the project in Godot 4 Editor
2. Press `F5` to run the project

---

## 🎮 Godot Client

### Running the Game

```bash
# Open the project in Godot 4 Editor and press F5
```

### Testing

- **Run All Tests:** Open and run the scene `res://test/run_all_tests.gd` in the Godot Editor
- **Test Files:** Located in `test/test_*.gd`

### Exporting

To export the game for a specific platform:
1. Open **Project → Export** in the Godot Editor
2. Select the target platform (Android, iOS, Linux, Windows, etc.)
3. Click **Export Project**

### Project Structure

```
/                          # Godot project root
├── autoloads/            # Singletons (NetworkManager, GameManager, etc.)
├── scenes/               # .tscn files organized by feature
│   ├── player/           # Player-related scenes
│   ├── enemies/          # Enemy scenes
│   └── ui/               # UI scenes
├── scripts/              # .gd scripts
├── assets/               # Sprites, sounds, music
├── test/                 # GDScript test runner and framework
├── export/               # Export presets and configurations
└── res://                # Godot resource path prefix
```

---

## ⚙️ Backend (Nakama)

### Environment Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your values:
   ```bash
   POSTGRES_PASSWORD=your_secure_password
   DATABASE_ADDRESS=postgres:your_password@postgres:5432/nakama
   NAKAMA_SERVER_KEY=your_server_key
   SESSION_ENCRYPTION_KEY=your_token_key
   REFRESH_ENCRYPTION_KEY=your_refresh_key
   ```

3. Start services with validation:
   ```bash
   ./start.sh
   ```

### Development Commands

| Command | Description |
|---------|-------------|
| `./start.sh` | Start Nakama and PostgreSQL with validation |
| `./scripts/cold-start.sh` | Robust cold-start with health-check waits + final assertion (#907) |
| `./scripts/assert-cold-start.sh` | Assert the stack reached all-green |
| `make services-restart-destructive` | Drop volume + re-run cold-start (self-heal test, #907) |
| `npm run dev` | Start development server with auto-reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm run build:watch` | Build TypeScript in watch mode |
| `./validate-env.sh` | Validate environment variables |

### Testing

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:integration` | Run integration tests |
| `npm run test:ci` | Run tests for CI (JUnit format) |

### Linting & Code Quality

| Command | Description |
|---------|-------------|
| `npm run lint` | Lint TypeScript |
| `npm run lint:fix` | Fix linting issues |
| `npm run typecheck` | Type check without building |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run docs` | Generate TypeDoc documentation |

### Running CI Locally

You can run GitHub Actions workflows locally using `act` before pushing to remote. This is highly recommended for catching issues early.

#### Installation

```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Windows
choco install act-cli
```

#### Initial Setup

No custom image build is required. The retired `armored-archer/nakama-postgres:3.21.1` phantom image (issue #858) was never published to a registry; CI now uses the standard upstream images directly via `.github/docker-compose.yml`:

- Postgres: `postgres:14-alpine`
- Nakama: `heroiclabs/nakama:3.21.1`

Pull them once and you're set:

```bash
docker pull postgres:14-alpine
docker pull heroiclabs/nakama:3.21.1
```

(The `.docker/nakama-postgres/` directory is kept for reference only — its custom entrypoint is superseded by the inline entrypoint in `.github/docker-compose.yml`.)

#### Running Jobs

The project's `.actrc` file contains default configuration, so you can run jobs directly:

```bash
# Run a specific job
act -j backend-lint
act -j backend-test
act -j gdscript-lint

# List all available jobs
act -l

# Run all jobs (may have cache contention issues)
act

# Run jobs sequentially (recommended for full CI run)
./scripts/run-ci-locally.sh
```

#### Common Issues and Solutions

**Cache contention when running full workflow:**

If you see `archive/tar: write too long` errors when running the full workflow, it's due to multiple jobs accessing the npm cache simultaneously.

**Solutions:**

1. Run jobs individually (most reliable):
   ```bash
   act -j backend-lint
   act -j backend-test
   # ... run each job separately
   ```

2. Use the sequential runner script (recommended):
   ```bash
   ./scripts/run-ci-locally.sh
   ```

3. Use `--reuse` flag to reuse containers:
   ```bash
   act --reuse
   ```

**Expected behaviors (not errors):**

- Artifact uploads fail: `Unable to get the ACTIONS_RUNTIME_TOKEN env variable` - This is expected with act (no GitHub context)
- Codecov upload is skipped: Intentionally skipped for git worktrees and local runs
- SonarCloud scan is skipped: Requires GitHub secrets not available locally

#### Available CI Jobs

| Job | Description |
|-----|-------------|
| `backend-lint` | ESLint for TypeScript backend |
| `backend-typecheck` | TypeScript type checking |
| `backend-test` | Jest tests with coverage (requires services) |
| `backend-integration-test` | Nakama + Postgres integration tests; services on PostgreSQL:5438, Nakama:7352/7353; **prerequisite** `cd backend && npm run build:full` (assert mounts `backend/data/modules` into the Nakama container at `/nakama/data/modules:ro`) |
| `backend-complexity` | Cyclomatic complexity analysis |
| `n-plus-one-detection` | Detect N+1 query patterns |
| `backend-dead-flags` | Detect unused feature flags |
| `security-audit` | npm audit for vulnerabilities |
| `duplicate-code-detection` | Detect duplicate code |
| `dependency-check` | Detect unused dependencies |
| `bundle-size-check` | Analyze bundle size |
| `python-lint` | Ruff for Python scripts |
| `gdscript-lint` | gdlint for GDScript |
| `tech-debt-tracking` | Technical debt report |
| `dead-code-detection` | Detect dead code |
| `godot-validate` | Validate Godot project structure |
| `schema-validation` | Database schema tests (requires services) |
| `agents-md-validation` | Validate AGENTS.md documentation |

**Note:** The project uses a custom Nakama Docker image configured for PostgreSQL. See [docs/ACT_CI_SUMMARY.md](docs/ACT_CI_SUMMARY.md) and [.docker/nakama-postgres/README.md](.docker/nakama-postgres/README.md) for details.

### Database

PostgreSQL is managed via Docker Compose:
- **Connection:** `postgres://postgres:localdbpassword@localhost:5432/nakama`

Run migrations:
```bash
docker exec -it armored_archer_server /nakama/nakama migrate up
```

### Backend Structure

```
backend/
├── src/                  # TypeScript source files
├── build/                # Compiled JavaScript output
├── server/               # Nakama server configuration
├── modules/              # Custom Nakama modules
├── data/                 # Server data and migrations
├── tests/                # TypeScript test files
├── docker-compose.yml    # Docker Compose configuration
├── nakama.yml            # Nakama server configuration
├── package.json          # Node.js dependencies
└── start.sh              # Startup script
```

---

## 🏗️ Architecture

### Client-Server Communication

- Client sends actions (e.g., `{"action": "shoot", "angle": 0.78}`)
- Server validates and calculates results (damage, loot, etc.)
- Server sends authoritative state back to client
- Use Nakama RPCs for custom game logic

### Key Autoloads (Godot)

| Autoload | Purpose |
|----------|---------|
| NetworkManager | Handles Nakama server connection and RPC |
| GameManager | Core game state and logic |
| CombatManager | Combat calculations and effects |
| GearManager/GearRegistry | Equipment system |
| PlayerStatsManager | Player statistics |
| MatchmakerManager | Asynchronous PvP matchmaking |
| SeasonManager | Seasonal content and leaderboards |
| StoreManager | In-app purchase handling |
| TransmogManager | Cosmetic skin system |

### Server-Authoritative Design

- Never trust client input - validate all data on server
- Calculate combat results server-side based on stored player stats
- Generate loot drops server-side to prevent manipulation

---

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our development workflow, code style, and pull request process.

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch: `git checkout -b fix/issue-<number>` or `feat/<description>`
3. Make changes and run tests:
   - Backend: `npm test`, `npm run lint`, `npm run typecheck`
   - Client: Run tests in Godot editor
4. Commit with conventional commits: `git commit -m "fix: resolve issue"`
5. Push and create a PR

---

## 📁 Project Structure

* `/` - Godot project root (client)
* `/backend` - Nakama server, TypeScript code, Docker Compose
* `/test` - GDScript tests
* `/docs` - Documentation

---

## 🗺️ Roadmap

### Current Status (v4.0.0 — Gameplay Refinement)

The project is mid-**v4.0.0 Gameplay Refinement**. Milestones v2.0.0 → v3.4.0 are shipped; see [`.planning/ROADMAP.md`](.planning/ROADMAP.md) for the full milestone history and active phase plans.

| MVP Feature | Status | Evidence |
|-------------|--------|----------|
| PvE Progression | ✅ Shipped | v3.4.0 Tactical Gameplay & PvE Campaign (Phases 1–5) |
| Async PvP | ✅ Shipped (hybrid model: async matchmaking + live short-session combat) | [ADR-0003](docs/adr/0003-hybrid-duel-model.md), [ADR-0002](docs/adr/0002-server-declared-match-settlement.md), [ADR-0004](docs/adr/0004-decommission-legacy-duel-rpcs.md) |
| Seasonal Rank | ✅ Shipped | v4.0.0 Phase 4 — PvP Balance & Ranking |
| Cosmetic Monetization | ✅ Shipped (RevenueCat; non-pay-to-win, transmog model) | [ADR-0001](docs/adr/0001-prd-living-promises-governance.md), [`docs/armored-archer_prd.md`](docs/armored-archer_prd.md) |

**Out of scope (still deferred):** Subscriptions, push notifications, guilds/clans, real-time PvP, trading, player reporting, analytics dashboard — see the [archived MVP scope](docs/mvp/MVP-SCOPE.md) for the original rationale.

For the **frozen v1.0.0 MVP scope** this README was first written against (every feature now shipped), see [`docs/mvp/MVP-SCOPE.md`](docs/mvp/MVP-SCOPE.md).

<details>
<summary>Deprecated MVP v1.0.0 scope table (frozen 2026-04-15, superseded)</summary>

The MVP scope was frozen around four core features on 2026-04-15 (Sprint 0, issue #675). Every feature listed below has since shipped.

| Feature | Description | Frozen status | Actual status |
|---------|-------------|---------------|---------------|
| PvE Progression | Auto-shooter combat with stage-based campaign | In Progress | **Shipped** (v3.4.0) |
| Async PvP | Turn-based asynchronous matches against other players | Planned | **Shipped** as hybrid model ([ADR-0003](docs/adr/0003-hybrid-duel-model.md)) |
| Seasonal Rank | Leaderboards with seasonal reset and rewards | Planned | **Shipped** (v4.0.0 Phase 4) |
| Cosmetic Monetization | Non-pay-to-win cosmetic items only | Planned | **Shipped** (RevenueCat) |

**Out of Scope for MVP:** Subscriptions, push notifications, guilds/clans, real-time PvP, trading, player reporting, analytics dashboard. See the full original document at [`.planning/MVP-SCOPE.md`](.planning/MVP-SCOPE.md).

</details>

### Development Phases

The original 5-phase bootstrap plan below is preserved as historical reference. Current milestone planning lives in [`.planning/ROADMAP.md`](.planning/ROADMAP.md).

| Phase | Timeline | Focus Area | Key Deliverables |
|-------|----------|------------|------------------|
| 1 | Weeks 1-3 | Godot Engine Setup & Physics | Touch controls (virtual joysticks), character movement, arrow trajectory physics, and hitbox collisions. |
| 2 | Weeks 4-6 | AI & Auto-Aim Logic | Spawning simple enemies, implementing auto-aim logic, health systems, and core game loop (win/loss states). |
| 3 | Weeks 7-9 | Backend & Database Setup | Local Nakama Docker setup, user authentication, database schemas (catalog, inventory, loadout). |
| 4 | Weeks 10-13 | UI, IAP, & Turn-Based PvP | Modular sprite system, cosmetic shop UI, RevenueCat integration, Nakama matchmaker, and turn-based RPCs. |
| 5 | Weeks 14-16 | Polish & App Store Submission | Safe-area UI adjustments, analytics (Crashlytics), TestFlight (iOS) / Play Console (Android) beta distribution. |

### Active Work

For the current milestone phases and in-flight work, see [`.planning/ROADMAP.md`](.planning/ROADMAP.md#v400-gameplay-refinement) (v4.0.0 Gameplay Refinement) and the open issues on the [issue tracker](https://github.com/anchapin/armored-archer/issues).

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📊 Code Coverage

[![codecov](https://img.shields.io/codecov/c/gh/anchapin/armored-archer/main)](https://codecov.io/gh/anchapin/armored-archer)
# Wave 1 - Issue #1307
