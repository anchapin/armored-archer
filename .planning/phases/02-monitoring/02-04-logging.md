# Phase 2.4: Log Aggregation (Loki) Configuration Guide

**Milestone**: v2.1.0 - Alpha Launch & Stabilization  
**Phase**: 2.4 - Log Aggregation (Loki) Validation  
**Status**: ✅ Complete  
**Created**: 2026-03-16

---

## Overview

This document provides comprehensive guidance for configuring and operating the Loki-based log aggregation system for Armored Archer. The system collects logs from the Go backend, Nakama server, Docker containers, and system sources.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Log Aggregation Stack                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │  Go App  │    │  Nakama  │    │  System  │                  │
│  │  Logs    │    │  Logs    │    │  Logs    │                  │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘                  │
│       │               │               │                         │
│       └───────────────┼───────────────┘                         │
│                       │                                         │
│              ┌────────▼────────┐                                │
│              │    Promtail     │                                │
│              │  (Log Collector)│                                │
│              └────────┬────────┘                                │
│                       │                                         │
│                       │ Push                                    │
│                       ▼                                         │
│              ┌────────────────┐                                 │
│              │      Loki      │                                 │
│              │ (Log Aggregator)│                                │
│              └────────┬────────┘                                │
│                       │                                         │
│                       │ Query                                   │
│                       ▼                                         │
│              ┌────────────────┐                                 │
│              │    Grafana     │                                 │
│              │ (Visualization)│                                 │
│              └────────────────┘                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Loki (Log Aggregator)

**Purpose**: Centralized log storage and querying  
**Port**: 3100  
**Configuration**: `backend/config/loki.yml`

**Key Features**:
- 30-day log retention
- Structured JSON log support
- Multi-tenant architecture ready
- Compression for efficient storage
- LogQL query language

### 2. Promtail (Log Collector)

**Purpose**: Log collection and forwarding  
**Port**: 9080  
**Configuration**: `backend/config/promtail.yml`

**Key Features**:
- Docker container log discovery
- File-based log scraping
- JSON log parsing
- Label enrichment
- Position tracking (prevents duplicates)

### 3. Grafana (Visualization)

**Purpose**: Log exploration and analysis  
**Port**: 3000  
**Configuration**: Auto-provisioned datasource

**Key Features**:
- LogQL query builder
- Log context viewing
- Derived fields (trace ID, request ID)
- Dashboard integration

---

## Configuration Files

### Loki Configuration (`backend/config/loki.yml`)

```yaml
# Key settings
server:
  http_listen_port: 3100

schema_config:
  configs:
    - schema: v13  # Latest schema version

limits_config:
  retention_period: 720h  # 30 days
  ingestion_rate_mb: 16
  max_query_parallelism: 32

logging:
  format: json
  level: info
```

### Promtail Configuration (`backend/config/promtail.yml`)

```yaml
# Key scrape configs
scrape_configs:
  - job_name: application    # Go backend logs
  - job_name: nakama         # Nakama server logs
  - job_name: docker         # Docker container logs
  - job_name: system         # Systemd journal logs
  - job_name: build_logs     # Build output logs
```

---

## Log Labels

Labels are key-value pairs used to filter and organize logs:

| Label | Values | Description |
|-------|--------|-------------|
| `environment` | `development`, `alpha`, `production` | Deployment environment |
| `service` | `backend`, `nakama`, `system` | Service identifier |
| `level` | `info`, `warn`, `error`, `debug` | Log severity |
| `job` | `armored_archer`, `nakama`, `docker` | Scrape job name |
| `rpcName` | RPC endpoint name | RPC handler (auto-extracted) |
| `userId` | User ID | User identifier (auto-extracted) |
| `requestId` | UUID | Request correlation ID (auto-extracted) |
| `container` | Container name | Docker container (auto-discovered) |
| `hostname` | Host name | Machine identifier |

---

## Structured Logging Format

All application logs should use this JSON format:

```json
{
  "timestamp": "2026-03-16T10:30:00Z",
  "level": "info",
  "message": "RPC handler executed successfully",
  "service": "backend",
  "context": {
    "requestId": "abc-123-def",
    "userId": "user_456",
    "rpcName": "create_match",
    "operation": "db_write",
    "duration": "45ms"
  }
}
```

---

## Deployment

### Starting the Stack

```bash
# Start all services including Loki and Promtail
cd backend
docker-compose up -d

# Start only logging components
docker-compose up -d loki promtail

# View logs
docker-compose logs -f loki
docker-compose logs -f promtail
```

### Health Checks

```bash
# Check Loki health
curl http://localhost:3100/ready

# Check Promtail health
curl http://localhost:9080/ready

# List available log sources
curl "http://localhost:3100/loki/api/v1/label/job/values"
```

### Verification Script

```bash
# Run verification
python3 backend/scripts/verify-logging.py

# JSON output
python3 backend/scripts/verify-logging.py --json

# With auto-fix suggestions
python3 backend/scripts/verify-logging.py --fix
```

