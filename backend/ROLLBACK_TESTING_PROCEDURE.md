# Rollback Testing Procedure

**Version**: 1.0.0  
**Last Updated**: 2026-03-16  
**Owner**: Backend Team  
**Environment**: Staging (NOT Production/Alpha)

---

## 🎯 Purpose

This document describes the procedure for testing the rollback process from Go backend to TypeScript backend in a safe staging environment.

---

## ⚠️ Important Warnings

- **NEVER** test rollback on production or alpha environments
- Always test on staging environment first
- Ensure staging database has realistic test data
- Schedule rollback tests during low-traffic periods
- Have a rollback plan for the rollback (re-deploy Go if test fails)

---

## 📋 Pre-Test Checklist

Before starting rollback test:

- [ ] Staging environment is healthy
- [ ] No active deployments or changes in progress
- [ ] Team notified of rollback test
- [ ] Monitoring dashboards open and visible
- [ ] All rollback scripts accessible
- [ ] TypeScript backup module available
- [ ] Database backup available
- [ ] Test data prepared in staging
- [ ] Rollback test runbook reviewed
- [ ] Estimated downtime communicated

---

## 🧪 Rollback Test Scenarios

### Scenario 1: Module-Only Rollback Test

**Objective**: Verify TypeScript module can replace Go module without database changes

**Estimated Time**: 15-20 minutes

#### Test Steps

```bash
# === PRE-TEST VERIFICATION ===

# 1. Verify current state (Go module)
echo "=== Current Module Check ==="
sudo systemctl status nakama
curl http://localhost:7350/health

# 2. Record baseline metrics
echo "=== Baseline Metrics ==="
# Note current response times, error rates, etc.

# === ROLLBACK EXECUTION ===

# 3. Stop Nakama service
echo "=== Stopping Nakama ==="
sudo systemctl stop nakama

# 4. Backup current Go module
echo "=== Backing up Go module ==="
cd /opt/nakama/modules
sudo cp server.so server.so.backup.test.$(date +%Y%m%d_%H%M%S)

# 5. Restore TypeScript module
echo "=== Restoring TypeScript module ==="
sudo cp /opt/nakama/backup/server.ts /opt/nakama/modules/server

# 6. Restore configuration (if needed)
echo "=== Restoring configuration ==="
sudo cp /opt/nakama/backup/config.yml /etc/nakama/config.yml

# 7. Start Nakama service
echo "=== Starting Nakama ==="
sudo systemctl start nakama

# 8. Wait for initialization
echo "=== Waiting for Nakama to initialize ==="
sleep 10

# === POST-ROLLBACK VERIFICATION ===

# 9. Check service status
echo "=== Service Status ==="
sudo systemctl status nakama

# 10. Health check
echo "=== Health Check ==="
curl -f http://localhost:7350/health

# 11. Check logs for TypeScript initialization
echo "=== Log Check ==="
sudo journalctl -u nakama -n 50 --no-pager | grep -i typescript

# 12. Run smoke tests
echo "=== Smoke Tests ==="
./scripts/run-smoke-tests.sh --quick

# === METRICS VERIFICATION ===

# 13. Compare metrics to baseline
echo "=== Metrics Comparison ==="
# Check Grafana dashboard for:
# - Response times
# - Error rates
# - Throughput

# === TEST RESULTS ===

# 14. Document results
echo "=== Test Results ==="
# Record:
# - Rollback duration
# - Any errors encountered
# - Performance comparison
# - Pass/Fail status
```

#### Success Criteria

- [ ] Nakama starts successfully with TypeScript module
- [ ] Health check passes
- [ ] No errors in logs
- [ ] Smoke tests pass
- [ ] Performance within 20% of baseline
- [ ] Error rate < 1%

---

### Scenario 2: Full Rollback Test (Module + Database)

**Objective**: Verify complete rollback including database restore

**Estimated Time**: 30-45 minutes

#### Test Steps

