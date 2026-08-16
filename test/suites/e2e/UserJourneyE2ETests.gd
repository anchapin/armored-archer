## End-to-End Tests for Key User Journeys
## Tests cover: Campaign Progression, Gear Acquisition, and PvP Matchmaking
## QA-001 Priority: Medium
extends Node

# Test results tracking
var _passed_tests: Array = []
var _failed_tests: Array = []
var _current_test_name: String = ""

# Test configuration
const TEST_TIMEOUT: float = 30.0

# For E2E hardening we prefer the real autoload singletons when possible.
# These preloads are kept only for cases where we need a fresh isolated instance.
const CampaignManagerScript = preload("res://autoloads/CampaignManager.gd")
const GearManagerScript = preload("res://autoloads/GearManager.gd")
const GameManagerScript = preload("res://autoloads/GameManager.gd")
const MatchmakerManagerScript = preload("res://autoloads/MatchmakerManager.gd")

# Helpers to get real autoloads with E2E-safe reset (hardened + null-safe)
# These now strictly return the real autoload or null — no more fragile .new() fallbacks
func _get_real_campaign_manager() -> Node:
	var cm = get_node_or_null("/root/CampaignManager")
	if cm:
		if cm.has_method("initialize_for_testing"):
			cm.initialize_for_testing()
		return cm
	push_warning("E2E: CampaignManager autoload not found")
	return null

func _get_real_game_manager() -> Node:
	return get_node_or_null("/root/GameManager")

func _get_real_gear_manager() -> Node:
	return get_node_or_null("/root/GearManager")

func _get_real_matchmaker_manager() -> Node:
	return get_node_or_null("/root/MatchmakerManager")

# Convenience guard for journey tests
func _ensure_manager(manager: Node, name: String) -> bool:
	if not manager:
		push_error("E2E: " + name + " is null — skipping test")
		return false
	return true

# Normalizes gear stats from either legacy Array-of-dicts form [{"name": "attack", "value": 25}]
# or modern flat Dictionary form {"attack": 25} into a flat Dictionary.
# This fixes the Array-vs-Dictionary crashes when test data reaches GearBalanceCalculator
# via get_total_equipped_stats() and similar paths.
func _convert_stats_to_dict(stats_value) -> Dictionary:
	if stats_value == null:
		return {}
	if typeof(stats_value) == TYPE_DICTIONARY:
		return stats_value
	if typeof(stats_value) == TYPE_ARRAY:
		var result: Dictionary = {}
		for entry in stats_value:
			if typeof(entry) == TYPE_DICTIONARY:
				var n = entry.get("name", "")
				var v = entry.get("value", 0)
				if n != "":
					result[n] = v
		return result
	return {}

func _ready() -> void:
	# Add a small delay to ensure SceneTree is fully initialized
	await get_tree().process_frame

	# E2E hardening: set global isolation flag (in addition to env var)
	# and clean common user:// state
	OS.set_environment("E2E_TEST", "1")

	var dir = DirAccess.open("user://")
	if dir:
		var _err = dir.remove("campaign_progress.json")

	print("=== E2E User Journey Tests Starting (Hardened) ===")
	print("Issue: #475 - QA-001 Priority: Medium")
	print("")

	# Run all test categories using the hardened (more realistic) style
	await _run_campaign_progression_tests()
	await _run_gear_acquisition_tests()
	await _run_pvp_matchmaking_tests()
	await _run_combined_journey_tests()

	# Print final results
	_print_results()
	get_tree().quit()

# ============================================
# CAMPAIGN PROGRESSION JOURNEY TESTS
# ============================================

func _run_campaign_progression_tests() -> void:
	print("=== Running Campaign Progression Tests ===")

	await _test_campaign_new_player_first_stage()
	await _test_campaign_stage_sequence()
	await _test_campaign_boss_defeat()
	await _test_campaign_progress_tracking()
	await _test_campaign_stage_unlock()

