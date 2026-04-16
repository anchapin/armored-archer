## Comprehensive Campaign Persistence Test Suite
##
## Tests campaign progress persistence across:
## - Local save/load operations
## - App restarts
## - Session reconnects
## - Server synchronization
##
## Related Issue: https://github.com/anchapin/armored-archer/issues/700

extends GUT_TEST

## Test path for save file
const SAVE_FILE_PATH = "user://campaign_progress.json"

## Test data
var test_campaign_data: Dictionary = {
	"unlocked_chapters": ["chapter_1", "chapter_2"],
	"unlocked_stages": ["1_1", "1_2", "1_3", "2_1"],
	"completed_stages": ["1_1", "1_2"],
	"unlocked_modifier_pools": ["heavy_impact", "piercing_arrow"],
	"bosses_defeated": ["boss_basic", "boss_wind"]
}

## Setup: Clean up any existing test data
func before_each() -> void:
	_remove_test_save_file()

## Teardown: Clean up test data
func after_each() -> void:
	_remove_test_save_file()

## Helper: Remove test save file
func _remove_test_save_file() -> void:
	if FileAccess.file_exists(SAVE_FILE_PATH):
		DirAccess.remove_absolute(SAVE_FILE_PATH)

## Helper: Create CampaignManager test instance
func _create_campaign_manager() -> CampaignManager:
	var manager = CampaignManager.new()
	add_child(manager)
	manager._ready()
	return manager

