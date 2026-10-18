extends GutTest

# Tests for the CampaignManager autoload.
#
# The suite hand-rolls its NetworkManager stub instead of using
# `double(Node)`: GUT cannot stub script-level methods (send_rpc,
# send_rpc_async) on a double of a bare native class, so the doubled
# mock crashed before_each and left the real NetworkManager autoload
# bound, which pushed errors in RPC-calling tests (issue #965, same
# MOCK-05 anti-pattern as issues #972/#977). The stub classes below
# implement exactly the NetworkManager/AnalyticsManager surface
# CampaignManager touches.

# --- Test Doubles ---

## Minimal NetworkManager double. `send_rpc` returns `rpc_response`
## synchronously, so CampaignManager's `await` resumes immediately.
class StubNetworkManager extends Node:
	var rpc_response: Dictionary = {"success": true}
	# Optional FIFO queue; when non-empty, send_rpc pops from it instead
	# of returning rpc_response. `calls` logs every invocation.
	var rpc_responses: Array = []
	var calls: Array = []
	var session_valid: bool = true

	func is_session_valid() -> bool:
		return session_valid

	func send_rpc(rpc_id: String, payload: String, _timeout: float = 30.0) -> Dictionary:
		calls.append({"rpc_id": rpc_id, "payload": payload})
		if not rpc_responses.is_empty():
			return rpc_responses.pop_front()
		return rpc_response

	func send_rpc_async(_rpc_id: String, _payload: String, _timeout: float = 10.0) -> void:
		pass

## Analytics stub with no log_* methods, so has_method() returns false
## and CampaignManager skips its analytics hooks.
class StubAnalyticsManager extends Node:
	pass

# --- Fixtures ---

var _campaign_manager = null
var _mock_network: StubNetworkManager = null
var _mock_analytics: StubAnalyticsManager = null
var _save_file_path = "user://campaign_progress.json"

func before_each():
	# Clean up any existing save file
	if FileAccess.file_exists(_save_file_path):
		DirAccess.remove_absolute(_save_file_path)
	if FileAccess.file_exists("user://campaign_pending_sync.json"):
		DirAccess.remove_absolute("user://campaign_pending_sync.json")

	var CampaignManager = preload("res://autoloads/CampaignManager.gd")
	_campaign_manager = CampaignManager.new()
	add_child_autofree(_campaign_manager)

	_mock_network = StubNetworkManager.new()
	_mock_network.name = "NetworkManager"
	add_child_autofree(_mock_network)
	_campaign_manager.set("network_manager", _mock_network)

	_mock_analytics = StubAnalyticsManager.new()
	_mock_analytics.name = "AnalyticsManager"
	add_child_autofree(_mock_analytics)
	_campaign_manager.set("analytics", _mock_analytics)

func test_initialization():
	assert_true(_campaign_manager != null)
	# _ready() deliberately seeds stage "1_1" for fresh installs so the
	# first stage is playable with no save file (autoloads/CampaignManager.gd
	# _ready(): "If no saved progress, initialize with first stage and
	# chapter unlocked" — see issue #965).
	assert_eq(_campaign_manager.unlocked_stages.size(), 1)
	assert_true("1_1" in _campaign_manager.unlocked_stages)
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

func test_is_stage_unlocked_fresh_state():
	# Fresh installs only have the seeded "1_1" unlocked (issue #965);
	# every other stage stays locked until progression unlocks it.
	assert_true(_campaign_manager.is_stage_unlocked("1_1"))
	assert_false(_campaign_manager.is_stage_unlocked("2_1"))

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

# --- Issue #1663: bounded retry + pending-sync queue ---

func _set_fast_retries():
	_campaign_manager.sync_retry_delays = [0.01, 0.01]

func test_retry_succeeds_after_transient_error():
	_set_fast_retries()
	_mock_network.rpc_responses = [
		{"error": "timeout"},
		{"success": true, "unlocked_chapters": [], "completed_stages": [], "unlocked_stages": [], "bosses_defeated": []},
	]
	await _campaign_manager.sync_campaign_progress()
	assert_eq(_mock_network.calls.size(), 2, "transient error should be retried once")

func test_retry_bounded_attempts():
	_set_fast_retries()
	_mock_network.rpc_responses = [{"error": "e1"}, {"error": "e2"}, {"error": "e3"}, {"error": "e4"}]
	await _campaign_manager.sync_campaign_progress()
	assert_push_error("Failed to sync campaign progress")
	assert_eq(_mock_network.calls.size(), 3, "initial + 2 retries, then gives up")

func test_no_retry_on_server_rejection():
	_set_fast_retries()
	_mock_network.rpc_responses = [{"success": false, "message": "bad request"}]
	await _campaign_manager.sync_campaign_progress()
	assert_eq(_mock_network.calls.size(), 1, "well-formed rejection must not be retried")

