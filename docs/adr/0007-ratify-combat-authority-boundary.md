# ADR-0007: Ratify the combat-authority boundary at the damage-math constants layer

**Status:** Accepted
**Date:** 2026-09-17
**Issue:** #1087
**Supersedes:** none
**Related ADRs:** [ADR-0002](./0002-server-declared-match-settlement.md) (winner-assertion), [ADR-0005](./0005-combat-authority-boundary.md) (broad combat/reward boundary — this ADR is the **damage-math** specialization of that boundary)
**Cross-references:** `backend/src/modules/combat_constants.ts`; `backend/src/modules/combat_system.ts`; `backend/src/modules/rpg_system.ts`; `backend/src/modules/balance_session.ts`; `backend/src/modules/weapon_balance.ts`; `backend/COMBAT_SYSTEM.md`; `backend/RPG_SYSTEM.md`; `RPC_MAP.md`; `CONTEXT.md` §Authority

## Context

[ADR-0005](./0005-combat-authority-boundary.md) ratifies the broad server-authoritative combat/reward boundary: the client sends **action intents**, the server computes and returns every reward value (XP, stars, Elo, drops, power rating, coin/gem payouts). The principle is server-authority at the boundary, fail-closed on any client-asserted reward value.

ADR-0005 lists the **values** that are server-rederived. It does not, however, point at a single artifact for the **damage-math constants themselves** — the small numbers that decide how a `attack=42, defense=18` exchange resolves. As of this filing, those constants live as inline magic numbers in three different modules:

- **`backend/src/modules/combat_system.ts:850-855`** — the canonical site:
  ```ts
  const baseDamage      = 10 + attackerStats.stats.attack * 0.5;
  const defenseReduction = defenderStats.stats.defense * 0.3;
  const finalDamage     = Math.max(1, baseDamage - defenseReduction);
  ```
  plus the inline crit multiplier at line 722: `damage * 2`.

- **`backend/src/modules/balance_session.ts:305-307`** — an identical formula used by the live "next-turn preview" path:
  ```ts
  const baseDamage      = 10 + attack * 0.5;
  const defenseReduction = defense * 0.3;
  return Math.max(1, Math.floor(baseDamage - defenseReduction));
  ```
  Three identical magic numbers (`10`, `0.5`, `0.3`, `1`).

- **`backend/src/modules/weapon_balance.ts:119, 195`** — the PvP damage curve and power-rating math use the **same** `* 0.5` and `* 2` magic numbers for `weapon_stats.attack` and `stats.critical_damage` respectively.

That is a real multi-file duplicate: a future balance change to "attack contributes 0.6× instead of 0.5×" would silently desynchronize live combat from live combat-preview, and live combat from matchmaking power rating. The boundary ADR-0005 documents the **rule** but not the **table**; a contributor implementing the rule has to read three modules to discover the existing numbers, and there is no canonical place to make a future change.

This ADR does not change the principle. It ratifies **the artifact** — a single constants module — and the **rule that any future change to those numbers goes through that artifact**. It does **not** (this filing) refactor the inline call sites; that refactor is queued below as a follow-up.

## Decision

### 1. The damage-math constants are server-only and live in one place

The canonical home for combat/damage-math constants is **`backend/src/modules/combat_constants.ts`**. The current set, ratified by this ADR:

| Name                              | Value  | Purpose                                              |
|-----------------------------------|--------|------------------------------------------------------|
| `BASE_DAMAGE`                     | `10`   | Additive base before per-stat coefficients           |
| `ATTACK_DAMAGE_COEFFICIENT`       | `0.5`  | `attack` → damage multiplier                         |
| `DEFENSE_REDUCTION_COEFFICIENT`   | `0.3`  | `defense` → damage reduction multiplier              |
| `CRIT_DAMAGE_MULTIPLIER`          | `2`    | Damage multiplier on a critical hit                  |
| `MIN_DAMAGE`                      | `1`    | Floor on final damage after all reductions           |
| `BASE_HEALTH`                     | `100`  | Starting health at level 1 in a PvP match            |
| `HEALTH_PER_LEVEL`                | `10`   | Per-level health increment                           |
| `MAX_HEALTH`                      | `9999` | Hard cap on per-match max-health                     |

A change to any of these numbers — for a balance patch, an A/B experiment, a season-specific tuning, or a bug fix — is made **only** in `combat_constants.ts`. The inline magic numbers in `combat_system.ts`, `balance_session.ts`, and `weapon_balance.ts` are documentation targets for follow-up replacement (see "Followups queued"); until that refactor lands, those modules remain valid because the numbers they hold match this table verbatim.

### 2. The combat constants are re-exported by every server module that owns combat semantics

`combat_system.ts` and `rpg_system.ts` both end with `export * from './combat_constants';`. This means existing server-side callers that import from either module keep working without code changes, and any new caller that imports from `./combat_constants` directly gets the same symbols. The re-export is the public surface; the constants file is the implementation.

### 3. Only the server computes damage for canonical outcomes

The GDScript client (the `autoloads/` directory, the `scenes/` directory, and any RPC consumer) **MUST** trust the server's `damage`, `is_crit`, `health`, `match_status`, and `winner` fields verbatim. It MAY display them, animate them, and present them to the player; it MUST NOT recompute any of them for canonical outcomes, and MUST NOT supply any of them back to the server as a payload field for re-derivation.

