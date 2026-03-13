extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running GameManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	test_initial_state()
	test_take_player_damage()
	test_heal_player()
	test_start_game()
	test_end_game_won()
	test_end_game_lost()
	test_complete_stage()
	test_reset_stage()
	test_signal_emission()
	test_health_boundaries()

	print("\n=== GameManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_game_manager() -> Node:
	var gm = load("res://autoloads/GameManager.gd").new()
	add_child(gm)
	return gm

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var gm = _create_game_manager()

	if gm.player_current_health == 100 and gm.player_max_health == 100:
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Initial health should be 100")

	if gm.current_stage == 1:
		_pass("test_initial_stage")
	else:
		_fail("test_initial_stage", "Initial stage should be 1")

	if gm.is_game_active:
		_pass("test_initial_game_active")
	else:
		_fail("test_initial_game_active", "Game should be active")

	gm.queue_free()

func test_take_player_damage() -> void:
	var gm = _create_game_manager()
	gm.player_current_health = 100

	gm.take_player_damage(30)

	if gm.player_current_health == 70:
		_pass("test_take_player_damage")
	else:
		_fail("test_take_player_damage", "Health should decrease")

	gm.queue_free()

func test_take_player_damage_excess() -> void:
	var gm = _create_game_manager()
	gm.player_current_health = 10

	gm.take_player_damage(50)

	if gm.player_current_health == 0:
		_pass("test_take_player_damage_excess")
	else:
		_fail("test_take_player_damage_excess", "Health should not go below 0")

	gm.queue_free()

func test_heal_player() -> void:
	var gm = _create_game_manager()
	gm.player_current_health = 50

	gm.heal_player(30)

	if gm.player_current_health == 80:
		_pass("test_heal_player")
	else:
		_fail("test_heal_player", "Health should increase")

	gm.queue_free()

func test_heal_player_excess() -> void:
	var gm = _create_game_manager()
	gm.player_current_health = 90

	gm.heal_player(50)

	if gm.player_current_health == 100:
		_pass("test_heal_player_excess")
	else:
		_fail("test_heal_player_excess", "Health should not exceed max")

	gm.queue_free()

func test_start_game() -> void:
	var gm = _create_game_manager()
	gm.player_current_health = 10
	gm.is_game_active = false

	gm.start_game()

	if gm.player_current_health == 100 and gm.is_game_active:
		_pass("test_start_game")
	else:
		_fail("test_start_game", "Game should start with full health")

	gm.queue_free()

func test_end_game_won() -> void:
	var gm = _create_game_manager()
	gm.is_game_active = true
	gm.current_stage_id = "stage_1"

	var game_won_emitted = false
	gm.game_won.connect(func(): game_won_emitted = true)

	gm.end_game(true)

	if not gm.is_game_active and game_won_emitted:
		_pass("test_end_game_won")
	else:
		_fail("test_end_game_won", "Game should end and emit won signal")

	gm.queue_free()

func test_end_game_lost() -> void:
	var gm = _create_game_manager()
	gm.is_game_active = true

	var player_died_emitted = false
	gm.player_died.connect(func(): player_died_emitted = true)

	gm.end_game(false)

	if not gm.is_game_active and player_died_emitted:
		_pass("test_end_game_lost")
	else:
		_fail("test_end_game_lost", "Game should end and emit died signal")

	gm.queue_free()

func test_complete_stage() -> void:
	var gm = _create_game_manager()
	gm.current_stage = 1
	gm.is_game_active = true

	gm.complete_stage()

	if gm.current_stage == 2:
		_pass("test_complete_stage")
	else:
		_fail("test_complete_stage", "Stage should increment")

	gm.queue_free()

func test_reset_stage() -> void:
	var gm = _create_game_manager()
	gm.current_stage = 5
	gm.player_current_health = 10
	gm.is_game_active = false

	gm.reset_stage()

	if gm.current_stage == 1 and gm.player_current_health == 100 and gm.is_game_active:
		_pass("test_reset_stage")
	else:
		_fail("test_reset_stage", "Stage should reset")

	gm.queue_free()

func test_signal_emission() -> void:
	var gm = _create_game_manager()
	var health_changed = false
	var player_died = false
	var game_won = false
	var stage_completed = false

	gm.health_changed.connect(func(n, m): health_changed = true)
	gm.player_died.connect(func(): player_died = true)
	gm.game_won.connect(func(): game_won = true)
	gm.stage_completed.connect(func(s): stage_completed = true)

	gm.health_changed.emit(50, 100)
	gm.player_died.emit()
	gm.game_won.emit()
	gm.stage_completed.emit("stage_1")

	await get_tree().create_timer(0.1).timeout

	if health_changed and player_died and game_won and stage_completed:
		_pass("test_signal_emission")
	else:
		_fail("test_signal_emission", "All signals should be emitted")

	gm.queue_free()

func test_health_boundaries() -> void:
	var gm = _create_game_manager()
	gm.player_current_health = 0

	gm.take_player_damage(10)
	if gm.player_current_health == 0:
		_pass("test_health_min_boundary")
	else:
		_fail("test_health_min_boundary", "Health should stay at 0")

	gm.player_current_health = 100
	gm.heal_player(10)
	if gm.player_current_health == 100:
		_pass("test_health_max_boundary")
	else:
		_fail("test_health_max_boundary", "Health should stay at max")

	gm.queue_free()

func test_damage_inactive_game() -> void:
	var gm = _create_game_manager()
	gm.player_current_health = 100
	gm.is_game_active = false

	gm.take_player_damage(50)

	if gm.player_current_health == 100:
		_pass("test_damage_inactive_game")
	else:
		_fail("test_damage_inactive_game", "Health should not change when inactive")

	gm.queue_free()
