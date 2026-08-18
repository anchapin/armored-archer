# Runbook: DatabaseDown

**Alert Name**: `DatabaseDown`
**Severity**: Critical
**Last Updated**: 2026-08-18

---

## 🚨 Alert Definition

**Expression**: `up{job="postgres"} == 0`
**Duration**: 1 minute
**Impact**: PostgreSQL is unreachable from Prometheus. Every gameplay path that persists or reads player/inventory/match state fails. All game operations are affected.

> **Note (open issue #1074):** the canonical metric name referenced by the alert expression is `up{job="postgres"}`. In our registry the equivalent gauge is `armored_archer_health_db_connections_percent` defined in [`backend/src/modules/health_monitor.ts:45`](../../backend/src/modules/health_monitor.ts). Until the Prometheus job mapping is reconciled, treat this alert as "all DB-touching requests are failing" rather than relying on the scrape target alone.

---

## 📞 Escalation Path

1. **0-5 minutes**: On-call engineer
2. **5-15 minutes**: Backend team lead
3. **15+ minutes**: CTO and DBA on call

Post in `#armored-archer-critical` immediately; page the on-call DBA via PagerDuty.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Check Prometheus scrape target for the postgres exporter
curl -s http://prometheus:9090/api/v1/targets | \
  jq '.data.activeTargets[] | select(.labels.job=="postgres")'

# Check Alertmanager state for this alert
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="DatabaseDown")'

# Local readiness probe (works on the host that runs the DB)
docker exec postgres pg_isready -h postgres -U postgres
```

### 2. Identify Failure Mode

```bash
# Container alive but Postgres not accepting connections?
docker ps | grep postgres
docker inspect postgres --format '{{.State.Status}} / {{.State.Running}}'

# Last 50 lines of PostgreSQL logs
docker logs postgres --tail 50

# Check Postgres exporter / connection-pool from the app side
curl -s http://nakama:7350/metrics | grep nakama_database_connections
```

---

## 🔧 Troubleshooting Steps

### Step 1: Recover the PostgreSQL Container

```bash
# 1. If the container stopped, restart it
docker start postgres || docker restart postgres

# 2. Wait for Postgres to accept connections
for i in {1..30}; do
  docker exec postgres pg_isready -h localhost -U postgres && break
  sleep 2
done

# 3. Confirm replicas are in sync (if replication is configured)
docker exec postgres psql -U postgres -c "SELECT pid, usename, application_name, state FROM pg_stat_replication;"
```

### Step 2: Restore Connectivity From Nakama

```bash
# 1. Confirm Nakama can reach Postgres
docker exec nakama pg_isready -h postgres -U postgres

# 2. Tail Nakama logs for connection errors
docker logs nakama --tail 100 | grep -iE "(postgres|database|connection refused|too many)"

# 3. If pool is exhausted, restart Nakama to drop stale handles
docker restart nakama
```

### Step 3: Free Disk or Resource Pressure

```bash
# 1. Check disk space — full disk is the most common silent Postgres-killer
df -h /

# 2. WAL / archive directory
docker exec postgres du -sh /var/lib/postgresql/data/pg_wal

# 3. Inode pressure (rare but real)
docker exec postgres df -i /var/lib/postgresql/data
```

### Step 4: Confirm Health From Inside Postgres

```bash
# 1. Live sessions / blockers
docker exec postgres psql -U postgres -c \
  "SELECT pid, usename, state, now()-query_start AS duration, query
   FROM pg_stat_activity WHERE state <> 'idle'
   ORDER BY duration DESC LIMIT 20;"

# 2. Replication / WAL receiver state
docker exec postgres psql -U postgres -c "SELECT * FROM pg_stat_wal_receiver;"

# 3. Last successful checkpoint
docker exec postgres psql -U postgres -c \
  "SELECT now() - checkpoint_time AS since_last_checkpoint FROM pg_stat_checkpointer;"
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Container Stopped

```bash
docker start postgres
docker logs postgres --tail 50 -f
docker exec nakama pg_isready -h postgres -U postgres
```

### Scenario 2: Postgres Will Not Start (Crash Loop)

```bash
# Pull the latest log lines and look for FATAL startup errors
docker logs postgres --tail 200 | grep -iE "(FATAL|panic|corrupt)"

# Common fix: postgresql.conf was clobbered by an env override
git log --oneline -5 -- backend/
git revert HEAD   # only if a recent deploy triggered this

# Free disk before retrying (see Step 3)
docker system prune -f
```

### Scenario 3: Disk Full

```bash
# Reclaim disk fast
docker system df
docker exec postgres psql -U postgres -c "VACUUM FULL;"   # only if you have the disk headroom

# Rotate WAL aggressively as a stop-gap
docker exec postgres psql -U postgres -c \
  "SET wal_keep_size='1GB'; checkpoint;"
```

### Scenario 4: Network Partition

```bash
# Confirm the bridge
docker network inspect armored_archer_default | jq '.[0].Containers'

# If Nakama and Postgres ended up on different networks, recreate the link
docker-compose down postgres nakama
docker-compose up -d postgres nakama
```

### Scenario 5: Postgres Exporter Scrape Failure Only

```bash
# Postgres is up but the Prometheus exporter is down → only this alert fires
docker logs postgres-exporter --tail 50
docker restart postgres-exporter

# Alert is informational — Nakama/Postgres itself may be fine.
# Cross-check the [GameServerDown](./GameServerDown.md) and
# [DatabaseConnectionPoolExhausted](./DatabaseConnectionPoolExhausted.md) runbooks.
```

---

## ✅ Verification

```bash
# 1. Postgres ready
docker exec postgres pg_isready -h localhost -U postgres

# 2. Health gauge back inside its expected band
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_health_db_connections_percent' \
  | jq '.data.result[0].value[1]'

# 3. Alert resolved in Alertmanager
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="DatabaseDown") | .status.state'

# 4. End-to-end smoke test (login + match lookup)
curl -s -X POST http://localhost:7350/v2/account/authenticate/custom \
  -H 'Content-Type: application/json' \
  -d '{"id":"smoketest","custom_id":"smoketest"}' | jq '.token'
```

---

## 📊 Post-Incident Actions

1. **Document timeline** — alert fired → detection → mitigation → resolution.
2. **Capture Postgres logs** from `pg_log/` for the incident window.
3. **Open a follow-up** if root cause is unaddressed (e.g., disk fill, missing exporter).
4. **Tune thresholds** — repeated false positives on the exporter should move the check to `armored_archer_health_db_connections_percent` (see issue #1092).

---

## 🔗 Related Resources

- [PostgreSQL Server Administration](https://www.postgresql.org/docs/current/admin.html)
- [Nakama Database Configuration](https://heroiclabs.com/docs/nakama/server-reference/configuration/)
- [Health Monitor module](../../backend/src/modules/health_monitor.ts)
- [GameServerDown runbook](./GameServerDown.md)
- [DatabaseConnectionPoolExhausted runbook](./DatabaseConnectionPoolExhausted.md)
- Grafana → *Postgres / Database* dashboard: `http://grafana:3000/d/database-monitoring`

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Backend Team**: `#backend-team` Slack channel
- **DBA Team**: `#dba` Slack channel
- **Infrastructure**: `#infra` Slack channel