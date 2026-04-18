extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running SeasonManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	await test_initial_state()
	await test_constants()
	await test_signals_exist()
	await test_get_current_season()
	await test_get_player_rank_sync()
	await test_get_player_score_sync()
	await test_get_time_remaining()
	await test_get_leaderboard_sync()
	await test_get_rewards_sync()
	await test_is_rewards_claimed()
	await test_format_time_remaining()
	await test_get_rank_tier()
	await test_get_rank_color()
	await test_soft_reset_elo()
	await test_prestige_initial_state()
	await test_projected_elo_initial_state()
	await test_new_signals_exist()
	await test_prestige_sync()
	await test_projected_elo_sync()

	print("\n=== SeasonManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_season_manager() -> Node:
	var sm = load("res://autoloads/SeasonManager.gd").new()
	add_child(sm)
	return sm

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var sm = _create_season_manager()

	if sm.current_season.is_empty():
		_pass("test_initial_season_empty")
	else:
		_fail("test_initial_season_empty", "Initial season should be empty")

	if sm.player_rank == 0:
		_pass("test_initial_rank_zero")
	else:
		_fail("test_initial_rank_zero", "Initial rank should be 0")

	if sm.player_score == 0:
		_pass("test_initial_score_zero")
	else:
		_fail("test_initial_score_zero", "Initial score should be 0")

	sm.queue_free()

func test_constants() -> void:
	var sm = _create_season_manager()

	if sm.RPC_GET_SEASON_INFO == "armored_archer/get_season_info":
		_pass("test_rpc_season_info")
	else:
		_fail("test_rpc_season_info", "RPC_GET_SEASON_INFO mismatch")

	if sm.RPC_GET_LEADERBOARD == "armored_archer/get_leaderboard":
		_pass("test_rpc_leaderboard")
	else:
		_fail("test_rpc_leaderboard", "RPC_GET_LEADERBOARD mismatch")

	if sm.RPC_UPDATE_RANK == "armored_archer/update_rank":
		_pass("test_rpc_update_rank")
	else:
		_fail("test_rpc_update_rank", "RPC_UPDATE_RANK mismatch")

	sm.queue_free()

func test_signals_exist() -> void:
	var sm = _create_season_manager()

	if sm.has_signal("season_info_loaded"):
		_pass("test_signal_season_info")
	else:
		_fail("test_signal_season_info", "Should have season_info_loaded")

	if sm.has_signal("leaderboard_loaded"):
		_pass("test_signal_leaderboard")
	else:
		_fail("test_signal_leaderboard", "Should have leaderboard_loaded")

	if sm.has_signal("rank_updated"):
		_pass("test_signal_rank")
	else:
		_fail("test_signal_rank", "Should have rank_updated")

	if sm.has_signal("rewards_loaded"):
		_pass("test_signal_rewards")
	else:
		_fail("test_signal_rewards", "Should have rewards_loaded")

	if sm.has_signal("rewards_claimed"):
		_pass("test_signal_rewards_claimed")
	else:
		_fail("test_signal_rewards_claimed", "Should have rewards_claimed")

	sm.queue_free()

func test_get_current_season() -> void:
	var sm = _create_season_manager()

	sm.current_season = {"id": "season_1", "name": "Test Season"}
	var season = sm.get_current_season()

	if season.has("id"):
		_pass("test_get_current_season")
	else:
		_fail("test_get_current_season", "Should return current season")

	sm.queue_free()

func test_get_player_rank_sync() -> void:
	var sm = _create_season_manager()
	sm.player_rank = 42

	var rank = sm.get_player_rank_sync()

	if rank == 42:
		_pass("test_get_player_rank_sync")
	else:
		_fail("test_get_player_rank_sync", "Should return player rank")

	sm.queue_free()

func test_get_player_score_sync() -> void:
	var sm = _create_season_manager()
	sm.player_score = 1500

	var score = sm.get_player_score_sync()

	if score == 1500:
		_pass("test_get_player_score_sync")
	else:
		_fail("test_get_player_score_sync", "Should return player score")

	sm.queue_free()

func test_get_time_remaining() -> void:
	var sm = _create_season_manager()
	sm.time_remaining = 7200000  # 2 hours in ms

	var time = sm.get_time_remaining()

	if time == 7200000:
		_pass("test_get_time_remaining")
	else:
		_fail("test_get_time_remaining", "Should return time remaining")

	sm.queue_free()

func test_get_leaderboard_sync() -> void:
	var sm = _create_season_manager()
	sm.leaderboard = [{"name": "Player1", "score": 1000}]

	var lb = sm.get_leaderboard_sync()

	if lb.size() == 1:
		_pass("test_get_leaderboard_sync")
	else:
		_fail("test_get_leaderboard_sync", "Should return leaderboard")

	sm.queue_free()

func test_get_rewards_sync() -> void:
	var sm = _create_season_manager()
	sm.season_rewards = {"rank_1": {"gems": 100}}

	var rewards = sm.get_rewards_sync()

	if rewards.has("rank_1"):
		_pass("test_get_rewards_sync")
	else:
		_fail("test_get_rewards_sync", "Should return rewards")

	sm.queue_free()

func test_is_rewards_claimed() -> void:
	var sm = _create_season_manager()

	if not sm.is_rewards_claimed():
		_pass("test_is_rewards_claimed_false")
	else:
		_fail("test_is_rewards_claimed_false", "Should be false initially")

	sm.rewards_claimed = true

	if sm.is_rewards_claimed():
		_pass("test_is_rewards_claimed_true")
	else:
		_fail("test_is_rewards_claimed_true", "Should be true after claiming")

	sm.queue_free()

func test_format_time_remaining() -> void:
	var sm = _create_season_manager()

	# Test days format
	sm.time_remaining = 172800000  # 2 days in ms
	if sm.format_time_remaining() == "2d 0h":
		_pass("test_format_days")
	else:
		_fail("test_format_days", "Should format days correctly")

	# Test hours format
	sm.time_remaining = 12600000  # 3.5 hours in ms (3h 30m)
	if "h" in sm.format_time_remaining():
		_pass("test_format_hours")
	else:
		_fail("test_format_hours", "Should format hours correctly")

	# Test minutes format
	sm.time_remaining = 2700000  # 45 minutes in ms
	if sm.format_time_remaining() == "45m":
		_pass("test_format_minutes")
	else:
		_fail("test_format_minutes", "Should format minutes correctly")

	sm.queue_free()

func test_get_rank_tier() -> void:
	var sm = _create_season_manager()

	if sm.get_rank_tier(1) == "Legendary":
		_pass("test_rank_legendary")
	else:
		_fail("test_rank_legendary", "Rank 1 should be Legendary")

	if sm.get_rank_tier(25) == "Epic":
		_pass("test_rank_epic")
	else:
		_fail("test_rank_epic", "Rank 25 should be Epic")

	if sm.get_rank_tier(75) == "Rare":
		_pass("test_rank_rare")
	else:
		_fail("test_rank_rare", "Rank 75 should be Rare")

	if sm.get_rank_tier(250) == "Uncommon":
		_pass("test_rank_uncommon")
	else:
		_fail("test_rank_uncommon", "Rank 250 should be Uncommon")

	if sm.get_rank_tier(1000) == "Common":
		_pass("test_rank_common")
	else:
		_fail("test_rank_common", "Rank 1000 should be Common")

	sm.queue_free()

func test_get_rank_color() -> void:
	var sm = _create_season_manager()

	var color = sm.get_rank_color(1)
	if color == Color.ORANGE:
		_pass("test_rank_color_legendary")
	else:
		_fail("test_rank_color_legendary", "Legendary should be orange")

	color = sm.get_rank_color(25)
	if color == Color.MAGENTA:
		_pass("test_rank_color_epic")
	else:
		_fail("test_rank_color_epic", "Epic should be magenta")

	color = sm.get_rank_color(75)
	if color == Color.BLUE:
		_pass("test_rank_color_rare")
	else:
		_fail("test_rank_color_rare", "Rare should be blue")

	color = sm.get_rank_color(250)
	if color == Color.GREEN:
		_pass("test_rank_color_uncommon")
	else:
		_fail("test_rank_color_uncommon", "Uncommon should be green")

	color = sm.get_rank_color(1000)
	if color == Color.GRAY:
		_pass("test_rank_color_common")
	else:
		_fail("test_rank_color_common", "Common should be gray")

	sm.queue_free()

func test_soft_reset_elo() -> void:
	var sm = _create_season_manager()

	# Test Legendary tier (rank 1-10)
	if sm.calculate_soft_reset_elo(1) == 1300:
		_pass("test_soft_reset_legendary_1")
	else:
		_fail("test_soft_reset_legendary_1", "Rank 1 should project 1300")

	if sm.calculate_soft_reset_elo(10) == 1300:
		_pass("test_soft_reset_legendary_10")
	else:
		_fail("test_soft_reset_legendary_10", "Rank 10 should project 1300")

	# Test Epic tier (rank 11-50)
	if sm.calculate_soft_reset_elo(11) == 1200:
		_pass("test_soft_reset_epic_11")
	else:
		_fail("test_soft_reset_epic_11", "Rank 11 should project 1200")

	if sm.calculate_soft_reset_elo(50) == 1200:
		_pass("test_soft_reset_epic_50")
	else:
		_fail("test_soft_reset_epic_50", "Rank 50 should project 1200")

	# Test Rare tier (rank 51-100)
	if sm.calculate_soft_reset_elo(51) == 1150:
		_pass("test_soft_reset_rare_51")
	else:
		_fail("test_soft_reset_rare_51", "Rank 51 should project 1150")

	if sm.calculate_soft_reset_elo(100) == 1150:
		_pass("test_soft_reset_rare_100")
	else:
		_fail("test_soft_reset_rare_100", "Rank 100 should project 1150")

	# Test Uncommon tier (rank 101-500)
	if sm.calculate_soft_reset_elo(101) == 1100:
		_pass("test_soft_reset_uncommon_101")
	else:
		_fail("test_soft_reset_uncommon_101", "Rank 101 should project 1100")

	if sm.calculate_soft_reset_elo(500) == 1100:
		_pass("test_soft_reset_uncommon_500")
	else:
		_fail("test_soft_reset_uncommon_500", "Rank 500 should project 1100")

	# Test Common tier (rank 501+)
	if sm.calculate_soft_reset_elo(501) == 1000:
		_pass("test_soft_reset_common_501")
	else:
		_fail("test_soft_reset_common_501", "Rank 501 should project 1000")

	sm.queue_free()

func test_prestige_initial_state() -> void:
	var sm = _create_season_manager()

	if sm.prestige_progress.has("tiers_earned"):
		_pass("test_prestige_has_tiers_earned")
	else:
		_fail("test_prestige_has_tiers_earned", "Should have tiers_earned key")

	if sm.prestige_progress.get("tiers_earned", []).is_empty():
		_pass("test_prestige_initially_empty")
	else:
		_fail("test_prestige_initially_empty", "tiers_earned should start empty")

	sm.queue_free()

func test_projected_elo_initial_state() -> void:
	var sm = _create_season_manager()

	if sm.projected_next_season_elo == 1000:
		_pass("test_projected_elo_default")
	else:
		_fail("test_projected_elo_default", "Projected ELO should default to 1000")

	if sm.current_tier_name == "Unranked":
		_pass("test_current_tier_default")
	else:
		_fail("test_current_tier_default", "Current tier should default to Unranked")

	sm.queue_free()

func test_new_signals_exist() -> void:
	var sm = _create_season_manager()

	if sm.has_signal("prestige_progress_loaded"):
		_pass("test_signal_prestige_progress")
	else:
		_fail("test_signal_prestige_progress", "Should have prestige_progress_loaded signal")

	if sm.has_signal("projected_elo_loaded"):
		_pass("test_signal_projected_elo")
	else:
		_fail("test_signal_projected_elo", "Should have projected_elo_loaded signal")

	sm.queue_free()

func test_prestige_sync() -> void:
	var sm = _create_season_manager()

	var progress = sm.get_prestige_progress_sync()
	if progress.has("tiers_earned"):
		_pass("test_prestige_sync_returns_data")
	else:
		_fail("test_prestige_sync_returns_data", "Should return prestige data")

	sm.queue_free()

func test_projected_elo_sync() -> void:
	var sm = _create_season_manager()
	sm.projected_next_season_elo = 1200

	var elo = sm.get_projected_elo_sync()
	if elo == 1200:
		_pass("test_projected_elo_sync")
	else:
		_fail("test_projected_elo_sync", "Should return cached projected ELO")

	sm.queue_free()
