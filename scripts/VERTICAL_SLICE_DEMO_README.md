# Vertical Slice Demo - Sprint 2

This document describes how to run and verify the Vertical Slice Demo for Sprint 2 of the Armored Archer project.

## Overview

The Vertical Slice Demo demonstrates the complete core loop of the game:

```
Login → PvE Combat → Gear Reward → Equip Gear → PvP Match → Results → Menu
```

This validates that all systems integrate correctly for the vertical slice.

## Prerequisites

1. **Nakama server running**: Ensure the backend is running with `make backend-start`
2. **Godot 4.6.1 or higher**: Open the project in Godot Editor
3. **Autoloads registered**: Ensure all autoloads are registered in `project.godot`

## How to Run the Demo

### Option 1: Through Godot Editor (Recommended)

1. Open the project in Godot Editor
2. Press F5 to run the project
3. In the Godot Console, execute:
   ```
   var demo = load("res://scripts/vertical_slice_demo.gd").new()
   demo.start_demo()
   ```

### Option 2: Automated Script

The demo script can be attached to any autoload or main scene to run automatically on startup.

## What the Demo Does

The demo walks through these steps:

| Step | Description | Validates |
|-------|-------------|------------|
| 1 | Player login | Nakama connection, player stats initialized |
| 2 | Campaign map navigation | Campaign accessible, player position shown |
| 3 | PvE encounter start | Encounter loaded, combat system ready |
| 4 | PvE encounter complete (Victory) | XP gained, gold gained, combat log |
| 5 | Gear reward view | Gear drops displayed correctly |
| 6 | Gear equip | Stats updated with gear bonuses |
| 7 | PvP menu open | Season info loaded, rank displayed |
| 8 | PvP match create | Matchmaker RPC called, match created |
| 9 | PvP match accept | Match accepted, combat scene loaded |
| 10 | PvP combat (server-authoritative) | Turn-based combat, gear bonuses applied |
| 11 | PvP combat complete | Winner determined, RPC called |
| 12 | Match results | XP, rank, season position displayed |
| 13 | Menu return | State cleared, ready for next action |

## Expected Output

When the demo runs successfully, you should see:

```
============================================================
ARMORED ARCHER - VERTICAL SLICE DEMO
============================================================
This automated demo walks through the complete core loop:
  1. Login
  2. Navigate to Campaign Map
  3. Start PvE Encounter
  4. Complete PvE Battle (Win)
  5. View Gear Reward
  6. Equip New Gear
  7. Navigate to PvP Menu
  8. Create Ranked Match
  9. Simulate PvP Combat (Win)
  10. View Match Results
  11. Return to Main Menu
============================================================

Starting Vertical Slice Demo...

[1/11] LOGIN - Simulating player login...
  - Player stats initialized: Level 5, 1250 XP
  - Connected to Nakama server
  ✓ Login successful

[2/11] CAMPAIGN MAP - Selecting encounter...
  - Campaign map loaded
  - Player position: Level 5
  ✓ Campaign accessible

[... steps 3-13 ...]

============================================================
VERTICAL SLICE DEMO COMPLETE
============================================================

Summary:
  ✓ All 11 steps completed successfully
  ✓ No errors encountered
  ✓ Core loop demonstrated:
    - Player login works
    - PvE combat flow works
    - Gear reward and equip works
    - PvP matchmaking works
    - Server-authoritative combat works
    - Match results display works
    - Progression updates work
    - State transition works

The vertical slice is ready for testing!
============================================================
```

## Verification Checklist

After running the demo, verify:

### Client-Side

- [ ] `MatchTransitionManager` stores state correctly
- [ ] `MatchmakerManager` emits `match_completed` signal
- [ ] `MatchResults` screen shows XP gained
- [ ] `MatchResults` screen shows rank change
- [ ] `MatchResults` screen shows season position
- [ ] PvP combat scene shows health bars
- [ ] PvP combat scene shows turn indicator
- [ ] `CombatManager` correctly switches turns
- [ ] `SeasonManager` loads season info

### Server-Side

- [ ] `create_match` RPC returns match with ID
- [ ] `accept_match` RPC returns active match
- [ ] `submit_combat_action` RPC returns hit/miss result
- [ ] `complete_match` RPC returns ELO changes
- [ ] `get_player_rank` RPC returns current rank
- [ ] `get_season_info` RPC returns season data

### Integration

- [ ] PvE → PvP transition clears previous state
- [ ] Gear bonuses are applied in PvP combat calculations
- [ ] XP is gained after both PvE and PvP
- [ ] Rank updates after PvP matches
- [ ] Match results are stored for history

## Troubleshooting

### Demo won't start

1. **Check autoloads**: Verify `MatchTransitionManager` is added to `project.godot`
2. **Check network**: Ensure Nakama server is running
3. **Check scene paths**: Verify all scene files exist at expected paths

### Match results don't show

1. **Check signal connection**: Verify `match_completed` signal is connected
2. **Check response format**: Verify backend returns correct response structure
3. **Check node references**: Verify all `@onready` variables find their nodes

### PvP match won't start

1. **Check user ID**: Verify `NetworkManager.user_id` is set
2. **Check match ID**: Verify current_match has valid match_id
3. **Check connection**: Verify network is connected

## Files Created/Modified for Sprint 2

### New Files:
- `autoloads/MatchTransitionManager.gd` - PvE → PvP state transition
- `scenes/ui/pvp/match_results.tscn` - Match results UI scene
- `scenes/ui/pvp/match_results.gd` - Match results controller
- `scripts/vertical_slice_demo.gd` - Automated demo script
- `scripts/VERTICAL_SLICE_DEMO_README.md` - This documentation

### Modified Files:
- `project.godot` - Added `MatchTransitionManager` autoload
- `scenes/ui/combat_menu.gd` - Updated to show match results on PvP end

## Success Criteria

The vertical slice is complete when:

- [ ] Demo runs through all 11 steps without errors
- [ ] XP is gained after both PvE and PvP matches
- [ ] Rank changes correctly with ELO calculation
- [ ] Gear bonuses are applied in PvP combat
- [ ] Match results show all progression data (XP, rank, season)
- [ ] No client-server contract errors in logs
- [ ] State transition clears properly between game modes

## References

- Sprint 2 Issue: https://github.com/anchapin/armored-archer/issues/687
- Backend Matchmaker: `backend/src/modules/matchmaker.ts`
- Backend Combat System: `backend/src/modules/combat_system.ts`
- Client Matchmaker: `autoloads/MatchmakerManager.gd`
- Client Combat: `autoloads/CombatManager.gd`
- Client Season: `autoloads/SeasonManager.gd`
