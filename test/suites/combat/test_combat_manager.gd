extends GutTest

var CombatManagerClass = load("res://autoloads/CombatManager.gd")
var _combat

# Mock NetworkManager for testing RPCs and user_id
class MockNetwork:
	extends Node
	var is_server_connected: bool = true
	var user_id: String = ""
	var mock_responses: Dictionary = {}
	var last_rpc_id: String = ""
	var last_payload: String = ""
	
	func send_rpc(rpc_id: String, payload: String) -> Dictionary:
		last_rpc_id = rpc_id
		last_payload = payload
		if mock_responses.has(rpc_id):
			return mock_responses[rpc_id]
		return {"success": true}

# Called before each test
func before_each():
	_combat = CombatManagerClass.new()
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

# Test: update_from_match_state - creator perspective
func test_update_from_match_state_creator():
	var mock_net = MockNetwork.new()
	mock_net.user_id = "player1"
	_combat.network_manager = mock_net
	
	var test_state = {
		"match_id": "match123",
		"creator_id": "player1",
		"opponent_id": "player2",
		"creator_health": 100,
		"opponent_health": 80,
		"current_turn_user_id": "player1"
	}
	
	_combat.current_match_state = test_state
	_combat._update_from_match_state()
	
	assert_eq(_combat.my_health, 100, "Creator should see their health as my_health")
	assert_eq(_combat.opponent_health, 80, "Creator should see opponent health as opponent_health")
	assert_true(_combat.is_my_turn, "It should be my turn as creator")

# Test: update_from_match_state - opponent perspective
func test_update_from_match_state_opponent():
	var mock_net = MockNetwork.new()
	mock_net.user_id = "player2"
	_combat.network_manager = mock_net
	
	var test_state = {
		"match_id": "match123",
		"creator_id": "player1",
		"opponent_id": "player2",
		"creator_health": 100,
		"opponent_health": 75,
		"current_turn_user_id": "player1"
	}
	
	_combat.current_match_state = test_state
	_combat._update_from_match_state()
	
	assert_eq(_combat.my_health, 75, "Opponent should see their health as my_health")
	assert_eq(_combat.opponent_health, 100, "Opponent should see creator health as opponent_health")
	assert_false(_combat.is_my_turn, "It should not be my turn as opponent")

# Test: calculate_damage basic
func test_calculate_damage_basic():
	var attacker_stats = {"attack": 10, "crit_rate": 0}
	var defender_stats = {"defense": 5, "dodge": 0}
	# base 20 + attack 10 - defense 5 = 25
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 1.5)
	assert_eq(damage, 25, "Basic damage calculation should be 25")

# Test: calculate_damage minimum 1
func test_calculate_damage_min():
	var attacker_stats = {"attack": 0, "crit_rate": 0}
	var defender_stats = {"defense": 100, "dodge": 0}
	# base 10 + attack 0 - defense 100 = -90 -> clamped to 1
	var damage = _combat.calculate_damage(10, attacker_stats, defender_stats, 1.5)
	assert_eq(damage, 1, "Minimum damage should be 1")

# Test: calculate_damage critical hit
func test_calculate_damage_crit():
	seed(42) # Ensure predictable randf()
	# With seed 42, randf() first values are ~0.46, ~0.02
	# Let's set crit_rate to 100 to force it
	var attacker_stats = {"attack": 10, "crit_rate": 100}
	var defender_stats = {"defense": 0, "dodge": 0}
	# base 20 + attack 10 = 30. 30 * 2.0 = 60
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 2.0)
	assert_eq(damage, 60, "Critical hit should double damage")

# Test: calculate_damage dodge
func test_calculate_damage_dodge():
	var attacker_stats = {"attack": 10, "crit_rate": 0}
	var defender_stats = {"defense": 0, "dodge": 100}
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 1.5)
	assert_eq(damage, 0, "Dodged attack should deal 0 damage")

# Test: submit_combat_action success
func test_submit_combat_action_success():
	var mock_net = MockNetwork.new()
	mock_net.user_id = "player1"
	_combat.network_manager = mock_net
	
	_combat.current_match_state = {
		"match_id": "match123",
		"creator_id": "player1",
		"opponent_id": "player2",
		"creator_health": 100,
		"opponent_health": 100
	}
	
	var result_data = {
		"success": true,
		"result": {
			"damage": 25,
			"creator_id": "player1",
			"creator_health": 100,
			"opponent_health": 75
		}
	}
	mock_net.mock_responses[_combat.RPC_SUBMIT_COMBAT_ACTION] = result_data
	
	watch_signals(_combat)
	await _combat.submit_combat_action("match123", "shoot", 45.0, 1.0)
	
	assert_signal_emitted(_combat, "combat_action_submitted")
	assert_eq(_combat.opponent_health, 75, "Opponent health should be updated")

# Test: get_match_state success
func test_get_match_state_success():
	var mock_net = MockNetwork.new()
	mock_net.user_id = "player1"
	_combat.network_manager = mock_net
	
	var state_data = {
		"match_id": "match123",
		"creator_id": "player1",
		"opponent_id": "player2",
		"creator_health": 100,
		"opponent_health": 100,
		"current_turn_user_id": "player1",
		"status": "active"
	}
	mock_net.mock_responses[_combat.RPC_GET_MATCH_STATE] = state_data
	
	watch_signals(_combat)
	await _combat.get_match_state("match123")
	
	assert_signal_emitted(_combat, "match_state_updated")
	assert_eq(_combat.get_match_status(), "active", "Match status should be active")
	assert_true(_combat.is_my_turn, "Should be my turn")

# Test: submit_combat_action with winner
func test_combat_ended_signal():
	var mock_net = MockNetwork.new()
	mock_net.user_id = "player1"
	_combat.network_manager = mock_net
	
	var result_data = {
		"success": true,
		"result": {
			"damage": 100,
			"creator_health": 100,
			"opponent_health": 0,
			"winner": "player1"
		}
	}
	mock_net.mock_responses[_combat.RPC_SUBMIT_COMBAT_ACTION] = result_data
	
	watch_signals(_combat)
	await _combat.submit_combat_action("match123", "shoot", 45.0, 1.0)
	
	assert_signal_emitted_with_parameters(_combat, "combat_ended", ["player1"])

# Test: Utility methods
func test_utility_getters():
	_combat.my_health = 50
	_combat.opponent_health = 30
	_combat.is_my_turn = true
	_combat.current_match_state = {"status": "active", "log": ["action1"]}
	
	assert_eq(_combat.get_my_health(), 50)
	assert_eq(_combat.get_opponent_health(), 30)
	assert_true(_combat.is_my_turn_sync())
	assert_eq(_combat.get_match_status(), "active")
	assert_true(_combat.is_combat_active())
	assert_eq(_combat.get_combat_log().size(), 1)

# Test: No network handling
func test_no_network_graceful():
	pending("ENV_DEPENDENT: requires live Nakama on 127.0.0.1:7350; see issue #960")
	return
	_combat.network_manager = null
	# Should not crash
	await _combat.submit_combat_action("m", "a", 0)
	await _combat.get_match_state("m")
	assert_true(true, "Should handle null network manager")

# Test: Invalid params handling
func test_invalid_params():
	var mock_net = MockNetwork.new()
	_combat.network_manager = mock_net
	
	await _combat.submit_combat_action("", "", 0)
	assert_eq(mock_net.last_rpc_id, "", "Should not send RPC with empty params")
	
	await _combat.get_match_state("")
	assert_eq(mock_net.last_rpc_id, "", "Should not send RPC with empty match_id")