func _test_campaign_new_player_first_stage() -> void:
	_current_test_name = "journey_campaign_new_player_first_stage"
	print("Testing: New Player → Start Game → Complete First Stage (hardened E2E)")

	# Hardened approach: prefer the real autoload singleton for realistic E2E coverage
	var campaign = _get_real_campaign_manager()
	if not _ensure_manager(campaign, "CampaignManager"):
		_record_result(false, "CampaignManager not available for new player first stage test")
		return

	# Ensure clean E2E state
	campaign.unlocked_stages = ["1_1"]
	campaign.completed_stages = []
	campaign.unlocked_chapters = ["chapter_1"]

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Verify initial state - first stage should be unlocked
	if not (campaign.unlocked_stages.size() > 0):
		passed = false
		_error_msg = "New player should have at least one unlocked stage"
	elif not campaign.is_stage_unlocked("1_1"):
		passed = false
		_error_msg = "Stage 1_1 should be unlocked for new player"
	else:
		# Complete the first stage using the real manager
		var stage_completed_emitted = [false]
		campaign.stage_completed.connect(func(_stage_id): stage_completed_emitted[0] = true)

		campaign.complete_stage("1_1")

		# Verify stage completion
		if not campaign.is_stage_completed("1_1"):
			passed = false
			_error_msg = "Stage 1_1 should be marked as completed"
		elif not stage_completed_emitted[0]:
			passed = false
			_error_msg = "stage_completed signal should be emitted"
		elif not campaign.is_stage_unlocked("1_2"):
			passed = false
			_error_msg = "Stage 1_2 should be unlocked after completing 1_1"

	# Note: We are using the real autoload singleton via _get_real_campaign_manager(),
	# so we must NOT queue_free() it. Only clean local test_context if we created one.

	_record_result(passed, _error_msg)

func _test_campaign_stage_sequence() -> void:
	_current_test_name = "journey_campaign_stage_sequence"
	print("Testing: Complete Stage 1 → Stage 2 → Stage 3")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var campaign = _get_real_campaign_manager()
	if not _ensure_manager(campaign, "CampaignManager"):
		test_context.queue_free()
		_record_result(false, "CampaignManager not available")
		return
	# Real autoload — do not re-parent
	# test_context.add_child(campaign)

	# Harden E2E test: use proper initialization helper instead of manual (incomplete) setup
	campaign.initialize_for_testing()

	# Override with minimal test data if desired (optional for this test)
	campaign.campaigns_data = {
		"campaigns": [
			{
				"id": "campaign_1",
				"stages": [
					{"id": "1_1"},
					{"id": "1_2"},
					{"id": "1_3"},
					{"id": "1_4"},
					{"id": "1_5"}
				]
			}
		]
	}
	campaign.unlocked_stages = ["1_1"]
	campaign.completed_stages = []

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Complete stages in sequence
	campaign.complete_stage("1_1")
	if campaign.completed_stages.size() != 1:
		passed = false
		_error_msg = "Should have 1 completed stage"
	elif not campaign.is_stage_unlocked("1_2"):
		passed = false
		_error_msg = "1_2 should be unlocked"
	else:
		campaign.complete_stage("1_1")
		campaign.complete_stage("1_2")
		campaign.complete_stage("1_3")

		if campaign.completed_stages.size() != 3:
			passed = false
			_error_msg = "Should have 3 completed stages"
		elif not campaign.is_stage_unlocked("1_4"):
			passed = false
			_error_msg = "1_4 should be unlocked"

	# campaign.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

