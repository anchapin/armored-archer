# Post-Rollback Verification Checklist

**Version**: 1.0.0  
**Last Updated**: 2026-03-16  
**Owner**: Backend Team  

---

## 🎯 Purpose

This checklist ensures all critical systems are verified after rolling back from Go to TypeScript backend.

---

## ⏱️ Verification Timeline

| Phase | Time After Rollback | Checks |
|-------|---------------------|--------|
| **Immediate** | 0-5 minutes | Service health, basic connectivity |
| **Short-term** | 5-15 minutes | Database, RPC endpoints |
| **Medium-term** | 15-30 minutes | Performance, logs |
| **Long-term** | 30-60 minutes | Monitoring, user flows |

---

## ✅ Immediate Checks (0-5 minutes)

### Service Health

- [ ] **Nakama service is running**
  ```bash
  sudo systemctl status nakama
  ```

- [ ] **Health endpoint responds**
  ```bash
  curl -f http://localhost:7350/health
  ```
  Expected: HTTP 200 with JSON response

- [ ] **API endpoint accessible**
  ```bash
  curl -I http://localhost:7350/
  ```
  Expected: HTTP 200 or 404

- [ ] **Response time acceptable**
  ```bash
  curl -w "%{time_total}" -o /dev/null -s http://localhost:7350/health
  ```
  Expected: < 500ms

### Module Verification

- [ ] **TypeScript module loaded**
  ```bash
  sudo journalctl -u nakama -n 50 --no-pager | grep -i typescript
  ```
  Expected: TypeScript initialization messages

- [ ] **Module file exists**
  ```bash
  ls -la /opt/nakama/modules/server
  ```
  Expected: File exists, readable

- [ ] **Configuration restored**
  ```bash
  cat /etc/nakama/config.yml | head -20
  ```
  Expected: Valid YAML configuration

---

## ✅ Short-term Checks (5-15 minutes)

### Database Connectivity

- [ ] **Database connection works**
  ```bash
  docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT 1;"
  ```
  Expected: Returns "1"

- [ ] **All tables accessible**
  ```bash
  docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "\dt"
  ```
  Expected: 10+ tables listed

- [ ] **Key tables verified**
  - [ ] `player_stats` - Player data
  - [ ] `catalog` - Item catalog
  - [ ] `inventory` - Player inventories
  - [ ] `loadout` - Equipment loadouts
  - [ ] `stage_completion` - Progress tracking

- [ ] **Data integrity check**
  ```bash
  docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT COUNT(*) FROM player_stats;"
  ```
  Expected: Non-zero count

### RPC Endpoints

- [ ] **RPC endpoint accessible**
  ```bash
  curl -I http://localhost:7350/v2/rpc/
  ```
  Expected: HTTP 401 or 403 (auth required)

- [ ] **Critical RPCs functional** (requires auth token)
  - [ ] `combat_resolve` - Combat resolution
  - [ ] `matchmaker_join` - Matchmaking
  - [ ] `get_player` - Player data retrieval
  - [ ] `get_inventory` - Inventory access
  - [ ] `update_loadout` - Equipment changes

---

## ✅ Medium-term Checks (15-30 minutes)

### Performance Metrics

- [ ] **Memory usage normal**
  ```bash
  free -h
  ```
  Expected: < 80% usage

- [ ] **CPU usage normal**
  ```bash
  top -bn1 | grep "Cpu(s)"
  ```
  Expected: < 80% usage

- [ ] **Disk space adequate**
  ```bash
  df -h /
  ```
  Expected: < 80% usage

- [ ] **Database connections healthy**
  ```bash
  docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'nakama';"
  ```
  Expected: < 50% of max_connections

### Log Analysis

- [ ] **No critical errors**
  ```bash
  sudo journalctl -u nakama -n 200 --no-pager | grep -i "error\|fatal\|panic"
  ```
  Expected: < 10 errors

- [ ] **Startup successful**
  ```bash
  sudo journalctl -u nakama -n 200 --no-pager | grep -i "started\|listening"
  ```
  Expected: Success messages present

- [ ] **No crash messages**
  ```bash
  sudo journalctl -u nakama -n 200 --no-pager | grep -i "panic\|crash\|segfault"
  ```
  Expected: No matches

### Monitoring Systems

- [ ] **Grafana dashboard accessible**
  ```
  http://localhost:3000
  ```
  Expected: Dashboard loads

- [ ] **Metrics flowing to Grafana**
  - [ ] Request rate visible
  - [ ] Error rate visible
  - [ ] Latency metrics visible
  - [ ] Database metrics visible

