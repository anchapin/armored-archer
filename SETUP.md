# Local Development Setup Guide

This guide provides step-by-step instructions for setting up a local development environment for Armored Archer. It covers both the Godot client and Nakama backend.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Clone the Repository](#clone-the-repository)
- [Backend Setup](#backend-setup)
- [Godot Client Setup](#godot-client-setup)
- [Running the Application](#running-the-application)
- [Running Tests](#running-tests)
- [Common Issues and Solutions](#common-issues-and-solutions)
- [Next Steps](#next-steps)

---

## Prerequisites

Before starting, ensure your machine meets the following requirements:

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Git** | Latest | Version control |
| **Docker** | Latest | Containerized services (PostgreSQL, Nakama) |
| **Docker Compose** | Latest | Orchestrate containers |
| **Godot** | 4.6+ | Game engine editor |
| **Node.js** | 18+ | Backend runtime |
| **npm** | Latest | Node.js package manager |

### Platform-Specific Notes

- **Windows**: Use WSL2 for Docker, or use Docker Desktop with WSL2 backend
- **macOS**: Docker Desktop works natively
- **Linux**: Install Docker Engine and Docker Compose via your package manager

### Verifying Installations

```bash
# Check all prerequisites
docker --version          # Should show Docker version
docker compose version    # Should show Docker Compose version  
node --version            # Should show 18.x or higher
npm --version             # Should show latest
godot --version           # Should show 4.6 or higher (if installed)
```

> **Note**: Godot is typically installed via download from the [Godot website](https://godotengine.org/download). The headless version is recommended for CI, but the standard version is needed for the editor.

---

## Clone the Repository

```bash
# Clone the repository
git clone https://github.com/anchapin/armored-archer.git
cd armored-archer
```

---

## Backend Setup

The backend runs on Nakama (Heroic Labs) game server with PostgreSQL. Both run in Docker containers.

### 1. Navigate to Backend Directory

```bash
cd backend
```

### 2. Install Node.js Dependencies

```bash
npm install
```

This installs all required packages defined in `package.json`. The project uses `package-lock.json` for reproducible builds.

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your preferred values. The minimum required changes are:

```bash
# Required: Set a secure password
POSTGRES_PASSWORD=your_secure_password

# Required: Update the database address with your password
DATABASE_ADDRESS=postgres:your_secure_password@postgres:5432/nakama

# Required: Set a unique server key
NAKAMA_SERVER_KEY=your_unique_server_key

# Required: Generate secure random keys (32+ characters)
SESSION_ENCRYPTION_KEY=your_random_session_key
REFRESH_ENCRYPTION_KEY=your_random_refresh_key
```

> **Security Note**: Never commit `.env` files to version control. They are already excluded in `.gitignore`.

### 4. Start Local Services

Use the convenience script to start Nakama and PostgreSQL:

```bash
# Option A: Using the helper script (recommended)
../scripts/local_services.sh start

# Option B: Using Docker Compose directly
docker compose up -d
```

The services will start with:
- **Nakama API**: http://localhost:7350
- **Nakama Console**: http://localhost:7351 (default credentials: admin / password)
- **PostgreSQL**: localhost:5432

### 5. Verify Services are Running

```bash
# Check container status
docker ps

# Or use the health check script
../scripts/local_services.sh health
```

You should see all containers in "healthy" state.

### 6. Build TypeScript Modules

The Nakama server needs the compiled TypeScript code:

```bash
npm run build
```

For development with auto-rebuild:

```bash
npm run build:watch
```

---

## Godot Client Setup

### 1. Open in Godot Editor

```bash
# Launch Godot and open the project
godot .
```

Or open Godot manually and browse to the project directory.

### 2. Import the Project

When Godot opens, it will automatically import the project. Wait for the import to complete.

### 3. Configure Project (First Time)

The project is pre-configured with sensible defaults. Key settings:

- **Renderer**: Mobile (configured in project.godot)
- **Main Scene**: `res://scenes/ui/login_screen.tscn`

---

## Running the Application

### Running the Backend

The backend must be running before the client can connect:

```bash
# Start services (if not already running)
cd backend
docker compose up -d

# Verify Nakama is responding
curl http://localhost:7350/
```

### Running the Godot Client

1. Open the project in Godot Editor
2. Press **F5** to run the project
3. The game will start and attempt to connect to the local Nakama server

### Alternative: Using the Local Services Script

For convenience, use the management script:

```bash
# Start all services
../scripts/local_services.sh start

# View logs
../scripts/local_services.sh logs

# Stop services
../scripts/local_services.sh stop

# Restart services
../scripts/local_services.sh restart

# Clean up (removes containers and data)
../scripts/local_services.sh clean
```

---

## Running Tests

### Backend Tests (TypeScript/Jest)

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run integration tests only
npm run test:integration

# Run tests in CI mode (for continuous integration)
npm run test:ci
```

### GDScript Tests (Godot)

1. Open the project in Godot Editor
2. Navigate to `res://test/run_all_tests.gd`
3. Press **Ctrl+F5** to run the test scene

Or use the Godot command line:

```bash
godot --path . --script test/run_all_tests.gd
```

### Linting and Type Checking

```bash
cd backend

# Lint TypeScript code
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Type check without building
npm run typecheck

# Check code formatting
npm run format:check
```

---

## Common Issues and Solutions

### Docker Issues

#### "Cannot connect to Docker daemon"

```bash
# Start Docker daemon
sudo systemctl start docker    # Linux
# Or start Docker Desktop      # macOS/Windows
```

#### "Port already in use"

Another service is using port 7350, 7351, or 5432:

```bash
# Find what's using the port
lsof -i :7350    # Linux
netstat -ano | findstr :7350    # Windows
```

Stop the conflicting service or modify the port in `docker-compose.yml`.

#### "Database connection refused"

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View PostgreSQL logs
docker logs armored_archer_db

# Restart services
docker compose restart postgres
```

### Godot Issues

#### "Failed to load project"

Ensure you're using Godot 4.6+. Check the version:

```bash
godot --version
```

#### "Cannot connect to Nakama server"

1. Verify Nakama is running: `curl http://localhost:7350/`
2. Check the server key matches in both client and server config
3. Check NetworkManager.gd for correct server address (default: `127.0.0.1:7350`)

#### "Missing export templates"

When exporting for a platform, Godot may prompt to download export templates. Go to **Editor → Manage Export Templates** to download them.

### Node.js Issues

#### "Module not found" errors

```bash
# Reinstall dependencies
cd backend
rm -rf node_modules
npm install
```

#### "Permission denied" on npm install

```bash
# Fix npm permissions
npm config set prefix ~/.npm
# Or use a Node version manager like nvm
```

### Database Issues

#### "Migration failed"

```bash
# Run migrations manually
docker exec -it armored_archer_server /nakama/nakama migrate up

# View migration status
docker exec -it armored_archer_server /nakama/nakama migrate up --dry-run
```

#### "Reset database"

```bash
# WARNING: This deletes all data
docker compose down -v    # Remove volumes
docker compose up -d      # Recreate containers (migrations run automatically)
```

---

## Next Steps

Now that your environment is set up:

1. **Read the Debugging Guide**: [DEBUGGING.md](DEBUGGING.md) - Learn how to debug both client and server
2. **Understand the Architecture**: [AGENTS.md](AGENTS.md) - Project structure and coding conventions
3. **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md) - Development workflow and code style
4. **Explore the Backend**: [backend/README.md](backend/README.md) - Detailed backend documentation

### Useful Commands Reference

```bash
# Backend
cd backend
npm run dev              # Start development server with auto-reload
npm run build            # Build TypeScript
npm test                 # Run tests

# Services
../scripts/local_services.sh start   # Start Nakama + PostgreSQL
../scripts/local_services.sh logs    # View logs
../scripts/local_services.sh health  # Check health
../scripts/local_services.sh clean   # Remove everything

# Godot
godot .                  # Open project in editor
godot --headless --script test/run_all_tests.gd  # Run tests headless
```

---

## Getting Help

- **Issues**: Open a GitHub issue for bugs or feature requests
- **Documentation**: Check the `docs/` directory for detailed guides
- **Debugging**: See [DEBUGGING.md](DEBUGGING.md) for troubleshooting tips
