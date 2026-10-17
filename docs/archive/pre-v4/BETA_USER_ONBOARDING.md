# Beta User Onboarding System

## Overview

This document describes the beta user registration and onboarding flow to support 100+ beta users.

## Beta User Capacity

| Metric | Value |
|--------|-------|
| Maximum Beta Users | 500 |
| Current Capacity | 100+ |
| Registration Mode | Invite-only (with self-service option) |

## User Registration Flow

### 1. Invite-Based Registration

Beta users receive unique invitation codes:

```
Invitation Code Format: BETA-XXXX-XXXX-XXXX
```

### 2. Self-Service Registration

Users can register without invitation up to the configured limit.

## Registration API

### Register New User

```
POST /rpc/register
{
  "username": "string (3-20 chars)",
  "email": "string (valid email)",
  "password": "string (min 8 chars)",
  "invite_code": "string (optional)"
}
```

**Response:**
```json
{
  "user_id": "uuid",
  "session_token": "string",
  "created": true
}
```

### Login

```
POST /rpc/login
{
  "email": "string",
  "password": "string"
}
```

### Beta User Profile

```
GET /rpc/get_beta_profile
```

**Response:**
```json
{
  "beta_user_id": "uuid",
  "invite_code": "string",
  "registered_at": "timestamp",
  "feedback_count": 0,
  "status": "active"
}
```

## User Roles

| Role | Permissions |
|------|-------------|
| `beta_user` | Standard gameplay, feedback submission |
| `beta_tester` | All beta_user + early access features |
| `beta_lead` | All beta_tester + access to aggregated feedback |

## Onboarding Flow

### Step 1: Account Creation
1. User enters username, email, password
2. System validates input
3. System checks user limit (max 500)
4. Account created with `beta_user` role

### Step 2: Welcome
1. User receives welcome notification
2. Tutorial prompt shown
3. Beta guidelines displayed

### Step 3: Tutorial
1. Guided gameplay introduction
2. Core mechanics explained
3. First match facilitated

### Step 4: Feedback Setup
1. Feedback button tutorial shown
2. Survey prompts configured
3. Discord link provided (optional)

## Database Schema

### beta_users table

```sql
CREATE TABLE beta_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    invite_code VARCHAR(20) UNIQUE,
    registered_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active',
    feedback_count INTEGER DEFAULT 0,
    last_feedback_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);
```

### beta_invitations table

```sql
CREATE TABLE beta_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    used_at TIMESTAMP,
    max_uses INTEGER DEFAULT 1,
    uses_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);
```

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `/rpc/register` | 10/minute per IP |
| `/rpc/login` | 20/minute per IP |

## User Management Commands

### Generate Invitation Code

```bash
psql -c "INSERT INTO beta_invitations (code, created_by) VALUES ('BETA-XXXX-XXXX-XXXX', 'admin-user-id');"
```

### List Active Beta Users

```sql
SELECT u.username, u.email, bu.registered_at, bu.status
FROM beta_users bu
JOIN users u ON bu.user_id = u.id
WHERE bu.status = 'active'
ORDER BY bu.registered_at DESC;
```

### Check User Count

```sql
SELECT COUNT(*) as total_beta_users
FROM beta_users
WHERE status = 'active';
```

## Access Control

### Maximum Users Enforcement

```go
func canRegisterNewBetaUser() bool {
    count := getActiveBetaUserCount()
    return count < 500 // MAX_BETA_USERS
}
```

### Invite Code Validation

```go
func validateInviteCode(code string) bool {
    inv := getInvitation(code)
    if inv == nil || inv.status != "active" {
        return false
    }
    if inv.expires_at != nil && time.Now().After(*inv.expires_at) {
        return false
    }
    return inv.uses_count < inv.max_uses
}
```

## Security Measures

1. **Password Requirements**: Min 8 characters
2. **Email Verification**: Required for full access
3. **Rate Limiting**: Per-IP limits enforced
4. **Invite Code**: Unique, expirable codes available

---

**Version**: 1.0  
**Created**: 2026-03-17
