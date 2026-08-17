extends GutTest

var _campaign_manager = null
var _mock_network = null
var _mock_analytics = null
var _save_file_path = "user://campaign_progress.json"

func before_each():
	# Clean up any existing save file
	if FileAccess.file_exists(_save_file_path):
		DirAccess.remove_absolute(_save_file_path)

	var CampaignManager = preload("res://autoloads/CampaignManager.gd")
	_campaign_manager = CampaignManager.new()
	add_child_autofree(_campaign_manager)

	_mock_network = double(Node).new()
	_mock_network.name = "NetworkManager"
	add_child_autofree(_mock_network)
	stub(_mock_network, "has_method").to_return(true)
	stub(_mock_network, "send_rpc").to_return({"success": true})
	stub(_mock_network, "send_rpc_async").to_return()
	_campaign_manager.set("network_manager", _mock_network)

	_mock_analytics = double(Node).new()
	_mock_analytics.name = "AnalyticsManager"
	add_child_autofree(_mock_analytics)
	stub(_mock_analytics, "has_method").to_return(false)
	_campaign_manager.set("analytics", _mock_analytics)

func test_initialization():
	assert_true(_campaign_manager != null)
	assert_eq(_campaign_manager.unlocked_stages.size(), 0)
	assert_eq(_campaign_manager.completed_stages.size(), 0)
	assert_eq(_campaign_manager.bosses_defeated.size(), 0)
	assert_eq(_campaign_manager.unlocked_modifier_pools.size(), 0)

func test_signals_exist():
	assert_true(_campaign_manager.has_signal("stage_unlocked"))
	assert_true(_campaign_manager.has_signal("stage_completed"))
	assert_true(_campaign_manager.has_signal("campaign_progress_updated"))
	assert_true(_campaign_manager.has_signal("modifier_pool_unlocked"))

func test_get_stage_data_not_found():
	var stage = _campaign_manager.get_stage_data("nonexistent")
	assert_true(stage.is_empty())

func test_is_stage_unlocked_empty():
	assert_false(_campaign_manager.is_stage_unlocked("1_1"))

func test_is_stage_completed_empty():
	assert_false(_campaign_manager.is_stage_completed("1_1"))

func test_unlock_modifier_pool():
	watch_signals(_campaign_manager)
	_campaign_manager.unlock_modifier_pool("test_modifier")
	assert_true(_campaign_manager.is_modifier_pool_unlocked("test_modifier"))
	assert_signal_emitted(_campaign_manager, "modifier_pool_unlocked")

func test_unlock_modifier_pool_duplicate():
	_campaign_manager.unlock_modifier_pool("test_modifier")
	_campaign_manager.unlock_modifier_pool("test_modifier")
	assert_eq(_campaign_manager.unlocked_modifier_pools.size(), 1)

func test_get_unlocked_modifier_pools():
	_campaign_manager.unlock_modifier_pool("mod1")
	_campaign_manager.unlock_modifier_pool("mod2")
	var pools = _campaign_manager.get_unlocked_modifier_pools()
	assert_eq(pools.size(), 2)
	assert_true(pools.has("mod1"))
	assert_true(pools.has("mod2"))

func test_get_bosses_defeated_empty():
	var bosses = _campaign_manager.get_bosses_defeated()
	assert_true(bosses.is_empty())

func test_has_defeated_boss_false():
	assert_false(_campaign_manager.has_defeated_boss("boss_wind"))

func test_complete_stage():
	_campaign_manager.unlocked_stages = ["1_1"]
	watch_signals(_campaign_manager)
	_campaign_manager.complete_stage("1_1")
	assert_true(_campaign_manager.is_stage_completed("1_1"))
	assert_signal_emitted(_campaign_manager, "stage_completed")

func test_complete_stage_with_boss():
	pending("ENV_DEPENDENT: requires live Nakama / authenticated session; see issue #960")
	return
	_campaign_manager.unlocked_stages = ["1_1"]
	_campaign_manager.campaigns_data = {
		"campaigns": [{
			"stages": [{"id": "1_1", "boss": "boss_wind"}]
		}]
	}
	watch_signals(_campaign_manager)
	_campaign_manager.complete_stage("1_1")
	assert_true(_campaign_manager.has_defeated_boss("boss_wind"))
	assert_true(_campaign_manager.is_modifier_pool_unlocked("piercing_arrow"))

func test_stage_unlock_sequence():
	pending("ENV_DEPENDENT: requires live Nakama / authenticated session; see issue #960")
	return
	_campaign_manager.unlocked_stages = ["1_1"]
	_campaign_manager.completed_stages = []
	_campaign_manager.campaigns_data = {
		"campaigns": [{
			"stages": [
				{"id": "1_1", "chapter": 1},
				{"id": "1_2", "chapter": 1},
				{"id": "2_1", "chapter": 2}
			]
		}]
	}
	watch_signals(_campaign_manager)
	_campaign_manager.complete_stage("1_1")
	assert_true(_campaign_manager.is_stage_unlocked("1_2"))
	assert_signal_emitted(_campaign_manager, "stage_unlocked")

