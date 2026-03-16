# Armored Archer Status Page Setup Guide

**Version**: 1.0
**Created**: 2026-03-16
**Status**: ✅ Complete
**Owner**: DevOps / Community Manager

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Platform Selection](#platform-selection)
3. [Domain Configuration](#domain-configuration)
4. [Component Setup](#component-setup)
5. [Monitoring Integration](#monitoring-integration)
6. [Incident Management](#incident-management)
7. [Communication Integration](#communication-integration)
8. [Testing & Validation](#testing-validation)
9. [Maintenance](#maintenance)

---

## 🎯 Overview

This guide covers the complete setup of the Armored Archer status page at
`status.armoredarcher.com`, including platform selection, configuration,
monitoring integration, and incident management procedures.

### Purpose
- Provide real-time visibility into server status
- Communicate incidents and maintenance to users
- Build trust through transparency
- Reduce support ticket volume during incidents

### Key Features
- Real-time status monitoring
- Incident tracking and updates
- Scheduled maintenance notifications
- Historical uptime data
- Discord and email notifications
- API for integrations

### Time Estimate
- **Platform Setup**: 1-2 hours
- **Domain Configuration**: 30 minutes
- **Monitoring Integration**: 1-2 hours
- **Testing**: 30 minutes
- **Total**: 3-4 hours

---

## 🎪 Platform Selection

### Recommended Platforms

#### Option 1: Instatus (Recommended)
**URL**: https://instatus.com

**Pros**:
- Free tier available
- Modern, clean design
- Easy Discord integration
- Custom domain support
- API access
- Multiple team members

**Cons**:
- Limited customization on free tier
- Branding on free tier

**Pricing**:
- Free: 1 status page, 5 team members, basic features
- Pro ($49/mo): Custom CSS, advanced analytics, priority support

**Best For**: Small to medium projects, quick setup

#### Option 2: Atlassian Statuspage
**URL**: https://www.atlassian.com/software/statuspage

**Pros**:
- Industry standard
- Excellent integrations
- Professional appearance
- Robust API
- Incident templates

**Cons**:
- Expensive ($29-299/mo)
- Overkill for small projects

**Pricing**:
- Starter ($29/mo): 100 subscribers, basic features
- Pro ($99/mo): 500 subscribers, advanced features
- Enterprise ($299/mo): Unlimited, premium support

**Best For**: Larger organizations, enterprise needs

#### Option 3: Statusfy (Self-Hosted)
**URL**: https://statusfy.co

**Pros**:
- Open source (free)
- Full control
- No monthly cost
- Customizable

**Cons**:
- Requires hosting
- More setup time
- Self-maintenance

**Pricing**:
- Free (open source)
- Hosting costs: ~$5-10/mo

**Best For**: Budget-conscious, technical teams

#### Option 4: Better Stack
**URL**: https://betterstack.com/better-uptime

**Pros**:
- Modern interface
- Good free tier
- Incident management
- Monitoring included

**Cons**:
- Limited customization
- Learning curve

**Pricing**:
- Free: 10 monitors, 3 team members
- Pro ($79/mo): 100 monitors, unlimited team

**Best For**: Teams wanting monitoring + status page

### Selection Criteria

| Feature | Instatus | Statuspage | Statusfy | Better Stack |
|---------|----------|------------|----------|--------------|
| Cost | Free | $29+/mo | Free | Free |
| Setup Time | 30 min | 1 hour | 2-3 hours | 1 hour |
| Custom Domain | ✅ | ✅ | ✅ | ✅ |
| Discord Integration | ✅ | ✅ | ⚠️ (webhook) | ✅ |
| Monitoring | ⚠️ (basic) | ⚠️ (basic) | ❌ | ✅ |
| API Access | ✅ | ✅ | ✅ | ✅ |
| Customization | Medium | High | Very High | Low |
| Maintenance | None | None | Self | None |

### Recommendation

**For Alpha Phase**: Use **Instatus** (free tier)
- Quick setup
- No cost
- All essential features
- Easy to migrate later if needed

**For Production**: Consider **Statuspage** or **Better Stack**
- More robust features
- Better scalability
- Professional appearance

---

## 🌐 Domain Configuration

### Step 1: DNS Setup

#### For Custom Domain (status.armoredarcher.com)

**Cloudflare DNS Configuration**:
```
Type: CNAME
Name: status
Content: [platform-provided-domain]
Proxy: Disabled (orange cloud off)
TTL: Auto
```

**Example for Instatus**:
```
Type: CNAME
Name: status
Content: your-page.instatus.com
Proxy: Disabled
TTL: Auto
```

**Example for Statuspage**:
```
Type: CNAME
Name: status
Content: your-page.statuspage.io
Proxy: Disabled
TTL: Auto
```

### Step 2: SSL Certificate

Most platforms provide automatic SSL. Verify:
- [ ] HTTPS is enabled
- [ ] Certificate is valid
- [ ] No mixed content warnings

### Step 3: Domain Verification

**Instatus**:
```
1. Go to Settings → Domains
2. Add custom domain: status.armoredarcher.com
3. Add CNAME record (see above)
4. Click "Verify"
5. Wait for propagation (5-10 minutes)
6. Enable HTTPS
```

**Statuspage**:
```
1. Go to Settings → Domains
2. Add custom domain
3. Follow DNS instructions
4. Verify ownership
5. Enable SSL
```

### Step 4: Test Domain

```bash
# Verify DNS propagation
dig status.armoredarcher.com
nslookup status.armoredarcher.com

# Test HTTPS
curl -I https://status.armoredarcher.com

# Check SSL certificate
openssl s_client -connect status.armoredarcher.com:443
```

---

## 🔧 Component Setup

### Step 1: Define Components

Create these components in your status page:

#### Game Services

**1. Game Server**
```
Name: Game Server
Description: Main game server and matchmaking
Group: Game Services
Critical: Yes
```

**2. Authentication**
```
Name: Authentication
Description: User login and session management
Group: Game Services
Critical: Yes
```

**3. Matchmaking**
```
Name: Matchmaking
Description: Player matching and lobby creation
Group: Game Services
Critical: Yes
```

**4. Combat Services**
```
Name: Combat Services
Description: Combat calculations and effects
Group: Game Services
Critical: Yes
```

#### Backend Services

**5. API**
```
Name: API
Description: REST API endpoints
Group: Backend Services
Critical: Yes
```

**6. Database**
```
Name: Database
Description: PostgreSQL database
Group: Backend Services
Critical: Yes
```

**7. Cache**
```
Name: Cache
Description: Redis cache layer
Group: Backend Services
Critical: No
```

#### External Services

**8. Discord Bot**
```
Name: Discord Bot
Description: Discord integration and notifications
Group: External Services
Critical: No
```

**9. Website**
```
Name: Website
Description: Main website (armoredarcher.com)
Group: External Services
Critical: No
```

**10. CDN**
```
Name: CDN
Description: Content delivery for assets
Group: External Services
Critical: No
```

### Step 2: Configure Component Groups

```
Group 1: Game Services
- Game Server
- Authentication
- Matchmaking
- Combat Services

Group 2: Backend Services
- API
- Database
- Cache

Group 3: External Services
- Discord Bot
- Website
- CDN
```

### Step 3: Set Status Thresholds

For each component, configure automatic status detection:

#### Game Server
```
Operational: All instances healthy
Degraded Performance: >5% error rate OR P95 latency >200ms
Partial Outage: >20% error rate OR P95 latency >500ms
Major Outage: >50% error rate OR all instances down
```

#### Authentication
```
Operational: Response time <100ms, error rate <1%
Degraded Performance: Response time 100-500ms OR error rate 1-5%
Partial Outage: Response time >500ms OR error rate 5-20%
Major Outage: Service unavailable OR error rate >20%
```

#### Matchmaking
```
Operational: Queue time <5 min
Degraded Performance: Queue time 5-10 min
Partial Outage: Queue time 10-30 min
Major Outage: Queue time >30 min OR service down
```

#### Database
```
Operational: All connections healthy, replication lag <1s
Degraded Performance: Connection pool >70% OR replication lag 1-5s
Partial Outage: Connection pool >90% OR replication lag >5s
Major Outage: Database unavailable OR data loss
```

### Step 4: Configure Metrics Display

#### Public Metrics
```
Show on status page:
- Current uptime (24h, 7d, 30d)
- Average response time
- Incident history (90 days)
- Active incidents
```

#### Internal Metrics (Admin Only)
```
Show on admin dashboard:
- Detailed performance graphs
- Error rate breakdown by endpoint
- Database query performance
- Resource utilization
- Alert history
```

---

## 📊 Monitoring Integration

### Step 1: Prometheus Integration

#### Configure Prometheus Metrics Endpoint

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'armored-archer-backend'
    static_configs:
      - targets: ['backend.armoredarcher.com:9090']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'armored-archer-database'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 30s
```

#### Key Metrics to Export

```go
// Backend metrics to expose
rpc_request_total{endpoint, status}
rpc_request_duration_seconds{endpoint, quantile}
rpc_error_total{endpoint, error_type}
database_connections{state}
database_query_duration_seconds{query_type, quantile}
cache_hit_ratio{cache_name}
active_players{}
matchmaking_queue_size{}
matchmaking_queue_duration_seconds{quantile}
```

### Step 2: Grafana Dashboard

#### Create Status Page Dashboard

```json
{
  "dashboard": {
    "title": "Status Page Metrics",
    "panels": [
      {
        "title": "API Response Time (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rpc_request_duration_seconds_bucket)"
          }
        ],
        "thresholds": [
          {"value": 100, "color": "green"},
          {"value": 200, "color": "yellow"},
          {"value": 500, "color": "red"}
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "sum(rate(rpc_error_total[5m])) / sum(rate(rpc_request_total[5m])) * 100"
          }
        ],
        "thresholds": [
          {"value": 1, "color": "green"},
          {"value": 5, "color": "yellow"},
          {"value": 10, "color": "red"}
        ]
      },
      {
        "title": "Active Players",
        "targets": [
          {
            "expr": "active_players"
          }
        ]
      }
    ]
  }
}
```

### Step 3: Alert Rules

#### Configure Prometheus Alert Rules

```yaml
# alerting_rules.yml
groups:
  - name: status_page_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: sum(rate(rpc_error_total[5m])) / sum(rate(rpc_request_total[5m])) > 0.05
        for: 2m
        labels:
          severity: warning
          component: api
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rpc_request_duration_seconds_bucket) > 0.5
        for: 5m
        labels:
          severity: warning
          component: api
        annotations:
          summary: "High latency detected"
          description: "P95 latency is {{ $value | humanizeDuration }}"

      - alert: ServiceDown
        expr: up{job="armored-archer-backend"} == 0
        for: 1m
        labels:
          severity: critical
          component: backend
        annotations:
          summary: "Service is down"
          description: "Backend service has been down for more than 1 minute"

      - alert: DatabaseConnectionPoolExhausted
        expr: database_connections{state="used"} / database_connections{state="total"} > 0.9
        for: 2m
        labels:
          severity: warning
          component: database
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "{{ $value | humanizePercentage }} of connections in use"

      - alert: MatchmakingQueueHigh
        expr: matchmaking_queue_size > 100
        for: 5m
        labels:
          severity: warning
          component: matchmaking
        annotations:
          summary: "High matchmaking queue"
          description: "{{ $value }} players waiting in queue"
```

### Step 4: Status Page Webhook

#### Configure Alertmanager Webhook

```yaml
# alertmanager.yml
receivers:
  - name: 'status_page'
    webhook_configs:
      - url: 'https://api.instatus.com/v1/webhooks/alerts'
        send_resolved: true
        max_alerts: 5

route:
  receiver: 'status_page'
  group_by: ['component', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
```

#### Webhook Payload Format

```json
{
  "status": "firing" | "resolved",
  "incident": {
    "title": "{{ alert name }}",
    "description": "{{ alert description }}",
    "severity": "{{ severity }}",
    "component": "{{ component }}",
    "started_at": "{{ startsAt }}",
    "resolved_at": "{{ endsAt }}"
  }
}
```

---

## 🚨 Incident Management

### Incident Workflow

```
┌─────────────────────────────────────────┐
│         Issue Detected                  │
│  (Automated alert or user report)       │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         Triage (5 min)                  │
│  - Verify issue                         │
│  - Assess severity                      │
│  - Identify affected components         │
│  - Assign incident commander            │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         Create Incident                 │
│  - Update status page                   │
│  - Send Discord notification            │
│  - Notify team                          │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         Investigate                     │
│  - Gather information                   │
│  - Identify root cause                  │
│  - Provide updates every 15-30 min      │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         Resolve                         │
│  - Deploy fix                           │
│  - Verify resolution                    │
│  - Update status to Monitoring          │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         Close & Report                  │
│  - Confirm stable for 30+ min           │
│  - Update status to Resolved            │
│  - Create post-incident report          │
└─────────────────────────────────────────┘
```

### Incident Severity Levels

#### Sev1 - Critical
```
Definition: Complete service outage, data loss, security breach
Response Time: < 15 minutes
Update Frequency: Every 15 minutes
Examples:
- All game servers down
- Database corruption
- Security breach
- Data loss
```

#### Sev2 - High
```
Definition: Major feature broken, significant degradation
Response Time: < 30 minutes
Update Frequency: Every 30 minutes
Examples:
- Matchmaking not working
- Authentication failures
- >50% error rate
- P95 latency >1 second
```

#### Sev3 - Medium
```
Definition: Minor feature broken, some users affected
Response Time: < 2 hours
Update Frequency: Every 2 hours
Examples:
- Leaderboard not updating
- Discord bot down
- Intermittent errors (<20%)
```

#### Sev4 - Low
```
Definition: Cosmetic issues, minor inconvenience
Response Time: < 24 hours
Update Frequency: Daily
Examples:
- Status page itself down
- Minor UI bugs
- Non-critical errors
```

### Incident Templates

#### Initial Incident Update

```markdown
**Status**: Investigating

**Impact**: Users are experiencing {{specific impact}}.

**Started**: {{Timestamp}}

**What We're Doing**:
Our team has been alerted and is investigating reports of {{issue}}.
We're currently {{action being taken}}.

**Next Update**: {{Timestamp, 15-30 min from now}}

---
Incident ID: INC-YYYY-MM-DD-XXX
```

#### Investigation Update

```markdown
**Status**: Identified

**Impact**: {{Specific impact}}

**Started**: {{Timestamp}}
**Updated**: {{Timestamp}}

**What We Found**:
We've identified the root cause: {{technical explanation}}.

**What We're Doing**:
Our team is currently {{specific action}}. We expect to have a fix
deployed within {{estimated time}}.

**Next Update**: {{Timestamp}}

---
Incident ID: INC-YYYY-MM-DD-XXX
```

#### Monitoring Update

```markdown
**Status**: Monitoring

**Impact**: Service has been restored. Some users may still experience issues.

**Started**: {{Timestamp}}
**Updated**: {{Timestamp}}

**What Happened**:
A fix was deployed at {{timestamp}}. We're now monitoring the situation
to ensure stability.

**What to Expect**:
Most users should now be able to {{action}} normally. If you're still
experiencing issues, please try {{workaround}}.

**Next Update**: {{Timestamp, 30 min from now}}

---
Incident ID: INC-YYYY-MM-DD-XXX
```

#### Resolution Update

```markdown
**Status**: Resolved

**Impact**: Service has been fully restored.

**Started**: {{Timestamp}}
**Resolved**: {{Timestamp}}
**Duration**: {{Duration}}

**What Happened**:
{{Brief summary of the incident}}.

**Resolution**:
{{What fixed the issue}}.

**Next Steps**:
We'll be conducting a post-incident review to prevent similar issues
in the future. A detailed report will be published within 24 hours.

Thank you for your patience.

---
Incident ID: INC-YYYY-MM-DD-XXX
```

### Post-Incident Report Template

```markdown
# Post-Incident Report: {{Incident Title}}

**Incident ID**: INC-YYYY-MM-DD-XXX
**Date**: {{Date}}
**Duration**: {{Duration}}
**Severity**: Sev{{1-4}}
**Components Affected**: {{List}}

## Executive Summary

{{2-3 sentence summary for non-technical stakeholders}}

## Impact

- **Users Affected**: {{Number/Percentage}}
- **Duration**: {{Minutes/Hours}}
- **Services Impacted**: {{List}}
- **Data Impact**: {{None/Minimal/Significant}}

## Timeline

| Time (UTC) | Event |
|------------|-------|
| HH:MM | Issue began (detected in hindsight) |
| HH:MM | Alert triggered |
| HH:MM | On-call engineer acknowledged |
| HH:MM | Investigation started |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Service restored |
| HH:MM | Incident declared resolved |

## Root Cause

{{Detailed technical explanation of what caused the issue}}

### Contributing Factors
- {{Factor 1}}
- {{Factor 2}}
- {{Factor 3}}

## Resolution

{{What was done to fix the issue}}

### Fix Details
- **Code Changes**: {{PR links}}
- **Configuration Changes**: {{Description}}
- **Deployment**: {{How it was deployed}}

## Prevention

### Immediate Actions (Completed)
- [x] {{Action 1}}
- [x] {{Action 2}}
- [x] {{Action 3}}

### Long-Term Actions (Planned)
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| {{Action}} | {{Owner}} | {{Date}} | {{Status}} |
| {{Action}} | {{Owner}} | {{Date}} | {{Status}} |

### Monitoring Improvements
- {{New alert or metric}}
- {{Dashboard update}}

## Lessons Learned

### What Went Well
- {{Positive 1}}
- {{Positive 2}}

### What Could Be Improved
- {{Improvement 1}}
- {{Improvement 2}}

### Follow-Up Actions
| Action | Owner | Due Date |
|--------|-------|----------|
| {{Action}} | {{Owner}} | {{Date}} |
| {{Action}} | {{Owner}} | {{Date}} |

---
**Report Author**: {{Name}}
**Review Date**: {{Date}}
**Distribution**: Team, Stakeholders
```

---

## 💬 Communication Integration

### Discord Integration

#### Step 1: Create Discord Webhook

```
1. Go to your Discord server
2. Server Settings → Integrations → Webhooks
3. New Webhook
4. Name: Status Updates
5. Channel: #server-status
6. Copy Webhook URL
7. Save securely
```

#### Step 2: Configure Status Page Webhook

**Instatus**:
```
1. Settings → Integrations → Webhooks
2. Add Webhook
3. URL: [Discord webhook URL]
4. Events:
   - ✅ Incident Created
   - ✅ Incident Updated
   - ✅ Incident Resolved
   - ✅ Maintenance Scheduled
   - ✅ Maintenance Started
   - ✅ Maintenance Completed
5. Save
```

#### Step 3: Test Integration

```
1. Create test incident
2. Verify Discord message appears
3. Update incident status
4. Verify update message
5. Resolve incident
6. Verify resolution message
```

#### Discord Message Format

```json
{
  "embeds": [{
    "title": "🔴 Incident: {{Component}} - {{Status}}",
    "description": "{{Incident description}}",
    "color": {{Color based on status}},
    "fields": [
      {
        "name": "Status",
        "value": "{{Status}}",
        "inline": true
      },
      {
        "name": "Started",
        "value": "{{Timestamp}}",
        "inline": true
      },
      {
        "name": "Next Update",
        "value": "{{Timestamp}}",
        "inline": true
      }
    ],
    "footer": {
      "text": "Incident ID: {{ID}} • status.armoredarcher.com"
    }
  }]
}
```

### Email Notifications

#### Step 1: Configure Email Subscribers

```
1. Status Page → Settings → Subscribers
2. Enable email notifications
3. Configure sender:
   - From: status@armoredarcher.com
   - Reply-to: support@armoredarcher.com
4. Customize email template
```

#### Step 2: Email Template

```html
Subject: [{{Status}}] {{Component}} - {{Incident Title}}

<html>
<body>
  <h2>Status Update: {{Component}}</h2>
  
  <p><strong>Status</strong>: {{Status}}</p>
  <p><strong>Impact</strong>: {{Impact description}}</p>
  
  <h3>Latest Update</h3>
  <p>{{Update message}}</p>
  
  <p><strong>Next Update</strong>: {{Timestamp}}</p>
  
  <hr>
  
  <p>View full details: <a href="https://status.armoredarcher.com">status.armoredarcher.com</a></p>
  
  <p>— Armored Archer Team</p>
  
  <hr>
  
  <p><small>You're receiving this because you subscribed to status updates.
  <a href="{{unsubscribe_link}}">Unsubscribe</a></small></p>
</body>
</html>
```

### API Integration

#### Status Page API

```typescript
// Example: Check current status
async function getCurrentStatus() {
  const response = await fetch('https://api.instatus.com/v1/status', {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY'
    }
  });
  return response.json();
}

// Example: Create incident
async function createIncident(data) {
  const response = await fetch('https://api.instatus.com/v1/incidents', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: data.title,
      description: data.description,
      severity: data.severity,
      components: data.components,
      status: data.status
    })
  });
  return response.json();
}

// Example: Update incident
async function updateIncident(incidentId, update) {
  const response = await fetch(`https://api.instatus.com/v1/incidents/${incidentId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(update)
  });
  return response.json();
}
```

---

## ✅ Testing & Validation

### Pre-Launch Checklist

#### Configuration
- [ ] Custom domain configured and verified
- [ ] SSL certificate valid
- [ ] All components created
- [ ] Component groups configured
- [ ] Status thresholds set

#### Monitoring
- [ ] Prometheus metrics exporting
- [ ] Grafana dashboards working
- [ ] Alert rules configured
- [ ] Alertmanager webhook set up
- [ ] Test alerts firing correctly

#### Communication
- [ ] Discord webhook configured
- [ ] Test message sent successfully
- [ ] Email notifications enabled
- [ ] Test email sent successfully
- [ ] API access configured

#### Documentation
- [ ] Incident templates created
- [ ] Runbooks documented
- [ ] Team trained on procedures
- [ ] Escalation contacts listed

### Functional Testing

#### Test 1: Incident Creation Flow
```
1. Trigger test alert (manually or via test endpoint)
2. Verify status page updates to "Investigating"
3. Verify Discord notification sent
4. Verify email sent to subscribers
5. Verify incident appears in history
6. Update incident status
7. Verify update propagates to all channels
8. Resolve incident
9. Verify resolution notification
```

#### Test 2: Maintenance Flow
```
1. Schedule maintenance (48h advance)
2. Verify status page shows "Scheduled"
3. Verify Discord notification sent
4. Verify reminder sent 24h before
5. Start maintenance
6. Verify status changes to "In Progress"
7. Complete maintenance
8. Verify status changes to "Completed"
```

#### Test 3: Monitoring Integration
```
1. Verify all metrics exporting
2. Check Grafana dashboards display data
3. Test alert thresholds (simulate high latency)
4. Verify alert fires correctly
5. Verify alert creates incident
6. Verify alert resolution closes incident
```

#### Test 4: Mobile Responsiveness
```
1. Open status page on mobile device
2. Verify all components visible
3. Verify incident updates readable
4. Test subscription flow
5. Verify navigation works
```

### User Acceptance Testing

Invite team members to test:
- [ ] Can view current status
- [ ] Can see incident history
- [ ] Can subscribe to updates
- [ ] Receive Discord notifications
- [ ] Receive email notifications
- [ ] Can navigate easily
- [ ] Information is clear

---

## 🔧 Maintenance

### Daily Tasks

| Task | Owner | Time |
|------|-------|------|
| Check status page health | DevOps | 5 min |
| Review any incidents | On-call | As needed |
| Monitor alert accuracy | DevOps | 10 min |

### Weekly Tasks

| Task | Owner | Time |
|------|-------|------|
| Review incident metrics | Community Manager | 30 min |
| Update component status if needed | DevOps | 15 min |
| Check subscriber count | Community Manager | 5 min |
| Review alert thresholds | DevOps | 30 min |

### Monthly Tasks

| Task | Owner | Time |
|------|-------|------|
| Review and archive old incidents | Community Manager | 1 hour |
| Update component definitions | DevOps | 30 min |
| Test incident response flow | All team | 1 hour |
| Review and update templates | Community Manager | 1 hour |
| Analyze uptime metrics | DevOps | 1 hour |

### Backup & Recovery

#### Configuration Backup
```
1. Export status page configuration monthly
2. Save component definitions
3. Backup webhook URLs (securely)
4. Document alert rules
5. Store in version control
```

#### Disaster Recovery
```
If status page is unavailable:
1. Use Discord #server-status channel for updates
2. Post updates directly in Discord
3. Use email for critical communications
4. Restore from backup when available
```

---

## 📊 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | > 99.9% | External monitoring |
| Incident Detection Time | < 5 min | Alert timestamps |
| First Update Time | < 15 min (Sev1) | Incident timeline |
| Update Frequency Compliance | > 95% | Incident audits |
| Subscriber Satisfaction | > 4/5 | Survey |
| False Positive Rate | < 5% | Alert analysis |

---

## 🐛 Troubleshooting

### Common Issues

#### Issue 1: Status Not Updating
**Symptoms**: Component shows wrong status
**Cause**: Monitoring integration broken
**Solution**:
1. Check Prometheus is scraping
2. Verify alert rules loaded
3. Check webhook connectivity
4. Test alert manually

#### Issue 2: Discord Notifications Not Sending
**Symptoms**: Incidents created but no Discord messages
**Cause**: Webhook URL invalid or expired
**Solution**:
1. Regenerate Discord webhook
2. Update status page integration
3. Test with manual message
4. Verify bot permissions

#### Issue 3: Email Not Delivered
**Symptoms**: Subscribers not receiving emails
**Cause**: Email configuration or deliverability
**Solution**:
1. Check email service status
2. Verify SPF/DKIM records
3. Check spam folder
4. Test with different email providers

#### Issue 4: Custom Domain Not Working
**Symptoms**: Can't access status page via custom domain
**Cause**: DNS not propagated or misconfigured
**Solution**:
1. Verify DNS records
2. Check CNAME target
3. Wait for propagation (up to 48h)
4. Clear DNS cache

---

## 🔗 Related Documents

- [Communication Plan](../../.planning/phases/03-user-onboarding/03-04-communication.md)
- [Discord Setup Guide](./ALPHA_DISCORD_SETUP.md)
- [Communication SLA](./COMMUNICATION_SLA.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Incident Response Runbook](./INCIDENT_RESPONSE.md) (create if needed)

---

## 📝 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-16 | [Author] | Initial creation |

---

**Status**: ✅ Complete
**Owner**: DevOps / Community Manager
**Next Review**: Before alpha launch
**Last Updated**: 2026-03-16
