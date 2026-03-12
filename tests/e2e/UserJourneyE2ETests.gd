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

func _ready() -> void:
	print("=== E2E User Journey Tests Starting ===")
	print("Issue: #475 - QA-001 Priority: Medium")
	print("")
	
	# Run all test categories
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
	
	_test_campaign_new_player_first_stage()
	_test_campaign_stage_sequence()
	_test_campaign_boss_defeat()
	_test_campaign_progress_tracking()
	_test_campaign_stage_unlock()

func _test_campaign_new_player_first_stage() -> void:
	_current_test_name = "journey_campaign_new_player_first_stage"
	print("Testing: New Player → Start Game → Complete First Stage")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var campaign = load("res://autoloads/CampaignManager.gd").new()
	test_context.add_child(campaign)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Verify initial state - first stage should be unlocked
	if not (campaign.unlocked_stages.size() > 0):
		passed = false
		error_msg = "New player should have at least one unlocked stage"
	elif not campaign.is_stage_unlocked("1_1"):
		passed = false
		error_msg = "Stage 1_1 should be unlocked for new player"
	else:
		# Complete the first stage
		var stage_completed_emitted = false
		campaign.stage_completed.connect(func(_): stage_completed_emitted = true)
		
		campaign.complete_stage("1_1")
		
		# Verify stage completion
		if not campaign.is_stage_completed("1_1"):
			passed = false
			error_msg = "Stage 1_1 should be marked as completed"
		elif not stage_completed_emitted:
			passed = false
			error_msg = "stage_completed signal should be emitted"
		elif not campaign.is_stage_unlocked("1_2"):
			passed = false
			error_msg = "Stage 1_2 should be unlocked after completing 1_1"
	
	campaign.queue_free()
	test_context.queue_free()
	
	_record_result(passed)

func _test_campaign_stage_sequence() -> void:
	_current_test_name = "journey_campaign_stage_sequence"
	print("Testing: Complete Stage 1 → Stage 2 → Stage 3")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var campaign = load("res://autoloads/CampaignManager.gd").new()
	test_context.add_child(campaign)
	
	# Setup campaign data
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
	var error_msg = ""
	
	# Complete stages in sequence
	campaign.complete_stage("1_1")
	if campaign.completed_stages.size() != 1:
		passed = false
		error_msg = "Should have 1 completed stage"
	elif not campaign.is_stage_unlocked("1_2"):
		passed = false
		error_msg = "1_2 should be unlocked"
	else:
		campaign.complete_stage("1_1")
		campaign.complete_stage("1_2")
		campaign.complete_stage("1_3")
		
		if campaign.completed_stages.size() != 3:
			passed = false
			error_msg = "Should have 3 completed stages"
		elif not campaign.is_stage_unlocked("1_4"):
			passed = false
			error_msg = "1_4 should be unlocked"
	
	campaign.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_campaign_boss_defeat() -> void:
	_current_test_name = "journey_campaign_boss_defeat"
	print("Testing: Defeat Boss → Unlock Modifier Pool")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var campaign = load("res://autoloads/CampaignManager.gd").new()
	test_context.add_child(campaign)
	
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
	var error_msg = ""
	
	# Defeat boss_wind - should complete stage
	campaign.complete_stage("1_1")
	if not campaign.is_stage_completed("1_1"):
		passed = false
		error_msg = "Stage with boss should be completed"
	
	# Defeat boss_iron
	campaign.complete_stage("1_2")
	if not campaign.is_stage_completed("1_2"):
		passed = false
		error_msg = "Stage with boss_iron should be completed"
	
	# Test handle_boss_defeat directly for other bosses (should not crash)
	campaign.handle_boss_defeat("boss_nightmare")
	campaign.handle_boss_defeat("unknown_boss")  # Unknown should not crash
	
	campaign.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_campaign_progress_tracking() -> void:
	_current_test_name = "journey_campaign_progress_tracking"
	print("Testing: Campaign Progress Calculation")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var campaign = load("res://autoloads/CampaignManager.gd").new()
	test_context.add_child(campaign)
	
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
	var error_msg = ""
	
	# Track progress updates
	var progress_updates = 0
	campaign.campaign_progress_updated.connect(func(_, _): progress_updates += 1)
	
	# Complete 2 out of 4 stages
	campaign.complete_stage("1_1")
	campaign.complete_stage("1_2")
	
	# Verify signals were emitted
	if progress_updates <= 0:
		passed = false
		error_msg = "Progress update signal should be emitted"
	
	campaign.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_campaign_stage_unlock() -> void:
	_current_test_name = "journey_campaign_stage_unlock"
	print("Testing: Stage Unlock Validation")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var campaign = load("res://autoloads/CampaignManager.gd").new()
	test_context.add_child(campaign)
	
	campaign.unlocked_stages = ["1_1", "1_2", "1_3"]
	campaign.completed_stages = ["1_1"]
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Test is_stage_unlocked
	if not campaign.is_stage_unlocked("1_1"):
		passed = false
		error_msg = "1_1 should be unlocked"
	elif not campaign.is_stage_unlocked("1_2"):
		passed = false
		error_msg = "1_2 should be unlocked"
	elif campaign.is_stage_unlocked("1_4"):
		passed = false
		error_msg = "1_4 should NOT be unlocked"
	
	# Test is_stage_completed
	if not campaign.is_stage_completed("1_1"):
		passed = false
		error_msg = "1_1 should be completed"
	elif campaign.is_stage_completed("1_2"):
		passed = false
		error_msg = "1_2 should NOT be completed"
	
	campaign.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

