# Environment Configuration

This document explains how to configure and manage different environments for the Armored Archer backend.

## Overview

The backend uses environment-specific configuration files to manage settings across different deployment environments:
- **Development**: Local development setup
- **Staging**: Pre-production testing environment
- **Production**: Live production environment

## Environment Files

### File Structure

```
backend/
├── .env                    # Local overrides (never committed)
├── .env.development        # Development environment (committed)
├── .env.staging           # Staging environment (committed)
├── .env.production.example # Production template (committed)
└── .env.production        # Production secrets (never committed)
```

### Using Environment Files

1. **Set the NODE_ENV** environment variable to select which environment to use:
   ```bash
   export NODE_ENV=development  # or staging, production
   ```

2. **Configuration loading** happens automatically via `src/config.ts`:
   - Loads `.env.{NODE_ENV}` first (e.g., `.env.development`)
   - Falls back to `.env` if environment-specific file doesn't exist
   - Finally loads `.env.{NODE_ENV}.local` for local overrides

3. **In your code**, the config is automatically loaded at import time via `src/config.ts`

## Environment Variables

### Required Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Environment name | `development` | `production` |
| `DB_HOST` | Database host | `postgres` | `db.example.com` |
| `DB_PORT` | Database port | `5432` | `5432` |
| `DB_NAME` | Database name | `nakama` | `nakama` |
| `DB_USER` | Database user | `postgres` | `nakama_user` |
| `DB_PASSWORD` | Database password | `localdbpassword` | `secure_password` |

### Nakama Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NAKAMA_CONSOLE_PORT` | Console API port | `7351` |
| `NAKAMA_CONSOLE_USERNAME` | Console username | `admin` |
| `NAKAMA_CONSOLE_PASSWORD` | Console password | `password` |
| `NAKAMA_SOCKET_PORT` | WebSocket port | `7350` |
| `NAKAMA_SERVER_KEY` | Server key for auth | `defaultkey` |

### Security Configuration

| Variable | Description | Development | Production |
|----------|-------------|-------------|------------|
| `REFRESH_ENCRYPTION_KEY` | Token refresh encryption | `default-refresh-key` | Must be unique |
| `TOKEN_ENCRYPTION_KEY` | Token encryption | `default-token-key` | Must be unique |
| `SESSION_ENCRYPTION_KEY` | Session encryption | `default-token-key` | Must be unique |

### Logging Configuration

| Variable | Description | Development | Production |
|----------|-------------|-------------|------------|
| `LOG_LEVEL` | Logging verbosity | `DEBUG` | `WARN` |
| `LOG_FORMAT` | Log format | `json` | `json` |
| `LOG_OUTPUT` | Log destination | `stdout` | `stdout` |

### Match Configuration

| Variable | Description | Development | Production |
|----------|-------------|-------------|------------|
| `ALLOW_HOST_LOOPBACK` | Allow local connections | `true` | `false` |

### Metrics Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `METRICS_NAMESPACE` | Metrics namespace | `nakama` |
| `METRICS_PREFIX` | Metrics prefix | `nakama` |
| `PROMETHEUS_PORT` | Prometheus port | `9100` |

### RevenueCat Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `REVENUECAT_PUBLIC_KEY` | RevenueCat public key | Yes |

## Setup Instructions

### Development

The development environment is pre-configured and ready to use:

```bash
cd backend
npm install
NODE_ENV=development docker-compose up -d
```

No additional setup required.

### Staging

1. Copy the staging template and add your secrets:
   ```bash
   cd backend
   cp .env.staging .env.staging.local
   ```

2. Edit `.env.staging.local` with your staging environment secrets.

3. Start with staging environment:
   ```bash
   NODE_ENV=staging docker-compose up -d
   ```

### Production

1. Copy the production example and configure it:
   ```bash
   cd backend
   cp .env.production.example .env.production
   ```

2. Edit `.env.production` with your production secrets:
   - **Important**: Generate strong, unique passwords and keys
   - Use different database credentials than development
   - Generate random encryption keys (e.g., using `openssl rand -base64 32`)

3. The `.env.production` file is gitignored and will never be committed.

4. Deploy to production:
   ```bash
   NODE_ENV=production docker-compose up -d
   ```

## Security Best Practices

1. **Never commit** `.env.production` or `.env.local` files to version control
2. **Use strong, unique passwords** for production databases
3. **Generate random encryption keys** for production (at least 32 characters)
4. **Rotate keys regularly** in production environments
5. **Use environment variables** for secrets in CI/CD pipelines
6. **Keep `ALLOW_HOST_LOOPBACK=false`** in production

## Docker Integration

When using Docker Compose, you can override environment variables:

```bash
NODE_ENV=production docker-compose up -d
```

Or create a `.env` file for Docker-specific overrides:

```env
POSTGRES_PASSWORD=${DB_PASSWORD}
```

## Troubleshooting

### Configuration not loading

Ensure `NODE_ENV` is set correctly:
```bash
echo $NODE_ENV
```

### Database connection issues

Verify environment variables are set by checking the logs:
```bash
docker logs armored_archer_server
```

### Secret keys in production

If you see default keys being used in production, ensure `.env.production` is properly configured and the file exists in the deployment environment.