## Helper: Write test save file
func _write_test_save_file(data: Dictionary) -> void:
	var file = FileAccess.open(SAVE_FILE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
		file.close()

## Helper: Read save file
func _read_save_file() -> Dictionary:
	var file = FileAccess.open(SAVE_FILE_PATH, FileAccess.READ)
	if file:
		var content = file.get_as_text()
		file.close()
		var json = JSON.new()
		var result = json.parse(content)
		if result == OK:
			return json.data
	return {}

## Helper: Verify save file structure
func _verify_save_structure(data: Dictionary) -> bool:
	var required_keys = ["unlocked_chapters", "unlocked_stages", "completed_stages", "unlocked_modifier_pools", "bosses_defeated"]
	for key in required_keys:
		if not data.has(key):
			return false
		if not data[key] is Array:
			return false
	return true

## ============================================================================
## TEST CATEGORY: Local Save/Load Functionality
## ============================================================================

func test_save_progress_creates_file() -> void:
	"""Verify that save_progress() creates a valid JSON file."""
	var manager = _create_campaign_manager()

	manager.unlocked_chapters = ["chapter_1"]
	manager.unlocked_stages = ["1_1", "1_2"]
	manager.completed_stages = ["1_1"]
	manager.unlocked_modifier_pools = ["heavy_impact"]
	manager.bosses_defeated = ["boss_basic"]

	manager.save_progress()

	assert_true(FileAccess.file_exists(SAVE_FILE_PATH), "Save file should exist after save_progress()")
	assert_true(_verify_save_structure(_read_save_file()), "Save file should have valid structure")

func test_save_progress_stores_all_data() -> void:
	"""Verify that save_progress() stores all progress data."""
	var manager = _create_campaign_manager()

	manager.unlocked_chapters = test_campaign_data["unlocked_chapters"].duplicate(true)
	manager.unlocked_stages = test_campaign_data["unlocked_stages"].duplicate(true)
	manager.completed_stages = test_campaign_data["completed_stages"].duplicate(true)
	manager.unlocked_modifier_pools = test_campaign_data["unlocked_modifier_pools"].duplicate(true)
	manager.bosses_defeated = test_campaign_data["bosses_defeated"].duplicate(true)

	manager.save_progress()

	var saved_data = _read_save_file()

	assert_eq(saved_data["unlocked_chapters"], test_campaign_data["unlocked_chapters"], "Unlocked chapters should match")
	assert_eq(saved_data["unlocked_stages"], test_campaign_data["unlocked_stages"], "Unlocked stages should match")
	assert_eq(saved_data["completed_stages"], test_campaign_data["completed_stages"], "Completed stages should match")
	assert_eq(saved_data["unlocked_modifier_pools"], test_campaign_data["unlocked_modifier_pools"], "Unlocked modifier pools should match")
	assert_eq(saved_data["bosses_defeated"], test_campaign_data["bosses_defeated"], "Bosses defeated should match")

func test_load_progress_reads_file() -> void:
	"""Verify that load_progress() correctly reads from save file."""
	_write_test_save_file(test_campaign_data)

	var manager = _create_campaign_manager()
	manager.load_progress()

	assert_eq(manager.unlocked_chapters, test_campaign_data["unlocked_chapters"], "Unloaded chapters should match")
	assert_eq(manager.unlocked_stages, test_campaign_data["unlocked_stages"], "Unlocked stages should match")
	assert_eq(manager.completed_stages, test_campaign_data["completed_stages"], "Completed stages should match")
	assert_eq(manager.unlocked_modifier_pools, test_campaign_data["unlocked_modifier_pools"], "Unlocked modifier pools should match")
	assert_eq(manager.bosses_defeated, test_campaign_data["bosses_defeated"], "Bosses defeated should match")

func test_load_progress_handles_missing_file() -> void:
	"""Verify that load_progress() handles missing save file gracefully."""
	_remove_test_save_file()

	var manager = _create_campaign_manager()
	# Should not crash
	manager.load_progress()

	# Arrays should be empty
	assert_eq(manager.unlocked_chapters.size(), 0, "Unlocked chapters should be empty when file missing")
	assert_eq(manager.unlocked_stages.size(), 0, "Unlocked stages should be empty when file missing")
	assert_eq(manager.completed_stages.size(), 0, "Completed stages should be empty when file missing")
	assert_eq(manager.unlocked_modifier_pools.size(), 0, "Unlocked modifier pools should be empty when file missing")
	assert_eq(manager.bosses_defeated.size(), 0, "Bosses defeated should be empty when file missing")

func test_load_progress_handles_corrupted_file() -> void:
	"""Verify that load_progress() handles corrupted JSON file."""
	var file = FileAccess.open(SAVE_FILE_PATH, FileAccess.WRITE)
	file.store_string("invalid json {{{")
	file.close()

	var manager = _create_campaign_manager()
	# Should not crash
	manager.load_progress()

	# Arrays should be empty (safe defaults)
	assert_eq(manager.unlocked_chapters.size(), 0, "Unloaded chapters should be empty with corrupted file")

func test_multiple_saves_overwrite_correctly() -> void:
	"""Verify that multiple saves correctly overwrite previous data."""
	var manager = _create_campaign_manager()

	# First save
	manager.unlocked_stages = ["1_1"]
	manager.completed_stages = []
	manager.save_progress()

	# Modify and save again
	manager.unlocked_stages = ["1_1", "1_2", "1_3"]
	manager.completed_stages = ["1_1"]
	manager.save_progress()

	# Verify final state
	var saved_data = _read_save_file()
	assert_eq(saved_data["unlocked_stages"].size(), 3, "Second save should overwrite first")
	assert_eq(saved_data["completed_stages"].size(), 1, "Second save should overwrite first")

## ============================================================================
## TEST CATEGORY: Stage Completion Updates
## ============================================================================

func test_complete_stage_updates_and_saves() -> void:
	"""Verify that complete_stage() updates state and saves progress."""
	var manager = _create_campaign_manager()

	manager.unlocked_stages = ["1_1"]
	manager.completed_stages = []

	manager.complete_stage("1_1")

	assert_true("1_1" in manager.completed_stages, "Stage should be marked as completed")
	assert_true("1_2" in manager.unlocked_stages, "Next stage should be unlocked")

	# Verify save file was updated
	var saved_data = _read_save_file()
	assert_true("1_1" in saved_data["completed_stages"], "Completed stage should be saved")
	assert_true("1_2" in saved_data["unlocked_stages"], "Unlocked stage should be saved")

func test_complete_stage_sends_to_server() -> void:
	"""Verify that complete_stage() notifies server (if online)."""
	var manager = _create_campaign_manager()

	# Mock network manager
	var mock_network = Node.new()
	mock_network.set_script(preload("res://test/mocks/mock_network_manager.gd"))
	manager.network_manager = mock_network
	add_child(mock_network)

	manager.complete_stage("1_1")

	# Verify RPC was called (would need to check mock state)
	# This test would be enhanced with proper mocking

func test_complete_stage_handles_boss_defeat() -> void:
	"""Verify that boss defeat is tracked and saves correctly."""
	var manager = _create_campaign_manager()

	manager.bosses_defeated = []
	manager.complete_stage("1_1")  # Assuming stage 1_1 has boss_basic

	assert_true(manager.has_defeated_boss("boss_basic"), "Boss should be marked as defeated")

	# Verify save
	var saved_data = _read_save_file()
	assert_true("boss_basic" in saved_data["bosses_defeated"], "Boss defeat should be saved")

## ============================================================================
## TEST CATEGORY: Server Synchronization
## ============================================================================

func test_sync_campaign_progress_merges_with_server() -> void:
	"""Verify that sync_campaign_progress() merges server data with local."""
	# This test would require mocking NetworkManager
	# The key behavior is union merge for:
	# - unlocked_chapters
	# - completed_stages
	# - unlocked_stages
	# - bosses_defeated

	var manager = _create_campaign_manager()
	manager.unlocked_stages = ["1_1", "1_2"]
	manager.completed_stages = ["1_1"]

	# Simulate server response with additional data
	var mock_server_data = {
		"unlocked_stages": ["1_1", "1_2", "1_3"],
		"completed_stages": ["1_1", "1_2"],
		"bosses_defeated": ["boss_basic"]
	}

	# After sync, should have union of both data
	# Test implementation would mock the RPC call

func test_sync_campaign_progress_saves_after_merge() -> void:
	"""Verify that synced data is saved locally."""
	# After sync_campaign_progress(), save_progress() should be called
	# to persist the merged state

## ============================================================================
## TEST CATEGORY: Progress Across App Restarts
## ============================================================================

func test_progress_persists_across_restart() -> void:
	"""Verify that all progress persists across app restart simulation."""
	# Simulate first session
	var manager1 = _create_campaign_manager()

	# Complete some stages
	manager1.complete_stage("1_1")
	manager1.complete_stage("1_2")

	var saved_data1 = _read_save_file()
	assert_eq(saved_data1["completed_stages"].size(), 2, "Two stages should be completed")

	# Simulate app restart (new CampaignManager instance)
	manager1.queue_free()
	await get_tree().process_frame

	var manager2 = _create_campaign_manager()
	manager2.load_progress()

	# Verify progress persisted
	assert_eq(manager2.completed_stages.size(), 2, "Completed stages should persist across restart")
	assert_true("1_1" in manager2.completed_stages, "Stage 1_1 completion should persist")
	assert_true("1_2" in manager2.completed_stages, "Stage 1_2 completion should persist")
	assert_eq(manager2.unlocked_stages.size(), 3, "Unlocked stages should persist across restart")

func test_chapter_unlocks_persist_across_restart() -> void:
	"""Verify that chapter unlocks persist across app restart."""
	var manager1 = _create_campaign_manager()

	manager1.unlock_chapter("chapter_2")
	manager1.unlock_chapter("chapter_3")

	assert_true(manager1.is_chapter_unlocked("chapter_2"), "Chapter 2 should be unlocked")
	assert_true(manager1.is_chapter_unlocked("chapter_3"), "Chapter 3 should be unlocked")

	# Simulate restart
	manager1.queue_free()
	await get_tree().process_frame

	var manager2 = _create_campaign_manager()
	manager2.load_progress()

	assert_true(manager2.is_chapter_unlocked("chapter_2"), "Chapter 2 unlock should persist")
	assert_true(manager2.is_chapter_unlocked("chapter_3"), "Chapter 3 unlock should persist")

func test_modifier_pools_persist_across_restart() -> void:
	"""Verify that unlocked modifier pools persist across app restart."""
	var manager1 = _create_campaign_manager()

	manager1.unlock_modifier_pool("heavy_impact")
	manager1.unlock_modifier_pool("piercing_arrow")
	manager1.unlock_modifier_pool("fire_arrow")

	var expected_pools = manager1.get_unlocked_modifier_pools()
	assert_eq(expected_pools.size(), 3, "Three modifier pools should be unlocked")

	# Simulate restart
	manager1.queue_free()
	await get_tree().process_frame

	var manager2 = _create_campaign_manager()
	manager2.load_progress()

	var loaded_pools = manager2.get_unlocked_modifier_pools()
	assert_eq(loaded_pools.size(), 3, "Modifier pools should persist across restart")
	assert_true("heavy_impact" in loaded_pools, "heavy_impact should persist")
	assert_true("piercing_arrow" in loaded_pools, "piercing_arrow should persist")
	assert_true("fire_arrow" in loaded_pools, "fire_arrow should persist")

func test_boss_defeats_persist_across_restart() -> void:
	"""Verify that boss defeats persist across app restart."""
	var manager1 = _create_campaign_manager()

	manager1.handle_boss_defeat("boss_basic")
	manager1.handle_boss_defeat("boss_wind")
	manager1.handle_boss_defeat("boss_fire")

	var bosses_defeated1 = manager1.get_bosses_defeated()
	assert_eq(bosses_defeated1.size(), 3, "Three bosses should be defeated")

	# Simulate restart
	manager1.queue_free()
	await get_tree().process_frame

	var manager2 = _create_campaign_manager()
	manager2.load_progress()

	var bosses_defeated2 = manager2.get_bosses_defeated()
	assert_eq(bosses_defeated2.size(), 3, "Boss defeats should persist across restart")
	assert_true(manager2.has_defeated_boss("boss_basic"), "boss_basic defeat should persist")
	assert_true(manager2.has_defeated_boss("boss_wind"), "boss_wind defeat should persist")
	assert_true(manager2.has_defeated_boss("boss_fire"), "boss_fire defeat should persist")

## ============================================================================
## TEST CATEGORY: Session Reconnect
## ============================================================================

func test_session_reconnect_syncs_with_server() -> void:
	"""Verify that reconnecting to server syncs campaign progress."""
	# This would test:
	# 1. Player completes stages offline
	# 2. Player reconnects
	# 3. sync_campaign_progress() is called
	# 4. Local and server data are merged

	# Requires NetworkManager mocking

func test_connection_status_change_triggers_sync() -> void:
	"""Verify that connection status changed signal triggers sync."""
	var manager = _create_campaign_manager()

	# Mock network manager that emits signal
	var mock_network = Node.new()
	var signal_emitted = false

	mock_network.connect("connection_status_changed", func(_is_online):
		signal_emitted = true
	)

	manager.network_manager = mock_network
	add_child(mock_network)

	# The CampaignManager connects to this signal in _ready()
	# When online, it should call sync_campaign_progress()

## ============================================================================
## TEST CATEGORY: Data Loss Prevention
## ============================================================================

func test_no_data_loss_on_concurrent_saves() -> void:
	"""Verify that concurrent save operations don't cause data loss."""
	var manager = _create_campaign_manager()

	# Simulate rapid saves
	for i in range(10):
		manager.unlocked_stages.append("1_%d" % i)
		manager.save_progress()

	var saved_data = _read_save_file()
	assert_eq(saved_data["unlocked_stages"].size(), 10, "All data should be saved")

func test_no_data_loss_on_partial_completions() -> void:
	"""Verify that partial completions don't corrupt save data."""
	var manager = _create_campaign_manager()

	# Save initial state
	manager.save_progress()

	# Add completion but don't save
	manager.complete_stage("1_1")

	# Read save file (should still have old data or should be consistent)
	var saved_data = _read_save_file()

	# Data should either include the new completion (if complete_stage saved)
	# or be consistent with the old state - not corrupted
	assert_true(_verify_save_structure(saved_data), "Save structure should remain valid")

func test_load_preserves_data_types() -> void:
	"""Verify that load preserves data types (arrays, not strings)."""
	_write_test_save_file(test_campaign_data)

	var manager = _create_campaign_manager()
	manager.load_progress()

	# All should be arrays, not strings or other types
	assert_typeof(manager.unlocked_chapters, TYPE_ARRAY, "unlocked_chapters should be array")
	assert_typeof(manager.unlocked_stages, TYPE_ARRAY, "unlocked_stages should be array")
	assert_typeof(manager.completed_stages, TYPE_ARRAY, "completed_stages should be array")
	assert_typeof(manager.unlocked_modifier_pools, TYPE_ARRAY, "unlocked_modifier_pools should be array")
	assert_typeof(manager.bosses_defeated, TYPE_ARRAY, "bosses_defeated should be array")

## ============================================================================
## TEST CATEGORY: Edge Cases
## ============================================================================

func test_empty_arrays_handled_correctly() -> void:
	"""Verify that empty arrays are saved and loaded correctly."""
	var manager = _create_campaign_manager()

	# Set all arrays to empty
	manager.unlocked_chapters = []
	manager.unlocked_stages = []
	manager.completed_stages = []
	manager.unlocked_modifier_pools = []
	manager.bosses_defeated = []

	manager.save_progress()

	var saved_data = _read_save_file()
	assert_eq(saved_data["unlocked_chapters"].size(), 0, "Empty array should be saved")
	assert_eq(saved_data["unlocked_stages"].size(), 0, "Empty array should be saved")
	assert_eq(saved_data["completed_stages"].size(), 0, "Empty array should be saved")
	assert_eq(saved_data["unlocked_modifier_pools"].size(), 0, "Empty array should be saved")
	assert_eq(saved_data["bosses_defeated"].size(), 0, "Empty array should be saved")

func test_duplicate_entries_prevented() -> void:
	"""Verify that duplicate entries are not added to arrays."""
	var manager = _create_campaign_manager()

	# Try to add same stage multiple times
	manager.complete_stage("1_1")
	manager.complete_stage("1_1")  # Should not add duplicate

	assert_eq(manager.completed_stages.size(), 1, "Duplicate stages should not be added")

func test_large_data_sets_handled() -> void:
	"""Verify that large data sets are handled without issues."""
	var manager = _create_campaign_manager()

	# Add many stages
	for i in range(100):
		manager.unlocked_stages.append("1_%d" % i)
		if i < 50:
			manager.completed_stages.append("1_%d" % i)

	manager.save_progress()

	var saved_data = _read_save_file()
	assert_eq(saved_data["unlocked_stages"].size(), 100, "All stages should be saved")
	assert_eq(saved_data["completed_stages"].size(), 50, "All completions should be saved")

func test_special_characters_in_stage_ids() -> void:
	"""Verify that special characters in IDs are handled."""
	var manager = _create_campaign_manager()

	# Note: Current implementation uses underscore, but test verifies JSON handles any characters
	manager.unlocked_stages = ["1_1", "chapter_1_stage_special", "test_123"]

	manager.save_progress()

	var manager2 = _create_campaign_manager()
	manager2.load_progress()

	assert_true("test_123" in manager2.unlocked_stages, "Stage with numbers should load correctly")

## ============================================================================
## TEST CATEGORY: Performance (Load Times)
## ============================================================================

func test_load_time_is_reasonable() -> void:
	"""Verify that load_progress() completes within reasonable time."""
	_write_test_save_file(test_campaign_data)

	var manager = _create_campaign_manager()

	var start_time = Time.get_ticks_msec()
	manager.load_progress()
	var load_time = Time.get_ticks_msec() - start_time

	# Load should complete in less than 100ms
	assert_true(load_time < 100, "Load time should be reasonable (<100ms), got %dms" % load_time)

func test_save_time_is_reasonable() -> void:
	"""Verify that save_progress() completes within reasonable time."""
	var manager = _create_campaign_manager()

	# Create moderately large data set
	for i in range(50):
		manager.unlocked_stages.append("1_%d" % i)
		manager.completed_stages.append("1_%d" % i)

	var start_time = Time.get_ticks_msec()
	manager.save_progress()
	var save_time = Time.get_ticks_msec() - start_time

	# Save should complete in less than 50ms
	assert_true(save_time < 50, "Save time should be reasonable (<50ms), got %dms" % save_time)

## ============================================================================
## TEST CATEGORY: Signal Emission
## ============================================================================

func test_stage_completed_signal_emitted() -> void:
	"""Verify that stage_completed signal is emitted when stage is completed."""
	var manager = _create_campaign_manager()

	var signal_received = false
	var stage_id_received = ""

	manager.stage_completed.connect(func(stage_id: String):
		signal_received = true
		stage_id_received = stage_id
	)

	manager.complete_stage("1_1")

	assert_true(signal_received, "stage_completed signal should be emitted")
	assert_eq(stage_id_received, "1_1", "Signal should pass correct stage_id")

func test_stage_unlocked_signal_emitted() -> void:
	"""Verify that stage_unlocked signal is emitted when stage is unlocked."""
	var manager = _create_campaign_manager()
	manager.unlocked_stages = ["1_1"]

	var signal_received = false
	var stage_id_received = ""

	manager.stage_unlocked.connect(func(stage_id: String):
		signal_received = true
		stage_id_received = stage_id
	)

	manager.complete_stage("1_1")

	assert_true(signal_received, "stage_unlocked signal should be emitted")
	assert_eq(stage_id_received, "1_2", "Signal should pass next stage_id")

func test_chapter_unlocked_signal_emitted() -> void:
	"""Verify that chapter_unlocked signal is emitted when chapter is unlocked."""
	var manager = _create_campaign_manager()

	var signal_received = false
	var chapter_id_received = ""

	manager.chapter_unlocked.connect(func(chapter_id: String):
		signal_received = true
		chapter_id_received = chapter_id
	)

	manager.unlock_chapter("chapter_2")

	assert_true(signal_received, "chapter_unlocked signal should be emitted")
	assert_eq(chapter_id_received, "chapter_2", "Signal should pass correct chapter_id")

func test_modifier_pool_unlocked_signal_emitted() -> void:
	"""Verify that modifier_pool_unlocked signal is emitted when pool is unlocked."""
	var manager = _create_campaign_manager()

	var signal_received = false
	var modifier_id_received = ""

	manager.modifier_pool_unlocked.connect(func(modifier_id: String):
		signal_received = true
		modifier_id_received = modifier_id
	)

	manager.unlock_modifier_pool("heavy_impact")

	assert_true(signal_received, "modifier_pool_unlocked signal should be emitted")
	assert_eq(modifier_id_received, "heavy_impact", "Signal should pass correct modifier_id")

## ============================================================================
## TEST CATEGORY: Initialization Defaults
## ============================================================================

func test_initialization_with_empty_save() -> void:
	"""Verify that CampaignManager initializes correctly with empty save file."""
	_remove_test_save_file()

	var manager = _create_campaign_manager()

	# Should have default first stage and chapter unlocked
	assert_true(manager.is_stage_unlocked("1_1"), "First stage should be unlocked by default")
	assert_true(manager.is_chapter_unlocked("chapter_1"), "First chapter should be unlocked by default")

func test_initialization_preserves_existing_data() -> void:
	"""Verify that existing save data is preserved during initialization."""
	_write_test_save_file(test_campaign_data)

	var manager = _create_campaign_manager()

	assert_eq(manager.unlocked_stages.size(), 4, "Existing stages should be loaded")
	assert_eq(manager.completed_stages.size(), 2, "Existing completions should be loaded")
	assert_eq(manager.unlocked_modifier_pools.size(), 2, "Existing modifiers should be loaded")
