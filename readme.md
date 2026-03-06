# Armored Archer 🏹

A 2D top-down mobile archery game built with Godot 4 and Nakama. Features a highly replayable PvE auto-shooter mode and asynchronous turn-based PvP duels. 

Strictly Free-to-Play. Zero Pay-to-Win. Cosmetics only.

## 🛠 Tech Stack

* **Game Engine:** [Godot 4](https://godotengine.org/)
* **Language:** GDScript (Client) / TypeScript (Server)
* **Backend:** [Nakama](https://heroiclabs.com/)
* **Database:** PostgreSQL
* **IAP Infrastructure:** RevenueCat

## 📊 Code Coverage

[![codecov](https://img.shields.io/codecov/c/gh/anchapin/armored-archer/main)](https://codecov.io/gh/anchapin/armored-archer)

---

## 🚀 Development Setup

### Prerequisites

- **Godot 4.x** - Download from [godotengine.org](https://godotengine.org/)
- **Docker & Docker Compose** - Required for local Nakama backend
- **Node.js 18+** - Required for backend development
- **npm** - Package manager (comes with Node.js)

---

## ⚡ Single Command Setup

For quick setup of the development environment, use the Makefile:

```bash
# Install all dependencies
make setup

# Start backend (requires Docker)
make backend-start

# Run Godot game
# Open project in Godot 4 Editor and press F5
```

### Common Development Commands

| Command | Description |
|---------|-------------|
| `make setup` | Install all dependencies |
| `make backend-start` | Start Nakama backend with Docker |
| `make backend-stop` | Stop backend services |
| `make dev` | Start backend with auto-reload |
| `make backend-test` | Run backend tests |
| `make backend-build` | Build TypeScript backend |
| `make backend-lint` | Lint backend code |
| `make backend-check` | Run linting and type checking |
| `make clean` | Clean build artifacts |
| `make help` | Show all available commands |

---

## 🎮 Godot Client

### Running the Game

1. Open the project in Godot 4 Editor
2. Press `F5` to run the project

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
├── scripts/              # .gd scripts
├── assets/               # Sprites, sounds, music
├── test/                 # GDScript test runner and framework
├── export/               # Export presets and configurations
└── res://                # Godot resource path prefix
```

---

## ⚙️ Backend (Nakama)

### Quick Start

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment template and configure
cp .env.example .env

# Start Nakama and PostgreSQL
./start.sh
```

The backend will be available at:
- **API:** http://localhost:7350
- **Admin Console:** http://localhost:7351 (admin:password)

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

### Development Commands

| Command | Description |
|---------|-------------|
| `./start.sh` | Start Nakama and PostgreSQL with validation |
| `npm run dev` | Start development server with auto-reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm run build:watch` | Build in watch mode |
| `./validate-env.sh` | Validate environment variables |

### Running Tests

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

## 📁 Project Structure

* `/` - Godot project root (client)
* `/backend` - Nakama server, TypeScript code, Docker Compose
* `/test` - GDScript tests
* `/docs` - Documentation

---

## 🗺️ Roadmap

| Phase | Timeline | Focus Area | Key Deliverables |
|-------|----------|------------|------------------|
| 1 | Weeks 1-3 | Godot Engine Setup & Physics | Touch controls (virtual joysticks), character movement, arrow trajectory physics, and hitbox collisions. |
| 2 | Weeks 4-6 | AI & Auto-Aim Logic | Spawning simple enemies, implementing auto-aim logic, health systems, and core game loop (win/loss states). |
| 3 | Weeks 7-9 | Backend & Database Setup | Local Nakama Docker setup, user authentication, database schemas (catalog, inventory, loadout). |
| 4 | Weeks 10-13 | UI, IAP, & Turn-Based PvP | Modular sprite system, cosmetic shop UI, RevenueCat integration, Nakama matchmaker, and turn-based RPCs. |
| 5 | Weeks 14-16 | Polish & App Store Submission | Safe-area UI adjustments, analytics (Crashlytics), TestFlight (iOS) / Play Console (Android) beta distribution. |
