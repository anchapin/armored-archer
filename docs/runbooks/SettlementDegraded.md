# Runbook: SettlementDegraded

**Alert Name**: `SettlementDegradedSpike` (this runbook also covers `SettlementClaimFailed`)
**Severity**: Warning (`SettlementDegradedSpike`) / Critical (`SettlementClaimFailed`)
**Last Updated**: 2026-09-15

---

## ⚠️ Alert Definitions

**SettlementDegradedSpike**

**Expression**: `sum(rate(armored_archer_settlement_outcomes_total{result="degraded"}[5m])) > 0.5 / 60`
**Duration**: 5 minutes
**Impact**: PvP settlements are degrading *after* the settled-marker claim landed: Elo, XP, and/or currency effects may be **partially applied** while the match stays marked settled. Per the issue #1078 failure-path choice the marker is never reverted, so every degraded settlement is a potential double-grant/shortfall that needs manual reconciliation (queries below). A spike means an infrastructure failure (usually PostgreSQL) is biting the post-claim effect writes.

**SettlementClaimFailed**

**Expression**: `sum(rate(armored_archer_settlement_outcomes_total{result="claim_failed"}[5m])) > 0`
**Duration**: 1 minute
**Impact**: The versioned settled-marker write is failing, so matches cannot settle at all — no rewards, XP, or Elo are applied. Nothing was mutated (the claim is the FIRST settlement mutation), client retries are safe, and players see `SETTLEMENT_CLAIM_FAILED`. Usually PostgreSQL unavailability or a storage-version storm; this alert is inhibited while `GameServerDown` is firing.

Both alerts live in the settlement group of the alert rules — `SettlementDegradedSpike` at alerts.yml:366 and `SettlementClaimFailed` at alerts.yml:379 — and route to the backend warning/critical receivers (Slack `#armored-archer-warnings` / `#armored-archer-critical`). The `SettlementClaimFailed` alert is suppressed by the `GameServerDown` inhibit rule (alertmanager.yml:234) — if the server is down, the page for that is `GameServerDown`, not this one.

---

## 🔗 Signal Chain (where the numbers come from)

1. Settlement is server-declared (ADR-0002): `rpcCompleteMatch` resolves the terminal state, then claims the settled marker via the versioned write in `claimSettlementMarker`: matchmaker.ts:2014
2. A genuine claim failure (not a lost race) audits the `settlement_claim_failed` channel: matchmaker.ts:2073
3. …and increments the `claim_failed` outcome counter through `recordSettlementOutcome`: matchmaker.ts:2076
4. The claim winner applies all effects in `applySettlementOutcome`: matchmaker.ts:2115
5. A fully-applied settlement increments the `success` outcome: matchmaker.ts:2336
6. If any post-claim effect throws, the wrapper in `processMatchResult` keeps the match settled: matchmaker.ts:2400
7. …audits the `settlement_degraded` channel: matchmaker.ts:2454
8. …and increments the `degraded` outcome counter: matchmaker.ts:2457
9. Terminal draws settle through a separate unconditional persist in `settleDrawMatch`: matchmaker.ts:1548
10. A draw persist failure increments the `persist_failed` outcome (and rethrows): matchmaker.ts:1572
11. The counter is declared on the shared Prometheus registry: metrics.ts:142
12. The increment helper and the `result` label vocabulary live beside it: metrics.ts:643

Idempotent replays (`already_settled`) and lost claim races emit **no** counter — they are not new settlement outcomes, so the counter counts every terminal settlement exactly once.

---

## 📞 Escalation Path

1. **0-15 minutes**: On-call engineer checks PostgreSQL health and the degraded/claim-failed split (see below).
2. **15-30 minutes**: Backend team lead; open a P1 if `SettlementClaimFailed` is firing at scale (players cannot finish matches).
3. **30+ minutes**: CTO; if currency grants are affected, loop in the economy/commerce owner for reconciliation sign-off.

Post in `#armored-archer-critical` (the alert already lands there) and loop in `#backend-team`.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Settlement outcome rates by result — which band is burning?
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (result) (rate(armored_archer_settlement_outcomes_total[5m]))' \
  | jq '.data.result[]'

# Alertmanager state
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="SettlementDegradedSpike" or .labels.alertname=="SettlementClaimFailed")'
```

### 2. Split the failure mode

- **Only `claim_failed`** — nothing was applied; matches are stuck unsettled. Check PostgreSQL first (`DatabaseDown` / `DatabaseConnectionPoolExhausted` firing?). Retries are safe, so players self-heal once storage recovers.
- **`degraded` present** — some matches are settled with partially-applied effects. These will NOT self-heal; every one needs the reconciliation pass below.
- **`persist_failed` present** — draw settlements are failing their persist; nothing applied, error propagated. Same response as `claim_failed`.

### 3. Inspect the Source Module

```bash
# Signal origin: the audit channels and their counter increments
grep -n "settlement_degraded\|settlement_claim_failed" backend/src/modules/matchmaker.ts

