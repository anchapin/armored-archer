# Secrets Management

This document outlines the secrets management strategy for Armored Archer, covering how secrets are stored, accessed, rotated, and protected throughout the development and deployment lifecycle.

## Overview

Armored Archer uses a multi-layered approach to secrets management:

1. **Environment Variables** - Primary method for configuration
2. **GitHub Secrets** - Used in CI/CD pipelines
3. **Nakama Configuration** - Server-side secrets
4. **Client-Side Configuration** - Non-sensitive settings only

## Secrets Categories

### Server-Side Secrets

These secrets are used by the backend and never exposed to clients:

| Secret | Description | Example |
|--------|-------------|---------|
| `NAKAMA_SERVER_KEY` | Nakama server authentication key | `base64-encoded-random-string` |
| `SESSION_ENCRYPTION_KEY` | JWT token encryption key | `base64-encoded-32-char-string` |
| `REFRESH_ENCRYPTION_KEY` | Refresh token encryption key | `base64-encoded-32-char-string` |
| `POSTGRES_PASSWORD` | Database password | `strong-random-password` |
| `REVENUECAT_SECRET_API_KEY` | RevenueCat server-side API key | `sk_live_...` |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON | `{...}` |

### Client-Side Configuration

These are non-sensitive configuration values that can be embedded in the client:

| Variable | Description | Example |
|----------|-------------|---------|
| `NAKAMA_SERVER_URL` | Server URL | `https://api.armoredarcher.com` |
| `NAKAMA_SERVER_PORT` | Server port | `7350` |
| `REVENUECAT_PUBLIC_API_KEY` | RevenueCat public key | `pk_live_...` |
| `FIREBASE_API_KEY` | Firebase API key | `AIza...` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `armored-archer-prod` |

## Environment Files

### File Structure

```
armored-archer/
├── .env                      # Local development (gitignored)
├── .env.development          # Development overrides (gitignored)
├── .env.staging              # Staging environment (gitignored)
├── .env.production           # Production environment (gitignored)
├── .env.example              # Template for all variables
└── backend/
    ├── .env                  # Backend-specific (gitignored)
    └── .env.example          # Backend template
```

### Loading Precedence

Environment variables are loaded in the following order (later values override earlier):

1. `.env` (base defaults)
2. Environment-specific file (`.env.development`, `.env.staging`, etc.)
3. System environment variables
4. CI/CD secrets (GitHub Secrets)

### Required Variables

All environments must define:

```bash
# Required for all environments
NAKAMA_SERVER_URL=127.0.0.1
NAKAMA_SERVER_PORT=7350
NAKAMA_SERVER_KEY=changeme

# Required for backend
SESSION_ENCRYPTION_KEY=changeme
REFRESH_ENCRYPTION_KEY=changeme

# Required for database
POSTGRES_PASSWORD=changeme
DATABASE_ADDRESS=postgres:changeme@postgres:5432/nakama
```

## Development Setup

### Initial Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   ```

2. Generate secure defaults:
   ```bash
   # Generate Nakama server key
   openssl rand -base64 32

   # Generate session encryption keys
   openssl rand -base64 32
   openssl rand -base64 32
   ```

3. Update `.env` with generated values

### Validation

The backend includes a validation script:

```bash
cd backend
./validate-env.sh
```

This checks for:
- Required variables are set
- No obvious defaults in production
- Proper URL formats
- Database connection strings are valid

## CI/CD Secrets Management

### GitHub Secrets

The following secrets are configured in GitHub repository settings:

| Secret | Used By | Description |
|--------|---------|-------------|
| `NAKAMA_SERVER_KEY` | CD Workflow | Production server key |
| `POSTGRES_PASSWORD` | CD Workflow | Production database password |
| `FIREBASE_SERVICE_ACCOUNT` | CD Workflow | Firebase credentials JSON |
| `REVENUECAT_SECRET_API_KEY` | CD Workflow | RevenueCat API key |
| `DOCKER_USERNAME` | CD Workflow | Docker registry credentials |
| `DOCKER_PASSWORD` | CD Workflow | Docker registry credentials |

### Adding New Secrets

1. **Generate the secret:**
   ```bash
   openssl rand -base64 32
   ```

2. **Add to GitHub:**
   - Navigate to: Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SECRET_NAME`
   - Value: `<generated-value>`

3. **Add to `.env.example`:**
   - Add the variable name with placeholder
   - Document in this file

4. **Update workflows:**
   - Add the secret to relevant workflow files
   - Reference as `${{ secrets.SECRET_NAME }}`

### Workflow Usage

```yaml
- name: Deploy to production
  env:
    NAKAMA_SERVER_KEY: ${{ secrets.NAKAMA_SERVER_KEY }}
    POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
  run: |
    cd backend
    echo "NAKAMA_SERVER_KEY=$NAKAMA_SERVER_KEY" >> .env
    docker-compose up -d