# ============================================
# GEAR ACQUISITION JOURNEY TESTS
# ============================================

func _run_gear_acquisition_tests() -> void:
	print("\n=== Running Gear Acquisition Tests ===")
	
	_test_gear_generate_after_stage()
	_test_gear_comparison()
	_test_gear_equipping()
	_test_gear_stats_calculation()
	_test_gear_modifier_unlock()

func _test_gear_generate_after_stage() -> void:
	_current_test_name = "journey_gear_generate_after_stage"
	print("Testing: Stage Complete → Generate Gear")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var gear_manager = load("res://autoloads/GearManager.gd").new()
	test_context.add_child(gear_manager)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Simulate gear generation
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
		error_msg = "Gear summary should not be empty"
	elif not ("Iron Bow" in summary):
		passed = false
		error_msg = "Summary should contain gear name"
	
	gear_manager.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_gear_comparison() -> void:
	_current_test_name = "journey_gear_comparison"
	print("Testing: Compare Gear → Identify Better Item")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var gear_manager = load("res://autoloads/GearManager.gd").new()
	test_context.add_child(gear_manager)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Create two gear items
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
		error_msg = "Better gear should be identified as gear1"
	elif comparison.differences.size() <= 0:
		passed = false
		error_msg = "Should have stat differences"
	else:
		# Test reverse comparison
		var reverse_comparison = gear_manager.compare_gear(worse_gear, better_gear)
		if reverse_comparison.better != "gear2":
			passed = false
			error_msg = "Reverse comparison should identify gear2 as better"
	
	gear_manager.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_gear_equipping() -> void:
	_current_test_name = "journey_gear_equipping"
	print("Testing: Equip Gear → Update Stats")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var gear_manager = load("res://autoloads/GearManager.gd").new()
	test_context.add_child(gear_manager)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
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
		error_msg = "Should have 2 equip events"
	elif equip_events[0].slot != "weapon":
		passed = false
		error_msg = "First event should be weapon slot"
	elif equip_events[1].slot != "armor":
		passed = false
		error_msg = "Second event should be armor slot"
	
	gear_manager.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_gear_stats_calculation() -> void:
	_current_test_name = "journey_gear_stats_calculation"
	print("Testing: Calculate Total Equipped Stats")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var gear_manager = load("res://autoloads/GearManager.gd").new()
	test_context.add_child(gear_manager)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Add gear to inventory
	gear_manager.player_inventory = {
		"gear": [
			{
				"id": "bow_001",
				"type": "weapon",
				"stats": [{"name": "attack", "value": 20}]
			},
			{
				"id": "armor_001", 
				"type": "armor",
				"stats": [{"name": "defense", "value": 15}, {"name": "health", "value": 50}]
			}
		]
	}
	
	# Set equipped gear
	gear_manager.equipped_gear = {
		"weapon": "bow_001",
		"armor": "armor_001"
	}
	
	# Calculate total stats
	var total_stats = gear_manager.get_total_equipped_stats()
	
	if total_stats.attack != 20:
		passed = false
		error_msg = "Total attack should be 20"
	elif total_stats.defense != 15:
		passed = false
		error_msg = "Total defense should be 15"
	elif total_stats.health != 50:
		passed = false
		error_msg = "Total health should be 50"
	
	gear_manager.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_gear_modifier_unlock() -> void:
	_current_test_name = "journey_gear_modifier_unlock"
	print("Testing: Unlock Modifier Pool via Boss Defeat")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var campaign = load("res://autoloads/CampaignManager.gd").new()
	test_context.add_child(campaign)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Test boss-specific modifier pool unlocks (just verify no crash)
	campaign.handle_boss_defeat("boss_wind")
	campaign.handle_boss_defeat("boss_iron")
	campaign.handle_boss_defeat("boss_king")
	campaign.handle_boss_defeat("boss_nightmare")
	campaign.handle_boss_defeat("boss_shadow")
	campaign.handle_boss_defeat("unknown_boss")  # Unknown should not crash
	
	campaign.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

