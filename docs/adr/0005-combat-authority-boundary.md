# ADR-0005: Combat authority boundary

**Status:** Accepted
**Date:** 2026-08-18
**Issue:** #1153 (filing), #1087 (open request), consolidating #1068, #1076, #1078, #1087
**Supersedes:** none
**Related ADRs:** [ADR-0002](./0002-server-declared-match-settlement.md), [ADR-0003](./0003-hybrid-duel-model.md), [ADR-0004](./0004-decommission-legacy-duel-rpcs.md)
**Cross-references:** AGENTS.md §"Architecture Notes"; `docs/COMBAT_SYSTEM.md`; `RPC_MAP.md`; `CONTEXT.md` §Authority, §Difficulty

## Context

Armored Archer is **server-authoritative**: clients send actions, Nakama RPCs validate and compute (AGENTS.md §"Architecture Notes"). That principle is ratified in `CONTEXT.md` under **Server Authority** ("all combat results, loot rolls, and match outcomes are computed from server-stored stats") and under **Match Settlement** ("only the server may declare a winner"). It is also re-stated — for one specific surface — by [ADR-0002](./0002-server-declared-match-settlement.md) (winner-assertion in `complete_match`).

Pass-1 (August 2026) tightened the broader combat pipeline across four PRs without a corresponding ADR:

- **#1068** — server-verified XP, difficulty modifier, stars, and score in PvE reward RPCs; the client may no longer report any of these as inputs.
- **#1076** — Elo changes are written only via server-settled matches; clients never supply an Elo delta.
- **#1078** — replay/settlement audit fields narrowed to what the server itself observed.
- **#1087** — open issue requesting the explicit boundary document.

Today the boundary — which client inputs the server still accepts, and which it always re-derives — lives only in four PR descriptions and a paragraph in `docs/COMBAT_SYSTEM.md`. That is brittle: a future contributor adding a new client-supplied field (e.g. a "bonus XP" or "damage multiplier" payload) has no single document to consult and is likely to invent a parallel authority, the exact failure mode ADR-0002 was filed to prevent for settlement.

## Decision

The combat and reward pipeline is **server-authoritative at the boundary**, with the explicit client-accepted / server-rederived split below. Anything not listed in **Accepted from client** is, by default, **Re-derived server-side** — there is no implicit third tier, no "advisory" client value, and no client-asserted outcome.

### Accepted from client

The server reads these fields from the client payload and trusts them as **action intents**, never as outcomes:

- `action_type` — fire, release, dodge, ability-use, etc.
- `aim_angle`, `aim_pitch`, `charge_fraction` — aim intent for the current turn.
- `target_id`, `ability_id` — which the server resolves against the live match state.
- `client_timestamp` (advisory) — used only for staleness/timeout checks; never for ordering or as a reward input.
- `match_id`, `turn_index` — identifiers the server cross-checks against its match state.

### Re-derived server-side (never trusted from client)

Every value in this list is computed by the server from stored stats, match state, and the action intent above. A client-supplied value is **always overwritten or ignored**, even when present:

- **XP grant** (PvE and PvP) — derived from enemy stats / match outcome; client XP fields are ignored.
- **Difficulty Modifier** — server-tracked from the player's recent PvE win/lose streak (CONTEXT.md §Dynamic Difficulty: PvE-only, ±20% on a 3-game threshold).
- **Star rating / score** — server-computed from turn-by-turn combat resolution.
- **Ladder Rating (Elo) delta** — server-applied only on **Match Settlement** (CONTEXT.md §Match Settlement); clients never supply an Elo field.
- **Coin / Gem payouts** — server-computed from `Match Settlement` and `Season Rewards`; client currency fields are ignored.
- **Drop rolls, rarity, modifier quality** — server-only; rolls are made against `gear_type` / `gear_rarity` enums (`backend/DATABASE_SCHEMA.md`).
- **Power Rating** — derived from `level×10 + (atk+def+dodge+crit)/4` (CONTEXT.md §Power Rating); clients cannot self-declare.
- **Standing** — server-computed leaderboard position at the end of a **Season**.

### Where the boundary lives in code

- Server-side validation and re-derivation live in `backend/src/modules/combat_system.ts` and the reward RPCs it calls (PvE reward RPCs per #1068; settlement per ADR-0002).
- The client sends actions only via the **PlayerActions** path in `autoloads/CombatManager.gd` and `autoloads/CombatSyncManager.gd`; it never sends results. (The legacy correspondence RPCs that *did* accept client outcomes — `submit_turn`, `complete_match` winner/loser — were removed by [ADR-0004](./0004-decommission-legacy-duel-rpcs.md) and #1076 respectively.)
- Every reward RPC re-derives; no reward RPC accepts a client reward value as input. This is the test surface: see `backend/src/modules/__tests__/combat_system.test.ts` and the reward-RPC test files added/updated in #1068.

### Why fail-closed

A client field not enumerated in **Accepted from client** is treated as **absent**, not as zero. The server never defaults a missing reward to "0 from client, server may not override"; it always runs the re-derivation. A client-asserted non-zero value is treated the same as a missing value: ignored.

## Consequences

### Positive

- A single document answers "may the client send X?" — future PRs that add a new field have a checklist, not a hunt across PR threads.
- Eliminates the parallel-authority failure mode ADR-0002 documents for settlement, generalized to every combat/reward surface.
- The boundary is testable: reward-RPC tests already assert server-rederivation (added in #1068); future fields inherit the pattern.
- Cross-references `CONTEXT.md` vocabulary directly, so domain review has one source of truth.

### Negative / costs

- A second sentence must be added to every new reward RPC's docstring: "client-supplied <X> is ignored." This is the contract.
- The PvE reward RPCs touched by #1068 still carry some legacy client fields for backward binary compat (the client binaries in the field cannot be re-shipped for every cleanup); these are documented in `RPC_MAP.md` and explicitly ignored server-side, but their presence in the payload is a small ongoing source of confusion for new readers. They will be removed when the legacy clients fall below the support threshold.

### Followups queued (not part of this decision)

- #1087 should be closed by this ADR's filing.
- A short section in `docs/COMBAT_SYSTEM.md` cross-linking back to this ADR (so the existing runbook points at the canonical document instead of four PR descriptions).
- Audit whether `docs/RPG_SYSTEM.md`, `docs/CASUAL_VS_RANKED_REWARDS.md`, and `docs/SEASONAL_LEADERBOARD.md` still describe any "client may send" field that contradicts the boundary — any contradiction should be filed as a ratification task per [ADR-0001](./0001-prd-living-promises-governance.md) rules.