# Counter emission points
grep -n "recordSettlementOutcome" backend/src/modules/matchmaker.ts backend/src/modules/metrics.ts
```

---

## 🔧 Troubleshooting Steps

### Step 1: List the affected matches from audit storage

Both failure modes write a `complete_match` audit entry against the `pvp_matches` resource with the channel name in `error`:

```bash
# Last hour of settlement failures with the same channel vocabulary as the metric
docker exec armored_archer_db psql -U postgres -c \
  "SELECT to_timestamp((value->>'timestamp')::bigint / 1000.0) AS at,
          value->'details'->>'match_id' AS match_id,
          value->'details'->>'winner_id' AS winner_id,
          value->'details'->>'loser_id' AS loser_id,
          value->>'error' AS channel
   FROM storage
   WHERE collection = 'audit_logs'
     AND value->>'action' = 'complete_match'
     AND value->>'resource' = 'pvp_matches'
     AND value->>'result' = 'failure'
     AND value->>'error' IN ('settlement_degraded', 'settlement_claim_failed')
     AND (value->>'timestamp')::bigint > (extract(epoch from now()) - 3600) * 1000
   ORDER BY (value->>'timestamp')::bigint DESC
   LIMIT 50;"
```

### Step 2: Reconcile partial grants (SettlementDegradedSpike only)

For each `settlement_degraded` match, compare what actually landed against the recorded settlement. Currency effects flow through the `player_currency` ledger (key = user id); the match record itself is in `pvp_matches`:

```bash
# 1. The settled match record — confirms the marker landed and records the outcome
docker exec armored_archer_db psql -U postgres -c \
  "SELECT key,
          value->>'status' AS status,
          to_timestamp((value->>'settled_at')::bigint / 1000.0) AS settled_at,
          value->>'winner' AS winner,
          value->>'end_reason' AS end_reason
   FROM storage
   WHERE collection = 'pvp_matches'
     AND key = '<MATCH_ID>';"

# 2. Both players' currency ledgers — what actually landed
docker exec armored_archer_db psql -U postgres -c \
  "SELECT key AS user_id, value->>'coins' AS coins, value->>'gems' AS gems
   FROM storage
   WHERE collection = 'player_currency'
     AND key IN ('<WINNER_ID>', '<LOSER_ID>');"
```

A half-applied state (winner credited, loser not — or currency landed but XP/Elo missing) is expected and must **never** be re-settled: a retry of the same settlement hits the already-settled fast path and cannot re-apply, by design (issue #1078). Reconciliation is manual: grant the shortfall via an admin/support tool, do not touch the settled marker.

### Step 3: Check the storage backend

The claim write and every effect write hit PostgreSQL through Nakama storage:

```bash
# Pool saturation is the usual culprit for claim failures
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=nakama_database_connections_active / nakama_database_connections_max' \
  | jq '.data.result[]'

docker logs armored_archer_server --tail 200 2>&1 | grep -i "settlement" | tail -30
```

---

## ✅ Resolution Procedures

1. **Restore storage health** (clear `DatabaseDown` / pool exhaustion). `claim_failed` matches then settle on player retry — no data repair needed because nothing was applied.
2. **Reconcile every `settlement_degraded` match** using Step 2: compute the shortfall per player (expected rewards from the settled match record minus the ledger balance delta) and grant it manually. Record each repair in the incident thread.
3. **`persist_failed` draws**: once storage is healthy, the match can be re-triggered by either player completing it again (the draw was never persisted).

---

## ✔️ Verification

```bash
# The degraded/claim_failed bands flatline at 0
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (result) (increase(armored_archer_settlement_outcomes_total[30m]))' \
  | jq '.data.result[]'

# Alerts cleared in Alertmanager
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '[.[] | select(.labels.alertname=="SettlementDegradedSpike" or .labels.alertname=="SettlementClaimFailed")] | length'
```

---

## 📋 Post-Incident Actions

- Reconcile ledger report attached to the incident (match → shortfall → repair).
- If root cause was pool exhaustion, file a capacity follow-up (`DatabaseConnectionPoolExhausted` tuning).
- Update this runbook if the reconciliation queries drifted.

---

## 🔗 Related Resources

- ADR-0002 (server-declared settlement) and ADR-0005 (combat authority boundary): `docs/adr/`
- Settlement exactly-once design (claim-before-apply): issue #1078
- Metric reference: [METRICS.md](../../backend/METRICS.md)
- Alert rules: [alerts.yml](../../backend/alerts.yml)

---

**Last Updated**: 2026-09-15
**Maintained By**: Backend Team
