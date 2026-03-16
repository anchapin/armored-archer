# Alpha Monitoring Infrastructure Setup

**Milestone**: v2.1.0 - Alpha Launch & Stabilization
**Phase**: 1.1 - Alpha Environment Setup
**Task**: 1.1.6 - Monitoring Infrastructure
**Date**: 2026-03-16

---

## Overview

This document describes the monitoring infrastructure setup for the alpha environment, including Prometheus, Grafana, Loki, and alerting configuration.

---

## Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Monitoring Stack                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │  Prometheus  │────▶│   Grafana    │────▶│    Users     │ │
│  │  (Metrics)   │     │ (Dashboards) │     │              │ │
│  └──────────────┘     └──────────────┘     └──────────────┘ │
│         │                    ▲                                │
│         │                    │                                │
│         ▼                    │                                │
│  ┌──────────────┐     ┌──────────────┐                       │
│  │ Alertmanager │     │    Loki      │                       │
│  │  (Alerts)    │     │   (Logs)     │                       │
│  └──────────────┘     └──────────────┘                       │
│                              ▲                                │
│                              │                                │
│  ┌──────────────┐     ┌──────────────┐                       │
│  │ Node Exporter│     │  Promtail    │                       │
│  │  (System)    │     │ (Log Shipper)│                       │
│  └──────────────┘     └──────────────┘                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Scrape
                              │
                    ┌──────────────────┐
                    │  Nakama Server   │
                    │  (Game Backend)  │
                    └──────────────────┘
```

---

## 1. Prometheus Configuration

### Current Configuration

The existing `backend/prometheus.yml` is already configured for the Armored Archer backend.

### Alpha-Specific Updates

Update `backend/prometheus.yml` for alpha:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'armored-archer'
    environment: 'alpha'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - '/etc/prometheus/alerts.yml'

scrape_configs:
  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['prometheus:9090']

  # Node Exporter for system metrics
  - job_name: 'node_exporter'
    static_configs:
      - targets: ['node_exporter:9100']

  # Alertmanager
  - job_name: 'alertmanager'
    static_configs:
      - targets: ['alertmanager:9093']

  # Nakama server metrics
  - job_name: 'nakama'
    metrics_path: '/metrics'
    scrape_interval: 30s
    static_configs:
      - targets: ['nakama:7350']
        labels:
          service: 'nakama'
          component: 'game-server'
          environment: 'alpha'

  # Custom application metrics from Nakama RPC endpoint
  - job_name: 'armored_archer_metrics'
    metrics_path: '/api/nakama/rpc/armored_archer/metrics'
    scrape_interval: 30s
    static_configs:
      - targets: ['nakama:7350']
        labels:
          service: 'armored-archer-backend'
          component: 'application'
          environment: 'alpha'

  # Health metrics
  - job_name: 'armored_archer_health'
    metrics_path: '/api/nakama/rpc/armored_archer/health'
    scrape_interval: 30s
    static_configs:
      - targets: ['nakama:7350']
        labels:
          service: 'armored-archer-backend'
          component: 'health'
          environment: 'alpha'
```

---

## 2. Alert Rules Configuration

Create `backend/alerts.yml`:

```yaml
groups:
  - name: armored_archer_alerts
    interval: 30s
    rules:
      # ============================================
      # Service Availability Alerts
      # ============================================
      - alert: NakamaServiceDown
        expr: up{job="nakama"} == 0
        for: 2m
        labels:
          severity: critical
          service: nakama
        annotations:
          summary: "Nakama service is down"
          description: "Nakama game server has been unreachable for more than 2 minutes"

      - alert: PrometheusTargetDown
        expr: up == 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Prometheus target down"
          description: "{{ $labels.instance }} of job {{ $labels.job }} has been down for 5 minutes"

      # ============================================
      # Performance Alerts
      # ============================================
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="nakama"}[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s (threshold: 0.5s)"

      - alert: VeryHighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="nakama"}[5m])) > 2.0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Very high response time detected"
          description: "95th percentile response time is {{ $value }}s (threshold: 2.0s)"

      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{job="nakama",status=~"5.."}[5m])) / sum(rate(http_requests_total{job="nakama"}[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"

      # ============================================
      # Resource Alerts
      # ============================================
      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is {{ $value }}% on {{ $labels.instance }}"

      - alert: VeryHighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 95
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Very high CPU usage detected"
          description: "CPU usage is {{ $value }}% on {{ $labels.instance }}"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is {{ $value }}% on {{ $labels.instance }}"

      - alert: VeryHighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 95
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Very high memory usage detected"
          description: "Memory usage is {{ $value }}% on {{ $labels.instance }}"

      - alert: LowDiskSpace
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 15
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space detected"
          description: "Disk space is {{ $value }}% available on {{ $labels.instance }}"

      - alert: VeryLowDiskSpace
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 5
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Very low disk space detected"
          description: "Disk space is {{ $value }}% available on {{ $labels.instance }}"

      # ============================================
      # Database Alerts
      # ============================================
      - alert: PostgreSQLDown
        expr: pg_up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL is down"
          description: "PostgreSQL database is unreachable"

      - alert: HighDatabaseConnections
        expr: pg_stat_activity_count > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High number of database connections"
          description: "PostgreSQL has {{ $value }} active connections"

      # ============================================
      # Game-Specific Alerts
      # ============================================
      - alert: HighMatchQueueSize
        expr: armored_archer_match_queue_size > 50
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High match queue size"
          description: "Match queue has {{ $value }} players waiting"

      - alert: HighMatchWaitTime
        expr: armored_archer_match_wait_time_seconds > 120
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High match wait time"
          description: "Average match wait time is {{ $value }} seconds"

      - alert: HighPurchaseFailureRate
        expr: sum(rate(armored_archer_purchase_failures_total[5m])) / sum(rate(armored_archer_purchases_total[5m])) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High purchase failure rate"
          description: "Purchase failure rate is {{ $value | humanizePercentage }}"
```

