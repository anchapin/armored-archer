# Runbook: SessionDurationAnomaly

**Alert Name**: `SessionDurationAnomaly`
**Severity**: Warning
**Last Updated**: 2026-08-18

---

## ⚠️ Alert Definition

**Expression**: `abs(armored_archer_avg_session_duration - armored_archer_avg_session_duration_offset_24h) / armored_archer_avg_session_duration_offset_24h > 0.3`
**Duration**: 30 minutes
**Impact**: Average session length has drifted more than 30% from the same-hour-yesterday value. A drop usually means a UX regression or a crash on first action; a spike can be a viral event or a stuck-session bug.

---

## 📞 Escalation Path

1. **0-30 minutes**: On-call engineer triages drop vs spike.
2. **30-60 minutes**: Backend team lead and product.
3. **60+ minutes**: Open a P2; coordinate with QA for repro if it's a crash / disconnect class.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Current avg session duration
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_avg_session_duration' \
  | jq '.data.result[0].value[1]'

# Same-hour-yesterday baseline
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_avg_session_duration offset 24h' \
  | jq '.data.result[0].value[1]'

# Trend over the last 6 hours
curl -s 'http://prometheus:9090/api/v1/query_range' \
  -G --data-urlencode 'query=armored_archer_avg_session_duration' \
  --data-urlencode 'start='"$(date -u -d '6 hours ago' +%s)" \
  --data-urlencode 'end='"$(date -u +%s)" \
  --data-urlencode 'step=300' | jq '.data.result[].values'

# Alertmanager state
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="SessionDurationAnomaly")'
```

### 2. Inspect the Signal Source

```bash
# Session observation lives in metrics.ts:599 (recordSessionDuration)
grep -n "recordSessionDuration\|playerSessionDuration\|armored_archer_player_session_duration_seconds" \
  backend/src/modules/metrics.ts | head -10

# The recording rule reduces it to avg_session_duration in alerts.yml:274
# Confirm the recording rule is loaded
curl -s 'http://prometheus:9090/api/v1/rules' | jq '.data.groups[].rules[] | select(.name | test("session"))'
```

### 3. Cross-Check Crash and Latency Signals

```bash
# Crash spike (mobile)
grep -n "crash\|collectError" backend/src/modules/error_insight_pipeline.ts | head -10

# RPC error rate
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_errors_total[5m]) / rate(armored_archer_rpc_requests_total[5m])' \
  | jq '.data.result[0].value[1]'

# Latency
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m]))' \
  | jq '.data.result[0].value[1]'
```

---

## 🔧 Troubleshooting Steps

### Step 1: Confirm Distribution, Not Just Average

```bash
# Median is more robust to outlier sessions than mean
docker exec postgres psql -U postgres -c \
  "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_seconds) AS p50,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_seconds) AS p95
   FROM sessions
   WHERE started_at > now() - interval '1 hour';"

# Are short sessions dominating (sign of crash / disconnect)?
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FILTER (WHERE duration_seconds < 30) AS short_sessions,
          count(*) FILTER (WHERE duration_seconds BETWEEN 30 AND 600) AS normal,
          count(*) FILTER (WHERE duration_seconds > 3600) AS long_sessions,
          count(*) AS total
   FROM sessions
   WHERE started_at > now() - interval '1 hour';"
```

### Step 2: Look for New UX or Content Drops

```bash
# Recent client / content changes that could move the metric
git log --oneline -10 -- scenes/ scripts/ assets/

# Live-ops / season changes
gh issue list --repo anchapin/armored-archer \
  --label "live-ops,season" --limit 10 --state all
```

### Step 3: Crash and Disconnect Pipelines

```bash
# Mobile crash signals from the error-insight pipeline
grep -n "collectError\|getErrorStore" backend/src/modules/error_insight_pipeline.ts | head -10

# Player-support tickets about disconnects
gh issue list --repo anchapin/armored-archer \
  --label "customer-support,crash,disconnect" --state open --limit 10
