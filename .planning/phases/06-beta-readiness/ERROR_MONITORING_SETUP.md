# Error Rate Monitoring Setup

**Phase**: 06 - Beta Readiness
**Plan**: 06-01
**Version**: v2.1.0-beta.1
**Created**: 2026-03-20

---

## Overview

This document describes the error rate monitoring configuration for the beta environment, including Prometheus metrics, alerting rules, dashboards, and validation procedures.

---

## Error Metrics

### Prometheus Metrics

**RPC Error Rate Metric**:
```promql
# Total RPC errors
nakama_rpc_errors_total{method, error_type}

# Total RPC calls
nakama_rpc_calls_total{method, status}

# Error rate calculation
sum(rate(nakama_rpc_errors_total[5m])) / sum(rate(nakama_rpc_calls_total[5m]))
```

**Target**: < 0.005 (0.5%)

**Alert Threshold**: > 0.01 (1%)

---

### RPC Endpoint Error Tracking

**Endpoints Monitored**:

| RPC Method | Description | Error Budget |
|------------|-------------|--------------|
| `GetPlayerStats` | Fetch player statistics | < 1% |
| `GetSeasonInfo` | Fetch season information | < 1% |
| `GetLeaderboard` | Fetch leaderboard data | < 1% |
| `GetInventory` | Fetch player inventory | < 1% |
| `CombatStart` | Start combat encounter | < 0.5% |
| `CombatEnd` | Complete combat encounter | < 0.5% |
| `FindMatch` | Find PvP match | < 2% |
| `JoinMatch` | Join PvP match | < 1% |
| `PurchaseItem` | Purchase from store | < 0.1% |
| `SubmitFeedback` | Submit beta feedback | < 5% |

**Error Budget**: Maximum acceptable error rate per endpoint

---

## Alerting Configuration

### Prometheus Alert Rules

**File**: `backend/alerts.yml`

```yaml
groups:
  - name: beta_error_alerts
    interval: 30s
    rules:
      # High overall error rate
      - alert: BetaHighErrorRate
        expr: |
          sum(rate(nakama_rpc_errors_total{job="nakama-beta"}[5m]))
          /
          sum(rate(nakama_rpc_calls_total{job="nakama-beta"}[5m])) > 0.01
        for: 5m
        labels:
          severity: critical
          environment: beta
        annotations:
          summary: "Beta error rate exceeds 1%"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 1%)"

      # Critical endpoint error rate
      - alert: BetaCriticalEndpointErrorRate
        expr: |
          sum(rate(nakama_rpc_errors_total{job="nakama-beta", method=~"CombatStart|CombatEnd|PurchaseItem"}[5m]))
          /
          sum(rate(nakama_rpc_calls_total{job="nakama-beta", method=~"CombatStart|CombatEnd|PurchaseItem"}[5m])) > 0.005
        for: 3m
        labels:
          severity: warning
          environment: beta
        annotations:
          summary: "Critical endpoint error rate exceeds 0.5%"
          description: "{{ $labels.method }} error rate is {{ $value | humanizePercentage }}"

      # Specific endpoint error spike
      - alert: BetaEndpointErrorSpike
        expr: |
          sum(rate(nakama_rpc_errors_total{job="nakama-beta"}[5m])) by (method)
          /
          sum(rate(nakama_rpc_calls_total{job="nakama-beta"}[5m])) by (method) > 0.02
        for: 2m
        labels:
          severity: warning
          environment: beta
        annotations:
          summary: "Error spike on {{ $labels.method }}"
          description: "{{ $labels.method }} error rate is {{ $value | humanizePercentage }}"

      # Zero RPC calls (service down)
      - alert: BetaNoRPCalls
        expr: sum(rate(nakama_rpc_calls_total{job="nakama-beta"}[1m])) == 0
        for: 2m
        labels:
          severity: critical
          environment: beta
        annotations:
          summary: "No RPC calls detected"
          description: "Nakama beta may be down or not accepting requests"

      # Database connection errors
      - alert: BetaDatabaseErrorRate
        expr: |
          sum(rate(nakama_rpc_errors_total{job="nakama-beta", error_type="database"}[5m]))
          /
          sum(rate(nakama_rpc_calls_total{job="nakama-beta"}[5m])) > 0.005
        for: 3m
        labels:
          severity: critical
          environment: beta
        annotations:
          summary: "Database error rate exceeds 0.5%"
          description: "Database errors are {{ $value | humanizePercentage }} of all calls"
```