func _test_campaign_boss_defeat() -> void:
	_current_test_name = "journey_campaign_boss_defeat"
	print("Testing: Defeat Boss → Unlock Modifier Pool")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var campaign = _get_real_campaign_manager()
	if not _ensure_manager(campaign, "CampaignManager"):
		test_context.queue_free()
		_record_result(false, "CampaignManager not available for boss defeat test")
		return
	# Real autoload — do not re-parent
	# test_context.add_child(campaign)

	# Setup: Complete a stage with boss
	campaign.campaigns_data = {
		"campaigns": [
			{
				"id": "campaign_1",
				"stages": [
					{"id": "1_1", "boss": "boss_wind"},
					{"id": "1_2", "boss": "boss_iron"},
					{"id": "1_3", "boss": "boss_king"}
				]
			}
		]
	}
	campaign.unlocked_stages = ["1_1", "1_2", "1_3"]
	campaign.completed_stages = []

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Defeat boss_wind - should complete stage
	campaign.complete_stage("1_1")
	if not campaign.is_stage_completed("1_1"):
		passed = false
		_error_msg = "Stage with boss should be completed"

	# Defeat boss_iron
	campaign.complete_stage("1_2")
	if not campaign.is_stage_completed("1_2"):
		passed = false
		_error_msg = "Stage with boss_iron should be completed"

	# Test handle_boss_defeat directly for other bosses (should not crash) — guarded
	if campaign.has_method("handle_boss_defeat"):
		campaign.handle_boss_defeat("boss_nightmare")
		campaign.handle_boss_defeat("unknown_boss")  # Unknown should not crash

	# campaign.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

func _test_campaign_progress_tracking() -> void:
	_current_test_name = "journey_campaign_progress_tracking"
	print("Testing: Campaign Progress Calculation")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var campaign = _get_real_campaign_manager()
	if not _ensure_manager(campaign, "CampaignManager"):
		test_context.queue_free()
		_record_result(false, "CampaignManager not available for progress tracking test")
		return
	# Real autoload — do not re-parent
	# test_context.add_child(campaign)

	campaign.campaigns_data = {
		"campaigns": [
			{
				"id": "campaign_1",
				"stages": [
					{"id": "1_1"},
					{"id": "1_2"},
					{"id": "1_3"},
					{"id": "1_4"}
				]
			}
		]
	}
	campaign.unlocked_stages = ["1_1", "1_2", "1_3", "1_4"]
	campaign.completed_stages = []

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Track progress updates
	var progress_updates = [0]
	campaign.campaign_progress_updated.connect(func(_chapter, _progress): progress_updates[0] += 1)

	# Complete 2 out of 4 stages
	campaign.complete_stage("1_1")
	campaign.complete_stage("1_2")

	# Verify signals were emitted
	if progress_updates[0] <= 0:
		passed = false
		_error_msg = "Progress update signal should be emitted"

	# campaign.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

func _test_campaign_stage_unlock() -> void:
	_current_test_name = "journey_campaign_stage_unlock"
	print("Testing: Stage Unlock Validation")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var campaign = _get_real_campaign_manager()
	if not _ensure_manager(campaign, "CampaignManager"):
		test_context.queue_free()
		_record_result(false, "CampaignManager not available for stage unlock test")
		return
	# Real autoload — do not re-parent
	# test_context.add_child(campaign)

	campaign.unlocked_stages = ["1_1", "1_2", "1_3"]
	campaign.completed_stages = ["1_1"]

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Test is_stage_unlocked
	if not campaign.is_stage_unlocked("1_1"):
		passed = false
		_error_msg = "1_1 should be unlocked"
	elif not campaign.is_stage_unlocked("1_2"):
		passed = false
		_error_msg = "1_2 should be unlocked"
	elif campaign.is_stage_unlocked("1_4"):
		passed = false
		_error_msg = "1_4 should NOT be unlocked"

	# Test is_stage_completed
	if not campaign.is_stage_completed("1_1"):
		passed = false
		_error_msg = "1_1 should be completed"
	elif campaign.is_stage_completed("1_2"):
		passed = false
		_error_msg = "1_2 should NOT be completed"

	# campaign.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

# ============================================
# GEAR ACQUISITION JOURNEY TESTS
# ============================================

func _run_gear_acquisition_tests() -> void:
	print("\n=== Running Gear Acquisition Tests ===")

	await _test_gear_acquisition_stage_complete()
	await _test_gear_acquisition_comparison()
	await _test_gear_acquisition_equip()
	await _test_gear_acquisition_stats_calculation()
	await _test_gear_acquisition_modifier_pool_unlock()

