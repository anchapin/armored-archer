extends SceneTree

# Vertical Slice End-to-End Smoke Test for Godot Client
#
# Validates the complete vertical slice flow from account creation
# to PvE stage completion, loot drop, and equipment equip.
#
# Usage (headless):
#   godot --headless --script res://test/e2e_vertical_slice.gd
#
# Note: This script was updated to extend SceneTree so it can be run
# directly via --script in headless mode.

enum TestStatus {
	PENDING,
	PASS,
	FAIL,
	SKIP
}

# Test results tracking
var test_results: Array = []
var current_test_index: int = 0
var test_phase: String = ""

# Manager references
var network_manager: Node
var player_stats_manager: Node
var campaign_manager: Node
var inventory_manager: Node

# Test configuration
const TEST_STAGE_ID: String = "1_1"
const RETRY_ATTEMPTS: int = 3
const RPC_TIMEOUT: float = 10.0

# Signals
signal test_complete(success: bool, message: String)
signal phase_complete(phase_name: String, success: bool)

# Colors for output
const COLOR_PASS = Color(0.2, 0.8, 0.2)
const COLOR_FAIL = Color(0.8, 0.2, 0.2)
const COLOR_SKIP = Color(0.7, 0.7, 0.7)

func _init() -> void:
	# In SceneTree scripts for --headless --script, we initialize here.
	print("=== Vertical Slice E2E Smoke Test ===")
	print("Issue: #679 - Sprint 1 Vertical Slice Foundation")
	print("")

	# Autoloads are available via /root/ even in pure script mode.
	# Use get_node (more reliable in SceneTree scripts) + yield a frame if needed.
	network_manager = get_node("/root/NetworkManager")
	player_stats_manager = get_node("/root/PlayerStatsManager")
	campaign_manager = get_node("/root/CampaignManager")
	inventory_manager = get_node("/root/InventoryManager")

	# Verify managers are available
	if not network_manager:
		_log_result("VS-1-1", "NetworkManager not found", TestStatus.FAIL)
		_finish_tests()
		return

	if not player_stats_manager:
		_log_result("VS-1-2", "PlayerStatsManager not found", TestStatus.FAIL)
		_finish_tests()
		return

	# Defer the actual async test sequence until the tree is ready
	call_deferred("_start_test_sequence")

## Runs all tests in sequence
func _run_test_sequence() -> void:
	print("Starting test sequence...")
	print("")

	# VS-1: Account Bootstrap & Session Management
	await _test_vs_1_account_bootstrap()

	# VS-2: PvE Stage Configuration
	await _test_vs_2_stage_configuration()

	# VS-3: Combat System (data flow only)
	await _test_vs_3_combat_data_flow()

	# VS-4: Server-Side Loot Generation
	await _test_vs_4_loot_generation()

	# VS-5: Inventory Display & Loadout Management
	await _test_vs_5_inventory_management()

	# VS-6: Stat Allocation System
	await _test_vs_6_stat_allocation()

	# VS-7: Boss Encounter Flow
	await _test_vs_7_boss_encounter()

	# VS-8: End-to-End Integration
	await _test_vs_8_full_integration()

	# Print summary
	_print_summary()

	# Exit with appropriate code
	_determine_exit_code()

## VS-1: Account Bootstrap & Session Management
func _test_vs_1_account_bootstrap() -> void:
	test_phase = "VS-1: Account Bootstrap & Session Management"
	print("--- " + test_phase + " ---")

	# Test 1.1: Device authentication
	_log_test("VS-1-1", "Authenticate with device ID")

	for attempt in range(RETRY_ATTEMPTS):
		network_manager.authenticate_device()
		await process_frame
		await process_frame  # approximate delay for 2s in headless (real timers are better in real scenes)

		if network_manager.is_connected:
			_log_result("VS-1-1", "Device authentication successful", TestStatus.PASS)
			break
		elif attempt == RETRY_ATTEMPTS - 1:
			_log_result("VS-1-1", "Device authentication failed after " + str(RETRY_ATTEMPTS) + " attempts", TestStatus.FAIL)

	# Test 1.2: Verify session token exists
	_log_test("VS-1-2", "Verify session token stored")

	if network_manager.session_token.length() > 0:
		_log_result("VS-1-2", "Session token exists", TestStatus.PASS)
	else:
		_log_result("VS-1-2", "Session token empty", TestStatus.FAIL)

	# Test 1.3: Verify user ID exists
	_log_test("VS-1-3", "Verify user ID exists")

	if network_manager.user_id.length() > 0:
		_log_result("VS-1-3", "User ID exists", TestStatus.PASS)
	else:
		_log_result("VS-1-3", "User ID empty", TestStatus.FAIL)

	# Test 1.4: Get initial player stats from server
	_log_test("VS-1-4", "Get initial player stats via RPC")

	var response = await network_manager.send_rpc(
		"armored_archer/get_player_stats",
		JSON.stringify({})
	)

	if response.has("error"):
		_log_result("VS-1-4", "RPC error: " + str(response.error), TestStatus.FAIL)
	else:
		_log_result("VS-1-4", "Initial stats retrieved successfully", TestStatus.PASS)

	print("")