This is the **client side** of the boundary ADR-0005 documents for the server side. A client that computes its own damage to "preview the hit" before the server responds is permitted **only** as a transient, non-canonical UI affordance (e.g. the live combat-preview path), and the values it shows MUST be re-derived server-side from the same `combat_constants.ts` table — not from a parallel client-side copy. Any divergence between a client-computed preview and the server's actual outcome is a **bug**, not a feature, and the live preview path in `balance_session.ts` exists precisely so that the server-side preview agrees with the server-side resolution.

### 4. Fail-closed, same as ADR-0005

Inherited verbatim from ADR-0005: a client payload field not enumerated as **Accepted from client** is treated as **absent**. A client-asserted damage, crit, health, or match-status value is ignored — the server always runs the re-derivation. This ADR adds one more layer of "fail-closed": a client-side damage table or constants module is, by definition, drift-bait, and any future addition of one must be paired with a CI check that its numbers match `combat_constants.ts`.

## Consequences

### Positive

- A single file (`combat_constants.ts`) is the answer to "what number did you use for `attack * X`?". The damage-formula table in §1 is the canonical reference for code review, balance tuning, and ADR amendments.
- The server and the (future) server-driven live-preview path share one source of truth. A balance patch changes one file; three call sites benefit, and the live preview cannot silently desynchronize from the actual resolution.
- The ADR ratifies the contract before the inline-magic-number refactor lands. Refactor PRs now have a single target (replace inline literals with named constants from `combat_constants.ts`) instead of having to first *invent* the artifact.
- Cross-references ADR-0005 directly, so the boundary's **principle** and this ADR's **artifact** are linked. A reviewer reading either one finds the other.

### Negative / costs

- Until the inline-magic-number followup lands, the constants in `combat_constants.ts` and the literals in `combat_system.ts` / `balance_session.ts` / `weapon_balance.ts` MUST stay byte-identical. The constants file's docstring calls this out per symbol; CI does not (yet) enforce it. A balance change that updates one and forgets the other is a regression.
- The constants are not environment-driven, not hot-reloadable, and not per-season. If a future season wants a 10% damage buff, the path is a code change + redeploy, not a config push. That is intentional — see "Why constants, not config" below — but it is a constraint.
- One new module to keep aligned. Module count grows by one (`combat_constants.ts`); the **net** file count shrinks once the inline literals are removed in the follow-up.

### Why constants, not config

These numbers are game-balance decisions, not operator-policy. A balance change is a design event that goes through the same review as a combat-system change (design + engineering + QA + telemetry); a config push is not. Per-ADR-0001 ("living promises governance"), a constants file under code review is the right surface for these numbers; an env-driven config would skip the review and let a balance change ship without sign-off.

### Why one file, not several

Splitting into `damage_constants.ts`, `crit_constants.ts`, `health_constants.ts` would mirror ADR-0005's "list of server-rederived values" too literally — each call site uses most of them together (e.g. `calculateDamage` reads `BASE_DAMAGE`, `ATTACK_DAMAGE_COEFFICIENT`, `DEFENSE_REDUCTION_COEFFICIENT`, `MIN_DAMAGE` in the same expression). Splitting them forces every consumer to import from multiple files, which is exactly the multi-file drift this ADR exists to prevent. One file, one table, one review.

### Followups queued (not part of this decision)

- **Replace inline literals in `combat_system.ts`** (lines 657-658 health, 722 crit multiplier, 851-855 damage formula) with `BASE_HEALTH`, `HEALTH_PER_LEVEL`, `CRIT_DAMAGE_MULTIPLIER`, `BASE_DAMAGE`, `ATTACK_DAMAGE_COEFFICIENT`, `DEFENSE_REDUCTION_COEFFICIENT`, `MIN_DAMAGE` from `combat_constants.ts`. Behavior-preserving.
- **Replace inline literals in `balance_session.ts`** (lines 305-307) — same pattern as above. This is the live-preview path; fixing it is the single highest-value followup because it directly prevents live-preview-vs-resolution desync.
- **Replace inline literals in `weapon_balance.ts`** (lines 119 `* 0.5`, 122 `* 0.3`, 195 `* 2`) — these are **related but not identical** to the combat_system numbers. The `* 0.5` for `weapon_stats.attack` may legitimately equal `ATTACK_DAMAGE_COEFFICIENT`; the `* 2` for `stats.critical_damage` is the same magic number but a different physical quantity (power rating, not damage). Each replacement should be reviewed individually with a code comment citing this ADR.
- **Client-side consumption** — once a server-driven "send me the live combat constants as part of the season config" RPC exists, the GDScript client can read its preview numbers from the server instead of from `autoloads/const.gd`. Until then, the client MUST NOT maintain a parallel copy of these numbers; any client-side preview math is to be removed entirely (not duplicated).
- **CI guard** — add a script (`scripts/check-combat-constants.ts`) that grep-asserts the inline literals in the three server modules still match the table, and run it in `test.yml` as a non-test smoke check.
- **`docs/COMBAT_SYSTEM.md`** should grow a one-line cross-reference to this ADR at the top of its "Damage formula" section, replacing any prose that describes the magic numbers directly.