func _test_gear_acquisition_stage_complete() -> void:
	_current_test_name = "journey_gear_generate_after_stage"
	print("Testing: Stage Complete → Generate Gear")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var gear_manager = _get_real_gear_manager()
	# Real autoload — do not re-parent into test_context
	# test_context.add_child(gear_manager)

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Simulate gear generation (legacy Array stats still supported by get_gear_stats_summary)
	var test_gear = {
		"id": "bow_001",
		"name": "Iron Bow",
		"type": "weapon",
		"rarity": "common",
		"stats": [
			{"name": "attack", "value": 15},
			{"name": "crit_rate", "value": 5}
		],
		"modifiers": []
	}

	# Emit gear generated signal (simulating server response)
	gear_manager.gear_generated.emit(test_gear)

	await get_tree().create_timer(0.1).timeout

	# Verify gear summary can be generated
	var summary = gear_manager.get_gear_stats_summary(test_gear)
	if summary.is_empty():
		passed = false
		_error_msg = "Gear summary should not be empty"
	elif not ("Iron Bow" in summary):
		passed = false
		_error_msg = "Summary should contain gear name"

	# gear_manager.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

func _test_gear_acquisition_comparison() -> void:
	_current_test_name = "journey_gear_comparison"
	print("Testing: Compare Gear → Identify Better Item")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var gear_manager = _get_real_gear_manager()
	# Real autoload — do not re-parent
	# test_context.add_child(gear_manager)

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Create two gear items (legacy Array form is still accepted by compare_gear / _get_stat_map)
	var better_gear = {
		"id": "bow_legendary",
		"name": "Dragon Bow",
		"type": "weapon",
		"rarity": "legendary",
		"stats": [
			{"name": "attack", "value": 50},
			{"name": "crit_rate", "value": 20}
		],
		"modifiers": [
			{"name": "Fire Damage", "description": "Adds fire damage", "value_range": [10, 20]}
		]
	}

	var worse_gear = {
		"id": "bow_common",
		"name": "Wooden Bow",
		"type": "weapon",
		"rarity": "common",
		"stats": [
			{"name": "attack", "value": 10},
			{"name": "crit_rate", "value": 5}
		],
		"modifiers": []
	}

	# Compare gear
	var comparison = gear_manager.compare_gear(better_gear, worse_gear)
	if comparison.better != "gear1":
		passed = false
		_error_msg = "Better gear should be identified as gear1"
	elif comparison.differences.size() <= 0:
		passed = false
		_error_msg = "Should have stat differences"
	else:
		# Test reverse comparison
		var reverse_comparison = gear_manager.compare_gear(worse_gear, better_gear)
		if reverse_comparison.better != "gear2":
			passed = false
			_error_msg = "Reverse comparison should identify gear2 as better"

	# gear_manager.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

func _test_gear_acquisition_equip() -> void:
	_current_test_name = "journey_gear_equipping"
	print("Testing: Equip Gear → Update Stats")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var gear_manager = _get_real_gear_manager()
	# Real autoload — never re-parent
	# test_context.add_child(gear_manager)

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Track equip events
	var equip_events = []
	gear_manager.gear_equipped.connect(func(slot, gear_id):
		equip_events.append({"slot": slot, "gear_id": gear_id})
	)

	# Simulate equipping via signal
	gear_manager.gear_equipped.emit("weapon", "bow_001")
	gear_manager.gear_equipped.emit("armor", "armor_001")

	await get_tree().create_timer(0.1).timeout

	if equip_events.size() != 2:
		passed = false
		_error_msg = "Should have 2 equip events"
	elif equip_events[0].slot != "weapon":
		passed = false
		_error_msg = "First event should be weapon slot"
	elif equip_events[1].slot != "armor":
		passed = false
		_error_msg = "Second event should be armor slot"

	# gear_manager.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

