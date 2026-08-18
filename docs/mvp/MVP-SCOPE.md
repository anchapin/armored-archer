# MVP v1.0.0 Scope — Archived

> **Status:** Frozen 2026-04-15 (Sprint 0, issue #675). **Superseded** — every feature listed below shipped before v4.0.0. See [`../README.md`](../README.md) "Current Status" section and [`.planning/ROADMAP.md`](../.planning/ROADMAP.md) for the live roadmap.

---

## MVP v1.0.0 Scope (Frozen)

The MVP scope was frozen around four core features. See [`.planning/MVP-SCOPE.md`](../.planning/MVP-SCOPE.md) for the complete original document (Definition of Done, value proposition, in-scope/out-of-scope tables).

| Feature | Description | Status (Frozen) | Status (Actual) |
|---------|-------------|-----------------|-----------------|
| PvE Progression | Auto-shooter combat with stage-based campaign | In Progress | **Shipped** (v3.4.0 Tactical Gameplay & PvE Campaign) |
| Async PvP | Turn-based asynchronous matches against other players | Planned | **Shipped** as hybrid model — async matchmaking + live short-session combat ([ADR-0003](../adr/0003-hybrid-duel-model.md), [ADR-0002](../adr/0002-server-declared-match-settlement.md)) |
| Seasonal Rank | Leaderboards with seasonal reset and rewards | Planned | **Shipped** (v4.0.0 Phase 4 — PvP Balance & Ranking) |
| Cosmetic Monetization | Non-pay-to-win cosmetic items only | Planned | **Shipped** (RevenueCat; base gear is gameplay-earned, skins are visual-only per [ADR-0001](../adr/0001-prd-living-promises-governance.md) ratified constraints) |

**Out of Scope for MVP:** Subscriptions, push notifications, guilds/clans, real-time PvP, trading, player reporting, analytics dashboard. See [`.planning/MVP-SCOPE.md`](../.planning/MVP-SCOPE.md#what-mvp-excludes-out-of-scope) for the original rationale and "When to Add" notes.

---

## Related Decisions

- [ADR-0001 — PRD is a living promises document, not frozen MVP scope](../adr/0001-prd-living-promises-governance.md)
- [ADR-0002 — Match settlement is server-declared only](../adr/0002-server-declared-match-settlement.md)
- [ADR-0003 — Duels are hybrid: async matchmaking, live short-session combat](../adr/0003-hybrid-duel-model.md)
- [ADR-0004 — Decommission legacy correspondence duel RPCs](../adr/0004-decommission-legacy-duel-rpcs.md)