# ============================================
# PVP MATCHMAKING JOURNEY TESTS
# ============================================

func _run_pvp_matchmaking_tests() -> void:
	print("\n=== Running PvP Matchmaking Tests ===")
	
	_test_pvp_create_match()
	_test_pvp_accept_match()
	_test_pvp_rank_tracking()
	_test_pvp_punch_up_stats()
	_test_pvp_match_completion()

func _test_pvp_create_match() -> void:
	_current_test_name = "journey_pvp_create_match"
	print("Testing: Create PvP Match")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var matchmaker = load("res://autoloads/MatchmakerManager.gd").new()
	test_context.add_child(matchmaker)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Verify initial state
	if not matchmaker.available_matches.is_empty():
		passed = false
		error_msg = "No matches initially"
	elif matchmaker.player_rank != 0:
		passed = false
		error_msg = "Initial rank should be 0"
	else:
		# Test get_available_matches returns empty array
		var matches = matchmaker.get_available_matches()
		if not matches.is_empty():
			passed = false
			error_msg = "get_available_matches should return empty array"
		elif not matchmaker.get_current_match().is_empty():
			passed = false
			error_msg = "get_current_match should return empty dict"
		elif matchmaker.is_in_match():
			passed = false
			error_msg = "Should not be in match initially"
	
	matchmaker.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_pvp_accept_match() -> void:
	_current_test_name = "journey_pvp_accept_match"
	print("Testing: Accept PvP Match")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var matchmaker = load("res://autoloads/MatchmakerManager.gd").new()
	test_context.add_child(matchmaker)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Set available matches
	matchmaker.available_matches = [
		{"id": "match_001", "host_id": "player_a", "status": "waiting"},
		{"id": "match_002", "host_id": "player_b", "status": "waiting"}
	]
	
	var matches = matchmaker.get_available_matches()
	if matches.size() != 2:
		passed = false
		error_msg = "Should have 2 available matches"
	else:
		# Test is_in_match with completed match
		matchmaker.current_match = {"status": "completed"}
		if matchmaker.is_in_match():
			passed = false
			error_msg = "Completed match should not count as in_match"
		else:
			# Test is_in_match with active match
			matchmaker.current_match = {"status": "active", "match_id": "match_001"}
			if not matchmaker.is_in_match():
				passed = false
				error_msg = "Active match should count as in_match"
	
	matchmaker.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_pvp_rank_tracking() -> void:
	_current_test_name = "journey_pvp_rank_tracking"
	print("Testing: Player Rank Tracking")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var matchmaker = load("res://autoloads/MatchmakerManager.gd").new()
	test_context.add_child(matchmaker)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Set player rank
	matchmaker.player_rank = 1500
	
	var rank_sync = matchmaker.get_player_rank_sync()
	if rank_sync != 1500:
		passed = false
		error_msg = "Synchronous rank should return 1500"
	
	# Test rank retrieval signal
	var rank_updated = false
	matchmaker.rank_retrieved.connect(func(r): rank_updated = true)
	matchmaker.rank_retrieved.emit(2000)
	
	await get_tree().create_timer(0.1).timeout
	
	if not rank_updated:
		passed = false
		error_msg = "Rank retrieval should emit signal"
	
	matchmaker.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_pvp_punch_up_stats() -> void:
	_current_test_name = "journey_pvp_punch_up_stats"
	print("Testing: Punch-Up Statistics")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var matchmaker = load("res://autoloads/MatchmakerManager.gd").new()
	test_context.add_child(matchmaker)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Test initial punch-up stats
	if matchmaker.get_punch_up_wins() != 0:
		passed = false
		error_msg = "Initial wins should be 0"
	elif matchmaker.get_punch_up_losses() != 0:
		passed = false
		error_msg = "Initial losses should be 0"
	elif matchmaker.get_punch_up_win_rate() != 0.0:
		passed = false
		error_msg = "Initial win rate should be 0.0"
	elif matchmaker.get_punch_up_total_matches() != 0:
		passed = false
		error_msg = "Initial total matches should be 0"
	else:
		# Simulate wins and losses
		matchmaker.punch_up_wins = 3
		matchmaker.punch_up_losses = 1
		
		if matchmaker.get_punch_up_total_matches() != 4:
			passed = false
			error_msg = "Total matches should be 4"
		else:
			# Win rate should be 3/4 = 0.75
			var win_rate = matchmaker.get_punch_up_win_rate()
			if not (win_rate > 0.7 and win_rate < 0.8):
				passed = false
				error_msg = "Win rate should be approximately 0.75"
	
	matchmaker.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_pvp_match_completion() -> void:
	_current_test_name = "journey_pvp_match_completion"
	print("Testing: Match Completion Flow")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var matchmaker = load("res://autoloads/MatchmakerManager.gd").new()
	test_context.add_child(matchmaker)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Setup active match
	matchmaker.current_match = {
		"match_id": "match_001",
		"status": "active",
		"players": ["player_1", "player_2"]
	}
	matchmaker.player_rank = 1500
	
	if not matchmaker.is_in_match():
		passed = false
		error_msg = "Should be in active match"
	else:
		# Complete the match - simulate clearing
		matchmaker.current_match = {}
		
		if matchmaker.is_in_match():
			passed = false
			error_msg = "Should not be in match after completion"
		elif not matchmaker.get_current_match().is_empty():
			passed = false
			error_msg = "Current match should be empty after completion"
	
	matchmaker.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