---

## 3. Grafana Configuration

### Provisioning Setup

Create directory structure:

```bash
mkdir -p backend/grafana/provisioning/datasources
mkdir -p backend/grafana/provisioning/dashboards
```

### Datasource Configuration

Create `backend/grafana/provisioning/datasources/datasources.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
    jsonData:
      timeInterval: "15s"
      queryTimeout: "60s"

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: false
    jsonData:
      maxLines: 1000
```

### Dashboard Configuration

Create `backend/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'Armored Archer'
    orgId: 1
    folder: ''
    folderUid: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

### Alpha Dashboard

Create `backend/grafana/provisioning/dashboards/alpha-overview.json`:

```json
{
  "dashboard": {
    "id": null,
    "uid": "alpha-overview",
    "title": "Alpha Environment Overview",
    "tags": ["alpha", "overview"],
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 0,
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 0},
        "type": "stat",
        "title": "Nakama Status",
        "targets": [
          {
            "expr": "up{job=\"nakama\"}",
            "legendFormat": "Status",
            "refId": "A"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "mappings": [
              {"type": "value", "options": {"0": {"text": "DOWN", "color": "red"}}},
              {"type": "value", "options": {"1": {"text": "UP", "color": "green"}}}
            ]
          }
        }
      },
      {
        "id": 2,
        "gridPos": {"h": 4, "w": 6, "x": 6, "y": 0},
        "type": "stat",
        "title": "Active Players",
        "targets": [
          {
            "expr": "armored_archer_player_active_sessions",
            "legendFormat": "Players",
            "refId": "A"
          }
        ]
      },
      {
        "id": 3,
        "gridPos": {"h": 4, "w": 6, "x": 12, "y": 0},
        "type": "stat",
        "title": "Avg Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{job=\"nakama\"}[5m]))",
            "legendFormat": "P50",
            "refId": "A"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s"
          }
        }
      },
      {
        "id": 4,
        "gridPos": {"h": 4, "w": 6, "x": 18, "y": 0},
        "type": "stat",
        "title": "Error Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{job=\"nakama\",status=~\"5..\"}[5m])) / sum(rate(http_requests_total{job=\"nakama\"}[5m])) * 100",
            "legendFormat": "Error %",
            "refId": "A"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {"value": null, "color": "green"},
                {"value": 1, "color": "yellow"},
                {"value": 5, "color": "red"}
              ]
            }
          }
        }
      },
      {
        "id": 5,
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 4},
        "type": "graph",
        "title": "Request Rate & Errors",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{job=\"nakama\"}[5m]))",
            "legendFormat": "Requests/s",
            "refId": "A"
          },
          {
            "expr": "sum(rate(http_requests_total{job=\"nakama\",status=~\"5..\"}[5m]))",
            "legendFormat": "Errors/s",
            "refId": "B"
          }
        ]
      },
      {
        "id": 6,
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 4},
        "type": "graph",
        "title": "Response Time (P50, P95, P99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{job=\"nakama\"}[5m]))",
            "legendFormat": "P50",
            "refId": "A"
          },
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"nakama\"}[5m]))",
            "legendFormat": "P95",
            "refId": "B"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{job=\"nakama\"}[5m]))",
            "legendFormat": "P99",
            "refId": "C"
          }
        ]
      },
      {
        "id": 7,
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 12},
        "type": "graph",
        "title": "CPU Usage",
        "targets": [
          {
            "expr": "100 - (avg by(instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
            "legendFormat": "{{instance}}",
            "refId": "A"
          }
        ]
      },
      {
        "id": 8,
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 12},
        "type": "graph",
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
            "legendFormat": "{{instance}}",
            "refId": "A"
          }
        ]
      },
      {
        "id": 9,
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 20},
        "type": "graph",
        "title": "Match Queue Size",
        "targets": [
          {
            "expr": "armored_archer_match_queue_size",
            "legendFormat": "Queue Size",
            "refId": "A"
          }
        ]
      }
    ]
  }
}
```

---

## 4. Loki Configuration

### Add Loki to Docker Compose

Update `backend/docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  loki:
    image: grafana/loki:2.9.0
    container_name: armored_archer_loki
    restart: unless-stopped
    volumes:
      - ./loki:/etc/loki
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    ports:
      - "3100:3100"
    networks:
      - backend-network

  promtail:
    image: grafana/promtail:2.9.0
    container_name: armored_archer_promtail
    restart: unless-stopped
    volumes:
      - ./promtail:/etc/promtail
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - backend-network
    depends_on:
      - loki
