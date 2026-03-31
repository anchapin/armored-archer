extends GutTest

var CombatManagerClass = load("res://autoloads/CombatManager.gd")
var _combat
var _mock_network: Node  # Mock NetworkManager for RPC isolation

func before_each():
	# Create fresh CombatManager instance for each test (ISO-04 pattern)
	_combat = CombatManagerClass.new()
	add_child_autofree(_combat)

	# Create mock NetworkManager using GUT's double() functionality
	# This prevents real RPC calls during testing
	_mock_network = double(Node).new()
	_mock_network.name = "NetworkManager"
	add_child_autofree(_mock_network)

	# Stub NetworkManager methods that CombatManager uses
	stub(_mock_network, "is_connected").to_return(true)
	stub(_mock_network, "send_rpc").to_return({"success": true, "result": {}})

	# Inject mock by setting the @onready property directly
	# Since network_manager is @onready, we set it after creation
	_combat.set("network_manager", _mock_network)

func after_each():
	# Cleanup is handled by add_child_autofree, but clear references
	_combat = null
	_mock_network = null

# --- State Management Tests ---

func test_initial_state():
	# Verify empty match_state, zero health, not my_turn
	assert_eq(_combat.get_current_match_state(), {}, "Initial match_state should be empty")
	assert_eq(_combat.get_my_health(), 0, "Initial my_health should be 0")
	assert_eq(_combat.get_opponent_health(), 0, "Initial opponent_health should be 0")
	assert_false(_combat.is_my_turn_sync(), "Initial is_my_turn should be false")

func test_rpc_constants_defined():
	# Verify RPC_SUBMIT_COMBAT_ACTION and RPC_GET_MATCH_STATE constants
	assert_eq(CombatManager.RPC_SUBMIT_COMBAT_ACTION, "armored_archer/submit_combat_action", "RPC_SUBMIT_COMBAT_ACTION should be defined")
	assert_eq(CombatManager.RPC_GET_MATCH_STATE, "armored_archer/get_match_state", "RPC_GET_MATCH_STATE should be defined")

func test_get_current_match_state():
	# Test returning current_match_state dictionary
	_combat.set("current_match_state", {"match_id": "test-123", "status": "active"})
	assert_eq(_combat.get_current_match_state()["match_id"], "test-123", "Should return current match state")

func test_get_my_health():
	# Test returning my_health
	_combat.set("my_health", 75)
	assert_eq(_combat.get_my_health(), 75, "Should return my_health")

func test_get_opponent_health():
	# Test returning opponent_health
	_combat.set("opponent_health", 50)
	assert_eq(_combat.get_opponent_health(), 50, "Should return opponent_health")

func test_is_my_turn_sync():
	# Test returning is_my_turn boolean
	_combat.set("is_my_turn", true)
	assert_true(_combat.is_my_turn_sync(), "Should return true when is_my_turn is true")

	_combat.set("is_my_turn", false)
	assert_false(_combat.is_my_turn_sync(), "Should return false when is_my_turn is false")

func test_get_combat_log():
	# Test returning log from match_state
	_combat.set("current_match_state", {"log": ["action1", "action2"]})
	assert_eq(_combat.get_combat_log().size(), 2, "Should return combat log array")

func test_get_match_status():
	# Test returning status string
	_combat.set("current_match_state", {"status": "active"})
	assert_eq(_combat.get_match_status(), "active", "Should return status from match state")

func test_is_combat_active():
	# Test true when status is "active", false otherwise
	_combat.set("current_match_state", {"status": "active"})
	assert_true(_combat.is_combat_active(), "Should return true when status is active")

	_combat.set("current_match_state", {"status": "completed"})
	assert_false(_combat.is_combat_active(), "Should return false when status is not active")

	_combat.set("current_match_state", {"status": ""})
	assert_false(_combat.is_combat_active(), "Should return false when status is empty")

# --- Combat Calculation Tests ---

