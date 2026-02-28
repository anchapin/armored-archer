# Armored Archer - Agent Development Guidelines

This file contains conventions and commands for agents working on the Armored Archer codebase.

## Build & Development Commands

### Godot Client (GDScript)
- **Run Project:** Open in Godot 4.x Editor and press `F5`
- **Test Scene:** Open scene in editor and press `Ctrl+F5` for current scene only
- **Export Project:** Project → Export → select platform → Export Project

### Backend (TypeScript - Not Yet Implemented)
```bash
# Start backend with Docker Compose
docker-compose up -d

# Nakama console (admin:password)
open http://localhost:7351

# When tests are added, likely patterns:
npm test                          # Run all tests
npm test -- path/to/test.ts      # Run single test file
npm run lint                     # Lint TypeScript
npm run lint:fix                 # Fix linting issues
```

### Database
```bash
# PostgreSQL is managed via Docker Compose
# Connection: postgres://postgres:localdbpassword@localhost:5432/nakama

# Run Nakama migrations
docker exec -it armored_archer_server /nakama/nakama migrate up
```

## GDScript Code Style

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

## TypeScript Code Style (Future Backend)

When the Nakama backend is implemented, follow these patterns:

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

## Project Structure

```
/                          # Godot project root
  ├── autoloads/          # Singletons (NetworkManager, GameManager, etc.)
  ├── scenes/             # .tscn files organized by feature
  ├── scripts/            # .gd scripts
  ├── assets/             # Sprites, sounds, music
  └── res://              # Godot resource path prefix

/backend/                  # Nakama TypeScript server (not yet created)
  ├── server/             # Nakama server code
  ├── modules/            # Custom Nakama modules
  └── data/               # Server configuration
```

## Architecture Notes

### Client-Server Communication
- Client sends actions (e.g., `{"action": "shoot", "angle": 0.78}`)
- Server validates and calculates results (damage, loot, etc.)
- Server sends authoritative state back to client
- Use Nakama RPCs for custom game logic

### Transmog System
- Base gear stores all stats/modifiers (earned via gameplay)
- Cosmetic skins store only visual data (purchased via IAP)
- Client combines base gear + skin for rendering

## Important Notes

- This is a F2P game with cosmetic-only monetization - never implement pay-to-win
- Asynchronous PvP only - no real-time synchronous multiplayer in MVP
- Player progression must be server-authoritative to prevent cheating
- Mobile-first design - touch controls and safe area considerations required
