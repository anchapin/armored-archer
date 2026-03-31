# Secrets Management

This document outlines the secrets management strategy for the Armored Archer project. Proper secrets management is critical for maintaining security, especially for a game with backend services, authentication, and in-app purchases.

## Overview

Armored Archer uses environment variables for managing sensitive configuration data. This approach:

- Keeps secrets out of version control
- Allows different configurations per environment (development, staging, production)
- Provides a standardized way to configure the application
- Works well with containerization and CI/CD pipelines

## What Are Secrets?

Secrets are sensitive values that should never be committed to version control, including:

- **API Keys**: Nakama server keys, RevenueCat keys, Firebase keys
- **Database Credentials**: PostgreSQL passwords, connection strings
- **Encryption Keys**: Session encryption keys, token encryption keys
- **Authentication Credentials**: Admin console credentials, service account keys
- **Third-Party Service Credentials**: PagerDuty, Slack, SMTP credentials

## Environment Files

### File Structure

```
armored-archer/
├── .env.example              # Template with placeholder values
├── .env                      # Local development secrets (gitignored)
├── .env.local                # Local overrides (gitignored)
├── .env.staging             # Staging secrets (gitignored)
├── .env.production           # Production secrets (gitignored)
├── backend/
│   ├── .env.example          # Backend-specific template
│   ├── .env                  # Backend local secrets
│   ├── .env.development      # Backend development
│   ├── .env.staging          # Backend staging
│   └── .env.production.example # Production template
```

### .env.example Files

The `.env.example` files serve as templates showing all available configuration options:

- **Root `.env.example`**: Client-side configuration
- **`backend/.env.example`**: Full backend configuration with all options

**Important**: Never put actual secrets in `.env.example` files. Use placeholder values like:
```
NAKAMA_SERVER_KEY=your_nakama_server_key_here
POSTGRES_PASSWORD=changeme
```

### Creating Your Local Environment

1. Copy the example file:
   ```bash
   # For backend
   cp backend/.env.example backend/.env
   
   # For root (if needed)
   cp .env.example .env
   ```

2. Edit the `.env` file with your actual values:
   ```bash
   # Generate secure random values
   openssl rand -base64 32  # For encryption keys
   
   # Edit your .env file
   nano backend/.env
   ```

3. Verify the file is gitignored:
   ```bash
   git check-ignore backend/.env  # Should return the file path
   ```

## Git Ignore Configuration

The project uses `.gitignore` to prevent accidentally committing secrets:

### Root `.gitignore`
```
# Environment and secrets
.env
.env.local
.env.*.local
```

### Backend `.gitignore`
```
.env
.env.local
.env.production
```

**Never remove these entries!** If you accidentally commit a secret, follow the incident response in [SECRETS_ROTATION.md](SECRETS_ROTATION.md).

## Configuration Loading

### Backend (Node.js)

The backend uses `dotenv` to load environment variables:

```typescript
import dotenv from 'dotenv';
import path from 'path';

// Load environment-specific config
const envFile = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, `.env.${envFile}`) });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
```

Environment precedence (highest to lowest):
1. `.env.production` / `.env.staging` / `.env.development`
2. `.env.local`
3. `.env`
4. `.env.example` (defaults)

### Validating Environment Variables

The backend includes a validation script to ensure all required secrets are set:

```bash
cd backend
./validate-env.sh
```

This script checks for:
- Required variables are present
- Secret values meet minimum length requirements
- No obvious security issues (e.g., default passwords)

## Best Practices

### Generating Secure Secrets

Use cryptographically secure random generators:

```bash
# Generate 32-character key (minimum recommended)
openssl rand -base64 32

# Or use Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Secret Rotation

Regularly rotate secrets to limit exposure if credentials are compromised. See [SECRETS_ROTATION.md](SECRETS_ROTATION.md) for detailed procedures.

### Environment-Specific Values

Use different values for each environment:

| Secret | Development | Staging | Production |
|--------|-------------|---------|------------|
| `NODE_ENV` | development | staging | production |
| `NAKAMA_SERVER_KEY` | dev-key | staging-key | prod-key |
| `LOG_LEVEL` | DEBUG | WARN | ERROR |
| `RATE_LIMIT_ENABLED` | false | true | true |

### CI/CD Integration

When configuring CI/CD pipelines:

1. **Never hardcode secrets** in workflow files
2. **Use secrets management** provided by your CI/CD platform (GitHub Secrets, GitLab CI Variables, etc.)
3. **Pass secrets as environment variables** to builds:
   ```yaml
   # Example GitHub Actions
   env:
     NAKAMA_SERVER_KEY: ${{ secrets.NAKAMA_SERVER_KEY }}
   ```

### Production Secrets

For production deployments, consider using a secrets management service:

- **AWS Secrets Manager**: https://aws.amazon.com/secrets-manager/
- **HashiCorp Vault**: https://www.vaultproject.io/
- **Azure Key Vault**: https://azure.microsoft.com/services/key-vault/
- **Google Cloud Secret Manager**: https://cloud.google.com/secret-manager

These services provide:
- Encrypted storage
- Access auditing
- Automatic rotation
- Fine-grained access control

## Development Workflow

### New Team Member Setup

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Request secrets from team lead or use default development values
4. Run the application and verify connectivity

### Adding New Secrets

When adding new configuration options:

1. **Add to `.env.example`** with a placeholder value:
   ```bash
   NEW_SECRET_KEY=your_new_secret_key_here
   ```

2. **Add to validation** in `backend/validate-env.sh` if required

3. **Document** the new variable in relevant documentation

4. **Update team** about the new requirement

## Security Checklist

Before deploying to any environment:

- [ ] All `.env` files are in `.gitignore`
- [ ] `.env.example` contains no real secrets
- [ ] Default passwords have been changed
- [ ] Encryption keys are at least 32 characters
- [ ] Production uses unique secrets (not development values)
- [ ] Secrets have been validated with `validate-env.sh`
- [ ] Team knows how to rotate secrets if compromised

## Related Documentation

- [SECRETS_ROTATION.md](SECRETS_ROTATION.md) - Procedures for rotating secrets
- [ENVIRONMENTS.md](backend/ENVIRONMENTS.md) - Environment-specific configuration
- [LOCAL_SERVICES_SETUP.md](docs/LOCAL_SERVICES_SETUP.md) - Local development setup
- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) - Firebase configuration
- [REVENUECAT_SETUP.md](REVENUECAT_SETUP.md) - RevenueCat configuration
- [SECURITY.md](SECURITY.md) - Security considerations

## Support

For questions about secrets management:
- Check this document and related documentation
- Review the issue tracker: https://github.com/anchapin/armored-archer/issues
- Contact the development team
