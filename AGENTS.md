# Armored Archer - Agent Development Guidelines

This file contains conventions and commands for agents working on the Armored Archer codebase.

## Project Structure

```text
/                          # Godot project root
├── autoloads/            # Singletons (NetworkManager, GameManager, etc.)
│   └── const.gd          # Centralized constants (used 3+ files)
├── scenes/               # .tscn files organized by feature
│   ├── player/           # Player-related scenes
│   │   └── Player/       # Per-scene directory (scene + script)
│   ├── enemies/          # Enemy scenes
│   └── ui/               # UI scenes
├── scripts/              # Shared scripts (not tied to specific scene)
├── assets/               # Sprites, sounds, music
├── test/                # GDScript test runner and framework
├── script_templates/    # Custom script templates
├── docs/                 # Documentation
└── res://                # Godot resource path prefix

/backend/                 # Nakama TypeScript server
├── src/                  # TypeScript source files
├── build/                # Compiled JavaScript output
├── server/               # Nakama server configuration
├── modules/              # Custom Nakama modules
├── data/                 # Server data and migrations
├── tests/                # TypeScript test files
└── docker-compose.yml   # Docker Compose configuration
```

## Build & Development Commands

### Godot Client (GDScript)
- **Run Project:** Open in Godot 4.x Editor and press `F5`
- **Test Scene:** Open scene in editor and press `Ctrl+F5` for current scene only
- **Export Project:** Project → Export → select platform → Export Project
- **GDScript Tests:** Open Godot editor, run `res://test/run_all_tests.gd` scene

### Local Godot Testing (When GitHub Actions/act is unavailable)

When GitHub Actions has billing issues or the `act` CLI tool fails, use the local testing script:

```bash
# Run all Godot checks (lint, syntax, tests)
./scripts/local-godot-tests.sh

# Quick validation (no Godot binary required)
./scripts/local-godot-tests.sh --quick

# Run linting only
./scripts/local-godot-tests.sh --lint

# Run syntax validation only
./scripts/local-godot-tests.sh --syntax

# Run full test suite only
./scripts/local-godot-tests.sh --tests
```

**Requirements:**
- Godot 4.6+ installed and in PATH (or set `GODOT_BINARY` environment variable)
- For linting: `pip install gdtoolkit`

**Alternative Manual Commands:**
```bash
# Validate Godot project structure
godot4 --headless --quit-after 5

# Run GDScript linting
gdlint autoloads/*.gd scenes/**/*.gd scripts/*.gd test/*.gd

# Run Godot test suite directly
godot4 --headless --script res://test/run_all_tests.gd

# Check for common syntax errors
grep -r "var _ =" autoloads/ scenes/ scripts/ test/ || echo "No syntax errors found"
```

**Using act CLI (if available):**
```bash
# Configure act with Godot support
cat > .actrc << EOF
--env GODOT_HEADLESS=true
--shm-size=2gb
--container-architecture linux/amd64
EOF

# Run Godot tests workflow
act -W .github/workflows/test.yml --container-architecture linux/amd64
```

**Note:** The `act` CLI may still fail due to display server requirements in containerized environments. Use the local testing script as the primary workaround.

### Backend (TypeScript - Nakama)
```bash
# Start backend with Docker Compose
cd backend && ./start.sh

# Nakama console (admin:password)
open http://localhost:7351

# Development
npm run dev              # Start with auto-reload
npm run build            # Build TypeScript
npm run build:watch      # Build in watch mode

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage
npm run test:integration # Run integration tests
npm run test:ci          # Run tests for CI (JUnit format)

# Linting & Type Checking
npm run lint             # Lint TypeScript
npm run lint:fix         # Fix linting issues
npm run typecheck        # Type check without building
npm run format           # Format code with Prettier
npm run format:check    # Check code formatting
npm run docs             # Generate TypeDoc documentation
```

### Database
```bash
# PostgreSQL is managed via Docker Compose
# Connection: postgres://postgres:localdbpassword@localhost:5432/nakama

# Run Nakama migrations
docker exec -it armored_archer_server /nakama/nakama migrate up

# View database schema
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\dt'

# Run schema migration tests
cd backend
npm run test:schema
```

### Database Schema Documentation
- **Schema Reference**: [DATABASE_SCHEMA.md](backend/DATABASE_SCHEMA.md)
- **Migration Files**: `backend/data/*.sql`

