# Runbook: DiskSpaceLow

**Alert Name**: `DiskSpaceLow`  
**Severity**: Warning  
**Last Updated**: 2026-03-16

---

## ⚠️ Alert Definition

**Expression**: `(node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) < 0.10`  
**Duration**: 5 minutes  
**Impact**: Risk of service failure, inability to write logs, database corruption potential.

---

## 📞 Escalation Path

1. **0-1 hour**: On-call engineer cleans up
2. **1-4 hours**: Infra team if cleanup insufficient
3. **4+ hours**: Disk expansion required

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Check disk usage
df -h

# Check disk usage percentage
df -h / | tail -1 | awk '{print $5}'

# Check Alertmanager
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="DiskSpaceLow")'
```

### 2. Identify Large Files/Directories

```bash
# Find largest directories
du -ah / | sort -rh | head -20

# Find large files (>100MB)
find / -type f -size +100M -exec ls -lh {} \; | awk '{ print $9 ": " $5 }'

# Check Docker disk usage
docker system df

# Check log files
ls -lh /var/log/*.log
```

---

## 🔧 Troubleshooting Steps

### Step 1: Check Docker Disk Usage

```bash
# Docker disk usage summary
docker system df

# Check container sizes
docker ps -s

# Check image sizes
docker images

# Check volume sizes
docker system df -v
```

### Step 2: Check Log Files

```bash
# Check log file sizes
du -sh /var/log/*

# Check Docker daemon logs
du -sh /var/lib/docker/*

# Check application logs
du -sh /app/logs/*
```

### Step 3: Check Database Size

```bash
# Check PostgreSQL database size
docker exec postgres psql -U postgres -c \
  "SELECT pg_size_pretty(pg_database_size('nakama'));"

# Check table sizes
docker exec postgres psql -U postgres -c \
  "SELECT table_name, pg_size_pretty(pg_total_relation_size(table_name)) FROM information_schema.tables WHERE table_schema = 'public' ORDER BY pg_total_relation_size(table_name) DESC;"
```

### Step 4: Check for Core Dumps

```bash
# Find core dump files
find / -name "core.*" -type f

# Check core dump size
du -sh /var/crash/*
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Docker Cleanup

```bash
# 1. Remove stopped containers
docker container prune -f

# 2. Remove unused images
docker image prune -f

# 3. Remove unused volumes
docker volume prune -f

# 4. Remove build cache
docker builder prune -f

# 5. Aggressive cleanup (removes all unused)
docker system prune -a --volumes -f

# 6. Verify cleanup
docker system df
```

### Scenario 2: Log Rotation

```bash
# 1. Check logrotate configuration
cat /etc/logrotate.conf

# 2. Force log rotation
logrotate -f /etc/logrotate.conf

# 3. Truncate large logs manually
> /var/log/large_log.log

# 4. Compress old logs
gzip /var/log/*.log.*

# 5. Remove old compressed logs
find /var/log -name "*.gz" -mtime +7 -delete
```

### Scenario 3: Application Cleanup

```bash
# 1. Clean up temporary files
rm -rf /tmp/*

# 2. Clean up application cache
rm -rf /app/cache/*

# 3. Clean up old releases
rm -rf /app/releases/old-*

# 4. Verify cleanup
df -h
```

### Scenario 4: Database Cleanup

```bash
# 1. Vacuum database
docker exec postgres psql -U postgres -c "VACUUM;"

# 2. Analyze tables
docker exec postgres psql -U postgres -c "ANALYZE;"

# 3. Clean up old data (if applicable)
# (Add your data retention queries)

# 4. Check size after cleanup
docker exec postgres psql -U postgres -c \
  "SELECT pg_size_pretty(pg_database_size('nakama'));"
```

### Scenario 5: Disk Expansion

```bash
# 1. Check current disk configuration
lsblk

# 2. If using cloud provider, expand disk via console

# 3. Resize filesystem (after disk expansion)
resize2fs /dev/sda1

# 4. Verify new size
df -h
```

---

## ✅ Verification

After resolution, verify:

```bash
# 1. Disk usage below threshold
df -h / | tail -1 | awk '{print $5}' | sed 's/%//'

# 2. Available space increased
df -h /

# 3. Alert resolved
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="DiskSpaceLow") | .status.state'

# 4. Set up monitoring
watch -n 60 'df -h /'
```

---

## 📊 Prevention

### Regular Maintenance

```bash
# Add to crontab for automated cleanup
# Docker cleanup (weekly)
0 2 * * 0 docker system prune -f

# Log rotation (daily)
0 3 * * * logrotate -f /etc/logrotate.conf

# Old file cleanup (weekly)
0 4 * * 0 find /tmp -type f -mtime +7 -delete
```

### Monitoring Improvements

1. Add disk usage trending dashboard
2. Set up earlier warning at 20%
3. Configure predictive alerts based on growth rate

---

## 🔗 Related Resources

- [Docker Disk Cleanup](https://docs.docker.com/config/pruning/)
- [Log Rotation](https://linux.die.net/man/8/logrotate)
- [PostgreSQL Maintenance](https://www.postgresql.org/docs/current/routine-vacuuming.html)
- [Grafana Disk Dashboard](http://grafana:3000/d/node-exporter)

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Infra Team**: #infra Slack channel
- **DBA Team**: #dba Slack channel (for database cleanup)
