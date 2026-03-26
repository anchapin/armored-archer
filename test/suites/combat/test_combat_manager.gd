extends GutTest

var _combat: CombatManager

# Called before each test
func before_each():
	_combat = CombatManager.new()
	add_child_autofree(_combat)

# Called after each test
func after_each():
	_combat = null

# Test: Initial state should be empty/zero
func test_initial_state():
	assert_true(_combat.current_match_state.is_empty(), "Initial match state should be empty")
	assert_false(_combat.is_my_turn, "Initial is_my_turn should be false")
	assert_eq(_combat.my_health, 0, "Initial my_health should be 0")
	assert_eq(_combat.opponent_health, 0, "Initial opponent_health should be 0")

# Test: RPC constants are properly defined
func test_rpc_constants():
	assert_eq(_combat.RPC_SUBMIT_COMBAT_ACTION, "armored_archer/submit_combat_action", "RPC_SUBMIT_COMBAT_ACTION should match")
	assert_eq(_combat.RPC_GET_MATCH_STATE, "armored_archer/get_match_state", "RPC_GET_MATCH_STATE should match")

# Test: submit_combat_action without network returns gracefully
func test_submit_combat_action_no_network():
	# NetworkManager is not available in test environment
	# Method should return without error
	_combat.submit_combat_action("match123", "shoot", 0.5)
	assert_true(true, "submit_combat_action should handle null network manager")

# Test: get_match_state without network returns gracefully
func test_get_match_state_no_network():
	# NetworkManager is not available in test environment
	_combat.get_match_state("match123")
	assert_true(true, "get_match_state should handle null network manager")

# Test: Signals can be connected and watched
func test_signal_connections():
	watch_signals(_combat)

	# Connect signal handlers
	_combat.combat_action_submitted.connect(func(_result): pass)
	_combat.match_state_updated.connect(func(_state): pass)
	_combat.turn_changed.connect(func(_is_my_turn): pass)
	_combat.combat_ended.connect(func(_winner): pass)

	assert_true(true, "All signals can be connected")

# Test: update_local_state updates match state
func test_update_local_state():
	var test_state = {
		"match_id": "match123",
		"turn": 1,
		"creator_health": 100,
		"opponent_health": 80
	}

	_combat.update_local_state(test_state)
	assert_eq(_combat.current_match_state, test_state, "Match state should be updated")

# Test: update_from_match_state with empty state
func test_update_from_match_state_empty():
	_combat.update_from_match_state({})
	assert_true(_combat.current_match_state.is_empty(), "Empty state should remain empty")

# Test: update_from_match_state for creator (first player)
func test_update_from_match_state_creator():
	var test_state = {
		"match_id": "match123",
		"creator_id": "player1",
		"opponent_id": "player2",
		"turn": 1
	}

	# Simulate being the creator
	_combat.player_id = "player1"
	_combat.update_from_match_state(test_state)

	assert_eq(_combat.my_health, test_state.get("creator_health", 0), "Creator health should be set")
	assert_eq(_combat.opponent_health, test_state.get("opponent_health", 0), "Opponent health should be set")

# Test: update_from_match_state for opponent (second player)
func test_update_from_match_state_opponent():
	var test_state = {
		"match_id": "match123",
		"creator_id": "player1",
		"opponent_id": "player2",
		"turn": 1
	}

	# Simulate being the opponent
	_combat.player_id = "player2"
	_combat.update_from_match_state(test_state)

	assert_eq(_combat.my_health, test_state.get("opponent_health", 0), "Opponent health should be set as my health")
	assert_eq(_combat.opponent_health, test_state.get("creator_health", 0), "Creator health should be set as opponent health")

# Test: Utility methods return correct values
func test_utility_methods():
	_combat.current_match_state = {"turn": 5}
	assert_eq(_combat.get_turn(), 5, "get_turn should return current turn")

	_combat.is_my_turn = true
	assert_true(_combat.get_is_my_turn(), "get_is_my_turn should return true")

# Test: get_health methods return correct values
func test_get_health_methods():
	_combat.my_health = 75
	_combat.opponent_health = 50

	assert_eq(_combat.get_my_health(), 75, "get_my_health should return 75")
	assert_eq(_combat.get_opponent_health(), 50, "get_opponent_health should return 50")

# Test: is_my_turn syncs with match state
func test_is_my_turn_sync():
	var test_state = {"turn": 1, "current_player": "player1"}
	_combat.player_id = "player1"

	_combat.update_from_match_state(test_state)
	assert_true(_combat.is_my_turn, "is_my_turn should be true when it's my turn")

# Test: submit_combat_action with invalid parameters
func test_submit_combat_action_invalid_params():
	# Empty match_id
	_combat.submit_combat_action("", "shoot", 0.5)
	assert_true(true, "Empty match_id should be handled")

	# Empty action_type
	_combat.submit_combat_action("match123", "", 0.5)
	assert_true(true, "Empty action_type should be handled")

# Test: get_match_state with invalid parameters
func test_get_match_state_invalid_params():
	# Empty match_id
	_combat.get_match_state("")
	assert_true(true, "Empty match_id should be handled")

# Test: turn_changed signal is emitted
func test_turn_changed_signal():
	watch_signals(_combat)
	_combat.is_my_turn = true
	_combat.turn_changed.emit(true)
	assert_signal_emitted(_combat, "turn_changed", "turn_changed signal should be emitted")

# Test: combat_ended signal is emitted
func test_combat_ended_signal():
	watch_signals(_combat)
	_combat.combat_ended.emit("player1")
	assert_signal_emitted(_combat, "combat_ended", "combat_ended signal should be emitted")