### Key Tables
| Table | Description |
|-------|-------------|
| `player_stats` | Player level, experience, ability points, stats |
| `catalog` | Master gear catalog with types, rarities, stats |
| `inventory` | Player gear ownership |
| `loadout` | 5 equipment slots (helm, armor, bow, arrow, amulet) |

### Database Enums
- `gear_type`: helm, armor, bow, arrow, amulet
- `gear_rarity`: common, rare, epic, legendary

## GDScript Code Style

### Autoloads (Singletons)
The project uses Godot autoloads for game managers. Key autoloads include:
- `NetworkManager.gd` - Handles Nakama server connection and RPC
- `GameManager.gd` - Core game state and logic
- `CombatManager.gd` - Combat calculations and effects
- `GearManager.gd` / `GearRegistry.gd` - Equipment system
- `PlayerStatsManager.gd` - Player statistics
- `MatchmakerManager.gd` - Asynchronous PvP matchmaking
- `SeasonManager.gd` - Seasonal content and leaderboards
- `StoreManager.gd` - In-app purchase handling
- `TransmogManager.gd` - Cosmetic skin system
- `GemManager.gd` - Gem/socket system
- `CampaignManager.gd` - Campaign progression
- `AutoAimManager.gd` - Auto-aim assistance
- `ObjectPool.gd` - Object pooling for performance
- `PerformanceProfiler.gd` - Runtime performance monitoring
- `SafeAreaManager.gd` - Mobile safe area handling
- `UITransitionOptimizer.gd` - UI transition caching

### File Organization
- **Class Declaration:** `extends NodeType` on first line
- **Sections:** Use `# --- Section Name ---` comments to organize code (stats, state, references, etc.)
- **Docstrings:** Add comments above methods explaining purpose

### Imports & Node References
- Use `@export` to expose variables to Godot Inspector for easy tweaking
- Use `@onready var node_name: Type = $NodePath` to cache child node references
- Preload scenes with `const SCENE_NAME = preload("res://path/to/scene.tscn")`

### Type Hints
- Always add explicit type hints: `var speed: float = 300.0`
- Function parameters: `func _physics_process(delta: float) → void:`
- Return types: `func get_damage() → int:`

### Naming Conventions
- **Variables & Functions:** `snake_case` (e.g., `base_speed`, `handle_movement()`)
- **Classes & Types:** `PascalCase` (e.g., `CharacterBody2D`, `Area2D`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `ARROW_SCENE`, `BASE_SPEED`)
- **Private Members:** Prefix with `_` (e.g., `_on_body_entered()`)
- **Signals:** Use past tense verbs (e.g., `body_entered`, `timeout`)