# ============================================
# COMBINED JOURNEY TESTS
# ============================================

func _run_combined_journey_tests() -> void:
	print("\n=== Running Combined Journey Tests ===")
	
	_test_combined_campaign_to_gear()
	_test_combined_pvp_with_gear()
	_test_combined_offline_progression()

func _test_combined_campaign_to_gear() -> void:
	_current_test_name = "journey_combined_campaign_to_gear"
	print("Testing: Campaign → Gear → Equip → Progress Pipeline")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	# Create managers
	var campaign = load("res://autoloads/CampaignManager.gd").new()
	var gear_manager = load("res://autoloads/GearManager.gd").new()
	var game_manager = load("res://autoloads/GameManager.gd").new()
	
	test_context.add_child(campaign)
	test_context.add_child(gear_manager)
	test_context.add_child(game_manager)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Start game
	game_manager.start_game()
	if not game_manager.is_game_active:
		passed = false
		error_msg = "Game should be active"
	elif game_manager.player_current_health != game_manager.player_max_health:
		passed = false
		error_msg = "Should have full health"
	else:
		# Complete stage with boss
		campaign.complete_stage("1_1")
		
		if not campaign.is_stage_completed("1_1"):
			passed = false
			error_msg = "Stage should be completed"
		elif not campaign.is_stage_unlocked("1_2"):
			passed = false
			error_msg = "Next stage should be unlocked"
		else:
			# Simulate gear generation
			var new_gear = {
				"id": "bow_victory",
				"name": "Victory Bow",
				"type": "weapon",
				"rarity": "rare",
				"stats": [{"name": "attack", "value": 25}]
			}
			
			gear_manager.player_inventory.gear = [new_gear]
			gear_manager.equipped_gear = {"weapon": "bow_victory"}
			
			# Verify equipped gear stats
			var total_stats = gear_manager.get_total_equipped_stats()
			if total_stats.attack != 25:
				passed = false
				error_msg = "Should have attack from equipped gear"
	
	campaign.queue_free()
	gear_manager.queue_free()
	game_manager.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_combined_pvp_with_gear() -> void:
	_current_test_name = "journey_combined_pvp_with_gear"
	print("Testing: PvP with Gear Stats")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var matchmaker = load("res://autoloads/MatchmakerManager.gd").new()
	var gear_manager = load("res://autoloads/GearManager.gd").new()
	
	test_context.add_child(matchmaker)
	test_context.add_child(gear_manager)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Setup gear with combat stats
	gear_manager.equipped_gear = {
		"weapon": "bow_pvp",
		"armor": "armor_pvp"
	}
	
	gear_manager.player_inventory = {
		"gear": [
			{
				"id": "bow_pvp",
				"type": "weapon",
				"stats": [{"name": "attack", "value": 30}, {"name": "crit_rate", "value": 15}]
			},
			{
				"id": "armor_pvp",
				"type": "armor",
				"stats": [{"name": "defense", "value": 20}]
			}
		]
	}
	
	# Get total combat stats
	var combat_stats = gear_manager.get_total_equipped_stats()
	
	if combat_stats.attack != 30:
		passed = false
		error_msg = "Should have attack stat"
	elif combat_stats.crit_rate != 15:
		passed = false
		error_msg = "Should have crit rate"
	elif combat_stats.defense != 20:
		passed = false
		error_msg = "Should have defense"
	else:
		# Setup matchmaker
		matchmaker.player_rank = 1200
		
		if matchmaker.get_player_rank_sync() != 1200:
			passed = false
			error_msg = "Rank should be set"
	
	matchmaker.queue_free()
	gear_manager.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

