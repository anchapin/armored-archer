# Rollback Communication Plan

**Version**: 1.0.0  
**Last Updated**: 2026-03-16  
**Owner**: Backend Team  
**Status**: Active

---

## 🎯 Purpose

This document defines the communication procedures, templates, and channels to be used during a backend rollback from Go to TypeScript.

---

## 📋 Communication Triggers

### When to Initiate Communication

| Trigger | Who to Notify | Timeline | Channel |
|---------|--------------|----------|---------|
| **Issue Detected** | On-call, Tech Lead | Immediate | PagerDuty, Phone |
| **Rollback Decision** | Engineering Team | < 5 min | Slack #incidents |
| **Rollback Started** | All Stakeholders | < 10 min | Slack, Email |
| **Rollback Complete** | All Stakeholders | < 5 min | Slack, Email, Status Page |
| **Post-Mortem Scheduled** | All Stakeholders | < 24 hours | Email, Calendar |

---

## 👥 Stakeholder Matrix

### Internal Stakeholders

| Group | Who | Contact Method | Message Type |
|-------|-----|----------------|--------------|
| **Engineering** | All engineers | Slack #engineering | Technical details |
| **Leadership** | EM, CTO | Slack #leadership + Email | High-level status |
| **Product** | PMs, Designers | Slack #product | User impact |
| **Support** | Customer Support | Slack #support | User-facing info |
| **Marketing** | Marketing Team | Slack #marketing | Public messaging |

### External Stakeholders

| Group | Who | Contact Method | Message Type |
|-------|-----|----------------|--------------|
| **Users** | Active players | Status Page, In-app | Service status |
| **Partners** | API consumers | Email, Status Page | API status |
| **Press** | Media contacts | Email (via Marketing) | Public statement |

---

## 📢 Communication Templates

### Template 1: Initial Incident Alert

**When**: Issue detected, evaluating rollback  
**Audience**: Engineering team, Leadership  
**Channel**: Slack #incidents, #engineering

```
🚨 INCIDENT ALERT

Service: Armored Archer Backend
Detected: YYYY-MM-DD HH:MM UTC
Severity: [Critical/High/Medium]

Issue: [Brief description of the problem]
Impact: [What users are experiencing]

Current Status: Investigating
Rollback Under Consideration: Yes

Incident Commander: @name
Tech Lead: @name

Next Update: In 15 minutes

Incident Channel: #incidents-YYYYMMDD
```

---

### Template 2: Rollback Decision

**When**: Decision made to rollback  
**Audience**: All internal stakeholders  
**Channel**: Slack #incidents, #engineering, #leadership

```
🔄 ROLLBACK INITIATED

Service: Armored Archer Backend
Decision Time: YYYY-MM-DD HH:MM UTC
Reason: [Why rollback was decided]

Rollback Type: [Module-only / Full / Emergency]
Estimated Duration: [XX minutes]
Expected Completion: HH:MM UTC

Impact During Rollback:
- [ ] Service unavailable
- [ ] Degraded performance
- [ ] No user impact

Status: In Progress

Incident Commander: @name
Backend Lead: @name

Next Update: In 15 minutes or when complete

#rollback #incident
```

---

### Template 3: Rollback Complete (Success)

**When**: Rollback completed successfully  
**Audience**: All stakeholders  
**Channel**: Slack (all channels), Email, Status Page

```
✅ ROLLBACK COMPLETE

Service: Armored Archer Backend
Completed: YYYY-MM-DD HH:MM UTC
Duration: XX minutes

Status: All Systems Operational

Verification Results:
✓ Health checks passing
✓ Smoke tests passing
✓ Error rate: < 1%
✓ Latency: Normal
✓ Database: Healthy

User Impact: [Minimal/None/Resolved]

Post-Mortem: Scheduled for YYYY-MM-DD HH:MM UTC
Incident Report: [Link to document]

Thank you to everyone involved in the rollback!

#rollback #resolved
```

---

### Template 4: Rollback Complete (Issues)

**When**: Rollback completed but issues remain  
**Audience**: Internal stakeholders  
**Channel**: Slack #incidents, #engineering

