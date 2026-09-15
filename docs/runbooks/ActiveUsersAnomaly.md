# Runbook: ActiveUsersAnomaly

**Alert Name**: `ActiveUsersAnomaly`
**Severity**: Warning
**Last Updated**: 2026-08-18

---

## ⚠️ Alert Definition

**Expression**: `abs(armored_archer_active_users - armored_archer_active_users_offset_1h) / armored_archer_active_users_offset_1h > 0.5`
**Duration**: 10 minutes
**Impact**: Active users drifted more than 50% from the value 1 hour ago. Either a real win (campaign going viral) or a real problem (login broken, bot attack, telemetry miscount). Investigate before scaling.

---

## 📞 Escalation Path

1. **0-15 minutes**: On-call engineer triages spike vs drop.
2. **15-30 minutes**: Backend team lead and analytics.
3. **30+ minutes**: Open a P2; brief product if revenue / churn impact is material.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Current vs 1h-ago active users
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users offset 1h' \
  | jq '.data.result[0].value[1]'

# Trend over the last 4 hours
curl -s 'http://prometheus:9090/api/v1/query_range' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  --data-urlencode 'start='"$(date -u -d '4 hours ago' +%s)" \
  --data-urlencode 'end='"$(date -u +%s)" \
  --data-urlencode 'step=300' | jq '.data.result[].values'

# Alertmanager state
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="ActiveUsersAnomaly")'
```

### 2. Inspect the Counter Source

```bash
# updateActiveUsersCount in metrics.ts:592 feeds the gauge
grep -n "updateActiveUsersCount\|armored_archer_rate_limit_active_users" \
  backend/src/modules/metrics.ts | head -15

# Recent changes to the gauge update path
git log --oneline -10 -- backend/src/modules/metrics.ts backend/src/modules/progressive_rollout.ts
```

### 3. Compare Against Independent Signals

```bash
# Login success rate (broken login → active_users drop even though players are trying)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_player_login_attempts_total{status="success"}[5m])' \
  | jq '.data.result[0].value[1]'

# Failed login rate (credential stuffing → active_users spike)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_failed_logins_total[5m])' \
  | jq '.data.result[0].value[1]'

# Match creation rate (legit players in PvP)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_matchmaking_queue_size[5m])' \
  | jq '.data.result[0].value[1]'
```

---

## 🔧 Troubleshooting Steps

### Step 1: Spike Investigation

```bash
# Are new regions / versions driving the spike?
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=count by (client_version) (armored_archer_active_users)' \
  | jq '.data.result[]'

# Per-region breakdown if labelled
docker exec postgres psql -U postgres -c \
  "SELECT region, count(DISTINCT user_id) AS users
   FROM client_telemetry
   WHERE last_seen_at > now() - interval '15 minutes'
   GROUP BY region
   ORDER BY users DESC;"
```

### Step 2: Drop Investigation

```bash
# Auth / login failures will appear in lockstep with a drop
grep -n "recordLoginAttempt\|playerLoginAttempts" backend/src/modules/metrics.ts | head -5

# Open player-support tickets — login issues reported by users
gh issue list --repo anchapin/armored-archer \
  --label "customer-support,login" --state open --limit 10

# Server errors on the most-trafficked RPCs
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (rpc) (rate(armored_archer_rpc_errors_total[5m]))' \
  | jq '.data.result[] | select(.value[1] | tonumber > 1)'
```

### Step 3: Marketing / Live-Ops Correlation

```bash
# Live-ops events recently shipped
gh issue list --repo anchapin/armored-archer \
  --label "live-ops" --state all --limit 10

# Season / push notification batch
grep -n "scheduleNextDailyReward\|notifyUsersAboutEvent\|startNotificationScheduler" backend/src/modules/notification_scheduler.ts | head -10
```

### Step 4: Database / Telemetry Health

```bash
# Confirm the gauge is being updated by a healthy process
curl -s http://nakama:7350/metrics | grep armored_archer_rate_limit_active_users | head -5

# Check for telemetry backfill or duplicates
docker exec postgres psql -U postgres -c \
  "SELECT date_trunc('minute', created_at) AS minute, count(*)
   FROM client_telemetry
   WHERE created_at > now() - interval '30 minutes'
   GROUP BY minute ORDER BY minute DESC LIMIT 30;"
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Real Spike (Campaign, Push Notification)

```bash
# Confirm via analytics
grep -n "analytics\|telemetry" backend/src/modules/analytics.ts | head -10

# Scale horizontally to keep latency low
docker-compose up -d --scale nakama=3
docker stats --no-stream
```

### Scenario 2: Bot-Driven Fake Spike

```bash
# Confirm via failed-login correlation
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_failed_logins_total[5m])' \
  | jq '.data.result[0].value[1]'

# Follow the SuspiciousLoginActivity runbook
cat docs/runbooks/SuspiciousLoginActivity.md
```

### Scenario 3: Login Pipeline Broken (Drop)

```bash
# Confirm login success rate has fallen
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_player_login_attempts_total{status="success"}[5m])' \
  | jq '.data.result[0].value[1]'

# Check for a recent deploy to auth.ts / admin_auth.ts
git log --oneline -10 -- backend/src/modules/auth.ts backend/src/modules/admin_auth.ts

# Roll back if recent
git revert <sha>
docker-compose build nakama && docker-compose up -d nakama
```

### Scenario 4: Telemetry Counter Drift

```bash
# Compare gauge vs raw telemetry
docker exec postgres psql -U postgres -c \
  "SELECT count(DISTINCT user_id) FROM client_telemetry
   WHERE last_seen_at > now() - interval '5 minutes';"

# If the gauge diverges from this count, fix the gauge updater
grep -n "updateActiveUsersCount" backend/src/modules/metrics.ts | head -5
```

### Scenario 5: Off-Peak vs Same-Time-Last-Week Comparison

```bash
# Same-hour comparison across days of week
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users offset 1d' \
  | jq '.data.result[0].value[1]'

# If the same-hour-last-week matches, this is just a regular drop — no action.
# Otherwise escalate.
```

---

## ✅ Verification

```bash
# 1. Active users near the rolling baseline
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users offset 1h' \
  | jq '.data.result[0].value[1]'

# 2. Independent signals also normalised
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_player_login_attempts_total{status="success"}[5m])' \
  | jq '.data.result[0].value[1]'

# 3. Alert cleared
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="ActiveUsersAnomaly") | .status.state'
```

---

## 📊 Post-Incident Actions

1. **Tune the alert threshold** if real growth has shifted the baseline (50% may be too tight now).
2. **Add labels** (region, client_version, platform) to the active_users gauge for faster triage.
3. **Cross-link** with [`SuspiciousLoginActivity`](./SuspiciousLoginActivity.md) and [`HighCPUUsage`](./HighCPUUsage.md) runbooks when multiple alerts fire together.
4. **Coordinate with product** for player-facing communication if a drop extended beyond 30 minutes.

---

## 🔗 Related Resources

- [Metrics module](../../backend/src/modules/metrics.ts)
- [Analytics module](../../backend/src/modules/analytics.ts)
- [Progressive Rollout module](../../backend/src/modules/progressive_rollout.ts)
- [SuspiciousLoginActivity runbook](./SuspiciousLoginActivity.md)
- [Live Ops Calendar](../LIVE_OPS_CALENDAR.md)
- Grafana → *Active Users* dashboard: `http://grafana:3000/d/armored-archer-analytics`

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Backend Team**: `#backend-team` Slack channel
- **Product Team**: `#product` Slack channel
- **Live Ops**: `#live-ops` Slack channel
- **Analytics**: `#analytics` Slack channel