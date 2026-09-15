# Alert Runbooks

This directory contains runbooks for responding to alerts configured in the Armored Archer monitoring system.

## 📚 Available Runbooks

The runbook set mirrors [`backend/alerts.yml`](../../backend/alerts.yml) 1:1 — every alert
has a corresponding runbook. If you add a new alert, write its runbook at the
same time and add a row below.

### Critical Alerts

| Runbook | Alert | Severity | Description |
|---------|-------|----------|-------------|
| [GameServerDown.md](./GameServerDown.md) | `GameServerDown` | Critical | Nakama server unavailable |
| [HighErrorRate.md](./HighErrorRate.md) | `HighErrorRate` | Critical | Error rate >5% for 5 minutes |
| [DatabaseDown.md](./DatabaseDown.md) | `DatabaseDown` | Critical | PostgreSQL unavailable |
| [PaymentProcessingFailures.md](./PaymentProcessingFailures.md) | `PaymentProcessingFailures` | Critical | IAP / RevenueCat failures detected |
| [PaymentProcessingFailures.md](./PaymentProcessingFailures.md) | `WebhookNotConfigured` | Critical | Webhook RPC fail-closed — secret unset, all purchases rejected (issue #1140) |
| [SuspiciousLoginActivity.md](./SuspiciousLoginActivity.md) | `SuspiciousLoginActivity` | Critical | Failed-login rate >10/min (possible brute force) |
| [AdminAccessDeniedSpike.md](./AdminAccessDeniedSpike.md) | `AdminAllowlistEmpty` | Critical | Admin allowlist empty — every admin RPC rejects every caller |
| [SettlementDegraded.md](./SettlementDegraded.md) | `SettlementClaimFailed` | Critical | Settlement claim failures — matches cannot settle, retries safe (issue #1143) |

### Warning Alerts

| Runbook | Alert | Severity | Description |
|---------|-------|----------|-------------|
| [HighLatency.md](./HighLatency.md) | `HighLatency` | Warning | P95 latency >2s for 3 minutes |
| [DiskSpaceLow.md](./DiskSpaceLow.md) | `DiskSpaceLow` | Warning | Disk space <15% available |
| [HighMemoryUsage.md](./HighMemoryUsage.md) | `HighMemoryUsage` | Warning | Memory usage >85% for 5 minutes |
| [HighCPUUsage.md](./HighCPUUsage.md) | `HighCPUUsage` | Warning | CPU usage >80% for 5 minutes |
| [DatabaseConnectionPoolExhausted.md](./DatabaseConnectionPoolExhausted.md) | `DatabaseConnectionPoolExhausted` | Warning | DB connection pool >90% |
| [AntiCheatViolationSpike.md](./AntiCheatViolationSpike.md) | `AntiCheatViolationSpike` | Warning | Anti-cheat violations >5/min (possible new exploit) |
| [AdminAccessDeniedSpike.md](./AdminAccessDeniedSpike.md) | `AdminAccessDeniedSpike` | Warning | Admin-guard rejections >5/min for 5m (probing or broken allowlist) |
| [UnusualAPICallPattern.md](./UnusualAPICallPattern.md) | `UnusualAPICallPattern` | Warning | RPC request rate >1000/min (possible bots / DDoS) |
| [MatchmakingQueueBuilding.md](./MatchmakingQueueBuilding.md) | `MatchmakingQueueBuilding` | Warning | Matchmaking queue >100 for 5 minutes |
| [ActiveUsersAnomaly.md](./ActiveUsersAnomaly.md) | `ActiveUsersAnomaly` | Warning | Active users >50% drift vs 1h ago |
| [SessionDurationAnomaly.md](./SessionDurationAnomaly.md) | `SessionDurationAnomaly` | Warning | Avg session duration >30% drift vs 24h ago |
| [PaymentProcessingFailures.md](./PaymentProcessingFailures.md) | `WebhookLagHigh` | Warning | Webhook p95 processing latency >2s for 5m (issue #1140) |
| [PaymentProcessingFailures.md](./PaymentProcessingFailures.md) | `WebhookSignatureFailureSpike` | Warning | Webhook signature rejections >1/min — rotated secret or forgery (issue #1140) |
| [PaymentProcessingFailures.md](./PaymentProcessingFailures.md) | `WebhookRedisDegraded` | Warning | Redis errors on the webhook dedup fast path >1/min (issue #1140) |
| [SettlementDegraded.md](./SettlementDegraded.md) | `SettlementDegradedSpike` | Warning | Partially-applied settlements >0.5/min for 5m — manual reconciliation needed (issue #1143) |

### Info Alerts

| Runbook | Alert | Severity | Description |
|---------|-------|----------|-------------|
| [LowRevenue.md](./LowRevenue.md) | `LowRevenue` | Info | 24h revenue <100 cents/hour |
| [ClientVersionMismatch.md](./ClientVersionMismatch.md) | `ClientVersionMismatch` | Info | A non-current client version has >10 active users |

## 🚨 Alert Response Process

### 1. Receive Alert

Alerts are sent via:
- **Slack**: `#armored-archer-critical` or `#armored-archer-warnings`
- **Email**: `on-call@armored-archer.example.com`
- **PagerDuty**: Critical alerts only

### 2. Acknowledge

1. Click "Acknowledge" in the alert notification
2. Post in Slack channel: "Looking into this"
3. Update PagerDuty incident (if applicable)

### 3. Assess

1. Open the relevant runbook
2. Verify the alert is real (not a false positive)
3. Check impact scope (users affected, services impacted)
4. Estimate severity (critical, high, medium, low)

### 4. Diagnose

1. Follow the troubleshooting steps in the runbook
2. Gather information (logs, metrics, traces)
3. Identify root cause
4. Document findings in incident thread

### 5. Resolve

1. Follow resolution procedures in runbook
2. Verify fix is working
3. Monitor for recurrence
4. Confirm alert has resolved

### 6. Post-Incident

1. Document incident summary
2. Update runbook if needed
3. Create follow-up tickets
4. Schedule post-mortem if critical

## 📞 Escalation Matrix

| Severity | Response Time | Escalation Path |
|----------|--------------|-----------------|
| Critical | 5 minutes | On-call → Team Lead → CTO |
| Warning | 30 minutes | On-call → Team Lead |
| Info | Next business day | Team backlog |

## 🔧 Tools & Access

### Monitoring Tools
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Grafana**: http://localhost:3000

### Common Commands

```bash
# Check alert status
curl http://alertmanager:9093/api/v2/alerts

# Check Prometheus metrics
curl http://prometheus:9090/api/v1/query?query=<metric>

# View Nakama logs
docker logs nakama --tail 100

# Check container status
docker ps | grep nakama

# View system resources
docker stats nakama --no-stream
```

## 📋 Runbook Structure

Each runbook contains:

1. **Alert Definition**: Expression, duration, impact
2. **Escalation Path**: Who to contact and when
3. **Initial Assessment**: How to verify the alert
4. **Troubleshooting Steps**: Systematic diagnosis
5. **Resolution Procedures**: How to fix common scenarios
6. **Verification**: How to confirm resolution
7. **Post-Incident Actions**: Follow-up tasks
8. **Related Resources**: Links to documentation
9. **Contact Information**: Team channels

## 🔄 Runbook Maintenance

### When to Update

- After responding to an alert
- When procedures change
- When new tools are added
- After post-mortem recommendations
- When false positives occur

### How to Update

1. Make changes to the runbook
2. Test any new commands
3. Submit PR for review
4. Notify team of changes

## 📊 Alert Metrics

Track these metrics to improve alerting:

- **Mean Time to Acknowledge (MTTA)**: Target < 5 minutes
- **Mean Time to Resolve (MTTR)**: Target < 30 minutes
- **False Positive Rate**: Target < 5%
- **Alert Volume**: Target < 10 per day (non-info)

## 🎯 On-Call Responsibilities

### Before Shift

1. Review recent incidents
2. Check for known issues
3. Verify monitoring is working
4. Test alerting channels

### During Shift

1. Monitor alert channels
2. Respond to pages within SLA
3. Document all incidents
4. Escalate when needed

### After Shift

1. Handoff to next on-call
2. Document ongoing issues
3. Update runbooks if needed
4. Create follow-up tickets

## 🔗 Related Resources

- [Alert Configuration Guide](../../.planning/phases/02-monitoring/02-03-alerts.md)
- [Alertmanager Config](../../backend/alertmanager.yml)
- [Alert Rules](../../backend/alerts.yml)
- [Testing Script](../../backend/scripts/test-alerts.sh)
- [Metrics Verification Script](../../backend/scripts/verify-metrics.sh)

---

**Last Updated**: 2026-03-16  
**Maintained By**: Backend Team