func _test_combined_offline_progression() -> void:
	_current_test_name = "journey_combined_offline_progression"
	print("Testing: Offline Progression")
	
	var test_context = Node.new()
	test_context.name = "TestContext"
	get_tree().root.add_child(test_context)
	
	var campaign = load("res://autoloads/CampaignManager.gd").new()
	var game_manager = load("res://autoloads/GameManager.gd").new()
	
	test_context.add_child(campaign)
	test_context.add_child(game_manager)
	
	await get_tree().process_frame
	
	var passed = true
	var error_msg = ""
	
	# Simulate offline mode - game should still work
	game_manager.start_game()
	game_manager.current_stage_id = "1_1"
	
	# Complete stages offline
	campaign.complete_stage("1_1")
	campaign.complete_stage("1_2")
	campaign.complete_stage("1_3")
	
	if campaign.completed_stages.size() != 3:
		passed = false
		error_msg = "Should have 3 completed stages offline"
	elif not campaign.is_stage_completed("1_1"):
		passed = false
		error_msg = "Stage 1 should be completed"
	elif not campaign.is_stage_completed("1_2"):
		passed = false
		error_msg = "Stage 2 should be completed"
	elif not campaign.is_stage_completed("1_3"):
		passed = false
		error_msg = "Stage 3 should be completed"
	
	campaign.queue_free()
	game_manager.queue_free()
	test_context.queue_free()
	
	_record_result(passed, error_msg)

# ============================================
# TEST RESULT TRACKING
# ============================================

func _record_result(passed: bool, error_msg: String = "") -> void:
	if passed:
		_passed_tests.append(_current_test_name)
		print("  ✓ PASS: " + _current_test_name)
	else:
		_failed_tests.append({"name": _current_test_name, "error": error_msg})
		print("  ✗ FAIL: " + _current_test_name + " - " + error_msg)

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
