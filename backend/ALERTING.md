# Alerting Configuration

This document describes the alerting infrastructure for Armored Archer, including critical metrics, thresholds, notification channels, and on-call procedures.

## Overview

The project implements alerting using Prometheus Alertmanager to monitor the game server infrastructure and notify the team of issues requiring attention.

## Requirements Addressed

- [x] Implement alerting configuration
- [x] Define critical metrics and thresholds for alerts
- [x] Configure notification channels
- [x] Set up on-call rotation or escalation policies

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Nakama    │────▶│  Prometheus  │────▶│  Alertmanager   │
│   (Game)    │     │  (Monitor)   │     │  (Router)       │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                  │
                         ┌────────────────────────┼────────────────────────┐
                         │                        │                        │
                         ▼                        ▼                        ▼
                  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
                  │   PagerDuty │        │    Slack    │        │    Email    │
                  │  (Critical) │        │  (All)      │        │  (All)      │
                  └─────────────┘        └─────────────┘        └─────────────┘
```

## Components

### 1. Alert Rules (`alerts.yml`)

Prometheus alerting rules defining critical, warning, and info-level alerts with specific thresholds.

### 2. Alertmanager (`alertmanager.yml`)

Routes alerts to appropriate notification channels based on severity and team.

### 3. On-Call Policy (`ONCALL_ESCALATION.md`)

Defines the on-call rotation schedule, escalation procedures, and response SLAs.

## Critical Metrics & Thresholds

### Critical Alerts (Immediate Action Required)

| Alert | Metric | Threshold | For | Description |
|-------|--------|------------|-----|-------------|
| GameServerDown | `up{job="nakama"}` | == 0 | 1m | Nakama server unavailable |
| DatabaseDown | `up{job="postgres"}` | == 0 | 1m | PostgreSQL unavailable |
| HighErrorRate | error_rate | > 5% | 2m | API error rate too high |
| DatabaseConnectionPoolExhausted | connections_active/connections_max | > 90% | 2m | DB pool nearly full |
| PaymentProcessingFailures | payment_failures_rate | > 0 | 1m | Payment failures detected |
| SuspiciousLoginActivity | failed_logins_rate | > 10/min | 2m | Possible brute force attack |

### Warning Alerts (Attention Required)

| Alert | Metric | Threshold | For | Description |
|-------|--------|------------|-----|-------------|
| HighLatency | p95_latency | > 2s | 3m | API latency too high |
| HighMemoryUsage | memory_usage | > 85% | 5m | Server memory pressure |
| HighCPUUsage | cpu_usage | > 80% | 5m | Server CPU pressure |
| DiskSpaceLow | disk_available | < 15% | 5m | Low disk space |
| ActiveUsersAnomaly | user_deviation | > 50% | 10m | Unusual user pattern |
| MatchmakingQueueBuilding | queue_size | > 100 | 5m | Players waiting too long |
| SessionDurationAnomaly | session_deviation | > 30% | 30m | Unusual session pattern |
| UnusualAPICallPattern | request_rate | > 1000/min | 5m | Possible bot activity |
| AntiCheatViolationSpike | violations_rate | > 5/min | 2m | New exploit detected |

### Info Alerts (Awareness)

| Alert | Metric | Threshold | For | Description |
|-------|--------|------------|-----|-------------|
| LowRevenue | revenue_rate_24h | < $1/hr | 1h | Revenue below threshold |
| ClientVersionMismatch | version_count | > 1 | 10m | Multiple client versions |

## Notification Channels

### Critical Alerts
- **PagerDuty**: Immediate page to on-call engineer
- **Slack**: `#armored-archer-critical` channel
- **Email**: `on-call-critical@armored-archer.example.com`

### Warning Alerts
- **Slack**: `#armored-archer-warnings` channel
- **Email**: `on-call@armored-archer.example.com`

### Info Alerts
- **Slack**: `#armored-archer-info` channel

### Security Alerts
- **Slack**: `#armored-archer-security` channel
- **Email**: `security-team@armored-archer.example.com`

## Configuration Files

| File | Description |
|------|-------------|
| `backend/alerts.yml` | Prometheus alerting rules with thresholds |
| `backend/alertmanager.yml` | Alert routing and notification configuration |
| `backend/docker-compose.yml` | Alertmanager service configuration |
| `backend/ONCALL_ESCALATION.md` | On-call rotation and escalation policy |

## Environment Variables

Required for notification integrations:

| Variable | Description | Required For |
|----------|-------------|--------------|
| `SMTP_PASSWORD` | SMTP password for email | Alertmanager |
| `PAGERDUTY_SERVICE_KEY` | PagerDuty integration key | Alertmanager |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook | Alertmanager |

## Getting Started

### 1. Start Alertmanager

```bash
cd backend
docker-compose up -d alertmanager prometheus
```

### 2. Verify Alerts Loaded

Visit Prometheus alerts page: http://localhost:9090/alerts

### 3. Check Alertmanager Status

Visit Alertmanager UI: http://localhost:9093

### 4. Test Alert Notification

Use Prometheus to manually trigger a test alert:

```bash
# Send test alert via amtool
docker exec armored_archer_alertmanager amtool alert add \
  --annotation summary="Test alert" \
  --annotation description="This is a test alert" \
  --label severity=critical
```

## Alert Response Workflow

```
1. Alert Triggered
       │
       ▼
2. PagerDuty Pages Primary On-Call
       │
       ▼
3. Primary Acknowledges (15 min for critical)
       │
       ▼
4. Investigate & Resolve
       │
       ▼
5. Escalate if no progress (10 min)
       │
       ▼
6. Resolution → Alert Resolved
```

## Adding New Alerts

### 1. Add Rule to `alerts.yml`

```yaml
- alert: NewAlertName
  expr: metric_expression > threshold
  for: 2m
  labels:
    severity: warning
    team: backend
  annotations:
    summary: "Alert summary"
    description: "Detailed description with {{ $value }}"
```

### 2. Update Routing in `alertmanager.yml`

Add routing rule for new severity/team if needed.

### 3. Update Runbooks

Add response procedure to `ONCALL_ESCALATION.md`.

### 4. Test in Development

Verify alert fires correctly before deploying to production.

## Grafana Integration

Grafana can display active alerts and alert history:

1. Add Prometheus as datasource (already configured)
2. Import alert dashboard: `backend/grafana/provisioning/dashboards/`
3. View alerts at: http://localhost:3000/alerting

## Related Documentation

- [METRICS.md](./METRICS.md) - Metrics collection infrastructure
- [ONCALL_ESCALATION.md](./ONCALL_ESCALATION.md) - On-call procedures
- [Prometheus Alerting](https://prometheus.io/docs/alerting/overview/)
- [Alertmanager Configuration](https://prometheus.io/docs/alerting/configuration/)
