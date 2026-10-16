# Nakama Auto-Scale Policy (issue #1351, PD-2026-04-12 A6)

The 2026-04-12 incident required a manual pool-ceiling bump under load
because no auto-scale trigger existed. This document defines the trigger,
the scaling actions, and the rollback path. The compose expression of the
policy lives in `backend/docker-compose.autoscale.yml`.

## Trigger

| Signal | Threshold | Duration | Source |
| --- | --- | --- | --- |
| Host CPU per Nakama instance | > 70% | 5 minutes sustained | `node_cpu_seconds_total` (same metric family as the `HighCPUUsage` alert, which trips at 80%) |

The 70% trigger fires ahead of the existing 80% `HighCPUUsage` warning
(`backend/alerts.yml`) so scaling starts before users see latency. Evaluate
per instance: one hot instance scales; a fleet-wide hot signal indicates a
systemic cause (runbook: `docs/runbooks/HighLatency.md`), not a capacity
gap.

## Scale-out action

1. Add one Nakama replica behind the load balancer (swarm:
   `docker stack deploy -c docker-compose.yml -c docker-compose.autoscale.yml armored_archer`,
   then set `deploy.replicas` to N+1; the override file carries the resource
   limits and explains why plain-compose `--scale` is not the scale-out path).
2. Do NOT raise the Postgres pool ceiling as part of scale-out: pool sizing
   is governed by #1350 and changes only on observed-peak data.

## Cooldown and scale-in

- **Cooldown**: no further scale-out for 10 minutes after a scale event.
- **Scale-in**: when per-instance CPU stays below 50% for 30 minutes, remove
  one replica, then re-enter cooldown.

## Rollback

Scaling actions are plain replica-count changes. Roll back by returning
`deploy.replicas` to the prior value and re-deploying the stack. No schema, config, or
data migration is involved, so rollback is always safe.

## Status

- [x] Trigger and cooldown documented (this file).
- [x] Policy expressed as a compose override (`backend/docker-compose.autoscale.yml`).
- [x] Runbook updated with the auto-scale signal (`docs/runbooks/HighLatency.md`).
- [ ] Tested in staging via the A2 load test (#1347) — requires a staging
  environment; owner action.
