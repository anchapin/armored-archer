# Runbook: GameServerDown

**Alert Name**: `GameServerDown`  
**Severity**: Critical  
**Last Updated**: 2026-03-16

---

## 🚨 Alert Definition

**Expression**: `up{job="nakama"} == 0`  
**Duration**: 1 minute  
**Impact**: Players cannot connect or play. All game operations are affected.

---

## 📞 Escalation Path

1. **0-5 minutes**: On-call engineer
2. **5-15 minutes**: Backend team lead
3. **15+ minutes**: CTO

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Check if Nakama is actually down
curl -f http://localhost:7350/health

# Check Prometheus target status
curl -s http://prometheus:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="nakama")'

# Check Alertmanager for alert details
curl -s http://alertmanager:9093/api/v2/alerts | jq '.[] | select(.labels.alertname=="GameServerDown")'
```

### 2. Check Container Status

```bash
# Check if Nakama container is running
docker ps | grep nakama

# Check container health
docker inspect nakama | jq '.[0].State'

# Check recent container events
docker events --since 5m --filter container=nakama
```

---

## 🔧 Troubleshooting Steps

### Step 1: Check Nakama Logs

```bash
# View last 100 log lines
docker logs nakama --tail 100

# View logs with timestamps
docker logs nakama --tail 100 -t

# Follow logs in real-time
docker logs nakama -f

# Search for errors
docker logs nakama --tail 200 | grep -i error

# Search for panics
docker logs nakama --tail 200 | grep -i panic
```

### Step 2: Check System Resources

```bash
# Check container resource usage
docker stats nakama --no-stream

# Check host system resources
free -h
df -h
top -bn1 | head -20
```

### Step 3: Check Network Connectivity

```bash
# Check if port 7350 is listening
netstat -tlnp | grep 7350

# Test local connectivity
curl -v http://localhost:7350/health

# Check Docker network
docker network ls
docker network inspect armored_archer_default
```

### Step 4: Check Database Connectivity

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Test database connection
docker exec nakama pg_isready -h postgres -U postgres

# Check database logs
docker logs postgres --tail 50
```

### Step 5: Check for OOM Kills

```bash
# Check if container was OOM killed
docker inspect nakama | jq '.[0].State.OOMKilled'

# Check system OOM events
dmesg | grep -i "out of memory" | tail -10

# Check memory limits
docker inspect nakama | jq '.[0].HostConfig.Memory'
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Container Crashed

```bash
# 1. Restart Nakama container
docker restart nakama

# 2. Wait for startup
sleep 30

# 3. Verify health
curl -f http://localhost:7350/health

# 4. Check logs for startup issues
docker logs nakama --tail 50
```

### Scenario 2: Out of Memory

```bash
# 1. Check current memory usage
docker stats nakama --no-stream

# 2. If memory is high, restart with limits
docker stop nakama
docker rm nakama

# 3. Update docker-compose.yml with memory limits
# Then restart
docker-compose up -d nakama

# 4. Monitor memory
watch -n 5 'docker stats nakama --no-stream'
```

### Scenario 3: Database Connection Failed

```bash
# 1. Check PostgreSQL status
docker ps | grep postgres

# 2. Restart PostgreSQL if needed
docker restart postgres

# 3. Wait for PostgreSQL to be ready
sleep 30
docker exec postgres pg_isready

# 4. Restart Nakama
docker restart nakama

# 5. Verify connectivity
curl -f http://localhost:7350/health
```

### Scenario 4: Configuration Error

```bash
# 1. Check Nakama configuration
docker exec nakama cat /nakama/config/default.yaml

# 2. Check for recent config changes
git log --oneline -5 -- backend/config/

# 3. Rollback if recent change caused issue
git revert HEAD

# 4. Restart with previous config
docker-compose down
docker-compose up -d nakama
```

### Scenario 5: Port Conflict

```bash
# 1. Check what's using port 7350
netstat -tlnp | grep 7350

# 2. If conflict, stop conflicting process
sudo kill -9 <PID>

# 3. Or change Nakama port in config
# Edit docker-compose.yml to use different host port

# 4. Restart Nakama
docker restart nakama
```

---

## ✅ Verification

After resolution, verify:

```bash
# 1. Health check passes
curl -f http://localhost:7350/health

# 2. Metrics endpoint working
curl -s http://localhost:7350/metrics | head -20

# 3. Alert resolved in Alertmanager
curl -s http://alertmanager:9093/api/v2/alerts | jq '.[] | select(.status.state=="active")'

# 4. Test game functionality
# (Run smoke tests or manual verification)
```

---

## 📊 Post-Incident Actions

1. **Document the incident**
   - What happened
   - Root cause
   - Resolution steps
   - Time to resolution

2. **Update monitoring if needed**
   - Add additional metrics
   - Adjust alert thresholds
   - Improve runbook

3. **Prevent recurrence**
   - Fix root cause
   - Add automated recovery
   - Update deployment procedures

---

## 🔗 Related Resources

- [Nakama Troubleshooting Guide](https://heroiclabs.com/docs/nakama/troubleshooting/)
- [Docker Troubleshooting](https://docs.docker.com/config/containers/troubleshoot/)
- [Prometheus Alerting](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Grafana Dashboard](http://grafana:3000/d/nakama-server)

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Backend Team**: #backend-team Slack channel
- **Infrastructure**: #infra Slack channel
