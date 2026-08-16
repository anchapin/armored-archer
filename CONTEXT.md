# Armored Archer

The domain language of a server-authoritative mobile archery ARPG where PvE grinding funds PvP build-crafting and cosmetic-only monetization keeps the competitive environment fair.

## Language

### Governance

**PRD**:
The product promises document (`docs/armored-archer_prd.md`); the source of truth for player-facing promises, amendable only through the ratification process.
_Avoid_: spec, requirements doc

**Ratification**:
The act of admitting a code-invented player-facing concept into the PRD, or deciding a conflict in favor of the PRD and filing a code-fix task.
_Avoid_: backfill, documentation fix

### Economy

**Coins**:
The earnable soft currency paid by gameplay; earned from matches and season tiers. Sink deferred to Season 1 mid-season (ship reroll vendor); never purchasable.
_Avoid_: gold (legacy storage field name), money

**Gems**:
The premium currency, bought with real money via RevenueCat IAP, with small earnable amounts from punch-up wins and season tiers; buys Cosmetic Skins and nothing with stats.
_Avoid_: premium coins

**Cosmetic Skin**:
A visual-only override applied over Base Gear; carries no stats or modifiers.
_Avoid_: skin (ambiguous with base gear appearance), transmog item

**Base Gear**:
The stat-bearing equipment (Helm/Armor/Bow/Arrow/Amulet) earned strictly by playing.
_Avoid_: gear (when contrasted with skins)

**Gear Rarity**:
The four-tier earned-only classification of Base Gear — Common, Rare, Epic, Legendary — scaling stat power and modifier quality. Never purchasable; Cosmetic Skins carry no rarity.
_Avoid_: uncommon (orphaned fifth tier referenced by balance code; dead — DB enum has no such value)

**Rank Tier**:
A season-reward band that reuses rarity words (legendary/epic/rare/uncommon/common) for leaderboard placement payouts. Distinct concept from **Gear Rarity** — a rank tier must never imply gear-drop rates.
_Avoid_: rarity tier (conflates the two vocabularies)

### Difficulty

