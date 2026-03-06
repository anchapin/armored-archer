# Armored Archer 🏹

A 2D top-down mobile archery game built with Godot 4 and Nakama. Features a highly replayable PvE auto-shooter mode and asynchronous turn-based PvP duels. 

Strictly Free-to-Play. Zero Pay-to-Win. Cosmetics only.

## 🛠 Tech Stack

* **Game Engine:** [Godot 4](https://godotengine.org/)
* **Language:** GDScript (Client) / TypeScript (Server)
* **Backend:** [Nakama](https://heroiclabs.com/)
* **Database:** PostgreSQL
* **IAP Infrastructure:** RevenueCat

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Backend Development](#backend-development)
- [Godot Client Development](#godot-client-development)
- [Running Tests](#running-tests)
- [Building for Distribution](#building-for-distribution)
- [Project Structure](#project-structure)
- [Common Issues & Troubleshooting](#common-issues--troubleshooting)

---

## ✅ Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| [Godot Engine](https://godotengine.org/) | 4.x | Game client development |
| [Node.js](https://nodejs.org/) | 18+ | Backend server |
| [Docker](https://www.docker.com/) | Latest | Running Nakama & PostgreSQL |
| [Docker Compose](https://docs.docker.com/compose/) | Latest | Container orchestration |

### Optional Software

| Software | Purpose |
|----------|---------|
| [Android Studio](https://developer.android.com/studio) | Android builds |
| [Xcode](https://developer.apple.com/xcode/) | iOS builds (macOS only) |
| [JDK 11+](https://www.oracle.com/java/technologies/downloads/) | Android builds |
| [ADB](https://developer.android.com/studio/command-line/adb) | Installing APK on device |

---

## 🔧 Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/anchapin/armored-archer.git
cd armored-archer
```

### 2. Backend Environment Variables

The backend requires environment variables to be configured. A `.env.example` file is provided:

```bash
# Navigate to backend directory
cd backend

# Copy the example environment file
cp .env.example .env

# Edit the .env file with your preferred editor
nano .env
# or
vim .env
```

Required environment variables include:
- `NAKAMA_SERVER_KEY` - Authentication key for Nakama server
- `POSTGRES_USER` - PostgreSQL username
- `POSTGRES_PASSWORD` - PostgreSQL password
- `POSTGRES_DB` - Database name

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

---

## 🖥 Backend Development

### Quick Start

The easiest way to start the backend:

```bash
cd backend
./start.sh
```

This script will:
1. Check for and create `.env` file if needed
2. Validate environment variables
3. Start PostgreSQL and Nakama via Docker Compose

### Manual Start

If you prefer to start services manually:

```bash
cd backend

# Start Docker Compose services
docker-compose up -d
```

### Available npm Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run build:watch` | Compile TypeScript in watch mode |
| `npm run dev` | Run development server with hot reload |
| `npm run test` | Run all unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:ci` | Run tests for CI/CD pipelines |
| `npm run test:integration` | Run integration tests |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run typecheck` | Run TypeScript type checking |

### Backend Services

After starting, the following services are available:

| Service | URL | Credentials |
|---------|-----|-------------|
| Nakama API | http://localhost:7350 | (server key from .env) |
| Nakama Console | http://localhost:7351 | admin:password |
| PostgreSQL | localhost:5432 | (from .env) |

### Running the TypeScript Server

For development with hot reload:

```bash
cd backend
npm run dev
```

To build and run the compiled version:

```bash
cd backend
npm run build
node build/index.js
```

---

## 🎮 Godot Client Development

### Opening the Project

1. Open Godot 4.x
2. Click "Import" and navigate to the project root
3. Select `project.godot` and click "Import & Edit"

### Running the Game

- **From Editor:** Press `F5` or click the Play button
- **From Command Line:**
  ```bash
  godot
  ```

### Godot Client Configuration

The client connects to the backend via `res://autoloads/NetworkManager.gd`. For local development, ensure the server address points to:

```
127.0.0.1:7350
```

### Key Godot Files

| Path | Description |
|------|-------------|
| `project.godot` | Project configuration |
| `scenes/main.tscn` | Main game scene |
| `autoloads/` | Global singletons |
| `test/` | GDScript test files |

---

## 🧪 Running Tests

### Backend Tests (Jest)

```bash
cd backend

# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (development)
npm run test:watch

# Run integration tests
npm run test:integration

# Run tests for CI/CD
npm run test:ci
```

### Backend Test Configuration

The Jest configuration (`jest.config.js`) includes:
- Coverage thresholds for critical modules
- Test timeout of 10 seconds
- TypeScript support via ts-jest

### Godot Client Tests (GDScript)

The project includes GDScript unit tests located in the `test/` directory.

**To run Godot tests:**

1. Open the project in Godot Editor
2. Run the test scene:
   - Press `F6` to run the current scene
   - Or navigate to `res://test/run_all_tests.gd` and run it

**Test files include:**
- `test/test_combat_manager.gd`
- `test/test_game_manager.gd`
- `test/test_gear_manager.gd`
- `test/test_matchmaker_manager.gd`
- `test/test_network_manager.gd`
- `test/test_player_stats_manager.gd`
- `test/test_store_manager.gd`
- `test/test_campaign_manager.gd`
- `test/test_season_manager.gd`
- `test/test_gear_registry.gd`
- `test/test_gem_manager.gd`
- `test/test_transmog_manager.gd`
- `test/test_safe_area_manager.gd`
- `test/test_auto_aim_manager.gd`
- `test/test_ui_transition_optimizer.gd`

---

## 📦 Building for Distribution

### Android Build

1. Open the project in Godot 4.x
2. Go to **Project → Export**
3. Select **Android** preset
4. Configure the following:
   - Package Name: `com.armoredarcher.game`
   - Version: `1`
   - Version Code: `1`
5. Click **Export**
6. Choose export location: `export/android/armored-archer.apk`

**Build from command line:**
```bash
godot --export "Android" export/android/armored-archer.apk
```

**Install on device:**
```bash
adb install export/android/armored-archer.apk
```

### iOS Build (macOS only)

1. Open the project in Godot 4.x
2. Go to **Project → Export**
3. Select **iOS** preset
4. Configure:
   - Bundle Identifier: `com.armoredarcher.game`
   - Display Name: `Armored Archer`
5. Click **Export**
6. Choose export location: `export/ios/armored-archer.ipa`

**Build from command line:**
```bash
godot --export "iOS" export/ios/armored-archer.ipa
```

### Export Presets

The project includes several export preset configurations:
- `export_presets.cfg` - Main configuration
- `export_presets_android.cfg` - Android-specific
- `export_presets_android_test.cfg` - Test builds
- `export_presets_clean.cfg` - Clean/minimal build

---

## 📁 Project Structure

```
armored-archer/
├── addons/              # Godot addons
│   └── analytics_manager/
├── assets/              # Game assets (sprites, icons, particles)
├── autoloads/           # Global singletons
├── backend/             # Nakama backend
│   ├── src/             # TypeScript source
│   ├── build/           # Compiled JavaScript
│   ├── tests/           # Backend tests
│   ├── docker-compose.yml
│   ├── package.json
│   └── nakama.yml
├── data/                # Game data (JSON files)
├── docs/                # Documentation
├── export/              # Built binaries
│   ├── android/
│   └── ios/
├── scenes/              # Godot scenes
│   ├── enemies/
│   ├── player/
│   └── ui/
├── scripts/            # Standalone scripts
├── test/               # GDScript tests
└── project.godot       # Godot project file
```

---

## 🔍 Common Issues & Troubleshooting

### Backend Issues

**Problem: Nakama fails to start**
- Solution: Ensure Docker is running
- Solution: Check `.env` file configuration
- Solution: Verify PostgreSQL is healthy: `docker-compose ps`

**Problem: Cannot connect to backend**
- Solution: Verify Nakama is running: `curl http://localhost:7350/`
- Solution: Check firewall settings

**Problem: Tests failing**
- Solution: Ensure all dependencies are installed: `npm install`
- Solution: Check TypeScript compilation: `npm run build`

### Godot Issues

**Problem: Export templates missing**
- Solution: Download export templates in Godot Editor (Editor → Manage Export Templates)

**Problem: Cannot run project**
- Solution: Ensure a main scene is set in project.godot
- Solution: Check Godot version (requires 4.x)

---

## 📊 Code Coverage

[![codecov](https://img.shields.io/codecov/c/gh/anchapin/armored-archer/main)](https://codecov.io/gh/anchapin/armored-archer)

---

## 🤝 Contributing

Please read the [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our development workflow.

---

## 📄 License

MIT License - see repository for details.

---

**Happy developing! 🎮**
