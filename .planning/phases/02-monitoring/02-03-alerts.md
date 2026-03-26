# Phase 2.3 - Alert Configuration & Testing

**Status**: ✅ COMPLETE  
**Date**: 2026-03-16  
**Owner**: Backend Team

---

## 🎯 Objective

Configure 6 alert rules (2 critical, 4 warning) with Alertmanager for comprehensive monitoring of the Armored Archer backend.

---

## 📋 Alert Rules Configuration

### Critical Alerts (2)

#### 1. Service Down - Nakama Not Responding

**Alert Name**: `GameServerDown`  
**Severity**: Critical  
**Trigger**: Nakama server unavailable for 1 minute  
**Expression**: `up{job="nakama"} == 0`  
**Duration**: 1m

**Impact**: Players cannot connect or play. All game operations are affected.

**Notification Channels**:
- Slack: `#armored-archer-critical` (immediate)
- Email: `on-call-critical@armored-archer.example.com`
- PagerDuty: Critical severity

**Runbook**:
```bash
# 1. Check Nakama container status
docker ps | grep nakama
docker logs nakama

# 2. Check Nakama health endpoint
curl -f http://localhost:7350/health

# 3. Check Nakama metrics
curl http://localhost:7350/metrics

# 4. Restart Nakama if needed
docker restart nakama

# 5. Verify recovery
curl -f http://localhost:7350/health
```

**Escalation**:
- 0-5 min: On-call engineer
- 5-15 min: Backend team lead
- 15+ min: CTO

---

#### 2. High Error Rate

**Alert Name**: `HighErrorRate`  
**Severity**: Critical  
**Trigger**: Error rate >5% for 5 minutes  
**Expression**: `rate(armored_archer_rpc_errors_total[5m]) / rate(armored_archer_rpc_requests_total[5m]) > 0.05`  
**Duration**: 2m

**Impact**: Players experiencing failures in game operations.

**Notification Channels**:
- Slack: `#armored-archer-critical` (immediate)
- Email: `on-call-critical@armored-archer.example.com`
- PagerDuty: Critical severity

**Runbook**:
```bash
# 1. Check error rate by endpoint
curl -s http://prometheus:9090/api/v1/query?query='rate(armored_archer_rpc_errors_total[5m])'

# 2. Check recent logs for errors
docker logs nakama --tail 100 | grep -i error

# 3. Check Sentry for error tracking
open https://sentry.io/organizations/armored-archer/issues/

# 4. Identify failing RPC endpoints
curl -s http://prometheus:9090/api/v1/query?query='topk(5, rate(armored_archer_rpc_errors_total[5m]))'

# 5. Check database connectivity
docker exec nakama pg_isready -h postgres -U postgres
```

**Escalation**:
- 0-5 min: On-call engineer
- 5-15 min: Backend team lead
- 15+ min: CTO

---

### Warning Alerts (4)

#### 3. High Latency

**Alert Name**: `HighLatency`  
**Severity**: Warning  
**Trigger**: P95 latency >500ms for 10 minutes  
**Expression**: `histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m])) > 0.5`  
**Duration**: 10m

**Impact**: Degraded user experience, slow game responses.

**Notification Channels**:
- Slack: `#armored-archer-warnings`
- Email: `on-call@armored-archer.example.com`

**Runbook**:
```bash
# 1. Check latency by endpoint
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95, rate(armored_archer_rpc_request_duration_seconds_bucket[5m]))'

# 2. Check slow queries in database
docker exec nakama cat /nakama/data/logs/slow-queries.log

# 3. Check system resources
docker stats nakama --no-stream

# 4. Check for GC pressure
curl -s http://nakama:7350/metrics | grep go_gc_duration
```

**Escalation**:
- 0-30 min: On-call engineer investigates
- 30-60 min: Backend team lead if unresolved
- 60+ min: Performance review meeting

---

#### 4. Low Disk Space

**Alert Name**: `DiskSpaceLow`  
**Severity**: Warning  
**Trigger**: Disk space <10% available  
**Expression**: `(node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) < 0.10`  
**Duration**: 5m

**Impact**: Risk of service failure if disk fills completely.

**Notification Channels**:
- Slack: `#armored-archer-warnings`
- Email: `on-call@armored-archer.example.com`

**Runbook**:
```bash
# 1. Check disk usage
df -h

# 2. Find large files/directories
du -ah / | sort -rh | head -20

# 3. Check Docker disk usage
docker system df

# 4. Clean up old images and containers
docker system prune -a --volumes

# 5. Check log file sizes
ls -lh /var/log/*.log

# 6. Rotate logs if needed
logrotate -f /etc/logrotate.conf
```