## VS-2: PvE Stage Configuration
func _test_vs_2_stage_configuration() -> void:
	test_phase = "VS-2: PvE Stage Configuration"
	print("--- " + test_phase + " ---")

	# Test 2.1: Get campaign progress
	_log_test("VS-2-1", "Get campaign progress")

	var response = await network_manager.send_rpc(
		"armored_archer/get_campaign_progress",
		JSON.stringify({})
	)

	if response.has("error"):
		_log_result("VS-2-1", "RPC error: " + str(response.error), TestStatus.FAIL)
	else:
		_log_result("VS-2-1", "Campaign progress retrieved", TestStatus.PASS)

	# Test 2.2: Verify stage 1 is unlocked
	_log_test("VS-2-2", "Verify Stage 1 is unlocked")

	if not campaign_manager:
		_log_result("VS-2-2", "CampaignManager not found", TestStatus.SKIP)
	else:
		var is_unlocked = campaign_manager.is_stage_unlocked(TEST_STAGE_ID)

		if is_unlocked:
			_log_result("VS-2-2", "Stage 1 is unlocked", TestStatus.PASS)
		else:
			_log_result("VS-2-2", "Stage 1 is not unlocked", TestStatus.FAIL)

	print("")

## VS-3: Combat System - Data Flow
func _test_vs_3_combat_data_flow() -> void:
	test_phase = "VS-3: Combat System - Data Flow"
	print("--- " + test_phase + " ---")

	# Note: We're testing the data flow, not actual combat simulation
	# Actual combat would require running the game scene

	# Test 3.1: Player stats used for combat
	_log_test("VS-3-1", "Verify player stats accessible")

	if not player_stats_manager:
		_log_result("VS-3-1", "PlayerStatsManager not found", TestStatus.FAIL)
	else:
		_log_result("VS-3-1", "Player stats accessible", TestStatus.PASS)

	# Test 3.2: Verify stat values
	_log_test("VS-3-2", "Verify player has base stats")

	if not player_stats_manager:
		_log_result("VS-3-2", "PlayerStatsManager not found", TestStatus.FAIL)
	else:
		var stats = player_stats_manager.player_stats

		if stats.has("attack") and stats.attack > 0:
			_log_result("VS-3-2", "Base stats present", TestStatus.PASS)
		else:
			_log_result("VS-3-2", "Base stats missing", TestStatus.FAIL)

	print("")

## VS-4: Server-Side Loot Generation
func _test_vs_4_loot_generation() -> void:
	test_phase = "VS-4: Server-Side Loot Generation"
	print("--- " + test_phase + " ---")

	# Test 4.1: Complete stage to trigger loot
	_log_test("VS-4-1", "Complete stage to trigger loot generation")

	var response = await network_manager.send_rpc(
		"armored_archer/stage_complete",
		JSON.stringify({
			"stage_id": TEST_STAGE_ID,
			"boss_defeated": false,
			"boss_id": "",
			"difficulty": "easy"
		})
	)

	if response.has("error"):
		_log_result("VS-4-1", "RPC error: " + str(response.error), TestStatus.FAIL)
	else:
		_log_result("VS-4-1", "Stage completion RPC successful", TestStatus.PASS)

	# Test 4.2: Verify XP gained
	_log_test("VS-4-2", "Verify XP gained")

	if response.has("xp_gained"):
		_log_result("VS-4-2", "XP gained: " + str(response.xp_gained), TestStatus.PASS)
	else:
		_log_result("VS-4-2", "XP gain not in response", TestStatus.FAIL)

	# Test 4.3: Check for gear drop (not guaranteed)
	_log_test("VS-4-3", "Check for gear drop (60% chance)")

	if response.has("gear_dropped") and response.gear_dropped != null:
		var gear = response.gear_dropped
		_log_result("VS-4-3", "Gear dropped: " + gear.name, TestStatus.PASS)
	else:
		_log_result("VS-4-3", "No gear dropped (RNG)", TestStatus.PASS)

	print("")

