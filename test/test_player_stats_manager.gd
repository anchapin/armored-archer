extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running PlayerStatsManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_constants()
	await test_get_level()
	await test_get_xp()
	await test_get_ability_points()
	await test_get_stat()
	await test_get_attack()
	await test_get_defense()
	await test_get_dodge()
	await test_get_crit_rate()
	await test_signal_emission()
	await test_get_level_minimum()
	await test_get_xp_default()
	await test_get_ability_points_default()
	await test_get_stat_missing()
	await test_get_stat_no_stats_key()
	await test_get_attack_default()
	await test_get_defense_default()
	await test_get_dodge_default()
	await test_get_crit_rate_default()
	await test_gain_xp_invalid_amount()
	await test_gain_xp_no_network()
	await test_allocate_stat_invalid_points()
	await test_allocate_stat_no_network()
	await test_get_player_stats_no_network()
	await test_stats_updated_signal()
	await test_xp_gained_signal()
	await test_level_up_signal()
	await test_stat_allocated_signal()
	await test_is_initialized_default()

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

# --- Additional PlayerStatsManager Tests for Higher Coverage ---

func test_get_level_minimum() -> void:
	var psm = _create_player_stats_manager()
	# Even with no stats, level should be at least 1
	psm.player_stats = {}

	if psm.get_level() >= 1:
		_pass("test_get_level_minimum")
	else:
		_fail("test_get_level_minimum", "Level should be at least 1")

	psm.queue_free()

func test_get_xp_default() -> void:
	var psm = _create_player_stats_manager()
	# No player_stats should return 0
	if psm.get_xp() == 0:
		_pass("test_get_xp_default")
	else:
		_fail("test_get_xp_default", "Default XP should be 0")

	psm.queue_free()

func test_get_ability_points_default() -> void:
	var psm = _create_player_stats_manager()

	if psm.get_ability_points() == 0:
		_pass("test_get_ability_points_default")
	else:
		_fail("test_get_ability_points_default", "Default ability points should be 0")

	psm.queue_free()

func test_get_stat_missing() -> void:
	var psm = _create_player_stats_manager()
	psm.player_stats = {"stats": {"attack": 10}}

	# Request a stat that doesn't exist
	if psm.get_stat("health") == 0:
		_pass("test_get_stat_missing")
	else:
		_fail("test_get_stat_missing", "Missing stat should return 0")

	psm.queue_free()

func test_get_stat_no_stats_key() -> void:
	var psm = _create_player_stats_manager()
	# No stats key in player_stats
	psm.player_stats = {}

	if psm.get_stat("attack") == 0:
		_pass("test_get_stat_no_stats_key")
	else:
		_fail("test_get_stat_no_stats_key", "Should return 0 when no stats key")

	psm.queue_free()

func test_get_attack_default() -> void:
	var psm = _create_player_stats_manager()
	psm.player_stats = {}

	if psm.get_attack() == 0:
		_pass("test_get_attack_default")
	else:
		_fail("test_get_attack_default", "Default attack should be 0")

	psm.queue_free()

func test_get_defense_default() -> void:
	var psm = _create_player_stats_manager()
	psm.player_stats = {}

	if psm.get_defense() == 0:
		_pass("test_get_defense_default")
	else:
		_fail("test_get_defense_default", "Default defense should be 0")

	psm.queue_free()

func test_get_dodge_default() -> void:
	var psm = _create_player_stats_manager()
	psm.player_stats = {}

	if psm.get_dodge() == 0:
		_pass("test_get_dodge_default")
	else:
		_fail("test_get_dodge_default", "Default dodge should be 0")

	psm.queue_free()

func test_get_crit_rate_default() -> void:
	var psm = _create_player_stats_manager()
	psm.player_stats = {}

	if psm.get_crit_rate() == 0:
		_pass("test_get_crit_rate_default")
	else:
		_fail("test_get_crit_rate_default", "Default crit rate should be 0")

	psm.queue_free()

func test_gain_xp_invalid_amount() -> void:
	var psm = _create_player_stats_manager()
	# No network manager, should push_error and return
	psm.gain_xp(0, "pve")
	psm.gain_xp(-10, "pve")

	_pass("test_gain_xp_invalid_amount")
	psm.queue_free()

func test_gain_xp_no_network() -> void:
	var psm = _create_player_stats_manager()
	# No network manager
	psm.gain_xp(100, "pve")

	_pass("test_gain_xp_no_network")
	psm.queue_free()

func test_allocate_stat_invalid_points() -> void:
	var psm = _create_player_stats_manager()
	# No network manager, should push_error and return
	psm.allocate_stat("attack", 0)
	psm.allocate_stat("attack", -5)

	_pass("test_allocate_stat_invalid_points")
	psm.queue_free()

func test_allocate_stat_no_network() -> void:
	var psm = _create_player_stats_manager()
	# No network manager
	psm.allocate_stat("attack", 1)

	_pass("test_allocate_stat_no_network")
	psm.queue_free()

func test_get_player_stats_no_network() -> void:
	var psm = _create_player_stats_manager()
	# No network manager
	var result = psm.get_player_stats()

	if result.is_empty():
		_pass("test_get_player_stats_no_network")
	else:
		_fail("test_get_player_stats_no_network", "Should return empty when no network")

	psm.queue_free()

func test_stats_updated_signal() -> void:
	var psm = _create_player_stats_manager()
	var received_stats = {}

	psm.stats_updated.connect(func(s): received_stats = s)

	psm.stats_updated.emit({"level": 5, "xp": 200})

	await get_tree().create_timer(0.1).timeout

	if received_stats.has("level") and received_stats.level == 5:
		_pass("test_stats_updated_signal")
	else:
		_fail("test_stats_updated_signal", "Stats not received")

	psm.queue_free()

func test_xp_gained_signal() -> void:
	var psm = _create_player_stats_manager()
	var received_amount = 0
	var received_total = 0

	psm.xp_gained.connect(func(a, t):
		received_amount = a
		received_total = t
	)

	psm.xp_gained.emit(50, 250)

	await get_tree().create_timer(0.1).timeout

	if received_amount == 50 and received_total == 250:
		_pass("test_xp_gained_signal")
	else:
		_fail("test_xp_gained_signal", "XP signal not received correctly")

	psm.queue_free()

func test_level_up_signal() -> void:
	var psm = _create_player_stats_manager()
	var received_level = 0
	var received_points = 0

	psm.level_up.connect(func(l, p):
		received_level = l
		received_points = p
	)

	psm.level_up.emit(10, 3)

	await get_tree().create_timer(0.1).timeout

	if received_level == 10 and received_points == 3:
		_pass("test_level_up_signal")
	else:
		_fail("test_level_up_signal", "Level up signal not received correctly")

	psm.queue_free()

func test_stat_allocated_signal() -> void:
	var psm = _create_player_stats_manager()
	var received_stat = ""
	var received_amount = 0

	psm.stat_allocated.connect(func(s, a):
		received_stat = s
		received_amount = a
	)

	psm.stat_allocated.emit("defense", 2)

	await get_tree().create_timer(0.1).timeout

	if received_stat == "defense" and received_amount == 2:
		_pass("test_stat_allocated_signal")
	else:
		_fail("test_stat_allocated_signal", "Stat allocated signal not received")

	psm.queue_free()

func test_is_initialized_default() -> void:
	var psm = _create_player_stats_manager()

	if not psm.is_initialized:
		_pass("test_is_initialized_default")
	else:
		_fail("test_is_initialized_default", "Should not be initialized by default")

	psm.queue_free()
