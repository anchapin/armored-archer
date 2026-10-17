# Stage Completion Settlement & Recovery (design, issue #1558)

Status: **design proposal** — no code or schema changes in this document's PR.
Follow-up to #1462 (fail-the-stage patch). Per #1558, any schema, claim or
reward-contract change described here needs its own design review before
implementation.

## Problem

Stage completion can fail visibly at the loot-insert step after the three
bounded attempts (`MAX_INSERT_ATTEMPTS` in `gear_system.ts`) are exhausted.
Today that failure is not recoverable for the player:

1. The claim marker (`stage_completion_claims` collection, written claim-first
   per #1069) stays consumed for the 5-minute cooldown
   (`STAGE_COMPLETION_CLAIM_COOLDOWN_MS`).
2. Earlier writes — best-of completion, boss defeat, modifier-pool unlock —
   have already committed.
3. A same-payload retry after the cooldown can be classified as *no
   improvement* because best-of was already saved, so the player gets neither
   replacement loot nor the withheld XP.
4. XP and terminal success were withheld on the exhausted insert, so the
   player's stage result is permanently lost unless support intervenes.

## What already exists (do not redesign)

- **Claim-first ordering** (#1069): the claim is written before any reward
  effect, so double-grant is impossible within the cooldown.
- **Same-attempt resume**: `attempt_id` in the claim lets a crashed/replayed
  client retry resume instead of being rejected as `DUPLICATE_COMPLETION`
  (`evaluateExistingClaim`).
- **Insert-once loot grants**: `insertGearItem` takes a deterministic
  `grant_id` and returns `alreadyGranted` when the same grant committed
  before — this already makes an ambiguous insert (timeout after commit)
  safe to retry *within* the 3-attempt loop.

The gap is that nothing persists the *intended reward* and *settlement
state* across the visible failure: after exhaustion the server forgets what
it owed, and the claim blocks re-entry.

## Proposed design

### 1. Settlement record

New Nakama storage collection `stage_settlements`, key
`${userId}:${stageId}:${attemptId}`, written in the **same `storageWrite`
batch as the claim** (one atomic call), containing:

- `attempt_id`, `stage_id`, `claimed_at`
- `intended_reward`: the rolled gear payload (fully generated item, not a
  seed), the deterministic `grant_id`, and the XP amount — fixed at claim
  time so recovery never rerolls
- `effects`: per-effect settlement status —
  `best_of` / `boss_defeat` / `modifier_pool` / `loot` / `xp`, each
  `pending` | `settled` | `failed`
- `state`: `pending` | `settled` | `failed`, `updated_at`, OCC `version`

### 2. Settlement-driven completion

Each reward-effect write is gated on its settlement sub-status:

- On success, flip the sub-status to `settled` (OCC-checked settlement
  update).
- On the exhausted loot insert, mark `loot` (and therefore `xp`) `failed`,
  stage still fails visibly exactly as #1462 intends — but the settlement
  row now durably records the intended reward and the failed state.
- XP is granted exactly once, on the `loot: settled` transition, and the
  transition is recorded before the XP write returns.

### 3. Recovery paths

- **Same-attempt resume (within cooldown)**: the existing `attempt_id`
  resume path re-drives only the `pending`/`failed` effects, using the
  persisted `intended_reward` and `grant_id`. A timeout-after-commit insert
  reconciles through the existing insert-once `alreadyGranted` response.
- **Post-cooldown re-completion**: when a completion for the same
  user+stage arrives and a `failed` settlement exists, the completion
  handler settles the old settlement *first* (grants the original intended
  loot + XP, transitions it to `settled`), then processes the new
  completion under the normal rules — no best-of improvement is required to
  recover the lost reward, and the new completion's own rewards follow the
  existing contract.
- **Concurrent requests**: claim OCC + `attempt_id` resume already
  serialize same-attempt retries; settlement state transitions are
  OCC-checked so two resumptions cannot both settle.
- **Restart/reconnect**: all recovery state lives in Nakama storage; there
  is no in-process state to lose.

### 4. Player-visible state

New RPC `armored_archer/get_stage_settlements` returning the player's
`pending`/`failed`/`settled` settlements (sanitized: stage id, state,
recovered item summary, timestamps). The client surfaces a "reward
recovered" toast when a post-cooldown completion settles an old settlement.
`failed` settlements older than the retention window that support has not
touched are listed by the support query below, not by the client.

### 5. Retention, audit, support

- `settled` settlements retained 30 days, then eligible for a cleanup job
  (same pattern as the existing storage cleanup tasks).
- `failed` settlements never auto-expire; they are the support queue.
- The exhausted-insert path already calls `logAudit`; recovery transitions
  log the same way with the settlement key, so every grant can be traced
  claim → settlement → grant.
- Support runbook addition: a storage query listing `failed` settlements,
  plus a manual-settle procedure (re-drive one settlement by key) for
  pre-existing affected runs; backfill candidates can be derived from the
  existing exhaustion audit entries.

## Invariants (must hold under every path)

1. A settlement grants its intended loot and XP **at most once** — the
   `pending → settled` transition is OCC-checked and single-winner.
2. Recovery never rerolls: the reward is fixed in `intended_reward` at
   claim time.
3. A new completion's rewards are never skipped or substituted because an
   old settlement was settled first.
4. The claim is never deleted to force re-entry; re-entry goes through the
   documented resume/recovery paths only.

## Test plan (failure injection at settlement boundaries)

- Exhaust all 3 loot inserts → settlement `failed`, intended reward
  persisted; same-attempt resume within cooldown settles loot + XP.
- Timeout *after* a committed insert (ambiguous outcome) → resume sees
  `alreadyGranted`, no duplicate row, settlement settles.
- Post-cooldown same-payload retry (no best-of improvement) → old
  settlement settles first; new completion still evaluates normally.
- Two concurrent resumes → exactly one wins the transition; the loser
  reads `settled` and grants nothing.
- Kill between claim write and first effect write → settlement `pending`
  with all effects pending; resume completes it.
- XP double-grant attempt: replay after `loot: settled` → XP skipped.
- `get_stage_settlements` returns the expected states at each step.

## Explicit non-goals (from #1558)

- No rollback of the committed best-of/boss/modifier writes.
- No claim deletion or reroll on retry.
- This document does not implement anything; the schema (new collection)
  and reward-contract changes described above go through their own design
  review before implementation.
