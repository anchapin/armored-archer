# Runbook: SuspiciousLoginActivity

**Alert Name**: `SuspiciousLoginActivity`
**Severity**: Critical
**Last Updated**: 2026-08-18

---

## 🚨 Alert Definition

**Expression**: `rate(armored_archer_failed_logins_total[5m]) > 10`
**Duration**: 2 minutes
**Impact**: Sustained failure rate above 10/minute. Likely credential stuffing or brute force. Even legitimate users on flaky networks can produce this — verify before locking accounts.

---

## 📞 Escalation Path

1. **0-5 minutes**: On-call engineer pages in `#armored-archer-critical`.
2. **5-15 minutes**: Security lead (account-takeover risk).
3. **15+ minutes**: CTO; coordinate with player support for any false-positive user lockouts.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Current rate of failed logins
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_failed_logins_total[5m])' \
  | jq '.data.result[]'

# Failure ratio (failures / (successes + failures))
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum(rate(armored_archer_failed_logins_total[5m])) / sum(rate(armored_archer_player_login_attempts_total[5m]))' \
  | jq '.data.result[0].value[1]'

# Alertmanager state
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="SuspiciousLoginActivity")'
```

### 2. Inspect the Signal Source

```bash
# Canonical counter: recordLoginAttempt in metrics.ts:620
grep -n "recordLoginAttempt\|playerLoginAttempts\|armored_archer_player_login_attempts_total" \
  backend/src/modules/metrics.ts | head -20

# Call sites — confirm coverage for all login paths
grep -rn "recordLoginAttempt" backend/src/ | grep -v __tests__ | head -10
```

### 3. Triage at the Database

```bash
# Top failing source IPs in the last 30 minutes
docker exec postgres psql -U postgres -c \
  "SELECT client_ip, count(*) AS failures
   FROM auth_failures
   WHERE created_at > now() - interval '30 minutes'
   GROUP BY client_ip
   ORDER BY failures DESC
   LIMIT 20;"

# Top failing user accounts
docker exec postgres psql -U postgres -c \
  "SELECT user_id, count(*) AS failures
   FROM auth_failures
   WHERE created_at > now() - interval '30 minutes'
   GROUP BY user_id
   ORDER BY failures DESC
   LIMIT 20;"

# Spread (one IP or many?) — distinguishes brute force from credential stuffing
docker exec postgres psql -U postgres -c \
  "SELECT count(DISTINCT client_ip) AS distinct_ips,
          count(DISTINCT user_id) AS distinct_users
   FROM auth_failures
   WHERE created_at > now() - interval '30 minutes';"
```

---

## 🔧 Troubleshooting Steps

### Step 1: Characterise the Attack Pattern

```bash
# Time-series of failures over the last hour
curl -s 'http://prometheus:9090/api/v1/query_range' \
  -G --data-urlencode 'query=rate(armored_archer_failed_logins_total[1m])' \
  --data-urlencode 'start='"$(date -u -d '1 hour ago' +%s)" \
  --data-urlencode 'end='"$(date -u +%s)" \
  --data-urlencode 'step=60' | jq '.data.result[].values'

# Are failures concentrated against a single endpoint?
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (endpoint) (rate(armored_archer_failed_logins_total[5m]))' \
  | jq '.data.result[]'
```

### Step 2: Check Rate-Limit State

```bash
# Active rate-limit blocks
grep -n "getPlayerRateLimitStatus\|getRateLimitStats" backend/src/modules/rate_limit.ts | head -10
# Read through the rate_limit module to know which thresholds apply
sed -n '70,140p' backend/src/modules/rate_limit.ts
```

### Step 3: Validate We Are Not Blocking Legitimate Users

```bash
# Compare successful login volume over the same window
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_player_login_attempts_total{status="success"}[5m])' \
  | jq '.data.result[0].value[1]'

# Customer-support tickets about login problems
gh issue list --repo anchapin/armored-archer \
  --label "customer-support,login" --state open --limit 20
```

### Step 4: Inspect Edge / WAF State (if configured)

```bash
# If using a CDN/WAF (Cloudflare, Fastly, etc.) check blocked requests
curl -s -H "Authorization: Bearer $CF_API_KEY" \
  "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/analytics/dashboard?since=-30" \
  | jq '.result.totals[] | select(.key=="threats.all")'