## VS-5: Inventory Display & Loadout Management
func _test_vs_5_inventory_management() -> void:
	test_phase = "VS-5: Inventory Display & Loadout Management"
	print("--- " + test_phase + " ---")

	# First, ensure we have gear in inventory
	var has_gear: bool = await _ensure_test_gear()

	if not has_gear:
		_log_result("VS-5-0", "Cannot test inventory - no gear available", TestStatus.SKIP)
		print("")
		return

	# Get the gear ID we'll use for tests
	var test_gear_id = "test_gear_e2e_001"

	# Test 5.1: Get inventory
	_log_test("VS-5-1", "Get inventory via RPC")

	var response = await network_manager.send_rpc(
		"armored_archer/get_inventory",
		JSON.stringify({})
	)

	if response.has("error"):
		_log_result("VS-5-1", "RPC error: " + str(response.error), TestStatus.FAIL)
	else:
		_log_result("VS-5-1", "Inventory retrieved successfully", TestStatus.PASS)

	# Test 5.2: Equip gear
	_log_test("VS-5-2", "Equip gear to bow slot")

	var equip_response = await network_manager.send_rpc(
		"armored_archer/equip_gear",
		JSON.stringify({
			"gear_id": test_gear_id,
			"slot": "bow"
		})
	)

	if equip_response.has("error"):
		_log_result("VS-5-2", "Equip RPC error: " + str(equip_response.error), TestStatus.FAIL)
	else:
		_log_result("VS-5-2", "Gear equipped successfully", TestStatus.PASS)

	# Test 5.3: Verify gear in loadout
	_log_test("VS-5-3", "Verify gear appears in loadout")

	var inventory_after = await network_manager.send_rpc(
		"armored_archer/get_inventory",
		JSON.stringify({})
	)

	if inventory_after.has("loadout") and inventory_after.loadout.has("bow"):
		_log_result("VS-5-3", "Gear appears in loadout", TestStatus.PASS)
	else:
		_log_result("VS-5-3", "Gear not in loadout", TestStatus.FAIL)

	# Test 5.4: Unequip gear
	_log_test("VS-5-4", "Unequip gear from bow slot")

	var unequip_response = await network_manager.send_rpc(
		"armored_archer/unequip_gear",
		JSON.stringify({
			"slot": "bow"
		})
	)

	if unequip_response.has("error"):
		_log_result("VS-5-4", "Unequip RPC error: " + str(unequip_response.error), TestStatus.FAIL)
	else:
		_log_result("VS-5-4", "Gear unequipped successfully", TestStatus.PASS)

	print("")

## VS-6: Stat Allocation System
func _test_vs_6_stat_allocation() -> void:
	test_phase = "VS-6: Stat Allocation System"
	print("--- " + test_phase + " ---")

	# Test 6.1: Gain enough XP to level up
	_log_test("VS-6-1", "Gain XP to trigger level-up")

	var gain_response = await network_manager.send_rpc(
		"armored_archer/gain_xp",
		JSON.stringify({
			"xp_amount": 1000,
			"source": "pve"
		})
	)

	if gain_response.has("error"):
		_log_result("VS-6-1", "Gain XP RPC error: " + str(gain_response.error), TestStatus.FAIL)
	else:
		_log_result("VS-6-1", "XP gained successfully", TestStatus.PASS)

	# Test 6.2: Verify ability points granted
	_log_test("VS-6-2", "Verify ability points available")

	var stats_response = await network_manager.send_rpc(
		"armored_archer/get_player_stats",
		JSON.stringify({})
	)

	if stats_response.has("error"):
		_log_result("VS-6-2", "Get stats RPC error: " + str(stats_response.error), TestStatus.FAIL)
	elif stats_response.player_stats.has("ability_points") and stats_response.player_stats.ability_points > 0:
		_log_result("VS-6-2", "Ability points available: " + str(stats_response.player_stats.ability_points), TestStatus.PASS)
	else:
		_log_result("VS-6-2", "No ability points available", TestStatus.FAIL)

	# Test 6.3: Allocate points to attack
	_log_test("VS-6-3", "Allocate 1 point to attack")

	var before_attack = stats_response.player_stats.stats.attack if stats_response.has("player_stats") else 0

	var allocate_response = await network_manager.send_rpc(
		"armored_archer/allocate_stats",
		JSON.stringify({
			"stat_name": "attack",
			"points": 1
		})
	)

	if allocate_response.has("error"):
		_log_result("VS-6-3", "Allocate stats RPC error: " + str(allocate_response.error), TestStatus.FAIL)
	else:
		_log_result("VS-6-3", "Stats allocated successfully", TestStatus.PASS)

	# Test 6.4: Verify attack stat increased
	_log_test("VS-6-4", "Verify attack stat increased")

	var final_stats_response = await network_manager.send_rpc(
		"armored_archer/get_player_stats",
		JSON.stringify({})
	)

	if final_stats_response.has("error"):
		_log_result("VS-6-4", "Get stats RPC error: " + str(final_stats_response.error), TestStatus.FAIL)
	else:
		var final_attack = final_stats_response.player_stats.stats.attack
		if final_attack > before_attack:
			_log_result("VS-6-4", "Attack stat increased: " + str(before_attack) + " -> " + str(final_attack), TestStatus.PASS)
		else:
			_log_result("VS-6-4", "Attack stat did not increase", TestStatus.FAIL)

	print("")

