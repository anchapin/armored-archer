# Runbook: AdminAccessDeniedSpike

**Alert Name**: `AdminAccessDeniedSpike` (this runbook also covers `AdminAllowlistEmpty`)
**Severity**: Warning (`AdminAccessDeniedSpike`) / Critical (`AdminAllowlistEmpty`)
**Last Updated**: 2026-09-15

---

## ⚠️ Alert Definitions

**AdminAccessDeniedSpike**

**Expression**: `sum by (rpc_id) (rate(armored_archer_admin_rpc_access_denied_total[5m])) > 5 / 60`
**Duration**: 5 minutes
**Impact**: Either an unauthorized caller is probing privileged RPCs (security incident), or a deploy broke `ADMIN_USER_IDS` so legitimate operators are being rejected. The gate itself is fail-closed — server state is never at risk — but admin tooling is unusable and the attempts must be investigated.

**AdminAllowlistEmpty**

**Expression**: `armored_archer_admin_allowlist_size == 0`
**Duration**: 1 minute
**Impact**: `ADMIN_USER_IDS` is unset or blank, so every admin RPC rejects every caller (fail-closed per ADR-0006). No operator can use admin tooling until the env var is fixed and the server restarts.

Both alerts live in the security group of the alert rules (alerts.yml:240 and alerts.yml:253) and route to the `security-alerts` receiver (Slack `#armored-archer-security` + security-team email).

---

## 🔗 Signal Chain (where the numbers come from)

1. The gate wrapper (`withAdminGuard`) rejects the call and computes the rejection reason: admin_auth.ts:297
2. The reason label distinguishes a merely-non-allowlisted caller from one with no user id at all (`AdminAccessDeniedReason`): admin_auth.ts:309
3. The rejection counter is incremented through the injected metric sink: admin_auth.ts:323
4. The counter and gauge are declared on the shared Prometheus registry: metrics.ts:360 and metrics.ts:369
5. The sinks are wired from the metrics module at load time (dependency injection, no import cycle): metrics.ts:383
6. The allowlist is force-resolved once at server startup so the gauge exists from boot: index.ts:246

The reason vocabulary is shared verbatim between the counter label, the winston log fields, and the audit entry details, so all three sinks stay joinable during forensics.

---

## 📞 Escalation Path

1. **0-15 minutes**: On-call engineer triages — probing vs. broken deploy (see below).
2. **15-30 minutes**: Security lead (if probing) or backend team lead (if deploy-related).
3. **30+ minutes**: Open a P1 incident; if credential compromise is suspected, rotate the Nakama runtime HTTP key.

Post in `#armored-archer-security` (the alert already lands there) and loop in `#backend-team`.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Rejection rate per RPC — which endpoint is being hammered?
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (rpc_id) (rate(armored_archer_admin_rpc_access_denied_total[5m]))' \
  | jq '.data.result[]'

# Allowlist posture — 0 means every admin RPC rejects everyone
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_admin_allowlist_size' \
  | jq '.data.result[]'

# Alertmanager state
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="AdminAccessDeniedSpike" or .labels.alertname=="AdminAllowlistEmpty")'
```

### 2. Split by Reason

```bash
# caller_id_missing = server-key style calls (no user id) — almost always probing.
# caller_not_in_admin_allowlist = authenticated players or ex-admins.
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (reason) (increase(armored_archer_admin_rpc_access_denied_total[1h]))' \
  | jq '.data.result[]'
```

A flood of `caller_id_missing` right after a client release may indicate a leaked/abused server key; the gate deliberately never treats those calls as admin.

### 3. Inspect the Source Module

```bash
# Signal origin: the guard's rejection path
grep -n "emitAccessDeniedMetric\|AdminAccessDeniedReason" backend/src/modules/admin_auth.ts

# Metric registration and sink wiring
grep -n "armored_archer_admin_rpc_access_denied_total\|armored_archer_admin_allowlist_size" backend/src/modules/metrics.ts

# Recent changes to the gate
git log --oneline -10 -- backend/src/modules/admin_auth.ts
```

---

## 🔧 Troubleshooting Steps

### Step 1: Replay the Rejections from Audit Storage

Every rejection writes an `admin_rpc_access_denied` audit entry against the caller (Nakama `storage` table, collection `audit_logs`):

```bash
# Last hour of guard rejections with the same reason vocabulary as the metric
docker exec armored_archer_db psql -U postgres -c \
  "SELECT to_timestamp((value->>'timestamp')::bigint / 1000.0) AS at,
          user_id,
          value->>'resource' AS rpc,
          value->'details'->>'reason' AS reason,
          value->>'ip_address' AS ip
   FROM storage
   WHERE collection = 'audit_logs'
     AND value->>'action' = 'admin_rpc_access_denied'
     AND (value->>'timestamp')::bigint > (extract(epoch from now()) - 3600) * 1000
   ORDER BY (value->>'timestamp')::bigint DESC
   LIMIT 50;"
```

Admins can also pull the same entries through the guarded RPC:

```bash
# Requires the caller to be on the allowlist themselves (issue #1077 scoping)
curl -s "http://localhost:7350/v2/rpc/armored_archer/query_audit_logs?unwrap" \
  -H "Authorization: Bearer <session-token-of-allowlisted-admin>" \
  -G --data-urlencode 'payload={"action":"admin_rpc_access_denied","limit":50}'
