# ADR-0009: Combat state ownership boundary (CombatManager vs CombatSyncManager)

**Status:** Accepted
**Date:** 2026-10-19
**Issue:** #1714 (spin-off from #1660 phase-5 dependency map, item b)
**Supersedes:** none
**Related ADRs:** [ADR-0002](./0002-server-declared-match-settlement.md), [ADR-0003](./0003-hybrid-duel-model.md), [ADR-0004](./0004-decommission-legacy-duel-rpcs.md), [ADR-0005](./0005-combat-authority-boundary.md)
**Cross-references:** `autoloads/CombatManager.gd`; `autoloads/CombatSyncManager.gd`; `scenes/ui/combat_menu.gd`; `autoloads/MatchmakerManager.gd`

## Context

Two autoloads hold networked-combat state on the client:

- **CombatManager** is the RPC-submission mirror. It submits actions (`submit_combat_action`) and re-fetches server state (`get_match_state`); its `current_match_state`, `my_health`, `opponent_health`, and `is_my_turn` are written **only** from server RPC results (`_update_local_state`, `_update_from_match_state`, `_apply_perspective`). Its consumer is the duel action UI (`scenes/ui/combat_menu.gd`).
- **CombatSyncManager** is the live-session presentation holder for the shipped hybrid duel ([ADR-0003](./0003-hybrid-duel-model.md)). It owns the combat lifecycle (`start_combat`, `end_combat`, `resync_combat_state`), the opponent-move polling loop with its circuit breaker (#1081), and the local presentation state (`player_health`, `opponent_health`, `combat_log`, `is_my_turn`, `is_combat_active`) that the live HUD binds to. Its consumers are the match flow (`autoloads/MatchmakerManager.gd`) and the vertical slice demo.

The phase-5 dependency map in #1660 concluded the two are **not** duplicates and must not be mechanically folded: one is a post-RPC echo, the other a real-time polling mirror. But the overlap is real: both carry a health pair, a turn flag, a combat-active flag, and a `combat_ended` signal. Two parallel holders of the same concepts is where desync bugs breed — a reader cannot tell today which holder a given field belongs to, and a contributor adding state has no rule for where it goes.

Neither holder is authoritative. Settlement is server-declared only ([ADR-0002](./0002-server-declared-match-settlement.md)) and the combat/reward pipeline is server-authoritative at the boundary ([ADR-0005](./0005-combat-authority-boundary.md)); the legacy correspondence RPCs that once accepted client outcomes were removed by [ADR-0004](./0004-decommission-legacy-duel-rpcs.md).

## Decision

**Keep both managers, with a written ownership boundary.** No consolidation in this stage.

### Single source of truth per concept

The server is the single source of truth for every combat value. Between the two client holders, ownership is split by **path**, not by field name:

| Concept | Live-session path (polling loop) | RPC-submission path (post-RPC echo) |
|---|---|---|
| Health (self / opponent) | CombatSyncManager `player_health` / `opponent_health` (presentation state, advanced by opponent-move polling and `apply_*_damage`) | CombatManager `my_health` / `opponent_health` (derived from the last server `match_state`) |
| Turn flag | CombatSyncManager `is_my_turn` | CombatManager `is_my_turn` (perspective-derived from server state) |
| Combat log | CombatSyncManager `combat_log` | CombatManager log via `get_combat_log()` (server-sourced) |
| Match state dictionary | — (not held) | CombatManager `current_match_state` (only holder) |
| Lifecycle (start / end / resync, polling, circuit breaker, offline surface) | CombatSyncManager only | — (none) |
| Action submission (`submit_combat_action`) and re-fetch (`get_match_state`) | — (none) | CombatManager only |
| `combat_ended` signal | Live-loop terminal signal (presentation) | Server-settlement echo after an RPC round trip |

A consumer binds to the holder for the path it lives on: live-duel HUD elements bind to CombatSyncManager; flows that need server-confirmed state after an action read CombatManager. Neither signal named `combat_ended` is settlement — settlement remains server-declared per [ADR-0002](./0002-server-declared-match-settlement.md).

### Boundary rules for future changes

1. New **live-session presentation** state goes in CombatSyncManager; new **RPC-result echo** state goes in CombatManager. No third combat-state holder.
2. Neither manager may add a field the other owns. Shared concepts stay per-path mirrors; they are never synced between the two managers.
3. If a field's owning path is ambiguous, the change stops and this ADR is amended first.

### Follow-up direction (not this stage)

The consolidation candidate, when revisited, is a **read-through cache**: a single read API that serves both paths from the server-echo cache, collapsing the duplicated health/turn fields onto one reader while leaving the polling lifecycle in CombatSyncManager and the RPC plumbing in CombatManager. That is a separate design stage requiring its own approval before any gameplay code is written; this ADR authorizes documentation only.

## Consequences

### Positive

- One document answers "which manager owns this field?" — the desync failure mode #1660 flagged (two parallel sources of truth) is now governed by an explicit rule instead of convention.
- The per-path split matches how the holders are actually built and consumed (verified against the call sites above), so the boundary documents reality rather than imposing a new one.
- Future contributors have a placement rule (boundary rule 1) and an escalation rule (rule 3).

### Negative / costs

- The duplicated concepts (health pair, turn flag, `combat_ended`) remain duplicated by design until the read-through-cache stage is taken up. Consumers must pick the right path; the table above is the checklist.
- Two signals share the name `combat_ended` with different meanings (presentation terminal vs settlement echo). Renaming either is a breaking change for existing consumers and is deferred to the consolidation stage.

### Followups queued (not part of this decision)

- Evaluate the read-through-cache consolidation as its own stage (requires explicit stage approval before gameplay code).
- Consider disambiguating the two `combat_ended` signal names during that stage.
