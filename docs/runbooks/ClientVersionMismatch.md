# Runbook: ClientVersionMismatch

**Alert Name**: `ClientVersionMismatch`
**Severity**: Info
**Last Updated**: 2026-08-18

---

## ℹ️ Alert Definition

**Expression**: `count by (client_version) (armored_archer_active_users) > 10`
**Duration**: 10 minutes
**Impact**: A non-current client version still has >10 active users. Either a forced-update gate is missing, an in-flight upgrade is taking longer than expected, or a fork is in the wild. Server-authoritative guarantees may not hold against an old client.

---

## 📞 Escalation Path

1. **Next business day**: Triage during normal standup.
2. **If a security-sensitive mismatch**: Frontend lead + security.
3. **If users are stuck**: Frontend lead opens a P1 to push a hotfix.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Active users by client version
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=count by (client_version) (armored_archer_active_users)' \
  | jq '.data.result[]'

# Alertmanager state
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="ClientVersionMismatch")'
```

### 2. Inspect the Signal Source

```bash
# Active users counter is updated via updateActiveUsersCount in metrics.ts:649
# The client_version label is attached by the client telemetry layer
grep -n "updateActiveUsersCount\|active_users" backend/src/modules/metrics.ts | head -10

# Client-side emission lives in /scenes and /scripts — usually via an analytics autoload
ls autoloads/ | grep -iE "analytics|telemetry|version"
```

### 3. Determine the Latest Released Version

```bash
# Mobile builds and rollout status
gh release list --repo anchapin/armored-archer --limit 10

# App Store / Play Store current version (manual check)
echo "Confirm against App Store Connect / Play Console metadata"
```

---

## 🔧 Troubleshooting Steps

### Step 1: Identify the Mismatched Versions

```bash
# All distinct versions with non-trivial user counts
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=count by (client_version) (armored_archer_active_users) > 10' \
  | jq '.data.result[]'

# Time since each version was first seen
docker exec postgres psql -U postgres -c \
  "SELECT client_version, min(first_seen_at) AS first_seen,
          max(last_seen_at) AS last_seen,
          count(DISTINCT user_id) AS users
   FROM client_telemetry
   GROUP BY client_version
   ORDER BY users DESC
   LIMIT 20;"
```

### Step 2: Check Rollout / Force-Update Flags

```bash
# Progressive rollout config — version-gated canary flags (no minimumSupportedVersion exists)
grep -n "canaryVersionMin\|canaryVersionMax\|game_version" backend/src/modules/progressive_rollout.ts | head -10

# Recent frontend changes
git log --oneline -10 -- scenes/ scripts/
```

### Step 3: Check for Store Submission Lag

```bash
# Was the latest build submitted / approved?
gh issue list --repo anchapin/armored-archer \
  --label "frontend,release" --state open --limit 10
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Force Update Was Not Shipped

```bash
# Update progressive_rollout.ts with the new canary version gate
grep -n "canaryVersionMin\|canaryVersionMax" backend/src/modules/progressive_rollout.ts | head -10
git checkout -b fix/min-supported-version
# adjust canaryVersionMin / canaryVersionMax; add a test in __tests__/progressive_rollout.test.ts
docker-compose build nakama && docker-compose up -d nakama
```

### Scenario 2: Store Review Lagging

```bash
# Apple / Google haven't approved the latest build yet
echo "Coordinate with release manager to expedite review or push a hotfix"
gh issue create --repo anchapin/armored-archer \
  --title "[Release] <store> review delay blocking v<version>" \
  --label "release,frontend"
```

### Scenario 3: Forked / Tampered Client

```bash
# If a client_version doesn't correspond to a released build, treat as suspicious
docker exec postgres psql -U postgres -c \
  "SELECT * FROM client_telemetry WHERE client_version NOT IN ('<released-list>')
   ORDER BY last_seen_at DESC LIMIT 20;"

# Cross-link with the SuspiciousLoginActivity runbook if the same user_ids appear there
cat docs/runbooks/SuspiciousLoginActivity.md
```

### Scenario 4: Users Stuck Mid-Upgrade

```bash
# Likely the App Store rollout percentage is below 100
gh release view --repo anchapin/armored-archer --json publishedAt,assets | head -10

# Coordinate with the release manager to bump the rollout percentage
```

---

## ✅ Verification

```bash
# 1. Only the current version (and one prior, if allowed) remain
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=count by (client_version) (armored_archer_active_users)' \
  | jq '.data.result[]'

# 2. Alert cleared
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="ClientVersionMismatch") | .status.state'
```

---

## 📊 Post-Incident Actions

1. **Adjust** `canaryVersionMin`/`canaryVersionMax` in `backend/src/modules/progressive_rollout.ts` (there is no server-side `minimumSupportedVersion` — version gating is canary-phase only).
2. **Coordinate** with the frontend team to push a hotfix build if a security-sensitive fix is gated by an upgrade.
3. **Update** [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md) and [`docs/APP_SUBMISSION_CHECKLIST.md`](../APP_SUBMISSION_CHECKLIST.md) with the rollout timeline.
4. **Add a regression test** for the client-version guard in `backend/src/modules/__tests__/progressive_rollout.test.ts`.

---

## 🔗 Related Resources

- [Progressive Rollout module](../../backend/src/modules/progressive_rollout.ts)
- [Metrics module](../../backend/src/modules/metrics.ts)
- [App Submission Checklist](../APP_SUBMISSION_CHECKLIST.md)
- [Deployment](../DEPLOYMENT.md)
- [iOS App Store Guide](../APP_STORE_IOS)
- [Android App Store Guide](../APP_STORE_ANDROID.md)
- [SuspiciousLoginActivity runbook](./SuspiciousLoginActivity.md)

---

## 📞 Contact

- **Frontend / Client Team**: `#frontend` Slack channel
- **Backend Team**: `#backend-team` Slack channel (if RPC behaviour depends on version)
- **Security Team**: `#security` Slack channel (only for tampered/forked clients)
- **Release Manager**: `#releases` Slack channel