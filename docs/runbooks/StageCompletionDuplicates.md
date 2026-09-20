# StageCompletionDuplicates

**Alert:** `StageCompletionDuplicateSpike` (Warning)
**Component:** PvE stage progression (`armored_archer/stage_complete`)

## What This Means

More than one `stage_complete` request per minute is being rejected as
`DUPLICATE_COMPLETION` for 5 minutes. The claim-first dedup marker (issue
#1069) is doing its job — every rejected request had a prior
`stage_completion_claims` storage object younger than the 5-minute cooldown
(`STAGE_COMPLETION_CLAIM_COOLDOWN_MS`, stage_progression.ts:78).

Two very different root causes present identically here:

1. **Stuck client retry loop** — a mobile client with a flaky connection
   re-sending the same completion after it already succeeded (benign; the
   claim marker prevented any double-grant).
2. **Scripted replay attack** — an automated client replaying captured
   completions looking for a double-grant window (hostile; also benign to
   the economy, but the actor should be blocked/rate-limited).

## Signal Chain

- RPC handler: `claimStageCompletionOrReject` (gear_system.ts:1755) calls
  `checkStageCompletionClaim` (stage_progression.ts:110) and records
  `recordStageClaim('replay_rejected')` (metrics.ts:1002) plus the
  `duplicate` terminal outcome of `armored_archer_stage_complete_total`
  (metrics.ts:939) on every rejection.
- Alert rule: `StageCompletionDuplicateSpike` in backend/alerts.yml
  (`sum(rate(armored_archer_stage_completion_claims_total{result="replay_rejected"}[5m])) > 1/60`).

## Investigation Steps

1. **Duplicate-reject rate and shape** — in Grafana (02-performance.json,
   "Stage Completion Duplicate-Reject Rate" panel) or:
   ```promql
   sum(rate(armored_archer_stage_completion_claims_total{result="replay_rejected"}[15m]))
   ```
   A single user's stuck retry loop shows as a flat line that starts
   abruptly; distributed attacks show many small series by user.

2. **Identify the replaying user(s)** — query the audit trail for duplicate
   rejections (the RPC audits each terminal outcome):
   ```sql
   SELECT write_time, user_id, value->>'stage_id' AS stage_id
   FROM storage
   WHERE collection = 'audit_logs'
     AND value->>'action' = 'stage_complete'
     AND write_time > now() - interval '30 minutes'
   ORDER BY write_time DESC;
   ```
   Users with bursts of `stage_complete` audits at machine cadence
   (sub-second intervals) are replay loops or scripts.

3. **Check for the clamp cheat signal** — correlate:
   ```promql
   sum(rate(armored_archer_stage_complete_total{outcome="clamped"}[15m]))
   ```
   A replay attack that also sends out-of-range stars/score lights this up;
   a stuck legitimate client almost never does (it replays its original,
   in-range payload).

4. **Confirm no double-grants occurred** — the claim marker makes this
   structurally impossible, but for incident reports verify the user's
   inventory write count matches their accepted completions:
   ```sql
   SELECT user_id, count(*) FROM inventory_items
   WHERE user_id = '<suspect-user-id>'
     AND acquired_at > now() - interval '1 hour'
   GROUP BY user_id;
   ```

## Remediation

- **Stuck client (benign):** no server action; the cooldown rejects the
  replays and the client gives up. If a client version shows a systemic
  retry bug, track it as a client bug with the version string from
  `canaryVersionMin`/`canaryVersionMax` gating context.
- **Scripted replay:** rate-limit or ban the offending user id via the
  admin tooling (the RPC is already behind `checkRateLimit`), and review
  surrounding admin-guarded endpoints for probing
  (`armored_archer_admin_rpc_access_denied_total`).

## Validation After Fix

- `armored_archer_stage_completion_claims_total{result="replay_rejected"}`
  rate returns to ~0.
- No `DUPLICATE_COMPLETION` audit bursts for the affected user.

## References

- Issue #1139 (stage-progression telemetry), #1069 (claim-first
  consolidation), #1068 (claim clamping)
- `armored_archer/stage_complete` handler — see RPC_MAP.md §Stage Progression
