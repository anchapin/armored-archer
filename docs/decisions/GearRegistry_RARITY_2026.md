# GearRegistry Rarity Vocabulary Decision — 2026-08-17

**Status:** Accepted
**Issue:** [#900](https://github.com/anchapin/armored-archer/issues/900)
**Deciders:** Implementation agent (option A) + product framing from issue body

## Context

`autoloads/GearRegistry.gd:62–74` registers five base items (`helm_iron`,
`armor_chain`, `bow_composite`, `arrow_iron`, `amulet_power`) with rarity
`"uncommon"`. CONTEXT.md defines **Gear Rarity** as a strict four-tier
vocabulary (`common`, `rare`, `epic`, `legendary`) and lists `uncommon` under
`_Avoid_` as *"orphaned fifth tier referenced by balance code; dead — DB enum
has no such value"*. PR #878 (#867) purged `uncommon` from the balance code
but missed `GearRegistry` and the loadout color dictionaries.

`CONTEXT.md` also defines **Rank Tier** as a season-reward band that
legitimately reuses the rarity words (`legendary`/`epic`/`rare`/`uncommon`/
`common`) for leaderboard placement payouts — this is the sanctioned context
where `uncommon` survives and must NOT be renamed.

## Decision: Option A — Remap the five base items into the 4-tier vocabulary

Map `"uncommon"` → `"rare"` for all five affected items. No new tier concept is
introduced.

## Rationale

1. **CONTEXT.md already canonicalised the 4-tier set.** The vocabulary is
   enforced by `autoloads/const.gd:GEAR_RARITIES`, the `gear_rarity` PostgreSQL
   enum, `scripts/gear_enums.gd:GearRarity` (with `EPIC` already present),
   `GearBalanceCalculator.RARITY_MULTIPLIERS`, `ArcherDesignTokens.COOLOR_RARITY_*`,
   `WeaponBalanceManager.gear_rarity_to_string`, `GearManager`'s epic handling,
   and `BossManager`'s epic loot rolls. Adding a parallel `base_item_tier`
   vocabulary (Option B) would require propagating a new concept through every
   one of those sites — a far heavier change than the issue's framing warrants.

2. **The five "uncommon" entries are gear, not rank tiers.** They live in
   `GearRegistry._initialize_base_gear`, are equipped by loadout UI, and feed
   into `GearBalanceCalculator` via `rarity` — none of those callers know
   about season ranks. Reusing the `uncommon` token here was a clear drift
   from the rank-tier vocabulary, not a deliberate distinct concept.

3. **`rare` is the natural target tier.** All five items carry modestly-tuned
   stats that sit above the `"common"` baseline (e.g. `helm_basic`: def 0 /
   hp 5 → `helm_iron`: def 5 / hp 10) and well below the `"rare"`/`"legendary"`
   top tier items (`armor_plate`: def 30 / hp 25; `helm_dragon`: atk 5 /
   def 10 / hp 20). Folding them into `"rare"` keeps the existing color
   palette (white / blue / purple / orange / gold) and the existing stat
   separation intact — players still see the stats; rarity just stops
   advertising a tier that does not exist in the canonical vocabulary.

4. **Why not add an `epic` row instead?** Items labelled `"rare"` today
   (`armor_plate`, `bow_crossbow`) are stronger than the five being remapped.
   Promoting them to `"epic"` would re-open a separate decision about whether
   the gap to `"legendary"` is wide enough. Out of scope for #900; flagging
   here as a follow-up if balance wants to fill the `epic` slot for armor
   and bows.

5. **Hard constraints respected.** DB enum unchanged. `rank_tier` vocabulary
   untouched (season tests still legitimately assert `"uncommon"` for rank
   250 etc.). `CONTEXT.md` terminology respected.

## Consequences

- 5 base items display with the existing `"rare"` colour (blue) in loadout
  UI, alongside `armor_plate` and `bow_crossbow`. Acceptable: rarity
  communicates tier-of-power, not unique colour identity.
- `loadout.gd` (4-key dict) gains the missing `"epic"` entry while dropping
  `"uncommon"`. Latent bug fix — previously `epic` gear would have fallen
  through to `Color.WHITE`.
- `loadout_slot.gd` (5-key dict including `epic`) drops `"uncommon"`.
- `RA_TERTIARY` in `ArcherDesignTokens.gd` keeps its green semantic (used by
  health bars and ambient glow) — only the legacy comment is updated to drop
  the `uncommon` reference.
- Two legacy `test/*.gd` fixtures and one `test/suites/gear/*.gd` fixture
  assert the renamed values; updated in lockstep.

## Follow-ups (filed separately if anyone cares)

- Consider adding an `epic`-tier item for armor and bow slots so the
  progression reads common → rare → epic → legendary.
- Audit other legacy sites where tier tokens may have drifted (none found
  at time of decision).