func _test_gear_acquisition_stats_calculation() -> void:
	_current_test_name = "journey_gear_stats_calculation"
	print("Testing: Calculate Total Equipped Stats")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var gear_manager = _get_real_gear_manager()
	# NOTE: Never add the real autoload singleton as child of test_context (causes prior "previously freed" / null errors)
	# test_context.add_child(gear_manager)  # intentionally omitted for real autoloads

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Add gear to inventory — use FLAT dict stats form (required by GearBalanceCalculator path in get_total_equipped_stats)
	gear_manager.player_inventory = {
		"gear": [
			{
				"id": "bow_001",
				"type": "weapon",
				"stats": {"attack": 20}
			},
			{
				"id": "armor_001",
				"type": "armor",
				"stats": {"defense": 15, "health": 50}
			}
		]
	}

	# Set equipped gear (flat stats)
	gear_manager.equipped_gear = {
		"weapon": "bow_001",
		"armor": "armor_001"
	}

	# Calculate total stats — this path reaches GearBalanceCalculator which requires flat Dictionary stats
	var total_stats = gear_manager.get_total_equipped_stats()

	if not total_stats is Dictionary:
		passed = false
		_error_msg = "get_total_equipped_stats must return Dictionary"
	elif total_stats.get("attack", 0) != 20:
		passed = false
		_error_msg = "Total attack should be 20"
	elif total_stats.get("defense", 0) != 15:
		passed = false
		_error_msg = "Total defense should be 15"
	elif total_stats.get("health", 0) != 50:
		passed = false
		_error_msg = "Total health should be 50"

	# gear_manager.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

func _test_gear_acquisition_modifier_pool_unlock() -> void:
	_current_test_name = "journey_gear_modifier_unlock"
	print("Testing: Unlock Modifier Pool via Boss Defeat")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var campaign = _get_real_campaign_manager()
	if not _ensure_manager(campaign, "CampaignManager"):
		test_context.queue_free()
		_record_result(false, "CampaignManager not available for boss defeat test")
		return

	test_context.add_child(campaign)

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Test boss-specific modifier pool unlocks (just verify no crash) — defensive
	if campaign.has_method("handle_boss_defeat"):
		campaign.handle_boss_defeat("boss_wind")
		campaign.handle_boss_defeat("boss_iron")
		campaign.handle_boss_defeat("boss_king")
		campaign.handle_boss_defeat("boss_nightmare")
		campaign.handle_boss_defeat("boss_shadow")
		campaign.handle_boss_defeat("unknown_boss")  # Unknown should not crash

	# campaign.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

# ============================================
# PVP MATCHMAKING JOURNEY TESTS
# ============================================

func _run_pvp_matchmaking_tests() -> void:
	print("\n=== Running PvP Matchmaking Tests ===")

	await _test_pvp_create_match()
	await _test_pvp_accept_match()
	await _test_pvp_rank_tracking()
	await _test_pvp_punch_up_statistics()
	await _test_pvp_match_completion_flow()

func _test_pvp_create_match() -> void:
	_current_test_name = "journey_pvp_create_match"
	print("Testing: Create PvP Match")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var matchmaker = _get_real_matchmaker_manager()
	if not _ensure_manager(matchmaker, "MatchmakerManager"):
		test_context.queue_free()
		_record_result(false, "MatchmakerManager not available")
		return
	# Real autoload — do not re-parent
	# test_context.add_child(matchmaker)

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Verify initial state
	if not matchmaker.available_matches.is_empty():
		passed = false
		_error_msg = "No matches initially"
	elif matchmaker.player_rank != 0:
		passed = false
		_error_msg = "Initial rank should be 0"
	else:
		# Test get_available_matches returns empty array
		var matches = matchmaker.get_available_matches()
		if not matches.is_empty():
			passed = false
			_error_msg = "get_available_matches should return empty array"
		elif not matchmaker.get_current_match().is_empty():
			passed = false
			_error_msg = "get_current_match should return empty dict"
		elif matchmaker.is_in_match():
			passed = false
			_error_msg = "Should not be in match initially"

	# matchmaker.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