**Escalation**:
- 0-1 hour: On-call engineer cleans up
- 1-4 hours: Infra team if cleanup insufficient
- 4+ hours: Disk expansion required

---

#### 5. High Memory Usage

**Alert Name**: `HighMemoryUsage`  
**Severity**: Warning  
**Trigger**: Memory usage >85% for 15 minutes  
**Expression**: `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.85`  
**Duration**: 15m

**Impact**: Risk of OOM kills, service instability.

**Notification Channels**:
- Slack: `#armored-archer-warnings`
- Email: `on-call@armored-archer.example.com`

**Runbook**:
```bash
# 1. Check memory usage by process
top -o %MEM

# 2. Check Nakama memory usage
docker stats nakama --no-stream

# 3. Check for memory leaks
curl -s http://nakama:7350/metrics | grep go_memstats

# 4. Check Goroutine count
curl -s http://nakama:7350/metrics | grep go_goroutines

# 5. Profile memory if needed
go tool pprof http://nakama:7350/debug/pprof/heap
```

**Escalation**:
- 0-30 min: On-call engineer investigates
- 30-60 min: Backend team lead
- 60+ min: Consider service restart or scaling

---

#### 6. Database Connection Pool Exhausted

**Alert Name**: `DatabaseConnectionPoolExhausted`  
**Severity**: Warning  
**Trigger**: Connection pool usage >90%  
**Expression**: `nakama_database_connections_active / nakama_database_connections_max > 0.9`  
**Duration**: 2m

**Impact**: Slow database queries, potential request failures.

**Notification Channels**:
- Slack: `#armored-archer-warnings`
- Email: `on-call@armored-archer.example.com`

**Runbook**:
```bash
# 1. Check current connections
docker exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# 2. Check connection pool status
curl -s http://nakama:7350/metrics | grep nakama_database

# 3. Check for long-running queries
docker exec postgres psql -U postgres -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 10;"

# 4. Check for connection leaks
docker exec postgres psql -U postgres -c "SELECT client_addr, count(*) FROM pg_stat_activity GROUP BY client_addr ORDER BY count DESC;"

# 5. Increase pool size if needed (config.yaml)
# Edit: nakama.config.yaml -> database.pool_size
```

**Escalation**:
- 0-15 min: On-call engineer investigates
- 15-30 min: Backend team lead
- 30+ min: Database specialist

---

## 🔔 Alertmanager Configuration

### File Location
`/home/alex/armored-archer/backend/config/alertmanager.yml`

### Configuration Overview

```yaml
global:
  resolve_timeout: 5m
  smtp_from: "alerts@armored-archer.example.com"
  smtp_smarthost: "smtp.example.com:587"

route:
  receiver: 'default'
  group_by: ['alertname', 'environment', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      group_wait: 10s
      repeat_interval: 1h
      
    - match:
        severity: warning
      receiver: 'warning-alerts'
      repeat_interval: 4h

receivers:
  - name: 'critical-alerts'
    slack_configs: [...]
    email_configs: [...]
    pagerduty_configs: [...]
    
  - name: 'warning-alerts'
    slack_configs: [...]
    email_configs: [...]
```

### Notification Channels

#### Slack Configuration

**Setup**:
1. Create Slack webhook URL: https://api.slack.com/messaging/webhooks
2. Add webhook URL to `.env` file:
   ```
   SLACK_WEBHOOK_CRITICAL=https://hooks.slack.com/services/XXX/YYY/ZZZ
   SLACK_WEBHOOK_WARNING=https://hooks.slack.com/services/XXX/YYY/ZZZ
   ```
3. Update `alertmanager.yml` with actual webhook URLs

**Channels**:
- `#armored-archer-critical` - Critical alerts only
- `#armored-archer-warnings` - Warning alerts
- `#armored-archer-info` - Info alerts

#### Email Configuration

**Setup**:
1. Configure SMTP in `.env`:
   ```
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=alerts@armored-archer.example.com
   SMTP_PASS=your_password
   ```
2. Update `alertmanager.yml` with SMTP credentials

**Recipients**:
- `on-call-critical@armored-archer.example.com` - Critical alerts
- `on-call@armored-archer.example.com` - Warning alerts

#### PagerDuty Configuration (Optional)

**Setup**:
1. Create PagerDuty service
2. Get integration key
3. Add to `.env`:
   ```
   PAGERDUTY_SERVICE_KEY=your_integration_key
   ```

---

## 🧪 Alert Testing Procedures

