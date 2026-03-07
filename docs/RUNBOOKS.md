# Runbooks

This document provides step-by-step operational procedures for common tasks in the Armored Archer project. These runbooks are designed to help developers and operators quickly execute routine tasks and handle common issues.

## Table of Contents

- [Backend Operations](#backend-operations)
  - [Starting the Backend](#starting-the-backend)
  - [Stopping the Backend](#stopping-the-backend)
  - [Restarting Backend Services](#restarting-backend-services)
  - [Checking Backend Status](#checking-backend-status)
- [Database Operations](#database-operations)
  - [Running Migrations](#running-migrations)
  - [Creating New Migrations](#creating-new-migrations)
  - [Viewing Database Schema](#viewing-database-schema)
  - [Accessing the Database Directly](#accessing-the-database-directly)
- [Development Operations](#development-operations)
  - [Setting Up Development Environment](#setting-up-development-environment)
  - [Running Backend in Development Mode](#running-backend-in-development-mode)
  - [Running Tests](#running-tests)
  - [Building the Backend](#building-the-backend)
- [Game Export Operations](#game-export-operations)
  - [Exporting for Android](#exporting-for-android)
  - [Exporting for iOS](#exporting-for-ios)
  - [Creating a Development Build](#creating-a-development-build)
- [Monitoring and Logs](#monitoring-and-logs)
  - [Viewing Backend Logs](#viewing-backend-logs)
  - [Viewing Database Logs](#viewing-database-logs)
  - [Checking Container Status](#checking-container-status)
- [Troubleshooting](#troubleshooting)
  - [Backend Won't Start](#backend-wont-start)
  - [Database Connection Failed](#database-connection-failed)
  - [Tests Failing](#tests-failing)
  - [Export Fails](#export-fails)

---

## Backend Operations

### Starting the Backend

Start the Nakama backend with Docker Compose.

```bash
# Using Makefile
make backend-start

# Or directly with Docker Compose
cd backend
docker-compose up -d
```

**Expected Output:**
```
Starting Nakama backend...
Nakama started: http://localhost:7350
Admin Console: http://localhost:7351 (admin:password)
```

**Verification:**
- Wait 10-15 seconds for services to initialize
- Access Nakama Console at http://localhost:7351
- Login with credentials: `admin` / `password`

---

### Stopping the Backend

Stop all backend services gracefully.

```bash
# Using Makefile
make backend-stop

# Or directly with Docker Compose
cd backend
docker-compose down
```

**Options:**
- `docker-compose down` - Stops containers but preserves data
- `docker-compose down -v` - Stops and removes volumes (destroys data)
- `docker-compose down --remove-orphans` - Removes orphaned containers

---

### Restarting Backend Services

Restart all backend services.

```bash
# Restart all services
cd backend
docker-compose restart

# Restart specific service
docker-compose restart server
docker-compose restart postgres
```

**Note:** Restarting the server will disconnect all connected clients.

---

### Checking Backend Status

Check if backend services are running.

```bash
# Using Docker
docker ps

# Expected output should show:
# - armored_archer_server (Nakama)
# - armored_archer_postgres (PostgreSQL)
```

---

## Database Operations

### Running Migrations

Apply pending database migrations.

**Prerequisites:**
- Backend must be running (`make backend-start`)

```bash
# Using Makefile
make backend-migrate

# Or directly with Docker
docker exec -it armored_archer_server /nakama/nakama migrate up --database.address postgres://postgres:localdbpassword@postgres:5432/nakama
```

**Verification:**
```bash
# Check applied migrations
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT * FROM schema_migrations;"
```

---

### Creating New Migrations

Create a new database migration file.

```bash
# Using Makefile (interactive)
make backend-migrate-new

# Or manually create migration file
touch backend/data/002_new_migration_name.sql
```

**Manual Migration Template:**
```sql
--- Migration: your_migration_name
--- Created: 2024-01-01

BEGIN;

--- Add your SQL here
--- Example: CREATE TABLE IF NOT EXISTS example_table (
---     id SERIAL PRIMARY KEY,
---     name VARCHAR(255) NOT NULL
--- );

COMMIT;
```

**Naming Convention:**
- Format: `{number}_{migration_name}.sql`
- Use incremental numbers starting from existing migrations
- Use snake_case for migration names

---

### Viewing Database Schema

View current database tables and schema.

```bash
# Using Makefile
make backend-db-schema

# Or directly with Docker
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\dt'
```

**View Table Details:**
```bash
# View specific table schema
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c '\d table_name'

# List all tables with row counts
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) FROM information_schema.tables WHERE table_schema = 'public' ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;"
```

---

### Accessing the Database Directly

Connect to PostgreSQL for direct queries.

```bash
# Connect to PostgreSQL container
docker exec -it armored_archer_postgres psql -U postgres -d nakama

# Useful psql commands:
# \dt          - List all tables
# \d table     - Describe table
# \l           - List databases
# \q           - Quit

# Example queries:
SELECT * FROM users LIMIT 10;
SELECT * FROM storage WHERE collection = 'player_data';
```

---

## Development Operations

### Setting Up Development Environment

Install all dependencies and set up the development environment.

```bash
# Using Makefile
make setup

# This will:
# 1. Install backend npm dependencies
# 2. Display next steps
```

**Manual Setup:**
```bash
# Install backend dependencies
cd backend
npm install

# Verify installation
npm --version
node --version
```

---

### Running Backend in Development Mode

Start the backend with auto-reload for development.

```bash
# Using Makefile
make backend-dev

# Or directly
cd backend
npm run dev
```

**Note:** The backend will automatically reload when TypeScript files change.

---

### Running Tests

Run backend unit and integration tests.

```bash
# Run all tests
make backend-test

# Or directly
cd backend
npm test

# Run specific test file
cd backend
npm test -- --testPathPattern=test_file_name

# Run tests with coverage
cd backend
npm test -- --coverage
```

**Test Configuration:**
- Unit tests: `backend/tests/unit/`
- Integration tests: `backend/tests/integration/`
- Test results: `backend/test-results.txt`
- Coverage report: `backend/coverage/`

---

### Building the Backend

Build the TypeScript backend for production.

```bash
# Using Makefile
make backend-build

# Or directly
cd backend
npm run build
```

**Output:**
- Compiled JavaScript: `backend/build/`
- Source maps: `backend/build/*.map`

---

## Game Export Operations

### Exporting for Android

Export the Godot game for Android.

**Using Godot Editor:**
1. Open project in Godot 4.x
2. Go to **Project → Export**
3. Select **Android** preset
4. Configure signing (use `debug.keystore` for development)
5. Click **Export Project**
6. Save as `armored-archer.apk`

**Using Command Line:**
```bash
# Ensure export presets are configured
# Edit export_presets_android.cfg if needed

# Export debug build
godot --headless --export-release "Android" export/android/armored-archer.apk
```

**Verification:**
```bash
# Check APK was created
ls -lh export/android/armored-archer.apk

# Install to connected device
adb install export/android/armored-archer.apk
```

---

### Exporting for iOS

Export the Godot game for iOS (requires macOS with Xcode).

**Using Godot Editor:**
1. Open project in Godot 4.x
2. Go to **Project → Export**
3. Select **iOS** preset
4. Configure bundle identifier and signing
5. Click **Export Project**
6. Save to `export/ios/`

**Requirements:**
- macOS with Xcode installed
- Apple Developer account
- Valid provisioning profile

---

### Creating a Development Build

Create a debug build for testing.

```bash
# Android debug build
godot --headless --export-debug "Android" export/android/armored-archer-debug.apk

# Check the APK
ls -lh export/android/armored-archer-debug.apk
```

**Debug Build Features:**
- Verbose logging enabled
- Console output visible
- Development server connection
- No code obfuscation

---

## Monitoring and Logs

### Viewing Backend Logs

View Nakama server logs in real-time.

```bash
# Follow all backend logs
docker-compose logs -f server

# View recent logs
docker logs --tail 100 armored_archer_server

# View logs with timestamps
docker logs -t armored_archer_server | tail -50
```

**Log Levels:**
```bash
# View only errors
docker logs armored_archer_server 2>&1 | grep -i error

# View warnings and errors
docker logs armored_archer_server 2>&1 | grep -iE "(warn|error)"
```

---

### Viewing Database Logs

View PostgreSQL database logs.

```bash
# Follow database logs
docker-compose logs -f postgres

# View recent logs
docker logs --tail 100 armored_archer_postgres
```

---

### Checking Container Status

Check health and status of all containers.

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Check container health
docker inspect --format='{{.State.Health.Status}}' armored_archer_server

# View container resource usage
docker stats

# View specific container stats
docker stats armored_archer_server armored_archer_postgres
```

---

## Troubleshooting

### Backend Won't Start

**Symptoms:** `make backend-start` fails or containers exit immediately.

**Diagnosis:**
```bash
# Check container status
docker ps -a

# View logs for errors
docker logs armored_archer_server
docker logs armored_archer_postgres
```

**Common Causes and Solutions:**

1. **Port already in use**
   ```bash
   # Find what's using the port
   lsof -i :7350
   lsof -i :7351
   lsof -i :5432

   # Kill the process if needed
   kill <PID>
   ```

2. **Docker not running**
   ```bash
   # Start Docker
   sudo systemctl start docker

   # Or on macOS
   open -a Docker
   ```

3. **Missing environment variables**
   ```bash
   # Check .env file
   cat .env.development

   # Verify required variables
   export NAKAMA_SECRET="your_secret"
   export DATABASE_ADDRESS="postgres://..."
   ```

4. **Volume permission issues**
   ```bash
   # Remove old volumes and restart
   docker-compose down -v
   docker-compose up -d
   ```

---

### Database Connection Failed

**Symptoms:** Backend logs show "database connection refused" or "authentication failed".

**Diagnosis:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test database connectivity
docker exec -it armored_archer_postgres pg_isready -U postgres
```

**Solutions:**

1. **PostgreSQL not ready**
   ```bash
   # Wait for PostgreSQL to start
   sleep 10
   docker-compose restart postgres
   ```

2. **Wrong credentials**
   ```bash
   # Check docker-compose.yml for correct credentials
   # Default: postgres/postgres or postgres/localdbpassword
   ```

3. **Database doesn't exist**
   ```bash
   # Connect to PostgreSQL and create database
   docker exec -it armored_archer_postgres psql -U postgres -c "CREATE DATABASE nakama;"
   ```

---

### Tests Failing

**Symptoms:** `npm test` shows failing tests.

**Diagnosis:**
```bash
# Run tests with verbose output
cd backend
npm test -- --verbose

# Run specific failing test
npm test -- --testPathPattern=failing_test
```

**Common Causes:**

1. **Backend not running**
   ```bash
   make backend-start
   npm test
   ```

2. **Missing dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Database not migrated**
   ```bash
   make backend-migrate
   ```

4. **Environment variables missing**
   ```bash
   # Check test environment setup
   cat backend/.env.test
   ```

---

### Export Fails

**Symptoms:** Godot export fails with errors.

**Diagnosis:**

1. **Check Godot version**
   ```bash
   godot --version
   # Should be 4.x
   ```

2. **Verify export templates**
   ```bash
   # In Godot Editor: Editor → Manage Export Templates
   # Or via command line
   godot --headless --export-templates
   ```

3. **Check export presets**
   ```bash
   # Verify export_presets.cfg is valid
   cat export_presets.cfg
   ```

**Solutions:**

1. **Missing export templates**
   ```bash
   # Download export templates via Godot
   godot --headless --import
   ```

2. **Invalid keystore**
   ```bash
   # Use debug keystore for testing
   # Located at: debug.keystore
   ```

3. **Android SDK issues**
   ```bash
   # Verify Android SDK is installed
   echo $ANDROID_HOME
   ls $ANDROID_HOME
   ```

---

## Quick Reference

### Common Commands

| Task | Command |
|------|---------|
| Start backend | `make backend-start` |
| Stop backend | `make backend-stop` |
| Run migrations | `make backend-migrate` |
| Run tests | `make backend-test` |
| Build backend | `make backend-build` |
| View logs | `docker-compose logs -f` |
| Access database | `docker exec -it armored_archer_postgres psql -U postgres -d nakama` |

### Service URLs (Local Development)

| Service | URL | Credentials |
|---------|-----|-------------|
| Nakama Server | http://localhost:7350 | - |
| Nakama Console | http://localhost:7351 | admin:password |
| PostgreSQL | localhost:5432 | postgres:localdbpassword |

### File Locations

| File | Path |
|------|------|
| Backend source | `backend/src/` |
| Database migrations | `backend/data/*.sql` |
| Export presets | `export_presets.cfg` |
| Android APK | `export/android/` |
| Test files | `backend/tests/` |

---

## Related Documentation

- [DEBUGGING.md](../DEBUGGING.md) - Detailed debugging techniques
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Production deployment procedures
- [Makefile](../Makefile) - Available development commands
- [backend/README.md](../backend/README.md) - Backend-specific documentation
