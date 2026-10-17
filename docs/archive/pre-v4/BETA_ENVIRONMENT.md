# Beta Environment Documentation

## Overview

This document details the beta environment configuration for the Armored Archer Go backend deployment.

## Environment Details

| Property | Value |
|----------|-------|
| Environment | Beta |
| Node Env | `beta` |
| Build ID | `beta-001` |
| Version | `v2.1.0-beta.1` |
| Debug Enabled | `false` |

## API Endpoints

| Service | URL |
|---------|-----|
| REST API | `https://beta-api.armored-archer.internal` |
| WebSocket | `wss://beta-ws.armored-archer.internal` |
| Console | `https://beta-console.armored-archer.internal` |

## Services

### Nakama Server
- **Port**: 7350 (TCP)
- **Console**: 7351 (TCP)
- **Server Key**: Configured via environment

### Database
- **Type**: PostgreSQL
- **Name**: `nakama_beta`
- **Host**: postgres:5432

### Cache
- **Type**: Redis
- **Persistence**: Enabled (60s save)

### Monitoring
- **Prometheus**: Port 9100
- **Grafana**: HTTP access
- **Loki**: Log aggregation
- **OpenTelemetry**: OTLP endpoint configured

## Configuration Files

| File | Purpose |
|------|---------|
| `.env.beta` | Environment variables |
| `docker-compose.beta.yml` | Container orchestration |
| `nakama.beta.yml` | Nakama server config |

## Rate Limiting

- **Enabled**: true
- **Max Requests**: 500
- **Window**: 60000ms

## Alerting

- **Provider**: Slack
- **Channel**: #beta-alerts
- **Min Alert Level**: beta

## Beta Features

| Feature | Status |
|---------|--------|
| Test Users | Enabled |
| Max Users | 500 |
| Onboarding | Enabled |
| Feedback Collection | Enabled |

## Health Check

```bash
curl http://beta-api.armored-archer.internal:7350/health
```

## Deployment Commands

```bash
# Start beta environment
docker-compose -f docker-compose.yml -f docker-compose.beta.yml up -d

# View logs
docker-compose -f docker-compose.yml -f docker-compose.beta.yml logs -f nakama

# Stop beta environment
docker-compose -f docker-compose.yml -f docker-compose.beta.yml down
```

## Rollback Procedure

See `ROLLBACK_RUNBOOK.md` for detailed rollback procedures.