```bash
# === PRE-TEST PREPARATION ===

# 1. Create test data
echo "=== Creating Test Data ==="
psql -U postgres -d nakama << EOF
-- Create test records
INSERT INTO player_stats (user_id, level, experience) 
VALUES ('test_user_rollback', 1, 0)
ON CONFLICT (user_id) DO UPDATE SET level = 1, experience = 0;

-- Record test timestamp
INSERT INTO audit_log (event_type, metadata, created_at)
VALUES ('rollback_test_start', '{"test": true}', NOW());
EOF

# 2. Take pre-rollback backup
echo "=== Creating Pre-Rollback Backup ==="
./scripts/backup-database.sh

# 3. Record current state
echo "=== Recording Current State ==="
BEFORE_COUNT=$(psql -U postgres -d nakama -t -c "SELECT count(*) FROM player_stats;")
echo "Player stats before: $BEFORE_COUNT"

# === DEPLOY GO MODULE (Simulate Current State) ===

# 4. Deploy Go module (if not already deployed)
# (Skip if already running Go module)

# === ROLLBACK EXECUTION ===

# 5. Stop services
echo "=== Stopping Services ==="
sudo systemctl stop nakama

# 6. Backup Go module
echo "=== Backing up Go module ==="
cd /opt/nakama/modules
sudo cp server.so server.so.backup.fulltest.$(date +%Y%m%d_%H%M%S)

# 7. Restore TypeScript module
echo "=== Restoring TypeScript module ==="
sudo cp /opt/nakama/backup/server.ts /opt/nakama/modules/server

# 8. Restore database
echo "=== Restoring Database ==="
# Find latest backup
LATEST_BACKUP=$(ls -t /opt/nakama/backups/nakama_backup_*.sql.gz | head -1)
echo "Restoring from: $LATEST_BACKUP"

# Verify checksum
sha256sum -c "${LATEST_BACKUP}.sha256"

# Restore
./scripts/restore-database.sh "$LATEST_BACKUP"

# 9. Start services
echo "=== Starting Services ==="
sudo systemctl start nakama
sleep 10

# === POST-ROLLBACK VERIFICATION ===

# 10. Verify service health
echo "=== Service Health ==="
sudo systemctl status nakama
curl -f http://localhost:7350/health

# 11. Verify database restore
echo "=== Database Verification ==="
AFTER_COUNT=$(psql -U postgres -d nakama -t -c "SELECT count(*) FROM player_stats;")
echo "Player stats after: $AFTER_COUNT"

# 12. Verify test data was removed (proves restore worked)
TEST_DATA_EXISTS=$(psql -U postgres -d nakama -t -c \
  "SELECT EXISTS(SELECT 1 FROM player_stats WHERE user_id = 'test_user_rollback');")
echo "Test data exists: $TEST_DATA_EXISTS (should be 'f' for false)"

# 13. Run smoke tests
echo "=== Smoke Tests ==="
./scripts/run-smoke-tests.sh

# 14. Run data integrity checks
echo "=== Data Integrity Checks ==="
./scripts/data-integrity-checks.sh

# === DOCUMENTATION ===

# 15. Record test results
echo "=== Test Results ==="
# Document:
# - Total rollback time
# - Database restore time
# - Any issues encountered
# - Data integrity verification results
```

#### Success Criteria

- [ ] Database restored successfully
- [ ] Checksum verification passed
- [ ] All tables restored
- [ ] Data integrity checks pass
- [ ] TypeScript module loads correctly
- [ ] All RPC endpoints functional
- [ ] Performance acceptable

---

### Scenario 3: Emergency Rollback Test (Automated)

**Objective**: Verify automated rollback script works correctly

**Estimated Time**: 10-15 minutes

#### Test Steps

```bash
# === PRE-TEST SETUP ===

# 1. Verify automated script exists
echo "=== Script Verification ==="
ls -la /opt/nakama/scripts/rollback-automated.sh

# 2. Review script contents
echo "=== Script Review ==="
cat /opt/nakama/scripts/rollback-automated.sh

# === EXECUTE AUTOMATED ROLLBACK ===

# 3. Run automated rollback
echo "=== Executing Automated Rollback ==="
cd /opt/nakama
sudo ./scripts/rollback-automated.sh --test-mode

# 4. Monitor rollback progress
echo "=== Monitoring Progress ==="
tail -f /var/log/nakama/rollback.log

# === VERIFICATION ===

# 5. Verify rollback completed
echo "=== Verification ==="
curl -f http://localhost:7350/health
./scripts/run-smoke-tests.sh

# 6. Check rollback logs
echo "=== Rollback Logs ==="
cat /var/log/nakama/rollback.log
```

