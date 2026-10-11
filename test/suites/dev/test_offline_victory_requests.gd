extends GutTest

class OfflineNetwork:
	extends Node
	var is_connected: bool = false
	var rpc_calls: int = 0
	func is_session_valid() -> bool:
		return false
	func send_rpc(_name: String, _payload: String) -> Dictionary:
		rpc_calls += 1
		return {"error": "should not send"}

class Rewards:
	extends Node
	var calls: int = 0
	func gain_xp(_xp: int, _source: String) -> void:
		calls += 1
	func generate_gear(_stage: String, _boss: bool) -> void:
		calls += 1

func test_offline_victory_does_not_request_or_claim_server_rewards() -> void:
	var screen: Control = load("res://scenes/ui/game_over.tscn").instantiate()
	add_child_autofree(screen)
	var offline := OfflineNetwork.new()
	add_child_autofree(offline)
	var rewards := Rewards.new()
	add_child_autofree(rewards)
	screen.network_manager = offline
	screen.player_stats = rewards
	screen.gear_manager = rewards
	screen._on_game_won()
	assert_eq(rewards.calls, 0)
	assert_true(screen.loot_label.text.contains("Server rewards unavailable"))
	assert_false(screen.loot_label.text.contains("+"))
	assert_false(screen.pvp_challenge_button.visible)

func test_offline_stage_notification_does_not_attempt_rpc() -> void:
	var previous: Node = CampaignManager.network_manager
	var offline := OfflineNetwork.new()
	add_child_autofree(offline)
	CampaignManager.network_manager = offline
	await CampaignManager._notify_server_stage_complete("1_1", "")
	assert_eq(offline.rpc_calls, 0)
	CampaignManager.network_manager = previous

class OnlineNetwork:
	extends OfflineNetwork
	func is_session_valid() -> bool:
		return true
	func send_rpc(_name: String, _payload: String) -> Dictionary:
		rpc_calls += 1
		return {"success": true}

func test_authenticated_completion_still_notifies_server() -> void:
	var previous: Node = CampaignManager.network_manager
	var online := OnlineNetwork.new()
	add_child_autofree(online)
	CampaignManager.network_manager = online
	await CampaignManager._notify_server_stage_complete("1_1", "")
	assert_eq(online.rpc_calls, 1)
	CampaignManager.network_manager = previous
