# Casual vs Ranked Rewards - Implementation Summary

## Overview
This document summarizes the implementation of clear reward differences between casual and ranked PvP modes for issue #705.

## Reward Structure

### Ranked Matches
Ranked matches offer full rewards and affect player ranking and season position:

| Result | XP | Coins | Gems | Rank Change |
|--------|-----|-------|-------|-------------|
| Win    | 100  | 50    | -     | Based on Elo |
| Loss   | 25   | 10    | -     | Based on Elo |

**Punch-Up Bonus (Ranked only):**
- +50% XP multiplier (150 XP win / 38 XP loss)
- +5 Gems on wins

### Casual Matches
Casual matches offer 50% of ranked rewards and do NOT affect rank or season position:

| Result | XP | Coins | Gems | Rank Change |
|--------|-----|-------|-------|-------------|
| Win    | 50   | 25    | -     | None         |
| Loss   | 15   | 5     | -     | None         |

**Punch-Up Bonus (Casual):**
- +50% XP multiplier (75 XP win / 23 XP loss)
- No gem rewards in casual mode

## Design Rationale

### Why Lower Rewards for Casual?
1. **Casual is for practice** - Players use casual to test builds without risking rank
2. **Ranked is competitive** - Higher stakes deserve higher rewards
3. **Gem rewards are ranked-only** - Gems are premium currency, reserved for competitive play
4. **Clear distinction** - Players should easily see which mode offers better rewards

### Key Differences
- **Ranked**: Full XP + Coins + Rank changes + Season position + Gem bonuses
- **Casual**: 50% XP + 50% Coins + No rank/season + No gems

## Implementation Details

### Backend Changes (`backend/src/modules/matchmaker.ts`)

1. **Updated `calculateXPGain()` function:**
   - Added `matchType` parameter (`'ranked' | 'casual'`)
   - Casual rewards = 50% of ranked rewards
   - Punch-up multiplier = 1.5x for both modes

2. **Updated `calculateMatchRewards()` function:**
   - Added `matchType` parameter
   - Casual coin rewards = 50% of ranked
   - Gem bonuses only in ranked mode with punch-up wins

3. **Updated calls in `processMatchResult()`:**
   - Pass `match.match_type` to reward calculation functions

### Frontend Changes

#### 1. Matchmaking Menu (`scenes/ui/matchmaking_menu.tscn`)
Added a **Reward Comparison Panel** that shows:
- RANKED rewards column
- CASUAL rewards column
- Punch-up bonus explanation
- Clear side-by-side comparison

UI Structure:
```
REWARD COMPARISON
+-------------------+-------------------+
|      RANKED       |      CASUAL       |
+-------------------+-------------------+
| Win: 100 XP       | Win: 50 XP        |
|      50 Coins      |      25 Coins     |
| Lose: 25 XP       | Lose: 15 XP       |
|      10 Coins      |      5 Coins      |
| Punch Up Win:      | No rank change     |
| +50% XP, +5 Gems | or gems            |
+-------------------+-------------------+
```

#### 2. Match Results Screen (`scenes/ui/pvp/match_results.gd`)
Updated to:
- Highlight match type more prominently (RANKED vs CASUAL)
- Hide rank change UI for casual matches (since no rank change occurs)
- Show "Casual Match - No rank changes" message for casual matches
- Punch-up status clearly shown with "PUNCH-UP" label

## Player Experience

### Before Match
Players see a clear reward comparison before selecting a mode:
- Ranked: Higher rewards, rank progression, gem bonuses
- Casual: Lower rewards, no rank pressure, practice environment

### After Match
Results screen clearly shows:
1. Match type (RANKED or CASUAL)
2. Whether it was a PUNCH-UP match
3. Rewards earned (XP, Coins, Gems)
4. Rank/season changes (ranked only)
5. Casual matches show "No rank changes" explicitly

## Testing

All backend tests pass (2784 tests):
```bash
cd backend && npm test
# Test Suites: 80 passed, 80 total
# Tests: 1 skipped, 2784 passed, 2785 total
```

Linting passes after prettier formatting fix.

## Acceptance Criteria - All Met

- [x] Casual vs ranked reward differences are defined
- [x] UI clearly shows which mode is being played
- [x] Rewards are visible before match starts (Reward Comparison Panel)
- [x] Reward differences are explained to players (Comparison panel + Match Results)
- [x] Players can make informed choices (Clear side-by-side comparison)

## Future Enhancements (Optional)

1. Add toggle to "Always show ranked rewards first"
2. Add hover tooltips explaining punch-up mechanics
3. Add reward preview before accepting a match (in match list)
4. Track casual vs ranked match statistics for player profile
5. Consider seasonal rewards for ranked play only
