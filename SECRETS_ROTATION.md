# Secrets Rotation Procedure

This document outlines the procedures for rotating secrets and sensitive configuration values in Armored Archer.

## Overview

Regular secret rotation is a security best practice that limits the exposure window if credentials are compromised. This document covers rotation procedures for:

- Nakama server keys
- Database passwords
- RevenueCat API keys
- Firebase configuration
- Session encryption keys

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

2. Update `.env` file:
   ```bash
   POSTGRES_PASSWORD=new_secure_password_here
   DATABASE_ADDRESS=postgres:new_secure_password_here@postgres:5432/nakama
   ```

3. Update `.env.example` (do NOT include actual password):
   ```bash
   POSTGRES_PASSWORD=changeme
   DATABASE_ADDRESS=postgres:changeme@postgres:5432/nakama
   ```

4. Update `nakama.yml` database.address field:
   ```yaml
   database:
     address: postgres:new_secure_password_here@postgres:5432/nakama
   ```

5. Restart services:
   ```bash
   cd backend
   docker-compose down
   docker-compose up -d
   ```

6. Verify connectivity:
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
   SESSION_ENCRYPTION_KEY=new_token_key_here
   REFRESH_ENCRYPTION_KEY=new_refresh_key_here
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

4. Update `.env` file:
   ```bash
   REVENUECAT_PUBLIC_API_KEY=new_public_key_here
   REVENUECAT_SECRET_API_KEY=new_secret_key_here
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

## Emergency Rotation

If a secret is suspected to be compromised:

1. **Immediately rotate** the compromised secret following the appropriate procedure above
2. **Review audit logs** for any suspicious activity
3. **Notify security team** if organization has one
4. **Document the incident** for post-mortem analysis
5. **Consider rotating related secrets** if exposure scope is unclear

## Contact

For questions or issues with secret rotation:
- Review this documentation
- Check issue tracker: https://github.com/anchapin/armored-archer/issues
- Contact security team (if applicable)