# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Armored Archer is a 2D top-down mobile archery game built with Godot 4 and Nakama (TypeScript). The project has two main components:
- **Client**: Godot 4 game engine with GDScript
- **Backend**: Nakama server written in TypeScript with PostgreSQL database

The game features PvE auto-shooter combat, asynchronous turn-based PvP, gear system, and seasonal leaderboards.

## Common Commands

### Initial Setup
```bash
make setup              # Install all dependencies (backend npm)
```

### Backend (TypeScript/Nakama)
```bash
# Start/Stop services
make backend-start      # Start Nakama + PostgreSQL with Docker
make backend-stop       # Stop backend services

# Development
make backend-dev        # Start backend with auto-reload (npm run dev)
make backend-build      # Build TypeScript to JavaScript

# Testing
make backend-test       # Run TypeScript tests
npm run test:integration  # Run integration tests only
npm run test:schema     # Run database schema tests

# Code Quality
make backend-lint       # Lint TypeScript
make backend-check      # Run linting + type checking
```

### Godot Client (GDScript)
```bash
# Run the game
# Open project in Godot 4.6.1 Editor and press F5

# Run tests
godot --headless --script res://test/run_all_tests.gd

# Linting (requires gdtoolkit)
pip install gdtoolkit
gdlint autoloads/ scenes/ scripts/ test/

# Generate HTML coverage report
python3 scripts/parse_godot_coverage.py \
  --input=test/coverage/json/coverage.json \
  --output=test/coverage/html/index.html

# Local testing script (when GitHub Actions unavailable)
./scripts/local-godot-tests.sh
```

### Database
```bash
make backend-migrate    # Run Nakama migrations
make backend-db-schema  # View current database schema
make backend-migrate-new  # Create new migration file (interactive)
```

## Architecture

### Autoloads (Godot Singletons)
The Godot client uses autoloads for global managers. Key autoloads (defined in `project.godot`):

| Autoload | Purpose |
|----------|---------|
| `NetworkManager` | Nakama server connection and RPC calls |
| `GameManager` | Core game state and logic |
| `CombatManager` | Combat calculations and effects |
| `GearManager`/`GearRegistry` | Equipment system |
| `PlayerStatsManager` | Player statistics (level, XP, stats) |
| `MatchmakerManager` | Asynchronous PvP matchmaking |
| `SeasonManager` | Seasonal content and leaderboards |
| `StoreManager` | In-app purchase handling (RevenueCat) |
| `TransmogManager` | Cosmetic skin system |
| `GemManager` | Gem/socket system |
| `CampaignManager` | Campaign progression |
| `AutoAimManager` | Auto-aim assistance |
| `ObjectPool` | Object pooling for performance |
| `DesignTokens` | Design system constants (spacing, colors, typography) |
| `ThemeManager` | UI theme management (light/dark modes) |
| `AccessibilityManager` | Accessibility features (text scaling, screen reader) |

### Design System (UI)
The project has a design system for UI components located in `scenes/ui/components/`:
- `base_button.gd` - Base button with design token support
- `base_container.gd` - Container with spacing/sizing
- `base_label.gd` - Labels with typography tokens
- `base_panel.gd` - Panel components
- `base_progress_bar.gd` - Progress bars with accessibility
- `base_icon.gd` - Icon components
- `loading_indicator.gd` - Loading states
- `theme_toggle.gd` - Light/dark theme switcher

Design tokens are defined in `autoloads/design_tokens.gd` and include spacing, colors, typography, and other UI constants.

### Backend Structure
```
backend/
├── src/              # TypeScript source
│   ├── modules/      # Nakama modules (RPC handlers, game logic)
│   ├── config/       # Configuration files
│   └── features/     # Feature-flagged functionality
├── build/            # Compiled JavaScript
├── data/             # SQL migrations
├── tests/            # Jest tests
└── docker-compose.yml
```

### Server-Authoritative Design
- Never trust client input - validate all data on server
- Calculate combat results server-side based on stored player stats
- Generate loot drops server-side to prevent manipulation
- Use Nakama RPCs for custom game logic

## Database Schema
Key tables (see `backend/DATABASE_SCHEMA.md` for full reference):
- `player_stats` - Player level, experience, ability points, stats
- `catalog` - Master gear catalog with types, rarities, stats
- `inventory` - Player gear ownership
- `loadout` - 5 equipment slots (helm, armor, bow, arrow, amulet)

