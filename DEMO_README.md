# Armored Archer - Full Core Loop Demo

This demo demonstrates the complete core loop of Armored Archer:

**PvE Combat → Loot Drop → Gear Equip → Ranked Match → Rewards**

## Issue

- GitHub Issue: #691
- Sprint: Sprint 2 - Vertical Slice Completion

## Demo Flow

The demo runs through 15 steps:

1. **Login** - Player authentication and session setup
2. **PvE Encounter Start** - Starting a PvE battle
3. **PvE Encounter Complete** - Completing the battle (victory)
4. **Loot Drop Received** - Receiving gear rewards
5. **Gear Inventory View** - Viewing the inventory with new item
6. **Gear Equip** - Equipping the new gear item
7. **Verify Equipped Stats** - Verifying stat changes from gear
8. **PvP Rank Check** - Checking current PvP rank
9. **PvP Match Create** - Creating a ranked match
10. **PvP Match Accept** - Accepting and entering the match
11. **PvP Combat Simulation** - Simulating turn-based PvP combat
12. **Match Complete** - Submitting match result to server
13. **Results View** - Displaying match results with XP/Rank changes
14. **Progression Update** - Verifying final player state
15. **Complete** - Demo finished with summary

## Running the Demo

### Option 1: From Command Line (Headless)

```bash
# From project root directory
godot --headless --script res://scripts/full_core_loop_demo.gd
```

### Option 2: From Godot Editor

1. Open the project in Godot 4.6+
2. Navigate to `scenes/full_core_loop_demo.tscn`
3. Press **F5** or click the **Play** button

### Option 3: Using the Demo Scene

The demo scene includes:
- Visual progress indicator
- Current step status display
- Restart and Exit buttons

## Requirements

- **Godot Engine**: 4.6 or later
- **Server**: Nakama server running (default: localhost:7350)
- **Network**: Connection to backend server required for full functionality

## Configuration

The demo can be configured by modifying constants at the top of `scripts/full_core_loop_demo.gd`:

```gdscript
const DEMO_DELAY: float = 2.0           # Seconds between steps
const SIMULATION_DELAY: float = 0.5        # Seconds between simulation actions
const ENABLE_VERIFICATION: bool = true       # Verify states at each step
const ENABLE_SCREENSHOTS: bool = false      # Capture screenshots at key steps
```

## Expected Output

### Console Output

The demo outputs detailed progress to the Godot console:

```
======================================================================
ARMORED ARCHER - FULL CORE LOOP DEMO
======================================================================

[1/13] LOGIN - Player authentication...
  User ID: abc123...
  Device ID: de4f...
  Player Level: 5
  Player XP: 1250
  ✓ Player logged in successfully

[2/13] PVE ENCOUNTER - Starting battle...
  Stage ID: demo_stage_001
  ✓ PvE encounter started successfully

...

======================================================================
FULL CORE LOOP DEMO COMPLETE
======================================================================

Summary:
  ✓ All 15 steps completed
  ✓ Core loop demonstrated:
    - Player login works
    - PvE combat flow works
    - Loot drop system works
    ...
```

### Session Data

The demo tracks and reports:

- **Initial Rank** → **Final Rank** (with delta)
- **Gear Equipped**: Name of equipped item
- **Match Result**: Victory or Defeat
- **XP Gained**: Total XP earned during session

## Troubleshooting

### Connection Issues

If the demo fails to connect:

1. Verify Nakama server is running:
   ```bash
   make backend-start
   ```

2. Check server configuration in `autoloads/NetworkManager.gd`

3. Verify network connectivity to `127.0.0.1:7350`

### Manager Not Found

If you see "Missing autoloads" error:

1. Check `project.godot` for autoload configuration
2. Ensure all required autoloads are registered:
   - NetworkManager
   - PlayerStatsManager
   - GearManager
   - MatchmakerManager
   - SeasonManager
   - CampaignManager

### RPC Failures

If RPC calls fail during demo:

1. Check Nakama server logs for errors
2. Verify backend TypeScript is compiled:
   ```bash
   cd backend
   npm run build
   ```

3. Check database migrations:
   ```bash
   make backend-migrate
   ```

## Acceptance Criteria

- ✅ Demo script runs through: PvE → loot → equip → ranked match → rewards
- ✅ Script can be executed for demonstration
- ✅ Key states are verified at each step
- ✅ Demo is repeatable and reliable
- ✅ Demo showcases the complete core loop

## Files

- `scripts/full_core_loop_demo.gd` - Main demo script
- `scenes/full_core_loop_demo.tscn` - Demo UI scene
- `DEMO_README.md` - This file

## Related Issues

- #679 - Sprint 1 Vertical Slice Foundation
- #690 - Display match results with XP, rank, and season progression
