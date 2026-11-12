extends GutTest

# Preload manager classes to avoid duplicate loads
const GameManagerClass = preload("res://autoloads/GameManager.gd")
const PlayerStatsManagerClass = preload("res://autoloads/PlayerStatsManager.gd")
const GearManagerClass = preload("res://autoloads/GearManager.gd")
const CombinedStatsManagerClass = preload("res://autoloads/CombinedStatsManager.gd")
const CombatManagerClass = preload("res://autoloads/CombatManager.gd")
const SeasonManagerClass = preload("res://autoloads/SeasonManager.gd")
const StoreManagerClass = preload("res://autoloads/StoreManager.gd")

class MockNetworkManager extends Node:
	var is_server_connected: bool = true
	var user_id: String = "test_player_1"
	var mock_rpc_responses: Dictionary = {}
	
	func send_rpc(rpc_id: String, payload: String) -> Dictionary:
		if mock_rpc_responses.has(rpc_id):
			return mock_rpc_responses[rpc_id]
		return {"success": true}

	func _init():
		mock_rpc_responses["armored_archer/get_player_profile"] = {
			"success": true,
			"user_id": user_id,
			"level": 10,
			"currency": 500,
			"gems": 50
		}

func before_each():
	Engine.time_scale = 1.0

func after_each():
	pass

func test_player_stats_with_gear_integration():
	# Issue #1361 follow-up: production GameManager.gd does not expose
	# `network_manager` as a settable property — assignment is rejected at runtime.
	pending("Production GameManager has no `network_manager` property (issue #1361 follow-up)")
	return
	var mock_net = MockNetworkManager.new()
	mock_net.user_id = "test_player_1"

	var game_mgr = GameManagerClass.new()
	add_child_autofree(game_mgr)
	game_mgr.network_manager = mock_net

	var player_mgr = PlayerStatsManagerClass.new()
	add_child_autofree(player_mgr)

	player_mgr.network_manager = mock_net
	player_mgr.user_id = "test_player_1"

	var gear_mgr = GearManagerClass.new()
	add_child_autofree(gear_mgr)
	gear_mgr.network_manager = mock_net

	await player_mgr.load_player_data()
	await gear_mgr.load_player_gear()

	assert_eq(player_mgr.get_currency(), 500, "Player should have 500 currency")
	assert_eq(player_mgr.get_level(), 10, "Player should be level 10")

func test_combat_manager_network_integration():
	var mock_net = MockNetworkManager.new()
	mock_net.user_id = "player1"
	mock_net.mock_rpc_responses["armored_archer/get_match_state"] = {
		"match_id": "match123",
		"creator_id": "player1",
		"opponent_id": "player2",
		"creator_health": 100,
		"opponent_health": 100,
		"current_turn_user_id": "player1",
		"status": "active"
	}

	var combat_mgr = CombatManagerClass.new()
	add_child_autofree(combat_mgr)
	combat_mgr.network_manager = mock_net
	
	await combat_mgr.get_match_state("match123")
	
	assert_true(combat_mgr.is_my_turn, "Should be player's turn")
	assert_eq(combat_mgr.my_health, 100, "Should have 100 health")
	assert_eq(combat_mgr.opponent_health, 100, "Opponent should have 100 health")