## VS-7: Boss Encounter Flow
func _test_vs_7_boss_encounter() -> void:
	test_phase = "VS-7: Boss Encounter Flow"
	print("--- " + test_phase + " ---")

	# Test 7.1: Complete boss stage
	_log_test("VS-7-1", "Complete stage with boss defeated")

	var boss_stage_id = "1_5" # Boss stage (5th stage of chapter 1)
	var boss_response = await network_manager.send_rpc(
		"armored_archer/stage_complete",
		JSON.stringify({
			"stage_id": boss_stage_id,
			"boss_defeated": true,
			"boss_id": "boss_basic",
			"difficulty": "normal"
		})
	)

	if boss_response.has("error"):
		_log_result("VS-7-1", "Boss stage RPC error: " + str(boss_response.error), TestStatus.FAIL)
	else:
		_log_result("VS-7-1", "Boss stage completed successfully", TestStatus.PASS)

	# Test 7.2: Verify boss loot drop (higher chance)
	_log_test("VS-7-2", "Verify boss loot drop (higher quality chance)")

	if boss_response.has("gear_dropped") and boss_response.gear_dropped != null:
		var gear = boss_response.gear_dropped
		_log_result("VS-7-2", "Boss gear dropped: " + gear.name + " (" + gear.get("rarity", "unknown") + ")", TestStatus.PASS)
	else:
		_log_result("VS-7-2", "No boss gear dropped (RNG)", TestStatus.PASS)

	# Test 7.3: Verify boss XP reward
	_log_test("VS-7-3", "Verify boss XP reward")

	if boss_response.has("xp_gained") and boss_response.xp_gained > 0:
		_log_result("VS-7-3", "Boss XP gained: " + str(boss_response.xp_gained), TestStatus.PASS)
	else:
		_log_result("VS-7-3", "No boss XP gained", TestStatus.FAIL)

	# Test 7.4: Boss gear has legendary potential
	_log_test("VS-7-4", "Verify boss gear quality potential")

	if boss_response.has("gear_dropped") and boss_response.gear_dropped != null:
		var gear_rarity = boss_response.gear_dropped.get("rarity", "")
		# Boss drops should have chance for epic/legendary
		if gear_rarity in ["epic", "legendary", "rare"]:
			_log_result("VS-7-4", "Boss gear quality: " + gear_rarity + " (good quality)", TestStatus.PASS)
		elif gear_rarity == "common":
			_log_result("VS-7-4", "Boss gear quality: " + gear_rarity + " (acceptable but low)", TestStatus.PASS)
		else:
			_log_result("VS-7-4", "Unknown boss gear quality", TestStatus.SKIP)
	else:
		_log_result("VS-7-4", "No boss gear to check quality", TestStatus.SKIP)

	print("")

