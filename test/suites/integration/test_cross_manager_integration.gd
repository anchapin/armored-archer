extends GutTest

var GameManagerClass = load("res://autoloads/GameManager.gd")
var PlayerStatsManagerClass = load("res://autoloads/PlayerStatsManager.gd")
var GearManagerClass = load("res://autoloads/GearManager.gd")

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
	var mock_net = MockNetworkManager.new()
	mock_net.user_id = "test_player_1"
	
	var game_mgr = GameManagerClass.new()
	add_child_autofree(game_mgr)
	game_mgr.network_manager = mock_net
	
	var player_mgr = PlayerStatsManagerClass.new()
	add_child_autoffree(player_mgr)
	
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
	
	var CombatManagerClass = load("res://autoloads/CombatManager.gd")
	var combat_mgr = CombatManagerClass.new()
	add_child_autofree(combat_mgr)
	combat_mgr.network_manager = mock_net
	
	await combat_mgr.get_match_state("match123")
	
	assert_true(combat_mgr.is_my_turn, "Should be player's turn")
	assert_eq(combat_mgr.my_health, 100, "Should have 100 health")
	assert_eq(combat_mgr.opponent_health, 100, "Opponent should have 100 health")

func test_gear_equipped_affects_combat():
	var mock_net = MockNetworkManager.new()
	mock_net.user_id = "test_player"
	mock_net.mock_rpc_responses["armored_archer/submit_combat_action"] = {
		"success": true,
		"result": {
			"damage": 30,
			"creator_health": 100,
			"opponent_health": 70
		}
	}
	
	var gear_mgr = GearManagerClass.new()
	add_child_autofree(gear_mgr)
	gear_mgr.network_manager = mock_net
	
	gear_mgr._player_gear = {
		"bow": {"item_id": "bow_rare", "attack_bonus": 10},
		"quiver": {"item_id": "quiver_common", "damage_multiplier": 1.2}
	}
	
	var CombatManagerClass = load("res://autoloads/CombatManager.gd")
	var combat_mgr = CombatManagerClass.new()
	add_child_autofree(combat_mgr)
	combat_mgr.network_manager = mock_net
	
	combat_mgr.current_match_state = {
		"match_id": "match123",
		"creator_id": "test_player",
		"opponent_id": "enemy",
		"creator_health": 100,
		"opponent_health": 100,
		"current_turn_user_id": "test_player"
	}
	
	watch_signals(combat_mgr)
	await combat_mgr.submit_combat_action("match123", "shoot", 45.0, 1.0)
	
	assert_signal_emitted(combat_mgr, "combat_action_submitted")
	assert_eq(combat_mgr.opponent_health, 70, "Opponent should take damage")

func test_season_manager_affects_player_rewards():
	var SeasonManagerClass = load("res://autoloads/SeasonManager.gd")
	var season_mgr = SeasonManagerClass.new()
	add_child_autofree(season_mgr)
	
	var player_mgr = PlayerStatsManagerClass.new()
	add_child_autoffree(player_mgr)
	
	season_mgr.current_season = {
		"season_id": "season_1",
		"bonus_multiplier": 1.5,
		"active": true
	}
	
	var base_xp = 100
	var bonus_xp = season_mgr.get_season_bonus_xp(base_xp)
	
	assert_eq(bonus_xp, 150, "Season bonus should apply to XP rewards")

func test_inventory_manager_with_store():
	var StoreManagerClass = load("res://autoloads/StoreManager.gd")
	var store_mgr = StoreManagerClass.new()
	add_child_autofree(store_mgr)
	
	var InventoryManagerClass = load("res://autoloads/InventoryManager.gd")
	var inventory_mgr = InventoryManagerClass.new()
	add_child_autofree(inventory_mgr)
	
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
