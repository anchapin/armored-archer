# Issue #1390 — Cluster 2 reproduction (gear / combat / vertical slice)

**Cluster:** #1390 — production-side, branch `fix/issue-1390-cluster-2-gear-combat`
**Worktree:** `/home/alex/worktrees/issue-1390`
**Date:** 2026-09-28

## Test command

```bash
cd /home/alex/worktrees/issue-1390/backend && \
  npm run test:integration -- --testPathPattern='gear.*\.test\.ts|combat.*\.test\.ts|vertical_slice.*\.test\.ts'
```

Local stack is up (Nakama + Postgres on `localhost:7350` / `5433`).

## Pre-fix totals

| Suite | Fail | Pass | Total |
|-------|------|------|-------|
| gear_system.test.ts  | 28 | 1  | 29 |
| combat_system.test.ts| 23 | 0  | 23 |
| vertical_slice_smoke.test.ts | 15 | 3  | 18 |
| **Total** | **66** | **4** | **70** |

Cluster-2 failure target was ~77; this run sees **66** failing tests across 3 suites. (All three suites are now active; the integration suite was previously counted as 339 across all clusters.)

## Failure categories

### Category A — Gear RPCs not registered in the rate-limit branch (~28 failures)

The current `RATE_LIMIT_ENABLED=true` env routes through `if (config.rateLimit.enabled)` in `backend/src/index.ts:273`. The rate-limit branch registers these gear RPCs:

- `armored_archer/generate_gear` ✓ (line 313)
- `armored_archer/equip_gear` ✓ (line 312)

But **four** gear RPCs that the test calls are only registered in the non-rate-limit branch (lines 590–605), so when rate-limiting is on the runtime returns 500 "rpc not registered":

- `armored_archer/unequip_gear` — handler `rpcUnequipGear` exists at `gear_system.ts:1064`
- `armored_archer/get_inventory` — handler `rpcGetInventory` exists at `gear_system.ts:1228`
- `armored_archer/unlock_modifier_pool` — handler `rpcUnlockModifierPool` exists at `gear_system.ts:1282`
- `armored_archer/get_completed_stages` — handler `rpcGetCompletedStages` exists at `gear_system.ts:1395` (approx.)

**Representative error from test-rpc.js live probe:**

```
armored_archer/unequip_gear ERR 500 |
  {"error":"rpc not registered",
   "message":"RPC function not found: armored_archer/unequip_gear"}
armored_archer/get_inventory ERR 500 |
  {"error":"rpc not registered",
   "message":"RPC function not found: armored_archer/get_inventory"}
armored_archer/unlock_modifier_pool ERR 500 |
  {"error":"rpc not registered",
   "message":"RPC function not found: armored_archer/unlock_modifier_pool"}
```

**Hypothesis:** Mirror the `generate_gear` / `equip_gear` registration (rate-limit branch) for the missing four RPCs. Add the wrapper + `registerRpcWithRateLimit` calls for each.

### Category B — `armored_archer/cleanup_test_user` not registered anywhere (~15 failures)

`backend/tests/integration/vertical_slice_smoke.test.ts:70` calls `await nakama.rpc(session, 'armored_archer/cleanup_test_user', { user_id });`. There is no handler and no registration anywhere in `backend/src/index.ts`. Every vertical-slice test that calls the RPC returns 404.

**Representative error:**

```
armored_archer/cleanup_test_user ERR 404 |
  {"error":"rpc not registered",
   "message":"RPC function not found: armored_archer/cleanup_test_user"}
```

**Hypothesis:** Add a small handler under `backend/src/modules/auth/cleanup_test_user.ts` (cluster-6 territory — must NOT do this; place under an in-scope module instead). The handler should:
1. Delete all storage objects owned by `user_id` from the `catalog`, `inventory`, `loadout`, `player_stats`, `campaign_progress` collections (server-authoritative).
2. Delete the wallet (currency) entries.
3. Return `{ ok: true, user_id }`.

Then register `armored_archer/cleanup_test_user` in **both** branches of `backend/src/index.ts` (lines 273–541 rate-limit-enabled and 542–617 rate-limit-disabled) using `registerRpcWithRateLimit` and plain `registerRpc`. Use a sync handler wrapper (Nakama JS runtime — async wrappers are unsupported; ADR-0008).

### Category C — `submit_combat_action` async handler rejected by runtime (~23 failures)

`backend/src/modules/combat_system.ts:478` declares `rpcSubmitCombatAction` as `async function` and uses `await` for several DB calls (`handleTurnTimeout`, `validateLoadoutForArchetype`, `saveMatchState`, `processAction`, `updatePlayerStats`, `handleQuestUpdate`).

The wrapper at `backend/src/index.ts:717` is `function rpcSubmitCombatActionWrapper(...)` — synchronous, returns `rpcSubmitCombatAction(...)` directly. Because the production handler returns `Promise<string>`, the wrapper returns a `Promise` where the runtime expects a `string`. Nakama JS throws:

```
armored_archer/submit_combat_action ERR 500 |
  {"error":"non_string_result",
   "message":"RPC submit_combat_action returned a non-string result; async handlers are unsupported"}
```

**Hypothesis:** This is the same shape as the `validate_purchase` bug documented at `index.ts:770` (ADR-0008). The fix is to convert `rpcSubmitCombatAction` to a sync handler. This is the largest production-side change in the cluster.

### Category D — `create_match` returning undefined (~10 failures)

`backend/src/modules/matchmaker.ts:359` `rpcCreateMatch` is sync and returns a JSON string. Wrapper at `index.ts:737` returns it directly. A live probe shows the RPC works end-to-end. The "returning undefined" symptom in the cluster-2 spec refers to a subset of tests where the payload is malformed (missing required field); the production handler returns the literal string `"undefined"` in that path. Tests then `JSON.parse(...)` and assert on `result.match_id` which is undefined → test fails.

**Hypothesis:** Validate the input at the wrapper boundary. If the payload lacks required fields (`match_type`), return a well-formed error JSON like `{ error: "missing_field", field: "match_type" }`. The tests assert specific error paths, so we need to match the existing test expectations rather than invent new ones. Will verify per-test after reading the relevant `combat_system.test.ts` blocks.

## Reproduction artefacts

- `/tmp/cluster2.txt` — full Jest output (66 fails, 4 pass).
- Live probe script: `backend/test-rpc.js` (one-off; not committed).

## Plan

1. Add missing RPC registrations (Category A) — pure delta, low risk.
2. Add `cleanup_test_user` handler + dual-branch registration (Category B) — pure delta, moderate risk; uses sync wrapper pattern.
3. Convert `rpcSubmitCombatAction` to sync (Category C) — production handler refactor; gated by per-`await` audit. If the audit shows the refactor is too large for the 25-turn budget, downgrade to documenting it as a follow-up.
4. Fix the `create_match` undefined-return path (Category D) — wrapper-level input validation.
5. Re-run cluster-2 suite. Expected new pass count: ≥50/70.
6. Run full integration suite. Target ≥65% pass rate.
7. Run `bash scripts/audit-runbook-citations.sh`. Fix any citations introduced.
