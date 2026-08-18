extends GutTest

var CombatSyncManagerClass = load("res://autoloads/CombatSyncManager.gd")

func before_each():
	super.before_each()
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)

func test_combat_sync_manager_initializes():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	assert_true(csm != null, "CombatSyncManager should instantiate")
	assert_true(csm.has_method("start_combat"), "Should have start_combat method")
	assert_true(csm.has_method("send_move"), "Should have send_move method")
	assert_true(csm.has_method("end_combat"), "Should have end_combat method")
	assert_true(csm.has_method("apply_opponent_damage"), "Should have apply_opponent_damage method")
	assert_true(csm.has_method("apply_player_damage"), "Should have apply_player_damage method")

func test_signals_exist():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	assert_true(csm.has_signal("opponent_moved"), "Should have opponent_moved signal")
	assert_true(csm.has_signal("health_changed"), "Should have health_changed signal")
	assert_true(csm.has_signal("combat_ended"), "Should have combat_ended signal")
	assert_true(csm.has_signal("combat_started"), "Should have combat_started signal")

func test_initial_state():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	assert_eq(csm.player_health, 100, "Should start with 100 player health")
	assert_eq(csm.opponent_health, 100, "Should start with 100 opponent health")
	assert_true(csm.combat_log.is_empty(), "Should start with empty combat log")
	assert_true(csm.current_match_id.is_empty(), "Should start with empty match ID")
	assert_false(csm.is_combat_active, "Should not be combat active initially")

func test_start_combat():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	csm.start_combat("test_match_123")
	assert_true(csm.is_combat_active, "Should be combat active after start")
	assert_eq(csm.current_match_id, "test_match_123", "Should set match ID")
	assert_eq(csm.player_health, 100, "Should reset player health")
	assert_eq(csm.opponent_health, 100, "Should reset opponent health")
	assert_true(csm.is_my_turn, "Player should have first turn")

func test_get_current_turn():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	csm.start_combat("test_match")
	var turn = csm.get_current_turn()
	assert_eq(turn, "player", "Should be player's turn after start_combat")
	csm.send_move(0.5, 0.8)
	assert_eq(csm.get_current_turn(), "opponent", "Should be opponent's turn after player sends a move")

func test_apply_opponent_damage():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	csm.apply_opponent_damage(25)
	assert_eq(csm.opponent_health, 75, "Should reduce opponent health")

func test_apply_opponent_damage_to_zero():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	csm.apply_opponent_damage(100)
	assert_eq(csm.opponent_health, 0, "Should not go below zero")

func test_apply_player_damage():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	csm.apply_player_damage(30)
	assert_eq(csm.player_health, 70, "Should reduce player health")

func test_apply_player_damage_to_zero():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	csm.apply_player_damage(100)
	assert_eq(csm.player_health, 0, "Should not go below zero")

func test_send_move_records_log():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	csm.start_combat("test_match")
	csm.send_move(0.5, 0.8)
	assert_true(csm.combat_log.size() > 0, "Should record move in combat log")
	assert_false(csm.is_my_turn, "Should not be my turn after sending move")

func test_update_opponent_state():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	csm.start_combat("test_match")
	csm.update_opponent_state({
		"angle": 0.7,
		"power": 0.9,
		"damage": 15
	})
	assert_eq(csm.player_health, 85, "Should apply opponent damage")
	assert_true(csm.is_my_turn, "Should be my turn after opponent moves")
	assert_true(csm.combat_log.size() > 0, "Should log opponent move")

func test_combat_log_entry_types():
	var csm = CombatSyncManagerClass.new()
	add_child_autofree(csm)
	csm.start_combat("test_match")
	csm.send_move(0.5, 0.8)
	var last_entry = csm.combat_log[csm.combat_log.size() - 1]
	assert_eq(last_entry.get("type"), "player_move", "Should log player moves")
