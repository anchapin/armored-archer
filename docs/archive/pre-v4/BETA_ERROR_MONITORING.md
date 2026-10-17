# Beta Error Rate Monitoring Dashboard

## Overview

This document describes the error rate monitoring configuration for the beta environment.

## Error Rate Metrics

### Primary Metrics

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Overall Error Rate | > 0.5% | Critical |
| Per-RPC Error Rate | > 0.5% | Critical |
| 5xx Errors | > 0 | Critical |

### Measurement

```
Error Rate = (Total Errors / Total Requests) * 100
```

## Prometheus Queries

### Overall Error Rate

```promql
sum(rate(armored_archer_rpc_errors_total{service="beta"}[5m]))
/
sum(rate(armored_archer_rpc_requests_total{service="beta"}[5m]))
```

### Per-RPC Error Rate

```promql
sum(rate(armored_archer_rpc_errors_total{service="beta"}[5m])) by (rpc_method)
/
sum(rate(armored_archer_rpc_requests_total{service="beta"}[5m])) by (rpc_method)
```

### Error Count by Type

```promql
sum(rate(armored_archer_rpc_errors_total{service="beta"}[5m])) by (error_type)
```

## Dashboard Panels

### Panel 1: Overall Error Rate (Gauge)
- **Type**: Gauge
- **Range**: 0 - 1%
- **Thresholds**: 
  - Green: < 0.3%
  - Yellow: 0.3% - 0.5%
  - Red: > 0.5%

### Panel 2: Error Rate Over Time (Time Series)
- **Type**: Graph
- **Interval**: Last 24 hours
- **Line**: Error rate percentage

### Panel 3: Errors by RPC Method (Table)
- **Columns**: RPC Method, Error Count, Error Rate, Status

### Panel 4: Error Types (Pie Chart)
- **Categories**: Validation, Auth, Database, Internal, Network

## Alert Rules

### Critical Alerts

| Alert | Expression | Duration |
|-------|------------|----------|
| BetaHighErrorRate | > 0.5% | 2m |
| BetaOverallErrorRate | > 0.5% | 2m |

### Warning Alerts

| Alert | Expression | Duration |
|-------|------------|----------|
| BetaElevatedErrorRate | > 0.3% | 5m |

## Access

| Role | Access |
|------|--------|
| Beta Lead | Full dashboard |
| Backend Team | Full dashboard |
| Product Team | View only |

## URL

Grafana Dashboard: `http://beta.grafana.armored-archer.internal/d/beta-errors`

---

**Version**: 1.0  
**Created**: 2026-03-17
