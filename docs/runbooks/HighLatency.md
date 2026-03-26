# Runbook: HighLatency

**Alert Name**: `HighLatency`  
**Severity**: Warning  
**Last Updated**: 2026-03-16

---

## ⚠️ Alert Definition

**Expression**: `histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m])) > 0.5`  
**Duration**: 10 minutes  
**Impact**: Degraded user experience with slow game responses, delayed combat actions, and laggy UI interactions.

---

## 📞 Escalation Path

1. **0-30 minutes**: On-call engineer investigates
2. **30-60 minutes**: Backend team lead if unresolved
3. **60+ minutes**: Performance review meeting

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Check current P95 latency
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m]))' \
  | jq '.data.result[0].value[1]'

# Check all latency percentiles
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=histogram_quantile(0.50, rate(armored_archer_rpc_request_duration_seconds_bucket[5m]))' \
  | jq '.data.result[0].value[1]'  # P50

curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=histogram_quantile(0.99, rate(armored_archer_rpc_request_duration_seconds_bucket[5m]))' \
  | jq '.data.result[0].value[1]'  # P99
```

### 2. Identify Slow Endpoints

```bash
# Latency by endpoint (P95)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=topk(5, histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m])))' \
  | jq '.data.result[]'

# Find endpoints with P95 > 500ms
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m]))' \
  | jq '.data.result[] | select(.value[1] | tonumber > 0.5)'
```

---

## 🔧 Troubleshooting Steps

### Step 1: Check System Resources

```bash
# CPU usage
docker stats nakama --no-stream

# Memory usage
docker stats nakama --no-stream

# Check for CPU throttling
docker inspect nakama | jq '.[0].HostConfig.CpuQuota'

# Check I/O wait
iostat -x 1 5
```

### Step 2: Check Database Performance

```bash
# Check for slow queries
docker exec postgres psql -U postgres -c \
  "SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 10;"

# Check database connections
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=nakama_database_connections_active' \
  | jq '.data.result[0].value[1]'

# Check query performance
docker exec postgres psql -U postgres -c \
  "SELECT query, calls, mean_exec_time, total_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

### Step 3: Check Garbage Collection

```bash
# Check GC duration
curl -s http://nakama:7350/metrics | grep go_gc_duration

# Check GC frequency
curl -s http://nakama:7350/metrics | grep go_gc_duration_seconds_count

# Check heap size
curl -s http://nakama:7350/metrics | grep go_memstats_heap_alloc_bytes
```

### Step 4: Check Network

```bash
# Check network latency to database
docker exec nakama ping -c 5 postgres

# Check for packet loss
docker exec nakama mtr -rwc 10 postgres

# Check network throughput
iftop -P -n
```

### Step 5: Profile Application

```bash
# Start CPU profiling (30 seconds)
go tool pprof http://nakama:7350/debug/pprof/profile?seconds=30

# Start memory profiling
go tool pprof http://nakama:7350/debug/pprof/heap

# Check goroutine count
curl -s http://nakama:7350/metrics | grep go_goroutines
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Database Slow Queries

```bash
# 1. Identify slow queries
docker exec postgres psql -U postgres -c \
  "SELECT query, mean_exec_time FROM pg_stat_statements WHERE mean_exec_time > 1000 ORDER BY mean_exec_time DESC LIMIT 5;"

# 2. Add indexes if needed
# (Work with DBA to add appropriate indexes)

# 3. Optimize queries
# (Work with backend team to optimize slow queries)

# 4. Monitor improvement
watch -n 10 'curl -s "http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m]))" | jq ".data.result[0].value[1]"'
```

### Scenario 2: Resource Constraints

```bash
# 1. Check current limits
docker inspect nakama | jq '.[0].HostConfig | {Memory: .Memory, CpuQuota: .CpuQuota}'

# 2. Increase resources in docker-compose.yml
# Edit: deploy.resources.limits

# 3. Restart with new limits
docker-compose up -d nakama

# 4. Monitor performance
docker stats nakama
```

### Scenario 3: High Traffic

```bash
# 1. Check request rate
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_requests_total[1m])' \
  | jq '.data.result[0].value[1]'

# 2. Check active users
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

# 3. Scale horizontally
docker-compose up -d --scale nakama=3

# 4. Verify load balancing
watch -n 5 'docker stats --no-stream'
```

### Scenario 4: Memory Pressure

```bash
# 1. Check memory usage
docker stats nakama --no-stream

# 2. Check for memory leaks
curl -s http://nakama:7350/metrics | grep go_memstats_heap_alloc_bytes

# 3. Force GC (temporary fix)
curl -s http://nakama:7350/debug/pprof/heap?gc=1

# 4. Restart if necessary
docker restart nakama
```

---

## ✅ Verification

After resolution, verify:

```bash
# 1. P95 latency below threshold
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m]))' \
  | jq '.data.result[0].value[1] | tonumber < 0.5'

# 2. All endpoints performing well
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m]))' \
  | jq '.data.result[] | select(.value[1] | tonumber > 0.5)'

# 3. Alert resolved
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="HighLatency") | .status.state'
```

---

## 📊 Post-Incident Actions

1. **Performance profiling**
   - Run load tests to identify bottlenecks
   - Profile slow endpoints
   - Optimize database queries

2. **Monitoring improvements**
   - Add per-endpoint latency alerts
   - Set up latency budget tracking
   - Create performance dashboard

3. **Capacity planning**
   - Review traffic patterns
   - Plan for scaling needs
   - Optimize resource allocation

---

## 🔗 Related Resources

- [Go Performance Profiling](https://golang.org/doc/diagnostics.html)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
- [Grafana Latency Dashboard](http://grafana:3000/d/armored-archer-latency)

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Backend Team**: #backend-team Slack channel
- **Performance Team**: #performance Slack channel