```

### Create Loki Configuration

Create `backend/loki/local-config.yaml`:

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  instance_addr: 127.0.0.1
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://alertmanager:9093

limits_config:
  retention_period: 744h  # 31 days
```

### Create Promtail Configuration

Create `backend/promtail/config.yml`:

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: nakama
    static_configs:
      - targets:
          - localhost
        labels:
          job: nakama
          __path__: /var/lib/docker/containers/*/*nakama*.log

  - job_name: postgres
    static_configs:
      - targets:
          - localhost
        labels:
          job: postgres
          __path__: /var/lib/docker/containers/*/*postgres*.log

  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: system
          __path__: /var/log/*.log
```

---

## 5. Alertmanager Configuration

Update `backend/alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: '<SLACK_WEBHOOK_URL>'

route:
  receiver: 'slack-notifications'
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: 'slack-critical'
      continue: true
    - match:
        severity: warning
      receiver: 'slack-warnings'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - channel: '#alpha-alerts'
        send_resolved: true
        title: '{{ template "slack.title" . }}'
        text: '{{ template "slack.text" . }}'

  - name: 'slack-critical'
    slack_configs:
      - channel: '#alpha-critical'
        send_resolved: true
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}*Alert:* {{ .Annotations.summary }}\n*Description:* {{ .Annotations.description }}\n*Severity:* {{ .Labels.severity }}\n{{ end }}'

  - name: 'slack-warnings'
    slack_configs:
      - channel: '#alpha-warnings'
        send_resolved: true
        title: '⚠️ WARNING: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}*Alert:* {{ .Annotations.summary }}\n*Description:* {{ .Annotations.description }}\n{{ end }}'

templates:
  - '/etc/alertmanager/templates/*.tmpl'
```

---

## 6. Deployment & Verification

### Start Monitoring Stack

```bash
cd backend

# Start all services including monitoring
docker-compose up -d

# Verify services are running
docker-compose ps

# Expected output:
# NAME                        STATUS
# armored_archer_prometheus   Up
# armored_archer_grafana      Up
# armored_archer_loki         Up
# armored_archer_promtail     Up
# armored_archer_alertmanager Up
```

### Verify Prometheus

```bash
# Check Prometheus UI
open http://localhost:9090

# Verify targets
curl http://localhost:9090/api/v1/targets

# Query metrics
curl -G http://localhost:9090/api/v1/query --data-urlencode "query=up"
```

### Verify Grafana

```bash
# Access Grafana
open http://localhost:3000

# Default credentials: admin/admin

# Verify datasources are configured
# Navigate to: Configuration → Data Sources

# Verify dashboards
# Navigate to: Dashboards → Browse
```

### Verify Loki

```bash
# Check Loki health
curl http://localhost:3100/ready

# Query logs
curl -G "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={job="nakama"}' \
  --data-urlencode 'start=2026-03-16T00:00:00Z' \
  --data-urlencode 'end=2026-03-16T23:59:59Z'
```

### Verify Alertmanager

```bash
# Check Alertmanager status
curl http://localhost:9093/api/v1/status

# Check alerts
curl http://localhost:9093/api/v1/alerts
```

---

## 7. Monitoring Checklist

- [ ] Prometheus scraping all targets
- [ ] Grafana dashboards accessible
- [ ] Loki receiving logs
- [ ] Alertmanager configured
- [ ] Alert rules loaded
- [ ] Slack notifications working
- [ ] All metrics visible in Grafana
- [ ] Log queries working in Loki

---

## Next Steps

After monitoring setup:

1. Create Phase 1.1 Summary Document
2. Schedule monitoring review meeting
3. Train team on using dashboards
4. Set up on-call rotation for alpha alerts

---

**Created**: 2026-03-16
**Status**: 📋 Ready for Execution
