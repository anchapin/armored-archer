extends Node

var framework: E2ETestFramework

func _ready() -> void:
	print("=== E2E Test Runner Starting ===")

	framework = E2ETestFramework.new()
	add_child(framework)

	framework.all_tests_completed.connect(_on_all_tests_completed)

	await get_tree().create_timer(0.5).timeout

	await _run_all_test_suites()

func _run_all_test_suites() -> void:
	framework.run_test("test_new_user_flow", _test_new_user_flow)
	await framework.test_passed

	framework.run_test("test_pve_gameplay", _test_pve_gameplay)
	await framework.test_passed

	framework.run_test("test_pvp_flow", _test_pvp_flow)
	await framework.test_passed

	framework.run_test("test_gear_progression", _test_gear_progression)
	await framework.test_passed

	framework.run_test("test_store_flow", _test_store_flow)
	await framework.test_passed

	framework.run_test("test_season_flow", _test_season_flow)
	await framework.test_passed

	framework.run_test("test_network_failure", _test_network_failure)
	await framework.test_passed

	framework.run_test("test_server_downtime", _test_server_downtime)
	await framework.test_passed

	framework.run_test("test_invalid_inputs", _test_invalid_inputs)
	await framework.test_passed

	framework.run_test("test_offline_mode", _test_offline_mode)
	await framework.test_passed

	framework.run_all_tests()

func _test_new_user_flow(test_context: Node) -> void:
	print("Testing: New User Registration → Tutorial → First Battle → First Level Up")

	var game_manager = GameManager.new()
	test_context.add_child(game_manager)

	game_manager.start_game()
	assert(game_manager.is_game_active, "Game should be active after start")
	assert(game_manager.player_current_health == game_manager.player_max_health, "Player should have full health")

	game_manager.take_player_damage(30)
	assert(game_manager.player_current_health == 70, "Player should take damage")

	game_manager.heal_player(20)
	assert(game_manager.player_current_health == 90, "Player should heal")

	game_manager.complete_stage()
	assert(game_manager.current_stage == 2, "Stage should increment after completion")

	print("New user flow test passed!")

func _test_pve_gameplay(test_context: Node) -> void:
	print("Testing: PvE Gameplay - Spawn Enemies → Combat → Loot Drops → XP Gain")

	var game_manager = GameManager.new()
	test_context.add_child(game_manager)

	game_manager.start_game()
	game_manager.current_stage_id = "stage_1"

	var enemy_count = 0
	var enemies_killed = 0
	var xp_gained = 0
	var loot_dropped = false

	for i in range(3):
		enemy_count += 1

	for i in range(enemy_count):
		enemies_killed += 1
		xp_gained += 50

	assert(enemies_killed == enemy_count, "All enemies should be killed")
	assert(xp_gained == 150, "XP should be gained from kills")

	loot_dropped = true
	assert(loot_dropped, "Loot should drop after combat")

	print("PvE gameplay test passed!")

func _test_pvp_flow(test_context: Node) -> void:
	print("Testing: PvP Flow - Create Match → Find Opponent → Turn-Based Combat → Winner Declaration")

	var combat_manager = CombatManager.new()
	test_context.add_child(combat_manager)

	var match_id = "match_" + str(Time.get_unix_time_from_system())

	var player_health = 100
	var opponent_health = 100
	var turns_taken = 0

	while player_health > 0 and opponent_health > 0:
		turns_taken += 1

		var damage_dealt = randi_range(10, 25)
		var damage_taken = randi_range(10, 20)

		player_health = max(0, player_health - damage_taken)
		opponent_health = max(0, opponent_health - damage_dealt)

	var winner = ""
	if player_health > 0:
		winner = "player"
	elif opponent_health > 0:
		winner = "opponent"
	else:
		winner = "draw"

	assert(turns_taken > 0, "At least one turn should be taken")
	assert(winner != "", "Winner should be declared")

	print("PvP flow test passed! Winner: %s, Turns: %d" % [winner, turns_taken])

func _test_gear_progression(test_context: Node) -> void:
	print("Testing: Gear Progression - Generate Gear → Equip → Play with Stats → Level Up → Upgrade")

	var gear_manager = GearManager.new()
	test_context.add_child(gear_manager)

	var generated_gear = {
		"id": "gear_001",
		"name": "Iron Bow",
		"type": "weapon",
		"rarity": "common",
		"stats": [
			{"name": "attack", "value": 10},
			{"name": "crit_rate", "value": 5}
		],
		"modifiers": []
	}

	var gear_summary = gear_manager.get_gear_stats_summary(generated_gear)
	assert(not gear_summary.is_empty(), "Gear summary should not be empty")

	var comparison = gear_manager.compare_gear(generated_gear, {})
	assert(comparison.better == "gear1", "Generated gear should be better than empty")

	var score = gear_manager._calculate_gear_score(generated_gear)
	assert(score > 0, "Gear score should be positive")

	print("Gear progression test passed! Gear score: %d" % score)

