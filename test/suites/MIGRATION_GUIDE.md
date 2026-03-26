# GUT Migration Guide

This guide explains how to migrate tests from the custom test framework to GUT (Godot Unit Test).

## Overview

The old test framework (`test_framework.gd`) used custom assertion helpers and manual test running. GUT provides a more feature-rich testing framework with:
- Comprehensive assertions
- Test lifecycle hooks (before_each, after_each)
- Automatic resource cleanup (add_child_autofree)
- Signal testing (watch_signals, assert_signal_emitted)
- Test doubles and mocking
- JUnit XML output for CI

## Migration Steps

### 1. Change Base Class

**Old:**
```gdscript
extends Node
```

**New:**
```gdscript
extends GutTest
```

### 2. Replace Test Setup

**Old:**
```gdscript
var _tests_passed: int = 0
var _tests_failed: int = 0

func _ready() -> void:
    print("=== Running Tests ===\n")
    await run_tests()

func _create_instance():
    var obj = MyClass.new()
    add_child(obj)
    return obj

func run_tests() -> void:
    await test_one()
    await test_two()
    # ...
```

**New:**
```gdscript
var _obj: MyClass

func before_each():
    _obj = MyClass.new()
    add_child_autofree(_obj)  # Auto-cleanup!

func after_each():
    _obj = null
```

### 3. Replace Assertions

**Old:**
```gdscript
func _pass(test_name: String) -> void:
    _tests_passed += 1
    print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
    _tests_failed += 1
    print("[FAIL] " + test_name + ": " + message)

func test_something():
    if value == expected:
        _pass("test_something")
    else:
        _fail("test_something", "Wrong value")
```

**New:**
```gdscript
func test_something():
    assert_eq(value, expected, "Values should match")
```

### 4. Use GUT Assertions

| Old Method | GUT Equivalent |
|------------|----------------|
| `assert_true(condition)` | `assert_true(condition, message)` |
| `assert_false(condition)` | `assert_false(condition, message)` |
| `assert_eq(actual, expected)` | `assert_eq(actual, expected, message)` |
| `assert_ne(actual, expected)` | `assert_ne(actual, expected, message)` |
| `assert_null(value)` | `assert_null(value, message)` |
| `assert_not_null(value)` | `assert_not_null(value, message)` |
| `assert_gt(actual, expected)` | `assert_gt(actual, expected, message)` |
| `assert_lt(actual, expected)` | `assert_lt(actual, expected, message)` |
| `assert_has(dict, key)` | `assert_has(dict, key, message)` |
| `assert_empty(array)` | `assert_empty(array, message)` |
| `assert_not_empty(array)` | `assert_not_empty(array, message)` |

### 5. Signal Testing

**Old:**
```gdscript
var signal_fired = false
obj.my_signal.connect(func(): signal_fired = true)
# Trigger signal
if signal_fired:
    _pass("test_signal")
```

**New:**
```gdscript
watch_signals(obj)
# Trigger signal
assert_signal_emitted(obj, "my_signal", "Signal should be emitted")
```

### 6. Test Organization

**Old:**
- Flat structure in `test/` directory
- Manual test execution in `run_tests()`

**New:**
- Organized by subsystem in `test/suites/`
- GUT auto-discovers test functions (prefix with `test_`)
- No manual test running needed

## Example: Complete Migration

### Before (Custom Framework)
```gdscript
extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

func _ready():
    await run_tests()

func run_tests():
    await test_level_starts_at_one()
    await test_gain_xp_increases_level()
    print_results()

func _pass(name):
    _tests_passed += 1
    print("[PASS] " + name)

func _fail(name, msg):
    _tests_failed += 1
    print("[FAIL] " + name + ": " + msg)

func test_level_starts_at_one():
    var psm = PlayerStatsManager.new()
    if psm.level == 1:
        _pass("test_level_starts_at_one")
    else:
        _fail("test_level_starts_at_one", "Level should be 1")
    psm.queue_free()

func test_gain_xp_increases_level():
    var psm = PlayerStatsManager.new()
    psm.gain_xp(100)
    if psm.level == 2:
        _pass("test_gain_xp_increases_level")
    else:
        _fail("test_gain_xp_increases_level", "Level should be 2")
    psm.queue_free()

func print_results():
    print("Passed: %d" % _tests_passed)
    print("Failed: %d" % _tests_failed)
```

### After (GUT)
```gdscript
extends GutTest

var _player: PlayerStatsManager

func before_each():
    _player = PlayerStatsManager.new()
    add_child_autofree(_player)  # Auto-cleanup!

func after_each():
    _player = null

func test_level_starts_at_one():
    assert_eq(_player.level, 1, "New player should start at level 1")

func test_gain_xp_increases_level():
    _player.gain_xp(100)
    assert_eq(_player.level, 2, "Level should be 2 after gaining XP")
```

## Key Benefits

1. **Less boilerplate**: No manual test running, result counting, or cleanup
2. **Better assertions**: Clear error messages with expected vs actual values
3. **Auto-cleanup**: `add_child_autofree()` prevents memory leaks
4. **Signal testing**: Built-in signal watching and assertion
5. **CI integration**: JUnit XML output for test reporting
6. **Test discovery**: Auto-finds test functions, no manual registration

## Running Migrated Tests

```bash
# Run all tests
godot4 --headless --script res://test/run_all_tests.gd

# Run specific suite
godot4 --headless --script res://test/run_all_tests.gd -dselect=suites/player

# Run specific test
godot4 --headless --script res://test/run_all_tests.gd -dselect=suites/player -dunit_test=test_player_stats_manager
```

## Next Steps

1. Migrate remaining test files in priority order:
   - High-priority: player, combat, gear (core gameplay)
   - Medium-priority: network, campaign, season
   - Low-priority: UI components, performance tests

2. After migration, verify all tests pass:
   ```bash
   godot4 --headless --script res://test/run_all_tests.gd
   ```

3. Remove old `test_framework.gd` once all tests migrated

4. Update CI/CD to use GUT's JUnit XML output
