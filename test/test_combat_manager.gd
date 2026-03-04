extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running CombatManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	test_initial_state()
	test_constants()
	test_submit_combat_action_no_network()
	test_get_match_state_no_network()
	test_signal_emission()
	test_update_local_state()
	test_update_from_match_state_empty()
	test_update_from_match_state_creator()
	test_update_from_match_state_opponent()
	test_utility_methods()
	test_get_health_methods()
	test_is_my_turn_sync()
	test_submit_combat_action_invalid_params()
	test_get_match_state_invalid_params()
	test_turn_changed_signal()
	test_combat_ended_signal()

	print("\n=== CombatManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_combat_manager() -> Node:
	var cm = load("res://autoloads/CombatManager.gd").new()
	add_child(cm)
	return cm

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var cm = _create_combat_manager()

	if cm.current_match_state.is_empty() and not cm.is_my_turn and cm.my_health == 0 and cm.opponent_health == 0:
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Initial state should be empty/zero")

	cm.queue_free()

func test_constants() -> void:
	var cm = _create_combat_manager()

	if cm.RPC_SUBMIT_COMBAT_ACTION == "armored_archer/submit_combat_action":
		_pass("test_constants_rpc_submit")
	else:
		_fail("test_constants_rpc_submit", "RPC_SUBMIT_COMBAT_ACTION mismatch")

	if cm.RPC_GET_MATCH_STATE == "armored_archer/get_match_state":
		_pass("test_constants_rpc_get_state")
	else:
		_fail("test_constants_rpc_get_state", "RPC_GET_MATCH_STATE mismatch")

	cm.queue_free()

func test_submit_combat_action_no_network() -> void:
	var cm = _create_combat_manager()
	# network_manager is null, should return early
	cm.submit_combat_action("match123", "shoot", 0.5)
	# no signal should be emitted, we just check that method returns without error
	_pass("test_submit_combat_action_no_network")
	cm.queue_free()

func test_get_match_state_no_network() -> void:
	var cm = _create_combat_manager()
	cm.get_match_state("match123")
	_pass("test_get_match_state_no_network")
	cm.queue_free()

func test_signal_emission() -> void:
	var cm = _create_combat_manager()
	var action_submitted = false
	var state_updated = false
	var turn_changed = false
	var combat_ended = false

	cm.combat_action_submitted.connect(func(_): action_submitted = true)
	cm.match_state_updated.connect(func(_): state_updated = true)
	cm.turn_changed.connect(func(_): turn_changed = true)
	cm.combat_ended.connect(func(_): combat_ended = true)

	# Emit signals manually
	cm.combat_action_submitted.emit({"test": true})
	cm.match_state_updated.emit({})
	cm.turn_changed.emit(true)
	cm.combat_ended.emit("player")

	await get_tree().create_timer(0.1).timeout

	if action_submitted and state_updated and turn_changed and combat_ended:
		_pass("test_signal_emission")
	else:
		_fail("test_signal_emission", "Not all signals were received")

	cm.queue_free()

func test_update_local_state() -> void:
	var cm = _create_combat_manager()

	# Simulate being the creator
	cm.current_match_state = {
		"creator_id": "user_123",
		"creator_health": 80,
		"opponent_health": 90
	}
	# Manually call the private method
	cm._update_local_state(cm.current_match_state)

	if cm.my_health == 80 and cm.opponent_health == 90:
		_pass("test_update_local_state_creator")
	else:
		_fail("test_update_local_state_creator", "Health values incorrect for creator")

	# Simulate being the opponent
	cm.current_match_state = {
		"creator_id": "other_user",
		"creator_health": 100,
		"opponent_health": 70
	}
	cm._update_local_state(cm.current_match_state)

	if cm.my_health == 70 and cm.opponent_health == 100:
		_pass("test_update_local_state_opponent")
	else:
		_fail("test_update_local_state_opponent", "Health values incorrect for opponent")

	cm.queue_free()

# --- Additional CombatManager Tests for Higher Coverage ---

func test_update_from_match_state_empty() -> void:
	var cm = _create_combat_manager()
	# Empty match state should not crash
	cm._update_from_match_state()
	
	_pass("test_update_from_match_state_empty")
	cm.queue_free()

func test_update_from_match_state_creator() -> void:
	var cm = _create_combat_manager()
	# Mock NetworkManager user_id
	var nm = Node.new()
	nm.set("user_id", "creator_user")
	add_child(nm)
	cm.network_manager = nm
	
	cm.current_match_state = {
		"creator_id": "creator_user",
		"opponent_id": "opponent_user",
		"creator_health": 85,
		"opponent_health": 70,
		"current_turn_user_id": "creator_user",
		"status": "active"
	}
	
	cm._update_from_match_state()
	
	if cm.my_health == 85 and cm.opponent_health == 70 and cm.is_my_turn:
		_pass("test_update_from_match_state_creator")
	else:
		_fail("test_update_from_match_state_creator", "Creator state incorrect")
	
	cm.queue_free()
	nm.queue_free()

func test_update_from_match_state_opponent() -> void:
	var cm = _create_combat_manager()
	var nm = Node.new()
	nm.set("user_id", "opponent_user")
	add_child(nm)
	cm.network_manager = nm
	
	cm.current_match_state = {
		"creator_id": "creator_user",
		"opponent_id": "opponent_user",
		"creator_health": 90,
		"opponent_health": 60,
		"current_turn_user_id": "creator_user",
		"status": "active"
	}
	
	cm._update_from_match_state()
	
	if cm.my_health == 60 and cm.opponent_health == 90 and not cm.is_my_turn:
		_pass("test_update_from_match_state_opponent")
	else:
		_fail("test_update_from_match_state_opponent", "Opponent state incorrect")
	
	cm.queue_free()
	nm.queue_free()

func test_utility_methods() -> void:
	var cm = _create_combat_manager()
	
	cm.current_match_state = {"log": ["action1", "action2"], "status": "active"}
	
	if cm.get_current_match_state() == cm.current_match_state:
		_pass("test_get_current_match_state")
	else:
		_fail("test_get_current_match_state", "Match state mismatch")
	
	if cm.get_combat_log() == ["action1", "action2"]:
		_pass("test_get_combat_log")
	else:
		_fail("test_get_combat_log", "Combat log incorrect")
	
	if cm.get_match_status() == "active":
		_pass("test_get_match_status")
	else:
		_fail("test_get_match_status", "Status incorrect")
	
	if cm.is_combat_active():
		_pass("test_is_combat_active")
	else:
		_fail("test_is_combat_active", "Should be active")
	
	cm.queue_free()

func test_get_health_methods() -> void:
	var cm = _create_combat_manager()
	cm.my_health = 75
	cm.opponent_health = 60
	
	if cm.get_my_health() == 75:
		_pass("test_get_my_health")
	else:
		_fail("test_get_my_health", "My health incorrect")
	
	if cm.get_opponent_health() == 60:
		_pass("test_get_opponent_health")
	else:
		_fail("test_get_opponent_health", "Opponent health incorrect")
	
	cm.queue_free()

func test_is_my_turn_sync() -> void:
	var cm = _create_combat_manager()
	cm.is_my_turn = true
	
	if cm.is_my_turn_sync():
		_pass("test_is_my_turn_sync_true")
	else:
		_fail("test_is_my_turn_sync_true", "Should be my turn")
	
	cm.is_my_turn = false
	if not cm.is_my_turn_sync():
		_pass("test_is_my_turn_sync_false")
	else:
		_fail("test_is_my_turn_sync_false", "Should not be my turn")
	
	cm.queue_free()

func test_submit_combat_action_invalid_params() -> void:
	var cm = _create_combat_manager()
	# No network manager, should return early without error
	cm.submit_combat_action("", "", 0.0)
	cm.submit_combat_action("match123", "", 0.0)
	cm.submit_combat_action("", "shoot", 0.5)
	
	_pass("test_submit_combat_action_invalid_params")
	cm.queue_free()

func test_get_match_state_invalid_params() -> void:
	var cm = _create_combat_manager()
	# No network manager, should return early
	cm.get_match_state("")
	
	_pass("test_get_match_state_invalid_params")
	cm.queue_free()

func test_turn_changed_signal() -> void:
	var cm = _create_combat_manager()
	var turn_true_received = false
	var turn_false_received = false
	
	cm.turn_changed.connect(func(is_turn): 
		if is_turn:
			turn_true_received = true
		else:
			turn_false_received = true
	)
	
	cm.turn_changed.emit(true)
	cm.turn_changed.emit(false)
	
	await get_tree().create_timer(0.1).timeout
	
	if turn_true_received and turn_false_received:
		_pass("test_turn_changed_signal")
	else:
		_fail("test_turn_changed_signal", "Turn signals not received")
	
	cm.queue_free()

func test_combat_ended_signal() -> void:
	var cm = _create_combat_manager()
	var winner_received = ""
	
	cm.combat_ended.connect(func(w): winner_received = w)
	
	cm.combat_ended.emit("player_1")
	
	await get_tree().create_timer(0.1).timeout
	
	if winner_received == "player_1":
		_pass("test_combat_ended_signal")
	else:
		_fail("test_combat_ended_signal", "Winner not received")
	
	cm.queue_free()
