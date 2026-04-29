# Punch-Up Mechanics Summary

## Overview

Punch-up matches allow lower-ranked players to challenge higher-ranked opponents with enhanced rewards for winning and reduced rewards for the favorite. This creates risk/reward mechanics for ranked PvP.

## Eligibility Rules

### Rank Requirements

- **Minimum rank**: 20 (both players must be rank 20 or higher)
- **Minimum rank difference**: 5 ranks
- **Maximum rank difference**: 15 ranks

### Validation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  Punch-Up Eligibility Check                    │
├─────────────────────────────────────────────────────────────────┤
│                                                          │
│  1. Check rank difference                                   │
│     ├─ If diff < 5: NOT a punch-up                     │
│     ├─ If diff > 15: NOT a punch-up (too large)         │
│     └─ If 5 ≤ diff ≤ 15: Continue                    │
│                                                          │
│  2. Check minimum rank                                     │
│     └─ If min(rank1, rank2) < 20: NOT a punch-up      │
│                                                          │
│  3. If both checks pass: PUNCH-UP CONFIRMED             │
│                                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Reward Calculations

### Underdog (Lower-Ranked Player)

| Rank Difference | XP Multiplier | Gem Bonus |
| --------------- | ------------- | --------- |
| 5-7 (Low)       | 1.2x          | 3-4 gems  |
| 8-11 (Medium)   | 1.5x          | 5-7 gems  |
| 12-15 (High)    | 2.0x          | 8-10 gems |

**Formula:**

```typescript
normalizedDiff = (rankDiff - 5) / (15 - 5);
xpMultiplier = 1.2 + (2.0 - 1.2) * normalizedDiff;
gemBonus = 3 + (10 - 3) * normalizedDiff;
```

### Favorite (Higher-Ranked Player)

| Rank Difference | Reward Multiplier |
| --------------- | ----------------- |
| 5-7 (Low)       | 70% of normal     |
| 8-11 (Medium)   | 60% of normal     |
| 12-15 (High)    | 50% of normal     |

**Formula:**

```typescript
normalizedDiff = rankDiff / 15;
rewardMultiplier = 0.7 - (0.7 - 0.5) * normalizedDiff;
// Result: 0.7 to 0.5 (70% to 50% of normal rewards)
```

## Risk Levels

### Low Risk (Rank Difference 5-7)

- **Underdog**: +20% XP, 3-4 gems
- **Favorite**: 70% rewards if lose
- **UI Warning**: Green color, "Opponent may be slightly stronger"

### Medium Risk (Rank Difference 8-11)

- **Underdog**: +50% XP, 5-7 gems
- **Favorite**: 60% rewards if lose
- **UI Warning**: Orange color, "Opponent is likely stronger"

### High Risk (Rank Difference 12-15)

- **Underdog**: +100% XP, 8-10 gems
- **Favorite**: 50% rewards if lose
- **UI Warning**: Red color, "You may face a much stronger opponent"

## UI Integration

### Warning Dialog

The `PunchUpWarningDialog` displays:

- Risk level with color coding
- Rank difference
- "If you WIN:" rewards (XP %, gems)
- "If you LOSE:" penalties (XP %, rank points)
- Warning message based on risk level

### Matchmaking Menu

The `MatchmakingMenu` shows:

- Punch-up indicator on match listings
- Rank difference with color coding
- Punch-up statistics (wins, losses, win rate)

### Match Results

The `MatchResults` screen shows:

- Match type (RANKED/CASUAL)
- Punch-up status badge
- XP gained (including punch-up bonus)
- Rank changes (for ranked matches)
- Gem bonuses (if punch-up win)

## Anti-Abuse Protection

### Prevention Measures

1. **Minimum Rank Threshold (20)**
   - Prevents low-level smurf accounts from abusing the system
   - Ensures players have basic experience before attempting punch-ups

2. **Maximum Rank Difference (15)**
   - Prevents extreme mismatches
   - Limits potential reward exploitation