```
⚠️ ROLLBACK COMPLETE - ISSUES REMAIN

Service: Armored Archer Backend
Completed: YYYY-MM-DD HH:MM UTC
Duration: XX minutes

Status: Partially Operational

Outstanding Issues:
- [Issue 1]
- [Issue 2]

Current Actions:
- [Action 1]
- [Action 2]

Next Steps:
1. [Immediate action]
2. [Follow-up action]

Next Update: In 30 minutes

#rollback #incident
```

---

### Template 5: Status Page Update

**When**: Public status update needed  
**Audience**: Users, Partners  
**Channel**: Status Page

```
Incident: Backend Service Degradation

Update [X]:
Our team identified an issue with the backend service affecting [specific functionality].
A rollback to the previous stable version was initiated at HH:MM UTC.

Current Status: [Investigating / Identified / Monitoring / Resolved]
Impact: Some users may have experienced [specific impact]

Next Update: In 30 minutes

---

[When Resolved]

Resolved: YYYY-MM-DD HH:MM UTC
Duration: XX minutes

Resolution:
Our team successfully rolled back the backend to a stable version.
All systems are now operational.

We apologize for any inconvenience caused.
```

---

### Template 6: Stakeholder Email

**When**: Formal notification to leadership/stakeholders  
**Audience**: Leadership, Non-technical stakeholders  
**Channel**: Email

```
Subject: [RESOLVED] Armored Archer Backend Incident - YYYY-MM-DD

Hi Team,

An incident occurred today affecting the Armored Archer backend service.

INCIDENT SUMMARY
================
Issue: [Brief, non-technical description]
Detected: YYYY-MM-DD HH:MM UTC
Resolved: YYYY-MM-DD HH:MM UTC
Duration: XX minutes
Severity: [Critical/High/Medium]

IMPACT
======
Users experienced: [Description of user impact]
Number of users affected: [Estimate]
Revenue impact: [If applicable]

RESOLUTION
==========
The team executed a rollback to the previous stable version.
All systems are now operational.

TIMELINE
========
HH:MM - Issue detected
HH:MM - Incident response initiated
HH:MM - Rollback decision made
HH:MM - Rollback completed
HH:MM - Service verified operational

NEXT STEPS
==========
1. Complete incident investigation
2. Root cause analysis
3. Implement preventive measures
4. Update monitoring/alerting if needed

POST-MORTEM
===========
A post-mortem meeting is scheduled for YYYY-MM-DD HH:MM UTC.
Meeting link: [Calendar link]

We apologize for any disruption this incident caused.

Regards,
[Your Name]
[Your Title]
```

---

### Template 7: Customer Support Brief

**When**: Support team needs user-facing talking points  
**Audience**: Customer Support team  
**Channel**: Slack #support, Email

```
📞 CUSTOMER SUPPORT BRIEF

Incident: Backend Service Disruption
Date: YYYY-MM-DD HH:MM UTC
Status: RESOLVED

WHAT HAPPENED
=============
[Brief, simple explanation for non-technical audience]

USER IMPACT
===========
Users may have experienced:
- [Issue 1]
- [Issue 2]

WHAT TO TELL USERS
==================
"We experienced a temporary service disruption on [date].
Our team quickly resolved the issue and all systems are now
operational. We apologize for any inconvenience."

COMPENSATION (if applicable)
============================
[Details of any user compensation]

ESCALATION
==========
If a user is particularly upset or requests escalation:
1. Apologize sincerely
2. Document their concern
3. Escalate to: [Name/Team]
4. Response time: Within 24 hours

FAQ
===
Q: Will this happen again?
A: We are implementing measures to prevent recurrence.

Q: Did I lose any progress/items?
A: [Answer based on data integrity verification]

Contact: @product-manager for additional questions
```

---

## 📱 Communication Channels

### Primary Channels

| Channel | Purpose | Audience | Owner |
|---------|---------|----------|-------|
| **Slack #incidents** | Real-time incident coordination | Engineering | On-call |
| **Slack #engineering** | Technical updates | Engineering | Tech Lead |
| **Slack #leadership** | Executive updates | Leadership | EM/CTO |
| **PagerDuty** | Emergency alerts | On-call | SRE |
| **Status Page** | Public updates | Users | Product |
| **Email** | Formal notifications | All stakeholders | EM |

### Escalation Contacts