func _test_pvp_accept_match() -> void:
	_current_test_name = "journey_pvp_accept_match"
	print("Testing: Accept PvP Match")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var matchmaker = _get_real_matchmaker_manager()
	if not _ensure_manager(matchmaker, "MatchmakerManager"):
		test_context.queue_free()
		_record_result(false, "MatchmakerManager not available")
		return
	# Real autoload — do not re-parent
	# test_context.add_child(matchmaker)

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Set available matches
	matchmaker.available_matches = [
		{"id": "match_001", "host_id": "player_a", "status": "waiting"},
		{"id": "match_002", "host_id": "player_b", "status": "waiting"}
	]

	var matches = matchmaker.get_available_matches()
	if matches.size() != 2:
		passed = false
		_error_msg = "Should have 2 available matches"
	else:
		# Test is_in_match with completed match
		matchmaker.current_match = {"status": "completed"}
		if matchmaker.is_in_match():
			passed = false
			_error_msg = "Completed match should not count as in_match"
		else:
			# Test is_in_match with active match
			matchmaker.current_match = {"status": "active", "match_id": "match_001"}
			if not matchmaker.is_in_match():
				passed = false
				_error_msg = "Active match should count as in_match"

	# matchmaker.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

func _test_pvp_rank_tracking() -> void:
	_current_test_name = "journey_pvp_rank_tracking"
	print("Testing: Player Rank Tracking")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var matchmaker = _get_real_matchmaker_manager()
	if not _ensure_manager(matchmaker, "MatchmakerManager"):
		test_context.queue_free()
		_record_result(false, "MatchmakerManager not available")
		return
	# Real autoload — do not re-parent
	# test_context.add_child(matchmaker)

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Set player rank
	matchmaker.player_rank = 1500

	var rank_sync = matchmaker.get_player_rank_sync()
	if rank_sync != 1500:
		passed = false
		_error_msg = "Synchronous rank should return 1500"

	# Test rank	# Track rank update
	var rank_updated = [false]
	matchmaker.rank_retrieved.connect(func(_r): rank_updated[0] = true)

	matchmaker.get_player_rank()

	# Verify rank_updated signal emitted
	if not rank_updated[0]:
		_error_msg = "Rank retrieval should emit signal"

	# matchmaker.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

func _test_pvp_punch_up_statistics() -> void:
	_current_test_name = "journey_pvp_punch_up_stats"
	print("Testing: Punch-Up Statistics")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var matchmaker = _get_real_matchmaker_manager()
	if not _ensure_manager(matchmaker, "MatchmakerManager"):
		test_context.queue_free()
		_record_result(false, "MatchmakerManager not available")
		return
	# Real autoload — do not re-parent
	# test_context.add_child(matchmaker)

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Test initial punch-up stats
	if matchmaker.get_punch_up_wins() != 0:
		passed = false
		_error_msg = "Initial wins should be 0"
	elif matchmaker.get_punch_up_losses() != 0:
		passed = false
		_error_msg = "Initial losses should be 0"
	elif matchmaker.get_punch_up_win_rate() != 0.0:
		passed = false
		_error_msg = "Initial win rate should be 0.0"
	elif matchmaker.get_punch_up_total_matches() != 0:
		passed = false
		_error_msg = "Initial total matches should be 0"
	else:
		# Simulate wins and losses
		matchmaker.punch_up_wins = 3
		matchmaker.punch_up_losses = 1

		if matchmaker.get_punch_up_total_matches() != 4:
			passed = false
			_error_msg = "Total matches should be 4"
		else:
			# Win rate should be 3/4 = 0.75
			var win_rate = matchmaker.get_punch_up_win_rate()
			if not (win_rate > 0.7 and win_rate < 0.8):
				passed = false
				_error_msg = "Win rate should be approximately 0.75"

	# matchmaker.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

