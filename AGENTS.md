# Armored Archer - Agent Development Guidelines

This file contains conventions and commands for agents working on the Armored Archer codebase.

## Project Structure

```
/                          # Godot project root
├── autoloads/            # Singletons (NetworkManager, GameManager, etc.)
├── scenes/               # .tscn files organized by feature
│   ├── player/           # Player-related scenes
│   ├── enemies/          # Enemy scenes
│   └── ui/               # UI scenes
├── scripts/              # .gd scripts
├── assets/               # Sprites, sounds, music
├── test/                # GDScript test runner and framework
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

#### Database Schema Documentation
- **Schema Reference**: [DATABASE_SCHEMA.md](backend/DATABASE_SCHEMA.md)
- **Migration Files**: `backend/data/*.sql`

#### Key Tables
| Table | Description |
|-------|-------------|
| `player_stats` | Player level, experience, ability points, stats |
| `catalog` | Master gear catalog with types, rarities, stats |
| `inventory` | Player gear ownership |
| `loadout` | 5 equipment slots (helm, armor, bow, arrow, amulet) |

#### Database Enums
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

#### Godot (GDScript)
```bash
# Run Godot flaky test detection
python3 scripts/detect_godot_flaky_tests.py

# Run with custom settings
python3 scripts/detect_godot_flaky_tests.py --runs=5 --verbose
```

#### Generate Reports
```bash
# Using Make
make test-flaky-report

# Or directly
cd backend && npm run test:report
```

#### Configuration Options
- `--runs=N`: Number of times to run each test (default: 3)
- `--threshold=N`: Minimum failure rate to consider flaky (default: 0.33)
- `--verbose`: Show detailed output

#### Flaky Test History
History is stored in:
- Backend: `backend/data/flaky-test-history.json`
- Godot: `data/godot-flaky-test-history.json`

#### CI Integration
- GitHub workflow: `.github/workflows/flaky-tests.yml`
- Can be run manually via workflow_dispatch
- Scheduled weekly via cron

## Architecture Notes

### Environment Configuration
- **Backend:** Uses `.env` files for configuration (never commit to version control)
- Copy `.env.example` to `.env` and configure before starting
- Use `./start.sh` script to validate environment and start services
- Environment-specific configs: `.env.development`, `.env.staging`

### Local Services Management

The project uses Docker Compose for local development services (Nakama game server, PostgreSQL).

#### Start Services
```bash
make services-start
# Or use backend-start
make backend-start
```

#### Stop Services
```bash
make services-stop
# Or use backend-stop
make backend-stop
```

#### Check Status
```bash
make services-status
```

#### Health Check
```bash
make services-health
```

#### View Logs
```bash
make services-logs
```

#### Validate Prerequisites
```bash
make services-validate
```

#### Clean (Stop + Remove Volumes)
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

```
[AI-assisted] <type>: <description>

- AI Model: <model name>
- Task: <brief description of what was done>
```

Example:
```
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