func test_gear_equipped_affects_combat():
	# Issue #1805: the shipped gear -> stats bridge is CombinedStatsManager.
	# CombinedStatsManager.gear_manager is a settable reference; when it is
	# wired to a GearManager, get_total_equipped_stats() is folded into the
	# combined stats (attack / defense / dodge / crit_rate / health) and
	# recalculate_stats() re-emits combined_stats_updated.
	#
	# NOTE: this test deliberately does NOT touch CombatManager. Combat
	# damage is server-authoritative, so CombatManager never reads gear; the
	# mocked submit_combat_action -> opponent_health path is already covered
	# by test/suites/combat/test_combat_manager.gd. What gear does feed is
	# the player's attack power, via the CombinedStatsManager bridge tested
	# below.
	var gear_mgr = GearManagerClass.new()
	add_child_autofree(gear_mgr)
	# The suite owns its own GearManager instance, so no network is involved.
	gear_mgr.network_manager = null
	# Use the shipped fallback summation in get_total_equipped_stats()
	# (GearManager.gd:398-407), which consumes the documented inventory gear
	# shape {id, stats: [{name, value}]} (see test/suites/gear/test_gear_manager.gd).
	gear_mgr.gear_balance_calculator = null

	var combined_mgr = CombinedStatsManagerClass.new()
	add_child_autofree(combined_mgr)
	# _ready() resolves the autoload singletons; re-point the manager at the
	# suite's own GearManager and drop the base-stats source so the gear
	# contribution is the only variable in the comparison.
	combined_mgr.gear_manager = gear_mgr
	combined_mgr.player_stats_manager = null

	# (a) Baseline: nothing equipped, so no gear contribution.
	gear_mgr.player_inventory = {"gear": []}
	gear_mgr.equipped_gear = {}
	combined_mgr.recalculate_stats()
	var base_attack: float = combined_mgr.get_attack_power()
	assert_eq(base_attack, 0.0, "No equipped gear should mean no gear attack contribution")

	# (b) Equip a bow with 10 attack through the public inventory API.
	gear_mgr.player_inventory = {
		"gear": [
			{
				"id": "bow_rare",
				"name": "Rare Bow",
				"type": "bow",
				"stats": [{"name": "attack", "value": 10}]
			}
		]
	}
	gear_mgr.equipped_gear = {"bow": "bow_rare"}

	var gear_attack = gear_mgr.get_total_equipped_stats().get("attack", 0)
	assert_eq(gear_attack, 10, "Equipped bow should contribute 10 attack")

	# (c) The gear contribution lands in the combined stats and the
	# combined_stats_updated signal is emitted on recalculation.
	watch_signals(combined_mgr)
	combined_mgr.recalculate_stats()

	assert_signal_emitted(combined_mgr, "combined_stats_updated")
	var expected_attack: float = base_attack + 10.0
	assert_eq(combined_mgr.get_attack_power(), expected_attack, "Combined attack rises by gear")
	var all_stats: Dictionary = combined_mgr.get_all_stats()
	assert_eq(all_stats.get("attack", 0.0), expected_attack, "Combined stats include gear attack")

func test_season_manager_affects_player_rewards():
	# Issue #1361 follow-up: production SeasonManager.gd has no
	# `get_season_bonus_xp` method; the test calls a non-existent API.
	pending("Production SeasonManager has no get_season_bonus_xp() (issue #1361 follow-up)")
	return
	var season_mgr = SeasonManagerClass.new()
	add_child_autofree(season_mgr)

	var player_mgr = PlayerStatsManagerClass.new()
	add_child_autofree(player_mgr)

	season_mgr.current_season = {
		"season_id": "season_1",
		"bonus_multiplier": 1.5,
		"active": true
	}

	var base_xp = 100
	var bonus_xp = season_mgr.get_season_bonus_xp(base_xp)

	assert_eq(bonus_xp, 150, "Season bonus should apply to XP rewards")

func test_inventory_manager_with_store():
	# Issue #1361 follow-up: production PlayerStatsManager.gd does not expose
	# `_currency` / `_gems` as writable attributes (they're method-driven).
	pending("Production PlayerStatsManager has no _currency / _gems attrs (issue #1361 follow-up)")
	return
	var store_mgr = StoreManagerClass.new()
	add_child_autofree(store_mgr)

	var gear_mgr = GearManagerClass.new()
	add_child_autofree(gear_mgr)

	var player_mgr = PlayerStatsManagerClass.new()
	add_child_autofree(player_mgr)
	player_mgr._currency = 100
	player_mgr._gems = 50

	var item_price = 80
	var item_gem_price = 10

	var can_afford = player_mgr.can_afford(item_price)
	assert_true(can_afford, "Player should afford item with currency")

	player_mgr.spend_currency(item_price)
	assert_eq(player_mgr.get_currency(), 20, "Currency should decrease after purchase")
