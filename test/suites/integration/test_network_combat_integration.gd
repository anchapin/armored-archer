extends GutTest

# Preload manager classes to avoid duplicate loads
const NetworkManagerClass = preload("res://autoloads/NetworkManager.gd")
const CombatManagerClass = preload("res://autoloads/CombatManager.gd")
const MatchmakerManagerClass = preload("res://autoloads/MatchmakerManager.gd")
const CombatSyncManagerClass = preload("res://autoloads/CombatSyncManager.gd")
const GemManagerClass = preload("res://autoloads/GemManager.gd")
const PlayerStatsManagerClass = preload("res://autoloads/PlayerStatsManager.gd")
const CampaignManagerClass = preload("res://autoloads/CampaignManager.gd")

func before_each():
	Engine.time_scale = 1.0

func after_each():
	pass

func test_network_connect_and_combat_flow():
	# Issue #1361 follow-up: production NetworkManager does not expose
	# `is_server_connected` as a settable attribute; the test assumes it does.
	pending("Production NetworkManager has no is_server_connected attribute (issue #1361 follow-up)")
	return
	var net_mgr = NetworkManagerClass.new()
	add_child_autofree(net_mgr)

	var combat_mgr = CombatManagerClass.new()
	add_child_autofree(combat_mgr)
	combat_mgr.network_manager = net_mgr

	assert_true(net_mgr.is_server_connected, "Network should be connected")

func test_matchmaking_manager_integration():
	# Issue #1361 follow-up: production MatchmakerManager has no `_join_queue`
	# method; the test calls a non-existent API.
	pending("Production MatchmakerManager has no _join_queue method (issue #1361 follow-up)")
	return
	var mm_mgr = MatchmakerManagerClass.new()
	add_child_autofree(mm_mgr)

	var net_mgr = NetworkManagerClass.new()
	add_child_autofree(net_mgr)
	mm_mgr.network_manager = net_mgr

	mm_mgr._join_queue("pvp", 1500)

	assert_true(mm_mgr.is_in_queue(), "Should be in matchmaking queue")

func test_combat_sync_integration():
	# Issue #1361 follow-up: production CombatSyncManager does not expose
	# `current_match_state` as a writable attribute; assignment is rejected.
	pending("Production CombatSyncManager has no current_match_state writer (issue #1361 follow-up)")
	return
	var sync_mgr = CombatSyncManagerClass.new()
	add_child_autofree(sync_mgr)

	var combat_mgr = CombatManagerClass.new()
	add_child_autofree(combat_mgr)

	sync_mgr.current_match_state = {
		"match_id": "test_match",
		"creator_id": "player1",
		"opponent_id": "player2",
		"creator_health": 80,
		"opponent_health": 60
	}

	assert_eq(sync_mgr.get_match_id(), "test_match", "Sync manager should track match")

func test_gem_manager_with_player_stats():
	pending("ENV_DEPENDENT: requires live Nakama / authenticated session; see issue #960")
	return
	var gem_mgr = GemManagerClass.new()
	add_child_autofree(gem_mgr)

	var player_mgr = PlayerStatsManagerClass.new()
	add_child_autofree(player_mgr)
	
	gem_mgr._player_gems = {"ruby": 5, "sapphire": 3}
	player_mgr._gems = 100
	
	var total_value = gem_mgr.get_total_gem_value() + player_mgr.get_gems()
	assert_true(total_value > 0, "Should have gems from both systems")

func test_campaign_manager_with_combat():
	# Issue #1361 follow-up: production CampaignManager does not expose
	# `_current_level` / `_level_data` as writable attributes.
	pending("Production CampaignManager has no _current_level / _level_data writers (issue #1361 follow-up)")
	return
	var campaign_mgr = CampaignManagerClass.new()
	add_child_autofree(campaign_mgr)

	var combat_mgr = CombatManagerClass.new()
	add_child_autofree(combat_mgr)

	campaign_mgr._current_level = 5
	campaign_mgr._level_data = {
		"level_5": {
			"difficulty": "hard",
			"enemy_health": 200
		}
	}

	assert_eq(campaign_mgr.get_current_level(), 5, "Should be on level 5")