---

### Alertmanager Configuration

**File**: `backend/alertmanager.yml`

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: '${SLACK_WEBHOOK_URL}'

route:
  receiver: 'beta-alerts'
  group_by: ['alertname', 'environment']
  group_wait: 10s
  group_interval: 5m
  repeat_interval: 12h
  routes:
    - match:
        severity: critical
      receiver: 'beta-critical'
    - match:
        severity: warning
      receiver: 'beta-warning'

receivers:
  - name: 'beta-alerts'
    slack_configs:
      - channel: '#beta-alerts'
        title: 'Beta Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'beta-critical'
    slack_configs:
      - channel: '#beta-critical'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        color: 'danger'
    email_configs:
      - to: 'devops@armored-archer.internal'
        subject: '🚨 CRITICAL Beta Alert: {{ .GroupLabels.alertname }}'
        body: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'beta-warning'
    slack_configs:
      - channel: '#beta-alerts'
        title: '⚠️ WARNING: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        color: 'warning'
```

---

## Grafana Dashboard

### Dashboard Configuration

**File**: `backend/grafana/dashboards/beta-error-monitoring.json`

**Panels**:

1. **Overall Error Rate** (Gauge)
   - Query: `sum(rate(nakama_rpc_errors_total[5m])) / sum(rate(nakama_rpc_calls_total[5m]))`
   - Thresholds: < 0.5% (green), 0.5-1% (yellow), > 1% (red)

2. **Error Rate by Endpoint** (Graph)
   - Query: `sum(rate(nakama_rpc_errors_total[5m])) by (method) / sum(rate(nakama_rpc_calls_total[5m])) by (method)`
   - Type: Time series graph
   - Group by: RPC method

3. **Error Count by Type** (Pie Chart)
   - Query: `sum(rate(nakama_rpc_errors_total[5m])) by (error_type)`
   - Types: database, validation, authentication, network, timeout

4. **Top 5 Error-Prone Endpoints** (Table)
   - Query: Top 5 methods by error rate
   - Columns: Method, Error Rate, Error Count, Total Calls

5. **RPC Call Volume** (Graph)
   - Query: `sum(rate(nakama_rpc_calls_total[5m]))`
   - Type: Time series graph
   - Unit: requests per second

6. **Error Rate Trend** (Graph)
   - Query: Moving average of error rate over 1 hour
   - Type: Time series graph
   - Trend line: linear regression

---

### Dashboard Layout

```
+--------------------------+--------------------------+
|    Overall Error Rate    |  Error Rate by Endpoint  |
|        (Gauge)           |        (Graph)           |
+--------------------------+--------------------------+
|    Error Count by Type   |   Top 5 Error Endpoints  |
|       (Pie Chart)        |        (Table)           |
+--------------------------+--------------------------+
|      RPC Call Volume     |    Error Rate Trend      |
|        (Graph)           |        (Graph)           |
+--------------------------+--------------------------+
```

---

## Error Validation

### Pre-Beta Validation

**Step 1: Verify Metrics Collection**
```bash
# Check if metrics are being collected
curl -s http://localhost:9090/api/v1/query?query=nakama_rpc_errors_total | jq '.data.result'

# Expected: At least one metric with beta labels
```

**Step 2: Test Error Calculation**
```bash
# Calculate current error rate
curl -s 'http://localhost:9090/api/v1/query?query=sum(rate(nakama_rpc_errors_total[5m]))/sum(rate(nakama_rpc_calls_total[5m]))' | jq '.data.result[0].value[1]'

# Expected: Value < 0.005 (0.5%)
```

**Step 3: Validate Alert Rules**
```bash
# Check if alert rules are loaded
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.name=="BetaHighErrorRate")'

