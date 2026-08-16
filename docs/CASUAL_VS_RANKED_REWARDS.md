# Casual vs Ranked Rewards - Implementation Summary

## Overview

This document summarizes the reward differences between casual and ranked PvP
modes (issue #705) and the casual punch-up purge (issue #872).

**Ratified rule (see `CONTEXT.md`): Casual PvP never exposes the Punch-Up
wager.** A stake-free wager violates the Punch-Up definition. Casual is
reduced-but-never-negative rewards, with no rank or season effect, and no
punch-up of any kind.

## Reward Structure

All reward values are server-authoritative: combat results, punch-up status,
and rewards are computed server-side from stored stats. Clients only ever
receive the settlement outcome.

### Ranked Matches

Ranked matches offer full rewards and affect Ladder Rating (Elo) and season
position:

| Result | XP | Coins | Gems | Ladder Rating Change |
|--------|-----|-------|-------|----------------------|
| Win | 100 | 50 | - | Elo-based |
| Loss | 25 | 10 | - | Elo-based |

**Punch-Up (ranked only):** a ranked duel wager against a significantly more
powerful opponent (Power Rating gap 5-15, both players Power Rating 20+).
Punch-up status is derived server-side from match ranks; the wager itself is
Ladder Rating. Punch-up shaping applies to ranked matches only:

- **Underdog win:** scaled XP multiplier (1.2x-2.0x by Power Rating gap) plus
  a Gems bonus (3-10) — Gems are premium currency earned only through
  punch-up wins and season tiers.
- **Underdog loss (issue #864):** the wager consequence is the amplified
  Ladder Rating deduction (2x K-factor); the XP grant is reduced but strictly
  positive — progression is never wagered, never negative, never zero.
- **Favorite:** reduced rewards (50-70% of normal) scaled by Power Rating gap.

### Casual Matches

Casual matches offer 50% of ranked rewards and do NOT affect Ladder Rating or
season position:

| Result | XP | Coins | Gems | Ladder Rating Change |
|--------|-----|-------|-------|----------------------|
| Win | 50 | 25 | - | None |
| Loss | 15 | 5 | - | None |

**Casual is punch-up-free.** No punch-up XP multiplier, no favorite penalty,
no punch-up gem bonus, and no amplified Ladder Rating consequence is applied
in casual mode — regardless of the Power Rating gap between the players or
any punch-up flag recorded on the match. There is no casual punch-up bonus of
any kind; the historical "+50% XP casual punch-up bonus" documented here
earlier never had a ratified basis and has been purged (issue #872).

## Design Rationale

### Why Lower Rewards for Casual?

1. **Casual is for practice** - Players use casual to test builds without
   risking Ladder Rating
2. **Ranked is competitive** - Higher stakes deserve higher rewards
3. **Gem rewards are ranked-only** - Gems are premium currency, reserved for
   competitive play
4. **Clear distinction** - Players should easily see which mode offers better
   rewards
5. **Punch-Up is a wager** - The punch-up stake only has meaning when
   Ladder Rating is on the line; a stake-free casual "punch-up" would
   contradict the Punch-Up definition

### Key Differences

- **Ranked**: Full XP + Coins + Ladder Rating changes + Season position +
  Punch-Up shaping (underdog multipliers, gem bonuses, amplified consequences)
- **Casual**: 50% XP + 50% Coins + No Ladder Rating/season effect + No gems +
  No punch-up exposure

## Implementation Details

### Backend (`backend/src/modules/matchmaker.ts`)

1. **`calculateXPGain()`:**
   - Takes `matchType` (`'ranked' | 'casual'`); casual rewards = 50% of ranked
   - Punch-up XP shaping (underdog multiplier, favorite penalty, reduced
     punch-up-loss grant) applies **only when `matchType === 'ranked'`**
     (issue #872)

2. **`calculateMatchRewards()`:**
   - Casual coin rewards = 50% of ranked
   - Favorite penalty applies to ranked punch-up matches only
   - Gem bonuses only in ranked mode with punch-up underdog wins

3. **Settlement (`processMatchResult()`):**
   - Elo/Ladder Rating updates and K-factor application (including the 2x
     punch-up-loss K-factor) run only for `match_type === 'ranked'`
   - Casual settlement reports `rank_change: 0` for both sides

4. **Guard test (`backend/src/modules/__tests__/casual_rewards_guard.test.ts`):**
   - Settles punch-up-flagged casual matches through `rpcCompleteMatch` and
     asserts the composed rewards contain no punch-up multiplier, no favorite
     penalty, and no gem bonus
   - Asserts casual XP/Coins are strictly below the ranked baseline yet
     always strictly positive
   - Asserts casual settlement never applies Elo updates or K-factors

### Frontend

#### 1. Matchmaking Menu (`scenes/ui/matchmaking_menu.tscn`)

A **Reward Comparison Panel** shows RANKED and CASUAL columns side by side:
ranked advertises its punch-up upside (underdog multipliers and gem bonuses),
while the casual column advertises no rank change and no gems — punch-up is a
ranked-only concept.

#### 2. Match Results Screen (`scenes/ui/pvp/match_results.gd`)

- Highlights match type (RANKED or CASUAL)
- Hides rank change UI for casual matches (no rank change occurs)
- Shows "Casual Match - No rank changes" for casual matches
- Punch-up status ("PUNCH-UP" label) is meaningful for ranked matches only

## Player Experience

### Before Match

Players see a clear reward comparison before selecting a mode:

- Ranked: Higher rewards, Ladder Rating progression, punch-up upside with
  amplified downside
- Casual: Lower rewards, no rank pressure, practice environment, no punch-up

### After Match

Results screen clearly shows:

1. Match type (RANKED or CASUAL)
2. Whether it was a PUNCH-UP match (ranked only)
3. Rewards earned (XP, Coins, Gems)
4. Ladder Rating/season changes (ranked only)
5. Casual matches show "No rank changes" explicitly

## Testing

- Backend unit tests: `cd backend && npm test` (includes
  `src/modules/__tests__/casual_rewards_guard.test.ts`, the issue #872 guard
  asserting casual rewards are punch-up-free, reduced-but-never-negative, and
  Elo-free)
- Schema tests: `cd backend && npm run test:schema`

## Acceptance Criteria - All Met

- [x] Casual vs ranked reward differences are defined
- [x] UI clearly shows which mode is being played
- [x] Rewards are visible before match starts (Reward Comparison Panel)
- [x] Reward differences are explained to players (Comparison panel + Match Results)
- [x] Players can make informed choices (Clear side-by-side comparison)
- [x] Docs describe casual as punch-up-free (issue #872)
- [x] Guard test: casual match rewards contain no punch-up multiplier or gem
      bonus (issue #872)

## Future Enhancements (Optional)

1. Add toggle to "Always show ranked rewards first"
2. Add hover tooltips explaining punch-up mechanics (ranked concept)
3. Add reward preview before accepting a match (in match list)
4. Track casual vs ranked match statistics for player profile
5. Consider seasonal rewards for ranked play only