#### Success Criteria

- [ ] Automated script executes without errors
- [ ] Rollback completes in < 10 minutes
- [ ] All verification steps pass
- [ ] Logs show successful completion

---

## 📊 Test Results Template

### Rollback Test Report

**Test Date**: YYYY-MM-DD HH:MM  
**Environment**: Staging  
**Test Scenario**: [Module-Only / Full / Emergency]  
**Test Conductor**: [Name]

#### Timing

| Phase | Target Time | Actual Time | Status |
|-------|-------------|-------------|--------|
| Detection & Decision | 5 min | | |
| Service Stop | 2 min | | |
| Module Rollback | 5 min | | |
| Database Restore | 30 min | | |
| Service Start | 5 min | | |
| Verification | 15 min | | |
| **TOTAL** | **60 min** | | |

#### Test Results

| Check | Expected | Actual | Pass/Fail |
|-------|----------|--------|-----------|
| Service starts | Success | | |
| Health check | 200 OK | | |
| TypeScript loads | Yes | | |
| Smoke tests | Pass | | |
| Data integrity | Pass | | |
| Performance | < 20% degradation | | |

#### Issues Encountered

| Issue | Severity | Resolution |
|-------|----------|------------|
| | | |

#### Lessons Learned

- 
- 
- 

#### Recommendation

- [ ] Rollback procedure approved for production
- [ ] Rollback procedure needs modifications (see issues above)
- [ ] Re-test required

---

## 🔧 Test Environment Setup

### Staging Environment Requirements

```yaml
# Minimum staging environment specs
server:
  cpu: 2 cores
  memory: 4 GB
  disk: 50 GB

database:
  cpu: 2 cores
  memory: 4 GB
  disk: 20 GB

services:
  - Nakama
  - PostgreSQL
  - Redis (optional)
  - Monitoring (Grafana/Prometheus)
```

### Test Data Requirements

Ensure staging has:
- At least 100 test player accounts
- Sample inventory data
- Sample match history
- All RPC endpoints testable

---

## 📅 Rollback Test Schedule

### Recommended Testing Frequency

| Test Type | Frequency | Duration |
|-----------|-----------|----------|
| Module-Only | Monthly | 30 min |
| Full Rollback | Quarterly | 2 hours |
| Emergency/Automated | Monthly | 30 min |

### Scheduling Guidelines

- Schedule during low-traffic periods
- Avoid testing during:
  - Peak gaming hours
  - Live events
  - Other deployments
  - Team member vacations

---

## 🚨 Test Failure Procedures

If rollback test fails:

1. **Stop the test immediately**
2. **Re-deploy Go module**
3. **Document failure reason**
4. **Investigate root cause**
5. **Fix issues**
6. **Reschedule test**

### Common Test Failures

| Failure | Likely Cause | Resolution |
|---------|-------------|------------|
| TypeScript won't load | Missing dependencies | Run `npm install` |
| Database restore fails | Corrupted backup | Create new backup |
| Health check fails | Config mismatch | Verify config files |
| Performance degraded | Resource constraints | Scale up staging |

---

## 📚 Related Documents

- [Rollback Runbook](./ROLLBACK_RUNBOOK.md)
- [Backup Database Script](./scripts/backup-database.sh)
- [Restore Database Script](./scripts/restore-database.sh)
- [Automated Rollback Script](./scripts/rollback-automated.sh)
- [Smoke Tests](./scripts/run-smoke-tests.sh)

---

## ✅ Test Sign-Off

**Test Completed**: [Date]  
**Test Result**: [PASS/FAIL]  
**Approved for Production**: [Yes/No]

**Signatures**:

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Test Conductor | | | |
| Tech Lead | | | |
| Engineering Manager | | | |

---

**END OF TESTING PROCEDURE**
