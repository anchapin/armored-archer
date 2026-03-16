# Rollback Runbook - Armored Archer Alpha

**Version**: 1.0.0  
**Last Updated**: 2026-03-16  
**Owner**: Backend Team  
**Status**: Active  

---

## 🎯 Purpose

This runbook provides step-by-step instructions for rolling back the Armored Archer backend from Go to TypeScript in case of critical issues during alpha deployment.

---

## 📋 Table of Contents

1. [When to Rollback](#when-to-rollback)
2. [Rollback Decision Matrix](#rollback-decision-matrix)
3. [Responsible Parties](#responsible-parties)
4. [Rollback Time Estimates](#rollback-time-estimates)
5. [Pre-Rollback Checklist](#pre-rollback-checklist)
6. [Rollback Procedures](#rollback-procedures)
7. [Post-Rollback Verification](#post-rollback-verification)
8. [Communication Templates](#communication-templates)
9. [Troubleshooting](#troubleshooting)

---

## 🚨 When to Rollback

Rollback should be considered when **ANY** of the following conditions are met:

### Critical Triggers (Immediate Rollback Required)

| Trigger | Detection Method | Severity | Response Time |
|---------|-----------------|----------|---------------|
| **Data Corruption** | Data integrity checks fail, user reports | Critical | < 5 minutes |
| **Security Vulnerability** | Security scan, incident report | Critical | < 5 minutes |
| **Service Outage** | Health checks fail > 5 minutes | Critical | < 5 minutes |
| **Authentication Failure** | Login success rate < 50% | Critical | < 10 minutes |

### Warning Triggers (Evaluate Within 30 Minutes)

| Trigger | Detection Method | Severity | Response Time |
|---------|-----------------|----------|---------------|
| **Performance Degradation** | Response time > 2x baseline | High | < 30 minutes |
| **Error Rate Spike** | Error rate > 5% of requests | High | < 30 minutes |
| **Database Connection Issues** | Connection pool exhaustion | High | < 30 minutes |
| **Memory Leak** | Memory usage > 90% sustained | High | < 30 minutes |
| **Critical Feature Broken** | User reports, monitoring alerts | High | < 30 minutes |

### Monitoring Thresholds

```yaml
# Alert thresholds that may trigger rollback
health_check:
  failure_duration: 5m
  consecutive_failures: 3

performance:
  p95_latency_multiplier: 2.0
  p99_latency_multiplier: 3.0

errors:
  error_rate_threshold: 5%
  critical_error_count: 10/hour

resources:
  memory_usage: 90%
  cpu_usage: 95%
  database_connections: 90%
```

---

## 🎲 Rollback Decision Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROLLBACK DECISION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Issue Detected                                                 │
│       ↓                                                         │
│  Is it a Critical Trigger? ───YES──→ Immediate Rollback         │
│       ↓ NO                                                      │
│  Is it a Warning Trigger? ───YES──→ Evaluate (30 min)           │
│       ↓ YES                                                     │
│  Can it be fixed quickly? ───NO──→ Initiate Rollback            │
│       ↓ YES                                                     │
│  Apply Hotfix                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Decision Authority

| Role | Authority | Can Approve Rollback |
|------|-----------|---------------------|
| On-Call Engineer | Detect & Recommend | No |
| Tech Lead | Evaluate & Decide | Yes |
| Engineering Manager | Final Approval | Yes |
| CTO | Emergency Override | Yes |

---

## 👥 Responsible Parties

### Primary Roles

| Role | Name | Contact | Responsibilities |
|------|------|---------|------------------|
| **Incident Commander** | On-Call Engineer | PagerDuty | Coordinate rollback execution |
| **Backend Lead** | Tech Lead | Slack #backend | Technical decisions |
| **Database Admin** | DBA On-Call | PagerDuty | Database rollback |
| **DevOps** | SRE On-Call | PagerDuty | Infrastructure changes |
| **Communications** | Product Manager | Slack | Stakeholder updates |

### Escalation Path

```
Level 1: On-Call Engineer (0-15 min)
    ↓ (No response or escalation needed)
Level 2: Tech Lead (15-30 min)
    ↓ (Critical issue or no response)
Level 3: Engineering Manager (30-60 min)
    ↓ (Major incident)
Level 4: CTO (As needed)
```

### Contact Information

| Role | Primary | Secondary | Emergency |
|------|---------|-----------|-----------|
| On-Call Engineer | PagerDuty | Slack @oncall | Phone |
| Tech Lead | Slack @techlead | Email | Phone |
| Engineering Manager | Slack @engmgr | Email | Phone |
| DevOps | PagerDuty | Slack #devops | Phone |

---

## ⏱️ Rollback Time Estimates

| Phase | Estimated Time | Maximum Time |
|-------|---------------|--------------|
| **Detection & Decision** | 5-15 min | 30 min |
| **Module Rollback** | 5 min | 10 min |
| **Database Rollback** | 15-30 min | 45 min |
| **Service Restart** | 2-5 min | 10 min |
| **Verification** | 10-15 min | 20 min |
| **Communication** | 5 min | 10 min |
| **TOTAL** | **42-80 min** | **125 min** |

### RTO/RPO Targets

- **Recovery Time Objective (RTO)**: 60 minutes
- **Recovery Point Objective (RPO)**: 15 minutes (max data loss)

---

## ✅ Pre-Rollback Checklist

Before initiating rollback, verify:

- [ ] Issue has been confirmed as requiring rollback
- [ ] Rollback decision approved by Tech Lead or EM
- [ ] Backup of current state taken (if time permits)
- [ ] TypeScript module backup is available
- [ ] Database backup is available and verified
- [ ] Team notified via Slack #incidents
- [ ] Status page team notified
- [ ] Monitoring dashboards open
- [ ] Rollback scripts accessible
- [ ] Database admin available (if DB rollback needed)

---

## 🔧 Rollback Procedures

### Procedure A: Module-Only Rollback (No Database Changes)

**Use Case**: Go module has bugs but no database schema changes deployed

**Estimated Time**: 10-15 minutes

```bash
# 1. Stop Nakama service
sudo systemctl stop nakama

# 2. Backup current Go module
cd /opt/nakama/modules
cp server.so server.so.backup.$(date +%Y%m%d_%H%M%S)

# 3. Restore TypeScript module
cp /opt/nakama/backup/server.ts /opt/nakama/modules/server

# 4. Restore configuration if changed
cp /opt/nakama/backup/config.yml /etc/nakama/config.yml

# 5. Start Nakama service
sudo systemctl start nakama

# 6. Verify Nakama loaded TypeScript module
sudo journalctl -u nakama -n 50 --no-pager

# 7. Health check
curl -f http://localhost:7350/health || exit 1

# 8. Run smoke tests
./scripts/run-smoke-tests.sh
```

---

### Procedure B: Full Rollback (Module + Database)

**Use Case**: Go module deployed with database migrations that need rollback

**Estimated Time**: 30-45 minutes

```bash
# === PHASE 1: Stop Services ===

# 1. Put system in maintenance mode (optional but recommended)
# Update status page to "Maintenance"

# 2. Stop Nakama service
sudo systemctl stop nakama

# 3. Verify Nakama stopped
sudo systemctl status nakama

# === PHASE 2: Module Rollback ===

# 4. Backup current Go module
cd /opt/nakama/modules
cp server.so server.so.backup.$(date +%Y%m%d_%H%M%S)

# 5. Restore TypeScript module
cp /opt/nakama/backup/server.ts /opt/nakama/modules/server

# 6. Restore configuration
cp /opt/nakama/backup/config.yml /etc/nakama/config.yml

# === PHASE 3: Database Rollback ===

# 7. Identify backup to restore
# List available backups
ls -lh /opt/nakama/backups/*.sql.gz

# 8. Verify backup integrity
cd /opt/nakama/backups
sha256sum -c nakama_backup_YYYYMMDD_HHMMSS.sql.gz.sha256

# 9. Restore database
# Using Docker
docker exec -i armored_archer_postgres psql -U postgres -d nakama < nakama_backup_YYYYMMDD_HHMMSS.sql.gz

# OR using restore script
./scripts/restore-database.sh /opt/nakama/backups/nakama_backup_YYYYMMDD_HHMMSS.sql.gz

# 10. Verify database restore
./scripts/verify-migrations.sh

# === PHASE 4: Restart Services ===

# 11. Start Nakama service
sudo systemctl start nakama

# 12. Wait for Nakama to initialize
sleep 10

# 13. Verify Nakama started successfully
sudo systemctl status nakama
sudo journalctl -u nakama -n 50 --no-pager

# === PHASE 5: Verification ===

# 14. Health check
curl -f http://localhost:7350/health

# 15. Run smoke tests
./scripts/run-smoke-tests.sh

# 16. Verify critical RPCs
./scripts/verify-rpcs.sh

# 17. Check monitoring dashboards
# - Grafana: http://localhost:3000
# - Check error rates, latency, throughput

# 18. Remove maintenance mode
# Update status page to "Operational"
```

---

### Procedure C: Emergency Rollback (Automated)

**Use Case**: Critical incident requiring immediate rollback

**Estimated Time**: 5-10 minutes

```bash
# Run automated rollback script
cd /opt/nakama
sudo ./scripts/rollback-automated.sh --force

# Monitor rollback
tail -f /var/log/nakama/rollback.log

# Verify
curl -f http://localhost:7350/health
```

---

## 🔍 Post-Rollback Verification

### Immediate Checks (First 5 Minutes)

- [ ] Nakama service is running: `sudo systemctl status nakama`
- [ ] Health endpoint responds: `curl http://localhost:7350/health`
- [ ] No errors in logs: `sudo journalctl -u nakama -n 100`
- [ ] TypeScript module loaded (check logs for "TypeScript runtime initialized")

### Functional Checks (5-15 Minutes)

- [ ] Authentication works (test login RPC)
- [ ] Player data accessible (test get_player RPC)
- [ ] Matchmaking functional (test matchmaker RPC)
- [ ] Inventory system works (test get_inventory RPC)
- [ ] Combat system functional (test combat RPC)

### Monitoring Checks (15-30 Minutes)

- [ ] Error rate < 1%
- [ ] P95 latency < 500ms
- [ ] Request throughput normal
- [ ] Database connections healthy
- [ ] Memory usage < 70%
- [ ] CPU usage < 60%

### Data Integrity Checks

```bash
# Run data integrity verification
./scripts/data-integrity-checks.sh

# Verify player stats
psql -U postgres -d nakama -c "SELECT count(*) FROM player_stats;"

# Verify inventory
psql -U postgres -d nakama -c "SELECT count(*) FROM inventory;"

# Verify loadouts
psql -U postgres -d nakama -c "SELECT count(*) FROM loadout;"
```

---

## 📢 Communication Templates

### Template 1: Internal Rollback Notification

```
🚨 ROLLBACK INITIATED

Service: Armored Archer Backend
Time: YYYY-MM-DD HH:MM UTC
Reason: [Brief description of issue]
Impact: [Users affected / functionality impacted]

Rollback Type: [Module-only / Full / Emergency]
Estimated Duration: [XX minutes]

Status: In Progress

Next update in: 15 minutes

Incident Channel: #incidents-YYYYMMDD
Incident Commander: @name
```

### Template 2: Rollback Complete

```
✅ ROLLBACK COMPLETE

Service: Armored Archer Backend
Time: YYYY-MM-DD HH:MM UTC
Duration: XX minutes

Status: All systems operational

Verification:
- Health checks: PASSING
- Smoke tests: PASSING
- Error rate: < 1%
- Latency: Normal

Post-Mortem: Scheduled for [date/time]

Incident Report: [Link to incident doc]
```

### Template 3: Status Page Update

```
Incident: Backend Service Degradation

Update: Our team identified an issue with the backend service and has successfully rolled back to the previous stable version. All systems are now operational.

Resolved: YYYY-MM-DD HH:MM UTC
Duration: XX minutes
Impact: Some users may have experienced [specific impact]

Next Steps: We are conducting a thorough review to prevent recurrence.
```

### Template 4: Stakeholder Email

```
Subject: [RESOLVED] Armored Archer Backend Incident - YYYY-MM-DD

Hi Team,

An incident occurred today at HH:MM UTC affecting the Armored Archer backend.

Summary:
- Issue: [Brief description]
- Impact: [What users experienced]
- Duration: XX minutes
- Resolution: Successful rollback to previous stable version

Current Status: All systems operational

Next Steps:
1. Complete incident investigation
2. Root cause analysis
3. Preventive measures implementation

Post-mortem scheduled for: [date/time]

Regards,
[Your Name]
```

---

## 🛠️ Troubleshooting

### Issue: Rollback Script Fails

**Symptoms**: Script exits with error code

**Solutions**:
1. Check permissions: `chmod +x rollback-*.sh`
2. Verify backup files exist: `ls -la /opt/nakama/backup/`
3. Check disk space: `df -h`
4. Review logs: `tail -f /var/log/nakama/rollback.log`

### Issue: TypeScript Module Won't Load

**Symptoms**: Nakama fails to start or reports module load error

**Solutions**:
1. Verify TypeScript file exists: `ls -la /opt/nakama/modules/server.ts`
2. Check file permissions: `chmod 644 /opt/nakama/modules/server.ts`
3. Verify Nakama config points to correct module
4. Check Nakama logs: `sudo journalctl -u nakama -n 200`
5. Rebuild TypeScript module: `cd /opt/nakama && npm run build`

### Issue: Database Restore Fails

**Symptoms**: psql errors during restore

**Solutions**:
1. Verify backup integrity: `sha256sum -c backup.sql.gz.sha256`
2. Check disk space: `df -h`
3. Verify database connection: `psql -U postgres -d nakama -c '\dt'`
4. Check for active connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'nakama';`
5. Try restore with verbose output: `psql -v ON_ERROR_STOP=1 < backup.sql`

### Issue: Health Check Fails After Rollback

**Symptoms**: `curl http://localhost:7350/health` returns error

**Solutions**:
1. Check if Nakama is running: `sudo systemctl status nakama`
2. Check if port 7350 is listening: `netstat -tlnp | grep 7350`
3. Review Nakama logs: `sudo journalctl -u nakama -n 200 --no-pager`
4. Verify configuration: `cat /etc/nakama/config.yml`
5. Restart Nakama: `sudo systemctl restart nakama`

### Issue: High Error Rate After Rollback

**Symptoms**: Error rate remains elevated after rollback

**Solutions**:
1. Check logs for specific errors: `sudo journalctl -u nakama -f`
2. Verify database connection: `psql -U postgres -d nakama -c 'SELECT 1'`
3. Check RPC endpoint availability
4. Review recent code changes that may not have been rolled back
5. Verify client compatibility with rolled-back version

---

## 📚 Related Documents

- [Database Backup Procedure](./scripts/backup-database.sh)
- [Database Restore Procedure](./scripts/restore-database.sh)
- [Automated Rollback Script](./scripts/rollback-automated.sh)
- [Health Check Script](./scripts/health-check.sh)
- [Smoke Tests](./scripts/run-smoke-tests.sh)
- [Verification Queries](./scripts/verification-queries.sql)
- [Alerting Configuration](./alertmanager.yml)
- [On-Call Escalation](./ONCALL_ESCALATION.md)

---

## 📝 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-16 | Backend Team | Initial version |

---

## 🎯 Appendix: Quick Reference Commands

```bash
# Service Management
sudo systemctl start nakama
sudo systemctl stop nakama
sudo systemctl restart nakama
sudo systemctl status nakama

# Logs
sudo journalctl -u nakama -f
sudo journalctl -u nakama -n 200 --no-pager

# Health Check
curl http://localhost:7350/health

# Database
docker exec -it armored_archer_postgres psql -U postgres -d nakama

# Backup
./scripts/backup-database.sh

# Rollback
./scripts/rollback-automated.sh
```

---

**END OF RUNBOOK**