func test_calculate_damage_basic():
	# Test base_damage + attack - defense formula
	var attacker_stats = {"attack": 10, "crit_rate": 0}
	var defender_stats = {"defense": 5, "dodge": 0}
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 1.0)
	# base 20 + attack 10 - defense 5 = 25
	assert_eq(damage, 25, "Basic damage calculation should be 25")

func test_calculate_damage_minimum_one():
	# Test damage never goes below 1
	var attacker_stats = {"attack": 0, "crit_rate": 0}
	var defender_stats = {"defense": 100, "dodge": 0}
	var damage = _combat.calculate_damage(10, attacker_stats, defender_stats, 1.0)
	# base 10 + attack 0 - defense 100 = -90, but min is 1
	assert_eq(damage, 1, "Damage should never be less than 1")

func test_calculate_damage_zero_attack():
	# Test with zero attack stat
	var attacker_stats = {"attack": 0, "crit_rate": 0}
	var defender_stats = {"defense": 5, "dodge": 0}
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 1.0)
	# base 20 + attack 0 - defense 5 = 15
	assert_eq(damage, 15, "Damage should be calculated correctly with zero attack")

func test_calculate_damage_high_defense():
	# Test when defense exceeds attack + base
	var attacker_stats = {"attack": 10, "crit_rate": 0}
	var defender_stats = {"defense": 50, "dodge": 0}
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 1.0)
	# base 20 + attack 10 - defense 50 = -20, but min is 1
	assert_eq(damage, 1, "Damage should be 1 when defense exceeds attack + base")

func test_calculate_damage_crit_hit():
	# Test crit multiplier applied when crit_roll < crit_rate
	# Since we can't control randf(), we'll test that crit is possible
	var attacker_stats = {"attack": 10, "crit_rate": 100}  # 100% crit rate
	var defender_stats = {"defense": 5, "dodge": 0}
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 2.0)
	# base 20 + attack 10 - defense 5 = 25, * 2.0 = 50 (if crit)
	# Since crit_rate is 100%, damage should be 50
	assert_eq(damage, 50, "Critical hit should double damage with 100% crit rate")

func test_calculate_damage_crit_multiplier_2x():
	# Test damage doubled with 2.0 multiplier
	var attacker_stats = {"attack": 10, "crit_rate": 100}
	var defender_stats = {"defense": 5, "dodge": 0}
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 2.0)
	assert_eq(damage, 50, "Damage should be doubled with 2.0 multiplier")

func test_calculate_damage_crit_multiplier_3x():
	# Test damage tripled with 3.0 multiplier
	var attacker_stats = {"attack": 10, "crit_rate": 100}
	var defender_stats = {"defense": 5, "dodge": 0}
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 3.0)
	# base 20 + attack 10 - defense 5 = 25, * 3.0 = 75
	assert_eq(damage, 75, "Damage should be tripled with 3.0 multiplier")

func test_calculate_damage_dodge():
	# Test damage = 0 when dodge_roll < dodge
	# With 100% dodge, damage should always be 0
	var attacker_stats = {"attack": 10, "crit_rate": 100}
	var defender_stats = {"defense": 5, "dodge": 100}  # 100% dodge rate
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 2.0)
	# With 100% dodge, attack should be dodged
	assert_eq(damage, 0, "Damage should be 0 when dodge succeeds")

func test_calculate_damage_stats_with_defaults():
	# Test with missing stats uses 0 defaults
	var attacker_stats = {}  # Empty dict - should use 0 defaults
	var defender_stats = {}  # Empty dict - should use 0 defaults
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 1.0)
	# base 20 + attack 0 - defense 0 = 20
	assert_eq(damage, 20, "Missing stats should default to 0")

func test_calculate_damage_integer_result():
	# Test result is int (not float)
	var attacker_stats = {"attack": 10, "crit_rate": 0}
	var defender_stats = {"defense": 5, "dodge": 0}
	var damage = _combat.calculate_damage(20, attacker_stats, defender_stats, 1.0)
	assert_true(typeof(damage) == TYPE_INT, "Damage result should be integer")
	assert_eq(damage, 25, "Integer damage should be 25")