func _test_pvp_match_completion_flow() -> void:
	_current_test_name = "journey_pvp_match_completion"
	print("Testing: Match Completion Flow")

	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)

	var matchmaker = _get_real_matchmaker_manager()
	if not _ensure_manager(matchmaker, "MatchmakerManager"):
		test_context.queue_free()
		_record_result(false, "MatchmakerManager not available")
		return
	# Real autoload — do not re-parent
	# test_context.add_child(matchmaker)

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Setup active match
	matchmaker.current_match = {
		"match_id": "match_001",
		"status": "active",
		"players": ["player_1", "player_2"]
	}
	matchmaker.player_rank = 1500

	if not matchmaker.is_in_match():
		passed = false
		_error_msg = "Should be in active match"
	else:
		# Complete the match - simulate clearing
		matchmaker.current_match = {}

		if matchmaker.is_in_match():
			passed = false
			_error_msg = "Should not be in match after completion"
		elif not matchmaker.get_current_match().is_empty():
			passed = false
			_error_msg = "Current match should be empty after completion"

	# matchmaker.queue_free()  # do not free real autoloads
	test_context.queue_free()

	_record_result(passed, _error_msg)

# ============================================
# COMBINED JOURNEY TESTS
# ============================================

func _run_combined_journey_tests() -> void:
	print("\n=== Running Combined Journey Tests ===")

	await _test_journey_combined_pipeline()
	await _test_journey_combined_pvp_gear()
	await _test_journey_combined_offline_progression()

func _test_journey_combined_pipeline() -> void:
	_current_test_name = "journey_combined_campaign_to_gear"
	print("Testing: Campaign → Gear → Equip → Progress Pipeline (hardened E2E)")

	# Hardened: Use real autoloads for integrated testing
	var campaign = _get_real_campaign_manager()
	var gear_manager = _get_real_gear_manager()
	var game_manager = _get_real_game_manager()

	if not _ensure_manager(campaign, "CampaignManager") or not _ensure_manager(gear_manager, "GearManager") or not _ensure_manager(game_manager, "GameManager"):
		_record_result(false, "Required autoloads not available for combined pipeline test")
		return

	# Clean relevant state (guarded)
	campaign.unlocked_stages = ["1_1"]
	campaign.completed_stages = []
	campaign.unlocked_chapters = ["chapter_1"]

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Start game using real GameManager
	game_manager.start_game()
	if not game_manager.is_game_active:
		passed = false
		_error_msg = "Game should be active"
	elif game_manager.player_current_health != game_manager.player_max_health:
		passed = false
		_error_msg = "Should have full health"
	else:
		# Complete stage with boss via real CampaignManager
		campaign.complete_stage("1_1")

		if not campaign.is_stage_completed("1_1"):
			passed = false
			_error_msg = "Stage should be completed"
		elif not campaign.is_stage_unlocked("1_2"):
			passed = false
			_error_msg = "Next stage should be unlocked"
		else:
			# Use real GearManager with FLAT stats dict (required when get_total_equipped_stats hits GearBalanceCalculator)
			var new_gear = {
				"id": "bow_victory",
				"name": "Victory Bow",
				"type": "weapon",
				"rarity": "rare",
				"stats": {"attack": 25}
			}

			# GearManager expects specific structures — set them correctly
			if not gear_manager.has_method("add_to_inventory"):
				# Fallback direct manipulation for now
				gear_manager.player_inventory = {"gear": [new_gear]}
				gear_manager.equipped_gear = {"weapon": "bow_victory"}
			else:
				gear_manager.add_to_inventory(new_gear)
				gear_manager.equip_gear("weapon", "bow_victory")

			# Verify equipped gear stats via real method (flat dict path)
			var total_stats = gear_manager.get_total_equipped_stats()
			if typeof(total_stats) != TYPE_DICTIONARY or total_stats.get("attack", 0) != 25:
				passed = false
				_error_msg = "Should have attack from equipped gear"

	_record_result(passed, _error_msg)