```

### Step 2: Classify the Spike

```bash
# Top rejected callers in the last hour
docker exec armored_archer_db psql -U postgres -c \
  "SELECT user_id, count(*) AS n,
          array_agg(DISTINCT value->>'resource') AS rpcs_tried
   FROM storage
   WHERE collection = 'audit_logs'
     AND value->>'action' = 'admin_rpc_access_denied'
     AND (value->>'timestamp')::bigint > (extract(epoch from now()) - 3600) * 1000
   GROUP BY user_id ORDER BY n DESC LIMIT 10;"
```

- **Few distinct user ids, many RPC ids tried** → systematic probing; escalate to security.
- **One or two known operator ids on every call** → the deploy dropped them from `ADMIN_USER_IDS` (see Step 3).
- **`user_id = unknown`** → server-key invocations; the client binary's embedded key is being scripted against admin RPCs.

### Step 3: If `AdminAllowlistEmpty` Is Firing (or operators are all rejected)

The allowlist resolution logs its count and per-id SHA-256 fingerprints once at startup — check the server logs:

```bash
docker logs armored_archer_server 2>&1 | grep -i "Admin allowlist"
```

- `Admin allowlist is empty` → `ADMIN_USER_IDS` is unset/blank in `backend/.env` (or the orchestrator env). Fix the var and restart: `make services-restart` locally.
- `Admin allowlist parsed` with a wrong count → a deploy typo (whitespace, a dropped id, or case mismatch — entries and lookups are lowercase-normalized, so `ABC-123` in the env does match `abc-123` callers).
- Startup **crash** with `ADMIN_USER_IDS contains malformed entry` → fail-fast on a typo'd entry; correct the offending value and restart.

The allowlist is parsed once and frozen; editing the env var mid-flight does nothing until restart (`reloadAdminAllowlist()` exists for future incident-response wiring but is not exposed via any RPC).

### Step 4: Correlate with a Deploy

```bash
# Did a recent deploy touch the guard or the env plumbing?
git log --oneline --since="2 hours ago" -- backend/src/modules/admin_auth.ts backend/src/metrics.ts

# Overall RPC error rate at the same moment (rules out a general incident)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_rpc_errors_total[5m])' \
  | jq '.data.result[]'
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Unauthorized Probing

1. Collect the audit replay (Step 1) and top-caller breakdown (Step 2) into the incident ticket.
2. Ban/suspend the offending accounts through normal moderation tooling.
3. If probing is high-volume from few IPs, apply edge/ingress rate limiting before the traffic reaches Nakama.
4. Do NOT widen the allowlist in response to probing — rejections are the gate working as designed.

### Scenario 2: Broken `ADMIN_USER_IDS` Deploy

```bash
# 1. Restore the intended allowlist in backend/.env (or the deploy env source)
#    ADMIN_USER_IDS=<comma-separated strict UUID v4 user ids>

# 2. Restart so the parse-once cache re-resolves (fail-fast: the server will
#    crash on a malformed entry rather than run with a broken gate)
make services-restart

# 3. Confirm posture from the startup log fingerprints
docker logs armored_archer_server 2>&1 | grep -i "Admin allowlist parsed"
```

### Scenario 3: Allowlist Correct but One Operator Rejected

- Compare their user id **lowercased** against the env entries — a case mismatch is the classic silent brick (the lookup normalizes case, but only exact-normalized ids match).
- Check the startup log fingerprints (`Admin allowlist parsed`) to confirm the deployed list actually contains a prefix of their id.

---

## ✅ Verification

```bash
# 1. Rejection rate back under threshold
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (rpc_id) (rate(armored_archer_admin_rpc_access_denied_total[5m]))' \
  | jq '.data.result[] | select(.value[1] | tonumber > 5 / 60)'

# 2. Allowlist non-zero again (if AdminAllowlistEmpty fired)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_admin_allowlist_size' \
  | jq '.data.result[]'

# 3. Alerts resolved
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="AdminAccessDeniedSpike" or .labels.alertname=="AdminAllowlistEmpty") | .status.state'

# 4. An allowlisted admin can call an admin RPC again (spot check)
curl -s "http://localhost:7350/v2/rpc/armored_archer/metrics?unwrap" \
  -H "Authorization: Bearer <session-token-of-allowlisted-admin>" | head -5
```

---

## 📊 Post-Incident Actions

1. **Open a security ticket** with the audit replay, top callers, and IPs if probing was confirmed.
2. **Tune thresholds** in the alert rules if the 5/min for 5m window proved too noisy or too slow; keep `AdminAllowlistEmpty` critical — an empty allowlist is always a misconfiguration.
3. **Document allowlist rotation** lessons in `docs/SECRETS_ROTATION.md` if the root cause was a rotation gone wrong.
4. **Check the dashboard**: Grafana → *Security* dashboard: `http://grafana:3000/d/armored-archer-security` (panels: Admin Allowlist Size, Admin Guard Rejections by RPC/Reason).

---

## 🔗 Related Resources

- [ADR-0006: Admin-gate allowlist policy](../adr/0006-admin-gate-allowlist-policy.md)
- [Admin guard module](../../backend/src/modules/admin_auth.ts)
- [Metrics registration](../../backend/src/modules/metrics.ts)
- [Alert rules](../../backend/alerts.yml)
- [Audit trail module](../../backend/src/modules/audit.ts)
- [SuspiciousLoginActivity runbook](./SuspiciousLoginActivity.md)

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Security Team**: `#armored-archer-security` Slack channel
- **Backend Team**: `#backend-team` Slack channel
