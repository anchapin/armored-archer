# Runbook: AntiCheatViolationSpike

**Alert Name**: `AntiCheatViolationSpike`
**Severity**: Warning
**Last Updated**: 2026-08-18

---

## ⚠️ Alert Definition

**Expression**: `rate(armored_archer_anticheat_violations_total[5m]) > 5`
**Duration**: 2 minutes
**Impact**: Either a new exploit is in active use, a recent deploy caused false positives, or a single account/cheat tool is producing noise. Server-authoritative combat guarantees are at risk.

---

## 📞 Escalation Path

1. **0-15 minutes**: On-call engineer triages and confirms real vs false positive.
2. **15-30 minutes**: Security lead and backend team lead.
3. **30+ minutes**: Open a P1 incident; brief product on player-impact scope.

Post in `#armored-archer-warnings` and loop in `#security`.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Current rate of anti-cheat violations
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_anticheat_violations_total[5m])' \
  | jq '.data.result[]'

# Alertmanager state
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="AntiCheatViolationSpike")'
```

### 2. Inspect the Source Module

```bash
# Signal origin: recordViolation() in anti_cheat_audit.ts
grep -n "recordViolation\|violation_type\|VIOLATION_TYPES" backend/src/modules/anti_cheat_audit.ts | head -30

# Look for newly added violation types or thresholds
git log --oneline -10 -- backend/src/modules/anti_cheat.ts backend/src/modules/anti_cheat_audit.ts
```

### 3. Triage by Violation Type

```bash
# Open the audit table and group by violation type (last 30 minutes)
docker exec postgres psql -U postgres -c \
  "SELECT violation_type, count(*) AS n
   FROM anti_cheat_violations
   WHERE created_at > now() - interval '30 minutes'
   GROUP BY violation_type
   ORDER BY n DESC;"
```

---

## 🔧 Troubleshooting Steps

### Step 1: Confirm Real Player Activity

```bash
# Sanity check that traffic itself isn't elevated (avoid conflation with load)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_requests_total[5m])' \
  | jq '.data.result[0].value[1]'

# Top offenders by user_id
docker exec postgres psql -U postgres -c \
  "SELECT user_id, count(*) AS n
   FROM anti_cheat_violations
   WHERE created_at > now() - interval '30 minutes'
   GROUP BY user_id
   ORDER BY n DESC
   LIMIT 10;"
```

### Step 2: Look for New Exploit Patterns

```bash
# Recent example payloads (truncated) for each violation type
docker exec postgres psql -U postgres -c \
  "SELECT violation_type, count(*) AS n,
          array_agg(DISTINCT substring(metadata::text, 1, 80)) AS samples
   FROM anti_cheat_violations
   WHERE created_at > now() - interval '30 minutes'
   GROUP BY violation_type
   ORDER BY n DESC;"

# Compare against current detection rules
cat docs/ANTI_CHEAT_IMPLEMENTATION.md | head -100
```

### Step 3: Check for Deploy-Induced False Positives

```bash
# Recent commits to anti-cheat code
git log --oneline -10 -- backend/src/modules/anti_cheat.ts
git log --oneline -10 -- backend/src/modules/anti_cheat_audit.ts

# If a recent change tightened thresholds, consider relaxing and shipping a follow-up fix
git show HEAD -- backend/src/modules/anti_cheat.ts | head -80
```

### Step 4: Cross-Check Combat Integrity Metrics

```bash
# Look for correlated spikes in combat RPC errors
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (rpc) (rate(armored_archer_rpc_errors_total[5m]))' \
  | jq '.data.result[] | select(.metric.rpc | test("combat|duel|attack"; "i"))'

# Player reports / dispute volume from CSAT channels
# (Pull from #customer-support Slack channel — not automated)
```

---

## 🛠️ Resolution Procedures

### Scenario 1: New Exploit In The Wild

```bash
# 1. Identify the user cluster and ban / shadowban via admin RPC
# backend/src/modules/admin_auth.ts exposes the auth gate; see ADMIN RPC docs.
gh api repos/anchapin/armored-archer/issues \
  --method POST \
  -f title="[Security] Anti-cheat spike — <violation_type> at <rate>" \
  -f body="Triggered from prod at $(date -u). Investigation thread: <link>" \
  -f "labels[]=security,priority:high"

# 2. Roll out an emergency rule patch
git checkout -b hotfix/anticheat-<violation_type>
# edit backend/src/modules/anti_cheat.ts
docker-compose build nakama && docker-compose up -d nakama
```

### Scenario 2: Deploy-Induced False Positives

```bash
# Identify the offending commit
git log --oneline --since="1 hour ago" -- backend/src/modules/anti_cheat.ts
git revert <sha>
docker-compose build nakama && docker-compose up -d nakama

# Then add a regression test in __tests__/anti_cheat.test.ts
```

### Scenario 3: Single Repeat Offender

```bash
# Apply per-user rate limit / ban through the admin RPC path
docker exec postgres psql -U postgres -c \
  "UPDATE accounts SET metadata = jsonb_set(metadata, '{banned}', 'true')
   WHERE id = '<user_id>';"

# Add to anti-cheat watch list
docker exec postgres psql -U postgres -c \
  "INSERT INTO anti_cheat_watchlist (user_id, reason, created_at)
   VALUES ('<user_id>', 'repeat offender', now());"
```

### Scenario 4: Noise From a Buggy Match Replay

```bash
# match_replay.ts re-simulates matches for fairness — known to spike violations
grep -n "recordViolation\|simulate" backend/src/modules/match_replay.ts | head -20

# If violations correlate with fairness-telemetry workloads, pause the replay worker
docker exec postgres psql -U postgres -c \
  "UPDATE scheduled_jobs SET status='paused' WHERE name='match_replay';"
```

---

## ✅ Verification

```bash
# 1. Violation rate back under threshold
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_anticheat_violations_total[5m])' \
  | jq '.data.result[] | select(.value[1] | tonumber > 5)'

# 2. Combat error rate stable
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_errors_total[5m])' \
  | jq '.data.result[0].value[1]'

# 3. Alert resolved
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="AntiCheatViolationSpike") | .status.state'
```

---

## 📊 Post-Incident Actions

1. **Open a security ticket** with violation types, scope, and any patches shipped.
2. **Tune thresholds** in `backend/src/modules/anti_cheat.ts` and add unit tests under `backend/src/modules/__tests__/`.
3. **Update** [`docs/ANTI_CHEAT_IMPLEMENTATION.md`](../ANTI_CHEAT_IMPLEMENTATION.md) with the new rule and detection rationale.
4. **Coordinate with player support** for refund/ban review if exploit caused leaderboard or rewards damage.

---

## 🔗 Related Resources

- [Anti-Cheat Implementation Guide](../ANTI_CHEAT_IMPLEMENTATION.md)
- [Anti-cheat module](../../backend/src/modules/anti_cheat.ts)
- [Anti-cheat audit module](../../backend/src/modules/anti_cheat_audit.ts)
- [Fairness Telemetry](../../backend/src/modules/fairness_telemetry.ts)
- [QA Dispute Resolution Guide](../QA_DISPUTE_RESOLUTION_GUIDE.md)
- Grafana → *Security / Anti-cheat* dashboard: `http://grafana:3000/d/armored-archer-security`

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Security Team**: `#security` Slack channel
- **Backend Team**: `#backend-team` Slack channel
- **Player Support**: `#customer-support` Slack channel