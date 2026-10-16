# SLO: Public API Availability and Latency (issue #1346)

Postmortem PD-2026-04-12, Action Item A1. Burn-rate alerts live in
`backend/alerts.yml` (group `armored_archer_slo_burn_rate`); measurement
queries below are the same expressions those alerts use.

## Objectives

| SLO                                                                          | Target    | Status                                 |
| ---------------------------------------------------------------------------- | --------- | -------------------------------------- |
| Availability: share of RPC calls that do not return an error, 30-day rolling | 99.9%     | Active                                 |
| Latency: p95 of `armored_archer_rpc_duration_seconds`, 30-day rolling        | <= 500 ms | PROPOSED - pending backend/lead review |

Error budget (availability): 0.1% of RPC calls per 30-day window. At the
current traffic mix that is the quantitative line for incident severity: any
event that consumes budget faster than it re-earns is an SLO incident even if
no static threshold has tripped.

## Measurement

Availability error ratio (bad / total):

```promql
rate(armored_archer_rpc_errors_total[30d]) / rate(armored_archer_rpc_calls_total[30d])
```

Latency p95:

```promql
histogram_quantile(0.95, rate(armored_archer_rpc_duration_seconds_bucket[30d]))
```

## Multi-window burn-rate alerts (Google SRE Workbook ch. 5)

Burn rate = observed error ratio / budget (0.001). Alerts pair a long window
(detect the burn) with a short window (confirm it is still active):

| Alert             | Long window | Short window | Burn rate | Budget consumed in | Severity        |
| ----------------- | ----------- | ------------ | --------- | ------------------ | --------------- |
| SLOBurnRateFast   | 1h          | 5m           | 14.4x     | 2 days             | critical (page) |
| SLOBurnRateMedium | 6h          | 30m          | 6x        | 5 days             | warning         |
| SLOBurnRateSlow   | 24h         | 2h           | 3x        | 10 days            | warning         |
| SLOBurnRateTicket | 72h         | 6h           | 1x        | 30 days            | info (ticket)   |

Latency watch: `SOLatencyP95High` pages at p95 > 500 ms for 10m (matches the
proposed target above) and stays independent of the existing static
`HighLatency` alert (p95 > 2s), which remains the degraded-mode tripwire.

## Error-budget policy

- Budget > 25% remaining: normal release cadence.
- Budget <= 25% remaining: feature freeze on latency- or error-risky changes;
  reliability work only, per the PD-2026-04-12 action items.
- Budget exhausted: halt non-emergency deploys until the 30-day rolling ratio
  recovers; incident review required before unfreezing.

Related: `docs/runbooks/HighLatency.md`,
`docs/runbooks/HighErrorRate.md`, `docs/incidents/PD-2026-04-12.md`.
