# Runbook: MatchmakingQueueBuilding

**Alert Name**: `MatchmakingQueueBuilding`
**Severity**: Warning
**Last Updated**: 2026-08-18

---

## ⚠️ Alert Definition

**Expression**: `armored_archer_matchmaking_queue_size > 100`
**Duration**: 5 minutes
**Impact**: More than 100 players queued for more than 5 minutes. Players churn out of matches and into frustration; PvP session length and conversion to IAP both suffer. Either matchmaking is too strict, there are not enough concurrent players, or the PvP pipeline is degraded.

---

## 📞 Escalation Path

1. **0-15 minutes**: On-call engineer investigates.
2. **15-30 minutes**: Backend team lead and PvP product owner.
3. **30+ minutes**: Open a P2; consider matchmaking parameter tuning with QA.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Current queue size
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_matchmaking_queue_size' \
  | jq '.data.result[]'

# Queue trend over the last 30 minutes
curl -s 'http://prometheus:9090/api/v1/query_range' \
  -G --data-urlencode 'query=armored_archer_matchmaking_queue_size' \
  --data-urlencode 'start='"$(date -u -d '30 minutes ago' +%s)" \
  --data-urlencode 'end='"$(date -u +%s)" \
  --data-urlencode 'step=60' | jq '.data.result[].values'

# Alertmanager state
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="MatchmakingQueueBuilding")'
```

### 2. Inspect the Matchmaker Source

```bash
# Queue instrumentation lives in health_monitor.ts:70 (armored_archer_health_match_queue_size)
# and metrics.ts:115 (armored_archer_match_queue_size)
grep -n "healthCheckMatchQueue\|matchQueueSize\|setMatchQueueSize" backend/src/modules/health_monitor.ts backend/src/modules/metrics.ts | head -10

# Matchmaker module — look for rank, punch-up matching, and any recent tweaks
grep -n "calculateRank\|isPunchUpMatch\|MATCHMAKING_ANALYTICS_TARGETS" backend/src/modules/matchmaker.ts backend/src/modules/matchmaking_analytics.ts | head -20
git log --oneline -10 -- backend/src/modules/matchmaker.ts
```

### 3. Read the Analytics

```bash
# Queue-time analytics — median and P95 wait
docker exec postgres psql -U postgres -c \
  "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY queue_time) AS p50,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY queue_time) AS p95,
          count(*) AS n
   FROM matchmaking_queue_times
   WHERE created_at > now() - interval '1 hour';"
```

---

## 🔧 Troubleshooting Steps

### Step 1: Are There Enough Players?

```bash
# Active users — if low, queue depth is expected
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

# PvP-active users (if you have a labelled counter)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users{mode="pvp"}' \
  | jq '.data.result[0].value[1]'
```

### Step 2: Recent Matchmaker Changes

```bash
# Pull recent diffs to matchmaker.ts
git log --oneline -10 -- backend/src/modules/matchmaker.ts
git show HEAD -- backend/src/modules/matchmaker.ts | head -80

# Match replay worker can also drain the queue
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FROM scheduled_jobs WHERE name='match_replay' AND status='running';"
```

### Step 3: Look for Stuck Tickets

```bash
# Sample of tickets currently in the pool
docker exec postgres psql -U postgres -c \
  "SELECT user_id, created_at, now()-created_at AS age
   FROM matchmaking_pool
   ORDER BY created_at ASC
   LIMIT 20;"

# Tickets stuck > 5 minutes
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FROM matchmaking_pool
   WHERE now() - created_at > interval '5 minutes';"
```

### Step 4: Cross-Check Server-Authoritative Combat

```bash
# Confirm the duel / combat pipeline is not regressed
grep -n "rpcSubmitCombatAction\|combat_action" backend/src/modules/combat_system.ts | head -10

# Server error rate on PvP RPCs
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (rpc) (rate(armored_archer_rpc_errors_total{component="pvp"}[5m]))' \
  | jq '.data.result[]'
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Off-Peak Hours / Low Player Count

```bash
# Confirm active_users is the cause
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

# No action required; alert is informational. Consider raising the threshold
# for off-peak hours via the rules file or silencing in Alertmanager.
```

### Scenario 2: Matchmaker Parameter Drift

```bash
# Inspect the most recent tuning change
git log --oneline -10 -- backend/src/modules/matchmaker.ts
git show HEAD -- backend/src/modules/matchmaker.ts | head -80

# Roll back to a known-good config
git revert <sha>
docker-compose build nakama && docker-compose up -d nakama
```

### Scenario 3: Stuck Tickets From a Worker Crash

```bash
# Drain stale tickets
docker exec postgres psql -U postgres -c \
  "DELETE FROM matchmaking_pool
   WHERE now() - created_at > interval '15 minutes'
   AND status='queued';"

# Restart the matchmaking worker
docker restart nakama
docker logs nakama --tail 100 | grep -i matchmaker
```

### Scenario 4: Bad Deployment Broke the Duel Pipeline

```bash
# Roll back
git log --oneline --since="1 hour ago" -- backend/
git revert <sha>
docker-compose build nakama && docker-compose up -d nakama
```

### Scenario 5: Region / Latency Routing Misbehaving

```bash
# Confirm region distribution in the queue
docker exec postgres psql -U postgres -c \
  "SELECT region, count(*) FROM matchmaking_pool GROUP BY region ORDER BY 2 DESC;"

# If a region is over-represented, consider rebalancing — coordinate with infra
```

---

## ✅ Verification

```bash
# 1. Queue draining
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_matchmaking_queue_size' \
  | jq '.data.result[] | select(.value[1] | tonumber > 100)'

# 2. Median queue time recovered
docker exec postgres psql -U postgres -c \
  "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY queue_time) AS p50
   FROM matchmaking_queue_times
   WHERE created_at > now() - interval '15 minutes';"

# 3. Alert cleared
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="MatchmakingQueueBuilding") | .status.state'
```

---

## 📊 Post-Incident Actions

1. **Tune matchmaker** parameters with QA — see [`docs/MATCHMAKER.md`](../MATCHMAKER.md).
2. **Add capacity** or scheduled off-peak bot matches if the queue regularly builds at night.
3. **Improve the dashboard** with median queue time and queue age histograms.
4. **File a follow-up** if the alert threshold (100) needs tuning for the new player base.

---

## 🔗 Related Resources

- [Matchmaker module](../../backend/src/modules/matchmaker.ts)
- [Matchmaking Analytics module](../../backend/src/modules/matchmaking_analytics.ts)
- [Health Monitor module](../../backend/src/modules/health_monitor.ts)
- [Metrics module](../../backend/src/modules/metrics.ts)
- [Matchmaker overview](../MATCHMAKER.md)
- [Async Duel Lifecycle](../ASYNC_DUEL_LIFECYCLE.md)
- Grafana → *Matchmaking* dashboard: `http://grafana:3000/d/armored-archer-matchmaking`

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Backend Team**: `#backend-team` Slack channel
- **Product Team (PvP)**: `#product` Slack channel
- **QA Team**: `#qa` Slack channel (for tuning changes)
- **Live Ops**: `#live-ops` Slack channel