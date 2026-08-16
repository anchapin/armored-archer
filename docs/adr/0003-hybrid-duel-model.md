# Duels are hybrid: async matchmaking, live short-session combat

Status: accepted

Every document described correspondence-style async duels (24h turns, 7-day matches — `docs/ASYNC_DUEL_LIFECYCLE.md`), but the code ships the opposite: asynchronous pairing (24h acceptance window) followed by a *live* duel with 5-minute turn timers, ~2-minute inactivity checks, and timeout forfeits. We ratified the code's model: "asynchronous matchmaking + live short-session turn-based duels," chosen because it preserves the PRD §7 rationale (discrete turn actions, no realtime simulation/prediction) while matching the shipped client (live combat UI, reconnect RPC).

## Consequences

- `ASYNC_DUEL_LIFECYCLE.md` must be rewritten to the real state machine; marketing/store copy saying "async PvP" must say "async matchmaking."
- Forfeit rules are mobile-hardened: turn timeouts double as reconnect grace (2 consecutive timeouts ≈ 10 min); the separate harsher `MATCH_INACTIVE_TIMEOUT_MS` (2 min) is redundant with turn timers and should be removed or repurposed.
