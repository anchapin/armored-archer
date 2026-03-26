# Runbook: HighErrorRate

**Alert Name**: `HighErrorRate`  
**Severity**: Critical  
**Last Updated**: 2026-03-16

---

## 🚨 Alert Definition

**Expression**: `rate(armored_archer_rpc_errors_total[5m]) / rate(armored_archer_rpc_requests_total[5m]) > 0.05`  
**Duration**: 2 minutes  
**Impact**: Players are experiencing failures in game operations including matchmaking, combat, and progression.

---

## 📞 Escalation Path

1. **0-5 minutes**: On-call engineer
2. **5-15 minutes**: Backend team lead
3. **15+ minutes**: CTO

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Check current error rate
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_errors_total[5m]) / rate(armored_archer_rpc_requests_total[5m])' \
  | jq '.data.result[0].value[1]'

# Check total requests and errors
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_requests_total[5m])' \
  | jq '.data.result[]'

curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_errors_total[5m])' \
  | jq '.data.result[]'
```

### 2. Identify Failing Endpoints

```bash
# Top 5 endpoints by error count
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=topk(5, sum by (rpc) (rate(armored_archer_rpc_errors_total[5m])))' \
  | jq '.data.result[]'

# Error rate by endpoint
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (rpc) (rate(armored_archer_rpc_errors_total[5m])) / sum by (rpc) (rate(armored_archer_rpc_requests_total[5m]))' \
  | jq '.data.result[] | select(.value[1] | tonumber > 0.05)'
```

### 3. Check Error Types

```bash
# Check Nakama logs for errors
docker logs nakama --tail 200 | grep -i error

# Check for specific error patterns
docker logs nakama --tail 200 | grep -E "(panic|exception|failed|timeout)" | tail -20

# Check Sentry for error tracking
open https://sentry.io/organizations/armored-archer/issues/
```

---

## 🔧 Troubleshooting Steps

### Step 1: Check Recent Deployments

```bash
# Check if recent deployment caused issues
git log --oneline -10

# Check deployment timestamp
docker inspect nakama | jq '.[0].Created'

# If recent deployment, consider rollback
git log --oneline --since="1 hour ago"
```

### Step 2: Analyze Error Patterns

```bash
# Check error distribution by type
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (error_type) (rate(armored_archer_rpc_errors_total[5m]))' \
  | jq '.data.result[]'

# Check if errors are from specific users
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (user_id) (rate(armored_archer_rpc_errors_total[5m]))' \
  | jq '.data.result[] | select(.value[1] | tonumber > 10)'
```

### Step 3: Check Database Issues

```bash
# Check database connectivity
docker exec nakama pg_isready -h postgres -U postgres

# Check for database errors
docker logs postgres --tail 100 | grep -i error

# Check connection pool
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=nakama_database_connections_active / nakama_database_connections_max * 100' \
  | jq '.data.result[0].value[1]'

# Check for slow queries
docker exec postgres psql -U postgres -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 10;"
```

### Step 4: Check External Dependencies

```bash
# Check if external APIs are responding
# (Add your external service checks here)

# Check Redis if used
docker exec redis redis-cli ping

# Check if any circuit breakers are open
curl -s http://nakama:7350/metrics | grep circuit
```

### Step 5: Check Resource Constraints

```bash
# Check CPU usage
docker stats nakama --no-stream

# Check memory usage
docker stats nakama --no-stream

# Check for GC pressure
curl -s http://nakama:7350/metrics | grep go_gc_duration
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Bad Deployment

```bash
# 1. Identify the bad commit
git log --oneline -10

# 2. Rollback to previous version
git revert HEAD

# 3. Rebuild and redeploy
docker-compose build nakama
docker-compose up -d nakama

# 4. Monitor error rate
watch -n 10 'curl -s "http://prometheus:9090/api/v1/query?query=rate(armored_archer_rpc_errors_total[5m]) / rate(armored_archer_rpc_requests_total[5m])" | jq ".data.result[0].value[1]"'
```

### Scenario 2: Database Issues

```bash
# 1. Check for locked queries
docker exec postgres psql -U postgres -c \
  "SELECT pid, usename, query, state, wait_event_type FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;"

# 2. Kill long-running queries if needed
docker exec postgres psql -U postgres -c "SELECT pg_terminate_backend(<PID>);"

# 3. Restart PostgreSQL if necessary
docker restart postgres

# 4. Wait and verify
sleep 30
docker exec postgres pg_isready
```

### Scenario 3: Resource Exhaustion

```bash
# 1. Check current resource usage
docker stats nakama --no-stream

# 2. If memory is high, check for leaks
curl -s http://nakama:7350/metrics | grep go_memstats

# 3. Restart if necessary
docker restart nakama

# 4. Consider scaling resources
# Edit docker-compose.yml to increase memory/CPU limits
```

### Scenario 4: External Service Failure

```bash
# 1. Identify failing external service
# Check logs for external API errors
docker logs nakama --tail 200 | grep -i "external\|api\|timeout"

# 2. Check service status pages
# (Add your external service status pages)

# 3. Enable circuit breaker if available
# Or implement fallback behavior

# 4. Monitor until external service recovers
```

### Scenario 5: Traffic Spike

```bash
# 1. Check current request rate
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_requests_total[1m])' \
  | jq '.data.result[0].value[1]'

# 2. Check active users
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

# 3. Scale if necessary
docker-compose up -d --scale nakama=3

# 4. Monitor error rate
```

---

## ✅ Verification

After resolution, verify:

```bash
# 1. Error rate returned to normal
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_errors_total[5m]) / rate(armored_archer_rpc_requests_total[5m])' \
  | jq '.data.result[0].value[1] | tonumber < 0.01'

# 2. All endpoints healthy
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (rpc) (rate(armored_archer_rpc_errors_total[5m])) / sum by (rpc) (rate(armored_archer_rpc_requests_total[5m]))' \
  | jq '.data.result[] | select(.value[1] | tonumber > 0.05)'

# 3. Alert resolved
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="HighErrorRate") | .status.state'

# 4. Run smoke tests
# (Add your smoke test commands)
```

---

## 📊 Post-Incident Actions

1. **Document the incident**
   - Root cause analysis
   - Affected endpoints
   - Duration of impact
   - Resolution steps

2. **Improve monitoring**
   - Add endpoint-specific error rate alerts
   - Set up error budget tracking
   - Create error type breakdown dashboard

3. **Prevent recurrence**
   - Add automated tests for failing endpoint
   - Implement circuit breakers
   - Improve error handling

---

## 🔗 Related Resources

- [Prometheus Query Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Nakama Error Handling](https://heroiclabs.com/docs/nakama/server-reference/go/#error-handling)
- [Sentry Dashboard](https://sentry.io/organizations/armored-archer/issues/)
- [Grafana Error Dashboard](http://grafana:3000/d/armored-archer-errors)

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Backend Team**: #backend-team Slack channel
- **Product Team**: #product Slack channel (for user impact assessment)
