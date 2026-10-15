# Pure difficulty reward-plan foundation

The first implementation slice has no callers, RPC, storage writes or grants.
`difficulty_reward_plan.ts` computes XP base/bonus/total and a gear count from
explicit base/extra random draws. It cannot validate challenge evidence and is
not a settlement API. Do not pass client tier strings into a future integration.

- Easy/Normal bonus multiplier1.0, Hard1.2, Extreme1.5. Campaign tier supplies
  the base XP and base loot chance; no campaign-tier replacement or double bonus.
- XP rounded once, safe-integer bounds. Invalid tier/input/random draw fails.
- Existing base roll first, extra-item chance multiplier minus1after success.
  No probability inflation or cap saturation. No rarity/stat/ID transformations.
- Pure plan includes the owner-approved new PvE Coins base10, Hard12, Extreme15.
  No balance write or award occurs. Existing matchmaker/season_admin payouts
  are outside this PvE feature and unchanged. Replay/no-improvement eligibility
  must be enforced by the future reviewed settlement, not this pure function.

Validation:31focused cases, including deterministic midpoint grids over base
chance0/0.45/0.99/1.0and all tiers, exact equality at drop/extra boundaries,
floor/cap/rounding/overflow/invalid inputs. Fullbackend146suites4118pass1skip.
Lint/typecheck/diffcheck pass. LocalNode22.23.3; hostedCIpin20still required.

## Next reviewed contract, before any production integration

1. Authoritative start snapshot needs a session ID, player/stage binding,
   challenge configuration, modifier/formula version and lifecycle. Neither
   current client victory callback nor an analytics start event proves the
   challenge was played. A snapshot locks terms, but does not itself prove a
   valid finish. Review the evidence source and offline behavior explicitly.
2. Current gear insertion creates a random DB UUID; XP uses versioned Nakama
   storage; claim/best-of writes precede both. A ledger record written before
   an effect can strand it, and one written after can duplicate it on a crash.
   Review per-effect idempotency in the effect's own storage domain, not just a
   top-level status flag. SQL inventory and Nakama storage are not a demonstrated
   shared transaction. No migrations or recovery writes in this slice.
3. Plural gear response/client parsing must arrive before enabling two items;
   one legacy `gear_dropped` alias cannot truthfully represent the full grant.
4. Preserve existing failed claims/best-of; do not replay them to test recovery.
   Integration needs crash-point/concurrency/forged-evidence regression tests,
   not just pure math tests.

The module does not establish that higher payouts are enabled or safe to enable.
