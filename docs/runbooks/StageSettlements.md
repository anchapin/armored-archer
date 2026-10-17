# Runbook: Stage Settlement Support (failed completions, retention)

**Scope**: Stage-completion settlements (issue #1558) — a player completed a stage but one or more reward effects (loot, XP) failed to land and the settlement is stuck `failed`.
**Audience**: Support / Live-ops operators on the admin allowlist (`ADMIN_USER_IDS`, gated by admin_auth.ts#withAdminGuard).
**Last Updated**: 2026-10-16

---

## Background

Every stage completion writes a settlement journal row in the `stage_settlements` storage collection (one row per player per stage, keyed `stage_settlement_<stageId>` under the player's user id). Each row tracks the state of five effects: `best_of`, `boss_defeat`, `modifier_pool`, `loot`, `xp`. A row is:

- `settled` — every effect landed. Nothing to do.
- `pending` — an attempt is mid-flight (or abandoned before the first effect). Left alone.
- `failed` — at least one effect failed. This is the support queue: the player may be missing loot and/or XP.

The design is docs/STAGE_SETTLEMENT_RECOVERY.md. In the normal path the player does not need support at all: their next completion of the same stage (after cooldown) settles the failed settlement FIRST — recorded intended loot is re-granted under its original grant ID and recorded intended XP is granted exactly once (gear_system.ts#recoverFailedStageSettlementForUser). Use the manual procedure below only when the player cannot or will not re-complete the stage.

## Support procedure

### 1. List the failed-settlement queue

Call the admin-gated RPC `armored_archer/admin_list_failed_stage_settlements` (stage_settlement_admin.ts#rpcAdminListFailedStageSettlements):

```json
{ "limit": 50, "cursor": "" }
```

Returns every player's failed settlements newest-first (`user_id`, `stage_id`, `attempt_id`, per-effect statuses, `intended_xp`, timestamps). While `truncated` is true, re-invoke with the returned `cursor` to continue; the scan is bounded to 10 pages per call. A player can also see their own journal via the client-facing `armored_archer/get_stage_settlements` RPC (stage_settlement.ts#listStageSettlements) — useful to confirm a complaint against what the player sees.

### 2. Verify the settlement really is failed

A settlement is `failed` when any effect row reads `failed` (stage_settlement.ts#computeSettlementState). If the state is `settled` but the player still reports a missing reward, this runbook does not apply — the journal recorded a successful grant, so investigate the inventory/XP path instead.

### 3. Manual settle (re-drive one settlement by key)

Call `armored_archer/admin_settle_stage_settlement` (stage_settlement_admin.ts#rpcAdminSettleStageSettlement):

```json
{ "user_id": "<player user id>", "stage_id": "<stage id from the queue>" }
```

The endpoint re-drives ONLY the failed effects of that settlement: intended loot is re-inserted under the original grant ID and intended XP is granted under the original grant ID, each behind a single-winner OCC transition — so a concurrent player re-completion cannot double-grant. Every manual settle is audit-logged under `stage_settlement_manual_settle` with the operator's user id, the target player, and the outcome.

Response `recovered: true` means the missing rewards were granted; `loot_recovered` / `xp_recovered` say which legs landed. A response with `recovered: false` means the failed effects had no recorded intent (e.g. the failure predates intent journaling — see Backfill below) or were already settled by a concurrent completion; re-list the queue to confirm the row's new state.

Do NOT attempt to compensate by editing storage directly: direct writes bypass the grant-ID idempotency and the OCC transitions and can double-grant.

### 4. Backfill candidates from the exhaustion audit entries

Settlements whose insert exhausted all retries predate intended-loot journaling and carry no `intended_loot` — the manual settle above cannot reconstruct the item. Find them in the audit log: exhaustion events are written on the `stage_complete` channel (gear_system.ts#insertGearWithRetry). For each candidate, confirm with the player which stage and roughly when, check the settlement row's `claimed_at`, then grant compensation through the normal support grant flow — never by hand-editing the settlement row.

## Retention

- **Settled** settlements are retained 30 days (stage_settlement_admin.ts#STAGE_SETTLEMENT_RETENTION_MS), then eligible for deletion by the retention sweep: call `armored_archer/admin_cleanup_stage_settlements` (stage_settlement_admin.ts#rpcAdminCleanupStageSettlements) with `{}` (or `{ "older_than_ms": ... }` for a one-off window, minimum 60 seconds). It deletes settled rows past the cutoff and audits `stage_settlement_cleanup` with the count; while `truncated` is true, re-invoke with the returned `cursor` to continue the sweep.
- **Failed** settlements NEVER expire — they are the support queue and must stay until manually settled.
- **Pending** settlements are left alone; a long-pending row is an abandoned attempt and the next completion overwrites it.

## Audit trail

| Action | Audit action | Actor |
|--------|--------------|-------|
| Automatic recovery on re-completion | `stage_settlement_recovery` (channel `stage_complete`) | the player |
| Manual settle via admin RPC | `stage_settlement_manual_settle` (channel `admin`) | the operator |
| Retention sweep | `stage_settlement_cleanup` (channel `admin`) | the operator |
