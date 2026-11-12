extends GutTest

# Preload manager classes to avoid duplicate loads
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

## Shared transport for the real stats and inventory read RPCs.
class MockStatsGearNetworkManager extends Node:
	var is_connected: bool = true
	var rpc_responses: Dictionary = {}
	var rpc_calls: Array = []
	var payloads: Array = []

	func is_session_valid() -> bool:
		return true

	func send_rpc(rpc_id: String, payload: String) -> Dictionary:
		rpc_calls.append(rpc_id)
		payloads.append(JSON.parse_string(payload))
		return rpc_responses.get(rpc_id, {"error": "Unexpected RPC: %s" % rpc_id})

## Mock transport serving StoreManager's real currency RPCs.
## Mirrors the stub-injection precedent of test/test_store_purchase_flow.gd.
class MockStoreNetworkManager extends Node:
	var is_connected: bool = true
	var rpc_responses: Dictionary = {}

	func _init():
		rpc_responses["armored_archer/get_currency"] = {
			"gems": 50,
			"coins": 500
		}
		rpc_responses["armored_archer/spend_gems"] = {
			"success": true,
			"new_balance": 40
		}

	func send_rpc(rpc_id: String, payload: String) -> Dictionary:
		if rpc_responses.has(rpc_id):
			return rpc_responses[rpc_id]
		return {"error": "Unknown RPC: %s" % rpc_id}

func before_each():
	Engine.time_scale = 1.0

func after_each():
	pass

func test_player_stats_with_gear_integration():
	# Both real managers use the same local transport. This covers their RPC
	# response paths, not gear-derived stat calculation or a live backend.
	var mock_net = MockStatsGearNetworkManager.new()
	add_child_autofree(mock_net)
	var stats_response: Dictionary = {"level": 10, "xp": 125, "attack": 20}
	var inventory_response: Dictionary = {
		"gear": [{"id": "test_bow", "type": "bow", "stats": [{"name": "attack", "value": 10}]}],
		"equipped_gear": {"bow": "test_bow"},
		"unlocked_modifier_pools": ["starter_pool"]
	}
	mock_net.rpc_responses["armored_archer/get_player_stats"] = stats_response
	mock_net.rpc_responses["armored_archer/get_inventory"] = inventory_response

	var player_mgr = PlayerStatsManagerClass.new()
	add_child_autofree(player_mgr)
	var gear_mgr = GearManagerClass.new()
	add_child_autofree(gear_mgr)
	# GearManager._ready() sets its network reference, so inject after entry.
	player_mgr.network_manager = mock_net
	gear_mgr.network_manager = mock_net
	watch_signals(player_mgr)
	watch_signals(gear_mgr)

	var loaded_stats: Dictionary = await player_mgr.get_player_stats()
	await gear_mgr._load_inventory()

	assert_eq(loaded_stats, stats_response, "Stats should come from the RPC response")
	assert_eq(player_mgr.get_level(), 10, "Level should come from get_player_stats")
	assert_signal_emitted_with_parameters(player_mgr, "stats_updated", [stats_response])
	assert_eq(gear_mgr.player_inventory.get("gear", []), inventory_response["gear"], "Inventory should come from get_inventory")
	assert_eq(gear_mgr.equipped_gear, inventory_response["equipped_gear"], "Equipped slots should come from get_inventory")
	assert_eq(gear_mgr.unlocked_modifier_pools, inventory_response["unlocked_modifier_pools"], "Modifier pools should come from get_inventory")
	assert_signal_emitted_with_parameters(gear_mgr, "inventory_updated", [inventory_response])
	assert_eq(mock_net.rpc_calls, ["armored_archer/get_player_stats", "armored_archer/get_inventory"], "Both managers should use their real RPC IDs on the shared transport")
	assert_eq(mock_net.payloads, [{}, {}], "Read RPCs should send empty JSON objects")

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
	# Issue #1803: the pending body of this test named PlayerStatsManager,
	# but the shipped currency API lives in StoreManager (load_currency /
	# get_gems / get_coins / spend_gems) - PlayerStatsManager has no
	# currency API at all. The test is rewritten against the real
	# StoreManager currency path over a mock transport, with a GearManager
	# inventory fixture co-existing in the same test.
	var mock_net = MockStoreNetworkManager.new()
	add_child_autofree(mock_net)

	var store_mgr = StoreManagerClass.new()
	add_child_autofree(store_mgr)
	# StoreManager.network_manager is an @onready var, so the stub has to be
	# injected after the node entered the tree (same order as the
	# StoreManager stub precedent in test/test_store_purchase_flow.gd).
	store_mgr.network_manager = mock_net

	# Inventory fixture owned by the gear manager, co-existing with the
	# store currency flow.
	var gear_mgr = GearManagerClass.new()
	add_child_autofree(gear_mgr)
	gear_mgr.network_manager = null
	gear_mgr.player_inventory = {
		"gear": [
			{
				"id": "sword_common",
				"name": "Common Sword",
				"type": "sword",
				"stats": [{"name": "attack", "value": 5}]
			}
		]
	}
	gear_mgr.equipped_gear = {"sword": "sword_common"}

	var inventory: Dictionary = gear_mgr.get_full_inventory()
	assert_eq(inventory.get("gear", []).size(), 1, "Inventory should hold the fixture gear")
	assert_eq(inventory.get("equipped_gear", {}).get("sword", ""), "sword_common", "Sword should be equipped")

	# (a) load_currency() reads the balances from the server response.
	watch_signals(store_mgr)
	await store_mgr.load_currency()
	assert_eq(store_mgr.get_gems(), 50, "Gems should come from the get_currency response")
	assert_eq(store_mgr.get_coins(), 500, "Coins should come from the get_currency response")
	assert_signal_emitted(store_mgr, "currency_updated")
	assert_signal_emitted_with_parameters(store_mgr, "currency_updated", [50, 500])

	# (b) spend_gems() adopts the server-authoritative new balance.
	await store_mgr.spend_gems(10, "test_purchase")
	assert_eq(store_mgr.get_gems(), 40, "Gems should adopt the server new_balance")
	assert_eq(store_mgr.get_coins(), 500, "Coins should be untouched by a gem spend")
	assert_signal_emitted(store_mgr, "currency_updated")

	# (c) The gear inventory co-exists untouched next to the store flow.
	assert_eq(gear_mgr.get_full_inventory().get("gear", []).size(), 1, "Inventory should still hold the fixture gear")
