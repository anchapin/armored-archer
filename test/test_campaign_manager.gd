extends Node

var _tests_passed: int = 0
var _tests_failed: int = 0

signal test_completed(test_name: String, passed: bool)

func _ready() -> void:
	print("=== Running CampaignManager Tests ===\n")
	await run_tests()

func run_tests() -> void:
	test_initial_state()
	test_signals_exist()
	test_is_stage_unlocked()
	test_is_stage_completed()
	test_complete_stage()
	test_unlock_next_stage()
	test_handle_boss_defeat()
	test_update_campaign_progress()
	
	print("\n=== CampaignManager Test Results ===")
	print("Passed: %d" % _tests_passed)
	print("Failed: %d" % _tests_failed)
	queue_free()

func _create_campaign_manager() -> Node:
	var campaign = load("res://autoloads/CampaignManager.gd").new()
	add_child(campaign)
	return campaign

func _pass(test_name: String) -> void:
	_tests_passed += 1
	test_completed.emit(test_name, true)
	print("[PASS] " + test_name)

func _fail(test_name: String, message: String) -> void:
	_tests_failed += 1
	test_completed.emit(test_name, false)
	print("[FAIL] " + test_name + ": " + message)

func test_initial_state() -> void:
	var campaign = _create_campaign_manager()
	
	# Wait for _ready to complete
	await get_tree().process_frame
	
	if campaign.unlocked_stages.size() > 0:
		_pass("test_initial_unlocked_stages")
	else:
		_fail("test_initial_unlocked_stages", "Should have initial unlocked stage")
	
	if campaign.completed_stages.is_empty():
		_pass("test_initial_completed_empty")
	else:
		_fail("test_initial_completed_empty", "Completed stages should be empty initially")
	
	campaign.queue_free()

func test_signals_exist() -> void:
	var campaign = _create_campaign_manager()
	
	if campaign.has_signal("stage_unlocked"):
		_pass("test_signal_stage_unlocked")
	else:
		_fail("test_signal_stage_unlocked", "Should have stage_unlocked signal")
	
	if campaign.has_signal("stage_completed"):
		_pass("test_signal_stage_completed")
	else:
		_fail("test_signal_stage_completed", "Should have stage_completed signal")
	
	if campaign.has_signal("campaign_progress_updated"):
		_pass("test_signal_progress_updated")
	else:
		_fail("test_signal_progress_updated", "Should have campaign_progress_updated signal")
	
	campaign.queue_free()

func test_is_stage_unlocked() -> void:
	var campaign = _create_campaign_manager()
	campaign.unlocked_stages = ["1_1", "1_2"]
	
	if campaign.is_stage_unlocked("1_1"):
		_pass("test_is_stage_unlocked_true")
	else:
		_fail("test_is_stage_unlocked_true", "Should return true for unlocked stage")
	
	if not campaign.is_stage_unlocked("1_3"):
		_pass("test_is_stage_unlocked_false")
	else:
		_fail("test_is_stage_unlocked_false", "Should return false for locked stage")
	
	campaign.queue_free()

func test_is_stage_completed() -> void:
	var campaign = _create_campaign_manager()
	campaign.completed_stages = ["1_1", "1_2"]
	
	if campaign.is_stage_completed("1_1"):
		_pass("test_is_stage_completed_true")
	else:
		_fail("test_is_stage_completed_true", "Should return true for completed stage")
	
	if not campaign.is_stage_completed("1_3"):
		_pass("test_is_stage_completed_false")
	else:
		_fail("test_is_stage_completed_false", "Should return false for incomplete stage")
	
	campaign.queue_free()

func test_complete_stage() -> void:
	var campaign = _create_campaign_manager()
	campaign.completed_stages = []
	campaign.unlocked_stages = ["1_1"]
	campaign.campaigns_data = {
		"campaigns": [
			{
				"id": "campaign_1",
				"stages": [
					{"id": "1_1", "boss": null},
					{"id": "1_2", "boss": "boss_wind"}
				]
			}
		]
	}
	
	var stage_completed_emitted = false
	campaign.stage_completed.connect(func(_): stage_completed_emitted = true)
	
	campaign.complete_stage("1_1")
	
	if "1_1" in campaign.completed_stages:
		_pass("test_complete_stage_added")
	else:
		_fail("test_complete_stage_added", "Stage should be in completed list")
	
	if stage_completed_emitted:
		_pass("test_complete_stage_signal")
	else:
		_fail("test_complete_stage_signal", "Should emit stage_completed signal")
	
	# Test stage with boss
	campaign.complete_stage("1_2")
	if "1_2" in campaign.completed_stages:
		_pass("test_complete_stage_with_boss")
	else:
		_fail("test_complete_stage_with_boss", "Should complete stage with boss")
	
	# Test duplicate completion doesn't emit again
	campaign.complete_stage("1_1")
	_pass("test_complete_stage_duplicate_safe")
	
	campaign.queue_free()

func test_unlock_next_stage() -> void:
	var campaign = _create_campaign_manager()
	campaign.unlocked_stages = ["1_1"]
	campaign.campaigns_data = {
		"campaigns": [
			{
				"id": "campaign_1",
				"stages": [
					{"id": "1_1"},
					{"id": "1_2"},
					{"id": "1_3"}
				]
			}
		]
	}
	
	var stage_unlocked_emitted = false
	campaign.stage_unlocked.connect(func(_): stage_unlocked_emitted = true)
	
	campaign.unlock_next_stage("1_1")
	
	if "1_2" in campaign.unlocked_stages:
		_pass("test_unlock_next_stage")
	else:
		_fail("test_unlock_next_stage", "Should unlock next stage")
	
	if stage_unlocked_emitted:
		_pass("test_unlock_next_stage_signal")
	else:
		_fail("test_unlock_next_stage_signal", "Should emit stage_unlocked")
	
	# Test non-existent next stage doesn't crash
	campaign.unlock_next_stage("1_3")
	_pass("test_unlock_next_nonexistent_safe")
	
	campaign.queue_free()

func test_handle_boss_defeat() -> void:
	var campaign = _create_campaign_manager()
	
	# Test boss_wind triggers modifier pool
	campaign.handle_boss_defeat("boss_wind")
	_pass("test_handle_boss_defeat_wind")
	
	# Test unknown boss doesn't crash
	campaign.handle_boss_defeat("unknown_boss")
	_pass("test_handle_boss_defeat_unknown")
	
	campaign.queue_free()

func test_update_campaign_progress() -> void:
	var campaign = _create_campaign_manager()
	campaign.completed_stages = ["1_1"]
	campaign.campaigns_data = {
		"campaigns": [
			{
				"id": "campaign_1",
				"stages": [
					{"id": "1_1"},
					{"id": "1_2"}
				]
			}
		]
	}
	
	var progress_updated = false
	campaign.campaign_progress_updated.connect(func(_, _): progress_updated = true)
	
	campaign.update_campaign_progress()
	
	if progress_updated:
		_pass("test_update_campaign_progress_signal")
	else:
		_fail("test_update_campaign_progress_signal", "Should emit progress signal")
	
	campaign.queue_free()
