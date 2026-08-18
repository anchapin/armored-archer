# Runbook: LowRevenue

**Alert Name**: `LowRevenue`
**Severity**: Info
**Last Updated**: 2026-08-18

---

## ℹ️ Alert Definition

**Expression**: `rate(armored_archer_revenue_cents_total[24h]) < 100`
**Duration**: 1 hour
**Impact**: 24-hour revenue is below $1/hour. This usually means the store is broken (cross-reference [PaymentProcessingFailures](./PaymentProcessingFailures.md)) or that marketing/season events are not driving conversions.

---

## 📞 Escalation Path

1. **Next business day**: Triage during normal standup.
2. **If sustained >24 hours**: Product owner opens a working session with backend + live-ops.
3. **If correlated with PaymentProcessingFailures**: Treat as a P1 — follow that runbook.

---

## 🔍 Initial Assessment

### 1. Verify the Alert

```bash
# Current revenue rate (cents per second over 24h)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_revenue_cents_total[24h])' \
  | jq '.data.result[0].value[1]'

# Total revenue last 24h
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=increase(armored_archer_revenue_cents_total[24h])' \
  | jq '.data.result[0].value[1]'

# Daily series for trend
curl -s 'http://prometheus:9090/api/v1/query_range' \
  -G --data-urlencode 'query=increase(armored_archer_revenue_cents_total[24h])' \
  --data-urlencode 'start='"$(date -u -d '7 days ago' +%s)" \
  --data-urlencode 'end='"$(date -u +%s)" \
  --data-urlencode 'step=86400' | jq '.data.result[].values[]'
```

### 2. Inspect the Revenue Pipeline

```bash
# Counter definition is in metrics.ts:147 (armored_archer_purchase_revenue_total)
grep -n "revenue\|purchase" backend/src/modules/metrics.ts | head -10

# Update calls — confirm the metric is actually being incremented
grep -n "purchase_revenue\|recordPurchase" backend/src/modules/metrics.ts backend/src/modules/store.ts | head -20
```

### 3. Check Correlated Signals

```bash
# Active users
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

# Payment failures (this is the most common silent cause)
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_payment_failures_total[1h])' \
  | jq '.data.result[0].value[1]'

# Recent store / RevenueCat changes
git log --oneline -10 -- backend/src/modules/store.ts backend/src/modules/metrics.ts
```

---

## 🔧 Troubleshooting Steps

### Step 1: Is the Store Broken?

```bash
# If payment failures > 0, follow PaymentProcessingFailures immediately
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_payment_failures_total[5m])' \
  | jq '.data.result[0].value[1]'

# Sanity check recent successful purchases in the database
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FROM purchases
   WHERE created_at > now() - interval '24 hours' AND status='completed';"
```

### Step 2: Are We Reaching Real Users?

```bash
# Active users gauge
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=armored_archer_active_users' \
  | jq '.data.result[0].value[1]'

# Cross-check the analytics dashboard for DAU/MAU
open http://grafana:3000/d/armored-archer-analytics
```

### Step 3: Catalog Visibility

```bash
# Confirm the store offerings are still live in RevenueCat
curl -s -H "Authorization: Bearer $REVENUECAT_SECRET_KEY" \
  https://api.revenuecat.com/v1/products | jq '.products | length'

# Compare against the configured product map
grep -n "PRODUCT_MAP\|productId" backend/src/modules/store.ts | head -20
```

### Step 4: Marketing / Season Context

```bash
# Is a live-ops event / season currently running?
gh issue list --repo anchapin/armored-archer \
  --label "live-ops,season" --state open --limit 5

# Are promo / bundle RPCs working end-to-end?
docker logs nakama --tail 200 | grep -iE "(bundle|offer|promo)" | tail -20
```

---

## 🛠️ Resolution Procedures

### Scenario 1: Payments Are Failing

```bash
# Hand off to the PaymentProcessingFailures runbook — fix the store first, then revenue will recover
cat docs/runbooks/PaymentProcessingFailures.md
```

### Scenario 2: Counter Not Being Incremented

```bash
# Confirm recordPurchase is being called for completed purchases
grep -n "recordPurchase" backend/src/modules/store.ts | head -20

# If a recent refactor removed the call, restore it
git log --all --oneline -S "recordPurchase" -- backend/src/modules/store.ts | head -10
git diff HEAD~5 -- backend/src/modules/store.ts | grep -E "recordPurchase"
```

### Scenario 3: No Active Campaign / Season

```bash
# Coordinate with product on a campaign or limited-time bundle
gh issue create --repo anchapin/armored-archer \
  --title "[Live-ops] Revenue dip — consider running <campaign>" \
  --label "live-ops,product" \
  --assignee <product-owner>

# See docs/SEASONAL_LEADERBOARD.md and docs/CASUAL_VS_RANKED_REWARDS.md for ideas
```

### Scenario 4: Players Aren't Converting

```bash
# Funnel analytics: where are players dropping?
grep -n "funnelConversionRate\|funnelDropoff" backend/src/modules/metrics.ts | head -10

# Compare against docs/LIVE_OPS_CALENDAR.md to find the last big conversion-driving event
cat docs/LIVE_OPS_CALENDAR.md | head -40
```

### Scenario 5: Catalog Drift After Store Submission

```bash
# Apple / Google occasionally reset offerings; sync with RevenueCat
open https://app.revenuecat.com/products
# Re-import any missing SKUs and add to PRODUCT_MAP in store.ts
```

---

## ✅ Verification

```bash
# 1. Revenue rate returning
curl -s 'http://prometheus:9090/api/v1/query' \
  -G --data-urlencode 'query=rate(armored_archer_revenue_cents_total[1h])' \
  | jq '.data.result[0].value[1]'

# 2. Successful purchases in the database
docker exec postgres psql -U postgres -c \
  "SELECT count(*) FROM purchases
   WHERE created_at > now() - interval '1 hour' AND status='completed';"

# 3. Alert resolved
curl -s http://alertmanager:9093/api/v2/alerts | \
  jq '.[] | select(.labels.alertname=="LowRevenue") | .status.state'
```

---

## 📊 Post-Incident Actions

1. **Post a revenue standup note** if the dip aligns with a known seasonal trough.
2. **Validate the counter** in load tests (`backend/src/modules/__tests__/metrics.test.ts` covers the registration; add a counter-increment test if missing).
3. **Open a product follow-up** for conversion / pricing experiments.
4. **Review** [`docs/LIVE_OPS_CALENDAR.md`](../LIVE_OPS_CALENDAR.md) for upcoming campaigns.

---

## 🔗 Related Resources

- [Metrics module](../../backend/src/modules/metrics.ts)
- [Store module](../../backend/src/modules/store.ts)
- [RevenueCat Setup](../REVENUECAT_SETUP.md)
- [Live Ops Calendar](../LIVE_OPS_CALENDAR.md)
- [PaymentProcessingFailures runbook](./PaymentProcessingFailures.md)
- Grafana → *Revenue* dashboard: `http://grafana:3000/d/armored-archer-revenue`

---

## 📞 Contact

- **On-Call**: Check PagerDuty rotation
- **Product Team**: `#product` Slack channel
- **Backend Team**: `#backend-team` Slack channel
- **Live Ops**: `#live-ops` Slack channel
- **Player Support**: `#customer-support` Slack channel