---

## Using Grafana Explore

### Accessing Logs

1. Open Grafana: http://localhost:3000
2. Navigate to **Explore** (compass icon)
3. Select **Loki** datasource
4. Enter LogQL query

### Basic Queries

```logql
# All errors in last 15 minutes
{environment="alpha", level="error"}

# Logs from specific service
{service="backend"}

# Logs for specific RPC
{rpcName="create_match"}

# Logs for specific user
{userId="user_123"}
```

### Advanced Queries

See [`backend/docs/log-queries.md`](backend/docs/log-queries.md) for comprehensive LogQL examples.

---

## Log Retention

| Environment | Retention Period | Storage Location |
|-------------|------------------|------------------|
| Development | 7 days | `/tmp/loki/chunks` |
| Alpha | 30 days | `loki_data` volume |
| Production | 90 days | S3/GCS (configured separately) |

### Retention Configuration

```yaml
# In loki.yml
limits_config:
  retention_period: 720h  # 30 days

compactor:
  retention_enabled: true
  retention_delete_delay: 2h
```

---

## Troubleshooting

### No Logs Appearing

1. Check Promtail is running: `docker-compose ps promtail`
2. Verify Promtail config: `docker-compose exec promtail cat /etc/promtail/config.yml`
3. Check Promtail logs: `docker-compose logs promtail`
4. Verify Loki is receiving: `curl "http://localhost:3100/loki/api/v1/label/job/values"`

### High Memory Usage

1. Reduce retention period in `loki.yml`
2. Limit query parallelism: `max_query_parallelism: 16`
3. Reduce max lines per query: `max_entries_limit_per_query: 1000`

### Missing Fields in Logs

1. Verify JSON format in source logs
2. Check Promtail pipeline stages
3. Use raw log view: `{job="application"} | line_format "{{__line__}}"`

### Loki Not Starting

1. Check config syntax: `docker-compose exec loki loki -config.file=/etc/loki/local-config.yaml -verify-config`
2. Verify volume permissions
3. Check port conflicts: `lsof -i :3100`

---

## Integration with Application

### Go Backend

The Go backend uses structured logging:

```go
logger.Info("RPC executed", 
    "requestId", requestId,
    "userId", userId,
    "rpcName", rpcName,
    "duration", duration.String(),
)
```

### Nakama Server

Nakama logs are automatically collected from stdout/stderr and parsed for JSON structure.

### Docker Containers

All containers with label `com.docker.compose.project=armored_archer` are automatically discovered.

---

## Security Considerations

### Log Scrubbing

Sensitive data is automatically scrubbed by the application logger:
- Passwords
- API keys
- Token values
- PII (personally identifiable information)

### Access Control

- Loki: No authentication (internal network only)
- Grafana: Admin authentication required
- Promtail: No authentication (internal network only)

### Production Hardening

For production deployment:
1. Enable Loki authentication
2. Use TLS for all connections
3. Configure network policies
4. Enable audit logging
5. Implement log encryption at rest

---

## Monitoring the Logging System

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `loki_ingester_memory_chunks` | In-memory chunks | > 1M |
| `loki_request_duration_seconds` | Request latency | P99 > 5s |
| `promtail_sent_entries_total` | Logs sent to Loki | Rate drop > 50% |
| `promtail_file_errors_total` | File read errors | > 0 |

### Grafana Dashboard

A logging dashboard is available at:
- **URL**: http://localhost:3000/d/loki-monitoring
- **Panels**: Log volume, error rate, service breakdown

---

## Cost Optimization

### Storage Optimization

1. Use compression (enabled by default)
2. Set appropriate retention periods
3. Drop debug logs in production
4. Aggregate old logs

### Query Optimization

1. Use selective label filters
2. Avoid regex when possible
3. Limit time ranges
4. Use `line_format` for formatting

---

## Migration from Previous System

If migrating from a different logging system:

1. Deploy Loki/Promtail alongside existing system
2. Configure dual logging (if needed)
3. Migrate saved queries/dashboards
4. Update documentation
5. Train team on LogQL
6. Decommission old system

---

## Next Steps

After completing this phase:

1. ✅ Verify all logs are being collected
2. ✅ Create saved queries for common investigations
3. ✅ Set up log-based alerts (Phase 2.5)
4. ✅ Integrate with distributed tracing (Phase 2.5)
5. ✅ Document runbooks for common issues

---

## References

- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [LogQL Reference](https://grafana.com/docs/loki/latest/logql/)
- [Promtail Documentation](https://grafana.com/docs/loki/latest/clients/promtail/)
- [LogQL Queries Guide](backend/docs/log-queries.md)
- [Phase 2.4 Summary](.planning/phases/02-monitoring/02-04-SUMMARY.md)

---

**Checkpoint**: Human verify logging configuration and dashboards
