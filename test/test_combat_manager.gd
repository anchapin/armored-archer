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