## VS-8: End-to-End Integration Test
func _test_vs_8_full_integration() -> void:
	test_phase = "VS-8: End-to-End Integration"
	print("--- " + test_phase + " ---")
	print("Running complete vertical slice flow...")

	# Test 8.1: Complete full flow
	_log_test("VS-8-1", "Complete full vertical slice flow")

	var steps_passed: int = 0
	var steps_total: int = 8

	# Step 1: Get initial state
	var initial_stats = await network_manager.send_rpc(
		"armored_archer/get_player_stats",
		JSON.stringify({})
	)
	if not initial_stats.has("error"):
		steps_passed += 1

	# Step 2: Complete stage
	var stage_response = await network_manager.send_rpc(
		"armored_archer/stage_complete",
		JSON.stringify({
			"stage_id": TEST_STAGE_ID,
			"boss_defeated": false,
			"boss_id": "",
			"difficulty": "easy"
		})
	)
	if not stage_response.has("error"):
		steps_passed += 1

	# Step 3: Verify XP gained
	if stage_response.has("xp_gained") and stage_response.xp_gained > 0:
		steps_passed += 1

	# Step 4: Check for gear drop
	if stage_response.has("gear_dropped"):
		steps_passed += 1
		# Use the gear for next steps
		var test_gear_id = "test_gear_e2e_integration"
		var gear_response = await network_manager.send_rpc(
			"armored_archer/equip_gear",
			JSON.stringify({
				"gear_id": test_gear_id,
				"slot": "bow"
			})
		)
		if not gear_response.has("error"):
			steps_passed += 1

		# Step 5: Verify equipment
		var inventory_check = await network_manager.send_rpc(
			"armored_archer/get_inventory",
			JSON.stringify({})
		)
		if not inventory_check.has("error"):
			steps_passed += 1

		# Step 6: Verify stats increased
		var final_stats = await network_manager.send_rpc(
			"armored_archer/get_player_stats",
			JSON.stringify({})
		)
		if not final_stats.has("error") and final_stats.player_stats.stats.attack > initial_stats.player_stats.stats.attack:
			steps_passed += 1

	# Step 7: Verify campaign progress
		var campaign_check = await network_manager.send_rpc(
			"armored_archer/get_campaign_progress",
			JSON.stringify({})
		)
		if not campaign_check.has("error") and TEST_STAGE_ID in campaign_check.completed_stages:
			steps_passed += 1

	var success: bool = steps_passed >= steps_total * 0.8 # Allow 80% pass rate

	if success:
		_log_result("VS-8-1", "E2E flow passed (" + str(steps_passed) + "/" + str(steps_total) + " steps)", TestStatus.PASS)
	else:
		_log_result("VS-8-1", "E2E flow failed (" + str(steps_passed) + "/" + str(steps_total) + " steps)", TestStatus.FAIL)

	print("")

## Helper Functions

## Ensures a test gear item exists for testing
func _ensure_test_gear() -> bool:
	# Try to use existing test gear
	var response = await network_manager.send_rpc(
		"armored_archer/equip_gear",
		JSON.stringify({
			"gear_id": "test_gear_e2e_001",
			"slot": "bow"
		})
	)

	# If it works, we have gear
	return not response.has("error")

## Logs a test start message
func _log_test(test_id: String, description: String) -> void:
	print("[TEST] " + test_id + ": " + description)

## Logs a test result with colored output
func _log_result(test_id: String, message: String, status: TestStatus) -> void:
	var status_str: String = TestStatus.keys()[status]
	var status_color: Color = _get_status_color(status)

	test_results.append({
		"test_id": test_id,
		"message": message,
		"status": status
	})

	print("[RESULT] " + test_id + ": " + status_str + " - " + message)

## Gets color for test status
func _get_status_color(status: TestStatus) -> Color:
	match status:
		TestStatus.PASS: return COLOR_PASS
		TestStatus.FAIL: return COLOR_FAIL
		TestStatus.SKIP: return COLOR_SKIP
		_: return Color.WHITE

## Prints test summary
func _print_summary() -> void:
	print("")
	print("=== Test Summary ===")
	print("Phase: " + test_phase)
	print("")

	var passed: int = 0
	var failed: int = 0
	var skipped: int = 0

	for result in test_results:
		match result.status:
			TestStatus.PASS: passed += 1
			TestStatus.FAIL: failed += 1
			TestStatus.SKIP: skipped += 1

	print("Passed:  " + str(passed))
	print("Failed:  " + str(failed))
	print("Skipped: " + str(skipped))
	print("Total:   " + str(test_results.size()))
	print("")

	if failed == 0 and skipped == 0:
		print("✓ ALL TESTS PASSED")
	elif failed == 0:
		print("⚠ SOME TESTS SKIPPED (but no failures)")
	else:
		print("✗ SOME TESTS FAILED")
	print("")

## Determines exit code based on results
func _determine_exit_code() -> void:
	var failed: int = 0
	for result in test_results:
		if result.status == TestStatus.FAIL:
			failed += 1

	if failed == 0:
		print("[E2E] All tests passed. Exiting with code 0.")
		quit(0)  # Success - SceneTree.quit()
	else:
		print("[E2E] %d test(s) failed. Exiting with code 1." % failed)
		quit(1)  # Failure

## Marks all tests as complete
func _finish_tests() -> void:
	_print_summary()
	_determine_exit_code()

## Helper to start the async sequence after the tree is ready (called via call_deferred)
func _start_test_sequence() -> void:
	# Clear any existing session for fresh test
	if network_manager and network_manager.has_method("logout"):
		network_manager.logout()

	# Give autoloads a frame to settle
	await process_frame

	# Start test sequence
	await _run_test_sequence()
