# Armored Archer Backend

> **⚠️ MIGRATION NOTICE (2026-03-15)**: This backend has been migrated from TypeScript to Go!
> See [README_GO.md](README_GO.md) for the new Go-based documentation.
> See [CHANGELOG.md](CHANGELOG.md) for migration details.
> See [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) for the complete migration summary.

Backend server for Armored Archer game built with Nakama and PostgreSQL.

## 🚀 Quick Start (Go)

```bash
# Install Go dependencies
go mod download

# Build Go plugin
CGO_ENABLED=1 go build -buildmode=plugin -o build/server.so ./cmd/server

# Start services
docker compose up -d

# Run tests
go test ./internal/... -v
```

For complete Go documentation, see [README_GO.md](README_GO.md).

---

## Legacy TypeScript Documentation

The following documentation is for the original TypeScript implementation.

## Directory Structure

### Go Backend (Current)

```
backend/
├── cmd/
│   └── server/
│       └── main.go              # Nakama module entry point
├── internal/                     # Internal Go packages
│   ├── player/                  # Player stats & progression
│   ├── combat/                  # Combat system logic
│   ├── gear/                    # Gear generation & inventory
│   ├── matchmaking/             # PvP matchmaking & rankings
│   ├── rpg/                     # XP, levels, stat allocation
│   ├── season/                  # Seasonal content & leaderboards
│   ├── store/                   # IAP & currency management
│   ├── notifications/           # Push notifications
│   ├── observability/           # Metrics, health, monitoring
│   └── ...                      # Other modules
├── tests/                        # Integration tests
│   ├── testhelpers/             # Test helper library
│   └── ...                      # Module tests
├── build/
│   └── server.so                # Compiled Go plugin
├── go.mod                        # Go module definition
├── go.sum                        # Go dependency lockfile
├── docker-compose.yml            # Docker Compose configuration
└── nakama.yml                    # Nakama server configuration
```

### TypeScript Backend (Legacy)

## Environment Configuration

### Quick Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Edit `.env` and set your values:
```bash
# Required variables
POSTGRES_PASSWORD=your_secure_password
DATABASE_ADDRESS=postgres:your_secure_password@postgres:5432/nakama
NAKAMA_SERVER_KEY=your_server_key
SESSION_ENCRYPTION_KEY=your_token_key
REFRESH_ENCRYPTION_KEY=your_refresh_key
```

3. Start services with validation:
```bash
./start.sh
```

### Environment Variables

Required variables are documented in `.env.example`. Key variables include:

**Nakama Configuration:**
- `NAKAMA_SERVER_KEY` - Server authentication key (REQUIRED)
- `NAKAMA_SERVER_PORT` - API port (default: 7350)
- `NAKAMA_CONSOLE_PORT` - Admin console port (default: 7351)

**Database Configuration:**
- `POSTGRES_USER` - Database user (default: postgres)
- `POSTGRES_PASSWORD` - Database password (REQUIRED)
- `POSTGRES_DB` - Database name (default: nakama)
- `DATABASE_ADDRESS` - Full connection string (REQUIRED)

**Session Configuration:**
- `SESSION_ENCRYPTION_KEY` - Token encryption key (REQUIRED)
- `REFRESH_ENCRYPTION_KEY` - Refresh token encryption key (REQUIRED)

**Optional:**
- `REVENUECAT_PUBLIC_API_KEY` - RevenueCat public key
- `REVENUECAT_SECRET_API_KEY` - RevenueCat secret key
- `FIREBASE_API_KEY` - Firebase API key
- `FIREBASE_PROJECT_ID` - Firebase project ID

### Environment-Specific Configurations

The project includes environment-specific `.env` files:
- `.env.development` - Development environment
- `.env.staging` - Staging environment
- `.env.production.example` - Production template

To use a specific environment:
```bash
cp .env.staging .env
./start.sh
```

**IMPORTANT:** Never commit `.env` files to version control. They are already excluded in `.gitignore`.

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your values
```

3. Start Nakama and PostgreSQL with validation:
```bash
./start.sh
```

4. Verify Nakama is running:
- API: http://localhost:7350
- Admin Console: http://localhost:7351 (username: admin, password: password)

5. Build TypeScript modules:
```bash
npm run build
```

## Development

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run build:watch` - Build in watch mode
- `npm test` - Run tests
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Lint code
- `npm run typecheck` - Type check without building
- `./validate-env.sh` - Validate environment variables
- `./start.sh` - Start services with validation

## Code Coverage

[![codecov](https://img.shields.io/codecov/c/gh/anchapin/armored-archer/main)](https://codecov.io/gh/anchapin/armored-archer)

Coverage reports are generated using Jest and automatically uploaded to Codecov on CI. View the full coverage report on [Codecov](https://codecov.io/gh/anchapin/armored-archer).

## Nakama Configuration

The Nakama server is configured in `nakama.yml`. Environment variables are loaded from `.env` file.

**Key settings:**
- Server runs on port 7350 (configurable via `NAKAMA_SERVER_PORT`)
- Admin console on port 7351 (configurable via `NAKAMA_CONSOLE_PORT`)
- PostgreSQL connection on port 5432
- Session expiry: 2 hours
- Server key: Set via `NAKAMA_SERVER_KEY` environment variable

## Database

PostgreSQL is managed via Docker Compose. Connection string is configured via `DATABASE_ADDRESS` in `.env`:
```
DATABASE_ADDRESS=postgres:your_password@postgres:5432/nakama
```

Run migrations:
```bash
docker exec -it armored_archer_server /nakama/nakama migrate up
```

## Secrets Management

For information about rotating secrets and secure configuration, see:
- `SECRETS_ROTATION.md` - Complete secrets rotation procedure

**Security Best Practices:**
- Never commit `.env` files to version control
- Use different credentials for development, staging, and production
- Rotate secrets regularly (see SECRETS_ROTATION.md)
- Use strong, randomly generated values for all secrets
- Limit access to production secrets to authorized personnel only