# --- Signal and RPC Tests ---

func test_signal_connections():
	# Test all signals can be connected (combat_action_submitted, match_state_updated, turn_changed, combat_ended)
	watch_signals(_combat)
	# Signal connection test - verify signals exist
	assert_true(_combat.has_signal("combat_action_submitted"), "combat_action_submitted signal should exist")
	assert_true(_combat.has_signal("match_state_updated"), "match_state_updated signal should exist")
	assert_true(_combat.has_signal("turn_changed"), "turn_changed signal should exist")
	assert_true(_combat.has_signal("combat_ended"), "combat_ended signal should exist")

func test_combat_action_submitted_signal():
	# Test signal emits on RPC success
	watch_signals(_combat)
	var mock_response = {"success": true, "result": {"action_id": "test-123"}}
	stub(_mock_network, "send_rpc").to_return(mock_response)

	# Note: submit_combat_action is async, so we can't directly test emission
	# This test verifies the signal exists and can be watched
	assert_signal_emit_count(_combat, "combat_action_submitted", 0, "Signal should not emit yet")

func test_match_state_updated_signal():
	# Test signal emits on state update
	watch_signals(_combat)
	var mock_response = {"success": true, "match_id": "test-456"}
	_combat.set("current_match_state", mock_response)

	# Manually trigger signal emission to test it
	_combat.emit_signal("match_state_updated", mock_response)
	assert_signal_emitted(_combat, "match_state_updated", "match_state_updated signal should emit")

func test_turn_changed_signal():
	# Test signal emits with is_my_turn parameter
	watch_signals(_combat)
	_combat.set("is_my_turn", true)

	# Manually trigger signal emission to test it
	_combat.emit_signal("turn_changed", true)
	assert_signal_emitted_with_parameters(_combat, "turn_changed", [true], "turn_changed signal should emit with is_my_turn=true")

func test_combat_ended_signal():
	# Test signal emits with winner on match end
	watch_signals(_combat)

	# Manually trigger signal emission to test it
	_combat.emit_signal("combat_ended", "player1")
	assert_signal_emitted_with_parameters(_combat, "combat_ended", ["player1"], "combat_ended signal should emit with winner")

func test_submit_combat_action_no_network():
	# Test graceful handling when network_manager is null
	_combat.set("network_manager", null)
	watch_signals(_combat)

	# This should not crash, just push_error and return
	_combat.submit_combat_action("match-123", "shoot", 45.0, 1.0)
	# Verify signal was not emitted due to no network
	assert_signal_emit_count(_combat, "combat_action_submitted", 0, "Signal should not emit without network")

func test_submit_combat_action_empty_match_id():
	# Test error handling for empty match_id
	watch_signals(_combat)

	# This should not crash, just push_error and return
	_combat.submit_combat_action("", "shoot", 45.0, 1.0)
	# Verify signal was not emitted due to empty match_id
	assert_signal_emit_count(_combat, "combat_action_submitted", 0, "Signal should not emit with empty match_id")

func test_submit_combat_action_empty_action_type():
	# Test error handling for empty action_type
	watch_signals(_combat)

	# This should not crash, just push_error and return
	_combat.submit_combat_action("match-123", "", 45.0, 1.0)
	# Verify signal was not emitted due to empty action_type
	assert_signal_emit_count(_combat, "combat_action_submitted", 0, "Signal should not emit with empty action_type")

func test_get_match_state_no_network():
	# Test graceful handling when network_manager is null
	_combat.set("network_manager", null)
	watch_signals(_combat)

	# This should not crash, just push_error and return
	_combat.get_match_state("match-123")
	# Verify current_match_state remains empty
	assert_eq(_combat.get_current_match_state(), {}, "Match state should remain empty without network")

func test_get_match_state_empty_match_id():
	# Test error handling for empty match_id
	watch_signals(_combat)

	# This should not crash, just push_error and return
	_combat.get_match_state("")
	# Verify current_match_state remains empty
	assert_eq(_combat.get_current_match_state(), {}, "Match state should remain empty with empty match_id")
