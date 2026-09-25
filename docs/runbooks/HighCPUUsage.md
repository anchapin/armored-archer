# Runbook: HighCPUUsage

**Alert Name**: `HighCPUUsage`
**Severity**: Warning
**Last Updated**: 2026-08-18

---

## ⚠️ Alert Definition

**Expression**: `100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80`
**Duration**: 5 minutes
**Impact**: Game server CPU sustained >80%. Symptoms: rising RPC latency, slower matchmaking, higher matchmaking queue depth, potential timeouts under load.

---

## 📞 Escalation Path

1. **0-30 minutes**: On-call engineer investigates
2. **30-60 minutes**: Backend team lead if sustained
3. **60+ minutes**: Capacity / infra team for horizontal scaling decision

Post status updates in `#armored-archer-warnings`.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Per-instance CPU usage
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)' \
  | jq '.data.result[]'

# Top CPU consumers (host)
top -bn1 -o %CPU | head -15

# Docker-level CPU
docker stats --no-stream | sort -k3 -h
```

### 2. Cross-Reference the Health Module

```bash
# Canonical app-side gauge (defined at backend/src/modules/health_monitor.ts:27)
curl -s http://nakama:7350/metrics | grep armored_archer_health_cpu_usage_percent

# Confirm RPC request volume is the cause (or not)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_requests_total[1m])' \
  | jq '.data.result[0].value[1]'
```

---

## 🔧 Troubleshooting Steps

### Step 1: Identify the Hot Process

```bash
# Container-level CPU breakdown
docker stats --no-stream

# Process tree inside Nakama container
docker exec nakama sh -c "ps -eo pid,ppid,pcpu,pmem,comm --sort=-pcpu | head -20"

# Go goroutine count — a runaway loop often shows up here
curl -s http://nakama:7350/metrics | grep go_goroutines
```

### Step 2: Correlate With RPC Hotspots

```bash
# Endpoints driving the load (top 5 by RPS)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=topk(5, sum by (rpc) (rate(armored_archer_rpc_requests_total[5m])))' \
  | jq '.data.result[]'

# Endpoints with elevated error rate (often the cause during a hot loop)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (rpc) (rate(armored_archer_rpc_errors_total[5m])) / sum by (rpc) (rate(armored_archer_rpc_requests_total[5m]))' \
  | jq '.data.result[] | select(.value[1] | tonumber > 0.05)'
```

### Step 3: Check Matchmaking and Match Loops

```bash
# PvP matchmaking is the most common CPU consumer — see backend/src/modules/matchmaker.ts:1
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_matchmaking_queue_size' \
  | jq '.data.result[0].value[1]'

# Open matches being simulated
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FROM matches WHERE status='in_progress';"
```

### Step 4: Look for Bad Deploys / GC Pressure

```bash
# Recent commits that could explain a regression
git log --oneline -10 -- backend/

# GC pauses — frequent GC = CPU burner
curl -s http://nakama:7350/metrics | grep go_gc_duration_seconds

# CPU quota throttling?
docker inspect nakama --format '{{.HostConfig.CpuQuota}} / {{.HostConfig.CpuPeriod}}'
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Traffic Spike

```bash
# Confirm via active-users gauge
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

# Scale horizontally
docker-compose up -d --scale nakama=3

# Verify load balanced
docker stats --no-stream
```

### Scenario 2: Runaway Goroutine / Hot Loop

```bash
# Capture CPU profile for 30s, then inspect
go tool pprof http://nakama:7350/debug/pprof/profile?seconds=30
# Inside pprof: top10, peek, list <function>

# If a recent deploy introduced the regression
git log --oneline --since="1 hour ago" -- backend/
git revert <sha>
docker-compose build nakama && docker-compose up -d nakama
```

### Scenario 3: Matchmaking Saturation

```bash
# Drain the queue by widening match criteria temporarily (advisory only —
# product/QA must approve widening pools before you change matchmaker knobs)
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FROM matchmaking_pool;"

# See matchmaker.ts for rank and punch-up knobs before changing
grep -n "calculateRank\|isPunchUpMatch\|PunchUp" backend/src/modules/matchmaker.ts | head -20
```

### Scenario 4: CPU Quota Throttling

```bash
docker inspect nakama --format '{{.HostConfig.CpuQuota}}'
# Raise in docker-compose.yml under deploy.resources.limits.cpus
docker-compose up -d nakama
```

### Scenario 5: Backup or Cron Job Running

```bash
# Check for nightly jobs that hit CPU during off-hours
docker exec postgres psql -U postgres -c \
  "SELECT pid, query, now()-query_start AS duration FROM pg_stat_activity WHERE state='active' ORDER BY duration DESC LIMIT 5;"

# CPU should recover once the cron completes; no action needed
```

---

## ✅ Verification

```bash
# 1. CPU usage back under threshold
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)' \
  | jq '.data.result[] | select(.value[1] | tonumber < 80)'

# 2. Latency normalised
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=histogram_quantile(0.95, rate(armored_archer_rpc_duration_seconds_bucket[5m]))' \
  | jq '.data.result[0].value[1]'

# 3. Alert cleared
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="HighCPUUsage") | .status.state'
```

---

## 📊 Post-Incident Actions

1. Save the CPU profile artifact to the incident ticket.
2. If a single RPC dominated, file a perf follow-up with that endpoint owner.
3. Update capacity-planning docs if the alert fires at expected peak traffic.
4. Consider lowering the alert threshold (`>70`) for early warning if traffic is climbing.

---

## 🔗 Related Resources

- [Go CPU profiling](https://golang.org/doc/diagnostics.html#profiling)
- [Docker resource constraints](https://docs.docker.com/config/containers/resource_constraints/)
- [Health Monitor module](../../backend/src/modules/health_monitor.ts)
- [Matchmaker module](../../backend/src/modules/matchmaker.ts)
- [HighLatency runbook](./HighLatency.md)
- Grafana → *Nakama / Compute* dashboard: `http://grafana:3000/d/nakama-server`

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Backend Team**: `#backend-team` Slack channel
- **Infrastructure**: `#infra` Slack channel
- **Performance Team**: `#performance` Slack channel