func test_failed_stage_write_queued():
	_set_fast_retries()
	_campaign_manager.campaigns_data = {"campaigns": [{"id": "campaign_1", "stages": [{"id": "1_1", "boss": null}]}]}
	_campaign_manager.unlocked_stages = ["1_1"]
	_campaign_manager.completed_stages = []
	_mock_network.rpc_responses = [{"error": "down"}, {"error": "down"}, {"error": "down"}]
	await _campaign_manager._notify_server_stage_complete("1_1", "")
	assert_push_error("Failed to notify server of stage completion")
	assert_eq(_campaign_manager.pending_sync.size(), 1, "failed write queued after retries exhausted")
	if _campaign_manager.pending_sync.size() == 1:
		assert_eq(_campaign_manager.pending_sync[0].get("stage_id"), "1_1")
	assert_eq(_campaign_manager.last_stage_sync.get("state"), "failed")

func test_rejected_stage_write_not_queued():
	_set_fast_retries()
	_campaign_manager.campaigns_data = {"campaigns": [{"id": "campaign_1", "stages": [{"id": "1_1", "boss": null}]}]}
	_campaign_manager.unlocked_stages = ["1_1"]
	_campaign_manager.completed_stages = []
	_mock_network.rpc_responses = [{"success": false, "message": "duplicate"}]
	await _campaign_manager._notify_server_stage_complete("1_1", "")
	assert_eq(_campaign_manager.pending_sync.size(), 0, "definitive rejection must not be queued")
	assert_eq(_campaign_manager.last_stage_sync.get("state"), "failed")

func test_replay_pending_sync_confirms_and_clears():
	_set_fast_retries()
	_campaign_manager.pending_sync = [{"stage_id": "1_1", "boss_id": "", "difficulty": "normal"}]
	_mock_network.rpc_responses = [{"success": true}]
	await _campaign_manager.replay_pending_sync()
	assert_eq(_campaign_manager.pending_sync.size(), 0, "confirmed replay dequeues")
	assert_eq(_campaign_manager.last_stage_sync.get("state"), "confirmed")
	assert_eq(_mock_network.calls.size(), 1)
	if _mock_network.calls.size() == 1:
		assert_eq(_mock_network.calls[0].rpc_id, "armored_archer/stage_complete")

func test_replay_drops_server_rejection():
	_set_fast_retries()
	_campaign_manager.pending_sync = [{"stage_id": "1_1", "boss_id": "", "difficulty": "normal"}]
	_mock_network.rpc_responses = [{"success": false, "message": "already recorded"}]
	await _campaign_manager.replay_pending_sync()
	assert_eq(_campaign_manager.pending_sync.size(), 0, "rejected replay dropped, not re-queued")
	assert_eq(_campaign_manager.last_stage_sync.get("state"), "failed")

func test_replay_skips_when_session_invalid():
	_mock_network.session_valid = false
	_campaign_manager.pending_sync = [{"stage_id": "1_1", "boss_id": "", "difficulty": "normal"}]
	await _campaign_manager.replay_pending_sync()
	assert_eq(_campaign_manager.pending_sync.size(), 1, "offline replay leaves queue untouched")
	assert_eq(_mock_network.calls.size(), 0, "no RPCs while offline")

func test_confirmed_write_dequeues_pending_entry():
	_set_fast_retries()
	_campaign_manager.campaigns_data = {"campaigns": [{"id": "campaign_1", "stages": [{"id": "1_1", "boss": null}]}]}
	_campaign_manager.unlocked_stages = ["1_1"]
	_campaign_manager.completed_stages = []
	_campaign_manager.pending_sync = [{"stage_id": "1_1", "boss_id": "", "difficulty": "normal"}]
	_mock_network.rpc_responses = [{"success": true}]
	await _campaign_manager._notify_server_stage_complete("1_1", "")
	assert_eq(_campaign_manager.pending_sync.size(), 0, "confirmed write dequeues matching entry")
	assert_eq(_campaign_manager.last_stage_sync.get("state"), "confirmed")

func test_pending_sync_persistence_round_trip():
	_campaign_manager.pending_sync = [{"stage_id": "1_1", "boss_id": "boss_wind", "difficulty": "hard"}]
	_campaign_manager._save_pending_sync()
	_campaign_manager.pending_sync = []
	_campaign_manager._load_pending_sync()
	assert_eq(_campaign_manager.pending_sync.size(), 1, "queue persists to disk and reloads")
	if _campaign_manager.pending_sync.size() == 1:
		assert_eq(_campaign_manager.pending_sync[0].get("boss_id"), "boss_wind")
	DirAccess.remove_absolute(_campaign_manager.PENDING_SYNC_PATH)