# Check reverse-proxy logs
docker logs nginx --tail 200 | grep -iE "(401|403|429)" | tail -30
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Credential Stuffing From One Botnet

```bash
# 1. Confirm pattern: many users, few IPs each → wide spread
docker exec postgres psql -U postgres -c \
  "SELECT count(DISTINCT user_id)::float / NULLIF(count(DISTINCT client_ip), 0) AS users_per_ip
   FROM auth_failures
   WHERE created_at > now() - interval '30 minutes';"

# 2. Tighten rate-limit window for /authenticate — see rate_limit.ts:74 (`DEFAULT_RATE_LIMITS`)
# Add or tighten the entry for the auth RPC and roll out.
docker-compose build nakama && docker-compose up -d nakama

# 3. Push a CAPTCHA / device-fingerprint requirement via Firebase App Check
# (See docs/AUTHENTICATION.md and docs/SECURITY.md)
```

### Scenario 2: Brute Force Against One Account

```bash
# 1. Confirm: one user_id, many failures
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FROM auth_failures
   WHERE user_id = '<user_id>' AND created_at > now() - interval '1 hour';"

# 2. Temporary account lockout — bump failed-login threshold and cool-down
# Edit rate_limit.ts:74 (`DEFAULT_RATE_LIMITS`) → add or tighten a maxRequests / penaltyMs entry
docker-compose build nakama && docker-compose up -d nakama

# 3. Notify the account owner via player support
gh issue create --repo anchapin/armored-archer \
  --title "[Security] Account <user_id> under brute-force" \
  --label "security,player-support" \
  --body "Triggered by SuspiciousLoginActivity at $(date -u). Source IP: <ip>."
```

### Scenario 3: Network / Client Bug Producing False Failures

```bash
# 1. Compare failure rate against recent deploy
git log --oneline -10 -- backend/src/modules/auth.ts backend/src/modules/admin_auth.ts

# 2. If a recent deploy changed auth, roll back
git revert <sha>
docker-compose build nakama && docker-compose up -d nakama

# 3. Add a regression test in __tests__/auth.test.ts
```

### Scenario 4: WAF / CDN Misconfiguration Blocking Legitimate Users

```bash
# 1. Verify failure ratio is high while success rate is also low → broken login path
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_player_login_attempts_total{status="success"}[5m])' \
  | jq '.data.result[0].value[1]'

# 2. Roll back CDN rule
# (Coordinate with infra; the WAF is owned by the infra team)
```

---

## ✅ Verification

```bash
# 1. Failure rate back to baseline
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_failed_logins_total[5m])' \
  | jq '.data.result[] | select(.value[1] | tonumber > 10)'

# 2. Successful logins are flowing
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_player_login_attempts_total{status="success"}[5m])' \
  | jq '.data.result[0].value[1]'

# 3. Alert cleared
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="SuspiciousLoginActivity") | .status.state'
```

---

## 📊 Post-Incident Actions

1. **Notify impacted users** via player support (especially if their accounts were locked).
2. **Document the IP/user pattern** in the security ticket for future reference.
3. **Tune** `backend/src/modules/rate_limit.ts` thresholds if the attack bypassed them.
4. **Update** [`docs/AUTHENTICATION.md`](../AUTHENTICATION.md) and [`docs/SECURITY.md`](../SECURITY.md) with any new rules.
5. **Coordinate with infra** if the WAF/CDN needs new rules.

---

## 🔗 Related Resources

- [Authentication](../AUTHENTICATION.md)
- [Security](../SECURITY.md)
- [Rate Limit module](../../backend/src/modules/rate_limit.ts)
- [Metrics module](../../backend/src/modules/metrics.ts)
- [Admin Auth module](../../backend/src/modules/admin_auth.ts)
- Grafana → *Security / Auth* dashboard: `http://grafana:3000/d/armored-archer-security`

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Security Team**: `#security` Slack channel
- **Backend Team**: `#backend-team` Slack channel
- **Infrastructure**: `#infra` Slack channel
- **Player Support**: `#customer-support` Slack channel