```

### Step 4: Look at Disconnect Reasons

```bash
# Per-reason disconnect counts (if your schema tracks them)
docker exec postgres psql -U postgres -c \
  "SELECT reason, count(*) AS n
   FROM session_terminations
   WHERE created_at > now() - interval '1 hour'
   GROUP BY reason
   ORDER BY n DESC
   LIMIT 10;"
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Client Crash on First Action (Drop)

```bash
# 1. Triage via crash reports
grep -n "crash\|registerErrorInsightRpcs" backend/src/modules/error_insight_pipeline.ts | head -10
cat docs/CRASH_ALERT_THRESHOLDS.md | head -60

# 2. Coordinate a hotfix release
gh issue create --repo anchapin/armored-archer \
  --title "[Frontend] Crash on first action — SessionDuration drop" \
  --label "frontend,crash,priority:high" \
  --body "Triggered at $(date -u). Repro: <details>"

# 3. Force-update via the ClientVersionMismatch runbook
cat docs/runbooks/ClientVersionMismatch.md
```

### Scenario 2: Server Bug Causing Disconnects (Drop)

```bash
# 1. Confirm via RPC error rate
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (rpc) (rate(armored_archer_rpc_errors_total[5m]))' \
  | jq '.data.result[]'

# 2. Roll back the recent backend deploy if implicated
git log --oneline --since="1 hour ago" -- backend/
git revert <sha>
docker-compose build nakama && docker-compose up -d nakama
```

### Scenario 3: Stuck-Session Bug (Spike)

```bash
# 1. Confirm via disconnect counts
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FROM session_terminations
   WHERE created_at > now() - interval '1 hour' AND reason='client_disconnect';"

# 2. If clients aren't terminating sessions, fix how session close is observed server-side
# (there is no server-side heartbeat — sessions are recorded via recordSessionDuration)
grep -n "recordSessionDuration\|playerSessionDuration" backend/src/modules/metrics.ts | head -10
```

### Scenario 4: Real Engagement Spike (Spike)

```bash
# 1. Cross-check active_users and revenue — is this a real win?
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_revenue_cents_total[1h])' \
  | jq '.data.result[0].value[1]'

# 2. No action required; coordinate with product on a follow-up comms blast
```

### Scenario 5: New Content / Mode Driving Engagement (Spike)

```bash
# Confirm via release notes / changelog
gh release view --repo anchapin/armored-archer --json publishedAt,body | head -10

# Update the analytics dashboard to highlight the change
```

---

## ✅ Verification

```bash
# 1. Avg session duration back to baseline
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_avg_session_duration' \
  | jq '.data.result[0].value[1]'

# 2. Median session duration stable
docker exec postgres psql -U postgres -c \
  "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_seconds) AS p50
   FROM sessions
   WHERE started_at > now() - interval '15 minutes';"

# 3. Alert cleared
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="SessionDurationAnomaly") | .status.state'
```

---

## 📊 Post-Incident Actions

1. **Tune the alert threshold** (currently 30%) if the change is durable growth.
2. **Add labels** (region, client_version) to the session-duration histogram.
3. **File a follow-up** if a regression caused the dip — track in `docs/CRASH_ALERT_THRESHOLDS.md`.
4. **Coordinate** with player support for refund / make-good flows if player impact was material.

---

## 🔗 Related Resources

- [Metrics module](../../backend/src/modules/metrics.ts)
- [Error Insight Pipeline](../../backend/src/modules/error_insight_pipeline.ts)
- [Crash Alert Thresholds](../CRASH_ALERT_THRESHOLDS.md)
- [ClientVersionMismatch runbook](./ClientVersionMismatch.md)
- [HighLatency runbook](./HighLatency.md)
- Grafana → *Sessions* dashboard: `http://grafana:3000/d/armored-archer-sessions`

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Backend Team**: `#backend-team` Slack channel
- **Frontend / Client Team**: `#frontend` Slack channel
- **Product Team**: `#product` Slack channel
- **QA Team**: `#qa` Slack channel
- **Player Support**: `#customer-support` Slack channel