- [ ] **Alerting configured**
  - [ ] PagerDuty integration active
  - [ ] Slack alerts working
  - [ ] Email alerts configured

---

## ✅ Long-term Checks (30-60 minutes)

### User Flow Testing

- [ ] **Authentication flow**
  - [ ] User login works
  - [ ] Session creation works
  - [ ] Token refresh works

- [ ] **Gameplay flows**
  - [ ] Match creation works
  - [ ] Combat resolution works
  - [ ] Reward distribution works

- [ ] **Social features**
  - [ ] Friend list accessible
  - [ ] Chat functionality works
  - [ ] Leaderboards update

### Data Validation

- [ ] **Player data consistent**
  ```bash
  # Sample random player records
  docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT user_id, level, experience FROM player_stats ORDER BY RANDOM() LIMIT 10;"
  ```

- [ ] **Inventory data intact**
  ```bash
  docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT COUNT(DISTINCT user_id) FROM inventory;"
  ```

- [ ] **No duplicate records**
  ```bash
  docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT user_id, COUNT(*) FROM player_stats GROUP BY user_id HAVING COUNT(*) > 1;"
  ```
  Expected: No results

### Load Testing (Optional)

- [ ] **Basic load test passed**
  ```bash
  # Using k6 or similar tool
  k6 run scripts/load-test.js
  ```
  Expected: Error rate < 1%

- [ ] **Performance under load acceptable**
  - [ ] P95 latency < 500ms
  - [ ] P99 latency < 1000ms
  - [ ] Throughput stable

---

## 📊 Verification Script

Run the automated verification script:

```bash
# Quick verification (5 minutes)
./scripts/verify-post-rollback.sh --quick

# Full verification (15-20 minutes)
./scripts/verify-post-rollback.sh --full

# JSON output for integration
./scripts/verify-post-rollback.sh --json
```

---

## 📋 Verification Report Template

```markdown
# Post-Rollback Verification Report

**Date**: YYYY-MM-DD HH:MM UTC
**Rollback Type**: Module-only / Full
**Verification Performed By**: [Name]

## Summary

- Total Checks: XX
- Passed: XX
- Failed: XX
- Warnings: XX

## Immediate Checks (0-5 min)

| Check | Status | Notes |
|-------|--------|-------|
| Service running | ✅/❌ | |
| Health endpoint | ✅/❌ | |
| Module loaded | ✅/❌ | |

## Short-term Checks (5-15 min)

| Check | Status | Notes |
|-------|--------|-------|
| Database connected | ✅/❌ | |
| Tables accessible | ✅/❌ | |
| RPC endpoints | ✅/❌ | |

## Medium-term Checks (15-30 min)

| Check | Status | Notes |
|-------|--------|-------|
| Memory usage | ✅/❌ | XX% |
| CPU usage | ✅/❌ | XX% |
| Disk space | ✅/❌ | XX% |
| Log analysis | ✅/❌ | |

## Long-term Checks (30-60 min)

| Check | Status | Notes |
|-------|--------|-------|
| User flows | ✅/❌ | |
| Data validation | ✅/❌ | |
| Monitoring | ✅/❌ | |

## Issues Found

| Issue | Severity | Resolution |
|-------|----------|------------|
| | | |

## Recommendation

- [ ] System verified operational
- [ ] System operational with warnings
- [ ] System has issues requiring attention

**Sign-off**: [Name]
**Time**: YYYY-MM-DD HH:MM UTC
```

---

## 🚨 Escalation Criteria

Escalate to Tech Lead if:

- Any **Immediate Check** fails
- More than 3 **Short-term Checks** fail
- Database connectivity fails
- More than 10% error rate in logs

Escalate to Engineering Manager if:

- Critical user flows fail
- Data integrity issues detected
- Rollback needs to be re-attempted
- Customer-impacting issues persist > 30 minutes

---

## 📚 Related Documents

- [Rollback Runbook](./ROLLBACK_RUNBOOK.md)
- [Rollback Testing Procedure](./ROLLBACK_TESTING_PROCEDURE.md)
- [Communication Plan](./ROLLBACK_COMMUNICATION_PLAN.md)
- [Verification Script](./scripts/verify-post-rollback.sh)

---

## ✅ Quick Reference Commands

```bash
# Service status
sudo systemctl status nakama

# Health check
curl http://localhost:7350/health

# Recent logs
sudo journalctl -u nakama -n 100 --no-pager

# Database connection
docker exec -it armored_archer_postgres psql -U postgres -d nakama

# Table count
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Run verification script
./scripts/verify-post-rollback.sh --full
```

---

**END OF VERIFICATION CHECKLIST**
