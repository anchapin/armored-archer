# Runbook: PaymentProcessingFailures

**Alert Name**: `PaymentProcessingFailures`
**Severity**: Critical
**Last Updated**: 2026-09-15

> **Companion alerts (issue #1140)**: this runbook also serves the webhook-ledger
> alerts `WebhookNotConfigured` (critical), `WebhookLagHigh` (warning),
> `WebhookSignatureFailureSpike` (warning), and `WebhookRedisDegraded` (warning) —
> see the `armored_archer_webhook_ledger` group in `backend/alerts.yml`.

---

## 🚨 Alert Definition

**Expression**: `rate(armored_archer_payment_failures_total[5m]) > 0`
**Duration**: 1 minute
**Impact**: Direct revenue impact. Players cannot complete IAP purchases, season passes, or gem top-ups. Even a single failure burst indicates a RevenueCat / Apple / Google outage or a misconfiguration that needs immediate attention.

---

## 📞 Escalation Path

1. **0-5 minutes**: On-call engineer pages in `#armored-archer-critical`.
2. **5-15 minutes**: Backend team lead and product owner (revenue impact).
3. **15+ minutes**: CTO; engage RevenueCat support if upstream.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Current failure rate
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_payment_failures_total[5m])' \
  | jq '.data.result[]'

# Failure rate by error type
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (error_type) (rate(armored_archer_payment_failures_total[5m]))' \
  | jq '.data.result[]'

# Alertmanager state
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="PaymentProcessingFailures")'
```

### 2. Query the Webhook Ledger (PromQL first — issue #1140)

```bash
# Webhook events by event_type x outcome — rejections, duplicates and failures at a glance
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (event_type, outcome) (rate(armored_archer_webhook_events_total[5m]))' \
  | jq '.data.result[] | {type: .metric.event_type, outcome: .metric.outcome, rate: .value[1]}'

# p95 webhook processing latency (WebhookLagHigh fires above 2s)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=histogram_quantile(0.95, sum by (le) (rate(armored_archer_webhook_processing_seconds_bucket[5m])))' \
  | jq '.data.result[]'

# Redis degradation on the dedup fast path (WebhookRedisDegraded)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (operation) (rate(armored_archer_webhook_redis_errors_total[5m]))' \
  | jq '.data.result[]'

# Queue depth of cap-overflow paid awards, per affected player
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_webhook_pending_awards' \
  | jq '.data.result[] | {user: .metric.user_id, queued: .value[1]}'

# Fail-closed liveness probe (WebhookNotConfigured fires on 0)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_webhook_configured' \
  | jq '.data.result[]'
```

Outcome vocabulary on `armored_archer_webhook_events_total`: `processed`,
`unhandled` (event noted, e.g. `test`), `failed` (handler returned an error),
`duplicate` (ledger replay), and the fail-closed rejections
`rejected_not_configured`, `rejected_invalid_signature`,
`rejected_invalid_payload`, `rejected_missing_user`,
`rejected_missing_event_id`.

### 3. Inspect the Store Module

```bash
# Signal origin: validatePurchaseWithRevenueCat / rpcRevenueCatWebhook
grep -n "validatePurchaseWithRevenueCat\|rpcRevenueCatWebhook\|billing_issue" \
  backend/src/modules/store.ts | head -30

# Recent store changes
git log --oneline -10 -- backend/src/modules/store.ts
```

### 4. Check the RevenueCat Webhook Pipeline

Query the ledger metrics above first (PromQL is the primary surface since
issue #1140); the SQL below is the fallback when Prometheus itself is down.

```bash
# Pending webhook events (durable ledger) — backlog means we are losing or delaying events
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FROM revenuecat_pending_awards WHERE processed=false;"

# Recent failure events
docker exec postgres psql -U postgres -c \
  "SELECT id, user_id, error_message, created_at
   FROM payment_failures
   ORDER BY created_at DESC LIMIT 20;"
```

---

## 🔧 Troubleshooting Steps

### Step 1: Check RevenueCat Status

```bash
# 1. RevenueCat public status page
curl -s https://status.revenuecat.com/api/v2/status.json | jq '.status.indicator'

# 2. Test our shared secret is configured (do not log the secret)
docker exec nakama printenv | grep REVENUECAT_WEBHOOK_SECRET | sed 's/=.*/=<redacted>/'

# 3. Are we reaching RevenueCat at all?
docker logs nakama --tail 200 | grep -iE "(revenuecat|webhook|signature)" | tail -20
```

### Step 2: Check App Store / Play Store Status

```bash
# Apple System Status
curl -s https://www.apple.com/support/systemstatus/data/system_status.json | jq '.serviceStatuses[] | select(.serviceKey=="itunes-store" or .serviceKey=="app-store")'

# Play Store / Google Play developer alerts (manual — open console)
echo "Open https://play.google.com/console and check for IAP warnings"
```

### Step 3: Check Our Webhook Signature Verification

```bash
# Webhook rejects (signature failures) — usually means the webhook secret rotated
docker logs nakama --tail 200 | grep -iE "(signature|hmac|webhook_secret)" | tail -10

# Confirm secret matches the value in the RevenueCat dashboard
gh secret list --repo anchapin/armored-archer | grep REVENUECAT
```

### Step 4: Review Failure Categories

```bash
# Group failures by error_type from the database
docker exec postgres psql -U postgres -c \
  "SELECT error_type, count(*) AS n
   FROM payment_failures
   WHERE created_at > now() - interval '1 hour'
   GROUP BY error_type
   ORDER BY n DESC;"

