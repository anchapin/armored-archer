# Armored Archer Backend

Backend server for Armored Archer game built with Nakama (TypeScript) and PostgreSQL.

**Current Status**: TypeScript is the authoritative backend runtime.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start services
docker compose up -d

# Run tests
npm test
```

---

## Directory Structure

```
backend/
├── src/                          # TypeScript source code
│   ├── modules/                   # Nakama RPC handlers
│   ├── utils/                     # Utility functions
│   ├── config/                    # Configuration
│   └── types/                    # TypeScript type definitions
├── data/                         # Nakama data & migrations
├── scripts/                      # Build & utility scripts
├── build/                        # Compiled JavaScript output
├── node_modules/                 # npm dependencies
├── package.json                  # npm configuration
├── tsconfig.json                 # TypeScript configuration
├── webpack.nakama.config.js      # Webpack bundle config
├── docker-compose.yml             # Docker Compose configuration
└── nakama.yml                   # Nakama server configuration
```

---

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

   **Recommended (issue #907):** for a true cold-start, prefer the
   repo-root helper which pre-pulls images, waits for postgres + nakama
   healthchecks, and prints a pass/fail assertion:
   ```bash
   # from repo root
   ./scripts/cold-start.sh            # alias of `make services-start`
   ./scripts/assert-cold-start.sh     # re-assert all-green any time
   ```

4. Verify Nakama is running:
- API: http://localhost:7350
- Admin Console: http://localhost:7351 (username: admin, password: password)

5. Build TypeScript modules:
```bash
npm run build
```

### Cold-start caveats (issue #907)

The `cold-start.sh` / `assert-cold-start.sh` pair reaches all-green from a
truly cold state (no containers, no volumes, no cached images) with zero
manual steps — as long as a real `backend/.env` is present. Caveats:

- **`backend/.env` must exist before invoking `cold-start.sh` in a worktree.**
  Auto-creating it from `.env.example` would replace the parent's healthy
  credentials (the data volume keeps the real password). See the script's
  git-worktree guard. From a fresh clone run `cp .env.example .env` first.
- **Game schema migrations are NOT applied by `cold-start.sh`.** Issue #891
  owns the "apply game SQL to local volume" task (the 16 core Nakama tables
  exist, but `player_stats`, `catalog`, `inventory`, `loadout`, … are not
  present until that lands). Until then, integration tests that touch game
  tables will fail with "relation does not exist". Run
  `npm run test:integration` to exercise the migration path.
- **Destructive-restart path:** `make services-restart-destructive` drops
  the named `data` volume and re-runs cold-start. Use this to verify
  self-healing without manually editing compose files.

## Build Process

The TypeScript backend uses a multi-stage build process to ensure Nakama runtime compatibility:

### Build Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Bundle for Nakama runtime (ES5 transpilation)
npm run bundle:nakama

# Validate bundle for ES5 compatibility
npm run bundle:validate

# Full build pipeline (build + bundle + validate)
npm run build:full
```

### Build Pipeline

1. **TypeScript Compilation** (`npm run build`)
   - Compiles TypeScript to ES6 JavaScript using `tsc`
   - Output: `build/` directory

2. **ES5 Transpilation** (`npm run bundle:nakama`)
   - Uses Babel to transpile ES6+ to ES5 for Nakama's Duktape/QuickJS runtime
   - Bundles code with webpack for optimal size
   - Output: `data/modules/index.js` — a **gitignored build artifact** (untracked since issue #996); fresh checkouts must run `npm run build:full` before starting services (`scripts/cold-start.sh` and `start.sh` do this automatically)

3. **Bundle Validation** (`npm run bundle:validate`)
   - Validates bundle doesn't contain ES6+ syntax
   - Checks for: `const`, `let`, `class`, `async`, `await`, arrow functions, template literals
   - Ensures Nakama runtime compatibility

### Build Configuration

**Babel** (`babel.config.js`):
- Targets ES5.1 for Nakama compatibility
- Uses loose mode for smaller bundle size
- Inlines helper functions (no external @babel/runtime dependency)

**Webpack** (`webpack.nakama.config.js`):
- Bundles for Node.js runtime
- Disables code splitting and chunking
- Provides fallbacks for Node.js built-in modules
- Uses babel-loader for on-the-fly transpilation

### Bundle Size

Current bundle size: ~9.5 MB (ES5 transpiled)

To analyze bundle composition:
```bash
npm run bundle:analyze
```

To check bundle size against limits:
```bash
npm run bundle:check
```

### Troubleshooting

**Build fails with TypeScript errors:**
```bash
# Check for type errors without building
npm run typecheck
```

**Bundle validation fails:**
- Check for ES6+ syntax in source code
- Ensure babel-loader is configured correctly
- Verify webpack config has proper fallbacks

**Large bundle size:**
- Run `npm run depcheck` to find unused dependencies
- Check for accidentally bundled Node.js modules
- Consider lazy-loading for optional features

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

---

## Deprecated: Go Backend

A Go backend implementation exists in `internal/` and `cmd/` directories but is **NOT actively used**.

**Status**: The Go backend is disabled in `nakama.yml` due to incompatible Go version issues.

**Reason for deprecation**:
- TypeScript backend is fully functional and actively maintained
- Go backend integration has compatibility issues
- The migration was never completed (Phases 14-15 pending)
- All active development targets TypeScript

**To remove Go backend** (optional, if you want to reclaim space):
```bash
# Remove Go source files (after ensuring TypeScript works for your needs)
rm -rf backend/internal backend/cmd backend/go.mod backend/go.sum backend/build-go.sh
```