**Dynamic Difficulty**:
A PvE-only, reward-neutral rubber-banding system that adjusts challenge within ±20% based on win/lose streaks (3-game threshold). Ratified with four constraints: PvE-only, reward-neutral, bounded, disclosed.
_Avoid_: adaptive difficulty, difficulty scaling (that's `difficulty_scaling.ts`, a different module)

**Difficulty Modifier**:
The per-player scalar in [-0.2, +0.2] applied to PvE combat pacing; never to loot, XP, or drop rates.

### Authority

**Match Settlement**:
The single server-side act of finalizing a duel's winner, Elo/XP/reward payouts, and records. Only the server may declare a winner (health-zero, forfeit, or timeout); client calls may trigger but never assert outcomes.
_Avoid_: match completion (implies the client completes anything)

**Server Authority**:
The principle that all combat results, loot rolls, and match outcomes are computed from server-stored stats. Client-reported values are, at most, sync hints.
_Avoid_: server-side validation (that's the mechanism, not the principle)

### Duels

**Duel**:
A live, turn-based combat session between two players with 5-minute turn timers and reconnect grace.
_Avoid_: async match (that's the matchmaking), correspondence game

**Duel Matchmaking**:
The asynchronous pairing phase — challenge or queue, with a 24-hour acceptance window — that precedes a **Duel**.
_Avoid_: match (when referring to the pairing phase)

**Forfeit**:
The server-declared loss from consecutive turn timeouts or abandonment; app interruptions fall within the reconnect grace (2 timeout window ≈ 10 minutes).
_Avoid_: disconnect loss (a disconnect alone never settles a match)

### Seasons

**Season**:
A 4-week ranked ladder cycle ending in tiered rewards and a soft reset into the next season.
_Avoid_: ladder (the ladder is the ranking inside a season)

**Soft Reset**:
The tiered Elo seeding at season start based on final rank (top-10 → 1300 … rest → 1000).
_Avoid_: reset (ambiguous with Rank Decay)

**Rank Decay**:
Inactivity erosion of Elo (−20/day after 7 idle days, floored at 800).

**Prestige Tier**:
A permanent cosmetic standing (bronze/silver/gold/diamond) earned by repeated top-100 season finishes.
_Avoid_: rank tier (that's the single-season reward band)

**Season Rewards**:
Tiered payouts of Coins + Gems + cosmetic title/aura by final rank. No XP component (PRD's "massive XP bursts" superseded).

### PvP

**Power Rating**:
A player's build-strength score derived from level and allocated stats (`level×10 + (atk+def+dodge+crit)/4`); gates punch-up eligibility and matchmaking brackets.
_Avoid_: rank (retired as standalone — collides with Elo and standing), combat rating

**Ladder Rating**:
The Elo score (seeded 1000) wagered in ranked duels and ranked on the seasonal leaderboard.
_Avoid_: rank, Elo (when player-facing), MMR

**Standing**:
A player's leaderboard position (1st, 2nd, …) within a season; determines Rank Tier and season rewards.
_Avoid_: rank (when meaning position)

**Punch-Up**:
A ranked duel wager against a significantly more powerful opponent (Power Rating ≥ 20, gap 5–15); amplified Ladder Rating upside on win, amplified downside on loss. Progression (XP/levels) is never wagered.
_Avoid_: upset challenge

**Punch-Up Loss**:
The underdog's consequence for losing a **Punch-Up**: amplified Ladder Rating deduction (2× K-factor), reduced XP grant — never XP subtraction, never level loss.

**Casual PvP**:
Practice duels with 50% rewards and no rank or season effect; rewards are reduced, never negative, and the punch-up wager is unavailable.
_Avoid_: unranked (when precision needed — "unranked" implies no Elo effect, "casual" defines the full reward posture)

## Relationships

- A **Cosmetic Skin** renders over exactly one **Base Gear** slot's appearance; **Base Gear** carries all stats
- **Gems** purchase **Cosmetic Skins** only; **Coins** are earned by gameplay and never purchased
- **Dynamic Difficulty** adjusts PvE challenge; it never touches loot, XP, drop rates, or any PvP system
- **Punch-Up** exists only inside ranked duels; **Casual PvP** never exposes the punch-up wager
- **Punch-Up** eligibility keys on **Power Rating**; the wager itself is **Ladder Rating** — build strength gates who you may challenge, Elo is what you stake
- **Duel Matchmaking** precedes exactly one **Duel**; a **Duel** ends only in server-declared **Match Settlement**
- A **Season** ends in **Season Rewards** by **Standing** and a **Soft Reset** into the next **Season**

## Example dialogue

> **Dev:** "If we put this sword in the gem store, do we need to re-balance its damage?"
> **Domain expert:** "No. Anything bought with **Gems** is a **Cosmetic Skin** — it renders over the **Base Gear** you already earned. The stats never leave the **Base Gear**."

> **Dev:** "Losing streak has him at the -20% **Difficulty Modifier** — should we bump his drop rate too so he doesn't quit?"
> **Domain expert:** "No. **Dynamic Difficulty** is reward-neutral by ratification. Pacing only, never loot, never XP."

## Flagged ambiguities

- "rank" was used for three different concepts — resolved: **Power Rating** (build strength), **Ladder Rating** (Elo), **Standing** (leaderboard position). "Rank" retired as a standalone term; punch-up eligibility keys on Power Rating, not Standing. Client UI label cleanup + `applyRankDecay`-on-derived-power investigation filed as tasks.
- "coins" appear throughout the codebase and reward docs but are absent from the PRD — **resolved**: ratified as Coins, the earnable soft currency; "gold" is a legacy storage-field alias to be eliminated. Ledger split (wallet vs `player_currency` storage) confirmed as a P1 bug; coin sink deferred to Season 1 mid-season.
- "severe XP penalties" on punch-up loss (PRD) vs +38 XP granted on loss (code) — **resolved**: severity lands on rank only (amplified Elo loss), never XP. PRD amendment + Elo change + UI fix queued as tasks.
- "no risk to rank or XP" for casual PvP (PRD) vs 50% rewards (code) — **resolved**: "no risk" means no deductions and no rank/season exposure; casual pays reduced-but-positive rewards. Casual punch-up bonus killed (stake-free wager contradicts the Punch-Up definition). PRD amendment queued.
