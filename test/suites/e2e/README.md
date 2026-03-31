# E2E Tests (Godot)

E2E tests for Godot that test complete game loops (e.g., full match flow).

## Purpose

E2E tests verify that the entire game client works end-to-end for critical user journeys. They should:

- Test complete workflows (e.g., main menu → match → result → lobby)
- Use real services (Nakama server, database)
- Test from player perspective (UI input → game action → result)
- Run against staging/production-like environment
- Be minimal (only for critical paths)

## Examples

```gdscript
func test_complete_match_flow_e2e():
    # Test: Launch game → Main menu → Quick match → Play → Victory → Lobby
    var game_manager = autoloads.GameManager
    var network_manager = autoloads.NetworkManager

    # Start from main menu
    game_manager.transition_to_state("main_menu")
    await wait_for_signal(game_manager, "state_changed")

    # Click quick match button
    game_manager.quick_match()
    await wait_for_signal(network_manager, "match_found")

    # Play match (auto-combat for testing)
    await wait_for_signal(game_manager, "match_complete")

    # Verify victory screen and lobby return
    assert_true(game_manager.current_state == "lobby")
    assert_true(game_manager.last_match_result == "victory")
```

## Guidelines

- Use real Nakama server (Docker Compose or staging)
- Test only critical user journeys (login, match, purchase)
- Keep test count low (10% or less of total tests)
- Tests are brittle and slow — use sparingly
- Focus on happy paths (error handling tested in integration)
- Document any environment setup requirements
- Use only for smoke testing before releases
- May require manual verification of visual elements