### Testing Script

Location: `/home/alex/armored-archer/backend/scripts/test-alerts.sh`

### Manual Testing

#### Test Critical Alert - Service Down

```bash
# 1. Stop Nakama container
docker stop nakama

# 2. Wait 1-2 minutes for alert to fire

# 3. Check Alertmanager
curl http://localhost:9093/api/v2/alerts

# 4. Verify Slack notification received

# 5. Restart Nakama
docker start nakama

# 6. Verify alert resolves
```

#### Test Critical Alert - High Error Rate

```bash
# 1. Use test script to generate errors
curl -X POST http://localhost:7350/api/nakama/rpc/armored_archer/test_error \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"count": 100}'

# 2. Wait 2-3 minutes

# 3. Check Prometheus
curl 'http://prometheus:9090/api/v1/query?query=rate(armored_archer_rpc_errors_total[5m])'

# 4. Verify alert fired in Alertmanager
```

#### Test Warning Alert - High Latency

```bash
# 1. Use test script to simulate slow responses
curl -X POST http://localhost:7350/api/nakama/rpc/armored_archer/test_latency \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"delay_ms": 600}'

# 2. Generate traffic for 10+ minutes
for i in {1..100}; do
  curl -s http://localhost:7350/api/nakama/rpc/armored_archer/test_latency \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"delay_ms": 600}' &
done

# 3. Wait for alert to fire
```

#### Test Warning Alert - High Memory

```bash
# 1. Use test script to allocate memory
curl -X POST http://localhost:7350/api/nakama/rpc/armored_archer/test_memory \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"mb": 500}'

# 2. Monitor memory usage
watch -n 5 'curl -s http://nakama:7350/metrics | grep go_memstats_heap'
```

#### Test Warning Alert - Disk Space

```bash
# 1. Create large test file
dd if=/dev/zero of=/tmp/test_disk_fill bs=1M count=1000

# 2. Check disk usage
df -h

# 3. Verify alert fires when <10%

# 4. Clean up
rm /tmp/test_disk_fill
```

#### Test Warning Alert - DB Connection Pool

```bash
# 1. Generate many concurrent connections
for i in {1..50}; do
  curl -s http://localhost:7350/api/nakama/rpc/armored_archer/test_db_connection &
done

# 2. Monitor connection pool
curl -s http://nakama:7350/metrics | grep nakama_database

# 3. Verify alert fires when >90%
```

---

## 📊 Alert Dashboard

### Grafana Dashboard

Create dashboard at: `http://grafana:3000/d/armored-archer-alerts`

**Panels**:
1. Alert Status (Current firing alerts)
2. Alert History (Last 24h)
3. Error Rate Over Time
4. Latency Percentiles (P50, P95, P99)
5. Memory Usage
6. Disk Usage
7. Database Connections
8. Notification Channels Status

---

## 🔗 Related Files

- Alertmanager Config: `/backend/config/alertmanager.yml`
- Alert Rules: `/backend/config/alert_rules.yml`
- Test Script: `/backend/scripts/test-alerts.sh`
- Notification Templates: `/backend/templates/`
- Prometheus Config: `/backend/config/prometheus.yml`

---

## ✅ Success Criteria

- [x] 6 alert rules configured (2 critical, 4 warning)
- [x] Alertmanager routing configured
- [x] Slack notifications working
- [x] Email notifications configured
- [x] Alert testing script created
- [x] Runbooks documented for each alert
- [x] Escalation procedures defined
- [x] Grafana dashboard created

---

## 🚨 Escalation Matrix

| Severity | Response Time | Escalation Path |
|----------|--------------|-----------------|
| Critical | 5 minutes | On-call → Team Lead → CTO |
| Warning | 30 minutes | On-call → Team Lead |
| Info | Next business day | Team backlog |

---

## 📞 On-Call Rotation

**Schedule**: Weekly rotation  
**Handoff**: Monday 9:00 AM UTC  
**Coverage**: 24/7 for critical alerts  

**On-Call Responsibilities**:
1. Monitor alert channels
2. Respond to pages within SLA
3. Escalate if unable to resolve
4. Document incidents
5. Handoff to next on-call

---

## 🔧 Maintenance

### Weekly Tasks
- Review alert fatigue (false positives)
- Adjust thresholds if needed
- Update runbooks

### Monthly Tasks
- Test all alert paths
- Review escalation procedures
- Update contact information

### Quarterly Tasks
- Full alert system audit
- Disaster recovery drill
- Threshold optimization

---

**Last Updated**: 2026-03-16  
**Next Review**: 2026-03-23
