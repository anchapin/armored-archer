extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running CombatSyncManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_start_combat()
	await test_send_move()
	await test_send_move_not_your_turn()
	await test_send_move_combat_not_active()
	await test_update_opponent_state()
	await test_get_current_turn()
	await test_end_combat()
	await test_apply_opponent_damage()
	await test_apply_player_damage()
	await test_combat_log_recording()
	await test_polling_timer_cleanup()
	await test_health_changed_signal()
	await test_polling_timer_starts_on_combat()
	await test_update_opponent_state_no_damage()
	await test_update_opponent_state_empty()
	await test_end_combat_lethal_opponent()
	await test_end_combat_lethal_player()
	await test_combat_log_cleared_on_restart()
	await test_health_changed_signal()
	await test_polling_timer_starts_on_combat()
	await test_update_opponent_state_no_damage()
	await test_update_opponent_state_empty()
	await test_end_combat_lethal_opponent()
	await test_end_combat_lethal_player()
	await test_combat_log_cleared_on_restart()

	print("\n=== CombatSyncManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_combat_sync_manager() -> Node:
	var csm = load("res://autoloads/CombatSyncManager.gd").new()
	add_child(csm)
	await get_tree().process_frame
	return csm

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var csm = await _create_combat_sync_manager()

	if csm.player_health == 100:
		_pass("test_initial_player_health")
	else:
		_fail("test_initial_player_health", "Player health should be 100")

	if csm.opponent_health == 100:
		_pass("test_initial_opponent_health")
	else:
		_fail("test_initial_opponent_health", "Opponent health should be 100")

	if csm.is_combat_active == false:
		_pass("test_initial_combat_inactive")
	else:
		_fail("test_initial_combat_inactive", "Combat should not be active initially")

	if csm.combat_log.is_empty():
		_pass("test_initial_combat_log_empty")
	else:
		_fail("test_initial_combat_log_empty", "Combat log should be empty initially")

	csm.queue_free()

func test_start_combat() -> void:
	var csm = await _create_combat_sync_manager()
	var signals_received: Array = []

	csm.combat_started.connect(func(match_id: String): signals_received.append(match_id))

	csm.start_combat("test_match_123")

	if csm.is_combat_active:
		_pass("test_start_combat_active")
	else:
		_fail("test_start_combat_active", "Combat should be active after start")

	if csm.player_health == 100 and csm.opponent_health == 100:
		_pass("test_start_combat_health_reset")
	else:
		_fail("test_start_combat_health_reset", "Health should reset to 100")

	if csm.is_my_turn:
		_pass("test_start_combat_player_turn")
	else:
		_fail("test_start_combat_player_turn", "Player should have first turn")

	if csm.current_match_id == "test_match_123":
		_pass("test_start_combat_match_id")
	else:
		_fail("test_start_combat_match_id", "Match ID should be set")

	if signals_received.size() > 0 and signals_received[0] == "test_match_123":
		_pass("test_start_combat_signal")
	else:
		_fail("test_start_combat_signal", "combat_started signal should emit with match_id")

	csm.queue_free()

func test_send_move() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")

	csm.send_move(45.0, 80.0)

	if csm.combat_log.size() == 1:
		_pass("test_send_move_logged")
	else:
		_fail("test_send_move_logged", "Move should be logged")

	if csm.combat_log[0]["type"] == "player_move":
		_pass("test_send_move_type")
	else:
		_fail("test_send_move_type", "Log entry should be player_move")

	if csm.combat_log[0]["angle"] == 45.0 and csm.combat_log[0]["power"] == 80.0:
		_pass("test_send_move_values")
	else:
		_fail("test_send_move_values", "Angle and power should be recorded")

	if csm.is_my_turn == false:
		_pass("test_send_move_turn_switch")
	else:
		_fail("test_send_move_turn_switch", "Should switch to opponent turn after sending move")

	csm.queue_free()

func test_send_move_not_your_turn() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")
	csm.send_move(45.0, 80.0)  # Now it's opponent's turn

	var log_size_before = csm.combat_log.size()
	csm.send_move(30.0, 50.0)  # Should be ignored

	if csm.combat_log.size() == log_size_before:
		_pass("test_send_move_not_your_turn")
	else:
		_fail("test_send_move_not_your_turn", "Should not log move when not your turn")

	csm.queue_free()

func test_send_move_combat_not_active() -> void:
	var csm = await _create_combat_sync_manager()

	csm.send_move(45.0, 80.0)

	if csm.combat_log.is_empty():
		_pass("test_send_move_combat_not_active")
	else:
		_fail("test_send_move_combat_not_active", "Should not log move when combat not active")

	csm.queue_free()

func test_update_opponent_state() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")
	csm.send_move(45.0, 80.0)  # Switch to opponent turn

	var signals_received: Array = []

	csm.opponent_moved.connect(func(move_data: Dictionary): signals_received.append(move_data))

	var move_data = {
		"angle": 30.0,
		"power": 60.0,
		"damage": 15
	}
	csm.update_opponent_state(move_data)

	if csm.player_health == 85:
		_pass("test_update_opponent_state_damage")
	else:
		_fail("test_update_opponent_state_damage", "Player health should decrease by damage")

	if csm.is_my_turn:
		_pass("test_update_opponent_state_turn_back")
	else:
		_fail("test_update_opponent_state_turn_back", "Should be player's turn after opponent moves")

	if signals_received.size() > 0:
		_pass("test_update_opponent_state_signal")
	else:
		_fail("test_update_opponent_state_signal", "opponent_moved signal should emit")

	if csm.combat_log.size() == 2:
		_pass("test_update_opponent_state_logged")
	else:
		_fail("test_update_opponent_state_logged", "Opponent move should be logged")

	csm.queue_free()

func test_get_current_turn() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")

	if csm.get_current_turn() == "player":
		_pass("test_get_current_turn_player")
	else:
		_fail("test_get_current_turn_player", "Should be player's turn initially")

	csm.send_move(45.0, 80.0)

	if csm.get_current_turn() == "opponent":
		_pass("test_get_current_turn_opponent")
	else:
		_fail("test_get_current_turn_opponent", "Should be opponent's turn after player move")

	csm.queue_free()

func test_end_combat() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")

	var signals_received: Array = []

	csm.combat_ended.connect(func(w: String): signals_received.append(w))

	csm.end_combat("player")

	if csm.is_combat_active == false:
		_pass("test_end_combat_inactive")
	else:
		_fail("test_end_combat_inactive", "Combat should be inactive after end")

	if signals_received.size() > 0 and signals_received[0] == "player":
		_pass("test_end_combat_signal")
	else:
		_fail("test_end_combat_signal", "combat_ended signal should emit with winner")

	if csm.combat_log.back()["type"] == "combat_end":
		_pass("test_end_combat_logged")
	else:
		_fail("test_end_combat_logged", "Combat end should be logged")

	csm.queue_free()

func test_apply_opponent_damage() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")

	csm.apply_opponent_damage(25)

	if csm.opponent_health == 75:
		_pass("test_apply_opponent_damage")
	else:
		_fail("test_apply_opponent_damage", "Opponent health should decrease")

	csm.apply_opponent_damage(100)

	if csm.opponent_health == 0:
		_pass("test_apply_opponent_damage_lethal")
	else:
		_fail("test_apply_opponent_damage_lethal", "Health should not go below 0")

	csm.queue_free()

func test_apply_player_damage() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")

	csm.apply_player_damage(30)

	if csm.player_health == 70:
		_pass("test_apply_player_damage")
	else:
		_fail("test_apply_player_damage", "Player health should decrease")

	csm.apply_player_damage(100)

	if csm.player_health == 0:
		_pass("test_apply_player_damage_lethal")
	else:
		_fail("test_apply_player_damage_lethal", "Health should not go below 0")

	csm.queue_free()

func test_combat_log_recording() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")

	csm.send_move(45.0, 80.0)

	var move_data = {
		"angle": 30.0,
		"power": 60.0,
		"damage": 15
	}
	csm.update_opponent_state(move_data)

	csm.end_combat("player")

	if csm.combat_log.size() >= 3:
		_pass("test_combat_log_size")
	else:
		_fail("test_combat_log_size", "Should have at least 3 log entries")

	if csm.combat_log[0]["type"] == "player_move":
		_pass("test_combat_log_first_entry")
	else:
		_fail("test_combat_log_first_entry", "First entry should be player_move")

	if csm.combat_log[1]["type"] == "opponent_move":
		_pass("test_combat_log_second_entry")
	else:
		_fail("test_combat_log_second_entry", "Second entry should be opponent_move")

	if csm.combat_log[2]["type"] == "combat_end":
		_pass("test_combat_log_last_entry")
	else:
		_fail("test_combat_log_last_entry", "Last entry should be combat_end")

	csm.queue_free()

func test_polling_timer_cleanup() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")
	csm.end_combat("player")

	# Timer should be cleaned up after end_combat
	if csm._polling_timer == null:
		_pass("test_polling_timer_cleanup")
	else:
		_fail("test_polling_timer_cleanup", "Polling timer should be null after cleanup")

	csm.queue_free()

func test_health_changed_signal() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")

	var signals_received: Array = []

	csm.health_changed.connect(func(ph: int, oh: int): signals_received.append([ph, oh]))

	csm.apply_opponent_damage(25)

	if signals_received.size() > 0:
		_pass("test_health_changed_signal_emitted")
	else:
		_fail("test_health_changed_signal_emitted", "health_changed signal should emit")

	if signals_received.size() > 0 and signals_received[0][0] == 100 and signals_received[0][1] == 75:
		_pass("test_health_changed_signal_values")
	else:
		_fail("test_health_changed_signal_values", "Signal should contain correct health values")

	csm.queue_free()

func test_polling_timer_starts_on_combat() -> void:
	var csm = await _create_combat_sync_manager()

	if csm._polling_timer == null:
		_pass("test_polling_timer_initially_null")
	else:
		_fail("test_polling_timer_initially_null", "Timer should be null before combat")

	csm.start_combat("test_match")

	if csm._polling_timer != null:
		_pass("test_polling_timer_created_on_combat_start")
	else:
		_fail("test_polling_timer_created_on_combat_start", "Timer should be created on start_combat")

	csm.queue_free()

func test_update_opponent_state_no_damage() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")
	csm.send_move(45.0, 80.0)

	var move_data = {
		"angle": 30.0,
		"power": 60.0
	}

	var health_before = csm.player_health
	csm.update_opponent_state(move_data)

	if csm.player_health == health_before:
		_pass("test_update_opponent_state_no_damage")
	else:
		_fail("test_update_opponent_state_no_damage", "Health should not change without damage")

	csm.queue_free()

func test_update_opponent_state_empty() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")

	var initial_log_size = csm.combat_log.size()
	csm.update_opponent_state({})

	if csm.combat_log.size() == initial_log_size:
		_pass("test_update_opponent_state_empty_ignored")
	else:
		_fail("test_update_opponent_state_empty_ignored", "Empty opponent state should be ignored")

	csm.queue_free()

func test_end_combat_lethal_opponent() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")

	var signals_received: Array = []

	csm.combat_ended.connect(func(w: String): signals_received.append(w))

	csm.apply_opponent_damage(100)

	if csm.opponent_health == 0:
		_pass("test_end_combat_lethal_opponent_health")
	else:
		_fail("test_end_combat_lethal_opponent_health", "Opponent health should be 0")

	if signals_received.size() > 0 and signals_received[0] == "player":
		_pass("test_end_combat_lethal_opponent_ends_combat")
	else:
		_fail("test_end_combat_lethal_opponent_ends_combat", "Combat should end with player winner")

	csm.queue_free()

func test_end_combat_lethal_player() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match")

	var signals_received: Array = []

	csm.combat_ended.connect(func(w: String): signals_received.append(w))

	csm.apply_player_damage(100)

	if csm.player_health == 0:
		_pass("test_end_combat_lethal_player_health")
	else:
		_fail("test_end_combat_lethal_player_health", "Player health should be 0")

	if signals_received.size() > 0 and signals_received[0] == "opponent":
		_pass("test_end_combat_lethal_player_ends_combat")
	else:
		_fail("test_end_combat_lethal_player_ends_combat", "Combat should end with opponent winner")

	csm.queue_free()

func test_combat_log_cleared_on_restart() -> void:
	var csm = await _create_combat_sync_manager()
	csm.start_combat("test_match_1")
	csm.send_move(45.0, 80.0)

	var log_size_before = csm.combat_log.size()

	csm.start_combat("test_match_2")

	if csm.combat_log.size() < log_size_before:
		_pass("test_combat_log_cleared_on_restart")
	else:
		_fail("test_combat_log_cleared_on_restart", "Combat log should be cleared on restart")

	csm.queue_free()