### Error Handling & Safety
- Use `has_method()` before calling methods on unknown nodes: `if body.has_method("take_damage")`
- Use `is_in_group()` for group checks: `elif body.is_in_group("Environment")`
- Use `queue_free()` for memory cleanup (don't manually delete nodes)
- Add timers for automatic cleanup of projectiles to prevent memory leaks

### Godot Best Practices
- Connect signals in `_ready()` using `connect()`: `body_entered.connect(_on_body_entered)`
- Use `move_and_slide()` for CharacterBody2D movement
- Normalize vectors: `direction.normalized()`
- Use `global_position` for world-space coordinates
- Set rotation using radians: `rotation = direction.angle()`

### Physics & Gameplay
- Input handling: `Input.get_vector("left", "right", "up", "down")` handles diagonal normalization
- Deadzone for joysticks: check `length() > 0.1` to detect actual input
- Store aim state: `var is_aiming: bool = false` to track thumb release

## Godot Best Practices

### Project Organization
Follow the [official Godot project organization guidelines](https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html):

- **Per-scene directories**: Create a directory for each scene and co-locate its script(s)
- Example: `scenes/player/Player/Player.tscn` + `scenes/player/Player/Player.gd`
- **Shared scripts** go in `scripts/` or `autoloads/` (for singletons)
- **Assets** go in `assets/` organized by type (sprites/, audio/, fonts/)
- **UI themes** go in `themes/`

### Code Order
Follow the [official GDScript style guide code order](https://docs.godotengine.org/en/latest/tutorials/scripting/gdscript/gdscript_styleguide.html#code-order):

1. `class_name` (optional)
2. `extends` (if applicable)
3. **Docstring** (`## description`)
4. `tool` keyword (if applicable)
5. **Signals**
6. **Enums** (const groups)
7. **Constants** (`const`)
8. **@export** variables
9. **@export_group** / @export_subgroup
10. **@onready** variables
11. Built-in variables (`var`)
12. `func _ready()` and `func _init()`
13. Other `func` methods
14. Inner classes

### Centralized Constants
Use `autoloads/const.gd` for constants shared across 3+ files:
```gdscript
const DEFAULT_PLAYER_HEALTH: int = 100
const CRITICAL_HIT_CHANCE: float = 0.15
```

### Script Templates
Use custom script templates for consistency. Templates are in `script_templates/`:
- `node.gd` - Standard Node-based scene script
- `autoload.gd` - Autoload singleton script

### File Naming
- **Scripts**: PascalCase (e.g., `PlayerController.gd`)
- **Scenes**: PascalCase (e.g., `Player.tscn`)
- **Autoloads**: PascalCase with "Manager" suffix (e.g., `GameManager.gd`)

### Scene Organization
```
scenes/
├── player/
│   ├── Player/
│   │   ├── Player.tscn
│   │   └── Player.gd
│   └── Player.tscn (entry point)
├── enemies/
│   ├── Enemy/
│   │   ├── Enemy.tscn
│   │   └── Enemy.gd
│   └── bosses/
└── ui/
    ├── Menu/
    │   ├── Menu.tscn
    │   └── Menu.gd
    └── HUD/
```

### Type Hints
- Use static typing throughout: `var speed: float = 300.0`
- Function signatures: `func _physics_process(delta: float) -> void:`
- Return types: `func get_damage() -> int:`
- Avoid untyped variables in production code

### Error Handling
- Use `push_error()` for critical failures
- Use `push_warning()` for non-critical issues
- Use `get_node_or_null()` instead of hardcoded paths when node may not exist
- Use `has_method()` before calling methods on unknown nodes

### Performance Tips
- Use `const` for scene preloads (loaded at compile time)
- Use `@onready` for child node caching
- Use object pooling for frequently created/destroyed objects
- Use signals for decoupled communication instead of direct node calls

## TypeScript Code Style (Nakama Backend)

### Type Safety
- Use strict TypeScript (`"strict": true` in tsconfig.json)
- Define interfaces for all data structures (player stats, loadouts, etc.)
- Use enums for fixed sets (equipment slots, match states, etc.)

### Server-Authoritative Design
- Never trust client input - validate all data on server
- Calculate combat results server-side based on stored player stats
- Generate loot drops server-side to prevent manipulation

### Error Handling
- Use async/await for Nakama API calls
- Wrap database operations in try-catch blocks
- Log errors but don't expose sensitive data to clients

### Backend Dependencies
- `@heroiclabs/nakama-js` - Nakama client
- `zod` - Schema validation
- `@sentry/node` - Error tracking
- `winston` - Logging
- `prom-client` - Metrics
- `uuid` - ID generation
- `lru-cache` - In-memory caching

### Dependency Lockfiles
The project uses `package-lock.json` to ensure reproducible builds.

- **Backend lockfile:** `backend/package-lock.json` - Already exists and is tracked in git
- **Install with lockfile:** `cd backend && npm install` (uses lockfile automatically)
- **Update dependencies:** `cd backend && npm install <package>@latest` (updates lockfile)
- **Check for outdated packages:** `cd backend && npm outdated`

## Testing Guidelines

### GDScript Tests
- **Run Tests:** Open Godot editor, run `res://test/run_all_tests.gd` scene
- **Test Location:** All test files are in `test/` directory
- **Test Files:** `test/test_*.gd` - each manager/feature has corresponding tests

### TypeScript Tests (Backend)
```bash
npm test                 # Run all tests
npm run test:coverage    # Run with coverage report
npm run test:integration # Run integration tests
npm run test:ci          # CI-ready test run with JUnit output
```

### Test Organization
- Backend tests in `/backend/tests/` directory
- Use Jest as the testing framework
- Integration tests use separate config: `backend/jest.integration.config.js`

### Flaky Test Detection
The project includes automated flaky test detection to identify non-deterministic test failures.

#### Backend (TypeScript/Jest)
```bash
# Run flaky test detection
npm run test:flaky

# Run with custom settings
npm run test:flaky -- --runs=5 --threshold=0.4

# Run in CI mode (exit with error if flaky tests found)
npm run test:flaky:ci
```

### Godot (GDScript)
```bash
# Run Godot flaky test detection
python3 scripts/detect_godot_flaky_tests.py

# Run with custom settings
python3 scripts/detect_godot_flaky_tests.py --runs=5 --verbose
```

### Generate Reports
```bash
# Using Make
make test-flaky-report

# Or directly
cd backend && npm run test:report
```

### Configuration Options
- `--runs=N`: Number of times to run each test (default: 3)
- `--threshold=N`: Minimum failure rate to consider flaky (default: 0.33)
- `--verbose`: Show detailed output

### Flaky Test History
History is stored in:
- Backend: `backend/data/flaky-test-history.json`
- Godot: `data/godot-flaky-test-history.json`

### CI Integration
- GitHub workflow: `.github/workflows/flaky-tests.yml`
- Can be run manually via workflow_dispatch
- Scheduled weekly via cron

### Duplicate Code Detection
The project includes automated duplicate code detection to identify and prevent code duplication across the codebase.

### Running Duplicate Code Detection
```bash
# Using Make
make duplicate-code-check

# Using npm (backend only)
cd backend && npm run detect-duplicate

# CI mode (strict - fails if threshold exceeded)
make duplicate-code-check-ci
```

### Configuration
- **Tool:** jscpd (JavaScript/TypeScript Clone Petector)
- **Thresholds:**
  - Minimum lines: 5
  - Minimum tokens: 30
  - CI threshold: 3% (percentage of duplicated lines)
- **Supported Languages:**
  - TypeScript (.ts)
  - GDScript (.gd)
  - Python (.py)

### Ignore Patterns
The following are excluded from duplicate detection:
- Test files (*.test.ts, *.test.gd)
- Build artifacts (node_modules, build, dist)
- Generated files

### CI Integration
- GitHub workflow: `.github/workflows/ci.yml` (duplicate-code-detection job)
- Runs automatically on push and pull requests
- Fails if duplicated lines exceed threshold

### Fixing Duplicates
When duplicates are detected:
1. Review the duplicate code
2. Extract common logic into shared functions/modules
3. Consider using inheritance for similar classes
4. Create utility functions for repeated patterns

## Architecture Notes

### Environment Configuration
- **Backend:** Uses `.env` files for configuration (never commit to version control)
- Copy `.env.example` to `.env` and configure before starting
- Use `./start.sh` script to validate environment and start services
- Environment-specific configs: `.env.development`, `.env.staging`

### Local Services Management

The project uses Docker Compose for local development services (Nakama game server, PostgreSQL).

### Start Services
```bash
make services-start
# Or use backend-start
make backend-start
```

### Stop Services
```bash
make services-stop
# Or use backend-stop
make backend-stop
```

### Check Status
```bash
make services-status
```

### Health Check
```bash
make services-health
```

### View Logs
```bash
make services-logs
```

### Validate Prerequisites
```bash
make services-validate
```

### Clean (Stop + Remove Volumes)
```bash
make services-clean
```

### Client-Server Communication
- Client sends actions (e.g., `{"action": "shoot", "angle": 0.78}`)
- Server validates and calculates results (damage, loot, etc.)
- Server sends authoritative state back to client
- Use Nakama RPCs for custom game logic

### Transmog System
- Base gear stores all stats/modifiers (earned via gameplay)
- Cosmetic skins store only visual data (purchased via IAP)
- Client combines base gear + skin for rendering

## Commit & Pull Request Guidelines

### Commit Messages
- Follow conventional commits: `fix:`, `feat:`, `refactor:`, `docs:`, `test:`
- Example: `fix: resolve arrow collision issue with enemies`

### Branch Naming
- `fix/issue-<number>` for bug fixes
- `feat/<description>` for new features
- `refactor/<description>` for code improvements

### PR Requirements
- All tests must pass
- Linting must pass without errors
- TypeScript type checking must pass
- Update documentation if needed

## Skills

OpenHands supports skills for enhanced agent capabilities. Skills are stored in `.agents/skills/` and provide specialized guidance for different aspects of the project.

### Available Skills

- **godot-backend** - Guidelines for working with Godot backend and Nakama server integration

### Adding New Skills

To add a new skill:
1. Create a new directory under `.agents/skills/`
2. Add a `SKILL.md` file with frontmatter containing:
   - `keywords`: Array of relevant keywords
   - `description`: Brief description of the skill
3. Add the skill to the list in this section

## AI Agent-Assisted Development Guidelines

This project supports AI agent-assisted development to enhance productivity and code quality. All AI-assisted contributions must follow these guidelines to ensure proper tracking, review, and accountability.

### Overview

AI agents can assist with various development tasks including:
- Code generation and implementation
- Bug detection and fixing
- Documentation improvements
- Refactoring and code optimization
- Test creation and maintenance

### Tracking AI-Generated Code Changes

All AI-generated code changes must be properly tracked in version control.

#### Required Attribution

AI-assisted contributions must include clear attribution in:
- **Commit messages**: Use `[AI-assisted]` or `(AI)` prefix in commit message
- **Code comments**: Add inline comments noting AI assistance for complex implementations
- **PR description**: Document which parts of the change were AI-assisted

#### Commit Message Format for AI-Assisted Changes

```text
[AI-assisted] <type>: <description>

- AI Model: <model name>
- Task: <brief description of what was done>
```

Example:
```text
[AI-assisted] feat: Add new weapon type

- AI Model: Claude/Codex/GPT-4
- Task: Implemented WeaponFactory with configurable weapon stats
- Human Review: Required for combat balance verification
```

### Code Review Requirements for AI-Assisted Contributions

All AI-assisted contributions require human review before merging:

1. **Mandatory Code Review**: At least one human team member must review all AI-assisted changes
2. **Focus Areas for Review**:
   - Verify code follows project conventions and style guides
   - Check for potential bugs or edge cases
   - Ensure security best practices are followed
   - Validate performance implications
   - Confirm tests are included and passing

3. **Review Checklist for AI-Assisted Code**:
   - [ ] Code follows GDScript/TypeScript style guides
   - [ ] No hardcoded secrets or credentials
   - [ ] Error handling is appropriate
   - [ ] Tests are included and passing
   - [ ] Documentation is updated if needed
   - [ ] No debug code or print statements left behind
   - [ ] Security implications considered

4. **Approval Requirements**:
   - Same approval rules as human-written code
   - Additional focus on AI-specific concerns (see below)

### AI-Specific Review Concerns

When reviewing AI-generated code, pay extra attention to:

1. **Security**:
   - No exposed API keys or secrets
   - Input validation on all user data
   - Proper escaping/parameterization to prevent injection

2. **Logic Errors**:
   - AI may miss edge cases
   - Verify business logic matches requirements
   - Check for off-by-one errors or boundary conditions

3. **Dependencies**:
   - Verify new dependencies are necessary
   - Check for version conflicts
   - Ensure lockfiles are updated properly

4. **Code Quality**:
   - AI may generate verbose or redundant code
   - Check for proper error handling
   - Verify type hints are correct and complete

### Process for AI-Assisted Development

1. **Task Assignment**: AI agent is assigned a specific task with clear requirements
2. **Implementation**: AI generates code following project conventions
3. **Self-Testing**: AI runs existing tests and adds new tests
4. **Human Review**: Human reviewer examines the changes
5. **Revision**: Any issues are addressed by AI or human
6. **Attribution**: Changes are committed with proper AI attribution
7. **Merge**: After approval, changes are merged following project workflow

### AI Agent Configuration

When working on this project, AI agents should:

1. **Read First**: Review AGENTS.md and relevant documentation before starting
2. **Follow Conventions**: Adhere to all code style and commit message guidelines
3. **Test Thoroughly**: Run tests before submitting changes
4. **Document Changes**: Update documentation for any new features
5. **Request Review**: Clearly mark AI-assisted contributions for human review

### Exceptions and Edge Cases

- **Security-Critical Code**: AI should not generate security-critical code without human supervision
- **Complex Business Logic**: Human review must verify AI-generated business logic
- **Database Migrations**: Always require human review for schema changes
- **Secret/Key Handling**: AI must not generate or modify secret management code

## Release Notes Automation

The project includes automated release notes generation from git history using conventional commits.

### Generate Release Notes Locally

```bash
# Using Make
make release-notes

# Using Python directly
python scripts/generate_release_notes.py
python scripts/generate_release_notes.py v1.0.0           # From tag to HEAD
python scripts/generate_release_notes.py v0.9.0 v1.0.0    # Between two tags
python scripts/generate_release_notes.py -o RELEASE.md    # Output to file
```

### GitHub Actions Workflow

The release notes workflow (`.github/workflows/release-notes.yml`) runs:
- **On Release:** When a new GitHub release is published
- **Manual:** Can be triggered via workflow_dispatch with optional from/to tag inputs

The workflow:
1. Checks out code with full git history
2. Generates release notes using the Python script
3. Creates a GitHub Release with the generated notes
4. Uploads release notes as an artifact

### Conventional Commits

Release notes are generated from commits following the conventional commits format:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Test changes
- `build:` - Build system changes
- `ci:` - CI/CD changes
- `chore:` - Maintenance tasks

Example: `feat: Add new weapon type (#123)` will appear in Features with a link to PR #123.

## Technical Debt Tracking

The project includes a technical debt tracking system to identify, document, and manage technical debt over time.

### Tech Debt Documentation

All technical debt items are documented in [TECH_DEBT.md](TECH_DEBT.md), which includes:
- Active debt items with severity, status, and estimated effort
- Historical debt that has been resolved
- Categories for classification (Deprecated APIs, Code Quality, Testing, etc.)

### Running Tech Debt Detection

```bash
# Using Make
make tech-debt-check

# Using npm directly
cd backend
npm run tech-debt:report

# CI mode (fails on critical/high severity)
npm run tech-debt:report:ci
```

### Automated Detection

The tech debt detection script (`backend/scripts/detect-tech-debt.ts`) automatically detects:
- Deprecated API usage (`@deprecated` markers)
- TODO/FIXME/HACK comments
- Console logging instead of proper logger
- Type safety issues (`any` type usage)
- Empty catch blocks
- TypeScript error suppressions

### CI/CD Integration

Tech debt tracking is integrated into the CI pipeline (`.github/workflows/ci.yml`):
- Runs on every push to main/develop and on PRs
- Generates JSON report with all detected issues
- Fails on critical/high severity issues in CI mode
- Uploads reports as artifacts for analysis

## Bundle Size Tracking

The project includes a comprehensive bundle size tracking system to monitor and control the size of the backend bundle.

### Running Bundle Analysis

```bash
# Using Make
make bundle-size-check

# Using npm directly
cd backend
npm run bundle:analyze

# CI mode (enforces limits and fails on errors)
npm run bundle:analyze:ci

# JSON output for integration
node scripts/bundle-analysis.js --json
```

### Configuration

Bundle size limits are configured in `backend/bundle-size-limits.json`:
- `maxBundleSize`: Maximum allowed bundle size (bytes)
- `maxDependencySize`: Maximum total dependency size (bytes)
- `heavyDependencyDetection`: Patterns to detect and flag heavy dependencies

### Heavy Dependency Detection

The system detects heavy dependencies and provides recommendations:
- **@sentry/***: Use selective imports or @sentry/lite
- **winston**: Consider pino or abstract logging
- **prom-client**: Verify needed metrics only
- **zod**: Consider lighter alternatives
- **@heroiclabs/***: Verify only needed modules are imported
- **pg**: Use pg-query-stream for bulk operations
- **opentelemetry**: Use selective instrumentations

### CI/CD Integration

Bundle size tracking is integrated into CI (`.github/workflows/ci.yml`):
- Runs bundle analysis on every push
- Tracks bundle size over time
- Enforces limits in CI mode
- Uploads reports as artifacts

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any shell command containing `curl` or `wget` will be intercepted and blocked by the context-mode plugin. Do NOT retry.
Instead use:
- `context-mode_ctx_fetch_and_index(url, source)` to fetch and index web pages
- `context-mode_ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any shell command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` will be intercepted and blocked. Do NOT retry with shell.
Instead use:
- `context-mode_ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### Direct web fetching — BLOCKED
Do NOT use any direct URL fetching tool. Use the sandbox equivalent.
Instead use:
- `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Shell (>20 lines output)
Shell is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `context-mode_ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `context-mode_ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### File reading (for analysis)
If you are reading a file to **edit** it → reading is correct (edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `context-mode_ctx_execute_file(path, language, code)` instead. Only your printed summary enters context.

### grep / search (large results)
Search results can flood context. Use `context-mode_ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `context-mode_ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `context-mode_ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `context-mode_ctx_execute(language, code)` | `context-mode_ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `context-mode_ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `upgrade` MCP tool, run the returned shell command, display as checklist |