# Common categories and meanings
# - signature_invalid  → webhook secret rotated or mismatched
# - circuit_open       → RevenueCat API failed enough times we short-circuited
# - product_not_found  → catalog mismatch after deploy
# - duplicate          → benign; client retried
```

---

## 🛠️ Resolution Procedures

### Scenario 1: RevenueCat Outage (Upstream)

```bash
# 1. Confirm via status page
curl -s https://status.revenuecat.com/api/v2/status.json

# 2. Open a P1 ticket
gh issue create --repo anchapin/armored-archer \
  --title "[Payments] RevenueCat upstream outage — $(date -u +%Y-%m-%d)" \
  --label "priority:high,revenue,payments" \
  --body "Triggered by PaymentProcessingFailures. Status page: <link>"

# 3. Disable the strict fail-closed fallback if it is harming UX
# backend/src/modules/store.ts:1025 — validatePurchaseWithRevenueCat is wrapped in withCircuitBreaker
# (its fail-closed fallback sits at store.ts:2480); temporarily
# return success on an open circuit *only* for one-off IAPs you have manually validated.
# (Default is to fail closed. Flip only after product sign-off.)
```

### Scenario 2: Webhook Secret Mismatch

```bash
# 1. Compare webhook secret in RevenueCat dashboard vs our secret store
gh secret list --repo anchapin/armored-archer | grep REVENUECAT_WEBHOOK_SECRET

# 2. Update the secret if it rotated
gh secret set REVENUECAT_WEBHOOK_SECRET --repo anchapin/armored-archer

# 3. Restart Nakama so the new secret is loaded
docker-compose restart nakama
docker logs nakama --tail 100 | grep -i "webhook secret" | tail -5
```

### Scenario 3: Catalog / Product ID Mismatch

```bash
# 1. Diff catalog vs the values in our store.ts catalogs (GEM_BUNDLES / COSMETIC_CATALOG)
grep -n "GEM_BUNDLES\|COSMETIC_CATALOG\|product_id" backend/src/modules/store.ts | head -20

# 2. Pull the current RevenueCat offerings
curl -s -H "Authorization: Bearer $REVENUECAT_SECRET_KEY" \
  https://api.revenuecat.com/v1/products \
  | jq '.products[] | {identifier, title}'

# 3. Update backend/src/modules/store.ts if Apple/Google added a new SKU
git checkout -b fix/payment-catalog-sync
# edit store.ts; add a unit test under __tests__/store.test.ts
```

### Scenario 4: Database Write Failures

```bash
# Check Postgres health — webhook handler may be failing to persist awards
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FROM revenuecat_pending_awards WHERE processed=false AND created_at < now() - interval '10 minutes';"

# Resolve per the DatabaseDown / DatabaseConnectionPoolExhausted runbooks
```

### Scenario 5: Duplicate / Idempotency Noise

```bash
# Duplicate webhook deliveries are expected; check that recordWebhookOutcome is being
# called from rpcRevenueCatWebhook (see backend/src/modules/store.ts:4062; the duplicate
# read-back via getRecordedWebhookOutcome sits at store.ts:3414).
# PromQL first (issue #1140): the duplicate outcome rate on the ledger counter
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=sum by (event_type) (rate(armored_archer_webhook_events_total{outcome="duplicate"}[1h]))' \
  | jq '.data.result[]'
# If this is the only error category, no action needed.
# SQL fallback when Prometheus is unavailable:
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FROM revenuecat_webhook_events WHERE outcome='duplicate' AND created_at > now() - interval '1 hour';"
```

---

## ✅ Verification

```bash
# 1. Failure rate back to zero
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_payment_failures_total[5m])' \
  | jq '.data.result[] | select(.value[1] | tonumber > 0)'

# 2. Revenue counter moving again
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_purchase_revenue_total[5m])' \
  | jq '.data.result[0].value[1]'

# 3. Alert cleared
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="PaymentProcessingFailures") | .status.state'

# 4. End-to-end test purchase (use a sandbox account)
# See docs/REVENUECAT_PLUGIN.md and docs/REVENUECAT_SETUP.md
```

---

## 📊 Post-Incident Actions

1. **Triage and resolve every pending webhook event** in `revenuecat_pending_awards` (issue #1067 covers idempotency).
2. **Update** [`docs/REVENUECAT_SETUP.md`](../REVENUECAT_SETUP.md) and [`docs/REVENUECAT_PLUGIN.md`](../REVENUECAT_PLUGIN.md) if configuration changed.
3. **Coordinate refunds / comps** with player support for failed purchases.
4. **Add a regression test** covering the failure path in `backend/src/modules/__tests__/store.test.ts`.
5. **Schedule a post-mortem** if revenue loss exceeds the team's threshold.

---

## 🔗 Related Resources

- [RevenueCat Setup](../REVENUECAT_SETUP.md)
- [RevenueCat Plugin Notes](../REVENUECAT_PLUGIN.md)
- [IAP Security Audit](../IAP_SECURITY_AUDIT.md)
- [Store module](../../backend/src/modules/store.ts)
- [RevenueCat status](https://status.revenuecat.com/)
- [Apple System Status](https://www.apple.com/support/systemstatus/)
- Grafana → *Payments* dashboard: `http://grafana:3000/d/armored-archer-payments`

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Backend Team**: `#backend-team` Slack channel
- **Product Team**: `#product` Slack channel (revenue-impact communication)
- **Player Support**: `#customer-support` Slack channel (failed-purchase queue)
- **RevenueCat Support**: support@revenuecat.com (only for upstream issues)