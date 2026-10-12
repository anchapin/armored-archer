extends GutTest

class Online:
	extends Node
	var is_connected: bool = true
	func is_session_valid() -> bool:
		return true

class Rewards:
	extends Node
	var calls: int = 0
	func gain_xp(_amount: int, _source: String) -> void:
		calls += 1
	func generate_gear(_stage: String, _boss: bool) -> void:
		calls += 1

func test_connected_result_waits_for_single_campaign_settlement() -> void:
	var screen: Control = load("res://scenes/ui/game_over.tscn").instantiate()
	add_child_autofree(screen)
	var online := Online.new()
	add_child_autofree(online)
	var rewards := Rewards.new()
	add_child_autofree(rewards)
	screen.network_manager = online
	screen.player_stats = rewards
	screen.gear_manager = rewards
	var old_stage: String = GameManager.current_stage_id
	GameManager.current_stage_id = "1_1"
	screen._on_game_won()
	assert_eq(rewards.calls, 0)
	assert_true(screen.loot_label.text.contains("pending confirmation"))
	assert_false(screen.loot_label.text.contains("+"))
	screen._on_stage_sync_updated("1_2", "confirmed", {"xp_gained": 999})
	assert_true(screen.loot_label.text.contains("pending confirmation"))
	screen._on_stage_sync_updated("1_1", "confirmed", {"xp_gained": 7, "gear_dropped": null})
	assert_eq(screen.loot_label.text, "Server confirmed: 7 XP. No gear drop.")
	assert_false(screen.loot_label.text.contains("Gold"))
	screen._on_stage_sync_updated("1_1", "failed", {})
	assert_true(screen.loot_label.text.contains("not confirmed"))
	GameManager.current_stage_id = old_stage

func test_confirmed_zero_reward_and_gear_use_server_fields() -> void:
	var screen: Control = load("res://scenes/ui/game_over.tscn").instantiate()
	add_child_autofree(screen)
	screen._result_stage_id = "1_1"
	screen.show()
	screen._on_stage_sync_updated("1_1", "confirmed", {"xp_gained": 0, "gear_dropped": {"name": "Server Bow"}})
	assert_eq(screen.loot_label.text, "Server confirmed: 0 XP.\nGear: Server Bow")

func test_last_settlement_survives_result_scene_exit() -> void:
	var old: Dictionary = CampaignManager.last_stage_sync.duplicate(true)
	watch_signals(CampaignManager)
	CampaignManager._set_stage_sync("1_1", "pending", {})
	assert_eq(CampaignManager.last_stage_sync.state, "pending")
	CampaignManager._set_stage_sync("1_1", "confirmed", {"xp_gained": 0})
	assert_eq(CampaignManager.last_stage_sync.result.xp_gained, 0)
	assert_signal_emit_count(CampaignManager, "stage_sync_updated", 2)
	CampaignManager.last_stage_sync = old

func test_map_reads_pending_and_late_confirmation_after_result_exit() -> void:
	var old: Dictionary = CampaignManager.last_stage_sync.duplicate(true)
	CampaignManager._set_stage_sync("1_1", "pending", {})
	var map: Control = load("res://scenes/ui/campaign_map.tscn").instantiate()
	add_child_autofree(map)
	assert_true(map._stage_sync_label.text.contains("pending confirmation"))
	CampaignManager._set_stage_sync("1_1", "confirmed", {"xp_gained": 3, "gear_dropped": null})
	assert_true(map._stage_sync_label.text.contains("confirmed 3 XP"))
	assert_false(map._stage_sync_label.text.contains("Gold"))
	CampaignManager.last_stage_sync = old

class ReplyNetwork:
	extends Online
	var calls: int = 0
	var response: Dictionary = {"success": true, "xp_gained": 0, "gear_dropped": null}
	func send_rpc(_name: String, _payload: String) -> Dictionary:
		calls += 1
		return response

func test_one_stage_request_publishes_confirmed_server_payload() -> void:
	var previous: Node = CampaignManager.network_manager
	var old: Dictionary = CampaignManager.last_stage_sync.duplicate(true)
	var network := ReplyNetwork.new()
	add_child_autofree(network)
	CampaignManager.network_manager = network
	await CampaignManager._notify_server_stage_complete("1_1", "")
	assert_eq(network.calls, 1)
	assert_eq(CampaignManager.last_stage_sync.state, "confirmed")
	assert_eq(CampaignManager.last_stage_sync.result.xp_gained, 0)
	CampaignManager.network_manager = previous
	CampaignManager.last_stage_sync = old

func test_local_replay_does_not_leave_pending_reward_status() -> void:
	var old: Dictionary = CampaignManager.last_stage_sync.duplicate(true)
	var old_completed: Array = CampaignManager.completed_stages.duplicate()
	CampaignManager.completed_stages.append("fixture_replay")
	CampaignManager.complete_stage("fixture_replay")
	assert_eq(CampaignManager.last_stage_sync.state, "local_replay")
	CampaignManager.completed_stages = old_completed
	CampaignManager.last_stage_sync = old
