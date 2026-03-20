# Integration Tests (Godot)

Integration tests for Godot that test interactions between autoloads and subsystems.

## Purpose

Integration tests verify that different autoloads and game systems work together correctly. They should:

- Test interactions between 2-3 autoloads
- Use real autoload instances (not mocks)
- Test specific integration points (e.g., NetworkManager + MatchmakerManager)
- Run in isolation (cleanup state after each test)
- Be deterministic (seed data, no randomness)

## Examples

```gdscript
func test_network_matchmaker_integration():
    # Test: NetworkManager connects → MatchmakerManager queues → match found
    var network_manager = autoloads.NetworkManager
    var matchmaker_manager = autoloads.MatchmakerManager

    # Connect to Nakama
    network_manager.connect_to_server("test-device")
    await wait_for_signal(network_manager, "connected")

    # Queue for match
    matchmaker_manager.find_match()
    await wait_for_signal(matchmaker_manager, "match_found")

    # Verify match data
    assert_true(matchmaker_manager.current_match != null)
```

## Guidelines

- Use real autoload instances (autoloads/)
- Cleanup state after each test
- Test real interactions (not mocks)
- Focus on critical paths (network, combat, stats)
- Avoid testing Godot engine features (they have their own tests)
- Keep tests focused on game-specific logic
- Use GUT's `before_each()` and `after_each()` for setup/teardown