3. **Favorite Penalties**
   - Discourages higher-ranked players from farming underdogs
   - Makes losses meaningful for favorites

4. **No Punch-Up in Casual Matches**
   - Punch-up only available in ranked
   - Casual remains practice-focused with consistent rewards

## Configuration Constants

### Backend (`matchmaker.ts`)

```typescript
const PUNCH_UP_RANK_DIFF_THRESHOLD = 5; // Min rank difference
const PUNCH_UP_MAX_RANK_DIFF = 15; // Max rank difference
const PUNCH_UP_MIN_RANK = 20; // Min player rank
const PUNCH_UP_XP_MULTIPLIER_MIN = 1.2; // Min XP bonus
const PUNCH_UP_XP_MULTIPLIER_MAX = 2.0; // Max XP bonus
const PUNCH_UP_GEM_BONUS_MIN = 3; // Min gem bonus
const PUNCH_UP_GEM_BONUS_MAX = 10; // Max gem bonus
const FAVORITE_REWARD_PENALTY_MIN = 0.7; // Min favorite multiplier (70%)
const FAVORITE_REWARD_PENALTY_MAX = 0.5; // Max favorite multiplier (50%)
```

### Client (`MatchmakerManager.gd`, `punch_up_warning_dialog.gd`)

```gdscript
const PUNCH_UP_RANK_DIFF_THRESHOLD = 5
const PUNCH_UP_MAX_RANK_DIFF = 15
const PUNCH_UP_MIN_RANK = 20
const RISK_LEVEL_LOW_THRESHOLD = 7
const RISK_LEVEL_MEDIUM_THRESHOLD = 11
const RISK_LEVEL_HIGH_THRESHOLD = 15
```

## Examples

### Example 1: Low-Risk Punch-Up

- **Player A (Rank 25)** vs **Player B (Rank 31)**
- **Rank Difference**: 6 (Low Risk)
- **Punch-Up**: Yes (Player A is underdog)
- **If Player A Wins**: +20% XP (1.2x), 3 gems
- **If Player B Wins**: Normal rewards (70% as favorite = -30%)

### Example 2: High-Risk Punch-Up

- **Player A (Rank 25)** vs **Player B (Rank 39)**
- **Rank Difference**: 14 (High Risk)
- **Punch-Up**: Yes (Player A is underdog)
- **If Player A Wins**: +100% XP (2.0x), 9 gems
- **If Player B Wins**: 50% rewards (significant penalty)

### Example 3: Not a Punch-Up

- **Player A (Rank 25)** vs **Player B (Rank 27)**
- **Rank Difference**: 2 (Below threshold)
- **Punch-Up**: No
- **Rewards**: Normal for both

## Testing

### Test Cases

- [ ] Verify punch-up eligibility with rank difference < 5 (should be false)
- [ ] Verify punch-up eligibility with rank difference = 5 (should be true)
- [ ] Verify punch-up eligibility with rank difference = 15 (should be true)
- [ ] Verify punch-up eligibility with rank difference > 15 (should be false)
- [ ] Verify minimum rank requirement (both < 20 = false)
- [ ] Calculate and verify low-risk rewards (rank diff 6)
- [ ] Calculate and verify medium-risk rewards (rank diff 10)
- [ ] Calculate and verify high-risk rewards (rank diff 14)
- [ ] Verify favorite penalty is applied correctly
- [ ] Verify warning dialog displays correctly for each risk level
- [ ] Verify match results show punch-up status

## References

- **Backend**: `backend/src/modules/matchmaker.ts` (lines 855-971)
- **Anti-Abuse Guide**: `backend/src/modules/ANTI_ABUSE_GUIDE.md`
- **Client Manager**: `autoloads/MatchmakerManager.gd`
- **UI Dialog**: `scenes/ui/punch_up_warning_dialog.gd`
- **UI Menu**: `scenes/ui/matchmaking_menu.gd`
