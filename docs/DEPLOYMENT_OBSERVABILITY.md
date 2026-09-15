# Deployment Observability

This document confirms the implementation of deployment observability for the Armored Archer project.

## Implementation Status: ✅ Complete

### What Was Implemented

1. **GitHub Deployments** - Using `chrnorm/deviation-action`:
   - Creates deployment records in GitHub
   - Updates deployment status (pending → success/failure)
   - Tracks environment (staging/production)

2. **Deployment Metrics** - Already configured in `.github/workflows/cd.yml`:
   - Deployment success/failure tracking
   - Health check verification (PostgreSQL, Nakama)
   - Service health status monitoring

3. **Real-time Notifications** - Slack integration:
   - Deployment status notifications
   - Environment, status, commit, and workflow URL included
   - Action buttons to view deployment

4. **Environment Configuration**:
   - Staging: `https://staging.armored-archer.example.com`
   - Production: `https://armored-archer.example.com`

### Key Features

| Feature | Status | Implementation |
|---------|--------|----------------|
| GitHub Deployments | ✅ | chrnorm/deviation-action |
| Success/Failure Metrics | ✅ | Status updates in cd.yml |
| Health Checks | ✅ | PostgreSQL + Nakama checks |
| Slack Notifications | ✅ | slack-api/github-action |
| Environment Selection | ✅ | workflow_dispatch |

### Verification

1. Check GitHub Deployments page in repository
2. Monitor Slack for deployment notifications
3. View workflow runs in Actions tab

## Local Observability Stack: postgres-exporter

The local Docker Compose stack (`backend/docker-compose.yml`) includes a
`postgres-exporter` service (issue #1183) that closes the last permanently-DOWN
Prometheus scrape target. The `postgres` scrape job in `backend/prometheus.yml`
targets `postgres-exporter:9187`; the exporter connects to the `postgres`
service (container `armored_archer_db`) and exposes database metrics on the
`backend-network`.

### Configuration

- Image: `quay.io/prometheuscommunity/postgres-exporter:v0.15.0` (container
  `armored_archer_postgres_exporter`).
- `DATA_SOURCE_NAME` is built at compose-config time from the same
  `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` variables (defaults
  `postgres` / `changeme` / `nakama`) that configure the postgres container —
  no separate credentials to maintain. The exporter starts only after the
  postgres container healthcheck passes, and publishes `9187` on the host for
  ad-hoc inspection (`curl http://localhost:9187/metrics`).

### Metric surface

Once `make services-start` brings the stack up, the Prometheus `postgres`
target reports UP and the following metric families become queryable in
Grafana (Prometheus data source, `job="postgres"`):

- `pg_up` — exporter-to-database connectivity (drive connection-saturation
  alerts off this plus the gauges below).
- `pg_stat_activity_*` — active/idle/backlogged server processes, including
  long-running transaction counts.
- `pg_stat_database_*` — per-database connections (`numbackends`),
  transactions (`xact_commit` / `xact_rollback`), tuple and block I/O
  (`blks_read` / `blks_hit`), and deadlocks.
- `pg_locks_*` — lock counts by mode (detects lock contention).
- `pg_database_size_bytes` / table-size families — disk growth tracking.
- Replication slots / replication-lag families when replication is configured
  (not used by the single-node local stack but exported where applicable).

These metrics unblock any alert rules in `backend/alerts.yml` that depend on
database health (connection saturation, long-running transactions).

## Related Issues

- Closes #318
- #1183 (postgres-exporter service + Prometheus `postgres` scrape job)

