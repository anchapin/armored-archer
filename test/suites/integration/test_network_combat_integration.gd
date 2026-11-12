extends GutTest

# Preload manager classes to avoid duplicate loads
const NetworkManagerClass = preload("res://autoloads/NetworkManager.gd")
const CombatManagerClass = preload("res://autoloads/CombatManager.gd")
const MatchmakerManagerClass = preload("res://autoloads/MatchmakerManager.gd")
const CombatSyncManagerClass = preload("res://autoloads/CombatSyncManager.gd")
const GemManagerClass = preload("res://autoloads/GemManager.gd")
const PlayerStatsManagerClass = preload("res://autoloads/PlayerStatsManager.gd")
const CampaignManagerClass = preload("res://autoloads/CampaignManager.gd")

## Files CampaignManager may write while the test runs: the progress save
## plus the SaveIO backup/temp siblings (issue #1723).
const CAMPAIGN_PROGRESS_FILES: Array = [
	"user://campaign_progress.json",
	"user://campaign_progress.json.tmp",
	"user://campaign_progress.json.bak"
]

func before_each():
	Engine.time_scale = 1.0

func after_each():
	pass

func test_network_connect_and_combat_flow():
	# Issue #1815: rewritten against NetworkManager's real connection
	# lifecycle. Production NetworkManager never had an `is_server_connected`
	# attribute; the real flag is `is_connected`
	# (autoloads/NetworkManager.gd), raised by handle_reconnection(), which
	# also emits connection_status_changed(true). A session is only valid
	# when a token exists AND the manager is connected
	# (is_session_valid() == not session_token.is_empty() and is_connected).
	#
	# The manager is added to the tree in the production E2E isolation mode
	# (E2E_TEST=1), where NetworkManager._ready() skips the automatic
	# authenticate_device() / _refresh_session() calls. That keeps the test
	# completely offline - no live Nakama, no HTTP traffic - while still
	# exercising the real production methods. The env var is restored right
	# after the node enters the tree so no other suite is affected.
	var previous_e2e := OS.get_environment("E2E_TEST")
	OS.set_environment("E2E_TEST", "1")
	var net_mgr = NetworkManagerClass.new()
	add_child_autofree(net_mgr)
	OS.set_environment("E2E_TEST", previous_e2e)

	# (a) A fresh manager is disconnected and holds no valid session.
	assert_false(net_mgr.is_connected, "A fresh NetworkManager should not be connected")
	assert_false(net_mgr.is_session_valid(), "A fresh NetworkManager should not have a valid session")

	# (b) handle_reconnection() raises the flag and announces it.
	# Offline-safe: with no refresh token it performs no session refresh.
	watch_signals(net_mgr)

	net_mgr.handle_reconnection()

	assert_true(net_mgr.is_connected, "handle_reconnection() should set is_connected")
	assert_false(net_mgr.is_offline, "handle_reconnection() should clear the offline flag")
	assert_signal_emitted_with_parameters(net_mgr, "connection_status_changed", [true])

	# (c) A session becomes valid once a token is present and the manager
	# is connected (the production definition of is_session_valid()).
	net_mgr.session_token = "offline-test-session-token"
	assert_true(net_mgr.is_session_valid(), "Connected manager with a token should be valid")

	# (d) CombatManager reads the same flag through its settable
	# network_manager property (the gate in CombatManager.submit_combat_action).
	var combat_mgr = CombatManagerClass.new()
	add_child_autofree(combat_mgr)
	combat_mgr.network_manager = net_mgr

	assert_eq(combat_mgr.network_manager, net_mgr, "CombatManager should use the manager under test")
	assert_true(combat_mgr.network_manager.is_connected, "CombatManager should see the connected manager")

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
	# ADR-0009 (issue #1714): the shared static CombatStateCache is the
	# single read-through snapshot. CombatSyncManager (polling write path)
	# and CombatManager (RPC echo write path) are separate instances but read
	# the same snapshot, so a cross-manager read proves the cache wiring.
	var sync_mgr = CombatSyncManagerClass.new()
	add_child_autofree(sync_mgr)

	var combat_mgr = CombatManagerClass.new()
	add_child_autofree(combat_mgr)

	# start_combat() overwrites the snapshot deterministically (100/100/turn),
	# so all assertions below are made after it - the managers' _ready()
	# seeds differ (CombatSyncManager 100/100/false, CombatManager 0/0/false).
	sync_mgr.start_combat("test_match")

	# (a) The sync manager tracks the live match.
	assert_eq(sync_mgr.current_match_id, "test_match", "Sync manager should track match")
	assert_true(sync_mgr.is_combat_active, "Combat should be active after start_combat")

	# (b) A *separate* CombatManager instance reads the same snapshot.
	assert_eq(combat_mgr.my_health, 100, "CombatManager should read shared my_health")
	assert_eq(combat_mgr.opponent_health, 100, "CombatManager should read shared opponent_health")
	assert_true(combat_mgr.is_my_turn, "CombatManager should read shared turn state")

	# (c) Damage applied by the sync path is visible to the other manager.
	sync_mgr.apply_opponent_damage(40)
	assert_eq(combat_mgr.opponent_health, 60, "Damage should propagate through the shared cache")

	# Cleanup: stop the 0.5s polling timer and clear the static snapshot so
	# it cannot leak into other suites.
	sync_mgr.end_combat("player")
	CombatStateCache.reset()

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
	# Issue #1804: rewritten against CampaignManager's real stage-data API.
	# The old stub assumed `_current_level` / `_level_data` writers that the
	# production manager never had. Production is stage-based: campaigns_data
	# (campaigns[].stages[] with id / difficulty / enemy) is read through
	# get_stage_data() / get_enemy_data() / get_difficulty_tier(), and
	# complete_stage() records the stage and emits stage_completed.
	#
	# This suite owns its own manager instance with a fixture campaigns_data,
	# so it does not depend on (nor duplicate) the autoload spawn-context
	# suite in test/suites/dev/test_campaign_spawn_context.gd.
	#
	# Snapshot the shared progress file before the manager touches it, so the
	# file can be restored afterwards (CampaignManager saves on _ready() and
	# on complete_stage()).
	var progress_snapshot := _snapshot_campaign_progress()

	var campaign_mgr = CampaignManagerClass.new()
	add_child_autofree(campaign_mgr)
	# Offline-safe: with no network manager the completion path stays local
	# (_notify_server_stage_complete -> "offline") and never calls a server.
	campaign_mgr.network_manager = null

	campaign_mgr.campaigns_data = {
		"campaigns": [
			{
				"id": "chapter_5",
				"stages": [
					{
						"id": "5_1",
						"name": "Iron Gate",
						"waves": 1,
						"boss": null,
						"difficulty": 3,
						"biome": "mountain",
						"enemy": {
							"type": "Armored Sentinel",
							"health": 200,
							"attack": 20,
							"defense": 8,
							"speed": 6
						}
					}
				]
			}
		]
	}
	campaign_mgr.unlocked_chapters = ["chapter_5"]
	campaign_mgr.unlocked_stages = ["5_1"]
	campaign_mgr.completed_stages = []

	# (a) The stage reads back through the public stage-data API.
	assert_eq(campaign_mgr.get_stage_data("5_1").difficulty, 3, "Stage 5_1 should be difficulty tier 3")
	assert_eq(campaign_mgr.get_enemy_data("5_1").health, 200, "Stage 5_1 enemy should have 200 health")
	assert_eq(campaign_mgr.get_difficulty_tier("5_1"), 3, "Stage 5_1 difficulty tier should be 3")

	# (b) Completing the stage emits stage_completed and records completion.
	watch_signals(campaign_mgr)

	campaign_mgr.complete_stage("5_1")

	assert_signal_emitted_with_parameters(campaign_mgr, "stage_completed", ["5_1"])
	assert_true(campaign_mgr.is_stage_completed("5_1"), "Stage 5_1 should be marked as completed")

	# Leave the shared user:// progress file as we found it (complete_stage
	# saves progress), so the rest of the suite is unaffected.
	_restore_campaign_progress(progress_snapshot)

# --- helpers for the campaign stage-data test ---

func _snapshot_campaign_progress() -> Array:
	## Captures the campaign progress files so the test can restore them.
	var snapshot: Array = []
	for path: String in CAMPAIGN_PROGRESS_FILES:
		if not FileAccess.file_exists(path):
			snapshot.append({"path": path, "existed": false, "content": ""})
			continue
		var file := FileAccess.open(path, FileAccess.READ)
		if file == null:
			snapshot.append({"path": path, "existed": false, "content": ""})
			continue
		var content := file.get_as_text()
		file.close()
		snapshot.append({"path": path, "existed": true, "content": content})
	return snapshot

func _restore_campaign_progress(snapshot: Array) -> void:
	## Restores (or removes) the campaign progress files.
	for entry in snapshot:
		var path := str(entry.get("path", ""))
		if path == "":
			continue
		if bool(entry.get("existed", false)):
			var file := FileAccess.open(path, FileAccess.WRITE)
			if file != null:
				file.store_string(str(entry.get("content", "")))
				file.close()
		elif FileAccess.file_exists(path):
			var dir := DirAccess.open("user://")
			if dir != null:
				var _err := dir.remove(path.get_file())