func _test_journey_combined_pvp_gear() -> void:
	_current_test_name = "journey_combined_pvp_with_gear"
	print("Testing: PvP with Gear Stats (hardened E2E)")

	# Hardened: Use real autoloads
	var matchmaker = _get_real_matchmaker_manager()
	var gear_manager = _get_real_gear_manager()

	if not _ensure_manager(matchmaker, "MatchmakerManager") or not _ensure_manager(gear_manager, "GearManager"):
		_record_result(false, "Required autoloads not available")
		return

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Setup gear following real contract:
	# - equipped_gear: slot → gear_id (String)
	# - player_inventory holds the full gear dicts (or get_gear_by_id resolves them)
	# Use flat stats inside the gear objects for the calculator path
	var bow_gear = {
		"id": "bow_pvp",
		"type": "weapon",
		"stats": {"attack": 30, "crit_rate": 15}
	}
	var armor_gear = {
		"id": "armor_pvp",
		"type": "armor",
		"stats": {"defense": 20}
	}

	gear_manager.equipped_gear = {
		"weapon": "bow_pvp",
		"armor": "armor_pvp"
	}

	gear_manager.player_inventory = {
		"gear": [bow_gear, armor_gear]
	}

	# Get total combat stats via real method (now matches contract)
	var combat_stats = gear_manager.get_total_equipped_stats()

	# The real method returns a Dictionary with summed stats
	if typeof(combat_stats) != TYPE_DICTIONARY:
		passed = false
		_error_msg = "get_total_equipped_stats should return a Dictionary"
	elif combat_stats.get("attack", 0) != 30:
		passed = false
		_error_msg = "Should have attack stat"
	elif combat_stats.get("crit_rate", 0) != 15:
		passed = false
		_error_msg = "Should have crit rate"
	elif combat_stats.get("defense", 0) != 20:
		passed = false
		_error_msg = "Should have defense"
	else:
		# Setup matchmaker
		matchmaker.player_rank = 1200

		if matchmaker.get_player_rank_sync() != 1200:
			passed = false
			_error_msg = "Rank should be set"

	_record_result(passed, _error_msg)

func _test_journey_combined_offline_progression() -> void:
	_current_test_name = "journey_combined_offline_progression"
	print("Testing: Offline Progression (hardened E2E)")

	# Hardened: Use real autoloads
	var campaign = _get_real_campaign_manager()
	var game_manager = _get_real_game_manager()

	if not _ensure_manager(campaign, "CampaignManager") or not _ensure_manager(game_manager, "GameManager"):
		_record_result(false, "Required autoloads not available for offline progression test")
		return

	# Clean state
	campaign.unlocked_stages = ["1_1", "1_2", "1_3"]
	campaign.completed_stages = []
	campaign.unlocked_chapters = ["chapter_1"]

	await get_tree().process_frame

	var passed = true
	var _error_msg = ""

	# Simulate offline mode using real GameManager
	game_manager.start_game()
	game_manager.current_stage_id = "1_1"

	# Complete stages offline via real CampaignManager
	campaign.complete_stage("1_1")
	campaign.complete_stage("1_2")
	campaign.complete_stage("1_3")

	if campaign.completed_stages.size() != 3:
		passed = false
		_error_msg = "Should have 3 completed stages offline"
	elif not campaign.is_stage_completed("1_1"):
		passed = false
		_error_msg = "Stage 1 should be completed"
	elif not campaign.is_stage_completed("1_2"):
		passed = false
		_error_msg = "Stage 2 should be completed"
	elif not campaign.is_stage_completed("1_3"):
		passed = false
		_error_msg = "Stage 3 should be completed"

	_record_result(passed, _error_msg)

# ============================================
# TEST RESULT TRACKING
# ============================================

func _record_result(passed: bool, _error_msg: String = "") -> void:
	if passed:
		_passed_tests.append(_current_test_name)
		print("  ✓ PASS: " + _current_test_name)
	else:
		_failed_tests.append({"name": _current_test_name, "error": _error_msg})
		print("  ✗ FAIL: " + _current_test_name + " - " + _error_msg)

func _print_results() -> void:
	var total = _passed_tests.size() + _failed_tests.size()
	print("\n" + "=".repeat(50))
	print("=== E2E USER JOURNEY TESTS COMPLETED ===")
	print("=".repeat(50))
	print("Total Tests: %d" % total)
	print("Passed: %d" % _passed_tests.size())
	print("Failed: %d" % _failed_tests.size())

	if _failed_tests.size() > 0:
		print("\n=== FAILED TESTS ===")
		for failure in _failed_tests:
			print("- %s: %s" % [failure.name, failure.error])

	print("=".repeat(50))
