# Runbook: UnusualAPICallPattern

**Alert Name**: `UnusualAPICallPattern`
**Severity**: Warning
**Last Updated**: 2026-08-18

---

## ⚠️ Alert Definition

**Expression**: `rate(armored_archer_rpc_requests_total[1m]) > 1000`
**Duration**: 5 minutes
**Impact**: Sustained API request rate above 1000/minute (≈17 req/s). Usually one of: legitimate traffic spike, hot RPC loop, abusive client, or partial DDoS. Investigate before scaling.

---

## 📞 Escalation Path

1. **0-15 minutes**: On-call engineer investigates.
2. **15-30 minutes**: Backend team lead and security if traffic is non-user.
3. **30+ minutes**: Engage infra for upstream WAF/CDN mitigation.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Current request rate
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_requests_total[1m])' \
  | jq '.data.result[]'

# Per-RPC breakdown — top 10
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=topk(10, sum by (rpc) (rate(armored_archer_rpc_requests_total[1m])))' \
  | jq '.data.result[]'

# Alertmanager state
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="UnusualAPICallPattern")'
```

### 2. Inspect the Counter Source

```bash
# The canonical RPC counter is defined in metrics.ts:27 (armored_archer_rpc_calls_total)
grep -n "armored_archer_rpc_calls_total\|recordRpcLatency" backend/src/modules/metrics.ts backend/src/modules/rpc_latency_tracker.ts | head -20

# Coverage — confirm all RPCs flow through the tracker
grep -rn "initializeRpcLatencyTracker\|recordRpcLatency" backend/src/ | grep -v __tests__ | head -10
```

### 3. Compare Against Active Users

```bash
# Are real users driving this?
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

# Per-user request rate — top 20
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=topk(20, sum by (user_id) (rate(armored_archer_rpc_requests_total[1m])))' \
  | jq '.data.result[]'
```

---

## 🔧 Troubleshooting Steps

### Step 1: Pinpoint the Hot RPC

```bash
# Top RPCs by RPS
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=topk(5, sum by (rpc) (rate(armored_archer_rpc_requests_total[1m])))' \
  | jq '.data.result[]'

# Error rate per RPC — high RPS + high errors = bad client loop
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (rpc) (rate(armored_archer_rpc_errors_total[1m])) / sum by (rpc) (rate(armored_archer_rpc_requests_total[1m]))' \
  | jq '.data.result[] | select(.value[1] | tonumber > 0.05)'
```

### Step 2: Look for Source IPs and ASNs

```bash
# Top source IPs (Nginx / reverse-proxy access log)
docker logs nginx --tail 10000 2>/dev/null | \
  awk '{print $1}' | sort | uniq -c | sort -rn | head -20

# Per-IP request count from Nakama logs (if logging client IP)
docker logs nakama --tail 1000 | grep -oE 'client_ip=[0-9.]+' | sort | uniq -c | sort -rn | head -20
```

### Step 3: Check Rate Limit Hits

```bash
# rate_limit violations are the signal that the limiter is engaging
curl -s http://nakama:7350/metrics | grep -iE "rate_limit|429"
grep -n "rate_limit_exceeded" backend/src/modules/rate_limit.ts | head -10
```

### Step 4: Cross-Reference With Other Alerts

```bash
# Active users anomaly (related signal)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

# If active_users is normal but RPC rate is high → bots, not real users
# See the SuspiciousLoginActivity runbook for the credential-stuffing case
cat docs/runbooks/SuspiciousLoginActivity.md
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Legitimate Traffic Spike

```bash
# Confirm: active_users is up too
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

# Scale horizontally
docker-compose up -d --scale nakama=3
docker stats --no-stream
```

### Scenario 2: Single Hot RPC Loop / Bad Client

```bash
# 1. Identify the RPC and the caller user_id
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=topk(5, sum by (rpc, user_id) (rate(armored_archer_rpc_requests_total[1m])))' \
  | jq '.data.result[]'

# 2. Per-RPC rate limit if not already configured
grep -n "DEFAULT_RATE_LIMITS" backend/src/modules/rate_limit.ts | head -5
# Add / tighten the limit for the offending RPC and redeploy
docker-compose build nakama && docker-compose up -d nakama

# 3. Communicate with the user / client team
gh issue create --repo anchapin/armored-archer \
  --title "[Infra] Client <team> hammering <rpc>" \
  --label "client,rate-limit" \
  --body "Detected via UnusualAPICallPattern at $(date -u)."
```

### Scenario 3: Bot / DDoS

```bash
# 1. Top source IPs and ASNs
docker logs nginx --tail 10000 2>/dev/null | \
  awk '{print $1}' | sort | uniq -c | sort -rn | head -20

# 2. Engage WAF/CDN: block offending ASNs or IP ranges
# Coordinate with infra — see docs/SECURITY.md for escalation

# 3. Throttle at the edge temporarily
# (Depends on the CDN in use; see infra runbook)
```

### Scenario 4: Scheduled Job or Replay Worker

```bash
# Match replay (match_replay.ts) can hammer read endpoints during fairness checks
grep -n "rpcGetMatchReplay\|rpcListMatchReplays" backend/src/modules/match_replay.ts | head -10

# Pause if it correlates with the spike
docker exec postgres psql -U postgres -c \
  "UPDATE scheduled_jobs SET status='paused' WHERE name='match_replay';"
```

### Scenario 5: Misconfigured Client Build

```bash
# If a recent client version is polling too aggressively, push a hotfix
git log --oneline -10 -- client/

# Force-update via the ClientVersionMismatch path; see that runbook
cat docs/runbooks/ClientVersionMismatch.md
```

---

## ✅ Verification

```bash
# 1. Request rate back to baseline
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_requests_total[1m])' \
  | jq '.data.result[] | select(.value[1] | tonumber > 1000)'

# 2. Error rate normal
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_errors_total[5m]) / rate(armored_archer_rpc_requests_total[5m])' \
  | jq '.data.result[0].value[1]'

# 3. Alert cleared
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="UnusualAPICallPattern") | .status.state'
```

---

## 📊 Post-Incident Actions

1. **Add per-RPC rate limits** to the offender (see `backend/src/modules/rate_limit.ts`).
2. **Tune** the alert threshold if 1000 req/min is the new normal after growth.
3. **File a follow-up** with the infra team if WAF/CDN rules need to be permanent.
4. **Coordinate with the client team** if the cause is a polling loop.
5. **Cross-link** with [SuspiciousLoginActivity](./SuspiciousLoginActivity.md) and [HighCPUUsage](./HighCPUUsage.md) when both fire.

---

## 🔗 Related Resources

- [Metrics module](../../backend/src/modules/metrics.ts)
- [Rate Limit module](../../backend/src/modules/rate_limit.ts)
- [RPC Latency Tracker](../../backend/src/modules/rpc_latency_tracker.ts)
- [Security Guide](../SECURITY.md)
- [SuspiciousLoginActivity runbook](./SuspiciousLoginActivity.md)
- [HighCPUUsage runbook](./HighCPUUsage.md)
- Grafana → *API / RPC* dashboard: `http://grafana:3000/d/armored-archer-api`

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Backend Team**: `#backend-team` Slack channel
- **Security Team**: `#security` Slack channel
- **Infrastructure**: `#infra` Slack channel
- **Frontend / Client Team**: `#frontend` Slack channel