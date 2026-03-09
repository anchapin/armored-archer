# On-Call Rotation & Escalation Policy

## Overview

This document defines the on-call rotation schedule, escalation procedures, and response expectations for the Armored Archer game infrastructure. The goal is to ensure timely response to alerts while maintaining healthy on-call schedules for the team.

---

## On-Call Schedule

### Primary Rotation

| Week | Primary On-Call | Secondary On-Call |
|------|-----------------|-------------------|
| Week 1 | Backend Engineer A | Backend Engineer B |
| Week 2 | Backend Engineer B | Frontend Engineer A |
| Week 3 | Frontend Engineer A | DevOps Engineer |
| Week 4 | DevOps Engineer | Backend Engineer A |

### Rotation Details

- **Rotation Period:** Weekly (Monday 00:00 UTC to following Monday 00:00 UTC)
- **Primary Responsibility:** Acknowledge and respond to all alerts within SLA
- **Secondary Responsibility:** Assist primary if overwhelmed, provide backup during primary's absence
- **Handoff:** Weekly sync meeting on Mondays at 11:00 UTC

### Contact Information

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| Backend Lead | [Name] | +1-XXX-XXX-XXXX | backend-lead@armored-archer.example.com | @backend-lead |
| DevOps Lead | [Name] | +1-XXX-XXX-XXXX | devops@armored-archer.example.com | @devops |
| Security Lead | [Name] | +1-XXX-XXX-XXXX | security@armored-archer.example.com | @security-lead |
| Product Lead | [Name] | +1-XXX-XXX-XXXX | product@armored-archer.example.com | @product-lead |

---

## Escalation Policy

### Severity Levels

| Severity | Description | Response Time | Example |
|----------|-------------|---------------|---------|
| **Critical** | Service down, data loss risk, revenue impact | 15 minutes | Game server down, payment failures |
| **Warning** | Degraded performance, potential impact | 30 minutes | High latency, memory pressure |
| **Info** | Awareness, trends | 24 hours | Low revenue, version mismatch |

### Escalation Path

```
┌─────────────────────────────────────────────────────────────────┐
│                        ALERT TRIGGERED                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Primary On-Call     │
                    │   (15 min - Critical)│
                    │   (30 min - Warning) │
                    └───────────────────────┘
                                │
                    No Ack / No Resolution
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Secondary On-Call   │
                    │   (10 min after)     │
                    └───────────────────────┘
                                │
                    No Ack / No Resolution
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Team Lead          │
                    │   (10 min after)     │
                    └───────────────────────┘
                                │
                    No Ack / No Resolution
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Department Head    │
                    │   (10 min after)     │
                    └───────────────────────┘
```

### Response Time SLAs

| Severity | First Ack | Resolution Target | Notification |
|----------|-----------|-------------------|--------------|
| Critical | 15 min | 1 hour | PagerDuty → Slack → Phone |
| Warning | 30 min | 4 hours | Slack → Email |
| Info | 24 hours | N/A | Email only |

---

## Alert Response Procedures

### Critical Alerts (P0)

1. **Immediate Actions:**
   - Acknowledge alert within 15 minutes
   - Check Grafana dashboard for current state
   - Review recent deployments/changes
   - Begin incident investigation

2. **Communication:**
   - Post in `#armored-archer-critical` Slack channel
   - Update incident status every 30 minutes
   - If service restoration takes >1 hour, notify department head

3. **Resolution Steps:**
   - Follow runbook for specific alert type
   - If runbook insufficient, escalate to secondary
   - Document timeline and actions taken

### Warning Alerts (P1)

1. **Immediate Actions:**
   - Acknowledge within 30 minutes
   - Investigate during next working cycle if business hours
   - Plan remediation

2. **Communication:**
   - Post in `#armored-archer-warnings`
   - Add to daily standup discussion if persistent

### Info Alerts (P2)

1. **Actions:**
   - Review during regular work hours
   - Add to weekly review meeting if action needed

---

## Runbooks

### Game Server Down

1. Check Nakama server status: `docker ps | grep nakama`
2. Review recent logs: `docker logs armored_archer_server --tail 100`
3. Check database connectivity
4. If recent deployment, consider rollback
5. Restart services if needed: `docker-compose restart nakama`

### High Error Rate

1. Check Grafana error breakdown dashboard
2. Identify error types and patterns
3. Review recent code deployments
4. Check external service dependencies
5. Create incident ticket if sustained >30 min

### Database Issues

1. Check database health: `docker exec armored_archer_db pg_isready`
2. Review connection pool: Grafana dashboard
3. Check for long-running queries
4. Review disk space

### Payment Failures

1. Check payment gateway status (Stripe/RevenueCat)
2. Verify API keys are valid
3. Review error logs for failure patterns
4. Contact payment provider support if needed

---

## On-Call Best Practices

### Before Your Shift

- [ ] Review active incidents
- [ ] Check scheduled deployments/maintenance
- [ ] Update contact info in PagerDuty
- [ ] Ensure you have VPN access
- [ ] Review runbooks for common issues

### During Your Shift

- [ ] Carry phone and check regularly
- [ ] Acknowledge alerts promptly
- [ ] Document all actions taken
- [ ] Update stakeholders proactively

### After Your Shift

- [ ] Handoff active incidents to next on-call
- [ ] Document any pending follow-ups
- [ ] Update runbooks if new issues found
- [ ] Take required rest period

---

## Rotation Management

### Scheduling

- Schedule managed via PagerDuty
- Self-swap allowed with 48-hour notice
- Swap requires team lead approval
- No more than 2 consecutive weeks

### Time Off

- Request time off at least 2 weeks in advance
- Ensure coverage is arranged
- Backup on-call during extended absence

---

## Contact Information

### External Contacts

| Service | Contact | URL |
|---------|---------|-----|
| AWS Support | [Account] | console.aws.amazon.com/support |
| Nakama Support | Heroic Labs | heroiclabs.com/support |
| Stripe Support | [Account] | dashboard.stripe.com/support |
| RevenueCat Support | [Account] | app.revenuecat.com/support |
| PagerDuty Support | [Account] | support.pagerduty.com |

### Internal Contacts

| Role | Responsibility |
|------|----------------|
| Backend Lead | Backend services, Nakama, API |
| DevOps Lead | Infrastructure, CI/CD, Monitoring |
| Security Lead | Security incidents, anti-cheat |
| Product Lead | Feature issues, analytics |

---

## Appendix: PagerDuty Configuration

### Policies

| Policy | Escalation Time | Users |
|--------|-----------------|-------|
| Armored Archer Critical | 15 → 10 → 10 min | Primary → Secondary → Lead |
| Armored Archer Warning | 30 → 30 min | Primary → Secondary |
| Armored Archer Info | 24 hours | Primary |

### Integration

- Prometheus → Alertmanager → PagerDuty
- Slack → PagerDuty (bidirectional)
- PagerDuty mobile app required for on-call

---

*Last Updated: 2024*
*Review Cycle: Quarterly*
*Document Owner: DevOps Lead*
