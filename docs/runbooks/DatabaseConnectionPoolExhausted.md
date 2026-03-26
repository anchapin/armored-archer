# Runbook: DatabaseConnectionPoolExhausted

**Alert Name**: `DatabaseConnectionPoolExhausted`  
**Severity**: Warning  
**Last Updated**: 2026-03-16

---

## ⚠️ Alert Definition

**Expression**: `nakama_database_connections_active / nakama_database_connections_max > 0.9`  
**Duration**: 2 minutes  
**Impact**: Slow database queries, potential request failures, degraded game performance.

---

## 📞 Escalation Path

1. **0-15 minutes**: On-call engineer investigates
2. **15-30 minutes**: Backend team lead
3. **30+ minutes**: Database specialist

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Check connection pool usage
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=nakama_database_connections_active / nakama_database_connections_max * 100' \
  | jq '.data.result[0].value[1]'

# Check active connections
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=nakama_database_connections_active' \
  | jq '.data.result[0].value[1]'

# Check max connections
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=nakama_database_connections_max' \
  | jq '.data.result[0].value[1]'
```

### 2. Check Database Connections

```bash
# Check current connections
docker exec postgres psql -U postgres -c \
  "SELECT count(*) as active_connections FROM pg_stat_activity;"

# Check connection limit
docker exec postgres psql -U postgres -c \
  "SHOW max_connections;"

# Check connections by state
docker exec postgres psql -U postgres -c \
  "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"
```

---

## 🔧 Troubleshooting Steps

### Step 1: Identify Connection Consumers

```bash
# Check connections by application
docker exec postgres psql -U postgres -c \
  "SELECT application_name, count(*) FROM pg_stat_activity GROUP BY application_name ORDER BY count DESC;"

# Check connections by user
docker exec postgres psql -U postgres -c \
  "SELECT usename, count(*) FROM pg_stat_activity GROUP BY usename ORDER BY count DESC;"

# Check connections by client
docker exec postgres psql -U postgres -c \
  "SELECT client_addr, count(*) FROM pg_stat_activity GROUP BY client_addr ORDER BY count DESC;"
```

### Step 2: Find Long-Running Queries

```bash
# Find queries running > 1 minute
docker exec postgres psql -U postgres -c \
  "SELECT pid, usename, now() - query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > interval '1 minute' ORDER BY duration DESC;"

# Find idle transactions
docker exec postgres psql -U postgres -c \
  "SELECT pid, usename, now() - query_start AS idle_time, query FROM pg_stat_activity WHERE state = 'idle in transaction' ORDER BY idle_time DESC;"

# Find locked queries
docker exec postgres psql -U postgres -c \
  "SELECT pid, usename, query, wait_event_type, wait_event FROM pg_stat_activity WHERE wait_event_type IS NOT NULL;"
```

### Step 3: Check for Connection Leaks

```bash
# Check for many connections from same source
docker exec postgres psql -U postgres -c \
  "SELECT client_addr, application_name, count(*) FROM pg_stat_activity GROUP BY client_addr, application_name HAVING count(*) > 10;"

# Check Nakama connection metrics
curl -s http://nakama:7350/metrics | grep nakama_database
```

### Step 4: Check Database Performance

```bash
# Check for locks
docker exec postgres psql -U postgres -c \
  "SELECT blocked_locks.pid AS blocked_pid, blocked_activity.usename AS blocked_user, blocking_locks.pid AS blocking_pid, blocking_activity.usename AS blocking_user, blocked_activity.query AS blocked_statement FROM pg_catalog.pg_locks blocked_locks JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid AND blocking_locks.pid != blocked_locks.pid JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid WHERE NOT blocked_locks.GRANTED;"

# Check database size
docker exec postgres psql -U postgres -c \
  "SELECT pg_size_pretty(pg_database_size('nakama'));"
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Long-Running Queries