Enums:
- `gear_type`: helm, armor, bow, arrow, amulet
- `gear_rarity`: common, rare, epic, legendary

## Code Style

### GDScript
- **Variables/Functions**: `snake_case` (e.g., `base_speed`, `handle_movement()`)
- **Classes/Types**: `PascalCase` (e.g., `CharacterBody2D`, `Area2D`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `ARROW_SCENE`, `BASE_SPEED`)
- **Private members**: Prefix with `_` (e.g., `_on_body_entered()`)
- Use `@export` for inspector-exposed variables
- Use `@onready` for node references: `@onready var sprite: Sprite2D = $Sprite2D`
- Always add explicit type hints: `var speed: float = 300.0`

### TypeScript
- Follow ESLint rules in `backend/.eslintrc.js` and `backend/eslint.config.js`
- Use async/await, strict typing, and JSDoc for public functions
- See `AGENTS.md` for detailed conventions

### Testing
- Backend tests use Jest and are in `backend/src/**/__tests__/`
- Godot tests are in `test/test_*.gd`
- Aim for high coverage on critical paths

## Environment Configuration
- Copy `backend/.env.example` to `backend/.env` and configure
- Default PostgreSQL: `postgres://postgres:localdbpassword@localhost:5432/nakama`
- Nakama Console: http://localhost:7351 (admin:password)

## Local Services
```bash
make services-start    # Start Nakama + PostgreSQL
make services-stop     # Stop services
make services-health   # Check service health
make services-logs     # View service logs
```

### CI Workflows with Act

Run GitHub Actions workflows locally using the `act` CLI tool.

#### Installing Act

```bash
# Linux (Homebrew)
brew install act

# Linux (manual download)
wget -qO- https://github.com/nektos/act/releases/latest/download/act_Linux_x86_64.tar.gz
tar -xzf act_Linux_x86_64.tar.gz
sudo mv act /usr/local/bin/
```

#### Running CI Jobs Locally

```bash
# Run backend linting and type checking
act -j backend-lint --no-cache-server
act -j backend-typecheck --no-cache-server

# Run all CI jobs from ci.yml
act --no-cache-server

# Run specific workflow
act -W .github/workflows/ci.yml --no-cache-server
```

#### Running Godot Tests with Act

Godot tests require significant memory. To run them locally with `act`, create a `.actrc` file in the project root:

```bash
cat > .actrc << 'EOF'
{
  "container-daemon-socket": "unix:///var/run/docker.sock",
  "container-options": [
    "--memory=8g",
    "--memory-swap=4g"
  ],
  "bind": false
}
EOF
```

Then run Godot tests:

```bash
act -j godot-tests
```

**Note**: Without `.actrc`, Godot tests are automatically skipped to avoid OOM issues.

#### Troubleshooting

| Issue | Solution |
|--------|----------|
| npm cache integrity errors | Use `--no-cache-server` flag |
| Godot tests cause OOM | Create `.actrc` with increased memory |
| Container network issues | Ensure Docker daemon is running |

## Key Files
- `project.godot` - Godot project configuration (autoloads, input map)
- `Makefile` - Development commands
- `AGENTS.md` - Detailed agent development guidelines
- `CONTRIBUTING.md` - Contribution guidelines
- `backend/DATABASE_SCHEMA.md` - Database schema reference
- `GODOGEN_SETUP.md` - AI game generation system setup guide

## Godogen AI Game Generation

This project includes **godogen** - an AI-powered system for generating Godot 4 games and features. See `GODOGEN_SETUP.md` for full documentation.

### Quick Start with Godogen

1. Set API keys (required):
   ```bash
   export GOOGLE_API_KEY="your-key"  # Get from https://makersuite.google.com/app/apikey
   ```

2. Use in Claude Code:
   ```
   /godogen Create a new enemy type: a flying gargoyle that throws stones
   /godogen Add a fishing mini-game with catch mechanics
   ```

### What Godogen Does
- Generates complete game features from natural language
- Creates 2D/3D assets using AI (Gemini, Tripo3D)
- Writes production-ready GDScript following project conventions
- Performs visual QA by capturing and analyzing screenshots
- Integrates with existing autoloads and systems

### Generated Files
- `PLAN.md` - Development plan with tasks
- `STRUCTURE.md` - Architecture documentation
- `MEMORY.md` - Learnings and workarounds
- `ASSETS.md` - Asset catalog
- `screenshots/` - Visual evidence from tests
