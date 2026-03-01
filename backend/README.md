# Armored Archer Backend

Backend server for Armored Archer game built with Nakama and PostgreSQL.

## Directory Structure

```
backend/
├── server/          # Nakama server configuration
├── modules/         # Custom Nakama modules
├── data/            # Server data and migrations
├── src/             # TypeScript source files
├── build/           # Compiled JavaScript output
├── docker-compose.yml  # Docker Compose configuration
├── nakama.yml       # Nakama server configuration
├── package.json     # Node.js dependencies
├── tsconfig.json    # TypeScript configuration
├── .env.example     # Environment variables template
├── .env.development # Development environment variables
├── .env.staging     # Staging environment variables
├── start.sh         # Startup script with validation
└── validate-env.sh  # Environment variable validation
```

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
- `npm run lint` - Lint code
- `npm run typecheck` - Type check without building
- `./validate-env.sh` - Validate environment variables
- `./start.sh` - Start services with validation

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