```

## Production Best Practices

### Secrets Separation

Never use the same secrets across environments:

- **Development:** Isolated test credentials
- **Staging:** Staging-specific keys (not production)
- **Production:** Unique, production-grade secrets

### Secret Generation

All production secrets should be:

- **Length:** Minimum 32 characters
- **Entropy:** Use cryptographic random generation
- **Uniqueness:** No reuse across services or environments

```bash
# Generate secure secrets
openssl rand -base64 32
```

### Access Control

Limit secret access:

- Only necessary team members can view production secrets
- Use GitHub's fine-grained permissions
- Rotate secrets regularly (see `SECRETS_ROTATION.md`)

### Monitoring

Monitor for secret exposure:

- GitHub secret scanning is enabled
- Review alerts in Security tab
- Enable push protection to prevent leaks

## Client-Side Security

### What NOT to Include in Client

Never expose these in client-side code:

- Server keys (`NAKAMA_SERVER_KEY`)
- Database credentials
- API secret keys
- Encryption keys
- Firebase service account credentials

### Secure Configuration Pattern

Use environment-based configuration in the Godot client:

```gdscript
# NetworkManager.gd
extends Node

@export var server_url: String = "127.0.0.1"
@export var server_port: int = 7350
# Server key loaded from external config or environment
var server_key: String = ""

func _ready():
    load_configuration()

func load_configuration():
    # Load from external config file (not committed)
    var config = ConfigFile.new()
    var err = config.load("res://config.ini")
    if err == OK:
        server_key = config.get_value("network", "server_key", "")
```

### Build-Time Configuration

For production builds, use build configuration:

```gdscript
# Build with custom configuration
# export_presets.cfg
[preset.0]

[preset.0.options]
custom_template/release=""
custom_template/debug=""
```

## Nakama Configuration

### Server Key Configuration

The Nakama server key is configured in `nakama.yml`:

```yaml
socket:
  server_key: "${NAKAMA_SERVER_KEY}"
```

And loaded from environment:

```bash
# In docker-compose.yml
environment:
  - NAKAMA_SERVER_KEY=${NAKAMA_SERVER_KEY}
```

### Session Encryption

Session tokens are encrypted using:

```yaml
session:
  token_encryption_key: "${SESSION_ENCRYPTION_KEY}"
  refresh_encryption_key: "${REFRESH_ENCRYPTION_KEY}"
```

## Database Secrets

### PostgreSQL Configuration

Database credentials are managed through environment:

```bash
# .env
POSTGRES_USER=nakama
POSTGRES_PASSWORD=your_secure_password
DATABASE_ADDRESS=postgres:your_secure_password@postgres:5432/nakama
```

### Docker Secrets

In production Docker deployments, use Docker secrets:

```yaml
# docker-compose.yml
services:
  nakama:
    secrets:
      - postgres_password
    environment:
      - DATABASE_ADDRESS=postgres:@postgres:5432/nakama

secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt
```

## Third-Party Service Keys

### RevenueCat

```bash
# Client-side (safe to expose)
REVENUECAT_PUBLIC_API_KEY=pk_live_...

# Server-side (secret)
REVENUECAT_SECRET_API_KEY=sk_live_...
```

### Firebase

```bash
# Non-sensitive (can be in client)
FIREBASE_API_KEY=AIza...
FIREBASE_PROJECT_ID=armored-archer-prod

# Sensitive (server-side only)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

## Emergency Procedures

### Suspected Secret Exposure

If you suspect a secret has been exposed:

1. **Immediately rotate** the affected secret
2. **Review audit logs** for unauthorized access
3. **Check GitHub alerts** for secret scanning matches
4. **Notify team** of the potential breach
5. **Document** the incident

See `SECRETS_ROTATION.md` for detailed rotation procedures.

### Lost Secrets

If production secrets are lost:

1. Generate new secrets
2. Update GitHub Secrets
3. Update running services
4. Verify all systems functional

## Related Documentation

- [SECRETS_ROTATION.md](./SECRETS_ROTATION.md) - Rotation procedures
- [SECURITY.md](./SECURITY.md) - Security considerations
- [ENVIRONMENTS.md](./backend/ENVIRONMENTS.md) - Environment-specific setup
- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) - Firebase configuration
- [DEPENDENCY_MANAGEMENT.md](./DEPENDENCY_MANAGEMENT.md) - Dependency security