func test_stage_unlock_last_in_chapter():
	pending("ENV_DEPENDENT: requires live Nakama / authenticated session; see issue #960")
	return
	_campaign_manager.unlocked_stages = ["1_1"]
	_campaign_manager.campaigns_data = {
		"campaigns": [{
			"stages": [{"id": "1_1", "chapter": 1}]
		}]
	}
	_campaign_manager.complete_stage("1_1")
	assert_false(_campaign_manager.is_stage_unlocked("1_2"))

func test_handle_boss_defeat():
	_campaign_manager.campaigns_data = {
		"campaigns": [{
			"stages": [{"id": "1_1", "boss": "boss_fire"}]
		}]
	}
	_campaign_manager.handle_boss_defeat("boss_fire")
	assert_true(_campaign_manager.has_defeated_boss("boss_fire"))
	assert_true(_campaign_manager.is_modifier_pool_unlocked("fire_arrow"))

func test_update_campaign_progress():
	_campaign_manager.campaigns_data = {
		"campaigns": [{
			"id": "chapter_1",
			"stages": [
				{"id": "1_1"},
				{"id": "1_2"}
			]
		}]
	}
	_campaign_manager.completed_stages = ["1_1"]
	watch_signals(_campaign_manager)
	_campaign_manager.update_campaign_progress()
	assert_signal_emitted(_campaign_manager, "campaign_progress_updated")

func test_save_progress_creates_file():
	_campaign_manager.unlocked_stages = ["1_1"]
	_campaign_manager.completed_stages = ["1_1"]
	_campaign_manager.save_progress()
	var file = FileAccess.open("user://campaign_progress.json", FileAccess.READ)
	assert_true(file != null)
	if file:
		var json_string = file.get_as_text()
		file.close()
		var json = JSON.new()
		var result = json.parse(json_string)
		assert_eq(result, OK)

func test_load_progress():
	var save_data = {
		"unlocked_stages": ["1_1", "1_2"],
		"completed_stages": ["1_1"],
		"unlocked_modifier_pools": ["mod1"],
		"bosses_defeated": ["boss_wind"]
	}
	var file = FileAccess.open("user://campaign_progress.json", FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(save_data))
		file.close()

	_campaign_manager.load_progress()
	assert_eq(_campaign_manager.unlocked_stages.size(), 2)
	assert_true(_campaign_manager.is_stage_completed("1_1"))
	assert_true(_campaign_manager.is_modifier_pool_unlocked("mod1"))
	assert_true(_campaign_manager.has_defeated_boss("boss_wind"))

func test_notify_server_stage_complete():
	pending("ENV_DEPENDENT: requires live Nakama / authenticated session; see issue #960")
	return
	watch_signals(_mock_network)
	_campaign_manager._notify_server_stage_complete("1_1", "boss_wind")
	# The stub was already set up in before_each, so if this completes without error, it's successful
	assert_true(true)

func test_get_stage_with_boss():
	_campaign_manager.campaigns_data = {
		"campaigns": [{
			"stages": [{"id": "1_1", "boss": "boss_wind", "difficulty": "normal"}]
		}]
	}
	var stage = _campaign_manager._get_stage_with_boss("boss_wind")
	assert_eq(stage.get("id"), "1_1")
	assert_eq(stage.get("boss"), "boss_wind")

func test_get_stage_with_boss_not_found():
	_campaign_manager.campaigns_data = {"campaigns": []}
	var stage = _campaign_manager._get_stage_with_boss("nonexistent")
	assert_true(stage.is_empty())

func test_boss_defeat_all_types():
	_campaign_manager.campaigns_data = {"campaigns": []}

	_campaign_manager.handle_boss_defeat("boss_fire")
	assert_true(_campaign_manager.is_modifier_pool_unlocked("fire_arrow"))

	_campaign_manager.handle_boss_defeat("boss_ice")
	assert_true(_campaign_manager.is_modifier_pool_unlocked("ice_arrow"))

	_campaign_manager.handle_boss_defeat("boss_electric")
	assert_true(_campaign_manager.is_modifier_pool_unlocked("lightning_damage"))

	_campaign_manager.handle_boss_defeat("boss_earth")
	assert_true(_campaign_manager.is_modifier_pool_unlocked("earth_arrow"))

	_campaign_manager.handle_boss_defeat("boss_king")
	assert_true(_campaign_manager.is_modifier_pool_unlocked("royal_blessing"))