# Expected: Alert rule with health="ok"
```

**Step 4: Test Alert Notifications**
```bash
# Trigger test alert (temporary increase threshold)
# Verify Slack notification received
# Verify email notification received
```

---

### Beta Period Monitoring

**Daily Checks** (10 AM):
1. Check error rate dashboard (last 24 hours)
2. Review alert firings (if any)
3. Investigate error spikes
4. Document findings in #beta-standup

**Weekly Reviews** (Friday 3 PM):
1. Error rate trend analysis (7 days)
2. Top error-prone endpoints
3. Error type distribution
4. Alert effectiveness review
5. Adjust thresholds if needed

---

## Error Response Procedures

### Level 1: Error Rate 0.5% - 1% (Warning)

**Actions**:
1. Check Grafana dashboard for error patterns
2. Identify affected endpoints
3. Review recent deployments
4. Check database performance
5. Monitor for escalation

**Timeline**: Respond within 30 minutes

---

### Level 2: Error Rate 1% - 5% (Critical)

**Actions**:
1. Page on-call engineer
2. Investigate root cause (logs, metrics)
3. Implement hotfix if critical bug
4. Consider rollback if recent deployment
5. Communicate to beta users

**Timeline**: Respond within 10 minutes

---

### Level 3: Error Rate > 5% (Severe)

**Actions**:
1. Emergency response team activation
2. Immediate rollback if recent deployment
3. Disable affected features if needed
4. Broadcast status update to beta users
5. Post-mortem preparation

**Timeline**: Respond within 5 minutes

---

## Error Budget Calculation

### Monthly Error Budget

**Target**: 0.5% error rate
**Budget**: 0.5% × 43,200 minutes/month = 216 minutes of downtime/errors

**Error Budget Consumption**:

| Week | Error Rate | Budget Used | Budget Remaining |
|------|------------|-------------|------------------|
| 1 | 0.3% | 30 min | 186 min |
| 2 | 0.4% | 40 min | 146 min |
| 3 | 0.6% | 65 min | 81 min |
| 4 | 0.2% | 20 min | 61 min |

**Alert**: If budget used > 80%, pause non-critical deployments

---

## Error Reporting

### Daily Error Report

**Format**:
```markdown
# Beta Error Report - YYYY-MM-DD

## Summary
- Overall Error Rate: 0.3%
- Total RPC Calls: 1.2M
- Total Errors: 3,600
- Status: 🟢 Normal

## Top Error-Prone Endpoints
1. FindMatch: 0.8% (96 errors)
2. CombatStart: 0.5% (60 errors)
3. GetInventory: 0.4% (48 errors)

## Error Type Distribution
- Database: 40%
- Timeout: 30%
- Validation: 20%
- Network: 10%

## Alerts Fired
- BetaEndpointErrorSpike (FindMatch): 2 times
- Duration: 5 minutes each

## Actions Taken
- Investigated FindMatch timeout issue
- Added database index for match queries
- Error rate returned to normal

## Tomorrow's Focus
- Monitor FindMatch performance
- Review database query optimization
```

---

### Weekly Error Summary

**Format**:
```markdown
# Beta Error Summary - Week N

## Metrics
- Average Error Rate: 0.35%
- Peak Error Rate: 0.8% (Tuesday 2 PM)
- Total Errors: 25,200
- Error Budget Used: 30%

## Trends
- 🟢 Error rate decreasing (was 0.4% last week)
- 🟢 Database errors reduced by 20%
- 🟡 Timeout errors increased by 10%

## Top Issues
1. FindMatch timeouts (resolved)
2. GetInventory slow queries (in progress)
3. PurchaseItem validation errors (new)

## Improvements Made
- Added database index for match queries
- Optimized inventory cache TTL
- Improved validation error messages

## Upcoming Week
- Deploy inventory optimization
- Monitor timeout errors
- Review error budget usage
```

---

## Integration with CI/CD

### Pre-Deployment Checks

**GitHub Workflow**: `.github/workflows/beta-error-check.yml`

```yaml
name: Beta Error Rate Check

on:
  pull_request:
    branches: [main]

jobs:
  error-rate-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check error rate
        run: |
          ERROR_RATE=$(curl -s 'http://beta-api.armored-archer.internal/metrics' | \
            grep 'nakama_rpc_errors_total' | \
            awk '{sum+=$1} END {print sum}')
          echo "Current error rate: $ERROR_RATE"
          if (( $(echo "$ERROR_RATE > 0.005" | bc -l) )); then
            echo "Error rate exceeds 0.5% threshold"
            exit 1
          fi
```

---

## Success Criteria

**Beta Launch Readiness**:

- [ ] Error rate < 0.5% for 24 hours
- [ ] All alert rules loaded and healthy
- [ ] Grafana dashboard configured and tested
- [ ] Alert notifications working (Slack + email)
- [ ] Error budget calculated and tracked
- [ ] On-call engineer assigned
- [ ] Error response procedures documented
- [ ] CI/CD integration tested

---

**Document Version**: 1.0
**Last Updated**: 2026-03-20
**Next Review**: After Week 1 of beta

---

*Generated by Beta Readiness Phase (06-01)*
