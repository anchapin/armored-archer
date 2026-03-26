# Runbook: HighMemoryUsage

**Alert Name**: `HighMemoryUsage`  
**Severity**: Warning  
**Last Updated**: 2026-03-16

---

## ⚠️ Alert Definition

**Expression**: `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.85`  
**Duration**: 15 minutes  
**Impact**: Risk of out-of-memory kills, service crashes, and degraded performance.

---

## 📞 Escalation Path

1. **0-30 minutes**: On-call engineer investigates
2. **30-60 minutes**: Backend team lead
3. **60+ minutes**: Consider service restart or scaling

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Check current memory usage
free -h

# Check memory percentage
free | grep Mem | awk '{printf("%.2f\n", $3/$2 * 100.0)}'

# Check Alertmanager
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="HighMemoryUsage")'
```

### 2. Identify Memory Consumers

```bash
# Top processes by memory
top -o %MEM -bn1 | head -20

# Docker container memory usage
docker stats --no-stream

# Check Nakama memory specifically
docker stats nakama --no-stream

# Check system memory breakdown
cat /proc/meminfo | head -20
```

---

## 🔧 Troubleshooting Steps

### Step 1: Check Application Memory

```bash
# Check Go memory stats
curl -s http://nakama:7350/metrics | grep go_memstats

# Check heap allocation
curl -s http://nakama:7350/metrics | grep go_memstats_heap_alloc_bytes

# Check heap in use
curl -s http://nakama:7350/metrics | grep go_memstats_heap_inuse_bytes

# Check GC stats
curl -s http://nakama:7350/metrics | grep go_gc_duration
```

### Step 2: Check for Memory Leaks

```bash
# Monitor heap growth over time
watch -n 30 'curl -s http://nakama:7350/metrics | grep go_memstats_heap_alloc_bytes'

# Check Goroutine count (leak indicator)
curl -s http://nakama:7350/metrics | grep go_goroutines

# Monitor Goroutine growth
watch -n 30 'curl -s http://nakama:7350/metrics | grep go_goroutines'
```

### Step 3: Check System Memory

```bash
# Detailed memory info
cat /proc/meminfo

# Check for OOM events
dmesg | grep -i "out of memory" | tail -10

# Check swap usage
swapon --show
free -h
```

### Step 4: Profile Memory Usage

```bash
# Take heap profile
go tool pprof http://nakama:7350/debug/pprof/heap

# Analyze top memory consumers
go tool pprof -top http://nakama:7350/debug/pprof/heap

# Generate flame graph
go tool pprof -svg http://nakama:7350/debug/pprof/heap > heap.svg
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Temporary Memory Spike

```bash
# 1. Check if spike is temporary
watch -n 10 'free -h'

# 2. Wait for GC to run
sleep 60

# 3. Force GC if needed
curl -s http://nakama:7350/debug/pprof/heap?gc=1

# 4. Monitor recovery
watch -n 30 'docker stats nakama --no-stream'
```

### Scenario 2: Memory Leak

```bash
# 1. Confirm leak (continuous growth)
# Monitor for 5-10 minutes
watch -n 30 'curl -s http://nakama:7350/metrics | grep go_memstats_heap_alloc_bytes'

# 2. Take heap profile for analysis
go tool pprof http://nakama:7350/debug/pprof/heap

# 3. Restart service (temporary fix)
docker restart nakama

# 4. Create issue for investigation
# Attach heap profile to issue
```

### Scenario 3: Insufficient Resources

```bash
# 1. Check current limits
docker inspect nakama | jq '.[0].HostConfig.Memory'

# 2. Increase memory limit in docker-compose.yml
# Edit: deploy.resources.limits.memory

# 3. Restart with new limits
docker-compose up -d nakama

# 4. Monitor new usage
docker stats nakama
```

### Scenario 4: Too Many Connections

```bash
# 1. Check active connections
curl -s http://nakama:7350/metrics | grep nakama_database_connections

# 2. Check Goroutine count
curl -s http://nakama:7350/metrics | grep go_goroutines

# 3. Reduce connection pool if too high
# Edit Nakama config: database.pool_size

# 4. Restart with new config
docker-compose restart nakama
```

### Scenario 5: Cache Growth

```bash
# 1. Check cache size
# (Add your cache monitoring commands)

# 2. Clear cache if needed
# (Add your cache clearing commands)

# 3. Set cache size limits
# (Add cache configuration)

# 4. Monitor cache growth
watch -n 60 'du -sh /app/cache/*'
```

---

## ✅ Verification

After resolution, verify:

```bash
# 1. Memory usage below threshold
free | grep Mem | awk '{print $3/$2 * 100.0}' | awk '{print ($1 < 85) ? "OK" : "HIGH"}'

# 2. Heap stable
curl -s http://nakama:7350/metrics | grep go_memstats_heap_alloc_bytes

# 3. Goroutine count stable
curl -s http://nakama:7350/metrics | grep go_goroutines

# 4. Alert resolved
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="HighMemoryUsage") | .status.state'
```

---

## 📊 Post-Incident Actions

1. **Memory profiling**
   - Analyze heap profiles
   - Identify memory leaks
   - Optimize memory usage

2. **Monitoring improvements**
   - Add memory trend dashboard
   - Set up leak detection alerts
   - Monitor Goroutine count

3. **Capacity planning**
   - Review memory requirements
   - Plan for scaling needs
   - Optimize resource allocation

---

## 🔗 Related Resources

- [Go Memory Profiling](https://golang.org/doc/diagnostics.html#memory)
- [Docker Memory Limits](https://docs.docker.com/config/containers/resource_constraints/#memory)
- [Grafana Memory Dashboard](http://grafana:3000/d/node-exporter)

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Backend Team**: #backend-team Slack channel
- **Performance Team**: #performance Slack channel
