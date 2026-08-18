# Secrets Rotation Procedure

> **Supersedes:** `docs/SECRET_ROTATION.md` ("Secret Rotation Guide", 2026-04-01), now a pointer stub — consolidated per issue #1085.
>
> **Last updated:** 2026-08-18

This document outlines the procedures for rotating secrets and sensitive configuration values in Armored Archer. It is the single canonical rotation procedure, including the required actions after a `backend/.env.*` exposure (issues #1032 / #1054).

## Overview

Regular secret rotation is a security best practice that limits the exposure window if credentials are compromised. This document covers rotation procedures for:

- Nakama server keys and console credentials
- Database passwords
- RevenueCat API keys
- Firebase configuration
- Session / token encryption keys
- Webhook, HMAC, and third-party service secrets (PagerDuty, SMTP, analytics)

If the trigger is a committed `backend/.env.*` file, go straight to [Post-Exposure Rotation](#post-exposure-rotation-formerly-tracked-backendenv-files).

## Preparation

Before rotating any secret:

1. **Notify stakeholders** - Inform the team of the upcoming maintenance window
2. **Backup current configuration** - Save working `.env` files and `nakama.yml`
3. **Test in staging** - Always verify rotation procedures in a non-production environment first
4. **Schedule maintenance** - Choose a low-traffic period to minimize user impact

## Rotation Procedures

### 1. Database Password Rotation

**Impact:** Requires service restart

**Steps:**

1. Generate new strong password (minimum 32 characters):
   ```bash
   openssl rand -base64 32
   ```

2. Change the database user's password (PostgreSQL does not read `.env` — updating config alone leaves the old password live):
   ```bash
   docker exec -it armored_archer_db psql -U postgres -c \
     "ALTER USER postgres PASSWORD '<new_secure_password>';"
   ```

3. Update `.env` file:
   ```bash
   POSTGRES_PASSWORD=new_secure_password_here
   DATABASE_ADDRESS=postgres:new_secure_password_here@postgres:5432/nakama
   ```

4. Update `.env.example` (do NOT include actual password):
   ```bash
   POSTGRES_PASSWORD=changeme
   DATABASE_ADDRESS=postgres:changeme@postgres:5432/nakama
   ```

5. Update `nakama.yml` database.address field:
   ```yaml
   database:
     address: postgres:new_secure_password_here@postgres:5432/nakama
   ```

6. Restart services:
   ```bash
   cd backend
   docker-compose down
   docker-compose up -d
   ```

7. Verify connectivity:
   ```bash
   docker exec -it armored_archer_server /nakama/nakama healthcheck
   ```

### 2. Nakama Server Key Rotation

**Impact:** Requires client reconnection (existing sessions will be invalidated)

**Steps:**

1. Generate new server key (minimum 32 characters):
   ```bash
   openssl rand -base64 32
   ```

2. Update `.env` file:
   ```bash
   NAKAMA_SERVER_KEY=new_server_key_here
   ```

3. Update `nakama.yml` socket.server_key:
   ```yaml
   socket:
     server_key: new_server_key_here
   ```

4. Update client configuration (if using hardcoded values):
   ```gdscript
   # In NetworkManager.gd - should be using environment variables
   @export var server_key: String = ""
   ```

5. Restart Nakama:
   ```bash
   cd backend
   docker-compose restart nakama
   ```

6. **Important:** All clients must reconnect after rotation

### 3. Session Encryption Keys Rotation

**Impact:** Invalidates all active user sessions (forced re-authentication)

**Steps:**

1. Generate new encryption keys:
   ```bash
   # Token encryption key
   openssl rand -base64 32 > token_key.txt
   
   # Refresh token encryption key
   openssl rand -base64 32 > refresh_key.txt
   ```

2. Update `.env` file:
   ```bash
   SESSION_ENCRYPTION_KEY=new_session_key_here
   REFRESH_ENCRYPTION_KEY=new_refresh_key_here
   TOKEN_ENCRYPTION_KEY=new_token_key_here
   ```

3. Update `nakama.yml`:
   ```yaml
   session:
     expiry_sec: 7200
     refresh_encryption_key: new_refresh_key_here
     token_encryption_key: new_token_key_here
   ```

4. Restart Nakama:
   ```bash
   cd backend
   docker-compose restart nakama
   ```

5. **Important:** All users will be logged out and must re-authenticate

### 4. RevenueCat API Keys Rotation

**Impact:** Minimal - can be rotated without service restart

**Steps:**

1. Log in to RevenueCat Dashboard (https://app.revenuecat.com)

2. Navigate to Settings > API Keys

3. Generate new API key pairs:
   - Public API Key (used by client)
   - Secret API Key (used by server)

4. Update `.env` file (variable names match `backend/.env.example`):
   ```bash
   REVENUECAT_PUBLIC_KEY=new_public_key_here
   REVENUECAT_SECRET_KEY=new_secret_key_here
   REVENUECAT_WEBHOOK_SECRET=new_webhook_secret_here
   ```

5. **Optional:** Rebuild and redeploy client if public key changed

6. Verify functionality with test purchases

### 5. Firebase Configuration Rotation

**Impact:** Varies - depends on which values are changed

**Steps:**

1. Log in to Firebase Console (https://console.firebase.google.com)

2. Navigate to Project Settings

3. Rotate credentials as needed:
   - **API Key:** Generate new key in Project Settings > General
   - **Service Account Keys:** Generate new private key in Project Settings > Service Accounts
   - **Database Rules:** Update Firebase Realtime Database or Firestore rules

4. Update `.env` file:
   ```bash
   FIREBASE_API_KEY=new_api_key_here
   FIREBASE_PROJECT_ID=existing_project_id
   FIREBASE_AUTH_DOMAIN=existing_project_id.firebaseapp.com
   FIREBASE_DATABASE_URL=https://existing_project_id-default-rtdb.firebaseio.com
   FIREBASE_STORAGE_BUCKET=existing_project_id.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=existing_sender_id
   ```

5. Rebuild and redeploy client if necessary

## Post-Rotation Verification

After any secret rotation, perform these checks:

### Database Verification
```bash
# Check database connection
docker exec -it armored_archer_server /nakama/nakama healthcheck

# Verify data integrity
docker exec -it armored_archer_db psql -U postgres -d nakama -c "SELECT COUNT(*) FROM users;"
```

### Nakama Verification
```bash
# Check Nakama health
curl http://localhost:7351/

# Test server authentication
curl http://localhost:7350/v2/account/authenticate/device \
  -H "Authorization: Bearer <server_key>" \
  -H "Content-Type: application/json" \
  -d '{"id":"test-device-id"}'
```

### Client Verification
1. Launch the Godot client
2. Verify connection to server
3. Test authentication flow
4. Verify session persistence
5. Test all features using the rotated credentials

## Rollback Procedure

If issues occur after rotation:

1. **Immediate rollback:** Restore previous `.env` files from backup
2. **Restart services:**
   ```bash
   cd backend
   docker-compose down
   docker-compose up -d
   ```
3. **Verify functionality:** Perform verification checks listed above
4. **Investigate:** Review logs to understand what went wrong
5. **Document:** Update this procedure with lessons learned

## Rotation Schedule

Recommended rotation intervals:

| Secret Type | Rotation Frequency | Priority |
|-------------|-------------------|----------|
| Database Password | Quarterly | High |
| Nakama Server Key | Semi-annually | High |
| Session Encryption Keys | Monthly | Medium |
| RevenueCat API Keys | Quarterly | Medium |
| Firebase Service Account Keys | Semi-annually | Medium |
| Firebase API Keys | Annually or upon compromise | Low |

## Security Best Practices

1. **Never commit secrets** to version control (`.gitignore` ensures this)
2. **Use different values** for development, staging, and production
3. **Use strong random values** (minimum 32 characters for most secrets)
4. **Limit secret access** to only necessary team members
5. **Monitor for unauthorized access** using audit logs
6. **Use secrets management tools** in production (e.g., AWS Secrets Manager, HashiCorp Vault)
7. **Document all rotations** with timestamps and team member responsible

## Post-Exposure Rotation: Formerly Tracked `backend/.env.*` Files

> Merged from the former `SECRET_ROTATION.md` ("Required Actions After .env Exposure", 2026-04-01) per issue #1085, and aligned with issues #1032 / #1054 and PR #1043.

### Background

`backend/.env.alpha`, `backend/.env.beta`, `backend/.env.development`, and `backend/.env.staging` were **tracked in git** from commit `10590783` (2026-03-31) until PR #1043 untracked them. The heuristic scan in #1032 (values counted, never inspected) found:

| File | Credential-pattern vars (`*KEY*/*SECRET*/*TOKEN*/*PASSWORD*=`) | Placeholder markers |
|---|---|---|
| `.env.alpha` | 11 | 10 |
| `.env.beta` | 11 | 6 |
| `.env.development` | 9 | 5 |
| `.env.staging` | 9 | **0** |

`.env.staging` has zero placeholder markers — **treat every value in all four files as live until proven otherwise**. Untracking does not scrub git history: every clone made while the files were tracked still contains the values.

### Required rotation checklist

Every credential-pattern variable class present in `backend/.env.*` (names per `backend/.env.example` and `backend/.env.production.example`):

| Variable | Class | Procedure |
|---|---|---|
| `NAKAMA_SERVER_KEY`, `NAKAMA_SOCKET_SERVER_KEY` | Nakama keys | [Nakama Server Key Rotation](#2-nakama-server-key-rotation) below |
| `NAKAMA_CONSOLE_PASSWORD` | Console credential | Generate (`openssl rand -base64 24`), update every affected `backend/.env.*` and the `console` section of `backend/data/nakama*.yml`, restart Nakama |
| `POSTGRES_PASSWORD`, `DB_PASSWORD` | Database | [Database Password Rotation](#1-database-password-rotation) below — include the `ALTER USER` step |
| `SESSION_ENCRYPTION_KEY`, `REFRESH_ENCRYPTION_KEY`, `TOKEN_ENCRYPTION_KEY` | Encryption keys | [Session Encryption Keys Rotation](#3-session-encryption-keys-rotation) below |
| `REVENUECAT_PUBLIC_KEY`, `REVENUECAT_SECRET_KEY`, `REVENUECAT_WEBHOOK_SECRET` | IAP | [RevenueCat API Keys Rotation](#4-revenuecat-api-keys-rotation) below |
| `FIREBASE_API_KEY` (+ service-account keys) | Auth | [Firebase Configuration Rotation](#5-firebase-configuration-rotation) below |
| `HMAC_SECRET` | Webhook signing | Generate (`openssl rand -hex 32`), update every affected `backend/.env.*`, redeploy |
| `PAGERDUTY_API_KEY`, `PAGERDUTY_INTEGRATION_KEY`, `ALERT_WEBHOOK_PASSWORD`, `ALERT_WEBHOOK_TOKEN`, `SMTP_PASSWORD` | Alerting / email | Rotate at the provider, update every affected `backend/.env.*` |
| `MIXPANEL_API_KEY`, `AMPLITUDE_API_KEY`, `SEGMENT_WRITE_KEY`, `ANALYTICS_CUSTOM_API_KEY` | Analytics | Rotate at the provider, update every affected `backend/.env.*` |

### Step-by-Step

1. **Classify (owner only):** inspect the four files and classify each credential as real vs placeholder, **staging first** (#1054). Every real credential must be rotated.
2. **Generate new values:**
   ```bash
   openssl rand -base64 32   # SESSION/REFRESH/TOKEN_ENCRYPTION_KEY (32+ chars)
   openssl rand -hex 20      # NAKAMA_SERVER_KEY
   openssl rand -base64 24   # NAKAMA_CONSOLE_PASSWORD, PostgreSQL passwords
   openssl rand -hex 32      # HMAC_SECRET
   ```
3. **Rotate PostgreSQL first** (the `ALTER USER` step in [Database Password Rotation](#1-database-password-rotation)) so the new password is live before services restart against it.
4. **Update every affected `backend/.env.*` file** with the new values. All `.env.*` files (except `.example` variants) are gitignored — keep them out of commits.
5. **Rotate provider-side credentials** (RevenueCat, Firebase, PagerDuty, SMTP, analytics) per the sections above — generating new local values alone does not invalidate the old credential at the provider.
6. **Restart and verify** per [Post-Rotation Verification](#post-rotation-verification) below.

### Git History Purge (owner decision, coordinated — never unilateral)

Untracking does not remove the old values from history. A rewrite via BFG Repo Cleaner (https://rtyley.github.io/bfg-repo-cleaner/) or `git filter-repo` is an **owner decision, only if confirmed-live secrets warrant it** (#1032/#1054):

```bash
# Requires shared-branch coordination: every clone and open PR is invalidated.
java -jar bfg.jar --delete-files '.env.alpha'   # repeat for .env.beta, .env.development, .env.staging
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force   # ONLY after coordinating the rewrite with all branch users — never force-push unilaterally
```

### Verification

```bash
# Confirm secrets are no longer in git history
git log --all -p -- backend/.env.alpha backend/.env.beta backend/.env.development backend/.env.staging \
  | grep -iE "key|secret|token|password"
# Should return no results after a purge (and nothing new while the files are untracked)
```

After rotation, confirm the `tracked-ignored-files` CI guard (`backend/scripts/validate-tracked-ignored-files.ts`, added in PR #1043) passes once hosted CI is restored (#1054).

### Prevention

- All `.env.*` files (except `.env.example` variants) are gitignored — keep it that way
- Use `.env.example` files as templates with placeholder values only
- Never commit actual secrets — use environment variables or a secrets manager

## Emergency Rotation

If a secret is suspected to be compromised:

1. **Immediately rotate** the compromised secret following the appropriate procedure above
2. **Review audit logs** for any suspicious activity
3. **Notify security team** if organization has one
4. **Document the incident** for post-mortem analysis
5. **Consider rotating related secrets** if exposure scope is unclear
6. **Committed `backend/.env.*` exposure:** follow the [Post-Exposure Rotation](#post-exposure-rotation-formerly-tracked-backendenv-files) section above

## Contact

For questions or issues with secret rotation:
- Review this documentation
- Check issue tracker: https://github.com/anchapin/armored-archer/issues
- Contact security team (if applicable)