| Level | Role | Contact | Response Time |
|-------|------|---------|---------------|
| L1 | On-Call Engineer | PagerDuty | < 5 min |
| L2 | Tech Lead | Phone | < 15 min |
| L3 | Engineering Manager | Phone | < 30 min |
| L4 | CTO | Phone | < 1 hour |

---

## 🕐 Communication Timeline

### During Rollback

```
T+0     Issue detected
T+5     Initial alert to on-call
T+10    Rollback decision communicated
T+15    Rollback started (update sent)
T+30    Status update (if still in progress)
T+45    Status update (if still in progress)
T+60    Rollback complete or escalation
T+65    Completion notification
T+90    Detailed summary sent
```

### Post-Rollback

```
D+0     Incident resolved
D+1     Post-mortem scheduled
D+2-3   Post-mortem meeting
D+5     Post-mortem report published
D+7     Follow-up actions reviewed
```

---

## 📊 Communication Metrics

Track these metrics for each incident:

| Metric | Target | Actual |
|--------|--------|--------|
| Time to first alert | < 5 min | |
| Time to rollback decision | < 30 min | |
| Time to stakeholder notification | < 15 min | |
| Status page update frequency | Every 30 min | |
| Post-mortem scheduled | < 24 hours | |
| Post-mortem completed | < 5 days | |

---

## 🔧 Communication Tools

### Required Tools

- **Slack**: Primary communication channel
- **PagerDuty**: Emergency alerts
- **Status Page**: Public updates (e.g., Statuspage, Status.io)
- **Email**: Formal notifications
- **Google Docs**: Incident documentation
- **Calendar**: Post-mortem scheduling

### Tool Access

Ensure these contacts have access:

| Tool | Admin | Backup Admin |
|------|-------|--------------|
| Slack | @admin | @backup-admin |
| PagerDuty | @oncall-admin | @backup-oncall |
| Status Page | @product | @marketing |
| Email List | @admin | @backup-admin |

---

## 📝 Pre-Written Messages

Save these as templates/snippets for quick access:

### Slack Snippets

```
/rollback-start
/rollback-complete
/rollback-issue
/status-update
/post-mortem-scheduled
```

### Email Templates

Save Templates 1-7 in your email client's templates/canned responses.

---

## ✅ Communication Checklist

### Before Rollback

- [ ] On-call notified
- [ ] Tech Lead notified
- [ ] Engineering Manager notified
- [ ] Incident channel created
- [ ] Status page team alerted

### During Rollback

- [ ] Initial alert sent
- [ ] Rollback decision communicated
- [ ] Rollback started notification sent
- [ ] Regular status updates (every 15-30 min)
- [ ] Leadership kept informed

### After Rollback

- [ ] Completion notification sent
- [ ] Status page updated
- [ ] Support team briefed
- [ ] Post-mortem scheduled
- [ ] Stakeholder email sent
- [ ] Documentation updated

---

## 🎯 Regional Considerations

### Time Zone Awareness

| Region | Business Hours | After-Hours Contact |
|--------|---------------|---------------------|
| **US West** | 9 AM - 6 PM PT | PagerDuty |
| **US East** | 9 AM - 6 PM ET | PagerDuty |
| **Europe** | 9 AM - 6 PM CET | PagerDuty |
| **Asia** | 9 AM - 6 PM JST | PagerDuty |

### Language Considerations

- All official communications in English
- Status page available in: [List languages]
- Support team can handle: [List languages]

---

## 📚 Related Documents

- [Rollback Runbook](./ROLLBACK_RUNBOOK.md)
- [On-Call Escalation](./ONCALL_ESCALATION.md)
- [Incident Response Playbook](./INCIDENT_RESPONSE.md)
- [Post-Mortem Template](./POST_MORTEM_TEMPLATE.md)

---

## 📞 Quick Reference

### Emergency Contacts

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| On-Call | [Name] | [Phone] | @oncall |
| Tech Lead | [Name] | [Phone] | @techlead |
| EM | [Name] | [Phone] | @engmgr |
| CTO | [Name] | [Phone] | @cto |

### Key Links

- Status Page: [URL]
- Grafana Dashboard: [URL]
- Incident Channel: [URL]
- Rollback Runbook: [URL]

---

**END OF COMMUNICATION PLAN**
