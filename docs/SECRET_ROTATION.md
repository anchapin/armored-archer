# Secret Rotation Guide

## Required Actions After .env Exposure

The following secrets were previously tracked in git via `backend/.env.alpha`:

| Secret | Environment Variable | Action Required |
|--------|---------------------|-----------------|
| Nakama Server Key | `NAKAMA_SERVER_KEY` | Generate new key in Nakama console |
| Nakama Console Password | `NAKAMA_CONSOLE_PASSWORD` | Reset in Nakama admin config |
| PostgreSQL Password | `POSTGRES_PASSWORD`, `DB_PASSWORD` | `ALTER USER postgres PASSWORD 'new_password'` |
| Session Encryption Key | `SESSION_ENCRYPTION_KEY` | Generate new 32+ char random string |
| Refresh Encryption Key | `REFRESH_ENCRYPTION_KEY` | Generate new 32+ char random string |
| Token Encryption Key | `TOKEN_ENCRYPTION_KEY` | Generate new 32+ char random string |

## Step-by-Step Rotation

### 1. Generate New Keys

```bash
# Generate new encryption keys
openssl rand -base64 32  # For SESSION_ENCRYPTION_KEY
openssl rand -base64 32  # For REFRESH_ENCRYPTION_KEY
openssl rand -base64 32  # For TOKEN_ENCRYPTION_KEY

# Generate new Nakama server key
openssl rand -hex 20

# Generate new console password
openssl rand -base64 24

# Generate new Postgres password
openssl rand -base64 24
```

### 2. Update PostgreSQL

```bash
docker exec -it armored_archer_postgres psql -U postgres -c \
  "ALTER USER postgres PASSWORD '<new_password>';"
```

### 3. Update Nakama Configuration

Update `backend/.env.alpha` with new values (file is now gitignored).

### 4. Clear Git History (BFG)

```bash
# Install BFG Repo Cleaner
# Download from https://rtyley.github.io/bfg-repo-cleaner/

# Remove .env files from entire git history
java -jar bfg.jar --delete-files '.env.alpha' .git
java -jar bfg.jar --delete-files '.env.beta' .git
java -jar bfg.jar --delete-files '.env.development' .git
java -jar bfg.jar --delete-files '.env.staging' .git

# Clean up and force push
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

### 5. Verify

```bash
# Confirm secrets are no longer in git history
git log --all -p -- backend/.env.alpha | grep -i "nakama"
# Should return no results
```

## Prevention

- All `.env.*` files (except `.env.example` variants) are now in `.gitignore`
- Use `.env.example` files as templates with placeholder values only
- Never commit actual secrets — use environment variables or a secrets manager
