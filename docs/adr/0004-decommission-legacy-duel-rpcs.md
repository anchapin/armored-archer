# ADR-0004: Decommission legacy correspondence duel RPCs

**Status:** Accepted
**Date:** 2026-08-17
**Issue:** #903
**Supersedes:** none

## Context

The legacy correspondence-style duel engine (`submit_turn`, `get_async_match_state`, `forfeit_match`, plus 24h/7d correspondence constants in `backend/src/modules/matchmaker.ts`) is **still registered** alongside the shipped hybrid duel model.

The shipped client (`autoloads/CombatManager.gd`, `autoloads/CombatSyncManager.gd`) uses the hybrid RPCs (`submit_combat_action`, `get_match_state`) and never calls the legacy correspondence endpoints. This was verified during #869 / PR #881. The legacy endpoints are:

1. Residual attack surface — the correspondence engine reads/writes duel state on the storage collection `pvp_matches` next to the server-authoritative path used by `combat_system.ts`.
2. A source of confusion — `docs/ASYNC_DUEL_LIFECYCLE.md` had to add a clearly-labeled "legacy" section.
3. Dead code — `autoloads/MatchmakerManager.gd` still defines `submit_turn`, `get_async_match_state`, `forfeit_match`, and `reconnect_to_match` (which calls `get_async_match_state`), but no shipped code path invokes them. The only test reference is `test/test_async_duel_flow.gd`, which uses `has_method()` guards and would pass via the "no method" fallback once the methods are removed.

## Decision

**Option A — Remove outright.**

Rationale:

- The shipped client migrated to `submit_combat_action`/`get_match_state` in PR #881 and the migration has been live for at least one release cycle.
- Removing eliminates residual attack surface and confusion; deprecating behind a flag (Option B) would retain both the attack surface and the confusion for one extra release cycle while the flag is being phased out.
- Client-side legacy code is unused. Removing it is a net cleanup.
- RPC_MAP.md already does **not** list the legacy RPCs (verified) — no entry to remove there.

## Changes

### Backend (`backend/src/modules/`)

- **`matchmaker.ts`**
  - Removed imports of `registerRpcSubmitTurn`, `registerRpcGetAsyncMatchState`, `registerRpcForfeitMatch`.
  - Removed registration calls in `initModule`.
  - Removed `registerRpcSubmitTurn`, `registerRpcGetAsyncMatchState`, `registerRpcForfeitMatch` exports.
  - Removed `rpcSubmitTurn`, `rpcGetAsyncMatchState`, `rpcForfeitMatch` handler implementations.
  - Removed correspondence-era constants: `TURN_TIMEOUT_MS = 24h`, `MAX_CONSECUTIVE_TIMEOUTS = 2`, `DEFAULT_MAX_TURNS = 10`, `BASE_HEALTH = 100`, `ACTIVE_MATCH_EXPIRY_MS = 7 days`.
  - Removed interfaces `SubmitTurnRequest`, `ForfeitMatchRequest`.
  - Removed helper functions used only by legacy RPCs: `storePlayerTurnData`, `resetConsecutiveTimeouts`, `saveMatchState`, `processCompleteTurn`, `getMatchForTurnSubmission`, `checkTurnTimeout`, `handleFirstTimeout`, `handleTimeoutForfeit`, `calculateTurnResults`, `checkMatchEndConditions`, `completeMatchFromTurn`, `sendTimeoutNotification`, `checkDuplicateTurn`.
  - Replaced correspondence initial-state references with the shipped 5-minute turn timeout value (matches `combat_system.ts`). Initial `creator_health` / `opponent_health` / `max_turns` left as harmless defaults (overridden by `combat_system.ts` when the duel starts).
  - **`PENDING_MATCH_EXPIRY_MS = 24h` is retained** — it is the hybrid model's open-match acceptance window, not correspondence.
- **`validation.ts`**
  - Removed Zod schemas `submit_turn`, `forfeit_match`.
- **`rate_limit.ts`**
  - Removed rate-limit entries for `submit_turn`, `forfeit_match`, `get_async_match_state`.
- **`__tests__/rate_limit.test.ts`**
  - Switched tests that used `submit_turn` as the rate-limit key to use `create_match` (a shipped RPC), preserving the test surface.
- **`__tests__/matchmaker.test.ts`** *(new)*
  - Added a test asserting that `submit_turn`, `get_async_match_state`, `forfeit_match` are not registered on the module initializer.

### Client (`autoloads/MatchmakerManager.gd`)

- Removed RPC constants: `RPC_SUBMIT_TURN`, `RPC_GET_ASYNC_MATCH_STATE`, `RPC_FORFEIT_MATCH`.
- Removed methods: `submit_turn`, `get_async_match_state`, `reconnect_to_match`, `forfeit_match`, `_emit_match_state_update`, `_handle_match_status_change`.
- Removed signals: `turn_submitted`, `match_state_loaded`, `match_reconnected`, `match_reconnect_failed`, `match_forfeited`, `match_expired`, `turn_timeout`.
- Removed correspondence timeout-monitoring state and methods: `_timeout_check_timer`, `_timeout_warning_threshold_ms`, `start_timeout_monitoring`, `stop_timeout_monitoring`, `_check_turn_timeout`.
- Removed correspondence utility methods: `is_my_turn`, `get_time_remaining_ms`, `get_my_health`, `get_opponent_health`, `get_current_turn`, `get_max_turns`.
- Removed `match_forfeited.emit()` call in `_handle_match_completion` (only triggered by the legacy `forfeit_match` path).

### Docs

- `docs/ASYNC_DUEL_LIFECYCLE.md` — legacy correspondence engine section now reads "Removed (issue #903)".
- `backend/src/modules/ASYNC_DUEL_LIFECYCLE.md` — mirror updated for consistency.
- `RPC_MAP.md` — no change required; legacy RPCs were already absent.

### Tests

- `test/test_async_duel_flow.gd` — unchanged. The existing tests use `has_method()` guards and will pass via the "no method" fallback path now that the legacy methods are removed.

## Consequences

- Removing these endpoints is a **breaking change** for any unshipped client code that called the legacy endpoints. No such callers were found in the repo (`grep` of `*.gd` and `*.ts` excluding the test file shows zero callers).
- The correspondence turn processing path is gone; all duel turns now go through `combat_system.ts`.
- `PENDING_MATCH_EXPIRY_MS` (24h open-match window) remains — that's the hybrid model's matchmaking window, not correspondence.