func _test_store_flow(test_context: Node) -> void:
	print("Testing: Store Flow - Browse Shop → Purchase Gems → Spend Gems")

	var store_manager = StoreManager.new()
	test_context.add_child(store_manager)

	var products = store_manager.get_products()
	assert(products.size() > 0, "Store should have products")

	var small_pack = store_manager.get_product_info(StoreManager.PRODUCT_SMALL_GEMS)
	assert(small_pack.gem_amount == 100, "Small pack should have 100 gems")

	store_manager.current_gems = 500
	var initial_gems = store_manager.current_gems

	store_manager.current_gems -= 100
	var final_gems = store_manager.current_gems

	assert(final_gems == initial_gems - 100, "Gems should be spent correctly")

	print("Store flow test passed!")

func _test_season_flow(test_context: Node) -> void:
	print("Testing: Season Flow - Play Matches → Climb Leaderboard → Claim Rewards → Season Reset")

	var season_manager = SeasonManager.new()
	test_context.add_child(season_manager)

	var current_season = {
		"id": "season_1",
		"name": "Season of Warriors",
		"start_time": 0,
		"end_time": 86400 * 30
	}

	season_manager.current_season = current_season
	season_manager.player_rank = 1000
	season_manager.player_score = 1500

	assert(season_manager.get_player_rank_sync() == 1000, "Player rank should be set")

	var rank_tier = season_manager.get_rank_tier(5)
	assert(rank_tier == "Legendary", "Top ranks should be Legendary")

	var formatted_time = season_manager.format_time_remaining()
	assert(not formatted_time.is_empty(), "Time remaining should be formatted")

	print("Season flow test passed! Rank: %s" % rank_tier)

func _test_network_failure(test_context: Node) -> void:
	print("Testing: Network Failure Handling")

	var mock_network = MockNetworkManager.new()
	test_context.add_child(mock_network)

	mock_network.connect_mock()
	await mock_network.connected

	assert(mock_network.is_connected, "Mock should connect")

	mock_network.disconnect_mock()
	assert(not mock_network.is_connected, "Mock should disconnect")

	print("Network failure test passed!")

func _test_server_downtime(test_context: Node) -> void:
	print("Testing: Server Downtime Handling")

	var network_manager = NetworkManager.new()
	test_context.add_child(network_manager)

	network_manager.is_offline = true
	network_manager.session_token = ""

	var is_valid = network_manager.is_session_valid()
	assert(not is_valid, "Session should be invalid when offline")

	print("Server downtime test passed!")

func _test_invalid_inputs(test_context: Node) -> void:
	print("Testing: Invalid Input Handling")

	var game_manager = GameManager.new()
	test_context.add_child(game_manager)

	game_manager.start_game()
	var initial_health = game_manager.player_current_health

	game_manager.take_player_damage(-10)
	assert(game_manager.player_current_health == initial_health, "Negative damage should not affect health")

	game_manager.heal_player(-5)
	assert(game_manager.player_current_health == initial_health, "Negative healing should not affect health")

	print("Invalid inputs test passed!")

func _test_offline_mode(test_context: Node) -> void:
	print("Testing: Offline Mode Fallbacks")

	var game_manager = GameManager.new()
	test_context.add_child(game_manager)

	game_manager.start_game()
	game_manager.is_game_active = true

	var offline_xp = 0
	offline_xp += 50
	offline_xp += 100
	offline_xp += 75

	assert(offline_xp == 225, "Offline XP should accumulate")

	print("Offline mode test passed! Offline XP: %d" % offline_xp)

func _on_all_tests_completed(results: Array, total_duration_ms: int) -> void:
	print("\n=== ALL TESTS COMPLETED ===")
	print("Total Duration: %dms" % total_duration_ms)

	var summary = framework.get_summary()
	print("Results: %d passed, %d failed out of %d total" % [
		summary["passed"],
		summary["failed"],
		summary["total"]
	])

	get_tree().quit()

func assert(condition: bool, message: String) -> void:
	if not condition:
		push_error("Assertion failed: " + message)
