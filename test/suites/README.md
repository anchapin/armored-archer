# Test Suites

This directory contains organized test suites for the Armored Archer project using the GUT (Godot Unit Test) framework.

## Directory Structure

Tests are organized by subsystem and component:

- `player/` - PlayerStatsManager, player progression, stats allocation
- `combat/` - CombatManager, damage calculations, combat flow
- `gear/` - GearManager, GearRegistry, inventory, loadouts
- `network/` - NetworkManager, Nakama RPC calls, connection handling
- `campaign/` - CampaignManager, level progression
- `season/` - SeasonManager, seasonal content, leaderboards
- `store/` - StoreManager, in-app purchases
- `transmog/` - TransmogManager, cosmetic skins
- `gem/` - GemManager, gem/socket system
- `safe_area/` - SafeAreaManager, device safe areas
- `auto_aim/` - AutoAimManager, targeting assistance
- `ui/` - UI components, transitions, optimization
- `object_pool/` - ObjectPool, performance optimization
- `performance/` - Performance benchmarks, profiling
- `analytics/` - AnalyticsManager, event tracking

## Test Naming Convention

Test files should be named `test_<component_name>.gd` and placed in the appropriate suite directory.

Example: `test/suites/player/test_player_stats_manager.gd`

## GUT Test Structure

All test files should extend `GutTest`:

```gdscript
extends GutTest

var _player: PlayerStatsManager

func before_each():
    _player = PlayerStatsManager.new()
    add_child_autofree(_player)

func after_each():
    _player = null

func test_level_starts_at_one():
    assert_eq(_player.level, 1, "New player should start at level 1")
```

## Running Tests

Run all tests:
```bash
godot4 --headless --script res://test/run_all_tests.gd
```

Run specific suite:
```bash
godot4 --headless --script res://test/run_all_tests.gd --suite player
```

## Migration Notes

This structure replaces the old flat `test/` directory organization. Tests are being migrated from:
- `test/test_player_stats_manager.gd` → `test/suites/player/test_player_stats_manager.gd`
- `test/test_combat_manager.gd` → `test/suites/combat/test_combat_manager.gd`
- etc.

Old test files remain in `test/` until migration is complete and verified.
