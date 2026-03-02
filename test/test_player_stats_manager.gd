extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running PlayerStatsManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	test_initial_state()
	test_constants()
	test_get_level()
	test_get_xp()
	test_get_ability_points()
	test_get_stat()
	test_get_attack()
	test_get_defense()
	test_get_dodge()
	test_get_crit_rate()
	test_signal_emission()
	
	print("\n=== PlayerStatsManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_player_stats_manager() -> Node:
	var psm = load("res://autoloads/PlayerStatsManager.gd").new()
	add_child(psm)
	return psm

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var psm = _create_player_stats_manager()
	
	if psm.player_stats.is_empty() and not psm.is_initialized:
		_pass("test_initial_state")
	else:
		_fail("test_initial_state", "Initial state should be empty")
	
	psm.queue_free()

func test_constants() -> void:
	var psm = _create_player_stats_manager()
	
	if psm.RPC_GAIN_XP == "armored_archer/gain_xp":
		_pass("test_constants_rpc_gain_xp")
	else:
		_fail("test_constants_rpc_gain_xp", "RPC_GAIN_XP should match")
	
	if psm.RPC_ALLOCATE_STATS == "armored_archer/allocate_stats":
		_pass("test_constants_rpc_allocate_stats")
	else:
		_fail("test_constants_rpc_allocate_stats", "RPC_ALLOCATE_STATS should match")
	
	if psm.RPC_GET_PLAYER_STATS == "armored_archer/get_player_stats":
		_pass("test_constants_rpc_get_player_stats")
	else:
		_fail("test_constants_rpc_get_player_stats", "RPC_GET_PLAYER_STATS should match")
	
	psm.queue_free()

func test_get_level() -> void:
	var psm = _create_player_stats_manager()
	
	if psm.get_level() == 1:
		_pass("test_get_level_default")
	else:
		_fail("test_get_level_default", "Default level should be 1")
	
	psm.player_stats = {"level": 10, "xp": 500}
	if psm.get_level() == 10:
		_pass("test_get_level_with_stats")
	else:
		_fail("test_get_level_with_stats", "Level should be 10")
	
	psm.queue_free()

func test_get_xp() -> void:
	var psm = _create_player_stats_manager()
	
	if psm.get_xp() == 0:
		_pass("test_get_xp_default")
	else:
		_fail("test_get_xp_default", "Default XP should be 0")
	
	psm.player_stats = {"level": 1, "xp": 250}
	if psm.get_xp() == 250:
		_pass("test_get_xp_with_stats")
	else:
		_fail("test_get_xp_with_stats", "XP should be 250")
	
	psm.queue_free()

func test_get_ability_points() -> void:
	var psm = _create_player_stats_manager()
	
	if psm.get_ability_points() == 0:
		_pass("test_get_ability_points_default")
	else:
		_fail("test_get_ability_points_default", "Default ability points should be 0")
	
	psm.player_stats = {"level": 5, "xp": 100, "ability_points": 3}
	if psm.get_ability_points() == 3:
		_pass("test_get_ability_points_with_stats")
	else:
		_fail("test_get_ability_points_with_stats", "Ability points should be 3")
	
	psm.queue_free()

func test_get_stat() -> void:
	var psm = _create_player_stats_manager()
	
	if psm.get_stat("attack") == 0:
		_pass("test_get_stat_default")
	else:
		_fail("test_get_stat_default", "Default stat should be 0")
	
	psm.player_stats = {"stats": {"attack": 15, "defense": 10}}
	if psm.get_stat("attack") == 15:
		_pass("test_get_stat_with_stats")
	else:
		_fail("test_get_stat_with_stats", "Attack should be 15")
	
	psm.queue_free()

func test_get_attack() -> void:
	var psm = _create_player_stats_manager()
	psm.player_stats = {"stats": {"attack": 20}}
	
	if psm.get_attack() == 20:
		_pass("test_get_attack")
	else:
		_fail("test_get_attack", "Attack should be 20")
	
	psm.queue_free()

func test_get_defense() -> void:
	var psm = _create_player_stats_manager()
	psm.player_stats = {"stats": {"defense": 15}}
	
	if psm.get_defense() == 15:
		_pass("test_get_defense")
	else:
		_fail("test_get_defense", "Defense should be 15")
	
	psm.queue_free()

func test_get_dodge() -> void:
	var psm = _create_player_stats_manager()
	psm.player_stats = {"stats": {"dodge": 5}}
	
	if psm.get_dodge() == 5:
		_pass("test_get_dodge")
	else:
		_fail("test_get_dodge", "Dodge should be 5")
	
	psm.queue_free()

func test_get_crit_rate() -> void:
	var psm = _create_player_stats_manager()
	psm.player_stats = {"stats": {"crit_rate": 10}}
	
	if psm.get_crit_rate() == 10:
		_pass("test_get_crit_rate")
	else:
		_fail("test_get_crit_rate", "Crit rate should be 10")
	
	psm.queue_free()

func test_signal_emission() -> void:
	var psm = _create_player_stats_manager()
	var stats_updated_received = false
	var xp_gained_received = false
	var level_up_received = false
	var stat_allocated_received = false
	
	psm.stats_updated.connect(func(s): stats_updated_received = true)
	psm.xp_gained.connect(func(a, t): xp_gained_received = true)
	psm.level_up.connect(func(l, p): level_up_received = true)
	psm.stat_allocated.connect(func(s, a): stat_allocated_received = true)
	
	psm.stats_updated.emit({})
	psm.xp_gained.emit(100, 500)
	psm.level_up.emit(5, 2)
	psm.stat_allocated.emit("attack", 1)
	
	await get_tree().create_timer(0.1).timeout
	
	if stats_updated_received and xp_gained_received and level_up_received and stat_allocated_received:
		_pass("test_signal_emission")
	else:
		_fail("test_signal_emission", "All signals should be emitted")
	
	psm.queue_free()