```bash
# 1. Identify the worst offenders
docker exec postgres psql -U postgres -c \
  "SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC LIMIT 5;"

# 2. Cancel long-running queries
docker exec postgres psql -U postgres -c \
  "SELECT pg_cancel_backend(<PID>);"

# 3. If necessary, terminate connections
docker exec postgres psql -U postgres -c \
  "SELECT pg_terminate_backend(<PID>);"

# 4. Monitor pool recovery
watch -n 10 'curl -s "http://prometheus:9090/api/v1/query?query=nakama_database_connections_active / nakama_database_connections_max * 100" | jq ".data.result[0].value[1]"'
```

### Scenario 2: Idle Transactions

```bash
# 1. Find idle transactions
docker exec postgres psql -U postgres -c \
  "SELECT pid, usename, now() - query_start AS idle_time FROM pg_stat_activity WHERE state = 'idle in transaction' ORDER BY idle_time DESC;"

# 2. Terminate old idle transactions
docker exec postgres psql -U postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND now() - query_start > interval '5 minutes';"

# 3. Set idle transaction timeout (prevent future)
docker exec postgres psql -U postgres -c \
  "SET idle_in_transaction_session_timeout = 300000;"  # 5 minutes
```

### Scenario 3: Connection Leak

```bash
# 1. Identify leaking application
docker exec postgres psql -U postgres -c \
  "SELECT application_name, count(*) FROM pg_stat_activity GROUP BY application_name ORDER BY count DESC;"

# 2. Restart Nakama to reset connections
docker restart nakama

# 3. Monitor connection count
watch -n 30 'curl -s http://nakama:7350/metrics | grep nakama_database_connections_active'

# 4. Create issue to investigate leak
# Include connection metrics and timeline
```

### Scenario 4: Insufficient Pool Size

```bash
# 1. Check current pool size configuration
docker exec nakama cat /nakama/config/default.yaml | grep -A 5 pool

# 2. Increase pool size in config
# Edit Nakama configuration:
# database:
#   pool_size: 50  # Increase from default

# 3. Restart Nakama
docker-compose restart nakama

# 4. Monitor new pool usage
watch -n 30 'curl -s "http://prometheus:9090/api/v1/query?query=nakama_database_connections_active / nakama_database_connections_max * 100" | jq ".data.result[0].value[1]"'
```

### Scenario 5: Too Many Application Instances

```bash
# 1. Check number of Nakama instances
docker ps | grep nakama

# 2. Calculate total connections needed
# instances * pool_size = total connections

# 3. Reduce instances if over-provisioned
docker-compose up -d --scale nakama=2

# 4. Or increase database max_connections
# Edit postgresql.conf: max_connections = 200
docker restart postgres
```

---

## ✅ Verification

After resolution, verify:

```bash
# 1. Pool usage below threshold
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=nakama_database_connections_active / nakama_database_connections_max * 100' \
  | jq '.data.result[0].value[1] | tonumber < 90'

# 2. No long-running queries
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > interval '1 minute';"

# 3. Alert resolved
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="DatabaseConnectionPoolExhausted") | .status.state'

# 4. Database responsive
docker exec postgres psql -U postgres -c "SELECT 1;"
```

---

## 📊 Post-Incident Actions

1. **Query optimization**
   - Review and optimize slow queries
   - Add appropriate indexes
   - Implement query timeouts

2. **Connection management**
   - Review pool size configuration
   - Implement connection limits
   - Add connection monitoring

3. **Monitoring improvements**
   - Add per-endpoint query monitoring
   - Set up connection leak detection
   - Create database performance dashboard

---

## 🔗 Related Resources

- [PostgreSQL Connection Management](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Nakama Database Configuration](https://heroiclabs.com/docs/nakama/server-reference/configuration/)
- [Grafana Database Dashboard](http://grafana:3000/d/database-monitoring)

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Backend Team**: #backend-team Slack channel
- **DBA Team**: #dba Slack channel
